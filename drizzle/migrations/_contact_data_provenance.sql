-- LEGAL-008: Article 14 provenance and durable suppression.
--
-- GDPR Art. 14 covers personal data NOT obtained from the data subject. A
-- contact bought from Apollo or ZoomInfo never gave us their details and does
-- not know we hold them, so they are owed a notice within a month of
-- acquisition. Nothing recorded which records came from a provider, so the
-- notice could not have been sent even in principle.
--
-- HAND-RUN, like the other underscore-prefixed files here:
--   psql "$DATABASE_URL" -f drizzle/migrations/_contact_data_provenance.sql
--
-- Not journalled because generating a journalled migration needs db:generate
-- against a live database, and adding a journal entry without its snapshot
-- widens the known snapshot gap (COP-M00) rather than fixing anything.

CREATE TABLE IF NOT EXISTS contact_data_provenance (
  id                     varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              varchar NOT NULL,
  subject_type           varchar(20) NOT NULL,
  subject_id             varchar NOT NULL,
  subject_email          varchar(320),
  source                 varchar(32) NOT NULL,
  source_record_id       varchar(128),
  acquired_at            timestamp NOT NULL DEFAULT now(),
  fields_acquired        jsonb DEFAULT '[]'::jsonb,
  art14_notice_status    varchar(20) NOT NULL DEFAULT 'not_required',
  art14_notice_sent_at   timestamp,
  art14_exemption_reason text,
  created_at             timestamp NOT NULL DEFAULT now(),
  updated_at             timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_data_provenance_subject_uq
  ON contact_data_provenance (tenant_id, subject_type, subject_id);
CREATE INDEX IF NOT EXISTS contact_data_provenance_tenant_idx
  ON contact_data_provenance (tenant_id);
CREATE INDEX IF NOT EXISTS contact_data_provenance_email_idx
  ON contact_data_provenance (tenant_id, subject_email);
CREATE INDEX IF NOT EXISTS contact_data_provenance_notice_idx
  ON contact_data_provenance (tenant_id, art14_notice_status);

-- Suppression is deliberately NOT tied to a contact row. The row is what gets
-- deleted; the suppression is what has to survive it, or the next enrichment
-- run silently re-acquires the person who asked to be removed.
CREATE TABLE IF NOT EXISTS contact_suppressions (
  id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     varchar NOT NULL,
  email         varchar(320) NOT NULL,
  reason        varchar(32) NOT NULL,
  reason_detail text,
  source        varchar(32) NOT NULL DEFAULT 'privacy_request',
  suppressed_at timestamp NOT NULL DEFAULT now(),
  created_at    timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_suppressions_tenant_email_uq
  ON contact_suppressions (tenant_id, email);
CREATE INDEX IF NOT EXISTS contact_suppressions_email_idx
  ON contact_suppressions (email);
