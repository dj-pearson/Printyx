-- Add missing vendor column to software_products table
-- This column exists in the NEON migration files but was missing from the actual database

ALTER TABLE software_products
ADD COLUMN IF NOT EXISTS vendor character varying;

-- Add comment for documentation
COMMENT ON COLUMN software_products.vendor IS 'Software vendor/manufacturer name';
