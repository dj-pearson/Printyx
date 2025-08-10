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
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

INSERT INTO public.tenants VALUES ('1d4522ad-b3d8-4018-8890-f9294b2efbe6', 'Demo Copier Dealer', 'demo', '2025-07-31 22:57:56.640151', '2025-07-31 22:57:56.640151', NULL, NULL, NULL, true, 'basic');
INSERT INTO public.tenants VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Demo Copier Dealership', NULL, '2025-08-01 01:58:32.724019', '2025-08-01 01:58:32.724019', 'printyx-demo', 'printyx-demo', 'printyx-demo', true, 'enterprise');


--
-- PostgreSQL database dump complete
--

