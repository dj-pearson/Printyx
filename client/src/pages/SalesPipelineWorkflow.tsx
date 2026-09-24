/**
 * Sales Pipeline board.
 *
 * COP-E02 exists to retire this page in favour of the canonical deals board,
 * and it CANNOT be retired yet - COP-B00 first.
 *
 * This board reads `business_records`, through /api/sales-pipeline. Every other
 * canonical CRM surface reads `companies`: /crm/leads calls
 * /api/business-records, whose own header describes it as "a
 * backwards-compatible wrapper that delegates to the companies table". Both
 * tables have live writers, so the split runs in both directions - an account
 * created through the CRM list lands in `companies` and never appears here,
 * and a lead created by `public-booking` (a prospect self-scheduling a meeting)
 * lands in `business_records` and never appears on the canonical Leads list.
 *
 * So deleting this page would make records invisible, which is exactly what
 * COP-E02's own AC3 forbids. server/tests/unit/crm-table-split.test.ts locks
 * the finding and is designed to FAIL the day the two tables are reconciled,
 * which is the day this page can go.
 *
 * COP-E02 already fixed the defect that mattered while it stays: the stage
 * vocabulary. `/api/sales-pipeline/stages` is the one source, the write path
 * validates against it, and "move to next stage" no longer advances every
 * record to index 0 by comparing two different stage models.
 */
import { percentOfOr } from '@/lib/utils';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, extractRecords } from '@/lib/queryClient';
import MainLayout from '@/components/layout/main-layout';
import { exportToCSV, type ExportColumn } from '@/lib/export-utils';
import TeamStatsWidget from '@/components/stats/TeamStatsWidget';
import {
  Phone,
  Mail,
  DollarSign,
  ArrowRight,
  Target,
  CheckCircle,
  Clock,
  Download,
  Award,
  Briefcase,
  MousePointer,
} from 'lucide-react';

import { clickableProps } from '@/lib/accessibility';
import { Input } from '@/components/ui/input';
import { describeApiError } from '@/lib/api-error';
import { coachingReasons, formatGrowth, oneOnOneBody } from '@/lib/rep-coaching';

// Dynamic Pipeline Stage Interface
/**
 * COP-E02. This is the LEAD-STATUS vocabulary served by
 * GET /api/sales-pipeline/stages, NOT a `pipeline_stages` row. `id` is the
 * value stored in business_records.status; the deals board's stage ids are
 * gen_random_uuid() varchars and belong to a different object model.
 */
interface PipelineStage {
  id: string;
  name: string;
  order: number;
}

// Sales Rep Performance Metrics
interface SalesRepMetrics {
  rep_id: string;
  rep_name: string;
  manager_id: string;
  total_leads: number;
  qualified_leads: number;
  demos_scheduled: number;
  demos_completed: number;
  proposals_sent: number;
  deals_closed: number;
  total_revenue: number;
  conversion_rate: number;
  avg_deal_size: number;
  /** Null when the rep has closed nothing: there is no cycle to average. */
  avg_sales_cycle: number | null;
  /** Always null (round 226): no table holds a per-rep revenue target. */
  goal_achievement: number | null;
  activity_score: number;
  last_activity: string;
}

// Pipeline Opportunity
interface PipelineOpportunity {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  stage: string;
  /** Null when the record carries none - the endpoint no longer invents one. */
  estimated_value: number | null;
  probability: number | null;
  expected_close_date: string | null;
  assigned_rep: string;
  last_activity: string | null;
  next_action: string;
  days_in_stage: number;
  created_at: string;
  notes: string;
  lead_source: string | null;
}

const OPPORTUNITY_EXPORT_COLUMNS: ExportColumn<PipelineOpportunity>[] = [
  { key: 'company_name', label: 'Company' },
  { key: 'contact_name', label: 'Contact' },
  { key: 'contact_email', label: 'Email' },
  { key: 'contact_phone', label: 'Phone' },
  { key: 'stage', label: 'Stage' },
  { key: 'estimated_value', label: 'Estimated Value' },
  { key: 'probability', label: 'Probability %' },
  { key: 'expected_close_date', label: 'Expected Close' },
  { key: 'days_in_stage', label: 'Days Since Last Update' },
  { key: 'lead_source', label: 'Source' },
  { key: 'created_at', label: 'Created' },
];

