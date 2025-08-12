import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Target, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Phone,
  Calendar,
  DollarSign,
  Award,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  Minus,
  Filter,
  Download,
  RefreshCw,
  MessageSquare,
  Lightbulb
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList } from 'recharts';
import AdvancedFilter, { type FilterValue, type FilterOption } from '@/components/reports/AdvancedFilter';
import { 
  TrendLineChart, 
  ComparisonBarChart, 
  KPICard, 
  SalesFunnelChart,
  chartExportUtils 
} from '@/components/reports/DataVisualization';
import { 
  type BusinessRecord,
  type Deal,
  type ServiceTicket
} from '@shared/schema';

// Sales rep performance data types
interface SalesRep {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  territory?: string;
  managerId?: string;
  hireDate: string;
  performance: SalesPerformance;
  coaching: CoachingInsights;
}

interface SalesPerformance {
  // Pipeline metrics
  totalPipelineValue: number;
  dealsInPipeline: number;
  avgDealSize: number;
  
  // Conversion rates
  leadToMeetingRate: number;
  meetingToProposalRate: number;
  proposalToCloseRate: number;
  overallCloseRate: number;
  
  // Activity metrics
  callsMade: number;
  emailsSent: number;
  meetingsHeld: number;
  proposalsSent: number;
  
  // Performance vs peers
  rankingPercentile: number;
  peerComparison: 'above' | 'average' | 'below';
  
  // Time-based metrics
  avgDealCycle: number; // days
  avgResponseTime: number; // hours
  
  // Revenue metrics
  monthlyRevenue: number;
  quarterlyRevenue: number;
  revenueTarget: number;
  revenueAttainment: number;
}

interface CoachingInsights {
  strengths: string[];
  improvementAreas: string[];
  recommendations: CoachingRecommendation[];
  skillAssessment: SkillAssessment;
}

interface CoachingRecommendation {
  area: string;
  issue: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  impact: string;
}

interface SkillAssessment {
  prospecting: number; // 1-10 score
  qualifying: number;
  presenting: number;
  objectionHandling: number;
  closing: number;
  followUp: number;
}

