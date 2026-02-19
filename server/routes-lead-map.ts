/**
 * Lead Map Routes
 * Provides map data for lead visualization and geocoding trigger
 */

import type { Express, Request, Response } from 'express';
import { requireSupabaseAuth as requireAuth } from './middleware/supabase-auth';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { db } from './db';
import { businessRecords } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export function registerLeadMapRoutes(app: Express) {
  // GET /api/leads/map-data - Get leads with geolocation for map display
  app.get('/api/leads/map-data', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'No tenant context' });

      const { source, city, brand, status: filterStatus, hasCoords } = req.query;

      let query = db
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

      const results = await query;

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

        // Parse brand info from notes lines like "Brand: XEROX"
        const brandMatches = notes.match(/Brand:\s*([^\s|]+)/g);
        if (brandMatches) {
          for (const match of brandMatches) {
            const b = match.replace('Brand:', '').trim();
            if (b && !brands.includes(b)) brands.push(b);
          }
        }

        // Parse equipment descriptions
        const descMatches = notes.match(/Unit \d+:\s*([^|]+)/g);
        if (descMatches) {
          for (const match of descMatches) {
            equipment.push(match.trim());
          }
        }

        // Parse UCC statuses
        const uccMatches = notes.match(/UCC:\s*(\w+)/g);
        const uccStatuses: string[] = [];
        if (uccMatches) {
          for (const match of uccMatches) {
            const s = match.replace('UCC:', '').trim();
            if (s && !uccStatuses.includes(s)) uccStatuses.push(s);
          }
        }

        // Count equipment units
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

      // Forward to edge function
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

  // POST /api/leads/import-eda - Import EDA CSV data via edge function
  app.post('/api/leads/import-eda', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'No tenant context' });

      const supabaseUrl = process.env.SUPABASE_URL || 'https://api.printyx.net';
      const authHeader = req.headers.authorization;

      const edgeRes = await fetch(`${supabaseUrl}/functions/v1/import-eda-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader || '',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify(req.body),
      });

      if (!edgeRes.ok) {
        const text = await edgeRes.text();
        return res.status(edgeRes.status).json({
          message: 'Import failed',
          details: text,
        });
      }

      const result = await edgeRes.json();
      res.json(result);
    } catch (err) {
      console.error('EDA import error:', err);
      res.status(500).json({ message: 'Failed to import EDA leads' });
    }
  });
}
