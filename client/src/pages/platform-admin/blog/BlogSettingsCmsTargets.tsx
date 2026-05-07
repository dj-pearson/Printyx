import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Globe,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
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
 * CMS Targets settings page (US-BLOG-006)
 *
 * Manages WordPress / Ghost endpoints that the publish flow (US-BLOG-042)
 * pushes posts to. Credentials encrypted at rest in
 * blog_distribution_targets.encrypted_config; never decrypted client-side.
 */

type CmsPlatform = 'wordpress' | 'ghost';

interface CmsTarget {
  id: string;
  platform: CmsPlatform;
  account_handle: string;
  display_name: string | null;
  base_url: string | null;
  username: string | null;
  api_token_set: boolean;
  is_active: boolean;
  last_health_check_at: string | null;
  last_health_check_ok: boolean | null;
  created_at: string;
  updated_at: string;
}

interface TargetsResponse {
  targets: CmsTarget[];
}

interface HealthCheckResponse {
  result: {
    ok: boolean;
    version?: string;
    message?: string;
    checked_at: string;
  };
}

const PLATFORM_OPTIONS: { value: CmsPlatform; label: string; help: string }[] = [
  {
    value: 'wordpress',
    label: 'WordPress',
    help: 'REST API + application password (or JWT plugin)',
  },
  {
    value: 'ghost',
    label: 'Ghost',
    help: 'Admin API key (id:secret_hex format)',
  },
];

interface FormState {
  platform: CmsPlatform;
  account_handle: string;
  display_name: string;
  base_url: string;
  api_token: string;
  username: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  platform: 'wordpress',
  account_handle: '',
  display_name: '',
  base_url: '',
  api_token: '',
  username: '',
  is_active: true,
};

function targetToForm(target: CmsTarget): FormState {
  return {
    platform: target.platform,
    account_handle: target.account_handle,
    display_name: target.display_name ?? '',
    base_url: target.base_url ?? '',
    api_token: '', // never returned from server; only set on submit if user types one
    username: target.username ?? '',
    is_active: target.is_active,
  };
}

