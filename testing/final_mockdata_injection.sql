-- Final Corrected Mock Data Injection 
-- Using tenant UUID: 1d4522ad-b3d8-4018-8890-f9294b2efbe6

-- Business Records (exact field matching)
INSERT INTO business_records (
    id, tenant_id, company_name, primary_contact_name, primary_contact_email, 
    primary_contact_phone, address_line1, city, state, postal_code, industry, 
    employee_count, annual_revenue, source, lead_score, last_contact_date, 
    next_follow_up_date, notes, priority, assigned_sales_rep, created_by, 
    record_type
) VALUES 
(
    'br_demo_001', 
    '1d4522ad-b3d8-4018-8890-f9294b2efbe6',
    'TechForward Solutions',
    'David Chen',
    'dchen@techforward.com',
    '(415) 555-0301',
    '789 Innovation Drive',
    'San Francisco', 
    'CA', 
    '94105',
    'Technology',
    145,
    12500000.00,
    'website',
    95,
    '2024-08-01 14:30:00',
    '2024-08-15 10:00:00',
    'High-volume printing needs, interested in managed print services',
    'high',
    'user_demo_001',
    'user_demo_001',
    'customer'
),
(
    'br_demo_002',
    '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 
    'Sunrise Manufacturing',
    'Jennifer Taylor',
    'jtaylor@sunrisemfg.com',
    '(206) 555-0500',
    '456 Industrial Way',
    'Tacoma',
    'WA', 
    '98402',
    'Manufacturing',
    75,
    5200000.00,
    'referral',
    75,
    '2024-08-03 16:15:00',
    '2024-08-08 09:00:00',
    'Looking to upgrade from old copiers, budget approved',
    'medium',
    'user_demo_002', 
    'user_demo_001',
    'lead'
),
(
    'br_demo_003',
    '1d4522ad-b3d8-4018-8890-f9294b2efbe6',
    'Downtown Legal Associates',
    'Robert Kim',
    'rkim@downtownlegal.com',
    '(206) 555-0600',
    '100 Legal Plaza Suite 500',
    'Seattle',
    'WA',
    '98101',
    'Legal Services',
    25,
    2800000.00,
    'google_ads',
    65,
    '2024-08-02 11:00:00',
    '2024-08-09 14:00:00',
    'Small law firm needing reliable document management and printing',
    'medium',
    'user_demo_001',
    'user_demo_001', 
    'lead'
);

-- Companies (exact field matching)
INSERT INTO companies (
    id, tenant_id, business_name, industry, website, 
    annual_revenue, business_address, phone, email
) VALUES
(
    'comp_demo_001',
    '1d4522ad-b3d8-4018-8890-f9294b2efbe6',
    'TechForward Solutions',
    'Technology',
    'www.techforward.com',
    12500000.00,
    '789 Innovation Drive, San Francisco, CA 94105',
    '(415) 555-0300',
    'info@techforward.com'
),
(
    'comp_demo_002',
    '1d4522ad-b3d8-4018-8890-f9294b2efbe6',
    'Greenfield Medical Group', 
    'Healthcare',
    'www.greenfieldmed.com',
    8750000.00,
    '321 Health Plaza, Portland, OR 97205',
    '(503) 555-0400',
    'admin@greenfieldmed.com'
);

-- Activity records (exact field matching)
INSERT INTO business_record_activities (
    id, business_record_id, activity_type, subject, description, 
    outcome, next_action, created_by, tenant_id, created_at
) VALUES
(
    'activity_demo_001',
    'br_demo_001', 
    'meeting',
    'Initial Needs Assessment',
    'Met with IT Director to discuss current printing infrastructure and pain points. Company prints 50,000+ pages monthly across 3 floors.',
    'positive',
    'Prepare proposal for managed print solution',
    'user_demo_001',
    '1d4522ad-b3d8-4018-8890-f9294b2efbe6',
    '2024-08-01 14:30:00'
),
(
    'activity_demo_002',
    'br_demo_002',
    'phone_call', 
    'Follow-up Call',
    'Discussed budget range and timeline for equipment replacement. CFO approval needed for purchases over $25k.',
    'interested',
    'Schedule on-site assessment',
    'user_demo_001',
    '1d4522ad-b3d8-4018-8890-f9294b2efbe6',
    '2024-08-03 16:15:00'
);

-- Demo users for the tenant
INSERT INTO users (
    id, tenant_id, email, first_name, last_name, role, is_active, created_at
) VALUES
(
    'user_demo_001',
    '1d4522ad-b3d8-4018-8890-f9294b2efbe6',
    'demo.admin@democopier.com',
    'Demo',
    'Administrator', 
    'admin',
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'user_demo_002',
    '1d4522ad-b3d8-4018-8890-f9294b2efbe6',
    'demo.sales@democopier.com',
    'Demo',
    'Sales Rep',
    'sales_rep',
    TRUE,
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;