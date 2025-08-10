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
-- PostgreSQL database dump complete
--

