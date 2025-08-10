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
-- PostgreSQL database dump complete
--

