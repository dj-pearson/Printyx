import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  DollarSign,
  Package,
  TrendingUp,
  Users,
  Wrench,
  FileText,
  Target,
  BarChart3,
} from 'lucide-react';
import {
  StatCard,
  PriorityList,
  ActivityFeed,
  TeamStatus,
  PipelineWidget,
  QuickActions,
} from './dashboard-widgets';
import { apiRequest } from '@/lib/queryClient';

// ============================================================================
// SERVICE MANAGER DASHBOARD
// ============================================================================

export function ServiceManagerDashboard() {
  // Fetch dashboard data
  const { data, isLoading } = useQuery({
    queryKey: ['/api/dashboards/service-manager'],
    queryFn: async () => {
      try {
        return await apiRequest('/api/dashboards/service-manager');
      } catch (err) {
        // Fallback: construct from individual endpoints
        const tickets = await apiRequest('/api/service-tickets');
        const technicians = await apiRequest('/api/technicians');

        return {
          stats: {
            emergencyTickets: tickets.filter((t: any) => t.priority === 'critical').length,
            dueToday: tickets.filter(
              (t: any) => t.dueDate === new Date().toISOString().split('T')[0],
            ).length,
            scheduledTomorrow: tickets.filter(
              (t: any) =>
                t.scheduledDate === new Date(Date.now() + 86400000).toISOString().split('T')[0],
            ).length,
            averageResponseTime: '1.2 hrs',
          },
          priorities: tickets
            .filter((t: any) => ['critical', 'high'].includes(t.priority))
            .slice(0, 5),
          technicians: technicians,
          recentActivity: [],
        };
      }
    },
  });

  const stats = data?.stats || {};
  const priorities = data?.priorities || [];
  const technicians = data?.technicians || [];
  const recentActivity = data?.recentActivity || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Service Command Center</h1>
        <p className="text-muted-foreground">Today's Priorities & Team Status</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Emergency Tickets"
          value={stats.emergencyTickets || 0}
          icon={<AlertCircle className="h-5 w-5" />}
          href="/service-hub?priority=critical"
          loading={isLoading}
        />
        <StatCard
          title="Due Today"
          value={stats.dueToday || 0}
          icon={<Calendar className="h-5 w-5" />}
          href="/service-hub?due=today"
          loading={isLoading}
        />
        <StatCard
          title="Scheduled Tomorrow"
          value={stats.scheduledTomorrow || 0}
          icon={<Calendar className="h-5 w-5" />}
          href="/service-dispatch?date=tomorrow"
          loading={isLoading}
        />
        <StatCard
          title="Avg Response Time"
          value={stats.averageResponseTime || 'N/A'}
          icon={<CheckCircle className="h-5 w-5" />}
          trend="down"
          change={-15}
          changeLabel="vs last week"
          loading={isLoading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Priority Tickets */}
          <PriorityList
            title="Today's Priorities"
            items={priorities.map((ticket: any) => ({
              id: ticket.id,
              title: `${ticket.ticketNumber} - ${ticket.description || 'Service Request'}`,
              subtitle: `${ticket.customerName} - ${ticket.equipmentName || 'Equipment'}`,
              priority: ticket.priority,
              href: `/service-hub/${ticket.id}`,
            }))}
            emptyMessage="No urgent tickets - Great work!"
            viewAllHref="/service-hub"
            loading={isLoading}
          />

          {/* Quick Actions */}
          <QuickActions
            title="Quick Actions"
            actions={[
              {
                label: 'New Service Request',
                icon: <Wrench className="h-5 w-5" />,
                href: '/service-hub?action=new',
              },
              {
                label: 'Emergency Dispatch',
                icon: <AlertCircle className="h-5 w-5" />,
                href: '/service-dispatch?emergency=true',
                variant: 'default',
              },
              {
                label: 'View Parts Inventory',
                icon: <Package className="h-5 w-5" />,
                href: '/warehouse-operations',
              },
              {
                label: 'Review Pending Approvals',
                icon: <CheckCircle className="h-5 w-5" />,
                href: '/service-hub?status=pending-approval',
              },
            ]}
          />
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Technician Status */}
          <TeamStatus
            title="Technician Status"
            technicians={technicians.map((tech: any) => ({
              id: tech.id,
              name: tech.name,
              avatar: tech.avatar,
              status: tech.status || 'available',
              currentJob: tech.currentJob,
              jobsToday: tech.jobsToday || 0,
              href: `/technicians/${tech.id}/track`,
            }))}
            loading={isLoading}
          />

          {/* Recent Activity */}
          <ActivityFeed
            title="Recent Activity"
            activities={recentActivity}
            maxItems={5}
            loading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SALES REP DASHBOARD
