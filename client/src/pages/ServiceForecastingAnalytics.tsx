import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Package,
  Wrench,
  Users,
  MapPin,
  Calendar,
  Target,
  Activity,
  Bell,
  Filter,
  Download,
  RefreshCw,
  Truck
} from 'lucide-react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { 
  type ServiceTicket,
  type Equipment,
  type Technician,
  type BusinessRecord
} from '@shared/schema';

// Service forecasting data types
interface ServiceForecast {
  customerId: string;
  customerName: string;
  equipmentId: string;
  equipmentModel: string;
  forecastType: 'toner' | 'maintenance' | 'repair' | 'contract_renewal';
  predictedDate: string;
  confidence: number; // 0-100
  priority: 'high' | 'medium' | 'low';
  estimatedCost: number;
  lastServiceDate?: string;
  usagePattern: UsagePattern;
  riskFactors: string[];
}

interface UsagePattern {
  monthlyVolume: number;
  weeklyTrend: number[];
  seasonalFactor: number;
  growthRate: number;
}

interface CustomerHealthScore {
  customerId: string;
  customerName: string;
  healthScore: number; // 0-100
  churnRisk: 'low' | 'medium' | 'high';
  satisfactionScore: number;
  responseTime: number;
  contractStatus: string;
  lastServiceDate: string;
  upcomingRenewals: ContractRenewal[];
  recommendations: string[];
}

interface ContractRenewal {
  contractId: string;
  renewalDate: string;
  value: number;
  renewalProbability: number;
}

interface TechnicianCapacity {
  technicianId: string;
  name: string;
  currentUtilization: number;
  forecastedUtilization: number;
  skills: string[];
  territory: string;
  upcomingAssignments: number;
  recommendedActions: string[];
}

interface InventoryForecast {
  itemId: string;
  itemName: string;
  currentStock: number;
  predictedDemand: number;
  stockoutRisk: number;
  reorderDate: string;
  optimalQuantity: number;
  estimatedCost: number;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

export default function ServiceForecastingAnalytics() {
  const [timeHorizon, setTimeHorizon] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedTerritory, setSelectedTerritory] = useState<string>('all');
  const [forecastType, setForecastType] = useState<'all' | 'toner' | 'maintenance' | 'repair'>('all');
  
  // Fetch service forecasts
  const { data: forecasts = [], isLoading: forecastsLoading } = useQuery<ServiceForecast[]>({
    queryKey: ['/api/reports/service-forecasts', timeHorizon, selectedTerritory, forecastType],
    queryFn: () => apiRequest(`/api/reports/service-forecasts?horizon=${timeHorizon}&territory=${selectedTerritory}&type=${forecastType}`),
  });

  // Fetch customer health scores
  const { data: customerHealth = [] } = useQuery<CustomerHealthScore[]>({
    queryKey: ['/api/reports/customer-health', selectedTerritory],
    queryFn: () => apiRequest(`/api/reports/customer-health?territory=${selectedTerritory}`),
  });

  // Fetch technician capacity
  const { data: techCapacity = [] } = useQuery<TechnicianCapacity[]>({
    queryKey: ['/api/reports/technician-capacity', timeHorizon, selectedTerritory],
    queryFn: () => apiRequest(`/api/reports/technician-capacity?horizon=${timeHorizon}&territory=${selectedTerritory}`),
  });

  // Fetch inventory forecasts
  const { data: inventoryForecasts = [] } = useQuery<InventoryForecast[]>({
    queryKey: ['/api/reports/inventory-forecast', timeHorizon],
    queryFn: () => apiRequest(`/api/reports/inventory-forecast?horizon=${timeHorizon}`),
  });

