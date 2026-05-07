import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Loader2,
  Pencil,
  Plus,
  ScrollText,
  Star,
  StarOff,
  Trash2,
  X,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogSettingsNav } from '@/components/blog/BlogSettingsNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Severity = 'error' | 'warn' | 'info';
type MatchType = 'regex' | 'substring';

interface StyleRule {
  pattern: string;
  match_type: MatchType;
  severity: Severity;
  message: string;
  replacement?: string | null;
}

interface StyleGuide {
  id: string;
  tenant_id: string;
  name: string;
  rules: StyleRule[] | null;
  rule_packs: string[] | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface GuidesResponse {
  guides: StyleGuide[];
}

const RULE_PACK_OPTIONS: { value: string; label: string; description: string }[] = [
  {
    value: 'ap',
    label: 'AP Stylebook',
    description: 'Associated Press conventions for journalism / news',
  },
  {
    value: 'chicago',
    label: 'Chicago Manual',
    description: 'Chicago Manual of Style for academic / book publishing',
  },
  {
    value: 'mla',
    label: 'MLA Style',
    description: 'Modern Language Association for humanities',
  },
  {
    value: 'plain-language',
    label: 'Plain Language',
    description: 'Active voice, short sentences, common words',
  },
  {
    value: 'inclusive',
    label: 'Inclusive Language',
    description: 'Avoids gendered, ableist, and other exclusionary terms',
  },
];

interface FormState {
  name: string;
  rule_packs: Set<string>;
  rules: StyleRule[];
  is_default: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  rule_packs: new Set(),
  rules: [],
  is_default: false,
};

const EMPTY_RULE: StyleRule = {
  pattern: '',
  match_type: 'substring',
  severity: 'warn',
  message: '',
  replacement: '',
};

function guideToForm(guide: StyleGuide): FormState {
  return {
    name: guide.name,
    rule_packs: new Set(guide.rule_packs ?? []),
    rules: (guide.rules ?? []).map((r) => ({ ...r, replacement: r.replacement ?? '' })),
    is_default: guide.is_default,
  };
}

function formToPayload(form: FormState) {
  return {
    name: form.name.trim(),
    rule_packs: Array.from(form.rule_packs),
    rules: form.rules
      .filter((r) => r.pattern.trim().length > 0 && r.message.trim().length > 0)
      .map((r) => ({
        pattern: r.pattern.trim(),
        match_type: r.match_type,
        severity: r.severity,
        message: r.message.trim(),
        replacement: r.replacement?.trim() || null,
      })),
    is_default: form.is_default,
  };
}

export default function BlogSettingsStyleGuides() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const guidesKey = ['/api/blog-style-guides'];

  const { data, isLoading, error } = useQuery<GuidesResponse>({
    queryKey: guidesKey,
    queryFn: () => apiRequest('/api/blog-style-guides'),
  });