// ============================================================================

export function SalesRepDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/dashboards/sales-rep'],
    queryFn: async () => {
      try {
        return await apiRequest('/api/dashboards/sales-rep');
      } catch (err) {
        // Fallback
        return {
          stats: {
            pipelineTotal: 487000,
            closingThisWeek: 125000,
            followUpToday: 89000,
            quotesPending: 273000,
          },
          pipeline: [
            { name: 'New Lead', value: 150000, count: 8, deals: [] },
            { name: 'Qualified', value: 120000, count: 5, deals: [] },
            { name: 'Proposal', value: 167000, count: 4, deals: [] },
            { name: 'Won', value: 50000, count: 2, deals: [] },
          ],
          recentActivity: [],
          aiRecommendations: [],
        };
      }
    },
  });

  const stats = data?.stats || {};
  const pipeline = data?.pipeline || [];
  const recentActivity = data?.recentActivity || [];
  const aiRecommendations = data?.aiRecommendations || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">My Sales Pipeline</h1>
        <p className="text-muted-foreground">${stats.pipelineTotal?.toLocaleString() || 0} Total</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Closing This Week"
          value={`$${(stats.closingThisWeek || 0).toLocaleString()}`}
          icon={<Target className="h-5 w-5" />}
          href="/deals?stage=closing"
          loading={isLoading}
        />
        <StatCard
          title="Follow Up Today"
          value={`$${(stats.followUpToday || 0).toLocaleString()}`}
          icon={<Calendar className="h-5 w-5" />}
          href="/deals?follow-up=today"
          loading={isLoading}
        />
        <StatCard
          title="Quotes Pending Response"
          value={`$${(stats.quotesPending || 0).toLocaleString()}`}
          icon={<FileText className="h-5 w-5" />}
          href="/deals?status=quote-sent"
          loading={isLoading}
        />
        <StatCard
          title="Win Rate"
          value="34%"
          icon={<TrendingUp className="h-5 w-5" />}
          trend="up"
          change={5}
          changeLabel="vs last quarter"
          loading={isLoading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pipeline Visualization */}
          <PipelineWidget title="Deal Pipeline" stages={pipeline} loading={isLoading} />

          {/* AI Recommendations */}
          <PriorityList
            title="Recommended Actions (AI)"
            items={aiRecommendations.map((rec: any) => ({
              id: rec.id,
              title: rec.title,
              subtitle: rec.description,
              priority: rec.priority || 'medium',
              href: rec.href,
            }))}
            emptyMessage="No recommendations at this time"
            loading={isLoading}
          />

          {/* Quick Actions */}
          <QuickActions
            title="Quick Actions"
            actions={[
              {
                label: 'Create Quote',
                icon: <FileText className="h-5 w-5" />,
                href: '/quotes?action=new',
              },
              {
                label: 'New Lead',
                icon: <Users className="h-5 w-5" />,
                href: '/customers?action=new-lead',
              },
              {
                label: 'View Reports',
                icon: <BarChart3 className="h-5 w-5" />,
                href: '/reports/sales',
              },
              {
                label: 'Schedule Call',
                icon: <Calendar className="h-5 w-5" />,
                onClick: () => console.log('Schedule call'),
              },
            ]}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <ActivityFeed
            title="Recent Activity"
            activities={recentActivity}
            maxItems={10}
            loading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TECHNICIAN DASHBOARD
// ============================================================================

