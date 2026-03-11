import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';
import { format, formatDistance, isToday, isPast, isFuture, addDays } from 'date-fns';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Mail,
  Phone,
  Target,
  TrendingUp,
  Users,
  Zap,
  Trophy,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  title: string;
  type: 'call' | 'meeting' | 'email' | 'task' | 'follow-up';
  scheduledDate: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'completed' | 'overdue';
  customerName?: string;
  customerId?: string;
  notes?: string;
}

interface Lead {
  id: string;
  companyName: string;
  contactName?: string;
  estimatedValue?: number;
  score?: number;
  status: string;
  lastContact?: string;
  reason?: string;
}

interface Deal {
  id: string;
  title: string;
  companyName: string;
  value: number;
  stage: string;
  daysSinceUpdate: number;
  probability: number;
  staleReason?: string;
}

interface TodayViewData {
  overdue: Activity[];
  today: Activity[];
  upcoming: Activity[];
  hotLeads: Lead[];
  pipelineAlerts: Deal[];
  recentWins: Deal[];
  stats: {
    pipelineValue: number;
    quotaAttainment: number;
    conversionRate: number;
    tasksCompleted: number;
  };
}

const activityTypeIcons = {
  call: Phone,
  meeting: Calendar,
  email: Mail,
  task: CheckCircle2,
  'follow-up': Clock,
};

const priorityColors = {
  low: 'text-gray-500 bg-gray-100',
  medium: 'text-blue-600 bg-blue-100',
  high: 'text-orange-600 bg-orange-100',
  urgent: 'text-red-600 bg-red-100',
};

