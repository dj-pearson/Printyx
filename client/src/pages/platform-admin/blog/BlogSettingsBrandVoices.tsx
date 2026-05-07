import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mic2, Pencil, Plus, Sparkles, Star, StarOff, Trash2, X } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogSettingsNav } from '@/components/blog/BlogSettingsNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
import { serializeBrandVoiceToPrompt } from '@/lib/blog/brand-voice-prompt';

interface VoiceAttributes {
  humor?: number;
  formality?: number;
  technicality?: number;
}

interface BrandVoice {
  id: string;
  tenant_id: string;
  name: string;
  tone: string | null;
  banned_phrases: string[] | null;
  preferred_phrases: string[] | null;
  reading_level_target: string | null;
  persona_description: string | null;
  sample_corpus: string | null;
  pov: string | null;
  voice_attributes: VoiceAttributes | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface VoicesResponse {
  voices: BrandVoice[];
}

const POV_OPTIONS = [
  { value: 'first', label: 'First person ("we", "I")' },
  { value: 'second', label: 'Second person ("you")' },
  { value: 'third', label: 'Third person ("they", "the company")' },
];

const READING_LEVEL_OPTIONS = [
  { value: 'grade-6', label: 'Grade 6 (very accessible)' },
  { value: 'grade-8', label: 'Grade 8 (accessible)' },
  { value: 'grade-10', label: 'Grade 10 (general adult)' },
  { value: 'grade-12', label: 'Grade 12 (informed adult)' },
  { value: 'grade-14', label: 'Grade 14 (technical / professional)' },
];

interface FormState {
  name: string;
  tone: string;
  persona_description: string;
  pov: string;
  reading_level_target: string;
  preferred_phrases: string;
  banned_phrases: string;
  humor: number | undefined;
  formality: number | undefined;
  technicality: number | undefined;
  sample_corpus: string;
  is_default: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  tone: '',
  persona_description: '',
  pov: '',
  reading_level_target: '',
  preferred_phrases: '',
  banned_phrases: '',
  humor: undefined,
  formality: undefined,
  technicality: undefined,
  sample_corpus: '',
  is_default: false,
};

function voiceToForm(voice: BrandVoice): FormState {
  return {
    name: voice.name,
    tone: voice.tone ?? '',
    persona_description: voice.persona_description ?? '',
    pov: voice.pov ?? '',
    reading_level_target: voice.reading_level_target ?? '',
    preferred_phrases: voice.preferred_phrases?.join(', ') ?? '',
    banned_phrases: voice.banned_phrases?.join(', ') ?? '',
    humor: voice.voice_attributes?.humor,
    formality: voice.voice_attributes?.formality,
    technicality: voice.voice_attributes?.technicality,
    sample_corpus: voice.sample_corpus ?? '',
    is_default: voice.is_default,
  };
}

function formToPayload(form: FormState) {
  const splitPhrases = (s: string) =>
    s
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

  const attributes: VoiceAttributes = {};
  if (form.humor !== undefined) attributes.humor = form.humor;
  if (form.formality !== undefined) attributes.formality = form.formality;
  if (form.technicality !== undefined) attributes.technicality = form.technicality;

  return {
    name: form.name.trim(),
    tone: form.tone.trim() || null,
    persona_description: form.persona_description.trim() || null,
    pov: form.pov || null,
    reading_level_target: form.reading_level_target || null,
    preferred_phrases: splitPhrases(form.preferred_phrases),
    banned_phrases: splitPhrases(form.banned_phrases),
    voice_attributes: Object.keys(attributes).length > 0 ? attributes : null,
    sample_corpus: form.sample_corpus.trim() || null,
    is_default: form.is_default,
  };
}

export default function BlogSettingsBrandVoices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const voicesKey = ['/api/blog-brand-voices'];

  const { data, isLoading, error } = useQuery<VoicesResponse>({
    queryKey: voicesKey,
    queryFn: () => apiRequest('/api/blog-brand-voices'),
  });

