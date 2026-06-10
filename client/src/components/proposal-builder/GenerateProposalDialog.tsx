// PROP-006: Generate a proposal from a quote using a template.
//
// One action: pick a template (defaulted to the type-default for the quote's
// dominant line-item type), a branding profile (defaulted), and a section
// checklist, then merge server-side into customer-facing proposal_sections.

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';

interface TemplateRow {
  id: string;
  template_name: string;
  template_type: string;
  is_default?: boolean;
  template_content?: { sections?: Array<{ id?: string; title?: string; type?: string }> } | null;
}
interface BrandingRow {
  id: string;
  name: string;
  is_default?: boolean;
}

// Dominant line-item type → template type used to preselect a default template.
const ITEM_TYPE_TO_TEMPLATE: Record<string, string> = {
  equipment: 'equipment_lease',
  service: 'service_contract',
  managed_service: 'managed_services',
  supply: 'general',
  accessory: 'general',
};

export default function GenerateProposalDialog({
  quoteId,
  open,
  onOpenChange,
}: {
  quoteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [templateId, setTemplateId] = useState<string>('');
  const [brandingId, setBrandingId] = useState<string>('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [touchedTemplate, setTouchedTemplate] = useState(false);

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<TemplateRow[]>({
    queryKey: ['/api/proposals/proposal-templates'],
    queryFn: () => apiRequest('/api/proposals/proposal-templates'),
    enabled: open,
  });

  const { data: brandingData } = useQuery<{ profiles: BrandingRow[] }>({
    queryKey: ['/api/branding-profiles'],
    queryFn: () => apiRequest('/api/branding-profiles'),
    enabled: open,
  });
  const brandingProfiles = brandingData?.profiles ?? [];

  const { data: quote } = useQuery<{
    lineItems?: Array<{ item_type?: string }>;
    template_id?: string;
  }>({
    queryKey: ['/api/proposals', quoteId, 'detail'],
    queryFn: () => apiRequest(`/api/proposals/${quoteId}`),
    enabled: open && !!quoteId,
  });

  // Infer the dominant line-item type → preferred template type.
  const inferredType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of quote?.lineItems ?? []) {
      const t = it.item_type ?? 'equipment';
      counts[t] = (counts[t] ?? 0) + 1;
    }
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return dominant ? (ITEM_TYPE_TO_TEMPLATE[dominant] ?? 'general') : null;
  }, [quote]);

  // Preselect template (type-default → overall default → first) and branding default.
  useEffect(() => {
    if (!open || touchedTemplate || !templates.length) return;
    const byType = inferredType
      ? (templates.find((t) => t.template_type === inferredType && t.is_default) ??
        templates.find((t) => t.template_type === inferredType))
      : undefined;
    const pick = byType ?? templates.find((t) => t.is_default) ?? templates[0];
    if (pick) setTemplateId(pick.id);
  }, [open, templates, inferredType, touchedTemplate]);

  useEffect(() => {
    if (!open || brandingId || !brandingProfiles.length) return;
    const def = brandingProfiles.find((b) => b.is_default) ?? brandingProfiles[0];
    if (def) setBrandingId(def.id);
  }, [open, brandingProfiles, brandingId]);

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const sections = selectedTemplate?.template_content?.sections ?? [];

  // Default every section checked when the template changes.
  useEffect(() => {
    const next: Record<string, boolean> = {};
    sections.forEach((s, i) => {
      next[s.id ?? `section-${i}`] = true;
    });
    setChecked(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // Reset when closed.
  useEffect(() => {
    if (!open) {
      setTouchedTemplate(false);
      setBrandingId('');
      setTemplateId('');
    }
  }, [open]);

  const alreadyGenerated = !!quote?.template_id;

  const generate = useMutation({
    mutationFn: () => {
      const sectionIds = Object.entries(checked)
        .filter(([, v]) => v)
        .map(([k]) => k);
      return apiRequest(`/api/proposals/${quoteId}/generate-from-template`, {
        method: 'POST',
        body: { templateId, brandingProfileId: brandingId || undefined, sectionIds },
      });
    },
    onSuccess: (res: { sections?: unknown[]; warnings?: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals', quoteId, 'detail'] });
      const count = res?.sections?.length ?? 0;
      const warnings = res?.warnings ?? [];
      toast({
        title: 'Proposal generated',
        description:
          `${count} section${count === 1 ? '' : 's'} created.` +
          (warnings.length ? ` ${warnings.length} unknown token(s) ignored.` : ''),
      });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: 'Generation failed', description: e?.message, variant: 'destructive' }),
  });

  const noTemplates = !loadingTemplates && templates.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Generate Proposal
          </DialogTitle>
          <DialogDescription>
            Merge a reusable template with this quote and your branding to produce a customer-facing
            proposal.
          </DialogDescription>
        </DialogHeader>

        {noTemplates ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No proposal templates yet. Create one under{' '}
            <span className="font-medium">Proposal Templates</span> first.
          </div>
        ) : (
          <div className="space-y-4">
            {alreadyGenerated && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  This quote already has a generated proposal. Generating again overwrites those
                  sections, including any manual edits.
                </span>
              </div>
            )}

            <div className="space-y-1">
              <Label>Template</Label>
              <Select
                value={templateId}
                onValueChange={(v) => {
                  setTouchedTemplate(true);
                  setTemplateId(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.template_name}
                      {t.is_default ? ' ★' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Branding</Label>
              <Select value={brandingId} onValueChange={setBrandingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a brand profile" />
                </SelectTrigger>
                <SelectContent>
                  {brandingProfiles.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                      {b.is_default ? ' ★' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sections.length > 0 && (
              <div className="space-y-2">
                <Label>Sections to include</Label>
                <div className="max-h-48 overflow-y-auto space-y-2 rounded-md border p-2">
                  {sections.map((s, i) => {
                    const sid = s.id ?? `section-${i}`;
                    return (
                      <label key={sid} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={checked[sid] ?? true}
                          onCheckedChange={(v) =>
                            setChecked((prev) => ({ ...prev, [sid]: v === true }))
                          }
                        />
                        <span>{s.title || s.type || `Section ${i + 1}`}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => generate.mutate()}
            disabled={!templateId || !quoteId || generate.isPending || noTemplates}
          >
            {generate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…
              </>
            ) : (
              'Generate'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
