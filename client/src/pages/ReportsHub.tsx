import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { useReportPermissions } from '@/components/reports/ProtectedReportRoute';
import { rbacUtils } from '@/lib/rbac';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Target, 
  Calendar,
  AlertTriangle,
  Clock,
  Eye,
  Download,
  Filter,
  Settings,
  Zap,
  PieChart,
  Activity
} from 'lucide-react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { 
  type BusinessRecord,
  type Deal,
  type ServiceTicket,
  type Invoice,
  type Contract
} from '@shared/schema';

// RBAC permissions type
interface UserPermissions {
  canViewSalesReports: boolean;
  canViewServiceReports: boolean;
  canViewFinancialReports: boolean;
  canViewExecutiveReports: boolean;
  canManageReports: boolean;
  territoryIds?: string[];
  teamMemberIds?: string[];
}

// Report metadata type
interface ReportCard {
  id: string;
  title: string;
  description: string;
  category: 'sales' | 'service' | 'finance' | 'executive';
  icon: React.ComponentType<any>;
  route: string;
  requiredPermission: keyof UserPermissions;
  lastUpdated?: string;
  kpiValue?: string;
  kpiChange?: number;
  priority?: 'high' | 'medium' | 'low';
}

// Dashboard KPI type
interface DashboardKPI {
  label: string;
  value: string;
  change: number;
  icon: React.ComponentType<any>;
  color: string;
}