  const guides = data?.guides ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteCandidate, setDeleteCandidate] = useState<StyleGuide | null>(null);

  const editingGuide = useMemo(
    () => guides.find((g) => g.id === editingId) ?? null,
    [guides, editingId],
  );

  const isFormOpen = creating || editingId !== null;

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreating(true);
    setEditingId(null);
  }

  function openEdit(guide: StyleGuide) {
    setForm(guideToForm(guide));
    setEditingId(guide.id);
    setCreating(false);
  }

  function closeForm() {
    setCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: guidesKey });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof formToPayload>) =>
      apiRequest('/api/blog-style-guides', 'POST', payload),
    onSuccess: () => {
      toast({ title: 'Style guide created' });
      invalidate();
      closeForm();
    },
    onError: (err: unknown) => {
      toast({
        title: 'Failed to create',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReturnType<typeof formToPayload> }) =>
      apiRequest(`/api/blog-style-guides/${id}`, 'PATCH', payload),
    onSuccess: () => {
      toast({ title: 'Style guide updated' });
      invalidate();
      closeForm();
    },
    onError: (err: unknown) => {
      toast({
        title: 'Failed to update',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/blog-style-guides/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Style guide deleted' });
      invalidate();
      setDeleteCandidate(null);
    },
    onError: (err: unknown) => {
      toast({
        title: 'Failed to delete',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/blog-style-guides/${id}/set-default`, 'POST', {}),
    onSuccess: () => {
      toast({ title: 'Default style guide updated' });
      invalidate();
    },
    onError: (err: unknown) => {
      toast({
        title: 'Failed to set default',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    const payload = formToPayload(form);
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <BlogShell title="Style Guides — Blog Settings · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Blog Settings</h1>
            <Badge variant="secondary" className="text-xs">
              US-BLOG-005
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Per-tenant configuration for the Platform Admin Blog System. Style guides combine
            built-in rule packs with custom regex / substring rules.
          </p>
        </header>

        <BlogSettingsNav />

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-muted-foreground" />
              Style Guides
            </h2>
            <p className="text-sm text-muted-foreground">
              Real-time linting in the post editor lands in US-BLOG-008. v1 stores rules + rule pack
              toggles; the pre-publish QA pass (US-BLOG-040) uses them then.
            </p>
          </div>
          {!isFormOpen ? (
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Guide
            </Button>
          ) : null}
        </div>

        {isFormOpen ? (
          <GuideFormCard
            isCreate={creating}
            guide={editingGuide}
            form={form}
            setForm={setForm}
            isPending={createMutation.isPending || updateMutation.isPending}
            onSubmit={handleSubmit}
            onCancel={closeForm}
          />
        ) : null}

        {isLoading ? (
          <Card>
            <CardContent className="py-12 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading style guides…
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-sm text-destructive">
              Failed to load: {error instanceof Error ? error.message : 'Unknown error'}
            </CardContent>
          </Card>
        ) : guides.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-3">
              <ScrollText className="h-8 w-8 mx-auto text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">No style guides yet</p>
                <p className="text-xs text-muted-foreground">
                  Create your first guide to enforce prose rules across AI-generated drafts.
                </p>
              </div>
              {!isFormOpen ? (
                <Button onClick={openCreate} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Style Guide
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {guides.map((guide) => (
              <GuideListItem
                key={guide.id}
                guide={guide}
                onEdit={() => openEdit(guide)}
                onDelete={() => setDeleteCandidate(guide)}
                onSetDefault={() => setDefaultMutation.mutate(guide.id)}
                isSetDefaultPending={
                  setDefaultMutation.isPending && setDefaultMutation.variables === guide.id
                }
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={deleteCandidate !== null}
        onOpenChange={(open) => !open && setDeleteCandidate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete style guide "{deleteCandidate?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing posts and briefs that reference this guide keep their reference but it will
              no longer appear in the picker. Soft delete — row stays in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCandidate) deleteMutation.mutate(deleteCandidate.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BlogShell>
  );
}

interface GuideListItemProps {
  guide: StyleGuide;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  isSetDefaultPending: boolean;
}

function GuideListItem({
  guide,
  onEdit,
  onDelete,
  onSetDefault,
  isSetDefaultPending,
}: GuideListItemProps) {
  const ruleCount = guide.rules?.length ?? 0;
  const packCount = guide.rule_packs?.length ?? 0;

  return (
    <Card className={guide.is_default ? 'border-primary/40' : undefined}>
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              {guide.name}
              {guide.is_default ? (
                <Badge variant="default" className="text-[10px] py-0 px-1.5">
                  Default
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription className="text-xs">
              {ruleCount} custom {ruleCount === 1 ? 'rule' : 'rules'} · {packCount} rule{' '}
              {packCount === 1 ? 'pack' : 'packs'} enabled
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {guide.is_default ? (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 gap-1">
                <Star className="h-3 w-3" />
                Default
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={onSetDefault}
                disabled={isSetDefaultPending}
                title="Set as default guide"
              >
                {isSetDefaultPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <StarOff className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onEdit} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} title="Delete">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {(guide.rule_packs && guide.rule_packs.length > 0) ||
      (guide.rules && guide.rules.length > 0) ? (
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          {guide.rule_packs && guide.rule_packs.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {guide.rule_packs.map((pack) => (
                <Badge key={pack} variant="secondary" className="text-[10px]">
                  {RULE_PACK_OPTIONS.find((p) => p.value === pack)?.label ?? pack}
                </Badge>
              ))}
            </div>
          ) : null}
          {guide.rules && guide.rules.length > 0 ? (
            <ul className="space-y-1">
              {guide.rules.slice(0, 3).map((rule, i) => (
                <li key={i} className="line-clamp-1">
                  <SeverityDot severity={rule.severity} />{' '}
                  <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-muted">
                    {rule.pattern}
                  </code>{' '}
                  → {rule.message}
                </li>
              ))}
              {guide.rules.length > 3 ? (
                <li className="text-[11px] italic">+ {guide.rules.length - 3} more…</li>
              ) : null}
            </ul>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

function SeverityDot({ severity }: { severity: Severity }) {
  const color =
    severity === 'error' ? 'bg-destructive' : severity === 'warn' ? 'bg-yellow-500' : 'bg-blue-500';
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} title={severity} />;
}

interface GuideFormCardProps {
  isCreate: boolean;
  guide: StyleGuide | null;
  form: FormState;
  setForm: (f: FormState) => void;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function GuideFormCard({
  isCreate,
  guide,
  form,
  setForm,
  isPending,
  onSubmit,
  onCancel,
}: GuideFormCardProps) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm({ ...form, [key]: value });

  function togglePack(value: string) {
    const next = new Set(form.rule_packs);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    set('rule_packs', next);
  }

  function addRule() {
    set('rules', [...form.rules, { ...EMPTY_RULE }]);
  }

  function updateRule(index: number, patch: Partial<StyleRule>) {
    const next = form.rules.map((r, i) => (i === index ? { ...r, ...patch } : r));
    set('rules', next);
  }

  function removeRule(index: number) {
    set(
      'rules',
      form.rules.filter((_, i) => i !== index),
    );
  }

  // Cheap regex validation — flags rules where match_type=regex and the pattern
  // doesn't compile. Doesn't block submission (server validates again) but
  // surfaces typos before the user clicks save.
  const invalidRegexIndices = useMemo(() => {
    const set = new Set<number>();
    form.rules.forEach((r, i) => {
      if (r.match_type !== 'regex') return;
      if (!r.pattern.trim()) return;
      try {
        new RegExp(r.pattern);
      } catch {
        set.add(i);
      }
    });
    return set;
  }, [form.rules]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {isCreate ? 'New Style Guide' : `Edit "${guide?.name ?? ''}"`}
            </CardTitle>
            <CardDescription className="text-xs">
              Required: <strong>Name</strong>. Add as many custom rules as you want; each rule has a
              pattern, severity, and a message shown to writers.
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={onCancel} type="button">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guide-name">Name *</Label>
              <Input
                id="guide-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. House Style, Marketing Blog Voice"
                maxLength={200}
                required
              />
            </div>
            <div className="flex items-center justify-between gap-3 pt-6">
              <div className="space-y-1">
                <Label htmlFor="guide-default" className="text-sm font-medium">
                  Default style guide
                </Label>
                <p className="text-xs text-muted-foreground">
                  Auto-applied to new posts when no guide is selected.
                </p>
              </div>
              <Switch
                id="guide-default"
                checked={form.is_default}
                onCheckedChange={(v) => set('is_default', v)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Built-in rule packs</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RULE_PACK_OPTIONS.map((pack) => {
                const checked = form.rule_packs.has(pack.value);
                return (
                  <label
                    key={pack.value}
                    className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    htmlFor={`pack-${pack.value}`}
                  >
                    <Checkbox
                      id={`pack-${pack.value}`}
                      checked={checked}
                      onCheckedChange={() => togglePack(pack.value)}
                    />
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">{pack.label}</div>
                      <div className="text-xs text-muted-foreground">{pack.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground italic">
              Pack contents (the actual patterns each pack contains) load when the editor lands in
              US-BLOG-008. v1 stores the toggle state.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Custom rules{form.rules.length > 0 ? ` (${form.rules.length})` : ''}
              </Label>
              <Button type="button" size="sm" variant="outline" onClick={addRule}>
                <Plus className="h-4 w-4 mr-1" />
                Add rule
              </Button>
            </div>

            {form.rules.length === 0 ? (
              <p className="text-xs text-muted-foreground border border-dashed rounded-md p-4 text-center">
                No custom rules yet. Click <strong>Add rule</strong> to flag specific phrases or
                patterns.
              </p>
            ) : (
              <div className="space-y-3">
                {form.rules.map((rule, i) => (
                  <RuleRow
                    key={i}
                    rule={rule}
                    invalid={invalidRegexIndices.has(i)}
                    onChange={(patch) => updateRule(i, patch)}
                    onRemove={() => removeRule(i)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {isCreate ? 'Create guide' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface RuleRowProps {
  rule: StyleRule;
  invalid: boolean;
  onChange: (patch: Partial<StyleRule>) => void;
  onRemove: () => void;
}

function RuleRow({ rule, invalid, onChange, onRemove }: RuleRowProps) {
  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/20">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_auto] gap-2 items-start">
        <div className="space-y-1">
          <Label className="text-xs">Pattern</Label>
          <Input
            value={rule.pattern}
            onChange={(e) => onChange({ pattern: e.target.value })}
            placeholder={rule.match_type === 'regex' ? '\\b(very|really)\\b' : 'in order to'}
            className={invalid ? 'border-destructive' : undefined}
          />
          {invalid ? (
            <p className="text-[11px] text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Invalid regex syntax
            </p>
          ) : null}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Match</Label>
          <Select
            value={rule.match_type}
            onValueChange={(v) => onChange({ match_type: v as MatchType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="substring">substring</SelectItem>
              <SelectItem value="regex">regex</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Severity</Label>
          <Select
            value={rule.severity}
            onValueChange={(v) => onChange({ severity: v as Severity })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="error">error</SelectItem>
              <SelectItem value="warn">warn</SelectItem>
              <SelectItem value="info">info</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onRemove}
          className="md:mt-6"
          title="Remove rule"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Message shown to writer</Label>
          <Input
            value={rule.message}
            onChange={(e) => onChange({ message: e.target.value })}
            placeholder='Avoid "very". Use a stronger adjective instead.'
            maxLength={500}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Suggested replacement (optional)</Label>
          <Input
            value={rule.replacement ?? ''}
            onChange={(e) => onChange({ replacement: e.target.value })}
            placeholder="Quick-fix click value"
            maxLength={2000}
          />
        </div>
      </div>
    </div>
  );
}
