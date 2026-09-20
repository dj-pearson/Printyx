/**
 * DealDetail — the deal record page (COP-B02).
 *
 * Replaces a 238-line read-only field dump. A copier rep lives on this screen,
 * and it previously had no timeline, no notes, no tasks, no quotes, no next
 * step and no way to advance the stage — while Lead and Customer detail were
 * 2,287 and 2,935 lines.
 *
 * Composition notes:
 *  - Notes come from NotesPanel (CRMX-006), already polymorphic.
 *  - Activities come from the deal's own timeline endpoint plus anything linked
 *    through crm_associations, so a task or note attached to the deal shows up
 *    without tasks/quotes needing a dealId column (they do not have one).
 *  - Stage advance posts to /api/pipeline-config/deals/:id/move — the SAME
 *    endpoint the board drag uses, so both paths fire identical automation.
 *  - The insights panel is a real slot with an honest empty state; COP-B11
 *    fills it. It does not fabricate a score.
 *  - Equipment is deliberately a stub: the deal↔equipment association is
 *    COP-M05, which is blocked on COP-M00 (migration tooling).
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useRoute } from 'wouter';
import { apiRequest, extractRecords } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NotesPanel } from '@/components/crm/NotesPanel';
import { DealInsightsPanel } from '@/components/crm/DealInsightsPanel';
import { CompetitiveCard } from '@/components/crm/CompetitiveCard';
import { PlaybookPanel } from '@/components/crm/PlaybookPanel';
import { DealEquipmentPanel } from '@/components/crm/DealEquipmentPanel';
import { RecordPageLayout, RecordStageBar } from '@/components/crm/RecordPageLayout';
import { FleetAssessmentPanel } from '@/components/crm/FleetAssessmentPanel';
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Mail,
  Phone,
  Calendar,
  Percent,
  Target,
  FileText,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Printer,
  Calculator,
  ListChecks,
  ClipboardList,
  Plus,
  Activity as ActivityIcon,
} from 'lucide-react';
import { format } from 'date-fns';

interface DealData {
  id: string;
  title: string;
  description?: string | null;
  amount?: string | null;
  companyName?: string | null;
  customerId?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  source?: string | null;
  dealType?: string | null;
  priority?: string | null;
  expectedCloseDate?: string | null;
  productsInterested?: string | null;
  estimatedMonthlyValue?: string | null;
  notes?: string | null;
  status?: string | null;
  probability?: number | null;
  stageId?: string | null;
  stageName?: string | null;
  stageColor?: string | null;
  ownerName?: string | null;
  nextFollowUpDate?: string | null;
  lastActivityDate?: string | null;
  createdAt?: string | null;
  // WF-C-09: the contract this deal became, returned by GET /api/deals/:id.
  // Absent on every deal that has not been accepted, which is most of them.
  contract?: {
    id: string;
    contract_number?: string | null;
    status?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    acquisition_type?: string | null;
    lease_id?: string | null;
  } | null;
  // WF-C-05: the lease this deal produced, when it was paid for on somebody
  // else's paper. Null for a cash sale and for every deal not yet accepted.
  lease?: {
    id: string;
    lease_number?: string | null;
    lease_name?: string | null;
    status?: string | null;
    lease_type?: string | null;
    monthly_payment?: string | null;
    term?: number | null;
    total_amount?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    first_payment_date?: string | null;
    lessor_name?: string | null;
  } | null;
  updatedAt?: string | null;
  // COP-M04: the copier-deal fields. The deals edge function returns each one in
  // camelCase alongside the raw snake row.
  dealMotion?: string | null;
  forecastCategory?: string | null;
  incumbentVendor?: string | null;
  leaseBuyoutExposure?: string | null;
  tradeInValue?: string | null;
  currentMonthlyVolumeBw?: number | null;
  currentMonthlyVolumeColor?: number | null;
  targetCpcBlack?: string | null;
  targetCpcColor?: string | null;
  replacesContractId?: string | null;
}

interface StageOption {
  /** The LEGACY deal_stages.id - what the move endpoint takes and deals group by. */
  id: string;
  name: string;
  displayName?: string;
  color?: string;
  order?: number;
  // WF-C-02: the board endpoint has always returned these; nothing read them, so
  // Mark Won had no way to know which stage "won" meant and patched status instead.
  isClosedWon?: boolean;
  isClosedLost?: boolean;
}