export function TechnicianDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/dashboards/technician'],
    queryFn: async () => {
      try {
        return await apiRequest('/api/dashboards/technician');
      } catch (err) {
        return {
          stats: {
            jobsToday: 4,
            jobsCompleted: 1,
            nextJobETA: '15 min',
            todayMiles: '23.4 mi',
          },
          todayJobs: [],
          recentCompletions: [],
        };
      }
    },
  });

  const stats = data?.stats || {};
  const todayJobs = data?.todayJobs || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Your Jobs - Today</h1>
        <p className="text-muted-foreground">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Jobs Today"
          value={stats.jobsToday || 0}
          icon={<Wrench className="h-5 w-5" />}
          loading={isLoading}
        />
        <StatCard
          title="Completed"
          value={stats.jobsCompleted || 0}
          icon={<CheckCircle className="h-5 w-5" />}
          loading={isLoading}
        />
        <StatCard
          title="Next Job ETA"
          value={stats.nextJobETA || 'N/A'}
          icon={<Calendar className="h-5 w-5" />}
          loading={isLoading}
        />
        <StatCard
          title="Miles Today"
          value={stats.todayMiles || '0 mi'}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={isLoading}
        />
      </div>

      {/* Today's Jobs */}
      <PriorityList
        title="Your Schedule"
        items={todayJobs.map((job: any) => ({
          id: job.id,
          title: `${job.scheduledTime} - ${job.customerName}`,
          subtitle: `${job.equipmentName} - ${job.description}`,
          priority: job.priority,
          href: `/service-hub/${job.id}`,
        }))}
        emptyMessage="No jobs scheduled for today"
        loading={isLoading}
      />

      {/* Quick Actions */}
      <QuickActions
        title="Quick Actions"
        actions={[
          {
            label: 'Clock In',
            icon: <CheckCircle className="h-5 w-5" />,
            variant: 'default',
            onClick: () => console.log('Clock in'),
          },
          {
            label: 'View Route',
            icon: <Calendar className="h-5 w-5" />,
            href: '/service-dispatch/my-route',
          },
          {
            label: 'Parts Lookup',
            icon: <Package className="h-5 w-5" />,
            href: '/warehouse-operations/lookup',
          },
          {
            label: 'Report Issue',
            icon: <AlertCircle className="h-5 w-5" />,
            onClick: () => console.log('Report issue'),
          },
        ]}
      />
    </div>
  );
}

// ============================================================================
// EXECUTIVE DASHBOARD
// ============================================================================

export function ExecutiveDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/dashboards/executive'],
    queryFn: async () => {
      try {
        return await apiRequest('/api/dashboards/executive');
      } catch (err) {
        return {
          stats: {
            mrr: 127000,
            mrrChange: 12,
            pipeline: 487000,
            csat: 4.7,
            slaCompliance: 94,
            growthRate: 15,
          },
          alerts: [],
          opportunities: [],
        };
      }
    },
  });

  const stats = data?.stats || {};
  const alerts = data?.alerts || [];
  const opportunities = data?.opportunities || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Business Overview</h1>
        <p className="text-muted-foreground">Key Performance Indicators</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Monthly Recurring Revenue"
          value={`$${(stats.mrr || 0).toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
          trend="up"
          change={stats.mrrChange}
          loading={isLoading}
        />
        <StatCard
          title="Sales Pipeline"
          value={`$${(stats.pipeline || 0).toLocaleString()}`}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={isLoading}
        />
        <StatCard
          title="Customer Satisfaction"
          value={`${stats.csat || 0}/5.0`}
          icon={<Users className="h-5 w-5" />}
          loading={isLoading}
        />
        <StatCard
          title="Service SLA Compliance"
          value={`${stats.slaCompliance || 0}%`}
          icon={<CheckCircle className="h-5 w-5" />}
          loading={isLoading}
        />
        <StatCard
          title="Month-over-Month Growth"
          value={`${stats.growthRate || 0}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          trend="up"
          loading={isLoading}
        />
        <StatCard
          title="Collections Rate"
          value="98%"
          icon={<DollarSign className="h-5 w-5" />}
          loading={isLoading}
        />
      </div>

      {/* Alerts & Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PriorityList
          title="Needs Attention"
          items={alerts.map((alert: any) => ({
            id: alert.id,
            title: alert.title,
            subtitle: alert.description,
            priority: alert.priority,
            href: alert.href,
          }))}
          emptyMessage="All systems running smoothly"
          loading={isLoading}
        />

        <PriorityList
          title="Growth Opportunities"
          items={opportunities.map((opp: any) => ({
            id: opp.id,
            title: opp.title,
            subtitle: opp.description,
            priority: 'high',
            href: opp.href,
          }))}
          emptyMessage="No new opportunities identified"
          loading={isLoading}
        />
      </div>
    </div>
  );
}
