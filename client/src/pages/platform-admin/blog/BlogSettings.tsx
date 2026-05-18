import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, AlertTriangle, Building2, Loader2, ShieldCheck } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogSettingsNav } from '@/components/blog/BlogSettingsNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

/**
 * Blog Settings — Kill switch + agent-mode toggles (US-BLOG-086)
 *
 * Route: /platform-admin/blog/settings (platform admin only)
 *
 * Surfaces the per-tenant blog_agent_settings row:
 *  - Engage / disengage the global kill switch (pauses every blog agent)
 *  - Toggle whether the auto-refresh agent requires human review (default off
 *    per scope decision 5D — fully autonomous re-editing)
 */

interface AgentSettings {
  id: string;
  tenant_id: string;
  agents_paused: boolean;
  paused_at: string | null;
  paused_by_user_id: string | null;
  paused_reason: string | null;
  auto_refresh_requires_review: boolean;
  organization_name: string | null;
  organization_url: string | null;
  organization_logo_url: string | null;
  created_at: string;
  updated_at: string;
}

interface SettingsResponse {
  settings: AgentSettings;
}

export default function BlogSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const settingsKey = ['/api/blog-agents/settings'];

  const { data, isLoading, error } = useQuery<SettingsResponse>({
    queryKey: settingsKey,
    queryFn: () => apiRequest('/api/blog-agents/settings'),
  });

  const settings = data?.settings;

  const pauseMutation = useMutation({
    mutationFn: (reason: string) => apiRequest('/api/blog-agents/pause', 'POST', { reason }),
    onSuccess: () => {
      toast({
        title: 'Kill switch engaged',
        description: 'All blog agents paused for this tenant.',
      });
      queryClient.invalidateQueries({ queryKey: settingsKey });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Failed to pause agents',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (note?: string) =>
      apiRequest('/api/blog-agents/resume', 'POST', note ? { note } : {}),
    onSuccess: () => {
      toast({
        title: 'Kill switch disengaged',
        description: 'Blog agents are running again.',
      });
      queryClient.invalidateQueries({ queryKey: settingsKey });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Failed to resume agents',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const patchMutation = useMutation({
    mutationFn: (patch: {
      auto_refresh_requires_review?: boolean;
      organization_name?: string | null;
      organization_url?: string | null;
      organization_logo_url?: string | null;
    }) => apiRequest('/api/blog-agents/settings', 'PATCH', patch),
    onSuccess: () => {
      toast({ title: 'Settings saved' });
      queryClient.invalidateQueries({ queryKey: settingsKey });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Failed to update settings',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  return (
    <BlogShell title="Blog Settings — Platform Admin · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Blog Settings</h1>
            <Badge variant="secondary" className="text-xs">
              US-BLOG-086
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Global agent controls for the Platform Admin Blog System. Use the kill switch to halt
            every blog agent (auto-refresh, draft pipeline, distribution scheduler, outreach) for
            this tenant in one click.
          </p>
        </header>

        <BlogSettingsNav />

        {isLoading ? (
          <Card>
            <CardContent className="py-12 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading settings…
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-sm text-destructive">
              Failed to load settings: {error instanceof Error ? error.message : 'Unknown error'}
            </CardContent>
          </Card>
        ) : settings ? (
          <>
            <KillSwitchCard
              settings={settings}
              isPausing={pauseMutation.isPending}
              isResuming={resumeMutation.isPending}
              onPause={(reason) => pauseMutation.mutate(reason)}
              onResume={() => resumeMutation.mutate(undefined)}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  Auto-refresh review gate
                </CardTitle>
                <CardDescription>
                  When enabled, the auto-refresh agent (US-BLOG-066) creates revisions in a review
                  queue instead of auto-publishing. Default off per scope decision 5D (fully
                  autonomous re-editing on SERP decay).
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="auto_refresh_requires_review" className="text-sm font-medium">
                    Require human review for auto-refresh edits
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Hard guardrails (change-magnitude, SEO regression, voice/style violations) will
                    always route edge cases to the review queue regardless of this setting.
                  </p>
                </div>
                <Switch
                  id="auto_refresh_requires_review"
                  checked={settings.auto_refresh_requires_review}
                  disabled={patchMutation.isPending}
                  onCheckedChange={(checked) =>
                    patchMutation.mutate({ auto_refresh_requires_review: checked })
                  }
                />
              </CardContent>
            </Card>

            <OrganizationCard
              settings={settings}
              isSaving={patchMutation.isPending}
              onSave={(patch) => patchMutation.mutate(patch)}
            />
          </>
        ) : null}
      </div>
    </BlogShell>
  );
}

interface OrganizationCardProps {
  settings: AgentSettings;
  isSaving: boolean;
  onSave: (patch: {
    organization_name: string | null;
    organization_url: string | null;
    organization_logo_url: string | null;
  }) => void;
}

function OrganizationCard({ settings, isSaving, onSave }: OrganizationCardProps) {
  const [name, setName] = useState(settings.organization_name ?? '');
  const [url, setUrl] = useState(settings.organization_url ?? '');
  const [logo, setLogo] = useState(settings.organization_logo_url ?? '');

  const dirty =
    name !== (settings.organization_name ?? '') ||
    url !== (settings.organization_url ?? '') ||
    logo !== (settings.organization_logo_url ?? '');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Organization (structured data)
        </CardTitle>
        <CardDescription>
          Used as the publisher/author in every post's JSON-LD schema markup (US-BLOG-027). Leave
          blank to omit the publisher block.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="org-name" className="text-sm">
            Organization name
          </Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Printyx"
            maxLength={255}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="org-url" className="text-sm">
            Website URL
          </Label>
          <Input
            id="org-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://printyx.net"
            maxLength={500}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="org-logo" className="text-sm">
            Logo URL
          </Label>
          <Input
            id="org-logo"
            type="url"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://printyx.net/logo.png"
            maxLength={1000}
          />
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!dirty || isSaving}
            onClick={() =>
              onSave({
                organization_name: name.trim() || null,
                organization_url: url.trim() || null,
                organization_logo_url: logo.trim() || null,
              })
            }
          >
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save organization
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface KillSwitchCardProps {
  settings: AgentSettings;
  isPausing: boolean;
  isResuming: boolean;
  onPause: (reason: string) => void;
  onResume: () => void;
}

function KillSwitchCard({
  settings,
  isPausing,
  isResuming,
  onPause,
  onResume,
}: KillSwitchCardProps) {
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');

  const handlePauseConfirm = () => {
    if (pauseReason.trim().length === 0) return;
    onPause(pauseReason.trim());
    setPauseDialogOpen(false);
    setPauseReason('');
  };

  return (
    <Card
      className={
        settings.agents_paused ? 'border-destructive/50 bg-destructive/5' : 'border-primary/30'
      }
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          {settings.agents_paused ? (
            <AlertOctagon className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          )}
          <div className="flex-1 space-y-1">
            <CardTitle className="text-lg">
              Kill Switch:{' '}
              {settings.agents_paused ? (
                <span className="text-destructive">ENGAGED</span>
              ) : (
                <span className="text-primary">disengaged</span>
              )}
            </CardTitle>
            <CardDescription>
              {settings.agents_paused
                ? 'Every blog agent is paused. No auto-publish, no auto-refresh, no distribution.'
                : 'Blog agents are running. Engage the kill switch to halt every agent immediately.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings.agents_paused ? (
          <div className="rounded-md border bg-background p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Pause active
            </div>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <dt>Engaged at</dt>
              <dd className="font-mono">
                {settings.paused_at ? new Date(settings.paused_at).toLocaleString() : 'unknown'}
              </dd>
              <dt>Engaged by</dt>
              <dd className="font-mono">{settings.paused_by_user_id ?? 'unknown'}</dd>
              <dt>Reason</dt>
              <dd className="text-foreground">{settings.paused_reason ?? '(no reason given)'}</dd>
            </dl>
          </div>
        ) : null}

        <Separator />

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          {settings.agents_paused ? (
            <Button
              onClick={onResume}
              disabled={isResuming}
              variant="default"
              className="sm:min-w-[180px]"
            >
              {isResuming ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Resume agents
            </Button>
          ) : (
            <AlertDialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isPausing} className="sm:min-w-[180px]">
                  {isPausing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Engage kill switch
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Pause every blog agent?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This stops auto-refresh, draft pipelines, scheduled distributions, and outreach
                    until you resume. Any in-progress run finishes; new runs are skipped with an
                    audit log entry.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="pauseReason" className="text-sm font-medium">
                    Reason (required)
                  </Label>
                  <Textarea
                    id="pauseReason"
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                    placeholder="e.g. Investigating an outlier auto-refresh edit on the pricing post"
                    rows={3}
                    maxLength={2000}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Captured in the blog audit log alongside the engagement timestamp and your user
                    ID.
                  </p>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handlePauseConfirm}
                    disabled={pauseReason.trim().length === 0}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Engage kill switch
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