interface BoardResponse {
  stages?: StageOption[];
  data?: { stages?: StageOption[] };
}

/** The activities endpoint has returned a bare array and an envelope over time. */
type TimelineResponse = TimelineEntry[] | { data?: TimelineEntry[]; records?: TimelineEntry[] };

interface TimelineEntry {
  id: string;
  type?: string | null;
  subject?: string | null;
  description?: string | null;
  createdAt?: string | null;
  userId?: string | null;
  outcome?: string | null;
}

/** The `deal_activities.type` values the timeline groups by (AC5). */
const TIMELINE_FILTERS = [
  { value: 'email', label: 'Emails' },
  { value: 'call', label: 'Calls' },
  { value: 'note', label: 'Notes' },
  { value: 'task', label: 'Tasks' },
  { value: 'meeting', label: 'Meetings' },
  { value: 'stage_change', label: 'Changes' },
] as const;

function money(value?: string | null): string | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

/**
 * COP-M04. Target CPC is stored at numeric(10,4) to match contracts.black_rate,
 * so it must render at four decimals - a copier CPC of $0.0085 rounds to $0.01
 * under the default currency format, which is a 17% error on the number the
 * whole deal turns on.
 */
function cpc(value?: string | null): string | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function pages(value?: number | null): string | null {
  if (value == null) return null;
  return `${value.toLocaleString()} pages/mo`;
}

/** Underscored vocabulary value to a readable label: lease_rollover -> Lease rollover. */
function humanize(value?: string | null): string | null {
  if (!value) return null;
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function statusVariant(
  status?: string | null,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'won':
      return 'default';
    case 'lost':
      return 'destructive';
    case 'on_hold':
      return 'secondary';
    default:
      return 'outline';
  }
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | number | null;
}) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  );
}