export default function ReportsHub() {
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Get RBAC permissions using the hook
  const permissions = useReportPermissions();
  
  // Convert RBAC permissions to the expected UserPermissions format
  const userPermissions: UserPermissions = {
    canViewSalesReports: permissions.sales,
    canViewServiceReports: permissions.service,
    canViewFinancialReports: permissions.finance,
    canViewExecutiveReports: permissions.executive,
    canManageReports: permissions.canManage,
    territoryIds: permissions.territories,
    teamMemberIds: permissions.teamMembers
  };

  // Fetch high-level KPIs for dashboard overview
  const { data: kpiData } = useQuery({
    queryKey: ['/api/reports/kpis'],
    queryFn: () => apiRequest('/api/reports/kpis'),
  });

  // Define available report cards with RBAC
  const reportCards: ReportCard[] = [
    // Sales Reports
    {
      id: 'sales-performance',
      title: 'Sales Performance Analytics',
      description: 'Rep-specific pipeline analysis, conversion rates, and coaching insights',
      category: 'sales',
      icon: Target,
      route: '/reports/sales-performance-analytics',
      requiredPermission: 'canViewSalesReports',
      kpiValue: kpiData?.salesMetrics?.totalPipeline || '$0',
      kpiChange: kpiData?.salesMetrics?.pipelineChange || 0,
      priority: 'high'
    },
    {
      id: 'territory-analysis',
      title: 'Territory Performance',
      description: 'Geographic analysis, market penetration, and territory comparisons',
      category: 'sales',
      icon: BarChart3,
      route: '/reports/territory-analysis',
      requiredPermission: 'canViewSalesReports',
      kpiValue: kpiData?.salesMetrics?.territories || '0',
      kpiChange: kpiData?.salesMetrics?.territoryGrowth || 0
    },
    {
      id: 'pipeline-forecast',
      title: 'Pipeline Forecasting',
      description: 'Deal velocity, close probability, and revenue predictions',
      category: 'sales',
      icon: TrendingUp,
      route: '/reports/pipeline-forecast',
      requiredPermission: 'canViewSalesReports',
      kpiValue: kpiData?.salesMetrics?.forecastAccuracy || '0%',
      kpiChange: kpiData?.salesMetrics?.forecastChange || 0
    },
    
    // Service Reports
    {
      id: 'service-forecasting',
      title: 'Service Demand Forecasting',
      description: 'Predictive analytics for toner, maintenance, and service needs',
      category: 'service',
      icon: Zap,
      route: '/reports/service-forecasting-analytics',
      requiredPermission: 'canViewServiceReports',
      kpiValue: kpiData?.serviceMetrics?.predictedCalls || '0',
      kpiChange: kpiData?.serviceMetrics?.demandChange || 0,
      priority: 'high'
    },
    {
      id: 'technician-performance',
      title: 'Technician Performance',
      description: 'Utilization, efficiency, customer satisfaction, and scheduling optimization',
      category: 'service',
      icon: Users,
      route: '/reports/technician-performance',
      requiredPermission: 'canViewServiceReports',
      kpiValue: kpiData?.serviceMetrics?.avgUtilization || '0%',
      kpiChange: kpiData?.serviceMetrics?.utilizationChange || 0
    },
    {
      id: 'customer-health',
      title: 'Customer Health Score',
      description: 'Churn risk, satisfaction trends, and retention predictions',
      category: 'service',
      icon: Activity,
      route: '/reports/customer-health',
      requiredPermission: 'canViewServiceReports',
      kpiValue: kpiData?.serviceMetrics?.healthScore || '0',
      kpiChange: kpiData?.serviceMetrics?.healthChange || 0
    },
    
    // Financial Reports
    {
      id: 'financial-overview',
      title: 'Financial Intelligence',
      description: 'AR/AP monitoring, cash flow, profitability analysis, and alerts',
      category: 'finance',
      icon: DollarSign,
      route: '/reports/financial-intelligence',
      requiredPermission: 'canViewFinancialReports',
      kpiValue: kpiData?.financialMetrics?.monthlyRevenue || '$0',
      kpiChange: kpiData?.financialMetrics?.revenueChange || 0,
      priority: 'high'
    },
    {
      id: 'payment-monitoring',
      title: 'Payment Risk Monitor',
      description: 'Late payment alerts, dunning automation, and collection insights',
      category: 'finance',
      icon: AlertTriangle,
      route: '/reports/payment-monitoring',
      requiredPermission: 'canViewFinancialReports',
      kpiValue: kpiData?.financialMetrics?.overdueAmount || '$0',
      kpiChange: kpiData?.financialMetrics?.overdueChange || 0,
      priority: kpiData?.financialMetrics?.overdueAmount > 0 ? 'high' : 'low'
    },
    {
      id: 'profitability-analysis',
      title: 'Profitability Analytics',
      description: 'Customer, product, and territory profitability with optimization tips',
      category: 'finance',
      icon: PieChart,
      route: '/reports/profitability-analysis',
      requiredPermission: 'canViewFinancialReports',
      kpiValue: kpiData?.financialMetrics?.grossMargin || '0%',
      kpiChange: kpiData?.financialMetrics?.marginChange || 0
    },
    
    // Executive Reports
    {
      id: 'executive-dashboard',
      title: 'Executive Summary',
      description: 'Cross-functional KPIs, strategic insights, and performance scorecards',
      category: 'executive',
      icon: BarChart3,
      route: '/reports/executive-dashboard',
      requiredPermission: 'canViewExecutiveReports',
      priority: 'high'
    }
  ];

  // Filter reports based on permissions and category
  const filteredReports = reportCards.filter(report => {
    const hasPermission = userPermissions?.[report.requiredPermission] || false;
    const matchesCategory = selectedCategory === 'all' || report.category === selectedCategory;
    return hasPermission && matchesCategory;
  });

  // Quick KPIs for dashboard overview
  const dashboardKPIs: DashboardKPI[] = [
    {
      label: 'Monthly Revenue',
      value: kpiData?.overview?.monthlyRevenue || '$0',
      change: kpiData?.overview?.revenueChange || 0,
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      label: 'Active Deals',
      value: kpiData?.overview?.activeDeals || '0',
      change: kpiData?.overview?.dealsChange || 0,
      icon: Target,
      color: 'text-blue-600'
    },
    {
      label: 'Service Tickets',
      value: kpiData?.overview?.openTickets || '0',
      change: kpiData?.overview?.ticketsChange || 0,
      icon: Clock,
      color: 'text-orange-600'
    },
    {
      label: 'Customer Health',
      value: kpiData?.overview?.avgHealthScore || '0',
      change: kpiData?.overview?.healthChange || 0,
      icon: Activity,
      color: 'text-purple-600'
    }
  ];

  return (
    <MainLayout
      title="Reports & Analytics"
      description="Comprehensive business intelligence with role-based insights"
    >
      <div className="space-y-6">
        {/* Quick KPIs Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {dashboardKPIs.map((kpi, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold">{kpi.value}</p>
                    {kpi.change !== 0 && (
                      <p className={`text-xs ${kpi.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {kpi.change > 0 ? '+' : ''}{kpi.change}% from last month
                      </p>
                    )}
                  </div>
                  <kpi.icon className={`h-8 w-8 ${kpi.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Category Filter Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All Reports</TabsTrigger>
            <TabsTrigger value="sales" disabled={!userPermissions?.canViewSalesReports}>
              Sales
            </TabsTrigger>
            <TabsTrigger value="service" disabled={!userPermissions?.canViewServiceReports}>
              Service
            </TabsTrigger>
            <TabsTrigger value="finance" disabled={!userPermissions?.canViewFinancialReports}>
              Finance
            </TabsTrigger>
            <TabsTrigger value="executive" disabled={!userPermissions?.canViewExecutiveReports}>
              Executive
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => (
            <Card key={report.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${
                      report.category === 'sales' ? 'bg-blue-100' :
                      report.category === 'service' ? 'bg-green-100' :
                      report.category === 'finance' ? 'bg-purple-100' :
                      'bg-orange-100'
                    }`}>
                      <report.icon className={`h-5 w-5 ${
                        report.category === 'sales' ? 'text-blue-600' :
                        report.category === 'service' ? 'text-green-600' :
                        report.category === 'finance' ? 'text-purple-600' :
                        'text-orange-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        {report.description}
                      </CardDescription>
                    </div>
                  </div>
                  {report.priority && (
                    <Badge variant={
                      report.priority === 'high' ? 'destructive' :
                      report.priority === 'medium' ? 'secondary' : 'outline'
                    }>
                      {report.priority}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                {report.kpiValue && (
                  <div className="flex items-center justify-between mb-4 p-3 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Value</p>
                      <p className="text-lg font-semibold">{report.kpiValue}</p>
                    </div>
                    {report.kpiChange !== undefined && report.kpiChange !== 0 && (
                      <Badge variant={report.kpiChange > 0 ? 'default' : 'destructive'}>
                        {report.kpiChange > 0 ? '+' : ''}{report.kpiChange}%
                      </Badge>
                    )}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    className="flex-1"
                    onClick={() => setLocation(report.route)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Report
                  </Button>
                  <Button variant="outline" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* No Reports Message */}
        {filteredReports.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Reports Available</h3>
                <p className="text-muted-foreground mb-4">
                  {selectedCategory === 'all' 
                    ? "You don't have permission to view any reports. Contact your administrator."
                    : `No ${selectedCategory} reports are available for your role.`
                  }
                </p>
                {userPermissions?.canManageReports && (
                  <Button variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Reports
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}