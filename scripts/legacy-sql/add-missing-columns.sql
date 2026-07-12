-- ============================================
-- Add Missing Columns
-- ============================================

-- Add team_id to users table (the Edge Function expects it)
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id varchar;

-- Grant permissions on the updated table
GRANT ALL ON TABLE users TO service_role;
GRANT ALL ON TABLE users TO authenticator;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO authenticated;

SELECT '✅ Missing columns added!' as status;

