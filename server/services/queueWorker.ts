import crypto from 'crypto';
import { getDb } from '../db.js';
import { config } from '../config.js';
import { getGmailClientForAdmin } from './googleAuth.js';
import { buildRawMimeMessage, renderTextTemplate, renderHtmlFromText } from '../utils/emailSanitizer.js';

let workerIntervalId: NodeJS.Timeout | null = null;
const WORKER_ID = `worker_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;

export function startQueueWorker() {
  if (workerIntervalId) return;

  console.log(`[Queue Worker] Started worker instance ${WORKER_ID}`);
  workerIntervalId = setInterval(async () => {
    try {
      await processNextQueueItem();
    } catch (err) {
      console.error('[Queue Worker] Error in worker tick:', err);
    }
  }, config.sendIntervalMs);
}

export function stopQueueWorker() {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
    console.log(`[Queue Worker] Stopped worker instance ${WORKER_ID}`);
  }
}

async function processNextQueueItem() {
  if (!config.isFeatureEnabled) return;

  const db = await getDb();
  const now = Date.now();
  const leaseExpiresAt = now + config.leaseTimeoutSeconds * 1000;
  const adminId = 'admin_single_tenant';

  // Atomic Claim Query
  const itemToClaim = await db.get(
    `SELECT i.id, i.job_id, i.recipient_id, i.attempt_count, j.event_id, j.event_name, j.message_type, j.message_cycle, j.status as job_status,
            t.subject_raw, t.body_text_raw, t.reply_to,
            r.guest_id, r.guest_name, r.recipient_email, r.table_name
     FROM email_job_items i
     JOIN email_jobs j ON i.job_id = j.id
     JOIN job_templates t ON j.id = t.job_id
     JOIN job_recipients r ON i.recipient_id = r.id
     WHERE i.status = 'PENDING'
       AND (i.next_attempt_at IS NULL OR i.next_attempt_at <= ?)
       AND (i.lease_expires_at IS NULL OR i.lease_expires_at < ?)
       AND j.status IN ('QUEUED', 'PROCESSING')
       AND j.admin_id = ?
     ORDER BY i.created_at ASC
     LIMIT 1;`,
    [now, now, adminId]
  );

  if (!itemToClaim) {
    return;
  }

  // Update item to PROCESSING
  const updated = await db.run(
    `UPDATE email_job_items 
     SET status = 'PROCESSING', leased_by = ?, lease_expires_at = ?, attempt_count = attempt_count + 1
     WHERE id = ? AND status = 'PENDING';`,
    [WORKER_ID, leaseExpiresAt, itemToClaim.id]
  );

  if (updated.changes === 0) {
    // Concurrent worker claimed row first
    return;
  }

  // Update parent job status to PROCESSING if it was QUEUED
  await db.run(
    `UPDATE email_jobs SET status = 'PROCESSING', updated_at = ? WHERE id = ? AND status = 'QUEUED';`,
    [now, itemToClaim.job_id]
  );

  // Check cancellation
  if (itemToClaim.job_status === 'CANCELLED') {
    await db.run(
      `UPDATE email_job_items SET status = 'CANCELLED', leased_by = NULL, lease_expires_at = NULL WHERE id = ?;`,
      [itemToClaim.id]
    );
    await updateJobCounters(itemToClaim.job_id);
    return;
  }

  // Check suppression
  const suppressionRow = await db.get(
    `SELECT id FROM suppression WHERE admin_id = ? AND event_id = ? AND guest_id = ?;`,
    [adminId, itemToClaim.event_id, itemToClaim.guest_id]
  );

  if (suppressionRow) {
    await db.run(
      `UPDATE email_job_items SET status = 'CANCELLED', error_code = 'SUPPRESSED_BY_GUEST', leased_by = NULL, lease_expires_at = NULL WHERE id = ?;`,
      [itemToClaim.id]
    );
    await updateJobCounters(itemToClaim.job_id);
    return;
  }

  // Generate unique suppression token for List-Unsubscribe header
  let suppressionToken = '';
  const existingTokenRow = await db.get(
    `SELECT token FROM suppression WHERE admin_id = ? AND event_id = ? AND guest_id = ?;`,
    [adminId, itemToClaim.event_id, itemToClaim.guest_id]
  );

  if (existingTokenRow) {
    suppressionToken = existingTokenRow.token;
  } else {
    suppressionToken = crypto.randomBytes(32).toString('base64url');
  }

  const unsubscribeUrl = `${config.appUrl}/unsubscribe?t=${suppressionToken}`;

  // Render text and HTML bodies
  const renderCtx = {
    guest_name: itemToClaim.guest_name,
    event_name: itemToClaim.event_name,
    table_name: itemToClaim.table_name || undefined,
    unsubscribe_url: unsubscribeUrl,
  };

  const renderedSubject = renderTextTemplate(itemToClaim.subject_raw, renderCtx);
  const renderedText = renderTextTemplate(itemToClaim.body_text_raw, renderCtx);
  const renderedHtml = renderHtmlFromText(itemToClaim.body_text_raw, renderCtx);

  try {
    const gmail = await getGmailClientForAdmin(adminId);
    const connRow = await db.get(
      `SELECT email FROM oauth_connections WHERE admin_id = ?;`,
      [adminId]
    );
    const senderEmail = connRow?.email || 'me';

    const rawMime = await buildRawMimeMessage({
      from: senderEmail,
      to: `${itemToClaim.guest_name} <${itemToClaim.recipient_email}>`,
      subject: renderedSubject,
      text: renderedText,
      html: renderedHtml,
      replyTo: itemToClaim.reply_to || undefined,
      listUnsubscribeUrl: unsubscribeUrl,
    });

    const sendRes = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMime,
      },
    });

    const gmailMessageId = sendRes.data.id || `msg_${crypto.randomUUID()}`;

    // Update item status to ACCEPTED_BY_GMAIL
    await db.run(
      `UPDATE email_job_items 
       SET status = 'ACCEPTED_BY_GMAIL', gmail_message_id = ?, sent_at = ?, leased_by = NULL, lease_expires_at = NULL
       WHERE id = ?;`,
      [gmailMessageId, Date.now(), itemToClaim.id]
    );

    // Record in sent_record for business-level duplicate prevention
    const sentRecordId = crypto.randomUUID();
    await db.run(
      `INSERT INTO sent_record 
        (id, admin_id, event_id, guest_id, message_type, message_cycle, job_item_id, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(admin_id, event_id, guest_id, message_type, message_cycle) DO NOTHING;`,
      [
        sentRecordId,
        adminId,
        itemToClaim.event_id,
        itemToClaim.guest_id,
        itemToClaim.message_type,
        itemToClaim.message_cycle,
        itemToClaim.id,
        Date.now(),
      ]
    );

    await updateJobCounters(itemToClaim.job_id);
  } catch (err: any) {
    console.error(`[Queue Worker] Send error for item ${itemToClaim.id}:`, err?.message || err);

    const isPermanent = err.status === 400 || err.code === 400 || String(err.message).includes('invalid recipient');
    const isTimeout = err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT' || String(err.message).includes('timeout');

    if (isPermanent) {
      await db.run(
        `UPDATE email_job_items 
         SET status = 'FAILED', is_permanent_fail = 1, error_code = 'PERMANENT_RECIPIENT_FAIL', error_detail = ?, leased_by = NULL, lease_expires_at = NULL
         WHERE id = ?;`,
        ['Invalid recipient or bad request format', itemToClaim.id]
      );
    } else if (isTimeout) {
      // Ambiguous timeout: do not auto-retry. Mark UNKNOWN.
      await db.run(
        `UPDATE email_job_items 
         SET status = 'UNKNOWN', error_code = 'GMAIL_AMBIGUOUS_TIMEOUT', error_detail = ?, leased_by = NULL, lease_expires_at = NULL
         WHERE id = ?;`,
        ['Gmail API call timed out after dispatch. Operator review required.', itemToClaim.id]
      );
    } else {
      // Transient error: Exponential backoff with jitter
      const attempts = itemToClaim.attempt_count + 1;
      if (attempts >= config.maxRetryAttempts) {
        await db.run(
          `UPDATE email_job_items 
           SET status = 'FAILED', is_permanent_fail = 0, error_code = 'MAX_RETRIES_EXCEEDED', error_detail = ?, leased_by = NULL, lease_expires_at = NULL
           WHERE id = ?;`,
          ['Exceeded maximum retry attempts', itemToClaim.id]
        );
      } else {
        const baseDelay = Math.min(300000, 10000 * Math.pow(2, attempts - 1));
        const jitter = 0.8 + Math.random() * 0.4;
        const nextAttemptAt = Date.now() + Math.round(baseDelay * jitter);

        await db.run(
          `UPDATE email_job_items 
           SET status = 'PENDING', next_attempt_at = ?, error_code = 'TRANSIENT_ERROR', leased_by = NULL, lease_expires_at = NULL
           WHERE id = ?;`,
          [nextAttemptAt, itemToClaim.id]
        );
      }
    }

    await updateJobCounters(itemToClaim.job_id);
  }
}

async function updateJobCounters(jobId: string) {
  const db = await getDb();
  const counts = await db.get(
    `SELECT 
        COUNT(CASE WHEN status = 'ACCEPTED_BY_GMAIL' THEN 1 END) as sent_count,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_count,
        COUNT(CASE WHEN status = 'UNKNOWN' THEN 1 END) as unknown_count,
        COUNT(CASE WHEN status IN ('PENDING', 'PROCESSING') THEN 1 END) as remaining_count,
        COUNT(*) as total_count
     FROM email_job_items
     WHERE job_id = ?;`,
    [jobId]
  );

  if (!counts) return;

  const now = Date.now();
  const isFinished = counts.remaining_count === 0;
  const newStatus = isFinished ? 'COMPLETED' : 'PROCESSING';

  await db.run(
    `UPDATE email_jobs 
     SET sent_count = ?, failed_count = ?, unknown_count = ?, status = ?, updated_at = ?
     WHERE id = ?;`,
    [counts.sent_count, counts.failed_count, counts.unknown_count, newStatus, now, jobId]
  );
}