export default function BlogSettingsCmsTargets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const targetsKey = ['/api/blog-cms-targets'];

  const { data, isLoading, error } = useQuery<TargetsResponse>({
    queryKey: targetsKey,
    queryFn: () => apiRequest('/api/blog-cms-targets'),
  });

  const targets = data?.targets ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteCandidate, setDeleteCandidate] = useState<CmsTarget | null>(null);

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

  function openEdit(target: CmsTarget) {
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
      apiRequest('/api/blog-cms-targets', 'POST', payload),
    onSuccess: () => {
      toast({ title: 'CMS target created' });
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
      apiRequest(`/api/blog-cms-targets/${id}`, 'PATCH', payload),
    onSuccess: () => {
      toast({ title: 'CMS target updated' });
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
    mutationFn: (id: string) => apiRequest(`/api/blog-cms-targets/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'CMS target deleted' });
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
      apiRequest<HealthCheckResponse>(`/api/blog-cms-targets/${id}/test`, 'POST', {}),
    onSuccess: (res, id) => {
      const ok = res.result.ok;
      toast({
        title: ok ? 'Connection OK' : 'Connection failed',
        description: res.result.message ?? (ok ? 'Reachable' : 'Unknown error'),
        variant: ok ? undefined : 'destructive',
      });
      // refetch so last_health_check_at/ok update
      queryClient.invalidateQueries({ queryKey: targetsKey });
      void id;
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
    if (!form.account_handle.trim() || !form.base_url.trim()) {
      toast({ title: 'Account name and base URL are required', variant: 'destructive' });
      return;
    }
    if (creating && !form.api_token.trim()) {
      toast({ title: 'API token is required when creating', variant: 'destructive' });
      return;
    }

    const payload: Record<string, unknown> = {
      platform: form.platform,
      account_handle: form.account_handle.trim(),
      display_name: form.display_name.trim() || null,
      base_url: form.base_url.trim(),
      username: form.username.trim() || null,
      is_active: form.is_active,
    };
    if (form.api_token.trim()) payload.api_token = form.api_token.trim();

    if (editingId) {
      // Patch can omit api_token; backend keeps existing
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <BlogShell title="CMS Targets — Blog Settings · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Blog Settings</h1>
            <Badge variant="secondary" className="text-xs">
              US-BLOG-006
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            WordPress and Ghost endpoints that the publish flow pushes posts to. Credentials are
            encrypted at rest with the Printyx credential vault and never decrypted client-side.
          </p>
        </header>

        <BlogSettingsNav />

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              CMS Targets
            </h2>
            <p className="text-sm text-muted-foreground">
              Add a target, supply credentials, then click <strong>Test</strong> to verify
              connectivity. Active targets are eligible for the publish flow (US-BLOG-042).
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
              <Globe className="h-8 w-8 mx-auto text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">No CMS targets yet</p>
                <p className="text-xs text-muted-foreground">
                  Add your first WordPress or Ghost endpoint to start publishing.
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
              Future publishes to this target will fail. Existing posts already published to this
              endpoint stay published. Soft delete — the row stays in the audit log.
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
  target: CmsTarget;
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
              {target.api_token_set ? (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                  credentials set
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                  no credentials
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs flex items-center gap-2 truncate">
              <code className="font-mono">{target.base_url ?? '—'}</code>
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={onTest}
              disabled={isTestPending || !target.api_token_set}
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
  target: CmsTarget | null;
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
              {isCreate ? 'New CMS Target' : `Edit "${target?.account_handle ?? ''}"`}
            </CardTitle>
            <CardDescription className="text-xs">
              {isCreate
                ? 'Credentials are encrypted at rest. Test connectivity after saving.'
                : 'Leave the API token blank to keep the existing one. Provide a new value to rotate.'}
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
              <Label htmlFor="cms-platform">Platform *</Label>
              <Select
                value={form.platform}
                onValueChange={(v) => set('platform', v as CmsPlatform)}
                disabled={!isCreate}
              >
                <SelectTrigger id="cms-platform">
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
              <Label htmlFor="cms-handle">Account name *</Label>
              <Input
                id="cms-handle"
                value={form.account_handle}
                onChange={(e) => set('account_handle', e.target.value)}
                placeholder="e.g. printyx-blog"
                required
                maxLength={255}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cms-base-url">Site URL *</Label>
            <Input
              id="cms-base-url"
              type="url"
              value={form.base_url}
              onChange={(e) => set('base_url', e.target.value)}
              placeholder={
                form.platform === 'wordpress'
                  ? 'https://blog.printyx.net'
                  : 'https://printyx.ghost.io'
              }
              required
              maxLength={1000}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cms-username">
                Username {form.platform === 'wordpress' ? '*' : '(unused)'}
              </Label>
              <Input
                id="cms-username"
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
                placeholder={form.platform === 'wordpress' ? 'wp-user' : 'leave blank for Ghost'}
                maxLength={255}
                disabled={form.platform !== 'wordpress'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cms-token">
                {form.platform === 'wordpress' ? 'Application password' : 'Admin API key'}
                {isCreate ? ' *' : ' (leave blank to keep)'}
              </Label>
              <Input
                id="cms-token"
                type="password"
                value={form.api_token}
                onChange={(e) => set('api_token', e.target.value)}
                placeholder={
                  form.platform === 'wordpress' ? 'xxxx xxxx xxxx xxxx xxxx xxxx' : '67d…:0123abcd…'
                }
                maxLength={2000}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cms-display">Display name (optional)</Label>
              <Input
                id="cms-display"
                value={form.display_name}
                onChange={(e) => set('display_name', e.target.value)}
                placeholder="Defaults to account name"
                maxLength={255}
              />
            </div>
            <div className="flex items-center justify-between gap-3 pt-6">
              <div className="space-y-1">
                <Label htmlFor="cms-active" className="text-sm font-medium flex items-center gap-1">
                  {form.is_active ? (
                    <Power className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inactive targets are skipped by the publish flow.
                </p>
              </div>
              <Switch
                id="cms-active"
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