  const voices = data?.voices ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteCandidate, setDeleteCandidate] = useState<BrandVoice | null>(null);

  const editingVoice = useMemo(
    () => voices.find((v) => v.id === editingId) ?? null,
    [voices, editingId],
  );

  const isFormOpen = creating || editingId !== null;

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreating(true);
    setEditingId(null);
  }

  function openEdit(voice: BrandVoice) {
    setForm(voiceToForm(voice));
    setEditingId(voice.id);
    setCreating(false);
  }

  function closeForm() {
    setCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: voicesKey });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof formToPayload>) =>
      apiRequest('/api/blog-brand-voices', 'POST', payload),
    onSuccess: () => {
      toast({ title: 'Brand voice created' });
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
      apiRequest(`/api/blog-brand-voices/${id}`, 'PATCH', payload),
    onSuccess: () => {
      toast({ title: 'Brand voice updated' });
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
    mutationFn: (id: string) => apiRequest(`/api/blog-brand-voices/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Brand voice deleted' });
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
    mutationFn: (id: string) => apiRequest(`/api/blog-brand-voices/${id}/set-default`, 'POST', {}),
    onSuccess: () => {
      toast({ title: 'Default brand voice updated' });
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
    <BlogShell title="Brand Voices — Blog Settings · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Blog Settings</h1>
            <Badge variant="secondary" className="text-xs">
              US-BLOG-004
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Per-tenant configuration for the Platform Admin Blog System. Brand voice profiles get
            serialized into every AI step's system prompt.
          </p>
        </header>

        <BlogSettingsNav />

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Mic2 className="h-4 w-4 text-muted-foreground" />
              Brand Voices
            </h2>
            <p className="text-sm text-muted-foreground">
              Each voice combines tone, persona, point-of-view, reading level, preferred / banned
              phrases, and an optional sample corpus.
            </p>
          </div>
          {!isFormOpen ? (
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Voice
            </Button>
          ) : null}
        </div>

        {isFormOpen ? (
          <VoiceFormCard
            isCreate={creating}
            voice={editingVoice}
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
              Loading brand voices…
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-sm text-destructive">
              Failed to load: {error instanceof Error ? error.message : 'Unknown error'}
            </CardContent>
          </Card>
        ) : voices.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-3">
              <Mic2 className="h-8 w-8 mx-auto text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">No brand voices yet</p>
                <p className="text-xs text-muted-foreground">
                  Create your first voice so AI draft generation knows what tone to write in.
                </p>
              </div>
              {!isFormOpen ? (
                <Button onClick={openCreate} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Brand Voice
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {voices.map((voice) => (
              <VoiceListItem
                key={voice.id}
                voice={voice}
                onEdit={() => openEdit(voice)}
                onDelete={() => setDeleteCandidate(voice)}
                onSetDefault={() => setDefaultMutation.mutate(voice.id)}
                isSetDefaultPending={
                  setDefaultMutation.isPending && setDefaultMutation.variables === voice.id
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
            <AlertDialogTitle>Delete brand voice "{deleteCandidate?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing posts and briefs that reference this voice keep their reference but the voice
              will no longer appear in the picker. This is a soft delete — the row stays in the
              audit log.
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

interface VoiceListItemProps {
  voice: BrandVoice;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  isSetDefaultPending: boolean;
}

function VoiceListItem({
  voice,
  onEdit,
  onDelete,
  onSetDefault,
  isSetDefaultPending,
}: VoiceListItemProps) {
  return (
    <Card className={voice.is_default ? 'border-primary/40' : undefined}>
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              {voice.name}
              {voice.is_default ? (
                <Badge variant="default" className="text-[10px] py-0 px-1.5">
                  Default
                </Badge>
              ) : null}
            </CardTitle>
            {voice.tone ? (
              <CardDescription className="text-xs line-clamp-2">{voice.tone}</CardDescription>
            ) : null}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {voice.is_default ? (
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
                title="Set as default voice"
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
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
          {voice.pov ? (
            <>
              <dt>POV</dt>
              <dd className="text-foreground">{voice.pov}</dd>
            </>
          ) : null}
          {voice.reading_level_target ? (
            <>
              <dt>Reading level</dt>
              <dd className="text-foreground">{voice.reading_level_target}</dd>
            </>
          ) : null}
          {voice.preferred_phrases && voice.preferred_phrases.length > 0 ? (
            <>
              <dt>Preferred</dt>
              <dd className="text-foreground line-clamp-1">{voice.preferred_phrases.join(', ')}</dd>
            </>
          ) : null}
          {voice.banned_phrases && voice.banned_phrases.length > 0 ? (
            <>
              <dt>Banned</dt>
              <dd className="text-foreground line-clamp-1">{voice.banned_phrases.join(', ')}</dd>
            </>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}

interface VoiceFormCardProps {
  isCreate: boolean;
  voice: BrandVoice | null;
  form: FormState;
  setForm: (f: FormState) => void;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function VoiceFormCard({
  isCreate,
  voice,
  form,
  setForm,
  isPending,
  onSubmit,
  onCancel,
}: VoiceFormCardProps) {
  const promptPreview = useMemo(() => {
    const payload = formToPayload(form);
    return serializeBrandVoiceToPrompt(payload);
  }, [form]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm({ ...form, [key]: value });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {isCreate ? 'New Brand Voice' : `Edit "${voice?.name ?? ''}"`}
            </CardTitle>
            <CardDescription className="text-xs">
              All fields are optional except <strong>Name</strong>. The preview shows the
              system-prompt fragment that gets prepended to every AI step.
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
              <Label htmlFor="voice-name">Name *</Label>
              <Input
                id="voice-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Founder POV, Corporate Blog"
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice-pov">Point of view</Label>
              <Select value={form.pov} onValueChange={(v) => set('pov', v)}>
                <SelectTrigger id="voice-pov">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {POV_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="voice-reading-level">Reading level</Label>
              <Select
                value={form.reading_level_target}
                onValueChange={(v) => set('reading_level_target', v)}
              >
                <SelectTrigger id="voice-reading-level">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {READING_LEVEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 pt-6">
              <div className="space-y-1">
                <Label htmlFor="voice-default" className="text-sm font-medium">
                  Default voice
                </Label>
                <p className="text-xs text-muted-foreground">
                  Auto-applied to new posts when no voice is selected.
                </p>
              </div>
              <Switch
                id="voice-default"
                checked={form.is_default}
                onCheckedChange={(v) => set('is_default', v)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-tone">Tone</Label>
            <Textarea
              id="voice-tone"
              value={form.tone}
              onChange={(e) => set('tone', e.target.value)}
              placeholder="e.g. Direct, technically rigorous, mildly skeptical. Avoids jargon and exclamation points."
              rows={2}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-persona">Persona</Label>
            <Textarea
              id="voice-persona"
              value={form.persona_description}
              onChange={(e) => set('persona_description', e.target.value)}
              placeholder="e.g. Senior engineer who built the product. Knows the trade-offs and is comfortable saying no."
              rows={2}
              maxLength={4000}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AttributeSlider
              id="voice-humor"
              label="Humor"
              value={form.humor}
              onChange={(v) => set('humor', v)}
            />
            <AttributeSlider
              id="voice-formality"
              label="Formality"
              value={form.formality}
              onChange={(v) => set('formality', v)}
            />
            <AttributeSlider
              id="voice-technicality"
              label="Technicality"
              value={form.technicality}
              onChange={(v) => set('technicality', v)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="voice-preferred">Preferred phrases (comma-separated)</Label>
              <Textarea
                id="voice-preferred"
                value={form.preferred_phrases}
                onChange={(e) => set('preferred_phrases', e.target.value)}
                placeholder="multi-tenant, enterprise-grade, audit trail"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice-banned">Banned phrases (comma-separated)</Label>
              <Textarea
                id="voice-banned"
                value={form.banned_phrases}
                onChange={(e) => set('banned_phrases', e.target.value)}
                placeholder="leverage, synergize, in today's fast-paced world"
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-sample">Sample corpus (paste 1-3 paragraphs)</Label>
            <Textarea
              id="voice-sample"
              value={form.sample_corpus}
              onChange={(e) => set('sample_corpus', e.target.value)}
              placeholder="Paste a few paragraphs that exemplify this voice. The AI mimics the cadence and word choice."
              rows={6}
              maxLength={10000}
            />
            <p className="text-xs text-muted-foreground">
              {form.sample_corpus.length} / 10,000 chars
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">System-prompt preview</Label>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              {promptPreview ? (
                <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
                  {promptPreview}
                </pre>
              ) : (
                <p className="text-xs italic text-muted-foreground">
                  Fill in any of the fields above to see the prompt fragment that gets prepended to
                  every AI step.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {isCreate ? 'Create voice' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface AttributeSliderProps {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

function AttributeSlider({ id, label, value, onChange }: AttributeSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {value !== undefined ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-5 text-xs px-1.5 text-muted-foreground"
            onClick={() => onChange(undefined)}
          >
            clear
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const isActive = value !== undefined && n <= value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={
                isActive
                  ? 'h-6 rounded bg-primary border border-primary'
                  : 'h-6 rounded border border-border hover:border-primary/40 bg-background'
              }
              aria-label={`${label} ${n}`}
            />
          );
        })}
      </div>
    </div>
  );
}
