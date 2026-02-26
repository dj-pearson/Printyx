import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Heart,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  DollarSign,
  Activity,
  BarChart3,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { Link } from 'wouter';

interface TenantHealth {
  id: string;
  tenantId: string;
  companyName: string;
  healthScore: number;
  healthGrade: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  churnRisk: 'low' | 'medium' | 'high' | 'critical';
  churnProbability: number;

  // Engagement metrics
  lastLoginDate?: string;
  activeUsers: number;
  totalUsers: number;
  loginFrequency: number;
  featureAdoption: number;

  // Financial metrics
  mrr: string;
  contractValue: string;
  contractEndDate?: string;
  daysUntilRenewal?: number;

  // Support metrics
  openTickets: number;
  avgResponseTime?: number;
  satisfactionScore?: number;

  // Onboarding
  onboardingStatus: 'not_started' | 'in_progress' | 'completed';
  onboardingProgress: number;

  // CSM assignment
  csmId?: string;
  csmName?: string;

  createdAt: string;
  updatedAt: string;
}

interface HealthMetrics {
  totalTenants: number;
  healthyTenants: number;
  atRiskTenants: number;
  criticalTenants: number;
  avgHealthScore: number;
  avgChurnRisk: number;
  totalMRR: string;
  activeUsers: number;
  avgSatisfaction: number;
}

const HEALTH_GRADE_CONFIG = {
  excellent: {
    label: 'Excellent',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: CheckCircle,
  },
  good: { label: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: TrendingUp },
  fair: { label: 'Fair', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: AlertTriangle },
  poor: { label: 'Poor', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: TrendingDown },
  critical: {
    label: 'Critical',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: AlertTriangle,
  },
};

const CHURN_RISK_CONFIG = {
  low: { label: 'Low Risk', variant: 'default' as const, color: 'text-green-600' },
  medium: { label: 'Medium Risk', variant: 'secondary' as const, color: 'text-yellow-600' },
  high: { label: 'High Risk', variant: 'destructive' as const, color: 'text-orange-600' },
  critical: { label: 'Critical Risk', variant: 'destructive' as const, color: 'text-red-600' },
};

