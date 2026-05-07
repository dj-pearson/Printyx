import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  X,
  XCircle,
  Zap,
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

/**
 * Keyword Targets settings page (US-BLOG-013)
 *
 * Manages per-tenant keyword research adapter credentials. Only DataForSEO in
 * v1 — Ahrefs / SEMrush / Google Keyword Planner are phase 2 (the registry
 * stays open for them, but this page doesn't surface them yet).
 */

type KeywordPlatform = 'dataforseo';

interface KeywordTarget {
  id: string;
  platform: KeywordPlatform;
  account_handle: string;
  display_name: string | null;
  base_url: string | null;
  api_key_set: boolean;
  api_secret_set: boolean;
  is_active: boolean;
  last_health_check_at: string | null;
  last_health_check_ok: boolean | null;
  created_at: string;
  updated_at: string;
}

interface TargetsResponse {
  targets: KeywordTarget[];
}

interface HealthCheckResponse {
  result: {
    ok: boolean;
    version?: string;
    message?: string;
    checked_at: string;
  };
}

const PLATFORM_OPTIONS: { value: KeywordPlatform; label: string; help: string }[] = [
  {
    value: 'dataforseo',
    label: 'DataForSEO',
    help: 'API login + password (HTTP Basic). v3 endpoints under api.dataforseo.com.',
  },
];

interface FormState {
  platform: KeywordPlatform;
  account_handle: string;
  display_name: string;
  base_url: string;
  api_key: string;
  api_secret: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  platform: 'dataforseo',
  account_handle: '',
  display_name: '',
  base_url: '',
  api_key: '',
  api_secret: '',
  is_active: true,
};

function targetToForm(target: KeywordTarget): FormState {
  return {
    platform: target.platform,
    account_handle: target.account_handle,
    display_name: target.display_name ?? '',
    base_url: target.base_url ?? '',
    api_key: '',
    api_secret: '',
    is_active: target.is_active,
  };
}