export default function DealDetail() {
  // COP-E04 made /crm/deals/:id canonical and left /deals/:id as a redirect.
  // Match BOTH — matching only the legacy shape left this page unable to read
  // its own id on the canonical URL.
  const [matchesCanonical, canonicalParams] = useRoute('/crm/deals/:id');
  const [, legacyParams] = useRoute('/deals/:id');
  const dealId = (matchesCanonical ? canonicalParams?.id : legacyParams?.id) ?? undefined;

  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('activity');

  const {
    data: deal,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<DealData>({
    queryKey: [`/api/deals/${dealId}`],
    enabled: !!dealId,
  });

  // Stage list drives the advance control. Same source as the board.
  const { data: board } = useQuery<BoardResponse>({
    queryKey: ['/api/pipeline-config/board'],
    queryFn: () => apiRequest('/api/pipeline-config/board'),
    enabled: !!dealId,
    staleTime: 300_000,
  });

  const stages: StageOption[] = useMemo(() => {
    const raw = board?.stages ?? board?.data?.stages ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [board]);

  const { data: timeline, isLoading: timelineLoading } = useQuery<TimelineResponse>({
    queryKey: [`/api/deals/${dealId}/activities`],
    queryFn: () => apiRequest(`/api/deals/${dealId}/activities`),
    enabled: !!dealId,
  });

  const entries: TimelineEntry[] = useMemo(() => {
    if (Array.isArray(timeline)) return timeline;
    return timeline?.data ?? timeline?.records ?? [];
  }, [timeline]);

  /**
   * AC5's type filter and AC9's compose area.
   *
   * The filter buckets by the `type` column `deal_activities` actually stores,
   * and a type outside the known set lands in "Other" rather than being
   * silently dropped - a timeline that hides entries is worse than one with an
   * unfamiliar label, because nothing says anything is missing.
   */
  const [timelineFilter, setTimelineFilter] = useState<string>('all');
  const [composeType, setComposeType] = useState<string>('note');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  const visibleEntries = useMemo(() => {
    if (timelineFilter === 'all') return entries;
    if (timelineFilter === 'other') {
      return entries.filter((e) => !TIMELINE_FILTERS.some((f) => f.value === (e.type ?? '')));
    }
    return entries.filter((e) => (e.type ?? '') === timelineFilter);
  }, [entries, timelineFilter]);

  const addActivity = useMutation({
    mutationFn: () =>
      apiRequest(`/api/deals/${dealId}/activities`, 'POST', {
        type: composeType,
        subject: composeSubject.trim() || null,
        description: composeBody.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/activities`] });
      setComposeSubject('');
      setComposeBody('');
      toast({ title: 'Logged' });
    },
    onError: (err: unknown) =>
      toast({
        title: 'Could not log that',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  // COP-M04: does this deal carry any copier facts at all? Every field is
  // nullable, so a generic B2B deal has none and gets no card. 0 counts as an
  // answer for a volume, hence the null check rather than a truthiness test.
  const hasCopierProfile = useMemo(
    () =>
      [
        deal?.dealMotion,
        deal?.forecastCategory,
        deal?.incumbentVendor,
        deal?.leaseBuyoutExposure,
        deal?.tradeInValue,
        deal?.currentMonthlyVolumeBw,
        deal?.currentMonthlyVolumeColor,
        deal?.targetCpcBlack,
        deal?.targetCpcColor,
      ].some((v) => v != null && v !== ''),
    [deal],
  );

  // WF-P-08: the deal's own work. tasks gained deal_id in migration 0079; before
  // it, a task carried an assignee and no subject, so this panel had nothing to
  // list and said so.
  const [newTaskTitle, setNewTaskTitle] = useState('');
  /** Local draft for the recurring value, so typing does not PATCH per keystroke. */
  const [monthlyDraft, setMonthlyDraft] = useState<string | null>(null);

  // COP-B02: the deal's quotes. proposals.deal_id landed with this story -
  // before it, an account's proposals could not be attributed to one of its
  // deals and this tab could not honestly exist.
  const dealQuotesQuery = useQuery<{
    data: Array<{
      id: string;
      proposalNumber: string | null;
      title: string | null;
      status: string | null;
      totalAmount: string | null;
      discountPercentage: string | null;
      marginPercentage: string | null;
      validUntil: string | null;
      createdAt: string | null;
    }>;
    unbacked: string[];
  }>({
    queryKey: [`/api/deals/${dealId}/quotes`],
    queryFn: () => apiRequest(`/api/deals/${dealId}/quotes`),
    enabled: Boolean(dealId),
  });
  const dealQuotes = dealQuotesQuery.data?.data ?? [];

  const dealTasksQuery = useQuery<
    Array<{ id: string; title: string; status?: string; priority?: string; dueDate?: string }>
  >({
    queryKey: ['/api/tasks', { dealId }],
    enabled: Boolean(dealId),
    queryFn: async () => extractRecords(await apiRequest(`/api/tasks?dealId=${dealId}`, 'GET')),
  });
  const dealTasks = dealTasksQuery.data ?? [];

  const addDealTask = useMutation({
    mutationFn: (title: string) =>
      apiRequest('/api/tasks', 'POST', {
        title,
        dealId,
        // The account too, so the customer's task list shows the deal's work.
        customerId: deal?.customerId ?? null,
        status: 'todo',
        priority: 'medium',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', { dealId }] });
      setNewTaskTitle('');
      toast({ title: 'Task added' });
    },
    onError: (error: Error) =>
      toast({
        title: 'Could not add the task',
        description: error.message,
        variant: 'destructive',
      }),
  });

  // COP-I06 AC1: the forecast category is what drives the forecast, so it has to
  // be settable where the rep works. It was a read-only field on a card that only
  // rendered when the deal already had copier facts - so a deal with no category
  // showed nothing and offered no way to set one.
  const setForecastField = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      apiRequest(`/api/deals/${dealId}`, 'PATCH', patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      // Generic copy because this one mutation now serves every inline edit on
      // the page, the deal's own name included - "Forecast updated" after
      // renaming a deal names the wrong thing.
      toast({ title: 'Deal updated' });
    },
    onError: () => toast({ title: 'Could not update the deal', variant: 'destructive' }),
  });

  const moveStage = useMutation({
    // The endpoint expects `toStageId` (the legacy deal_stages.id the board also
    // sends), not `stageId` — sending the wrong key silently 400s.
    mutationFn: (toStageId: string) =>
      apiRequest(`/api/pipeline-config/deals/${dealId}/move`, 'POST', { toStageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/activities`] });
      toast({ title: 'Stage updated' });
    },
    onError: () => toast({ title: 'Could not move stage', variant: 'destructive' }),
  });

  // WF-C-02: this had the same defect as CrmDealsPage's Mark Won - it PUT status
  // and actualCloseDate and nothing else, so the board (which groups strictly by
  // stageId) kept the deal in its old column while this page said Won. Marking a
  // deal closed IS a stage move, so it goes through the same endpoint the stage
  // control above uses, which sets status, probability and actual_close_date from
  // the stage's own flags and fires deal.stage_changed (WF-C-01).
  const setStatus = useMutation({
    mutationFn: (status: 'won' | 'lost') => {
      const target = stages.find((s) => (status === 'won' ? s.isClosedWon : s.isClosedLost));
      if (!target) {
        // Refusing beats writing a status the board cannot show; a pipeline with
        // no closing stage is a configuration problem, and patching status anyway
        // is what produced the disagreement.
        return Promise.reject(
          new Error(
            `This pipeline has no Closed ${status === 'won' ? 'Won' : 'Lost'} stage. ` +
              'Add one in Pipeline Configuration first.',
          ),
        );
      }
      return apiRequest(`/api/pipeline-config/deals/${dealId}/move`, 'POST', {
        toStageId: target.id,
      });
    },
    onSuccess: (_d, status) => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({ title: `Deal marked ${status}` });
    },
    onError: (err) =>
      toast({
        title: 'Could not update the deal',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-28 w-full" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-64 lg:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (isError || !deal) {
    return (
      <MainLayout>
        <div className="p-6 max-w-2xl mx-auto">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/crm/deals')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to deals
          </Button>
          <EmptyState
            icon={AlertTriangle}
            type="error"
            title={isError ? 'Could not load this deal' : 'Deal not found'}
            description={
              isError
                ? error instanceof Error
                  ? error.message
                  : 'The request failed.'
                : 'It may have been deleted, or you may not have access to it.'
            }
            action={{ label: 'Try again', onClick: () => refetch(), icon: RefreshCw }}
          />
        </div>
      </MainLayout>
    );
  }

  const isOpen = !deal.status || deal.status === 'open';

  /**
   * AC3's quick actions - only the ones with somewhere to go.
   *
   * "Schedule meeting" is deliberately absent: nothing on this page can create
   * a meeting against a deal yet (that is COP-B12, still open) and a button
   * that does nothing is worse than no button (AUDIT-016).
   */
  const quickActions = [
    {
      label: 'Log activity',
      icon: <ActivityIcon className="h-4 w-4 mr-1" />,
      onClick: () => setTab('activity'),
    },
    {
      label: 'Add note',
      icon: <FileText className="h-4 w-4 mr-1" />,
      onClick: () => setTab('notes'),
    },
    {
      label: 'Create task',
      icon: <ListChecks className="h-4 w-4 mr-1" />,
      onClick: () => setTab('tasks'),
    },
    ...(deal.primaryContactEmail
      ? [
          {
            label: 'Email',
            icon: <Mail className="h-4 w-4 mr-1" />,
            onClick: () => window.open(`mailto:${deal.primaryContactEmail}`, '_self'),
          },
        ]
      : []),
    ...(deal.primaryContactPhone
      ? [
          {
            label: 'Call',
            icon: <Phone className="h-4 w-4 mr-1" />,
            onClick: () => window.open(`tel:${deal.primaryContactPhone}`, '_self'),
          },
        ]
      : []),
  ];

  /**
   * CRM-008: the page's content, handed to the layout engine as SLOTS.
   *
   * The engine owns which sections exist, where they sit and in what order -
   * all of that is config. It does NOT own what a section contains, because
   * several of these carry judgement no config can express: the contract and
   * lease rows appear only when the deal produced one, and the competitive
   * card renders unconditionally because "no competitor recorded" and "no
   * competitor" are different facts.
   */
  const timelineSlot = (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="activity">
          <ActivityIcon className="h-4 w-4 mr-1.5" /> Activity
        </TabsTrigger>
        <TabsTrigger value="notes">
          <FileText className="h-4 w-4 mr-1.5" /> Notes
        </TabsTrigger>
        <TabsTrigger value="tasks">
          <ListChecks className="h-4 w-4 mr-1.5" /> Tasks
        </TabsTrigger>
        <TabsTrigger value="equipment">
          <Printer className="h-4 w-4 mr-1.5" /> Equipment
        </TabsTrigger>
        {/* COP-B05: the fleet assessment, where the copier sale is actually
            made. Sits beside Equipment because it reads the same machines. */}
        <TabsTrigger value="fleet">
          <Calculator className="h-4 w-4 mr-1.5" /> Fleet TCO
        </TabsTrigger>
        {/* COP-B13: the discovery questions, in front of the rep while
            they are on the call. */}
        <TabsTrigger value="quotes">
          <FileText className="h-4 w-4 mr-1.5" /> Quotes
        </TabsTrigger>
        <TabsTrigger value="discovery">
          <ClipboardList className="h-4 w-4 mr-1.5" /> Discovery
        </TabsTrigger>
      </TabsList>

      <TabsContent value="quotes" className="mt-4">
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Quotes</CardTitle>
            {/* The only path that SETS proposals.deal_id. Raising a
                quote from /quotes/new directly leaves it null, which is
                correct - that quote belongs to an account, not a deal. */}
            <Button size="sm" variant="outline" asChild>
              <Link href={`/quotes/new?dealId=${dealId}`}>
                <Plus className="h-4 w-4 mr-1" /> New quote
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {dealQuotesQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : dealQuotes.length === 0 ? (
              <EmptyState
                title="No quotes on this deal"
                description={
                  dealQuotesQuery.data?.unbacked?.[0] ??
                  'A quote raised from this deal will appear here with its margin and discount.'
                }
              />
            ) : (
              <div className="space-y-2">
                {dealQuotes.map((quote) => (
                  <Link
                    key={quote.id}
                    href={`/quotes/${quote.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {quote.title || quote.proposalNumber || 'Quote'}
                        </span>
                        {quote.status && (
                          <Badge variant="outline" className="text-xs font-normal">
                            {quote.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {quote.proposalNumber}
                        {/* Margin is what the insights panel scores; showing
                            it here is why a rep can argue with the score. */}
                        {quote.marginPercentage != null &&
                          ` · ${Number(quote.marginPercentage).toFixed(1)}% margin`}
                      </p>
                    </div>
                    <span className="tabular-nums text-sm shrink-0">
                      {money(quote.totalAmount)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="discovery" className="mt-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Guided discovery</CardTitle>
          </CardHeader>
          <CardContent>
            <PlaybookPanel parentType="deal" parentId={dealId} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="activity" className="mt-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {/* AC9: compose at the top of the timeline. One POST to the deal's
                own activities endpoint, so what a rep logs here is the same
                row the timeline reads back. */}
            <div className="space-y-2 rounded-lg border p-3 mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={composeType} onValueChange={setComposeType}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMELINE_FILTERS.filter((f) => f.value !== 'stage_change').map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label.replace(/s$/, '')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 flex-1 min-w-[12rem] text-sm"
                  placeholder="What happened?"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={
                    addActivity.isPending || (!composeSubject.trim() && !composeBody.trim())
                  }
                  onClick={() => addActivity.mutate()}
                >
                  Log
                </Button>
              </div>
              <Input
                className="h-8 text-sm"
                placeholder="Detail (optional)"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
              />
            </div>

            {/* AC5: type filter. "Other" exists so an unfamiliar type is
                labelled rather than hidden. */}
            <div className="flex flex-wrap gap-1 mb-3">
              {[
                { value: 'all', label: 'All' },
                ...TIMELINE_FILTERS,
                { value: 'other', label: 'Other' },
              ].map((f) => (
                <Button
                  key={f.value}
                  size="sm"
                  variant={timelineFilter === f.value ? 'secondary' : 'ghost'}
                  className="h-7 px-2 text-xs"
                  onClick={() => setTimelineFilter(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {timelineLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : visibleEntries.length === 0 ? (
              <EmptyState
                title={entries.length === 0 ? 'No activity yet' : 'Nothing of that kind yet'}
                description={
                  entries.length === 0
                    ? 'Calls, emails, meetings and stage changes on this deal will appear here.'
                    : 'This deal has activity, just none matching that filter.'
                }
              />
            ) : (
              <ol className="space-y-3">
                {visibleEntries.map((e) => (
                  <li key={e.id} className="flex gap-3 text-sm">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium break-words">{e.subject || e.type || 'Activity'}</p>
                      {e.description && (
                        <p className="text-muted-foreground break-words">{e.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {e.createdAt ? format(new Date(e.createdAt), 'PPp') : ''}
                        {e.outcome ? ` · ${e.outcome}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="notes" className="mt-4">
        {/* CRMX-006 NotesPanel is already polymorphic — no work needed. */}
        <NotesPanel parentType="deal" parentId={dealId} />
      </TabsContent>

      <TabsContent value="tasks" className="mt-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* WF-P-08: real now. tasks gained deal_id in migration
                0079, and the note that stood here - "tasks attach
                through crm_associations" - was a guess: nothing ever
                associated a task that way either. */}
            {dealTasksQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : dealTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks on this deal yet.</p>
            ) : (
              <ul className="space-y-2">
                {dealTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{task.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {humanize(task.status)}
                        {task.dueDate ? ` · due ${format(new Date(task.dueDate), 'PP')}` : ''}
                      </span>
                    </span>
                    <Badge variant="outline">{humanize(task.priority)}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTaskTitle.trim()) return;
                addDealTask.mutate(newTaskTitle.trim());
              }}
            >
              <Input
                aria-label="New task for this deal"
                placeholder="Add a task for this deal"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 min-w-[12rem]"
              />
              <Button type="submit" disabled={addDealTask.isPending}>
                Add task
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="fleet" className="mt-4">
        {dealId && <FleetAssessmentPanel dealId={dealId} companyName={deal.companyName} />}
      </TabsContent>

      <TabsContent value="equipment" className="mt-4">
        {/* COP-M05: real now. Links live in crm_associations with an
            explicit 'replaces' / 'places' role. */}
        <DealEquipmentPanel dealId={dealId} customerId={deal.customerId} />
      </TabsContent>
    </Tabs>
  );

  const insightsSlot = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Insights</CardTitle>
      </CardHeader>
      <CardContent>
        {/* COP-B11: a real, inspectable score. Renders "not enough
            signal" rather than a number when the deal is too sparse. */}
        <DealInsightsPanel deal={deal} activityCount={entries.length} />
      </CardContent>
    </Card>
  );

  // COP-I06: the two fields that decide what this deal contributes to the
  // forecast. Always shown, including when both are empty - a deal nobody has
  // categorized is exactly the one a manager needs to find.
  const forecastSlot = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Forecast</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="forecast-category" className="text-xs text-muted-foreground">
            Category
          </Label>
          <Select
            value={deal.forecastCategory ?? 'none'}
            onValueChange={(value) =>
              setForecastField.mutate({
                forecastCategory: value === 'none' ? null : value,
              })
            }
          >
            <SelectTrigger id="forecast-category">
              <SelectValue placeholder="Not categorized" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not categorized</SelectItem>
              <SelectItem value="pipeline">Pipeline</SelectItem>
              <SelectItem value="best_case">Best case</SelectItem>
              <SelectItem value="commit">Commit</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="monthly-value" className="text-xs text-muted-foreground">
            Recurring monthly value
          </Label>
          <Input
            id="monthly-value"
            inputMode="decimal"
            placeholder="CPC and service, per month"
            value={monthlyDraft ?? deal.estimatedMonthlyValue ?? ''}
            onChange={(e) => setMonthlyDraft(e.target.value)}
            onBlur={() => {
              if (monthlyDraft === null) return;
              const trimmed = monthlyDraft.trim();
              const next = trimmed === '' ? null : trimmed;
              if (next !== (deal.estimatedMonthlyValue ?? null)) {
                setForecastField.mutate({ estimatedMonthlyValue: next });
              }
              setMonthlyDraft(null);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Kept apart from Amount on purpose: the box lands once, CPC and service land every month.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  // COP-B10: who this deal is against, rendered unconditionally so a deal with
  // no incumbent says so.
  const competitiveSlot = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Competition</CardTitle>
      </CardHeader>
      <CardContent>
        <CompetitiveCard dealId={dealId} />
      </CardContent>
    </Card>
  );

  const detailsSlot = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field icon={Building2} label="Account" value={deal.companyName} />
        <Field icon={Target} label="Deal type" value={deal.dealType} />
        {/* WF-C-09. Rendered only when the deal produced one, so an open
            deal does not grow an empty row. The term is deliberately not
            shown here: start and end date are null until acceptance sets
            them (WF-L-08), and rendering "N/A" for a date nobody has
            agreed to reads as missing data rather than as not-yet. */}
        {deal.contract && (
          <Field
            icon={FileText}
            label="Contract"
            value={deal.contract.contract_number ?? deal.contract.id}
          />
        )}
        {/* WF-C-05. Acceptance used to create a contract and nothing
            else, whatever the proposal said, so a leased fleet looked
            exactly like a cash sale. Both rows appear only when the
            fact exists - a deal that states no acquisition type shows
            neither, rather than "Cash" by default. */}
        {deal.contract?.acquisition_type && (
          <Field
            icon={DollarSign}
            label="Acquisition"
            value={humanize(deal.contract.acquisition_type)}
          />
        )}
        {deal.lease && (
          <>
            <Field
              icon={FileText}
              label="Lease"
              value={deal.lease.lease_number ?? deal.lease.lease_name ?? deal.lease.id}
            />
            <Field
              icon={DollarSign}
              label="Lease payment"
              value={
                deal.lease.monthly_payment
                  ? `${money(deal.lease.monthly_payment)} x ${deal.lease.term ?? '?'} months`
                  : null
              }
            />
            <Field icon={Building2} label="Lessor" value={deal.lease.lessor_name} />
            <Field icon={Target} label="Lease status" value={humanize(deal.lease.status)} />
          </>
        )}
        <Field icon={FileText} label="Products" value={deal.productsInterested} />
        <Field
          icon={Calendar}
          label="Created"
          value={deal.createdAt ? format(new Date(deal.createdAt), 'PP') : null}
        />
        <Field
          icon={ActivityIcon}
          label="Last activity"
          value={deal.lastActivityDate ? format(new Date(deal.lastActivityDate), 'PP') : null}
        />
        {deal.description && (
          <div>
            <p className="text-xs text-muted-foreground">Description</p>
            <p className="text-sm break-words">{deal.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  /**
   * COP-M04's copier facts. Unconditional now, unlike before CRM-008: a
   * section the layout names and the page does not supply is REPORTED by the
   * engine, and "this deal has no copier profile" is worth one honest line
   * rather than a warning about a missing renderer.
   */
  const copierSlot = hasCopierProfile ? (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Copier profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field icon={Target} label="Motion" value={humanize(deal.dealMotion)} />
        <Field
          icon={ListChecks}
          label="Forecast category"
          value={humanize(deal.forecastCategory)}
        />
        <Field icon={Building2} label="Incumbent vendor" value={deal.incumbentVendor} />
        <Field
          icon={DollarSign}
          label="Lease buyout exposure"
          value={money(deal.leaseBuyoutExposure)}
        />
        <Field icon={DollarSign} label="Trade-in value" value={money(deal.tradeInValue)} />
        <Field
          icon={Printer}
          label="Current B/W volume"
          value={pages(deal.currentMonthlyVolumeBw)}
        />
        <Field
          icon={Printer}
          label="Current color volume"
          value={pages(deal.currentMonthlyVolumeColor)}
        />
        <Field icon={Percent} label="Target CPC B/W" value={cpc(deal.targetCpcBlack)} />
        <Field icon={Percent} label="Target CPC color" value={cpc(deal.targetCpcColor)} />
      </CardContent>
    </Card>
  ) : (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Copier profile</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">No copier profile recorded on this deal.</p>
      </CardContent>
    </Card>
  );

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/crm/deals')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to deals
        </Button>

        <RecordPageLayout
          objectType="deals"
          record={deal as unknown as Record<string, unknown>}
          title={deal.title}
          titleField="title"
          subtitle={deal.companyName}
          badges={
            <>
              <Badge variant={statusVariant(deal.status)}>{deal.status || 'open'}</Badge>
              {deal.stageName && (
                <Badge
                  variant="outline"
                  style={deal.stageColor ? { borderColor: deal.stageColor } : undefined}
                >
                  {deal.stageName}
                </Badge>
              )}
            </>
          }
          headerContent={
            isOpen ? (
              <div className="space-y-3">
                {/* AC8: the stage picker is a progress bar and a click asks
                    before it moves - through the same endpoint the board drag
                    uses, so the same automation fires. */}
                <RecordStageBar
                  stages={stages}
                  currentStageId={deal.stageId}
                  onChange={(stageId) => moveStage.mutate(stageId)}
                  disabled={moveStage.isPending}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate('won')}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Mark won
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate('lost')}
                  >
                    Mark lost
                  </Button>
                </div>
              </div>
            ) : null
          }
          quickActions={quickActions}
          onFieldSave={(field, value) =>
            setForecastField.mutateAsync({ [field]: value === '' ? null : value })
          }
          slots={{
            'deal-timeline': timelineSlot,
            'deal-insights': insightsSlot,
            'deal-forecast': forecastSlot,
            'deal-competitive': competitiveSlot,
            'deal-details': detailsSlot,
            'deal-copier': copierSlot,
          }}
        />
      </div>
    </MainLayout>
  );
}
