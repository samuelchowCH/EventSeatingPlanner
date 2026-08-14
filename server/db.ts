import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let dbInstance: Database<sqlite3.Database, sqlite3.Statement> | null = null;

export async function getDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = process.env.DATABASE_PATH || './data/seating_planner.db';
  const resolvedPath = path.resolve(dbPath);
  const dbDir = path.dirname(resolvedPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = await open({
    filename: resolvedPath,
    driver: sqlite3.Database,
  });

  // Enable foreign keys
  await dbInstance.run('PRAGMA foreign_keys = ON;');
  // Enable WAL mode for better concurrency in local single-server profile
  await dbInstance.run('PRAGMA journal_mode = WAL;');

  await initTables(dbInstance);
  return dbInstance;
}

async function initTables(db: Database<sqlite3.Database, sqlite3.Statement>) {
  await db.exec(`
    -- OAuth Connections (Encrypted at Rest)
    CREATE TABLE IF NOT EXISTS oauth_connections (
        id            TEXT    NOT NULL PRIMARY KEY,
        admin_id      TEXT    NOT NULL,
        email         TEXT    NOT NULL,
        ciphertext    TEXT    NOT NULL,
        iv            TEXT    NOT NULL,
        auth_tag      TEXT    NOT NULL,
        aad           TEXT    NOT NULL,
        key_version   INTEGER NOT NULL DEFAULT 1,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL,
        UNIQUE (admin_id)
    );

    -- Email Batch Jobs
    CREATE TABLE IF NOT EXISTS email_jobs (
        id                TEXT    NOT NULL PRIMARY KEY,
        admin_id          TEXT    NOT NULL,
        event_id          TEXT    NOT NULL,
        event_name        TEXT    NOT NULL,
        message_type      TEXT    NOT NULL CHECK (message_type IN ('INVITATION', 'REMINDER')),
        message_cycle     INTEGER NOT NULL DEFAULT 1,
        status            TEXT    NOT NULL CHECK (status IN ('QUEUED','PROCESSING','COMPLETED','CANCELLED','FAILED')),
        idempotency_key   TEXT    NOT NULL,
        request_hash      TEXT    NOT NULL,
        total_count       INTEGER NOT NULL CHECK (total_count > 0),
        sent_count        INTEGER NOT NULL DEFAULT 0,
        failed_count      INTEGER NOT NULL DEFAULT 0,
        unknown_count     INTEGER NOT NULL DEFAULT 0,
        created_at        INTEGER NOT NULL,
        updated_at        INTEGER NOT NULL,
        UNIQUE (admin_id, idempotency_key)
    );

    -- Template Snapshot (one per job)
    CREATE TABLE IF NOT EXISTS job_templates (
        job_id          TEXT    NOT NULL PRIMARY KEY REFERENCES email_jobs(id) ON DELETE CASCADE,
        subject_raw     TEXT    NOT NULL,
        body_text_raw   TEXT    NOT NULL,
        reply_to        TEXT,
        created_at      INTEGER NOT NULL
    );

    -- Staged Recipient Snapshot (immutable after confirmation)
    CREATE TABLE IF NOT EXISTS job_recipients (
        id              TEXT    NOT NULL PRIMARY KEY,
        job_id          TEXT    NOT NULL REFERENCES email_jobs(id) ON DELETE CASCADE,
        guest_id        TEXT    NOT NULL,
        guest_name      TEXT    NOT NULL,
        recipient_email TEXT    NOT NULL,
        table_name      TEXT,
        UNIQUE (job_id, guest_id)
    );

    -- Individual Email Queue Items
    CREATE TABLE IF NOT EXISTS email_job_items (
        id                  TEXT    NOT NULL PRIMARY KEY,
        job_id              TEXT    NOT NULL REFERENCES email_jobs(id) ON DELETE CASCADE,
        recipient_id        TEXT    NOT NULL REFERENCES job_recipients(id),
        status              TEXT    NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'ACCEPTED_BY_GMAIL', 'FAILED', 'CANCELLED', 'UNKNOWN')),
        leased_by           TEXT,
        lease_expires_at    INTEGER,
        attempt_count       INTEGER NOT NULL DEFAULT 0,
        next_attempt_at     INTEGER,
        gmail_message_id    TEXT,
        error_code          TEXT,
        error_detail        TEXT,
        is_permanent_fail   INTEGER NOT NULL DEFAULT 0 CHECK (is_permanent_fail IN (0,1)),
        sent_at             INTEGER,
        created_at          INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_job_items_queue ON email_job_items(status, next_attempt_at, lease_expires_at);
    CREATE INDEX IF NOT EXISTS idx_job_items_job ON email_job_items(job_id, status);

    -- Business-Level Duplicate Prevention
    CREATE TABLE IF NOT EXISTS sent_record (
        id              TEXT    NOT NULL PRIMARY KEY,
        admin_id        TEXT    NOT NULL,
        event_id        TEXT    NOT NULL,
        guest_id        TEXT    NOT NULL,
        message_type    TEXT    NOT NULL,
        message_cycle   INTEGER NOT NULL,
        job_item_id     TEXT    NOT NULL,
        sent_at         INTEGER NOT NULL,
        UNIQUE (admin_id, event_id, guest_id, message_type, message_cycle)
    );

    -- Suppression (opt-out) Table
    CREATE TABLE IF NOT EXISTS suppression (
        id              TEXT    NOT NULL PRIMARY KEY,
        admin_id        TEXT    NOT NULL,
        event_id        TEXT    NOT NULL,
        guest_id        TEXT    NOT NULL,
        token           TEXT    NOT NULL UNIQUE,
        suppressed_at   INTEGER NOT NULL,
        source          TEXT    NOT NULL CHECK (source IN ('UNSUBSCRIBE_LINK', 'ADMIN_MANUAL')),
        UNIQUE (admin_id, event_id, guest_id)
    );

    -- OAuth Pending Transactions
    CREATE TABLE IF NOT EXISTS oauth_pending (
        state           TEXT    NOT NULL PRIMARY KEY,
        admin_id        TEXT    NOT NULL,
        pkce_verifier   TEXT    NOT NULL,
        expires_at      INTEGER NOT NULL
    );

    -- Staged Job Confirmation Tokens
    CREATE TABLE IF NOT EXISTS staged_jobs (
        confirmation_token TEXT    NOT NULL PRIMARY KEY,
        admin_id           TEXT    NOT NULL,
        event_id           TEXT    NOT NULL,
        event_name         TEXT    NOT NULL,
        message_type       TEXT    NOT NULL,
        message_cycle      INTEGER NOT NULL DEFAULT 1,
        idempotency_key    TEXT    NOT NULL,
        request_hash       TEXT    NOT NULL,
        template_json      TEXT    NOT NULL,
        recipients_json    TEXT    NOT NULL,
        expires_at         INTEGER NOT NULL,
        created_at         INTEGER NOT NULL
    );
  `);

  // Cleanup expired oauth_pending and staged_jobs on startup
  const now = Date.now();
  await db.run('DELETE FROM oauth_pending WHERE expires_at < ?;', [now]);
  await db.run('DELETE FROM staged_jobs WHERE expires_at < ?;', [now]);

  // Reset crashed PROCESSING items to PENDING on startup
  await db.run(
    `UPDATE email_job_items 
     SET status = 'PENDING', leased_by = NULL, lease_expires_at = NULL 
     WHERE status = 'PROCESSING' AND lease_expires_at < ?;`,
    [now]
  );
}
