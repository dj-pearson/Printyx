-- Migration: Add company_id support to business_record_activities table
-- Date: 2026-01-16
-- Purpose: Support both business_records (legacy) and companies (new) architectures

-- Add company_id column (nullable for backward compatibility)
ALTER TABLE business_record_activities
ADD COLUMN IF NOT EXISTS company_id VARCHAR;

-- Make business_record_id nullable (since we now support company_id as alternative)
ALTER TABLE business_record_activities
ALTER COLUMN business_record_id DROP NOT NULL;

-- Add check constraint: at least one of business_record_id or company_id must be set
ALTER TABLE business_record_activities
ADD CONSTRAINT activities_parent_check 
CHECK (
  (business_record_id IS NOT NULL AND company_id IS NULL) OR
  (business_record_id IS NULL AND company_id IS NOT NULL)
);

-- Add index on company_id for better query performance
CREATE INDEX IF NOT EXISTS business_record_activities_company_id_idx 
ON business_record_activities(company_id);

-- Add comment
COMMENT ON COLUMN business_record_activities.company_id IS 'References companies.id (new architecture)';
COMMENT ON COLUMN business_record_activities.business_record_id IS 'References businessRecords.id (legacy architecture)';
