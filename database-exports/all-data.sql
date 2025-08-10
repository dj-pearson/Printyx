--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9
-- Dumped by pg_dump version 16.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: accounts_payable; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: accounts_receivable; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.audit_logs VALUES ('audit_001', 'user_001', 'UPDATE', 'deals', 'deal_001', '{"stage": "discovery", "probability": 25}', '{"stage": "proposal", "probability": 75}', '2025-08-05 02:30:16.874733', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0', '1d4522ad-b3d8-4018-8890-f9294b2efbe6');
INSERT INTO public.audit_logs VALUES ('audit_002', 'user_002', 'INSERT', 'service_tickets', 'st_002', '{}', '{"title": "Color Quality Issues", "status": "new", "priority": "high"}', '2025-08-05 02:30:16.874733', '10.0.0.50', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) Mobile/15E148', '1d4522ad-b3d8-4018-8890-f9294b2efbe6');


--
-- Data for Name: automated_tasks; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.automated_tasks VALUES ('85324519-c468-4d27-a762-e1ec54dfa053', '550e8400-e29b-41d4-a716-446655440000', 'Follow up with TechCorp Solutions', 'Contact customer to ensure satisfaction with recent printer installation and setup', 'follow_up', 'customer_service', 'b2a3208b-0ba9-4c87-91ae-ba5e4c300480', NULL, 'workflow_completion', 'high', 8, 30, 'medium', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, 'auto', NULL, '2025-08-05', NULL, NULL, NULL, 'pending', 0.00, '2025-08-03 13:47:48.275609', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, false, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, '2025-08-03 13:47:48.275609', '2025-08-03 13:47:48.275609');
INSERT INTO public.automated_tasks VALUES ('3f9a63f7-8676-42f3-a2f1-6d4ce1be0c18', '550e8400-e29b-41d4-a716-446655440000', 'Quarterly maintenance check - Canon MFP', 'Perform scheduled quarterly maintenance on Canon multifunction printer', 'maintenance_alert', 'maintenance', NULL, '9e4cb66a-8c0f-4b0b-9463-a6e3d356a225', 'rule_triggered', 'medium', 6, 120, 'medium', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, 'auto', NULL, '2025-08-10', NULL, NULL, NULL, 'pending', 0.00, '2025-08-03 13:47:48.275609', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, false, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, '2025-08-03 13:47:48.275609', '2025-08-03 13:47:48.275609');
INSERT INTO public.automated_tasks VALUES ('ebf5a677-5af5-476a-9c73-9b39622eb74b', '550e8400-e29b-41d4-a716-446655440000', 'Process August billing exceptions', 'Review and resolve billing exceptions for August 2025 billing cycle', 'billing_task', 'billing', '5797803b-753f-40d9-8ed6-71881c787e8b', NULL, 'billing_workflow', 'urgent', 9, 60, 'medium', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, 'auto', NULL, '2025-08-04', NULL, NULL, NULL, 'in_progress', 45.00, '2025-08-03 13:47:48.275609', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, false, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, '2025-08-03 13:47:48.275609', '2025-08-03 13:47:48.275609');


--
-- Data for Name: automation_rules; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.automation_rules VALUES ('4122d344-3e6b-49e0-b126-ef63f3713833', '550e8400-e29b-41d4-a716-446655440000', 'High Priority Ticket Alert', 'Immediately notify management when high priority service tickets are created', 'notification', '["ticket_created"]', '{"logic": "AND", "rules": [{"field": "priority", "value": "high", "operator": "equal"}]}', 'AND', '[{"type": "email", "target": "management"}, {"type": "sms", "target": "on_call"}]', 'sequential', 0, NULL, 0, 9, true, true, NULL, NULL, NULL, 50, NULL, 1, false, NULL, NULL, NULL, 15, 15, '2025-08-03 14:20:00', NULL, true, false, NULL, NULL, NULL, NULL, 250.50, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-03 13:47:48.275609', '2025-08-03 13:47:48.275609');
INSERT INTO public.automation_rules VALUES ('9e4cb66a-8c0f-4b0b-9463-a6e3d356a225', '550e8400-e29b-41d4-a716-446655440000', 'Equipment Maintenance Reminder', 'Create maintenance tasks for equipment approaching service intervals', 'trigger', '["equipment_usage_threshold"]', '{"logic": "AND", "rules": [{"field": "days_since_maintenance", "value": 85, "operator": "greater_than"}]}', 'AND', '[{"type": "create_task", "category": "maintenance"}]', 'sequential', 3600, NULL, 0, 6, false, false, NULL, NULL, NULL, 10, NULL, 1, false, NULL, NULL, NULL, 8, 7, '2025-08-02 09:15:00', NULL, true, false, NULL, NULL, NULL, NULL, 1500.20, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-03 13:47:48.275609', '2025-08-03 13:47:48.275609');
INSERT INTO public.automation_rules VALUES ('2b3c0d52-545a-4beb-9849-0e34dfc9d370', '550e8400-e29b-41d4-a716-446655440000', 'Customer Follow-up Assignment', 'Automatically assign follow-up tasks after service completion', 'assignment', '["service_completed"]', '{"logic": "AND", "rules": [{"field": "customer_type", "value": "premium", "operator": "equal"}]}', 'AND', '[{"type": "assign_task", "target": "account_manager"}]', 'sequential', 7200, NULL, 0, 5, false, false, NULL, NULL, NULL, 25, NULL, 1, false, NULL, NULL, NULL, 22, 21, '2025-08-03 11:45:00', NULL, true, false, NULL, NULL, NULL, NULL, 850.00, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-03 13:47:48.275609', '2025-08-03 13:47:48.275609');
INSERT INTO public.automation_rules VALUES ('ar_001', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'High Value Deal Alert', 'Notify sales manager when deal value exceeds $50,000', 'notification', '["deal_created", "deal_updated"]', '{"deal_value": {"value": 50000, "operator": ">"}}', 'AND', '{"notifications": [{"type": "email", "template": "high_value_deal", "recipients": ["sales_manager"]}]}', 'sequential', 0, NULL, 0, 1, false, false, '["deals"]', NULL, NULL, NULL, NULL, 1, false, NULL, NULL, NULL, 23, 22, NULL, NULL, true, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'user_001', '2025-08-05 02:30:16.731149', '2025-08-05 02:30:16.731149');
INSERT INTO public.automation_rules VALUES ('ar_002', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Service Escalation Rule', 'Escalate service tickets that remain unassigned for more than 2 hours', 'escalation', '["ticket_created", "ticket_status_changed"]', '{"status": "new", "age_hours": {"value": 2, "operator": ">"}}', 'AND', '{"assign_to": "service_manager", "notifications": [{"type": "sms", "recipients": ["on_call_manager"]}], "status_change": "escalated"}', 'sequential', 0, NULL, 0, 2, false, false, '["service_tickets"]', NULL, NULL, NULL, NULL, 1, false, NULL, NULL, NULL, 8, 8, NULL, NULL, true, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'user_002', '2025-08-05 02:30:16.731149', '2025-08-05 02:30:16.731149');


--
-- Data for Name: billing_adjustments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.billing_adjustments VALUES ('cc3ec189-a671-4901-97b5-927b16b7c6ec', '550e8400-e29b-41d4-a716-446655440000', NULL, NULL, NULL, 'credit', 'Service credit for equipment downtime', 50.00, 'USD', 'approved', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-03 04:50:05.668215', '2025-08-03 04:50:05.668215');
INSERT INTO public.billing_adjustments VALUES ('1e5c2996-6b93-4699-9d2d-0a8c7e87f3fd', '550e8400-e29b-41d4-a716-446655440000', NULL, NULL, NULL, 'discount', 'Volume discount for large customer', 25.00, 'USD', 'pending', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-03 04:50:05.668215', '2025-08-03 04:50:05.668215');


--
-- Data for Name: billing_configurations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.billing_configurations VALUES ('e3b72329-9737-4f5f-8f30-8aa12f2904c0', '550e8400-e29b-41d4-a716-446655440000', 'Standard Monthly Service', 'flat_rate', true, true, 'monthly', 1, 299.99, 100.00, NULL, NULL, 0.0000, 0.00, 0.00, NULL, NULL, 'USD', 0.0850, false, NULL, NULL, '2025-08-03 04:50:05.668215', '2025-08-03 04:50:05.668215');
INSERT INTO public.billing_configurations VALUES ('f3f3c88d-e992-4f2c-a7ee-991a4ab69602', '550e8400-e29b-41d4-a716-446655440000', 'Meter-Based Color Printing', 'meter_based', true, false, 'monthly', 1, 0.00, 50.00, NULL, NULL, 0.0000, 0.00, 0.00, NULL, NULL, 'USD', 0.0850, false, NULL, NULL, '2025-08-03 04:50:05.668215', '2025-08-03 04:50:05.668215');
INSERT INTO public.billing_configurations VALUES ('4b7c6eb9-980f-4581-9016-fd606453b95d', '550e8400-e29b-41d4-a716-446655440000', 'Premium Quarterly Service', 'tiered', true, false, 'quarterly', 1, 250.00, 150.00, NULL, NULL, 0.0000, 0.00, 0.00, NULL, NULL, 'USD', 0.0850, false, NULL, NULL, '2025-08-03 04:50:05.668215', '2025-08-03 04:50:05.668215');


--
-- Data for Name: billing_cycles; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: billing_invoices; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: billing_line_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: budget_vs_actual; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: business_intelligence_dashboards; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: business_records; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.business_records VALUES ('br_demo_001', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'customer', 'new', 'TechForward Solutions', NULL, 'Technology', NULL, 12500000.00, 'David Chen', 'dchen@techforward.com', '(415) 555-0301', NULL, NULL, NULL, '789 Innovation Drive', NULL, 'San Francisco', 'CA', '94105', 'US', 'website', NULL, NULL, NULL, NULL, NULL, false, NULL, '2024-08-01 14:30:00', '2024-08-15 10:00:00', NULL, NULL, NULL, NULL, NULL, NULL, 'user_demo_001', '2025-08-05 02:32:05.388799', '2025-08-05 02:32:05.388799', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'user_demo_001', NULL, 95, 'high', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, NULL, NULL, 50, NULL, NULL, NULL, NULL, 'High-volume printing needs, interested in managed print services', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 145, NULL, true);
INSERT INTO public.business_records VALUES ('br_demo_002', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'lead', 'new', 'Sunrise Manufacturing', NULL, 'Manufacturing', NULL, 5200000.00, 'Jennifer Taylor', 'jtaylor@sunrisemfg.com', '(206) 555-0500', NULL, NULL, NULL, '456 Industrial Way', NULL, 'Tacoma', 'WA', '98402', 'US', 'referral', NULL, NULL, NULL, NULL, NULL, false, NULL, '2024-08-03 16:15:00', '2024-08-08 09:00:00', NULL, NULL, NULL, NULL, NULL, NULL, 'user_demo_001', '2025-08-05 02:32:05.388799', '2025-08-05 02:32:05.388799', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'user_demo_002', NULL, 75, 'medium', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, NULL, NULL, 50, NULL, NULL, NULL, NULL, 'Looking to upgrade from old copiers, budget approved', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 75, NULL, true);
INSERT INTO public.business_records VALUES ('br_demo_003', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'lead', 'new', 'Downtown Legal Associates', NULL, 'Legal Services', NULL, 2800000.00, 'Robert Kim', 'rkim@downtownlegal.com', '(206) 555-0600', NULL, NULL, NULL, '100 Legal Plaza Suite 500', NULL, 'Seattle', 'WA', '98101', 'US', 'google_ads', NULL, NULL, NULL, NULL, NULL, false, NULL, '2024-08-02 11:00:00', '2024-08-09 14:00:00', NULL, NULL, NULL, NULL, NULL, NULL, 'user_demo_001', '2025-08-05 02:32:05.388799', '2025-08-05 02:32:05.388799', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'user_demo_001', NULL, 65, 'medium', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, NULL, NULL, 50, NULL, NULL, NULL, NULL, 'Small law firm needing reliable document management and printing', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 25, NULL, true);
INSERT INTO public.business_records VALUES ('lead-002', '550e8400-e29b-41d4-a716-446655440000', 'lead', 'new', 'DEF Company', NULL, NULL, NULL, NULL, NULL, 'sarah@techstart.com', '555-0456', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'US', 'Referral', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, 25000.00, NULL, NULL, NULL, NULL, 'demo-user', '2025-08-01 02:37:44.20441', '2025-08-01 02:37:44.20441', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 'medium', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, NULL, NULL, 50, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true);
INSERT INTO public.business_records VALUES ('lead-001', '550e8400-e29b-41d4-a716-446655440000', 'lead', 'new', 'ABC Company', '', '', NULL, NULL, NULL, 'john.smith@acme.com', '555-0123', NULL, NULL, NULL, NULL, NULL, '123', 'IA', NULL, 'US', 'Website', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, 45000.00, NULL, NULL, NULL, NULL, 'demo-user', '2025-08-01 02:37:41.635245', '2025-08-07 21:35:04.931', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 'medium', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, NULL, NULL, 50, NULL, NULL, NULL, NULL, '', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true);
INSERT INTO public.business_records VALUES ('e620280d-b634-413f-ba65-9b177523cd95', '550e8400-e29b-41d4-a716-446655440000', 'lead', 'new', 'GHI Company', '', '', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', '', NULL, 'US', NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-05 16:48:26.18926', '2025-08-08 19:48:36.813', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', NULL, NULL, NULL, 0, 'medium', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, NULL, NULL, 50, NULL, NULL, NULL, NULL, '', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true);
INSERT INTO public.business_records VALUES ('6f648e51-25e8-4ef5-b7cf-6f5759a385ea', '550e8400-e29b-41d4-a716-446655440000', 'customer', 'active', 'Customer Company number 5', 'https://danpearson.net', 'Government', NULL, 1234564568.00, 'Terry', 'Email@gmail.com', '51051651651', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'US', NULL, NULL, '2025-08-02 04:11:18.931', NULL, NULL, NULL, false, 'Bronze', NULL, NULL, NULL, 10000.00, NULL, NULL, NULL, NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-02 04:11:18.931761', '2025-08-08 23:58:56.281', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Steve', NULL, 0, 'medium', '12346789', NULL, NULL, NULL, 'Jamie', NULL, NULL, NULL, NULL, 0.00, NULL, NULL, 50, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2312156', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 200, NULL, true);
INSERT INTO public.business_records VALUES ('adc117e7-611d-426a-b569-6c6c0bdaf750', '550e8400-e29b-41d4-a716-446655440000', 'customer', 'active', 'The Customer Company', 'https://danpearson.net', 'Technology', NULL, 2343242342.00, 'Mike Davis', 'mike.davis@thecustomercompany.com', '(555) 123-4567', 'Dan Pearson', 'DPearson@InfomaxOffice.com', '5152372352', '1010 Illinois St', NULL, 'Des Moines', 'Iowa', '50314', 'US', NULL, NULL, '2025-08-02 04:11:18.931', NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, 10000.00, NULL, NULL, NULL, NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-02 04:11:18.931761', '2025-08-09 03:40:46.341', NULL, NULL, NULL, NULL, NULL, '1010 Illinois St', NULL, 'Des Moines', 'Iowa', '50314', NULL, NULL, NULL, NULL, 0, 'medium', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, NULL, NULL, 50, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '0231564', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 23, NULL, true);
INSERT INTO public.business_records VALUES ('01e8d93b-c133-4c23-9894-88cf214ccade', '550e8400-e29b-41d4-a716-446655440000', 'customer', 'active', 'NEW Customer Company', NULL, 'Legal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'US', NULL, NULL, '2025-08-02 04:11:18.931761', NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, 10000.00, NULL, NULL, NULL, NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-02 04:11:18.931761', '2025-08-08 23:44:15.952', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 'medium', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, NULL, NULL, 50, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '12316545613', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true);


--
-- Data for Name: business_record_activities; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.business_record_activities VALUES ('5a670d02-7eac-4c2f-b715-2f62641baf43', '550e8400-e29b-41d4-a716-446655440000', 'lead-002', 'call', 'Test call', 'Testing activity creation', NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'system', '2025-08-04 20:49:11.082189', '2025-08-04 20:49:11.082189');
INSERT INTO public.business_record_activities VALUES ('a3f876a6-7912-4619-a848-eb2c579c6b24', '550e8400-e29b-41d4-a716-446655440000', 'lead-002', 'call', 'big call', 'answered', 'outbound', NULL, '', '', NULL, NULL, false, NULL, 'answered', NULL, '2025-08-04 20:50:37.211', NULL, 'completed', '', '2025-08-29 05:00:00', NULL, NULL, 'system', '2025-08-04 20:50:37.92', '2025-08-04 20:50:37.92');
INSERT INTO public.business_record_activities VALUES ('activity_demo_001', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'br_demo_001', 'meeting', 'Initial Needs Assessment', 'Met with IT Director to discuss current printing infrastructure and pain points. Company prints 50,000+ pages monthly across 3 floors.', NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, 'positive', 'Prepare proposal for managed print solution', NULL, NULL, NULL, 'user_demo_001', '2024-08-01 14:30:00', '2025-08-05 02:32:05.423458');
INSERT INTO public.business_record_activities VALUES ('activity_demo_002', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'br_demo_002', 'phone_call', 'Follow-up Call', 'Discussed budget range and timeline for equipment replacement. CFO approval needed for purchases over $25k.', NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, 'interested', 'Schedule on-site assessment', NULL, NULL, NULL, 'user_demo_001', '2024-08-03 16:15:00', '2025-08-05 02:32:05.423458');
INSERT INTO public.business_record_activities VALUES ('28e3ab7d-75e2-43e5-a72a-cad9950de848', '550e8400-e29b-41d4-a716-446655440000', 'adc117e7-611d-426a-b569-6c6c0bdaf750', 'call', 'tony', 'talked', 'outbound', NULL, '', '', NULL, NULL, false, NULL, 'answered', NULL, NULL, NULL, NULL, '', '2025-08-29 05:00:00', NULL, NULL, 'system', '2025-08-06 03:37:39.637', '2025-08-06 03:37:39.637');


--
-- Data for Name: cash_flow_projections; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.cash_flow_projections VALUES ('410ece3f-fd3b-4dd9-a7d4-9e71494e0828', '550e8400-e29b-41d4-a716-446655440000', 'Q4 2025 Cash Flow Projection', '2025-10-01', 75000.00, 180000.00, 0.00, 255000.00, 85000.00, 45000.00, 25000.00, 0.00, 0.00, 0.00, 155000.00, 100000.00, 175000.00, 50000.00, false, 34, NULL, NULL, 'draft', '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-03 04:55:20.744279', '2025-08-03 04:55:20.744279');


--
-- Data for Name: commission_analytics; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: commission_calculations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: commission_disputes; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.commission_disputes VALUES ('4a99e7f5-00dd-48e4-9ac7-695789c06c03', '550e8400-e29b-41d4-a716-446655440000', 'DISP-001', 'calculation_error', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, NULL, 500.00, 750.00, 'Commission calculation appears to be missing bonus for exceeding quota in July', NULL, 'open', 'medium', '2025-08-01', NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, '2025-08-03 13:02:42.326712', '2025-08-03 13:02:42.326712');
INSERT INTO public.commission_disputes VALUES ('34ed2838-0d73-4ea4-b3a7-a6b12b31eae5', '550e8400-e29b-41d4-a716-446655440000', 'DISP-002', 'missing_sale', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, NULL, 250.00, 250.00, 'Large equipment sale on July 28th not reflected in commission calculation', NULL, 'under_review', 'high', '2025-08-02', NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, '2025-08-03 13:02:42.326712', '2025-08-03 13:02:42.326712');
INSERT INTO public.commission_disputes VALUES ('c9be8b48-b819-42e2-84b9-5b3ef0f262fc', '550e8400-e29b-41d4-a716-446655440000', 'DISP-1754231800001', 'calculation_error', 'SALES003', NULL, NULL, NULL, 500.00, NULL, 'Commission calculation appears incorrect for Q2 service contract. Expected rate should be 6% instead of 5% based on performance tier achievement.', NULL, 'submitted', 'medium', '2025-08-01', NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, '2025-08-03 14:41:15.652223', '2025-08-03 14:41:15.652223');
INSERT INTO public.commission_disputes VALUES ('cd866f53-0ad1-4494-9733-a3585b5824d1', '550e8400-e29b-41d4-a716-446655440000', 'DISP-1754231800002', 'missing_commission', 'SALES002', NULL, NULL, NULL, 1200.00, NULL, 'Missing commission for software renewal deal with ABC Manufacturing closed on July 15th. Deal value was $12,000 with standard 10% commission structure.', NULL, 'under_review', 'high', '2025-07-30', NULL, NULL, NULL, NULL, NULL, NULL, false, false, false, '2025-08-03 14:41:15.652223', '2025-08-03 14:41:15.652223');


--
-- Data for Name: commission_payments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.commission_payments VALUES ('6ffd8828-c02b-44ba-93e5-493bfa0a0220', '550e8400-e29b-41d4-a716-446655440000', NULL, '2025-08-01', '2025-07-01', '2025-07-31', 'SALES001', 4375.00, 0.00, 0.00, 4375.00, 'direct_deposit', 'BATCH-202507-001', NULL, NULL, 'processed', NULL, NULL, NULL, false, NULL, NULL, NULL, 0.00, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, '2025-08-03 14:40:37.400866', '2025-08-03 14:40:37.400866');
INSERT INTO public.commission_payments VALUES ('fc01d5e0-3113-4635-8c12-9f2b2c85f375', '550e8400-e29b-41d4-a716-446655440000', NULL, '2025-08-01', '2025-07-01', '2025-07-31', 'SALES002', 2500.00, 0.00, 0.00, 2500.00, 'direct_deposit', 'BATCH-202507-001', NULL, NULL, 'processed', NULL, NULL, NULL, false, NULL, NULL, NULL, 0.00, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, '2025-08-03 14:40:37.400866', '2025-08-03 14:40:37.400866');
INSERT INTO public.commission_payments VALUES ('a33b4c14-1eed-467d-a580-a68881cb77fd', '550e8400-e29b-41d4-a716-446655440000', NULL, '2025-08-01', '2025-07-01', '2025-07-31', 'SALES004', 3850.00, 0.00, 0.00, 3850.00, 'check', 'BATCH-202507-001', NULL, NULL, 'processed', NULL, NULL, NULL, false, NULL, NULL, NULL, 0.00, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, '2025-08-03 14:40:37.400866', '2025-08-03 14:40:37.400866');


--
-- Data for Name: commission_sales_data; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: commission_structures; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.commission_structures VALUES ('b03a9abe-da7a-426a-9f7e-dd20b0d31909', '550e8400-e29b-41d4-a716-446655440000', 'Sales Rep Standard Commission', 'flat_rate', 'individual', NULL, NULL, 0.0500, NULL, 'revenue', 0.00, NULL, 'monthly', 30, NULL, 1.000, true, '2025-01-01', NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, '2025-08-03 13:02:42.326712', '2025-08-03 13:02:42.326712', NULL, NULL, NULL, NULL, NULL, true, 90, NULL, 0.00, 'monthly');
INSERT INTO public.commission_structures VALUES ('14ed9b51-efc5-4226-aa9c-8f74ceed9809', '550e8400-e29b-41d4-a716-446655440000', 'Senior Sales Tiered Commission', 'tiered', 'individual', NULL, NULL, 0.0400, NULL, 'gross_profit', 10000.00, NULL, 'monthly', 30, NULL, 1.000, true, '2025-01-01', NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, '2025-08-03 13:02:42.326712', '2025-08-03 13:02:42.326712', NULL, NULL, NULL, NULL, NULL, true, 90, NULL, 0.00, 'monthly');
INSERT INTO public.commission_structures VALUES ('6bb474fb-3b04-4b82-8a95-ed2295e3bf92', '550e8400-e29b-41d4-a716-446655440000', 'Hardware Sales Commission', 'percentage', 'hardware', NULL, NULL, 0.0750, NULL, 'revenue', 0.00, NULL, 'monthly', 30, NULL, 1.000, true, '2025-01-01', NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, '2025-08-03 14:40:00.066333', '2025-08-03 14:40:00.066333', NULL, NULL, NULL, NULL, NULL, true, 90, NULL, 0.00, 'monthly');
INSERT INTO public.commission_structures VALUES ('611c5e7d-e122-457b-a2f9-a737f7493afa', '550e8400-e29b-41d4-a716-446655440000', 'Software Sales Commission', 'percentage', 'software', NULL, NULL, 0.1000, NULL, 'revenue', 0.00, NULL, 'monthly', 30, NULL, 1.000, true, '2025-01-01', NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, '2025-08-03 14:40:00.066333', '2025-08-03 14:40:00.066333', NULL, NULL, NULL, NULL, NULL, true, 90, NULL, 0.00, 'monthly');
INSERT INTO public.commission_structures VALUES ('56c8ae32-4ca6-40a0-b4e4-f9a9466c6a70', '550e8400-e29b-41d4-a716-446655440000', 'Service Contract Commission', 'tiered', 'services', NULL, NULL, 0.0500, NULL, 'revenue', 0.00, NULL, 'quarterly', 30, NULL, 1.000, true, '2025-01-01', NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, '2025-08-03 14:40:00.066333', '2025-08-03 14:40:00.066333', NULL, NULL, NULL, NULL, NULL, true, 90, NULL, 0.00, 'monthly');
INSERT INTO public.commission_structures VALUES ('94f198b2-f353-4dfc-8f6f-ee43b4f58881', '550e8400-e29b-41d4-a716-446655440000', 'Maintenance Contract Commission', 'flat_rate', 'maintenance', NULL, NULL, 0.0300, NULL, 'revenue', 0.00, NULL, 'monthly', 30, NULL, 1.000, true, '2025-01-01', NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, '2025-08-03 14:40:00.066333', '2025-08-03 14:40:00.066333', NULL, NULL, NULL, NULL, NULL, true, 90, NULL, 0.00, 'bi-weekly');


--
-- Data for Name: commission_transactions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.commission_transactions VALUES ('85905124-79b2-475a-b6bd-6cb7d135bde9', '550e8400-e29b-41d4-a716-446655440000', 'sale', NULL, 'a1447ec5-63e9-47a9-9e5d-fbca671e1864', 'Jennifer Martinez', NULL, 'TechCorp Solutions', NULL, 45000.00, 0.0750, 3375.00, 'hardware', NULL, NULL, NULL, NULL, '2025-08-01', '2025-08', 'approved', 'paid', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, 0.00, NULL, NULL, NULL, '2025-08-03 14:40:12.312955', '2025-08-03 14:40:12.312955');
INSERT INTO public.commission_transactions VALUES ('87cc3fc4-a10a-4bd4-be59-5432a7455444', '550e8400-e29b-41d4-a716-446655440000', 'sale', NULL, 'd69af46c-53b5-4c27-8d73-0fc1b38ad9ce', 'Michael Thompson', NULL, 'Global Finance Corp', NULL, 25000.00, 0.1000, 2500.00, 'software', NULL, NULL, NULL, NULL, '2025-08-02', '2025-08', 'approved', 'paid', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, 0.00, NULL, NULL, NULL, '2025-08-03 14:40:12.312955', '2025-08-03 14:40:12.312955');
INSERT INTO public.commission_transactions VALUES ('76dc06d0-91e5-4dee-bdb2-0f11cd800d78', '550e8400-e29b-41d4-a716-446655440000', 'sale', NULL, '81b32926-af7c-460b-af2e-6b73a9d8a509', 'Amanda Chen', NULL, 'Healthcare Associates', NULL, 35000.00, 0.0500, 1750.00, 'services', NULL, NULL, NULL, NULL, '2025-08-03', '2025-08', 'pending', 'unpaid', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, 0.00, NULL, NULL, NULL, '2025-08-03 14:40:12.312955', '2025-08-03 14:40:12.312955');
INSERT INTO public.commission_transactions VALUES ('8e1a5291-0f6f-47ea-a0f4-1700112229de', '550e8400-e29b-41d4-a716-446655440000', 'sale', NULL, '3180e2ec-bdd4-4c50-aeb5-7035769afc78', 'Robert Johnson', NULL, 'Legal Partners LLC', NULL, 55000.00, 0.0750, 4125.00, 'hardware', NULL, NULL, NULL, NULL, '2025-08-03', '2025-08', 'approved', 'unpaid', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, 0.00, NULL, NULL, NULL, '2025-08-03 14:40:12.312955', '2025-08-03 14:40:12.312955');
INSERT INTO public.commission_transactions VALUES ('1e556373-fef4-4882-98f8-91db80eb950c', '550e8400-e29b-41d4-a716-446655440000', 'bonus', NULL, 'a1447ec5-63e9-47a9-9e5d-fbca671e1864', 'Jennifer Martinez', NULL, 'Quota Achievement Bonus', NULL, 10000.00, 0.1000, 1000.00, 'bonus', NULL, NULL, NULL, NULL, '2025-07-31', '2025-07', 'approved', 'paid', false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, 0.00, NULL, NULL, NULL, '2025-08-03 14:40:12.312955', '2025-08-03 14:40:12.312955');


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.companies VALUES ('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'Printyx', NULL, 'SaaS Technology', 'Business Software', 'https://printyx.com', '(555) 123-PRINTYX', 'info@printyx.com', '123 Tech Avenue, Software City, SC 12345', NULL, NULL, 'Main Printyx company - SaaS platform for copier dealers', '2025-08-01 03:56:32.908836', '2025-08-01 03:56:32.908836', 'Customer', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.companies VALUES ('679f04ce-122e-4d95-9add-57fb0575c342', '550e8400-e29b-41d4-a716-446655440000', 'ABC Company', NULL, NULL, NULL, NULL, '5555555555', NULL, NULL, NULL, NULL, NULL, '2025-08-01 04:06:03.059549', '2025-08-01 04:06:03.059549', 'Customer', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.companies VALUES ('0da755ff-fdfb-427c-86a0-89048997b8c8', '550e8400-e29b-41d4-a716-446655440000', 'ABC Company', NULL, NULL, NULL, NULL, '5555555555', NULL, NULL, NULL, NULL, NULL, '2025-08-01 04:06:08.599594', '2025-08-01 04:06:08.599594', 'Customer', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.companies VALUES ('b227b173-ff76-490d-8629-6900d6c9f1d0', '550e8400-e29b-41d4-a716-446655440000', 'Lead Company', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-04 21:03:07.442684', '2025-08-04 21:03:07.442684', 'Customer', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: company_contacts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.company_contacts VALUES ('a3e6768c-3721-44b6-90ac-57c76b7d1bf4', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 'Brian', 'Halligan', 'CEO', 'bh@hubspot.com', '555-0001', NULL, false, NULL, '2025-08-01 20:22:03.965512', '2025-08-01 20:22:03.965512', NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'qualified', '2024-01-30 00:00:00', '2024-02-05 00:00:00', '6f3224b2-221c-42ad-a7f5-a24a11e33621', NULL, NULL);
INSERT INTO public.company_contacts VALUES ('2f6b8705-808d-4d56-8cc5-9e75f35c603c', '550e8400-e29b-41d4-a716-446655440000', '679f04ce-122e-4d95-9add-57fb0575c342', 'Maria', 'Johnson', 'CTO', 'emjohnson@printyx.com', '555-0002', NULL, false, NULL, '2025-08-01 20:22:13.649778', '2025-08-01 20:22:13.649778', NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'contacted', '2024-01-28 00:00:00', '2024-02-03 00:00:00', '6f3224b2-221c-42ad-a7f5-a24a11e33621', NULL, NULL);
INSERT INTO public.company_contacts VALUES ('60258d1d-e561-4f81-8f17-ef40cf6bd963', '550e8400-e29b-41d4-a716-446655440000', 'b227b173-ff76-490d-8629-6900d6c9f1d0', 'New', 'Contact', 'IT Guy', 'newguy@gmail.com', '51555515115', '', false, NULL, '2025-08-04 21:03:07.471358', '2025-08-04 21:03:07.471358', 'Mr.', 'IT', NULL, NULL, true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'new', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.company_contacts VALUES ('88cca1f0-3ebc-4f57-a3dc-cca0f6597772', '550e8400-e29b-41d4-a716-446655440000', 'lead-001', 'John', 'Smith', 'CEO', 'john.smith@leadcompany.com', '555-0123', NULL, false, NULL, '2025-08-05 15:48:51.148209', '2025-08-05 15:48:51.148209', NULL, 'Executive', NULL, NULL, true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'new', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.company_contacts VALUES ('9c0da884-8695-40e0-8537-3bf523e31cc2', '550e8400-e29b-41d4-a716-446655440000', 'lead-002', 'Sarah', 'Johnson', 'CTO', 'sarah@leadcompany.com', '555-0456', NULL, false, NULL, '2025-08-05 15:48:51.148209', '2025-08-05 15:48:51.148209', NULL, 'Technology', NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'contacted', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.company_contacts VALUES ('645a16c7-73a1-4e05-9abe-c4ab3ee1903d', '550e8400-e29b-41d4-a716-446655440000', 'adc117e7-611d-426a-b569-6c6c0bdaf750', 'Mike', 'Davis', 'Manager', 'mike@customercompany.com', '555-0789', NULL, false, NULL, '2025-08-05 15:48:51.148209', '2025-08-05 15:48:51.148209', NULL, 'Sales', NULL, NULL, true, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'customer', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.company_contacts VALUES ('0fe2df39-cdfc-4755-b0bf-dd560325c547', '550e8400-e29b-41d4-a716-446655440000', 'lead-001', 'John ', 'Smith', 'IT Guy', 'JohnS@gmail.com', '5155515151', '', false, NULL, '2025-08-05 15:52:55.690837', '2025-08-05 15:52:55.690837', '', 'IT', NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'new', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.company_contacts VALUES ('472affee-8c88-4883-afc0-00d6a20152d4', '550e8400-e29b-41d4-a716-446655440000', 'lead-002', 'Dan', 'Pearson', 'o', 'pearsonperformance@gmail.com', '8155602217', '5152372352', false, NULL, '2025-08-05 16:01:33.016253', '2025-08-05 16:01:33.016253', '', 'sales', '', NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'new', NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL);
INSERT INTO public.company_contacts VALUES ('2bf936cf-5ac7-477e-b7fa-e1315f88dcb5', '550e8400-e29b-41d4-a716-446655440000', 'e620280d-b634-413f-ba65-9b177523cd95', 'Tyler', 'Durden', 'IT Director', 'TDurden@gmail.com', '5155154455', '', false, NULL, '2025-08-05 16:48:26.411014', '2025-08-05 16:48:26.411014', '', 'it', '', NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'new', NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL);


--
-- Data for Name: company_pricing_settings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.company_pricing_settings VALUES ('e8baa5fe-29eb-431a-9521-28f687812722', '550e8400-e29b-41d4-a716-446655440000', 25.00, true, 5.00, true, '2025-08-01 18:36:21.506897', '2025-08-01 18:36:21.506897');


--
-- Data for Name: contracts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.contracts VALUES ('contract-1', '550e8400-e29b-41d4-a716-446655440000', 'cust-1', 'CNT-2024-001', '2024-01-01 00:00:00', '2026-12-31 00:00:00', 0.0500, 0.1500, 299.99, 'active', '2025-07-31 22:58:52.382991', '2025-07-31 22:58:52.382991');
INSERT INTO public.contracts VALUES ('contract-2', '550e8400-e29b-41d4-a716-446655440000', 'cust-2', 'CNT-2024-002', '2024-03-01 00:00:00', '2027-02-28 00:00:00', 0.0500, 0.1500, 459.99, 'active', '2025-07-31 22:58:52.382991', '2025-07-31 22:58:52.382991');
INSERT INTO public.contracts VALUES ('contract-3', '550e8400-e29b-41d4-a716-446655440000', 'cust-3', 'CNT-2024-003', '2024-06-01 00:00:00', '2025-05-31 00:00:00', 0.0500, 0.1500, 149.99, 'active', '2025-07-31 22:58:52.382991', '2025-07-31 22:58:52.382991');
INSERT INTO public.contracts VALUES ('b68ad3db-3189-4d7e-ab81-0ef1b07f9679', '550e8400-e29b-41d4-a716-446655440000', 'adc117e7-611d-426a-b569-6c6c0bdaf750', 'CNT-1754705167828', '2025-08-08 00:00:00', '2026-08-08 00:00:00', NULL, NULL, NULL, 'active', '2025-08-09 02:06:07.838846', '2025-08-09 02:06:07.838846');


--
-- Data for Name: product_models; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.product_models VALUES ('04d4ad0d-6642-456d-91a8-ac2c45db061b', '550e8400-e29b-41d4-a716-446655440000', 'CN-IPCV1000', 'imagePRESS V1000', 'Production Printer', 'Canon', 'High-performance production printer with advanced color capabilities and finishing options', 171930.00, 'Color', '100', '120', NULL, true, 125000.00, true, 115000.00, false, NULL, true, '2025-08-01 02:55:54.257588', '2025-08-01 02:55:54.257588');
INSERT INTO public.product_models VALUES ('ef23537a-991b-41c8-bdda-396450a748a7', '550e8400-e29b-41d4-a716-446655440000', 'CN-IRC3520I', 'imageRUNNER C3520i', 'MFP', 'Canon', 'Mid-volume color multifunction device ideal for workgroups', 8995.00, 'Color', '20', '20', NULL, true, 7200.00, false, NULL, false, NULL, true, '2025-08-01 02:55:54.257588', '2025-08-01 02:55:54.257588');
INSERT INTO public.product_models VALUES ('ab372198-e4fe-4e1e-8a6d-88c5520b127c', '550e8400-e29b-41d4-a716-446655440000', 'HP-LJ4555X', 'LaserJet Enterprise 4555x', 'MFP', 'HP', 'Monochrome laser MFP with advanced security features', 5499.00, 'B/W', NULL, '55', NULL, true, 4200.00, true, 3800.00, false, NULL, true, '2025-08-01 02:55:54.257588', '2025-08-01 02:55:54.257588');
INSERT INTO public.product_models VALUES ('baad08b0-9234-4ecd-828f-b750c321915a', '550e8400-e29b-41d4-a716-446655440000', 'XR-VL-C8000', 'VersaLink C8000', 'Production Printer', 'Xerox', 'Color production printer with exceptional print quality', 89995.00, 'Color', '45', '45', NULL, true, 72000.00, true, 68000.00, false, NULL, true, '2025-08-01 02:55:54.257588', '2025-08-01 02:55:54.257588');
INSERT INTO public.product_models VALUES ('0705feb3-85e2-4440-8c0a-61790e9b3862', '550e8400-e29b-41d4-a716-446655440000', 'KM-BH454E', 'bizhub 454e', 'MFP', 'Konica Minolta', 'Fast monochrome MFP with flexible finishing options', 6995.00, 'B/W', NULL, '45', NULL, true, 5600.00, true, 5200.00, false, NULL, true, '2025-08-01 02:55:54.257588', '2025-08-01 02:55:54.257588');
INSERT INTO public.product_models VALUES ('443f1daa-e4b3-4019-b58b-c8b8d8798011', '550e8400-e29b-41d4-a716-446655440000', 'CANON-IR-C3025i', 'imageRUNNER C3025i', 'MFP', 'Canon', 'Color multifunction printer with advanced productivity features', 4500.00, 'Color', '25', '25', 'imageRUNNER', true, 3250.00, true, 3400.00, false, NULL, true, '2025-08-01 18:48:15.894128', '2025-08-01 18:48:15.894128');
INSERT INTO public.product_models VALUES ('8980bf51-1c26-4c42-a591-2360228efb2c', '550e8400-e29b-41d4-a716-446655440000', 'HP-LJ-M404dn', 'LaserJet Pro M404dn', 'Printer', 'HP', 'Fast, reliable monochrome printing with automatic duplex and network connectivity', 329.00, 'Monochrome', '0', '38', 'LaserJet Pro', true, 225.00, true, 250.00, false, NULL, true, '2025-08-01 18:48:15.894128', '2025-08-01 18:48:15.894128');
INSERT INTO public.product_models VALUES ('ba2d565b-42fc-429f-a6cd-fcfef42a9dbc', '550e8400-e29b-41d4-a716-446655440000', 'XEROX-WC6515', 'WorkCentre 6515', 'MFP', 'Xerox', 'All-in-one color MFP with print, copy, scan, and fax capabilities', 599.00, 'Color', '28', '30', 'WorkCentre', true, 448.00, true, 475.00, false, NULL, true, '2025-08-01 18:48:15.894128', '2025-08-01 18:48:15.894128');
INSERT INTO public.product_models VALUES ('5f8127bc-497d-4aca-9082-3fb8b4f58f3c', '550e8400-e29b-41d4-a716-446655440000', 'CANON-IR-ADV-C5535i', 'imageRUNNER ADVANCE C5535i', 'MFP', 'Canon', 'Enterprise-class color MFP with exceptional image quality and productivity features', 8995.00, 'Color', '35', '35', 'imageRUNNER ADVANCE', true, 6750.00, true, 7200.00, false, NULL, true, '2025-08-01 18:48:15.894128', '2025-08-01 18:48:15.894128');
INSERT INTO public.product_models VALUES ('31a4c554-c47a-47d6-9884-7ffff31aa01d', '550e8400-e29b-41d4-a716-446655440000', 'RICOH-MP-C3004', 'MP C3004', 'MFP', 'Ricoh', 'Intelligent color MFP with touchscreen interface and cloud connectivity', 3799.00, 'Color', '30', '30', 'MP C Series', true, 2850.00, true, 3000.00, false, NULL, true, '2025-08-01 18:48:15.894128', '2025-08-01 18:48:15.894128');
INSERT INTO public.product_models VALUES ('fb50e0cd-8902-48cf-87b1-976dc35a9e9d', '550e8400-e29b-41d4-a716-446655440000', 'KYOCERA-TA5002i', 'TASKalfa 5002i', 'MFP', 'Kyocera', 'High-volume monochrome MFP with advanced document handling', 2995.00, 'Monochrome', '0', '50', 'TASKalfa', true, 2250.00, true, 2400.00, false, NULL, true, '2025-08-01 18:48:15.894128', '2025-08-01 18:48:15.894128');


--
-- Data for Name: cpc_rates; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.cpc_rates VALUES ('b04d19fe-49ac-4aa8-baa3-ad745766baab', '550e8400-e29b-41d4-a716-446655440000', '04d4ad0d-6642-456d-91a8-ac2c45db061b', 'Color', '0-5000', 0.089, '2025-08-01 02:55:58.862897', '2025-08-01 02:55:58.862897');


--
-- Data for Name: customer_activities; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customer_contacts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customer_equipment; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customer_interactions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customer_portal_access; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customer_meter_submissions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customer_payments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customer_service_requests; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customer_supply_orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customer_notifications; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customer_number_config; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customer_number_history; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customer_portal_activity_log; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customer_related_records; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customer_supply_order_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.customers VALUES ('adc117e7-611d-426a-b569-6c6c0bdaf750', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', '82615de8-8ff3-4213-9a6c-04da7f3a9f0b', 'existing_business', 'customer', 10000.00, 100, NULL, NULL, 0, 'medium', 'Converted from existing company record', NULL, NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', NULL, NULL, NULL, NULL, NULL, 0.00, NULL, NULL, '2025-08-02 04:11:18.931761', '2025-08-02 04:11:18.931761', NULL, NULL);
INSERT INTO public.customers VALUES ('6f648e51-25e8-4ef5-b7cf-6f5759a385ea', '550e8400-e29b-41d4-a716-446655440000', '679f04ce-122e-4d95-9add-57fb0575c342', '761df3e1-c480-4985-bc3d-d7f5519ea2b7', 'existing_business', 'customer', 10000.00, 100, NULL, NULL, 0, 'medium', 'Converted from existing company record', NULL, NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', NULL, NULL, NULL, NULL, NULL, 0.00, NULL, NULL, '2025-08-02 04:11:18.931761', '2025-08-02 04:11:18.931761', NULL, NULL);
INSERT INTO public.customers VALUES ('01e8d93b-c133-4c23-9894-88cf214ccade', '550e8400-e29b-41d4-a716-446655440000', '0da755ff-fdfb-427c-86a0-89048997b8c8', 'b5b054e5-aeef-42e0-abe6-cfb9c8ab5535', 'existing_business', 'customer', 10000.00, 100, NULL, NULL, 0, 'medium', 'Converted from existing company record', NULL, NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', NULL, NULL, NULL, NULL, NULL, 0.00, NULL, NULL, '2025-08-02 04:11:18.931761', '2025-08-02 04:11:18.931761', NULL, NULL);


--
-- Data for Name: deal_stages; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.deal_stages VALUES ('a55d8db1-de56-4b4b-b9bf-aa246cdbeb44', '6f3224b2-221c-42ad-a7f5-a24a11e33621', 'Appointment Scheduled', NULL, '#3B82F6', 1, true, false, false, '2025-08-01 16:00:01.593133', '2025-08-01 16:00:01.593133', false, NULL);
INSERT INTO public.deal_stages VALUES ('69214b67-3ee4-461a-9da7-889584b01c8c', '6f3224b2-221c-42ad-a7f5-a24a11e33621', 'Qualified to Buy', NULL, '#8B5CF6', 2, true, false, false, '2025-08-01 16:00:01.593133', '2025-08-01 16:00:01.593133', false, NULL);
INSERT INTO public.deal_stages VALUES ('96050589-3614-4839-a26c-2c059655ad8e', '6f3224b2-221c-42ad-a7f5-a24a11e33621', 'Presentation Scheduled', NULL, '#06B6D4', 3, true, false, false, '2025-08-01 16:00:01.593133', '2025-08-01 16:00:01.593133', false, NULL);
INSERT INTO public.deal_stages VALUES ('0f2e767f-3bbb-434f-ad3d-630e2a0a2af9', '6f3224b2-221c-42ad-a7f5-a24a11e33621', 'Decision Maker Bought-In', NULL, '#F59E0B', 4, true, false, false, '2025-08-01 16:00:01.593133', '2025-08-01 16:00:01.593133', false, NULL);
INSERT INTO public.deal_stages VALUES ('5a786b22-2527-4837-bb2c-76b92c4f8af0', '6f3224b2-221c-42ad-a7f5-a24a11e33621', 'Contract Sent', NULL, '#EF4444', 5, true, false, false, '2025-08-01 16:00:01.593133', '2025-08-01 16:00:01.593133', false, NULL);
INSERT INTO public.deal_stages VALUES ('cb9af107-22ae-4fc2-a1c7-caf7b9834b9d', '6f3224b2-221c-42ad-a7f5-a24a11e33621', 'Closed Won', NULL, '#10B981', 6, true, true, true, '2025-08-01 16:00:01.593133', '2025-08-01 16:00:01.593133', false, NULL);
INSERT INTO public.deal_stages VALUES ('855c096c-c543-4e0d-b59e-35050faa3795', '6f3224b2-221c-42ad-a7f5-a24a11e33621', 'Closed Lost', NULL, '#6B7280', 7, true, true, false, '2025-08-01 16:00:01.593133', '2025-08-01 16:00:01.593133', false, NULL);
INSERT INTO public.deal_stages VALUES ('c25f95f6-eaea-4720-adc1-12a7101838cd', '550e8400-e29b-41d4-a716-446655440000', 'Appointment Scheduled', NULL, '#3B82F6', 1, true, false, false, '2025-08-02 02:33:48.469042', '2025-08-02 02:33:48.469042', false, NULL);
INSERT INTO public.deal_stages VALUES ('be80c092-167e-425f-9a39-6027f9c4f9a7', '550e8400-e29b-41d4-a716-446655440000', 'Qualified to Buy', NULL, '#8B5CF6', 2, true, false, false, '2025-08-02 02:33:48.488981', '2025-08-02 02:33:48.488981', false, NULL);
INSERT INTO public.deal_stages VALUES ('10d89e8f-4a48-406a-be0b-f76adda3f20a', '550e8400-e29b-41d4-a716-446655440000', 'Presentation Scheduled', NULL, '#06B6D4', 3, true, false, false, '2025-08-02 02:33:48.504117', '2025-08-02 02:33:48.504117', false, NULL);
INSERT INTO public.deal_stages VALUES ('64f4f839-ffb5-4114-9727-5cca50f19e84', '550e8400-e29b-41d4-a716-446655440000', 'Decision Maker Bought-In', NULL, '#F59E0B', 4, true, false, false, '2025-08-02 02:33:48.520255', '2025-08-02 02:33:48.520255', false, NULL);
INSERT INTO public.deal_stages VALUES ('f2082e10-221c-4988-b169-5bd1e484c5c4', '550e8400-e29b-41d4-a716-446655440000', 'Contract Sent', NULL, '#EF4444', 5, true, false, false, '2025-08-02 02:33:48.535372', '2025-08-02 02:33:48.535372', false, NULL);
INSERT INTO public.deal_stages VALUES ('dc087fa4-27bd-4aef-979b-79bf817e3816', '550e8400-e29b-41d4-a716-446655440000', 'Closed Won', NULL, '#10B981', 6, true, true, true, '2025-08-02 02:33:48.550732', '2025-08-02 02:33:48.550732', false, NULL);
INSERT INTO public.deal_stages VALUES ('155e559a-46c6-4824-b553-5e5579dca116', '550e8400-e29b-41d4-a716-446655440000', 'Closed Lost', NULL, '#6B7280', 7, true, true, false, '2025-08-02 02:33:48.565688', '2025-08-02 02:33:48.565688', false, NULL);


--
-- Data for Name: deals; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.deals VALUES ('8b359d9c-3fec-42c6-911b-e0dca8a2ca74', '550e8400-e29b-41d4-a716-446655440000', 'Trial Deal', NULL, 50000.00, 'Lead Company', NULL, NULL, NULL, 'website', NULL, 'medium', '2025-08-29 00:00:00', NULL, NULL, NULL, 'open', 50, 'be80c092-167e-425f-9a39-6027f9c4f9a7', '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-08 20:18:50.789042', '2025-08-09 01:04:57.435', NULL, NULL, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL);
INSERT INTO public.deals VALUES ('4a86abaf-85fa-4bcf-88c9-cf0b289b1119', '550e8400-e29b-41d4-a716-446655440000', 'Big Deal', NULL, 50000.00, 'ABC Company', 'Maria Johnson', 'emjohnson@printyx.com', '555-0002', 'website', 'new_business', 'medium', '2025-10-22 00:00:00', NULL, NULL, NULL, 'open', 50, 'be80c092-167e-425f-9a39-6027f9c4f9a7', '907d3114-5221-49d4-999d-4e2478fabb70', '2025-08-02 02:36:34.795769', '2025-08-09 01:05:02.573', NULL, NULL, NULL, NULL, '907d3114-5221-49d4-999d-4e2478fabb70', NULL);
INSERT INTO public.deals VALUES ('badaa6b7-a23d-4ae0-be90-39711cbc0ebd', '550e8400-e29b-41d4-a716-446655440000', ' (PROP-2025-0009)', NULL, 72000.00, 'GHI Company', NULL, NULL, NULL, NULL, NULL, 'medium', '2025-08-29 00:00:00', NULL, NULL, NULL, 'open', 70, 'f2082e10-221c-4988-b169-5bd1e484c5c4', '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-09 12:50:05.873', '2025-08-09 12:50:05.873', 'e620280d-b634-413f-ba65-9b177523cd95', NULL, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL);
INSERT INTO public.deals VALUES ('d6f1b950-4d75-4d70-980a-e6b823b6b672', '550e8400-e29b-41d4-a716-446655440000', 'Trail Quote (PROP-2025-0008)', NULL, 3250.00, 'ABC Company', NULL, NULL, NULL, NULL, NULL, 'medium', '2025-08-29 00:00:00', NULL, NULL, NULL, 'open', 70, 'f2082e10-221c-4988-b169-5bd1e484c5c4', '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-08 20:19:53.404', '2025-08-08 20:19:53.404', 'lead-001', NULL, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL);
INSERT INTO public.deals VALUES ('22aab668-a0f2-4ed4-b7f1-a289e11a5cbb', '550e8400-e29b-41d4-a716-446655440000', 'Test Deal', 'Testing deal creation', 5000.00, 'Test Company', 'John Doe', NULL, NULL, NULL, NULL, 'medium', '2025-08-29 00:00:00', NULL, NULL, NULL, 'open', 50, '10d89e8f-4a48-406a-be0b-f76adda3f20a', '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-02 02:35:26.445924', '2025-08-09 01:04:43.474', NULL, NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: deal_activities; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.deal_activities VALUES ('197b9e75-8d29-4a48-bf14-d6a140adbcc3', '550e8400-e29b-41d4-a716-446655440000', '4a86abaf-85fa-4bcf-88c9-cf0b289b1119', '907d3114-5221-49d4-999d-4e2478fabb70', 'stage_change', NULL, 'Deal stage changed to Contract Sent', '2025-08-02 03:01:17.107318', '2025-08-02 03:01:17.107318', 'stage_change', 'Deal moved to Contract Sent', NULL, NULL, '{"stageId":"f2082e10-221c-4988-b169-5bd1e484c5c4"}', '{"stageId":"f2082e10-221c-4988-b169-5bd1e484c5c4"}');
INSERT INTO public.deal_activities VALUES ('599ec956-10ab-4989-8e14-c655bc1db7d4', '550e8400-e29b-41d4-a716-446655440000', '4a86abaf-85fa-4bcf-88c9-cf0b289b1119', '907d3114-5221-49d4-999d-4e2478fabb70', 'stage_change', NULL, 'Deal stage changed to Presentation Scheduled', '2025-08-02 03:03:01.506157', '2025-08-02 03:03:01.506157', 'stage_change', 'Deal moved to Presentation Scheduled', NULL, NULL, '{"stageId":"10d89e8f-4a48-406a-be0b-f76adda3f20a"}', '{"stageId":"10d89e8f-4a48-406a-be0b-f76adda3f20a"}');
INSERT INTO public.deal_activities VALUES ('0bc1a921-a8f8-433a-8402-28b87b96f567', '550e8400-e29b-41d4-a716-446655440000', '22aab668-a0f2-4ed4-b7f1-a289e11a5cbb', '58c36f26-c458-400b-8055-5dfa31afa88a', 'stage_change', NULL, 'Deal stage changed to Decision Maker Bought-In', '2025-08-05 16:09:58.121126', '2025-08-05 16:09:58.121126', 'stage_change', 'Deal moved to Decision Maker Bought-In', NULL, NULL, '{"stageId":"64f4f839-ffb5-4114-9727-5cca50f19e84"}', '{"stageId":"64f4f839-ffb5-4114-9727-5cca50f19e84"}');
INSERT INTO public.deal_activities VALUES ('e9ccacb2-0310-4906-a375-7ed74d0549a6', '550e8400-e29b-41d4-a716-446655440000', '4a86abaf-85fa-4bcf-88c9-cf0b289b1119', '907d3114-5221-49d4-999d-4e2478fabb70', 'stage_change', NULL, 'Deal stage changed to Qualified to Buy', '2025-08-08 19:52:24.358625', '2025-08-08 19:52:24.358625', 'stage_change', 'Deal moved to Qualified to Buy', NULL, NULL, '{"stageId":"be80c092-167e-425f-9a39-6027f9c4f9a7"}', '{"stageId":"be80c092-167e-425f-9a39-6027f9c4f9a7"}');
INSERT INTO public.deal_activities VALUES ('ed41f158-6a79-440b-a3b6-16976af5833d', '550e8400-e29b-41d4-a716-446655440000', '4a86abaf-85fa-4bcf-88c9-cf0b289b1119', '907d3114-5221-49d4-999d-4e2478fabb70', 'stage_change', NULL, 'Deal stage changed to Presentation Scheduled', '2025-08-09 01:04:41.302477', '2025-08-09 01:04:41.302477', 'stage_change', 'Deal moved to Presentation Scheduled', NULL, NULL, '{"stageId":"10d89e8f-4a48-406a-be0b-f76adda3f20a"}', '{"stageId":"10d89e8f-4a48-406a-be0b-f76adda3f20a"}');
INSERT INTO public.deal_activities VALUES ('785838f5-bef7-44ce-842e-6428a2142e8e', '550e8400-e29b-41d4-a716-446655440000', '22aab668-a0f2-4ed4-b7f1-a289e11a5cbb', '58c36f26-c458-400b-8055-5dfa31afa88a', 'stage_change', NULL, 'Deal stage changed to Presentation Scheduled', '2025-08-09 01:04:43.497799', '2025-08-09 01:04:43.497799', 'stage_change', 'Deal moved to Presentation Scheduled', NULL, NULL, '{"stageId":"10d89e8f-4a48-406a-be0b-f76adda3f20a"}', '{"stageId":"10d89e8f-4a48-406a-be0b-f76adda3f20a"}');
INSERT INTO public.deal_activities VALUES ('08ba479e-9fb1-4373-a381-c337046ab1b9', '550e8400-e29b-41d4-a716-446655440000', '8b359d9c-3fec-42c6-911b-e0dca8a2ca74', '58c36f26-c458-400b-8055-5dfa31afa88a', 'stage_change', NULL, 'Deal stage changed to Presentation Scheduled', '2025-08-09 01:04:47.862833', '2025-08-09 01:04:47.862833', 'stage_change', 'Deal moved to Presentation Scheduled', NULL, NULL, '{"stageId":"10d89e8f-4a48-406a-be0b-f76adda3f20a"}', '{"stageId":"10d89e8f-4a48-406a-be0b-f76adda3f20a"}');
INSERT INTO public.deal_activities VALUES ('5dfba72f-77f9-41cc-849d-9ba1435bc6c6', '550e8400-e29b-41d4-a716-446655440000', '8b359d9c-3fec-42c6-911b-e0dca8a2ca74', '58c36f26-c458-400b-8055-5dfa31afa88a', 'stage_change', NULL, 'Deal stage changed to Qualified to Buy', '2025-08-09 01:04:57.45886', '2025-08-09 01:04:57.45886', 'stage_change', 'Deal moved to Qualified to Buy', NULL, NULL, '{"stageId":"be80c092-167e-425f-9a39-6027f9c4f9a7"}', '{"stageId":"be80c092-167e-425f-9a39-6027f9c4f9a7"}');
INSERT INTO public.deal_activities VALUES ('119b79ff-66cd-4514-90c7-047e9fec6d94', '550e8400-e29b-41d4-a716-446655440000', '4a86abaf-85fa-4bcf-88c9-cf0b289b1119', '907d3114-5221-49d4-999d-4e2478fabb70', 'stage_change', NULL, 'Deal stage changed to Appointment Scheduled', '2025-08-09 01:04:59.916778', '2025-08-09 01:04:59.916778', 'stage_change', 'Deal moved to Appointment Scheduled', NULL, NULL, '{"stageId":"c25f95f6-eaea-4720-adc1-12a7101838cd"}', '{"stageId":"c25f95f6-eaea-4720-adc1-12a7101838cd"}');
INSERT INTO public.deal_activities VALUES ('e8ebb55e-fa31-4331-bc93-833d0577f1fc', '550e8400-e29b-41d4-a716-446655440000', '4a86abaf-85fa-4bcf-88c9-cf0b289b1119', '907d3114-5221-49d4-999d-4e2478fabb70', 'stage_change', NULL, 'Deal stage changed to Qualified to Buy', '2025-08-09 01:05:02.596713', '2025-08-09 01:05:02.596713', 'stage_change', 'Deal moved to Qualified to Buy', NULL, NULL, '{"stageId":"be80c092-167e-425f-9a39-6027f9c4f9a7"}', '{"stageId":"be80c092-167e-425f-9a39-6027f9c4f9a7"}');


--
-- Data for Name: manufacturer_integrations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: device_registrations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: device_metrics; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: device_performance_trends; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.device_performance_trends VALUES ('904a3f1a-8e34-4971-a063-d93dcbf94a7f', '550e8400-e29b-41d4-a716-446655440000', 'DEV-001', '2025-07-01', '2025-07-31', 'monthly', 98.50, 12450, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'stable', NULL, false, 0, 0.95, NULL, 0.12, 85, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-03 13:09:55.004503', '2025-08-03 13:09:55.004503');
INSERT INTO public.device_performance_trends VALUES ('b70a404a-dfc1-482c-95f4-a27e2f77c66c', '550e8400-e29b-41d4-a716-446655440000', 'DEV-002', '2025-07-01', '2025-07-31', 'monthly', 96.20, 8750, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'improving', NULL, false, 0, 0.88, NULL, 0.25, 72, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-03 13:09:55.004503', '2025-08-03 13:09:55.004503');
INSERT INTO public.device_performance_trends VALUES ('14c89808-e18e-447b-8196-dffdbf6540ab', '550e8400-e29b-41d4-a716-446655440000', 'DEV-003', '2025-07-01', '2025-07-31', 'monthly', 94.10, 3250, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'declining', NULL, false, 0, 0.78, NULL, 0.45, 45, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-03 13:09:55.004503', '2025-08-03 13:09:55.004503');


--
-- Data for Name: device_telemetry; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: master_product_models; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.master_product_models VALUES ('6fcc0890-78c2-4308-a82c-6de9fda452a5', 'Xerox', 'VersaLink C7000', 'Xerox VersaLink C7000 Color Printer', 'Printer', 'A3 Color', 4299.00, '{"weight": "40 kg", "features": ["Duplex printing", "Mobile printing", "Cloud connectivity"], "dimensions": "506 x 575 x 412 mm", "printSpeed": "35 ppm color/BW", "resolution": "1200 x 2400 dpi", "connectivity": ["Ethernet", "Wi-Fi", "USB", "NFC"], "paperCapacity": "620 sheets standard"}', 'active', '2025-08-09 16:13:19.186751', '2025-08-09 16:13:19.186751', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('6cf66db2-1152-4e08-9dee-de550b7cd6f0', 'HP', 'LaserJet Enterprise M507dn', 'HP LaserJet Enterprise M507dn', 'Printer', 'A4 Mono', 449.00, '{"weight": "13.6 kg", "features": ["Duplex printing", "Security features", "Energy efficient"], "dimensions": "416 x 372 x 252 mm", "printSpeed": "43 ppm", "resolution": "1200 x 1200 dpi", "connectivity": ["Ethernet", "USB"], "paperCapacity": "650 sheets standard"}', 'active', '2025-08-09 16:13:19.186751', '2025-08-09 16:13:19.186751', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('4370b549-7a12-4d86-971d-dba4466cc508', 'HP', 'Color LaserJet Enterprise M751dn', 'HP Color LaserJet Enterprise M751dn', 'Printer', 'A3 Color', 2799.00, '{"weight": "29.1 kg", "features": ["Duplex printing", "Security features", "Mobile printing"], "dimensions": "471 x 527 x 385 mm", "printSpeed": "41 ppm color, 43 ppm BW", "resolution": "1200 x 1200 dpi", "connectivity": ["Ethernet", "USB"], "paperCapacity": "650 sheets standard"}', 'active', '2025-08-09 17:36:46.235735', '2025-08-09 17:36:46.235735', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('9c8fc155-a326-4567-a496-3baaf81c1fbe', 'Canon', '2184C003AB', '" GPR-58 Magenta Toner (18', 'Supplies', 'accessory', 120.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:13.585076', '2025-08-09 18:25:34.617', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('f3bdf745-c858-4fd5-9d05-b63c7ff0e30c', 'Canon', '2188C003BA', '" GPR-58 Magenta Drum Unit (C359iF- 45', 'Supplies', 'accessory', NULL, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:13.441445', '2025-08-09 18:25:34.491', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'Canon', '"Remote Operator''s Software Kit', 'Color Network ScanGear', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:11.470521', '2025-08-09 18:25:32.768', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('bc630911-9270-4fd1-bd2b-926175c26c61', 'Canon', '2186C003BA', '" GPR-58 Black Drum Unit  (C359iF- 48', 'Supplies', 'accessory', NULL, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:13.369996', '2025-08-09 18:25:34.428', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('88365eb7-65a0-46db-a5db-8ba84e6d0f4f', 'Canon', '2183C003AB', '" GPR-58 Cyan Toner (18', 'Supplies', 'accessory', 120.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:13.549235', '2025-08-09 18:25:34.584', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('f4abd7a8-6e2c-4269-b760-fb0b2f8eed18', 'Canon', '2189C003BA', '" GPR-58 Yellow Drum Unit (C359iF- 45', 'Supplies', 'accessory', NULL, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:13.478092', '2025-08-09 18:25:34.522', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('01521971-8c68-4239-b5f1-b2d3715d60f6', 'Canon', '2182C003BA', '" GPR-58 Black Toner (23', 'Supplies', 'accessory', 58.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:13.512655', '2025-08-09 18:25:34.553', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b7eda2c2-d575-4937-81f4-b13dd80e5cbd', 'Canon', '1008B001AA', 'Staple-P1 <1>', 'Supplies', 'accessory', 84.00, '{"section": "Supplies", "dealerPrice": 45, "isMainModel": false}', 'active', '2025-08-09 18:25:13.333661', '2025-08-09 18:25:34.393', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('80a2f2bd-820b-44f7-94b5-fcd5cba70a3f', 'Canon', '"Data Encryption (FIPS-140-2)', 'IP Sec', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:11.434644', '2025-08-09 18:25:32.735', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8c5ea079-9243-4368-be7b-6d812bf8cc45', 'Canon', '5846C003AA', 'imageRUNNER ADVANCE DX C359iF <1><2>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:11.252402', '2025-08-09 18:25:32.576', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('46e79f95-0c26-4190-a39c-81769f106b35', 'Canon', '5847C003AA', 'imageRUNNER ADVANCE DX C259iF <1><2>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:11.288859', '2025-08-09 18:25:32.608', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('1900884d-836e-4884-8289-dd271b1dc54b', 'Canon', 'Envelope Feeder Attachment', '550-sheet Cassette', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:11.326751', '2025-08-09 18:25:32.639', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('54bd1548-50cd-447f-8f06-88a8da1eda80', 'Canon', '"Direct PDF/XPS Printing', 'Color Universal Send with PDF High Compression', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:11.363075', '2025-08-09 18:25:32.67', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8e1a1433-1249-41b2-bc7d-82ef257f73e7', 'Canon', '"Searchable PDF/XPS', 'OOXML (Scan to PPT and Word)', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:11.399251', '2025-08-09 18:25:32.704', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c069af4f-cf67-411f-b502-2f8074bef535', 'Canon', '2187C003BA', '" GPR-58 Cyan Drum Unit (C359iF- 45', 'Supplies', 'accessory', NULL, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:13.406391', '2025-08-09 18:25:34.459', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('d694839b-cbce-40af-ba18-66ced0f21d7e', 'Canon', '4836C009AA', 'imageRUNNER ADVANCE DX C478iF (Toner T04L Bundled)<1><3><4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:13.732349', '2025-08-09 18:25:34.742', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('14ebd1a1-f3b6-426f-bfd1-e54992559ceb', 'Canon', '4837C001AA', 'imageRUNNER ADVANCE DX C568iF <1><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:13.94714', '2025-08-09 18:25:34.932', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('7fe4e1d0-916f-4d8d-b2df-b0f7322010d8', 'Canon', '4837C002AA', 'imageRUNNER ADVANCE DX C568iFZ <1><2><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:13.983257', '2025-08-09 18:25:34.965', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('defd982b-fcf5-4e25-9d7a-cbc84b7cbfc9', 'Canon', '4836C001AA', 'imageRUNNER ADVANCE DX C478iF <1><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:14.018533', '2025-08-09 18:25:34.998', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('476ddceb-5e67-4f40-980d-9361ba382cc0', 'Canon', '4836C002AA', 'imageRUNNER ADVANCE DX C478iFZ <1><2><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:14.053495', '2025-08-09 18:25:35.03', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e4770471-fe52-48dd-8bf0-66f0cec3c641', 'Canon', '2980C001AA', '"TONER T04 BK Yield 33', 'Supplies', 'accessory', 165.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:14.81579', '2025-08-09 18:25:35.698', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c82e1575-f0a9-44f0-aeb3-5c84e8b686e0', 'Canon', '4837C004AA', 'imageRUNNER ADVANCE DX C568iFZ (Toner T04L Bundled) <1><2><3><4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:13.697121', '2025-08-09 18:25:34.711', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('00656ebc-b3ff-4061-8719-c18f79746dbb', 'Canon', '550-sheet Cassette', '100-sheet Stack Bypass', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:13.803357', '2025-08-09 18:25:34.805', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('4799b23c-a960-4f95-8123-5fa622ce9dc0', 'Canon', '4836C010AA', 'imageRUNNER ADVANCE DX C478iFZ (Toner T04L Bundled) <1><2><3><4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:13.766995', '2025-08-09 18:25:34.774', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2edff127-7066-46d2-8899-505ff2301615', 'Canon', '"OOXML (Scan to PPT and Word)', 'Universal Login Manager (Requires Download)', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:13.874986', '2025-08-09 18:25:34.867', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('1ced6623-3620-4250-b777-21b64bc5c483', 'Canon', '"Color Universal Send with PDF High Compression', 'Encrypted PDF', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:13.838641', '2025-08-09 18:25:34.836', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('3349f062-5631-411c-b16b-7e66bff7ff20', 'Canon', '2979C001AA', '"TONER T04 C Yield 27', 'Supplies', 'accessory', 272.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:14.851405', '2025-08-09 18:25:35.73', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2bd24af4-c1f8-4a0d-994d-784e63a0b15c', 'Canon', '2978C001AA', '"TONER T04 M Yield 27', 'Supplies', 'accessory', 272.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:14.887138', '2025-08-09 18:25:35.763', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('6fd472f7-aefd-46de-b12e-99170ab47995', 'Canon', '2977C001AA', '"TONER T04 Y Yield 27', 'Supplies', 'accessory', 272.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:14.922805', '2025-08-09 18:25:35.794', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b4a773f2-5bff-4a67-84fd-f1fbb7a77c70', 'Canon', '4616C001AA', '"TONER T04L BK Yield 11', 'Supplies', 'accessory', 107.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:14.958623', '2025-08-09 18:25:35.825', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c6c26a20-a889-49f1-b8f5-a15ed5be7756', 'Canon', '4615C001AA', '"TONER T04L C Yield 9', 'Supplies', 'accessory', 141.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:14.99438', '2025-08-09 18:25:35.856', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('093abf2c-4cdf-4964-850a-0b2033fcaff4', 'Canon', '4614C001AA', '"TONER T04L M Yield 9', 'Supplies', 'accessory', 141.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:15.029982', '2025-08-09 18:25:35.888', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2c2bf9e3-74b1-45ec-8939-664e98972eff', 'Canon', '4613C001AA', '"TONER T04L Y Yield 9', 'Supplies', 'accessory', 141.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:15.065364', '2025-08-09 18:25:35.919', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0e667a01-0a95-48fa-aae9-1a2507532041', 'Canon', '5961C002AA', 'imageRUNNER ADVANCE DX C3935i <1><2>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:15.10067', '2025-08-09 18:25:35.95', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e2c313af-4af2-411d-8eff-bc4a515bbbce', 'Canon', '5962C002AA', 'imageRUNNER ADVANCE DX C3930i <1><2>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:15.137004', '2025-08-09 18:25:35.982', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('7ba13b06-59e9-4f5c-9407-c1ca8d35ed20', 'Canon', '5963C002AA', 'imageRUNNER ADVANCE DX C3926i <1><2>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:15.172562', '2025-08-09 18:25:36.013', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0fc6e804-d2e4-4bef-aa02-badb783a223a', 'Canon', 'OOXML (Scan to PPT and Word)', 'Universal Login Manager(Requires Download)', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:15.245168', '2025-08-09 18:25:36.08', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('d10c773b-2953-4e77-add5-ff998ff9b616', 'Canon', 'IP Sec', 'Encrypted Secure Print', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:15.281967', '2025-08-09 18:25:36.111', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('92f1f0ee-3da9-44f2-9d21-08f2e617a259', 'Canon', '5754C003AA', 'GPR-66 Cyan Toner (25.5K impressions @ 5% coverage)', 'Supplies', 'accessory', 210.00, '{"section": "Supplies", "dealerPrice": 126, "isMainModel": false}', 'active', '2025-08-09 18:25:17.795923', '2025-08-09 18:25:38.288', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e6b474b1-f5d5-4648-81d4-6403e29fc657', 'Canon', 'Color Universal Send with PDF High Compression', 'Encrypted PDF', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:15.209385', '2025-08-09 18:25:36.045', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('1f2f0250-d1e0-491e-8ada-b124c4f66dc1', 'Canon', '"IP Sec', 'Encrypted Secure Print', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:13.911185', '2025-08-09 18:25:34.898', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('f6a85ec4-df7c-4436-b143-969e50feed30', 'Canon', '3824C002AA', 'imageRUNNER ADVANCE DX C5870i <1><2>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:18.013127', '2025-08-09 18:25:38.476', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('6c304266-7258-4d4b-a1cb-300cf299e09d', 'Canon', '5756C003AA', 'GPR-66 Yellow Toner (25.5K impressions @ 5% coverage)', 'Supplies', 'accessory', 210.00, '{"section": "Supplies", "dealerPrice": 126, "isMainModel": false}', 'active', '2025-08-09 18:25:17.867923', '2025-08-09 18:25:38.349', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a538c2ca-973a-4dba-a080-16fe76e36527', 'Canon', '5758C002AA', 'GPR-66L Cyan Toner  (11K impressions @ 5% coverage)', 'Supplies', 'accessory', 132.00, '{"section": "Supplies", "dealerPrice": 79, "isMainModel": false}', 'active', '2025-08-09 18:25:17.903668', '2025-08-09 18:25:38.381', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a31b6caf-473e-4b71-aa6b-8f6adbf62939', 'Canon', '5755C003AA', 'GPR-66 Magenta Toner (25.5K impressions @ 5% coverage)', 'Supplies', 'accessory', 210.00, '{"section": "Supplies", "dealerPrice": 126, "isMainModel": false}', 'active', '2025-08-09 18:25:17.83186', '2025-08-09 18:25:38.319', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2d6c28b7-baf3-4cec-8a9e-00613cb5ee66', 'Canon', '8528B004AA', '"GPR-53 Drum Unit (C3935i -BW 96.4K', 'Supplies', 'accessory', NULL, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:17.723506', '2025-08-09 18:25:38.224', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('dcbb5360-f825-4548-a00e-e115657b4b80', 'Canon', '5760C002AA', 'GPR-66L Yellow Toner  (11K impressions @ 5% coverage)', 'Supplies', 'accessory', 132.00, '{"section": "Supplies", "dealerPrice": 79, "isMainModel": false}', 'active', '2025-08-09 18:25:17.975865', '2025-08-09 18:25:38.444', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('fd50ff13-c682-4d5c-a40c-1cb84947ec52', 'Canon', '4837C003AA', 'imageRUNNER ADVANCE DX C568iF (Toner T04L Bundled)<1><3><4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:13.66082', '2025-08-09 18:25:34.679', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('bb1820b8-9263-4a07-af23-baae59a93c4a', 'Canon', 'uniFLOW Online Express', 'Access Management System', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:18.264963', '2025-08-09 18:25:38.712', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('05b16967-f5f3-40b4-a26b-b8f8a5b8ddb0', 'Canon', '6141C003AA', '"GPR-1001 Drum Unit (BW: 600K', 'Supplies', 'accessory', 809.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:23.088585', '2025-08-09 18:25:43.268', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b6c451b2-3fa1-495a-975a-0aee9f4ba225', 'Canon', 'Encrypted PDF', 'Digital Signature PDF (Device and User Signature)', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:18.229092', '2025-08-09 18:25:38.683', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('49241dbc-fd97-42a3-8390-d740f8cc120b', 'Canon', '3826C002AA', 'imageRUNNER ADVANCE DX C5850i <1><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:18.085561', '2025-08-09 18:25:38.552', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2f2fa512-141b-4a26-981b-898464106523', 'Canon', '3827C002AA', 'imageRUNNER ADVANCE DX C5840i <1><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:18.121794', '2025-08-09 18:25:38.585', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b0baf371-20b2-4443-9278-69f8f8f6082a', 'Canon', '6611C002AA', 'imageFORCE C5170 Speed License <4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:21.505675', '2025-08-09 18:25:41.79', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('21d3dbfa-4d2e-4a52-a553-31625aaba974', 'Canon', '6137C003AA', 'GPR-1001 TONER BK (63K impressions @ 5% coverage)', 'Supplies', 'accessory', 175.00, '{"section": "Supplies", "dealerPrice": 105, "isMainModel": false}', 'active', '2025-08-09 18:25:23.124333', '2025-08-09 18:25:43.3', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('cad54dd1-aafa-447a-88a4-61f24200747d', 'Canon', '6642C001AA', 'Staple Cartridge-Z1 (for Inner inisher-N1) <3>', 'Supplies', 'accessory', 72.00, '{"section": "Supplies", "dealerPrice": 37, "isMainModel": false}', 'active', '2025-08-09 18:25:23.05267', '2025-08-09 18:25:43.235', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b525ee63-c436-46ad-a5b0-de44da152548', 'Canon', '6139C003AA', 'GPR-1001 TONER M (54.5K impressions @ 5% coverage)', 'Supplies', 'accessory', 377.00, '{"section": "Supplies", "dealerPrice": 226, "isMainModel": false}', 'active', '2025-08-09 18:25:23.196587', '2025-08-09 18:25:43.363', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('1b76d89c-dc3f-499b-a144-84f3e52d318b', 'Canon', '6138C003AA', 'GPR-1001 TONER C (54.5K impressions @ 5% coverage)', 'Supplies', 'accessory', 377.00, '{"section": "Supplies", "dealerPrice": 226, "isMainModel": false}', 'active', '2025-08-09 18:25:23.159996', '2025-08-09 18:25:43.332', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e8f55e54-a83d-40be-8a79-a05846e327a5', 'Canon', '6496C001AA', '"3001 Drum Unit (BW: 600K', 'Supplies', 'accessory', 348.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:23.718756', '2025-08-09 18:25:43.832', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('5c345d39-904f-4043-bb50-16e8ba9a61ed', 'Canon', '3769C003AA', 'GPR-61L TONER Y (26K impressions @ 5% coverage)', 'Supplies', 'accessory', 197.00, '{"section": "Supplies", "dealerPrice": 118, "isMainModel": false}', 'active', '2025-08-09 18:25:21.433059', '2025-08-09 18:25:41.725', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('eccb9576-23f1-4ed9-a140-ad4e69ed71e3', 'Canon', '6140C003AA', 'GPR-1001 TONER Y (54.5K impressions @ 5% coverage)', 'Supplies', 'accessory', 377.00, '{"section": "Supplies", "dealerPrice": 226, "isMainModel": false}', 'active', '2025-08-09 18:25:23.232445', '2025-08-09 18:25:43.395', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8aa21881-deb9-4e14-bd53-9df97f43f9ea', 'Canon', '6142C003AA', 'GPR-1001L TONER C (24K impressions @ 5% coverage)', 'Supplies', 'accessory', 193.00, '{"section": "Supplies", "dealerPrice": 116, "isMainModel": false}', 'active', '2025-08-09 18:25:23.268074', '2025-08-09 18:25:43.427', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c1718b9b-1877-4c3f-ade0-85813ade57fa', 'Canon', '6143C003AA', 'GPR-1001L TONER M (24K impressions @ 5% coverage)', 'Supplies', 'accessory', 193.00, '{"section": "Supplies", "dealerPrice": 116, "isMainModel": false}', 'active', '2025-08-09 18:25:23.303785', '2025-08-09 18:25:43.459', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8f16cf35-86a4-4b21-a0dc-2660210cc5c2', 'Canon', '6377C002AA', 'imageFORCE C5140 <1><2><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:21.611892', '2025-08-09 18:25:41.888', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('745da1c8-5a43-4c86-bc63-86996ea7fd7d', 'Canon', 'Scan and Send feature with PDF High Compression', 'Encrypted PDF', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:21.648416', '2025-08-09 18:25:41.925', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('6246c7a2-f6dd-482b-a3b3-b185d00a0e94', 'Canon', '6382C002AA', 'imageFORCE C7165 <1><2>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:23.376299', '2025-08-09 18:25:43.524', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('ca17b43b-0008-48e0-97fb-f800497311a5', 'Canon', '6378C002AA', 'imageFORCE C5170/ C5160/ C5150 <1><2><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:21.469395', '2025-08-09 18:25:41.758', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2c495270-a3a5-47eb-ac55-715ef01f6f0a', 'Canon', '6493C001AA', '3001 Cyan Toner (27.5K impressions @ 8.5% coverage)', 'Supplies', 'accessory', 272.00, '{"section": "Supplies", "dealerPrice": 163, "isMainModel": false}', 'active', '2025-08-09 18:25:23.790474', '2025-08-09 18:25:43.901', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('83e90089-4f19-4ef8-8222-730ca902d4cf', 'Canon', '3767C003AA', 'GPR-61L TONER C (26K impressions @ 5% coverage)', 'Supplies', 'accessory', 197.00, '{"section": "Supplies", "dealerPrice": 118, "isMainModel": false}', 'active', '2025-08-09 18:25:21.360768', '2025-08-09 18:25:41.66', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('57e91798-ae1c-4d96-b700-11a1834c67e3', 'Canon', '3770C003AA', 'GPR-61 Drum Unit (Black 482K / Color 410K impressions)', 'Supplies', 'accessory', NULL, '{"section": "Supplies", "dealerPrice": 649, "isMainModel": false}', 'active', '2025-08-09 18:25:21.181469', '2025-08-09 18:25:41.489', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('089b54a4-9a26-4c35-a18f-51753dd5a8c4', 'Canon', '3763C003AA', 'GPR-61 TONER BK (71K impressions @ 5% coverage)', 'Supplies', 'accessory', 187.00, '{"section": "Supplies", "dealerPrice": 112, "isMainModel": false}', 'active', '2025-08-09 18:25:21.217362', '2025-08-09 18:25:41.522', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('f94207c0-9c20-4383-be22-af5b907e1e5e', 'Canon', '3764C003AA', 'GPR-61 TONER C (60K impressions @ 5% coverage)', 'Supplies', 'accessory', 393.00, '{"section": "Supplies", "dealerPrice": 236, "isMainModel": false}', 'active', '2025-08-09 18:25:21.252378', '2025-08-09 18:25:41.559', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('ea405998-cfc2-4842-be7a-adcc9c46e49a', 'Canon', '3765C003AA', 'GPR-61 TONER M (60K impressions @ 5% coverage)', 'Supplies', 'accessory', 393.00, '{"section": "Supplies", "dealerPrice": 236, "isMainModel": false}', 'active', '2025-08-09 18:25:21.28787', '2025-08-09 18:25:41.594', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8ac580cb-81cf-409d-9947-01ecbcc13457', 'Canon', '3766C003AA', 'GPR-61 TONER Y (60K impressions @ 5% coverage)', 'Supplies', 'accessory', 393.00, '{"section": "Supplies", "dealerPrice": 236, "isMainModel": false}', 'active', '2025-08-09 18:25:21.323843', '2025-08-09 18:25:41.627', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('34b88768-b23e-4ad7-9e27-2e202460c9b2', 'Canon', '3768C003AA', 'GPR-61L TONER M (26K impressions @ 5% coverage)', 'Supplies', 'accessory', 197.00, '{"section": "Supplies", "dealerPrice": 118, "isMainModel": false}', 'active', '2025-08-09 18:25:21.396761', '2025-08-09 18:25:41.693', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'Canon', 'Remote Operator''s Software Kit', 'Color Network ScanGear and Drum Units. "', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:18.336848', '2025-08-09 18:25:38.775', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('128f6525-28b6-4c26-b1d0-5888617368cc', 'Canon', '6612C002AA', 'imageFORCE C5160 Speed License <4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:21.540993', '2025-08-09 18:25:41.824', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('1a5c651d-73c6-4ad3-a2ae-76f3a2c8269b', 'Canon', '6613C002AA', 'imageFORCE C5150 Speed License <4>', 'Equipment', 'multifunction', 50.00, '{"section": "Equipment", "dealerPrice": 20, "isMainModel": true}', 'active', '2025-08-09 18:25:21.576478', '2025-08-09 18:25:41.856', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('db33faeb-52e0-420a-aeda-d83ed3a83bc6', 'Canon', 'Single Pass Duplexing Automatic Document Feeder', 'Color Image Reader', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:18.300281', '2025-08-09 18:25:38.744', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('890875d8-9507-4032-a9d2-cb22548eb8aa', 'Canon', '0259C003AA', 'Velo Bind 11-Hole Punch (round) LTR-B1 <7>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "dealerPrice": 806, "isMainModel": true}', 'active', '2025-08-09 18:25:25.129843', '2025-08-09 18:25:45.111', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('76915b86-e749-428f-b704-1257dd8aa00b', 'Canon', 'Direct PDF/XPS Printing', 'High Compression', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:24.011224', '2025-08-09 18:25:44.103', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('94568a3a-983e-4726-b452-fdc52665e1d0', 'Canon', 'Universal Send Trace & Smooth PDF', 'uniFLOW Online Express', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:24.046742', '2025-08-09 18:25:44.137', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('df67f81d-d36f-4197-8071-e43a59fa2e61', 'Canon', '5589C002AA', 'imagePRESS Lite C270 208V <1><2>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:23.903264', '2025-08-09 18:25:44.007', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('704528f3-78e2-4245-b6ef-388f69ceb307', 'Canon', '6495C001AA', '3001 Yellow Toner (27.5K impressions @ 8.5% coverage)', 'Supplies', 'accessory', 272.00, '{"section": "Supplies", "dealerPrice": 163, "isMainModel": false}', 'active', '2025-08-09 18:25:23.867088', '2025-08-09 18:25:43.972', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('6e5e87b7-c038-4354-9844-71237a8cd033', 'Canon', '4056V496', 'Multi Function Professional Puncher-C1 <5>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:25.021283', '2025-08-09 18:25:45.015', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('4c1afab4-f438-4b82-b822-0d1137fdf76c', 'Canon', '100-Sheet Paper Drawers', 'Buffer Pass Unit', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:23.975564', '2025-08-09 18:25:44.071', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0692a927-8182-44f4-91fc-8e34f4b6a7e2', 'Canon', '5590C005AA', 'imagePRESS Lite C265 Showroom Engine Set <1><2><4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:24.265025', '2025-08-09 18:25:44.336', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e51b71db-29d8-4135-ab65-253ea8d9b937', 'Canon', '5224C001AA', 'Paper Folding Unit-K1 <5>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:24.949593', '2025-08-09 18:25:44.951', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2f9425d3-c2e8-480f-b7d6-1f524fdb50b3', 'Canon', 'Secure Watermark', 'SSD Data Initialize', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:24.083146', '2025-08-09 18:25:44.17', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('7328c6d1-3b04-45d1-aa5b-75ee4ff2165d', 'Canon', 'Stack Bypass', 'USB 2.0/3.0 high speed connectivity', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:24.119109', '2025-08-09 18:25:44.202', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('420d1af3-0f4d-4205-aa69-a0c9da673fbf', 'Canon', '5589C005AA', 'imagePRESS Lite C270 Showroom Engine Set <1><2><4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:24.22923', '2025-08-09 18:25:44.302', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('d327fc10-feeb-47ef-9ae7-9ca27b43901d', 'Canon', '5225C001AA', 'Booklet Trimmer-G1 <6>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:24.98579', '2025-08-09 18:25:44.982', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8fa3bd6f-30fe-4b7b-9db9-7a2fc8191e8c', 'Canon', '3836C018AA', 'imagePRESS Server M20', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:24.588884', '2025-08-09 18:25:44.626', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('49780eea-f79d-4583-9a11-f4635c50695e', 'Canon', 'Universal Send Digital User Signature', 'Universal Send Trace & Smooth PDF', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:24.625016', '2025-08-09 18:25:44.658', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('dcedf307-ef36-42d7-8f7e-4353fd20803b', 'Canon', 'Encrypted Secure Print', 'Secure Watermark', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:24.661598', '2025-08-09 18:25:44.691', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a699d255-0be7-4406-894f-307434dc3b6e', 'Canon', '1142C004AA', 'Document Insertion Unit-R1 <5>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:24.912954', '2025-08-09 18:25:44.918', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0c87923e-7389-4c56-b033-9843fd83ce40', 'Canon', '0259C002AA', 'Loose Leaf 5-Hole Punch (round) LTR-B1 <7>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "dealerPrice": 806, "isMainModel": true}', 'active', '2025-08-09 18:25:25.093981', '2025-08-09 18:25:45.079', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0d7fc45c-09fc-4528-a207-b2b1f5a6368c', 'Canon', '0259C017AA', 'High Durability Loose Leaf 3-Hole Punch (round) LTR-B1 <7>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:25.383271', '2025-08-09 18:25:45.339', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('f7193c0a-5220-45ed-b16e-9cddb302e809', 'Canon', '4481V202', 'High Durability Plastic Comb 19-Hole Punch (rect) LTR-B1 <7>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:25.41854', '2025-08-09 18:25:45.373', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('021156f8-9124-458b-beb6-5389bff5e2b4', 'Canon', '4481V135', 'Loose Leaf 3-Hole Punch (round) LTR-B1 <7>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "dealerPrice": 806, "isMainModel": true}', 'active', '2025-08-09 18:25:25.057561', '2025-08-09 18:25:45.047', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('3df50a7b-e693-4224-b7aa-a647a0249f2f', 'Canon', '5738B002AA', 'Puncher Unit-BS1(2/3H) <4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "dealerPrice": 605, "isMainModel": true}', 'active', '2025-08-09 18:25:24.877463', '2025-08-09 18:25:44.886', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('4764b215-b11c-4bae-b94f-56f50bb9a0ee', 'Canon', '3101V220', 'Color Coil 44-Hole Punch (oval) LTR-B1 <7>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:25.310827', '2025-08-09 18:25:45.272', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('f2cefdcc-f959-4980-9855-55d9fe7e39b7', 'Canon', '4481V180', 'Plastic Comb 19-Hole Punch (rect) LTR-B1 <7>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "dealerPrice": 806, "isMainModel": true}', 'active', '2025-08-09 18:25:25.165625', '2025-08-09 18:25:45.143', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('91cb4f90-bc33-4382-bc08-37a16a0e0360', 'Canon', '0259C005AA', 'Twin Loop 21-Hole Punch (rect) LTR-B1 <7>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "dealerPrice": 806, "isMainModel": true}', 'active', '2025-08-09 18:25:25.201678', '2025-08-09 18:25:45.175', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('bd38ca1f-f78c-43fe-823e-27ca6432c9f8', 'Canon', '0259C006AA', 'Twin Loop 32-Hole Punch (sq) LTR-B1 <7>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "dealerPrice": 806, "isMainModel": true}', 'active', '2025-08-09 18:25:25.237552', '2025-08-09 18:25:45.207', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('4d871262-f795-44aa-9f46-9654093b4e51', 'Canon', '0259C007AA', 'Color Coil 44-Hole Punch (round) LTR-B1 <7>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "dealerPrice": 806, "isMainModel": true}', 'active', '2025-08-09 18:25:25.272853', '2025-08-09 18:25:45.24', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e8a102bd-e5cf-41dd-9f01-49751293a674', 'Canon', '1197C002AA', 'Document Insertion / Folding Unit-K1 <7>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:25.914982', '2025-08-09 18:25:45.836', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('f82057d9-dc00-4111-967d-0e4b44634b63', 'Canon', '5', '000 staples per cartridge) and Staple-P1 box for booklet (2 cartridges per box', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:25.668954', '2025-08-09 18:25:45.6', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('84506be9-bc06-499c-bff2-d29b5c4803da', 'Canon', '5590C002AA', 'imagePRESS Lite C265 120V <1><2>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:23.939753', '2025-08-09 18:25:44.039', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('370e8277-23a0-4069-9ef7-7e5647a32d7b', 'Canon', '4481V203', 'Crease Die <8>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:25.453829', '2025-08-09 18:25:45.406', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8e375138-3f7a-485d-bb1b-b99836d0fe8d', 'Canon', '6494C001AA', '3001 Magenta Toner (27.5K impressions @ 8.5% coverage)', 'Supplies', 'accessory', 272.00, '{"section": "Supplies", "dealerPrice": 163, "isMainModel": false}', 'active', '2025-08-09 18:25:23.830047', '2025-08-09 18:25:43.934', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('97e1575f-8f31-41af-8733-c550c7e64904', 'Canon', '4481V200', 'High Durability Color Coil 44-Hole Punch (round) LTR-B1 <7>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:25.347759', '2025-08-09 18:25:45.304', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('780a175c-4d6f-4e6e-9f60-21ff4b1670c9', 'Canon', '3631C001AA', 'imageRUNNER 1643P <1> <3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "dealerPrice": 639, "isMainModel": true}', 'active', '2025-08-09 18:25:26.44529', '2025-08-09 18:25:46.322', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('cf78279f-4ef1-400d-8ff9-3ec7715c2d21', 'Canon', '5143C003AA', 'GPR-64 Drum Unit (BW 99K impressions)', 'Supplies', 'accessory', 128.00, '{"section": "Supplies", "dealerPrice": 77, "isMainModel": false}', 'active', '2025-08-09 18:25:29.503853', '2025-08-09 18:25:49.142', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('6dc23667-9668-4567-beb7-8162d45c2904', 'Canon', '3526C001AA', '"Toner T06 Black (20', 'Supplies', 'accessory', 119.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:27.095311', '2025-08-09 18:25:46.908', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('610a7365-48b2-456b-ae78-6623d3af961e', 'Canon', '3645C001AA', 'D07 Drum Black (840K impressions)', 'Supplies', 'accessory', 433.00, '{"section": "Supplies", "dealerPrice": 260, "isMainModel": false}', 'active', '2025-08-09 18:25:26.230516', '2025-08-09 18:25:46.13', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2a160856-58b5-40b9-84df-1cd01889daef', 'Canon', '000 staples) within the Finisher.  An additional Staple Cartridge-X1 box (3 cartridges per box', '5', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:25.987556', '2025-08-09 18:25:45.901', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('3d26f2df-81e6-45df-944c-9abc703076d3', 'Canon', 'Color Image Reader', '2 x 1', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:29.611529', '2025-08-09 18:25:49.24', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('5d5f7d58-1a50-4036-8b78-d32d3886897c', 'Canon', '3646C001BA', 'D07 Drum Unit Color (310K impressions)', 'Supplies', 'accessory', 257.00, '{"section": "Supplies", "dealerPrice": 154, "isMainModel": false}', 'active', '2025-08-09 18:25:26.265776', '2025-08-09 18:25:46.161', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('780ce492-51ab-402e-b82d-08b432c52921', 'Canon', '3641C001AA', '"T07 Toner Black (92', 'Supplies', 'accessory', NULL, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:26.300209', '2025-08-09 18:25:46.193', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('af43121a-089c-42cf-bda9-8c251ecb1d24', 'Canon', '3642C001AA', '"T07 Toner Cyan (63', 'Supplies', 'accessory', NULL, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:26.336385', '2025-08-09 18:25:46.226', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a8caaf3b-2198-4b8c-88f6-21f0c8144035', 'Canon', '3643C001AA', '"T07 Toner Magenta (63', 'Supplies', 'accessory', NULL, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:26.370821', '2025-08-09 18:25:46.259', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('1f78ca93-9caa-4a46-afbc-def3cceccedf', 'Canon', '3644C001AA', '"T07 Toner Yellow (63', 'Supplies', 'accessory', NULL, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:26.407838', '2025-08-09 18:25:46.291', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('71f4e89e-025d-4221-861b-c3f91a6a21f6', 'Canon', 'Searchable PDF/XPS', 'OOXML (Scan to PPT and Word)', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:29.686093', '2025-08-09 18:25:49.311', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('7f72c046-52f0-4186-be27-4953a0ec50c7', 'Canon', 'Data Encryption (FIPS-140-2)', 'IP Sec', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:29.721309', '2025-08-09 18:25:49.343', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('9f68ff81-290a-4dc8-a464-1cbded07fb86', 'Canon', '5745C003AA', 'GPR-67 Black Toner (44.5K impressions @ 6% coverage)', 'Supplies', 'accessory', 133.00, '{"section": "Supplies", "dealerPrice": 80, "isMainModel": false}', 'active', '2025-08-09 18:25:29.540484', '2025-08-09 18:25:49.175', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('5dba31a0-79f5-4d8e-a9cd-f4e06b2f971a', 'Canon', '6014C003AA', 'imageRUNNER ADVANCE DX 6980i  <1><2><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:29.574625', '2025-08-09 18:25:49.206', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('d0e36e30-4f39-4478-b24a-44cbc69de0dc', 'Canon', 'Drum', 'Developer', 'Supplies', 'accessory', NULL, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:27.130811', '2025-08-09 18:25:46.939', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0ebffea5-026d-40a6-9d73-efd5b45613a3', 'Canon', '5850C002AA', 'imageRUNNER ADVANCE DX 719iF <1><2><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:27.16632', '2025-08-09 18:25:46.972', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0aee913f-303b-45df-b3bf-a034ea4aa09e', 'Canon', '2725C001BA', '" Toner T03 Black  (51', 'Supplies', 'accessory', 185.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:28.796457', '2025-08-09 18:25:48.49', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b86b6eeb-9f6e-4cdc-aceb-97baf4587e47', 'Canon', 'UFRII/PCL/PS Printing', 'Direct PDF/XPS Printing', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:29.649606', '2025-08-09 18:25:49.279', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('5544047d-6090-4568-a767-cd1fc16d8ef2', 'Canon', '5972C002AA', 'imageRUNNER ADVANCE DX 4925i <1><3><4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:28.903932', '2025-08-09 18:25:48.591', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('6d67f590-8576-4a15-9284-9045c0a68bbe', 'Canon', '5971C002AA', 'imageRUNNER ADVANCE DX 4935i <1><3><4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:28.868093', '2025-08-09 18:25:48.558', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('afc7ec92-a8e7-4955-9aaa-ee4a794f5f32', 'Canon', '3631C006AA', 'imageRUNNER 1643P SHOWROOM   <1> <2> <3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "dealerPrice": 576, "isMainModel": true}', 'active', '2025-08-09 18:25:26.481764', '2025-08-09 18:25:46.356', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('3086790d-0721-4d3f-8a7b-2bead60bad85', 'Canon', '100-sheet Stack Bypass', 'UFR II/PCL/PS Printing', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:26.516275', '2025-08-09 18:25:46.388', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('4be7c2b9-b0f1-4c30-8e62-bcf94283952a', 'Canon', '"ULM(Requires Download)', 'uniFLOW Online Express*(uniFLOW2019.3 or after)', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:26.551545', '2025-08-09 18:25:46.421', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('947c16a8-8cab-4473-856e-a48395982941', 'Canon', 'Trace and Smooth PDF', 'Searchable PDF/XPS', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:28.937397', '2025-08-09 18:25:48.623', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2f4b1eed-1905-4039-bd73-8ad6b424ea70', 'Canon', 'Access Management System', 'SSD Data Initialize', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:28.972901', '2025-08-09 18:25:48.656', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('decab237-219e-48ad-a976-7c681632af60', 'Canon', 'Ethernet 1000Base-T/100Base-TX/10Base-T', 'USB 2.0/3.0 High Speed Connectivity', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:29.007852', '2025-08-09 18:25:48.688', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('d9d84c8b-07d7-4d65-b18d-b30b7672adda', 'Canon', '5849C002AA', 'imageRUNNER ADVANCE DX 619iF <1><2><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:27.201043', '2025-08-09 18:25:47.005', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b1aa43a9-984f-4289-af69-b4ec4f2de623', 'Canon', '5848C002AA', 'imageRUNNER ADVANCE DX 529iF <1><2><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:27.237483', '2025-08-09 18:25:47.039', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('abe33f65-b6c5-4a91-9021-ddb2fe87a9ad', 'Canon', '5850C004AA', 'imageRUNNER ADVANCE DX 719iFZ <1><2><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:27.273647', '2025-08-09 18:25:47.071', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8c017869-b4cf-4e8c-af3f-41fc7434a6d4', 'Canon', '5849C004AA', 'imageRUNNER ADVANCE DX 619iFZ <1><2><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:27.310866', '2025-08-09 18:25:47.104', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('991aedae-9418-453d-9510-5c72b96c9aba', 'Canon', '5848C004AA', 'imageRUNNER ADVANCE DX 529iFZ <1><2><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:27.34537', '2025-08-09 18:25:47.136', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('6cb152ff-39fa-40db-b634-9e90765bab79', 'Canon', '"Universal Login Manager', 'Access Management System', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:27.381275', '2025-08-09 18:25:47.169', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'Canon', '"Ethernet 1000Base-T/100Base-TX/10Base-T', 'USB 2.0/3.0 Connectivity', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:27.415719', '2025-08-09 18:25:47.202', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('f8ba4792-ed7b-4c20-8375-b1228e8265f0', 'Canon', '3836C012AA', 'imagePRESS Server M20 <1>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:26.144274', '2025-08-09 18:25:46.048', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('21e7de4e-0918-404a-b80e-16bacbb4b607', 'Canon', '-', 'Cloud Connector for Email - (5 Year Term) <1>', 'Equipment', 'multifunction', 600.00, '{"section": "Equipment", "dealerPrice": 240, "isMainModel": true}', 'active', '2025-08-09 18:25:11.204857', '2025-08-09 18:25:32.544', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b2891e8f-1dd9-431a-b2c6-5335daea1d3d', 'Canon', '2185C003AB', '" GPR-58 Yellow Toner (18', 'Supplies', 'accessory', 120.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:13.621095', '2025-08-09 18:25:34.648', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('7a99c9e1-8233-41d6-99a4-b0431e21f619', 'Canon', '5759C002AA', 'GPR-66L Magenta Toner  (11K impressions @ 5% coverage)', 'Supplies', 'accessory', 132.00, '{"section": "Supplies", "dealerPrice": 79, "isMainModel": false}', 'active', '2025-08-09 18:25:17.940281', '2025-08-09 18:25:38.413', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('df2025a8-7443-4fad-a056-50994d111574', 'Canon', '3825C002AA', 'imageRUNNER ADVANCE DX C5860i <1><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:18.049186', '2025-08-09 18:25:38.52', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('45d00293-84c0-4352-81e5-8f777b468b18', 'Canon', '6144C003AA', 'GPR-1001L TONER Y (24K impressions @ 5% coverage)', 'Supplies', 'accessory', 193.00, '{"section": "Supplies", "dealerPrice": 116, "isMainModel": false}', 'active', '2025-08-09 18:25:23.339975', '2025-08-09 18:25:43.491', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c3ee5c0b-f60f-4828-936f-7046a2532363', 'Canon', '5753C003AA', 'GPR-66 Black Toner (38K impressions @ 5% coverage)', 'Supplies', 'accessory', 105.00, '{"section": "Supplies", "dealerPrice": 63, "isMainModel": false}', 'active', '2025-08-09 18:25:17.76028', '2025-08-09 18:25:38.256', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('333d406d-4b43-49c3-81af-b12d873459a7', 'Canon', '6615C002AA', 'imageFORCE 6160 Speed License <4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:31.246406', '2025-08-09 18:25:50.771', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b6b24db3-90db-4d39-8284-5988694a9320', 'Canon', 'Paper Folding Unit-K1', 'Multi Function Professional Puncher-C1 and Booklet Trimmer-G1 cannot be attached."', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:25.951188', '2025-08-09 18:25:45.869', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('599a99ce-b4a0-4b9d-b727-9dfffc4c1095', 'Canon', '6492C001AA', '3001 Black Toner (37.5K impressions @ 8.5% coverage)', 'Supplies', 'accessory', 138.00, '{"section": "Supplies", "dealerPrice": 83, "isMainModel": false}', 'active', '2025-08-09 18:25:23.754721', '2025-08-09 18:25:43.865', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('4d306eed-7a01-4280-ba61-384f5c0901c4', 'Canon', '5970C002AA', 'imageRUNNER ADVANCE DX 4945i <1><2><4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:28.833225', '2025-08-09 18:25:48.522', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b7737b3a-6a17-45d3-bb99-207ccad98b87', 'Canon', '3765B003AA', 'GPR-37/38 Drum Unit (6M impressions)', 'Supplies', 'accessory', NULL, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:30.706256', '2025-08-09 18:25:50.258', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('d929fd49-6871-4add-85c5-65d39b75395d', 'Canon', 'C5860i', 'imageRUNNER ADVANCE DX C5860i', 'Multifunction', 'model', 11200.00, NULL, 'active', '2025-08-09 20:44:42.765291', '2025-08-09 20:44:42.765291', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('736e6977-b484-420e-8249-0ba026b828b4', 'Canon', '3766B003AA', '"GPR-38 - Black Toner (56', 'Supplies', 'accessory', 85.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:30.741732', '2025-08-09 18:25:50.296', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0a73c9ef-9db9-4f01-8c03-c9b1d5a2c684', 'Canon', 'C5850i', 'imageRUNNER ADVANCE DX C5850i', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:42.81469', '2025-08-09 20:44:42.81469', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8151a6a1-8894-49ab-ad32-4da63814dc6f', 'Canon', 'C5840i', 'imageRUNNER ADVANCE DX C5840i', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:42.866649', '2025-08-09 20:44:42.866649', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('3ce1faed-e4b5-4a7d-a19f-aa5b544e08f4', 'Canon', '000 staples) within the Finisher.  An additional Staple Cartridge-X1 box(3 cartridges per box. 5', '000 staples per cartridge) is also included."', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:32.770919', '2025-08-09 18:25:52.211', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('eb09fb04-663b-46ef-9fba-7e4b155c93a1', 'Canon', '6616C002AA', 'imageFORCE 6155 Speed License <4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "dealerPrice": 20, "isMainModel": true}', 'active', '2025-08-09 18:25:31.280824', '2025-08-09 18:25:50.803', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('1214ba63-88bd-4863-b116-122a171ec7b9', 'Canon', '4963C002AA', 'imageRUNNER ADVANCE DX 6860i <1><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:30.811341', '2025-08-09 18:25:50.371', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2cca5b69-bb12-484d-bb32-4c9c8945fc0f', 'Canon', '5347C003AA', '"GPR-1002 Drum Unit (6170/ 6160: 600K', 'Supplies', 'accessory', 358.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:31.530105', '2025-08-09 18:25:51.037', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a62fc508-50ed-4d51-ae81-c435b35ba7d1', 'Canon', 'C3926i', 'imageRUNNER ADVANCE DX C3926i', 'Multifunction', 'model', 3400.00, NULL, 'active', '2025-08-09 20:44:42.925228', '2025-08-09 20:44:42.925228', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('4321c6d4-2a73-414b-b6eb-5c33666d67cc', 'Canon', '6136C003AA', 'GPR-1002 TONER BK (65.5K impressions @ 6% coverage)', 'Supplies', 'accessory', 173.00, '{"section": "Supplies", "dealerPrice": 104, "isMainModel": false}', 'active', '2025-08-09 18:25:31.566427', '2025-08-09 18:25:51.069', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('ceb271c9-f68a-4ff3-836d-92c656a18721', 'Canon', '5538C002AA', 'imageRUNNER ADVANCE DX 6855i <1><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:30.845572', '2025-08-09 18:25:50.404', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b69d6b70-7783-4db1-8e98-b9785a789819', 'Canon', '4946C003AA', 'imageRUNNER ADVANCE DX 8905i/ 8995i/ 8986i <1><2><5>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:31.601696', '2025-08-09 18:25:51.102', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('30dbf260-e96a-437b-a238-7a9d9345d54d', 'Canon', '4948C001AA', 'imageRUNNER ADVANCE DX 8905 Speed License <4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:31.637211', '2025-08-09 18:25:51.134', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('96fed725-84ec-4d86-bfe5-6b9bee2113da', 'Canon', '4949C001AA', 'imageRUNNER ADVANCE DX 8995 Speed License  <4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:31.671477', '2025-08-09 18:25:51.167', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('22923432-f020-4165-8596-ba3e96225a24', 'Canon', '3759C003AA', 'GPR-63 Drum Unit (488K impressions)', 'Supplies', 'accessory', 540.00, '{"section": "Supplies", "dealerPrice": 324, "isMainModel": false}', 'active', '2025-08-09 18:25:31.100315', '2025-08-09 18:25:50.636', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('5e1569c5-5a30-4684-a135-a5a01c54dd9c', 'Canon', '8986i', 'imageRUNNER ADVANCE DX 8986i', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:42.977625', '2025-08-09 20:44:42.977625', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e97ccb36-664f-410c-8774-48c54c451771', 'Canon', '3764B003AA', 'GPR-37 - Black Toner (70)', 'Supplies', 'accessory', 65.00, '{"section": "Supplies", "isMainModel": false}', 'active', '2025-08-09 18:25:32.912818', '2025-08-09 19:22:53.754', NULL, '1.0', 47.00, NULL);
INSERT INTO public.master_product_models VALUES ('74ee5bc7-7747-4ce2-8326-c8559ce59b02', 'Canon', '000 staples) within the Finisher.  An additional Staple-N1 box (3 cartridges per box. 5', '000 staples per cartridge) is also included."', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:25.560657', '2025-08-09 18:25:45.503', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('300e0ce7-77b5-40bc-860a-c3c9d2d92db8', 'Canon', '4766C003AA', 'GPR-63 Toner Black (71.5K impressions @ 6% coverage)', 'Supplies', 'accessory', 178.00, '{"section": "Supplies", "dealerPrice": 107, "isMainModel": false}', 'active', '2025-08-09 18:25:31.136572', '2025-08-09 18:25:50.669', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('f443f76d-0a83-4402-9688-395ee61ff106', 'Canon', '6381C002AA', 'imageFORCE 6170/ 6160/ 6155 <1><2><3>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:31.172956', '2025-08-09 18:25:50.703', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('5ebf5c83-0386-4f50-8263-676b10e27b54', 'Canon', '4962C002AA', 'imageRUNNER ADVANCE DX 6870i <1><2>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:30.776594', '2025-08-09 18:25:50.331', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('67a43146-9523-47f9-a29f-6680c0e662be', 'Canon', '8995i', 'imageRUNNER ADVANCE DX 8995i', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:43.033013', '2025-08-09 20:44:43.033013', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('05d71a06-b531-4206-95b5-eba537ffe01a', 'Canon', '4950C001AA', 'imageRUNNER ADVANCE DX 8986i Speed License  <4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:31.706405', '2025-08-09 18:25:51.201', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('bc26e352-060c-46a2-89f0-d2675325a045', 'Canon', '8905i', 'imageRUNNER ADVANCE DX 8905i', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:43.097203', '2025-08-09 20:44:43.097203', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('da87760f-ee7c-41e4-aec6-7c4e1958ce94', 'Canon', '6614C002AA', 'imageFORCE 6170 Speed License <4>', 'Equipment', 'multifunction', NULL, '{"section": "Equipment", "isMainModel": true}', 'active', '2025-08-09 18:25:31.208043', '2025-08-09 18:25:50.738', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('39a7c934-a48f-41bf-8667-9b84c43956c3', 'Canon', '4945i', 'imageRUNNER ADVANCE DX 4945i', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:43.149954', '2025-08-09 20:44:43.149954', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c2454717-cf9e-4760-aa71-9bb4fd0ca1a8', 'Canon', 'MF753Cdw', 'Color imageCLASS MF753Cdw', 'Multifunction', 'model', 535.00, NULL, 'active', '2025-08-09 20:44:43.207602', '2025-08-09 20:44:43.207602', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('5cc2485b-0653-464c-94c6-20f558c020f2', 'Canon', 'V1350', 'imagePRESS V1350', 'Production', 'model', 200000.00, NULL, 'active', '2025-08-09 20:44:43.260281', '2025-08-09 20:44:43.260281', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('f05cf147-94ba-4964-96ed-b9e7ab9f3dd2', 'Canon', 'V1000', 'imagePRESS V1000', 'Production', 'model', NULL, NULL, 'active', '2025-08-09 20:44:43.32599', '2025-08-09 20:44:43.32599', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('395787de-0a47-4ac2-af59-cd2d56148229', 'Canon', 'V900', 'imagePRESS V900', 'Production', 'model', NULL, NULL, 'active', '2025-08-09 20:44:43.392221', '2025-08-09 20:44:43.392221', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('18be76bf-0f0c-4b99-bce7-2ee2b8ad0038', 'Canon', 'V800', 'imagePRESS V800', 'Production', 'model', NULL, NULL, 'active', '2025-08-09 20:44:43.442476', '2025-08-09 20:44:43.442476', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('26718d19-d7fa-4f02-85b2-06c806d9dac2', 'Canon', 'V700', 'imagePRESS V700', 'Production', 'model', NULL, NULL, 'active', '2025-08-09 20:44:43.495146', '2025-08-09 20:44:43.495146', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('98913f4a-d514-4d73-bba1-a2036ed15948', 'Canon', 'C265', 'imagePRESS C265', 'Production', 'model', NULL, NULL, 'active', '2025-08-09 20:44:43.555939', '2025-08-09 20:44:43.555939', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('5bc8e80f-3aee-4b8c-9afb-578d32b8f0b9', 'Canon', 'Finisher-AB2', 'Staple Finisher-AB2', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:43.60664', '2025-08-09 20:44:43.60664', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('5430b446-81f0-4e17-8350-b87133fcbeb8', 'Canon', 'Finisher-A1', 'Paper Folding/Booklet Finisher-A1', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:43.658006', '2025-08-09 20:44:43.658006', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('5a9c8ac8-7256-458d-8fca-4f6b34481bf0', 'Canon', 'Finisher-L1', 'Inner Finisher-L1', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:43.720576', '2025-08-09 20:44:43.720576', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('1680d0c6-9dd7-4ecc-a07b-dfaf136b7312', 'Canon', 'Puncher-D1', 'Inner 2/4 Hole Puncher-D1', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:43.774573', '2025-08-09 20:44:43.774573', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('3346f7c0-c5da-4413-a33a-67d58872e5e8', 'Canon', '0607C002AA', 'Paper Deck Unit-F1', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:43.825093', '2025-08-09 20:44:43.825093', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('543688a9-ac77-4368-9cbf-937c7a7d4109', 'Canon', '3655B002AA', 'Paper Deck Unit-B1', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:43.876587', '2025-08-09 20:44:43.876587', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('6bb4cd3e-add9-412c-92c0-72473a781072', 'Canon', '3655B004AA', 'Paper Deck Unit-B2', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:43.940844', '2025-08-09 20:44:43.940844', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e6f4be60-7a22-4c01-80a5-7153d544b427', 'Canon', '3755B001AA', 'Cassette Feeding Unit-AF1', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:43.994553', '2025-08-09 20:44:43.994553', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e1eeb459-50b3-4174-b8e6-9cded862b674', 'Xerox', 'B400', 'VersaLink B400', 'Printer', 'model', 800.00, NULL, 'active', '2025-08-09 20:44:44.050593', '2025-08-09 20:44:44.050593', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('bf661a4e-64c2-43c2-80fd-bedf5ab10d0b', 'Xerox', 'B405', 'VersaLink B405', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:44.107764', '2025-08-09 20:44:44.107764', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('43b8957c-2d37-4f1e-8de5-84e924392e36', 'Xerox', 'B415', 'VersaLink B415', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:44.169592', '2025-08-09 20:44:44.169592', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('f9687e8e-88bd-4ab1-8b4a-10cdad334cac', 'Xerox', 'B605', 'VersaLink B605', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:44.222105', '2025-08-09 20:44:44.222105', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('19dc91b3-2ece-4972-9e1d-8ba412f6cacd', 'Xerox', 'B615', 'VersaLink B615', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:44.28017', '2025-08-09 20:44:44.28017', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('cb376be9-6431-4702-bfb8-a76aa14070d1', 'Xerox', 'B625', 'VersaLink B625', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:44.331637', '2025-08-09 20:44:44.331637', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('1d2e14c1-0d07-45e3-a674-7eae7b6a6be5', 'Xerox', 'C400', 'VersaLink C400', 'Printer', 'model', NULL, NULL, 'active', '2025-08-09 20:44:44.3881', '2025-08-09 20:44:44.3881', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b4a6189c-c1cf-4e67-ba7f-452f29ffef18', 'Xerox', 'C405', 'VersaLink C405', 'Multifunction', 'model', 1400.00, NULL, 'active', '2025-08-09 20:44:44.43718', '2025-08-09 20:44:44.43718', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a1b59034-da70-4599-ba42-6ea112937013', 'Xerox', 'C415', 'VersaLink C415', 'Multifunction', 'model', 1500.00, NULL, 'active', '2025-08-09 20:44:44.518216', '2025-08-09 20:44:44.518216', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('30a873ca-a264-4f46-b20e-0a489b9dd1e7', 'Xerox', 'C505', 'VersaLink C505', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:44.597165', '2025-08-09 20:44:44.597165', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('f7627b24-3aa9-4932-89bb-2360357893c0', 'Xerox', 'C605', 'VersaLink C605', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:44.652831', '2025-08-09 20:44:44.652831', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('38d07c5c-ebc6-4d47-a3e2-3b5338514350', 'Xerox', 'C625', 'VersaLink C625', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:44.71889', '2025-08-09 20:44:44.71889', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c48a7f3f-4008-4534-b0dc-3a796d8b8dc9', 'Xerox', 'B8055', 'AltaLink B8055', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:44.770915', '2025-08-09 20:44:44.770915', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('d86404e1-4752-41eb-a0a0-f0b2f5ee5ef8', 'Xerox', 'B8065', 'AltaLink B8065', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:44.827301', '2025-08-09 20:44:44.827301', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e5856710-efab-479b-bdfd-b9579e38d588', 'Xerox', 'B8075', 'AltaLink B8075', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:44.880936', '2025-08-09 20:44:44.880936', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8f12a85c-6129-44aa-9d21-5b1763a23bc1', 'Xerox', 'B8090', 'AltaLink B8090', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:44.930509', '2025-08-09 20:44:44.930509', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c88646e6-f449-4a89-b7d1-84ddc3409562', 'Xerox', 'C8045', 'AltaLink C8045', 'Multifunction', 'model', 15000.00, NULL, 'active', '2025-08-09 20:44:44.982564', '2025-08-09 20:44:44.982564', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('04c156f1-3971-410d-b7a8-1e7f0b3c6dea', 'Xerox', 'C8055', 'AltaLink C8055', 'Multifunction', 'model', 15000.00, NULL, 'active', '2025-08-09 20:44:45.034538', '2025-08-09 20:44:45.034538', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('da4602e2-2981-4f5e-b707-d17c52c656bf', 'Xerox', 'C8070', 'AltaLink C8070', 'Multifunction', 'model', 15000.00, NULL, 'active', '2025-08-09 20:44:45.089958', '2025-08-09 20:44:45.089958', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('ced85bb9-bd61-475e-82e6-d91f30ee5b53', 'Xerox', 'C9265', 'PrimeLink C9265', 'Production', 'model', 50000.00, NULL, 'active', '2025-08-09 20:44:45.148159', '2025-08-09 20:44:45.148159', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('db01e893-4d35-4543-ac5f-283dbbc6dac9', 'Xerox', 'C9275', 'PrimeLink C9275', 'Production', 'model', 50000.00, NULL, 'active', '2025-08-09 20:44:45.214978', '2025-08-09 20:44:45.214978', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b4da83cb-6360-4b6e-ad79-ff66aee55fae', 'Xerox', 'C9281', 'PrimeLink C9281', 'Production', 'model', 50000.00, NULL, 'active', '2025-08-09 20:44:45.268109', '2025-08-09 20:44:45.268109', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b9ddc551-bc00-445b-ab06-43e5264c6f2b', 'Xerox', 'B9100', 'PrimeLink B9100', 'Production', 'model', NULL, NULL, 'active', '2025-08-09 20:44:45.320615', '2025-08-09 20:44:45.320615', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('9663ea5a-aa5e-4f1d-925e-98f01755854b', 'Xerox', 'BR-Finisher', 'Business Ready Finisher', 'Accessory', 'accessory', 3000.00, NULL, 'active', '2025-08-09 20:44:45.379805', '2025-08-09 20:44:45.379805', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('413c705f-1a59-4cd3-a255-e790b9cb4115', 'Xerox', 'BR-Booklet', 'Business Ready Booklet Maker', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:45.442246', '2025-08-09 20:44:45.442246', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('df92e59a-1b30-46e3-babe-82b3da998769', 'Xerox', 'PR-Booklet', 'Production Ready Booklet Maker', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:45.493877', '2025-08-09 20:44:45.493877', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('1874fbf9-91ff-43f2-9448-66fa963efeb0', 'Xerox', 'Plockmatic-50', 'Plockmatic Pro 50/35', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:45.56074', '2025-08-09 20:44:45.56074', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('663e670d-7a43-4755-80cd-ebf5dbc66b85', 'Xerox', 'HCF-1', 'High Capacity Feeder (1-Tray)', 'Accessory', 'accessory', 1000.00, NULL, 'active', '2025-08-09 20:44:45.612064', '2025-08-09 20:44:45.612064', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('9bf615fc-e40f-430c-b6c4-dc214410c917', 'Xerox', 'HCF-Advanced', 'Advanced High Capacity Feeder', 'Accessory', 'accessory', 1000.00, NULL, 'active', '2025-08-09 20:44:45.665171', '2025-08-09 20:44:45.665171', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8cead20b-99ac-4428-9271-00ae0f217302', 'Xerox', 'TTM', 'Tandem Tray Modules', 'Accessory', 'accessory', 1000.00, NULL, 'active', '2025-08-09 20:44:45.717366', '2025-08-09 20:44:45.717366', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a349cf69-8862-4e59-aac0-cd6372297054', 'Ricoh', 'IM C2000', 'IM C2000', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:45.768755', '2025-08-09 20:44:45.768755', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8b31d62e-8d7e-4292-b2be-6b42ee92475e', 'Ricoh', 'IM C2500', 'IM C2500', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:45.823935', '2025-08-09 20:44:45.823935', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('16a56459-3ea8-4be5-9334-6d77dc6fe287', 'Ricoh', 'IM C3000', 'IM C3000', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:45.873919', '2025-08-09 20:44:45.873919', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a069d79a-0b0f-4da6-a986-a07dc6dc02a9', 'Ricoh', 'IM C3500', 'IM C3500', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:45.926947', '2025-08-09 20:44:45.926947', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b622d8e5-bac8-49b1-b18a-7668f0600851', 'Ricoh', 'IM C4500', 'IM C4500', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:45.981458', '2025-08-09 20:44:45.981458', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('960699f2-f72a-4cc9-97e6-0b004295a2d9', 'Ricoh', 'IM C4510', 'IM C4510', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.035181', '2025-08-09 20:44:46.035181', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0aa9c798-dd17-4337-81da-63578f57f29d', 'Ricoh', 'IM C5500', 'IM C5500', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.097189', '2025-08-09 20:44:46.097189', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('3a43067e-a664-41f2-8c48-2c6bc8e39e4b', 'Ricoh', 'IM C6000', 'IM C6000', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.157078', '2025-08-09 20:44:46.157078', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('25a0b77d-a4ca-4428-b213-534ee9f29906', 'Ricoh', 'IM C6500', 'IM C6500', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.217981', '2025-08-09 20:44:46.217981', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('27dd1452-f41c-471a-bb33-47566880342e', 'Ricoh', 'IM 2500', 'IM 2500', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.271473', '2025-08-09 20:44:46.271473', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('9cefec5c-78cf-4d05-9167-14652ca85e34', 'Ricoh', 'IM 4000', 'IM 4000', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.327955', '2025-08-09 20:44:46.327955', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('7ff992b2-559c-4091-b24d-0bc994ae9784', 'Ricoh', 'IM 9000', 'IM 9000', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.382316', '2025-08-09 20:44:46.382316', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('87f31366-e5b0-47a1-931b-40a394601ea4', 'Ricoh', 'IM C320F', 'IM C320F', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.438166', '2025-08-09 20:44:46.438166', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('10b507ce-256c-42e8-b19e-93fb76242f33', 'Ricoh', 'M C320FW', 'M C320FW', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.49304', '2025-08-09 20:44:46.49304', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('aeeb0928-96d0-4ed4-b6a8-935e92aab667', 'Ricoh', 'P C375', 'P C375', 'Printer', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.550298', '2025-08-09 20:44:46.550298', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('4426e10c-1273-4824-99bb-2f2ac031703c', 'Ricoh', 'Pro 8400S', 'Pro 8400S', 'Production', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.60511', '2025-08-09 20:44:46.60511', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('9c9b465e-89ac-4d36-bf70-32c70b5a54f8', 'Ricoh', 'Pro 8410S', 'Pro 8410S', 'Production', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.658901', '2025-08-09 20:44:46.658901', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('3b69d112-39e5-484f-98df-2d5fc8a83ea5', 'Ricoh', 'Pro 8420S', 'Pro 8420S', 'Production', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.714138', '2025-08-09 20:44:46.714138', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('aab41bda-db42-4ea7-b6c6-9112dc4e6013', 'Ricoh', 'Pro 8410', 'Pro 8410', 'Production', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.766942', '2025-08-09 20:44:46.766942', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('451fa8dc-3ca5-4f4f-b37c-e42d1d3e283b', 'Ricoh', 'Pro 8420', 'Pro 8420', 'Production', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.820067', '2025-08-09 20:44:46.820067', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('1ef647b8-62d1-4c72-80bf-5cd7b3f1a359', 'Ricoh', 'Pro C5300s', 'Pro C5300s', 'Production', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.877345', '2025-08-09 20:44:46.877345', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('ff226845-fe58-4b9b-b495-8dad75ea36f2', 'Ricoh', 'Pro C5310s', 'Pro C5310s', 'Production', 'model', NULL, NULL, 'active', '2025-08-09 20:44:46.932658', '2025-08-09 20:44:46.932658', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('212f9079-94d8-49ba-9a4f-7c83c89b841b', 'Ricoh', '419401', 'Internal Finisher SR3310', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:47.07716', '2025-08-09 20:44:47.07716', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('08019b76-a584-4c86-aa33-7fa14dc48c33', 'Ricoh', 'SR3250', 'Internal Finisher SR3250', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:47.249198', '2025-08-09 20:44:47.249198', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0aa796d7-6327-4c65-bf54-1dc43310b6f5', 'Ricoh', 'SR3300', 'Internal Finisher SR3300', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:47.352305', '2025-08-09 20:44:47.352305', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c1adf938-455e-468f-8eb5-7cd8145253c8', 'Ricoh', '419399', 'Finisher SR3320', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:47.404399', '2025-08-09 20:44:47.404399', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('582706b3-3949-4855-829b-3cfc5e0ba431', 'Ricoh', '419392', 'Finisher SR3340', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:47.469098', '2025-08-09 20:44:47.469098', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('266a420c-74cc-4f84-b77a-9df51d909cf4', 'Ricoh', 'SR4140', 'Finisher SR4140', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:47.521815', '2025-08-09 20:44:47.521815', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('906609a2-2e76-41a5-b329-420592e2bcea', 'Ricoh', '419397', 'Booklet Finisher SR3330', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:47.574189', '2025-08-09 20:44:47.574189', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b095a95b-ad64-4f33-84f5-42041e279837', 'Ricoh', '419390', 'Booklet Finisher SR3350', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:47.624945', '2025-08-09 20:44:47.624945', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a62858d7-29c8-4477-b989-cb5e64b1f7d6', 'Ricoh', 'SR4160', 'Booklet Finisher SR4160', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:47.675279', '2025-08-09 20:44:47.675279', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c9e99e59-af80-445b-95ff-4df093a9b47e', 'Ricoh', '419374', 'LCIT PB3330', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:47.730415', '2025-08-09 20:44:47.730415', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('6287574a-fdc0-479b-a99e-9b09f8139164', 'Ricoh', '419378', 'LCIT RT3050', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:47.785303', '2025-08-09 20:44:47.785303', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('f8064855-22ae-4f9c-adb4-057153aa0c03', 'Ricoh', 'RT4070', 'LCIT RT4070', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:47.846789', '2025-08-09 20:44:47.846789', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8243a88d-03e4-41c1-92e7-d4db167858a2', 'Ricoh', '419365', 'Paper Feed Unit PB3320', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:47.908332', '2025-08-09 20:44:47.908332', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('1f9983aa-916d-437e-a2af-1349e24489df', 'Konica Minolta', 'C251i', 'bizhub C251i', 'Multifunction', 'model', 3000.00, NULL, 'active', '2025-08-09 20:44:48.014983', '2025-08-09 20:44:48.014983', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('bdc8daf7-39a4-45c1-9483-3a8ee6cbee2f', 'Konica Minolta', 'C301i', 'bizhub C301i', 'Multifunction', 'model', 4000.00, NULL, 'active', '2025-08-09 20:44:48.088179', '2025-08-09 20:44:48.088179', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0a25fed1-ba05-473d-b1a2-e475aa59884e', 'Konica Minolta', 'C361i', 'bizhub C361i', 'Multifunction', 'model', 5000.00, NULL, 'active', '2025-08-09 20:44:48.246014', '2025-08-09 20:44:48.246014', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c5be91f6-861f-4b75-b10f-a1a55a6c16b5', 'Konica Minolta', 'C451i', 'bizhub C451i', 'Multifunction', 'model', 7000.00, NULL, 'active', '2025-08-09 20:44:48.302836', '2025-08-09 20:44:48.302836', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('6d612650-7d75-4cfb-bf4f-71d566eb64db', 'Konica Minolta', 'C551i', 'bizhub C551i', 'Multifunction', 'model', 9000.00, NULL, 'active', '2025-08-09 20:44:48.354661', '2025-08-09 20:44:48.354661', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a8507250-aa14-40cc-8b31-3bbd70976705', 'Konica Minolta', 'C651i', 'bizhub C651i', 'Multifunction', 'model', 11000.00, NULL, 'active', '2025-08-09 20:44:48.413603', '2025-08-09 20:44:48.413603', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e8a9b455-8e4a-4f6e-bc83-d847ca06ecc5', 'Konica Minolta', 'C751i', 'bizhub C751i', 'Multifunction', 'model', 13000.00, NULL, 'active', '2025-08-09 20:44:48.476843', '2025-08-09 20:44:48.476843', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('bfa46624-bf1d-4e02-b01f-f34dca91e4df', 'Konica Minolta', '301i', 'bizhub 301i', 'Multifunction', 'model', 2500.00, NULL, 'active', '2025-08-09 20:44:48.572544', '2025-08-09 20:44:48.572544', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('de1fa1d9-7a23-4141-be67-1d152140418d', 'Konica Minolta', '361i', 'bizhub 361i', 'Multifunction', 'model', 3000.00, NULL, 'active', '2025-08-09 20:44:48.631883', '2025-08-09 20:44:48.631883', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('943064ba-15b2-42ea-9aab-5f4d4c0e8444', 'Konica Minolta', '451i', 'bizhub 451i', 'Multifunction', 'model', 4000.00, NULL, 'active', '2025-08-09 20:44:48.688159', '2025-08-09 20:44:48.688159', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('5df59a3d-ec94-46d7-b8ea-0bc169cc664f', 'Konica Minolta', '551i', 'bizhub 551i', 'Multifunction', 'model', 6000.00, NULL, 'active', '2025-08-09 20:44:48.748116', '2025-08-09 20:44:48.748116', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0e0d2bc1-31f5-4cee-a993-6969a7282c70', 'Konica Minolta', '651i', 'bizhub 651i', 'Multifunction', 'model', 8000.00, NULL, 'active', '2025-08-09 20:44:48.807112', '2025-08-09 20:44:48.807112', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('3eec5c0d-f1d5-4622-82fd-c8cd45812d7a', 'Konica Minolta', '751i', 'bizhub 751i', 'Multifunction', 'model', 10000.00, NULL, 'active', '2025-08-09 20:44:48.859911', '2025-08-09 20:44:48.859911', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a8e4de65-0369-4933-ad7e-d784ea3ae2dd', 'Konica Minolta', 'C3301i', 'bizhub C3301i', 'Multifunction', 'model', 1500.00, NULL, 'active', '2025-08-09 20:44:48.911213', '2025-08-09 20:44:48.911213', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b42330ba-a6f5-4f40-a7b9-eacd22cdde13', 'Konica Minolta', 'C3351i', 'bizhub C3351i', 'Multifunction', 'model', 1800.00, NULL, 'active', '2025-08-09 20:44:48.962831', '2025-08-09 20:44:48.962831', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b7936eae-a7ce-4d6b-b5fd-fcf52a10e9d8', 'Konica Minolta', 'C4001i', 'bizhub C4001i', 'Multifunction', 'model', 2000.00, NULL, 'active', '2025-08-09 20:44:49.01679', '2025-08-09 20:44:49.01679', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8a981ba1-c6fb-4024-92d3-54f4f3faa37d', 'Konica Minolta', 'C4751i', 'bizhub C4751i', 'Multifunction', 'model', 2500.00, NULL, 'active', '2025-08-09 20:44:49.075184', '2025-08-09 20:44:49.075184', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('5ce7a1d4-a116-469e-90b1-0a62b7c37dfb', 'Konica Minolta', '4051i', 'bizhub 4051i', 'Multifunction', 'model', 800.00, NULL, 'active', '2025-08-09 20:44:49.140464', '2025-08-09 20:44:49.140464', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('fce3ad15-e31f-43ec-8599-283019145a29', 'Konica Minolta', '4701i', 'bizhub 4701i', 'Multifunction', 'model', 1200.00, NULL, 'active', '2025-08-09 20:44:49.199247', '2025-08-09 20:44:49.199247', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('5db60c3c-774c-4032-a269-5d6394ad0ec5', 'Konica Minolta', '4751i', 'bizhub 4751i', 'Multifunction', 'model', 1300.00, NULL, 'active', '2025-08-09 20:44:49.280185', '2025-08-09 20:44:49.280185', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('abe5a9de-e25e-448e-8661-2f3546f744d5', 'Konica Minolta', 'C12000', 'AccurioPress C12000', 'Production', 'model', 120000.00, NULL, 'active', '2025-08-09 20:44:49.338829', '2025-08-09 20:44:49.338829', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2dcb3881-6a43-4a91-9d4e-55b7e814f479', 'Konica Minolta', 'C7100', 'AccurioPress C7100', 'Production', 'model', 80000.00, NULL, 'active', '2025-08-09 20:44:49.398349', '2025-08-09 20:44:49.398349', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2f552876-bd2a-4938-b5bd-9de68529faa7', 'Konica Minolta', 'C84hc', 'AccurioPress C84hc', 'Production', 'model', 70000.00, NULL, 'active', '2025-08-09 20:44:49.455112', '2025-08-09 20:44:49.455112', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('850eadc9-d33d-4925-b868-94a61c1bd860', 'Konica Minolta', 'C74hc', 'AccurioPress C74hc', 'Production', 'model', 60000.00, NULL, 'active', '2025-08-09 20:44:49.519792', '2025-08-09 20:44:49.519792', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0e827d5c-5f42-4d04-8586-74ab0102f038', 'Konica Minolta', 'C6100', 'AccurioPress C6100', 'Production', 'model', 70000.00, NULL, 'active', '2025-08-09 20:44:49.578738', '2025-08-09 20:44:49.578738', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('94d813e7-7874-428a-bc0f-a2e49a1c6a75', 'Konica Minolta', '6120', 'AccurioPress 6120', 'Production', 'model', 30000.00, NULL, 'active', '2025-08-09 20:44:49.63407', '2025-08-09 20:44:49.63407', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a33a957e-b12c-4c5a-bbea-fb7c8dd6fdcb', 'Konica Minolta', 'FS-533', 'Inner Finisher', 'Accessory', 'accessory', 800.00, NULL, 'active', '2025-08-09 20:44:49.688065', '2025-08-09 20:44:49.688065', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8f8e1547-30da-4dcc-bd21-a5aa7671c2ef', 'Konica Minolta', 'FS-540', 'Floor Finisher', 'Accessory', 'accessory', 2000.00, NULL, 'active', '2025-08-09 20:44:49.740731', '2025-08-09 20:44:49.740731', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('ba09d511-380b-4d25-b24c-503eeda095ff', 'Konica Minolta', 'FS-540 SD', 'Floor Finisher + Saddle Stitcher', 'Accessory', 'accessory', 4000.00, NULL, 'active', '2025-08-09 20:44:49.797023', '2025-08-09 20:44:49.797023', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('5ef76633-1f2b-4199-b009-f1c76878ffbb', 'Konica Minolta', 'LU-301', 'Large Capacity Unit (2500)', 'Accessory', 'accessory', 600.00, NULL, 'active', '2025-08-09 20:44:49.852064', '2025-08-09 20:44:49.852064', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('76dabc3b-7b33-4bad-a956-123920759a11', 'Konica Minolta', 'LU-302', 'Large Capacity Unit (3000)', 'Accessory', 'accessory', 800.00, NULL, 'active', '2025-08-09 20:44:49.908703', '2025-08-09 20:44:49.908703', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8dbb0d05-aa86-4b0e-827a-e992b94d5fc6', 'Konica Minolta', 'PC-410', '2-way Paper Feed Cabinet', 'Accessory', 'accessory', 400.00, NULL, 'active', '2025-08-09 20:44:49.96706', '2025-08-09 20:44:49.96706', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('7996b636-aeba-4b96-851d-8c6a8914fb53', 'Konica Minolta', 'IC-418', 'Fiery Image Controller', 'Accessory', 'accessory', 3000.00, NULL, 'active', '2025-08-09 20:44:50.030418', '2025-08-09 20:44:50.030418', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('14c882f8-e011-43ef-a457-78dc95d8b60b', 'Konica Minolta', 'IQ-501', 'Spectrophotometer', 'Accessory', 'accessory', 8000.00, NULL, 'active', '2025-08-09 20:44:50.084525', '2025-08-09 20:44:50.084525', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('69de65ce-b2ca-45d5-8fcd-8bca718999a8', 'Kyocera', '1102YN2US2', 'TASKalfa 2554ci', 'Multifunction', 'model', 7000.00, NULL, 'active', '2025-08-09 20:44:50.144869', '2025-08-09 20:44:50.144869', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('517e6a99-5299-4921-b159-6630d0550efa', 'Kyocera', 'TBA', 'TASKalfa 3554ci', 'Multifunction', 'model', 8000.00, NULL, 'active', '2025-08-09 20:44:50.202656', '2025-08-09 20:44:50.202656', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('57ed0b66-a657-4d8d-838c-a85536cc69ef', 'Kyocera', '1102YN2US2-1603TM0US0', 'TASKalfa 5054ci', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:50.262691', '2025-08-09 20:44:50.262691', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a8d8f693-6d5d-46e9-94c5-bc0ffb37d1b4', 'Kyocera', '1102YN2US2-1603TN0US0', 'TASKalfa 6054ci', 'Multifunction', 'model', 12000.00, NULL, 'active', '2025-08-09 20:44:50.321391', '2025-08-09 20:44:50.321391', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('db656f01-ed61-4669-9454-aae8ad0dc5b9', 'Kyocera', '1102XC2USV', 'TASKalfa 7054ci', 'Multifunction', 'model', 15000.00, NULL, 'active', '2025-08-09 20:44:50.375525', '2025-08-09 20:44:50.375525', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a70a7a0a-0a84-42b9-b988-0905dfee9e40', 'Kyocera', '1203TC6USV', 'DP-7160', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:50.457634', '2025-08-09 20:44:50.457634', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('ee15c278-b067-42ef-a6ee-5e9c6987f8dc', 'Kyocera', '1203TD6USV', 'DP-7170', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:50.512511', '2025-08-09 20:44:50.512511', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('93f00e15-cc41-4031-bfc3-533a71d66e31', 'Kyocera', '1203RV2US0', 'DF-7120', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:50.565753', '2025-08-09 20:44:50.565753', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8239a72d-4113-4046-aaed-d7bc3c39ae6e', 'Kyocera', '1203V82US0', 'DF-7140', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:50.618945', '2025-08-09 20:44:50.618945', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('ff00f664-9c8d-4a7a-9d7c-c657674806f5', 'Kyocera', '1203V92US0', 'DF-7150', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:50.718069', '2025-08-09 20:44:50.718069', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('fc71851c-e842-427b-beb1-f14eed2090c4', 'Kyocera', '1203RL2US0', 'PF-7120', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:50.777739', '2025-08-09 20:44:50.777739', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b3d2b371-2d6a-49ec-92c0-94d354a3b50c', 'Kyocera', '1203V42USV', 'PF-7140', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:50.837658', '2025-08-09 20:44:50.837658', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('063a534c-70bc-4233-8c84-223de82ccf21', 'Kyocera', '1203V52USV', 'PF-7150', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:50.904798', '2025-08-09 20:44:50.904798', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('abaf9d85-91f6-4eab-a802-45e70612a867', 'Kyocera', '1503RK2USJ', 'Fax System 12', 'Accessory', 'accessory', 899.00, NULL, 'active', '2025-08-09 20:44:50.957007', '2025-08-09 20:44:50.957007', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c6575394-0534-4c7f-8b5a-817c57dc3c44', 'Kyocera', '1603V60UN0', 'Data Security Kit 10', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:51.018636', '2025-08-09 20:44:51.018636', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('597dba65-dba6-489e-b864-b9ec34837385', 'Kyocera', '1503T80UN0', 'IB-37 WiFi Module', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:51.071832', '2025-08-09 20:44:51.071832', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('56b6ac70-c6a9-473e-ad9d-f8822da1ae55', 'Sharp', 'MX-C358F', 'MX-C358F', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:51.129098', '2025-08-09 20:44:51.129098', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2edb8b89-e68a-47a6-ab32-cb216ea6081b', 'Sharp', 'MX-B468F', 'MX-B468F', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:51.186118', '2025-08-09 20:44:51.186118', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('fd9cce34-4765-4fd4-8dbe-e8eed13755e8', 'Sharp', 'MX-C428P', 'MX-C428P', 'Printer', 'model', NULL, NULL, 'active', '2025-08-09 20:44:51.245804', '2025-08-09 20:44:51.245804', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('8011a61e-4d21-4c47-8c22-16faa0366e11', 'Sharp', 'MX-B468P', 'MX-B468P', 'Printer', 'model', NULL, NULL, 'active', '2025-08-09 20:44:51.301719', '2025-08-09 20:44:51.301719', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('33a6be91-b4aa-4007-bb7d-60f07c7b736a', 'Sharp', 'MX-4071', 'MX-4071', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:51.361161', '2025-08-09 20:44:51.361161', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('7ce18807-0374-4e5f-94ac-41e98401d4c7', 'Sharp', 'MX-5051', 'MX-5051', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:51.430072', '2025-08-09 20:44:51.430072', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e5093805-08b7-4bfe-98d8-0d2064ceec78', 'Sharp', 'MX-5071', 'MX-5071', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:51.482461', '2025-08-09 20:44:51.482461', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('6a382100-38c1-45ba-b480-7b18c4275718', 'Sharp', 'MX-6051', 'MX-6051', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:51.53754', '2025-08-09 20:44:51.53754', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0285dee2-6ae0-4194-9294-e22fb23ebd2d', 'Sharp', 'MX-6071', 'MX-6071', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:51.58986', '2025-08-09 20:44:51.58986', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('7a46bb6a-20a2-41c9-b45f-951885f3d402', 'Sharp', 'MX-8081', 'MX-8081', 'Production', 'model', 40000.00, NULL, 'active', '2025-08-09 20:44:51.643107', '2025-08-09 20:44:51.643107', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b7fe8657-b1db-4ac8-9555-fa227c3a3067', 'Sharp', 'MX-M1056', 'MX-M1056', 'Production', 'model', 40000.00, NULL, 'active', '2025-08-09 20:44:51.695285', '2025-08-09 20:44:51.695285', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('96126336-58d1-4e02-82cc-aa72847484c7', 'Sharp', 'MX-M1206', 'MX-M1206', 'Production', 'model', 40000.00, NULL, 'active', '2025-08-09 20:44:51.746741', '2025-08-09 20:44:51.746741', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('914844a9-f8b0-4532-a629-ecf76bf65af6', 'Sharp', 'BP-50C26', 'BP-50C26', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:51.803053', '2025-08-09 20:44:51.803053', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('1103cb18-5ac2-402e-9b70-25be11f8ee97', 'Sharp', 'BP-50C31', 'BP-50C31', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:51.866104', '2025-08-09 20:44:51.866104', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b54427cc-d01d-4bf8-bcf0-e64b8a410a87', 'Sharp', 'BP-50C45', 'BP-50C45', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:51.919054', '2025-08-09 20:44:51.919054', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('282be748-00c8-4ed0-ad52-45c357378b13', 'Sharp', 'BP-50C55', 'BP-50C55', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:51.980578', '2025-08-09 20:44:51.980578', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e19b3cb8-af53-4c81-8a6a-294269fbc646', 'Sharp', 'BP-50C65', 'BP-50C65', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:52.038162', '2025-08-09 20:44:52.038162', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('42646995-c0fb-4a4d-a71b-2d630a4c9604', 'Sharp', 'BP-70C31', 'BP-70C31', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:52.094439', '2025-08-09 20:44:52.094439', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2adf4cc1-8803-4db7-ac68-7a603efd363c', 'Sharp', 'BP-70C45', 'BP-70C45', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:52.146113', '2025-08-09 20:44:52.146113', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('31142c31-e0c4-40d8-8453-ab4ce029f64b', 'Sharp', 'BP-70C55', 'BP-70C55', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:52.197475', '2025-08-09 20:44:52.197475', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2851d911-3d21-4e3f-9ee2-bb8a2d45692f', 'Sharp', 'BP-70C65', 'BP-70C65', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:52.248743', '2025-08-09 20:44:52.248743', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('974e6a2b-1778-44a5-995d-c51dbc806ce8', 'Sharp', 'BP-C535WR', 'BP-C535WR', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:52.301717', '2025-08-09 20:44:52.301717', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('52b87d46-4773-48d9-b64e-c4ef64b5a666', 'Sharp', 'BP-C535WD', 'BP-C535WD', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:52.354174', '2025-08-09 20:44:52.354174', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('1b16ad97-ba69-45c8-a0c8-e57fedfefa68', 'Sharp', 'BP-C545WD', 'BP-C545WD', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:52.410812', '2025-08-09 20:44:52.410812', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('50abf039-07ac-4301-b4de-6e4ec6ef7764', 'Sharp', 'MX-FN17', 'MX-FN17', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:52.463007', '2025-08-09 20:44:52.463007', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e907a82c-0103-4182-a655-96e367b274c2', 'Sharp', 'MX-FN27N', 'MX-FN27N', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:52.515871', '2025-08-09 20:44:52.515871', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('bac76cc1-e133-45f8-8175-2bf36870e8f5', 'Sharp', 'MX-FN28', 'MX-FN28', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:52.567638', '2025-08-09 20:44:52.567638', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b1bf84a2-4daa-45b6-bcf9-3af887a5a131', 'Sharp', 'IF-Unit', 'Inner Folding Unit', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:52.622651', '2025-08-09 20:44:52.622651', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('4c9c7d4f-55a4-4777-9500-2a30cf561e6c', 'Sharp', 'MX-PN11B', 'MX-PN11B', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:52.674869', '2025-08-09 20:44:52.674869', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('41eabcb6-556e-460e-a53a-4bee90ef22f4', 'Sharp', 'MX-PN14B', 'MX-PN14B', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:52.733503', '2025-08-09 20:44:52.733503', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('bea4c643-d1a3-4e8b-96fe-0749876d1532', 'Sharp', 'MX-PN15B', 'MX-PN15B', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:52.785323', '2025-08-09 20:44:52.785323', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c944a652-8d1a-4030-9eba-51dedabe3215', 'Sharp', 'LCT-Various', 'Large Capacity Trays', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:52.841093', '2025-08-09 20:44:52.841093', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('d9cc8fae-f269-4f2f-90c0-0061c2112b3f', 'Sharp', 'PF-550', '550-sheet drawers', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:52.893814', '2025-08-09 20:44:52.893814', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('ff94baa4-3543-4405-8854-e63ce329de84', 'Sharp', 'TLCT', 'Tandem LCT', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:52.96376', '2025-08-09 20:44:52.96376', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c3c3c090-18b8-4f88-bdff-b885164f5669', 'Lexmark', 'CX963se', 'CX963se', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.016564', '2025-08-09 20:44:53.016564', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('e197d672-878e-481f-8fff-fc8ead6c0c76', 'Lexmark', 'CX962se', 'CX962se', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.069635', '2025-08-09 20:44:53.069635', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('9eb438cb-94d1-474d-b510-bdba820724b9', 'Lexmark', '20L8200', 'CX961se', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.125229', '2025-08-09 20:44:53.125229', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('67b5a0d4-4df5-47f4-9584-5420f3fb010c', 'Lexmark', '32C0200', 'CX921de', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.177652', '2025-08-09 20:44:53.177652', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b3f04e2b-a89b-4728-85dc-44aa4a8b6aaa', 'Lexmark', 'XC9655', 'XC9655', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.230757', '2025-08-09 20:44:53.230757', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('eb9e4094-026d-483e-8e0a-d46a467e1b48', 'Lexmark', 'XC9645', 'XC9645', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.2867', '2025-08-09 20:44:53.2867', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0054c0fc-11a1-4fc1-a54d-f4dbd3682c8f', 'Lexmark', 'XC9635', 'XC9635', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.346545', '2025-08-09 20:44:53.346545', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('ae0df1bb-e65b-4d18-8f81-77ad7166a439', 'Lexmark', 'XC8355', 'XC8355', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.399043', '2025-08-09 20:44:53.399043', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('2f737ff0-bf21-462d-8b1c-c360315c933b', 'Lexmark', 'CS963', 'CS963', 'Printer', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.461726', '2025-08-09 20:44:53.461726', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('183e47a6-08e3-40d3-a726-d9550ca86bfb', 'Lexmark', 'XM1145', 'XM1145', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.514149', '2025-08-09 20:44:53.514149', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('a8611f4c-76d6-452f-834d-ca9e85f44a98', 'Lexmark', 'XM3250', 'XM3250', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.573828', '2025-08-09 20:44:53.573828', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('4e215e34-86ba-4a0d-801c-cf5612c66cfa', 'Lexmark', 'XM5263', 'XM5263', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.638873', '2025-08-09 20:44:53.638873', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('9abdcfac-7262-4154-a1ac-5d3db79ca6ce', 'Lexmark', 'XC8155de', 'XC8155de', 'Production', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.696185', '2025-08-09 20:44:53.696185', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('cc641f16-0551-4746-8622-b1caf2da6028', 'Lexmark', 'MX532adwe', 'MX532adwe', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.75375', '2025-08-09 20:44:53.75375', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('7de26566-ea50-426a-95be-7467b8e04263', 'Lexmark', 'MX711de', 'MX711de', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.810955', '2025-08-09 20:44:53.810955', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('158bb287-7f44-4214-86c5-a738c2b1f191', 'Lexmark', 'MX810de', 'MX810de', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.886077', '2025-08-09 20:44:53.886077', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('17e4fbec-fca7-4913-8249-f2046731a95b', 'Lexmark', 'MX811de', 'MX811de', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.938354', '2025-08-09 20:44:53.938354', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('fd383d66-e2db-4742-a2bc-aadbecebf22f', 'Lexmark', 'MX812dt', 'MX812dt', 'Multifunction', 'model', NULL, NULL, 'active', '2025-08-09 20:44:53.992101', '2025-08-09 20:44:53.992101', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('ad07fee2-f7c3-46b5-868f-b290482d3745', 'Lexmark', '30430', '500-Sheet Staple Finisher', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:54.043519', '2025-08-09 20:44:54.043519', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('7e40fb53-ec22-4b3b-9006-0da46666f79d', 'Lexmark', '7561', 'Staple Finisher', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:54.097994', '2025-08-09 20:44:54.097994', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c87f645e-0b8d-4fd7-9e3a-48cabe6f70b6', 'Lexmark', '7562', 'Staple Hole Punch Finisher', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:54.152074', '2025-08-09 20:44:54.152074', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c82ff18d-7d15-497b-ac45-0525764e8068', 'Lexmark', 'Various', '1250-Sheet Staple Hole Punch', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:54.20315', '2025-08-09 20:44:54.20315', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('bbb69fa3-7212-405f-9fd9-82c71014f6ca', 'Lexmark', '40X-7725', 'Multipurpose Feeder', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:54.263214', '2025-08-09 20:44:54.263214', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('b6430f90-05e0-4357-81f4-29292aefad6e', 'Lexmark', 'LCT-Various', 'Large Capacity Trays', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:54.316397', '2025-08-09 20:44:54.316397', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('eb39b27d-24c0-401f-9847-97b72731e1cf', 'Lexmark', '57X-Series', 'Flash Memory', 'Accessory', 'accessory', NULL, NULL, 'active', '2025-08-09 20:44:54.36837', '2025-08-09 20:44:54.36837', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('911b8c80-854c-466d-9167-844dce301703', 'Canon', 'C5870i', 'imageRUNNER ADVANCE DX C5870i', 'Equipment', 'MFP', NULL, NULL, 'active', '2025-08-09 20:44:42.686486', '2025-08-09 20:48:27.821', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c7af311e-3e6c-4a4e-9180-8e675a88c216', 'Canon', 'imageRUNNER ADVANCE DX C5560i', 'Canon imageRUNNER ADVANCE DX C5560i', 'Multifunction', 'model', 18500.00, '{"weight": "85 kg", "features": ["Duplex printing", "Scan to email", "Mobile printing", "Security features"], "dimensions": "615 x 685 x 855 mm", "printSpeed": "60 ppm color/BW", "resolution": "1200 x 1200 dpi", "connectivity": ["Ethernet", "Wi-Fi", "USB"], "paperCapacity": "2,300 sheets standard"}', 'active', '2025-08-09 16:13:19.186751', '2025-08-09 20:56:55.313144', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('c801d655-d1a7-4678-94c9-75eb93e1ca33', 'Canon', 'imageRUNNER ADVANCE DX C3330i', 'Canon imageRUNNER ADVANCE DX C3330i', 'Multifunction', 'model', 8950.00, '{"weight": "75 kg", "features": ["Duplex printing", "Scan to email", "Mobile printing"], "dimensions": "615 x 685 x 855 mm", "printSpeed": "30 ppm color/BW", "resolution": "1200 x 1200 dpi", "connectivity": ["Ethernet", "Wi-Fi", "USB"], "paperCapacity": "1,200 sheets standard"}', 'active', '2025-08-09 16:13:19.186751', '2025-08-09 20:56:55.313144', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('77273fce-04b4-468f-a9d4-993afacf8ac8', 'Xerox', 'AltaLink C8030', 'Xerox AltaLink C8030 Multifunction Printer', 'Multifunction', 'model', 12500.00, '{"weight": "119 kg", "features": ["Duplex printing", "Scan to email", "Cloud workflows", "Security"], "dimensions": "622 x 737 x 1181 mm", "printSpeed": "30 ppm color/BW", "resolution": "1200 x 2400 dpi", "connectivity": ["Ethernet", "Wi-Fi", "USB"], "paperCapacity": "1,140 sheets standard"}', 'active', '2025-08-09 16:13:19.186751', '2025-08-09 20:56:55.313144', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('984d6dd9-f6d3-4b45-999b-866899ba482d', 'Ricoh', 'IM C3010', 'Ricoh IM C3010 Color Laser Multifunction Printer', 'Multifunction', 'model', 5995.00, '{"weight": "59 kg", "features": ["Duplex printing", "Scan to email", "Cloud connectivity"], "dimensions": "587 x 685 x 595 mm", "printSpeed": "30 ppm color/BW", "resolution": "1200 x 1200 dpi", "connectivity": ["Ethernet", "Wi-Fi", "USB"], "paperCapacity": "650 sheets standard"}', 'active', '2025-08-09 17:36:46.363335', '2025-08-09 20:56:55.313144', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('80510022-8336-451d-abc8-c96984aa483e', 'Ricoh', 'IM C6010', 'Ricoh IM C6010 Color Laser Multifunction Printer', 'Multifunction', 'model', 15995.00, '{"weight": "125 kg", "features": ["Duplex printing", "Scan to email", "Advanced finishing", "Cloud workflows"], "dimensions": "615 x 737 x 1181 mm", "printSpeed": "60 ppm color/BW", "resolution": "1200 x 1200 dpi", "connectivity": ["Ethernet", "Wi-Fi", "USB"], "paperCapacity": "2,300 sheets standard"}', 'active', '2025-08-09 17:36:46.426943', '2025-08-09 20:56:55.313144', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('56da5479-3e0d-4b50-8349-1e6b3934e922', 'Lexmark', 'CX725de', 'Lexmark CX725de Color Laser Multifunction Printer', 'Multifunction', 'model', 2299.00, '{"weight": "33.7 kg", "features": ["Duplex printing", "Scan to email", "Mobile printing"], "dimensions": "467 x 515 x 526 mm", "printSpeed": "47 ppm color/BW", "resolution": "1200 x 1200 dpi", "connectivity": ["Ethernet", "Wi-Fi", "USB"], "paperCapacity": "650 sheets standard"}', 'active', '2025-08-09 17:36:46.443385', '2025-08-09 20:56:55.313144', NULL, '1.0', NULL, NULL);
INSERT INTO public.master_product_models VALUES ('0b53e92f-6762-4756-bf82-2f82fb3fb49b', 'Lexmark', 'XC9265', 'Lexmark XC9265 Color MFP', 'Multifunction', 'model', 18999.00, '{"weight": "140 kg", "features": ["Duplex printing", "Advanced finishing", "Security", "Cloud workflows"], "dimensions": "668 x 737 x 1273 mm", "printSpeed": "65 ppm color/BW", "resolution": "1200 x 1200 dpi", "connectivity": ["Ethernet", "Wi-Fi", "USB"], "paperCapacity": "2,300 sheets standard"}', 'active', '2025-08-09 17:36:46.477158', '2025-08-09 20:56:55.313144', NULL, '1.0', NULL, NULL);


--
-- Data for Name: enabled_products; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: enhanced_roles; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.tenants VALUES ('1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Demo Copier Dealer', 'demo', '2025-07-31 22:57:56.640151', '2025-07-31 22:57:56.640151', NULL, NULL, NULL, true, 'basic');
INSERT INTO public.tenants VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Demo Copier Dealership', NULL, '2025-08-01 01:58:32.724019', '2025-08-01 01:58:32.724019', 'printyx-demo', 'printyx-demo', 'printyx-demo', true, 'enterprise');


--
-- Data for Name: enriched_companies; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.enriched_companies VALUES ('b1eb8c2a-9b4d-42cb-898c-e201cff6b473', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'TechCorp Solutions', 'Information Technology', NULL, 500, 25000000, 'Growth', 'United States', 'California', 'San Francisco', 'https://www.techcorp.com', NULL, NULL, 'Enterprise', 90, 'zoominfo', 'zoominfo_comp_123', '2025-08-02 17:00:07.056924', '2025-08-02 17:00:07.056924', '2025-08-02 17:00:07.056924');
INSERT INTO public.enriched_companies VALUES ('660ba550-034f-4522-814e-1a18aa633cf3', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'InnovateCorp', 'Software Development', NULL, 150, 8000000, 'Growth', 'United States', 'Texas', 'Austin', 'https://www.innovatecorp.com', NULL, NULL, 'Mid-Market', 78, 'apollo', 'apollo_comp_456', '2025-08-02 17:00:07.056924', '2025-08-02 17:00:07.056924', '2025-08-02 17:00:07.056924');
INSERT INTO public.enriched_companies VALUES ('a15676da-ac91-47af-a9ac-33a5e42ab9aa', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Global Print Services', 'Business Services', NULL, 75, 3500000, 'Established', 'United States', 'New York', 'New York', 'https://www.globalprint.com', NULL, NULL, 'SMB', 65, 'zoominfo', 'zoominfo_comp_789', '2025-08-02 17:00:07.056924', '2025-08-02 17:00:07.056924', '2025-08-02 17:00:07.056924');


--
-- Data for Name: enriched_contacts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.enriched_contacts VALUES ('4cd5235e-5571-4c8c-bb3b-60118fc6f052', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'John', 'Smith', 'John Smith', 'john.smith@techcorp.com', NULL, 'VP of Operations', NULL, 'Senior', 'Operations', NULL, 'TechCorp Solutions', NULL, NULL, NULL, NULL, NULL, 85, 'qualified', NULL, NULL, 'zoominfo', 'zoominfo_12345', '2025-08-02 16:59:59.36981', '2025-08-02 16:59:59.36981', '2025-08-02 16:59:59.36981');
INSERT INTO public.enriched_contacts VALUES ('44a80681-2d67-4ecc-9b82-6e79c419eda9', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Sarah', 'Johnson', 'Sarah Johnson', 'sarah.johnson@innovatecorp.com', NULL, 'Director of IT', NULL, 'Middle', 'Technology', NULL, 'InnovateCorp', NULL, NULL, NULL, NULL, NULL, 72, 'contacted', NULL, NULL, 'apollo', 'apollo_67890', '2025-08-02 16:59:59.36981', '2025-08-02 16:59:59.36981', '2025-08-02 16:59:59.36981');
INSERT INTO public.enriched_contacts VALUES ('e75fc0b9-efed-45e3-af8d-1088bb59da45', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Michael', 'Chen', 'Michael Chen', 'michael.chen@globalprint.com', NULL, 'Facilities Manager', NULL, 'Entry', 'Facilities', NULL, 'Global Print Services', NULL, NULL, NULL, NULL, NULL, 58, 'new', NULL, NULL, 'zoominfo', 'zoominfo_54321', '2025-08-02 16:59:59.36981', '2025-08-02 16:59:59.36981', '2025-08-02 16:59:59.36981');


--
-- Data for Name: equipment; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: equipment_asset_tracking; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: equipment_delivery_schedules; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.equipment_delivery_schedules VALUES ('a96682d1-ed6a-4538-804e-b9c5b1983f31', '550e8400-e29b-41d4-a716-446655440000', 'DEL-001', NULL, '2025-08-05', '09:00:00', '12:00:00', 'white_glove', '123 Business Park Dr, Suite 200, Anytown ST 12345', 'John Smith', '(555) 123-4567', NULL, 'scheduled', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'good', false, NULL, NULL, '2025-08-03 12:52:44.044312', '2025-08-03 12:52:44.044312');
INSERT INTO public.equipment_delivery_schedules VALUES ('6b44e015-4c4c-42ad-93f1-960fbd310f58', '550e8400-e29b-41d4-a716-446655440000', 'DEL-002', NULL, '2025-08-08', '13:00:00', '17:00:00', 'standard', '456 Corporate Blvd, Floor 3, Business City ST 67890', 'Jane Doe', '(555) 987-6543', NULL, 'confirmed', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'good', false, NULL, NULL, '2025-08-03 12:52:44.044312', '2025-08-03 12:52:44.044312');


--
-- Data for Name: equipment_installations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: equipment_lifecycle_stages; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.equipment_lifecycle_stages VALUES ('8a3bd279-7ae6-479f-b74f-1091197ea142', '550e8400-e29b-41d4-a716-446655440000', 'EQ001', 'CN123456789', 'imageRUNNER 2530i', 'Canon', 'in_transit', 'in_progress', '2025-08-03 12:52:44.044312', NULL, NULL, NULL, 'adc117e7-611d-426a-b569-6c6c0b32e234', 'adc117e7-611d-426a-b569-6c6c0b32e234', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 75, '2025-08-03', 'Coordinate delivery with customer', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, NULL, '2025-08-03 12:52:44.044312', '2025-08-03 12:52:44.044312');
INSERT INTO public.equipment_lifecycle_stages VALUES ('f6cb0008-1622-490e-b758-a5f83a104ab4', '550e8400-e29b-41d4-a716-446655440000', 'EQ002', 'HP987654321', 'LaserJet Pro M404dn', 'HP', 'delivered', 'completed', '2025-08-03 12:52:44.044312', NULL, NULL, NULL, 'adc117e7-611d-426a-b569-6c6c0b32e234', 'adc117e7-611d-426a-b569-6c6c0b32e234', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 85, '2025-08-03', 'Schedule installation appointment', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, NULL, '2025-08-03 12:52:44.044312', '2025-08-03 12:52:44.044312');


--
-- Data for Name: equipment_packages; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: equipment_purchase_orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.equipment_purchase_orders VALUES ('ec3cfb74-8393-4967-8637-092568d4d356', '550e8400-e29b-41d4-a716-446655440000', 'PO-2025-001', NULL, 'Canon Business Solutions', '2025-07-15', '2025-08-15', NULL, 2500.00, 212.50, 0.00, 2712.50, 'in_production', NULL, 'adc117e7-611d-426a-b569-6c6c0b32e234', 'adc117e7-611d-426a-b569-6c6c0b32e234', NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, '2025-08-03 12:52:44.044312', '2025-08-03 12:52:44.044312');
INSERT INTO public.equipment_purchase_orders VALUES ('f0102aad-0277-4c57-915c-2604452e93ed', '550e8400-e29b-41d4-a716-446655440000', 'PO-2025-002', NULL, 'HP Inc', '2025-07-20', '2025-08-10', NULL, 1200.00, 102.00, 0.00, 1302.00, 'shipped', NULL, 'adc117e7-611d-426a-b569-6c6c0b32e234', 'adc117e7-611d-426a-b569-6c6c0b32e234', NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, '2025-08-03 12:52:44.044312', '2025-08-03 12:52:44.044312');


--
-- Data for Name: equipment_status_monitoring; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: field_technicians; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.field_technicians VALUES ('4f13d657-4b4c-45a6-98bf-502ed2d98e0a', '550e8400-e29b-41d4-a716-446655440000', 'TECH001', NULL, 'Mike Johnson', 'mike.johnson@company.com', '+1-555-0123', NULL, 'android', NULL, NULL, '2025-08-03 13:45:00', NULL, NULL, '{"lat": 40.7128, "lng": -74.0060, "address": "123 Business Ave, NYC"}', NULL, NULL, '["Printer Repair", "Installation", "Network Setup"]', NULL, NULL, NULL, NULL, 'available', NULL, NULL, false, 3, 18, 0, 0.00, 4.80, 89.50, true, true, true, true, true, 'active', NULL, NULL, '2025-08-03 13:56:03.845032', '2025-08-03 13:56:03.845032');
INSERT INTO public.field_technicians VALUES ('f5146520-6ba4-4dc8-a852-b881dc8cfb97', '550e8400-e29b-41d4-a716-446655440000', 'TECH002', NULL, 'Sarah Chen', 'sarah.chen@company.com', '+1-555-0124', NULL, 'ios', NULL, NULL, '2025-08-03 13:42:00', NULL, NULL, '{"lat": 40.7589, "lng": -73.9851, "address": "456 Office Blvd, NYC"}', NULL, NULL, '["Copier Maintenance", "Repair", "Training"]', NULL, NULL, NULL, NULL, 'busy', NULL, NULL, false, 2, 15, 0, 0.00, 4.90, 92.30, true, true, true, true, true, 'active', NULL, NULL, '2025-08-03 13:56:03.845032', '2025-08-03 13:56:03.845032');
INSERT INTO public.field_technicians VALUES ('00974e9b-8d28-4a18-b899-8db0955fc920', '550e8400-e29b-41d4-a716-446655440000', 'TECH003', NULL, 'David Rodriguez', 'david.rodriguez@company.com', '+1-555-0125', NULL, 'android', NULL, NULL, '2025-08-03 13:38:00', NULL, NULL, '{"lat": 40.7282, "lng": -74.0776, "address": "789 Corporate St, NYC"}', NULL, NULL, '["Installation", "Troubleshooting", "Customer Training"]', NULL, NULL, NULL, NULL, 'available', NULL, NULL, false, 4, 22, 0, 0.00, 4.70, 85.20, true, true, true, true, true, 'active', NULL, NULL, '2025-08-03 13:56:03.845032', '2025-08-03 13:56:03.845032');
INSERT INTO public.field_technicians VALUES ('d6256e72-9098-4372-854d-c2183e3e1a4a', '550e8400-e29b-41d4-a716-446655440000', 'TECH004', NULL, 'Lisa Wang', 'lisa.wang@company.com', '+1-555-0126', NULL, 'tablet', NULL, NULL, '2025-08-03 12:15:00', NULL, NULL, NULL, NULL, NULL, '["Advanced Diagnostics", "Network Integration"]', NULL, NULL, NULL, NULL, 'offline', NULL, NULL, false, 1, 12, 0, 0.00, 4.60, 91.80, true, true, true, true, true, 'active', NULL, NULL, '2025-08-03 13:56:03.845032', '2025-08-03 13:56:03.845032');


--
-- Data for Name: field_work_orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.field_work_orders VALUES ('fac7bd38-f0d4-48a5-a466-5c55d9aa6f09', '550e8400-e29b-41d4-a716-446655440000', 'WO-1754229001', NULL, 'installation', 'high', 'cust-001', 'TechCorp Solutions', '{"address": "555 Innovation Drive, NYC", "coordinates": {"lat": 40.7505, "lng": -73.9934}}', NULL, NULL, NULL, NULL, '4f13d657-4b4c-45a6-98bf-502ed2d98e0a', NULL, 'automatic', NULL, 180, '2025-08-03', '14:00:00', NULL, 30, NULL, NULL, NULL, NULL, 'Install new Canon imageRUNNER ADVANCE C5560i multifunction printer with network configuration', 'Customer requires installation in conference room on 3rd floor', NULL, NULL, 'assigned', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-03 13:56:15.452103', '2025-08-03 13:56:15.452103');
INSERT INTO public.field_work_orders VALUES ('7f39c24a-f52d-4b0a-b25c-2136e6eb1644', '550e8400-e29b-41d4-a716-446655440000', 'WO-1754229002', NULL, 'repair', 'urgent', 'cust-002', 'Global Finance Corp', '{"address": "200 Wall Street, NYC", "coordinates": {"lat": 40.7074, "lng": -74.0113}}', NULL, NULL, NULL, NULL, 'f5146520-6ba4-4dc8-a852-b881dc8cfb97', NULL, 'automatic', NULL, 90, '2025-08-03', '15:30:00', NULL, 30, NULL, NULL, NULL, NULL, 'Repair paper jam issue on HP LaserJet Enterprise M609dn - recurring problem affecting daily operations', 'Contact site manager John Smith ext. 245 upon arrival', NULL, NULL, 'in_progress', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-03 13:56:15.452103', '2025-08-03 13:56:15.452103');
INSERT INTO public.field_work_orders VALUES ('9ae3068a-fea4-4019-aeba-50ae2eb3fd84', '550e8400-e29b-41d4-a716-446655440000', 'WO-1754229003', NULL, 'maintenance', 'medium', 'cust-003', 'Healthcare Associates', '{"address": "300 Medical Plaza, NYC", "coordinates": {"lat": 40.7831, "lng": -73.9712}}', NULL, NULL, NULL, NULL, '00974e9b-8d28-4a18-b899-8db0955fc920', NULL, 'automatic', NULL, 120, '2025-08-04', '09:00:00', NULL, 30, NULL, NULL, NULL, NULL, 'Quarterly preventive maintenance on Xerox WorkCentre 7855 including drum replacement and calibration', 'Medical facility - follow strict hygiene protocols', NULL, NULL, 'created', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-03 13:56:15.452103', '2025-08-03 13:56:15.452103');
INSERT INTO public.field_work_orders VALUES ('0eaa2609-723d-423f-936f-ee07ecaf5b77', '550e8400-e29b-41d4-a716-446655440000', 'WO-1754229004', NULL, 'inspection', 'low', 'cust-004', 'Legal Partners LLC', '{"address": "150 Broadway, NYC", "coordinates": {"lat": 40.7087, "lng": -74.0120}}', NULL, NULL, NULL, NULL, NULL, NULL, 'automatic', NULL, 60, '2025-08-05', '11:00:00', NULL, 30, NULL, NULL, NULL, NULL, 'Annual compliance inspection of all printing equipment and security features audit', 'Schedule appointment with IT director before visit', NULL, NULL, 'created', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-03 13:56:15.452103', '2025-08-03 13:56:15.452103');


--
-- Data for Name: financial_forecasts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: financial_kpis; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.financial_kpis VALUES ('20258cd7-7200-48d2-a129-977a0735f338', '550e8400-e29b-41d4-a716-446655440000', 'Monthly Recurring Revenue', 'growth', '2025-08-01', 125000.0000, 118000.0000, 130000.0000, 'improving', 'below_target', 5.90, NULL, NULL, NULL, NULL, false, NULL, NULL, '2025-08-03 04:55:20.744279', '2025-08-03 04:55:20.744279');
INSERT INTO public.financial_kpis VALUES ('022c2e64-3aa0-4038-bddd-276873c012cc', '550e8400-e29b-41d4-a716-446655440000', 'Gross Profit Margin', 'profitability', '2025-08-01', 32.5000, 31.2000, 35.0000, 'improving', 'below_target', 4.20, NULL, NULL, NULL, NULL, false, NULL, NULL, '2025-08-03 04:55:20.744279', '2025-08-03 04:55:20.744279');
INSERT INTO public.financial_kpis VALUES ('6c786da7-b4c2-4c70-8830-4a08800c4d82', '550e8400-e29b-41d4-a716-446655440000', 'Customer Acquisition Cost', 'efficiency', '2025-08-01', 485.0000, 520.0000, 400.0000, 'improving', 'above_target', -6.70, NULL, NULL, NULL, NULL, false, NULL, NULL, '2025-08-03 04:55:20.744279', '2025-08-03 04:55:20.744279');
INSERT INTO public.financial_kpis VALUES ('b7af426c-853f-4f2d-940a-8b4df0e8ca39', '550e8400-e29b-41d4-a716-446655440000', 'Days Sales Outstanding', 'liquidity', '2025-08-01', 28.5000, 32.1000, 25.0000, 'improving', 'above_target', -11.20, NULL, NULL, NULL, NULL, false, NULL, NULL, '2025-08-03 04:55:20.744279', '2025-08-03 04:55:20.744279');
INSERT INTO public.financial_kpis VALUES ('1cc5c595-f97c-42f1-81bc-91373f93e1e3', '550e8400-e29b-41d4-a716-446655440000', 'Customer Lifetime Value', 'profitability', '2025-08-01', 15200.0000, 14800.0000, 18000.0000, 'improving', 'below_target', 2.70, NULL, NULL, NULL, NULL, false, NULL, NULL, '2025-08-03 04:55:20.744279', '2025-08-03 04:55:20.744279');


--
-- Data for Name: forecast_line_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: forecast_metrics; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.forecast_metrics VALUES ('fa49c713-6ce0-451c-97bb-a1f24af384b3', '90728b95-dd3a-42a2-8719-dea28e264666', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', '2025-08-08 12:05:44.01624', 40000.00, 27000.00, NULL, NULL, NULL, 2, NULL, NULL, NULL, NULL, 67.50, 20000.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-08 12:05:44.01624');


--
-- Data for Name: forecast_pipeline_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.forecast_pipeline_items VALUES ('83918d81-8cae-4c9d-8d70-76eea92e16f0', '90728b95-dd3a-42a2-8719-dea28e264666', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'sample-business-record-1', 'ABC Corp Printer Lease', 'ABC Corporation', 25000.00, NULL, 75, '2025-02-15 00:00:00', NULL, NULL, 'proposal', 0, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, 'equipment', 'multifunction_printer', NULL, 1, false, NULL, NULL, 'medium', '[]', NULL, NULL, NULL, 0, NULL, NULL, NULL, true, '2025-08-08 12:05:41.307742', '2025-08-08 12:05:41.307742');
INSERT INTO public.forecast_pipeline_items VALUES ('08bab3ea-1506-4b1d-965c-819f3d10433e', '90728b95-dd3a-42a2-8719-dea28e264666', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'sample-business-record-2', 'XYZ Ltd Service Contract', 'XYZ Limited', 15000.00, NULL, 60, '2025-01-30 00:00:00', NULL, NULL, 'negotiation', 0, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, 'service', 'maintenance_contract', NULL, 1, false, NULL, NULL, 'medium', '[]', NULL, NULL, NULL, 0, NULL, NULL, NULL, true, '2025-08-08 12:05:41.307742', '2025-08-08 12:05:41.307742');


--
-- Data for Name: forecast_rules; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: gl_accounts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: gps_tracking_points; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: integration_audit_logs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.inventory_items VALUES ('item-1', '550e8400-e29b-41d4-a716-446655440000', 'Black Toner - HP LaserJet', 'HP-TONER-BK-05A', 'toner', 15, 20, 45.99, 'HP Direct', '2025-07-31 22:59:00.620555', '2025-07-31 22:59:00.620555');
INSERT INTO public.inventory_items VALUES ('item-2', '550e8400-e29b-41d4-a716-446655440000', 'Color Toner Set - Canon', 'CANON-COLOR-SET', 'toner', 8, 15, 125.50, 'Canon Supply', '2025-07-31 22:59:00.620555', '2025-07-31 22:59:00.620555');
INSERT INTO public.inventory_items VALUES ('item-3', '550e8400-e29b-41d4-a716-446655440000', 'Paper - Letter Size 500ct', 'PAPER-LETTER-500', 'paper', 45, 50, 8.99, 'Office Depot', '2025-07-31 22:59:00.620555', '2025-07-31 22:59:00.620555');


--
-- Data for Name: invoice_line_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: iot_devices; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.iot_devices VALUES ('e6810245-1d65-4414-89a9-2937e757b29e', '550e8400-e29b-41d4-a716-446655440000', 'DEV-001', 'CN123456789', 'Main Office Canon MFP', 'mfp', 'Canon', 'imageRUNNER 2530i', NULL, NULL, 'adc117e7-611d-426a-b569-6c6c0b32e234', 'adc117e7-611d-426a-b569-6c6c0b32e234', 'Main Office - Floor 2', NULL, 'ethernet', NULL, NULL, NULL, NULL, NULL, true, 300, 'active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, '2025-08-03 13:09:55.004503', '2025-08-03 13:09:55.004503');
INSERT INTO public.iot_devices VALUES ('7fb2392a-770c-4797-b50b-c46ded1c4ba7', '550e8400-e29b-41d4-a716-446655440000', 'DEV-002', 'HP987654321', 'Accounting HP Printer', 'printer', 'HP', 'LaserJet Pro M404dn', NULL, NULL, 'adc117e7-611d-426a-b569-6c6c0b32e234', 'adc117e7-611d-426a-b569-6c6c0b32e234', 'Accounting Department', NULL, 'wifi', NULL, NULL, NULL, NULL, NULL, true, 300, 'active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, '2025-08-03 13:09:55.004503', '2025-08-03 13:09:55.004503');
INSERT INTO public.iot_devices VALUES ('a99e2c84-bf5f-41b2-914d-b53681594512', '550e8400-e29b-41d4-a716-446655440000', 'DEV-003', 'FJ111222333', 'Reception Scanner', 'scanner', 'Fujitsu', 'ScanSnap iX1500', NULL, NULL, 'adc117e7-611d-426a-b569-6c6c0b32e234', 'adc117e7-611d-426a-b569-6c6c0b32e234', 'Reception Area', NULL, 'ethernet', NULL, NULL, NULL, NULL, NULL, true, 300, 'offline', NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, '2025-08-03 13:09:55.004503', '2025-08-03 13:09:55.004503');


--
-- Data for Name: knowledge_base_articles; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.knowledge_base_articles VALUES ('92240752-b880-47aa-a303-dbfe8f228784', '550e8400-e29b-41d4-a716-446655440000', 'How to Replace Toner Cartridges', 'replace-toner-cartridges', 'Follow these steps to replace your toner cartridge: 1. Turn off the printer 2. Open the front cover...', 'Step-by-step guide to replacing toner cartridges safely', 'how_to', NULL, NULL, NULL, true, true, 0, 0, 0, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, '2025-08-03 04:45:35.659417', '2025-08-03 04:45:35.659417');
INSERT INTO public.knowledge_base_articles VALUES ('37d932c9-4d23-45b3-abc3-6badea2578b8', '550e8400-e29b-41d4-a716-446655440000', 'Troubleshooting Paper Jams', 'troubleshooting-paper-jams', 'Paper jams can be frustrating but are usually easy to resolve...', 'Common solutions for paper jam issues', 'troubleshooting', NULL, NULL, NULL, true, true, 0, 0, 0, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, '2025-08-03 04:45:35.659417', '2025-08-03 04:45:35.659417');
INSERT INTO public.knowledge_base_articles VALUES ('77398e1c-c94a-45e1-9427-aabaa9e0ff2e', '550e8400-e29b-41d4-a716-446655440000', 'When to Schedule Maintenance', 'schedule-maintenance', 'Regular maintenance keeps your equipment running smoothly...', 'Learn when your equipment needs professional maintenance', 'maintenance', NULL, NULL, NULL, true, false, 0, 0, 0, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, '2025-08-03 04:45:35.659417', '2025-08-03 04:45:35.659417');
INSERT INTO public.knowledge_base_articles VALUES ('b71ae822-525a-42ab-a860-1582e3555782', '550e8400-e29b-41d4-a716-446655440000', 'Ordering Supplies FAQ', 'ordering-supplies-faq', 'Common questions about ordering toner, paper, and other supplies...', 'Frequently asked questions about supply orders', 'faq', NULL, NULL, NULL, true, false, 0, 0, 0, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, '2025-08-03 04:45:35.659417', '2025-08-03 04:45:35.659417');


--
-- Data for Name: lead_activities; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.lead_activities VALUES ('activity-001', '550e8400-e29b-41d4-a716-446655440000', 'lead-001', 'call', 'Initial Discovery Call', 'Discussed their current copier situation and pain points. They have 15 old devices that frequently break down. IT Director is frustrated with maintenance costs.', NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, 'Positive - interested in proposal', NULL, NULL, NULL, NULL, 'demo-user', '2025-08-01 02:37:47.086484', '2025-08-01 02:37:47.086484');
INSERT INTO public.lead_activities VALUES ('activity-002', '550e8400-e29b-41d4-a716-446655440000', 'lead-001', 'email', 'Follow-up with Pricing Information', 'Sent detailed pricing breakdown for 12 new multifunction devices plus managed print services contract.', NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, 'Email opened, awaiting response', NULL, NULL, NULL, NULL, 'demo-user', '2025-08-01 02:37:49.440698', '2025-08-01 02:37:49.440698');
INSERT INTO public.lead_activities VALUES ('b6f1ae63-fc76-47b0-953d-76afd671bf1e', '550e8400-e29b-41d4-a716-446655440000', 'lead-001', 'call', 'Call logged', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'demo-user', '2025-08-01 19:59:48.304835', '2025-08-01 19:59:48.304835');


--
-- Data for Name: lead_contacts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.lead_contacts VALUES ('0037a83b-e9d9-42e6-9599-0f1b9e4298fc', '550e8400-e29b-41d4-a716-446655440000', 'lead-001', 'john', 'Smith', NULL, NULL, '5155254242', 'johns@gmail.com', false, '2025-08-01 19:51:25.941109', '2025-08-01 19:51:25.941109');


--
-- Data for Name: lead_related_records; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.leads VALUES ('lead-002', '550e8400-e29b-41d4-a716-446655440000', 'sarah@techstart.com', '555-0456', '456 Innovation Blvd, San Francisco, CA 94105', 'Referral', 'demo-user', 25000.00, '2025-02-28 00:00:00', 'Growing tech startup, need multifunction devices for 3 locations.', NULL, NULL, 'demo-user', '2025-08-01 02:37:44.20441', '2025-08-01 02:37:44.20441', NULL, NULL, NULL, NULL, 'new', 'new', 25000.00, 50, '2025-02-28', 0, 'medium', NULL, NULL);
INSERT INTO public.leads VALUES ('lead-001', '550e8400-e29b-41d4-a716-446655440000', 'john.smith@acme.com', '555-0123', '123 Business Ave, New York, NY 10001', 'Website', 'demo-user', 45000.00, '2025-03-15 00:00:00', 'Large manufacturing company looking to upgrade their copier fleet. 250 employees, $15M annual revenue.', NULL, NULL, 'demo-user', '2025-08-01 02:37:41.635245', '2025-08-02 03:20:45.231', NULL, NULL, NULL, NULL, 'new', 'new', 45000.00, 50, '2025-03-15', 0, 'medium', NULL, NULL);


--
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: maintenance_notifications; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: maintenance_schedules; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.maintenance_schedules VALUES ('129cc5bf-f615-4c07-be8b-397b84a61fd5', '550e8400-e29b-41d4-a716-446655440000', NULL, NULL, NULL, NULL, 'Monthly Cleaning - Reception Printer', 'time_based', 'monthly', 1, '2025-09-15 10:00:00', NULL, NULL, NULL, NULL, NULL, 90, NULL, NULL, 150.00, 7, true, true, true, 'medium', '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-03 04:45:49.416315', '2025-08-03 04:45:49.416315');
INSERT INTO public.maintenance_schedules VALUES ('414fdc15-ff0a-499c-a4e8-d05d586447d0', '550e8400-e29b-41d4-a716-446655440000', NULL, NULL, NULL, NULL, 'Quarterly Service - Production Copier', 'time_based', 'quarterly', 1, '2025-10-01 09:00:00', NULL, NULL, NULL, NULL, NULL, 180, NULL, NULL, 450.00, 7, true, true, true, 'high', '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-03 04:45:49.416315', '2025-08-03 04:45:49.416315');
INSERT INTO public.maintenance_schedules VALUES ('bb22b95c-83ad-4e97-a543-1e5f6634ca50', '550e8400-e29b-41d4-a716-446655440000', NULL, NULL, NULL, NULL, 'Overdue Drum Replacement', 'meter_based', 'every', 50000, '2025-08-01 14:00:00', NULL, NULL, NULL, NULL, NULL, 120, NULL, NULL, 320.00, 7, true, true, true, 'urgent', '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-03 04:45:49.416315', '2025-08-03 04:45:49.416315');


--
-- Data for Name: maintenance_tasks; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: managed_services; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.managed_services VALUES ('7eb91b39-d4c2-44e2-bc32-820db6c7cddb', '550e8400-e29b-41d4-a716-446655440000', 'IT-NET-001', 'Network Monitoring & Management', 'IT Services', 'Network Management', 'Premium', NULL, 'Comprehensive network monitoring with proactive management and 24/7 support', NULL, NULL, NULL, NULL, '24x7', '15 minutes', false, true, true, true, false, false, true, true, false, 'Monthly', true, 299.00, true, 279.00, true, 259.00, true, 319.00, NULL, NULL, '2025-08-01 03:32:44.619234', '2025-08-01 03:32:44.619234');
INSERT INTO public.managed_services VALUES ('2bb1f906-64c2-4a2a-b327-f7032977d965', '550e8400-e29b-41d4-a716-446655440000', 'IT-SRV-001', 'Server Management Service', 'IT Services', 'Server Management', 'Enterprise', NULL, 'Complete server management including monitoring, patching, and maintenance', NULL, NULL, NULL, NULL, '24x7', '1 hour', true, true, true, true, false, false, true, true, false, 'Monthly', true, 449.00, true, 429.00, true, 399.00, true, 479.00, NULL, NULL, '2025-08-01 03:32:44.619234', '2025-08-01 03:32:44.619234');
INSERT INTO public.managed_services VALUES ('1409d55a-1dbf-48d9-afae-4cfa54a4e769', '550e8400-e29b-41d4-a716-446655440000', 'IT-CLD-001', 'Cloud Migration & Management', 'IT Services', 'Cloud Services', 'Standard', NULL, 'End-to-end cloud migration and ongoing cloud infrastructure management', NULL, NULL, NULL, NULL, '12x5', '4 hours', false, true, false, true, false, false, true, true, false, 'Monthly', true, 599.00, true, 569.00, true, 549.00, true, 629.00, NULL, NULL, '2025-08-01 03:32:44.619234', '2025-08-01 03:32:44.619234');
INSERT INTO public.managed_services VALUES ('ff822641-e96e-4ed1-ba87-4613d861c91f', '550e8400-e29b-41d4-a716-446655440000', 'IT-SEC-001', 'Cybersecurity Management', 'IT Services', 'Security Services', 'Premium', NULL, 'Comprehensive cybersecurity monitoring, threat detection, and incident response', NULL, NULL, NULL, NULL, '24x7', '15 minutes', false, true, true, true, false, false, true, true, false, 'Monthly', true, 399.00, true, 379.00, true, 359.00, true, 429.00, NULL, NULL, '2025-08-01 03:32:44.619234', '2025-08-01 03:32:44.619234');
INSERT INTO public.managed_services VALUES ('ddd73d29-ea47-4e5b-905b-c67a458ae943', '550e8400-e29b-41d4-a716-446655440000', 'IT-BAK-001', 'Backup & Disaster Recovery', 'IT Services', 'Backup & Recovery', 'Enterprise', NULL, 'Automated backup solutions with disaster recovery planning and testing', NULL, NULL, NULL, NULL, '24x5', '4 hours', true, true, true, true, false, false, true, true, false, 'Monthly', true, 349.00, true, 329.00, true, 309.00, true, 379.00, NULL, NULL, '2025-08-01 03:32:44.619234', '2025-08-01 03:32:44.619234');


--
-- Data for Name: master_product_accessories; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.master_product_accessories VALUES ('c6ab96f1-9a49-42ef-a890-d164db473bc9', 'Canon', 'PF-C1', 'Canon PF-C1 Paper Feeding Unit', 'Paper Feeding', 895.00, '{"capacity": "550 sheets", "paperSizes": ["A4", "A5", "B5", "Letter", "Legal"], "compatibility": ["imageRUNNER ADVANCE DX series"]}', 'active', '2025-08-09 16:13:25.050759', '2025-08-09 16:13:25.050759', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('954bc94e-c06c-4d13-b6e3-c0a299cb082f', 'Canon', 'DF-C1', 'Canon DF-C1 Document Feeder', 'Document Feeding', 1295.00, '{"capacity": "100 sheets", "scanSpeed": "80 ipm", "compatibility": ["imageRUNNER ADVANCE DX series"]}', 'active', '2025-08-09 16:13:25.050759', '2025-08-09 16:13:25.050759', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('fdbd804b-43da-47e7-af75-4bdf359f3fc2', 'Xerox', '497K17750', 'Xerox High Capacity Feeder', 'Paper Feeding', 750.00, '{"capacity": "2000 sheets", "paperSizes": ["A4", "A3", "Letter", "Legal"], "compatibility": ["VersaLink C7000", "AltaLink series"]}', 'active', '2025-08-09 16:13:25.050759', '2025-08-09 16:13:25.050759', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('ea23de3d-447c-46b5-b6c0-7f0e99539c67', 'HP', 'T3V27A', 'HP 550-sheet Paper Tray', 'Paper Feeding', 399.00, '{"capacity": "550 sheets", "paperSizes": ["A4", "Letter", "Legal"], "compatibility": ["LaserJet Enterprise M507", "Color LaserJet Enterprise M751"]}', 'active', '2025-08-09 16:13:25.050759', '2025-08-09 16:13:25.050759', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('5d9c4e15-1383-4236-95fa-e1fb24171c70', 'Ricoh', 'PB1040', 'Ricoh PB1040 Paper Bank', 'Paper Feeding', 650.00, '{"capacity": "500 sheets", "paperSizes": ["A4", "A3", "B4", "Letter"], "compatibility": ["IM C series"]}', 'active', '2025-08-09 17:36:46.782895', '2025-08-09 17:36:46.782895', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('ae544bf7-2293-4f42-927a-e7646f44abd9', 'Canon', '4781B004AA', 'Canon Card Set-A4 (201-300)', 'Hardware Accessories', 613.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 327}', 'active', '2025-08-09 18:25:12.462293', '2025-08-09 18:25:33.625', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('48cb2b0b-a980-475a-a6cd-355fff8aaff9', 'Canon', '9579B004AA', 'Cassette Feeding Unit-AJ1 SHOWROOM <2> <4>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 287}', 'active', '2025-08-09 18:25:11.749291', '2025-08-09 18:25:32.988', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('74256285-889c-4d3e-9b0f-7a3cf381fbfc', 'Canon', '4781B005AA', 'Canon Card Set-A5 (301-500)', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 652}', 'active', '2025-08-09 18:25:12.532127', '2025-08-09 18:25:33.687', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('0f60d5fd-e94b-468b-9994-9c0c3c1940cd', 'Canon', '1095B001AA', 'ADF Access Handle-A1 <8>', 'Hardware Accessories', 195.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 110}', 'active', '2025-08-09 18:25:12.680234', '2025-08-09 18:25:33.813', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('c743b808-7db3-4243-bb5f-47fcd81b6b74', 'Canon', '4781B003AA', 'Canon Card Set-A3 (101-200)', 'Hardware Accessories', 613.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 327}', 'active', '2025-08-09 18:25:12.392035', '2025-08-09 18:25:33.563', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('79a60df5-23eb-4e16-9e68-c83fb0b7c1d5', 'Canon', '9580B005AA', 'Cassette Feeding Unit-AK1 SHOWROOM <3> <4>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 575}', 'active', '2025-08-09 18:25:11.821488', '2025-08-09 18:25:33.054', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('9e8bf1d6-5c0d-4691-9ba0-c081aa102dee', 'Canon', '9579B003AA', 'Cassette Feeding Unit-AJ1 <2> <4>', 'Hardware Accessories', 697.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 302}', 'active', '2025-08-09 18:25:11.969087', '2025-08-09 18:25:33.178', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('042e1ee4-af6d-49ac-a188-7f61659184ce', 'Canon', '4781B006AA', 'Canon Card Set-A6 (501-1000)', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit"}', 'active', '2025-08-09 18:25:12.60692', '2025-08-09 18:25:33.749', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('6e8bac45-52d0-4944-9042-85062f681fc8', 'Canon', '4784B001AA', 'Copy Card Reader-F1 <5> <6>', 'Hardware Accessories', 418.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 218}', 'active', '2025-08-09 18:25:12.113231', '2025-08-09 18:25:33.313', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('9b76638e-eb27-42e2-81ad-e2e51baf34b4', 'Canon', '3684B005AA', 'Copy Card Reader Attachment-B5 <7>', 'Hardware Accessories', 112.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 49}', 'active', '2025-08-09 18:25:12.184178', '2025-08-09 18:25:33.375', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('adafe072-98f2-4399-b9ee-e87a2ce776fd', 'Canon', '4781B001AA', 'Canon Card Set-A1 (1-30)', 'Hardware Accessories', 210.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 110}', 'active', '2025-08-09 18:25:12.255065', '2025-08-09 18:25:33.437', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('fd39d993-d69d-4ee5-aae2-57b641646c62', 'Canon', '4781B002AA', 'Canon Card Set-A2 (31-100)', 'Hardware Accessories', 460.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 241}', 'active', '2025-08-09 18:25:12.324218', '2025-08-09 18:25:33.499', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('5cd9e935-7f3a-4508-a49c-75b73088b2f4', 'Canon', '3726B001AA', 'Copy Control Interface Kit-A1 <9>', 'Hardware Accessories', 71.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 37}', 'active', '2025-08-09 18:25:12.752099', '2025-08-09 18:25:33.875', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('27526432-a52a-4f28-ae94-8afb5a348fdf', 'Canon', '4085V100', 'Braille Label Kit-G1', 'Hardware Accessories', 224.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 128}', 'active', '2025-08-09 18:25:12.824286', '2025-08-09 18:25:33.936', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('53015869-c43d-4c73-80d5-c1cac2ed4d3f', 'Canon', '1266V426', 'USB Keyboard (Cherry) <10>', 'Hardware Accessories', 123.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 90}', 'active', '2025-08-09 18:25:12.898371', '2025-08-09 18:25:34.016', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('ef13c803-a88a-43eb-b3ff-6d8098c68e26', 'Canon', '3954V774', 'Universal Keyboard Stand-A2 <11>', 'Hardware Accessories', 331.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 173}', 'active', '2025-08-09 18:25:12.969978', '2025-08-09 18:25:34.081', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('7358d5ea-6690-4f3a-b652-aded58805b8f', 'Canon', '3806V864', 'Convenience Stapler-C1 <12>', 'Hardware Accessories', 477.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 236}', 'active', '2025-08-09 18:25:13.041993', '2025-08-09 18:25:34.144', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('802d3ea2-9b40-48f3-9844-4e8b77c73dde', 'Canon', '3987V510', 'Staple Remover A-1 <14>', 'Hardware Accessories', 809.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 566}', 'active', '2025-08-09 18:25:13.114817', '2025-08-09 18:25:34.207', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('771c35c7-7a7a-4abb-8281-691c533f3978', 'Canon', '3821V580', 'imageRUNNER ADVANCE DX Series Control Panel Protective Film (10 pack) <13>', 'Hardware Accessories', 132.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 35}', 'active', '2025-08-09 18:25:13.18709', '2025-08-09 18:25:34.269', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('72e6e443-9556-4e5d-be2f-3f88643bc212', 'Canon', '5982C001AA', 'Wireless LAN Board-D1', 'Accessories', 67.00, '{"section": "Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 42}', 'active', '2025-08-09 18:25:13.26271', '2025-08-09 18:25:34.33', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('314f96ce-beb1-42ca-a409-3d66bfc7f6e6', 'Canon', '1409C002AA', 'Cassette Module-AE1 <1> <4>', 'Hardware Accessories', 556.00, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 241}', 'active', '2025-08-09 18:25:11.89675', '2025-08-09 18:25:33.117', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('cb867c4f-3df0-4eb2-ae23-c6b628deaf32', 'Canon', '5847C010AA', 'imageRUNNER ADVANCE DX C259iF Showroom', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Remote Operator''s Software Kit"}', 'active', '2025-08-09 18:25:11.602203', '2025-08-09 18:25:32.86', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('f09f5e10-5e12-4cbb-8d24-36b78f324fe6', 'Canon', '3318C001AA', 'Cassette Module-AJ1<3>', 'Hardware Accessories', 556.00, '{"section": "Hardware Accessories", "baseModel": "C568iF", "dealerPrice": 241}', 'active', '2025-08-09 18:25:14.707709', '2025-08-09 18:25:35.605', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('8fa854f7-191d-4fd5-ac05-c769307a4fd3', 'Canon', '3316C001AA', 'Cassette Feeding Unit-AS1 <1>', 'Hardware Accessories', 742.00, '{"section": "Hardware Accessories", "baseModel": "C568iF", "dealerPrice": 322}', 'active', '2025-08-09 18:25:14.599545', '2025-08-09 18:25:35.511', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('caf449df-8d04-4f7b-9f4d-f76857e44ec7', 'Canon', '4837C006AA', 'imageRUNNER ADVANCE DX C568iFZ Toner T04L Bundled Showroom <3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4836C002AA"}', 'active', '2025-08-09 18:25:14.161599', '2025-08-09 18:25:35.125', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('9f2e675f-5af0-4a2b-b5aa-df94d4e19b09', 'Canon', '4836C011AA', 'imageRUNNER ADVANCE DX C478iF Toner T04L Bundled Showroom <3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4836C002AA"}', 'active', '2025-08-09 18:25:14.233346', '2025-08-09 18:25:35.188', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('99bc73b2-df15-4b34-a91f-25bd9c11fb7d', 'Canon', '4836C012AA', 'imageRUNNER ADVANCE DX C478iFZ Toner T04L Bundled Showroom <3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4836C002AA"}', 'active', '2025-08-09 18:25:14.304441', '2025-08-09 18:25:35.249', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('5a409136-d4e5-4c70-8244-931b45c3a451', 'Canon', '3818C003AA', 'Platen Cover-Y3 <10>', 'Hardware Accessories', 140.00, '{"section": "Hardware Accessories", "baseModel": "IP Sec", "dealerPrice": 72}', 'active', '2025-08-09 18:25:16.836364', '2025-08-09 18:25:37.49', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('fade048c-2380-412a-bff9-fb9fc61274d9', 'Canon', '3317C002AA', 'Cassette Feeding Unit-AT1 Showroom<2>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4836C002AA", "dealerPrice": 621}', 'active', '2025-08-09 18:25:14.454747', '2025-08-09 18:25:35.374', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('0e896f74-267d-422a-bb13-632993b6705e', 'Canon', '3684B009AA', 'Copy Card Reader Attachment-B7', 'Hardware Accessories', 112.00, '{"section": "Hardware Accessories", "baseModel": "IP Sec", "dealerPrice": 49}', 'active', '2025-08-09 18:25:16.953874', '2025-08-09 18:25:37.552', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('5704a1dd-1d63-4134-b46e-a6cd1fb712c2', 'Canon', '0165C001AA', 'Utility Tray-B1 <13>', 'Hardware Accessories', 85.00, '{"section": "Hardware Accessories", "baseModel": "IP Sec", "dealerPrice": 42}', 'active', '2025-08-09 18:25:16.752668', '2025-08-09 18:25:37.426', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('9c69404a-d90c-432c-9dc6-202128f739d2', 'Canon', '5961C015AA', 'imageRUNNER ADVANCE DX C3935i Showroom', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "IP Sec"}', 'active', '2025-08-09 18:25:15.390593', '2025-08-09 18:25:36.208', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('dd11ee3c-6b84-457f-896d-d6ed5ad9197d', 'Canon', '5962C015AA', 'imageRUNNER ADVANCE DX C3930i Showroom', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "IP Sec"}', 'active', '2025-08-09 18:25:15.461159', '2025-08-09 18:25:36.271', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('f0e973b8-c0a9-4ff8-b372-67d10cacfa99', 'Canon', '5963C015AA', 'imageRUNNER ADVANCE DX C3926i Showroom', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "IP Sec"}', 'active', '2025-08-09 18:25:15.532565', '2025-08-09 18:25:36.332', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('e46a264e-eba2-4800-b25f-96704e3722ce', 'Canon', '4917C004AA', 'Cassette Feeding Unit-AW1  Showroom <1>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "IP Sec", "dealerPrice": 707}', 'active', '2025-08-09 18:25:15.604279', '2025-08-09 18:25:36.395', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('56565d58-2938-44b3-a24f-bb54d9bf3ad1', 'Canon', '4000C003AA', 'Inner Finisher-L1 Showroom <2>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "IP Sec", "dealerPrice": 708}', 'active', '2025-08-09 18:25:15.676131', '2025-08-09 18:25:36.458', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('a580f488-7784-4f54-8705-e14bbefafb26', 'Canon', '4002C005AA', 'Inner 2/3 Hole Puncher-D1<3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "IP Sec", "dealerPrice": 435}', 'active', '2025-08-09 18:25:15.747135', '2025-08-09 18:25:36.519', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('68f525e4-e5b3-4847-a2b7-f07900effed3', 'Canon', '4921C003AA', 'Staple Finisher-AE1 Showroom<2><3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "IP Sec"}', 'active', '2025-08-09 18:25:15.818346', '2025-08-09 18:25:36.582', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('17b11bb3-cbe0-488e-9a94-0e7564a939dd', 'Canon', '4922C003AA', 'Booklet Finisher-AE1 Showroom <2><3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "IP Sec"}', 'active', '2025-08-09 18:25:15.888811', '2025-08-09 18:25:36.644', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('6563082c-daf1-4485-a357-0079a9fd65ac', 'Canon', '0126C004AA', '2/3 Hole Puncher Unit-A1 Showroom <4>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "IP Sec", "dealerPrice": 490}', 'active', '2025-08-09 18:25:15.960214', '2025-08-09 18:25:36.707', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('3e5706db-ab4c-49f2-a0d0-fece0de45a7a', 'Canon', '4917C002AA', 'Cassette Feeding Unit-AW1 <1>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "IP Sec", "dealerPrice": 786}', 'active', '2025-08-09 18:25:16.103714', '2025-08-09 18:25:36.833', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('07e8bdc2-2923-4f6c-8410-3ceee8fb4e69', 'Canon', '4034C001AA', 'Inner 2way Tray-M1 <2>', 'Hardware Accessories', 140.00, '{"section": "Hardware Accessories", "baseModel": "IP Sec", "dealerPrice": 60}', 'active', '2025-08-09 18:25:16.246157', '2025-08-09 18:25:36.973', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('b7121634-5f79-4fb0-a7de-a033d03dd8ee', 'Canon', '4002C002AA', 'Inner 2/3 Hole Puncher-D1', 'Hardware Accessories', 940.00, '{"section": "Hardware Accessories", "baseModel": "IP Sec", "dealerPrice": 483}', 'active', '2025-08-09 18:25:16.390723', '2025-08-09 18:25:37.098', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('75ee4916-d798-4d82-95a2-621d3f6e8e5c', 'Canon', '4000C002BA', 'Inner Finisher-L1 <2><11>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "IP Sec", "dealerPrice": 786}', 'active', '2025-08-09 18:25:16.31719', '2025-08-09 18:25:37.037', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('3c65d88f-e460-4c6b-bab8-7c0ed4fcb366', 'Canon', '0126C001AA', '2/3 Hole Puncher Unit-A1 <4>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "IP Sec", "dealerPrice": 544}', 'active', '2025-08-09 18:25:16.610652', '2025-08-09 18:25:37.296', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('0a49ab38-14b4-4243-bd80-54e9a8dfab2f', 'Canon', '4921C001AA', 'Staple Finisher-AE1 <2><3><11>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "IP Sec"}', 'active', '2025-08-09 18:25:16.46182', '2025-08-09 18:25:37.168', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('05e82c13-c686-477a-9ffe-06a4ab677f62', 'Canon', '4922C001AA', 'Booklet Finisher-AE1 <2><3><12>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "IP Sec"}', 'active', '2025-08-09 18:25:16.531429', '2025-08-09 18:25:37.231', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('5b34c956-82a7-4ed4-92c3-9a45bcf073bf', 'Canon', '3316C002AA', 'Cassette Feeding Unit-AS1 Showroom <1>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4836C002AA", "dealerPrice": 289}', 'active', '2025-08-09 18:25:14.384394', '2025-08-09 18:25:35.31', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('d1a5193c-6211-4447-8bad-2f39ddd897d6', 'Canon', 'and a wheeled stand for floor standing use. The total paper capacity becomes 2', '300 sheets (550 x 4 + 100 Stack Bypass)."', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4836C002AA"}', 'active', '2025-08-09 18:25:14.527604', '2025-08-09 18:25:35.436', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('0752494c-b045-4ee2-9c56-072a6e1f1b9b', 'Canon', '3317C001AA', 'Cassette Feeding Unit-AT1 <2>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C568iF", "dealerPrice": 690}', 'active', '2025-08-09 18:25:14.654302', '2025-08-09 18:25:35.558', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('8cacd650-1032-4384-8e42-a1753ead7c18', 'Canon', '"The total paper capacity becomes 1', '200 sheets (550 x 2 + 100 Stack Bypass) with one additional cassette or  1', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C568iF"}', 'active', '2025-08-09 18:25:14.761887', '2025-08-09 18:25:35.651', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('2ec356c4-e8e6-4271-9ba9-4828ac205a77', 'Canon', 'USB 2.0/3.0 Connectivity', 'Remote Operator''s Software Kit', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "IP Sec"}', 'active', '2025-08-09 18:25:15.318022', '2025-08-09 18:25:36.144', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('ab6287f2-b5c4-460f-ba94-8d5b583a2829', 'Canon', '4918C002AA', 'Copy Tray-T2', 'Hardware Accessories', 62.00, '{"section": "Hardware Accessories", "baseModel": "IP Sec", "dealerPrice": 29}', 'active', '2025-08-09 18:25:16.68204', '2025-08-09 18:25:37.362', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('ecea59e4-3001-43e8-a8a3-42838a82bf11', 'Canon', '6601C005AA', 'Booklet Finisher-A2 with Tri-Fold <2><4>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Remote Operator''s Software Kit"}', 'active', '2025-08-09 18:25:18.873684', '2025-08-09 18:25:39.26', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('bacab863-6b45-45b9-bd24-50e9f22c763c', 'Canon', '4030C002BA', 'Cassette Feeding Unit-AQ1<1>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C5870i", "dealerPrice": 786}', 'active', '2025-08-09 18:25:19.142579', '2025-08-09 18:25:39.495', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('4f8dce57-a0c0-4953-ae89-e51d6ec3e35e', 'Canon', '5358C001AA', 'Cabinet Type-V<1>', 'Hardware Accessories', 397.00, '{"section": "Hardware Accessories", "baseModel": "C5870i", "dealerPrice": 207}', 'active', '2025-08-09 18:25:19.19633', '2025-08-09 18:25:39.544', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('433a08bf-1e89-4e06-a622-3f49fa958f7f', 'Canon', '6595C002AA', 'Paper Deck Unit-F2<2>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:19.249846', '2025-08-09 18:25:39.592', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('02e66803-679a-4ab5-aedd-9859ca308212', 'Canon', '6598C002AA', 'Staple Finisher-AB3<3><5><13>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:19.312344', '2025-08-09 18:25:39.639', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('48c501d1-48d6-459d-8c28-f39c9a5a753d', 'Canon', '0172C002AA', 'Voice Operation Kit-D1<5>', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C3935i"}', 'active', '2025-08-09 18:25:17.633849', '2025-08-09 18:25:38.142', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('4c2da450-b6f2-4733-af59-78e5024762e7', 'Canon', '0148C001AA', 'Staple Cartridge-Y1 (for Booklet Finisher-AE1)<2>', 'Supplies', 51.00, '{"section": "Supplies", "dealerPrice": 26}', 'active', '2025-08-09 18:25:17.68751', '2025-08-09 18:25:38.192', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('0dccb954-ebec-489a-b1d5-6d8907298f4d', 'Canon', '5546C003AA', 'Buffer Pass Unit-P2', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Remote Operator''s Software Kit", "dealerPrice": 176}', 'active', '2025-08-09 18:25:18.945324', '2025-08-09 18:25:39.323', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('f41daa66-c00e-4388-8cca-c3e1d1599d06', 'Canon', '5984C001AA', 'Wireless LAN Board-F1', 'Accessories', 67.00, '{"section": "Accessories", "baseModel": "C3935i", "dealerPrice": 42}', 'active', '2025-08-09 18:25:17.470207', '2025-08-09 18:25:37.979', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('89d4c22f-73c6-45a9-b449-7ddcf61a1be1', 'Canon', '4036C002AA', 'Numeric Keypad-A2', 'Accessories', 238.00, '{"section": "Accessories", "baseModel": "C3935i", "dealerPrice": 103}', 'active', '2025-08-09 18:25:17.52308', '2025-08-09 18:25:38.029', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('d4dd7a57-092b-4d49-81f7-23a769659078', 'Canon', 'Staple Finisher Lite-A1', 'Booklet Finisher-A2 with Tri-Fold or Inner Tray"', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "Remote Operator''s Software Kit"}', 'active', '2025-08-09 18:25:18.372997', '2025-08-09 18:25:38.806', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('5cdbbcda-dc4c-4be6-b0d3-75d94156cf96', 'Canon', '2 x 550-sheet Paper Cassettes', 'Envelope Feeder Attachment', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "3827C002AA"}', 'active', '2025-08-09 18:25:18.157856', '2025-08-09 18:25:38.617', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('d5be770b-e8bb-43dc-95eb-dda07244b051', 'Canon', '3827C012AA', 'imageRUNNER ADVANCE DX C5840i Showroom bundled with Power PDF V4 5-User with 3 Year M&S<5>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Remote Operator''s Software Kit"}', 'active', '2025-08-09 18:25:18.587389', '2025-08-09 18:25:39.006', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('01962030-03d3-4b56-95d8-3cbcab554fdf', 'Canon', '4031C005AA', 'High Capacity Cassette Feeding Unit-C1<1>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Remote Operator''s Software Kit", "dealerPrice": 869}', 'active', '2025-08-09 18:25:18.657778', '2025-08-09 18:25:39.07', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('f16f37e1-b6b3-43e1-8d83-838d13eaa0e7', 'Canon', '5549C003AA', 'Paper Folding Unit-L1 <6>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Remote Operator''s Software Kit"}', 'active', '2025-08-09 18:25:19.015615', '2025-08-09 18:25:39.385', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('6bf0e9d2-67f4-4fd1-8277-114d34687474', 'Canon', '3824C012AA', 'imageRUNNER ADVANCE DX C5870i Showroom bundled with Power PDF V4 5-User with 3 Year M&S<5>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Remote Operator''s Software Kit"}', 'active', '2025-08-09 18:25:18.516574', '2025-08-09 18:25:38.944', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('136b36ab-283c-424d-9bd2-8450dd66bdbf', 'Canon', '4030C004AA', 'Cassette Feeding Unit-AQ1<1>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Remote Operator''s Software Kit", "dealerPrice": 708}', 'active', '2025-08-09 18:25:18.728981', '2025-08-09 18:25:39.135', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('40573fb4-515e-4808-b894-a1c0f8426474', 'Canon', '4032C001AA', 'Inner Tray (1st Copy Tray Kit-A1) <3>', 'Hardware Accessories', 62.00, '{"section": "Hardware Accessories", "baseModel": "C5870i", "dealerPrice": 29}', 'active', '2025-08-09 18:25:19.644834', '2025-08-09 18:25:39.92', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('c2116a02-5fb9-42c9-a3fa-257acd6be0c2', 'Canon', '5546C002BA', 'Buffer Pass Unit-P2', 'Hardware Accessories', 371.00, '{"section": "Hardware Accessories", "baseModel": "C5870i", "dealerPrice": 195}', 'active', '2025-08-09 18:25:19.485703', '2025-08-09 18:25:39.783', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('a75b9e20-77c3-46a9-8431-39d14b1c62d3', 'Canon', '6598C005AA', 'Staple Finisher-AB3 <2><4>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Remote Operator''s Software Kit"}', 'active', '2025-08-09 18:25:18.801645', '2025-08-09 18:25:39.197', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('ab8528e0-cd5e-4207-bedd-337780e010d2', 'Canon', '7147C001AA', 'Staple Finisher Lite-A1<3><5><21>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:19.379251', '2025-08-09 18:25:39.687', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('741641ba-4a77-43a9-9e2b-e65faa1a2c04', 'Canon', '000 staples) and 2 staple cartridges for booklet (2', '000 x 2 staples). DOES NOT include additional staple cartridges."', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "IP Sec"}', 'active', '2025-08-09 18:25:17.137287', '2025-08-09 18:25:37.678', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('58972708-6243-4d33-a5d2-5d0b75067660', 'Canon', '5549C002AA', 'Paper Folding Unit-L1 <20>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:19.538492', '2025-08-09 18:25:39.829', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('4b81b02a-a4ed-4c59-9246-9e2248f5b790', 'Canon', '4031C002BA', 'High Capacity Cassette Feeding Unit-C1<1>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C5870i", "dealerPrice": 966}', 'active', '2025-08-09 18:25:19.089368', '2025-08-09 18:25:39.449', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('99c8f6ca-ee71-432d-8aac-c39b897a95c5', 'Canon', '4919C001AA', 'Super G3 FAX Board-BH1', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C3935i", "dealerPrice": 579}', 'active', '2025-08-09 18:25:17.208555', '2025-08-09 18:25:37.741', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('33333ca4-1678-4609-84fa-25745947346c', 'Canon', '4920C008AA', 'Super G3 2nd Line Fax Board-BH2 <2>', 'Accessories', 696.00, '{"section": "Accessories", "baseModel": "C3935i", "dealerPrice": 362}', 'active', '2025-08-09 18:25:17.261161', '2025-08-09 18:25:37.787', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('b50c7b28-2390-42ae-93ee-476f19260035', 'Canon', '4039C001BA', 'Memory Mirroring Kit-A1 <6>', 'Accessories', 696.00, '{"section": "Accessories", "baseModel": "C3935i", "dealerPrice": 362}', 'active', '2025-08-09 18:25:17.313147', '2025-08-09 18:25:37.833', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('75610b5b-49dd-4901-8bff-ff364f720e08', 'Canon', '4873C001BA', '250GB SSD-A1 <7>', 'Accessories', 488.00, '{"section": "Accessories", "baseModel": "C3935i", "dealerPrice": 241}', 'active', '2025-08-09 18:25:17.365218', '2025-08-09 18:25:37.881', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('3045e2ac-e1bc-4345-967b-e83b0f93ef6f', 'Canon', '4874C001BA', '1TB SSD-A1', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C3935i", "dealerPrice": 786}', 'active', '2025-08-09 18:25:17.416819', '2025-08-09 18:25:37.932', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('d6153af8-e876-4603-920e-9f37931e112f', 'Canon', '6601C002AA', 'Booklet Finisher-A2 with Tri-Fold <3><5><14>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:19.431675', '2025-08-09 18:25:39.734', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('298e1ad5-bc7c-457b-8fdd-b021bf0cdee4', 'Canon', '4040C001AA', 'IC Card Reader Box for Numeric Keypad-A1<8>', 'Accessories', 212.00, '{"section": "Accessories", "baseModel": "C3935i", "dealerPrice": 92}', 'active', '2025-08-09 18:25:17.576804', '2025-08-09 18:25:38.079', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('8d2be6ff-0640-42be-8034-5d017245c261', 'Canon', '6377C013AA', 'imageFORCE C5140 Showroom <1>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Scan and Send feature with PDF High Compression"}', 'active', '2025-08-09 18:25:21.756204', '2025-08-09 18:25:42.023', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('72f41010-9dc9-43f3-b34c-53f0683760a2', 'Canon', '6596C005AA', 'Cassette Feeding Unit-AY1 Showroom <2>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Scan and Send feature with PDF High Compression", "dealerPrice": 708}', 'active', '2025-08-09 18:25:21.897837', '2025-08-09 18:25:42.156', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('5c50560c-37a7-4cc7-8ca7-be31af52aa73', 'Canon', '6378C012AA', 'imageFORCE C5170 Showroom <1>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Scan and Send feature with PDF High Compression"}', 'active', '2025-08-09 18:25:21.684137', '2025-08-09 18:25:41.959', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('1e125f56-bc58-4a73-b64e-d8d10a3c8f07', 'Canon', '6602C004AA', 'Inner Finisher-N1 Showroom <3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Scan and Send feature with PDF High Compression", "dealerPrice": 707}', 'active', '2025-08-09 18:25:22.041251', '2025-08-09 18:25:42.285', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('0abfa826-ea60-4e81-b3d7-c365bc089794', 'Canon', '7752A047AA', 'Fiery ColorRight Package 3 years term license', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:20.878551', '2025-08-09 18:25:41.207', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('368beecb-c2b0-49bb-9c7c-72da991045f0', 'Canon', '7752A046AA', 'Fiery ColorRight Package 1 year term license', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i", "dealerPrice": 860}', 'active', '2025-08-09 18:25:20.822154', '2025-08-09 18:25:41.159', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('3ca2f6d1-30a5-4e39-b0cb-e5f3a9210299', 'Canon', '6597C006AA', 'High Capacity Cassette Feeding Unit-F1 Showroom <2>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Scan and Send feature with PDF High Compression", "dealerPrice": 868}', 'active', '2025-08-09 18:25:21.826159', '2025-08-09 18:25:42.091', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('e685155b-c3b0-43f0-8866-a8317260c391', 'Canon', '6828C007AA', 'imagePASS-T1 Showroom', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Scan and Send feature with PDF High Compression"}', 'active', '2025-08-09 18:25:22.113482', '2025-08-09 18:25:42.351', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('23c80bfb-86ff-4d6e-9c97-8f58c321cb2c', 'Canon', '7752A043AA', 'Fiery Automation Package 3 years term license', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:21.037573', '2025-08-09 18:25:41.358', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('c85b7b9a-6aee-4543-93f3-426f6eda6836', 'Canon', '7752A044AA', 'Fiery Automation Package 5 years term license', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:21.090641', '2025-08-09 18:25:41.407', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('366f9cfc-1c66-4458-8827-111bcf8070f8', 'Canon', '4100C001AA', 'imagePASS-R1<1>', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:19.967471', '2025-08-09 18:25:40.377', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('e117f381-a820-4757-ab0e-9db5c7afb569', 'Canon', '0123B006AA', 'Hot Folders License', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i", "dealerPrice": 713}', 'active', '2025-08-09 18:25:20.021144', '2025-08-09 18:25:40.425', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('9984f397-a64f-43f8-8ddf-60cea49e7f50', 'Canon', '7752A050AA', 'Fiery with Adobe PDF Print Engine KIT(APPE)', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:20.075218', '2025-08-09 18:25:40.474', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('c6e62f4b-157a-4f30-b5d8-64b0d2ea767b', 'Canon', '7752A074AA', 'Fiery Compose 1 year term license', 'Accessories', 600.00, '{"section": "Accessories", "baseModel": "C5870i", "dealerPrice": 370}', 'active', '2025-08-09 18:25:20.129189', '2025-08-09 18:25:40.521', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('576b2fd2-f53c-494e-86ec-2010d5018568', 'Canon', '7752A075AA', 'Fiery Compose 3 years term license', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i", "dealerPrice": 750}', 'active', '2025-08-09 18:25:20.18321', '2025-08-09 18:25:40.571', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('6f4bea6e-488a-4c0d-aa93-a6e010a9f124', 'Canon', '7752A076AA', 'Fiery Compose 5 years term license', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i", "dealerPrice": 807}', 'active', '2025-08-09 18:25:20.236762', '2025-08-09 18:25:40.619', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('580f5460-24d3-4ae0-815b-ba4c7f4e8f86', 'Canon', '7752A077AA', 'Fiery Impose 1 year license', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i", "dealerPrice": 775}', 'active', '2025-08-09 18:25:20.289984', '2025-08-09 18:25:40.667', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('70acee76-1966-47a3-81ac-e1e6ce52e6cc', 'Canon', '7752A079AA', 'Fiery Impose 5 years license', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:20.396893', '2025-08-09 18:25:40.763', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('a6a03628-0e5e-433e-be8d-1160e6195c0c', 'Canon', '7752A080AA', 'Fiery Impose and Compose 1 year term license <2>', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i", "dealerPrice": 950}', 'active', '2025-08-09 18:25:20.450362', '2025-08-09 18:25:40.811', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('b8a1ab86-1d48-402f-90e7-8d6ffa0d21ba', 'Canon', '7752A081AA', 'Fiery Impose and Compose 3 years term license <2>', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:20.50257', '2025-08-09 18:25:40.859', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('6f3c14d2-76fd-481e-968c-3e0a254eb426', 'Canon', '7752A082AA', 'Fiery Impose and Compose 5 years term license <2>', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:20.55611', '2025-08-09 18:25:40.907', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('daa9042f-336e-42cf-bbb6-078ab71767bf', 'Canon', '8002A017AA', 'X-Rite i1 (for imagePASS-R1)', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:20.608995', '2025-08-09 18:25:40.956', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('8ad66fb8-1351-4f29-84cb-450d50854c0e', 'Canon', '3438B025AA', 'i1 Publish (i1 Profiler) Software <3>', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:20.663514', '2025-08-09 18:25:41.011', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('f7f0908c-9d61-452b-a4bd-03a0f608a778', 'Canon', '3077B130AA', 'Fiery Color Profiler Suite <4><5>', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:20.717396', '2025-08-09 18:25:41.061', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('a46e1cb1-3eee-4a99-b880-ee40b468c5c2', 'Canon', '6603C004AA', 'Buffer Pass Unit-R1 Showroom <5>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Scan and Send feature with PDF High Compression", "dealerPrice": 175}', 'active', '2025-08-09 18:25:21.969908', '2025-08-09 18:25:42.22', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('92edd082-4fb2-467e-b7be-c51dfaf11653', 'Canon', '0146C001AA', 'Staple Cartridge-X1 (for Staple Finisher-AB3 & Booklet Finisher-A2 with Tri-Fold) <3>', 'Supplies', 72.00, '{"section": "Supplies", "dealerPrice": 38}', 'active', '2025-08-09 18:25:21.145674', '2025-08-09 18:25:41.455', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('b48cdfc0-c1b2-4811-b374-201bd710db28', 'Canon', '7752A078AA', 'Fiery Impose 3 years license', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:20.343538', '2025-08-09 18:25:40.715', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('aa3a0df4-1fd4-44ee-8fa2-93dd6c2ba6b3', 'Canon', '7752A048AA', 'Fiery ColorRight Package 5 years term license', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i"}', 'active', '2025-08-09 18:25:20.931743', '2025-08-09 18:25:41.255', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('b4440605-8098-46f1-8e4f-276eb885c371', 'Canon', '7752A042AA', 'Fiery Automation Package 1 year term license', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i", "dealerPrice": 753}', 'active', '2025-08-09 18:25:20.984764', '2025-08-09 18:25:41.307', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('15875dfb-4484-42e2-9b61-264c0e0dabb7', 'Canon', '4037C002BA', 'Super G3 2nd Line Fax Board-AX1<2>', 'Accessories', 696.00, '{"section": "Accessories", "baseModel": "C5870i", "dealerPrice": 362}', 'active', '2025-08-09 18:25:19.859184', '2025-08-09 18:25:40.058', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('d4c5ffdf-ee4f-40dc-a09a-38c78d45ebde', 'Canon', '4038C001BA', 'Super G3 3rd/4th Line Fax Board-AX1<3>', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i", "dealerPrice": 725}', 'active', '2025-08-09 18:25:19.913653', '2025-08-09 18:25:40.327', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('7f015911-19e5-4fa7-9452-ae15c084b8a2', 'Canon', '4064C002AA', 'Printer Cover-M2<17>', 'Hardware Accessories', 278.00, '{"section": "Hardware Accessories", "baseModel": "C5870i", "dealerPrice": 120}', 'active', '2025-08-09 18:25:19.751967', '2025-08-09 18:25:40.013', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('ec1459de-8808-4471-89af-6677dcb67e2d', 'Canon', '6596C002AA', 'Cassette Feeding Unit-AY1 <1>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C5170", "dealerPrice": 786}', 'active', '2025-08-09 18:25:22.310584', '2025-08-09 18:25:42.529', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('b035d0d7-f993-4a1d-a31b-28f2630b5c12', 'Canon', '1409C003AA', 'Cassette Module-AE1 SHOWROOM <1> <4>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 230}', 'active', '2025-08-09 18:25:11.674111', '2025-08-09 18:25:32.925', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('8c73922e-377a-4dfa-9f8d-19ff072e2aed', 'Canon', 'Staple Finisher-AC1', 'Staple Finisher AG1 or Booklet Finisher AG1"', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "Stack Bypass"}', 'active', '2025-08-09 18:25:24.155343', '2025-08-09 18:25:44.235', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('26dfe949-30ba-43bd-8422-1b37ce77bcbf', 'Canon', '6828C005AA', 'imagePASS-T1 with Connection Kit <1>', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C7165"}', 'active', '2025-08-09 18:25:23.665405', '2025-08-09 18:25:43.784', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('7bd57da3-f381-4007-8bed-fd132ccce22c', 'Canon', '6603C002AA', 'Buffer Pass Unit-R1 <7>', 'Hardware Accessories', 369.00, '{"section": "Hardware Accessories", "baseModel": "C5170", "dealerPrice": 192}', 'active', '2025-08-09 18:25:22.46896', '2025-08-09 18:25:42.675', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('13325112-663c-4a62-bb34-ee945c53eaaf', 'Canon', '5594C005AA', 'Booklet Finisher-AG1 Set <1><3><9>', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "C270"}', 'active', '2025-08-09 18:25:24.8244', '2025-08-09 18:25:44.838', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('0525fce7-fb85-4910-8fb0-e85a6c6b36dc', 'Canon', '5593C006AA', 'Staple Finisher-AG1 Set<1><2><9>', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "C270"}', 'active', '2025-08-09 18:25:24.769001', '2025-08-09 18:25:44.79', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('4075b731-b0fd-4f4b-a530-4e4faaa4fb24', 'Canon', '6605C002AA', 'Super G3 2nd Line Fax Board-BQ1 <2>', 'Accessories', 694.00, '{"section": "Accessories", "baseModel": "C5170", "dealerPrice": 358}', 'active', '2025-08-09 18:25:22.628391', '2025-08-09 18:25:42.823', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('a296cb3e-493a-460d-b2fe-99c16de2e921', 'Canon', '6828C001AA', 'imagePASS-T1', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5170"}', 'active', '2025-08-09 18:25:22.785664', '2025-08-09 18:25:42.971', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('c6868352-ac35-42cc-84ab-3f4d437308c6', 'Canon', '3236C003AA', 'Booklet Finisher-AC2 <3><4>', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "5590C005AA"}', 'active', '2025-08-09 18:25:24.515536', '2025-08-09 18:25:44.562', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('49f8e87a-0220-4a06-886b-a8e2a4559285', 'Canon', '7752A083AA', 'FIERY JOB MASTER WITH 1 YEAR MAINTENANCE', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5170"}', 'active', '2025-08-09 18:25:22.891815', '2025-08-09 18:25:43.068', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('60e4978f-ad7f-40e6-91d1-d55c0da80153', 'Canon', '000 staples) and 2 staple cartridges for booklet (5', '000 x 2 staples) within the Finisher. An additional Staple-N1 box "', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "000 staples) within the Finisher.  An additional Staple-N1 box (3 cartridges per box. 5"}', 'active', '2025-08-09 18:25:25.596775', '2025-08-09 18:25:45.535', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('a3288d21-91fa-4972-a3b8-09e31bdb8036', 'Canon', '6606C001AA', 'Super G3 3rd/4th Line Fax Board-BQ1 <3>', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5170", "dealerPrice": 722}', 'active', '2025-08-09 18:25:22.681775', '2025-08-09 18:25:42.873', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('9ff32cd5-9fe5-4a55-9e38-5bbec133d23e', 'Canon', '3237C001BA', 'Jogger Kit-A1<5>', 'Equipment', 795.00, '{"section": "Equipment", "baseModel": "5", "dealerPrice": 403}', 'active', '2025-08-09 18:25:25.844506', '2025-08-09 18:25:45.771', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('74d50770-d6a4-4fb3-9dd5-0b3b836daad0', 'Canon', '4095V700', 'JobExpert/PDF Processing Kit', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5170"}', 'active', '2025-08-09 18:25:22.839172', '2025-08-09 18:25:43.02', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('d9b9d880-fd11-435f-8a08-6b5566bc5bfc', 'Canon', '6599C001AA', 'Long Sheet Feeding Tray-A1 <11>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C5170", "dealerPrice": 663}', 'active', '2025-08-09 18:25:22.521846', '2025-08-09 18:25:42.725', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('742e7908-bcd1-44d2-95e3-cfb5b8c1b97d', 'Canon', 'Booklet Finisher-AG1', 'Staple Finisher-AC1', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "4481V203"}', 'active', '2025-08-09 18:25:25.489064', '2025-08-09 18:25:45.438', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('484b2843-4d30-4931-9ba3-daf0f2382075', 'Canon', '7752A085AA', 'FIERY JOB MASTER WITH 5 YEAR MAINTENANCE', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5170"}', 'active', '2025-08-09 18:25:22.998287', '2025-08-09 18:25:43.175', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('08539463-3aee-446c-8c63-a399019ab5e7', 'Canon', '3235C001BA', 'Staple Finisher-AC1 <1><2><3>', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "5"}', 'active', '2025-08-09 18:25:25.704605', '2025-08-09 18:25:45.632', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('9d78241f-f634-417c-8557-add8ad8078d1', 'Canon', '3236C014AA', 'Booklet Finisher-AC2 <1><2><4>', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "5"}', 'active', '2025-08-09 18:25:25.77428', '2025-08-09 18:25:45.698', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('08f5c9e9-1375-45b2-b8f5-3d0263efc971', 'Canon', 'Inner Finisher-N1', 'Staple Finisher-AB3', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Scan and Send feature with PDF High Compression"}', 'active', '2025-08-09 18:25:22.185239', '2025-08-09 18:25:42.415', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('9738a370-a1c9-40f7-a5b3-3f01b312c000', 'Canon', '5594C006AA', 'Booklet Finisher-AG1 <3><4>', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "5590C005AA"}', 'active', '2025-08-09 18:25:24.371763', '2025-08-09 18:25:44.434', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('1128d92a-45ae-4161-8f83-01c0dcb15e25', 'Canon', '6618C001AA', 'Inner Tray (1st Copy Tray Kit-B1) <3>', 'Hardware Accessories', 61.00, '{"section": "Hardware Accessories", "baseModel": "C5170", "dealerPrice": 29}', 'active', '2025-08-09 18:25:22.363551', '2025-08-09 18:25:42.576', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('5a427de3-f1f5-452e-95b3-67c1d9d5c3c9', 'Canon', '6602C002AA', 'Inner Finisher-N1 <3><9>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C5170", "dealerPrice": 786}', 'active', '2025-08-09 18:25:22.415965', '2025-08-09 18:25:42.625', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('badd06e8-54df-407b-8ae4-7d4bb98e4541', 'Canon', '6597C002AA', 'High Capacity Cassette Feeding Unit-F1 <1>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C5170", "dealerPrice": 963}', 'active', '2025-08-09 18:25:22.256889', '2025-08-09 18:25:42.48', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('ffdd33b8-ca03-4a32-920f-60949e359df3', 'Canon', '6610C003AA', 'Wireless LAN Board-H1 with 5GHz License <9>', 'Accessories', 67.00, '{"section": "Accessories", "baseModel": "C5170", "dealerPrice": 42}', 'active', '2025-08-09 18:25:22.733501', '2025-08-09 18:25:42.922', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('d3b7ec9f-5a2d-48bd-b3f1-f304edcf32eb', 'Canon', '5593C007AA', 'Staple Finisher-AG1 <3><4>', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "5590C005AA"}', 'active', '2025-08-09 18:25:24.30056', '2025-08-09 18:25:44.369', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('1fe32b6c-3b50-4e48-ab37-0cd3002ca3f2', 'Canon', '6604C001AA', 'Long Sheet Catch Tray-D1 <12>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C5170", "dealerPrice": 781}', 'active', '2025-08-09 18:25:22.574744', '2025-08-09 18:25:42.775', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('98246b84-dc15-43ab-b94b-6eedb280c487', 'Canon', '6607C001AA', 'Long Sheet Feeding Tray-B1 <11>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C7165", "dealerPrice": 663}', 'active', '2025-08-09 18:25:23.609199', '2025-08-09 18:25:43.734', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('686c2dbb-a5aa-4e52-b214-eff0a0fb747f', 'Canon', '3235C005AA', 'Staple Finisher-AC1 <3><4>', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "5590C005AA"}', 'active', '2025-08-09 18:25:24.443709', '2025-08-09 18:25:44.498', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('be626b0f-1b83-45db-a24b-ad85fbb1b1ed', 'Canon', '6382C013AA', 'imageFORCE C7165 Showroom', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "6382C002AA"}', 'active', '2025-08-09 18:25:23.411965', '2025-08-09 18:25:43.557', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('26cd62e2-ba67-459f-bcea-9094242ff031', 'Canon', '6828C006AA', 'imagePASS-T1 with Connection Kit Showroom <5>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "6382C002AA"}', 'active', '2025-08-09 18:25:23.483509', '2025-08-09 18:25:43.622', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('61c0c01e-d35b-4661-b40c-13b16d72ed55', 'Canon', '6595C007AA', 'Paper Deck Unit-F2 Set <2>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "C7165"}', 'active', '2025-08-09 18:25:23.555606', '2025-08-09 18:25:43.687', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('d6fcad84-5906-4003-a9e3-612a7aac1c6d', 'Canon', '5831C002AA', 'Cassette Feeding Unit-AX1 SHOWROOM<4>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T", "dealerPrice": 621}', 'active', '2025-08-09 18:25:28.014735', '2025-08-09 18:25:47.754', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('0aaec45b-9b9c-463c-ad90-d810508d2df3', 'Canon', '5850C008AA', 'imageRUNNER ADVANCE DX 719iFZ SHOWROOM <3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T"}', 'active', '2025-08-09 18:25:27.663104', '2025-08-09 18:25:47.43', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('d27f9ab6-ed99-408a-bb1c-bbedcd217ffc', 'Canon', '2916C001AA', 'Cassette Feeding Unit-AR1<2>', 'Hardware Accessories', 742.00, '{"section": "Hardware Accessories", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T", "dealerPrice": 322}', 'active', '2025-08-09 18:25:28.301561', '2025-08-09 18:25:48.013', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('096f024c-fa13-4be9-9243-70848c24494f', 'Canon', '3791C001AA', 'Cabinet Type-U<4>', 'Hardware Accessories', 212.00, '{"section": "Hardware Accessories", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T", "dealerPrice": 92}', 'active', '2025-08-09 18:25:28.583028', '2025-08-09 18:25:48.292', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('ec2c6d9f-b6be-45b7-9456-6e20540598c9', 'Canon', '1007B001AA', 'Staple-N1 (for Staple Finisher-AG1 & Booklet Finisher-AG1) <1>', 'Supplies', 233.00, '{"section": "Supplies", "baseModel": "C270", "dealerPrice": 112}', 'active', '2025-08-09 18:25:26.178911', '2025-08-09 18:25:46.082', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('38c71509-f98f-47c2-a588-1758ae90005f', 'Canon', '2918C001AA', 'Envelope Cassette Module-A1<1>', 'Hardware Accessories', 556.00, '{"section": "Hardware Accessories", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T", "dealerPrice": 241}', 'active', '2025-08-09 18:25:28.511042', '2025-08-09 18:25:48.217', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('2fe11940-7395-466e-a8f9-47ae7613adb5', 'Canon', '"Cannot be installed with Cassette Feeding Unit-AR1', 'High Capacity Cassette Feeding Unit-D1 or Cassette Feeding Unit-AX1."', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T"}', 'active', '2025-08-09 18:25:28.652863', '2025-08-09 18:25:48.359', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('1f45419d-0045-42eb-a880-3480b0ccbaef', 'Canon', '8034B005BA', 'Silex Wireless Bridge SX-4600WAN2', 'Hardware Accessories', 333.00, '{"section": "Hardware Accessories", "baseModel": "\"ULM(Requires Download)", "dealerPrice": 186}', 'active', '2025-08-09 18:25:26.810798', '2025-08-09 18:25:46.651', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('1bcb3d79-b245-4d19-962c-eac9109fa845', 'Canon', 'Stored Job Print', 'Interrupt Print', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "\"ULM(Requires Download)"}', 'active', '2025-08-09 18:25:26.880871', '2025-08-09 18:25:46.716', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('730775db-0292-40de-8195-c702808e0a0e', 'Canon', '0660A018AA', 'Barcode Printing Kit-F1', 'Accessories', 540.00, '{"section": "Accessories", "baseModel": "\"ULM(Requires Download)", "dealerPrice": 324}', 'active', '2025-08-09 18:25:26.952286', '2025-08-09 18:25:46.78', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('00ee2945-7ef4-42c8-a06d-5b89bfef19d9', 'Canon', '0643A029AA', 'PCL Font Set-C1', 'Accessories', 454.00, '{"section": "Accessories", "baseModel": "\"ULM(Requires Download)", "dealerPrice": 227}', 'active', '2025-08-09 18:25:27.023552', '2025-08-09 18:25:46.844', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('4626ee43-1b8b-4c72-88ed-b4baa6237572', 'Canon', '"(550 x 2 + 2', '000 + 100 Stack Bypass). Cannot be installed with Cassette Module-AG1', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T"}', 'active', '2025-08-09 18:25:28.723714', '2025-08-09 18:25:48.427', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('908df156-b1b0-4ac4-95ca-9178e1f3ce79', 'Canon', '2916C002AA', 'Cassette Feeding Unit-AR1 SHOWROOM <1>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T", "dealerPrice": 289}', 'active', '2025-08-09 18:25:27.874856', '2025-08-09 18:25:47.623', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('ae31c3a9-ea53-4093-ae6e-68209813bd42', 'Canon', 'one additional 2000-sheet cassette', 'and a wheeled stand for floor standing use. The total paper capacity becomes 3', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T"}', 'active', '2025-08-09 18:25:28.086851', '2025-08-09 18:25:47.822', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('d5701906-45a7-45fa-9f9f-cae38722f6d8', 'Canon', '5849C011AA', 'imageRUNNER ADVANCE DX 619iF SHOWROOM <3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T"}', 'active', '2025-08-09 18:25:27.523419', '2025-08-09 18:25:47.298', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('24ee7f8f-8b3a-40e3-b867-b03b240467e6', 'Canon', '2917C001AA', 'Cassette Module-AG1<1>', 'Hardware Accessories', 556.00, '{"section": "Hardware Accessories", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T", "dealerPrice": 241}', 'active', '2025-08-09 18:25:28.231756', '2025-08-09 18:25:47.948', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('6a41caa7-ddf9-4bda-aa6a-1b3e8230de4c', 'Canon', '5850C009AA', 'imageRUNNER ADVANCE DX 719iF SHOWROOM <3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T"}', 'active', '2025-08-09 18:25:27.452253', '2025-08-09 18:25:47.234', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('34ad9f04-91a0-4671-9ad5-f905684be072', 'Canon', '5831C001AA', 'Cassette Feeding Unit-AX1<15>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T", "dealerPrice": 690}', 'active', '2025-08-09 18:25:28.440906', '2025-08-09 18:25:48.153', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('90de8e54-7054-4a94-bbd5-b6f6170b7991', 'Canon', '5848C013AA', 'imageRUNNER ADVANCE DX 529iF SHOWROOM <3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T"}', 'active', '2025-08-09 18:25:27.593659', '2025-08-09 18:25:47.364', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('f5c57415-b1f9-4241-98f5-d6894ce7a6f3', 'Canon', '0865C001AA', 'Paper Feeder PF-C1 <1>', 'Hardware Accessories', 407.00, '{"section": "Hardware Accessories", "baseModel": "\"ULM(Requires Download)", "dealerPrice": 197}', 'active', '2025-08-09 18:25:26.584607', '2025-08-09 18:25:46.453', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('8b3f422d-2170-4d5d-8fb5-c63d7a3ae249', 'Canon', '5970C014AA', 'imageRUNNER ADVANCE DX 4945i Showroom<1>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Ethernet 1000Base-T/100Base-TX/10Base-T"}', 'active', '2025-08-09 18:25:29.043101', '2025-08-09 18:25:48.721', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('33852292-281b-490b-a404-e9400ae460a6', 'Canon', '8943B099AA', 'PRISMAprepare V8 - Software License - 1st Concurrent User <7>', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C270"}', 'active', '2025-08-09 18:25:26.092455', '2025-08-09 18:25:45.999', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('061b26a8-9805-41c1-baaa-b282ad28a54c', 'Canon', '5858A010AD', 'Cabinet Type-S <2>', 'Hardware Accessories', 382.00, '{"section": "Hardware Accessories", "baseModel": "\"ULM(Requires Download)", "dealerPrice": 243}', 'active', '2025-08-09 18:25:26.656481', '2025-08-09 18:25:46.52', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('de4cf67e-130f-4484-8bb0-98b5112a1f99', 'Canon', '2915C001AA', 'High Capacity Cassette Feeding Unit-D1<3>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T", "dealerPrice": 690}', 'active', '2025-08-09 18:25:28.371757', '2025-08-09 18:25:48.079', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('7631625d-fc5f-4561-91d6-40ae3fd74903', 'Canon', '5848C011AA', 'imageRUNNER ADVANCE DX 529iFZ SHOWROOM <3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T"}', 'active', '2025-08-09 18:25:27.804791', '2025-08-09 18:25:47.56', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('5b446d53-6444-4a97-ba85-f3b729b2715d', 'Canon', '5849C012AA', 'imageRUNNER ADVANCE DX 619iFZ SHOWROOM <3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T"}', 'active', '2025-08-09 18:25:27.733511', '2025-08-09 18:25:47.495', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('fd2baa26-e4c3-4926-99df-d968d507b077', 'Canon', '2915C002AA', 'High Capacity Cassette Feeding Unit-D1 SHOWROOM <2>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T", "dealerPrice": 621}', 'active', '2025-08-09 18:25:27.945502', '2025-08-09 18:25:47.688', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('f583ab93-eee5-4a21-a8ed-06c3baaf4d8e', 'Canon', '0655A004AA', 'SD Card-C1<4>', 'Hardware Accessories', 441.00, '{"section": "Hardware Accessories", "baseModel": "\"ULM(Requires Download)", "dealerPrice": 221}', 'active', '2025-08-09 18:25:26.739382', '2025-08-09 18:25:46.586', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('eedfe2f6-d22a-40fb-ab7d-53914287787a', 'Canon', '4837C005AA', 'imageRUNNER ADVANCE DX C568iF Toner T04L Bundled Showroom <3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4836C002AA"}', 'active', '2025-08-09 18:25:14.089725', '2025-08-09 18:25:35.061', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('181a5095-908e-47a5-b8a7-7c4bc5bff64c', 'Canon', 'Inner Finisher-L1', 'Staple Finisher-AE1 or Booklet Finisher-AE1 cannot be installed at the same time."', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "IP Sec"}', 'active', '2025-08-09 18:25:16.031733', '2025-08-09 18:25:36.77', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('7f4aae94-6626-4627-b44f-6c61b4ad988f', 'Canon', '4067C002AA', 'OP Attachment Kit for Reader-A2 <14>', 'Hardware Accessories', 26.00, '{"section": "Hardware Accessories", "baseModel": "IP Sec", "dealerPrice": 11}', 'active', '2025-08-09 18:25:17.0559', '2025-08-09 18:25:37.616', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('58494b28-2443-4299-8978-341526c08c5d', 'Canon', '8930B001AA', 'Tab Feeding Attachment-F1<7>', 'Hardware Accessories', 106.00, '{"section": "Hardware Accessories", "baseModel": "C5870i", "dealerPrice": 46}', 'active', '2025-08-09 18:25:19.591799', '2025-08-09 18:25:39.875', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('1540ff9f-2bcc-4c80-a876-17d3a439bf4d', 'Canon', '4033C001AA', '3rd Copy Tray Kit-A1', 'Hardware Accessories', 92.00, '{"section": "Hardware Accessories", "baseModel": "C5870i", "dealerPrice": 40}', 'active', '2025-08-09 18:25:19.69777', '2025-08-09 18:25:39.967', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('b0bd6b52-e9b4-4ac3-bcb2-f0de6d4b1d3d', 'Canon', '3077B131AA', 'Fiery Color Profiler Suite Annual Maintenance <6>', 'Accessories', 410.00, '{"section": "Accessories", "baseModel": "C5870i", "dealerPrice": 360}', 'active', '2025-08-09 18:25:20.770565', '2025-08-09 18:25:41.11', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('c95d4cb3-a0b6-43ca-9ee1-a154b4b5d546', 'Canon', '0164C002AA', 'Copy Tray-R2 <2>', 'Showroom Model', 278.00, '{"section": "Showroom", "baseModel": "Data Encryption (FIPS-140-2)", "dealerPrice": 145}', 'active', '2025-08-09 18:25:30.179193', '2025-08-09 18:25:49.76', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('b3752fef-d901-4ec4-939e-11f19b8c186d', 'Canon', '0104C001AA', 'Document Insertion Unit-P1 <3><4>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Data Encryption (FIPS-140-2)"}', 'active', '2025-08-09 18:25:30.24952', '2025-08-09 18:25:49.824', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('01d985c3-fa28-410a-bb57-cab706e5e044', 'Canon', '0105C002AA', 'Document Insertion / Folding Unit-J1 <3><4>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Data Encryption (FIPS-140-2)"}', 'active', '2025-08-09 18:25:30.318664', '2025-08-09 18:25:49.888', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('04123c52-dd05-495c-a978-5a2284ddaea5', 'Canon', '0100C007AA', 'Booklet Finisher-X1 <4><6>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4950C001AA"}', 'active', '2025-08-09 18:25:32.167193', '2025-08-09 18:25:51.624', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('b44488f3-72a3-4f8d-b1c1-a45665a6e9c5', 'Canon', '0163C002AB', 'POD Deck Lite-C1 <1>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Data Encryption (FIPS-140-2)"}', 'active', '2025-08-09 18:25:30.107384', '2025-08-09 18:25:49.695', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('fa1fc726-06b4-4058-9339-7bf7e4a20fb3', 'Canon', '3813C001AA', 'DADF-BA1<17>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "dealerPrice": 483}', 'active', '2025-08-09 18:25:29.433205', '2025-08-09 18:25:49.077', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('76cdbc89-330c-45f6-949f-4600c63487c7', 'Canon', '4946C014AA', 'imageRUNNER ADVANCE DX 8986i  Showroom<1><3><6>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4950C001AA"}', 'active', '2025-08-09 18:25:32.023159', '2025-08-09 18:25:51.494', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('ba02c38e-fee2-4773-a042-c8feb72c8beb', 'Canon', '5971C014AA', 'imageRUNNER ADVANCE DX 4935i Showroom<1><2>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Ethernet 1000Base-T/100Base-TX/10Base-T"}', 'active', '2025-08-09 18:25:29.115621', '2025-08-09 18:25:48.785', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('2f61714e-7f03-4ff4-8fa9-cdcc90f365e8', 'Canon', '5972C014AA', 'imageRUNNER ADVANCE DX 4925i Showroom<1><2>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Ethernet 1000Base-T/100Base-TX/10Base-T"}', 'active', '2025-08-09 18:25:29.186108', '2025-08-09 18:25:48.849', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('687c3bee-f848-4e00-95b4-73ad4ec2fddc', 'Canon', '4063C003AA', 'Single Pass DADF-C1<1>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Ethernet 1000Base-T/100Base-TX/10Base-T", "dealerPrice": 849}', 'active', '2025-08-09 18:25:29.259435', '2025-08-09 18:25:48.913', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('e7a1c8fb-bb42-40d1-8963-a8c5318b8f7d', 'Canon', '0097C002AA', 'Printer Cover-H2 <6>', 'Showroom Model', 265.00, '{"section": "Showroom", "baseModel": "Data Encryption (FIPS-140-2)", "dealerPrice": 115}', 'active', '2025-08-09 18:25:30.45798', '2025-08-09 18:25:50.02', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('2b10ee37-07d3-44a8-9aef-0dbb85ba0074', 'Canon', '4063C001AA', 'Single Pass DADF-C1<5>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "dealerPrice": 943}', 'active', '2025-08-09 18:25:29.398063', '2025-08-09 18:25:49.044', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('96ea02df-7b58-4e7b-9018-7acb5bf29bf1', 'Canon', '5555C002AA', 'High Capacity Cassette Feeding Unit-E1<1>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "dealerPrice": 966}', 'active', '2025-08-09 18:25:29.468205', '2025-08-09 18:25:49.109', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('e4c2bd4c-a81f-4e44-887a-233d6d6c0d9a', 'Canon', '4962C011AA', 'imageRUNNER ADVANCE DX 6870i Showroom bundled with Power PDF V4 5-User with 3 Year M&S<5>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "5538C002AA"}', 'active', '2025-08-09 18:25:30.888657', '2025-08-09 18:25:50.436', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('9d7b288b-4a79-431c-9015-68124f434e0f', 'Canon', '3730B010AA', 'Copy Card Reader Attachment-A5', 'Showroom Model', 112.00, '{"section": "Showroom", "baseModel": "Data Encryption (FIPS-140-2)", "dealerPrice": 49}', 'active', '2025-08-09 18:25:30.530353', '2025-08-09 18:25:50.087', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('8806f115-e4da-45ef-a56c-0934da7b50e9', 'Canon', '6014C010AA', 'imageRUNNER ADVANCE DX 6980i Showroom<1><2><4>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Data Encryption (FIPS-140-2)"}', 'active', '2025-08-09 18:25:29.756794', '2025-08-09 18:25:49.375', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('e001643a-5f92-4950-b845-ee1ed7f4948f', 'Canon', '3236C017AA', 'Booklet Finisher-AC2 <3><4>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Data Encryption (FIPS-140-2)"}', 'active', '2025-08-09 18:25:29.826609', '2025-08-09 18:25:49.439', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('8148eac8-902c-4069-8c1a-33e7108f5e95', 'Canon', 'Booklet Finisher-AC2', 'and Copy Tray-R2 cannot be installed at the same time."', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Data Encryption (FIPS-140-2)"}', 'active', '2025-08-09 18:25:29.896887', '2025-08-09 18:25:49.502', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('cc0b55d9-4c5f-40eb-bda5-9342d938cea3', 'Canon', 'Item No', 'Description', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Data Encryption (FIPS-140-2)"}', 'active', '2025-08-09 18:25:29.967512', '2025-08-09 18:25:49.566', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('55036761-c149-43d4-8857-04b42e0ce05e', 'Canon', '4946C013AA', 'imageRUNNER ADVANCE DX 8905i  Showroom<1><2><6>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4950C001AA"}', 'active', '2025-08-09 18:25:31.882486', '2025-08-09 18:25:51.365', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('6a459ffc-292e-4a58-bfeb-c12845fcb94e', 'Canon', '6024C001AA', 'Canon Wireless LAN Board-G1', 'Accessories', 67.00, '{"section": "Accessories", "dealerPrice": 42}', 'active', '2025-08-09 18:25:30.671889', '2025-08-09 18:25:50.221', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('269c96c1-c683-4ef0-9539-0f21733040a7', 'Canon', '4963C011AA', 'imageRUNNER ADVANCE DX 6860i Showroom bundled with Power PDF V4 5-User with 3 Year M&S<5>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "5538C002AA"}', 'active', '2025-08-09 18:25:30.958159', '2025-08-09 18:25:50.502', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('376cf9d0-2a66-4c34-b716-9336a6ff60d6', 'Canon', '0099C007AA', 'Staple Finisher-X1 <4><6>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4950C001AA"}', 'active', '2025-08-09 18:25:32.094325', '2025-08-09 18:25:51.559', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('48523e9f-58b0-4b90-a190-fc457b63caf4', 'Canon', '5538C054AA', 'imageRUNNER ADVANCE DX 6855i Showroom bundled with Power PDF V4 5-User with 3 Year M&S', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "5538C002AA"}', 'active', '2025-08-09 18:25:31.029417', '2025-08-09 18:25:50.568', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('12ed7741-71a7-4ddf-98db-02abaf05c804', 'Canon', 'USB 2.0/3.0 High Speed Connectivity', 'Remote Operator''s Software Kit', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "4950C001AA"}', 'active', '2025-08-09 18:25:31.741194', '2025-08-09 18:25:51.235', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('5e43b879-afe7-4b2d-bb75-9f0763c1adc7', 'Canon', '6380C011AA', 'imageFORCE 6155 Showroom <1>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "6616C002AA"}', 'active', '2025-08-09 18:25:31.459917', '2025-08-09 18:25:50.972', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('dc1da90a-9806-4c41-8ebc-fd06a90a0f7b', 'Canon', '6376C011AA', 'imageFORCE 6170 Showroom <1>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "6616C002AA"}', 'active', '2025-08-09 18:25:31.315662', '2025-08-09 18:25:50.835', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('408113a6-5075-4ca3-b2ae-ee9f4c6cb472', 'Canon', '0162C002AA', 'Paper Deck Unit-E1 <1>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Data Encryption (FIPS-140-2)"}', 'active', '2025-08-09 18:25:30.037549', '2025-08-09 18:25:49.63', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('231ff99d-756d-4092-9619-0644545bd319', 'Canon', '4946C015AA', 'imageRUNNER ADVANCE DX 8995i  Showroom<1><2><6>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4950C001AA"}', 'active', '2025-08-09 18:25:31.952442', '2025-08-09 18:25:51.429', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('ff919574-bdc8-42ad-95ff-e35d060befd8', 'Canon', '6379C011AA', 'imageFORCE 6160 Showroom <1>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "6616C002AA"}', 'active', '2025-08-09 18:25:31.388355', '2025-08-09 18:25:50.908', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('35e8a8e2-63cc-4f85-a6a1-067ee09c836c', 'Canon', 'Booklet Finisher-X1', 'Staple Finisher-AG1', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "4950C001AA"}', 'active', '2025-08-09 18:25:31.813056', '2025-08-09 18:25:51.3', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('4630e11a-6695-4413-8dcb-1929538f2eb9', 'Canon', '000 staples) within the Finisher.  An additional Staple-X1 box (3 cartridges per box', '5', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Data Encryption (FIPS-140-2)"}', 'active', '2025-08-09 18:25:30.602983', '2025-08-09 18:25:50.153', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('f19a5713-9eba-4141-9104-5f27ac8044e3', 'Canon', '1097B002AA', 'Double Feeding Detection Kit-B1', 'Hardware Accessories', 663.00, '{"section": "Hardware Accessories", "dealerPrice": 276}', 'active', '2025-08-09 18:25:32.87494', '2025-08-09 18:25:52.313', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('4d0aa140-b4ba-4d4d-8e8b-5dde6571887e', 'Canon', '5846C013AA', 'imageRUNNER ADVANCE DX C359iF Showroom', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Remote Operator''s Software Kit"}', 'active', '2025-08-09 18:25:11.511041', '2025-08-09 18:25:32.799', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('7073dd2a-36a8-40d9-a73a-9a4c839500d8', 'Canon', '9580B003AA', 'Cassette Feeding Unit-AK1 <3> <4>', 'Hardware Accessories', NULL, '{"section": "Hardware Accessories", "baseModel": "\"Remote Operator''s Software Kit", "dealerPrice": 605}', 'active', '2025-08-09 18:25:12.03961', '2025-08-09 18:25:33.243', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('f096e4d9-4050-4bf7-95c4-df7d180dafd9', 'Canon', '2988B001AA', 'Inner Booklet Trimmer-A1 (for Booklet Finisher-X1) <2>', 'Equipment', NULL, '{"section": "Equipment"}', 'active', '2025-08-09 18:25:32.597626', '2025-08-09 18:25:52.039', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('b793f4d7-2404-4072-92e3-fb8a41cd579d', 'Canon', '5634C001AA', 'Cabinet Type-W<1>', 'Hardware Accessories', 201.00, '{"section": "Hardware Accessories", "baseModel": "IP Sec", "dealerPrice": 97}', 'active', '2025-08-09 18:25:16.174489', '2025-08-09 18:25:36.896', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('527d8b0f-a458-49d7-b60f-eec210d13f2c', 'Canon', 'Staple Finisher-AB3', 'Staple Finisher Lite-A1', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "Remote Operator''s Software Kit"}', 'active', '2025-08-09 18:25:18.445025', '2025-08-09 18:25:38.869', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('dc37e9bd-cf3a-425f-be18-444da4a41792', 'Canon', '3998C007AA', 'Super G3 FAX Board-AX2', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5870i", "dealerPrice": 572}', 'active', '2025-08-09 18:25:19.803723', '2025-08-09 18:25:40.058', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('edccfc66-6c8f-4491-8fd0-7ed15dcf5c64', 'Canon', '6793A004AA', 'Tab Feeding Attachment Kit-B1<5>', 'Showroom Model', 222.00, '{"section": "Showroom", "baseModel": "Data Encryption (FIPS-140-2)", "dealerPrice": 97}', 'active', '2025-08-09 18:25:30.389009', '2025-08-09 18:25:49.954', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('8e30d20c-db96-41fd-becf-b9c6d0549354', 'Canon', 'Booklet Finisher', 'and Copy Tray-R2 cannot be installed at the same time."', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "Encrypted Secure Print"}', 'active', '2025-08-09 18:25:24.696661', '2025-08-09 18:25:44.724', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('f7de044f-a983-453c-bca9-0af84bf5b586', 'Canon', '7752A084AA', 'FIERY JOB MASTER WITH 3 YEAR MAINTENANCE', 'Accessories', NULL, '{"section": "Accessories", "baseModel": "C5170"}', 'active', '2025-08-09 18:25:22.945551', '2025-08-09 18:25:43.127', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('c2c1cb63-1150-4c38-8d45-e8fea06836cf', 'Canon', '2895B002AA', 'Puncher Unit-BF1 (for Staple Finisher-X1 and Booklet Finisher-X1) <4>', 'Equipment', NULL, '{"section": "Equipment", "dealerPrice": 483}', 'active', '2025-08-09 18:25:32.632022', '2025-08-09 18:25:52.072', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('acfec99d-5cf3-4fea-abf4-5635d10609b7', 'Canon', '5593C009AA', 'Staple Finisher-AG1 <4><6>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4950C001AA"}', 'active', '2025-08-09 18:25:32.239916', '2025-08-09 18:25:51.689', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('dc84b5c0-dd63-4903-be47-7ddde2bfac92', 'Canon', '5594C008AA', 'Booklet Finisher-AG1<4><6>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4950C001AA"}', 'active', '2025-08-09 18:25:32.310083', '2025-08-09 18:25:51.756', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('945c3841-a390-4dde-a36b-930978eabbb3', 'Canon', '5223C002AA', '"Document Insertion Unit-R1 (for Staple Finisher-X1', 'Equipment', NULL, '{"section": "Equipment"}', 'active', '2025-08-09 18:25:32.667897', '2025-08-09 18:25:52.109', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('1634c70b-9874-4746-b937-64d385735ad2', 'Canon', '0161C001AA', 'Inserter Option Controller Kit-A1 (Required when attaching the Insertion Unit with the Staple Finisher-AG1 or Booklet Finisher-AG1)', 'Equipment', 398.00, '{"section": "Equipment", "dealerPrice": 173}', 'active', '2025-08-09 18:25:32.70234', '2025-08-09 18:25:52.144', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('7dc77ff8-29ca-4fc4-a07d-b71034e3b693', 'Canon', 'Booklet Trimmer-G1', 'Document Insertion Unit-R1', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "4950C001AA"}', 'active', '2025-08-09 18:25:32.380313', '2025-08-09 18:25:51.824', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('aa9065a0-a812-4ce9-a3d3-6f9f2bb10c65', 'Canon', '000 staples) and 2 staple cartridge for booklet (2', '000 x 2 staples) within the Finisher. An additional Staple"', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "000 staples) within the Finisher.  An additional Staple Cartridge-X1 box (3 cartridges per box"}', 'active', '2025-08-09 18:25:26.022213', '2025-08-09 18:25:45.933', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('44f093ec-b4da-40e8-bd2d-cd30be744326', 'Canon', '0997C001AA', 'MF Professional Puncher Attachment Kit-A1', 'Equipment', 663.00, '{"section": "Equipment", "dealerPrice": 287}', 'active', '2025-08-09 18:25:32.736873', '2025-08-09 18:25:52.178', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('2e0d8236-f558-4b24-bccf-2660d3fd3b3e', 'Canon', '0099C002AA', 'Staple Finisher-X1 <1><12>', 'Equipment', NULL, '{"section": "Equipment"}', 'active', '2025-08-09 18:25:32.451199', '2025-08-09 18:25:51.891', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('136094b9-af44-42fb-906a-f9706fddd8ba', 'Canon', '"Cannot be installed with Cassette Module-AG1', 'Envelope Cassette Module-A1', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "\"Ethernet 1000Base-T/100Base-TX/10Base-T"}', 'active', '2025-08-09 18:25:28.1583', '2025-08-09 18:25:47.885', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('402210a1-f056-4a08-99bb-b91a4aca18cf', 'Canon', '5555C005AA', 'High Capacity Cassette Feeding Unit-E1<3>', 'Showroom Model', NULL, '{"section": "Showroom", "baseModel": "Ethernet 1000Base-T/100Base-TX/10Base-T", "dealerPrice": 869}', 'active', '2025-08-09 18:25:29.327571', '2025-08-09 18:25:48.979', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('ef38ad83-0425-43b5-8158-d6349b134f3d', 'Canon', '000 staples) and 2 staple cartridge for booklet (5', '000 x 2 staples) within the Finisher. An additional Staple-N1 box for stapling"', 'Equipment', NULL, '{"section": "Equipment", "baseModel": "000 staples) within the Finisher.  An additional Staple Cartridge-X1 box(3 cartridges per box. 5"}', 'active', '2025-08-09 18:25:32.80565', '2025-08-09 18:25:52.245', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('56b97c57-f466-4ae5-8e1e-0eaa4d16fbd7', 'Canon', '0100C002AA', 'Booklet Finisher-X1 <1><13>', 'Equipment', NULL, '{"section": "Equipment"}', 'active', '2025-08-09 18:25:32.487632', '2025-08-09 18:25:51.925', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('cd1df63b-041c-4d10-9660-a417a14d4dd7', 'Canon', '5593C002AA', 'Staple Finisher-AG1 <1>', 'Equipment', NULL, '{"section": "Equipment"}', 'active', '2025-08-09 18:25:32.52789', '2025-08-09 18:25:51.97', NULL, '1.0');
INSERT INTO public.master_product_accessories VALUES ('63c2ce81-f138-4fb3-bae9-8efcd5dd86e4', 'Canon', '5594C002AA', 'Booklet Finisher-AG1 <1>', 'Equipment', NULL, '{"section": "Equipment"}', 'active', '2025-08-09 18:25:32.562316', '2025-08-09 18:25:52.006', NULL, '1.0');


--
-- Data for Name: master_product_accessory_relationships; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.master_product_accessory_relationships VALUES ('2fe38c32-9a6c-4205-86f2-0962b35c18e7', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '4d0aa140-b4ba-4d4d-8e8b-5dde6571887e', 'recommended', 'Showroom', '2025-08-09 18:25:11.549906');
INSERT INTO public.master_product_accessory_relationships VALUES ('a1f26620-543c-439b-beb2-78018ca12d9c', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'cb867c4f-3df0-4eb2-ae23-c6b628deaf32', 'recommended', 'Showroom', '2025-08-09 18:25:11.637382');
INSERT INTO public.master_product_accessory_relationships VALUES ('526a9fab-216c-49c5-914f-03d2b3ca608f', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'b035d0d7-f993-4a1d-a31b-28f2630b5c12', 'recommended', 'Showroom', '2025-08-09 18:25:11.711597');
INSERT INTO public.master_product_accessory_relationships VALUES ('260db46f-3727-4408-94c7-3431f52beea2', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '48cb2b0b-a980-475a-a6cd-355fff8aaff9', 'recommended', 'Showroom', '2025-08-09 18:25:11.785336');
INSERT INTO public.master_product_accessory_relationships VALUES ('0a69ea89-b61d-4b26-8020-ced89b6752f2', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '79a60df5-23eb-4e16-9e68-c83fb0b7c1d5', 'recommended', 'Showroom', '2025-08-09 18:25:11.860982');
INSERT INTO public.master_product_accessory_relationships VALUES ('56b31693-a2e4-4531-9fc0-fdbecb5c3f79', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '314f96ce-beb1-42ca-a409-3d66bfc7f6e6', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:11.932624');
INSERT INTO public.master_product_accessory_relationships VALUES ('93dee2f7-f85f-493f-a09e-a0dc90be9fda', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '9e8bf1d6-5c0d-4691-9ba0-c081aa102dee', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:12.004538');
INSERT INTO public.master_product_accessory_relationships VALUES ('8435bc27-c4ed-4010-a9d3-28db6280f0da', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '7073dd2a-36a8-40d9-a73a-9a4c839500d8', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:12.075769');
INSERT INTO public.master_product_accessory_relationships VALUES ('257d9c7f-d79c-4a42-9797-b01d1579693b', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '6e8bac45-52d0-4944-9042-85062f681fc8', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:12.149367');
INSERT INTO public.master_product_accessory_relationships VALUES ('41ce6f05-6e43-437b-a13c-c0fa7b4dda73', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '9b76638e-eb27-42e2-81ad-e2e51baf34b4', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:12.219343');
INSERT INTO public.master_product_accessory_relationships VALUES ('c78421cf-b3eb-4a0e-aa65-0c3b91191123', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'adafe072-98f2-4399-b9ee-e87a2ce776fd', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:12.289556');
INSERT INTO public.master_product_accessory_relationships VALUES ('720e3b9c-b022-4254-8901-6a93f37e50c9', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'fd39d993-d69d-4ee5-aae2-57b641646c62', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:12.358792');
INSERT INTO public.master_product_accessory_relationships VALUES ('b8e82339-5580-47a2-b4ef-939ae43ad4e1', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'c743b808-7db3-4243-bb5f-47fcd81b6b74', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:12.426493');
INSERT INTO public.master_product_accessory_relationships VALUES ('f8b65f06-22d4-4672-98e0-2c3800dcbbcd', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'ae544bf7-2293-4f42-927a-e7646f44abd9', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:12.497376');
INSERT INTO public.master_product_accessory_relationships VALUES ('a03ab17b-07cc-4dd3-b1ac-bc268e95a382', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '74256285-889c-4d3e-9b0f-7a3cf381fbfc', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:12.568306');
INSERT INTO public.master_product_accessory_relationships VALUES ('9fe9e9a6-e43b-4ffc-8cf6-d2e0d6614faa', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '042e1ee4-af6d-49ac-a188-7f61659184ce', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:12.643008');
INSERT INTO public.master_product_accessory_relationships VALUES ('43dee344-d5b2-410a-ab65-00fbcc5a54ca', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '0f60d5fd-e94b-468b-9994-9c0c3c1940cd', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:12.716156');
INSERT INTO public.master_product_accessory_relationships VALUES ('433eb76f-209b-46ab-8cad-6f67a1e21d6f', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '5cd9e935-7f3a-4508-a49c-75b73088b2f4', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:12.78854');
INSERT INTO public.master_product_accessory_relationships VALUES ('13bf8bc2-0442-4dfe-8328-41ca7eb2a074', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '27526432-a52a-4f28-ae94-8afb5a348fdf', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:12.860694');
INSERT INTO public.master_product_accessory_relationships VALUES ('428bf19e-283e-41a5-ba79-a60969c70633', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '53015869-c43d-4c73-80d5-c1cac2ed4d3f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:12.933632');
INSERT INTO public.master_product_accessory_relationships VALUES ('5d6b4c0b-0e02-4260-8b54-fe635cf3d817', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'ef13c803-a88a-43eb-b3ff-6d8098c68e26', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:13.005431');
INSERT INTO public.master_product_accessory_relationships VALUES ('807bbd5e-9956-4068-b679-b68c2ffb3e04', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '7358d5ea-6690-4f3a-b652-aded58805b8f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:13.077869');
INSERT INTO public.master_product_accessory_relationships VALUES ('b3026820-6597-46c1-9f48-879ac77ff889', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '802d3ea2-9b40-48f3-9844-4e8b77c73dde', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:13.150899');
INSERT INTO public.master_product_accessory_relationships VALUES ('c0a58bc9-8c37-4698-8f57-e18395a63ada', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '771c35c7-7a7a-4abb-8281-691c533f3978', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:13.227956');
INSERT INTO public.master_product_accessory_relationships VALUES ('8f1d339a-8dc7-48b5-8220-eeade58a31e7', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '72e6e443-9556-4e5d-be2f-3f88643bc212', 'compatible', 'Accessories', '2025-08-09 18:25:13.298738');
INSERT INTO public.master_product_accessory_relationships VALUES ('2b0830b6-441f-492c-b71d-aed38f1cfd33', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'eedfe2f6-d22a-40fb-ab7d-53914287787a', 'recommended', 'Showroom', '2025-08-09 18:25:14.127204');
INSERT INTO public.master_product_accessory_relationships VALUES ('a174ac2f-3cfd-400f-a1d7-474dff882e40', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'caf449df-8d04-4f7b-9f4d-f76857e44ec7', 'recommended', 'Showroom', '2025-08-09 18:25:14.197513');
INSERT INTO public.master_product_accessory_relationships VALUES ('729edff2-3024-439c-9cea-e4cdf77b3da4', '476ddceb-5e67-4f40-980d-9361ba382cc0', '9f2e675f-5af0-4a2b-b5aa-df94d4e19b09', 'recommended', 'Showroom', '2025-08-09 18:25:14.268276');
INSERT INTO public.master_product_accessory_relationships VALUES ('fd749daf-89b9-47f8-9ca4-e1a1a8bd558a', '476ddceb-5e67-4f40-980d-9361ba382cc0', '99bc73b2-df15-4b34-a91f-25bd9c11fb7d', 'recommended', 'Showroom', '2025-08-09 18:25:14.340229');
INSERT INTO public.master_product_accessory_relationships VALUES ('b8dc5d2c-beb2-4c29-8a92-1c7a421277e0', '476ddceb-5e67-4f40-980d-9361ba382cc0', '5b34c956-82a7-4ed4-92c3-9a45bcf073bf', 'recommended', 'Showroom', '2025-08-09 18:25:14.418874');
INSERT INTO public.master_product_accessory_relationships VALUES ('18cf8aaa-c431-471f-894d-5e62841c1395', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'fade048c-2380-412a-bff9-fb9fc61274d9', 'recommended', 'Showroom', '2025-08-09 18:25:14.491265');
INSERT INTO public.master_product_accessory_relationships VALUES ('5ef35181-4d06-4fd6-8b8e-761ad9d57ac2', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'd1a5193c-6211-4447-8bad-2f39ddd897d6', 'recommended', 'Showroom', '2025-08-09 18:25:14.563132');
INSERT INTO public.master_product_accessory_relationships VALUES ('95ea815b-bbcd-48f9-b98c-8bbf551a88f0', 'd10c773b-2953-4e77-add5-ff998ff9b616', '2ec356c4-e8e6-4271-9ba9-4828ac205a77', 'compatible', 'Equipment', '2025-08-09 18:25:15.353756');
INSERT INTO public.master_product_accessory_relationships VALUES ('32d79f48-03d8-4d92-9540-1f7d7112d40b', 'd10c773b-2953-4e77-add5-ff998ff9b616', '9c69404a-d90c-432c-9dc6-202128f739d2', 'recommended', 'Showroom', '2025-08-09 18:25:15.425541');
INSERT INTO public.master_product_accessory_relationships VALUES ('986fd749-f243-4899-bdb5-2cfe5afab822', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'dd11ee3c-6b84-457f-896d-d6ed5ad9197d', 'recommended', 'Showroom', '2025-08-09 18:25:15.497039');
INSERT INTO public.master_product_accessory_relationships VALUES ('4985a21f-bc01-49d3-8994-f3d5eff0687b', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'f0e973b8-c0a9-4ff8-b372-67d10cacfa99', 'recommended', 'Showroom', '2025-08-09 18:25:15.568389');
INSERT INTO public.master_product_accessory_relationships VALUES ('303a97f6-8ddb-496d-bcc7-50f94c84a9e7', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'e46a264e-eba2-4800-b25f-96704e3722ce', 'recommended', 'Showroom', '2025-08-09 18:25:15.640695');
INSERT INTO public.master_product_accessory_relationships VALUES ('d96830b8-32b6-47ca-a1b4-6d63b51aa587', 'd10c773b-2953-4e77-add5-ff998ff9b616', '56565d58-2938-44b3-a24f-bb54d9bf3ad1', 'recommended', 'Showroom', '2025-08-09 18:25:15.711827');
INSERT INTO public.master_product_accessory_relationships VALUES ('967136dd-2e2f-4011-b7ed-aad6d1e2f85b', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'a580f488-7784-4f54-8705-e14bbefafb26', 'recommended', 'Showroom', '2025-08-09 18:25:15.782776');
INSERT INTO public.master_product_accessory_relationships VALUES ('d1aa04b0-f100-43da-ad00-63956d5a7613', 'd10c773b-2953-4e77-add5-ff998ff9b616', '68f525e4-e5b3-4847-a2b7-f07900effed3', 'recommended', 'Showroom', '2025-08-09 18:25:15.853782');
INSERT INTO public.master_product_accessory_relationships VALUES ('271cc874-b9c5-4113-8f89-22b79b5238a6', 'd10c773b-2953-4e77-add5-ff998ff9b616', '17b11bb3-cbe0-488e-9a94-0e7564a939dd', 'recommended', 'Showroom', '2025-08-09 18:25:15.924555');
INSERT INTO public.master_product_accessory_relationships VALUES ('51803975-114b-424a-9278-3546e737296c', 'd10c773b-2953-4e77-add5-ff998ff9b616', '6563082c-daf1-4485-a357-0079a9fd65ac', 'recommended', 'Showroom', '2025-08-09 18:25:15.995854');
INSERT INTO public.master_product_accessory_relationships VALUES ('6138a400-82e5-4c00-9ae9-e0c5c4fc415e', 'd10c773b-2953-4e77-add5-ff998ff9b616', '181a5095-908e-47a5-b8a7-7c4bc5bff64c', 'recommended', 'Showroom', '2025-08-09 18:25:16.067916');
INSERT INTO public.master_product_accessory_relationships VALUES ('b9c0989f-bb6d-47aa-be18-c8b905f3cabd', 'd10c773b-2953-4e77-add5-ff998ff9b616', '3e5706db-ab4c-49f2-a0d0-fece0de45a7a', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:16.138989');
INSERT INTO public.master_product_accessory_relationships VALUES ('17b924a3-8b6b-4e18-9ab6-429fad179fed', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'b793f4d7-2404-4072-92e3-fb8a41cd579d', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:16.210212');
INSERT INTO public.master_product_accessory_relationships VALUES ('9068c680-5707-4e44-bf41-358e2d507a05', 'd10c773b-2953-4e77-add5-ff998ff9b616', '07e8bdc2-2923-4f6c-8410-3ceee8fb4e69', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:16.281644');
INSERT INTO public.master_product_accessory_relationships VALUES ('5a199cac-7106-4c65-82ee-595d608ec5cd', 'd10c773b-2953-4e77-add5-ff998ff9b616', '75ee4916-d798-4d82-95a2-621d3f6e8e5c', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:16.352974');
INSERT INTO public.master_product_accessory_relationships VALUES ('8cc4a94d-ef54-4fd8-af75-22876cd49626', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'b7121634-5f79-4fb0-a7de-a033d03dd8ee', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:16.426784');
INSERT INTO public.master_product_accessory_relationships VALUES ('0716aa47-f3e0-4c22-bd1d-0eab88b1e28e', 'd10c773b-2953-4e77-add5-ff998ff9b616', '0a49ab38-14b4-4243-bd80-54e9a8dfab2f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:16.497677');
INSERT INTO public.master_product_accessory_relationships VALUES ('c30dba0e-f5a9-4555-825e-9d7c39a37ec1', 'd10c773b-2953-4e77-add5-ff998ff9b616', '05e82c13-c686-477a-9ffe-06a4ab677f62', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:16.565802');
INSERT INTO public.master_product_accessory_relationships VALUES ('5e8764e4-06ea-45fd-89e3-c83598089a5b', 'd10c773b-2953-4e77-add5-ff998ff9b616', '3c65d88f-e460-4c6b-bab8-7c0ed4fcb366', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:16.646196');
INSERT INTO public.master_product_accessory_relationships VALUES ('86cbb63c-109f-405e-932a-fd5bbea1d941', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'ab6287f2-b5c4-460f-ba94-8d5b583a2829', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:16.71722');
INSERT INTO public.master_product_accessory_relationships VALUES ('725f9526-78f5-4b80-8f18-32e9d2f3f0fd', 'd10c773b-2953-4e77-add5-ff998ff9b616', '5704a1dd-1d63-4134-b46e-a6cd1fb712c2', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:16.787877');
INSERT INTO public.master_product_accessory_relationships VALUES ('0bebc318-11cc-42f4-8eb9-d721fa187b39', 'd10c773b-2953-4e77-add5-ff998ff9b616', '5a409136-d4e5-4c70-8244-931b45c3a451', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:16.895775');
INSERT INTO public.master_product_accessory_relationships VALUES ('2afc33bc-7198-4064-8005-ef24d273c492', 'd10c773b-2953-4e77-add5-ff998ff9b616', '0e896f74-267d-422a-bb13-632993b6705e', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:17.019582');
INSERT INTO public.master_product_accessory_relationships VALUES ('a8709c94-2072-4bc3-b9fd-dd681403a321', 'd10c773b-2953-4e77-add5-ff998ff9b616', '7f4aae94-6626-4627-b44f-6c61b4ad988f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:17.091053');
INSERT INTO public.master_product_accessory_relationships VALUES ('e4400ca0-39e7-404c-8424-7c339ef0aa41', 'd10c773b-2953-4e77-add5-ff998ff9b616', '741641ba-4a77-43a9-9e2b-e65faa1a2c04', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:17.172958');
INSERT INTO public.master_product_accessory_relationships VALUES ('b3a561fc-7048-432c-8815-14322d517f7a', '2f2fa512-141b-4a26-981b-898464106523', '5cdbbcda-dc4c-4be6-b0d3-75d94156cf96', 'compatible', 'Equipment', '2025-08-09 18:25:18.193578');
INSERT INTO public.master_product_accessory_relationships VALUES ('e5f7229c-e317-4312-99c1-2d1ecbc1f43f', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'd4dd7a57-092b-4d49-81f7-23a769659078', 'compatible', 'Equipment', '2025-08-09 18:25:18.409251');
INSERT INTO public.master_product_accessory_relationships VALUES ('8e7a8937-988b-420e-87f8-56e01b2cc213', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '527d8b0f-a458-49d7-b60f-eec210d13f2c', 'compatible', 'Equipment', '2025-08-09 18:25:18.480987');
INSERT INTO public.master_product_accessory_relationships VALUES ('2ef8fd27-2ff8-4c10-845f-d2770a6021ef', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '6bf0e9d2-67f4-4fd1-8277-114d34687474', 'recommended', 'Showroom', '2025-08-09 18:25:18.551537');
INSERT INTO public.master_product_accessory_relationships VALUES ('f69e27ba-94e2-44b5-b61c-2d84968564a9', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'd5be770b-e8bb-43dc-95eb-dda07244b051', 'recommended', 'Showroom', '2025-08-09 18:25:18.622094');
INSERT INTO public.master_product_accessory_relationships VALUES ('ba23ebb4-dca4-4d89-8aba-09d0e9a39102', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '01962030-03d3-4b56-95d8-3cbcab554fdf', 'recommended', 'Showroom', '2025-08-09 18:25:18.693338');
INSERT INTO public.master_product_accessory_relationships VALUES ('8e52b647-5116-4e8c-bc79-639b3adf8806', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '136b36ab-283c-424d-9bd2-8450dd66bdbf', 'recommended', 'Showroom', '2025-08-09 18:25:18.765107');
INSERT INTO public.master_product_accessory_relationships VALUES ('e53e7f5a-dc53-4a49-b4b9-638432da12c2', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'a75b9e20-77c3-46a9-8431-39d14b1c62d3', 'recommended', 'Showroom', '2025-08-09 18:25:18.837807');
INSERT INTO public.master_product_accessory_relationships VALUES ('81b10533-45fd-4751-92a3-6321672824a7', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'ecea59e4-3001-43e8-a8a3-42838a82bf11', 'recommended', 'Showroom', '2025-08-09 18:25:18.909527');
INSERT INTO public.master_product_accessory_relationships VALUES ('7f283dcc-d2e6-41e7-a76c-2cc99a90cca2', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '0dccb954-ebec-489a-b1d5-6d8907298f4d', 'recommended', 'Showroom', '2025-08-09 18:25:18.980915');
INSERT INTO public.master_product_accessory_relationships VALUES ('eb76e255-65f7-4b71-8d59-e60397cec8a1', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'f16f37e1-b6b3-43e1-8d83-838d13eaa0e7', 'recommended', 'Showroom', '2025-08-09 18:25:19.051595');
INSERT INTO public.master_product_accessory_relationships VALUES ('f490f797-7ce0-4d84-a17e-dc123979a518', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '5c50560c-37a7-4cc7-8ca7-be31af52aa73', 'recommended', 'Showroom', '2025-08-09 18:25:21.719945');
INSERT INTO public.master_product_accessory_relationships VALUES ('4871e551-7fc2-4193-9027-0b1f0e474073', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '8d2be6ff-0640-42be-8034-5d017245c261', 'recommended', 'Showroom', '2025-08-09 18:25:21.790552');
INSERT INTO public.master_product_accessory_relationships VALUES ('29b1b16b-4409-42ec-9511-41bf33fe0e7e', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '3ca2f6d1-30a5-4e39-b0cb-e5f3a9210299', 'recommended', 'Showroom', '2025-08-09 18:25:21.86235');
INSERT INTO public.master_product_accessory_relationships VALUES ('36ce85ee-a8f1-432e-8cab-5292b45826d4', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '72f41010-9dc9-43f3-b34c-53f0683760a2', 'recommended', 'Showroom', '2025-08-09 18:25:21.934074');
INSERT INTO public.master_product_accessory_relationships VALUES ('032a5916-6886-4acb-b009-5cab6bd8ca8e', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', 'a46e1cb1-3eee-4a99-b880-ee40b468c5c2', 'recommended', 'Showroom', '2025-08-09 18:25:22.005183');
INSERT INTO public.master_product_accessory_relationships VALUES ('42c0115d-c388-4e3a-a94d-0a909e087650', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '1e125f56-bc58-4a73-b64e-d8d10a3c8f07', 'recommended', 'Showroom', '2025-08-09 18:25:22.077367');
INSERT INTO public.master_product_accessory_relationships VALUES ('4a343b76-f76a-459a-8c14-9492d18caefb', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', 'e685155b-c3b0-43f0-8866-a8317260c391', 'recommended', 'Showroom', '2025-08-09 18:25:22.149596');
INSERT INTO public.master_product_accessory_relationships VALUES ('a1a4b23c-c761-4310-be68-dd7d6df7f396', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '08f5c9e9-1375-45b2-b8f5-3d0263efc971', 'recommended', 'Showroom', '2025-08-09 18:25:22.221008');
INSERT INTO public.master_product_accessory_relationships VALUES ('33e05afa-c9e8-4d9e-8110-e342fb0fa014', '6246c7a2-f6dd-482b-a3b3-b185d00a0e94', 'be626b0f-1b83-45db-a24b-ad85fbb1b1ed', 'recommended', 'Showroom', '2025-08-09 18:25:23.447992');
INSERT INTO public.master_product_accessory_relationships VALUES ('e4702894-30fd-45ca-800a-c2cb2374064f', '6246c7a2-f6dd-482b-a3b3-b185d00a0e94', '26cd62e2-ba67-459f-bcea-9094242ff031', 'recommended', 'Showroom', '2025-08-09 18:25:23.52012');
INSERT INTO public.master_product_accessory_relationships VALUES ('ce8ecf70-409e-4847-b7f1-93de98791c33', '7328c6d1-3b04-45d1-aa5b-75ee4ff2165d', '8c73922e-377a-4dfa-9f8d-19ff072e2aed', 'compatible', 'Equipment', '2025-08-09 18:25:24.191601');
INSERT INTO public.master_product_accessory_relationships VALUES ('c674ec4e-96f1-4576-b840-ec980fd94c27', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', 'd3b7ec9f-5a2d-48bd-b3f1-f304edcf32eb', 'compatible', 'Equipment', '2025-08-09 18:25:24.336208');
INSERT INTO public.master_product_accessory_relationships VALUES ('040d25d5-cd90-4d0d-9dd6-df0b841a5d17', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', '9738a370-a1c9-40f7-a5b3-3f01b312c000', 'compatible', 'Equipment', '2025-08-09 18:25:24.40776');
INSERT INTO public.master_product_accessory_relationships VALUES ('7dba5337-f56a-4fc5-a2b9-709372e4fe43', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', '686c2dbb-a5aa-4e52-b214-eff0a0fb747f', 'compatible', 'Equipment', '2025-08-09 18:25:24.480049');
INSERT INTO public.master_product_accessory_relationships VALUES ('87729058-c803-4553-9b6a-dc6d40f183ad', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', 'c6868352-ac35-42cc-84ab-3f4d437308c6', 'compatible', 'Equipment', '2025-08-09 18:25:24.551263');
INSERT INTO public.master_product_accessory_relationships VALUES ('c29c3627-0b07-412a-b9e8-1d846ec7f5a7', 'dcedf307-ef36-42d7-8f7e-4353fd20803b', '8e30d20c-db96-41fd-becf-b9c6d0549354', 'compatible', 'Equipment', '2025-08-09 18:25:24.73328');
INSERT INTO public.master_product_accessory_relationships VALUES ('4b131267-0c6c-43dc-bd3e-e8d1b02b782e', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '4d0aa140-b4ba-4d4d-8e8b-5dde6571887e', 'recommended', 'Showroom', '2025-08-09 18:25:25.110779');
INSERT INTO public.master_product_accessory_relationships VALUES ('e6ed1089-55b7-4458-aad4-ccc4527fb879', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'cb867c4f-3df0-4eb2-ae23-c6b628deaf32', 'recommended', 'Showroom', '2025-08-09 18:25:25.182864');
INSERT INTO public.master_product_accessory_relationships VALUES ('9ea470a1-ac4e-465b-8ce5-1fa65927865f', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'b035d0d7-f993-4a1d-a31b-28f2630b5c12', 'recommended', 'Showroom', '2025-08-09 18:25:25.254645');
INSERT INTO public.master_product_accessory_relationships VALUES ('7505c80a-b896-4122-a9bf-3d4db561529c', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '48cb2b0b-a980-475a-a6cd-355fff8aaff9', 'recommended', 'Showroom', '2025-08-09 18:25:25.327988');
INSERT INTO public.master_product_accessory_relationships VALUES ('135a2766-d635-4b03-ad49-d3faf8722b6a', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '79a60df5-23eb-4e16-9e68-c83fb0b7c1d5', 'recommended', 'Showroom', '2025-08-09 18:25:25.398613');
INSERT INTO public.master_product_accessory_relationships VALUES ('4715267f-ddb6-450e-8856-b60f3b62e0c2', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '314f96ce-beb1-42ca-a409-3d66bfc7f6e6', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:25.469046');
INSERT INTO public.master_product_accessory_relationships VALUES ('7ae3a881-6b37-4697-ad3d-bd17958aaa79', '370e8277-23a0-4069-9ef7-7e5647a32d7b', '742e7908-bcd1-44d2-95e3-cfb5b8c1b97d', 'compatible', 'Equipment', '2025-08-09 18:25:25.524035');
INSERT INTO public.master_product_accessory_relationships VALUES ('c47c1c91-c105-4ee0-9403-60cc9961ef34', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '9e8bf1d6-5c0d-4691-9ba0-c081aa102dee', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:25.541095');
INSERT INTO public.master_product_accessory_relationships VALUES ('02ee1546-5c7d-47a7-bfc1-7ae2af73f2da', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '7073dd2a-36a8-40d9-a73a-9a4c839500d8', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:25.614395');
INSERT INTO public.master_product_accessory_relationships VALUES ('8481f12e-5dac-472d-988f-76ab38b659b0', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '6e8bac45-52d0-4944-9042-85062f681fc8', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:25.68777');
INSERT INTO public.master_product_accessory_relationships VALUES ('8fc52649-40e4-45f8-905b-74485b13b372', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '9b76638e-eb27-42e2-81ad-e2e51baf34b4', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:25.758392');
INSERT INTO public.master_product_accessory_relationships VALUES ('56013634-ff77-4543-9ab4-57ce08a90c2f', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'adafe072-98f2-4399-b9ee-e87a2ce776fd', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:25.830113');
INSERT INTO public.master_product_accessory_relationships VALUES ('66d4f772-9639-41bb-b02c-6421b30fc19c', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'fd39d993-d69d-4ee5-aae2-57b641646c62', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:25.898341');
INSERT INTO public.master_product_accessory_relationships VALUES ('4918004a-4a2b-4a12-af6c-568eb6189096', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'c743b808-7db3-4243-bb5f-47fcd81b6b74', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:25.967497');
INSERT INTO public.master_product_accessory_relationships VALUES ('ef204e77-3810-4030-b649-001cee38f5cc', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'ae544bf7-2293-4f42-927a-e7646f44abd9', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.038105');
INSERT INTO public.master_product_accessory_relationships VALUES ('776a765c-a4e6-44e3-9307-fecf981925ee', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '74256285-889c-4d3e-9b0f-7a3cf381fbfc', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.107731');
INSERT INTO public.master_product_accessory_relationships VALUES ('9c7ce7b5-09ed-4d17-b7f5-7448371d6741', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '042e1ee4-af6d-49ac-a188-7f61659184ce', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.176957');
INSERT INTO public.master_product_accessory_relationships VALUES ('c80a74a9-ea48-430d-a087-aad94ef2dcce', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '0f60d5fd-e94b-468b-9994-9c0c3c1940cd', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.246522');
INSERT INTO public.master_product_accessory_relationships VALUES ('5098451f-5339-4cfb-bddd-881ca5a13850', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '5cd9e935-7f3a-4508-a49c-75b73088b2f4', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.318486');
INSERT INTO public.master_product_accessory_relationships VALUES ('d413f9e4-2481-43ad-987e-e3c835ad3f26', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '27526432-a52a-4f28-ae94-8afb5a348fdf', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.389255');
INSERT INTO public.master_product_accessory_relationships VALUES ('59128fcc-6fab-4782-96ac-279cc027240e', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '53015869-c43d-4c73-80d5-c1cac2ed4d3f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.46057');
INSERT INTO public.master_product_accessory_relationships VALUES ('15434441-fb71-40b0-a895-5b305eb4d0c9', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'ef13c803-a88a-43eb-b3ff-6d8098c68e26', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.531701');
INSERT INTO public.master_product_accessory_relationships VALUES ('b73e5da8-10e2-4b32-b413-e91fbdae8ef9', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '7358d5ea-6690-4f3a-b652-aded58805b8f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.603338');
INSERT INTO public.master_product_accessory_relationships VALUES ('5d7365c7-2ae9-439e-aa32-1c8f35940949', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '802d3ea2-9b40-48f3-9844-4e8b77c73dde', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.67351');
INSERT INTO public.master_product_accessory_relationships VALUES ('130bab06-63b6-4cb7-afe9-b6cc6e275755', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '771c35c7-7a7a-4abb-8281-691c533f3978', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.743394');
INSERT INTO public.master_product_accessory_relationships VALUES ('78822fed-8b4e-4d96-90d8-f817ecf5bd42', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '72e6e443-9556-4e5d-be2f-3f88643bc212', 'compatible', 'Accessories', '2025-08-09 18:25:26.812504');
INSERT INTO public.master_product_accessory_relationships VALUES ('1ef806b1-bc16-4968-b428-886fed58b99c', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'eedfe2f6-d22a-40fb-ab7d-53914287787a', 'recommended', 'Showroom', '2025-08-09 18:25:27.626499');
INSERT INTO public.master_product_accessory_relationships VALUES ('a1918887-052f-451a-8cbb-d95a7623f015', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'caf449df-8d04-4f7b-9f4d-f76857e44ec7', 'recommended', 'Showroom', '2025-08-09 18:25:27.696816');
INSERT INTO public.master_product_accessory_relationships VALUES ('7bde85af-b0e6-48b0-954c-d2a1945eb969', '476ddceb-5e67-4f40-980d-9361ba382cc0', '9f2e675f-5af0-4a2b-b5aa-df94d4e19b09', 'recommended', 'Showroom', '2025-08-09 18:25:27.770003');
INSERT INTO public.master_product_accessory_relationships VALUES ('b6022e80-a662-4f01-ba3f-38ec0cdeeb00', '476ddceb-5e67-4f40-980d-9361ba382cc0', '99bc73b2-df15-4b34-a91f-25bd9c11fb7d', 'recommended', 'Showroom', '2025-08-09 18:25:27.840664');
INSERT INTO public.master_product_accessory_relationships VALUES ('6d7d62d5-2659-42e5-aed4-acc5839d2cf5', '476ddceb-5e67-4f40-980d-9361ba382cc0', '5b34c956-82a7-4ed4-92c3-9a45bcf073bf', 'recommended', 'Showroom', '2025-08-09 18:25:27.911742');
INSERT INTO public.master_product_accessory_relationships VALUES ('0484a463-1d16-4184-841d-68670e6aa0a6', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'fade048c-2380-412a-bff9-fb9fc61274d9', 'recommended', 'Showroom', '2025-08-09 18:25:27.981872');
INSERT INTO public.master_product_accessory_relationships VALUES ('7fcd0180-50de-4187-ac10-6f95595072ab', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'd1a5193c-6211-4447-8bad-2f39ddd897d6', 'recommended', 'Showroom', '2025-08-09 18:25:28.052441');
INSERT INTO public.master_product_accessory_relationships VALUES ('cc4f61d4-7790-4cf6-9a87-c85bbe810852', 'd10c773b-2953-4e77-add5-ff998ff9b616', '2ec356c4-e8e6-4271-9ba9-4828ac205a77', 'compatible', 'Equipment', '2025-08-09 18:25:28.831873');
INSERT INTO public.master_product_accessory_relationships VALUES ('c9945840-da06-4770-9b02-062555ba7f4e', 'd10c773b-2953-4e77-add5-ff998ff9b616', '9c69404a-d90c-432c-9dc6-202128f739d2', 'recommended', 'Showroom', '2025-08-09 18:25:28.902569');
INSERT INTO public.master_product_accessory_relationships VALUES ('73fae1a1-0cf5-4e78-803d-6326e596f569', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'dd11ee3c-6b84-457f-896d-d6ed5ad9197d', 'recommended', 'Showroom', '2025-08-09 18:25:28.971533');
INSERT INTO public.master_product_accessory_relationships VALUES ('feeaa1e9-db5a-4922-a4b4-319120787413', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'f0e973b8-c0a9-4ff8-b372-67d10cacfa99', 'recommended', 'Showroom', '2025-08-09 18:25:29.041766');
INSERT INTO public.master_product_accessory_relationships VALUES ('0e2fce96-0760-4ca4-b273-957926f30e4e', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'e46a264e-eba2-4800-b25f-96704e3722ce', 'recommended', 'Showroom', '2025-08-09 18:25:29.114084');
INSERT INTO public.master_product_accessory_relationships VALUES ('ab615ec9-f840-4f80-a257-6baef2d5f664', 'd10c773b-2953-4e77-add5-ff998ff9b616', '56565d58-2938-44b3-a24f-bb54d9bf3ad1', 'recommended', 'Showroom', '2025-08-09 18:25:29.184826');
INSERT INTO public.master_product_accessory_relationships VALUES ('e7c5bba2-99ef-4e94-8ca3-151b4a657913', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'a580f488-7784-4f54-8705-e14bbefafb26', 'recommended', 'Showroom', '2025-08-09 18:25:29.256077');
INSERT INTO public.master_product_accessory_relationships VALUES ('eda50ae7-943d-42d1-bf87-18c805524b1b', 'd10c773b-2953-4e77-add5-ff998ff9b616', '68f525e4-e5b3-4847-a2b7-f07900effed3', 'recommended', 'Showroom', '2025-08-09 18:25:29.326177');
INSERT INTO public.master_product_accessory_relationships VALUES ('42134f0a-104a-4a18-8bbf-94bdc8d1091b', 'd10c773b-2953-4e77-add5-ff998ff9b616', '17b11bb3-cbe0-488e-9a94-0e7564a939dd', 'recommended', 'Showroom', '2025-08-09 18:25:29.396761');
INSERT INTO public.master_product_accessory_relationships VALUES ('f4c5b301-ba03-4bfd-a764-5fa47f46ec1d', 'd10c773b-2953-4e77-add5-ff998ff9b616', '6563082c-daf1-4485-a357-0079a9fd65ac', 'recommended', 'Showroom', '2025-08-09 18:25:29.466794');
INSERT INTO public.master_product_accessory_relationships VALUES ('2f03665b-ff90-49f7-a81a-13f3289ae653', 'd10c773b-2953-4e77-add5-ff998ff9b616', '181a5095-908e-47a5-b8a7-7c4bc5bff64c', 'recommended', 'Showroom', '2025-08-09 18:25:29.540134');
INSERT INTO public.master_product_accessory_relationships VALUES ('16726ca8-0bf6-47a7-b400-db3d01137aea', 'd10c773b-2953-4e77-add5-ff998ff9b616', '3e5706db-ab4c-49f2-a0d0-fece0de45a7a', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:29.611884');
INSERT INTO public.master_product_accessory_relationships VALUES ('3dd87fd8-6f58-4916-b66f-75e2d9886cf2', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'b793f4d7-2404-4072-92e3-fb8a41cd579d', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:29.684588');
INSERT INTO public.master_product_accessory_relationships VALUES ('1cffcfed-319d-45a2-aff8-e7df64c2efe2', 'd10c773b-2953-4e77-add5-ff998ff9b616', '07e8bdc2-2923-4f6c-8410-3ceee8fb4e69', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:29.755403');
INSERT INTO public.master_product_accessory_relationships VALUES ('0859b4bf-3094-424d-9c67-f812f77a90dc', 'd10c773b-2953-4e77-add5-ff998ff9b616', '75ee4916-d798-4d82-95a2-621d3f6e8e5c', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:29.826234');
INSERT INTO public.master_product_accessory_relationships VALUES ('6c1847d0-7fc1-4a6b-a2f6-0e95c9bb50bb', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'b7121634-5f79-4fb0-a7de-a033d03dd8ee', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:29.896526');
INSERT INTO public.master_product_accessory_relationships VALUES ('73691125-caf8-4d98-98e4-85e5a980fb62', 'd10c773b-2953-4e77-add5-ff998ff9b616', '0a49ab38-14b4-4243-bd80-54e9a8dfab2f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:29.97');
INSERT INTO public.master_product_accessory_relationships VALUES ('c14f6758-61e3-4e8b-921e-3cdbcc9a1c8c', 'd10c773b-2953-4e77-add5-ff998ff9b616', '05e82c13-c686-477a-9ffe-06a4ab677f62', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:30.041394');
INSERT INTO public.master_product_accessory_relationships VALUES ('a736c67c-cfb2-4b86-b3ed-fb37d96d5b2a', 'd10c773b-2953-4e77-add5-ff998ff9b616', '3c65d88f-e460-4c6b-bab8-7c0ed4fcb366', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:30.11925');
INSERT INTO public.master_product_accessory_relationships VALUES ('fdaf6403-9c67-4931-911b-f5b03b370e7d', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'ab6287f2-b5c4-460f-ba94-8d5b583a2829', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:30.191135');
INSERT INTO public.master_product_accessory_relationships VALUES ('a905bb96-6c3d-4092-a1ad-2eb0e8e18629', 'd10c773b-2953-4e77-add5-ff998ff9b616', '5704a1dd-1d63-4134-b46e-a6cd1fb712c2', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:30.26207');
INSERT INTO public.master_product_accessory_relationships VALUES ('643bbaa2-690c-4a29-a338-69810932cd54', '74ee5bc7-7747-4ce2-8326-c8559ce59b02', '60e4978f-ad7f-40e6-91d1-d55c0da80153', 'compatible', 'Equipment', '2025-08-09 18:25:25.631884');
INSERT INTO public.master_product_accessory_relationships VALUES ('6aad1bd9-856e-498e-9d99-f2edfb7de232', 'f82057d9-dc00-4111-967d-0e4b44634b63', '08539463-3aee-446c-8c63-a399019ab5e7', 'compatible', 'Equipment', '2025-08-09 18:25:25.73889');
INSERT INTO public.master_product_accessory_relationships VALUES ('e6b85485-991b-4a26-9b66-2229c1505c99', 'f82057d9-dc00-4111-967d-0e4b44634b63', '9d78241f-f634-417c-8557-add8ad8078d1', 'compatible', 'Equipment', '2025-08-09 18:25:25.810187');
INSERT INTO public.master_product_accessory_relationships VALUES ('f58ee7a6-1402-44f4-b4ee-c26f06706eee', 'f82057d9-dc00-4111-967d-0e4b44634b63', '9ff32cd5-9fe5-4a55-9e38-5bbec133d23e', 'compatible', 'Equipment', '2025-08-09 18:25:25.87984');
INSERT INTO public.master_product_accessory_relationships VALUES ('0f9bc54c-c5b3-4083-8ef6-c479b77ed16d', '2a160856-58b5-40b9-84df-1cd01889daef', 'aa9065a0-a812-4ce9-a3d3-6f9f2bb10c65', 'compatible', 'Equipment', '2025-08-09 18:25:26.057185');
INSERT INTO public.master_product_accessory_relationships VALUES ('a9e0609c-9265-4585-b65a-07305b58760c', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', 'f5c57415-b1f9-4241-98f5-d6894ce7a6f3', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.619672');
INSERT INTO public.master_product_accessory_relationships VALUES ('6574dbb9-e7de-476b-bbbd-d98941398e62', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '061b26a8-9805-41c1-baaa-b282ad28a54c', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.704004');
INSERT INTO public.master_product_accessory_relationships VALUES ('c2ab7b26-c3b7-4efc-ab60-09683bf4c5a6', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', 'f583ab93-eee5-4a21-a8ed-06c3baaf4d8e', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.775279');
INSERT INTO public.master_product_accessory_relationships VALUES ('a3bc411e-34b0-43b6-8e3b-080ee959516a', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '1f45419d-0045-42eb-a880-3480b0ccbaef', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.846083');
INSERT INTO public.master_product_accessory_relationships VALUES ('bff91492-9ba0-4d9c-a339-88a59acac8f7', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '1bcb3d79-b245-4d19-962c-eac9109fa845', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:26.916742');
INSERT INTO public.master_product_accessory_relationships VALUES ('571a9c80-7939-4dad-9501-ee0a5238bc28', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '730775db-0292-40de-8195-c702808e0a0e', 'compatible', 'Accessories', '2025-08-09 18:25:26.988288');
INSERT INTO public.master_product_accessory_relationships VALUES ('522e7bc9-1dc8-4918-9c9b-de9d0d5da3fa', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '00ee2945-7ef4-42c8-a06d-5b89bfef19d9', 'compatible', 'Accessories', '2025-08-09 18:25:27.057762');
INSERT INTO public.master_product_accessory_relationships VALUES ('15972d5f-36b9-4f94-a130-fe848f2148ce', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '6a41caa7-ddf9-4bda-aa6a-1b3e8230de4c', 'recommended', 'Showroom', '2025-08-09 18:25:27.48836');
INSERT INTO public.master_product_accessory_relationships VALUES ('e38369f6-d0ac-43af-a705-f48e9eda8cd3', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd5701906-45a7-45fa-9f9f-cae38722f6d8', 'recommended', 'Showroom', '2025-08-09 18:25:27.55876');
INSERT INTO public.master_product_accessory_relationships VALUES ('5c6946f1-531c-4bf8-9cd3-a536b22b9051', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '90de8e54-7054-4a94-bbd5-b6f6170b7991', 'recommended', 'Showroom', '2025-08-09 18:25:27.628442');
INSERT INTO public.master_product_accessory_relationships VALUES ('3710e741-cbc7-4ca9-9fd3-38fcb2f356f5', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '0aaec45b-9b9c-463c-ad90-d810508d2df3', 'recommended', 'Showroom', '2025-08-09 18:25:27.698975');
INSERT INTO public.master_product_accessory_relationships VALUES ('e3c4e7f0-780b-4444-9a41-4665bde2319f', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '5b446d53-6444-4a97-ba85-f3b729b2715d', 'recommended', 'Showroom', '2025-08-09 18:25:27.768602');
INSERT INTO public.master_product_accessory_relationships VALUES ('e4bfe858-2992-4383-a838-e39db7ed647d', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '7631625d-fc5f-4561-91d6-40ae3fd74903', 'recommended', 'Showroom', '2025-08-09 18:25:27.839686');
INSERT INTO public.master_product_accessory_relationships VALUES ('a378c233-c09e-4ad0-9201-5a5f6e67987d', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '908df156-b1b0-4ac4-95ca-9178e1f3ce79', 'recommended', 'Showroom', '2025-08-09 18:25:27.910653');
INSERT INTO public.master_product_accessory_relationships VALUES ('f6345398-fb5c-4013-8383-315824c542e5', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'fd2baa26-e4c3-4926-99df-d968d507b077', 'recommended', 'Showroom', '2025-08-09 18:25:27.980023');
INSERT INTO public.master_product_accessory_relationships VALUES ('af189330-1edd-4c7f-a454-a65aa26ad34e', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd6fcad84-5906-4003-a9e3-612a7aac1c6d', 'recommended', 'Showroom', '2025-08-09 18:25:28.052404');
INSERT INTO public.master_product_accessory_relationships VALUES ('d0edc277-a671-4337-8d78-40df309756db', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'ae31c3a9-ea53-4093-ae6e-68209813bd42', 'recommended', 'Showroom', '2025-08-09 18:25:28.122408');
INSERT INTO public.master_product_accessory_relationships VALUES ('0a100514-eee9-4c25-9485-dfe40d862b55', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '136094b9-af44-42fb-906a-f9706fddd8ba', 'recommended', 'Showroom', '2025-08-09 18:25:28.196851');
INSERT INTO public.master_product_accessory_relationships VALUES ('07eaa55e-f106-44fd-af4b-8dd07aa19df6', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '24ee7f8f-8b3a-40e3-b867-b03b240467e6', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:28.26677');
INSERT INTO public.master_product_accessory_relationships VALUES ('53628ae1-9ce7-4b19-a80e-fedc8a98c26d', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd27f9ab6-ed99-408a-bb1c-bbedcd217ffc', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:28.33675');
INSERT INTO public.master_product_accessory_relationships VALUES ('cda42760-6e25-4574-818d-9d5924478dbf', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'de4cf67e-130f-4484-8bb0-98b5112a1f99', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:28.405917');
INSERT INTO public.master_product_accessory_relationships VALUES ('149eb346-7818-478f-b942-70fe253df3d9', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '34ad9f04-91a0-4671-9ad5-f905684be072', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:28.475674');
INSERT INTO public.master_product_accessory_relationships VALUES ('e769902b-b99b-4700-bcf2-e230d188af4d', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '38c71509-f98f-47c2-a588-1758ae90005f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:28.54646');
INSERT INTO public.master_product_accessory_relationships VALUES ('9ef318ea-3e17-4186-8e30-eb6784477548', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '096f024c-fa13-4be9-9243-70848c24494f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:28.617621');
INSERT INTO public.master_product_accessory_relationships VALUES ('e9dc81c0-177c-4e0f-90f7-9aae74234064', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '2fe11940-7395-466e-a8f9-47ae7613adb5', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:28.688689');
INSERT INTO public.master_product_accessory_relationships VALUES ('de7a774f-5bd4-4d83-b7a8-48e3ca464f49', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '4626ee43-1b8b-4c72-88ed-b4baa6237572', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:28.759296');
INSERT INTO public.master_product_accessory_relationships VALUES ('0baa07ae-c25d-41e9-a202-faf2ef1c899c', 'decab237-219e-48ad-a976-7c681632af60', '8b3f422d-2170-4d5d-8fb5-c63d7a3ae249', 'recommended', 'Showroom', '2025-08-09 18:25:29.080038');
INSERT INTO public.master_product_accessory_relationships VALUES ('dd092e59-51f3-4117-8f56-50c64c9b80cd', 'decab237-219e-48ad-a976-7c681632af60', 'ba02c38e-fee2-4773-a042-c8feb72c8beb', 'recommended', 'Showroom', '2025-08-09 18:25:29.151879');
INSERT INTO public.master_product_accessory_relationships VALUES ('4a33df3f-67dd-4127-ad5a-0fdb5a33af6e', 'decab237-219e-48ad-a976-7c681632af60', '2f61714e-7f03-4ff4-8fa9-cdcc90f365e8', 'recommended', 'Showroom', '2025-08-09 18:25:29.222029');
INSERT INTO public.master_product_accessory_relationships VALUES ('3c8a6915-08b4-4631-8843-f0994c3773f8', 'decab237-219e-48ad-a976-7c681632af60', '687c3bee-f848-4e00-95b4-73ad4ec2fddc', 'recommended', 'Showroom', '2025-08-09 18:25:29.294769');
INSERT INTO public.master_product_accessory_relationships VALUES ('fd9b8233-b570-4adc-9bd3-b69f6a568605', 'decab237-219e-48ad-a976-7c681632af60', '402210a1-f056-4a08-99bb-b91a4aca18cf', 'recommended', 'Showroom', '2025-08-09 18:25:29.362396');
INSERT INTO public.master_product_accessory_relationships VALUES ('86285b3f-5676-4595-be21-99e89eac5417', '7f72c046-52f0-4186-be27-4953a0ec50c7', '8806f115-e4da-45ef-a56c-0934da7b50e9', 'recommended', 'Showroom', '2025-08-09 18:25:29.791563');
INSERT INTO public.master_product_accessory_relationships VALUES ('ddd68f8a-3d70-459e-97b3-b8c68b574cff', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'e001643a-5f92-4950-b845-ee1ed7f4948f', 'recommended', 'Showroom', '2025-08-09 18:25:29.861945');
INSERT INTO public.master_product_accessory_relationships VALUES ('40e74346-2f4d-46fc-9cde-4ea2b9cf6003', '7f72c046-52f0-4186-be27-4953a0ec50c7', '8148eac8-902c-4069-8c1a-33e7108f5e95', 'recommended', 'Showroom', '2025-08-09 18:25:29.932019');
INSERT INTO public.master_product_accessory_relationships VALUES ('775c3f47-6920-4f21-955a-2d7b4682597b', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'cc0b55d9-4c5f-40eb-bda5-9342d938cea3', 'recommended', 'Showroom', '2025-08-09 18:25:30.003255');
INSERT INTO public.master_product_accessory_relationships VALUES ('d4f36098-9b78-4392-ab57-70dd5fbdf368', '7f72c046-52f0-4186-be27-4953a0ec50c7', '408113a6-5075-4ca3-b2ae-ee9f4c6cb472', 'recommended', 'Showroom', '2025-08-09 18:25:30.072498');
INSERT INTO public.master_product_accessory_relationships VALUES ('ca299fd3-578d-48da-8fa5-b858ca3bd87a', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'b44488f3-72a3-4f8d-b1c1-a45665a6e9c5', 'recommended', 'Showroom', '2025-08-09 18:25:30.144313');
INSERT INTO public.master_product_accessory_relationships VALUES ('021d4aeb-5af6-40d3-b5c2-bd17c886ba70', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'c95d4cb3-a0b6-43ca-9ee1-a154b4b5d546', 'recommended', 'Showroom', '2025-08-09 18:25:30.214292');
INSERT INTO public.master_product_accessory_relationships VALUES ('3405135d-a5e2-4890-93ae-b2220ca5e602', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'b3752fef-d901-4ec4-939e-11f19b8c186d', 'recommended', 'Showroom', '2025-08-09 18:25:30.284076');
INSERT INTO public.master_product_accessory_relationships VALUES ('c81b5b8a-f781-44ec-862d-df284120285b', '7f72c046-52f0-4186-be27-4953a0ec50c7', '01d985c3-fa28-410a-bb57-cab706e5e044', 'recommended', 'Showroom', '2025-08-09 18:25:30.353933');
INSERT INTO public.master_product_accessory_relationships VALUES ('8ba9f3dc-2f58-4cfb-9aa6-2e9d35607282', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'edccfc66-6c8f-4491-8fd0-7ed15dcf5c64', 'recommended', 'Showroom', '2025-08-09 18:25:30.423827');
INSERT INTO public.master_product_accessory_relationships VALUES ('adeb927d-d717-4066-ac73-380ade869fd9', 'd10c773b-2953-4e77-add5-ff998ff9b616', '5a409136-d4e5-4c70-8244-931b45c3a451', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:30.334372');
INSERT INTO public.master_product_accessory_relationships VALUES ('289f4433-3881-431e-adbd-ebc0d018d5db', 'd10c773b-2953-4e77-add5-ff998ff9b616', '0e896f74-267d-422a-bb13-632993b6705e', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:30.405465');
INSERT INTO public.master_product_accessory_relationships VALUES ('68619cf0-da4c-4e07-9fcb-86b09c511598', 'd10c773b-2953-4e77-add5-ff998ff9b616', '7f4aae94-6626-4627-b44f-6c61b4ad988f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:30.476816');
INSERT INTO public.master_product_accessory_relationships VALUES ('1413f40c-52cc-4084-8a6b-0c9167932802', 'd10c773b-2953-4e77-add5-ff998ff9b616', '741641ba-4a77-43a9-9e2b-e65faa1a2c04', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:30.548945');
INSERT INTO public.master_product_accessory_relationships VALUES ('5378cf77-5e6d-4376-9565-9a8347bc9c03', '2f2fa512-141b-4a26-981b-898464106523', '5cdbbcda-dc4c-4be6-b0d3-75d94156cf96', 'compatible', 'Equipment', '2025-08-09 18:25:31.54757');
INSERT INTO public.master_product_accessory_relationships VALUES ('9cb442e4-9756-4397-b803-475f668dfcc8', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'd4dd7a57-092b-4d49-81f7-23a769659078', 'compatible', 'Equipment', '2025-08-09 18:25:31.755857');
INSERT INTO public.master_product_accessory_relationships VALUES ('3422ee17-f436-463e-8bdf-534e186bc6e9', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '527d8b0f-a458-49d7-b60f-eec210d13f2c', 'compatible', 'Equipment', '2025-08-09 18:25:31.826459');
INSERT INTO public.master_product_accessory_relationships VALUES ('3b325760-7953-412e-ba0d-8411bb042165', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '6bf0e9d2-67f4-4fd1-8277-114d34687474', 'recommended', 'Showroom', '2025-08-09 18:25:31.897784');
INSERT INTO public.master_product_accessory_relationships VALUES ('94ede369-6fe8-4aed-8d29-4f49eb1a543f', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'd5be770b-e8bb-43dc-95eb-dda07244b051', 'recommended', 'Showroom', '2025-08-09 18:25:31.968785');
INSERT INTO public.master_product_accessory_relationships VALUES ('b3a10c56-445d-4c9c-8d8d-28e441aff65b', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '01962030-03d3-4b56-95d8-3cbcab554fdf', 'recommended', 'Showroom', '2025-08-09 18:25:32.03857');
INSERT INTO public.master_product_accessory_relationships VALUES ('72098ce4-0086-4c18-8c39-7941da873116', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '136b36ab-283c-424d-9bd2-8450dd66bdbf', 'recommended', 'Showroom', '2025-08-09 18:25:32.109656');
INSERT INTO public.master_product_accessory_relationships VALUES ('cc88389c-c2c5-4e1c-a3f4-60c0ceab5848', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'a75b9e20-77c3-46a9-8431-39d14b1c62d3', 'recommended', 'Showroom', '2025-08-09 18:25:32.179427');
INSERT INTO public.master_product_accessory_relationships VALUES ('716727c6-ee2d-41a7-b9d4-23cd299ce793', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'ecea59e4-3001-43e8-a8a3-42838a82bf11', 'recommended', 'Showroom', '2025-08-09 18:25:32.289316');
INSERT INTO public.master_product_accessory_relationships VALUES ('d52c925e-29bf-40e6-96c4-e4a09c3353c5', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '0dccb954-ebec-489a-b1d5-6d8907298f4d', 'recommended', 'Showroom', '2025-08-09 18:25:32.361841');
INSERT INTO public.master_product_accessory_relationships VALUES ('7a9beaab-2b7c-4a59-8652-d8fa6985548d', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'f16f37e1-b6b3-43e1-8d83-838d13eaa0e7', 'recommended', 'Showroom', '2025-08-09 18:25:32.429362');
INSERT INTO public.master_product_accessory_relationships VALUES ('97e7c85b-f9aa-400c-95dc-eb72013b7faa', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '5c50560c-37a7-4cc7-8ca7-be31af52aa73', 'recommended', 'Showroom', '2025-08-09 18:25:35.012237');
INSERT INTO public.master_product_accessory_relationships VALUES ('3e68651d-0dce-42f3-b77b-e73ccad13ee4', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '8d2be6ff-0640-42be-8034-5d017245c261', 'recommended', 'Showroom', '2025-08-09 18:25:35.081375');
INSERT INTO public.master_product_accessory_relationships VALUES ('235b789d-330b-4c8e-87ce-babe3e3298a2', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '3ca2f6d1-30a5-4e39-b0cb-e5f3a9210299', 'recommended', 'Showroom', '2025-08-09 18:25:35.152624');
INSERT INTO public.master_product_accessory_relationships VALUES ('bb2ce6a6-6d00-455e-a7cb-6a0c5b698ae3', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '72f41010-9dc9-43f3-b34c-53f0683760a2', 'recommended', 'Showroom', '2025-08-09 18:25:35.220565');
INSERT INTO public.master_product_accessory_relationships VALUES ('e8ea788d-4871-4da6-af02-69425af6e983', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', 'a46e1cb1-3eee-4a99-b880-ee40b468c5c2', 'recommended', 'Showroom', '2025-08-09 18:25:35.290074');
INSERT INTO public.master_product_accessory_relationships VALUES ('be36ae33-1208-4a06-a76f-42b57e20d68d', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '1e125f56-bc58-4a73-b64e-d8d10a3c8f07', 'recommended', 'Showroom', '2025-08-09 18:25:35.359361');
INSERT INTO public.master_product_accessory_relationships VALUES ('524bd7d4-dc1e-43b0-a8e3-8af122f0ea84', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', 'e685155b-c3b0-43f0-8866-a8317260c391', 'recommended', 'Showroom', '2025-08-09 18:25:35.429249');
INSERT INTO public.master_product_accessory_relationships VALUES ('f8d0ecdc-a760-4014-a2c7-cf835516178a', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '08f5c9e9-1375-45b2-b8f5-3d0263efc971', 'recommended', 'Showroom', '2025-08-09 18:25:35.504664');
INSERT INTO public.master_product_accessory_relationships VALUES ('8ad76c90-7997-48a7-a625-5f92552606a0', '6246c7a2-f6dd-482b-a3b3-b185d00a0e94', 'be626b0f-1b83-45db-a24b-ad85fbb1b1ed', 'recommended', 'Showroom', '2025-08-09 18:25:36.695446');
INSERT INTO public.master_product_accessory_relationships VALUES ('c694738c-a718-4c2e-9662-62962071f639', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'e7a1c8fb-bb42-40d1-8963-a8c5318b8f7d', 'recommended', 'Showroom', '2025-08-09 18:25:30.495623');
INSERT INTO public.master_product_accessory_relationships VALUES ('24318f0e-7627-4e43-a104-9db18f142a14', '7f72c046-52f0-4186-be27-4953a0ec50c7', '9d7b288b-4a79-431c-9015-68124f434e0f', 'recommended', 'Showroom', '2025-08-09 18:25:30.567868');
INSERT INTO public.master_product_accessory_relationships VALUES ('b38a462a-6a69-42f2-937c-385e3900c268', '7f72c046-52f0-4186-be27-4953a0ec50c7', '4630e11a-6695-4413-8dcb-1929538f2eb9', 'recommended', 'Showroom', '2025-08-09 18:25:30.637363');
INSERT INTO public.master_product_accessory_relationships VALUES ('16ddfe1c-8510-4c4d-8101-db8af6bf3756', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '4d0aa140-b4ba-4d4d-8e8b-5dde6571887e', 'recommended', 'Showroom', '2025-08-09 18:25:30.868314');
INSERT INTO public.master_product_accessory_relationships VALUES ('0d8e0d75-f2f5-4add-8d21-d318b54b1ad4', 'ceb271c9-f68a-4ff3-836d-92c656a18721', 'e4c2bd4c-a81f-4e44-887a-233d6d6c0d9a', 'recommended', 'Showroom', '2025-08-09 18:25:30.923569');
INSERT INTO public.master_product_accessory_relationships VALUES ('7a0ae0fb-635a-4e08-b80a-ef9bcb4a05c6', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'cb867c4f-3df0-4eb2-ae23-c6b628deaf32', 'recommended', 'Showroom', '2025-08-09 18:25:30.932193');
INSERT INTO public.master_product_accessory_relationships VALUES ('efc79c5a-4ab5-4ba7-aeae-aebd18da8274', 'ceb271c9-f68a-4ff3-836d-92c656a18721', '269c96c1-c683-4ef0-9539-0f21733040a7', 'recommended', 'Showroom', '2025-08-09 18:25:30.993244');
INSERT INTO public.master_product_accessory_relationships VALUES ('73d96c03-e38c-4746-b0a3-ef5609ae95e5', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'b035d0d7-f993-4a1d-a31b-28f2630b5c12', 'recommended', 'Showroom', '2025-08-09 18:25:30.99603');
INSERT INTO public.master_product_accessory_relationships VALUES ('cd3e0a0d-fe6f-456b-8573-5740bd441f8b', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '48cb2b0b-a980-475a-a6cd-355fff8aaff9', 'recommended', 'Showroom', '2025-08-09 18:25:31.061829');
INSERT INTO public.master_product_accessory_relationships VALUES ('7b796f4f-aafc-4143-890e-32d38f92f5df', 'ceb271c9-f68a-4ff3-836d-92c656a18721', '48523e9f-58b0-4b90-a190-fc457b63caf4', 'recommended', 'Showroom', '2025-08-09 18:25:31.064528');
INSERT INTO public.master_product_accessory_relationships VALUES ('97772353-16e0-4378-8547-f6ed98df93c0', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '79a60df5-23eb-4e16-9e68-c83fb0b7c1d5', 'recommended', 'Showroom', '2025-08-09 18:25:31.12734');
INSERT INTO public.master_product_accessory_relationships VALUES ('09e06a3d-a609-465e-9b11-ef1fe5793a83', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '314f96ce-beb1-42ca-a409-3d66bfc7f6e6', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:31.191947');
INSERT INTO public.master_product_accessory_relationships VALUES ('9978960e-3acc-479c-b7af-6261599aea5a', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '9e8bf1d6-5c0d-4691-9ba0-c081aa102dee', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:31.255915');
INSERT INTO public.master_product_accessory_relationships VALUES ('e0d285a1-6288-48e7-8804-673a720d59ce', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '7073dd2a-36a8-40d9-a73a-9a4c839500d8', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:31.322347');
INSERT INTO public.master_product_accessory_relationships VALUES ('0520a519-92da-4c25-8175-4785de396787', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', 'dc1da90a-9806-4c41-8ebc-fd06a90a0f7b', 'recommended', 'Showroom', '2025-08-09 18:25:31.352335');
INSERT INTO public.master_product_accessory_relationships VALUES ('2e164b10-e197-415d-8f5c-3868dcef2f7e', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '6e8bac45-52d0-4944-9042-85062f681fc8', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:31.387444');
INSERT INTO public.master_product_accessory_relationships VALUES ('d4a7546b-7a3b-4fdc-b4bf-aa6d1ce92862', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', 'ff919574-bdc8-42ad-95ff-e35d060befd8', 'recommended', 'Showroom', '2025-08-09 18:25:31.425837');
INSERT INTO public.master_product_accessory_relationships VALUES ('b2f1f54a-4b20-4234-a283-2394cb8ce467', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '9b76638e-eb27-42e2-81ad-e2e51baf34b4', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:31.46036');
INSERT INTO public.master_product_accessory_relationships VALUES ('28bf7e12-c253-4ebf-bb09-3c1a327ea293', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', '5e43b879-afe7-4b2d-bb75-9f0763c1adc7', 'recommended', 'Showroom', '2025-08-09 18:25:31.494797');
INSERT INTO public.master_product_accessory_relationships VALUES ('cbde6b8d-4954-461c-b500-1e99aa3d33ca', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'adafe072-98f2-4399-b9ee-e87a2ce776fd', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:31.525337');
INSERT INTO public.master_product_accessory_relationships VALUES ('e1779935-f0b6-455b-a56e-434c237166a9', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'fd39d993-d69d-4ee5-aae2-57b641646c62', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:31.589869');
INSERT INTO public.master_product_accessory_relationships VALUES ('709609f8-f4fa-41cd-9c76-4aed9843f3de', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'c743b808-7db3-4243-bb5f-47fcd81b6b74', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:31.653811');
INSERT INTO public.master_product_accessory_relationships VALUES ('64ecc1d3-b41e-4214-b78c-92a4f7fc537d', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'ae544bf7-2293-4f42-927a-e7646f44abd9', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:31.718982');
INSERT INTO public.master_product_accessory_relationships VALUES ('31a4d3af-5dba-4b50-9b29-f4a8c2f92cc2', '05d71a06-b531-4206-95b5-eba537ffe01a', '12ed7741-71a7-4ddf-98db-02abaf05c804', 'compatible', 'Equipment', '2025-08-09 18:25:31.778434');
INSERT INTO public.master_product_accessory_relationships VALUES ('f10c7fab-5c4d-41e3-bca8-b9b989e081fe', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '74256285-889c-4d3e-9b0f-7a3cf381fbfc', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:31.784148');
INSERT INTO public.master_product_accessory_relationships VALUES ('d65eb5bf-92b2-4445-8fa5-f0a41c1120c1', '05d71a06-b531-4206-95b5-eba537ffe01a', '35e8a8e2-63cc-4f85-a6a1-067ee09c836c', 'compatible', 'Equipment', '2025-08-09 18:25:31.847497');
INSERT INTO public.master_product_accessory_relationships VALUES ('89fc97d3-4a08-4251-ab97-cbc01cd77272', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '042e1ee4-af6d-49ac-a188-7f61659184ce', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:31.848603');
INSERT INTO public.master_product_accessory_relationships VALUES ('1705d0f9-31ea-4cf0-9cb0-18e7f397b293', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '0f60d5fd-e94b-468b-9994-9c0c3c1940cd', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:31.913027');
INSERT INTO public.master_product_accessory_relationships VALUES ('dde718b2-cfcd-4ee4-8ac3-68dea57d200a', '05d71a06-b531-4206-95b5-eba537ffe01a', '55036761-c149-43d4-8857-04b42e0ce05e', 'recommended', 'Showroom', '2025-08-09 18:25:31.917386');
INSERT INTO public.master_product_accessory_relationships VALUES ('750f268a-daed-4ffc-b03e-2ebf2c3310fb', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '5cd9e935-7f3a-4508-a49c-75b73088b2f4', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:31.977583');
INSERT INTO public.master_product_accessory_relationships VALUES ('6e9e57cc-3461-430e-98d4-99bb79a5bb63', '05d71a06-b531-4206-95b5-eba537ffe01a', '231ff99d-756d-4092-9619-0644545bd319', 'recommended', 'Showroom', '2025-08-09 18:25:31.987384');
INSERT INTO public.master_product_accessory_relationships VALUES ('43257265-f935-4419-9d01-c847539bc11c', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '27526432-a52a-4f28-ae94-8afb5a348fdf', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:32.04095');
INSERT INTO public.master_product_accessory_relationships VALUES ('b701aa64-5666-420c-8d1d-6e63d3a18ded', '05d71a06-b531-4206-95b5-eba537ffe01a', '76cdbc89-330c-45f6-949f-4600c63487c7', 'recommended', 'Showroom', '2025-08-09 18:25:32.059021');
INSERT INTO public.master_product_accessory_relationships VALUES ('d74a9919-8aa2-4b46-816f-59e936be7bee', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '53015869-c43d-4c73-80d5-c1cac2ed4d3f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:32.1049');
INSERT INTO public.master_product_accessory_relationships VALUES ('96272ccc-e9ad-4403-81ef-dfe79526c250', '05d71a06-b531-4206-95b5-eba537ffe01a', '376cf9d0-2a66-4c34-b716-9336a6ff60d6', 'recommended', 'Showroom', '2025-08-09 18:25:32.130007');
INSERT INTO public.master_product_accessory_relationships VALUES ('dc334e66-8868-4e24-879b-c58196173ad7', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'ef13c803-a88a-43eb-b3ff-6d8098c68e26', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:32.170128');
INSERT INTO public.master_product_accessory_relationships VALUES ('c9ae1584-3f2c-46d0-9776-a466aedddb92', '05d71a06-b531-4206-95b5-eba537ffe01a', '04123c52-dd05-495c-a978-5a2284ddaea5', 'recommended', 'Showroom', '2025-08-09 18:25:32.20126');
INSERT INTO public.master_product_accessory_relationships VALUES ('afac7e41-201e-43e8-ade3-4d2b6272a497', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '7358d5ea-6690-4f3a-b652-aded58805b8f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:32.237807');
INSERT INTO public.master_product_accessory_relationships VALUES ('a8ffd438-d28e-48c3-ad30-e82f6f9de9ae', '05d71a06-b531-4206-95b5-eba537ffe01a', 'acfec99d-5cf3-4fea-abf4-5635d10609b7', 'recommended', 'Showroom', '2025-08-09 18:25:32.275578');
INSERT INTO public.master_product_accessory_relationships VALUES ('1f8371ab-e6a2-4a83-a05f-8ad04c13648c', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '802d3ea2-9b40-48f3-9844-4e8b77c73dde', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:32.304117');
INSERT INTO public.master_product_accessory_relationships VALUES ('1494c102-51f7-43ec-89ef-acaee0fc020d', '05d71a06-b531-4206-95b5-eba537ffe01a', 'dc84b5c0-dd63-4903-be47-7ddde2bfac92', 'recommended', 'Showroom', '2025-08-09 18:25:32.3453');
INSERT INTO public.master_product_accessory_relationships VALUES ('23245f72-781b-4f70-8b5c-649b90901089', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '771c35c7-7a7a-4abb-8281-691c533f3978', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:32.368223');
INSERT INTO public.master_product_accessory_relationships VALUES ('31bc113b-20e2-436a-9441-3f56231ab0a1', '05d71a06-b531-4206-95b5-eba537ffe01a', '7dc77ff8-29ca-4fc4-a07d-b71034e3b693', 'recommended', 'Showroom', '2025-08-09 18:25:32.415962');
INSERT INTO public.master_product_accessory_relationships VALUES ('d270586e-83b5-438f-9bfd-0899e63912a3', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '72e6e443-9556-4e5d-be2f-3f88643bc212', 'compatible', 'Accessories', '2025-08-09 18:25:32.432173');
INSERT INTO public.master_product_accessory_relationships VALUES ('1b3c3cd6-68f9-4e24-8898-3320aee00c3d', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '4d0aa140-b4ba-4d4d-8e8b-5dde6571887e', 'recommended', 'Showroom', '2025-08-09 18:25:32.544357');
INSERT INTO public.master_product_accessory_relationships VALUES ('f2f05c5d-4e96-4ae4-b3fe-a0ecfdb526c6', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'cb867c4f-3df0-4eb2-ae23-c6b628deaf32', 'recommended', 'Showroom', '2025-08-09 18:25:32.608713');
INSERT INTO public.master_product_accessory_relationships VALUES ('3397b8d0-f226-4d41-9d93-eb14f062109e', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'b035d0d7-f993-4a1d-a31b-28f2630b5c12', 'recommended', 'Showroom', '2025-08-09 18:25:32.674191');
INSERT INTO public.master_product_accessory_relationships VALUES ('53d12258-0298-4f37-be24-a1e7988ede18', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '4d0aa140-b4ba-4d4d-8e8b-5dde6571887e', 'recommended', 'Showroom', '2025-08-09 18:25:32.681085');
INSERT INTO public.master_product_accessory_relationships VALUES ('4bf3bc1c-7184-4011-a265-afcb0904bfaf', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '48cb2b0b-a980-475a-a6cd-355fff8aaff9', 'recommended', 'Showroom', '2025-08-09 18:25:32.738657');
INSERT INTO public.master_product_accessory_relationships VALUES ('6d2a8c9f-b57a-4de0-9475-6bec35b57e7a', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'cb867c4f-3df0-4eb2-ae23-c6b628deaf32', 'recommended', 'Showroom', '2025-08-09 18:25:32.74423');
INSERT INTO public.master_product_accessory_relationships VALUES ('1d744517-91e9-43ca-b17c-237763c9fc70', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '79a60df5-23eb-4e16-9e68-c83fb0b7c1d5', 'recommended', 'Showroom', '2025-08-09 18:25:32.804081');
INSERT INTO public.master_product_accessory_relationships VALUES ('a7b63fa8-584f-4e1a-93bc-a700a3f70732', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'b035d0d7-f993-4a1d-a31b-28f2630b5c12', 'recommended', 'Showroom', '2025-08-09 18:25:32.807723');
INSERT INTO public.master_product_accessory_relationships VALUES ('487eea64-9f89-4973-9339-d5b699f23c16', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '4d0aa140-b4ba-4d4d-8e8b-5dde6571887e', 'recommended', 'Showroom', '2025-08-09 18:25:32.836449');
INSERT INTO public.master_product_accessory_relationships VALUES ('90c795cb-4274-4d78-9d3e-1689508971f0', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '314f96ce-beb1-42ca-a409-3d66bfc7f6e6', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:32.869814');
INSERT INTO public.master_product_accessory_relationships VALUES ('e122f493-8247-4d7c-8ee9-37ef7862cb26', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '48cb2b0b-a980-475a-a6cd-355fff8aaff9', 'recommended', 'Showroom', '2025-08-09 18:25:32.871183');
INSERT INTO public.master_product_accessory_relationships VALUES ('5019edbb-9177-4abd-8333-0d9421759fe2', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'cb867c4f-3df0-4eb2-ae23-c6b628deaf32', 'recommended', 'Showroom', '2025-08-09 18:25:32.90148');
INSERT INTO public.master_product_accessory_relationships VALUES ('631b54c7-f651-42af-a6ff-3b457f9fd141', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '79a60df5-23eb-4e16-9e68-c83fb0b7c1d5', 'recommended', 'Showroom', '2025-08-09 18:25:32.934735');
INSERT INTO public.master_product_accessory_relationships VALUES ('fdb32f39-1d5b-45c9-a8f2-0bf96fa874f4', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '9e8bf1d6-5c0d-4691-9ba0-c081aa102dee', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:32.936393');
INSERT INTO public.master_product_accessory_relationships VALUES ('8330b0c8-e606-4776-8452-e7ff27a90d2d', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'b035d0d7-f993-4a1d-a31b-28f2630b5c12', 'recommended', 'Showroom', '2025-08-09 18:25:32.964678');
INSERT INTO public.master_product_accessory_relationships VALUES ('4da07800-79fe-4944-ace5-4b7b289f75d6', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '314f96ce-beb1-42ca-a409-3d66bfc7f6e6', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:32.998688');
INSERT INTO public.master_product_accessory_relationships VALUES ('47d16537-9ceb-4a61-b0fd-a6d83a349bd3', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '7073dd2a-36a8-40d9-a73a-9a4c839500d8', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.001732');
INSERT INTO public.master_product_accessory_relationships VALUES ('8f7675c1-a73e-49d1-8851-80e5f277e44b', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '48cb2b0b-a980-475a-a6cd-355fff8aaff9', 'recommended', 'Showroom', '2025-08-09 18:25:33.02721');
INSERT INTO public.master_product_accessory_relationships VALUES ('6e7826a4-230e-4288-9441-eadea5ba296e', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '9e8bf1d6-5c0d-4691-9ba0-c081aa102dee', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.063334');
INSERT INTO public.master_product_accessory_relationships VALUES ('f56bd316-9cca-4f2e-80c0-dc2b602dc674', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '6e8bac45-52d0-4944-9042-85062f681fc8', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.067758');
INSERT INTO public.master_product_accessory_relationships VALUES ('91c5b094-3e65-43ea-86c4-1b4df8bb3f5a', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '79a60df5-23eb-4e16-9e68-c83fb0b7c1d5', 'recommended', 'Showroom', '2025-08-09 18:25:33.093866');
INSERT INTO public.master_product_accessory_relationships VALUES ('21513460-7eab-45f1-a4c0-1f94f811a591', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '7073dd2a-36a8-40d9-a73a-9a4c839500d8', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.126026');
INSERT INTO public.master_product_accessory_relationships VALUES ('a11ba46f-ff01-4415-aa20-463bdd1bdaa1', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '9b76638e-eb27-42e2-81ad-e2e51baf34b4', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.133724');
INSERT INTO public.master_product_accessory_relationships VALUES ('a7579af7-41e8-44c7-b7ab-86d56cab9245', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '314f96ce-beb1-42ca-a409-3d66bfc7f6e6', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.155168');
INSERT INTO public.master_product_accessory_relationships VALUES ('03822425-6bf6-4dcc-91b5-838f0e6e66c0', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '6e8bac45-52d0-4944-9042-85062f681fc8', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.188252');
INSERT INTO public.master_product_accessory_relationships VALUES ('27b6d4d1-bd9a-4e53-afad-89585c0860fe', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'adafe072-98f2-4399-b9ee-e87a2ce776fd', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.199233');
INSERT INTO public.master_product_accessory_relationships VALUES ('539d5c27-4ae4-4e50-b197-187993406704', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '9e8bf1d6-5c0d-4691-9ba0-c081aa102dee', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.219835');
INSERT INTO public.master_product_accessory_relationships VALUES ('235e739c-1028-4813-a4fb-51404715e671', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '9b76638e-eb27-42e2-81ad-e2e51baf34b4', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.250844');
INSERT INTO public.master_product_accessory_relationships VALUES ('96a81a56-9488-4248-9485-7205d2a4c943', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'fd39d993-d69d-4ee5-aae2-57b641646c62', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.270553');
INSERT INTO public.master_product_accessory_relationships VALUES ('c022b1a7-dd9f-4fba-9828-dc79c5b2398b', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '7073dd2a-36a8-40d9-a73a-9a4c839500d8', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.287881');
INSERT INTO public.master_product_accessory_relationships VALUES ('142f3246-4318-447c-b531-2cd2bad7bb01', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'adafe072-98f2-4399-b9ee-e87a2ce776fd', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.319535');
INSERT INTO public.master_product_accessory_relationships VALUES ('12b2e2b2-faa7-4323-854b-b6e0c2a23609', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'c743b808-7db3-4243-bb5f-47fcd81b6b74', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.340158');
INSERT INTO public.master_product_accessory_relationships VALUES ('720aa22b-f7c7-4850-84b9-b473d875bd88', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '6e8bac45-52d0-4944-9042-85062f681fc8', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.351738');
INSERT INTO public.master_product_accessory_relationships VALUES ('976946f7-0e81-4359-a391-9ec747fa1bfb', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'fd39d993-d69d-4ee5-aae2-57b641646c62', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.381367');
INSERT INTO public.master_product_accessory_relationships VALUES ('b7725990-58b2-46c0-966b-f20dddcd2bbe', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'ae544bf7-2293-4f42-927a-e7646f44abd9', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.404346');
INSERT INTO public.master_product_accessory_relationships VALUES ('113c97ad-76db-4af0-8ce4-b6cbc53db292', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '9b76638e-eb27-42e2-81ad-e2e51baf34b4', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.413737');
INSERT INTO public.master_product_accessory_relationships VALUES ('f92884cd-db66-4eb3-a185-228eca9c7955', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'c743b808-7db3-4243-bb5f-47fcd81b6b74', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.442744');
INSERT INTO public.master_product_accessory_relationships VALUES ('9f3ba506-09f8-4078-a514-117f0dcc3eb2', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '74256285-889c-4d3e-9b0f-7a3cf381fbfc', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.468561');
INSERT INTO public.master_product_accessory_relationships VALUES ('3cf8b808-74ed-4e3a-ac5a-0506d9f45883', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'adafe072-98f2-4399-b9ee-e87a2ce776fd', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.475828');
INSERT INTO public.master_product_accessory_relationships VALUES ('c568dae2-1b1f-49e8-9982-64101aeb9bba', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'ae544bf7-2293-4f42-927a-e7646f44abd9', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.505306');
INSERT INTO public.master_product_accessory_relationships VALUES ('a99a9a3e-04f3-4e8b-9f1d-b0f484983fc2', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '042e1ee4-af6d-49ac-a188-7f61659184ce', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.534509');
INSERT INTO public.master_product_accessory_relationships VALUES ('d5af5d8d-5281-4da6-8f08-ef8681341b75', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'fd39d993-d69d-4ee5-aae2-57b641646c62', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.540059');
INSERT INTO public.master_product_accessory_relationships VALUES ('9d841f7d-9897-4345-b3a2-3d5d12d08656', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '74256285-889c-4d3e-9b0f-7a3cf381fbfc', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.568293');
INSERT INTO public.master_product_accessory_relationships VALUES ('7641ea59-d87e-442e-b1bc-116ed145c832', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'c743b808-7db3-4243-bb5f-47fcd81b6b74', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.601856');
INSERT INTO public.master_product_accessory_relationships VALUES ('e6bbe2b1-b399-4c66-ab68-cc26109ef6f5', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '0f60d5fd-e94b-468b-9994-9c0c3c1940cd', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.613122');
INSERT INTO public.master_product_accessory_relationships VALUES ('60afd8b9-c618-4b6f-b312-aff4203b1c18', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '042e1ee4-af6d-49ac-a188-7f61659184ce', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.630702');
INSERT INTO public.master_product_accessory_relationships VALUES ('a666cd00-6f38-4076-b3dc-789a28e39aa4', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'ae544bf7-2293-4f42-927a-e7646f44abd9', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.663693');
INSERT INTO public.master_product_accessory_relationships VALUES ('e7255b3d-c243-458b-82a8-75bd2a128710', '3ce1faed-e4b5-4a7d-a19f-aa5b544e08f4', 'ef38ad83-0425-43b5-8158-d6349b134f3d', 'compatible', 'Equipment', '2025-08-09 18:25:32.839947');
INSERT INTO public.master_product_accessory_relationships VALUES ('79a3064e-682a-4e95-81b8-98879ec4db2b', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'eedfe2f6-d22a-40fb-ab7d-53914287787a', 'recommended', 'Showroom', '2025-08-09 18:25:33.180319');
INSERT INTO public.master_product_accessory_relationships VALUES ('5247acb3-594e-4e97-9c5d-e696b81988ee', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'caf449df-8d04-4f7b-9f4d-f76857e44ec7', 'recommended', 'Showroom', '2025-08-09 18:25:33.246326');
INSERT INTO public.master_product_accessory_relationships VALUES ('29386c47-8bea-44d8-918d-018f65aa465d', '476ddceb-5e67-4f40-980d-9361ba382cc0', '9f2e675f-5af0-4a2b-b5aa-df94d4e19b09', 'recommended', 'Showroom', '2025-08-09 18:25:33.30984');
INSERT INTO public.master_product_accessory_relationships VALUES ('6c2ed8e2-d46b-4427-a3b1-7a3f7f169530', '476ddceb-5e67-4f40-980d-9361ba382cc0', '99bc73b2-df15-4b34-a91f-25bd9c11fb7d', 'recommended', 'Showroom', '2025-08-09 18:25:33.376312');
INSERT INTO public.master_product_accessory_relationships VALUES ('12b5cbab-933a-4e68-b630-d13bcae15c4f', '476ddceb-5e67-4f40-980d-9361ba382cc0', '5b34c956-82a7-4ed4-92c3-9a45bcf073bf', 'recommended', 'Showroom', '2025-08-09 18:25:33.441164');
INSERT INTO public.master_product_accessory_relationships VALUES ('04e6bd0d-43a4-4c4b-b56e-f59e440bf1cd', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'fade048c-2380-412a-bff9-fb9fc61274d9', 'recommended', 'Showroom', '2025-08-09 18:25:33.506107');
INSERT INTO public.master_product_accessory_relationships VALUES ('14b1d509-ec5d-4f67-ac26-037ecb99219d', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'd1a5193c-6211-4447-8bad-2f39ddd897d6', 'recommended', 'Showroom', '2025-08-09 18:25:33.579081');
INSERT INTO public.master_product_accessory_relationships VALUES ('88b7e841-e733-4cea-89f1-f085888cb3e7', 'd10c773b-2953-4e77-add5-ff998ff9b616', '2ec356c4-e8e6-4271-9ba9-4828ac205a77', 'compatible', 'Equipment', '2025-08-09 18:25:34.286491');
INSERT INTO public.master_product_accessory_relationships VALUES ('614447ad-cc18-4c9c-9c64-d0f3e84db14e', 'd10c773b-2953-4e77-add5-ff998ff9b616', '9c69404a-d90c-432c-9dc6-202128f739d2', 'recommended', 'Showroom', '2025-08-09 18:25:34.350733');
INSERT INTO public.master_product_accessory_relationships VALUES ('ef726474-e479-4dfc-b2d1-5a617e1c6439', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'dd11ee3c-6b84-457f-896d-d6ed5ad9197d', 'recommended', 'Showroom', '2025-08-09 18:25:34.418173');
INSERT INTO public.master_product_accessory_relationships VALUES ('909374a3-25ba-4d74-aba7-acd9bdb9aa56', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'f0e973b8-c0a9-4ff8-b372-67d10cacfa99', 'recommended', 'Showroom', '2025-08-09 18:25:34.482086');
INSERT INTO public.master_product_accessory_relationships VALUES ('dd6923ae-bebc-4785-a58d-086b64962898', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'e46a264e-eba2-4800-b25f-96704e3722ce', 'recommended', 'Showroom', '2025-08-09 18:25:34.545068');
INSERT INTO public.master_product_accessory_relationships VALUES ('41b91186-3b55-404f-88de-a843dcffdf91', 'd10c773b-2953-4e77-add5-ff998ff9b616', '56565d58-2938-44b3-a24f-bb54d9bf3ad1', 'recommended', 'Showroom', '2025-08-09 18:25:34.608154');
INSERT INTO public.master_product_accessory_relationships VALUES ('d10759cb-db2f-4f09-9857-5acc5e8992e9', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'a580f488-7784-4f54-8705-e14bbefafb26', 'recommended', 'Showroom', '2025-08-09 18:25:34.673136');
INSERT INTO public.master_product_accessory_relationships VALUES ('05567f8e-14b0-43f5-af39-ffb9462d9a3d', 'd10c773b-2953-4e77-add5-ff998ff9b616', '68f525e4-e5b3-4847-a2b7-f07900effed3', 'recommended', 'Showroom', '2025-08-09 18:25:34.736415');
INSERT INTO public.master_product_accessory_relationships VALUES ('a783aeea-9ea3-4dcb-8d17-0584474aa0af', 'd10c773b-2953-4e77-add5-ff998ff9b616', '17b11bb3-cbe0-488e-9a94-0e7564a939dd', 'recommended', 'Showroom', '2025-08-09 18:25:34.799014');
INSERT INTO public.master_product_accessory_relationships VALUES ('4d2dc706-301f-42f2-b738-1ad1a269d131', 'd10c773b-2953-4e77-add5-ff998ff9b616', '6563082c-daf1-4485-a357-0079a9fd65ac', 'recommended', 'Showroom', '2025-08-09 18:25:34.863483');
INSERT INTO public.master_product_accessory_relationships VALUES ('c19c16c0-0144-428b-9666-70d7fb4381f6', 'd10c773b-2953-4e77-add5-ff998ff9b616', '181a5095-908e-47a5-b8a7-7c4bc5bff64c', 'recommended', 'Showroom', '2025-08-09 18:25:34.93097');
INSERT INTO public.master_product_accessory_relationships VALUES ('a0a817f4-5adc-4286-bb43-356ec0fafc9c', 'd10c773b-2953-4e77-add5-ff998ff9b616', '3e5706db-ab4c-49f2-a0d0-fece0de45a7a', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:34.993042');
INSERT INTO public.master_product_accessory_relationships VALUES ('6cc8f362-5e3f-4ad1-abc1-0be3ec02160d', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'b793f4d7-2404-4072-92e3-fb8a41cd579d', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:35.05702');
INSERT INTO public.master_product_accessory_relationships VALUES ('bafe7612-83c0-438f-bc9e-32b706e4f1d7', 'd10c773b-2953-4e77-add5-ff998ff9b616', '07e8bdc2-2923-4f6c-8410-3ceee8fb4e69', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:35.122156');
INSERT INTO public.master_product_accessory_relationships VALUES ('6e8a23f5-ae10-4e93-81cb-de3c880d92f2', 'd10c773b-2953-4e77-add5-ff998ff9b616', '75ee4916-d798-4d82-95a2-621d3f6e8e5c', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:35.186779');
INSERT INTO public.master_product_accessory_relationships VALUES ('478a65ae-1ee3-4cd5-a508-90b4fc120c47', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'b7121634-5f79-4fb0-a7de-a033d03dd8ee', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:35.251163');
INSERT INTO public.master_product_accessory_relationships VALUES ('444be4c8-ec4a-4cb2-87a2-8c624d0634c9', 'd10c773b-2953-4e77-add5-ff998ff9b616', '0a49ab38-14b4-4243-bd80-54e9a8dfab2f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:35.314775');
INSERT INTO public.master_product_accessory_relationships VALUES ('b27511f8-04f1-47bf-8aff-500710633e6b', 'd10c773b-2953-4e77-add5-ff998ff9b616', '05e82c13-c686-477a-9ffe-06a4ab677f62', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:35.382922');
INSERT INTO public.master_product_accessory_relationships VALUES ('7c5d49eb-62ff-4aa2-a5bd-22a5c0c45f2c', 'd10c773b-2953-4e77-add5-ff998ff9b616', '3c65d88f-e460-4c6b-bab8-7c0ed4fcb366', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:35.447046');
INSERT INTO public.master_product_accessory_relationships VALUES ('d1bdd162-18ca-4505-921e-5cee9e50b139', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'ab6287f2-b5c4-460f-ba94-8d5b583a2829', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:35.519907');
INSERT INTO public.master_product_accessory_relationships VALUES ('69e15854-d875-413e-83fa-517405c93cdd', 'd10c773b-2953-4e77-add5-ff998ff9b616', '5704a1dd-1d63-4134-b46e-a6cd1fb712c2', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:35.584086');
INSERT INTO public.master_product_accessory_relationships VALUES ('db545ce0-1b64-4b7d-9c5a-9290fa856886', 'd10c773b-2953-4e77-add5-ff998ff9b616', '5a409136-d4e5-4c70-8244-931b45c3a451', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:35.647974');
INSERT INTO public.master_product_accessory_relationships VALUES ('a3d9f0bc-8848-409c-af63-40bc7a8024cb', 'd10c773b-2953-4e77-add5-ff998ff9b616', '0e896f74-267d-422a-bb13-632993b6705e', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:35.713474');
INSERT INTO public.master_product_accessory_relationships VALUES ('2a3daf3c-bae1-4eea-8515-5915f2e03abd', 'd10c773b-2953-4e77-add5-ff998ff9b616', '7f4aae94-6626-4627-b44f-6c61b4ad988f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:35.778353');
INSERT INTO public.master_product_accessory_relationships VALUES ('630b9318-5303-49a7-b7ed-9d3e8a764073', 'd10c773b-2953-4e77-add5-ff998ff9b616', '741641ba-4a77-43a9-9e2b-e65faa1a2c04', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:35.845977');
INSERT INTO public.master_product_accessory_relationships VALUES ('2e7d8076-6703-4126-bc43-67a42197c8b0', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '5cd9e935-7f3a-4508-a49c-75b73088b2f4', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.67718');
INSERT INTO public.master_product_accessory_relationships VALUES ('e3c259a1-0fef-4a51-b9e9-61e98210d03e', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '27526432-a52a-4f28-ae94-8afb5a348fdf', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.73977');
INSERT INTO public.master_product_accessory_relationships VALUES ('6301c602-55cf-48e5-b5f6-ee3e3ae5847d', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '53015869-c43d-4c73-80d5-c1cac2ed4d3f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.80398');
INSERT INTO public.master_product_accessory_relationships VALUES ('a42c31a1-a318-4b0b-8a43-a554d9147ba1', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'ef13c803-a88a-43eb-b3ff-6d8098c68e26', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.86865');
INSERT INTO public.master_product_accessory_relationships VALUES ('a8d8c58b-cf88-463d-9508-d8c12858526e', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '7358d5ea-6690-4f3a-b652-aded58805b8f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.932259');
INSERT INTO public.master_product_accessory_relationships VALUES ('ebccbc7a-20b7-4062-9d7e-60241ad418f1', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '802d3ea2-9b40-48f3-9844-4e8b77c73dde', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:34.000676');
INSERT INTO public.master_product_accessory_relationships VALUES ('26806513-2369-46b6-a5a4-cdcaa1f22ddb', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '771c35c7-7a7a-4abb-8281-691c533f3978', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:34.066208');
INSERT INTO public.master_product_accessory_relationships VALUES ('b51f40b7-02ad-4ce6-98dc-e407116b6b2d', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '72e6e443-9556-4e5d-be2f-3f88643bc212', 'compatible', 'Accessories', '2025-08-09 18:25:34.132049');
INSERT INTO public.master_product_accessory_relationships VALUES ('b898292f-9305-4e3d-bffa-5c40008386c3', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'eedfe2f6-d22a-40fb-ab7d-53914287787a', 'recommended', 'Showroom', '2025-08-09 18:25:34.895218');
INSERT INTO public.master_product_accessory_relationships VALUES ('dc4251ef-1440-459c-9cba-a1443513039b', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'caf449df-8d04-4f7b-9f4d-f76857e44ec7', 'recommended', 'Showroom', '2025-08-09 18:25:34.961136');
INSERT INTO public.master_product_accessory_relationships VALUES ('81bd018a-1db7-4c9d-bae5-59f6b6d74e87', '476ddceb-5e67-4f40-980d-9361ba382cc0', '9f2e675f-5af0-4a2b-b5aa-df94d4e19b09', 'recommended', 'Showroom', '2025-08-09 18:25:35.026007');
INSERT INTO public.master_product_accessory_relationships VALUES ('1ca803dc-793a-44fb-9203-f59f9b358923', '476ddceb-5e67-4f40-980d-9361ba382cc0', '99bc73b2-df15-4b34-a91f-25bd9c11fb7d', 'recommended', 'Showroom', '2025-08-09 18:25:35.090227');
INSERT INTO public.master_product_accessory_relationships VALUES ('927d3984-442d-410c-8033-d6a25f497667', '476ddceb-5e67-4f40-980d-9361ba382cc0', '5b34c956-82a7-4ed4-92c3-9a45bcf073bf', 'recommended', 'Showroom', '2025-08-09 18:25:35.156296');
INSERT INTO public.master_product_accessory_relationships VALUES ('8334fe4c-0fc8-4ae4-8524-09949f7d822c', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'fade048c-2380-412a-bff9-fb9fc61274d9', 'recommended', 'Showroom', '2025-08-09 18:25:35.221168');
INSERT INTO public.master_product_accessory_relationships VALUES ('d9c4c731-59a4-403d-9b1b-310c58ee14d5', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'd1a5193c-6211-4447-8bad-2f39ddd897d6', 'recommended', 'Showroom', '2025-08-09 18:25:35.284894');
INSERT INTO public.master_product_accessory_relationships VALUES ('16877c46-8f40-49d9-b704-ca053e9e6f9e', 'd10c773b-2953-4e77-add5-ff998ff9b616', '2ec356c4-e8e6-4271-9ba9-4828ac205a77', 'compatible', 'Equipment', '2025-08-09 18:25:36.012034');
INSERT INTO public.master_product_accessory_relationships VALUES ('4bd045db-0984-4890-8d1b-2e63ce3371a4', 'd10c773b-2953-4e77-add5-ff998ff9b616', '9c69404a-d90c-432c-9dc6-202128f739d2', 'recommended', 'Showroom', '2025-08-09 18:25:36.078412');
INSERT INTO public.master_product_accessory_relationships VALUES ('a8106816-22d4-42d3-af18-3843a58721a6', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'dd11ee3c-6b84-457f-896d-d6ed5ad9197d', 'recommended', 'Showroom', '2025-08-09 18:25:36.144548');
INSERT INTO public.master_product_accessory_relationships VALUES ('5602f48d-e08a-4008-8084-e21c30e03b84', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'f0e973b8-c0a9-4ff8-b372-67d10cacfa99', 'recommended', 'Showroom', '2025-08-09 18:25:36.208418');
INSERT INTO public.master_product_accessory_relationships VALUES ('f00bc5db-bd1d-4154-9847-6b44023bd280', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'e46a264e-eba2-4800-b25f-96704e3722ce', 'recommended', 'Showroom', '2025-08-09 18:25:36.272844');
INSERT INTO public.master_product_accessory_relationships VALUES ('0ad8d598-198a-4959-9f33-6837feb331d4', 'd10c773b-2953-4e77-add5-ff998ff9b616', '56565d58-2938-44b3-a24f-bb54d9bf3ad1', 'recommended', 'Showroom', '2025-08-09 18:25:36.338255');
INSERT INTO public.master_product_accessory_relationships VALUES ('9ab376d4-4841-417a-ba04-d0cf8edc0dd7', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'a580f488-7784-4f54-8705-e14bbefafb26', 'recommended', 'Showroom', '2025-08-09 18:25:36.402743');
INSERT INTO public.master_product_accessory_relationships VALUES ('05f233c3-c879-4d76-81dc-42d4c60adf34', 'd10c773b-2953-4e77-add5-ff998ff9b616', '68f525e4-e5b3-4847-a2b7-f07900effed3', 'recommended', 'Showroom', '2025-08-09 18:25:36.467205');
INSERT INTO public.master_product_accessory_relationships VALUES ('2a8d8629-0de6-4f9c-b7d7-73b94bc2a569', 'd10c773b-2953-4e77-add5-ff998ff9b616', '17b11bb3-cbe0-488e-9a94-0e7564a939dd', 'recommended', 'Showroom', '2025-08-09 18:25:36.531379');
INSERT INTO public.master_product_accessory_relationships VALUES ('a385beae-1ba0-4d74-ae02-964c9b7c0faf', 'd10c773b-2953-4e77-add5-ff998ff9b616', '6563082c-daf1-4485-a357-0079a9fd65ac', 'recommended', 'Showroom', '2025-08-09 18:25:36.60594');
INSERT INTO public.master_product_accessory_relationships VALUES ('a1937c01-d143-44e0-aafc-34f9d6fb1ab2', 'd10c773b-2953-4e77-add5-ff998ff9b616', '181a5095-908e-47a5-b8a7-7c4bc5bff64c', 'recommended', 'Showroom', '2025-08-09 18:25:36.668108');
INSERT INTO public.master_product_accessory_relationships VALUES ('3c1f894a-8086-4d82-a66e-ca213e97524d', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '0f60d5fd-e94b-468b-9994-9c0c3c1940cd', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.69232');
INSERT INTO public.master_product_accessory_relationships VALUES ('d23792a4-116a-42f1-b550-0334c231e51e', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '5cd9e935-7f3a-4508-a49c-75b73088b2f4', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.753849');
INSERT INTO public.master_product_accessory_relationships VALUES ('3f086b6e-b665-4dc5-8dab-96078670e8ce', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '27526432-a52a-4f28-ae94-8afb5a348fdf', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.816777');
INSERT INTO public.master_product_accessory_relationships VALUES ('c18de367-2b3b-461c-987a-51827841c3e9', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '53015869-c43d-4c73-80d5-c1cac2ed4d3f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.878761');
INSERT INTO public.master_product_accessory_relationships VALUES ('605b6145-1ccd-454f-8aed-a0889f693d59', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'ef13c803-a88a-43eb-b3ff-6d8098c68e26', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.941282');
INSERT INTO public.master_product_accessory_relationships VALUES ('7bb61def-0677-462c-a6b8-64b85748be09', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '7358d5ea-6690-4f3a-b652-aded58805b8f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:34.009298');
INSERT INTO public.master_product_accessory_relationships VALUES ('55450fb3-12f4-47c3-bf1f-05df5d7edd5e', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '802d3ea2-9b40-48f3-9844-4e8b77c73dde', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:34.071705');
INSERT INTO public.master_product_accessory_relationships VALUES ('aced3948-b945-4a74-87f4-f7aed8b8be5e', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '771c35c7-7a7a-4abb-8281-691c533f3978', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:34.133314');
INSERT INTO public.master_product_accessory_relationships VALUES ('51f53188-1af5-493a-b7ad-a592d34a0e75', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '72e6e443-9556-4e5d-be2f-3f88643bc212', 'compatible', 'Accessories', '2025-08-09 18:25:34.195825');
INSERT INTO public.master_product_accessory_relationships VALUES ('11eeb7b3-2f07-47b0-9e46-7007ccb99774', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'eedfe2f6-d22a-40fb-ab7d-53914287787a', 'recommended', 'Showroom', '2025-08-09 18:25:34.923627');
INSERT INTO public.master_product_accessory_relationships VALUES ('c25ab1b9-6176-4166-b566-996bc0a91d31', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'caf449df-8d04-4f7b-9f4d-f76857e44ec7', 'recommended', 'Showroom', '2025-08-09 18:25:34.986799');
INSERT INTO public.master_product_accessory_relationships VALUES ('f369cf98-5f43-4fb6-a568-9a8245c4ee92', '476ddceb-5e67-4f40-980d-9361ba382cc0', '9f2e675f-5af0-4a2b-b5aa-df94d4e19b09', 'recommended', 'Showroom', '2025-08-09 18:25:35.055611');
INSERT INTO public.master_product_accessory_relationships VALUES ('c21a668c-a4c3-4639-b9e1-1a0723971416', '476ddceb-5e67-4f40-980d-9361ba382cc0', '99bc73b2-df15-4b34-a91f-25bd9c11fb7d', 'recommended', 'Showroom', '2025-08-09 18:25:35.121373');
INSERT INTO public.master_product_accessory_relationships VALUES ('09d221f3-fdd0-4c5b-9373-bb56050a526d', '476ddceb-5e67-4f40-980d-9361ba382cc0', '5b34c956-82a7-4ed4-92c3-9a45bcf073bf', 'recommended', 'Showroom', '2025-08-09 18:25:35.183594');
INSERT INTO public.master_product_accessory_relationships VALUES ('a2ec07aa-98eb-42b3-946f-a7ca4ac64161', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'fade048c-2380-412a-bff9-fb9fc61274d9', 'recommended', 'Showroom', '2025-08-09 18:25:35.246275');
INSERT INTO public.master_product_accessory_relationships VALUES ('c46f5876-3b4b-468e-b154-5a8893bcf20c', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'd1a5193c-6211-4447-8bad-2f39ddd897d6', 'recommended', 'Showroom', '2025-08-09 18:25:35.308602');
INSERT INTO public.master_product_accessory_relationships VALUES ('57fb0a64-1f76-44f3-abce-1dd348b646ea', 'd10c773b-2953-4e77-add5-ff998ff9b616', '2ec356c4-e8e6-4271-9ba9-4828ac205a77', 'compatible', 'Equipment', '2025-08-09 18:25:36.007577');
INSERT INTO public.master_product_accessory_relationships VALUES ('bceeb19a-04f4-478a-a1a7-b7814db8f206', 'd10c773b-2953-4e77-add5-ff998ff9b616', '9c69404a-d90c-432c-9dc6-202128f739d2', 'recommended', 'Showroom', '2025-08-09 18:25:36.073104');
INSERT INTO public.master_product_accessory_relationships VALUES ('7d2248a7-c61b-47d5-adc7-4a436cbb3619', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'dd11ee3c-6b84-457f-896d-d6ed5ad9197d', 'recommended', 'Showroom', '2025-08-09 18:25:36.136462');
INSERT INTO public.master_product_accessory_relationships VALUES ('ea8b4b75-6a08-4095-8044-28894c1605c2', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'f0e973b8-c0a9-4ff8-b372-67d10cacfa99', 'recommended', 'Showroom', '2025-08-09 18:25:36.199575');
INSERT INTO public.master_product_accessory_relationships VALUES ('e72287a2-b9db-49f2-9a92-24c3161bfb14', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'e46a264e-eba2-4800-b25f-96704e3722ce', 'recommended', 'Showroom', '2025-08-09 18:25:36.261317');
INSERT INTO public.master_product_accessory_relationships VALUES ('f7d5c9c2-9898-4266-bc37-c3f273fbbe20', 'd10c773b-2953-4e77-add5-ff998ff9b616', '56565d58-2938-44b3-a24f-bb54d9bf3ad1', 'recommended', 'Showroom', '2025-08-09 18:25:36.322987');
INSERT INTO public.master_product_accessory_relationships VALUES ('3d7d24cf-8ba5-4f08-b2ca-6938020981a5', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'a580f488-7784-4f54-8705-e14bbefafb26', 'recommended', 'Showroom', '2025-08-09 18:25:36.384395');
INSERT INTO public.master_product_accessory_relationships VALUES ('8f89f954-9658-42e3-9d62-5fabc438267d', 'd10c773b-2953-4e77-add5-ff998ff9b616', '68f525e4-e5b3-4847-a2b7-f07900effed3', 'recommended', 'Showroom', '2025-08-09 18:25:36.448114');
INSERT INTO public.master_product_accessory_relationships VALUES ('d15c2a51-13b5-42ab-ab34-4c6582aab6da', 'd10c773b-2953-4e77-add5-ff998ff9b616', '17b11bb3-cbe0-488e-9a94-0e7564a939dd', 'recommended', 'Showroom', '2025-08-09 18:25:36.511242');
INSERT INTO public.master_product_accessory_relationships VALUES ('a8f0e5fe-29f6-4cd8-b115-0c33715ada7b', 'd10c773b-2953-4e77-add5-ff998ff9b616', '6563082c-daf1-4485-a357-0079a9fd65ac', 'recommended', 'Showroom', '2025-08-09 18:25:36.575213');
INSERT INTO public.master_product_accessory_relationships VALUES ('35430f9d-d112-43ee-96e1-deb4407658dd', 'd10c773b-2953-4e77-add5-ff998ff9b616', '181a5095-908e-47a5-b8a7-7c4bc5bff64c', 'recommended', 'Showroom', '2025-08-09 18:25:36.637814');
INSERT INTO public.master_product_accessory_relationships VALUES ('50720576-d54c-4f74-ab88-9a5896d8deb0', 'd10c773b-2953-4e77-add5-ff998ff9b616', '3e5706db-ab4c-49f2-a0d0-fece0de45a7a', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:36.701231');
INSERT INTO public.master_product_accessory_relationships VALUES ('1387b411-dafa-4a44-865a-d12cd40d87fe', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '74256285-889c-4d3e-9b0f-7a3cf381fbfc', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.725476');
INSERT INTO public.master_product_accessory_relationships VALUES ('fc38d8c5-87b8-4c86-9f3d-6a43483e839f', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '042e1ee4-af6d-49ac-a188-7f61659184ce', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.788324');
INSERT INTO public.master_product_accessory_relationships VALUES ('0778f565-6205-450f-a5b4-813faaeab477', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '0f60d5fd-e94b-468b-9994-9c0c3c1940cd', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.851765');
INSERT INTO public.master_product_accessory_relationships VALUES ('d3dc7fa8-cadc-4857-8121-4af9bdc74710', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '5cd9e935-7f3a-4508-a49c-75b73088b2f4', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.912484');
INSERT INTO public.master_product_accessory_relationships VALUES ('716cbda8-b4b3-4e86-a4fa-0eb4e4b6ea9c', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '27526432-a52a-4f28-ae94-8afb5a348fdf', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:33.992457');
INSERT INTO public.master_product_accessory_relationships VALUES ('e12894d3-92fd-4fdb-9af8-7e4416857f6d', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '53015869-c43d-4c73-80d5-c1cac2ed4d3f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:34.056696');
INSERT INTO public.master_product_accessory_relationships VALUES ('2500ac68-9c78-4768-bfad-35ae6c5b1eb7', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', 'ef13c803-a88a-43eb-b3ff-6d8098c68e26', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:34.11979');
INSERT INTO public.master_product_accessory_relationships VALUES ('a85fd8ed-7231-4ab3-ad12-e3b1d35701b2', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '7358d5ea-6690-4f3a-b652-aded58805b8f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:34.18261');
INSERT INTO public.master_product_accessory_relationships VALUES ('17b4797a-75ee-456a-8965-43af19c80483', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '802d3ea2-9b40-48f3-9844-4e8b77c73dde', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:34.245578');
INSERT INTO public.master_product_accessory_relationships VALUES ('e3f0ad68-7e78-439d-8c4d-2112a3673417', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '771c35c7-7a7a-4abb-8281-691c533f3978', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:34.307543');
INSERT INTO public.master_product_accessory_relationships VALUES ('e019ad14-a2e5-45ec-8b1b-6ef372109b56', 'cd3a36d7-306d-42f4-9ceb-8a8586ff21c1', '72e6e443-9556-4e5d-be2f-3f88643bc212', 'compatible', 'Accessories', '2025-08-09 18:25:34.369522');
INSERT INTO public.master_product_accessory_relationships VALUES ('fcdc7659-d30c-427f-9f71-f3eb88d2c76d', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'eedfe2f6-d22a-40fb-ab7d-53914287787a', 'recommended', 'Showroom', '2025-08-09 18:25:35.101368');
INSERT INTO public.master_product_accessory_relationships VALUES ('6bc6b69b-004c-472d-b32f-6161f0360c3e', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'caf449df-8d04-4f7b-9f4d-f76857e44ec7', 'recommended', 'Showroom', '2025-08-09 18:25:35.164366');
INSERT INTO public.master_product_accessory_relationships VALUES ('e5af33e7-4993-425a-bb34-2b69f46c5594', '476ddceb-5e67-4f40-980d-9361ba382cc0', '9f2e675f-5af0-4a2b-b5aa-df94d4e19b09', 'recommended', 'Showroom', '2025-08-09 18:25:35.2272');
INSERT INTO public.master_product_accessory_relationships VALUES ('378f6220-ca78-4e92-95d0-ebc61b7ec68a', '476ddceb-5e67-4f40-980d-9361ba382cc0', '99bc73b2-df15-4b34-a91f-25bd9c11fb7d', 'recommended', 'Showroom', '2025-08-09 18:25:35.287282');
INSERT INTO public.master_product_accessory_relationships VALUES ('0e6e5d81-eaf3-40df-8c0d-45e2771cddf2', '476ddceb-5e67-4f40-980d-9361ba382cc0', '5b34c956-82a7-4ed4-92c3-9a45bcf073bf', 'recommended', 'Showroom', '2025-08-09 18:25:35.348396');
INSERT INTO public.master_product_accessory_relationships VALUES ('a1196692-28a3-4e30-aaff-bfb6f7a17bd2', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'fade048c-2380-412a-bff9-fb9fc61274d9', 'recommended', 'Showroom', '2025-08-09 18:25:35.413226');
INSERT INTO public.master_product_accessory_relationships VALUES ('ce467fa0-79bb-46cc-9e56-083db61306c5', '476ddceb-5e67-4f40-980d-9361ba382cc0', 'd1a5193c-6211-4447-8bad-2f39ddd897d6', 'recommended', 'Showroom', '2025-08-09 18:25:35.482411');
INSERT INTO public.master_product_accessory_relationships VALUES ('2a22ff11-e6c4-4b2b-b43e-ab98c765e63b', 'd10c773b-2953-4e77-add5-ff998ff9b616', '2ec356c4-e8e6-4271-9ba9-4828ac205a77', 'compatible', 'Equipment', '2025-08-09 18:25:36.184286');
INSERT INTO public.master_product_accessory_relationships VALUES ('6e86006b-a153-4835-bbed-86736fb45468', 'd10c773b-2953-4e77-add5-ff998ff9b616', '9c69404a-d90c-432c-9dc6-202128f739d2', 'recommended', 'Showroom', '2025-08-09 18:25:36.247392');
INSERT INTO public.master_product_accessory_relationships VALUES ('7f081b42-5231-492c-9e67-66c93d24ee97', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'dd11ee3c-6b84-457f-896d-d6ed5ad9197d', 'recommended', 'Showroom', '2025-08-09 18:25:36.309188');
INSERT INTO public.master_product_accessory_relationships VALUES ('a6043a8c-0794-4c44-8c7e-6410e3b3d816', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'f0e973b8-c0a9-4ff8-b372-67d10cacfa99', 'recommended', 'Showroom', '2025-08-09 18:25:36.370729');
INSERT INTO public.master_product_accessory_relationships VALUES ('2fa05220-a06a-4266-962a-48cff9e308e3', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'e46a264e-eba2-4800-b25f-96704e3722ce', 'recommended', 'Showroom', '2025-08-09 18:25:36.434536');
INSERT INTO public.master_product_accessory_relationships VALUES ('6ce84d78-cabc-4db6-8cae-48ee19772a9a', 'd10c773b-2953-4e77-add5-ff998ff9b616', '56565d58-2938-44b3-a24f-bb54d9bf3ad1', 'recommended', 'Showroom', '2025-08-09 18:25:36.49632');
INSERT INTO public.master_product_accessory_relationships VALUES ('704f7955-aa98-46de-b7d3-1947bda1e840', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'a580f488-7784-4f54-8705-e14bbefafb26', 'recommended', 'Showroom', '2025-08-09 18:25:36.558504');
INSERT INTO public.master_product_accessory_relationships VALUES ('884dc656-e420-44ea-836d-f7363ac9406e', 'd10c773b-2953-4e77-add5-ff998ff9b616', '68f525e4-e5b3-4847-a2b7-f07900effed3', 'recommended', 'Showroom', '2025-08-09 18:25:36.620307');
INSERT INTO public.master_product_accessory_relationships VALUES ('eda78358-3791-4372-8f9a-e224b9aeaf24', 'd10c773b-2953-4e77-add5-ff998ff9b616', '17b11bb3-cbe0-488e-9a94-0e7564a939dd', 'recommended', 'Showroom', '2025-08-09 18:25:36.682201');
INSERT INTO public.master_product_accessory_relationships VALUES ('45cee1e3-5e41-4351-83f3-3b003b8f6633', 'd10c773b-2953-4e77-add5-ff998ff9b616', '3e5706db-ab4c-49f2-a0d0-fece0de45a7a', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:36.733273');
INSERT INTO public.master_product_accessory_relationships VALUES ('39cbc215-07c7-4ebd-a079-4562b224f7ee', 'd10c773b-2953-4e77-add5-ff998ff9b616', '6563082c-daf1-4485-a357-0079a9fd65ac', 'recommended', 'Showroom', '2025-08-09 18:25:36.746248');
INSERT INTO public.master_product_accessory_relationships VALUES ('e400781e-f1b7-4fe9-87a5-a96418928746', '6246c7a2-f6dd-482b-a3b3-b185d00a0e94', '26cd62e2-ba67-459f-bcea-9094242ff031', 'recommended', 'Showroom', '2025-08-09 18:25:36.765925');
INSERT INTO public.master_product_accessory_relationships VALUES ('4d2820bf-728d-429e-9c9d-3a0137b394cf', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'b793f4d7-2404-4072-92e3-fb8a41cd579d', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:36.766617');
INSERT INTO public.master_product_accessory_relationships VALUES ('adf6aa11-a044-4bdc-89fc-eac0b7fb2268', '2f2fa512-141b-4a26-981b-898464106523', '5cdbbcda-dc4c-4be6-b0d3-75d94156cf96', 'compatible', 'Equipment', '2025-08-09 18:25:36.770115');
INSERT INTO public.master_product_accessory_relationships VALUES ('4183b88f-deeb-41f6-b1f1-625b6354e148', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'b793f4d7-2404-4072-92e3-fb8a41cd579d', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:36.796548');
INSERT INTO public.master_product_accessory_relationships VALUES ('2ba3ceff-72d4-4baa-8377-388501da6148', 'd10c773b-2953-4e77-add5-ff998ff9b616', '181a5095-908e-47a5-b8a7-7c4bc5bff64c', 'recommended', 'Showroom', '2025-08-09 18:25:36.809363');
INSERT INTO public.master_product_accessory_relationships VALUES ('1f3781e2-0c95-412d-9ae3-fec9505cb882', 'd10c773b-2953-4e77-add5-ff998ff9b616', '07e8bdc2-2923-4f6c-8410-3ceee8fb4e69', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:36.829851');
INSERT INTO public.master_product_accessory_relationships VALUES ('d1ba3e05-a996-4e89-ad88-6312d4b47d10', 'd10c773b-2953-4e77-add5-ff998ff9b616', '07e8bdc2-2923-4f6c-8410-3ceee8fb4e69', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:36.862899');
INSERT INTO public.master_product_accessory_relationships VALUES ('589c9b02-ed0e-46fd-8b17-78e79781c3c7', 'd10c773b-2953-4e77-add5-ff998ff9b616', '3e5706db-ab4c-49f2-a0d0-fece0de45a7a', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:36.87226');
INSERT INTO public.master_product_accessory_relationships VALUES ('cf0b9b86-e0e4-4261-ace1-b8682962c2da', 'd10c773b-2953-4e77-add5-ff998ff9b616', '75ee4916-d798-4d82-95a2-621d3f6e8e5c', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:36.893076');
INSERT INTO public.master_product_accessory_relationships VALUES ('b9d3cf1e-d44d-4773-964f-5d9a2672959d', 'd10c773b-2953-4e77-add5-ff998ff9b616', '75ee4916-d798-4d82-95a2-621d3f6e8e5c', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:36.932196');
INSERT INTO public.master_product_accessory_relationships VALUES ('0f9c8da4-595c-411c-8abe-4c4cf226a34a', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'b793f4d7-2404-4072-92e3-fb8a41cd579d', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:36.947969');
INSERT INTO public.master_product_accessory_relationships VALUES ('1840a2d9-dea8-4d9b-93cb-0d36d0b73a0c', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'b7121634-5f79-4fb0-a7de-a033d03dd8ee', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:36.963632');
INSERT INTO public.master_product_accessory_relationships VALUES ('d24aa6c6-2b77-44dc-95c5-314defd46f27', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'd4dd7a57-092b-4d49-81f7-23a769659078', 'compatible', 'Equipment', '2025-08-09 18:25:36.967834');
INSERT INTO public.master_product_accessory_relationships VALUES ('f200bde7-fad1-47ac-bb06-056466727c11', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'b7121634-5f79-4fb0-a7de-a033d03dd8ee', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:36.997376');
INSERT INTO public.master_product_accessory_relationships VALUES ('662a6ba5-9e0a-4020-a157-3146d9c257fc', 'd10c773b-2953-4e77-add5-ff998ff9b616', '07e8bdc2-2923-4f6c-8410-3ceee8fb4e69', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.01259');
INSERT INTO public.master_product_accessory_relationships VALUES ('269c67cb-41af-449d-98c2-e46584784fac', 'd10c773b-2953-4e77-add5-ff998ff9b616', '0a49ab38-14b4-4243-bd80-54e9a8dfab2f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.026319');
INSERT INTO public.master_product_accessory_relationships VALUES ('f55c4228-4605-4936-825b-dce67346122e', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '527d8b0f-a458-49d7-b60f-eec210d13f2c', 'compatible', 'Equipment', '2025-08-09 18:25:37.030893');
INSERT INTO public.master_product_accessory_relationships VALUES ('7f06505c-2f13-44aa-9e10-839991e7c8c5', 'd10c773b-2953-4e77-add5-ff998ff9b616', '0a49ab38-14b4-4243-bd80-54e9a8dfab2f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.061481');
INSERT INTO public.master_product_accessory_relationships VALUES ('78b4e3f0-6ca9-485e-837b-5ba983d08544', 'd10c773b-2953-4e77-add5-ff998ff9b616', '05e82c13-c686-477a-9ffe-06a4ab677f62', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.128918');
INSERT INTO public.master_product_accessory_relationships VALUES ('42c56ea9-2f2d-4839-83b4-8662b1cef3db', 'd10c773b-2953-4e77-add5-ff998ff9b616', '3c65d88f-e460-4c6b-bab8-7c0ed4fcb366', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.195001');
INSERT INTO public.master_product_accessory_relationships VALUES ('91208b83-9a44-4587-833e-bfa8593c25ed', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'ab6287f2-b5c4-460f-ba94-8d5b583a2829', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.260025');
INSERT INTO public.master_product_accessory_relationships VALUES ('b6006331-4e60-4319-ad5b-7de5c1cfc539', 'd10c773b-2953-4e77-add5-ff998ff9b616', '5704a1dd-1d63-4134-b46e-a6cd1fb712c2', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.326136');
INSERT INTO public.master_product_accessory_relationships VALUES ('223fee79-1cdf-4d2a-8054-fc18ae8d2539', 'd10c773b-2953-4e77-add5-ff998ff9b616', '5a409136-d4e5-4c70-8244-931b45c3a451', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.399177');
INSERT INTO public.master_product_accessory_relationships VALUES ('2001bfa7-127a-42e0-a5ce-b9bdcec6ff24', 'd10c773b-2953-4e77-add5-ff998ff9b616', '0e896f74-267d-422a-bb13-632993b6705e', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.464479');
INSERT INTO public.master_product_accessory_relationships VALUES ('75109a3a-3c0b-4baf-8ca3-dba3c771bc7a', 'd10c773b-2953-4e77-add5-ff998ff9b616', '7f4aae94-6626-4627-b44f-6c61b4ad988f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.528921');
INSERT INTO public.master_product_accessory_relationships VALUES ('552c8519-7937-4b9b-aaa1-00c973a16266', 'd10c773b-2953-4e77-add5-ff998ff9b616', '741641ba-4a77-43a9-9e2b-e65faa1a2c04', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.594313');
INSERT INTO public.master_product_accessory_relationships VALUES ('caa3a6f2-c93f-44e6-a2be-3bb62bf17450', '2f2fa512-141b-4a26-981b-898464106523', '5cdbbcda-dc4c-4be6-b0d3-75d94156cf96', 'compatible', 'Equipment', '2025-08-09 18:25:38.563702');
INSERT INTO public.master_product_accessory_relationships VALUES ('6a00cf01-d04e-4294-8949-54beda703523', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'd4dd7a57-092b-4d49-81f7-23a769659078', 'compatible', 'Equipment', '2025-08-09 18:25:38.767221');
INSERT INTO public.master_product_accessory_relationships VALUES ('0a98f1c6-6bd1-4130-9bba-fabea6fcc997', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '527d8b0f-a458-49d7-b60f-eec210d13f2c', 'compatible', 'Equipment', '2025-08-09 18:25:38.832786');
INSERT INTO public.master_product_accessory_relationships VALUES ('71d77272-fed1-4d9f-9f21-cf160ee34c17', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '6bf0e9d2-67f4-4fd1-8277-114d34687474', 'recommended', 'Showroom', '2025-08-09 18:25:38.899076');
INSERT INTO public.master_product_accessory_relationships VALUES ('510e2746-f087-461e-808f-b1be00da2556', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'd5be770b-e8bb-43dc-95eb-dda07244b051', 'recommended', 'Showroom', '2025-08-09 18:25:38.964551');
INSERT INTO public.master_product_accessory_relationships VALUES ('6f1e3463-5bb8-433b-bba2-771a7153c2e9', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '01962030-03d3-4b56-95d8-3cbcab554fdf', 'recommended', 'Showroom', '2025-08-09 18:25:39.031276');
INSERT INTO public.master_product_accessory_relationships VALUES ('99a9bd57-177d-463a-a69f-f1b090502acf', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '136b36ab-283c-424d-9bd2-8450dd66bdbf', 'recommended', 'Showroom', '2025-08-09 18:25:39.09618');
INSERT INTO public.master_product_accessory_relationships VALUES ('cfbd7e77-0a2e-40fe-a947-260bde547813', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'a75b9e20-77c3-46a9-8431-39d14b1c62d3', 'recommended', 'Showroom', '2025-08-09 18:25:39.160865');
INSERT INTO public.master_product_accessory_relationships VALUES ('0fb23eca-2a88-4914-b4e5-3434f06ab6e2', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'ecea59e4-3001-43e8-a8a3-42838a82bf11', 'recommended', 'Showroom', '2025-08-09 18:25:39.224526');
INSERT INTO public.master_product_accessory_relationships VALUES ('90c20b85-3d7a-47b5-81ca-6197193a493f', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '0dccb954-ebec-489a-b1d5-6d8907298f4d', 'recommended', 'Showroom', '2025-08-09 18:25:39.290656');
INSERT INTO public.master_product_accessory_relationships VALUES ('3816e044-30c4-48f3-a803-46a974e13583', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'f16f37e1-b6b3-43e1-8d83-838d13eaa0e7', 'recommended', 'Showroom', '2025-08-09 18:25:39.355939');
INSERT INTO public.master_product_accessory_relationships VALUES ('34e0c7b7-e201-4865-a35d-c5a1734b91a0', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '5c50560c-37a7-4cc7-8ca7-be31af52aa73', 'recommended', 'Showroom', '2025-08-09 18:25:41.999827');
INSERT INTO public.master_product_accessory_relationships VALUES ('b9fcee12-78ad-47d4-b64f-2b259c89d04f', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '8d2be6ff-0640-42be-8034-5d017245c261', 'recommended', 'Showroom', '2025-08-09 18:25:42.066352');
INSERT INTO public.master_product_accessory_relationships VALUES ('2e07e0ee-3371-4a37-985a-f00d9feba3df', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '3ca2f6d1-30a5-4e39-b0cb-e5f3a9210299', 'recommended', 'Showroom', '2025-08-09 18:25:42.131437');
INSERT INTO public.master_product_accessory_relationships VALUES ('1ecb43de-efc8-48d3-90e6-b608d9dfa628', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '72f41010-9dc9-43f3-b34c-53f0683760a2', 'recommended', 'Showroom', '2025-08-09 18:25:42.195919');
INSERT INTO public.master_product_accessory_relationships VALUES ('ac74fba3-c303-4899-9283-1a77bd25d968', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', 'a46e1cb1-3eee-4a99-b880-ee40b468c5c2', 'recommended', 'Showroom', '2025-08-09 18:25:42.260835');
INSERT INTO public.master_product_accessory_relationships VALUES ('7f2e5eaf-e31b-462c-b2b7-1e834b969328', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '1e125f56-bc58-4a73-b64e-d8d10a3c8f07', 'recommended', 'Showroom', '2025-08-09 18:25:42.325595');
INSERT INTO public.master_product_accessory_relationships VALUES ('2874e5dd-3384-4e23-baa7-0e8d4c6cf1a2', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', 'e685155b-c3b0-43f0-8866-a8317260c391', 'recommended', 'Showroom', '2025-08-09 18:25:42.392054');
INSERT INTO public.master_product_accessory_relationships VALUES ('e9ce4a35-9d9e-4d4b-9ef8-6c8e6b20b148', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '08f5c9e9-1375-45b2-b8f5-3d0263efc971', 'recommended', 'Showroom', '2025-08-09 18:25:42.456681');
INSERT INTO public.master_product_accessory_relationships VALUES ('2767de3c-b170-4d06-97a2-6fefef17f6e3', '6246c7a2-f6dd-482b-a3b3-b185d00a0e94', 'be626b0f-1b83-45db-a24b-ad85fbb1b1ed', 'recommended', 'Showroom', '2025-08-09 18:25:43.597663');
INSERT INTO public.master_product_accessory_relationships VALUES ('8f4f7c67-d5d4-4c81-8dfe-5b2e60a12c61', '6246c7a2-f6dd-482b-a3b3-b185d00a0e94', '26cd62e2-ba67-459f-bcea-9094242ff031', 'recommended', 'Showroom', '2025-08-09 18:25:43.662243');
INSERT INTO public.master_product_accessory_relationships VALUES ('f94502fa-e7d7-4c84-92a5-002231de7b1d', '7328c6d1-3b04-45d1-aa5b-75ee4ff2165d', '8c73922e-377a-4dfa-9f8d-19ff072e2aed', 'compatible', 'Equipment', '2025-08-09 18:25:44.277467');
INSERT INTO public.master_product_accessory_relationships VALUES ('e46bc4a5-ab8d-4773-ac47-7b97240fbdb8', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', 'd3b7ec9f-5a2d-48bd-b3f1-f304edcf32eb', 'compatible', 'Equipment', '2025-08-09 18:25:44.409758');
INSERT INTO public.master_product_accessory_relationships VALUES ('94fcf21c-5cba-42d0-a338-e59436ad5a29', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', '9738a370-a1c9-40f7-a5b3-3f01b312c000', 'compatible', 'Equipment', '2025-08-09 18:25:44.474194');
INSERT INTO public.master_product_accessory_relationships VALUES ('d0295337-6043-43eb-ae68-e39fa7597238', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', '686c2dbb-a5aa-4e52-b214-eff0a0fb747f', 'compatible', 'Equipment', '2025-08-09 18:25:44.538184');
INSERT INTO public.master_product_accessory_relationships VALUES ('b6b55f34-6d25-49cb-b103-1c00275d055e', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', 'c6868352-ac35-42cc-84ab-3f4d437308c6', 'compatible', 'Equipment', '2025-08-09 18:25:44.603034');
INSERT INTO public.master_product_accessory_relationships VALUES ('711a2c50-53fe-42d0-aeb9-72ce20b3067c', 'dcedf307-ef36-42d7-8f7e-4353fd20803b', '8e30d20c-db96-41fd-becf-b9c6d0549354', 'compatible', 'Equipment', '2025-08-09 18:25:44.763637');
INSERT INTO public.master_product_accessory_relationships VALUES ('2e94e713-5be5-4bf2-9d43-e054cf7e997f', '370e8277-23a0-4069-9ef7-7e5647a32d7b', '742e7908-bcd1-44d2-95e3-cfb5b8c1b97d', 'compatible', 'Equipment', '2025-08-09 18:25:45.479114');
INSERT INTO public.master_product_accessory_relationships VALUES ('f2e475b9-4bde-490f-a06b-ec4fc33bb7f1', '74ee5bc7-7747-4ce2-8326-c8559ce59b02', '60e4978f-ad7f-40e6-91d1-d55c0da80153', 'compatible', 'Equipment', '2025-08-09 18:25:45.576249');
INSERT INTO public.master_product_accessory_relationships VALUES ('ffa001b4-c0c6-4731-9b51-295050bfded0', 'f82057d9-dc00-4111-967d-0e4b44634b63', '08539463-3aee-446c-8c63-a399019ab5e7', 'compatible', 'Equipment', '2025-08-09 18:25:45.673279');
INSERT INTO public.master_product_accessory_relationships VALUES ('5ba96ae6-caac-4819-84a6-ebb6bf0a218a', 'f82057d9-dc00-4111-967d-0e4b44634b63', '9d78241f-f634-417c-8557-add8ad8078d1', 'compatible', 'Equipment', '2025-08-09 18:25:45.739157');
INSERT INTO public.master_product_accessory_relationships VALUES ('d29f2de5-5d6b-4b88-a9ca-a8aaf122bb74', 'f82057d9-dc00-4111-967d-0e4b44634b63', '9ff32cd5-9fe5-4a55-9e38-5bbec133d23e', 'compatible', 'Equipment', '2025-08-09 18:25:45.812635');
INSERT INTO public.master_product_accessory_relationships VALUES ('2fd1c756-fc98-4a21-8c59-419f364a729d', '2a160856-58b5-40b9-84df-1cd01889daef', 'aa9065a0-a812-4ce9-a3d3-6f9f2bb10c65', 'compatible', 'Equipment', '2025-08-09 18:25:45.973752');
INSERT INTO public.master_product_accessory_relationships VALUES ('e58a4bd5-e47b-4b93-876f-f922bc7f2d17', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', 'f5c57415-b1f9-4241-98f5-d6894ce7a6f3', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.495999');
INSERT INTO public.master_product_accessory_relationships VALUES ('5897c406-a7d8-4f86-9be6-d041646bf18c', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '061b26a8-9805-41c1-baaa-b282ad28a54c', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.560486');
INSERT INTO public.master_product_accessory_relationships VALUES ('be6476c7-066c-4289-bb62-b29395a9ec2e', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', 'f583ab93-eee5-4a21-a8ed-06c3baaf4d8e', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.62688');
INSERT INTO public.master_product_accessory_relationships VALUES ('31416027-49d0-4919-b88f-add91e801087', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '1f45419d-0045-42eb-a880-3480b0ccbaef', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.691846');
INSERT INTO public.master_product_accessory_relationships VALUES ('fa937d61-fed4-4618-af8b-8fbc7c289c16', 'd10c773b-2953-4e77-add5-ff998ff9b616', '75ee4916-d798-4d82-95a2-621d3f6e8e5c', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.075192');
INSERT INTO public.master_product_accessory_relationships VALUES ('a8d7f631-cacb-4683-ad67-cda10399b16a', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'b7121634-5f79-4fb0-a7de-a033d03dd8ee', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.143834');
INSERT INTO public.master_product_accessory_relationships VALUES ('f4809d65-a86e-4c5e-a6c9-27a411ca5415', 'd10c773b-2953-4e77-add5-ff998ff9b616', '0a49ab38-14b4-4243-bd80-54e9a8dfab2f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.20668');
INSERT INTO public.master_product_accessory_relationships VALUES ('4ab78305-dc1c-43c9-b022-d9fbc0940c98', 'd10c773b-2953-4e77-add5-ff998ff9b616', '05e82c13-c686-477a-9ffe-06a4ab677f62', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.271554');
INSERT INTO public.master_product_accessory_relationships VALUES ('1ab23611-4f7f-473a-a618-cdcfe7b2dd3e', 'd10c773b-2953-4e77-add5-ff998ff9b616', '3c65d88f-e460-4c6b-bab8-7c0ed4fcb366', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.338764');
INSERT INTO public.master_product_accessory_relationships VALUES ('59cbce74-0e25-4b1b-8ba2-52d9530d6f42', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'ab6287f2-b5c4-460f-ba94-8d5b583a2829', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.40289');
INSERT INTO public.master_product_accessory_relationships VALUES ('62fdb05c-d84c-4159-99f2-92e7ed2eb9a6', 'd10c773b-2953-4e77-add5-ff998ff9b616', '5704a1dd-1d63-4134-b46e-a6cd1fb712c2', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.466343');
INSERT INTO public.master_product_accessory_relationships VALUES ('a88f1c31-3fce-482d-8005-3412e4afa6df', 'd10c773b-2953-4e77-add5-ff998ff9b616', '5a409136-d4e5-4c70-8244-931b45c3a451', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.528532');
INSERT INTO public.master_product_accessory_relationships VALUES ('9e3c3732-a702-49c9-8897-f5c61022d23c', 'd10c773b-2953-4e77-add5-ff998ff9b616', '0e896f74-267d-422a-bb13-632993b6705e', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.592454');
INSERT INTO public.master_product_accessory_relationships VALUES ('e5c1ba4d-b4fb-4e1a-ac4a-098b41e54b32', 'd10c773b-2953-4e77-add5-ff998ff9b616', '7f4aae94-6626-4627-b44f-6c61b4ad988f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.65476');
INSERT INTO public.master_product_accessory_relationships VALUES ('a0bf89b8-17ab-44e5-b203-676b87d7518e', 'd10c773b-2953-4e77-add5-ff998ff9b616', '741641ba-4a77-43a9-9e2b-e65faa1a2c04', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.717235');
INSERT INTO public.master_product_accessory_relationships VALUES ('890343e3-b485-42bb-bb5f-6469771ce3c1', '2f2fa512-141b-4a26-981b-898464106523', '5cdbbcda-dc4c-4be6-b0d3-75d94156cf96', 'compatible', 'Equipment', '2025-08-09 18:25:38.658175');
INSERT INTO public.master_product_accessory_relationships VALUES ('a8d4a368-b8bd-4ffb-aa44-5b58c056bde7', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'd4dd7a57-092b-4d49-81f7-23a769659078', 'compatible', 'Equipment', '2025-08-09 18:25:38.845485');
INSERT INTO public.master_product_accessory_relationships VALUES ('9cba2230-bb2c-4683-b72a-58097becb92b', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '527d8b0f-a458-49d7-b60f-eec210d13f2c', 'compatible', 'Equipment', '2025-08-09 18:25:38.907281');
INSERT INTO public.master_product_accessory_relationships VALUES ('3568863c-19f5-4ab9-90bb-03a079d223e4', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '6bf0e9d2-67f4-4fd1-8277-114d34687474', 'recommended', 'Showroom', '2025-08-09 18:25:38.981998');
INSERT INTO public.master_product_accessory_relationships VALUES ('57d62ff1-958f-4bbf-a3ba-1c200fcf4438', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'd5be770b-e8bb-43dc-95eb-dda07244b051', 'recommended', 'Showroom', '2025-08-09 18:25:39.045375');
INSERT INTO public.master_product_accessory_relationships VALUES ('f55c37bd-e8aa-41fc-a5b2-127f3de524d0', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '01962030-03d3-4b56-95d8-3cbcab554fdf', 'recommended', 'Showroom', '2025-08-09 18:25:39.110376');
INSERT INTO public.master_product_accessory_relationships VALUES ('58981c0e-d904-4813-839e-2c6bef62d7e1', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '136b36ab-283c-424d-9bd2-8450dd66bdbf', 'recommended', 'Showroom', '2025-08-09 18:25:39.173299');
INSERT INTO public.master_product_accessory_relationships VALUES ('637c06fd-eb8e-49c0-9749-370affbbf690', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'a75b9e20-77c3-46a9-8431-39d14b1c62d3', 'recommended', 'Showroom', '2025-08-09 18:25:39.236425');
INSERT INTO public.master_product_accessory_relationships VALUES ('690a28c1-7e15-4b64-a35e-ecfc0cb63c6a', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'ecea59e4-3001-43e8-a8a3-42838a82bf11', 'recommended', 'Showroom', '2025-08-09 18:25:39.299052');
INSERT INTO public.master_product_accessory_relationships VALUES ('faf2235c-bd6f-46c0-9f8e-6011aab387c8', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '0dccb954-ebec-489a-b1d5-6d8907298f4d', 'recommended', 'Showroom', '2025-08-09 18:25:39.362018');
INSERT INTO public.master_product_accessory_relationships VALUES ('fab64f26-bd65-4b8c-8bc0-0eda7ecfd2f3', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'f16f37e1-b6b3-43e1-8d83-838d13eaa0e7', 'recommended', 'Showroom', '2025-08-09 18:25:39.424992');
INSERT INTO public.master_product_accessory_relationships VALUES ('11fabb5f-997e-482a-90e9-658bb196f7bd', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '5c50560c-37a7-4cc7-8ca7-be31af52aa73', 'recommended', 'Showroom', '2025-08-09 18:25:41.778804');
INSERT INTO public.master_product_accessory_relationships VALUES ('da817661-8495-4611-92da-cac9a07d59c8', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '8d2be6ff-0640-42be-8034-5d017245c261', 'recommended', 'Showroom', '2025-08-09 18:25:41.842264');
INSERT INTO public.master_product_accessory_relationships VALUES ('1cc34c8a-5d83-494b-a825-d6fc787f3a6a', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '3ca2f6d1-30a5-4e39-b0cb-e5f3a9210299', 'recommended', 'Showroom', '2025-08-09 18:25:41.907243');
INSERT INTO public.master_product_accessory_relationships VALUES ('04aecc18-3adb-43d8-9bcc-eb57c1f21d5f', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '72f41010-9dc9-43f3-b34c-53f0683760a2', 'recommended', 'Showroom', '2025-08-09 18:25:41.970564');
INSERT INTO public.master_product_accessory_relationships VALUES ('c0e1028c-1e6c-4baa-816d-890053b9c70a', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', 'a46e1cb1-3eee-4a99-b880-ee40b468c5c2', 'recommended', 'Showroom', '2025-08-09 18:25:42.032786');
INSERT INTO public.master_product_accessory_relationships VALUES ('ffaf6618-3c7b-4b94-a21e-ea133cfc2638', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '1e125f56-bc58-4a73-b64e-d8d10a3c8f07', 'recommended', 'Showroom', '2025-08-09 18:25:42.096951');
INSERT INTO public.master_product_accessory_relationships VALUES ('6f08a1e6-c243-4500-85c1-bebca2726f9f', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', 'e685155b-c3b0-43f0-8866-a8317260c391', 'recommended', 'Showroom', '2025-08-09 18:25:42.16068');
INSERT INTO public.master_product_accessory_relationships VALUES ('8db14a87-218c-4106-8cf9-52be3a4d556b', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '08f5c9e9-1375-45b2-b8f5-3d0263efc971', 'recommended', 'Showroom', '2025-08-09 18:25:42.224432');
INSERT INTO public.master_product_accessory_relationships VALUES ('f1fc539b-f2e9-4fa3-b741-b511a83199a5', '6246c7a2-f6dd-482b-a3b3-b185d00a0e94', 'be626b0f-1b83-45db-a24b-ad85fbb1b1ed', 'recommended', 'Showroom', '2025-08-09 18:25:43.306783');
INSERT INTO public.master_product_accessory_relationships VALUES ('db7abcc9-6d51-491c-a341-915d0af737d4', '6246c7a2-f6dd-482b-a3b3-b185d00a0e94', '26cd62e2-ba67-459f-bcea-9094242ff031', 'recommended', 'Showroom', '2025-08-09 18:25:43.368751');
INSERT INTO public.master_product_accessory_relationships VALUES ('3a4eb32d-20c8-4c1b-828a-62d6055eee4b', '7328c6d1-3b04-45d1-aa5b-75ee4ff2165d', '8c73922e-377a-4dfa-9f8d-19ff072e2aed', 'compatible', 'Equipment', '2025-08-09 18:25:43.961491');
INSERT INTO public.master_product_accessory_relationships VALUES ('92f6ee82-6b4d-4e37-b356-53fe8563b59a', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', 'd3b7ec9f-5a2d-48bd-b3f1-f304edcf32eb', 'compatible', 'Equipment', '2025-08-09 18:25:44.095486');
INSERT INTO public.master_product_accessory_relationships VALUES ('36527aea-74de-46c1-bcef-b27b7bd8c63c', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', '9738a370-a1c9-40f7-a5b3-3f01b312c000', 'compatible', 'Equipment', '2025-08-09 18:25:44.158185');
INSERT INTO public.master_product_accessory_relationships VALUES ('a858c4dd-cb96-485d-b2c9-70b68c8194c5', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', '686c2dbb-a5aa-4e52-b214-eff0a0fb747f', 'compatible', 'Equipment', '2025-08-09 18:25:44.221457');
INSERT INTO public.master_product_accessory_relationships VALUES ('6c8ddca0-702b-474b-ab18-af90d643c9e3', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', 'c6868352-ac35-42cc-84ab-3f4d437308c6', 'compatible', 'Equipment', '2025-08-09 18:25:44.283422');
INSERT INTO public.master_product_accessory_relationships VALUES ('85b7e4f0-cacf-4496-b4d6-d91429d07c6f', 'dcedf307-ef36-42d7-8f7e-4353fd20803b', '8e30d20c-db96-41fd-becf-b9c6d0549354', 'compatible', 'Equipment', '2025-08-09 18:25:44.438282');
INSERT INTO public.master_product_accessory_relationships VALUES ('89b79771-aa1f-43f2-b7d8-00c294dfda3f', '370e8277-23a0-4069-9ef7-7e5647a32d7b', '742e7908-bcd1-44d2-95e3-cfb5b8c1b97d', 'compatible', 'Equipment', '2025-08-09 18:25:45.126811');
INSERT INTO public.master_product_accessory_relationships VALUES ('9a503937-3cbf-412a-9035-049f4ffeb293', '74ee5bc7-7747-4ce2-8326-c8559ce59b02', '60e4978f-ad7f-40e6-91d1-d55c0da80153', 'compatible', 'Equipment', '2025-08-09 18:25:45.218676');
INSERT INTO public.master_product_accessory_relationships VALUES ('c35f5d37-6a1a-4f7f-ae19-42e0d92047c9', 'f82057d9-dc00-4111-967d-0e4b44634b63', '08539463-3aee-446c-8c63-a399019ab5e7', 'compatible', 'Equipment', '2025-08-09 18:25:45.318424');
INSERT INTO public.master_product_accessory_relationships VALUES ('452b79c9-8bea-4ed5-b513-0a48029fe741', 'f82057d9-dc00-4111-967d-0e4b44634b63', '9d78241f-f634-417c-8557-add8ad8078d1', 'compatible', 'Equipment', '2025-08-09 18:25:45.380403');
INSERT INTO public.master_product_accessory_relationships VALUES ('af9f6467-dbcc-4a8e-9f0f-79f3eee08f8e', 'f82057d9-dc00-4111-967d-0e4b44634b63', '9ff32cd5-9fe5-4a55-9e38-5bbec133d23e', 'compatible', 'Equipment', '2025-08-09 18:25:45.444079');
INSERT INTO public.master_product_accessory_relationships VALUES ('0809bf3f-14be-4335-9ca9-9b6f26421aba', '2a160856-58b5-40b9-84df-1cd01889daef', 'aa9065a0-a812-4ce9-a3d3-6f9f2bb10c65', 'compatible', 'Equipment', '2025-08-09 18:25:45.600854');
INSERT INTO public.master_product_accessory_relationships VALUES ('fbbd7813-3470-4bac-9bc4-2fa506293372', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', 'f5c57415-b1f9-4241-98f5-d6894ce7a6f3', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.102127');
INSERT INTO public.master_product_accessory_relationships VALUES ('241c9172-dab0-4551-8dd6-937c1b85f2fa', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '061b26a8-9805-41c1-baaa-b282ad28a54c', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.163934');
INSERT INTO public.master_product_accessory_relationships VALUES ('61ac6eab-a1e8-4329-84c2-275a47d4d5ac', 'd10c773b-2953-4e77-add5-ff998ff9b616', '05e82c13-c686-477a-9ffe-06a4ab677f62', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.089079');
INSERT INTO public.master_product_accessory_relationships VALUES ('90ba7d6c-a01a-42e1-8136-2621fb069184', 'd10c773b-2953-4e77-add5-ff998ff9b616', '3c65d88f-e460-4c6b-bab8-7c0ed4fcb366', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.152002');
INSERT INTO public.master_product_accessory_relationships VALUES ('90609434-46fe-468a-afed-f534ff9f16ba', 'd10c773b-2953-4e77-add5-ff998ff9b616', 'ab6287f2-b5c4-460f-ba94-8d5b583a2829', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.218197');
INSERT INTO public.master_product_accessory_relationships VALUES ('46923165-c15c-45af-9970-78f73c6d9515', 'd10c773b-2953-4e77-add5-ff998ff9b616', '5704a1dd-1d63-4134-b46e-a6cd1fb712c2', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.280659');
INSERT INTO public.master_product_accessory_relationships VALUES ('4c42d738-7e89-4614-9e87-c3915c7c12e0', 'd10c773b-2953-4e77-add5-ff998ff9b616', '5a409136-d4e5-4c70-8244-931b45c3a451', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.348751');
INSERT INTO public.master_product_accessory_relationships VALUES ('3c9af1c6-1c73-4ddd-b98b-cf9845ea07df', 'd10c773b-2953-4e77-add5-ff998ff9b616', '0e896f74-267d-422a-bb13-632993b6705e', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.411508');
INSERT INTO public.master_product_accessory_relationships VALUES ('c1727614-f79d-4493-bc30-2d7266710f37', 'd10c773b-2953-4e77-add5-ff998ff9b616', '7f4aae94-6626-4627-b44f-6c61b4ad988f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.475031');
INSERT INTO public.master_product_accessory_relationships VALUES ('99accd0d-d632-41b9-b879-7422a858d638', 'd10c773b-2953-4e77-add5-ff998ff9b616', '741641ba-4a77-43a9-9e2b-e65faa1a2c04', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:37.537863');
INSERT INTO public.master_product_accessory_relationships VALUES ('724e17ed-8188-4aaa-abc1-88ccf61bcf7b', '2f2fa512-141b-4a26-981b-898464106523', '5cdbbcda-dc4c-4be6-b0d3-75d94156cf96', 'compatible', 'Equipment', '2025-08-09 18:25:38.43444');
INSERT INTO public.master_product_accessory_relationships VALUES ('90e97536-4b40-4d94-98e6-b018e2ddbf91', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'd4dd7a57-092b-4d49-81f7-23a769659078', 'compatible', 'Equipment', '2025-08-09 18:25:38.640389');
INSERT INTO public.master_product_accessory_relationships VALUES ('fb38fd15-937f-4dd3-aae3-6007091c7db3', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '527d8b0f-a458-49d7-b60f-eec210d13f2c', 'compatible', 'Equipment', '2025-08-09 18:25:38.705475');
INSERT INTO public.master_product_accessory_relationships VALUES ('23875c98-9a8f-4572-b62d-58334a90de91', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '6bf0e9d2-67f4-4fd1-8277-114d34687474', 'recommended', 'Showroom', '2025-08-09 18:25:38.768498');
INSERT INTO public.master_product_accessory_relationships VALUES ('785ff295-a7fc-4dd5-a7ea-6141c27013d9', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'd5be770b-e8bb-43dc-95eb-dda07244b051', 'recommended', 'Showroom', '2025-08-09 18:25:38.830521');
INSERT INTO public.master_product_accessory_relationships VALUES ('00097aad-e600-4ead-b924-08c8396d8a61', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '01962030-03d3-4b56-95d8-3cbcab554fdf', 'recommended', 'Showroom', '2025-08-09 18:25:38.893821');
INSERT INTO public.master_product_accessory_relationships VALUES ('345743b3-f99a-4d37-a074-3a2da872e70a', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '136b36ab-283c-424d-9bd2-8450dd66bdbf', 'recommended', 'Showroom', '2025-08-09 18:25:38.96849');
INSERT INTO public.master_product_accessory_relationships VALUES ('e675e74d-94ae-45ad-b600-f3939a9661b0', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'a75b9e20-77c3-46a9-8431-39d14b1c62d3', 'recommended', 'Showroom', '2025-08-09 18:25:39.030624');
INSERT INTO public.master_product_accessory_relationships VALUES ('7f5bb6d6-d922-4923-a3ef-486d057f8a69', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'ecea59e4-3001-43e8-a8a3-42838a82bf11', 'recommended', 'Showroom', '2025-08-09 18:25:39.09506');
INSERT INTO public.master_product_accessory_relationships VALUES ('a48888c8-e587-46c0-85df-8dea1d78a96a', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '0dccb954-ebec-489a-b1d5-6d8907298f4d', 'recommended', 'Showroom', '2025-08-09 18:25:39.161699');
INSERT INTO public.master_product_accessory_relationships VALUES ('eedace0b-9e71-4f85-8ab5-f2708ea02e97', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'f16f37e1-b6b3-43e1-8d83-838d13eaa0e7', 'recommended', 'Showroom', '2025-08-09 18:25:39.23061');
INSERT INTO public.master_product_accessory_relationships VALUES ('fea7e55f-c251-4b36-94a5-1936d025566a', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '5c50560c-37a7-4cc7-8ca7-be31af52aa73', 'recommended', 'Showroom', '2025-08-09 18:25:41.584086');
INSERT INTO public.master_product_accessory_relationships VALUES ('6ee15a3b-8680-492a-87d9-b2b308e13f64', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '8d2be6ff-0640-42be-8034-5d017245c261', 'recommended', 'Showroom', '2025-08-09 18:25:41.649402');
INSERT INTO public.master_product_accessory_relationships VALUES ('e057095f-9f20-4e95-92ee-2e118f0ebc4c', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '3ca2f6d1-30a5-4e39-b0cb-e5f3a9210299', 'recommended', 'Showroom', '2025-08-09 18:25:41.713405');
INSERT INTO public.master_product_accessory_relationships VALUES ('ac8135cf-4c39-4a56-8fa2-a2ad87363f38', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '72f41010-9dc9-43f3-b34c-53f0683760a2', 'recommended', 'Showroom', '2025-08-09 18:25:41.777934');
INSERT INTO public.master_product_accessory_relationships VALUES ('fc68d6aa-60b6-4f9b-bb84-7469caf0a7a0', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', 'a46e1cb1-3eee-4a99-b880-ee40b468c5c2', 'recommended', 'Showroom', '2025-08-09 18:25:41.842168');
INSERT INTO public.master_product_accessory_relationships VALUES ('081651e1-edf8-44d8-b647-25e46cb25da0', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '1e125f56-bc58-4a73-b64e-d8d10a3c8f07', 'recommended', 'Showroom', '2025-08-09 18:25:41.906585');
INSERT INTO public.master_product_accessory_relationships VALUES ('5589c4ae-b4c9-4dd4-93f3-9d40d4e23c54', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', 'e685155b-c3b0-43f0-8866-a8317260c391', 'recommended', 'Showroom', '2025-08-09 18:25:41.969918');
INSERT INTO public.master_product_accessory_relationships VALUES ('585083d4-803c-40f4-9eed-cd105d922376', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '08f5c9e9-1375-45b2-b8f5-3d0263efc971', 'recommended', 'Showroom', '2025-08-09 18:25:42.031691');
INSERT INTO public.master_product_accessory_relationships VALUES ('80def105-0fc2-447d-b662-743532726cd0', '6246c7a2-f6dd-482b-a3b3-b185d00a0e94', 'be626b0f-1b83-45db-a24b-ad85fbb1b1ed', 'recommended', 'Showroom', '2025-08-09 18:25:43.131459');
INSERT INTO public.master_product_accessory_relationships VALUES ('6bc33e25-c506-40b4-a7a8-28a3334d574d', '6246c7a2-f6dd-482b-a3b3-b185d00a0e94', '26cd62e2-ba67-459f-bcea-9094242ff031', 'recommended', 'Showroom', '2025-08-09 18:25:43.200821');
INSERT INTO public.master_product_accessory_relationships VALUES ('a3e7624a-e55e-483e-ae8d-d46a20bee87a', '7328c6d1-3b04-45d1-aa5b-75ee4ff2165d', '8c73922e-377a-4dfa-9f8d-19ff072e2aed', 'compatible', 'Equipment', '2025-08-09 18:25:43.793468');
INSERT INTO public.master_product_accessory_relationships VALUES ('48b8260d-6156-431a-aaac-0f653050413a', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', 'd3b7ec9f-5a2d-48bd-b3f1-f304edcf32eb', 'compatible', 'Equipment', '2025-08-09 18:25:43.927008');
INSERT INTO public.master_product_accessory_relationships VALUES ('c972d370-446b-4382-9098-a1fa95409f54', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', '9738a370-a1c9-40f7-a5b3-3f01b312c000', 'compatible', 'Equipment', '2025-08-09 18:25:43.996826');
INSERT INTO public.master_product_accessory_relationships VALUES ('8fc96aa1-e930-4bad-8805-f8809736fd60', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', '686c2dbb-a5aa-4e52-b214-eff0a0fb747f', 'compatible', 'Equipment', '2025-08-09 18:25:44.060749');
INSERT INTO public.master_product_accessory_relationships VALUES ('35545cb3-02ea-4f58-a77d-48542a53c717', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', 'c6868352-ac35-42cc-84ab-3f4d437308c6', 'compatible', 'Equipment', '2025-08-09 18:25:44.124276');
INSERT INTO public.master_product_accessory_relationships VALUES ('f6669874-603e-45e2-9ddd-e91482deff6b', 'dcedf307-ef36-42d7-8f7e-4353fd20803b', '8e30d20c-db96-41fd-becf-b9c6d0549354', 'compatible', 'Equipment', '2025-08-09 18:25:44.2803');
INSERT INTO public.master_product_accessory_relationships VALUES ('58df8ea0-7226-4eb9-b192-cf798293f75b', '370e8277-23a0-4069-9ef7-7e5647a32d7b', '742e7908-bcd1-44d2-95e3-cfb5b8c1b97d', 'compatible', 'Equipment', '2025-08-09 18:25:44.966831');
INSERT INTO public.master_product_accessory_relationships VALUES ('5c6d30b2-cd0f-446d-9783-2cc804b43d05', '74ee5bc7-7747-4ce2-8326-c8559ce59b02', '60e4978f-ad7f-40e6-91d1-d55c0da80153', 'compatible', 'Equipment', '2025-08-09 18:25:45.060753');
INSERT INTO public.master_product_accessory_relationships VALUES ('a5df1f8b-9926-40bf-be02-936c343a6479', 'f82057d9-dc00-4111-967d-0e4b44634b63', '08539463-3aee-446c-8c63-a399019ab5e7', 'compatible', 'Equipment', '2025-08-09 18:25:45.154812');
INSERT INTO public.master_product_accessory_relationships VALUES ('3bcaca6a-f76a-47cf-ac9c-b95608c41458', 'f82057d9-dc00-4111-967d-0e4b44634b63', '9d78241f-f634-417c-8557-add8ad8078d1', 'compatible', 'Equipment', '2025-08-09 18:25:45.217446');
INSERT INTO public.master_product_accessory_relationships VALUES ('ce6623f5-19d4-46f9-a49d-d8235a4aab02', 'f82057d9-dc00-4111-967d-0e4b44634b63', '9ff32cd5-9fe5-4a55-9e38-5bbec133d23e', 'compatible', 'Equipment', '2025-08-09 18:25:45.278939');
INSERT INTO public.master_product_accessory_relationships VALUES ('3defc7b0-8504-4dab-a0ce-4c03eca59cce', '2a160856-58b5-40b9-84df-1cd01889daef', 'aa9065a0-a812-4ce9-a3d3-6f9f2bb10c65', 'compatible', 'Equipment', '2025-08-09 18:25:45.435352');
INSERT INTO public.master_product_accessory_relationships VALUES ('4b565e86-b913-433f-9264-6ba357cdb3df', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', 'f5c57415-b1f9-4241-98f5-d6894ce7a6f3', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:45.930223');
INSERT INTO public.master_product_accessory_relationships VALUES ('7040fbda-1216-4d87-ba4e-15e7906071b8', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '061b26a8-9805-41c1-baaa-b282ad28a54c', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:45.991421');
INSERT INTO public.master_product_accessory_relationships VALUES ('b46bbf0c-c043-404d-a1df-c2bc4384df8d', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', 'f583ab93-eee5-4a21-a8ed-06c3baaf4d8e', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.056872');
INSERT INTO public.master_product_accessory_relationships VALUES ('6dec8c9d-c216-4b98-8616-482614be08fb', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '1f45419d-0045-42eb-a880-3480b0ccbaef', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.120853');
INSERT INTO public.master_product_accessory_relationships VALUES ('8e6ebdfe-5bd6-4edb-b7ee-5563004b5c89', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '1bcb3d79-b245-4d19-962c-eac9109fa845', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.185213');
INSERT INTO public.master_product_accessory_relationships VALUES ('20a8fe16-0f3f-4953-b56c-b8de7f8d13c9', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '6bf0e9d2-67f4-4fd1-8277-114d34687474', 'recommended', 'Showroom', '2025-08-09 18:25:37.095345');
INSERT INTO public.master_product_accessory_relationships VALUES ('602d2b7a-5051-4740-856c-f62491e33dcd', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'd5be770b-e8bb-43dc-95eb-dda07244b051', 'recommended', 'Showroom', '2025-08-09 18:25:37.161347');
INSERT INTO public.master_product_accessory_relationships VALUES ('0b6bbf80-fc4f-46b8-b492-780fe29a72d3', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '01962030-03d3-4b56-95d8-3cbcab554fdf', 'recommended', 'Showroom', '2025-08-09 18:25:37.223978');
INSERT INTO public.master_product_accessory_relationships VALUES ('d907dd5b-4129-4b0c-a345-0706e48f926f', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '136b36ab-283c-424d-9bd2-8450dd66bdbf', 'recommended', 'Showroom', '2025-08-09 18:25:37.289823');
INSERT INTO public.master_product_accessory_relationships VALUES ('bbdd4e31-3345-429d-88c3-8a236fbd8369', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'a75b9e20-77c3-46a9-8431-39d14b1c62d3', 'recommended', 'Showroom', '2025-08-09 18:25:37.364689');
INSERT INTO public.master_product_accessory_relationships VALUES ('b71ad703-953e-4d86-a31f-e31a86ec939e', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'ecea59e4-3001-43e8-a8a3-42838a82bf11', 'recommended', 'Showroom', '2025-08-09 18:25:37.431201');
INSERT INTO public.master_product_accessory_relationships VALUES ('0976783b-d1c1-4df7-9c30-2ff8f547c443', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', '0dccb954-ebec-489a-b1d5-6d8907298f4d', 'recommended', 'Showroom', '2025-08-09 18:25:37.49623');
INSERT INTO public.master_product_accessory_relationships VALUES ('ca59e46c-addd-46cb-a79d-8fcaa3e43fb0', 'a78180e5-9d3f-4ad1-9e73-44d290d815f9', 'f16f37e1-b6b3-43e1-8d83-838d13eaa0e7', 'recommended', 'Showroom', '2025-08-09 18:25:37.561162');
INSERT INTO public.master_product_accessory_relationships VALUES ('36a04b06-5e2d-4bfd-823f-278a02d969f2', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '5c50560c-37a7-4cc7-8ca7-be31af52aa73', 'recommended', 'Showroom', '2025-08-09 18:25:39.969186');
INSERT INTO public.master_product_accessory_relationships VALUES ('6ea8f1f0-1864-485a-888e-2f06c65430c5', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '8d2be6ff-0640-42be-8034-5d017245c261', 'recommended', 'Showroom', '2025-08-09 18:25:40.033705');
INSERT INTO public.master_product_accessory_relationships VALUES ('a5b98686-1315-4403-b329-9a095f2ee4ec', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '3ca2f6d1-30a5-4e39-b0cb-e5f3a9210299', 'recommended', 'Showroom', '2025-08-09 18:25:40.09831');
INSERT INTO public.master_product_accessory_relationships VALUES ('06b63de6-3904-4c02-806d-9c6c9b6b901c', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '72f41010-9dc9-43f3-b34c-53f0683760a2', 'recommended', 'Showroom', '2025-08-09 18:25:40.164106');
INSERT INTO public.master_product_accessory_relationships VALUES ('a80d39cf-f72e-4a91-a8a5-15e0fb543c57', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', 'a46e1cb1-3eee-4a99-b880-ee40b468c5c2', 'recommended', 'Showroom', '2025-08-09 18:25:40.227827');
INSERT INTO public.master_product_accessory_relationships VALUES ('77c39716-083b-45ec-af30-b425762b1e90', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '1e125f56-bc58-4a73-b64e-d8d10a3c8f07', 'recommended', 'Showroom', '2025-08-09 18:25:40.290373');
INSERT INTO public.master_product_accessory_relationships VALUES ('031bcf69-f021-470d-b085-69972ba9a06d', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', 'e685155b-c3b0-43f0-8866-a8317260c391', 'recommended', 'Showroom', '2025-08-09 18:25:40.35424');
INSERT INTO public.master_product_accessory_relationships VALUES ('a4e56898-348d-4ec3-82f5-1c046687e440', '745da1c8-5a43-4c86-bc63-86996ea7fd7d', '08f5c9e9-1375-45b2-b8f5-3d0263efc971', 'recommended', 'Showroom', '2025-08-09 18:25:40.417695');
INSERT INTO public.master_product_accessory_relationships VALUES ('204c3e08-79ea-42ee-a399-56cbf3da225b', '6246c7a2-f6dd-482b-a3b3-b185d00a0e94', 'be626b0f-1b83-45db-a24b-ad85fbb1b1ed', 'recommended', 'Showroom', '2025-08-09 18:25:41.526993');
INSERT INTO public.master_product_accessory_relationships VALUES ('d9eb2aad-7ed8-410a-901b-59448a9b3e99', '6246c7a2-f6dd-482b-a3b3-b185d00a0e94', '26cd62e2-ba67-459f-bcea-9094242ff031', 'recommended', 'Showroom', '2025-08-09 18:25:41.600451');
INSERT INTO public.master_product_accessory_relationships VALUES ('2310ce9b-1dd5-45d8-9436-6459667e1128', '7328c6d1-3b04-45d1-aa5b-75ee4ff2165d', '8c73922e-377a-4dfa-9f8d-19ff072e2aed', 'compatible', 'Equipment', '2025-08-09 18:25:42.204476');
INSERT INTO public.master_product_accessory_relationships VALUES ('beab4c45-a534-4376-b470-7d52d64d08b0', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', 'd3b7ec9f-5a2d-48bd-b3f1-f304edcf32eb', 'compatible', 'Equipment', '2025-08-09 18:25:42.331278');
INSERT INTO public.master_product_accessory_relationships VALUES ('f8317d36-1dca-47d2-bf42-ed3f2cb19de7', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', '9738a370-a1c9-40f7-a5b3-3f01b312c000', 'compatible', 'Equipment', '2025-08-09 18:25:42.395571');
INSERT INTO public.master_product_accessory_relationships VALUES ('aad47b4a-c716-48cd-8dcd-bdbb7b682cec', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', '686c2dbb-a5aa-4e52-b214-eff0a0fb747f', 'compatible', 'Equipment', '2025-08-09 18:25:42.459156');
INSERT INTO public.master_product_accessory_relationships VALUES ('33d6a544-d732-4156-90b1-0bf7ef4d0920', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', 'c6868352-ac35-42cc-84ab-3f4d437308c6', 'compatible', 'Equipment', '2025-08-09 18:25:42.523149');
INSERT INTO public.master_product_accessory_relationships VALUES ('0c1db414-5245-415a-a0a1-3b89534536cd', 'dcedf307-ef36-42d7-8f7e-4353fd20803b', '8e30d20c-db96-41fd-becf-b9c6d0549354', 'compatible', 'Equipment', '2025-08-09 18:25:42.683098');
INSERT INTO public.master_product_accessory_relationships VALUES ('bc9aab93-b20f-4173-b977-a0b7971ead04', '370e8277-23a0-4069-9ef7-7e5647a32d7b', '742e7908-bcd1-44d2-95e3-cfb5b8c1b97d', 'compatible', 'Equipment', '2025-08-09 18:25:43.390712');
INSERT INTO public.master_product_accessory_relationships VALUES ('74fefd9c-f010-4b32-9e1b-f885bccf38d5', '74ee5bc7-7747-4ce2-8326-c8559ce59b02', '60e4978f-ad7f-40e6-91d1-d55c0da80153', 'compatible', 'Equipment', '2025-08-09 18:25:43.484617');
INSERT INTO public.master_product_accessory_relationships VALUES ('534d7506-af0b-4093-8269-8d89c2b39d91', 'f82057d9-dc00-4111-967d-0e4b44634b63', '08539463-3aee-446c-8c63-a399019ab5e7', 'compatible', 'Equipment', '2025-08-09 18:25:43.579571');
INSERT INTO public.master_product_accessory_relationships VALUES ('15d331ab-3bec-479e-b594-3bb48875d03a', 'f82057d9-dc00-4111-967d-0e4b44634b63', '9d78241f-f634-417c-8557-add8ad8078d1', 'compatible', 'Equipment', '2025-08-09 18:25:43.643498');
INSERT INTO public.master_product_accessory_relationships VALUES ('0d8dbf97-b33f-464d-b081-699eec46fbdd', 'f82057d9-dc00-4111-967d-0e4b44634b63', '9ff32cd5-9fe5-4a55-9e38-5bbec133d23e', 'compatible', 'Equipment', '2025-08-09 18:25:43.708879');
INSERT INTO public.master_product_accessory_relationships VALUES ('93f13f54-5982-4bde-8c25-2c6e9936f0f1', '2a160856-58b5-40b9-84df-1cd01889daef', 'aa9065a0-a812-4ce9-a3d3-6f9f2bb10c65', 'compatible', 'Equipment', '2025-08-09 18:25:43.874951');
INSERT INTO public.master_product_accessory_relationships VALUES ('ad70ff9e-5506-4a3a-82c0-20bdbe8206db', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', 'f5c57415-b1f9-4241-98f5-d6894ce7a6f3', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:44.397789');
INSERT INTO public.master_product_accessory_relationships VALUES ('5ca9e908-2116-4071-9e6b-41d7c085d304', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '061b26a8-9805-41c1-baaa-b282ad28a54c', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:44.461219');
INSERT INTO public.master_product_accessory_relationships VALUES ('09461913-7646-4360-bb64-5ec353a1c0b3', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', 'f583ab93-eee5-4a21-a8ed-06c3baaf4d8e', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:44.524752');
INSERT INTO public.master_product_accessory_relationships VALUES ('091a6a5a-0f1f-4bf5-9297-048ea1bcb224', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '1f45419d-0045-42eb-a880-3480b0ccbaef', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:44.589194');
INSERT INTO public.master_product_accessory_relationships VALUES ('6a584cb2-3b62-45f3-b3d3-0763921554d1', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '1bcb3d79-b245-4d19-962c-eac9109fa845', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:44.652495');
INSERT INTO public.master_product_accessory_relationships VALUES ('468f3dad-d947-43da-87df-7f95e99f0852', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '730775db-0292-40de-8195-c702808e0a0e', 'compatible', 'Accessories', '2025-08-09 18:25:44.716893');
INSERT INTO public.master_product_accessory_relationships VALUES ('39742f60-748a-4db9-9fc1-e7de5ea08f73', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '00ee2945-7ef4-42c8-a06d-5b89bfef19d9', 'compatible', 'Accessories', '2025-08-09 18:25:44.780077');
INSERT INTO public.master_product_accessory_relationships VALUES ('d57db2b1-4fa7-4f8c-8231-c3b644dabea4', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '6a41caa7-ddf9-4bda-aa6a-1b3e8230de4c', 'recommended', 'Showroom', '2025-08-09 18:25:45.162593');
INSERT INTO public.master_product_accessory_relationships VALUES ('8cc0160a-9df6-4f14-8e3b-ad30e58c804f', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd5701906-45a7-45fa-9f9f-cae38722f6d8', 'recommended', 'Showroom', '2025-08-09 18:25:45.227038');
INSERT INTO public.master_product_accessory_relationships VALUES ('c59a6417-4299-4936-aad4-06a65b4deec8', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '90de8e54-7054-4a94-bbd5-b6f6170b7991', 'recommended', 'Showroom', '2025-08-09 18:25:45.291055');
INSERT INTO public.master_product_accessory_relationships VALUES ('43dcfd5c-0ab9-488c-8fc5-91dbb33627d3', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '0aaec45b-9b9c-463c-ad90-d810508d2df3', 'recommended', 'Showroom', '2025-08-09 18:25:45.356015');
INSERT INTO public.master_product_accessory_relationships VALUES ('b6c54783-cbd2-43a1-ab20-f0e84db66989', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '5b446d53-6444-4a97-ba85-f3b729b2715d', 'recommended', 'Showroom', '2025-08-09 18:25:45.420921');
INSERT INTO public.master_product_accessory_relationships VALUES ('c6aa3c4c-e2d2-49be-9390-f7dd8162b9e6', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '7631625d-fc5f-4561-91d6-40ae3fd74903', 'recommended', 'Showroom', '2025-08-09 18:25:45.483988');
INSERT INTO public.master_product_accessory_relationships VALUES ('03ee7358-8467-4a6b-83c3-7a1614383831', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '908df156-b1b0-4ac4-95ca-9178e1f3ce79', 'recommended', 'Showroom', '2025-08-09 18:25:45.547205');
INSERT INTO public.master_product_accessory_relationships VALUES ('5c34dd18-4ba3-4085-9d22-98f0a6fbd6b9', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'fd2baa26-e4c3-4926-99df-d968d507b077', 'recommended', 'Showroom', '2025-08-09 18:25:45.611115');
INSERT INTO public.master_product_accessory_relationships VALUES ('c48afbda-35bf-4601-bf33-2880613670ad', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd6fcad84-5906-4003-a9e3-612a7aac1c6d', 'recommended', 'Showroom', '2025-08-09 18:25:45.677408');
INSERT INTO public.master_product_accessory_relationships VALUES ('14ed9129-ec47-4fec-9738-c432211d4408', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'ae31c3a9-ea53-4093-ae6e-68209813bd42', 'recommended', 'Showroom', '2025-08-09 18:25:45.741876');
INSERT INTO public.master_product_accessory_relationships VALUES ('23f931d0-fa6b-4c14-9557-7346bd6744de', '7328c6d1-3b04-45d1-aa5b-75ee4ff2165d', '8c73922e-377a-4dfa-9f8d-19ff072e2aed', 'compatible', 'Equipment', '2025-08-09 18:25:37.427722');
INSERT INTO public.master_product_accessory_relationships VALUES ('ead54ced-d16e-4d87-863d-98bc72107dac', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', 'd3b7ec9f-5a2d-48bd-b3f1-f304edcf32eb', 'compatible', 'Equipment', '2025-08-09 18:25:37.568853');
INSERT INTO public.master_product_accessory_relationships VALUES ('afd39e27-0421-4d45-bf18-c00ce7b568f0', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', '9738a370-a1c9-40f7-a5b3-3f01b312c000', 'compatible', 'Equipment', '2025-08-09 18:25:37.638416');
INSERT INTO public.master_product_accessory_relationships VALUES ('70454ba2-9c10-4a9a-9b65-63104c1be69f', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', '686c2dbb-a5aa-4e52-b214-eff0a0fb747f', 'compatible', 'Equipment', '2025-08-09 18:25:37.707346');
INSERT INTO public.master_product_accessory_relationships VALUES ('164627a7-d79d-499e-b937-c8fc2199002a', '0692a927-8182-44f4-91fc-8e34f4b6a7e2', 'c6868352-ac35-42cc-84ab-3f4d437308c6', 'compatible', 'Equipment', '2025-08-09 18:25:37.776181');
INSERT INTO public.master_product_accessory_relationships VALUES ('fc399054-dc9d-4407-9f15-99fdb3f4c20d', 'dcedf307-ef36-42d7-8f7e-4353fd20803b', '8e30d20c-db96-41fd-becf-b9c6d0549354', 'compatible', 'Equipment', '2025-08-09 18:25:37.948137');
INSERT INTO public.master_product_accessory_relationships VALUES ('9721675e-2d5b-4fb6-b240-1f6e8ec46698', '370e8277-23a0-4069-9ef7-7e5647a32d7b', '742e7908-bcd1-44d2-95e3-cfb5b8c1b97d', 'compatible', 'Equipment', '2025-08-09 18:25:38.743985');
INSERT INTO public.master_product_accessory_relationships VALUES ('a0588771-9cf2-4fd1-ae85-7139aa5e4810', '74ee5bc7-7747-4ce2-8326-c8559ce59b02', '60e4978f-ad7f-40e6-91d1-d55c0da80153', 'compatible', 'Equipment', '2025-08-09 18:25:38.848732');
INSERT INTO public.master_product_accessory_relationships VALUES ('12aae658-e002-469f-ad65-3a4086c36543', 'f82057d9-dc00-4111-967d-0e4b44634b63', '08539463-3aee-446c-8c63-a399019ab5e7', 'compatible', 'Equipment', '2025-08-09 18:25:38.951854');
INSERT INTO public.master_product_accessory_relationships VALUES ('5c2ada31-4759-4be7-bb3f-d1780153f34f', 'f82057d9-dc00-4111-967d-0e4b44634b63', '9d78241f-f634-417c-8557-add8ad8078d1', 'compatible', 'Equipment', '2025-08-09 18:25:39.018427');
INSERT INTO public.master_product_accessory_relationships VALUES ('05aefe19-0302-40b7-bcd6-1950b864226f', 'f82057d9-dc00-4111-967d-0e4b44634b63', '9ff32cd5-9fe5-4a55-9e38-5bbec133d23e', 'compatible', 'Equipment', '2025-08-09 18:25:39.094643');
INSERT INTO public.master_product_accessory_relationships VALUES ('a2b092c3-ecb7-4221-a487-271f40b9a7c7', '2a160856-58b5-40b9-84df-1cd01889daef', 'aa9065a0-a812-4ce9-a3d3-6f9f2bb10c65', 'compatible', 'Equipment', '2025-08-09 18:25:39.271873');
INSERT INTO public.master_product_accessory_relationships VALUES ('f28fe2b1-2e23-499c-b8c6-dc40234b792f', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', 'f5c57415-b1f9-4241-98f5-d6894ce7a6f3', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:39.824553');
INSERT INTO public.master_product_accessory_relationships VALUES ('a4b7868a-0a0f-49f8-abc5-587eb7f0387b', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '061b26a8-9805-41c1-baaa-b282ad28a54c', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:39.892771');
INSERT INTO public.master_product_accessory_relationships VALUES ('c4b3c647-0e6f-4260-837c-b4f362064125', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', 'f583ab93-eee5-4a21-a8ed-06c3baaf4d8e', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:39.961493');
INSERT INTO public.master_product_accessory_relationships VALUES ('d17ed1f4-3785-4dbd-b570-934727410ad5', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '1f45419d-0045-42eb-a880-3480b0ccbaef', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:40.030462');
INSERT INTO public.master_product_accessory_relationships VALUES ('413e4230-c5a1-42df-a9cf-80e6c74dd3a7', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '1bcb3d79-b245-4d19-962c-eac9109fa845', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:40.100192');
INSERT INTO public.master_product_accessory_relationships VALUES ('81da2042-7bed-4add-8332-c62ad4820322', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '730775db-0292-40de-8195-c702808e0a0e', 'compatible', 'Accessories', '2025-08-09 18:25:40.168904');
INSERT INTO public.master_product_accessory_relationships VALUES ('f1691893-73b4-49e7-988e-f1c5fa4751cf', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '00ee2945-7ef4-42c8-a06d-5b89bfef19d9', 'compatible', 'Accessories', '2025-08-09 18:25:40.237382');
INSERT INTO public.master_product_accessory_relationships VALUES ('70d2ff3d-2120-48b1-95b4-60e43b5ce2ff', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '6a41caa7-ddf9-4bda-aa6a-1b3e8230de4c', 'recommended', 'Showroom', '2025-08-09 18:25:40.663745');
INSERT INTO public.master_product_accessory_relationships VALUES ('d4583220-14b6-4abf-bea5-e4b5859d3889', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd5701906-45a7-45fa-9f9f-cae38722f6d8', 'recommended', 'Showroom', '2025-08-09 18:25:40.733514');
INSERT INTO public.master_product_accessory_relationships VALUES ('114ce48d-f8d3-49c6-aea8-714abb1b8c2d', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '90de8e54-7054-4a94-bbd5-b6f6170b7991', 'recommended', 'Showroom', '2025-08-09 18:25:40.805033');
INSERT INTO public.master_product_accessory_relationships VALUES ('b0c73ecc-2c8a-44bd-ae20-58c57c4905d1', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '0aaec45b-9b9c-463c-ad90-d810508d2df3', 'recommended', 'Showroom', '2025-08-09 18:25:40.874737');
INSERT INTO public.master_product_accessory_relationships VALUES ('c3fdfbd3-ccd5-4c12-9c12-25575b07aa18', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '5b446d53-6444-4a97-ba85-f3b729b2715d', 'recommended', 'Showroom', '2025-08-09 18:25:40.943078');
INSERT INTO public.master_product_accessory_relationships VALUES ('cabfcecb-c718-4f32-a83f-05e6c7d67cc3', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '7631625d-fc5f-4561-91d6-40ae3fd74903', 'recommended', 'Showroom', '2025-08-09 18:25:41.019135');
INSERT INTO public.master_product_accessory_relationships VALUES ('929bd81e-3230-4f08-b802-9d968823a270', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '908df156-b1b0-4ac4-95ca-9178e1f3ce79', 'recommended', 'Showroom', '2025-08-09 18:25:41.088311');
INSERT INTO public.master_product_accessory_relationships VALUES ('ac72a057-db04-4aa4-8134-a9a7ae23744c', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'fd2baa26-e4c3-4926-99df-d968d507b077', 'recommended', 'Showroom', '2025-08-09 18:25:41.15727');
INSERT INTO public.master_product_accessory_relationships VALUES ('e3135dcf-72f5-4361-a6ea-6cf4616f30e2', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd6fcad84-5906-4003-a9e3-612a7aac1c6d', 'recommended', 'Showroom', '2025-08-09 18:25:41.226621');
INSERT INTO public.master_product_accessory_relationships VALUES ('c7b432ed-bdf3-4db1-9495-6e7d33bc46ac', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'ae31c3a9-ea53-4093-ae6e-68209813bd42', 'recommended', 'Showroom', '2025-08-09 18:25:41.299728');
INSERT INTO public.master_product_accessory_relationships VALUES ('ba865bd0-5c7d-4564-a7fe-990159015ffd', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '136094b9-af44-42fb-906a-f9706fddd8ba', 'recommended', 'Showroom', '2025-08-09 18:25:41.370049');
INSERT INTO public.master_product_accessory_relationships VALUES ('790d67c4-a569-496c-aaa6-7de467bfe82b', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '24ee7f8f-8b3a-40e3-b867-b03b240467e6', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:41.440473');
INSERT INTO public.master_product_accessory_relationships VALUES ('720bf9a9-7e8d-4d54-9ef6-f356fa5bfc18', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd27f9ab6-ed99-408a-bb1c-bbedcd217ffc', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:41.510899');
INSERT INTO public.master_product_accessory_relationships VALUES ('37f96537-c342-41f6-96f8-8f2d59883964', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'de4cf67e-130f-4484-8bb0-98b5112a1f99', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:41.586793');
INSERT INTO public.master_product_accessory_relationships VALUES ('f2535dee-da9e-4e43-b179-3e43cb074ced', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '34ad9f04-91a0-4671-9ad5-f905684be072', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:41.655945');
INSERT INTO public.master_product_accessory_relationships VALUES ('d52249a3-8248-4550-ae64-2d429e0317df', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '38c71509-f98f-47c2-a588-1758ae90005f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:41.727553');
INSERT INTO public.master_product_accessory_relationships VALUES ('76469dbe-1929-49b9-9ed5-4589d1fd6040', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '096f024c-fa13-4be9-9243-70848c24494f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:41.797991');
INSERT INTO public.master_product_accessory_relationships VALUES ('dea0b85b-d0f0-434f-8c2c-cf573c0cf44b', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '2fe11940-7395-466e-a8f9-47ae7613adb5', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:41.868379');
INSERT INTO public.master_product_accessory_relationships VALUES ('38f94cb7-5a5a-4ef2-94f4-e9f680352af9', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '4626ee43-1b8b-4c72-88ed-b4baa6237572', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:41.937088');
INSERT INTO public.master_product_accessory_relationships VALUES ('f4392be6-a362-4efd-9aba-814763987949', 'decab237-219e-48ad-a976-7c681632af60', '8b3f422d-2170-4d5d-8fb5-c63d7a3ae249', 'recommended', 'Showroom', '2025-08-09 18:25:42.254234');
INSERT INTO public.master_product_accessory_relationships VALUES ('a7cdf569-9862-472a-93fc-ad7971037d3c', 'decab237-219e-48ad-a976-7c681632af60', 'ba02c38e-fee2-4773-a042-c8feb72c8beb', 'recommended', 'Showroom', '2025-08-09 18:25:42.324132');
INSERT INTO public.master_product_accessory_relationships VALUES ('1a40ba12-aa5f-4e3b-bd97-954baecffe4e', 'decab237-219e-48ad-a976-7c681632af60', '2f61714e-7f03-4ff4-8fa9-cdcc90f365e8', 'recommended', 'Showroom', '2025-08-09 18:25:42.392468');
INSERT INTO public.master_product_accessory_relationships VALUES ('95801442-58a2-41b0-8a09-031ee9292f21', 'decab237-219e-48ad-a976-7c681632af60', '687c3bee-f848-4e00-95b4-73ad4ec2fddc', 'recommended', 'Showroom', '2025-08-09 18:25:42.46078');
INSERT INTO public.master_product_accessory_relationships VALUES ('0fa40a99-ab6e-4da9-b2a3-f1decc786cea', 'decab237-219e-48ad-a976-7c681632af60', '402210a1-f056-4a08-99bb-b91a4aca18cf', 'recommended', 'Showroom', '2025-08-09 18:25:42.528659');
INSERT INTO public.master_product_accessory_relationships VALUES ('be011140-12d0-4c08-bfda-acd5b0a22913', '7f72c046-52f0-4186-be27-4953a0ec50c7', '8806f115-e4da-45ef-a56c-0934da7b50e9', 'recommended', 'Showroom', '2025-08-09 18:25:42.944727');
INSERT INTO public.master_product_accessory_relationships VALUES ('17403358-8ab6-41d8-957d-26c5ff597c10', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'e001643a-5f92-4950-b845-ee1ed7f4948f', 'recommended', 'Showroom', '2025-08-09 18:25:43.014025');
INSERT INTO public.master_product_accessory_relationships VALUES ('164a48f1-3713-4084-88cc-aa1920d93ab6', '7f72c046-52f0-4186-be27-4953a0ec50c7', '8148eac8-902c-4069-8c1a-33e7108f5e95', 'recommended', 'Showroom', '2025-08-09 18:25:43.082509');
INSERT INTO public.master_product_accessory_relationships VALUES ('7fc973c1-91ac-4a95-b757-7fa7828d657f', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'cc0b55d9-4c5f-40eb-bda5-9342d938cea3', 'recommended', 'Showroom', '2025-08-09 18:25:43.158074');
INSERT INTO public.master_product_accessory_relationships VALUES ('a2b55dce-f346-44ad-8cad-4fdfe1618bb5', '7f72c046-52f0-4186-be27-4953a0ec50c7', '408113a6-5075-4ca3-b2ae-ee9f4c6cb472', 'recommended', 'Showroom', '2025-08-09 18:25:43.230148');
INSERT INTO public.master_product_accessory_relationships VALUES ('7d90dfad-e245-473d-afcc-9e24f8ee46a8', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'b44488f3-72a3-4f8d-b1c1-a45665a6e9c5', 'recommended', 'Showroom', '2025-08-09 18:25:43.298516');
INSERT INTO public.master_product_accessory_relationships VALUES ('9ded8f94-3a0b-41e4-80ad-fdc552994f5a', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'c95d4cb3-a0b6-43ca-9ee1-a154b4b5d546', 'recommended', 'Showroom', '2025-08-09 18:25:43.367097');
INSERT INTO public.master_product_accessory_relationships VALUES ('d9306c33-e01d-42ad-bc8b-38501afd1924', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'b3752fef-d901-4ec4-939e-11f19b8c186d', 'recommended', 'Showroom', '2025-08-09 18:25:43.437081');
INSERT INTO public.master_product_accessory_relationships VALUES ('59e4d124-32ac-403d-a3b9-8e5f24f24361', '7f72c046-52f0-4186-be27-4953a0ec50c7', '01d985c3-fa28-410a-bb57-cab706e5e044', 'recommended', 'Showroom', '2025-08-09 18:25:43.505435');
INSERT INTO public.master_product_accessory_relationships VALUES ('7851083b-23bc-4085-a9aa-2ad917f894df', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'edccfc66-6c8f-4491-8fd0-7ed15dcf5c64', 'recommended', 'Showroom', '2025-08-09 18:25:43.572495');
INSERT INTO public.master_product_accessory_relationships VALUES ('9c774990-6987-46d4-b0aa-5d87b830d8be', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'e7a1c8fb-bb42-40d1-8963-a8c5318b8f7d', 'recommended', 'Showroom', '2025-08-09 18:25:43.64051');
INSERT INTO public.master_product_accessory_relationships VALUES ('bb35c910-7f14-4b87-9d0a-4a8d930ef59b', '7f72c046-52f0-4186-be27-4953a0ec50c7', '9d7b288b-4a79-431c-9015-68124f434e0f', 'recommended', 'Showroom', '2025-08-09 18:25:43.710306');
INSERT INTO public.master_product_accessory_relationships VALUES ('969bcbe3-01d8-4b70-8f65-7d2511d25fc8', '7f72c046-52f0-4186-be27-4953a0ec50c7', '4630e11a-6695-4413-8dcb-1929538f2eb9', 'recommended', 'Showroom', '2025-08-09 18:25:43.780033');
INSERT INTO public.master_product_accessory_relationships VALUES ('77102fda-933f-4193-8e94-1ddb7ab163b2', 'ceb271c9-f68a-4ff3-836d-92c656a18721', 'e4c2bd4c-a81f-4e44-887a-233d6d6c0d9a', 'recommended', 'Showroom', '2025-08-09 18:25:44.068557');
INSERT INTO public.master_product_accessory_relationships VALUES ('18641c7c-b157-406a-b9f4-64d48307b4cb', 'ceb271c9-f68a-4ff3-836d-92c656a18721', '269c96c1-c683-4ef0-9539-0f21733040a7', 'recommended', 'Showroom', '2025-08-09 18:25:44.14111');
INSERT INTO public.master_product_accessory_relationships VALUES ('818aecfa-4d57-4ed2-be30-edea6e6d4f0d', 'ceb271c9-f68a-4ff3-836d-92c656a18721', '48523e9f-58b0-4b90-a190-fc457b63caf4', 'recommended', 'Showroom', '2025-08-09 18:25:44.211433');
INSERT INTO public.master_product_accessory_relationships VALUES ('bcb3660f-3206-4bc5-9ec2-4102d9257bb7', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', 'dc1da90a-9806-4c41-8ebc-fd06a90a0f7b', 'recommended', 'Showroom', '2025-08-09 18:25:44.488112');
INSERT INTO public.master_product_accessory_relationships VALUES ('71247c83-8d7c-46c4-8c7a-0bb339556d37', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', 'ff919574-bdc8-42ad-95ff-e35d060befd8', 'recommended', 'Showroom', '2025-08-09 18:25:44.557228');
INSERT INTO public.master_product_accessory_relationships VALUES ('b19e82c3-e7bd-4d86-bfb2-a0ef43456aa5', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', '5e43b879-afe7-4b2d-bb75-9f0763c1adc7', 'recommended', 'Showroom', '2025-08-09 18:25:44.631282');
INSERT INTO public.master_product_accessory_relationships VALUES ('593fcfaa-a41e-4394-8642-2211e4a61609', '05d71a06-b531-4206-95b5-eba537ffe01a', '12ed7741-71a7-4ddf-98db-02abaf05c804', 'compatible', 'Equipment', '2025-08-09 18:25:44.914886');
INSERT INTO public.master_product_accessory_relationships VALUES ('25b9cdf4-53d5-438f-8787-0671e90f20f9', '05d71a06-b531-4206-95b5-eba537ffe01a', '35e8a8e2-63cc-4f85-a6a1-067ee09c836c', 'compatible', 'Equipment', '2025-08-09 18:25:44.984203');
INSERT INTO public.master_product_accessory_relationships VALUES ('6c7a77ba-3e3f-4d25-b509-181aebd3c386', '05d71a06-b531-4206-95b5-eba537ffe01a', '55036761-c149-43d4-8857-04b42e0ce05e', 'recommended', 'Showroom', '2025-08-09 18:25:45.053732');
INSERT INTO public.master_product_accessory_relationships VALUES ('8431b269-d58e-4447-b371-4df9549704be', '05d71a06-b531-4206-95b5-eba537ffe01a', '231ff99d-756d-4092-9619-0644545bd319', 'recommended', 'Showroom', '2025-08-09 18:25:45.123053');
INSERT INTO public.master_product_accessory_relationships VALUES ('0ff66ccb-89ce-4ead-8941-1bb1059793d9', '05d71a06-b531-4206-95b5-eba537ffe01a', '76cdbc89-330c-45f6-949f-4600c63487c7', 'recommended', 'Showroom', '2025-08-09 18:25:45.192407');
INSERT INTO public.master_product_accessory_relationships VALUES ('b8bbbb61-c5dc-4710-921f-ce7bd9106649', '05d71a06-b531-4206-95b5-eba537ffe01a', '376cf9d0-2a66-4c34-b716-9336a6ff60d6', 'recommended', 'Showroom', '2025-08-09 18:25:45.261904');
INSERT INTO public.master_product_accessory_relationships VALUES ('b367b3bd-0adb-4545-a27a-ef68a7737e24', '05d71a06-b531-4206-95b5-eba537ffe01a', '04123c52-dd05-495c-a978-5a2284ddaea5', 'recommended', 'Showroom', '2025-08-09 18:25:45.329431');
INSERT INTO public.master_product_accessory_relationships VALUES ('4380dc77-3fca-4496-b372-a48dddb2a9a7', '05d71a06-b531-4206-95b5-eba537ffe01a', 'acfec99d-5cf3-4fea-abf4-5635d10609b7', 'recommended', 'Showroom', '2025-08-09 18:25:45.398753');
INSERT INTO public.master_product_accessory_relationships VALUES ('4a561586-4bdc-4ef5-85a5-c61a9fb4096a', '05d71a06-b531-4206-95b5-eba537ffe01a', 'dc84b5c0-dd63-4903-be47-7ddde2bfac92', 'recommended', 'Showroom', '2025-08-09 18:25:45.468528');
INSERT INTO public.master_product_accessory_relationships VALUES ('b4465960-457a-420b-9e6d-4fb0269ef0ba', '05d71a06-b531-4206-95b5-eba537ffe01a', '7dc77ff8-29ca-4fc4-a07d-b71034e3b693', 'recommended', 'Showroom', '2025-08-09 18:25:45.538793');
INSERT INTO public.master_product_accessory_relationships VALUES ('e5bcdd2f-c191-4935-a93e-5fbe4fe673d3', '3ce1faed-e4b5-4a7d-a19f-aa5b544e08f4', 'ef38ad83-0425-43b5-8158-d6349b134f3d', 'compatible', 'Equipment', '2025-08-09 18:25:45.953888');
INSERT INTO public.master_product_accessory_relationships VALUES ('e7e06b45-224f-4e0e-b869-13a9d38b36dd', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '136094b9-af44-42fb-906a-f9706fddd8ba', 'recommended', 'Showroom', '2025-08-09 18:25:45.806788');
INSERT INTO public.master_product_accessory_relationships VALUES ('b0749af2-db76-4066-9680-a25106c23623', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '24ee7f8f-8b3a-40e3-b867-b03b240467e6', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:45.867837');
INSERT INTO public.master_product_accessory_relationships VALUES ('82192d6c-3dc2-40d1-9e29-9b1eaf20780c', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd27f9ab6-ed99-408a-bb1c-bbedcd217ffc', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:45.932214');
INSERT INTO public.master_product_accessory_relationships VALUES ('125f2696-8110-4d48-abf9-5089afbef060', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'de4cf67e-130f-4484-8bb0-98b5112a1f99', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.000569');
INSERT INTO public.master_product_accessory_relationships VALUES ('4ab91291-510d-4665-967d-827c762bb4ae', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '34ad9f04-91a0-4671-9ad5-f905684be072', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.065145');
INSERT INTO public.master_product_accessory_relationships VALUES ('77353335-ca38-47f5-85c7-26bf5247ff1d', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '38c71509-f98f-47c2-a588-1758ae90005f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.129913');
INSERT INTO public.master_product_accessory_relationships VALUES ('161d138b-c603-4d67-991b-4fcc1a5fc07f', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '096f024c-fa13-4be9-9243-70848c24494f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.194163');
INSERT INTO public.master_product_accessory_relationships VALUES ('0d77c9dc-46c1-42ac-8f18-898b6a5a6581', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '2fe11940-7395-466e-a8f9-47ae7613adb5', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.2572');
INSERT INTO public.master_product_accessory_relationships VALUES ('6fa4b17f-9c93-4468-a1f8-b0adbd512358', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '4626ee43-1b8b-4c72-88ed-b4baa6237572', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.321237');
INSERT INTO public.master_product_accessory_relationships VALUES ('b9413976-d7da-4565-8a7e-001975515cab', 'decab237-219e-48ad-a976-7c681632af60', '8b3f422d-2170-4d5d-8fb5-c63d7a3ae249', 'recommended', 'Showroom', '2025-08-09 18:25:46.608837');
INSERT INTO public.master_product_accessory_relationships VALUES ('5647c04f-7676-481f-874b-6e134de9426f', 'decab237-219e-48ad-a976-7c681632af60', 'ba02c38e-fee2-4773-a042-c8feb72c8beb', 'recommended', 'Showroom', '2025-08-09 18:25:46.6711');
INSERT INTO public.master_product_accessory_relationships VALUES ('c533a243-3b2c-4a91-b2f9-adcef47cca5b', 'decab237-219e-48ad-a976-7c681632af60', '2f61714e-7f03-4ff4-8fa9-cdcc90f365e8', 'recommended', 'Showroom', '2025-08-09 18:25:46.734903');
INSERT INTO public.master_product_accessory_relationships VALUES ('b6890fd3-d948-4592-8e82-7f66ccda199d', 'decab237-219e-48ad-a976-7c681632af60', '687c3bee-f848-4e00-95b4-73ad4ec2fddc', 'recommended', 'Showroom', '2025-08-09 18:25:46.799989');
INSERT INTO public.master_product_accessory_relationships VALUES ('3f09c543-91aa-4e5d-b979-9addfef413d2', 'decab237-219e-48ad-a976-7c681632af60', '402210a1-f056-4a08-99bb-b91a4aca18cf', 'recommended', 'Showroom', '2025-08-09 18:25:46.864309');
INSERT INTO public.master_product_accessory_relationships VALUES ('6cf48343-e06f-450b-b0c4-960e8baec31c', '7f72c046-52f0-4186-be27-4953a0ec50c7', '8806f115-e4da-45ef-a56c-0934da7b50e9', 'recommended', 'Showroom', '2025-08-09 18:25:47.243722');
INSERT INTO public.master_product_accessory_relationships VALUES ('74bcf1e9-b08d-47ff-9b5a-19b5c54b459a', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'e001643a-5f92-4950-b845-ee1ed7f4948f', 'recommended', 'Showroom', '2025-08-09 18:25:47.307582');
INSERT INTO public.master_product_accessory_relationships VALUES ('8f8b0d25-f2b4-4c6e-980a-d4f913ee54e4', '7f72c046-52f0-4186-be27-4953a0ec50c7', '8148eac8-902c-4069-8c1a-33e7108f5e95', 'recommended', 'Showroom', '2025-08-09 18:25:47.373132');
INSERT INTO public.master_product_accessory_relationships VALUES ('c597b4ac-0fb1-4a5c-b00c-cc74ea87b1fd', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'cc0b55d9-4c5f-40eb-bda5-9342d938cea3', 'recommended', 'Showroom', '2025-08-09 18:25:47.438078');
INSERT INTO public.master_product_accessory_relationships VALUES ('5f99e7f2-a614-4f98-aab5-d1e5e129ca2f', '7f72c046-52f0-4186-be27-4953a0ec50c7', '408113a6-5075-4ca3-b2ae-ee9f4c6cb472', 'recommended', 'Showroom', '2025-08-09 18:25:47.500743');
INSERT INTO public.master_product_accessory_relationships VALUES ('981603d9-162f-41ab-ad1f-197fd80959fc', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'b44488f3-72a3-4f8d-b1c1-a45665a6e9c5', 'recommended', 'Showroom', '2025-08-09 18:25:47.565599');
INSERT INTO public.master_product_accessory_relationships VALUES ('ab8bfb7a-3ae7-4f4f-9564-62da4940466e', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'c95d4cb3-a0b6-43ca-9ee1-a154b4b5d546', 'recommended', 'Showroom', '2025-08-09 18:25:47.629837');
INSERT INTO public.master_product_accessory_relationships VALUES ('8cfb6849-5a9b-42de-a7bd-3e726bfa3089', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'b3752fef-d901-4ec4-939e-11f19b8c186d', 'recommended', 'Showroom', '2025-08-09 18:25:47.693952');
INSERT INTO public.master_product_accessory_relationships VALUES ('ca44b443-af73-4f8b-8e31-f7c1cc52abe8', '7f72c046-52f0-4186-be27-4953a0ec50c7', '01d985c3-fa28-410a-bb57-cab706e5e044', 'recommended', 'Showroom', '2025-08-09 18:25:47.75932');
INSERT INTO public.master_product_accessory_relationships VALUES ('eb793ca9-6bcb-41a5-b59d-5aca3834c751', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'edccfc66-6c8f-4491-8fd0-7ed15dcf5c64', 'recommended', 'Showroom', '2025-08-09 18:25:47.820917');
INSERT INTO public.master_product_accessory_relationships VALUES ('fb2b6049-5950-4916-97c6-56047bdf84d9', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'e7a1c8fb-bb42-40d1-8963-a8c5318b8f7d', 'recommended', 'Showroom', '2025-08-09 18:25:47.885297');
INSERT INTO public.master_product_accessory_relationships VALUES ('642b50eb-94e3-4f11-a12c-0956d5c2a1d7', '7f72c046-52f0-4186-be27-4953a0ec50c7', '9d7b288b-4a79-431c-9015-68124f434e0f', 'recommended', 'Showroom', '2025-08-09 18:25:47.949274');
INSERT INTO public.master_product_accessory_relationships VALUES ('859d48fc-86fa-4abe-9ce3-2d3ad0af4519', '7f72c046-52f0-4186-be27-4953a0ec50c7', '4630e11a-6695-4413-8dcb-1929538f2eb9', 'recommended', 'Showroom', '2025-08-09 18:25:48.013952');
INSERT INTO public.master_product_accessory_relationships VALUES ('100e15ea-c838-4c80-860e-20bacf7ba04a', 'ceb271c9-f68a-4ff3-836d-92c656a18721', 'e4c2bd4c-a81f-4e44-887a-233d6d6c0d9a', 'recommended', 'Showroom', '2025-08-09 18:25:48.284572');
INSERT INTO public.master_product_accessory_relationships VALUES ('b38f34dd-bf8c-4008-ab2a-a4c1fa0eb82b', 'ceb271c9-f68a-4ff3-836d-92c656a18721', '269c96c1-c683-4ef0-9539-0f21733040a7', 'recommended', 'Showroom', '2025-08-09 18:25:48.350723');
INSERT INTO public.master_product_accessory_relationships VALUES ('89ef5cc5-8257-42b5-9e91-c6faaad83a65', 'ceb271c9-f68a-4ff3-836d-92c656a18721', '48523e9f-58b0-4b90-a190-fc457b63caf4', 'recommended', 'Showroom', '2025-08-09 18:25:48.415797');
INSERT INTO public.master_product_accessory_relationships VALUES ('2df19765-00f9-459a-b8ed-73039b5c04c0', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', 'dc1da90a-9806-4c41-8ebc-fd06a90a0f7b', 'recommended', 'Showroom', '2025-08-09 18:25:48.678671');
INSERT INTO public.master_product_accessory_relationships VALUES ('e650a922-09b0-41ad-8f07-df84e1626c11', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', 'ff919574-bdc8-42ad-95ff-e35d060befd8', 'recommended', 'Showroom', '2025-08-09 18:25:48.743175');
INSERT INTO public.master_product_accessory_relationships VALUES ('46564378-43b1-4645-a22c-c77cadcb304f', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', '5e43b879-afe7-4b2d-bb75-9f0763c1adc7', 'recommended', 'Showroom', '2025-08-09 18:25:48.806782');
INSERT INTO public.master_product_accessory_relationships VALUES ('86ba5f21-4cb8-4fd9-90a5-7a44333081a4', '05d71a06-b531-4206-95b5-eba537ffe01a', '12ed7741-71a7-4ddf-98db-02abaf05c804', 'compatible', 'Equipment', '2025-08-09 18:25:49.062084');
INSERT INTO public.master_product_accessory_relationships VALUES ('2dc1709b-ec65-4eff-ac5f-662c11ca46ef', '05d71a06-b531-4206-95b5-eba537ffe01a', '35e8a8e2-63cc-4f85-a6a1-067ee09c836c', 'compatible', 'Equipment', '2025-08-09 18:25:49.125692');
INSERT INTO public.master_product_accessory_relationships VALUES ('7250c87d-6730-41c0-be66-facbb70a9e03', '05d71a06-b531-4206-95b5-eba537ffe01a', '55036761-c149-43d4-8857-04b42e0ce05e', 'recommended', 'Showroom', '2025-08-09 18:25:49.189009');
INSERT INTO public.master_product_accessory_relationships VALUES ('ffaf720f-a298-4d6e-8d62-1027de0ca513', '05d71a06-b531-4206-95b5-eba537ffe01a', '231ff99d-756d-4092-9619-0644545bd319', 'recommended', 'Showroom', '2025-08-09 18:25:49.252572');
INSERT INTO public.master_product_accessory_relationships VALUES ('7131f9f2-e379-4a56-b8ce-be2648a18871', '05d71a06-b531-4206-95b5-eba537ffe01a', '76cdbc89-330c-45f6-949f-4600c63487c7', 'recommended', 'Showroom', '2025-08-09 18:25:49.318172');
INSERT INTO public.master_product_accessory_relationships VALUES ('b889d3e4-9ec5-4a0c-b29e-7775570bdaba', '05d71a06-b531-4206-95b5-eba537ffe01a', '376cf9d0-2a66-4c34-b716-9336a6ff60d6', 'recommended', 'Showroom', '2025-08-09 18:25:49.380873');
INSERT INTO public.master_product_accessory_relationships VALUES ('cf0f7caf-c856-478d-a9e4-a80ef37aa04c', '05d71a06-b531-4206-95b5-eba537ffe01a', '04123c52-dd05-495c-a978-5a2284ddaea5', 'recommended', 'Showroom', '2025-08-09 18:25:49.446066');
INSERT INTO public.master_product_accessory_relationships VALUES ('3d623765-f235-4d46-ae47-327e5d9d4d02', '05d71a06-b531-4206-95b5-eba537ffe01a', 'acfec99d-5cf3-4fea-abf4-5635d10609b7', 'recommended', 'Showroom', '2025-08-09 18:25:49.510904');
INSERT INTO public.master_product_accessory_relationships VALUES ('1bb56dfa-5ed7-4197-9b68-9abdfc5f63e0', '05d71a06-b531-4206-95b5-eba537ffe01a', 'dc84b5c0-dd63-4903-be47-7ddde2bfac92', 'recommended', 'Showroom', '2025-08-09 18:25:49.573173');
INSERT INTO public.master_product_accessory_relationships VALUES ('134772cd-3d0c-406b-a9e2-82c81859e889', '05d71a06-b531-4206-95b5-eba537ffe01a', '7dc77ff8-29ca-4fc4-a07d-b71034e3b693', 'recommended', 'Showroom', '2025-08-09 18:25:49.637014');
INSERT INTO public.master_product_accessory_relationships VALUES ('ebfe7145-6067-458d-ae3a-504642b9385f', '3ce1faed-e4b5-4a7d-a19f-aa5b544e08f4', 'ef38ad83-0425-43b5-8158-d6349b134f3d', 'compatible', 'Equipment', '2025-08-09 18:25:50.028186');
INSERT INTO public.master_product_accessory_relationships VALUES ('3d110796-e6f4-4b82-bea8-f5a32e2c6902', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', 'f583ab93-eee5-4a21-a8ed-06c3baaf4d8e', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.227955');
INSERT INTO public.master_product_accessory_relationships VALUES ('4b9f9b53-894e-49e5-ba07-526a75a95d33', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '1f45419d-0045-42eb-a880-3480b0ccbaef', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.290304');
INSERT INTO public.master_product_accessory_relationships VALUES ('be0c2e0e-230d-4cb3-b792-c95da0a2440b', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '1bcb3d79-b245-4d19-962c-eac9109fa845', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.355373');
INSERT INTO public.master_product_accessory_relationships VALUES ('eb02c5a3-36cd-49fa-9dc9-b7a4257b26d3', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '730775db-0292-40de-8195-c702808e0a0e', 'compatible', 'Accessories', '2025-08-09 18:25:46.417196');
INSERT INTO public.master_product_accessory_relationships VALUES ('9dfdf573-c2f3-4907-a797-ff06c594f29a', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '00ee2945-7ef4-42c8-a06d-5b89bfef19d9', 'compatible', 'Accessories', '2025-08-09 18:25:46.479951');
INSERT INTO public.master_product_accessory_relationships VALUES ('6f717ee2-6cc8-4d5a-bd2a-32b4b528ee25', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '6a41caa7-ddf9-4bda-aa6a-1b3e8230de4c', 'recommended', 'Showroom', '2025-08-09 18:25:46.852162');
INSERT INTO public.master_product_accessory_relationships VALUES ('ba7c19b5-5fb3-45e6-8865-dab628a6b90b', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd5701906-45a7-45fa-9f9f-cae38722f6d8', 'recommended', 'Showroom', '2025-08-09 18:25:46.913494');
INSERT INTO public.master_product_accessory_relationships VALUES ('800118b2-c933-454a-9bd8-8287110ae4b6', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '90de8e54-7054-4a94-bbd5-b6f6170b7991', 'recommended', 'Showroom', '2025-08-09 18:25:46.974223');
INSERT INTO public.master_product_accessory_relationships VALUES ('71c4f222-f2c9-4179-8834-5cb88dff4742', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '0aaec45b-9b9c-463c-ad90-d810508d2df3', 'recommended', 'Showroom', '2025-08-09 18:25:47.036371');
INSERT INTO public.master_product_accessory_relationships VALUES ('7afcfde4-fc08-4374-833f-3e4a03911c18', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '5b446d53-6444-4a97-ba85-f3b729b2715d', 'recommended', 'Showroom', '2025-08-09 18:25:47.09733');
INSERT INTO public.master_product_accessory_relationships VALUES ('aa39c76d-6a0c-4d7a-8caf-7c993aa41477', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '7631625d-fc5f-4561-91d6-40ae3fd74903', 'recommended', 'Showroom', '2025-08-09 18:25:47.158566');
INSERT INTO public.master_product_accessory_relationships VALUES ('5e3721c7-3548-4c80-966b-bd4a6e9e1add', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '908df156-b1b0-4ac4-95ca-9178e1f3ce79', 'recommended', 'Showroom', '2025-08-09 18:25:47.221919');
INSERT INTO public.master_product_accessory_relationships VALUES ('0723ff92-05f0-4159-9f1f-5091d3e415af', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'fd2baa26-e4c3-4926-99df-d968d507b077', 'recommended', 'Showroom', '2025-08-09 18:25:47.283663');
INSERT INTO public.master_product_accessory_relationships VALUES ('e1d01e31-95b9-4f7e-84fd-659df3fef5f7', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd6fcad84-5906-4003-a9e3-612a7aac1c6d', 'recommended', 'Showroom', '2025-08-09 18:25:47.346037');
INSERT INTO public.master_product_accessory_relationships VALUES ('f0b59c9f-19bd-4422-b12c-6c1fb663dec9', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'ae31c3a9-ea53-4093-ae6e-68209813bd42', 'recommended', 'Showroom', '2025-08-09 18:25:47.408871');
INSERT INTO public.master_product_accessory_relationships VALUES ('5196a885-4f17-4540-8cf6-cd8425f481e2', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '136094b9-af44-42fb-906a-f9706fddd8ba', 'recommended', 'Showroom', '2025-08-09 18:25:47.470962');
INSERT INTO public.master_product_accessory_relationships VALUES ('e55a7128-a414-47b3-8a4e-93d3847a168a', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '24ee7f8f-8b3a-40e3-b867-b03b240467e6', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.533733');
INSERT INTO public.master_product_accessory_relationships VALUES ('58ecbe86-46da-4100-a979-b1c91b259d50', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd27f9ab6-ed99-408a-bb1c-bbedcd217ffc', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.595941');
INSERT INTO public.master_product_accessory_relationships VALUES ('d66fa122-c9f5-497e-8715-7135202c6b66', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'de4cf67e-130f-4484-8bb0-98b5112a1f99', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.659987');
INSERT INTO public.master_product_accessory_relationships VALUES ('d188f708-e1c9-408e-87c8-eb3019eb78f9', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '34ad9f04-91a0-4671-9ad5-f905684be072', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.722801');
INSERT INTO public.master_product_accessory_relationships VALUES ('fdef108d-3888-4107-bf02-35294e6eb059', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '38c71509-f98f-47c2-a588-1758ae90005f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.785933');
INSERT INTO public.master_product_accessory_relationships VALUES ('8a845688-f547-45bd-9c20-4d819dbf1043', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '096f024c-fa13-4be9-9243-70848c24494f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.847981');
INSERT INTO public.master_product_accessory_relationships VALUES ('e8c76205-5cea-4a71-b6b3-cacf27bfbf83', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '2fe11940-7395-466e-a8f9-47ae7613adb5', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.911812');
INSERT INTO public.master_product_accessory_relationships VALUES ('c931999c-8357-40f1-87ee-8bc68a520e13', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '4626ee43-1b8b-4c72-88ed-b4baa6237572', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.973296');
INSERT INTO public.master_product_accessory_relationships VALUES ('25e9d93e-2c19-4f09-a30d-5cef0d01c680', 'decab237-219e-48ad-a976-7c681632af60', '8b3f422d-2170-4d5d-8fb5-c63d7a3ae249', 'recommended', 'Showroom', '2025-08-09 18:25:48.301139');
INSERT INTO public.master_product_accessory_relationships VALUES ('df908eaa-1772-4c3d-8637-6ffc04f3b8f2', 'decab237-219e-48ad-a976-7c681632af60', 'ba02c38e-fee2-4773-a042-c8feb72c8beb', 'recommended', 'Showroom', '2025-08-09 18:25:48.366572');
INSERT INTO public.master_product_accessory_relationships VALUES ('3aa067cc-ebf7-4ab2-9fc1-0b96bee98edd', 'decab237-219e-48ad-a976-7c681632af60', '2f61714e-7f03-4ff4-8fa9-cdcc90f365e8', 'recommended', 'Showroom', '2025-08-09 18:25:48.428925');
INSERT INTO public.master_product_accessory_relationships VALUES ('ec968fcf-997f-4342-a85c-ed6c26e89a35', 'decab237-219e-48ad-a976-7c681632af60', '687c3bee-f848-4e00-95b4-73ad4ec2fddc', 'recommended', 'Showroom', '2025-08-09 18:25:48.492173');
INSERT INTO public.master_product_accessory_relationships VALUES ('f7d22aaf-ff87-489f-ac11-2be5255d53bc', 'decab237-219e-48ad-a976-7c681632af60', '402210a1-f056-4a08-99bb-b91a4aca18cf', 'recommended', 'Showroom', '2025-08-09 18:25:48.555034');
INSERT INTO public.master_product_accessory_relationships VALUES ('fc5eff37-eee0-491b-89f0-dea5d049c964', '7f72c046-52f0-4186-be27-4953a0ec50c7', '8806f115-e4da-45ef-a56c-0934da7b50e9', 'recommended', 'Showroom', '2025-08-09 18:25:48.932467');
INSERT INTO public.master_product_accessory_relationships VALUES ('12fd7853-5bf3-4759-a16d-080982335b22', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'e001643a-5f92-4950-b845-ee1ed7f4948f', 'recommended', 'Showroom', '2025-08-09 18:25:48.996101');
INSERT INTO public.master_product_accessory_relationships VALUES ('4b90a429-b1b4-4f77-a1ae-3ff53d74a21a', '7f72c046-52f0-4186-be27-4953a0ec50c7', '8148eac8-902c-4069-8c1a-33e7108f5e95', 'recommended', 'Showroom', '2025-08-09 18:25:49.061186');
INSERT INTO public.master_product_accessory_relationships VALUES ('63576c73-7cda-41c3-b63c-642b2f978e92', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'cc0b55d9-4c5f-40eb-bda5-9342d938cea3', 'recommended', 'Showroom', '2025-08-09 18:25:49.122301');
INSERT INTO public.master_product_accessory_relationships VALUES ('dbb72a71-71b9-499f-b447-68aabe9b6875', '7f72c046-52f0-4186-be27-4953a0ec50c7', '408113a6-5075-4ca3-b2ae-ee9f4c6cb472', 'recommended', 'Showroom', '2025-08-09 18:25:49.185046');
INSERT INTO public.master_product_accessory_relationships VALUES ('e1a34952-1a95-4733-a34e-da25f0920c91', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'b44488f3-72a3-4f8d-b1c1-a45665a6e9c5', 'recommended', 'Showroom', '2025-08-09 18:25:49.24795');
INSERT INTO public.master_product_accessory_relationships VALUES ('250bc95e-f55e-48ff-b3df-03d9a409d2fa', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'c95d4cb3-a0b6-43ca-9ee1-a154b4b5d546', 'recommended', 'Showroom', '2025-08-09 18:25:49.316284');
INSERT INTO public.master_product_accessory_relationships VALUES ('973a74a4-a798-442c-aaa0-5f3afe3b51cb', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'b3752fef-d901-4ec4-939e-11f19b8c186d', 'recommended', 'Showroom', '2025-08-09 18:25:49.380098');
INSERT INTO public.master_product_accessory_relationships VALUES ('1f5ca615-8ed2-4b48-97c2-0dcb39f1422a', '7f72c046-52f0-4186-be27-4953a0ec50c7', '01d985c3-fa28-410a-bb57-cab706e5e044', 'recommended', 'Showroom', '2025-08-09 18:25:49.445193');
INSERT INTO public.master_product_accessory_relationships VALUES ('9c362bd5-9cb6-4459-9e1e-01a098c0e1bf', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'edccfc66-6c8f-4491-8fd0-7ed15dcf5c64', 'recommended', 'Showroom', '2025-08-09 18:25:49.508381');
INSERT INTO public.master_product_accessory_relationships VALUES ('8c3df3a8-305f-4c22-b0ae-4cd1fd455446', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'e7a1c8fb-bb42-40d1-8963-a8c5318b8f7d', 'recommended', 'Showroom', '2025-08-09 18:25:49.571185');
INSERT INTO public.master_product_accessory_relationships VALUES ('fa3642c0-4992-461a-b308-ebcf4d289f7e', '7f72c046-52f0-4186-be27-4953a0ec50c7', '9d7b288b-4a79-431c-9015-68124f434e0f', 'recommended', 'Showroom', '2025-08-09 18:25:49.636643');
INSERT INTO public.master_product_accessory_relationships VALUES ('9b88d78b-d171-41ba-96a0-ee0cee30bce8', '7f72c046-52f0-4186-be27-4953a0ec50c7', '4630e11a-6695-4413-8dcb-1929538f2eb9', 'recommended', 'Showroom', '2025-08-09 18:25:49.701183');
INSERT INTO public.master_product_accessory_relationships VALUES ('89de7289-688f-441f-a999-70357cb7e175', 'ceb271c9-f68a-4ff3-836d-92c656a18721', 'e4c2bd4c-a81f-4e44-887a-233d6d6c0d9a', 'recommended', 'Showroom', '2025-08-09 18:25:49.954253');
INSERT INTO public.master_product_accessory_relationships VALUES ('6f463c25-1b51-49a7-bd97-bb3b748fb86e', 'ceb271c9-f68a-4ff3-836d-92c656a18721', '269c96c1-c683-4ef0-9539-0f21733040a7', 'recommended', 'Showroom', '2025-08-09 18:25:50.01674');
INSERT INTO public.master_product_accessory_relationships VALUES ('da242099-c414-4da5-bd22-f1413ce28ae9', 'ceb271c9-f68a-4ff3-836d-92c656a18721', '48523e9f-58b0-4b90-a190-fc457b63caf4', 'recommended', 'Showroom', '2025-08-09 18:25:50.079936');
INSERT INTO public.master_product_accessory_relationships VALUES ('7e360c59-88a7-4c0b-8d21-24c9ba50d0c6', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', 'dc1da90a-9806-4c41-8ebc-fd06a90a0f7b', 'recommended', 'Showroom', '2025-08-09 18:25:50.338357');
INSERT INTO public.master_product_accessory_relationships VALUES ('9116cf5b-55d9-4fb7-8360-782384f5aaf8', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '730775db-0292-40de-8195-c702808e0a0e', 'compatible', 'Accessories', '2025-08-09 18:25:46.247942');
INSERT INTO public.master_product_accessory_relationships VALUES ('e870edec-5b60-421d-a408-48bff96e24a4', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '00ee2945-7ef4-42c8-a06d-5b89bfef19d9', 'compatible', 'Accessories', '2025-08-09 18:25:46.310471');
INSERT INTO public.master_product_accessory_relationships VALUES ('937c2159-0530-431a-8e83-ee2f6f570ab5', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '6a41caa7-ddf9-4bda-aa6a-1b3e8230de4c', 'recommended', 'Showroom', '2025-08-09 18:25:46.688853');
INSERT INTO public.master_product_accessory_relationships VALUES ('6614cec6-fc10-4606-b28c-ab821b3d6287', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd5701906-45a7-45fa-9f9f-cae38722f6d8', 'recommended', 'Showroom', '2025-08-09 18:25:46.750623');
INSERT INTO public.master_product_accessory_relationships VALUES ('7b2b0964-560c-4cc5-ae8f-81c7c09fb499', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '90de8e54-7054-4a94-bbd5-b6f6170b7991', 'recommended', 'Showroom', '2025-08-09 18:25:46.812814');
INSERT INTO public.master_product_accessory_relationships VALUES ('51c1f783-41a3-40a7-90e4-20a2c4cb1bab', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '0aaec45b-9b9c-463c-ad90-d810508d2df3', 'recommended', 'Showroom', '2025-08-09 18:25:46.874594');
INSERT INTO public.master_product_accessory_relationships VALUES ('a87e15d8-d530-4061-be1f-a8abe83c0526', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '5b446d53-6444-4a97-ba85-f3b729b2715d', 'recommended', 'Showroom', '2025-08-09 18:25:46.936222');
INSERT INTO public.master_product_accessory_relationships VALUES ('e87d7ac5-916c-47b0-90ba-871308394ae7', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '7631625d-fc5f-4561-91d6-40ae3fd74903', 'recommended', 'Showroom', '2025-08-09 18:25:46.997381');
INSERT INTO public.master_product_accessory_relationships VALUES ('b06607b9-9c09-4f59-9f0c-a3b779d40ba0', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '908df156-b1b0-4ac4-95ca-9178e1f3ce79', 'recommended', 'Showroom', '2025-08-09 18:25:47.059228');
INSERT INTO public.master_product_accessory_relationships VALUES ('c1830ef4-7bfa-4c1c-bd91-4311c3ea8e18', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'fd2baa26-e4c3-4926-99df-d968d507b077', 'recommended', 'Showroom', '2025-08-09 18:25:47.121398');
INSERT INTO public.master_product_accessory_relationships VALUES ('95f9ab5e-baa0-41ba-bc2b-e5472620ee29', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd6fcad84-5906-4003-a9e3-612a7aac1c6d', 'recommended', 'Showroom', '2025-08-09 18:25:47.181253');
INSERT INTO public.master_product_accessory_relationships VALUES ('86703716-566e-4b63-9382-e67f079dedc2', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'ae31c3a9-ea53-4093-ae6e-68209813bd42', 'recommended', 'Showroom', '2025-08-09 18:25:47.243181');
INSERT INTO public.master_product_accessory_relationships VALUES ('e4c65442-2171-4148-9b8b-020d064380db', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '136094b9-af44-42fb-906a-f9706fddd8ba', 'recommended', 'Showroom', '2025-08-09 18:25:47.304518');
INSERT INTO public.master_product_accessory_relationships VALUES ('e3383c45-9ad4-48ba-9841-a25308089cc9', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '24ee7f8f-8b3a-40e3-b867-b03b240467e6', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.367454');
INSERT INTO public.master_product_accessory_relationships VALUES ('c365cbfd-98cb-4ad8-a331-020a82137831', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd27f9ab6-ed99-408a-bb1c-bbedcd217ffc', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.430179');
INSERT INTO public.master_product_accessory_relationships VALUES ('aece494b-eb21-459e-9d47-2d70f3730d59', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'de4cf67e-130f-4484-8bb0-98b5112a1f99', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.492484');
INSERT INTO public.master_product_accessory_relationships VALUES ('f4f87d5a-cffe-413e-a357-0615cb22753e', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '34ad9f04-91a0-4671-9ad5-f905684be072', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.554577');
INSERT INTO public.master_product_accessory_relationships VALUES ('5f11a390-23ac-49d8-a09f-43816fca8f5e', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '38c71509-f98f-47c2-a588-1758ae90005f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.616769');
INSERT INTO public.master_product_accessory_relationships VALUES ('2d332547-cca8-4c91-aace-2710f9053f2b', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '096f024c-fa13-4be9-9243-70848c24494f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.679722');
INSERT INTO public.master_product_accessory_relationships VALUES ('6fe5664e-ce00-402c-9adb-740abcddf083', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '2fe11940-7395-466e-a8f9-47ae7613adb5', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.743374');
INSERT INTO public.master_product_accessory_relationships VALUES ('6bb14909-8d00-40de-acb6-8212930e4694', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '4626ee43-1b8b-4c72-88ed-b4baa6237572', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.812546');
INSERT INTO public.master_product_accessory_relationships VALUES ('8fbc3d73-5fe1-479a-8a55-d262fd25861e', 'decab237-219e-48ad-a976-7c681632af60', '8b3f422d-2170-4d5d-8fb5-c63d7a3ae249', 'recommended', 'Showroom', '2025-08-09 18:25:48.09603');
INSERT INTO public.master_product_accessory_relationships VALUES ('df3bfeb3-d9c4-4fd5-9e83-af6f9d142353', 'decab237-219e-48ad-a976-7c681632af60', 'ba02c38e-fee2-4773-a042-c8feb72c8beb', 'recommended', 'Showroom', '2025-08-09 18:25:48.160461');
INSERT INTO public.master_product_accessory_relationships VALUES ('70eacab6-6b6c-456d-b44a-87ffe487d89c', 'decab237-219e-48ad-a976-7c681632af60', '2f61714e-7f03-4ff4-8fa9-cdcc90f365e8', 'recommended', 'Showroom', '2025-08-09 18:25:48.22364');
INSERT INTO public.master_product_accessory_relationships VALUES ('4d7320f7-c084-4439-bfd1-3b905b34d34e', 'decab237-219e-48ad-a976-7c681632af60', '687c3bee-f848-4e00-95b4-73ad4ec2fddc', 'recommended', 'Showroom', '2025-08-09 18:25:48.304293');
INSERT INTO public.master_product_accessory_relationships VALUES ('f3041b03-20f2-4552-ad9e-ed1518939cf2', 'decab237-219e-48ad-a976-7c681632af60', '402210a1-f056-4a08-99bb-b91a4aca18cf', 'recommended', 'Showroom', '2025-08-09 18:25:48.368102');
INSERT INTO public.master_product_accessory_relationships VALUES ('73a12f74-5b41-42ee-9af1-f03c98558933', '7f72c046-52f0-4186-be27-4953a0ec50c7', '8806f115-e4da-45ef-a56c-0934da7b50e9', 'recommended', 'Showroom', '2025-08-09 18:25:48.756001');
INSERT INTO public.master_product_accessory_relationships VALUES ('c6ec3496-451d-497a-829c-7df2f9ed56a4', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'e001643a-5f92-4950-b845-ee1ed7f4948f', 'recommended', 'Showroom', '2025-08-09 18:25:48.819528');
INSERT INTO public.master_product_accessory_relationships VALUES ('ad7f82f1-2d7f-427c-81c2-b9a237e8885d', '7f72c046-52f0-4186-be27-4953a0ec50c7', '8148eac8-902c-4069-8c1a-33e7108f5e95', 'recommended', 'Showroom', '2025-08-09 18:25:48.882489');
INSERT INTO public.master_product_accessory_relationships VALUES ('ded1bd65-58ae-4b69-9ca3-84deef6761d1', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'cc0b55d9-4c5f-40eb-bda5-9342d938cea3', 'recommended', 'Showroom', '2025-08-09 18:25:48.947536');
INSERT INTO public.master_product_accessory_relationships VALUES ('840fc89c-aeb7-4a98-8ba7-75212228eda0', '7f72c046-52f0-4186-be27-4953a0ec50c7', '408113a6-5075-4ca3-b2ae-ee9f4c6cb472', 'recommended', 'Showroom', '2025-08-09 18:25:49.011483');
INSERT INTO public.master_product_accessory_relationships VALUES ('1513bd5d-e183-407d-b1de-421ca445943e', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'b44488f3-72a3-4f8d-b1c1-a45665a6e9c5', 'recommended', 'Showroom', '2025-08-09 18:25:49.074119');
INSERT INTO public.master_product_accessory_relationships VALUES ('ef55e077-8f57-4432-812e-0e7e92006440', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'c95d4cb3-a0b6-43ca-9ee1-a154b4b5d546', 'recommended', 'Showroom', '2025-08-09 18:25:49.135902');
INSERT INTO public.master_product_accessory_relationships VALUES ('90920256-4685-4237-8145-6f5dd88dd050', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'b3752fef-d901-4ec4-939e-11f19b8c186d', 'recommended', 'Showroom', '2025-08-09 18:25:49.198715');
INSERT INTO public.master_product_accessory_relationships VALUES ('b133202a-9b18-4d0b-b54d-75f29c16156f', '7f72c046-52f0-4186-be27-4953a0ec50c7', '01d985c3-fa28-410a-bb57-cab706e5e044', 'recommended', 'Showroom', '2025-08-09 18:25:49.261803');
INSERT INTO public.master_product_accessory_relationships VALUES ('56106c81-f05f-44fe-bb1c-6a3fbdef2c8f', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'edccfc66-6c8f-4491-8fd0-7ed15dcf5c64', 'recommended', 'Showroom', '2025-08-09 18:25:49.323095');
INSERT INTO public.master_product_accessory_relationships VALUES ('7f6ed30e-12a5-4d0a-b0bf-a224b74e1969', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'e7a1c8fb-bb42-40d1-8963-a8c5318b8f7d', 'recommended', 'Showroom', '2025-08-09 18:25:49.384536');
INSERT INTO public.master_product_accessory_relationships VALUES ('c3a0979a-2f7a-4dca-a82f-8524b8ccb8a8', '7f72c046-52f0-4186-be27-4953a0ec50c7', '9d7b288b-4a79-431c-9015-68124f434e0f', 'recommended', 'Showroom', '2025-08-09 18:25:49.445656');
INSERT INTO public.master_product_accessory_relationships VALUES ('34e5d534-a470-4cb0-ba2b-eaf36b7ee378', '7f72c046-52f0-4186-be27-4953a0ec50c7', '4630e11a-6695-4413-8dcb-1929538f2eb9', 'recommended', 'Showroom', '2025-08-09 18:25:49.507704');
INSERT INTO public.master_product_accessory_relationships VALUES ('e02907ca-561b-4040-a7d6-3c261aa99fde', 'ceb271c9-f68a-4ff3-836d-92c656a18721', 'e4c2bd4c-a81f-4e44-887a-233d6d6c0d9a', 'recommended', 'Showroom', '2025-08-09 18:25:49.763552');
INSERT INTO public.master_product_accessory_relationships VALUES ('456333bb-ef58-4439-a622-cbca09790812', 'ceb271c9-f68a-4ff3-836d-92c656a18721', '269c96c1-c683-4ef0-9539-0f21733040a7', 'recommended', 'Showroom', '2025-08-09 18:25:49.826123');
INSERT INTO public.master_product_accessory_relationships VALUES ('b4bc4c9c-a9b8-42c2-a645-46e74bc357c0', 'ceb271c9-f68a-4ff3-836d-92c656a18721', '48523e9f-58b0-4b90-a190-fc457b63caf4', 'recommended', 'Showroom', '2025-08-09 18:25:49.889015');
INSERT INTO public.master_product_accessory_relationships VALUES ('f3f5372e-057e-4094-9d19-e16e573a2995', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', 'dc1da90a-9806-4c41-8ebc-fd06a90a0f7b', 'recommended', 'Showroom', '2025-08-09 18:25:50.140324');
INSERT INTO public.master_product_accessory_relationships VALUES ('70ea24e9-59bb-428c-b249-e21a61a4f02d', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', 'ff919574-bdc8-42ad-95ff-e35d060befd8', 'recommended', 'Showroom', '2025-08-09 18:25:50.202663');
INSERT INTO public.master_product_accessory_relationships VALUES ('340112db-dd6a-4bae-957d-4e80986e5880', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', '5e43b879-afe7-4b2d-bb75-9f0763c1adc7', 'recommended', 'Showroom', '2025-08-09 18:25:50.271138');
INSERT INTO public.master_product_accessory_relationships VALUES ('0d5bd306-d07b-400b-8ef1-7289cacab488', '05d71a06-b531-4206-95b5-eba537ffe01a', '12ed7741-71a7-4ddf-98db-02abaf05c804', 'compatible', 'Equipment', '2025-08-09 18:25:50.537006');
INSERT INTO public.master_product_accessory_relationships VALUES ('4ed3f1f3-ceb7-4824-89de-3095c2706113', '05d71a06-b531-4206-95b5-eba537ffe01a', '35e8a8e2-63cc-4f85-a6a1-067ee09c836c', 'compatible', 'Equipment', '2025-08-09 18:25:50.599186');
INSERT INTO public.master_product_accessory_relationships VALUES ('a69a9308-a7e8-44e2-ac12-56549193700b', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '1bcb3d79-b245-4d19-962c-eac9109fa845', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:46.756522');
INSERT INTO public.master_product_accessory_relationships VALUES ('b1f83c9b-e656-4ea4-8a79-5a000e531bfc', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '730775db-0292-40de-8195-c702808e0a0e', 'compatible', 'Accessories', '2025-08-09 18:25:46.820409');
INSERT INTO public.master_product_accessory_relationships VALUES ('98d1283b-4107-4b64-8686-f7dfedacf03e', '4be7c2b9-b0f1-4c30-8e62-bcf94283952a', '00ee2945-7ef4-42c8-a06d-5b89bfef19d9', 'compatible', 'Accessories', '2025-08-09 18:25:46.883752');
INSERT INTO public.master_product_accessory_relationships VALUES ('4be838ef-bfe4-457a-864c-ab1ab8f0e76e', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '6a41caa7-ddf9-4bda-aa6a-1b3e8230de4c', 'recommended', 'Showroom', '2025-08-09 18:25:47.274218');
INSERT INTO public.master_product_accessory_relationships VALUES ('0643527c-b99a-42c4-89e4-b8e36aaa55b2', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd5701906-45a7-45fa-9f9f-cae38722f6d8', 'recommended', 'Showroom', '2025-08-09 18:25:47.339886');
INSERT INTO public.master_product_accessory_relationships VALUES ('88d76848-ec22-4f28-a2d0-5af03956def5', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '90de8e54-7054-4a94-bbd5-b6f6170b7991', 'recommended', 'Showroom', '2025-08-09 18:25:47.406134');
INSERT INTO public.master_product_accessory_relationships VALUES ('168a14c0-f186-4372-bb22-cc82fbea4668', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '0aaec45b-9b9c-463c-ad90-d810508d2df3', 'recommended', 'Showroom', '2025-08-09 18:25:47.471443');
INSERT INTO public.master_product_accessory_relationships VALUES ('4b4ebdc3-f34e-4078-b124-c9942c87837c', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '5b446d53-6444-4a97-ba85-f3b729b2715d', 'recommended', 'Showroom', '2025-08-09 18:25:47.536242');
INSERT INTO public.master_product_accessory_relationships VALUES ('39f4b84a-7e31-4c12-b37d-8b5330c162ef', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '7631625d-fc5f-4561-91d6-40ae3fd74903', 'recommended', 'Showroom', '2025-08-09 18:25:47.600057');
INSERT INTO public.master_product_accessory_relationships VALUES ('a2e8f7d6-65a4-4233-9b2a-0772017cfd00', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '908df156-b1b0-4ac4-95ca-9178e1f3ce79', 'recommended', 'Showroom', '2025-08-09 18:25:47.664285');
INSERT INTO public.master_product_accessory_relationships VALUES ('ce450f48-d95b-4550-9380-6452c27b3156', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'fd2baa26-e4c3-4926-99df-d968d507b077', 'recommended', 'Showroom', '2025-08-09 18:25:47.729487');
INSERT INTO public.master_product_accessory_relationships VALUES ('52162f5a-35a5-4337-bfc9-cfefc03ba4d5', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd6fcad84-5906-4003-a9e3-612a7aac1c6d', 'recommended', 'Showroom', '2025-08-09 18:25:47.796779');
INSERT INTO public.master_product_accessory_relationships VALUES ('a237ecce-28c9-4925-b5c2-b977a133d42e', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'ae31c3a9-ea53-4093-ae6e-68209813bd42', 'recommended', 'Showroom', '2025-08-09 18:25:47.862295');
INSERT INTO public.master_product_accessory_relationships VALUES ('78fc8006-cd19-4fff-a0c5-8cb5c94f3055', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '136094b9-af44-42fb-906a-f9706fddd8ba', 'recommended', 'Showroom', '2025-08-09 18:25:47.924509');
INSERT INTO public.master_product_accessory_relationships VALUES ('76bf8501-70a2-4540-a13a-681ee1715134', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '24ee7f8f-8b3a-40e3-b867-b03b240467e6', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:47.989006');
INSERT INTO public.master_product_accessory_relationships VALUES ('1b2573f1-11f1-446b-9bee-2b4f3fdcf303', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'd27f9ab6-ed99-408a-bb1c-bbedcd217ffc', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:48.054201');
INSERT INTO public.master_product_accessory_relationships VALUES ('633a14f5-4d3b-4485-8cbe-bf670a9d59ba', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', 'de4cf67e-130f-4484-8bb0-98b5112a1f99', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:48.12965');
INSERT INTO public.master_product_accessory_relationships VALUES ('3c654646-7232-45ce-b0cf-b815a03b8f4c', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '34ad9f04-91a0-4671-9ad5-f905684be072', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:48.193204');
INSERT INTO public.master_product_accessory_relationships VALUES ('cfbd9149-704c-4c0c-9c3e-10f12c846ae1', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '38c71509-f98f-47c2-a588-1758ae90005f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:48.256948');
INSERT INTO public.master_product_accessory_relationships VALUES ('6d6fe234-c604-4433-97b8-313f2a945a8e', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '096f024c-fa13-4be9-9243-70848c24494f', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:48.334463');
INSERT INTO public.master_product_accessory_relationships VALUES ('7234561a-0b61-4337-8ed3-a81c9106a487', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '2fe11940-7395-466e-a8f9-47ae7613adb5', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:48.399164');
INSERT INTO public.master_product_accessory_relationships VALUES ('c07e8b8a-53ce-4b09-82e0-55531ae68745', 'fb9596ed-a29e-43a1-abf9-804a8bd0651a', '4626ee43-1b8b-4c72-88ed-b4baa6237572', 'compatible', 'Hardware Accessories', '2025-08-09 18:25:48.466726');
INSERT INTO public.master_product_accessory_relationships VALUES ('b7431bd5-5ff7-4531-94fc-3320732e6fe3', 'decab237-219e-48ad-a976-7c681632af60', '8b3f422d-2170-4d5d-8fb5-c63d7a3ae249', 'recommended', 'Showroom', '2025-08-09 18:25:48.76133');
INSERT INTO public.master_product_accessory_relationships VALUES ('637aef84-875e-47dc-8234-949bae8f7fe7', 'decab237-219e-48ad-a976-7c681632af60', 'ba02c38e-fee2-4773-a042-c8feb72c8beb', 'recommended', 'Showroom', '2025-08-09 18:25:48.824966');
INSERT INTO public.master_product_accessory_relationships VALUES ('2f5501c4-f18b-4f79-8ba0-0471764e8451', 'decab237-219e-48ad-a976-7c681632af60', '2f61714e-7f03-4ff4-8fa9-cdcc90f365e8', 'recommended', 'Showroom', '2025-08-09 18:25:48.889467');
INSERT INTO public.master_product_accessory_relationships VALUES ('8f18783f-115c-40da-8f0e-528cfdc106e2', 'decab237-219e-48ad-a976-7c681632af60', '687c3bee-f848-4e00-95b4-73ad4ec2fddc', 'recommended', 'Showroom', '2025-08-09 18:25:48.954252');
INSERT INTO public.master_product_accessory_relationships VALUES ('1dd76fdf-a4c3-4100-ade8-d88b3fa5a4b3', 'decab237-219e-48ad-a976-7c681632af60', '402210a1-f056-4a08-99bb-b91a4aca18cf', 'recommended', 'Showroom', '2025-08-09 18:25:49.020322');
INSERT INTO public.master_product_accessory_relationships VALUES ('cf3b530a-4b2d-46d2-bdc8-d83dcfd08d0e', '7f72c046-52f0-4186-be27-4953a0ec50c7', '8806f115-e4da-45ef-a56c-0934da7b50e9', 'recommended', 'Showroom', '2025-08-09 18:25:49.41651');
INSERT INTO public.master_product_accessory_relationships VALUES ('9d70c801-36ba-4e2c-8664-9da60dfff946', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'e001643a-5f92-4950-b845-ee1ed7f4948f', 'recommended', 'Showroom', '2025-08-09 18:25:49.479246');
INSERT INTO public.master_product_accessory_relationships VALUES ('428564fe-961f-4d9c-8fbc-d275d789e7bd', '7f72c046-52f0-4186-be27-4953a0ec50c7', '8148eac8-902c-4069-8c1a-33e7108f5e95', 'recommended', 'Showroom', '2025-08-09 18:25:49.542691');
INSERT INTO public.master_product_accessory_relationships VALUES ('758cb4c7-48d7-4045-83f5-a229263b8294', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'cc0b55d9-4c5f-40eb-bda5-9342d938cea3', 'recommended', 'Showroom', '2025-08-09 18:25:49.606576');
INSERT INTO public.master_product_accessory_relationships VALUES ('4712aa66-6661-46f8-9024-f783c3c2abda', '7f72c046-52f0-4186-be27-4953a0ec50c7', '408113a6-5075-4ca3-b2ae-ee9f4c6cb472', 'recommended', 'Showroom', '2025-08-09 18:25:49.671212');
INSERT INTO public.master_product_accessory_relationships VALUES ('68e33503-001f-4551-8cc3-5ba613f260e5', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'b44488f3-72a3-4f8d-b1c1-a45665a6e9c5', 'recommended', 'Showroom', '2025-08-09 18:25:49.736062');
INSERT INTO public.master_product_accessory_relationships VALUES ('30c47811-38bb-48d0-b569-1776f5ed17d4', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'c95d4cb3-a0b6-43ca-9ee1-a154b4b5d546', 'recommended', 'Showroom', '2025-08-09 18:25:49.799907');
INSERT INTO public.master_product_accessory_relationships VALUES ('e8206933-113b-42c6-b54b-d4debcbff27d', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'b3752fef-d901-4ec4-939e-11f19b8c186d', 'recommended', 'Showroom', '2025-08-09 18:25:49.865244');
INSERT INTO public.master_product_accessory_relationships VALUES ('1f37cd7f-5cc3-4d2b-93e3-7e69b8e00e0c', '7f72c046-52f0-4186-be27-4953a0ec50c7', '01d985c3-fa28-410a-bb57-cab706e5e044', 'recommended', 'Showroom', '2025-08-09 18:25:49.929558');
INSERT INTO public.master_product_accessory_relationships VALUES ('7f07cedf-7934-4a0e-af00-e6bb87a8b229', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'edccfc66-6c8f-4491-8fd0-7ed15dcf5c64', 'recommended', 'Showroom', '2025-08-09 18:25:49.99619');
INSERT INTO public.master_product_accessory_relationships VALUES ('2b49c7e1-d157-4fc7-8c51-66b103951d1f', '7f72c046-52f0-4186-be27-4953a0ec50c7', 'e7a1c8fb-bb42-40d1-8963-a8c5318b8f7d', 'recommended', 'Showroom', '2025-08-09 18:25:50.062742');
INSERT INTO public.master_product_accessory_relationships VALUES ('6fe65b01-1bc1-4652-96d3-691d70694ad8', '7f72c046-52f0-4186-be27-4953a0ec50c7', '9d7b288b-4a79-431c-9015-68124f434e0f', 'recommended', 'Showroom', '2025-08-09 18:25:50.128746');
INSERT INTO public.master_product_accessory_relationships VALUES ('f05c6df4-5670-48e2-a1e7-e6345c3aad84', '7f72c046-52f0-4186-be27-4953a0ec50c7', '4630e11a-6695-4413-8dcb-1929538f2eb9', 'recommended', 'Showroom', '2025-08-09 18:25:50.195624');
INSERT INTO public.master_product_accessory_relationships VALUES ('5122f679-0eb1-4aca-a49a-016f2c318388', 'ceb271c9-f68a-4ff3-836d-92c656a18721', 'e4c2bd4c-a81f-4e44-887a-233d6d6c0d9a', 'recommended', 'Showroom', '2025-08-09 18:25:50.476811');
INSERT INTO public.master_product_accessory_relationships VALUES ('11e11568-0926-4d36-a662-7be7f3bf0ec0', 'ceb271c9-f68a-4ff3-836d-92c656a18721', '269c96c1-c683-4ef0-9539-0f21733040a7', 'recommended', 'Showroom', '2025-08-09 18:25:50.543851');
INSERT INTO public.master_product_accessory_relationships VALUES ('b3677569-7ef7-4fc9-b598-822dd805a809', 'ceb271c9-f68a-4ff3-836d-92c656a18721', '48523e9f-58b0-4b90-a190-fc457b63caf4', 'recommended', 'Showroom', '2025-08-09 18:25:50.611002');
INSERT INTO public.master_product_accessory_relationships VALUES ('419e3227-e138-4a60-bb85-3408fa8514b1', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', 'dc1da90a-9806-4c41-8ebc-fd06a90a0f7b', 'recommended', 'Showroom', '2025-08-09 18:25:50.883817');
INSERT INTO public.master_product_accessory_relationships VALUES ('5c26614c-a1a1-4ff1-84c4-f734ef8082a3', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', 'ff919574-bdc8-42ad-95ff-e35d060befd8', 'recommended', 'Showroom', '2025-08-09 18:25:50.948533');
INSERT INTO public.master_product_accessory_relationships VALUES ('159ccd09-5d20-45c1-9290-f5f949a46688', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', '5e43b879-afe7-4b2d-bb75-9f0763c1adc7', 'recommended', 'Showroom', '2025-08-09 18:25:51.011373');
INSERT INTO public.master_product_accessory_relationships VALUES ('29f7e815-6871-4bbb-a595-d3f05bedecc6', '05d71a06-b531-4206-95b5-eba537ffe01a', '12ed7741-71a7-4ddf-98db-02abaf05c804', 'compatible', 'Equipment', '2025-08-09 18:25:51.275882');
INSERT INTO public.master_product_accessory_relationships VALUES ('0d80a0b9-a149-4004-bee8-fd3e3de3be54', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', 'ff919574-bdc8-42ad-95ff-e35d060befd8', 'recommended', 'Showroom', '2025-08-09 18:25:50.409234');
INSERT INTO public.master_product_accessory_relationships VALUES ('e34013bb-6781-4f11-b5d5-4ed478911adf', 'eb09fb04-663b-46ef-9fba-7e4b155c93a1', '5e43b879-afe7-4b2d-bb75-9f0763c1adc7', 'recommended', 'Showroom', '2025-08-09 18:25:50.471407');
INSERT INTO public.master_product_accessory_relationships VALUES ('80fcba35-4b23-47e2-86aa-efe077501909', '05d71a06-b531-4206-95b5-eba537ffe01a', '12ed7741-71a7-4ddf-98db-02abaf05c804', 'compatible', 'Equipment', '2025-08-09 18:25:50.727943');
INSERT INTO public.master_product_accessory_relationships VALUES ('e456a85e-dff5-4e7e-9793-211d2f6ea640', '05d71a06-b531-4206-95b5-eba537ffe01a', '35e8a8e2-63cc-4f85-a6a1-067ee09c836c', 'compatible', 'Equipment', '2025-08-09 18:25:50.79253');
INSERT INTO public.master_product_accessory_relationships VALUES ('bfae65ce-9e5c-4338-80ab-837772ad691d', '05d71a06-b531-4206-95b5-eba537ffe01a', '55036761-c149-43d4-8857-04b42e0ce05e', 'recommended', 'Showroom', '2025-08-09 18:25:50.856256');
INSERT INTO public.master_product_accessory_relationships VALUES ('689e5041-1245-4723-a54f-f4d7c4019eb7', '05d71a06-b531-4206-95b5-eba537ffe01a', '231ff99d-756d-4092-9619-0644545bd319', 'recommended', 'Showroom', '2025-08-09 18:25:50.918296');
INSERT INTO public.master_product_accessory_relationships VALUES ('6e7fb6da-fb24-4d8e-9b40-21335f6a9803', '05d71a06-b531-4206-95b5-eba537ffe01a', '76cdbc89-330c-45f6-949f-4600c63487c7', 'recommended', 'Showroom', '2025-08-09 18:25:50.980721');
INSERT INTO public.master_product_accessory_relationships VALUES ('ad22669d-08a2-49de-8c56-e280ade9ea1b', '05d71a06-b531-4206-95b5-eba537ffe01a', '376cf9d0-2a66-4c34-b716-9336a6ff60d6', 'recommended', 'Showroom', '2025-08-09 18:25:51.04437');
INSERT INTO public.master_product_accessory_relationships VALUES ('2087230b-1678-41c4-aa6c-5f2cc8fddec6', '05d71a06-b531-4206-95b5-eba537ffe01a', '04123c52-dd05-495c-a978-5a2284ddaea5', 'recommended', 'Showroom', '2025-08-09 18:25:51.105285');
INSERT INTO public.master_product_accessory_relationships VALUES ('d48415c1-3c3b-4202-a7ec-228da46e53dc', '05d71a06-b531-4206-95b5-eba537ffe01a', 'acfec99d-5cf3-4fea-abf4-5635d10609b7', 'recommended', 'Showroom', '2025-08-09 18:25:51.165989');
INSERT INTO public.master_product_accessory_relationships VALUES ('6d68b3a0-f348-4fa0-9610-2889ba86470f', '05d71a06-b531-4206-95b5-eba537ffe01a', 'dc84b5c0-dd63-4903-be47-7ddde2bfac92', 'recommended', 'Showroom', '2025-08-09 18:25:51.227675');
INSERT INTO public.master_product_accessory_relationships VALUES ('984485b4-a0d9-4fde-ad1c-3e9e5f7de4e9', '05d71a06-b531-4206-95b5-eba537ffe01a', '7dc77ff8-29ca-4fc4-a07d-b71034e3b693', 'recommended', 'Showroom', '2025-08-09 18:25:51.290605');
INSERT INTO public.master_product_accessory_relationships VALUES ('a6a4e0f5-9c2b-49b8-ad93-4c95cd8b9f0f', '3ce1faed-e4b5-4a7d-a19f-aa5b544e08f4', 'ef38ad83-0425-43b5-8158-d6349b134f3d', 'compatible', 'Equipment', '2025-08-09 18:25:51.666303');
INSERT INTO public.master_product_accessory_relationships VALUES ('0df31d4b-333a-43fc-bef8-f8e0a56d7020', '05d71a06-b531-4206-95b5-eba537ffe01a', '55036761-c149-43d4-8857-04b42e0ce05e', 'recommended', 'Showroom', '2025-08-09 18:25:50.66258');
INSERT INTO public.master_product_accessory_relationships VALUES ('124d0ff3-4cda-44dc-9aa2-e56b07ce2c50', '05d71a06-b531-4206-95b5-eba537ffe01a', '231ff99d-756d-4092-9619-0644545bd319', 'recommended', 'Showroom', '2025-08-09 18:25:50.72832');
INSERT INTO public.master_product_accessory_relationships VALUES ('50d67907-9872-4309-8cbf-cc6ac5debd30', '05d71a06-b531-4206-95b5-eba537ffe01a', '76cdbc89-330c-45f6-949f-4600c63487c7', 'recommended', 'Showroom', '2025-08-09 18:25:50.791348');
INSERT INTO public.master_product_accessory_relationships VALUES ('f9f113dd-2493-451f-b0f0-5c967785ec79', '05d71a06-b531-4206-95b5-eba537ffe01a', '376cf9d0-2a66-4c34-b716-9336a6ff60d6', 'recommended', 'Showroom', '2025-08-09 18:25:50.864765');
INSERT INTO public.master_product_accessory_relationships VALUES ('dec74b10-bfa5-4d19-8c95-1963645af35c', '05d71a06-b531-4206-95b5-eba537ffe01a', '04123c52-dd05-495c-a978-5a2284ddaea5', 'recommended', 'Showroom', '2025-08-09 18:25:50.928805');
INSERT INTO public.master_product_accessory_relationships VALUES ('c6cc7540-08a4-425e-be23-0e81554d575b', '05d71a06-b531-4206-95b5-eba537ffe01a', 'acfec99d-5cf3-4fea-abf4-5635d10609b7', 'recommended', 'Showroom', '2025-08-09 18:25:50.99303');
INSERT INTO public.master_product_accessory_relationships VALUES ('03448771-1446-40ae-996d-9786e9b172bf', '05d71a06-b531-4206-95b5-eba537ffe01a', 'dc84b5c0-dd63-4903-be47-7ddde2bfac92', 'recommended', 'Showroom', '2025-08-09 18:25:51.055568');
INSERT INTO public.master_product_accessory_relationships VALUES ('ff7d6168-d6b4-46df-83d6-611ee95abbd9', '05d71a06-b531-4206-95b5-eba537ffe01a', '7dc77ff8-29ca-4fc4-a07d-b71034e3b693', 'recommended', 'Showroom', '2025-08-09 18:25:51.118039');
INSERT INTO public.master_product_accessory_relationships VALUES ('28bb3ea4-2c10-4168-afe3-442d94092c40', '3ce1faed-e4b5-4a7d-a19f-aa5b544e08f4', 'ef38ad83-0425-43b5-8158-d6349b134f3d', 'compatible', 'Equipment', '2025-08-09 18:25:51.493841');
INSERT INTO public.master_product_accessory_relationships VALUES ('12d7f27d-24af-47e7-80ff-0de2a5f0def7', '05d71a06-b531-4206-95b5-eba537ffe01a', '35e8a8e2-63cc-4f85-a6a1-067ee09c836c', 'compatible', 'Equipment', '2025-08-09 18:25:51.340747');
INSERT INTO public.master_product_accessory_relationships VALUES ('b82ec43f-6c13-4e14-88f2-a309360ae116', '05d71a06-b531-4206-95b5-eba537ffe01a', '55036761-c149-43d4-8857-04b42e0ce05e', 'recommended', 'Showroom', '2025-08-09 18:25:51.405247');
INSERT INTO public.master_product_accessory_relationships VALUES ('f7b85e95-4b84-4ab1-afad-e46a64437dae', '05d71a06-b531-4206-95b5-eba537ffe01a', '231ff99d-756d-4092-9619-0644545bd319', 'recommended', 'Showroom', '2025-08-09 18:25:51.470173');
INSERT INTO public.master_product_accessory_relationships VALUES ('2eeec1ef-0781-40f8-b90d-5febfac0e2a2', '05d71a06-b531-4206-95b5-eba537ffe01a', '76cdbc89-330c-45f6-949f-4600c63487c7', 'recommended', 'Showroom', '2025-08-09 18:25:51.534785');
INSERT INTO public.master_product_accessory_relationships VALUES ('0f5a1b10-17a0-41ad-b689-259ee872bad4', '05d71a06-b531-4206-95b5-eba537ffe01a', '376cf9d0-2a66-4c34-b716-9336a6ff60d6', 'recommended', 'Showroom', '2025-08-09 18:25:51.600018');
INSERT INTO public.master_product_accessory_relationships VALUES ('7732017b-acbc-46b9-b787-caeef8edcecd', '05d71a06-b531-4206-95b5-eba537ffe01a', '04123c52-dd05-495c-a978-5a2284ddaea5', 'recommended', 'Showroom', '2025-08-09 18:25:51.664705');
INSERT INTO public.master_product_accessory_relationships VALUES ('c938d864-3277-471b-8032-fb5380276f6a', '05d71a06-b531-4206-95b5-eba537ffe01a', 'acfec99d-5cf3-4fea-abf4-5635d10609b7', 'recommended', 'Showroom', '2025-08-09 18:25:51.731284');
INSERT INTO public.master_product_accessory_relationships VALUES ('489e55ea-30c6-414c-a1ab-05e78e1cea3b', '05d71a06-b531-4206-95b5-eba537ffe01a', 'dc84b5c0-dd63-4903-be47-7ddde2bfac92', 'recommended', 'Showroom', '2025-08-09 18:25:51.796915');
INSERT INTO public.master_product_accessory_relationships VALUES ('d1963210-11e5-47de-8ea6-83ab063fe999', '05d71a06-b531-4206-95b5-eba537ffe01a', '7dc77ff8-29ca-4fc4-a07d-b71034e3b693', 'recommended', 'Showroom', '2025-08-09 18:25:51.866121');
INSERT INTO public.master_product_accessory_relationships VALUES ('98327a86-2170-4160-a23e-3c8f4ff3cf3a', '3ce1faed-e4b5-4a7d-a19f-aa5b544e08f4', 'ef38ad83-0425-43b5-8158-d6349b134f3d', 'compatible', 'Equipment', '2025-08-09 18:25:52.287824');


--
-- Data for Name: meter_readings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: mobile_app_sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.mobile_app_sessions VALUES ('0baec08d-6c05-426e-8ede-4b6c4d31b4dd', '550e8400-e29b-41d4-a716-446655440000', 'SES-001', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, '2025-08-03 08:00:00', NULL, '2025-08-03 13:16:08.783021', 'ios', 'iPhone 14', NULL, NULL, 'cellular', NULL, NULL, NULL, 0, NULL, 2, 5, 0, 0, 0.00, 0.00, 15, 0, 0, NULL, NULL, '2025-08-03 13:16:08.783021', '2025-08-03 13:16:08.783021');
INSERT INTO public.mobile_app_sessions VALUES ('cc43eb1b-5a7f-49ed-b20b-3d5e31893d19', '550e8400-e29b-41d4-a716-446655440000', 'SES-002', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, '2025-08-02 07:30:00', NULL, '2025-08-03 13:16:08.783021', 'android', 'Samsung Galaxy S23', NULL, NULL, 'wifi', NULL, NULL, NULL, 0, NULL, 1, 8, 0, 0, 0.00, 0.00, 8, 0, 0, NULL, NULL, '2025-08-03 13:16:08.783021', '2025-08-03 13:16:08.783021');
INSERT INTO public.mobile_app_sessions VALUES ('0ec2dddf-a5fc-44ff-ad17-f0a1b5e6eee7', '550e8400-e29b-41d4-a716-446655440000', 'SES-003', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, '2025-08-01 09:15:00', NULL, '2025-08-03 13:16:08.783021', 'ios', 'iPad Pro', NULL, NULL, 'wifi', NULL, NULL, NULL, 0, NULL, 0, 12, 0, 0, 0.00, 0.00, 5, 0, 0, NULL, NULL, '2025-08-03 13:16:08.783021', '2025-08-03 13:16:08.783021');


--
-- Data for Name: mobile_field_metrics; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: mobile_field_orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.mobile_field_orders VALUES ('8cae2c13-9dd1-47f5-8089-dc14b1c35bb3', '550e8400-e29b-41d4-a716-446655440000', 'FO-001', 'parts_request', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, '2025-08-03', NULL, 'truck_delivery', NULL, NULL, NULL, NULL, 'approved', 'urgent', false, NULL, NULL, NULL, 215.98, 18.36, 0.00, 234.34, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-03 13:16:08.783021', '2025-08-03 13:16:08.783021');
INSERT INTO public.mobile_field_orders VALUES ('4286d358-17af-42ec-b580-cc378d7b4fb7', '550e8400-e29b-41d4-a716-446655440000', 'FO-002', 'emergency_order', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, '2025-08-02', NULL, 'courier', NULL, NULL, NULL, NULL, 'shipped', 'emergency', false, NULL, NULL, NULL, 149.99, 12.75, 0.00, 162.74, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-03 13:16:08.783021', '2025-08-03 13:16:08.783021');
INSERT INTO public.mobile_field_orders VALUES ('11a773fd-bd1b-4870-907e-998e1bb17b62', '550e8400-e29b-41d4-a716-446655440000', 'FO-003', 'stock_replenishment', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, '2025-08-01', NULL, 'warehouse_pickup', NULL, NULL, NULL, NULL, 'delivered', 'standard', false, NULL, NULL, NULL, 425.95, 36.21, 0.00, 462.16, NULL, NULL, NULL, NULL, NULL, NULL, '2025-08-03 13:16:08.783021', '2025-08-03 13:16:08.783021');


--
-- Data for Name: mobile_order_line_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: mobile_parts_inventory; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.mobile_parts_inventory VALUES ('874d0e54-5e4a-48c1-8355-033574167da5', '550e8400-e29b-41d4-a716-446655440000', 'TN-221BK', 'Black Toner Cartridge', 'High-yield black toner for Brother printers', 'Brother', 'toner', 25, 8, 0, 33, 45.50, 89.99, 0.00, NULL, NULL, NULL, NULL, NULL, 7, 1, 5, 100, NULL, true, true, false, true, 5, '2025-08-03 13:16:08.783021', '2025-08-03 13:16:08.783021');
INSERT INTO public.mobile_parts_inventory VALUES ('ce43668e-3140-43bd-b321-a907077cf4b8', '550e8400-e29b-41d4-a716-446655440000', 'DR-221CL', 'Drum Unit', 'Drum unit for Brother HL/DCP/MFC series', 'Brother', 'drum', 12, 3, 0, 15, 75.25, 149.99, 0.00, NULL, NULL, NULL, NULL, NULL, 7, 1, 5, 100, NULL, true, true, false, true, 5, '2025-08-03 13:16:08.783021', '2025-08-03 13:16:08.783021');
INSERT INTO public.mobile_parts_inventory VALUES ('cfae234a-63b2-4daf-b6b0-284360d45da2', '550e8400-e29b-41d4-a716-446655440000', 'CF283A', 'Black Toner 83A', 'Standard yield black toner for HP LaserJet', 'HP', 'toner', 18, 5, 0, 23, 32.75, 65.99, 0.00, NULL, NULL, NULL, NULL, NULL, 7, 1, 5, 100, NULL, true, true, false, true, 5, '2025-08-03 13:16:08.783021', '2025-08-03 13:16:08.783021');
INSERT INTO public.mobile_parts_inventory VALUES ('ed34a3ea-8465-46a2-ad48-b51074e2472f', '550e8400-e29b-41d4-a716-446655440000', 'MK-1142', 'Maintenance Kit', 'Maintenance kit for Kyocera FS-1135MFP', 'Kyocera', 'maintenance_kit', 8, 2, 0, 10, 125.00, 249.99, 0.00, NULL, NULL, NULL, NULL, NULL, 7, 1, 5, 100, NULL, true, true, false, false, 5, '2025-08-03 13:16:08.783021', '2025-08-03 13:16:08.783021');
INSERT INTO public.mobile_parts_inventory VALUES ('52d293e7-e296-4a2e-9529-fe443d20daf2', '550e8400-e29b-41d4-a716-446655440000', 'RG5-5750', 'Fuser Assembly', 'Fuser assembly for HP LaserJet 9000 series', 'HP', 'fuser', 6, 1, 0, 7, 189.50, 379.99, 0.00, NULL, NULL, NULL, NULL, NULL, 7, 1, 5, 100, NULL, true, true, false, false, 5, '2025-08-03 13:16:08.783021', '2025-08-03 13:16:08.783021');


--
-- Data for Name: mobile_work_orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.mobile_work_orders VALUES ('77d74ef0-165c-49e0-ae07-5e2c8a0986bd', '550e8400-e29b-41d4-a716-446655440000', 'WO-001', 'service_call', 'high', 'adc117e7-611d-426a-b569-6c6c0b32e234', 'adc117e7-611d-426a-b569-6c6c0b32e234', NULL, NULL, '123 Business Park Dr, Suite 200, Anytown ST 12345', 'John Smith', '(555) 123-4567', NULL, NULL, '2025-08-04', '09:00:00', NULL, 2.50, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, 'Printer jamming frequently, needs diagnostic and repair', NULL, NULL, 0.00, 'assigned', '2025-08-03 13:16:08.783021', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 0.00, 0.00, NULL, false, NULL, NULL, NULL, 'synced', NULL, '2025-08-03 13:16:08.783021', '2025-08-03 13:16:08.783021');
INSERT INTO public.mobile_work_orders VALUES ('cfa1068e-c0c0-442b-96f0-a99ca45198e5', '550e8400-e29b-41d4-a716-446655440000', 'WO-002', 'maintenance', 'medium', 'adc117e7-611d-426a-b569-6c6c0b32e234', 'adc117e7-611d-426a-b569-6c6c0b32e234', NULL, NULL, '456 Corporate Blvd, Floor 3, Business City ST 67890', 'Jane Doe', '(555) 987-6543', NULL, NULL, '2025-08-05', '14:00:00', NULL, 1.50, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, 'Scheduled quarterly maintenance for Canon MFP', NULL, NULL, 0.00, 'in_progress', '2025-08-03 13:16:08.783021', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 0.00, 0.00, NULL, false, NULL, NULL, NULL, 'synced', NULL, '2025-08-03 13:16:08.783021', '2025-08-03 13:16:08.783021');
INSERT INTO public.mobile_work_orders VALUES ('bcc7ac49-fd14-4e2d-a051-5359bdae11ec', '550e8400-e29b-41d4-a716-446655440000', 'WO-003', 'installation', 'urgent', 'adc117e7-611d-426a-b569-6c6c0b32e234', 'adc117e7-611d-426a-b569-6c6c0b32e234', NULL, NULL, '789 Office Complex, Building A, Floor 1', 'Mike Johnson', '(555) 456-7890', NULL, NULL, '2025-08-03', '11:00:00', NULL, 3.00, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, 'Install new HP LaserJet printer and configure network settings', NULL, NULL, 0.00, 'completed', '2025-08-03 13:16:08.783021', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, 0.00, 0.00, NULL, false, NULL, NULL, NULL, 'synced', NULL, '2025-08-03 13:16:08.783021', '2025-08-03 13:16:08.783021');


--
-- Data for Name: monitoring_dashboards; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: onboarding_checklists; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: onboarding_dynamic_sections; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: onboarding_equipment; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: onboarding_network_config; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: onboarding_print_management; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: onboarding_tasks; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: organizational_units; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: payment_methods; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: payment_schedules; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: payment_terms; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: performance_benchmarks; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.performance_benchmarks VALUES ('84d34e72-ea32-4bfe-a3a4-1ae6173da545', '550e8400-e29b-41d4-a716-446655440000', 'Customer Satisfaction Score', 'satisfaction', 'decimal', 4.1000, NULL, 4.5000, 4.3000, 'B', 75.00, NULL, NULL, NULL, 'improving', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'high', NULL, NULL, NULL, NULL, 'critical', NULL, '2025-08-03 13:22:46.973134', '2025-08-03 13:22:46.973134');
INSERT INTO public.performance_benchmarks VALUES ('51bdf688-c2d4-4c26-8ee9-c8ee7c24073c', '550e8400-e29b-41d4-a716-446655440000', 'Average Response Time', 'response_time', 'time', 60.0000, NULL, 45.0000, 45.5000, 'A', 85.00, NULL, NULL, NULL, 'improving', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'medium', NULL, NULL, NULL, NULL, 'high', NULL, '2025-08-03 13:22:46.973134', '2025-08-03 13:22:46.973134');
INSERT INTO public.performance_benchmarks VALUES ('6475c803-5a2d-40f0-9a66-6b1d6de1d36b', '550e8400-e29b-41d4-a716-446655440000', 'First Call Resolution Rate', 'efficiency', 'percentage', 80.0000, NULL, 90.0000, 87.2000, 'B', 78.00, NULL, NULL, NULL, 'stable', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'medium', NULL, NULL, NULL, NULL, 'medium', NULL, '2025-08-03 13:22:46.973134', '2025-08-03 13:22:46.973134');


--
-- Data for Name: phone_in_tickets; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.phone_in_tickets VALUES ('3f5a2efd-25bc-4dc6-87c7-292d5fb0065d', '550e8400-e29b-41d4-a716-446655440000', 'Test Caller 2', '(555) 888-8888', 'test2@example.com', 'Admin', 'test-customer-id-2', 'Test Company 2', '456 Test Avenue', '', '', '', '', '', '', '', 'toner_low', 'Toner cartridge is running low', 'medium', 'phone', NULL, '2025-08-09 04:18:25.312687', '2025-08-09 04:18:25.312687', NULL, NULL, '');
INSERT INTO public.phone_in_tickets VALUES ('d2c56666-57d4-43f6-b45b-6b22a73bf855', '550e8400-e29b-41d4-a716-446655440000', 'John Smith', '(555) 123-4567', 'john@abc.com', 'IT Manager', 'customer-abc-123', 'ABC Corporation', '123 Business Park Drive, Suite 100', 'Main Building', '2nd Floor', 'Conference Room A', '', 'Canon', 'IR-ADV C5535i', 'ABC123456', 'paper_jam', 'Paper jam in tray 2, cannot remove paper stuck inside', 'high', 'phone', '2025-08-10', '2025-08-09 04:19:35.939359', '2025-08-09 04:19:35.939359', NULL, NULL, 'Customer mentioned this happens frequently with thick paper');
INSERT INTO public.phone_in_tickets VALUES ('a339e8c8-b04a-43fb-b6b3-90517dd430a0', '550e8400-e29b-41d4-a716-446655440000', 'Test User', '(555) 000-0000', 'test@test.com', 'Manager', 'test-conversion-customer', 'Test Conversion Company', '123 Test Address', '', '', '', '', '', '', '', 'printer_offline', 'Printer is completely offline and not responding', 'high', 'phone', NULL, '2025-08-09 04:26:49.175846', '2025-08-09 04:26:49.175846', NULL, NULL, '');


--
-- Data for Name: po_line_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: predictive_alerts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.predictive_alerts VALUES ('7181cf4c-ab50-4401-9531-a66a1e90eb37', '550e8400-e29b-41d4-a716-446655440000', 'ALERT-001', 'DEV-001', NULL, 'predictive_failure', 'hardware', 'warning', NULL, 0.7500, 15, 0.85, 'Drum Unit Approaching End of Life', 'Analysis indicates drum unit will need replacement within 15 days based on current usage patterns', NULL, NULL, NULL, NULL, NULL, 'open', NULL, NULL, NULL, NULL, NULL, 'adc117e7-611d-426a-b569-6c6c0b32e234', 'adc117e7-611d-426a-b569-6c6c0b32e234', NULL, 'medium', 1, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, '2025-08-03 13:09:55.004503', '2025-08-03 13:09:55.004503');
INSERT INTO public.predictive_alerts VALUES ('6e76ee93-0925-459a-a96c-71b0f62375b3', '550e8400-e29b-41d4-a716-446655440000', 'ALERT-002', 'DEV-002', NULL, 'supply_low', 'supplies', 'info', NULL, 0.9500, 7, 0.95, 'Toner Running Low', 'Black toner cartridge is at 15% capacity and should be replaced soon', NULL, NULL, NULL, NULL, NULL, 'open', NULL, NULL, NULL, NULL, NULL, 'adc117e7-611d-426a-b569-6c6c0b32e234', 'adc117e7-611d-426a-b569-6c6c0b32e234', NULL, 'low', 1, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, '2025-08-03 13:09:55.004503', '2025-08-03 13:09:55.004503');
INSERT INTO public.predictive_alerts VALUES ('d578a80e-ba36-4f04-a1a0-2b1468f069be', '550e8400-e29b-41d4-a716-446655440000', 'ALERT-003', 'DEV-003', NULL, 'maintenance_due', 'maintenance', 'warning', NULL, 0.6000, 0, 0.90, 'Scheduled Maintenance Overdue', 'Device has exceeded recommended maintenance interval by 12 days', NULL, NULL, NULL, NULL, NULL, 'open', NULL, NULL, NULL, NULL, NULL, 'adc117e7-611d-426a-b569-6c6c0b32e234', 'adc117e7-611d-426a-b569-6c6c0b32e234', NULL, 'medium', 1, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL, NULL, '2025-08-03 13:09:55.004503', '2025-08-03 13:09:55.004503');


--
-- Data for Name: process_automation_logs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: product_accessories; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.product_accessories VALUES ('aac1f27c-808d-4dbd-84b7-cdd5461d2c10', '550e8400-e29b-41d4-a716-446655440000', '04d4ad0d-6642-456d-91a8-ac2c45db061b', 'FINISHER-SR5020', 'Saddle Stitching Finisher SR5020', 'Finishing', 'Stapling and saddle-stitching finisher with hole punching capability', 8500.00, 6800.00, false, true, '2025-08-01 02:55:57.004086', '2025-08-01 02:55:57.004086');
INSERT INTO public.product_accessories VALUES ('5fd31482-02ef-4ba0-abf1-3dbdcc83a5b7', '550e8400-e29b-41d4-a716-446655440000', '443f1daa-e4b3-4019-b58b-c8b8d8798011', 'CN-FINISHER-SR', 'Inner Finisher SR-1', 'Finishing', 'Internal finishing unit for booklet making and saddle stitching', 2495.00, 1895.00, false, true, '2025-08-01 19:00:13.768134', '2025-08-01 19:00:13.768134');
INSERT INTO public.product_accessories VALUES ('6b9b1ea8-6c39-4ba9-bb10-bba522d6cf49', '550e8400-e29b-41d4-a716-446655440000', '443f1daa-e4b3-4019-b58b-c8b8d8798011', 'CN-TRAY-A1', 'Paper Tray A1', 'Paper Handling', 'Additional paper tray for 550 sheets', 385.00, 275.00, false, true, '2025-08-01 19:00:13.768134', '2025-08-01 19:00:13.768134');
INSERT INTO public.product_accessories VALUES ('b7a08084-55b3-4b85-8dfe-0afe5dd04263', '550e8400-e29b-41d4-a716-446655440000', '8980bf51-1c26-4c42-a591-2360228efb2c', 'HP-TRAY-550', 'HP 550-Sheet Feeder', 'Paper Handling', 'Additional paper input tray for high-volume printing', 299.00, 225.00, false, true, '2025-08-01 19:00:13.768134', '2025-08-01 19:00:13.768134');
INSERT INTO public.product_accessories VALUES ('ea800901-85d6-42ee-b9f1-e58db4a38b73', '550e8400-e29b-41d4-a716-446655440000', 'ba2d565b-42fc-429f-a6cd-fcfef42a9dbc', 'XR-WIFI-KIT', 'Wireless Network Kit', 'Connectivity', 'Wi-Fi connectivity module for wireless printing', 149.00, 119.00, false, true, '2025-08-01 19:00:13.768134', '2025-08-01 19:00:13.768134');


--
-- Data for Name: product_pricing; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.product_pricing VALUES ('1319b405-499e-4a02-809a-6f9b7d2a77fc', '550e8400-e29b-41d4-a716-446655440000', 'CANON-IR-C3025i', 'model', 2500.00, 30.00, 3250.00, 3000.00, 3800.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');
INSERT INTO public.product_pricing VALUES ('4d0f68d4-55c2-450a-abd3-34735fde177a', '550e8400-e29b-41d4-a716-446655440000', 'HP-LaserJet-M404dn', 'model', 180.00, NULL, 225.00, 210.00, 280.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');
INSERT INTO public.product_pricing VALUES ('64868fa4-e82b-431b-a00f-b6692eef5035', '550e8400-e29b-41d4-a716-446655440000', 'XEROX-WorkCentre-6515', 'model', 350.00, 28.00, 448.00, 420.00, 520.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');
INSERT INTO public.product_pricing VALUES ('81ecefcb-c858-4af0-802c-ec8fd8252b97', '550e8400-e29b-41d4-a716-446655440000', 'FINISHER-BOOKLET-FB501', 'accessory', 800.00, 35.00, 1080.00, 1000.00, 1200.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');
INSERT INTO public.product_pricing VALUES ('dd410418-afc0-4163-8a2b-56ea745fc875', '550e8400-e29b-41d4-a716-446655440000', 'PAPER-TRAY-PF-701', 'accessory', 120.00, 40.00, 168.00, 150.00, 200.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');
INSERT INTO public.product_pricing VALUES ('5166995f-065a-43aa-8916-e37b06c22674', '550e8400-e29b-41d4-a716-446655440000', 'STAPLER-UNIT-J1', 'accessory', 85.00, 45.00, 123.25, 110.00, 150.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');
INSERT INTO public.product_pricing VALUES ('f9dda520-af25-4e0b-822a-6ab8adac9371', '550e8400-e29b-41d4-a716-446655440000', 'SETUP-INSTALLATION', 'service', 150.00, 50.00, 225.00, 200.00, 275.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');
INSERT INTO public.product_pricing VALUES ('80487618-a670-440a-a772-b70b83c66463', '550e8400-e29b-41d4-a716-446655440000', 'TRAINING-BASIC', 'service', 100.00, 60.00, 160.00, 140.00, 200.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');
INSERT INTO public.product_pricing VALUES ('3cebc31f-a68d-4fb3-bcea-62105003f1fb', '550e8400-e29b-41d4-a716-446655440000', 'NETWORK-CONFIG', 'service', 75.00, 66.67, 125.00, 110.00, 160.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');
INSERT INTO public.product_pricing VALUES ('ee468780-332c-4ccf-baa7-65878d6345c7', '550e8400-e29b-41d4-a716-446655440000', 'PRINT-MANAGEMENT-SUITE', 'software', 200.00, 45.00, 290.00, 260.00, 350.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');
INSERT INTO public.product_pricing VALUES ('8485bc8d-2609-41e0-9643-a6a5c4d630fc', '550e8400-e29b-41d4-a716-446655440000', 'MOBILE-PRINT-APP', 'software', 50.00, 80.00, 90.00, 80.00, 120.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');
INSERT INTO public.product_pricing VALUES ('036f8808-f683-474c-9276-6cb7ed7c7f17', '550e8400-e29b-41d4-a716-446655440000', 'TONER-BLACK-GPR-58', 'supply', 45.00, 20.00, 54.00, 50.00, 68.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');
INSERT INTO public.product_pricing VALUES ('4bf7e459-3bfb-43bb-bd13-2abae04e6b84', '550e8400-e29b-41d4-a716-446655440000', 'TONER-CYAN-GPR-58', 'supply', 48.00, 18.75, 57.00, 52.00, 72.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');
INSERT INTO public.product_pricing VALUES ('4f49da95-dfde-4531-abf2-38cbf8adcb2c', '550e8400-e29b-41d4-a716-446655440000', 'DRUM-UNIT-GPR-58', 'supply', 85.00, 25.00, 106.25, 95.00, 125.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');
INSERT INTO public.product_pricing VALUES ('01f7effe-b16d-4e59-bd74-b5716ccadc17', '550e8400-e29b-41d4-a716-446655440000', 'CLOUD-BACKUP-SERVICE', 'managed-service', 25.00, 100.00, 50.00, 45.00, 75.00, true, '2025-08-01 18:36:42.366095', NULL, '6f3224b2-221c-42ad-a7f5-a24a11e33621', '2025-08-01 18:36:42.366095', '2025-08-01 18:36:42.366095');


--
-- Data for Name: product_tags; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: professional_services; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.professional_services VALUES ('44d90b31-a98a-49d4-b950-232ee82df83f', '550e8400-e29b-41d4-a716-446655440000', 'SETUP-INSTALL-001', 'Equipment Setup and Installation', 'Professional Services', 'Installation', 'Comprehensive setup and installation service for new equipment including configuration, testing, and user training', 'Professional installation and setup service for new copier equipment', NULL, NULL, NULL, true, false, false, true, true, false, NULL, 1500.00, true, 1200.00, false, NULL, false, NULL, false, NULL, 'Printyx', NULL, NULL, 'Each', NULL, NULL, NULL, NULL, NULL, '2025-08-01 03:17:48.823581', '2025-08-01 03:17:48.823581');
INSERT INTO public.professional_services VALUES ('25484122-7b52-498a-9b76-cd583b656b5d', '550e8400-e29b-41d4-a716-446655440000', 'TRAINING-BASIC-001', 'Basic User Training', 'Professional Services', 'Training', 'On-site basic user training covering operation, maintenance, and troubleshooting', 'Basic training session for equipment users', NULL, NULL, NULL, true, false, false, true, true, false, NULL, 500.00, true, 400.00, false, NULL, false, NULL, false, NULL, 'Printyx', NULL, NULL, 'Hour', NULL, NULL, NULL, NULL, NULL, '2025-08-01 03:17:48.823581', '2025-08-01 03:17:48.823581');
INSERT INTO public.professional_services VALUES ('191beac8-a7ce-43f4-8dd9-b9a8018f3612', '550e8400-e29b-41d4-a716-446655440000', 'MAINT-PM-001', 'Preventive Maintenance Service', 'Professional Services', 'Maintenance', 'Comprehensive preventive maintenance service including cleaning, calibration, and parts inspection', 'Regular preventive maintenance service', NULL, NULL, NULL, true, false, false, true, true, false, NULL, 300.00, true, 240.00, false, NULL, false, NULL, false, NULL, 'Printyx', NULL, NULL, 'Each', NULL, NULL, NULL, NULL, NULL, '2025-08-01 03:17:48.823581', '2025-08-01 03:17:48.823581');
INSERT INTO public.professional_services VALUES ('63457e46-d0ca-473e-9d2c-2b673228ef43', '550e8400-e29b-41d4-a716-446655440000', 'CONSULT-WORKFLOW-001', 'Workflow Optimization Consulting', 'Professional Services', 'Consulting', 'Expert consultation on optimizing document workflows and improving efficiency', 'Professional workflow optimization consultation', NULL, NULL, NULL, true, false, false, true, true, false, NULL, 2000.00, true, 1600.00, false, NULL, false, NULL, false, NULL, 'Printyx', NULL, NULL, 'Project', NULL, NULL, NULL, NULL, NULL, '2025-08-01 03:17:48.823581', '2025-08-01 03:17:48.823581');
INSERT INTO public.professional_services VALUES ('a19f9975-2bdb-46e8-891b-b741a5a8d7b5', '550e8400-e29b-41d4-a716-446655440000', 'SUPPORT-ONSITE-001', 'On-site Technical Support', 'Professional Services', 'Support', 'On-site technical support and troubleshooting for complex issues', 'On-site technical support service', NULL, NULL, NULL, true, false, false, true, true, false, NULL, 150.00, true, 120.00, false, NULL, false, NULL, false, NULL, 'Printyx', NULL, NULL, 'Hour', NULL, NULL, NULL, NULL, NULL, '2025-08-01 03:17:48.823581', '2025-08-01 03:17:48.823581');


--
-- Data for Name: profitability_analysis; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: proposal_analytics; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.proposal_analytics VALUES ('417c5d79-0729-47d4-9f97-c821707c3f88', '95df7b39-dc93-4743-9a55-bf18bd396be8', 'status_sent', '2025-08-05 21:28:40.640255', '{"newStatus": "sent"}', NULL, NULL, '2025-08-05 21:28:40.640255');
INSERT INTO public.proposal_analytics VALUES ('365ce38b-b67c-4a8c-ad95-d42d17e7a4ee', '6ac71c6e-d8a1-4eb4-9c2e-e0a19b60c9d2', 'status_sent', '2025-08-05 21:47:33.525743', '{"newStatus": "sent"}', NULL, NULL, '2025-08-05 21:47:33.525743');
INSERT INTO public.proposal_analytics VALUES ('1d7588b2-9098-4de9-9e00-e338468bbf9b', '3ea7dd27-0c12-4bbd-891c-c5f0be35e49f', 'status_sent', '2025-08-05 22:29:00.943836', '{"newStatus": "sent"}', NULL, NULL, '2025-08-05 22:29:00.943836');
INSERT INTO public.proposal_analytics VALUES ('19160ad3-6ceb-48c7-abd6-c591720d1d60', '863487fd-5bd3-4358-b9ba-5f07a022476e', 'status_sent', '2025-08-05 23:40:53.752064', '{"newStatus": "sent"}', NULL, NULL, '2025-08-05 23:40:53.752064');
INSERT INTO public.proposal_analytics VALUES ('c029e67e-1676-4d32-ae70-1e84b48f21b9', 'ffd815ec-993c-4a63-b709-7ba224af9843', 'status_sent', '2025-08-06 04:32:04.146511', '{"newStatus": "sent"}', NULL, NULL, '2025-08-06 04:32:04.146511');
INSERT INTO public.proposal_analytics VALUES ('06a5442d-a058-40c0-bef0-7d3e4cdb04f1', '24811ff5-b64d-49e4-a306-2078282577f0', 'status_sent', '2025-08-08 20:19:53.429317', '{"newStatus": "sent"}', NULL, NULL, '2025-08-08 20:19:53.429317');
INSERT INTO public.proposal_analytics VALUES ('63aa1abc-14a0-4a36-a78e-16b21bb0107e', '69d055fc-48a2-4c26-b315-fdae653282ac', 'status_sent', '2025-08-09 12:50:05.903416', '{"newStatus": "sent"}', NULL, NULL, '2025-08-09 12:50:05.903416');


--
-- Data for Name: proposal_comments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: proposal_line_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.proposal_line_items VALUES ('e17e2701-aa39-4b85-abd9-526099d6a876', '550e8400-e29b-41d4-a716-446655440000', '95df7b39-dc93-4743-9a55-bf18bd396be8', 1, 'equipment', '443f1daa-e4b3-4019-b58b-c8b8d8798011', 'imageRUNNER C3025i', 'Color multifunction printer with advanced productivity features', 1, 3250.00, NULL, 3250, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, '2025-08-05 21:28:40.422423', '2025-08-05 21:28:40.422423');
INSERT INTO public.proposal_line_items VALUES ('9e4777ce-f254-4a38-a4da-e1ab002c76d4', '550e8400-e29b-41d4-a716-446655440000', '6ac71c6e-d8a1-4eb4-9c2e-e0a19b60c9d2', 1, 'product_models', '0705feb3-85e2-4440-8c0a-61790e9b3862', 'bizhub 454e', 'Fast monochrome MFP with flexible finishing options', 1, 5600.00, NULL, 5600, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, '2025-08-05 21:47:33.208748', '2025-08-05 21:47:33.208748');
INSERT INTO public.proposal_line_items VALUES ('7bf6e5a8-f59f-4aac-accb-094e587172ed', '550e8400-e29b-41d4-a716-446655440000', '6ac71c6e-d8a1-4eb4-9c2e-e0a19b60c9d2', 2, 'product_accessories', '6b9b1ea8-6c39-4ba9-bb10-bba522d6cf49', 'Additional paper tray for 550 sheets', 'Additional paper tray for 550 sheets', 1, 385.00, NULL, 385, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, '2025-08-05 21:47:33.208748', '2025-08-05 21:47:33.208748');
INSERT INTO public.proposal_line_items VALUES ('b79d2b05-eb91-4102-a121-06a11535f1cc', '550e8400-e29b-41d4-a716-446655440000', '3ea7dd27-0c12-4bbd-891c-c5f0be35e49f', 1, 'product_models', '0705feb3-85e2-4440-8c0a-61790e9b3862', 'bizhub 454e', 'Fast monochrome MFP with flexible finishing options', 1, 5600.00, NULL, 5600, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, '2025-08-05 22:29:00.526098', '2025-08-05 22:29:00.526098');
INSERT INTO public.proposal_line_items VALUES ('0cec8213-a3ea-4652-93d2-4ecfa03aa47f', '550e8400-e29b-41d4-a716-446655440000', '3ea7dd27-0c12-4bbd-891c-c5f0be35e49f', 2, 'product_accessories', '6b9b1ea8-6c39-4ba9-bb10-bba522d6cf49', 'Additional paper tray for 550 sheets', 'Additional paper tray for 550 sheets', 1, 385.00, NULL, 385, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, '2025-08-05 22:29:00.526098', '2025-08-05 22:29:00.526098');
INSERT INTO public.proposal_line_items VALUES ('6c86bb18-6155-4cc8-a525-a40b3a9b7bc2', '550e8400-e29b-41d4-a716-446655440000', '863487fd-5bd3-4358-b9ba-5f07a022476e', 1, 'product_models', '0705feb3-85e2-4440-8c0a-61790e9b3862', 'bizhub 454e', 'Fast monochrome MFP with flexible finishing options', 1, 5600.00, NULL, 5600, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, '2025-08-05 23:40:53.545124', '2025-08-05 23:40:53.545124');
INSERT INTO public.proposal_line_items VALUES ('4e2622be-979a-49c5-ae19-7a7872477c02', '550e8400-e29b-41d4-a716-446655440000', 'ffd815ec-993c-4a63-b709-7ba224af9843', 1, 'product_models', 'ab372198-e4fe-4e1e-8a6d-88c5520b127c', 'LaserJet Enterprise 4555x', 'Monochrome laser MFP with advanced security features', 1, 4200.00, NULL, 4200, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, '2025-08-06 04:32:03.781489', '2025-08-06 04:32:03.781489');
INSERT INTO public.proposal_line_items VALUES ('73733041-4bb5-4a71-b911-fde3f889f5de', '550e8400-e29b-41d4-a716-446655440000', 'ffd815ec-993c-4a63-b709-7ba224af9843', 2, 'product_accessories', '6b9b1ea8-6c39-4ba9-bb10-bba522d6cf49', 'Additional paper tray for 550 sheets', 'Additional paper tray for 550 sheets', 1, 385.00, NULL, 385, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, '2025-08-06 04:32:03.781489', '2025-08-06 04:32:03.781489');
INSERT INTO public.proposal_line_items VALUES ('76490d33-8fe8-4c7c-80c0-e9773e2c7d0c', '550e8400-e29b-41d4-a716-446655440000', '24811ff5-b64d-49e4-a306-2078282577f0', 1, 'product_models', '443f1daa-e4b3-4019-b58b-c8b8d8798011', 'imageRUNNER C3025i', 'Color multifunction printer with advanced productivity features', 1, 3250.00, NULL, 3250, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, '2025-08-08 20:19:53.108403', '2025-08-08 20:19:53.108403');
INSERT INTO public.proposal_line_items VALUES ('17b90025-a011-477e-a22e-96c236a61fe2', '550e8400-e29b-41d4-a716-446655440000', '69d055fc-48a2-4c26-b315-fdae653282ac', 1, 'product_models', 'baad08b0-9234-4ecd-828f-b750c321915a', 'VersaLink C8000', 'Color production printer with exceptional print quality', 1, 72000.00, NULL, 72000, NULL, NULL, NULL, NULL, false, false, NULL, NULL, NULL, '2025-08-09 12:50:05.442915', '2025-08-09 12:50:05.442915');


--
-- Data for Name: proposal_templates; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: proposals; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.proposals VALUES ('0e6a9b0b-2bbb-4a75-bf30-d08e38431a47', '550e8400-e29b-41d4-a716-446655440000', 'PROP-2025-0001', '1.0', 'new quote', 'lead-001', '0fe2df39-cdfc-4755-b0bf-dd560325c547', '58c36f26-c458-400b-8055-5dfa31afa88a', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, 'quote', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2250, 0, 0, 0, 2250, '2025-10-31 00:00:00', NULL, NULL, 'draft', 'medium', NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '', '2025-08-05 21:26:54.611894', '2025-08-05 21:26:54.611894');
INSERT INTO public.proposals VALUES ('00f40f28-317f-44ea-9073-fb709f9d9285', '550e8400-e29b-41d4-a716-446655440000', 'PROP-2025-0002', '1.0', 'new new', 'lead-001', '88cca1f0-3ebc-4f57-a3dc-cca0f6597772', '58c36f26-c458-400b-8055-5dfa31afa88a', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, 'quote', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5600, 0, 0, 0, 5600, '2025-10-10 00:00:00', NULL, NULL, 'draft', 'medium', NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, '', '2025-08-05 21:27:25.863645', '2025-08-05 21:27:25.863645');
INSERT INTO public.proposals VALUES ('95df7b39-dc93-4743-9a55-bf18bd396be8', '550e8400-e29b-41d4-a716-446655440000', 'PROP-2025-0003', '1.0', 'new', 'lead-001', '0fe2df39-cdfc-4755-b0bf-dd560325c547', '58c36f26-c458-400b-8055-5dfa31afa88a', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, 'quote', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3250, 0, 0, 0, 3250, '2025-11-07 00:00:00', NULL, NULL, 'sent', 'medium', '2025-08-05 21:28:40.616', NULL, NULL, NULL, 0, NULL, NULL, NULL, '', '2025-08-05 21:28:40.397928', '2025-08-05 21:28:40.616');
INSERT INTO public.proposals VALUES ('69d055fc-48a2-4c26-b315-fdae653282ac', '550e8400-e29b-41d4-a716-446655440000', 'PROP-2025-0009', '1.0', '', 'e620280d-b634-413f-ba65-9b177523cd95', '2bf936cf-5ac7-477e-b7fa-e1315f88dcb5', '58c36f26-c458-400b-8055-5dfa31afa88a', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, 'quote', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 72000, -7200, -10, 6534, 72000, '2025-08-29 00:00:00', NULL, NULL, 'sent', 'medium', '2025-08-09 12:50:05.798', NULL, NULL, NULL, 0, NULL, NULL, NULL, '', '2025-08-09 12:50:05.419236', '2025-08-09 12:50:05.798');
INSERT INTO public.proposals VALUES ('6ac71c6e-d8a1-4eb4-9c2e-e0a19b60c9d2', '550e8400-e29b-41d4-a716-446655440000', 'PROP-2025-0004', '1.0', 'new Plus', 'lead-001', '88cca1f0-3ebc-4f57-a3dc-cca0f6597772', '58c36f26-c458-400b-8055-5dfa31afa88a', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, 'quote', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5985, 0, 0, 0, 5985, '2025-10-03 00:00:00', NULL, NULL, 'sent', 'medium', '2025-08-05 21:47:33.5', NULL, NULL, NULL, 0, NULL, NULL, NULL, '', '2025-08-05 21:47:33.185412', '2025-08-05 21:47:33.5');
INSERT INTO public.proposals VALUES ('3ea7dd27-0c12-4bbd-891c-c5f0be35e49f', '550e8400-e29b-41d4-a716-446655440000', 'PROP-2025-0005', '1.0', 'New guy', 'lead-002', '472affee-8c88-4883-afc0-00d6a20152d4', '58c36f26-c458-400b-8055-5dfa31afa88a', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, 'quote', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5985, -598.5, -10, 0, 5985, '2025-08-29 00:00:00', NULL, NULL, 'sent', 'medium', '2025-08-05 22:29:00.917', NULL, NULL, NULL, 0, NULL, NULL, NULL, '', '2025-08-05 22:29:00.488938', '2025-08-05 22:29:00.917');
INSERT INTO public.proposals VALUES ('863487fd-5bd3-4358-b9ba-5f07a022476e', '550e8400-e29b-41d4-a716-446655440000', 'PROP-2025-0006', '1.0', 'Last Try', 'e620280d-b634-413f-ba65-9b177523cd95', '2bf936cf-5ac7-477e-b7fa-e1315f88dcb5', '58c36f26-c458-400b-8055-5dfa31afa88a', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, 'quote', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5600, -560, -10, 0, 5600, '2025-08-29 00:00:00', NULL, NULL, 'sent', 'medium', '2025-08-05 23:40:53.727', NULL, NULL, NULL, 0, NULL, NULL, NULL, '', '2025-08-05 23:40:53.523969', '2025-08-05 23:40:53.727');
INSERT INTO public.proposals VALUES ('ffd815ec-993c-4a63-b709-7ba224af9843', '550e8400-e29b-41d4-a716-446655440000', 'PROP-2025-0007', '1.0', 'Super big deal', 'adc117e7-611d-426a-b569-6c6c0bdaf750', '645a16c7-73a1-4e05-9abe-c4ab3ee1903d', '58c36f26-c458-400b-8055-5dfa31afa88a', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, 'quote', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4585, -917, -20, 453.915, 4585, '2025-09-30 00:00:00', NULL, NULL, 'sent', 'medium', '2025-08-06 04:32:04.123', NULL, NULL, NULL, 0, NULL, NULL, NULL, '', '2025-08-06 04:32:03.762445', '2025-08-06 04:32:04.123');
INSERT INTO public.proposals VALUES ('24811ff5-b64d-49e4-a306-2078282577f0', '550e8400-e29b-41d4-a716-446655440000', 'PROP-2025-0008', '1.0', 'Trail Quote', 'lead-001', '88cca1f0-3ebc-4f57-a3dc-cca0f6597772', '58c36f26-c458-400b-8055-5dfa31afa88a', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, 'quote', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3250, -325, -10, 294.9375, 3250, '2025-08-29 00:00:00', NULL, NULL, 'sent', 'medium', '2025-08-08 20:19:53.344', NULL, NULL, NULL, 0, NULL, NULL, NULL, '', '2025-08-08 20:19:53.08988', '2025-08-08 20:19:53.344');


--
-- Data for Name: prospecting_campaigns; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.prospecting_campaigns VALUES ('7c6483c0-2f6d-478a-ba5b-3e9d4cb3a18a', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'IT Decision Makers Q1 2025', 'email_sequence', 'Targeting IT decision makers in mid-market companies for copier equipment upgrades', 'Information Technology', 'Mid-Market', '{CTO,"IT Director","VP of Operations"}', 'active', 45, 28, 8, 0.2857, 0, NULL, '2025-08-02 17:00:14.749829', NULL, '2025-08-02 17:00:14.749829', '2025-08-02 17:00:14.749829');
INSERT INTO public.prospecting_campaigns VALUES ('9cb01b3d-0828-4443-bf82-918b4d2b3129', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Office Managers Outreach', 'phone_campaign', 'Direct phone outreach to office managers for equipment needs assessment', 'Business Services', 'SMB', '{"Office Manager","Facilities Manager","Operations Manager"}', 'completed', 32, 32, 12, 0.3750, 0, NULL, '2025-08-02 17:00:14.749829', NULL, '2025-08-02 17:00:14.749829', '2025-08-02 17:00:14.749829');


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: qb_customers; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: qb_invoices; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: qb_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: qb_vendors; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: quickbooks_integrations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: quote_line_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.quote_line_items VALUES ('qli-001', '550e8400-e29b-41d4-a716-446655440000', 'quote-001', 'Canon imageRUNNER ADVANCE C3326i MFP', 1, 2800.0000, 2800.00, 'service', '2025-08-07 20:06:36.228105');
INSERT INTO public.quote_line_items VALUES ('qli-002', '550e8400-e29b-41d4-a716-446655440000', 'quote-001', 'Additional Paper Tray', 2, 185.0000, 370.00, 'service', '2025-08-07 20:06:36.228105');
INSERT INTO public.quote_line_items VALUES ('qli-003', '550e8400-e29b-41d4-a716-446655440000', 'quote-001', 'Service Contract - 36 months', 1, 1782.0000, 1782.00, 'service', '2025-08-07 20:06:36.228105');
INSERT INTO public.quote_line_items VALUES ('qli-004', '550e8400-e29b-41d4-a716-446655440000', 'quote-002', 'Monthly Service Plan - Premium', 36, 168.0000, 6048.00, 'service', '2025-08-07 20:06:36.228105');
INSERT INTO public.quote_line_items VALUES ('qli-005', '550e8400-e29b-41d4-a716-446655440000', 'quote-003', 'HP LaserJet Enterprise M507dn', 3, 899.0000, 2697.00, 'service', '2025-08-07 20:06:36.228105');
INSERT INTO public.quote_line_items VALUES ('qli-006', '550e8400-e29b-41d4-a716-446655440000', 'quote-003', 'HP 89A Toner Cartridges', 12, 89.0000, 1068.00, 'service', '2025-08-07 20:06:36.228105');
INSERT INTO public.quote_line_items VALUES ('qli-007', '550e8400-e29b-41d4-a716-446655440000', 'quote-003', 'Installation & Setup', 1, 699.0000, 699.00, 'service', '2025-08-07 20:06:36.228105');


--
-- Data for Name: quote_pricing; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.quote_pricing VALUES ('27bc9ca5-0ce5-47e5-b97c-4d8b670a7e68', '550e8400-e29b-41d4-a716-446655440000', 'lead-1', 'customer-1', 'Q-2025-001', 12.00, true, 3555.00, 4623.25, 5200.00, 1576.75, 34.13, 'draft', '6f3224b2-221c-42ad-a7f5-a24a11e33621', NULL, NULL, '2025-08-01 18:36:49.005289', '2025-08-01 18:36:49.005289');
INSERT INTO public.quote_pricing VALUES ('ef1ab552-fdda-4e04-a8f7-558353ad9d67', '550e8400-e29b-41d4-a716-446655440000', 'lead-2', 'customer-2', 'Q-2025-002', 8.50, false, 5250.00, 6750.00, 7400.00, 2150.00, 40.95, 'pending', '6f3224b2-221c-42ad-a7f5-a24a11e33621', NULL, NULL, '2025-08-01 18:36:49.005289', '2025-08-01 18:36:49.005289');
INSERT INTO public.quote_pricing VALUES ('c6558911-56c0-4daf-88b5-224667fd2ade', '550e8400-e29b-41d4-a716-446655440000', NULL, 'customer-3', 'Q-2025-003', 15.00, true, 375.00, 610.00, 720.00, 345.00, 92.00, 'approved', '6f3224b2-221c-42ad-a7f5-a24a11e33621', NULL, NULL, '2025-08-01 18:36:49.005289', '2025-08-01 18:36:49.005289');


--
-- Data for Name: quote_pricing_line_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.quote_pricing_line_items VALUES ('1e1ddab9-faa1-4204-a3a0-c9e35beeaed7', '550e8400-e29b-41d4-a716-446655440000', '27bc9ca5-0ce5-47e5-b97c-4d8b670a7e68', 1, 'CANON-IR-C3025i', 'model', 'Canon imageRUNNER C3025i Color Multifunction Printer', 1, 2500.00, 3250.00, 3640.00, 1140.00, 45.60, true, '2025-08-01 18:37:03.801168', '2025-08-01 18:37:03.801168');
INSERT INTO public.quote_pricing_line_items VALUES ('1cf6a68b-24be-4922-84f9-de81058dc859', '550e8400-e29b-41d4-a716-446655440000', '27bc9ca5-0ce5-47e5-b97c-4d8b670a7e68', 2, 'FINISHER-BOOKLET-FB501', 'accessory', 'Booklet Finisher FB-501', 1, 800.00, 1080.00, 1209.60, 409.60, 51.20, true, '2025-08-01 18:37:03.801168', '2025-08-01 18:37:03.801168');
INSERT INTO public.quote_pricing_line_items VALUES ('af78a019-13ff-4f75-9c7a-70e430864078', '550e8400-e29b-41d4-a716-446655440000', '27bc9ca5-0ce5-47e5-b97c-4d8b670a7e68', 3, 'SETUP-INSTALLATION', 'service', 'Professional Setup and Installation', 1, 150.00, 225.00, 252.00, 102.00, 68.00, true, '2025-08-01 18:37:03.801168', '2025-08-01 18:37:03.801168');
INSERT INTO public.quote_pricing_line_items VALUES ('1204fa32-26f5-48b6-acb7-fd58a8da8808', '550e8400-e29b-41d4-a716-446655440000', '27bc9ca5-0ce5-47e5-b97c-4d8b670a7e68', 4, 'TRAINING-BASIC', 'service', 'Basic User Training (2 hours)', 1, 100.00, 160.00, 179.20, 79.20, 79.20, true, '2025-08-01 18:37:03.801168', '2025-08-01 18:37:03.801168');
INSERT INTO public.quote_pricing_line_items VALUES ('2736d84d-f56b-4f48-a3d6-11b0dd330485', '550e8400-e29b-41d4-a716-446655440000', '27bc9ca5-0ce5-47e5-b97c-4d8b670a7e68', 5, 'TONER-BLACK-GPR-58', 'supply', 'Black Toner Cartridge GPR-58', 2, 45.00, 54.00, 60.48, 15.48, 34.40, true, '2025-08-01 18:37:03.801168', '2025-08-01 18:37:03.801168');
INSERT INTO public.quote_pricing_line_items VALUES ('01542cd2-3726-47d6-bd7a-e80d240d1672', '550e8400-e29b-41d4-a716-446655440000', 'ef1ab552-fdda-4e04-a8f7-558353ad9d67', 1, 'CANON-IR-C3025i', 'model', 'Canon imageRUNNER C3025i Color Multifunction Printer (qty 2)', 2, 2500.00, 3250.00, 3400.00, 900.00, 36.00, false, '2025-08-01 18:37:17.148227', '2025-08-01 18:37:17.148227');
INSERT INTO public.quote_pricing_line_items VALUES ('ad0378b1-7067-4597-b128-1dafc63b2316', '550e8400-e29b-41d4-a716-446655440000', 'ef1ab552-fdda-4e04-a8f7-558353ad9d67', 2, 'XEROX-WorkCentre-6515', 'model', 'Xerox WorkCentre 6515 Color Multifunction Printer', 1, 350.00, 448.00, 600.00, 250.00, 71.43, false, '2025-08-01 18:37:17.148227', '2025-08-01 18:37:17.148227');
INSERT INTO public.quote_pricing_line_items VALUES ('aef4f12c-a9c6-42cd-ba3c-f14a5da9b24a', '550e8400-e29b-41d4-a716-446655440000', 'ef1ab552-fdda-4e04-a8f7-558353ad9d67', 3, 'PRINT-MANAGEMENT-SUITE', 'software', 'Enterprise Print Management Suite (5 users)', 1, 200.00, 290.00, 400.00, 110.00, 55.00, false, '2025-08-01 18:37:17.148227', '2025-08-01 18:37:17.148227');
INSERT INTO public.quote_pricing_line_items VALUES ('939f5e40-24ac-4b8d-ac66-4ce2dfca59c0', '550e8400-e29b-41d4-a716-446655440000', 'c6558911-56c0-4daf-88b5-224667fd2ade', 1, 'SETUP-INSTALLATION', 'service', 'Professional Setup and Installation', 2, 150.00, 225.00, 258.75, 108.75, 72.50, true, '2025-08-01 18:37:23.815744', '2025-08-01 18:37:23.815744');
INSERT INTO public.quote_pricing_line_items VALUES ('8db304b5-2c70-4672-a749-f16bdfed2a13', '550e8400-e29b-41d4-a716-446655440000', 'c6558911-56c0-4daf-88b5-224667fd2ade', 2, 'TRAINING-BASIC', 'service', 'Basic User Training (2 hours)', 2, 100.00, 160.00, 184.00, 84.00, 84.00, true, '2025-08-01 18:37:23.815744', '2025-08-01 18:37:23.815744');
INSERT INTO public.quote_pricing_line_items VALUES ('6eec5dba-63be-47cd-9a93-44f5bf669703', '550e8400-e29b-41d4-a716-446655440000', 'c6558911-56c0-4daf-88b5-224667fd2ade', 3, 'NETWORK-CONFIG', 'service', 'Network Configuration Service', 1, 75.00, 125.00, 143.75, 68.75, 91.67, true, '2025-08-01 18:37:23.815744', '2025-08-01 18:37:23.815744');
INSERT INTO public.quote_pricing_line_items VALUES ('ba604c53-c436-48b1-bf1a-17f54b757656', '550e8400-e29b-41d4-a716-446655440000', 'c6558911-56c0-4daf-88b5-224667fd2ade', 4, 'MOBILE-PRINT-APP', 'software', 'Mobile Print Application License', 1, 50.00, 90.00, 103.50, 53.50, 107.00, true, '2025-08-01 18:37:23.815744', '2025-08-01 18:37:23.815744');


--
-- Data for Name: quotes; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.quotes VALUES ('quote-001', '550e8400-e29b-41d4-a716-446655440000', 'lead-001', 'adc117e7-611d-426a-b569-6c6c0bdaf750', 'PROP-2025-0003', 'Super big deal', 4952.00, 'Draft', '2025-09-29 00:00:00', NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-07 20:06:06.640789', '2025-08-07 20:06:06.640789', 'Net 30 payment terms', 'Complete office setup with printers and supplies');
INSERT INTO public.quotes VALUES ('quote-002', '550e8400-e29b-41d4-a716-446655440000', 'lead-001', 'adc117e7-611d-426a-b569-6c6c0bdaf750', 'PROP-2025-0006', 'Last Try', 6048.00, 'Sent', '2025-08-28 00:00:00', '2025-08-06 20:06:06.640789', NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-07 20:06:06.640789', '2025-08-07 20:06:06.640789', 'Net 15 payment terms', 'Monthly service contract');
INSERT INTO public.quotes VALUES ('quote-003', '550e8400-e29b-41d4-a716-446655440000', 'lead-001', 'adc117e7-611d-426a-b569-6c6c0bdaf750', 'PROP-2025-0005', 'New guy', 6464.00, 'Sent', '2025-08-28 00:00:00', '2025-08-05 20:06:06.640789', NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-07 20:06:06.640789', '2025-08-07 20:06:06.640789', 'Net 30 payment terms', 'Equipment replacement program');


--
-- Data for Name: regions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.roles VALUES ('446afac0-f6c1-4657-87f5-96a3b83a7cdf', 'System Administrator', 'SYSTEM_ADMIN', 'admin', 5, 'Full system access and user management', '"{\"admin\":[\"*\"],\"sales\":[\"*\"],\"service\":[\"*\"],\"finance\":[\"*\"],\"purchasing\":[\"*\"],\"reports\":[\"*\"]}"', '2025-08-01 01:58:55.215737', 'department_role', false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('2235104d-4119-42e3-90c0-91c6dba981db', 'Director', 'DIRECTOR', 'operations', 4, 'Cross-department access and strategic oversight', '"{\"sales\":[\"*\"],\"service\":[\"*\"],\"finance\":[\"view-reports\",\"approve-invoices\"],\"purchasing\":[\"view-inventory\",\"approve-orders\"],\"reports\":[\"*\"]}"', '2025-08-01 01:58:55.239968', 'department_role', false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('a7c13dc3-9840-4005-9820-f9110da314f0', 'Team Lead', 'TEAM_LEAD', 'sales', 2, 'Leads a specific team within department', '"{\"sales\":[\"manage-team-leads\",\"view-team-customers\",\"create-quotes\"],\"service\":[\"view-tickets\"],\"reports\":[\"team-reports\"]}"', '2025-08-01 01:58:55.294623', 'department_role', false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('e7eed447-4a4f-44da-9b18-daa0af00340e', 'Service Technician', 'TECHNICIAN', 'service', 1, 'Field service technician', '"{\"service\":[\"manage-assigned-tickets\",\"update-work-orders\",\"record-parts\"],\"sales\":[\"view-customer-info\"],\"reports\":[\"personal-reports\"]}"', '2025-08-01 01:58:55.332185', 'department_role', false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('service-tech-role', 'Service Technician', 'SERVICE_TECH', 'service', 1, 'Field service technician with work order and maintenance access', '{"admin": ["read_limited"], "finance": ["read_limited"], "reports": ["read", "service_limited"], "service": ["read", "write", "field_access"]}', '2025-08-01 15:01:24.714414', 'department_role', false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('finance-director-role', 'Finance Director', 'FINANCE_DIRECTOR', 'finance', 4, 'Financial operations leadership with full accounting authority', '{"admin": ["read"], "sales": ["read", "pricing"], "finance": ["*"], "reports": ["read", "finance"], "service": ["read"]}', '2025-08-01 15:01:24.749038', 'department_role', false, true, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('finance-manager-role', 'Finance Manager', 'FINANCE_MANAGER', 'finance', 3, 'Financial management with billing and accounts authority', '{"admin": ["read"], "sales": ["read"], "finance": ["read", "write", "billing"], "reports": ["read", "finance"], "service": ["read"]}', '2025-08-01 15:01:24.780671', 'department_role', false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('root-admin-role', 'Root Administrator', 'ROOT_ADMIN', 'platform', 7, 'Ultimate system access for backend Printyx operations and system setup', '{"admin": ["*"], "sales": ["*"], "system": ["*"], "finance": ["*"], "reports": ["*"], "service": ["*"], "platform": ["*"], "purchasing": ["*"]}', '2025-08-01 15:01:24.380538', 'platform_admin', true, true, true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('printyx-support-role', 'Printyx Support Specialist', 'PRINTYX_SUPPORT', 'platform', 6, 'Customer troubleshooting and support access across all tenant companies', '{"admin": ["read"], "sales": ["read"], "system": ["read"], "finance": ["read"], "reports": ["read"], "service": ["read", "write"], "platform": ["read", "support"], "purchasing": ["read"]}', '2025-08-01 15:01:24.418468', 'platform_admin', true, false, true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('printyx-technical-role', 'Printyx Technical Specialist', 'PRINTYX_TECHNICAL', 'platform', 6, 'System diagnostics and technical troubleshooting across tenant environments', '{"admin": ["read"], "sales": ["read"], "system": ["read", "diagnose"], "finance": ["read"], "reports": ["read"], "service": ["read", "write", "diagnose"], "platform": ["read", "diagnose"], "purchasing": ["read"]}', '2025-08-01 15:01:24.472651', 'platform_admin', true, false, true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('company-admin-role', 'Company Administrator', 'COMPANY_ADMIN', 'admin', 5, 'High-level company management with full access to company tenant features', '{"admin": ["*"], "sales": ["*"], "finance": ["*"], "reports": ["*"], "service": ["*"], "purchasing": ["*"]}', '2025-08-01 15:01:24.5053', 'company_admin', false, true, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('sales-director-role', 'Sales Director', 'SALES_DIRECTOR', 'sales', 4, 'Sales department leadership with full sales and pricing authority', '{"admin": ["read"], "sales": ["*"], "finance": ["read", "pricing"], "reports": ["read", "sales"]}', '2025-08-01 15:01:24.543544', 'department_role', false, true, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('da35e22f-1d89-4399-a61c-f10d898d0e51', 'Sales Manager', 'SALES_MANAGER', 'sales', 3, 'Sales team management with pricing approval authority', '{"admin": ["read"], "sales": ["read", "write", "approve_pricing"], "finance": ["read"], "reports": ["read", "sales"]}', '2025-08-01 01:58:55.258292', 'department_role', false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('0d3426be-53c0-4758-8055-0527d51e0279', 'Sales Representative', 'SALES_REP', 'sales', 1, 'Individual sales representative with limited pricing authority (requires approval)', '{"admin": ["read_limited"], "sales": ["read", "write", "request_pricing"], "finance": ["read_limited"], "reports": ["read", "sales_limited"]}', '2025-08-01 01:58:55.313529', 'department_role', false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('service-director-role', 'Service Director', 'SERVICE_DIRECTOR', 'service', 4, 'Service department leadership with full service operations authority', '{"admin": ["read"], "finance": ["read"], "reports": ["read", "service"], "service": ["*"]}', '2025-08-01 15:01:24.649797', 'department_role', false, true, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
INSERT INTO public.roles VALUES ('d2d10612-a4b0-43b9-8a99-f2f1350059e2', 'Service Manager', 'SERVICE_MANAGER', 'service', 3, 'Service team management with technician scheduling authority', '{"admin": ["read"], "finance": ["read"], "reports": ["read", "service"], "service": ["read", "write", "schedule"]}', '2025-08-01 01:58:55.27621', 'department_role', false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);


--
-- Data for Name: sales_forecasts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.sales_forecasts VALUES ('90728b95-dd3a-42a2-8719-dea28e264666', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Q1 2025 Sales Forecast', 'quarterly', 'First quarter sales projection for 2025', '2025-01-01 00:00:00', '2025-03-31 00:00:00', 500000.00, 25, 15, 0.00, 0, 0, 0.00, 0.00, 0.00, 'high', 85, 0.00, 0.00, 30, 'active', 0.00, 0.00, 0.00, NULL, '[]', NULL, NULL, NULL, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, '2025-08-08 12:05:35.600556', '2025-08-08 12:05:35.600556', NULL);


--
-- Data for Name: sales_quotas; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.sales_quotas VALUES ('0ec3af98-86ee-4ccb-9548-402981da9449', '550e8400-e29b-41d4-a716-446655440000', '2025-08-01', '2025-08-31', 'revenue', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, NULL, 100000.00, NULL, NULL, 75000.00, 75.00, NULL, NULL, NULL, NULL, 'active', '2025-08-03', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, '2025-08-03 13:02:42.326712', '2025-08-03 13:02:42.326712');
INSERT INTO public.sales_quotas VALUES ('d150d1b1-f17d-4ad9-b8b5-e8df50d1e2df', '550e8400-e29b-41d4-a716-446655440000', '2025-07-01', '2025-07-31', 'revenue', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, NULL, 90000.00, NULL, NULL, 95000.00, 105.60, NULL, NULL, NULL, NULL, 'completed', '2025-08-03', '58c36f26-c458-400b-8055-5dfa31afa88a', NULL, NULL, '2025-08-03 13:02:42.326712', '2025-08-03 13:02:42.326712');


--
-- Data for Name: sales_representatives; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.sales_representatives VALUES ('a1447ec5-63e9-47a9-9e5d-fbca671e1864', '550e8400-e29b-41d4-a716-446655440000', 'SALES001', NULL, 'Jennifer Martinez', 'jennifer.martinez@company.com', '+1-555-0201', NULL, NULL, NULL, NULL, '6bb474fb-3b04-4b82-8a95-ed2295e3bf92', NULL, NULL, 125000.00, 350000.00, 1200000.00, 115.50, 'payroll', 'employee', 'active', NULL, NULL, '2025-08-03 14:40:04.477036', '2025-08-03 14:40:04.477036');
INSERT INTO public.sales_representatives VALUES ('d69af46c-53b5-4c27-8d73-0fc1b38ad9ce', '550e8400-e29b-41d4-a716-446655440000', 'SALES002', NULL, 'Michael Thompson', 'michael.thompson@company.com', '+1-555-0202', NULL, NULL, NULL, NULL, '611c5e7d-e122-457b-a2f9-a737f7493afa', NULL, NULL, 95000.00, 275000.00, 950000.00, 98.20, 'payroll', 'employee', 'active', NULL, NULL, '2025-08-03 14:40:04.477036', '2025-08-03 14:40:04.477036');
INSERT INTO public.sales_representatives VALUES ('81b32926-af7c-460b-af2e-6b73a9d8a509', '550e8400-e29b-41d4-a716-446655440000', 'SALES003', NULL, 'Amanda Chen', 'amanda.chen@company.com', '+1-555-0203', NULL, NULL, NULL, NULL, '56c8ae32-4ca6-40a0-b4e4-f9a9466c6a70', NULL, NULL, 78000.00, 245000.00, 890000.00, 102.80, 'payroll', 'employee', 'active', NULL, NULL, '2025-08-03 14:40:04.477036', '2025-08-03 14:40:04.477036');
INSERT INTO public.sales_representatives VALUES ('3180e2ec-bdd4-4c50-aeb5-7035769afc78', '550e8400-e29b-41d4-a716-446655440000', 'SALES004', NULL, 'Robert Johnson', 'robert.johnson@company.com', '+1-555-0204', NULL, NULL, NULL, NULL, '6bb474fb-3b04-4b82-8a95-ed2295e3bf92', NULL, NULL, 110000.00, 320000.00, 1100000.00, 108.70, 'payroll', 'employee', 'active', NULL, NULL, '2025-08-03 14:40:04.477036', '2025-08-03 14:40:04.477036');


--
-- Data for Name: seo_pages; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.seo_pages VALUES ('7841c117-731a-42c0-8d94-124d6ff0ef19', NULL, '/', 'Printyx — Print Fleet CRM, Service, Finance Platform', 'All-in-one platform: CRM, Service, Inventory, Billing, and Reporting for print dealers.', '2025-08-10 02:26:25.816', 'weekly', 1.0, true, 'Organization', '{"url": "https://printyx.net", "name": "Printyx"}', '2025-08-10 02:26:25.822909', '2025-08-10 02:26:25.822909');
INSERT INTO public.seo_pages VALUES ('49689803-e984-424d-8d84-a0e9b2237371', NULL, '/product-hub', 'Product Hub — Catalog, Inventory, and POs', 'Manage master catalog, enable products, inventory, purchase orders, and warehouse ops.', '2025-08-10 02:26:25.867', 'weekly', 0.8, true, 'Service', '{"name": "Product Management", "serviceType": "Inventory and Catalog Management"}', '2025-08-10 02:26:25.872808', '2025-08-10 02:26:25.872808');
INSERT INTO public.seo_pages VALUES ('9b4d10cd-89e8-45a9-b0d7-ea59fbd47b4a', NULL, '/product-catalog', 'Master Product Catalog — Canon imageRUNNER, imagePRESS, Accessories', 'Browse the master catalog. Enable equipment and accessories for your tenant with pricing overrides.', '2025-08-10 02:26:25.915', 'weekly', 0.8, true, 'Service', '{"name": "Master Product Catalog"}', '2025-08-10 02:26:25.923053', '2025-08-10 02:26:25.923053');
INSERT INTO public.seo_pages VALUES ('cb672656-d2b1-4f9d-afa1-961c50ffb5e8', NULL, '/crm', 'CRM — Leads, Deals, Quotes, Proposals', 'End-to-end sales workflow with activities, quotes, proposals, and pipeline forecasting.', '2025-08-10 02:26:26.229', 'weekly', 0.7, true, 'SoftwareApplication', '{"name": "Printyx CRM", "applicationCategory": "BusinessApplication"}', '2025-08-10 02:26:26.234817', '2025-08-10 02:26:26.234817');
INSERT INTO public.seo_pages VALUES ('d8863fe7-97f2-4c1e-917c-4034a49e2865', NULL, '/service-hub', 'Service Hub — Dispatch, PM, Field Operations', 'Ticketing, dispatch optimization, preventive maintenance, and mobile field service.', '2025-08-10 02:26:26.26', 'weekly', 0.7, true, 'Service', '{"name": "Printyx Service"}', '2025-08-10 02:26:26.266291', '2025-08-10 02:26:26.266291');
INSERT INTO public.seo_pages VALUES ('74732f0f-0529-471e-8577-320100fd37cb', NULL, '/reports', 'Reports — Sales, Service, Finance KPIs', 'Unified reporting across CRM, Service, Finance, and Product. Standardized KPIs and dashboards.', '2025-08-10 02:26:26.292', 'monthly', 0.6, true, 'WebSite', '{"name": "Printyx Reports"}', '2025-08-10 02:26:26.297593', '2025-08-10 02:26:26.297593');


--
-- Data for Name: seo_settings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.seo_settings VALUES ('18ce3ce5-39f5-4d8a-bb7c-0d69783e2fca', NULL, 'Printyx', 'https://Printyx.net', 'Printyx - Unified Copier Dealer Management Platform', '', '', '', true, 'weekly', 0.5, NULL, '2025-08-10 02:26:25.767586', '2025-08-10 02:27:47.999');


--
-- Data for Name: service_performance_metrics; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: service_products; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.service_products VALUES ('b964c1a3-15c4-4947-8201-e199374e348e', '550e8400-e29b-41d4-a716-446655440000', 'SVC-MAINT-001', 'Monthly Maintenance Plan', 'Service', 'Maintenance', 'Standard', 'Comprehensive monthly maintenance service including cleaning, inspection, and minor repairs', 'Monthly maintenance plan for copier equipment', NULL, NULL, NULL, true, false, false, true, true, false, 'Monthly', true, 89.00, true, 79.00, false, NULL, false, NULL, '2025-08-01 03:21:21.952917', '2025-08-01 03:21:21.952917');
INSERT INTO public.service_products VALUES ('2e7f49da-5493-4dac-b88a-35942802c032', '550e8400-e29b-41d4-a716-446655440000', 'SVC-SUPPORT-001', 'Premium Support Package', 'Service', 'Support', 'Premium', '24/7 technical support with priority response times and remote diagnostics', 'Premium support package with 24/7 coverage', NULL, NULL, NULL, true, false, false, true, true, false, 'Monthly', true, 149.00, true, 129.00, false, NULL, false, NULL, '2025-08-01 03:21:21.952917', '2025-08-01 03:21:21.952917');
INSERT INTO public.service_products VALUES ('01036f20-bfa4-41cf-a28b-3d070f7931bd', '550e8400-e29b-41d4-a716-446655440000', 'SVC-WARRANTY-001', 'Extended Warranty Service', 'Service', 'Extended Warranty', 'Extended', 'Extended warranty coverage beyond manufacturer warranty with parts and labor', 'Extended warranty service for equipment protection', NULL, NULL, NULL, true, false, false, true, true, false, 'Annual', true, 199.00, true, 179.00, false, NULL, false, NULL, '2025-08-01 03:21:21.952917', '2025-08-01 03:21:21.952917');
INSERT INTO public.service_products VALUES ('f94d0037-2581-4f7c-a024-41835ed3f8eb', '550e8400-e29b-41d4-a716-446655440000', 'SVC-MONITOR-001', 'Remote Monitoring Service', 'Service', 'Remote Monitoring', 'Advanced', 'Proactive remote monitoring with automated alerts and performance analytics', 'Remote monitoring service with proactive alerts', NULL, NULL, NULL, true, false, false, true, true, false, 'Monthly', true, 59.00, true, 49.00, false, NULL, false, NULL, '2025-08-01 03:21:21.952917', '2025-08-01 03:21:21.952917');
INSERT INTO public.service_products VALUES ('8569d9c2-85d6-4bf4-a492-2874dc27abf7', '550e8400-e29b-41d4-a716-446655440000', 'SVC-PLAN-001', 'Comprehensive Service Plan', 'Service', 'Service Plan', 'Comprehensive', 'All-inclusive service plan covering maintenance, support, parts, and labor', 'Complete service plan with full coverage', NULL, NULL, NULL, true, false, false, true, true, false, 'Monthly', true, 299.00, true, 269.00, false, NULL, false, NULL, '2025-08-01 03:21:21.952917', '2025-08-01 03:21:21.952917');


--
-- Data for Name: service_requests; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: service_templates; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: service_ticket_updates; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: service_tickets; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.service_tickets VALUES ('ticket-1', '550e8400-e29b-41d4-a716-446655440000', 'cust-1', NULL, 'TKT-2024-001', 'Paper Jam Issue', 'Frequent paper jams on main copier', 'high', 'open', NULL, 'system', NULL, '2025-07-31 22:58:55.49755', '2025-07-31 22:58:55.49755', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.service_tickets VALUES ('ticket-2', '550e8400-e29b-41d4-a716-446655440000', 'cust-2', NULL, 'TKT-2024-002', 'Toner Replacement', 'Black toner running low', 'medium', 'in_progress', NULL, 'system', NULL, '2025-07-31 22:58:55.49755', '2025-07-31 22:58:55.49755', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.service_tickets VALUES ('ticket-3', '550e8400-e29b-41d4-a716-446655440000', 'cust-3', NULL, 'TKT-2024-003', 'Maintenance Check', 'Scheduled quarterly maintenance', 'low', 'open', NULL, 'system', NULL, '2025-07-31 22:58:55.49755', '2025-07-31 22:58:55.49755', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: service_trend_analysis; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.sessions VALUES ('N_Yt4uqYxom77ZP2tBcsMtpKBjUFGSUp', '{"cookie": {"path": "/", "secure": false, "expires": "2025-08-11T03:50:16.350Z", "httpOnly": true, "originalMaxAge": 86400000}, "userId": "58c36f26-c458-400b-8055-5dfa31afa88a", "tenantId": "550e8400-e29b-41d4-a716-446655440000"}', '2025-08-11 03:50:17');
INSERT INTO public.sessions VALUES ('I2qevB1ScXo-PNMDCQp3d0WIKmqR9LdR', '{"cookie": {"path": "/", "secure": false, "expires": "2025-08-11T03:50:17.186Z", "httpOnly": true, "originalMaxAge": 86400000}, "userId": "6f3224b2-221c-42ad-a7f5-a24a11e33621", "tenantId": "550e8400-e29b-41d4-a716-446655440000"}', '2025-08-11 03:50:18');
INSERT INTO public.sessions VALUES ('RKZ7bYVfiw8QKF_RnvNGH_UMc-ZYTiXJ', '{"cookie": {"path": "/", "secure": false, "expires": "2025-08-11T04:38:38.607Z", "httpOnly": true, "originalMaxAge": 86400000}, "userId": "6f3224b2-221c-42ad-a7f5-a24a11e33621", "tenantId": "550e8400-e29b-41d4-a716-446655440000"}', '2025-08-11 04:38:39');
INSERT INTO public.sessions VALUES ('HJXTp9cPs9uWAAnvn9EwfRfzWtGxxLXP', '{"cookie": {"path": "/", "secure": false, "expires": "2025-08-11T04:40:42.647Z", "httpOnly": true, "originalMaxAge": 86400000}, "userId": "58c36f26-c458-400b-8055-5dfa31afa88a", "tenantId": "550e8400-e29b-41d4-a716-446655440000"}', '2025-08-11 04:40:43');
INSERT INTO public.sessions VALUES ('rdFpBHBop4Rkug3m3QR3ZMoNZDrZxoO6', '{"cookie": {"path": "/", "secure": false, "expires": "2025-08-10T14:11:15.573Z", "httpOnly": true, "originalMaxAge": 86400000}, "userId": "58c36f26-c458-400b-8055-5dfa31afa88a", "tenantId": "550e8400-e29b-41d4-a716-446655440000"}', '2025-08-10 23:51:18');


--
-- Data for Name: social_media_cron_jobs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: social_media_posts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: software_products; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.software_products VALUES ('0df7a1f7-b575-4f72-8432-8d2d54ff51a0', '550e8400-e29b-41d4-a716-446655440000', 'SW-DMS-001', 'Document Management Suite', 'Application', 'Document Management', NULL, 'Comprehensive document management and workflow automation solution for enterprise environments', 'Complete document management system with workflow automation', NULL, NULL, NULL, NULL, true, false, false, true, true, false, 'License', true, 1200.00, 1499.00, true, 1000.00, 1299.00, true, 400.00, 549.00, NULL, NULL, '2025-08-01 03:25:02.098646', '2025-08-01 03:25:02.098646');
INSERT INTO public.software_products VALUES ('e213d0e0-d787-489a-b6b5-bf2d6b5bd12c', '550e8400-e29b-41d4-a716-446655440000', 'SW-PM-001', 'Print Management Software', 'Application', 'Print Management', NULL, 'Advanced print management and cost control software for multi-device environments', 'Enterprise print management and monitoring solution', NULL, NULL, NULL, NULL, true, false, false, true, true, false, 'Subscription', true, 800.00, 999.00, true, 700.00, 899.00, true, 300.00, 449.00, NULL, NULL, '2025-08-01 03:25:02.098646', '2025-08-01 03:25:02.098646');
INSERT INTO public.software_products VALUES ('086c12ee-003e-4153-a6e1-f34bb68e2c96', '550e8400-e29b-41d4-a716-446655440000', 'SW-SEC-001', 'Security and Authentication Module', 'Plugin', 'Security Software', NULL, 'Advanced security module with user authentication and document encryption capabilities', 'Security enhancement plugin for document systems', NULL, NULL, NULL, NULL, true, false, false, true, true, false, 'License', true, 500.00, 649.00, true, 450.00, 599.00, true, 200.00, 299.00, NULL, NULL, '2025-08-01 03:25:02.098646', '2025-08-01 03:25:02.098646');
INSERT INTO public.software_products VALUES ('4ce5cb45-49a1-4016-9ab3-a2886dbff0a7', '550e8400-e29b-41d4-a716-446655440000', 'SW-CLOUD-001', 'Cloud Sync Service', 'Cloud Service', 'Cloud Solutions', NULL, 'Cloud synchronization service for seamless document access across devices and locations', 'Cloud-based document synchronization service', NULL, NULL, NULL, NULL, true, false, false, true, true, false, 'Subscription', true, 300.00, 399.00, true, 250.00, 349.00, true, 150.00, 199.00, NULL, NULL, '2025-08-01 03:25:02.098646', '2025-08-01 03:25:02.098646');
INSERT INTO public.software_products VALUES ('88590012-52a1-4206-87b4-1f921b9d0788', '550e8400-e29b-41d4-a716-446655440000', 'SW-WF-001', 'Workflow Automation Engine', 'Application', 'Workflow Automation', NULL, 'Intelligent workflow automation engine for document processing and approval workflows', 'Advanced workflow automation and process management', NULL, NULL, NULL, NULL, true, false, false, true, true, false, 'License', true, 1500.00, 1899.00, true, 1300.00, 1699.00, true, 600.00, 799.00, NULL, NULL, '2025-08-01 03:25:02.098646', '2025-08-01 03:25:02.098646');


--
-- Data for Name: supplies; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.supplies VALUES ('d628be7a-2548-4144-9e66-751c992e4195', '550e8400-e29b-41d4-a716-446655440000', 'SUP-TON-001', 'Black Toner Cartridge XL', 'Toner', 'Standard', 'Main Warehouse', '85', 'High-yield black toner cartridge compatible with multiple printer models', NULL, NULL, NULL, true, false, false, true, true, false, 'Per-unit', true, 89.99, true, 79.99, true, 75.99, true, 95.99, NULL, NULL, '2025-08-01 03:28:35.150979', '2025-08-01 03:28:35.150979');
INSERT INTO public.supplies VALUES ('249f0af5-d87b-4ee5-bf47-8fc14a0e415f', '550e8400-e29b-41d4-a716-446655440000', 'SUP-INK-001', 'Color Ink Set CMYK', 'Ink', 'Premium', 'Main Warehouse', '45', 'Complete CMYK ink cartridge set for color printing', NULL, NULL, NULL, true, false, false, true, true, false, 'Per-unit', true, 149.99, true, 139.99, true, 135.99, true, 159.99, NULL, NULL, '2025-08-01 03:28:35.150979', '2025-08-01 03:28:35.150979');
INSERT INTO public.supplies VALUES ('b52c460f-59bb-4331-ac2d-0653cff80443', '550e8400-e29b-41d4-a716-446655440000', 'SUP-PAP-001', 'Premium Copy Paper A4', 'Paper', 'Standard', 'Paper Storage', '120', 'High-quality white copy paper, 80gsm, A4 size, 500 sheets per ream', NULL, NULL, NULL, true, false, false, true, true, false, 'Bulk', true, 12.99, true, 11.99, true, 10.99, true, 14.99, NULL, NULL, '2025-08-01 03:28:35.150979', '2025-08-01 03:28:35.150979');
INSERT INTO public.supplies VALUES ('872d8f50-8f91-4b3e-8852-3d8d5a2cdcd8', '550e8400-e29b-41d4-a716-446655440000', 'SUP-MNT-001', 'Maintenance Kit Standard', 'Maintenance Kit', 'Technical', 'Service Center', '25', 'Complete maintenance kit including rollers, fuser, and cleaning supplies', NULL, NULL, NULL, true, false, false, true, true, false, 'One-time', true, 299.99, true, 279.99, true, 269.99, true, 319.99, NULL, NULL, '2025-08-01 03:28:35.150979', '2025-08-01 03:28:35.150979');
INSERT INTO public.supplies VALUES ('fd0d06c1-38d3-47bd-862f-a41b8eca50c5', '550e8400-e29b-41d4-a716-446655440000', 'SUP-PRT-001', 'Drum Unit Replacement', 'Parts', 'Technical', 'Parts Warehouse', '35', 'Original equipment manufacturer drum unit for optimal print quality', NULL, NULL, NULL, true, false, false, true, true, false, 'Per-unit', true, 199.99, true, 189.99, true, 179.99, true, 219.99, NULL, NULL, '2025-08-01 03:28:35.150979', '2025-08-01 03:28:35.150979');


--
-- Data for Name: supply_order_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: supply_orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: system_integrations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.system_integrations VALUES ('e2d3baaa-fa7c-42c8-8d28-ab53055dc091', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Google Calendar', 'google', 'oauth', 'active', '{"scopes": ["https://www.googleapis.com/auth/calendar"], "redirect_uri": "http://localhost:5000/api/integrations/google/callback"}', '{"client_id": "demo_client_id", "access_token": "demo_token", "refresh_token": "demo_refresh"}', NULL, NULL, '2025-08-06 04:01:01.222973', '2025-08-06 04:01:01.222973');
INSERT INTO public.system_integrations VALUES ('08ba7ac7-3e43-4398-89c2-81de0f41d4d6', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Microsoft Outlook', 'microsoft', 'oauth', 'active', '{"scopes": ["https://graph.microsoft.com/calendars.readwrite"], "redirect_uri": "http://localhost:5000/api/integrations/microsoft/callback"}', '{"client_id": "demo_ms_client_id", "access_token": "demo_ms_token", "refresh_token": "demo_ms_refresh"}', NULL, NULL, '2025-08-06 04:01:01.222973', '2025-08-06 04:01:01.222973');
INSERT INTO public.system_integrations VALUES ('8d1acdc3-d8ea-47ec-9514-09d2adc9501a', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Salesforce CRM', 'salesforce', 'oauth', 'connected', '{"api_version": "v58.0", "instance_url": "https://demo.salesforce.com"}', '{"client_id": "salesforce_client_id", "access_token": "salesforce_token", "refresh_token": "salesforce_refresh"}', NULL, NULL, '2025-08-06 04:01:01.222973', '2025-08-06 04:01:01.222973');
INSERT INTO public.system_integrations VALUES ('3c91bc36-658b-4d61-b6ce-397738c3ce84', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'QuickBooks Online', 'quickbooks', 'oauth', 'connected', '{"api_url": "https://sandbox-quickbooks.api.intuit.com", "sandbox": true}', '{"client_id": "qb_client_id", "access_token": "qb_token", "refresh_token": "qb_refresh"}', NULL, NULL, '2025-08-06 04:01:01.222973', '2025-08-06 04:01:01.222973');
INSERT INTO public.system_integrations VALUES ('1f792fc7-ef76-4390-be11-6411e76754c4', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Stripe Payments', 'stripe', 'api', 'active', '{"api_version": "2023-10-16", "webhook_url": "http://localhost:5000/api/webhooks/stripe"}', '{"secret_key": "sk_test_demo", "publishable_key": "pk_test_demo"}', NULL, NULL, '2025-08-06 04:01:01.222973', '2025-08-06 04:01:01.222973');
INSERT INTO public.system_integrations VALUES ('ed7ab1da-b517-48c3-a3bc-267ab0bddd67', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'ZoomInfo API', 'zoominfo', 'api', 'active', '{"api_url": "https://api.zoominfo.com/lookup", "rate_limit": "100/hour"}', '{"api_key": "zoominfo_api_key", "username": "demo_user"}', NULL, NULL, '2025-08-06 04:01:01.222973', '2025-08-06 04:01:01.222973');
INSERT INTO public.system_integrations VALUES ('cdfe4d2d-ef65-4f79-a699-3115f4e90498', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Apollo.io', 'apollo', 'api', 'pending', '{"api_url": "https://api.apollo.io/v1", "rate_limit": "200/hour"}', '{"api_key": "apollo_api_key"}', NULL, NULL, '2025-08-06 04:01:01.222973', '2025-08-06 04:01:01.222973');
INSERT INTO public.system_integrations VALUES ('0de9dd29-102c-4a63-8376-029b128ec871', '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Twilio SMS', 'twilio', 'api', 'inactive', '{"api_url": "https://api.twilio.com/2010-04-01", "from_number": "+1234567890"}', '{"auth_token": "twilio_token", "account_sid": "twilio_sid"}', NULL, NULL, '2025-08-06 04:01:01.222973', '2025-08-06 04:01:01.222973');


--
-- Data for Name: system_permissions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.system_permissions VALUES ('perm-1', 'View Dashboard', 'dashboard.view', 'View main dashboard', 'dashboard', 'dashboard', 'view', 'INDIVIDUAL', false, 'MEDIUM', '{}', '2025-08-07 16:28:31.587211+00', '2025-08-07 16:28:31.587211+00');
INSERT INTO public.system_permissions VALUES ('perm-2', 'Manage Users', 'user.manage', 'Create, edit, delete users', 'user', 'user', 'manage', 'COMPANY', false, 'MEDIUM', '{}', '2025-08-07 16:28:31.587211+00', '2025-08-07 16:28:31.587211+00');
INSERT INTO public.system_permissions VALUES ('perm-3', 'View Sales', 'sales.view', 'View sales data', 'sales', 'sales', 'view', 'LOCATION', false, 'MEDIUM', '{}', '2025-08-07 16:28:31.587211+00', '2025-08-07 16:28:31.587211+00');
INSERT INTO public.system_permissions VALUES ('perm-4', 'Manage Roles', 'role.manage', 'Create and manage roles', 'rbac', 'role', 'manage', 'COMPANY', false, 'MEDIUM', '{}', '2025-08-07 16:28:31.587211+00', '2025-08-07 16:28:31.587211+00');
INSERT INTO public.system_permissions VALUES ('perm-5', 'View Reports', 'report.view', 'View business reports', 'reports', 'report', 'view', 'LOCATION', false, 'MEDIUM', '{}', '2025-08-07 16:28:31.587211+00', '2025-08-07 16:28:31.587211+00');


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.teams VALUES ('b3dcb678-ab04-4aa1-8576-3d2c76a05afa', '550e8400-e29b-41d4-a716-446655440000', 'West Coast Sales', 'sales', NULL, NULL, true, NULL, '2025-08-01 01:58:55.34969', '2025-08-01 01:58:55.34969', NULL);
INSERT INTO public.teams VALUES ('a0610c49-29c2-4725-af7f-45a0b2acb385', '550e8400-e29b-41d4-a716-446655440000', 'East Coast Sales', 'sales', NULL, NULL, true, NULL, '2025-08-01 01:58:55.36873', '2025-08-01 01:58:55.36873', NULL);
INSERT INTO public.teams VALUES ('022135b4-c59c-4b6c-9718-4e00a9145fb4', '550e8400-e29b-41d4-a716-446655440000', 'Field Service Team A', 'service', NULL, NULL, true, NULL, '2025-08-01 01:58:55.38677', '2025-08-01 01:58:55.38677', NULL);
INSERT INTO public.teams VALUES ('8d70313a-49c8-4292-9418-ea6b04f2d407', '550e8400-e29b-41d4-a716-446655440000', 'Field Service Team B', 'service', NULL, NULL, true, NULL, '2025-08-01 01:58:55.403693', '2025-08-01 01:58:55.403693', NULL);
INSERT INTO public.teams VALUES ('98b83dc3-bef1-495b-87c8-705f5f1ecdf9', '550e8400-e29b-41d4-a716-446655440000', 'West Coast Sales', 'sales', NULL, NULL, true, NULL, '2025-08-01 01:59:46.720688', '2025-08-01 01:59:46.720688', NULL);
INSERT INTO public.teams VALUES ('c40eaa08-7737-42ec-8f39-41d1313f617c', '550e8400-e29b-41d4-a716-446655440000', 'East Coast Sales', 'sales', NULL, NULL, true, NULL, '2025-08-01 01:59:46.744779', '2025-08-01 01:59:46.744779', NULL);
INSERT INTO public.teams VALUES ('bb2253ea-29f1-4b02-9fa5-f8fb8a860536', '550e8400-e29b-41d4-a716-446655440000', 'Field Service Team A', 'service', NULL, NULL, true, NULL, '2025-08-01 01:59:46.763388', '2025-08-01 01:59:46.763388', NULL);
INSERT INTO public.teams VALUES ('b72d42c4-ff42-4d51-aa1e-efb816874c75', '550e8400-e29b-41d4-a716-446655440000', 'Field Service Team B', 'service', NULL, NULL, true, NULL, '2025-08-01 01:59:46.781788', '2025-08-01 01:59:46.781788', NULL);
INSERT INTO public.teams VALUES ('team-executives', '550e8400-e29b-41d4-a716-446655440000', 'Executive Team', 'Administration', '6f3224b2-221c-42ad-a7f5-a24a11e33621', NULL, true, 'C-level executives and directors', '2025-08-01 03:57:17.860062', '2025-08-01 03:57:17.860062', NULL);
INSERT INTO public.teams VALUES ('team-sales', '550e8400-e29b-41d4-a716-446655440000', 'Sales Team', 'Sales', 'f48b90e1-5501-45cb-a36c-0f6511508635', 'team-executives', true, 'Sales representatives and managers', '2025-08-01 03:57:17.860062', '2025-08-01 03:57:17.860062', NULL);
INSERT INTO public.teams VALUES ('team-service', '550e8400-e29b-41d4-a716-446655440000', 'Service Team', 'Service', '56939a80-d6d4-4e6e-b00a-ef526b9468fc', 'team-executives', true, 'Service technicians and managers', '2025-08-01 03:57:17.860062', '2025-08-01 03:57:17.860062', NULL);


--
-- Data for Name: technician_availability; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: technician_locations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: technician_performance_analytics; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: technician_sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: technician_time_tracking; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: technicians; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: tenant_catalog_settings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: ticket_parts_requests; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: user_location_assignments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: user_role_assignments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: user_settings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.users VALUES ('sales-director-1', 'sales.director@democopier.com', 'Michael', 'SalesDirector', NULL, '550e8400-e29b-41d4-a716-446655440000', 'user', '2025-08-01 15:01:25.72976', '2025-08-01 15:01:25.72976', '$2b$10$6DdaTgBjFpcB18.iby3Fb.RK0bju3At/oQfBHpvMcgw7qWB8xpxKa', 'sales-director-role', NULL, NULL, NULL, true, NULL, false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('sales-manager-1', 'sales.manager@democopier.com', 'Lisa', 'SalesManager', NULL, '550e8400-e29b-41d4-a716-446655440000', 'user', '2025-08-01 15:01:25.856089', '2025-08-01 15:01:25.856089', '$2b$10$iEmBIFk3AlUCyK8vjMTV1u9SuIS/CgdFagJpyoQC5uecTYUuNg8oC', 'da35e22f-1d89-4399-a61c-f10d898d0e51', NULL, NULL, NULL, true, NULL, false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('user_demo_001', 'demo.admin@democopier.com', 'Demo', 'Administrator', NULL, '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'admin', '2025-08-05 02:31:16.622868', '2025-08-05 02:31:16.622868', NULL, NULL, NULL, NULL, NULL, true, NULL, false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('service-director-1', 'service.director@democopier.com', 'Patricia', 'ServiceDirector', NULL, '550e8400-e29b-41d4-a716-446655440000', 'user', '2025-08-01 15:01:26.075948', '2025-08-01 15:01:26.075948', '$2b$10$suRggtyWMCD6QFSMZ9Zvn.YotnULVh/H5NQ5kZxN4E/839RUa4ibu', 'service-director-role', NULL, NULL, NULL, true, NULL, false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('service-tech-1', 'service.tech@democopier.com', 'Robert', 'ServiceTech', NULL, '550e8400-e29b-41d4-a716-446655440000', 'user', '2025-08-01 15:01:26.182383', '2025-08-01 15:01:26.182383', '$2b$10$SiJdOZ59h8/Dm0MpbcCMhOU7e2/dlOJMZcrNti/uMbcRtLmUrZDOy', 'service-tech-role', NULL, NULL, NULL, true, NULL, false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('finance-director-1', 'finance.director@democopier.com', 'Karen', 'FinanceDirector', NULL, '550e8400-e29b-41d4-a716-446655440000', 'user', '2025-08-01 15:01:26.285145', '2025-08-01 15:01:26.285145', '$2b$10$NIujxWOnpTO.7Pyyk6PadecM6NmKOhly8rl5eVh/8zX7pqMrX.vxC', 'finance-director-role', NULL, NULL, NULL, true, NULL, false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('user_demo_002', 'demo.sales@democopier.com', 'Demo', 'Sales Rep', NULL, '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'sales_rep', '2025-08-05 02:31:16.622868', '2025-08-05 02:31:16.622868', NULL, NULL, NULL, NULL, NULL, true, NULL, false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('6f3224b2-221c-42ad-a7f5-a24a11e33621', 'director@printyx.com', 'Sarah', 'Director', NULL, '550e8400-e29b-41d4-a716-446655440000', 'director', '2025-08-01 01:58:55.584705', '2025-08-10 03:39:46.254', '$2b$10$LOgCW7/ciGG/wB77pkCVTuSeLr6DhwJiHtj.tjH5rlG.z585SAuYS', '2235104d-4119-42e3-90c0-91c6dba981db', 'team-executives', NULL, NULL, true, '2025-08-10 04:38:38.524', false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('platform-support-1', 'support@printyx.com', 'Sarah', 'Support', NULL, NULL, 'user', '2025-08-01 15:01:38.127847', '2025-08-01 15:01:38.127847', '$2b$10$vmT8NQLT/Qbpnle2hrMtmOA/hO.93WvRzWewqufMdjpS/B9AT.U/C', 'printyx-support-role', NULL, NULL, NULL, true, '2025-08-01 15:01:48.105', true, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('f48b90e1-5501-45cb-a36c-0f6511508635', 'sales.manager@printyx.com', 'Mike', 'Johnson', NULL, '550e8400-e29b-41d4-a716-446655440000', 'manager', '2025-08-01 01:58:55.671181', '2025-08-10 03:39:46.273', '$2b$10$LOgCW7/ciGG/wB77pkCVTuSeLr6DhwJiHtj.tjH5rlG.z585SAuYS', 'da35e22f-1d89-4399-a61c-f10d898d0e51', 'team-sales', NULL, NULL, true, '2025-08-03 03:40:02.698', false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('56939a80-d6d4-4e6e-b00a-ef526b9468fc', 'service.manager@printyx.com', 'Lisa', 'Chen', NULL, '550e8400-e29b-41d4-a716-446655440000', 'manager', '2025-08-01 01:58:55.75369', '2025-08-10 03:39:46.329', '$2b$10$LOgCW7/ciGG/wB77pkCVTuSeLr6DhwJiHtj.tjH5rlG.z585SAuYS', 'd2d10612-a4b0-43b9-8a99-f2f1350059e2', 'team-service', NULL, NULL, true, '2025-08-05 03:38:38.124', false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('7e44943c-7051-47ff-a39a-8a2eefb905ff', 'team.lead@printyx.com', 'David', 'Wilson', NULL, '550e8400-e29b-41d4-a716-446655440000', 'team_lead', '2025-08-01 01:58:55.831174', '2025-08-10 03:39:46.348', '$2b$10$LOgCW7/ciGG/wB77pkCVTuSeLr6DhwJiHtj.tjH5rlG.z585SAuYS', 'a7c13dc3-9840-4005-9820-f9110da314f0', 'team-service', NULL, NULL, true, NULL, false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('907d3114-5221-49d4-999d-4e2478fabb70', 'sales.rep@printyx.com', 'Jennifer', 'Smith', NULL, '550e8400-e29b-41d4-a716-446655440000', 'individual', '2025-08-01 01:58:55.911546', '2025-08-10 03:39:46.365', '$2b$10$LOgCW7/ciGG/wB77pkCVTuSeLr6DhwJiHtj.tjH5rlG.z585SAuYS', '0d3426be-53c0-4758-8055-0527d51e0279', 'team-sales', NULL, NULL, true, '2025-08-03 03:41:05.961', false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('company-admin-1', 'admin@democopier.com', 'Jennifer', 'Administrator', NULL, '550e8400-e29b-41d4-a716-446655440000', 'user', '2025-08-01 15:01:25.526965', '2025-08-01 15:01:25.526965', '$2b$10$2WUMgYCAV5KQaKVwNoaibejfGdOKEDGnm8T1OKifFH8Rw/MFQEEMO', 'company-admin-role', NULL, NULL, NULL, true, '2025-08-01 15:01:49.13', false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('sales-rep-1', 'sales.rep@democopier.com', 'David', 'SalesRep', NULL, '550e8400-e29b-41d4-a716-446655440000', 'user', '2025-08-01 15:01:25.973226', '2025-08-01 15:01:25.973226', '$2b$10$/WsULzfVhxNinyjs8S3jjO4ajg87OX2EVqVU0CsD2EUqFh1gdk3D2', '0d3426be-53c0-4758-8055-0527d51e0279', NULL, NULL, NULL, true, '2025-08-01 15:01:50.429', false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('b551f0db-36b9-47e2-b32e-49107ea979ca', 'technician@printyx.com', 'Robert', 'Garcia', NULL, '550e8400-e29b-41d4-a716-446655440000', 'individual', '2025-08-01 01:58:56.00278', '2025-08-10 03:39:46.383', '$2b$10$LOgCW7/ciGG/wB77pkCVTuSeLr6DhwJiHtj.tjH5rlG.z585SAuYS', 'e7eed447-4a4f-44da-9b18-daa0af00340e', 'team-service', NULL, NULL, true, NULL, false, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('platform-tech-1', 'tech@printyx.com', 'Marcus', 'Technical', NULL, NULL, 'user', '2025-08-01 15:01:38.238826', '2025-08-01 15:01:38.238826', '$2b$10$i5dituojDW2zctbeuD9uWu4L3mIuZFwSsx.S.gqfQJRJiR1WNYsGO', 'printyx-technical-role', NULL, NULL, NULL, true, NULL, true, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('58c36f26-c458-400b-8055-5dfa31afa88a', 'Pearsonperformance@gmail.com', 'Root', 'Admin', NULL, '550e8400-e29b-41d4-a716-446655440000', 'admin', '2025-08-01 01:58:55.492371', '2025-08-10 03:39:46.113', '$2b$10$LOgCW7/ciGG/wB77pkCVTuSeLr6DhwJiHtj.tjH5rlG.z585SAuYS', 'root-admin-role', 'team-executives', NULL, NULL, true, '2025-08-10 04:42:02.844', true, NULL, NULL, 'location');
INSERT INTO public.users VALUES ('user_001', 'admin@metrocopy.com', 'Sarah', 'Johnson', NULL, '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'admin', '2025-08-05 02:30:15.793634', '2025-08-05 02:30:15.793634', '$2b$10$example_hash_1', 'role_001', 'team_001', NULL, 'EMP001', true, '2024-08-05 09:00:00', false, 'loc_001', 'region_001', 'company');
INSERT INTO public.users VALUES ('user_002', 'mike.wilson@pacificprint.net', 'Mike', 'Wilson', NULL, '1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'sales_manager', '2025-08-05 02:30:15.793634', '2025-08-05 02:30:15.793634', '$2b$10$example_hash_2', 'role_002', 'team_002', NULL, 'EMP002', true, '2024-08-05 08:45:00', false, 'loc_002', 'region_002', 'region');


--
-- Data for Name: vendor_bills; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: voice_notes; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.voice_notes VALUES ('f14db1a6-26c0-40af-bb9e-9ba25f26ac82', '550e8400-e29b-41d4-a716-446655440000', '4f13d657-4b4c-45a6-98bf-502ed2d98e0a', 'fac7bd38-f0d4-48a5-a466-5c55d9aa6f09', 'work_progress', '/audio/voice-note-1754229001.mp3', 45, 'mp3', NULL, 'Installation is proceeding smoothly. Network configuration completed successfully. Customer is very satisfied with the placement and initial setup. Estimated completion time is 2:30 PM.', 0.9234, 'pending', 'en', NULL, NULL, '2025-08-03 13:45:00', 'Installation Progress Update', '["installation", "progress", "network"]', NULL, NULL, NULL, 'low', false, false, true, false, false, false, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, '2025-08-03 13:56:27.228062', '2025-08-03 13:56:27.228062');
INSERT INTO public.voice_notes VALUES ('367450a7-d917-4c26-85e2-cf118ba07ef9', '550e8400-e29b-41d4-a716-446655440000', 'f5146520-6ba4-4dc8-a852-b881dc8cfb97', '7f39c24a-f52d-4b0a-b25c-2136e6eb1644', 'parts_needed', '/audio/voice-note-1754229002.mp3', 62, 'mp3', NULL, 'Paper jam was caused by worn pickup roller. Need to order replacement roller part number HP-RM2-5452. Customer approved repair quote. Will schedule return visit once part arrives.', 0.8976, 'pending', 'en', NULL, NULL, '2025-08-03 13:20:00', 'Additional Parts Required', '["parts", "repair", "follow-up"]', NULL, NULL, NULL, 'medium', false, false, true, false, false, false, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, '2025-08-03 13:56:27.228062', '2025-08-03 13:56:27.228062');
INSERT INTO public.voice_notes VALUES ('b7067f12-a9cb-45d3-b850-5f04342ecc93', '550e8400-e29b-41d4-a716-446655440000', '00974e9b-8d28-4a18-b899-8db0955fc920', NULL, 'safety_concern', '/audio/voice-note-1754229003.mp3', 38, 'mp3', NULL, 'Reminder for tomorrow maintenance visit at healthcare facility - bring extra PPE equipment and sanitizing supplies. Check latest COVID protocols before entering medical plaza.', 0.9156, 'pending', 'en', NULL, NULL, '2025-08-03 17:30:00', 'Safety Protocol Reminder', '["safety", "healthcare", "ppe"]', NULL, NULL, NULL, 'high', false, false, true, false, false, false, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, '2025-08-03 13:56:27.228062', '2025-08-03 13:56:27.228062');
INSERT INTO public.voice_notes VALUES ('c12c9468-8a1b-46bb-925c-294c5941cf52', '550e8400-e29b-41d4-a716-446655440000', '4f13d657-4b4c-45a6-98bf-502ed2d98e0a', NULL, 'customer_interaction', '/audio/voice-note-1754229004.mp3', 52, 'mp3', NULL, 'Customer at TechCorp extremely pleased with service quality and technician professionalism. They mentioned potential for additional equipment purchase next quarter. Recommended follow-up call from sales team.', 0.9387, 'pending', 'en', NULL, NULL, '2025-08-03 16:15:00', 'Customer Feedback', '["customer-feedback", "sales-opportunity", "positive"]', NULL, NULL, NULL, 'low', false, false, true, false, false, false, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, '2025-08-03 13:56:27.228062', '2025-08-03 13:56:27.228062');


--
-- Data for Name: workflow_executions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.workflow_executions VALUES ('e42093d4-c7d4-4e9d-bdae-46445d6f8b12', '550e8400-e29b-41d4-a716-446655440000', 'WF-1754228501001', 'b2a3208b-0ba9-4c87-91ae-ba5e4c300480', 'TechCorp Solutions Onboarding', '58c36f26-c458-400b-8055-5dfa31afa88a', 'manual', NULL, NULL, NULL, 'running', 1, 1, 3, '2025-08-03 13:45:00', NULL, NULL, 15.50, NULL, NULL, NULL, NULL, NULL, NULL, 33.30, '2025-08-03 13:47:48.275609', NULL, 'high', NULL, NULL, NULL, 0, 0, '2025-08-03 13:47:48.275609', '2025-08-03 13:47:48.275609');
INSERT INTO public.workflow_executions VALUES ('d58fc99a-5c1e-44e6-ae53-19b4ca436faf', '550e8400-e29b-41d4-a716-446655440000', 'WF-1754228501002', 'aa48cceb-e8ca-4cff-97ef-693d33962814', 'Printer Issue Escalation', '58c36f26-c458-400b-8055-5dfa31afa88a', 'condition_met', NULL, NULL, NULL, 'completed', 3, 3, 3, '2025-08-03 12:30:00', NULL, NULL, 25.20, NULL, NULL, NULL, NULL, NULL, NULL, 100.00, '2025-08-03 13:47:48.275609', NULL, 'urgent', NULL, NULL, NULL, 0, 0, '2025-08-03 13:47:48.275609', '2025-08-03 13:47:48.275609');
INSERT INTO public.workflow_executions VALUES ('ba6d71e0-d518-4a8d-823a-56b73b915e01', '550e8400-e29b-41d4-a716-446655440000', 'WF-1754228501003', '5797803b-753f-40d9-8ed6-71881c787e8b', 'August 2025 Billing', '58c36f26-c458-400b-8055-5dfa31afa88a', 'scheduled', NULL, NULL, NULL, 'pending', 0, 0, 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, '2025-08-03 13:47:48.275609', NULL, 'medium', NULL, NULL, NULL, 0, 0, '2025-08-03 13:47:48.275609', '2025-08-03 13:47:48.275609');


--
-- Data for Name: workflow_step_executions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: workflow_steps; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- Data for Name: workflow_templates; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.workflow_templates VALUES ('b2a3208b-0ba9-4c87-91ae-ba5e4c300480', '550e8400-e29b-41d4-a716-446655440000', 'Customer Onboarding Workflow', 'Automated workflow for onboarding new customers with setup tasks and welcome communications', 'customer_onboarding', '1.0', '[{"name": "Welcome Email", "step": 1, "type": "notification"}, {"name": "Account Setup", "step": 2, "type": "action"}, {"name": "Training Schedule", "step": 3, "type": "action"}]', '{"events": ["customer_created"], "conditions": []}', NULL, true, true, false, 'high', 0, 48, 3, 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, 48, 25, 23, 0, 45.50, '58c36f26-c458-400b-8055-5dfa31afa88a', false, false, NULL, '2025-08-03 13:47:48.275609', '2025-08-03 13:47:48.275609');
INSERT INTO public.workflow_templates VALUES ('aa48cceb-e8ca-4cff-97ef-693d33962814', '550e8400-e29b-41d4-a716-446655440000', 'Service Escalation Process', 'Automatic escalation of unresolved service tickets with notifications and reassignment', 'service_automation', '1.0', '[{"name": "Check Status", "step": 1, "type": "condition"}, {"name": "Escalate Ticket", "step": 2, "type": "action"}, {"name": "Notify Manager", "step": 3, "type": "notification"}]', '{"events": ["ticket_overdue"], "conditions": [{"field": "status", "value": "resolved", "operator": "not_equal"}]}', NULL, true, true, true, 'urgent', 120, 24, 5, 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, 48, 18, 17, 0, 25.20, '58c36f26-c458-400b-8055-5dfa31afa88a', false, false, NULL, '2025-08-03 13:47:48.275609', '2025-08-03 13:47:48.275609');
INSERT INTO public.workflow_templates VALUES ('5797803b-753f-40d9-8ed6-71881c787e8b', '550e8400-e29b-41d4-a716-446655440000', 'Monthly Billing Process', 'Automated monthly billing workflow with invoice generation and payment processing', 'billing', '1.0', '[{"name": "Generate Invoices", "step": 1, "type": "action"}, {"name": "Send Notifications", "step": 2, "type": "notification"}, {"name": "Process Payments", "step": 3, "type": "action"}]', '{"events": ["scheduled_monthly"], "conditions": []}', NULL, true, true, false, 'medium', 0, 72, 2, 15, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, NULL, NULL, 48, 12, 12, 0, 125.80, '58c36f26-c458-400b-8055-5dfa31afa88a', false, false, NULL, '2025-08-03 13:47:48.275609', '2025-08-03 13:47:48.275609');


--
-- Name: accounts_receivable_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.accounts_receivable_id_seq', 1, false);


--
-- Name: gl_accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.gl_accounts_id_seq', 1, false);


--
-- Name: payment_methods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.payment_methods_id_seq', 1, false);


--
-- Name: payment_terms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.payment_terms_id_seq', 1, false);


--
-- Name: qb_customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.qb_customers_id_seq', 1, false);


--
-- Name: qb_invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.qb_invoices_id_seq', 1, false);


--
-- Name: qb_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.qb_items_id_seq', 1, false);


--
-- Name: qb_vendors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.qb_vendors_id_seq', 1, false);


--
-- Name: quickbooks_integrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.quickbooks_integrations_id_seq', 1, false);


--
-- Name: vendor_bills_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.vendor_bills_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

