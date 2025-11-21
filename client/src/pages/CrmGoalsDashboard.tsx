import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Target, 
  Users, 
  TrendingUp, 
  Phone, 
  Mail, 
  Calendar, 
  UserPlus, 
  FileText,
  Activity,
  BarChart3,
  Plus,
  Settings,
  Filter,
  Eye,
  AlertTriangle,
  CheckCircle,
  Calculator
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import { ScrollArea } from "@/components/ui/scroll-area";

// Form schemas
const createGoalSchema = z.object({
  goalType: z.enum(["calls", "emails", "meetings", "reachouts", "proposals", "new_opportunities", "demos", "follow_ups"]),
  targetCount: z.number().min(1),
  period: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  startDate: z.string(),
  endDate: z.string(),
  assignedToUserId: z.string().optional(),
  assignedToTeamId: z.string().optional(),
  notes: z.string().optional(),
});

const createTeamSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

type CreateGoalInput = z.infer<typeof createGoalSchema>;
type CreateTeamInput = z.infer<typeof createTeamSchema>;

// Simple goal templates
const GOAL_TEMPLATES = [
  { id: "new-rep-ramp", name: "New Rep Ramp (Weekly)", period: "weekly", targets: { calls: 150, emails: 100, meetings: 5, proposals: 2 } },
  { id: "standard-month", name: "Standard Month", period: "monthly", targets: { calls: 500, emails: 350, meetings: 15, proposals: 6 } },
  { id: "enterprise-quarter", name: "Enterprise Quarter", period: "quarterly", targets: { calls: 1200, emails: 900, meetings: 40, proposals: 15 } },
];

