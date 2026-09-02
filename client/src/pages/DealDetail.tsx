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
import { useLocation, useRoute } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
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
import { DealEquipmentPanel } from '@/components/crm/DealEquipmentPanel';
import {
  ArrowLeft,
  Building2,
  DollarSign,
  User,
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
  ListChecks,
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

  const closeDate = deal.expectedCloseDate ? format(new Date(deal.expectedCloseDate), 'PP') : null;
  const nextStep = deal.nextFollowUpDate ? format(new Date(deal.nextFollowUpDate), 'PP') : null;
  const isOpen = !deal.status || deal.status === 'open';

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/crm/deals')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to deals
        </Button>

        {/* ─── Header: identity, money, stage, close actions ─────────── */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold leading-tight break-words">{deal.title}</h1>
                {deal.companyName && (
                  <p className="text-sm text-muted-foreground mt-0.5">{deal.companyName}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(deal.status)}>{deal.status || 'open'}</Badge>
                {deal.stageName && (
                  <Badge
                    variant="outline"
                    style={deal.stageColor ? { borderColor: deal.stageColor } : undefined}
                  >
                    {deal.stageName}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field icon={DollarSign} label="Amount" value={money(deal.amount)} />
              <Field
                icon={DollarSign}
                label="Monthly value"
                value={money(deal.estimatedMonthlyValue)}
              />
              <Field icon={Calendar} label="Expected close" value={closeDate} />
              <Field
                icon={Percent}
                label="Probability"
                value={deal.probability != null ? `${deal.probability}%` : null}
              />
              <Field icon={User} label="Owner" value={deal.ownerName} />
              <Field icon={Target} label="Next step" value={nextStep} />
              <Field icon={Target} label="Source" value={deal.source} />
              <Field icon={Target} label="Priority" value={deal.priority} />
            </div>

            {/* Stage advance + close, mirroring the board's actions. */}
            {isOpen && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">Move to stage</span>
                <Select
                  value={deal.stageId ?? undefined}
                  onValueChange={(v) => moveStage.mutate(v)}
                  disabled={moveStage.isPending || stages.length === 0}
                >
                  <SelectTrigger className="h-8 w-[200px] text-xs">
                    <SelectValue placeholder={stages.length ? 'Select stage' : 'No stages'} />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.displayName || s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1" />
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
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* ─── Main column: timeline / notes / tasks / quotes ──────── */}
          <div className="lg:col-span-2 space-y-4">
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
              </TabsList>

              <TabsContent value="activity" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {timelineLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : entries.length === 0 ? (
                      <EmptyState
                        title="No activity yet"
                        description="Calls, emails, meetings and stage changes on this deal will appear here."
                      />
                    ) : (
                      <ol className="space-y-3">
                        {entries.map((e) => (
                          <li key={e.id} className="flex gap-3 text-sm">
                            <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium break-words">
                                {e.subject || e.type || 'Activity'}
                              </p>
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
                  <CardContent>
                    {/* Tasks have no dealId column; they attach through
                        crm_associations. Wiring that UI is its own slice, so
                        say so rather than render a fake list. */}
                    <EmptyState
                      title="Task links are not wired yet"
                      description="Tasks attach to a deal through the CRM association layer. This panel lands with the task-association slice."
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="equipment" className="mt-4">
                {/* COP-M05: real now. Links live in crm_associations with an
                    explicit 'replaces' / 'places' role. */}
                <DealEquipmentPanel dealId={dealId} customerId={deal.customerId} />
              </TabsContent>
            </Tabs>
          </div>

          {/* ─── Side column: contact, details, insights slot ────────── */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Primary contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field icon={User} label="Name" value={deal.primaryContactName} />
                <Field icon={Mail} label="Email" value={deal.primaryContactEmail} />
                <Field icon={Phone} label="Phone" value={deal.primaryContactPhone} />
                {!deal.primaryContactName &&
                  !deal.primaryContactEmail &&
                  !deal.primaryContactPhone && (
                    <p className="text-sm text-muted-foreground">No contact on this deal.</p>
                  )}
                <div className="flex gap-2 pt-1">
                  {deal.primaryContactEmail && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`mailto:${deal.primaryContactEmail}`, '_self')}
                    >
                      <Mail className="h-4 w-4 mr-1" /> Email
                    </Button>
                  )}
                  {deal.primaryContactPhone && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`tel:${deal.primaryContactPhone}`, '_self')}
                    >
                      <Phone className="h-4 w-4 mr-1" /> Call
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

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
                  value={
                    deal.lastActivityDate ? format(new Date(deal.lastActivityDate), 'PP') : null
                  }
                />
                {deal.description && (
                  <div>
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="text-sm break-words">{deal.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* COP-M04: the facts that decide a copier deal. Rendered only when the
                deal actually carries one, so a generic B2B deal does not grow a card
                of empty rows. Read-only here; the editable version belongs to the
                record rebuild in COP-B02. */}
            {hasCopierProfile && (
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
                  <Field
                    icon={DollarSign}
                    label="Trade-in value"
                    value={money(deal.tradeInValue)}
                  />
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
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
