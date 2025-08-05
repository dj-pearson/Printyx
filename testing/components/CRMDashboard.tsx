import React, { useState, useEffect } from 'react';

interface WorkflowProgress {
  workflowId: string;
  customerId: string;
  currentStage: string;
  currentStageName: string;
  completedStages: number;
  totalStages: number;
  progressPercentage: number;
  estimatedCompletion: Date;
  nextActions: NextAction[];
  milestones: Milestone[];
  blockers: Blocker[];
  assignedTo: string;
  assignedRole: RoleInfo;
}

interface NextAction {
  stage: string;
  name: string;
  description: string;
  assignedRole: string;
  estimatedDuration: string;
}

interface Milestone {
  name: string;
  stage: string;
  completedAt: Date;
}

interface Blocker {
  id: string;
  description: string;
  severity: string;
  createdAt: Date;
  resolved: boolean;
}

interface RoleInfo {
  name: string;
  department: string;
  permissions: string[];
}

interface DashboardData {
  totalWorkflows: number;
  stageDistribution: { [key: string]: number };
  roleWorkload: { [key: string]: number };
  blockedWorkflows: string[];
  upcomingDeadlines: DeadlineInfo[];
  averageCompletionTime: number;
  bottlenecks: BottleneckInfo[];
}

interface DeadlineInfo {
  workflowId: string;
  customerId: string;
  daysRemaining: number;
  currentStage: string;
}

interface BottleneckInfo {
  stage: string;
  stageName: string;
  workflowCount: number;
  assignedRole: string;
}

interface UserDashboard {
  user: {
    id: string;
    name: string;
    role: string;
    department: string;
  };
  workload: {
    total: number;
    overdue: number;
    urgent: number;
    blocked: number;
  };
  workflows: WorkflowProgress[];
  performance: {
    completedWorkflows: number;
    averageCompletionTime: number;
    lastActive: Date;
  };
  notifications: Notification[];
}

interface Notification {
  id: string;
  type: string;
  data: any;
  createdAt: Date;
  read: boolean;
}

const CRMDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [userDashboard, setUserDashboard] = useState<UserDashboard | null>(null);
  const [selectedView, setSelectedView] = useState<'overview' | 'personal' | 'workflows'>('overview');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // In real implementation, these would be API calls
      const dashboardResponse = await fetch('/api/crm/dashboard');
      const dashboard = await dashboardResponse.json();
      setDashboardData(dashboard);

      const userResponse = await fetch('/api/crm/user-dashboard');
      const user = await userResponse.json();
      setUserDashboard(user);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceWorkflow = async (workflowId: string, targetStage: string) => {
    try {
      await fetch(`/api/crm/workflows/${workflowId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStage })
      });
      loadDashboardData();
    } catch (error) {
      console.error('Failed to advance workflow:', error);
    }
  };

  const formatDuration = (milliseconds: number) => {
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    return `${days} days`;
  };

  const getStageColor = (stage: string) => {
    const stageColors: { [key: string]: string } = {
      'lead_submission': '#3B82F6',
      'discovery_scheduled': '#8B5CF6', 
      'contract_signed': '#10B981',
      'production_scheduled': '#F59E0B',
      'delivered': '#EF4444',
      'acceptance_signed': '#06B6D4',
      'maintenance_monitoring': '#84CC16'
    };
    return stageColors[stage] || '#6B7280';
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: '#EF4444',
      medium: '#F59E0B', 
      low: '#10B981'
    };
    return colors[priority as keyof typeof colors] || '#6B7280';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">CRM Workflow Management</h1>
          <p className="text-gray-600 mt-2">Complete customer journey from lead to maintenance</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'personal', label: 'My Tasks' },
              { key: 'workflows', label: 'All Workflows' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedView(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  selectedView === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {selectedView === 'overview' && dashboardData && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Workflows</p>
                    <p className="text-2xl font-semibold text-gray-900">{dashboardData.totalWorkflows}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Blocked</p>
                    <p className="text-2xl font-semibold text-gray-900">{dashboardData.blockedWorkflows.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Due Soon</p>
                    <p className="text-2xl font-semibold text-gray-900">{dashboardData.upcomingDeadlines.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg Completion</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {dashboardData.averageCompletionTime ? formatDuration(dashboardData.averageCompletionTime) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stage Distribution */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Workflows by Stage</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {Object.entries(dashboardData.stageDistribution).map(([stage, count]) => (
                  <div
                    key={stage}
                    className="p-4 rounded-lg border-2"
                    style={{ borderColor: getStageColor(stage) }}
                  >
                    <div className="text-center">
                      <p className="text-2xl font-bold" style={{ color: getStageColor(stage) }}>
                        {count}
                      </p>
                      <p className="text-xs text-gray-600 mt-1 capitalize">
                        {stage.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottlenecks Alert */}
            {dashboardData.bottlenecks.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <svg className="w-6 h-6 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h3 className="text-lg font-medium text-red-800">Bottlenecks Detected</h3>
                </div>
                <div className="space-y-2">
                  {dashboardData.bottlenecks.map((bottleneck, index) => (
                    <div key={index} className="text-red-700">
                      <strong>{bottleneck.stageName}</strong>: {bottleneck.workflowCount} workflows 
                      (Assigned to: {bottleneck.assignedRole})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Deadlines */}
            {dashboardData.upcomingDeadlines.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Deadlines</h3>
                <div className="space-y-3">
                  {dashboardData.upcomingDeadlines.map((deadline) => (
                    <div key={deadline.workflowId} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <p className="font-medium">Customer: {deadline.customerId}</p>
                        <p className="text-sm text-gray-600 capitalize">{deadline.currentStage.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-yellow-600">{deadline.daysRemaining} days</p>
                        <p className="text-sm text-gray-600">remaining</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Personal Dashboard Tab */}
        {selectedView === 'personal' && userDashboard && (
          <div className="space-y-6">
            {/* User Info & Workload */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{userDashboard.user.name}</h2>
                  <p className="text-gray-600">{userDashboard.user.role} - {userDashboard.user.department}</p>
                </div>
                <div className="flex space-x-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{userDashboard.workload.total}</p>
                    <p className="text-sm text-gray-600">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{userDashboard.workload.overdue}</p>
                    <p className="text-sm text-gray-600">Overdue</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-600">{userDashboard.workload.urgent}</p>
                    <p className="text-sm text-gray-600">Urgent</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600">{userDashboard.workload.blocked}</p>
                    <p className="text-sm text-gray-600">Blocked</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notifications */}
            {userDashboard.notifications.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Notifications</h3>
                <div className="space-y-3">
                  {userDashboard.notifications.slice(0, 5).map((notification) => (
                    <div key={notification.id} className="flex items-center p-3 bg-blue-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium capitalize">{notification.type.replace(/_/g, ' ')}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My Workflows */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">My Assigned Workflows</h3>
              <div className="space-y-4">
                {userDashboard.workflows.map((workflow) => (
                  <div key={workflow.workflowId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium">Customer: {workflow.customerId}</h4>
                        <p className="text-sm text-gray-600">{workflow.currentStageName}</p>
                      </div>
                      <div className="text-right">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${workflow.progressPercentage}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{Math.round(workflow.progressPercentage)}%</p>
                      </div>
                    </div>
                    
                    {workflow.blockers.length > 0 && (
                      <div className="mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Blocked
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-3">
                      {workflow.nextActions.map((action, index) => (
                        <button
                          key={index}
                          onClick={() => handleAdvanceWorkflow(workflow.workflowId, action.stage)}
                          className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full hover:bg-blue-200 transition-colors"
                        >
                          {action.name}
                        </button>
                      ))}
                    </div>

                    <div className="text-xs text-gray-500">
                      Due: {new Date(workflow.estimatedCompletion).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* All Workflows Tab */}
        {selectedView === 'workflows' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">All Workflows</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progress
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assigned To
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* This would be populated with actual workflow data */}
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Loading...
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CRMDashboard;