  // Fetch summary metrics
  const { data: summaryMetrics } = useQuery({
    queryKey: ['/api/reports/service-summary', timeHorizon, selectedTerritory],
    queryFn: () => apiRequest(`/api/reports/service-summary?horizon=${timeHorizon}&territory=${selectedTerritory}`),
  });

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  // Get health score color
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get churn risk color
  const getChurnRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <MainLayout
      title="Service Demand Forecasting"
      description="Predictive analytics for proactive customer service management"
    >
      <div className="space-y-6">
        {/* Filters and Controls */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col md:flex-row gap-4">
                <Select value={timeHorizon} onValueChange={(value: any) => setTimeHorizon(value)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Next 7 days</SelectItem>
                    <SelectItem value="30d">Next 30 days</SelectItem>
                    <SelectItem value="90d">Next 90 days</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedTerritory} onValueChange={setSelectedTerritory}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select territory" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Territories</SelectItem>
                    <SelectItem value="north">North Territory</SelectItem>
                    <SelectItem value="south">South Territory</SelectItem>
                    <SelectItem value="east">East Territory</SelectItem>
                    <SelectItem value="west">West Territory</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={forecastType} onValueChange={(value: any) => setForecastType(value)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="toner">Toner</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm">
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

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Predicted Service Calls</p>
                  <p className="text-2xl font-bold">
                    {summaryMetrics?.predictedCalls || 0}
                  </p>
                  <p className="text-xs text-blue-600">
                    {summaryMetrics?.callsIncrease || 0}% increase expected
                  </p>
                </div>
                <Zap className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">High Risk Customers</p>
                  <p className="text-2xl font-bold text-red-600">
                    {summaryMetrics?.highRiskCustomers || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Require immediate attention
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Technician Utilization</p>
                  <p className="text-2xl font-bold">
                    {summaryMetrics?.avgUtilization || 0}%
                  </p>
                  <Progress value={summaryMetrics?.avgUtilization || 0} className="mt-2" />
                </div>
                <Users className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Inventory Alerts</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {summaryMetrics?.inventoryAlerts || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Items need reordering
                  </p>
                </div>
                <Package className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="forecasts" className="w-full">
          <TabsList>
            <TabsTrigger value="forecasts">Service Forecasts</TabsTrigger>
            <TabsTrigger value="customer-health">Customer Health</TabsTrigger>
            <TabsTrigger value="technician-capacity">Resource Planning</TabsTrigger>
            <TabsTrigger value="inventory">Inventory Forecast</TabsTrigger>
          </TabsList>

          {/* Service Forecasts */}
          <TabsContent value="forecasts" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* High Priority Forecasts */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Upcoming Service Needs</CardTitle>
                  <CardDescription>AI-predicted service requirements with confidence scores</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {forecasts.slice(0, 10).map((forecast, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${
                            forecast.forecastType === 'toner' ? 'bg-blue-100' :
                            forecast.forecastType === 'maintenance' ? 'bg-green-100' :
                            forecast.forecastType === 'repair' ? 'bg-red-100' :
                            'bg-purple-100'
                          }`}>
                            {forecast.forecastType === 'toner' ? <Package className="h-4 w-4 text-blue-600" /> :
                             forecast.forecastType === 'maintenance' ? <Wrench className="h-4 w-4 text-green-600" /> :
                             forecast.forecastType === 'repair' ? <AlertTriangle className="h-4 w-4 text-red-600" /> :
                             <CheckCircle className="h-4 w-4 text-purple-600" />}
                          </div>
                          <div>
                            <p className="font-medium">{forecast.customerName}</p>
                            <p className="text-sm text-muted-foreground">
                              {forecast.equipmentModel} • {forecast.forecastType}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Expected: {format(new Date(forecast.predictedDate), 'MMM dd, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge variant={getPriorityColor(forecast.priority)}>
                            {forecast.priority}
                          </Badge>
                          <p className="text-sm font-medium">{forecast.confidence}% confidence</p>
                          <p className="text-xs text-muted-foreground">
                            ${forecast.estimatedCost.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Forecast Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Forecast Distribution</CardTitle>
                  <CardDescription>Service types breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Toner', value: forecasts.filter(f => f.forecastType === 'toner').length },
                          { name: 'Maintenance', value: forecasts.filter(f => f.forecastType === 'maintenance').length },
                          { name: 'Repair', value: forecasts.filter(f => f.forecastType === 'repair').length },
                          { name: 'Renewals', value: forecasts.filter(f => f.forecastType === 'contract_renewal').length },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Customer Health */}
          <TabsContent value="customer-health" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Health Scores</CardTitle>
                  <CardDescription>Churn risk assessment and satisfaction tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {customerHealth.slice(0, 8).map((customer, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{customer.customerName}</h4>
                            <Badge variant={getChurnRiskColor(customer.churnRisk)}>
                              {customer.churnRisk} churn risk
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Health Score</span>
                              <span className={`font-medium ${getHealthColor(customer.healthScore)}`}>
                                {customer.healthScore}/100
                              </span>
                            </div>
                            <Progress value={customer.healthScore} />
                            <div className="text-xs text-muted-foreground">
                              Last service: {format(new Date(customer.lastServiceDate), 'MMM dd, yyyy')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contract Renewals</CardTitle>
                  <CardDescription>Upcoming renewal opportunities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {customerHealth
                      .filter(customer => customer.upcomingRenewals.length > 0)
                      .slice(0, 6)
                      .map((customer, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{customer.customerName}</h4>
                            <Badge variant="outline">
                              {customer.upcomingRenewals.length} contract{customer.upcomingRenewals.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          {customer.upcomingRenewals.map((renewal, idx) => (
                            <div key={idx} className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <span>Renewal Date:</span>
                                <span>{format(new Date(renewal.renewalDate), 'MMM dd, yyyy')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Value:</span>
                                <span className="font-medium">${renewal.value.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Success Probability:</span>
                                <span className={`font-medium ${
                                  renewal.renewalProbability >= 80 ? 'text-green-600' :
                                  renewal.renewalProbability >= 60 ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>
                                  {renewal.renewalProbability}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Resource Planning */}
          <TabsContent value="technician-capacity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Technician Capacity Planning</CardTitle>
                <CardDescription>Current and forecasted utilization by technician</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {techCapacity.map((tech, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{tech.name}</h4>
                          <p className="text-sm text-muted-foreground">{tech.territory} Territory</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            Current: {tech.currentUtilization}% | Forecast: {tech.forecastedUtilization}%
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Current Utilization</span>
                            <span>{tech.currentUtilization}%</span>
                          </div>
                          <Progress value={tech.currentUtilization} />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Forecasted Utilization</span>
                            <span className={
                              tech.forecastedUtilization > 90 ? 'text-red-600' :
                              tech.forecastedUtilization > 80 ? 'text-yellow-600' :
                              'text-green-600'
                            }>
                              {tech.forecastedUtilization}%
                            </span>
                          </div>
                          <Progress value={tech.forecastedUtilization} />
                        </div>
                      </div>

                      {tech.recommendedActions.length > 0 && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-blue-800 mb-1">Recommendations:</p>
                          <ul className="text-xs text-blue-700 space-y-1">
                            {tech.recommendedActions.map((action, idx) => (
                              <li key={idx}>• {action}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Forecast */}
          <TabsContent value="inventory" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Demand Forecast</CardTitle>
                <CardDescription>Predicted inventory needs and reorder recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {inventoryForecasts.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${
                          item.stockoutRisk > 70 ? 'bg-red-100' :
                          item.stockoutRisk > 40 ? 'bg-yellow-100' :
                          'bg-green-100'
                        }`}>
                          <Package className={`h-4 w-4 ${
                            item.stockoutRisk > 70 ? 'text-red-600' :
                            item.stockoutRisk > 40 ? 'text-yellow-600' :
                            'text-green-600'
                          }`} />
                        </div>
                        <div>
                          <h4 className="font-medium">{item.itemName}</h4>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Current Stock: {item.currentStock} | Predicted Demand: {item.predictedDemand}</p>
                            <p>Reorder by: {format(new Date(item.reorderDate), 'MMM dd, yyyy')}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={
                          item.stockoutRisk > 70 ? 'destructive' :
                          item.stockoutRisk > 40 ? 'secondary' :
                          'default'
                        }>
                          {item.stockoutRisk}% stockout risk
                        </Badge>
                        <p className="text-sm font-medium mt-1">
                          Order {item.optimalQuantity} units
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Est. ${item.estimatedCost.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}