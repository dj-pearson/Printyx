import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Target, DollarSign, Users, BarChart3, Calendar, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface SalesForecast {
  id: string;
  forecastName: string;
  forecastType: string;
  startDate: Date;
  endDate: Date;
  revenueTarget: number;
  unitTarget: number;
  dealCountTarget: number;
  actualRevenue: number;
  actualUnits: number;
  actualDeals: number;
  pipelineValue: number;
  weightedPipelineValue: number;
  probabilityAdjustedRevenue: number;
  confidenceLevel: string;
  confidencePercentage: number;
  conversionRate: number;
  averageDealSize: number;
  salesCycleLength: number;
  status: string;
  achievementPercentage: number;
  projectedRevenue: number;
  gapToTarget: number;
  createdAt: Date;
}

interface PipelineItem {
  id: string;
  dealName: string;
  dealValue: number;
  stage: string;
  closeProbability: number;
  expectedCloseDate: Date;
  customerName: string;
  salesRep: string;
  equipmentTypes: string[];
  riskLevel: string;
  weightedValue: number;
  daysInStage: number;
}

const getStageColor = (stage: string) => {
  switch (stage) {
    case 'prospect': return 'bg-gray-100 text-gray-800';
    case 'qualified': return 'bg-blue-100 text-blue-800';
    case 'proposal': return 'bg-yellow-100 text-yellow-800';
    case 'negotiation': return 'bg-orange-100 text-orange-800';
    case 'closed_won': return 'bg-green-100 text-green-800';
    case 'closed_lost': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'low': return 'bg-green-100 text-green-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'high': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const STAGE_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

export default function SalesPipelineForecasting() {
  const [isCreateForecastOpen, setIsCreateForecastOpen] = useState(false);
  const [selectedForecastId, setSelectedForecastId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue } = useForm();

  // Fetch sales forecasts
  const { data: forecasts = [], isLoading: forecastsLoading } = useQuery({
    queryKey: ['/api/sales-forecasts'],
    select: (data: any[]) => data.map(forecast => ({
      ...forecast,
      startDate: new Date(forecast.startDate),
      endDate: new Date(forecast.endDate),
      createdAt: new Date(forecast.createdAt)
    }))
  });

  // Fetch pipeline items for selected forecast
  const { data: pipelineItems = [] } = useQuery<PipelineItem[]>({
    queryKey: ['/api/sales-forecasts', selectedForecastId, 'pipeline'],
    enabled: !!selectedForecastId,
    select: (data: any[]) => data.map(item => ({
      ...item,
      expectedCloseDate: new Date(item.expectedCloseDate)
    }))
  });

  // Fetch performance metrics
  const { data: performanceMetrics = [] } = useQuery({
    queryKey: ['/api/sales-performance-metrics']
  });

  // Fetch sales trends
  const { data: salesTrends = [] } = useQuery({
    queryKey: ['/api/sales-trends'],
    queryFn: () => apiRequest('/api/sales-trends?months=6')
  });

  // Create forecast mutation
  const createForecastMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/sales-forecasts', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-forecasts'] });
      setIsCreateForecastOpen(false);
      reset();
      toast({
        title: "Forecast Created",
        description: "Sales forecast has been created successfully.",
      });
    }
  });

  const onSubmit = (data: any) => {
    createForecastMutation.mutate({
      ...data,
      revenueTarget: parseFloat(data.revenueTarget),
      unitTarget: parseInt(data.unitTarget),
      dealCountTarget: parseInt(data.dealCountTarget)
    });
  };

  if (forecastsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading sales forecasts...</p>
          </div>
        </div>
      </div>
    );
  }

  const activeForecast = forecasts.find(f => f.status === 'active') || forecasts[0];
  const currentPipelineStages = pipelineItems.reduce((acc, item) => {
    acc[item.stage] = (acc[item.stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stageData = Object.entries(currentPipelineStages).map(([stage, count], index) => ({
    name: stage.replace('_', ' ').toUpperCase(),
    value: count,
    fill: STAGE_COLORS[index % STAGE_COLORS.length]
  }));

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Pipeline Forecasting</h1>
          <p className="text-gray-600 mt-2">Advanced sales analytics and pipeline forecasting</p>
        </div>
        
        <Dialog open={isCreateForecastOpen} onOpenChange={setIsCreateForecastOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Forecast
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Sales Forecast</DialogTitle>
              <DialogDescription>
                Set targets and create a new sales forecast period.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forecastName">Forecast Name</Label>
                <Input
                  placeholder="Q1 2025 Forecast"
                  {...register('forecastName', { required: true })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="forecastType">Type</Label>
                  <Select onValueChange={(value) => setValue('forecastType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="revenueTarget">Revenue Target ($)</Label>
                  <Input
                    type="number"
                    placeholder="500000"
                    {...register('revenueTarget', { required: true })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    type="date"
                    {...register('startDate', { required: true })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    type="date"
                    {...register('endDate', { required: true })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unitTarget">Unit Target</Label>
                  <Input
                    type="number"
                    placeholder="25"
                    {...register('unitTarget', { required: true })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dealCountTarget">Deal Count Target</Label>
                  <Input
                    type="number"
                    placeholder="15"
                    {...register('dealCountTarget', { required: true })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateForecastOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createForecastMutation.isPending}>
                  {createForecastMutation.isPending ? 'Creating...' : 'Create Forecast'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {activeForecast && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue Progress</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${activeForecast.actualRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                of ${activeForecast.revenueTarget.toLocaleString()} target
              </p>
              <Progress 
                value={activeForecast.achievementPercentage} 
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {activeForecast.achievementPercentage.toFixed(1)}% achieved
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${activeForecast.weightedPipelineValue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                ${activeForecast.pipelineValue.toLocaleString()} total pipeline
              </p>
              <div className="flex items-center mt-2">
                <Badge variant="outline" className="text-xs">
                  {activeForecast.confidenceLevel} confidence
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deals Closed</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activeForecast.actualDeals}
              </div>
              <p className="text-xs text-muted-foreground">
                of {activeForecast.dealCountTarget} target
              </p>
              <div className="flex items-center mt-2">
                <span className="text-xs text-green-600">
                  Avg: ${activeForecast.averageDealSize.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activeForecast.conversionRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {activeForecast.salesCycleLength} day avg cycle
              </p>
              <div className="flex items-center mt-2">
                <Badge variant={activeForecast.conversionRate >= 40 ? "default" : "secondary"} className="text-xs">
                  {activeForecast.conversionRate >= 40 ? "Above Target" : "Below Target"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline Analysis</TabsTrigger>
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
          <TabsTrigger value="trends">Performance Trends</TabsTrigger>
          <TabsTrigger value="analytics">Advanced Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Pipeline by Stage</CardTitle>
                <CardDescription>Distribution of deals across sales stages</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stageData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {stageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sales Trends</CardTitle>
                <CardDescription>Revenue performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={salesTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monthName" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']} />
                    <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Active Pipeline Deals</CardTitle>
              <CardDescription>Current opportunities in the sales pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              {pipelineItems.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No pipeline data available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pipelineItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{item.dealName}</h4>
                        <p className="text-sm text-gray-600">{item.customerName} • {item.salesRep}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={getStageColor(item.stage)}>
                            {item.stage.replace('_', ' ')}
                          </Badge>
                          <Badge className={getRiskColor(item.riskLevel)}>
                            {item.riskLevel} risk
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {item.daysInStage} days in stage
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${item.dealValue.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">{item.closeProbability}% probability</div>
                        <div className="text-xs text-gray-500">
                          Expected: {format(item.expectedCloseDate, 'MMM dd')}
                        </div>
                        <div className="text-xs font-medium text-green-600">
                          Weighted: ${item.weightedValue.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecasts">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {forecasts.map((forecast) => (
              <Card key={forecast.id} className="cursor-pointer hover:shadow-md transition-shadow" 
                    onClick={() => setSelectedForecastId(forecast.id)}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{forecast.forecastName}</CardTitle>
                      <CardDescription>
                        {format(forecast.startDate, 'MMM dd')} - {format(forecast.endDate, 'MMM dd, yyyy')}
                      </CardDescription>
                    </div>
                    <Badge variant={forecast.status === 'active' ? 'default' : 'secondary'}>
                      {forecast.status}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Revenue Progress</span>
                      <span>{forecast.achievementPercentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={forecast.achievementPercentage} />
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>${forecast.actualRevenue.toLocaleString()}</span>
                      <span>${forecast.revenueTarget.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-medium">{forecast.actualDeals}</div>
                      <div className="text-xs text-gray-600">Deals</div>
                    </div>
                    <div>
                      <div className="text-lg font-medium">{forecast.actualUnits}</div>
                      <div className="text-xs text-gray-600">Units</div>
                    </div>
                    <div>
                      <div className="text-lg font-medium">{forecast.confidencePercentage}%</div>
                      <div className="text-xs text-gray-600">Confidence</div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm text-gray-600">
                      Pipeline: ${forecast.weightedPipelineValue.toLocaleString()}
                    </span>
                    <Button size="sm" variant="outline">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends Analysis</CardTitle>
              <CardDescription>Historical performance metrics and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={salesTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monthName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
                  <Bar dataKey="pipelineValue" fill="#82ca9d" name="Pipeline Value" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
                <CardDescription>Lead to close conversion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Leads Generated</span>
                    <span className="font-medium">100</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Qualified Opportunities</span>
                    <span className="font-medium">32 (32%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Proposals Sent</span>
                    <span className="font-medium">16 (16%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Deals Closed</span>
                    <span className="font-medium">6 (6%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sales Velocity</CardTitle>
                <CardDescription>Average time in each stage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Prospect</span>
                    <span className="font-medium">12 days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Qualified</span>
                    <span className="font-medium">18 days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Proposal</span>
                    <span className="font-medium">8 days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Negotiation</span>
                    <span className="font-medium">5 days</span>
                  </div>
                  <div className="flex justify-between items-center font-medium border-t pt-2">
                    <span>Total Cycle</span>
                    <span>43 days</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}