export default function PlatformCustomerSuccess() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedCSM, setSelectedCSM] = useState<string>('');

  // Fetch tenant health data
  const { data: tenants = [], isLoading } = useQuery<TenantHealth[]>({
    queryKey: ['/api/platform-cs/health-scores', selectedFilter, selectedCSM],
  });

  // Fetch overall metrics
  const { data: metrics } = useQuery<HealthMetrics>({
    queryKey: ['/api/platform-cs/metrics'],
  });

  // Fetch available CSMs
  const { data: csms = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/platform-cs/csms'],
  });

  // Filter tenants
  const filteredTenants = tenants.filter((tenant) => {
    const matchesFilter =
      selectedFilter === 'all' ||
      (selectedFilter === 'at_risk' &&
        (tenant.churnRisk === 'high' || tenant.churnRisk === 'critical')) ||
      (selectedFilter === 'healthy' && tenant.healthGrade === 'excellent') ||
      tenant.healthGrade === 'good' ||
      (selectedFilter === 'onboarding' && tenant.onboardingStatus !== 'completed') ||
      (selectedFilter === 'renewal' && tenant.daysUntilRenewal && tenant.daysUntilRenewal <= 60);

    const matchesCSM = !selectedCSM || tenant.csmId === selectedCSM;

    return matchesFilter && matchesCSM;
  });

  // Calculate filter counts
  const filterCounts = {
    all: tenants.length,
    healthy: tenants.filter((t) => t.healthGrade === 'excellent' || t.healthGrade === 'good')
      .length,
    at_risk: tenants.filter((t) => t.churnRisk === 'high' || t.churnRisk === 'critical').length,
    onboarding: tenants.filter((t) => t.onboardingStatus !== 'completed').length,
    renewal: tenants.filter((t) => t.daysUntilRenewal && t.daysUntilRenewal <= 60).length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading customer success data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-2">
              <Heart className="h-8 w-8 text-primary" />
              Customer Success Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Monitor tenant health, engagement, and churn risk
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedCSM} onValueChange={setSelectedCSM}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All CSMs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All CSMs</SelectItem>
                {csms.map((csm) => (
                  <SelectItem key={csm.id} value={csm.id}>
                    {csm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{metrics.totalTenants}</span>
                <Users className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-green-600">{metrics.healthyTenants} healthy</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-red-600">{metrics.criticalTenants} critical</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Health Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{metrics.avgHealthScore.toFixed(0)}</span>
                <Heart className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
              <Progress value={metrics.avgHealthScore} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total MRR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">
                  ${parseFloat(metrics.totalMRR).toLocaleString()}
                </span>
                <DollarSign className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
              <p className="text-sm text-muted-foreground mt-2">Monthly recurring revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Satisfaction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{metrics.avgSatisfaction.toFixed(1)}/5</span>
                <Activity className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
              <Progress value={(metrics.avgSatisfaction / 5) * 100} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* At-Risk Tenants Alert */}
      {filterCounts.at_risk > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900">
                    {filterCounts.at_risk} tenant(s) at high churn risk
                  </p>
                  <p className="text-sm text-red-700">Immediate action required to prevent churn</p>
                </div>
              </div>
              <Button variant="destructive" onClick={() => setSelectedFilter('at_risk')}>
                View At-Risk Tenants
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tenant Health Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tenant Health Overview</CardTitle>
              <CardDescription>Monitor health scores and engagement metrics</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedFilter} onValueChange={setSelectedFilter}>
            <TabsList>
              <TabsTrigger value="all">All ({filterCounts.all})</TabsTrigger>
              <TabsTrigger value="healthy">Healthy ({filterCounts.healthy})</TabsTrigger>
              <TabsTrigger value="at_risk">At Risk ({filterCounts.at_risk})</TabsTrigger>
              <TabsTrigger value="onboarding">Onboarding ({filterCounts.onboarding})</TabsTrigger>
              <TabsTrigger value="renewal">Renewal ({filterCounts.renewal})</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedFilter} className="mt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Churn Risk</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead>MRR</TableHead>
                    <TableHead>CSM</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No tenants found matching the selected filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTenants.map((tenant) => {
                      const gradeConfig = HEALTH_GRADE_CONFIG[tenant.healthGrade];
                      const riskConfig = CHURN_RISK_CONFIG[tenant.churnRisk];
                      const GradeIcon = gradeConfig.icon;

                      return (
                        <TableRow key={tenant.id}>
                          <TableCell>
                            <div>
                              <Link href={`/platform-crm/business-records/${tenant.tenantId}`}>
                                <a className="font-medium hover:underline">{tenant.companyName}</a>
                              </Link>
                              <div className="text-sm text-muted-foreground">
                                ID: {tenant.tenantId}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`p-1 rounded ${gradeConfig.bgColor}`}>
                                <GradeIcon className={`h-4 w-4 ${gradeConfig.color}`} />
                              </div>
                              <div>
                                <div className="font-medium">{tenant.healthScore}</div>
                                <div className="text-xs text-muted-foreground">
                                  {gradeConfig.label}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <Badge variant={riskConfig.variant} className="mb-1">
                                {riskConfig.label}
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                {tenant.churnProbability.toFixed(0)}% probability
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="h-3 w-3" />
                                <span>
                                  {tenant.activeUsers}/{tenant.totalUsers} users
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Zap className="h-3 w-3" />
                                <span>{tenant.featureAdoption}% adoption</span>
                              </div>
                              {tenant.lastLoginDate && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>{new Date(tenant.lastLoginDate).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                ${parseFloat(tenant.mrr).toLocaleString()}
                              </div>
                              {tenant.daysUntilRenewal !== undefined && (
                                <div className="text-xs text-muted-foreground">
                                  Renewal in {tenant.daysUntilRenewal} days
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {tenant.csmName || (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {tenant.onboardingStatus === 'completed' ? (
                              <Badge variant="outline">Active</Badge>
                            ) : (
                              <div>
                                <Badge variant="secondary">Onboarding</Badge>
                                <Progress value={tenant.onboardingProgress} className="mt-1 w-20" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/platform-crm/business-records/${tenant.tenantId}`}>
                              <Button variant="ghost" size="sm">
                                View Details
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Health Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Health Score Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(HEALTH_GRADE_CONFIG).map(([grade, config]) => {
                const count = tenants.filter((t) => t.healthGrade === grade).length;
                const percentage = tenants.length > 0 ? (count / tenants.length) * 100 : 0;

                return (
                  <div key={grade}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${config.bgColor}`}></div>
                        <span className="text-sm font-medium">{config.label}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Churn Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(CHURN_RISK_CONFIG).map(([risk, config]) => {
                const count = tenants.filter((t) => t.churnRisk === risk).length;
                const percentage = tenants.length > 0 ? (count / tenants.length) * 100 : 0;

                return (
                  <div key={risk}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={config.variant} className="w-24 justify-center">
                          {config.label}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
