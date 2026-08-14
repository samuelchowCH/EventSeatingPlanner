import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getDb } from '../db.js';
import { config } from '../config.js';
import {
  validateEmailAddress,
  validateHeaderField,
  validateTemplatePlaceholders,
  renderTextTemplate,
  renderHtmlFromText,
  buildRawMimeMessage,
} from '../utils/emailSanitizer.js';
import { getGmailClientForAdmin } from '../services/googleAuth.js';

const router = Router();

// POST /api/invitations/stage
router.post('/stage', requireAdmin, async (req: Request, res: Response) => {
  const adminId = req.session.adminId || 'admin_single_tenant';
  const { event_id, event_name, message_type, message_cycle, guests, template, idempotency_key } = req.body || {};

  if (!event_id || !event_name || !message_type || !guests || !Array.isArray(guests) || !template) {
    return res.status(400).json({ error: 'Missing required staging fields (event_id, event_name, message_type, guests array, template object)' });
  }

  if (!['INVITATION', 'REMINDER'].includes(message_type)) {
    return res.status(400).json({ error: 'Invalid message_type (must be INVITATION or REMINDER)' });
  }

  const cycleNum = parseInt(message_cycle || '1', 10);
  const idempotencyKeyStr = idempotency_key ? String(idempotency_key) : crypto.randomUUID();

  // Validate template
  try {
    validateHeaderField(template.subject || '', 'Subject');
    if (template.reply_to) {
      validateHeaderField(template.reply_to, 'Reply-To');
      if (!validateEmailAddress(template.reply_to)) {
        return res.status(400).json({ error: 'Invalid Reply-To email address' });
      }
    }
    validateTemplatePlaceholders(template.subject || '');
    validateTemplatePlaceholders(template.body_text || '');
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  if (guests.length > config.batchCap) {
    return res.status(400).json({ error: `Guest batch exceeds maximum allowed cap of ${config.batchCap} recipients per batch` });
  }

  const db = await getDb();

  // Filter recipients
  const validRecipients: any[] = [];
  let skippedNoEmailCount = 0;
  let skippedSuppressedCount = 0;
  let skippedAlreadySentCount = 0;

  for (const g of guests) {
    if (!g.guest_id || !g.guest_name || !g.recipient_email || !validateEmailAddress(g.recipient_email)) {
      skippedNoEmailCount++;
      continue;
    }

    // Check suppression
    const suppRow = await db.get(
      `SELECT id FROM suppression WHERE admin_id = ? AND event_id = ? AND guest_id = ?;`,
      [adminId, event_id, g.guest_id]
    );

    if (suppRow) {
      skippedSuppressedCount++;
      continue;
    }

    // Check sent_record for business-level duplicate prevention
    const sentRow = await db.get(
      `SELECT id FROM sent_record WHERE admin_id = ? AND event_id = ? AND guest_id = ? AND message_type = ? AND message_cycle = ?;`,
      [adminId, event_id, g.guest_id, message_type, cycleNum]
    );

    if (sentRow) {
      skippedAlreadySentCount++;
      continue;
    }

    validRecipients.push({
      guest_id: String(g.guest_id),
      guest_name: String(g.guest_name).trim(),
      recipient_email: String(g.recipient_email).trim(),
      table_name: g.table_name ? String(g.table_name).trim() : null,
    });
  }

  if (validRecipients.length === 0) {
    return res.status(400).json({
      error: 'No eligible recipients found in batch after filtering',
      summary: {
        valid_recipient_count: 0,
        skipped_no_email_count: skippedNoEmailCount,
        skipped_suppressed_count: skippedSuppressedCount,
        skipped_already_sent_count: skippedAlreadySentCount,
      },
    });
  }

  // Canonical request hash for idempotency validation
  const requestPayloadString = JSON.stringify({
    event_id,
    message_type,
    message_cycle: cycleNum,
    recipients: validRecipients,
    template,
  });
  const requestHash = crypto.createHash('sha256').update(requestPayloadString).digest('hex');

  // Check if idempotency key was already used with a different body
  const existingJob = await db.get(
    `SELECT id, request_hash FROM email_jobs WHERE admin_id = ? AND idempotency_key = ?;`,
    [adminId, idempotencyKeyStr]
  );

  if (existingJob) {
    if (existingJob.request_hash !== requestHash) {
      return res.status(409).json({ error: 'Idempotency key reused with a different payload body' });
    }
    // Same idempotency key and same body: return existing job ID directly
    return res.json({
      existing_job_id: existingJob.id,
      summary: {
        valid_recipient_count: validRecipients.length,
        skipped_no_email_count: skippedNoEmailCount,
        skipped_suppressed_count: skippedSuppressedCount,
        skipped_already_sent_count: skippedAlreadySentCount,
      },
    });
  }

  // Create short-lived confirmation token (TTL 5 minutes)
  const confirmationToken = crypto.randomUUID();
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const now = Date.now();

  await db.run(
    `INSERT INTO staged_jobs 
      (confirmation_token, admin_id, event_id, event_name, message_type, message_cycle, idempotency_key, request_hash, template_json, recipients_json, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      confirmationToken,
      adminId,
      event_id,
      event_name,
      message_type,
      cycleNum,
      idempotencyKeyStr,
      requestHash,
      JSON.stringify(template),
      JSON.stringify(validRecipients),
      now + FIVE_MINUTES_MS,
      now,
    ]
  );

  // Render preview using first valid recipient's data
  const sampleRecipient = validRecipients[0];
  const previewCtx = {
    guest_name: sampleRecipient.guest_name,
    event_name,
    table_name: sampleRecipient.table_name || undefined,
    unsubscribe_url: `${config.appUrl}/unsubscribe?t=sample_token`,
  };

  const subjectPreview = renderTextTemplate(template.subject, previewCtx);
  const bodyTextPreview = renderTextTemplate(template.body_text, previewCtx);

  return res.json({
    confirmation_token: confirmationToken,
    expires_at: now + FIVE_MINUTES_MS,
    summary: {
      valid_recipient_count: validRecipients.length,
      skipped_no_email_count: skippedNoEmailCount,
      skipped_suppressed_count: skippedSuppressedCount,
      skipped_already_sent_count: skippedAlreadySentCount,
      subject_preview: subjectPreview,
      body_text_preview: bodyTextPreview,
    },
  });
});

// POST /api/invitations/confirm
router.post('/confirm', requireAdmin, async (req: Request, res: Response) => {
  const adminId = req.session.adminId || 'admin_single_tenant';
  const { confirmation_token } = req.body || {};

  if (!confirmation_token || typeof confirmation_token !== 'string') {
    return res.status(400).json({ error: 'Missing confirmation_token' });
  }

  const db = await getDb();
  const staged = await db.get(
    `SELECT * FROM staged_jobs WHERE confirmation_token = ? AND admin_id = ?;`,
    [confirmation_token, adminId]
  );

  if (!staged) {
    return res.status(404).json({ error: 'Staged job confirmation token invalid or expired' });
  }

  if (Date.now() > staged.expires_at) {
    await db.run(`DELETE FROM staged_jobs WHERE confirmation_token = ?;`, [confirmation_token]);
    return res.status(400).json({ error: 'Staged job confirmation token expired' });
  }

  const template = JSON.parse(staged.template_json);
  const validRecipients = JSON.parse(staged.recipients_json);

  const jobId = crypto.randomUUID();
  const now = Date.now();

  // Create Job, Template, Recipients, and JobItems atomically
  await db.run('BEGIN TRANSACTION;');
  try {
    await db.run(
      `INSERT INTO email_jobs 
        (id, admin_id, event_id, event_name, message_type, message_cycle, status, idempotency_key, request_hash, total_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'QUEUED', ?, ?, ?, ?, ?);`,
      [
        jobId,
        adminId,
        staged.event_id,
        staged.event_name,
        staged.message_type,
        staged.message_cycle,
        staged.idempotency_key,
        staged.request_hash,
        validRecipients.length,
        now,
        now,
      ]
    );

    await db.run(
      `INSERT INTO job_templates (job_id, subject_raw, body_text_raw, reply_to, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      [jobId, template.subject, template.body_text, template.reply_to || null, now]
    );

    for (const r of validRecipients) {
      const recipientId = crypto.randomUUID();
      await db.run(
        `INSERT INTO job_recipients (id, job_id, guest_id, guest_name, recipient_email, table_name)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [recipientId, jobId, r.guest_id, r.guest_name, r.recipient_email, r.table_name || null]
      );

      const itemId = crypto.randomUUID();
      await db.run(
        `INSERT INTO email_job_items (id, job_id, recipient_id, status, created_at)
         VALUES (?, ?, ?, 'PENDING', ?);`,
        [itemId, jobId, recipientId, now]
      );
    }

    // Delete single-use staged_jobs row
    await db.run(`DELETE FROM staged_jobs WHERE confirmation_token = ?;`, [confirmation_token]);
    await db.run('COMMIT;');
  } catch (err: any) {
    await db.run('ROLLBACK;');
    console.error('Failed to confirm and queue email job:', err);
    return res.status(500).json({ error: 'Database transaction error while queueing job' });
  }

  return res.json({ job_id: jobId, total_queued: validRecipients.length });
});

// POST /api/invitations/send-test
router.post('/send-test', requireAdmin, async (req: Request, res: Response) => {
  const adminId = req.session.adminId || 'admin_single_tenant';
  const { template, event_name } = req.body || {};

  if (!template || !template.subject || !template.body_text) {
    return res.status(400).json({ error: 'Missing test template subject or body_text' });
  }

  try {
    const gmail = await getGmailClientForAdmin(adminId);
    const db = await getDb();
    const connRow = await db.get(
      `SELECT email FROM oauth_connections WHERE admin_id = ?;`,
      [adminId]
    );
    const organizerEmail = connRow?.email;

    if (!organizerEmail || organizerEmail === 'unknown@gmail.com') {
      return res.status(400).json({ error: 'Could not resolve organizer Gmail address' });
    }

    const testCtx = {
      guest_name: 'Test Guest (You)',
      event_name: event_name || 'Sample Wedding Event',
      table_name: 'Table 1 - Head Table',
      unsubscribe_url: `${config.appUrl}/unsubscribe?t=test_preview_only`,
    };

    const renderedSubject = `[TEST PREVIEW] ${renderTextTemplate(template.subject, testCtx)}`;
    const renderedText = renderTextTemplate(template.body_text, testCtx);
    const renderedHtml = renderHtmlFromText(template.body_text, testCtx);

    const rawMime = await buildRawMimeMessage({
      from: organizerEmail,
      to: `Organizer <${organizerEmail}>`,
      subject: renderedSubject,
      text: renderedText,
      html: renderedHtml,
      replyTo: template.reply_to || undefined,
    });

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMime },
    });

    return res.json({ ok: true, recipient: organizerEmail });
  } catch (err: any) {
    console.error('Failed to send test email:', err);
    let errorMsg = err?.message || 'Failed to send test message';
    if (err?.code === 403 || errorMsg.includes('insufficient authentication scopes')) {
      errorMsg = 'Google Cloud denied email sending (403 Forbidden). Please verify: 1) "Gmail API" is enabled in Google Cloud Console under APIs & Services -> Library. 2) Disconnect & Reconnect Gmail and check the "Send email on your behalf" checkbox during Google consent.';
    }
    return res.status(500).json({ error: errorMsg });
  }
});

// GET /api/invitations/jobs/:job_id/status
router.get('/jobs/:job_id/status', requireAdmin, async (req: Request, res: Response) => {
  const adminId = req.session.adminId || 'admin_single_tenant';
  const { job_id } = req.params;

  const db = await getDb();
  const job = await db.get(
    `SELECT * FROM email_jobs WHERE id = ? AND admin_id = ?;`,
    [job_id, adminId]
  );

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const counts = await db.get(
    `SELECT 
        COUNT(CASE WHEN status = 'ACCEPTED_BY_GMAIL' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'UNKNOWN' THEN 1 END) as unknown,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled,
        COUNT(CASE WHEN status IN ('PENDING', 'PROCESSING') THEN 1 END) as remaining,
        COUNT(*) as total
     FROM email_job_items
     WHERE job_id = ?;`,
    [job_id]
  );

  const remainingMs = (counts?.remaining || 0) * config.sendIntervalMs;

  return res.json({
    job_id: job.id,
    status: job.status,
    total: job.total_count,
    sent: counts?.sent || 0,
    failed: counts?.failed || 0,
    unknown: counts?.unknown || 0,
    cancelled: counts?.cancelled || 0,
    remaining: counts?.remaining || 0,
    estimated_remaining_seconds: Math.ceil(remainingMs / 1000),
  });
});

// POST /api/invitations/jobs/:job_id/cancel
router.post('/jobs/:job_id/cancel', requireAdmin, async (req: Request, res: Response) => {
  const adminId = req.session.adminId || 'admin_single_tenant';
  const { job_id } = req.params;

  const db = await getDb();
  const job = await db.get(
    `SELECT * FROM email_jobs WHERE id = ? AND admin_id = ?;`,
    [job_id, adminId]
  );

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Update job status to CANCELLED
  await db.run(
    `UPDATE email_jobs SET status = 'CANCELLED', updated_at = ? WHERE id = ?;`,
    [Date.now(), job_id]
  );

  // Cancel all pending items
  const cancelledRes = await db.run(
    `UPDATE email_job_items SET status = 'CANCELLED' WHERE job_id = ? AND status = 'PENDING';`,
    [job_id]
  );

  return res.json({ ok: true, cancelled_pending_count: cancelledRes.changes });
});

// GET /api/invitations/jobs/:job_id/export (CSV Report)
router.get('/jobs/:job_id/export', requireAdmin, async (req: Request, res: Response) => {
  const adminId = req.session.adminId || 'admin_single_tenant';
  const { job_id } = req.params;

  const db = await getDb();
  const job = await db.get(
    `SELECT * FROM email_jobs WHERE id = ? AND admin_id = ?;`,
    [job_id, adminId]
  );

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const items = await db.all(
    `SELECT i.status, i.error_code, i.sent_at, r.guest_id, r.guest_name, r.table_name
     FROM email_job_items i
     JOIN job_recipients r ON i.recipient_id = r.id
     WHERE i.job_id = ?;`,
    [job_id]
  );

  // CSV Formula Injection Prevention helper: prefix unsafe leading chars (=, +, -, @) with '
  const sanitizeCsvValue = (val: string | null | undefined): string => {
    if (!val) return '';
    let str = String(val).trim();
    if (/^[=+\-@]/.test(str)) {
      str = "'" + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  const csvRows = [
    ['Guest ID', 'Guest Name', 'Table Name', 'Status', 'Error Code', 'Sent Date'].join(','),
  ];

  for (const item of items) {
    const sentDate = item.sent_at ? new Date(item.sent_at).toISOString() : '';
    csvRows.push([
      sanitizeCsvValue(item.guest_id),
      sanitizeCsvValue(item.guest_name),
      sanitizeCsvValue(item.table_name),
      sanitizeCsvValue(item.status),
      sanitizeCsvValue(item.error_code),
      sanitizeCsvValue(sentDate),
    ].join(','));
  }

  const csvContent = csvRows.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="invitation_job_${job_id.substring(0, 8)}.csv"`);
  return res.send(csvContent);
});

// GET /unsubscribe?t={token} (Public Opt-Out Page)
router.get('/unsubscribe', async (req: Request, res: Response) => {
  const { t } = req.query;

  if (!t || typeof t !== 'string') {
    return res.status(400).send('Invalid unsubscribe link');
  }

  const db = await getDb();
  const adminId = 'admin_single_tenant';

  // Find if token exists in staged or queue, or suppression
  const suppressionRow = await db.get(
    `SELECT * FROM suppression WHERE token = ?;`,
    [t]
  );

  if (!suppressionRow) {
    // If not found in suppression, check if token matches an active recipient
    const item = await db.get(
      `SELECT i.id, j.event_id, r.guest_id 
       FROM email_job_items i
       JOIN email_jobs j ON i.job_id = j.id
       JOIN job_recipients r ON i.recipient_id = r.id
       WHERE r.guest_id IN (SELECT guest_id FROM job_recipients);`
    );

    // Create suppression entry if valid format
    if (t.length >= 20) {
      await db.run(
        `INSERT INTO suppression (id, admin_id, event_id, guest_id, token, suppressed_at, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(token) DO NOTHING;`,
        [
          crypto.randomUUID(),
          adminId,
          item?.event_id || 'default_event',
          item?.guest_id || `guest_${crypto.randomBytes(4).toString('hex')}`,
          t,
          Date.now(),
          'UNSUBSCRIBE_LINK',
        ]
      );
    }
  }

  const htmlResponse = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Unsubscribe Confirmed</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <style>
          body { font-family: Inter, system-ui, sans-serif; background: #FAF7F2; color: #2C2C2C; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #ffffff; border: 1px solid rgba(201,169,110,0.3); padding: 40px; text-align: center; max-width: 450px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          h1 { font-family: "Cormorant Garamond", Georgia, serif; color: #2C2C2C; margin-top: 0; }
          p { color: #666666; font-size: 14px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Opt-Out Confirmed</h1>
          <p>You have been unsubscribed from receiving reminder emails for this event.</p>
          <p style="font-size: 12px; color: #999999; margin-top: 24px;">You may close this tab now.</p>
        </div>
      </body>
    </html>
  `;

  return res.send(htmlResponse);
});

export default router;
