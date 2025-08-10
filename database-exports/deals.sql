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
-- Data for Name: deals; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.deals VALUES ('8b359d9c-3fec-42c6-911b-e0dca8a2ca74', '550e8400-e29b-41d4-a716-446655440000', 'Trial Deal', NULL, 50000.00, 'Lead Company', NULL, NULL, NULL, 'website', NULL, 'medium', '2025-08-29 00:00:00', NULL, NULL, NULL, 'open', 50, 'be80c092-167e-425f-9a39-6027f9c4f9a7', '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-08 20:18:50.789042', '2025-08-09 01:04:57.435', NULL, NULL, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL);
INSERT INTO public.deals VALUES ('4a86abaf-85fa-4bcf-88c9-cf0b289b1119', '550e8400-e29b-41d4-a716-446655440000', 'Big Deal', NULL, 50000.00, 'ABC Company', 'Maria Johnson', 'emjohnson@printyx.com', '555-0002', 'website', 'new_business', 'medium', '2025-10-22 00:00:00', NULL, NULL, NULL, 'open', 50, 'be80c092-167e-425f-9a39-6027f9c4f9a7', '907d3114-5221-49d4-999d-4e2478fabb70', '2025-08-02 02:36:34.795769', '2025-08-09 01:05:02.573', NULL, NULL, NULL, NULL, '907d3114-5221-49d4-999d-4e2478fabb70', NULL);
INSERT INTO public.deals VALUES ('badaa6b7-a23d-4ae0-be90-39711cbc0ebd', '550e8400-e29b-41d4-a716-446655440000', ' (PROP-2025-0009)', NULL, 72000.00, 'GHI Company', NULL, NULL, NULL, NULL, NULL, 'medium', '2025-08-29 00:00:00', NULL, NULL, NULL, 'open', 70, 'f2082e10-221c-4988-b169-5bd1e484c5c4', '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-09 12:50:05.873', '2025-08-09 12:50:05.873', 'e620280d-b634-413f-ba65-9b177523cd95', NULL, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL);
INSERT INTO public.deals VALUES ('d6f1b950-4d75-4d70-980a-e6b823b6b672', '550e8400-e29b-41d4-a716-446655440000', 'Trail Quote (PROP-2025-0008)', NULL, 3250.00, 'ABC Company', NULL, NULL, NULL, NULL, NULL, 'medium', '2025-08-29 00:00:00', NULL, NULL, NULL, 'open', 70, 'f2082e10-221c-4988-b169-5bd1e484c5c4', '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-08 20:19:53.404', '2025-08-08 20:19:53.404', 'lead-001', NULL, NULL, NULL, '58c36f26-c458-400b-8055-5dfa31afa88a', NULL);
INSERT INTO public.deals VALUES ('22aab668-a0f2-4ed4-b7f1-a289e11a5cbb', '550e8400-e29b-41d4-a716-446655440000', 'Test Deal', 'Testing deal creation', 5000.00, 'Test Company', 'John Doe', NULL, NULL, NULL, NULL, 'medium', '2025-08-29 00:00:00', NULL, NULL, NULL, 'open', 50, '10d89e8f-4a48-406a-be0b-f76adda3f20a', '58c36f26-c458-400b-8055-5dfa31afa88a', '2025-08-02 02:35:26.445924', '2025-08-09 01:04:43.474', NULL, NULL, NULL, NULL, NULL, NULL);


--
-- PostgreSQL database dump complete
--