export default function BlogSettingsKeywordTargets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const targetsKey = ['/api/blog-keyword-targets'];

  const { data, isLoading, error } = useQuery<TargetsResponse>({
    queryKey: targetsKey,
    queryFn: () => apiRequest('/api/blog-keyword-targets'),
  });

  const targets = data?.targets ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteCandidate, setDeleteCandidate] = useState<KeywordTarget | null>(null);

  const editingTarget = useMemo(
    () => targets.find((t) => t.id === editingId) ?? null,
    [targets, editingId],
  );

  const isFormOpen = creating || editingId !== null;

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreating(true);
    setEditingId(null);
  }

  function openEdit(target: KeywordTarget) {
    setForm(targetToForm(target));
    setEditingId(target.id);
    setCreating(false);
  }

  function closeForm() {
    setCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: targetsKey });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest('/api/blog-keyword-targets', 'POST', payload),
    onSuccess: () => {
      toast({ title: 'Keyword target created' });
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
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiRequest(`/api/blog-keyword-targets/${id}`, 'PATCH', payload),
    onSuccess: () => {
      toast({ title: 'Keyword target updated' });
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
    mutationFn: (id: string) => apiRequest(`/api/blog-keyword-targets/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Keyword target deleted' });
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

  const testMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<HealthCheckResponse>(`/api/blog-keyword-targets/${id}/test`, 'POST', {}),
    onSuccess: (res) => {
      const ok = res.result.ok;
      toast({
        title: ok ? 'Connection OK' : 'Connection failed',
        description: res.result.message ?? (ok ? 'Reachable' : 'Unknown error'),
        variant: ok ? undefined : 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: targetsKey });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Test failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.account_handle.trim()) {
      toast({ title: 'Account name is required', variant: 'destructive' });
      return;
    }
    if (creating && !form.api_key.trim()) {
      toast({ title: 'API key is required when creating', variant: 'destructive' });
      return;
    }

    const payload: Record<string, unknown> = {
      platform: form.platform,
      account_handle: form.account_handle.trim(),
      display_name: form.display_name.trim() || null,
      base_url: form.base_url.trim() || null,
      is_active: form.is_active,
    };
    if (form.api_key.trim()) payload.api_key = form.api_key.trim();
    if (form.api_secret.trim()) payload.api_secret = form.api_secret.trim();

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <BlogShell title="Keyword Research — Blog Settings · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Blog Settings</h1>
            <Badge variant="secondary" className="text-xs">
              US-BLOG-013
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Keyword research adapter credentials. Used by the Ideas surface, auto-brief generator,
            content-decay detector, and topical-authority scorer. Credentials encrypted at rest.
          </p>
        </header>

        <BlogSettingsNav />

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              Keyword Research
            </h2>
            <p className="text-sm text-muted-foreground">
              v1 ships DataForSEO. Ahrefs, SEMrush, and Google Keyword Planner are phase 2 — the
              adapter registry leaves slots for them.
            </p>
          </div>
          {!isFormOpen ? (
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Target
            </Button>
          ) : null}
        </div>

        {isFormOpen ? (
          <TargetFormCard
            isCreate={creating}
            target={editingTarget}
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
              Loading targets…
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-sm text-destructive">
              Failed to load: {error instanceof Error ? error.message : 'Unknown error'}
            </CardContent>
          </Card>
        ) : targets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-3">
              <Search className="h-8 w-8 mx-auto text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">No keyword research targets yet</p>
                <p className="text-xs text-muted-foreground">
                  Add a DataForSEO API login to enable the Ideas surface and auto-brief generator.
                </p>
              </div>
              {!isFormOpen ? (
                <Button onClick={openCreate} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Target
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {targets.map((target) => (
              <TargetListItem
                key={target.id}
                target={target}
                onEdit={() => openEdit(target)}
                onDelete={() => setDeleteCandidate(target)}
                onTest={() => testMutation.mutate(target.id)}
                isTestPending={testMutation.isPending && testMutation.variables === target.id}
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
            <AlertDialogTitle>
              Delete {deleteCandidate?.platform} target "{deleteCandidate?.account_handle}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The Ideas surface, auto-brief generator, and content-decay detector will fail to fetch
              keyword data until another target is configured. Soft delete — row stays in the audit
              log.
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

interface TargetListItemProps {
  target: KeywordTarget;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  isTestPending: boolean;
}

function TargetListItem({ target, onEdit, onDelete, onTest, isTestPending }: TargetListItemProps) {
  return (
    <Card className={!target.is_active ? 'opacity-70' : undefined}>
      <CardHeader className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <span className="truncate">{target.display_name ?? target.account_handle}</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                {target.platform}
              </Badge>
              {!target.is_active ? (
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                  paused
                </Badge>
              ) : null}
              {target.api_key_set ? (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                  credentials set
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                  no credentials
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              {target.base_url ? (
                <code className="font-mono">{target.base_url}</code>
              ) : (
                'default endpoint'
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={onTest}
              disabled={isTestPending || !target.api_key_set}
              title="Test connection"
            >
              {isTestPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={onEdit} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} title="Delete">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {target.last_health_check_at ? (
        <CardContent className="text-xs">
          <div className="flex items-center gap-2">
            {target.last_health_check_ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className="text-muted-foreground">
              Last check {target.last_health_check_ok ? 'OK' : 'failed'} —{' '}
              {new Date(target.last_health_check_at).toLocaleString()}
            </span>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

interface TargetFormCardProps {
  isCreate: boolean;
  target: KeywordTarget | null;
  form: FormState;
  setForm: (f: FormState) => void;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function TargetFormCard({
  isCreate,
  target,
  form,
  setForm,
  isPending,
  onSubmit,
  onCancel,
}: TargetFormCardProps) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm({ ...form, [key]: value });

  const platformHelp = PLATFORM_OPTIONS.find((p) => p.value === form.platform)?.help ?? '';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {isCreate ? 'New Keyword Target' : `Edit "${target?.account_handle ?? ''}"`}
            </CardTitle>
            <CardDescription className="text-xs">
              {isCreate
                ? 'Credentials encrypted at rest. Test connectivity after saving.'
                : 'Leave the API key / secret blank to keep existing values. Provide new values to rotate.'}
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={onCancel} type="button">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kw-platform">Platform *</Label>
              <Select
                value={form.platform}
                onValueChange={(v) => set('platform', v as KeywordPlatform)}
                disabled={!isCreate}
              >
                <SelectTrigger id="kw-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{platformHelp}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kw-handle">Account name *</Label>
              <Input
                id="kw-handle"
                value={form.account_handle}
                onChange={(e) => set('account_handle', e.target.value)}
                placeholder="e.g. printyx-research"
                required
                maxLength={255}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kw-base-url">Custom base URL (optional)</Label>
            <Input
              id="kw-base-url"
              type="url"
              value={form.base_url}
              onChange={(e) => set('base_url', e.target.value)}
              placeholder="https://api.dataforseo.com (default)"
              maxLength={1000}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kw-api-key">
                API login{isCreate ? ' *' : ' (leave blank to keep)'}
              </Label>
              <Input
                id="kw-api-key"
                type="password"
                value={form.api_key}
                onChange={(e) => set('api_key', e.target.value)}
                placeholder="DataForSEO login email"
                maxLength={2000}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kw-api-secret">API password (leave blank to keep)</Label>
              <Input
                id="kw-api-secret"
                type="password"
                value={form.api_secret}
                onChange={(e) => set('api_secret', e.target.value)}
                placeholder="DataForSEO password"
                maxLength={2000}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kw-display">Display name (optional)</Label>
              <Input
                id="kw-display"
                value={form.display_name}
                onChange={(e) => set('display_name', e.target.value)}
                placeholder="Defaults to account name"
                maxLength={255}
              />
            </div>
            <div className="flex items-center justify-between gap-3 pt-6">
              <div className="space-y-1">
                <Label htmlFor="kw-active" className="text-sm font-medium flex items-center gap-1">
                  {form.is_active ? (
                    <Power className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inactive targets are skipped by Ideas / brief generators.
                </p>
              </div>
              <Switch
                id="kw-active"
                checked={form.is_active}
                onCheckedChange={(v) => set('is_active', v)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {isCreate ? 'Create target' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
