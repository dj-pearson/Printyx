-- Comprehensive Schema Migration for Supabase
-- Generated from shared/schema.ts
-- Date: 2026-01-13

-- ============================================================================
-- AUTOMATIC TIMESTAMP TRIGGERS
-- ============================================================================

-- Function to auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to set tenant_id from auth context
CREATE OR REPLACE FUNCTION set_tenant_id_from_auth()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id = COALESCE(
            auth.jwt() ->> 'tenantId',
            auth.jwt() ->> 'tenant_id',
            (auth.jwt() -> 'app_metadata' ->> 'tenantId'),
            (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        )::uuid;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUDIT LOGGING HOOKS
-- ============================================================================

-- Function for audit logging on important tables
CREATE OR REPLACE FUNCTION log_data_change()
RETURNS TRIGGER AS $$
DECLARE
    audit_user_id uuid;
    change_type text;
BEGIN
    -- Get user ID from JWT
    audit_user_id := COALESCE(
        (auth.jwt() ->> 'sub')::uuid,
        auth.uid()
    );
    
    -- Determine operation type
    IF (TG_OP = 'DELETE') THEN
        change_type := 'DELETE';
        -- Log deletion (you can insert into an audit_logs table here)
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        change_type := 'UPDATE';
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        change_type := 'INSERT';
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CASCADE DELETE HELPERS
-- ============================================================================

-- Function to cascade delete related records
CREATE OR REPLACE FUNCTION cascade_delete_business_record()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete related activities
    DELETE FROM business_record_activities WHERE business_record_id = OLD.id;
    -- Delete related contacts
    DELETE FROM lead_contacts WHERE lead_id = OLD.id;
    DELETE FROM customer_contacts WHERE customer_id = OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BUSINESS LOGIC HOOKS
-- ============================================================================

-- Auto-generate quote numbers
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
        NEW.quote_number := 'Q-' || 
                           TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                           LPAD(NEXTVAL('quote_number_seq')::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for quote numbers
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1000;

-- Auto-generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := 'INV-' || 
                             TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                             LPAD(NEXTVAL('invoice_number_seq')::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000;

-- Auto-generate ticket numbers
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
        NEW.ticket_number := 'TKT-' || 
                            TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                            LPAD(NEXTVAL('ticket_number_seq')::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1000;

-- ============================================================================
-- APPLY TRIGGERS TO TABLES
-- ============================================================================

-- Apply updated_at triggers to all major tables
DO $$
DECLARE
    table_name text;
    tables_with_updated_at text[] := ARRAY[
        'tasks', 'projects', 'users', 'business_records', 'business_record_activities',
        'lead_contacts', 'customer_contacts', 'service_tickets', 'equipment', 'contracts',
        'meter_readings', 'invoices', 'quotes', 'deals', 'opportunities', 'proposals',
        'technicians', 'teams', 'roles', 'locations', 'appointments', 'notifications',
        'inventory_items', 'product_models', 'product_accessories', 'leases', 'customers'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_with_updated_at
    LOOP
        -- Check if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = table_name) THEN
            -- Drop trigger if exists
            EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', table_name, table_name);
            -- Create trigger
            EXECUTE format('
                CREATE TRIGGER update_%I_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column()
            ', table_name, table_name);
        END IF;
    END LOOP;
END $$;

-- Apply auto-number generation triggers
DO $$
BEGIN
    -- Quotes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quotes') THEN
        DROP TRIGGER IF EXISTS generate_quote_number_trigger ON quotes;
        CREATE TRIGGER generate_quote_number_trigger
        BEFORE INSERT ON quotes
        FOR EACH ROW
        EXECUTE FUNCTION generate_quote_number();
    END IF;
    
    -- Invoices
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
        DROP TRIGGER IF EXISTS generate_invoice_number_trigger ON invoices;
        CREATE TRIGGER generate_invoice_number_trigger
        BEFORE INSERT ON invoices
        FOR EACH ROW
        EXECUTE FUNCTION generate_invoice_number();
    END IF;
    
    -- Service Tickets
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_tickets') THEN
        DROP TRIGGER IF EXISTS generate_ticket_number_trigger ON service_tickets;
        CREATE TRIGGER generate_ticket_number_trigger
        BEFORE INSERT ON service_tickets
        FOR EACH ROW
        EXECUTE FUNCTION generate_ticket_number();
    END IF;
END $$;

-- Apply cascade delete trigger
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_records') THEN
        DROP TRIGGER IF EXISTS cascade_delete_business_record_trigger ON business_records;
        CREATE TRIGGER cascade_delete_business_record_trigger
        BEFORE DELETE ON business_records
        FOR EACH ROW
        EXECUTE FUNCTION cascade_delete_business_record();
    END IF;
END $$;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Create indexes on frequently queried columns
DO $$
DECLARE
    idx_sql text;
    indexes_to_create text[] := ARRAY[
        'CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON tasks(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)',
        'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
        'CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON projects(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_business_records_tenant_id ON business_records(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_business_records_record_type ON business_records(record_type)',
        'CREATE INDEX IF NOT EXISTS idx_business_records_status ON business_records(status)',
        'CREATE INDEX IF NOT EXISTS idx_activities_business_record_id ON business_record_activities(business_record_id)',
        'CREATE INDEX IF NOT EXISTS idx_activities_tenant_id ON business_record_activities(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_service_tickets_tenant_id ON service_tickets(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_service_tickets_status ON service_tickets(status)',
        'CREATE INDEX IF NOT EXISTS idx_equipment_tenant_id ON equipment(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_equipment_customer_id ON equipment(customer_id)',
        'CREATE INDEX IF NOT EXISTS idx_quotes_tenant_id ON quotes(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status)',
        'CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)',
        'CREATE INDEX IF NOT EXISTS idx_deals_tenant_id ON deals(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage)',
        'CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_id ON opportunities(tenant_id)',
        'CREATE INDEX IF NOT EXISTS idx_opportunities_stage_name ON opportunities(stage_name)'
    ];
BEGIN
    FOREACH idx_sql IN ARRAY indexes_to_create
    LOOP
        BEGIN
            EXECUTE idx_sql;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors (table might not exist yet)
            NULL;
        END;
    END LOOP;
END $$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant service_role access to functions
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION set_tenant_id_from_auth() TO service_role;
GRANT EXECUTE ON FUNCTION log_data_change() TO service_role;
GRANT EXECUTE ON FUNCTION generate_quote_number() TO service_role;
GRANT EXECUTE ON FUNCTION generate_invoice_number() TO service_role;
GRANT EXECUTE ON FUNCTION generate_ticket_number() TO service_role;
GRANT EXECUTE ON FUNCTION cascade_delete_business_record() TO service_role;

-- ============================================================================
-- SCHEMA RELOAD
-- ============================================================================

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

