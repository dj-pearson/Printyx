import { useState, useEffect } from "react";
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
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

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
  managerId: z.string(),
  territory: z.string().optional(),
  parentTeamId: z.string().optional(),
});

type CreateGoalInput = z.infer<typeof createGoalSchema>;
type CreateTeamInput = z.infer<typeof createTeamSchema>;

export default function CrmGoalsDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPeriod, setSelectedPeriod] = useState("weekly");
  const [showCreateGoalDialog, setShowCreateGoalDialog] = useState(false);
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false);
  const queryClient = useQueryClient();

  // Dashboard stats query
  const { data: dashboardStats } = useQuery({
    queryKey: ["/api/crm/dashboard-stats"],
  });

  // Goals query
  const { data: goals } = useQuery({
    queryKey: ["/api/crm/goals"],
  });

  // Teams query
  const { data: teams } = useQuery({
    queryKey: ["/api/crm/teams"],
  });

  // Activity reports query
  const { data: activityReports } = useQuery({
    queryKey: ["/api/crm/activity-reports", { period: selectedPeriod }],
  });

  // Goal progress query
  const { data: goalProgress } = useQuery({
    queryKey: ["/api/crm/goal-progress"],
  });

  // Users query for dropdowns
  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: (data: CreateGoalInput) => apiRequest("/api/crm/goals", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard-stats"] });
      setShowCreateGoalDialog(false);
    },
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: (data: CreateTeamInput) => apiRequest("/api/crm/teams", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard-stats"] });
      setShowCreateTeamDialog(false);
    },
  });

  // Forms
  const createGoalForm = useForm<CreateGoalInput>({
    resolver: zodResolver(createGoalSchema),
    defaultValues: {
      period: "weekly",
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    },
  });

  const createTeamForm = useForm<CreateTeamInput>({
    resolver: zodResolver(createTeamSchema),
  });

  const handleCreateGoal = (data: CreateGoalInput) => {
    createGoalMutation.mutate({
      ...data,
      targetCount: Number(data.targetCount),
    });
  };

  const handleCreateTeam = (data: CreateTeamInput) => {
    createTeamMutation.mutate(data);
  };

  // Activity type icons
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "calls": return <Phone className="h-4 w-4" />;
      case "emails": return <Mail className="h-4 w-4" />;
      case "meetings": return <Calendar className="h-4 w-4" />;
      case "reachouts": return <Activity className="h-4 w-4" />;
      case "proposals": return <FileText className="h-4 w-4" />;
      case "new_opportunities": return <UserPlus className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case "calls": return "Calls";
      case "emails": return "Emails";
      case "meetings": return "Meetings";
      case "reachouts": return "Reachouts";
      case "proposals": return "Proposals";
      case "new_opportunities": return "New Opportunities";
      case "demos": return "Demos";
      case "follow_ups": return "Follow-ups";
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM Goals & Reporting</h1>
          <p className="text-muted-foreground">
            Manage sales goals, track activity, and analyze performance across teams and reps
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showCreateTeamDialog} onOpenChange={setShowCreateTeamDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Sales Team</DialogTitle>
                <DialogDescription>
                  Set up a new sales team with hierarchy and territory assignments
                </DialogDescription>
              </DialogHeader>
              <Form {...createTeamForm}>
                <form onSubmit={createTeamForm.handleSubmit(handleCreateTeam)} className="space-y-4">
                  <FormField
                    control={createTeamForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Enterprise Sales Team" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createTeamForm.control}
                    name="managerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team Manager</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select manager" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users?.map((user: any) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createTeamForm.control}
                    name="territory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Territory</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Northeast Region" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createTeamForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Team description..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createTeamMutation.isPending}>
                      {createTeamMutation.isPending ? "Creating..." : "Create Team"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={showCreateGoalDialog} onOpenChange={setShowCreateGoalDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Set Goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Sales Goal</DialogTitle>
                <DialogDescription>
                  Set activity targets for individual reps or teams
                </DialogDescription>
              </DialogHeader>
              <Form {...createGoalForm}>
                <form onSubmit={createGoalForm.handleSubmit(handleCreateGoal)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createGoalForm.control}
                      name="goalType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Activity Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select activity" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="calls">Calls</SelectItem>
                              <SelectItem value="emails">Emails</SelectItem>
                              <SelectItem value="meetings">Meetings</SelectItem>
                              <SelectItem value="reachouts">Reachouts (Calls + Emails)</SelectItem>
                              <SelectItem value="proposals">Proposals</SelectItem>
                              <SelectItem value="new_opportunities">New Opportunities</SelectItem>
                              <SelectItem value="demos">Demos</SelectItem>
                              <SelectItem value="follow_ups">Follow-ups</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createGoalForm.control}
                      name="period"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Period</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select period" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={createGoalForm.control}
                    name="targetCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Count</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="e.g., 50" 
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createGoalForm.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createGoalForm.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={createGoalForm.control}
                    name="assignedToUserId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned to User (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select user or leave empty for team goal" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users?.map((user: any) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createGoalForm.control}
                    name="assignedToTeamId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned to Team (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select team or leave empty for individual goal" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {teams?.map((team: any) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createGoalForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional goal details..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createGoalMutation.isPending}>
                      {createGoalMutation.isPending ? "Creating..." : "Create Goal"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dashboard Stats Cards */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Target className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{dashboardStats.activeGoals}</p>
                  <p className="text-sm text-muted-foreground">Active Goals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Users className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{dashboardStats.activeTeams}</p>
                  <p className="text-sm text-muted-foreground">Active Teams</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <UserPlus className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{dashboardStats.teamMembers}</p>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">{dashboardStats.recentReports}</p>
                  <p className="text-sm text-muted-foreground">Recent Reports</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Goals */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Goals</CardTitle>
                <CardDescription>Latest activity goals set for teams and reps</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {goals?.slice(0, 5).map((goal: any) => (
                    <div key={goal.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getActivityIcon(goal.goalType)}
                        <div>
                          <p className="font-medium">{getActivityLabel(goal.goalType)}</p>
                          <p className="text-sm text-muted-foreground">
                            {goal.targetCount} per {goal.period}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={goal.isActive ? "default" : "secondary"}>
                          {goal.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {goal.userName || goal.teamName || "Unassigned"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Goal Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Goal Progress</CardTitle>
                <CardDescription>Current progress toward active goals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {goalProgress?.slice(0, 5).map((progress: any) => (
                    <div key={progress.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getActivityIcon(progress.goalType)}
                          <span className="font-medium">{getActivityLabel(progress.goalType)}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {progress.currentCount}/{progress.targetCount}
                        </span>
                      </div>
                      <Progress value={progress.progressPercentage} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{progress.assignedUserName || progress.teamName}</span>
                        <span className={progress.onTrack ? "text-green-600" : "text-red-600"}>
                          {progress.onTrack ? "On Track" : "Behind"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Goals</CardTitle>
              <CardDescription>Manage activity targets for individuals and teams</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {goals?.map((goal: any) => (
                  <div key={goal.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getActivityIcon(goal.goalType)}
                        <div>
                          <h3 className="font-semibold">{getActivityLabel(goal.goalType)} Goal</h3>
                          <p className="text-sm text-muted-foreground">
                            {goal.targetCount} per {goal.period} • {format(new Date(goal.startDate), "MMM d")} - {format(new Date(goal.endDate), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={goal.isActive ? "default" : "secondary"}>
                          {goal.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Assigned to: {goal.userName ? `${goal.userName} ${goal.userLastName}` : goal.teamName || "Unassigned"}
                      </span>
                      {goal.notes && (
                        <span className="text-muted-foreground">"{goal.notes}"</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Teams</CardTitle>
              <CardDescription>Manage team structure and member assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {teams?.map((team: any) => (
                  <div key={team.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{team.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Manager: {team.managerName} {team.managerLastName}
                        </p>
                        {team.territory && (
                          <p className="text-sm text-muted-foreground">Territory: {team.territory}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant={team.isActive ? "default" : "secondary"}>
                          {team.memberCount} members
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Level {team.teamLevel}
                        </p>
                      </div>
                    </div>
                    {team.description && (
                      <p className="text-sm text-muted-foreground mt-2">{team.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Activity Reports</h2>
              <p className="text-muted-foreground">View prospecting activity performance and trends</p>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="period-select">Period:</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Activity Performance</CardTitle>
              <CardDescription>
                Detailed breakdown of prospecting activities and outcomes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityReports?.map((report: any) => (
                  <div key={report.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold">
                          {report.userName ? `${report.userName} ${report.userLastName}` : report.teamName}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(report.reportDate), "MMM d, yyyy")} • {report.period}
                        </p>
                      </div>
                      <Badge variant="outline">{report.period}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <Phone className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                        <p className="text-2xl font-bold text-blue-600">{report.totalCalls}</p>
                        <p className="text-xs text-muted-foreground">Calls</p>
                        <p className="text-xs text-green-600">
                          {report.callConnectRate?.toFixed(1)}% connect rate
                        </p>
                      </div>
                      
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <Mail className="h-6 w-6 mx-auto mb-2 text-green-600" />
                        <p className="text-2xl font-bold text-green-600">{report.totalEmails}</p>
                        <p className="text-xs text-muted-foreground">Emails</p>
                        <p className="text-xs text-green-600">
                          {report.emailReplyRate?.toFixed(1)}% reply rate
                        </p>
                      </div>
                      
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <Calendar className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                        <p className="text-2xl font-bold text-purple-600">{report.totalMeetings}</p>
                        <p className="text-xs text-muted-foreground">Meetings</p>
                        <p className="text-xs text-green-600">{report.meetingsScheduled} scheduled</p>
                      </div>
                      
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <Activity className="h-6 w-6 mx-auto mb-2 text-orange-600" />
                        <p className="text-2xl font-bold text-orange-600">{report.totalReachouts}</p>
                        <p className="text-xs text-muted-foreground">Reachouts</p>
                        <p className="text-xs text-muted-foreground">Calls + Emails</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}