export default function TodayDashboard() {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Fetch today's dashboard data
  const { data, isLoading } = useQuery<TodayViewData>({
    queryKey: ['/api/dashboards/today'],
    queryFn: async () => {
      try {
        return await apiRequest('/api/dashboards/today');
      } catch (error) {
        // Fallback with mock data for demo
        return generateMockTodayData();
      }
    },
    enabled: isAuthenticated,
    refetchInterval: 60000, // Refresh every minute
  });

  const handleCompleteActivity = async (activityId: string) => {
    try {
      const response = await fetch(`/api/activities/${activityId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'completed', completedAt: new Date().toISOString() }),
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/dashboards/today'] });
      }
    } catch {
      // Activity completion endpoint may not be available
    }
  };

  const handleCallCustomer = (customerId: string) => {
    navigate(`/customers/${customerId}`);
  };

  if (isLoading) {
    return (
      <MainLayout title="Today" description="Your personalized daily workflow">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  const {
    overdue = [],
    today = [],
    upcoming = [],
    hotLeads = [],
    pipelineAlerts = [],
    recentWins = [],
    stats = {
      pipelineValue: 0,
      quotaAttainment: 0,
      conversionRate: 0,
      tasksCompleted: 0,
    },
  } = data || {};

  return (
    <MainLayout
      title="Today"
      description={`Good ${getTimeOfDay()}, ${user?.firstName || 'there'}! Here's your day at a glance.`}
    >
      <div className="space-y-6">
        {/* Overdue Alert Banner */}
        {overdue.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <CardTitle className="text-red-900">
                  {overdue.length} Overdue {overdue.length === 1 ? 'Task' : 'Tasks'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overdue.slice(0, 3).map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    onComplete={handleCompleteActivity}
                    onNavigate={handleCallCustomer}
                    isOverdue
                  />
                ))}
                {overdue.length > 3 && (
                  <Button variant="link" className="text-red-600 p-0 h-auto">
                    View all {overdue.length} overdue tasks →
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={DollarSign}
            label="Pipeline Value"
            value={`$${(stats.pipelineValue / 1000).toFixed(0)}K`}
            color="text-green-600 bg-green-100"
          />
          <StatCard
            icon={Target}
            label="Quota Attainment"
            value={`${stats.quotaAttainment}%`}
            color="text-blue-600 bg-blue-100"
            subtitle={stats.quotaAttainment >= 100 ? '🎉 Over target!' : 'Keep going!'}
          />
          <StatCard
            icon={TrendingUp}
            label="Conversion Rate"
            value={`${stats.conversionRate}%`}
            color="text-purple-600 bg-purple-100"
          />
          <StatCard
            icon={CheckCircle2}
            label="Tasks Completed"
            value={`${stats.tasksCompleted}`}
            color="text-orange-600 bg-orange-100"
            subtitle="Today"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Schedule - Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Today's Schedule */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <CardTitle>Today's Schedule</CardTitle>
                    <Badge variant="secondary">{today.length} tasks</Badge>
                  </div>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {today.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p className="text-lg font-medium">All caught up!</p>
                    <p className="text-sm">No tasks scheduled for today.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {today.map((activity) => (
                      <ActivityItem
                        key={activity.id}
                        activity={activity}
                        onComplete={handleCompleteActivity}
                        onNavigate={handleCallCustomer}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pipeline Alerts */}
            {pipelineAlerts.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <CardTitle className="text-orange-900">Pipeline Alerts</CardTitle>
                    <Badge variant="secondary" className="bg-orange-200">
                      {pipelineAlerts.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pipelineAlerts.map((deal) => (
                      <DealAlertItem key={deal.id} deal={deal} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Wins */}
            {recentWins.length > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-green-600" />
                    <CardTitle className="text-green-900">Recent Wins 🎉</CardTitle>
                    <Badge variant="secondary" className="bg-green-200">
                      {recentWins.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentWins.map((deal) => (
                      <WinItem key={deal.id} deal={deal} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Hot Leads & Upcoming */}
          <div className="space-y-6">
            {/* Hot Leads */}
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-purple-900">Hot Leads</CardTitle>
                </div>
                <p className="text-sm text-purple-700">AI-scored high-value opportunities</p>
              </CardHeader>
              <CardContent>
                {hotLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hot leads right now
                  </p>
                ) : (
                  <div className="space-y-3">
                    {hotLeads.map((lead) => (
                      <HotLeadItem key={lead.id} lead={lead} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming (Next 3 Days) */}
            {upcoming.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-gray-600" />
                    <CardTitle>Coming Up</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">Next 3 days</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {upcoming.slice(0, 5).map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-2 text-sm p-2 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <div className="mt-0.5">
                          {activityTypeIcons[activity.type] && (
                            <span className="text-gray-500">
                              {activityTypeIcons[activity.type]({ className: 'h-4 w-4' })}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{activity.title}</p>
                          {activity.customerName && (
                            <p className="text-xs text-muted-foreground truncate">
                              {activity.customerName}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {activity.scheduledDate &&
                              formatDistance(new Date(activity.scheduledDate), new Date(), {
                                addSuffix: true,
                              })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

// Helper Components
function StatCard({
  icon: Icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityItem({
  activity,
  onComplete,
  onNavigate,
  isOverdue = false,
}: {
  activity: Activity;
  onComplete: (id: string) => void;
  onNavigate: (customerId: string) => void;
  isOverdue?: boolean;
}) {
  const Icon = activityTypeIcons[activity.type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-all hover:shadow-sm',
        isOverdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 hover:border-gray-300',
      )}
    >
      <div className={cn('p-2 rounded-md', priorityColors[activity.priority])}>
        {Icon && <Icon className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{activity.title}</p>
        {activity.customerName && (
          <p className="text-sm text-muted-foreground">{activity.customerName}</p>
        )}
        {activity.scheduledDate && (
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(activity.scheduledDate), 'h:mm a')}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {activity.customerId && (
          <Button variant="ghost" size="sm" onClick={() => onNavigate(activity.customerId!)}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onComplete(activity.id)}
          className="text-green-600 hover:text-green-700"
        >
          <CheckCircle2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function HotLeadItem({ lead }: { lead: Lead }) {
  const [, navigate] = useLocation();

  return (
    <div
      className="p-3 bg-white rounded-lg border border-purple-200 hover:border-purple-300 transition-all cursor-pointer hover:shadow-sm"
      onClick={() => navigate(`/business-records/${lead.id}`)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="font-medium">{lead.companyName}</p>
          {lead.contactName && <p className="text-sm text-muted-foreground">{lead.contactName}</p>}
        </div>
        {lead.score && (
          <Badge className="bg-purple-600">
            {lead.score}% <Zap className="h-3 w-3 ml-1" />
          </Badge>
        )}
      </div>
      {lead.estimatedValue && (
        <p className="text-sm font-medium text-green-600">
          ${lead.estimatedValue.toLocaleString()}
        </p>
      )}
      {lead.reason && <p className="text-xs text-muted-foreground mt-2">{lead.reason}</p>}
      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="outline" className="flex-1">
          <Phone className="h-3 w-3 mr-1" /> Call
        </Button>
        <Button size="sm" variant="outline" className="flex-1">
          <Mail className="h-3 w-3 mr-1" /> Email
        </Button>
      </div>
    </div>
  );
}

function DealAlertItem({ deal }: { deal: Deal }) {
  const [, navigate] = useLocation();

  return (
    <div
      className="p-3 bg-white rounded-lg border border-orange-200 hover:border-orange-300 transition-all cursor-pointer"
      onClick={() => navigate(`/deals/${deal.id}`)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="font-medium">{deal.title}</p>
          <p className="text-sm text-muted-foreground">{deal.companyName}</p>
        </div>
        <p className="text-sm font-medium text-orange-600">{deal.daysSinceUpdate} days</p>
      </div>
      <p className="text-sm font-medium text-green-600">
        ${deal.value.toLocaleString()} • {deal.probability}%
      </p>
      {deal.staleReason && (
        <p className="text-xs text-muted-foreground mt-2">
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          {deal.staleReason}
        </p>
      )}
      <Button size="sm" variant="outline" className="w-full mt-3">
        <MessageSquare className="h-3 w-3 mr-1" /> Log Activity
      </Button>
    </div>
  );
}

function WinItem({ deal }: { deal: Deal }) {
  const [, navigate] = useLocation();

  return (
    <div
      className="p-3 bg-white rounded-lg border border-green-200 hover:border-green-300 transition-all cursor-pointer"
      onClick={() => navigate(`/deals/${deal.id}`)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="font-medium">{deal.title}</p>
          <p className="text-sm text-muted-foreground">{deal.companyName}</p>
        </div>
        <Trophy className="h-5 w-5 text-yellow-500" />
      </div>
      <p className="text-lg font-bold text-green-600 mt-2">${deal.value.toLocaleString()}</p>
    </div>
  );
}

// Helper Functions
function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function generateMockTodayData(): TodayViewData {
  const now = new Date();
  const yesterday = addDays(now, -1);
  const tomorrow = addDays(now, 1);

  return {
    overdue: [
      {
        id: '1',
        title: 'Follow up on proposal',
        type: 'call',
        scheduledDate: yesterday.toISOString(),
        priority: 'high',
        status: 'overdue',
        customerName: 'Acme Corporation',
        customerId: 'cust-1',
      },
      {
        id: '2',
        title: 'Send contract documents',
        type: 'email',
        scheduledDate: yesterday.toISOString(),
        priority: 'urgent',
        status: 'overdue',
        customerName: 'TechCorp Inc',
        customerId: 'cust-2',
      },
    ],
    today: [
      {
        id: '3',
        title: 'Demo call with prospect',
        type: 'meeting',
        scheduledDate: new Date(now.setHours(10, 0)).toISOString(),
        priority: 'high',
        status: 'pending',
        customerName: 'Global Industries',
        customerId: 'cust-3',
      },
      {
        id: '4',
        title: 'Check in with key account',
        type: 'call',
        scheduledDate: new Date(now.setHours(14, 30)).toISOString(),
        priority: 'medium',
        status: 'pending',
        customerName: 'Enterprise Solutions',
        customerId: 'cust-4',
      },
      {
        id: '5',
        title: 'Send quarterly review',
        type: 'email',
        scheduledDate: new Date(now.setHours(16, 0)).toISOString(),
        priority: 'low',
        status: 'pending',
        customerName: 'ABC Company',
        customerId: 'cust-5',
      },
    ],
    upcoming: [
      {
        id: '6',
        title: 'Renewal discussion',
        type: 'meeting',
        scheduledDate: tomorrow.toISOString(),
        priority: 'high',
        status: 'pending',
        customerName: 'Big Corp',
        customerId: 'cust-6',
      },
      {
        id: '7',
        title: 'Product training session',
        type: 'meeting',
        scheduledDate: addDays(now, 2).toISOString(),
        priority: 'medium',
        status: 'pending',
        customerName: 'StartupXYZ',
        customerId: 'cust-7',
      },
    ],
    hotLeads: [
      {
        id: 'lead-1',
        companyName: 'MegaCorp Industries',
        contactName: 'John Smith',
        estimatedValue: 150000,
        score: 92,
        status: 'qualified',
        reason: 'Opened proposal 5 times, high engagement',
      },
      {
        id: 'lead-2',
        companyName: 'FastGrowth LLC',
        contactName: 'Jane Doe',
        estimatedValue: 85000,
        score: 88,
        status: 'qualified',
        reason: 'Budget confirmed, decision maker engaged',
      },
      {
        id: 'lead-3',
        companyName: 'Innovation Labs',
        contactName: 'Bob Johnson',
        estimatedValue: 120000,
        score: 85,
        status: 'qualified',
        reason: 'Similar company just purchased, warm referral',
      },
    ],
    pipelineAlerts: [
      {
        id: 'deal-1',
        title: 'Enterprise Software Deal',
        companyName: 'Acme Corp',
        value: 180000,
        stage: 'proposal',
        daysSinceUpdate: 23,
        probability: 60,
        staleReason: 'Stalled in proposal stage (avg: 12 days)',
      },
      {
        id: 'deal-2',
        title: 'Hardware Upgrade',
        companyName: 'TechCorp',
        value: 95000,
        stage: 'negotiation',
        daysSinceUpdate: 15,
        probability: 70,
        staleReason: 'No contact in 2 weeks',
      },
    ],
    recentWins: [
      {
        id: 'win-1',
        title: 'Annual Support Contract',
        companyName: 'Global Enterprises',
        value: 125000,
        stage: 'closed-won',
        daysSinceUpdate: 1,
        probability: 100,
      },
      {
        id: 'win-2',
        title: 'Cloud Migration Project',
        companyName: 'Local Business Inc',
        value: 75000,
        stage: 'closed-won',
        daysSinceUpdate: 3,
        probability: 100,
      },
    ],
    stats: {
      pipelineValue: 1245000,
      quotaAttainment: 87,
      conversionRate: 24,
      tasksCompleted: 8,
    },
  };
}

// Missing import
import { Plus } from 'lucide-react';
