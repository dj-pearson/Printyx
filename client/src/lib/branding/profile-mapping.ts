// PROP-003: map between the BrandManager rich UI model and the
// company_branding_profiles API row (snake_case from the edge function).
//
// The flat columns stay the queryable source of truth the proposal merge engine
// reads (primary_color, heading_font, logo_url, company_name, address, ...). The
// rich extras the UI edits that have no flat column (extended colors, full
// typography, layout, gradients, logo variants, template presets) round-trip
// through the `settings` jsonb column.

import type { BrandProfile } from '@/components/proposal-builder/BrandManager';

// Snake_case row as returned by the branding-profiles edge function.
export interface BrandingRow {
  id: string;
  tenant_id?: string;
  name: string;
  is_default?: boolean;
  company_name?: string | null;
  tagline?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  text_color?: string | null;
  heading_font?: string | null;
  body_font?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  social_links?: Record<string, string> | null;
  custom_css?: string | null;
  settings?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const DEFAULT_LAYOUT: BrandProfile['layout'] = {
  pageMargins: { top: 40, right: 40, bottom: 40, left: 40 },
  headerHeight: 80,
  footerHeight: 60,
  sectionSpacing: 32,
  columnGap: 24,
};

const DEFAULT_STYLING: BrandProfile['styling'] = {
  borderRadius: 8,
  shadowStrength: 2,
  gradients: [],
  patterns: [],
};

const DEFAULT_TEMPLATES: BrandProfile['templates'] = {
  coverPageLayout: 'centered',
  headerStyle: 'branded',
  footerStyle: 'minimal',
  sectionDividers: 'spacing',
};

// API row → rich UI profile. Prefer the `settings` blob for the rich parts; fall
// back to the flat columns so older rows (saved before PROP-003) still hydrate.
export function rowToProfile(row: BrandingRow): BrandProfile {
  const s = (row.settings ?? {}) as Partial<BrandProfile> & { description?: string };

  return {
    id: row.id,
    name: row.name ?? 'Brand Profile',
    description: s.description ?? '',
    colors: s.colors ?? {
      primary: row.primary_color ?? '#0066CC',
      secondary: row.secondary_color ?? '#4A90E2',
      accent: row.accent_color ?? '#FF6B35',
      background: '#FFFFFF',
      text: row.text_color ?? '#1F2937',
      muted: '#6B7280',
    },
    typography: s.typography ?? {
      headingFont: row.heading_font ?? 'Inter',
      bodyFont: row.body_font ?? 'Inter',
      logoFont: row.heading_font ?? 'Inter',
      baseFontSize: 16,
      headingScale: 1.25,
      lineHeight: 1.6,
      letterSpacing: 0,
    },
    logos: s.logos ?? (row.logo_url ? { primary: row.logo_url } : {}),
    layout: s.layout ?? DEFAULT_LAYOUT,
    styling: s.styling ?? DEFAULT_STYLING,
    templates: s.templates ?? DEFAULT_TEMPLATES,
    company: {
      companyName: row.company_name ?? '',
      tagline: row.tagline ?? '',
      websiteUrl: row.website_url ?? '',
      address: row.address ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      socialLinks: row.social_links ?? {},
    },
    isDefault: row.is_default ?? false,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

// Rich UI profile → camelCase payload for POST/PUT. The edge function normalizes
// camelCase → snake_case columns, so camelCase keys are accepted directly.
export function profileToPayload(profile: BrandProfile): Record<string, unknown> {
  return {
    name: profile.name,
    isDefault: profile.isDefault,
    // company_name is NOT NULL — fall back to the profile name if unset.
    companyName: profile.company?.companyName?.trim() || profile.name,
    tagline: profile.company?.tagline ?? null,
    logoUrl: profile.logos?.primary ?? null,
    websiteUrl: profile.company?.websiteUrl ?? null,
    primaryColor: profile.colors.primary,
    secondaryColor: profile.colors.secondary,
    accentColor: profile.colors.accent,
    textColor: profile.colors.text,
    headingFont: profile.typography.headingFont,
    bodyFont: profile.typography.bodyFont,
    address: profile.company?.address ?? null,
    phone: profile.company?.phone ?? null,
    email: profile.company?.email ?? null,
    socialLinks: profile.company?.socialLinks ?? {},
    settings: {
      description: profile.description,
      colors: profile.colors,
      typography: profile.typography,
      logos: profile.logos,
      layout: profile.layout,
      styling: profile.styling,
      templates: profile.templates,
    },
  };
}