// Pipeline funnel data
interface PipelineFunnel {
  stage: string;
  value: number;
  count: number;
  conversionRate: number;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

export default function SalesPerformanceAnalytics() {
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'ytd'>('30d');
  const [viewMode, setViewMode] = useState<'overview' | 'individual' | 'coaching'>('overview');
  const [filters, setFilters] = useState<FilterValue[]>([]);

  // Advanced filter configuration
  const filterOptions: FilterOption[] = [
    {
      id: 'territory',
      label: 'Territory',
      type: 'multiselect',
      options: [
        { value: 'north', label: 'North Territory' },
        { value: 'south', label: 'South Territory' },
        { value: 'east', label: 'East Territory' },
        { value: 'west', label: 'West Territory' }
      ]
    },
    {
      id: 'performanceLevel',
      label: 'Performance Level',
      type: 'select',
      options: [
        { value: 'top', label: 'Top Performers (80%+)' },
        { value: 'middle', label: 'Middle Performers (50-80%)' },
        { value: 'bottom', label: 'Bottom Performers (<50%)' }
      ]
    },
    {
      id: 'revenueRange',
      label: 'Monthly Revenue Range',
      type: 'slider',
      min: 0,
      max: 500000,
      step: 10000
    },
    {
      id: 'dealSizeMin',
      label: 'Minimum Deal Size',
      type: 'number',
      min: 0,
      placeholder: 'Enter minimum deal size'
    },
    {
      id: 'closeRateMin',
      label: 'Minimum Close Rate (%)',
      type: 'number',
      min: 0,
      max: 100,
      placeholder: 'Enter minimum close rate'
    },
    {
      id: 'hireDate',
      label: 'Hire Date Range',
      type: 'dateRange'
    },
    {
      id: 'hasCoachingNeeds',
      label: 'Needs Coaching',
      type: 'boolean'
    }
  ];
  
  // Fetch sales reps (filtered by manager permissions)
  const { data: salesReps = [], isLoading: repsLoading } = useQuery<SalesRep[]>({
    queryKey: ['/api/reports/sales-reps', dateRange],
    queryFn: () => apiRequest(`/api/reports/sales-reps?period=${dateRange}`),
  });

  // Fetch team performance metrics
  const { data: teamMetrics } = useQuery({
    queryKey: ['/api/reports/team-performance', selectedRep, dateRange],
    queryFn: () => apiRequest(`/api/reports/team-performance?rep=${selectedRep}&period=${dateRange}`),
  });

  // Fetch pipeline funnel data
  const { data: pipelineFunnel = [] } = useQuery<PipelineFunnel[]>({
    queryKey: ['/api/reports/pipeline-funnel', selectedRep, dateRange],
    queryFn: () => apiRequest(`/api/reports/pipeline-funnel?rep=${selectedRep}&period=${dateRange}`),
  });

  // Get selected rep details
  const currentRep = salesReps.find(rep => rep.id === selectedRep);

  // Filter handling functions
  const handleFiltersChange = (newFilters: FilterValue[]) => {
    setFilters(newFilters);
  };

  const handleFiltersReset = () => {
    setFilters([]);
  };

  const handleExportData = () => {
    const exportData = salesReps.map(rep => ({
      name: `${rep.firstName} ${rep.lastName}`,
      territory: rep.territory || 'N/A',
      revenue: rep.performance.monthlyRevenue,
      quota_attainment: rep.performance.revenueAttainment,
      close_rate: rep.performance.overallCloseRate,
      pipeline_value: rep.performance.totalPipelineValue,
      deals_in_pipeline: rep.performance.dealsInPipeline
    }));
    chartExportUtils.exportToCSV(exportData, 'sales-performance-data');
  };
  
  // Performance trend colors
  const getTrendColor = (value: number, benchmark: number) => {
    if (value >= benchmark * 1.1) return 'text-green-600';
    if (value >= benchmark * 0.9) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTrendIcon = (value: number, benchmark: number) => {
    if (value >= benchmark * 1.1) return ArrowUp;
    if (value >= benchmark * 0.9) return Minus;
    return ArrowDown;
  };

  // Coaching priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <MainLayout
      title="Sales Performance Analytics"
      description="Rep-specific insights and coaching recommendations for sales managers"
    >
      <div className="space-y-6">
        {/* Basic Controls */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col md:flex-row gap-4">
                <Select value={selectedRep} onValueChange={setSelectedRep}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Select sales rep" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Team Members</SelectItem>
                    {salesReps.map(rep => (
                      <SelectItem key={rep.id} value={rep.id}>
                        {rep.firstName} {rep.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="ytd">Year to date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportData}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Filters */}
        <AdvancedFilter
          filters={filterOptions}
          values={filters}
          onFiltersChange={handleFiltersChange}
          onReset={handleFiltersReset}
          onExport={handleExportData}
        />

        {/* View Mode Tabs */}
        <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
          <TabsList>
            <TabsTrigger value="overview">Team Overview</TabsTrigger>
            <TabsTrigger value="individual" disabled={selectedRep === 'all'}>
              Individual Analysis
            </TabsTrigger>
            <TabsTrigger value="coaching" disabled={selectedRep === 'all'}>
              Coaching Insights
            </TabsTrigger>
          </TabsList>

          {/* Team Overview */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Performance Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Team Pipeline"
                value={`$${teamMetrics?.totalPipeline?.toLocaleString() || '0'}`}
                change={teamMetrics?.pipelineGrowth || 0}
                icon={Target}
                trend={teamMetrics?.pipelineGrowth > 0 ? 'up' : teamMetrics?.pipelineGrowth < 0 ? 'down' : 'neutral'}
              />
              
              <KPICard
                title="Avg Close Rate"
                value={`${teamMetrics?.avgCloseRate || 0}%`}
                change={teamMetrics?.closeRateChange || 0}
                period="vs benchmark"
                icon={Award}
                trend={teamMetrics?.closeRateChange > 0 ? 'up' : teamMetrics?.closeRateChange < 0 ? 'down' : 'neutral'}
              />

              <KPICard
                title="Team Quota Attainment"
                value={`${teamMetrics?.quotaAttainment || 0}%`}
                icon={TrendingUp}
              />

              <KPICard
                title="Avg Deal Cycle"
                value={`${teamMetrics?.avgDealCycle || 0} days`}
                change={teamMetrics?.dealCycleChange || 0}
                period="vs target"
                icon={Clock}
                trend={teamMetrics?.dealCycleChange <= 0 ? 'up' : 'down'}
              />
            </div>

            {/* Team Performance Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Funnel */}
              <SalesFunnelChart
                data={pipelineFunnel}
                dataKey="count"
                nameKey="stage"
                config={{
                  title: 'Team Sales Funnel',
                  description: 'Conversion rates at each pipeline stage',
                  height: 350
                }}
                onExport={() => chartExportUtils.exportToCSV(pipelineFunnel, 'sales-funnel-data')}
              />

              {/* Rep Performance Ranking */}
              <Card>
                <CardHeader>
                  <CardTitle>Rep Performance Ranking</CardTitle>
                  <CardDescription>Individual performance vs quota attainment</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {salesReps.slice(0, 6).map((rep, index) => (
                      <div key={rep.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <div>
                            <p className="font-medium">{rep.firstName} {rep.lastName}</p>
                            <p className="text-sm text-muted-foreground">{rep.territory}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{rep.performance.revenueAttainment}%</p>
                          <p className="text-sm text-muted-foreground">
                            ${rep.performance.monthlyRevenue.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Individual Analysis */}
          <TabsContent value="individual" className="space-y-6">
            {currentRep && (
              <>
                {/* Rep Profile Header */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">
                            {currentRep.firstName} {currentRep.lastName}
                          </h2>
                          <p className="text-muted-foreground">{currentRep.territory} Territory</p>
                        </div>
                      </div>
                      <Badge variant={
                        currentRep.performance.peerComparison === 'above' ? 'default' :
                        currentRep.performance.peerComparison === 'average' ? 'secondary' :
                        'destructive'
                      }>
                        {currentRep.performance.rankingPercentile}th Percentile
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Revenue Performance */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Revenue Attainment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold">
                            {currentRep.performance.revenueAttainment}%
                          </span>
                          <Badge variant={currentRep.performance.revenueAttainment >= 100 ? 'default' : 'secondary'}>
                            {currentRep.performance.revenueAttainment >= 100 ? 'On Track' : 'Below Target'}
                          </Badge>
                        </div>
                        <Progress value={currentRep.performance.revenueAttainment} />
                        <div className="text-sm text-muted-foreground">
                          ${currentRep.performance.monthlyRevenue.toLocaleString()} / 
                          ${currentRep.performance.revenueTarget.toLocaleString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pipeline Metrics */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Pipeline Health</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Total Value:</span>
                          <span className="font-medium">
                            ${currentRep.performance.totalPipelineValue.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Active Deals:</span>
                          <span className="font-medium">{currentRep.performance.dealsInPipeline}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Avg Deal Size:</span>
                          <span className="font-medium">
                            ${currentRep.performance.avgDealSize.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Deal Cycle:</span>
                          <span className="font-medium">{currentRep.performance.avgDealCycle} days</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Activity Metrics */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Activity Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Calls Made:</span>
                          <span className="font-medium">{currentRep.performance.callsMade}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Meetings Held:</span>
                          <span className="font-medium">{currentRep.performance.meetingsHeld}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Proposals Sent:</span>
                          <span className="font-medium">{currentRep.performance.proposalsSent}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Response Time:</span>
                          <span className="font-medium">{currentRep.performance.avgResponseTime}h</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Conversion Funnel Analysis */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Conversion Funnel</CardTitle>
                      <CardDescription>Stage-by-stage conversion performance</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Lead → Meeting</span>
                            <Badge variant={currentRep.performance.leadToMeetingRate >= 25 ? 'default' : 'secondary'}>
                              {currentRep.performance.leadToMeetingRate}%
                            </Badge>
                          </div>
                          <Progress value={currentRep.performance.leadToMeetingRate} />
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Meeting → Proposal</span>
                            <Badge variant={currentRep.performance.meetingToProposalRate >= 60 ? 'default' : 'secondary'}>
                              {currentRep.performance.meetingToProposalRate}%
                            </Badge>
                          </div>
                          <Progress value={currentRep.performance.meetingToProposalRate} />
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Proposal → Close</span>
                            <Badge variant={currentRep.performance.proposalToCloseRate >= 30 ? 'default' : 'secondary'}>
                              {currentRep.performance.proposalToCloseRate}%
                            </Badge>
                          </div>
                          <Progress value={currentRep.performance.proposalToCloseRate} />
                        </div>

                        <div className="pt-3 border-t">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Overall Close Rate</span>
                            <Badge variant={currentRep.performance.overallCloseRate >= 15 ? 'default' : 'destructive'}>
                              {currentRep.performance.overallCloseRate}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Skills Assessment Radar */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Skills Assessment</CardTitle>
                      <CardDescription>Core sales competency evaluation</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(currentRep.coaching.skillAssessment).map(([skill, score]) => (
                          <div key={skill} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="capitalize">{skill.replace(/([A-Z])/g, ' $1')}</span>
                              <span className="font-medium">{score}/10</span>
                            </div>
                            <Progress value={score * 10} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Coaching Insights */}
          <TabsContent value="coaching" className="space-y-6">
            {currentRep && (
              <>
                {/* Coaching Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-yellow-500" />
                      Coaching Insights for {currentRep.firstName} {currentRep.lastName}
                    </CardTitle>
                    <CardDescription>
                      AI-powered recommendations based on performance analysis
                    </CardDescription>
                  </CardHeader>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Strengths */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-5 w-5" />
                        Strengths
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {currentRep.coaching.strengths.map((strength, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm">{strength}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Improvement Areas */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-orange-700">
                        <AlertTriangle className="h-5 w-5" />
                        Focus Areas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {currentRep.coaching.improvementAreas.map((area, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm">{area}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Coaching Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle>Actionable Recommendations</CardTitle>
                    <CardDescription>Specific coaching suggestions with expected impact</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {currentRep.coaching.recommendations.map((rec, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">{rec.area}</h4>
                            <Badge variant={getPriorityColor(rec.priority)}>
                              {rec.priority} priority
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-red-700">Issue: </span>
                              <span>{rec.issue}</span>
                            </div>
                            <div>
                              <span className="font-medium text-blue-700">Suggestion: </span>
                              <span>{rec.suggestion}</span>
                            </div>
                            <div>
                              <span className="font-medium text-green-700">Expected Impact: </span>
                              <span>{rec.impact}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}