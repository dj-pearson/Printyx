// PROP-004: Proposal template editor — loads a template's content into the visual
// builder, seeds styling from the default brand, and persists template_content back.

import { useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import ProposalVisualBuilder from '@/components/proposal-builder/ProposalVisualBuilder';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

const QUERY_KEY = '/api/proposals/proposal-templates';
const BRANDING_KEY = '/api/branding-profiles';

interface TemplateRow {
  id: string;
  template_name: string;
  template_type: string;
  description?: string | null;
  template_content?: { sections?: any[]; globalStyling?: any } | null;
}

interface BrandingRow {
  is_default?: boolean;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  heading_font?: string | null;
  body_font?: string | null;
  logo_url?: string | null;
}

export default function ProposalTemplateEditor() {
  const [, params] = useRoute('/proposal-templates/:id/edit');
  const id = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Templates are few — fetch the list (incl. inactive) and find by id.
  const { data, isLoading, isError, error } = useQuery<TemplateRow[]>({
    queryKey: [QUERY_KEY, 'all'],
    queryFn: () => apiRequest(`${QUERY_KEY}?includeInactive=true`),
  });

  const { data: brandingData } = useQuery<{ profiles: BrandingRow[] }>({
    queryKey: [BRANDING_KEY],
    queryFn: () => apiRequest(BRANDING_KEY),
  });

  const row = useMemo(
    () => (Array.isArray(data) ? data.find((t) => t.id === id) : undefined),
    [data, id],
  );

  const brandingDefaults = useMemo(() => {
    const profiles = brandingData?.profiles ?? [];
    const def = profiles.find((p) => p.is_default) ?? profiles[0];
    if (!def) return undefined;
    return {
      primaryColor: def.primary_color ?? undefined,
      secondaryColor: def.secondary_color ?? undefined,
      accentColor: def.accent_color ?? undefined,
      fontFamily: def.body_font ?? undefined,
      headerFont: def.heading_font ?? undefined,
      logoUrl: def.logo_url ?? undefined,
    };
  }, [brandingData]);

  const initialTemplate = useMemo(() => {
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.template_name,
      description: row.description ?? '',
      sections: row.template_content?.sections ?? [],
      globalStyling: row.template_content?.globalStyling ?? {
        primaryColor: brandingDefaults?.primaryColor ?? '#0066CC',
        secondaryColor: brandingDefaults?.secondaryColor ?? '#4A90E2',
        accentColor: brandingDefaults?.accentColor ?? '#FF6B35',
        fontFamily: brandingDefaults?.fontFamily ?? 'Inter',
        headerFont: brandingDefaults?.headerFont ?? 'Inter',
        logoUrl: brandingDefaults?.logoUrl,
        pageMargins: { top: 20, right: 20, bottom: 20, left: 20 },
      },
    };
  }, [row, brandingDefaults]);

  const saveMutation = useMutation({
    mutationFn: (template: any) =>
      apiRequest(`${QUERY_KEY}/${id}`, {
        method: 'PUT',
        body: {
          templateName: template.name,
          description: template.description,
          templateContent: {
            sections: template.sections,
            globalStyling: template.globalStyling,
          },
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'all'] });
      toast({ title: 'Saved', description: 'Template saved.' });
    },
    onError: (e: any) =>
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading template…
      </div>
    );
  }

  if (isError || !row) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center px-4">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="font-medium">{isError ? 'Couldn’t load template' : 'Template not found'}</p>
        {isError && <p className="text-sm text-muted-foreground mb-4">{(error as any)?.message}</p>}
        <Button onClick={() => navigate('/proposal-templates')} className="mt-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to templates
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b bg-white p-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/proposal-templates')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Templates
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        <ProposalVisualBuilder
          key={row.id}
          initialTemplate={initialTemplate as any}
          brandingDefaults={brandingDefaults}
          saving={saveMutation.isPending}
          onSave={(t) => saveMutation.mutate(t)}
        />
      </div>
    </div>
  );
}