interface PipelineSummary {
  totalValue?: number;
  growthRate?: number | null;
  activeOpportunities?: number;
  qualifiedOpportunities?: number;
  conversionRate?: number;
  avgSalesCycle?: number | null;
  monthlyRevenue?: number;
  goalAchievement?: number | null;
}

/**
 * Round 226: "Schedule 1:1" had no handler. It now puts the meeting on the
 * manager's own calendar through POST /api/meetings/calendar/events, which
 * writes the caller as the owner and records the rep in related_entity_*.
 */
function OneOnOneDialog({ rep, onClose }: { rep: SalesRepMetrics | null; onClose: () => void }) {
  const { toast } = useToast();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [minutes, setMinutes] = useState('30');
  const body = rep ? oneOnOneBody(rep, date, time, Number(minutes)) : null;

  const create = useMutation({
    mutationFn: () => apiRequest('/api/meetings/calendar/events', 'POST', body),
    onSuccess: () => {
      toast({ title: '1:1 scheduled', description: body?.title });
      setDate('');
      onClose();
    },
    onError: (err) =>
      toast({
        title: 'Could not schedule the 1:1',
        description: describeApiError(err).message,
        variant: 'destructive',
      }),
  });

  return (
    <Dialog open={rep !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule a 1:1</DialogTitle>
          <DialogDescription>With {rep?.rep_name}, on your calendar.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <label className="block space-y-1 text-sm col-span-3 sm:col-span-1">
            <span className="font-medium">Date</span>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Time</span>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Minutes</span>
            <Input
              type="number"
              min={5}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!body || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Scheduling...' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SalesPipelineWorkflow() {
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [oneOnOneRep, setOneOnOneRep] = useState<SalesRepMetrics | null>(null);
  const [viewMode, setViewMode] = useState<'pipeline' | 'metrics' | 'team'>('pipeline');
  const [selectedOpportunity, setSelectedOpportunity] = useState<PipelineOpportunity | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<string>('');
  const [actionNotes, setActionNotes] = useState<string>('');

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // The stage vocabulary this board's records actually use.
  //
  // This used to fetch /api/pipeline-config/templates - the DEALS pipeline -
  // while every record on the board is a business_records row whose "stage" is
  // its lifecycle status. The two never lined up: the column filter compared a
  // template stage NAME to a status, and the advance button compared a stage
  // UUID to a status, so findIndex returned -1 and every click resolved to
  // index 0 and PATCHed that UUID into business_records.status. The server now
  // rejects a stage outside this list; this query is the same list.
  const { data: pipelineStages = [], isLoading: pipelineLoading } = useQuery<PipelineStage[]>({
    queryKey: ['/api/sales-pipeline/stages'],
    queryFn: async () => {
      const raw = await apiRequest('/api/sales-pipeline/stages');
      return extractRecords(raw) as PipelineStage[];
    },
  });

  // Fetch pipeline opportunities
  const { data: opportunities = [], isLoading: opportunitiesLoading } = useQuery<
    PipelineOpportunity[]
  >({
    queryKey: ['/api/sales-pipeline/opportunities', selectedStage, selectedRep],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStage !== 'all') params.append('stage', selectedStage);
      if (selectedRep !== 'all') params.append('rep', selectedRep);
      const response = await apiRequest(`/api/sales-pipeline/opportunities?${params.toString()}`);
      return extractRecords(response);
    },
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
  });

  // Fetch sales rep metrics
  const { data: repMetrics = [], isLoading: metricsLoading } = useQuery<SalesRepMetrics[]>({
    queryKey: ['/api/sales-pipeline/rep-metrics'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch pipeline summary
  const { data: pipelineSummary } = useQuery<PipelineSummary>({
    queryKey: ['/api/sales-pipeline/summary'],
    refetchInterval: 30000,
  });

  // Move opportunity to next stage
  const moveToNextStageMutation = useMutation({
    mutationFn: async ({
      opportunityId,
      targetStage,
      notes,
    }: {
      opportunityId: string;
      targetStage: string;
      notes?: string;
    }) => {
      return apiRequest(`/api/sales-pipeline/opportunities/${opportunityId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: targetStage, notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-pipeline/opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-pipeline/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-pipeline/rep-metrics'] });
      toast({
        title: 'Stage Updated',
        description: 'Opportunity moved to next stage successfully',
      });
      setIsActionDialogOpen(false);
      setSelectedOpportunity(null);
    },
  });

  // Log activity for opportunity
  const logActivityMutation = useMutation({
    mutationFn: async ({
      opportunityId,
      activityType,
      notes,
    }: {
      opportunityId: string;
      activityType: string;
      notes: string;
    }) => {
      return apiRequest(`/api/sales-pipeline/opportunities/${opportunityId}/activity`, {
        method: 'POST',
        body: JSON.stringify({ activity_type: activityType, notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-pipeline/opportunities'] });
      toast({
        title: 'Activity Logged',
        description: 'Activity has been recorded successfully',
      });
      setIsActionDialogOpen(false);
      setActionNotes('');
    },
  });

  const handleStageAction = (opportunity: PipelineOpportunity, action: string) => {
    setSelectedOpportunity(opportunity);
    setActionType(action);
    setIsActionDialogOpen(true);
  };

  const executeAction = () => {
    if (!selectedOpportunity) return;

    if (actionType === 'move_stage') {
      const currentStageIndex = pipelineStages.findIndex((s) => s.id === selectedOpportunity.stage);
      // -1 means the record carries a status outside the vocabulary - including
      // a UUID written by the bug this replaced. Advancing from there would
      // silently move it to the first stage, so it is refused instead.
      const nextStage = currentStageIndex >= 0 ? pipelineStages[currentStageIndex + 1] : undefined;

      if (nextStage) {
        moveToNextStageMutation.mutate({
          opportunityId: selectedOpportunity.id,
          targetStage: nextStage.id,
          notes: actionNotes,
        });
      }
    } else {
      logActivityMutation.mutate({
        opportunityId: selectedOpportunity.id,
        activityType: actionType,
        notes: actionNotes,
      });
    }
  };

  const calculateConversionRate = (metrics: SalesRepMetrics) => {
    return percentOfOr(metrics.deals_closed, metrics.total_leads);
  };

  if (pipelineLoading || opportunitiesLoading || metricsLoading) {
    return (
      <MainLayout
        title="Sales Pipeline Workflow"
        description="Assembly line sales process from lead to customer"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading sales pipeline...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Sales Pipeline Workflow"
      description="Assembly line sales process from lead to customer"
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <h2 className="text-2xl font-bold">Sales Pipeline Workflow</h2>
          <div className="hidden sm:flex items-center gap-3">
            <Select
              value={viewMode}
              onValueChange={(value: 'pipeline' | 'metrics' | 'team') => setViewMode(value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pipeline">Pipeline View</SelectItem>
                <SelectItem value="metrics">Rep Metrics</SelectItem>
                <SelectItem value="team">Team Overview</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={opportunities.length === 0}
              onClick={() =>
                exportToCSV(opportunities, OPPORTUNITY_EXPORT_COLUMNS, {
                  filename: 'sales-pipeline',
                })
              }
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Pipeline Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${pipelineSummary?.totalValue?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-muted-foreground">Open deal value</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Opps</CardTitle>
              <Briefcase className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pipelineSummary?.activeOpportunities || 0}</div>
              <p className="text-xs text-muted-foreground">
                {pipelineSummary?.qualifiedOpportunities || 0} qualified
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pipelineSummary?.conversionRate?.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                {pipelineSummary?.avgSalesCycle == null
                  ? 'No closed deals to time'
                  : `${pipelineSummary.avgSalesCycle} day cycle`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Month Closed</CardTitle>
              <Award className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${pipelineSummary?.monthlyRevenue?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatGrowth(pipelineSummary?.growthRate) == null
                  ? 'Nothing closed last month to compare'
                  : `${formatGrowth(pipelineSummary?.growthRate)} vs last month`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs
          value={viewMode}
          onValueChange={(value: string) => setViewMode(value as 'pipeline' | 'metrics' | 'team')}
        >
          <TabsList>
            <TabsTrigger value="pipeline">
              <span className="hidden sm:inline">Pipeline Flow</span>
              <span className="sm:hidden">Pipeline</span>
            </TabsTrigger>
            <TabsTrigger value="metrics">
              <span className="hidden sm:inline">Sales Rep Performance</span>
              <span className="sm:hidden">Reps</span>
            </TabsTrigger>
            <TabsTrigger value="team">
              <span className="hidden sm:inline">Team Management</span>
              <span className="sm:hidden">Team</span>
            </TabsTrigger>
          </TabsList>

          {/* Pipeline Flow View */}
          <TabsContent value="pipeline" className="space-y-6">
            {/* Team Quick Stats - Compact View */}
            <TeamStatsWidget variant="compact" showAutoRefresh={false} />

            {/* Filters */}
            <div className="flex items-center gap-4">
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {pipelineStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedRep} onValueChange={setSelectedRep}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by rep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reps</SelectItem>
                  {repMetrics.map((rep) => (
                    <SelectItem key={rep.rep_id} value={rep.rep_id}>
                      {rep.rep_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* COP-E02: a record whose status is not in the vocabulary belongs to
                no column, so without this it would simply vanish from the board.
                The bug this replaced wrote pipeline_stages UUIDs into
                business_records.status, so these are the rows it damaged. */}
            {(() => {
              const known = new Set(pipelineStages.map((st) => st.id));
              const stranded = opportunities.filter((opp) => !known.has(opp.stage));
              if (stranded.length === 0) return null;
              return (
                <div className="rounded-lg border border-dashed p-4">
                  <p className="text-sm font-medium">
                    {stranded.length} record{stranded.length === 1 ? '' : 's'} sit in no column
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Their status is not one this board recognises. Set each back to a real stage
                    from the record itself; the board cannot infer which one was intended.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm">
                    {stranded.map((opp) => (
                      <li key={opp.id} className="flex justify-between gap-4">
                        <span>{opp.company_name}</span>
                        <code className="text-xs text-muted-foreground">{opp.stage}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {/* Pipeline Stages Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {pipelineStages
                .sort((a, b) => a.order - b.order)
                .map((stage) => {
                  // Match on the status VALUE. This compared against
                  // stage.name before, which is a display label on the deals
                  // template and has no reason to equal a lifecycle status.
                  const stageOpportunities = opportunities.filter((opp) => opp.stage === stage.id);
                  const stageValue = stageOpportunities.reduce(
                    (sum, opp) => sum + (opp.estimated_value || 0),
                    0,
                  );

                  return (
                    <Card key={stage.id} className="h-fit">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                              <Target className="h-4 w-4" />
                            </div>
                            <div>
                              <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
                              <CardDescription className="text-xs">
                                {stageOpportunities.length} opportunities
                              </CardDescription>
                            </div>
                          </div>
                        </div>
                        <div className="text-lg font-bold tabular-nums">
                          ${stageValue.toLocaleString()}
                        </div>
                      </CardHeader>

                      <CardContent className="pt-0 space-y-3">
                        {stageOpportunities.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <MousePointer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No opportunities</p>
                          </div>
                        ) : (
                          stageOpportunities.map((opportunity) => (
                            <div
                              key={opportunity.id}
                              className="border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                              {...clickableProps(() => setSelectedOpportunity(opportunity))}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-medium text-sm">
                                    {opportunity.company_name}
                                  </h4>
                                  <p className="text-xs text-gray-600">
                                    {opportunity.contact_name}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {opportunity.probability !== null
                                    ? `${opportunity.probability}%`
                                    : '—'}
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>
                                  {opportunity.estimated_value !== null
                                    ? `$${opportunity.estimated_value.toLocaleString()}`
                                    : 'No value'}
                                </span>
                                <span>{opportunity.days_in_stage}d in stage</span>
                              </div>

                              <div className="mt-2 flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStageAction(opportunity, 'move_stage');
                                  }}
                                >
                                  <ArrowRight className="h-3 w-3 mr-1" />
                                  Next Stage
                                </Button>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStageAction(opportunity, 'call');
                                  }}
                                >
                                  <Phone className="h-3 w-3" />
                                </Button>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStageAction(opportunity, 'email');
                                  }}
                                >
                                  <Mail className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </TabsContent>

          {/* Sales Rep Performance View */}
          <TabsContent value="metrics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {repMetrics.map((rep) => {
                const conversionRate = calculateConversionRate(rep);

                return (
                  <Card key={rep.rep_id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{rep.rep_name}</CardTitle>
                          <CardDescription>
                            No revenue goal is recorded for this rep
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">Total Leads</div>
                          <div className="font-bold">{rep.total_leads}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Deals Closed</div>
                          <div className="font-bold">{rep.deals_closed}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Revenue</div>
                          <div className="font-bold">${rep.total_revenue.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Avg Deal Size</div>
                          <div className="font-bold">${rep.avg_deal_size.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Conversion Funnel */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Conversion Rate</span>
                          <span className="font-medium">{conversionRate.toFixed(1)}%</span>
                        </div>
                        <Progress value={conversionRate} className="h-2" />
                      </div>

                      {/* Activity Score */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Activity Score</span>
                          <span className="font-medium">{rep.activity_score}/100</span>
                        </div>
                        <Progress value={rep.activity_score} className="h-2" />
                      </div>

                      {/* Sales Cycle */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Avg Sales Cycle</span>
                        <span className="font-medium">
                          {rep.avg_sales_cycle == null
                            ? 'Nothing closed yet'
                            : `${rep.avg_sales_cycle} days`}
                        </span>
                      </div>

                      {/* Last Activity */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Last Activity</span>
                        <span className="font-medium">{rep.last_activity}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Team Management View */}
          <TabsContent value="team" className="space-y-6">
            {/* Team Stats Widget - Comprehensive Overview */}
            <TeamStatsWidget variant="full" showAutoRefresh={true} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Team Performance Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Team Performance Overview</CardTitle>
                  <CardDescription>Manager insights and team health metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Team Summary */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Total Team Revenue</div>
                        <div className="text-2xl font-bold text-green-600">
                          $
                          {repMetrics
                            .reduce((sum, rep) => sum + rep.total_revenue, 0)
                            .toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">Deals closed</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {repMetrics.reduce((sum, rep) => sum + rep.deals_closed, 0)}
                        </div>
                      </div>
                    </div>

                    {/* Round 226: a four-bucket "performance distribution"
                        ranked reps against a hardcoded $50,000 goal. No goal
                        table exists, so the ranking is gone and says why. */}
                    <p className="text-sm text-muted-foreground">
                      Goal achievement is not shown: no revenue goals are recorded for reps.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Action Items for Managers */}
              <Card>
                <CardHeader>
                  <CardTitle>Manager Action Items</CardTitle>
                  <CardDescription>Opportunities for coaching and support</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {repMetrics
                      .map((rep) => ({ rep, reasons: coachingReasons(rep) }))
                      .filter(({ reasons }) => reasons.length > 0)
                      .map(({ rep, reasons }) => (
                        <div key={rep.rep_id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">{rep.rep_name}</div>
                            <Badge variant="destructive" className="text-xs">
                              Needs Attention
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm">
                            {reasons.map((r) =>
                              r.kind === 'activity' ? (
                                <div
                                  key="activity"
                                  className="flex items-center gap-2 text-orange-600"
                                >
                                  <Clock className="h-4 w-4" />
                                  <span>Low activity score ({r.score}/100)</span>
                                </div>
                              ) : (
                                <div
                                  key="conversion"
                                  className="flex items-center gap-2 text-yellow-600"
                                >
                                  <Target className="h-4 w-4" />
                                  <span>Low conversion rate ({r.pct.toFixed(1)}%)</span>
                                </div>
                              ),
                            )}
                          </div>

                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => setOneOnOneRep(rep)}
                            >
                              Schedule 1:1
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => {
                                setSelectedRep(rep.rep_id);
                                setViewMode('pipeline');
                              }}
                            >
                              Review Pipeline
                            </Button>
                          </div>
                        </div>
                      ))}

                    {repMetrics.every((rep) => coachingReasons(rep).length === 0) && (
                      <div className="text-center py-8 text-gray-500">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p className="text-sm">Nobody is flagged for low activity or conversion.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <OneOnOneDialog rep={oneOnOneRep} onClose={() => setOneOnOneRep(null)} />

        {/* Action Dialog */}
        <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'move_stage'
                  ? 'Move to Next Stage'
                  : `Log ${actionType.charAt(0).toUpperCase() + actionType.slice(1)}`}
              </DialogTitle>
              <DialogDescription>
                {selectedOpportunity && `For ${selectedOpportunity.company_name}`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <label>
                <span className="text-sm font-medium">Notes</span>
                <Textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder={`Add notes about this ${actionType}...`}
                  rows={3}
                />
              </label>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={executeAction}
                  disabled={moveToNextStageMutation.isPending || logActivityMutation.isPending}
                >
                  {moveToNextStageMutation.isPending || logActivityMutation.isPending
                    ? 'Processing...'
                    : 'Confirm'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