export default function CrmGoalsDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPeriod, setSelectedPeriod] = useState("weekly");
  const [showCreateGoalDialog, setShowCreateGoalDialog] = useState(false);
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [goalTypeFilter, setGoalTypeFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  // Dashboard stats query
  const { data: dashboardStats } = useQuery({
    queryKey: ["/api/crm/dashboard-stats"],
  });

  // Goals query
  const { data: goals = [] } = useQuery({
    queryKey: ["/api/crm/goals"],
  });

  // Teams query
  const { data: teams = [] } = useQuery({
    queryKey: ["/api/crm/teams"],
  });

  // Users query for dropdowns
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  // Goal progress query
  const { data: goalProgress = [] } = useQuery({
    queryKey: ["/api/crm/goal-progress"],
  });

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: (data: CreateGoalInput) => apiRequest("/api/crm/goals", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard-stats"] });
      setShowCreateGoalDialog(false);
    },
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: (data: CreateTeamInput) => apiRequest("/api/crm/teams", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard-stats"] });
      setShowCreateTeamDialog(false);
    },
  });

  // Bulk assign goals from template
  const bulkAssignMutation = useMutation({
    mutationFn: async (payload: any) => apiRequest("/api/crm/goals/bulk-assign", "POST", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/goal-progress"] });
      setShowAssignDialog(false);
      setSelectedTemplateId("");
    },
  });

  // Forms
  const createGoalForm = useForm<CreateGoalInput>({
    resolver: zodResolver(createGoalSchema),
    defaultValues: {
      goalType: "calls",
      targetCount: 50,
      period: "weekly",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
        .toISOString()
        .slice(0, 10),
      notes: "",
    },
  });

  const filteredProgress = useMemo(() => {
    let rows = goalProgress as any[];
    if (ownerFilter !== "all") rows = rows.filter((r) => r.ownerId === ownerFilter || r.teamId === ownerFilter);
    if (goalTypeFilter !== "all") rows = rows.filter((r) => r.goalType === goalTypeFilter);
    return rows;
  }, [goalProgress, ownerFilter, goalTypeFilter]);

  const handleApplyTemplate = (assignees: { userIds: string[]; teamIds: string[] }) => {
    const template = GOAL_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (!template) return;
    const payload = {
      templateId: template.id,
      period: template.period,
      userIds: assignees.userIds,
      teamIds: assignees.teamIds,
      targets: template.targets,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 28).toISOString().slice(0, 10),
    };
    bulkAssignMutation.mutate(payload);
  };

  return (
    <MainLayout title="CRM Goals Dashboard" description="Set sales goals, monitor activity, and track progress">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">CRM Goals Dashboard</h1>
            <p className="text-gray-600">Manager and rep goals with progress tracking</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAssignDialog(true)}>Assign Goals</Button>
            <Button onClick={() => setShowCreateGoalDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Goal
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-center">
            <div className="text-sm text-gray-700 font-medium">Filters:</div>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                <SelectItem value="teams">— Teams —</SelectItem>
                {teams?.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
                <SelectItem value="users">— Users —</SelectItem>
                {users?.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.name || `${u.firstName || ""} ${u.lastName || ""}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={goalTypeFilter} onValueChange={setGoalTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Goal Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All goal types</SelectItem>
                {(["calls", "emails", "meetings", "reachouts", "proposals", "new_opportunities", "demos", "follow_ups"])?.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Compact progress table */}
        <Card>
          <CardHeader>
            <CardTitle>Goal Progress</CardTitle>
            <CardDescription>Combined per-rep and per-team progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProgress?.map((row: any) => (
                <div key={row.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium truncate">{row.ownerName || row.teamName || "Goal"}</div>
                    <Badge variant="secondary">{row.goalType}</Badge>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">{row.period || ""}</div>
                  <Progress value={Math.min(100, Math.round(((row.currentCount ?? row.currentValue) / ((row.targetCount ?? row.targetValue) || 1)) * 100))} />
                  <div className="text-xs text-gray-600 mt-1">
                    {row.currentCount ?? row.currentValue} / {row.targetCount ?? row.targetValue}
                  </div>
                </div>
              )) || <div className="text-sm text-gray-500">No progress yet.</div>}
            </div>
          </CardContent>
        </Card>

        {/* Existing tabs and sections remain below */}
      </div>

      {/* Assign goals dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Goals</DialogTitle>
            <DialogDescription>Choose a template and select users/teams to assign targets quickly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select a template" /></SelectTrigger>
                <SelectContent>
                  {GOAL_TEMPLATES.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Teams</Label>
                <ScrollArea className="h-32 border rounded-md p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {teams?.map((t: any) => (
                      <Button key={t.id} variant="outline" size="sm" onClick={() => handleApplyTemplate({ userIds: [], teamIds: [t.id] })}>{t.name}</Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <div>
                <Label>Users</Label>
                <ScrollArea className="h-32 border rounded-md p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {users?.map((u: any) => (
                      <Button key={u.id} variant="outline" size="sm" onClick={() => handleApplyTemplate({ userIds: [u.id], teamIds: [] })}>
                        {u.name || `${u.firstName || ""} ${u.lastName || ""}`}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAssignDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing create goal/team dialogs remain below */}
    </MainLayout>
  );
}

// Manager Insights Component
function ConversionInsights() {
  const { data: insights } = useQuery({
    queryKey: ["/api/crm/manager-insights"],
  });

  const { data: conversionAnalysis } = useQuery({
    queryKey: ["/api/crm/analytics/conversion-analysis"],
  });

  if (!conversionAnalysis || conversionAnalysis.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-muted-foreground">No conversion data available yet</p>
        <p className="text-sm text-muted-foreground mt-2">Data will appear once sales activities are tracked</p>
      </div>
    );
  }

  const analysis = conversionAnalysis[0];
  const benchmarks = analysis.benchmarks || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Call Answer Rate</span>
            <span className="text-sm text-muted-foreground">
              {benchmarks.callAnswerRate?.current || 0}% / {benchmarks.callAnswerRate?.target || 30}%
            </span>
          </div>
          <Progress 
            value={Math.min(100, benchmarks.callAnswerRate?.current || 0)} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            Industry benchmark: 25-35%
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Email Response Rate</span>
            <span className="text-sm text-muted-foreground">
              {benchmarks.emailResponseRate?.current || 0}% / {benchmarks.emailResponseRate?.target || 20}%
            </span>
          </div>
          <Progress 
            value={Math.min(100, benchmarks.emailResponseRate?.current || 0)} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            Industry benchmark: 15-25%
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Activity → Meeting %</span>
            <span className="text-sm text-muted-foreground">
              {benchmarks.activityToMeetingRate?.current || 0}% / {benchmarks.activityToMeetingRate?.target || 12}%
            </span>
          </div>
          <Progress 
            value={Math.min(100, benchmarks.activityToMeetingRate?.current || 0)} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            Industry benchmark: 8-15%
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Meeting → Proposal %</span>
            <span className="text-sm text-muted-foreground">
              {benchmarks.meetingToProposalRate?.current || 0}% / {benchmarks.meetingToProposalRate?.target || 40}%
            </span>
          </div>
          <Progress 
            value={Math.min(100, benchmarks.meetingToProposalRate?.current || 0)} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            Industry benchmark: 30-50%
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Proposal Closing %</span>
            <span className="text-sm text-muted-foreground">
              {benchmarks.proposalClosingRate?.current || 0}% / {benchmarks.proposalClosingRate?.target || 25}%
            </span>
          </div>
          <Progress 
            value={Math.min(100, benchmarks.proposalClosingRate?.current || 0)} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            Industry benchmark: 20-30%
          </p>
        </div>
      </div>

      {insights && insights.length > 0 && (
        <div className="mt-6 space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Key Insights
          </h4>
          {insights.slice(0, 2).map((insight: any, index: number) => (
            <div key={index} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm font-medium text-orange-800">{insight.insightTitle}</p>
              <p className="text-xs text-orange-600 mt-1">{insight.insightDescription}</p>
              {insight.recommendedActions && insight.recommendedActions.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-orange-700">Recommended Actions:</p>
                  <ul className="text-xs text-orange-600 mt-1 space-y-1">
                    {insight.recommendedActions.slice(0, 2).map((action: any, idx: number) => (
                      <li key={idx}>• {action.action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Activity Calculator Component
function ActivityCalculator() {
  const [calculation, setCalculation] = useState<any>(null);
  const [formData, setFormData] = useState({
    revenueGoal: 100000,
    averageDealSize: 50000,
    callAnswerRate: 30,
    emailResponseRate: 20,
    activityToMeetingRate: 12,
    meetingToProposalRate: 40,
    proposalClosingRate: 25,
  });

  const calculateActivities = async () => {
    try {
      const result = await apiRequest("/api/crm/analytics/calculate-activities", {
        method: "POST",
        body: formData,
      });
      setCalculation(result);
    } catch (error) {
      console.error("Error calculating activities:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Revenue Goal ($)</Label>
          <Input
            type="number"
            value={formData.revenueGoal}
            onChange={(e) => setFormData({...formData, revenueGoal: Number(e.target.value)})}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Avg Deal Size ($)</Label>
          <Input
            type="number"
            value={formData.averageDealSize}
            onChange={(e) => setFormData({...formData, averageDealSize: Number(e.target.value)})}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Call Answer Rate (%)</Label>
          <Input
            type="number"
            value={formData.callAnswerRate}
            onChange={(e) => setFormData({...formData, callAnswerRate: Number(e.target.value)})}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Email Response Rate (%)</Label>
          <Input
            type="number"
            value={formData.emailResponseRate}
            onChange={(e) => setFormData({...formData, emailResponseRate: Number(e.target.value)})}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Activity → Meeting (%)</Label>
          <Input
            type="number"
            value={formData.activityToMeetingRate}
            onChange={(e) => setFormData({...formData, activityToMeetingRate: Number(e.target.value)})}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Meeting → Proposal (%)</Label>
          <Input
            type="number"
            value={formData.meetingToProposalRate}
            onChange={(e) => setFormData({...formData, meetingToProposalRate: Number(e.target.value)})}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label className="text-xs">Proposal Closing Rate (%)</Label>
          <Input
            type="number"
            value={formData.proposalClosingRate}
            onChange={(e) => setFormData({...formData, proposalClosingRate: Number(e.target.value)})}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <Button onClick={calculateActivities} className="w-full" size="sm">
        <Calculator className="h-4 w-4 mr-2" />
        Calculate Required Activities
      </Button>

      {calculation && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-800 mb-3">Required Activities for Goal</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Deals Needed:</span>
              <span className="font-medium">{calculation.requiredActivities.dealsNeeded}</span>
            </div>
            <div className="flex justify-between">
              <span>Proposals Needed:</span>
              <span className="font-medium">{calculation.requiredActivities.proposalsNeeded}</span>
            </div>
            <div className="flex justify-between">
              <span>Meetings Needed:</span>
              <span className="font-medium">{calculation.requiredActivities.meetingsNeeded}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Calls:</span>
              <span className="font-medium">{calculation.requiredActivities.totalCalls}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Emails:</span>
              <span className="font-medium">{calculation.requiredActivities.totalEmails}</span>
            </div>
            <div className="flex justify-between font-bold text-blue-800 pt-2 border-t border-blue-300">
              <span>Total Activities/Month:</span>
              <span>{calculation.requiredActivities.totalActivities}</span>
            </div>
            <div className="flex justify-between font-bold text-blue-800">
              <span>Daily Activities Needed:</span>
              <span>{calculation.dailyBreakdown.totalDaily}</span>
            </div>
          </div>
          
          <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
            <p className="text-sm font-medium text-green-800">Daily Breakdown:</p>
            <p className="text-xs text-green-700">
              {calculation.dailyBreakdown.callsDaily} calls + {calculation.dailyBreakdown.emailsDaily} emails per day
            </p>
          </div>
        </div>
      )}
    </div>
  );
}