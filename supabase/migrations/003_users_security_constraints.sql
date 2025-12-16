-- =====================================================
-- Security Constraints for Users Table
-- Prevent users from updating security-critical fields
-- =====================================================

-- Create a trigger function to prevent unauthorized updates to security fields
CREATE OR REPLACE FUNCTION prevent_security_field_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service_role to update anything
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For authenticated users updating their own record
  IF auth.uid()::text = NEW.id THEN
    -- Prevent changes to security-critical fields
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot modify role field';
    END IF;
    
    IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
      RAISE EXCEPTION 'Cannot modify role_id field';
    END IF;
    
    IF NEW.is_platform_user IS DISTINCT FROM OLD.is_platform_user THEN
      RAISE EXCEPTION 'Cannot modify is_platform_user field';
    END IF;
    
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'Cannot modify tenant_id field';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS protect_user_security_fields ON users;

-- Create trigger to protect security fields
CREATE TRIGGER protect_user_security_fields
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_security_field_updates();

-- Add comment for documentation
COMMENT ON TRIGGER protect_user_security_fields ON users IS 
  'Prevents non-admin users from modifying security-critical fields (role, role_id, is_platform_user, tenant_id)';
