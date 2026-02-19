/**
 * Lead Map Routes
 * Provides map data for lead visualization, geocoding trigger, and EDA CSV import
 */

import type { Express, Request, Response } from 'express';
import { Readable } from 'stream';
import csv from 'csv-parser';
import multer from 'multer';
import { requireSupabaseAuth as requireAuth } from './middleware/supabase-auth';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { db } from './db';
import { businessRecords } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { storage } from './storage';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

function parseCSV(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const stream = Readable.from(buffer.toString());
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

interface EdaRow {
  BUYID: string;
  UCCID: string;
  EQTUNIT: string;
  BUYC1FIRST: string;
  BUYC1LAST: string;
  BUYC1TITLE: string;
  BUYCOMP1: string;
  BUYCITY: string;
  BUYZIP: string;
  UCCDATE: string;
  UCCSTATUS: string;
  EQTMAN: string;
  EQTMODEL: string;
  EQTDESC: string;
  PRIMARYBRAND: string;
}

function groupByCompany(rows: EdaRow[]): Map<string, EdaRow[]> {
  const companies = new Map<string, EdaRow[]>();
  for (const row of rows) {
    if (!row.BUYCOMP1?.trim()) continue;
    const key = row.BUYCOMP1.toUpperCase().trim();
    if (!companies.has(key)) companies.set(key, []);
    companies.get(key)!.push(row);
  }
  return companies;
}

function buildEquipmentNotes(companyRows: EdaRow[]): string {
  const lines = companyRows.map(
    (r, i) =>
      `Unit ${i + 1}: ${r.EQTMAN || ''} ${r.EQTMODEL || ''} - ${r.EQTDESC || ''} | Brand: ${r.PRIMARYBRAND || ''} | UCC: ${r.UCCSTATUS || ''} (${r.UCCDATE || ''}) | BuyID: ${r.BUYID || ''} | UCCID: ${r.UCCID || ''}`,
  );
  return `EDA Import - ${companyRows.length} equipment unit(s)\n\n${lines.join('\n')}`;
}

function buildEdaLeadRecord(companyRows: EdaRow[], tenantId: string, userId: string) {
  const first = companyRows[0];
  const withTitle = companyRows.find((r) => r.BUYC1TITLE?.trim()) || first;
  const firstName = (withTitle.BUYC1FIRST || first.BUYC1FIRST || '').trim();
  const lastName = (withTitle.BUYC1LAST || first.BUYC1LAST || '').trim();
  const title = (withTitle.BUYC1TITLE || '').trim();
  const city = (first.BUYCITY || '').trim();
  const zip = (first.BUYZIP || '').trim();
  const contactName = [firstName, lastName].filter(Boolean).join(' ');

  return {
    tenantId,
    recordType: 'lead' as const,
    status: 'new',
    companyName: first.BUYCOMP1.trim(),
    primaryContactName: contactName || '',
    primaryContactTitle: title || '',
    leadSource: 'EDA Import',
    billingCity: city || '',
    billingState: 'IA',
    billingPostalCode: zip || '',
    city: city || '',
    state: 'IA',
    postalCode: zip || '',
    country: 'US',
    interestLevel: 'warm',
    priority: 'medium',
    notes: buildEquipmentNotes(companyRows),
    createdBy: userId,
    ownerId: userId,
  };
}

export function registerLeadMapRoutes(app: Express) {
  // GET /api/leads/map-data - Get leads with geolocation for map display
  app.get('/api/leads/map-data', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'No tenant context' });

      const { source, city, brand, status: filterStatus, hasCoords } = req.query;

      const results = await db
        .select({
          id: businessRecords.id,
          companyName: businessRecords.companyName,
          recordType: businessRecords.recordType,
          status: businessRecords.status,
          primaryContactName: businessRecords.primaryContactName,
          primaryContactTitle: businessRecords.primaryContactTitle,
          billingCity: businessRecords.billingCity,
          billingState: businessRecords.billingState,
          billingPostalCode: businessRecords.billingPostalCode,
          addressLine1: businessRecords.addressLine1,
          city: businessRecords.city,
          state: businessRecords.state,
          postalCode: businessRecords.postalCode,
          latitude: businessRecords.latitude,
          longitude: businessRecords.longitude,
          leadSource: businessRecords.leadSource,
          notes: businessRecords.notes,
          ownerId: businessRecords.ownerId,
          assignedSalesRep: businessRecords.assignedSalesRep,
          createdAt: businessRecords.createdAt,
        })
        .from(businessRecords)
        .where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'lead')));

      // Apply post-query filters
      let filtered = results;

      if (source) {
        filtered = filtered.filter((r) => r.leadSource === source);
      }

      if (city) {
        const cityStr = String(city).toLowerCase();
        filtered = filtered.filter((r) =>
          (r.billingCity || r.city || '').toLowerCase().includes(cityStr),
        );
      }

      if (brand) {
        const brandStr = String(brand).toLowerCase();
        filtered = filtered.filter((r) => (r.notes || '').toLowerCase().includes(brandStr));
      }

      if (filterStatus) {
        filtered = filtered.filter((r) => r.status === filterStatus);
      }

      if (hasCoords === 'true') {
        filtered = filtered.filter((r) => r.latitude && r.longitude);
      }

      // Extract equipment/brand info from notes for each lead
      const leadsWithMeta = filtered.map((lead) => {
        const notes = lead.notes || '';
        const brands: string[] = [];
        const equipment: string[] = [];

        const brandMatches = notes.match(/Brand:\s*([^\s|]+)/g);
        if (brandMatches) {
          for (const match of brandMatches) {
            const b = match.replace('Brand:', '').trim();
            if (b && !brands.includes(b)) brands.push(b);
          }
        }

        const descMatches = notes.match(/Unit \d+:\s*([^|]+)/g);
        if (descMatches) {
          for (const match of descMatches) {
            equipment.push(match.trim());
          }
        }

        const uccMatches = notes.match(/UCC:\s*(\w+)/g);
        const uccStatuses: string[] = [];
        if (uccMatches) {
          for (const match of uccMatches) {
            const s = match.replace('UCC:', '').trim();
            if (s && !uccStatuses.includes(s)) uccStatuses.push(s);
          }
        }

        const unitMatch = notes.match(/(\d+) equipment unit/);
        const unitCount = unitMatch ? parseInt(unitMatch[1]) : equipment.length;

        return {
          ...lead,
          lat: lead.latitude ? parseFloat(String(lead.latitude)) : null,
          lng: lead.longitude ? parseFloat(String(lead.longitude)) : null,
          brands,
          equipment,
          uccStatuses,
          unitCount,
        };
      });

      // Build summary stats
      const allBrands: Record<string, number> = {};
      const allCities: Record<string, number> = {};
      const allUccStatuses: Record<string, number> = {};
      let geocodedCount = 0;

      for (const lead of leadsWithMeta) {
        if (lead.lat && lead.lng) geocodedCount++;
        const c = lead.billingCity || lead.city || 'Unknown';
        allCities[c] = (allCities[c] || 0) + 1;
        for (const b of lead.brands) {
          allBrands[b] = (allBrands[b] || 0) + 1;
        }
        for (const s of lead.uccStatuses) {
          allUccStatuses[s] = (allUccStatuses[s] || 0) + 1;
        }
      }

      res.json({
        leads: leadsWithMeta,
        stats: {
          total: leadsWithMeta.length,
          geocoded: geocodedCount,
          pending: leadsWithMeta.length - geocodedCount,
          geocodedPct: leadsWithMeta.length
            ? Math.round((geocodedCount / leadsWithMeta.length) * 100)
            : 0,
          brands: allBrands,
          cities: allCities,
          uccStatuses: allUccStatuses,
        },
      });
    } catch (err) {
      console.error('Lead map data error:', err);
      res.status(500).json({ message: 'Failed to load map data' });
    }
  });

  // POST /api/leads/geocode - Trigger geocoding for leads
  app.post('/api/leads/geocode', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'No tenant context' });

      const { ids, limit = 10 } = req.body;

      const supabaseUrl = process.env.SUPABASE_URL || 'https://api.printyx.net';
      const authHeader = req.headers.authorization;

      const edgeRes = await fetch(`${supabaseUrl}/functions/v1/geocode-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader || '',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({ ids, limit }),
      });

      if (!edgeRes.ok) {
        const text = await edgeRes.text();
        return res.status(edgeRes.status).json({
          message: 'Geocoding request failed',
          details: text,
        });
      }

      const result = await edgeRes.json();
      res.json(result);
    } catch (err) {
      console.error('Geocode trigger error:', err);
      res.status(500).json({ message: 'Failed to trigger geocoding' });
    }
  });

  // POST /api/leads/import-eda - Bulk import EDA CSV (multipart file upload)
  app.post(
    '/api/leads/import-eda',
    requireAuth,
    upload.single('file'),
    async (req: any, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        // Parse CSV
        const rows: EdaRow[] = await parseCSV(req.file.buffer);
        if (rows.length === 0) {
          return res.status(400).json({ message: 'CSV file is empty' });
        }

        // Validate EDA format (check for BUYCOMP1 header)
        if (!rows[0].BUYCOMP1 && !rows[0].BUYCOMP1) {
          return res.status(400).json({
            message:
              'Invalid CSV format. Expected EDA export columns (BUYCOMP1, BUYCITY, BUYZIP, etc.)',
          });
        }

        // Group by company
        const companies = groupByCompany(rows);

        // Check for existing EDA imports to skip duplicates
        const existingRecords = await db
          .select({ companyName: businessRecords.companyName })
          .from(businessRecords)
          .where(
            and(
              eq(businessRecords.tenantId, tenantId),
              eq(businessRecords.leadSource, 'EDA Import'),
            ),
          );
        const existingNames = new Set(
          existingRecords.map((r) => (r.companyName || '').toUpperCase().trim()),
        );

        let imported = 0;
        let skipped = 0;
        let duplicates = 0;
        const errors: string[] = [];

        for (const [key, companyRows] of companies) {
          const displayName = companyRows[0].BUYCOMP1.trim();

          if (existingNames.has(displayName.toUpperCase())) {
            duplicates++;
            continue;
          }

          try {
            const record = buildEdaLeadRecord(companyRows, tenantId, userId || 'system');
            await storage.createBusinessRecord(record);
            imported++;
          } catch (error: any) {
            errors.push(`${displayName}: ${error.message}`);
            skipped++;
          }
        }

        res.json({
          success: true,
          imported,
          skipped,
          duplicates,
          errors,
          totalRows: rows.length,
          totalCompanies: companies.size,
          message: `Imported ${imported} leads from ${rows.length} rows (${companies.size} companies). ${duplicates > 0 ? `${duplicates} duplicates skipped.` : ''}`,
        });
      } catch (err: any) {
        console.error('EDA import error:', err);
        res.status(500).json({ message: err.message || 'Failed to import EDA leads' });
      }
    },
  );
}
