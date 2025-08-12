import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  DollarSign, 
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  CreditCard,
  PieChart,
  BarChart3,
  Target,
  Calendar,
  Bell,
  Filter,
  Download,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Users,
  Building
} from 'lucide-react';
import { format, subDays, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { 
  type Invoice,
  type Contract,
  type BusinessRecord
} from '@shared/schema';

// Financial data types
interface FinancialSummary {
  totalRevenue: number;
  revenueChange: number;
  totalAR: number;
  totalAP: number;
  cashFlow: number;
  profitMargin: number;
  overdueAmount: number;
  overdueCount: number;
  collectionRate: number;
  dso: number; // Days Sales Outstanding
}

interface PaymentAlert {
  id: string;
  type: 'overdue' | 'upcoming' | 'failed' | 'dispute';
  severity: 'critical' | 'high' | 'medium' | 'low';
  customerId: string;
  customerName: string;
  amount: number;
  dueDate: string;
  daysPastDue?: number;
  description: string;
  recommendedAction: string;
  autoActionAvailable: boolean;
}

interface ARAgingBucket {
  bucket: string;
  amount: number;
  count: number;
  percentage: number;
}

interface CustomerProfitability {
  customerId: string;
  customerName: string;
  totalRevenue: number;
  totalCosts: number;
  grossProfit: number;
  profitMargin: number;
  revenueGrowth: number;
  paymentHistory: PaymentMetrics;
  riskScore: number;
}

interface PaymentMetrics {
  avgDaysToPay: number;
  onTimePaymentRate: number;
  totalOutstanding: number;
  creditLimit: number;
  creditUtilization: number;
}

interface CashFlowForecast {
  date: string;
  projectedInflow: number;
  projectedOutflow: number;
  netCashFlow: number;
  runningBalance: number;
  confidence: number;
}

interface TerritoryFinancials {
  territory: string;
  revenue: number;
  revenueGrowth: number;
  customerCount: number;
  avgDealSize: number;
  profitability: number;
  collectionRate: number;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

export default function FinancialIntelligenceDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<'30d' | '90d' | 'ytd' | '12m'>('90d');
  const [selectedTerritory, setSelectedTerritory] = useState<string>('all');
  const [alertFilter, setAlertFilter] = useState<'all' | 'critical' | 'overdue'>('all');
  
  // Fetch financial summary
  const { data: financialSummary } = useQuery<FinancialSummary>({
    queryKey: ['/api/reports/financial-summary', selectedPeriod, selectedTerritory],
    queryFn: () => apiRequest(`/api/reports/financial-summary?period=${selectedPeriod}&territory=${selectedTerritory}`),
  });

  // Fetch payment alerts
  const { data: paymentAlerts = [] } = useQuery<PaymentAlert[]>({
    queryKey: ['/api/reports/payment-alerts', alertFilter],
    queryFn: () => apiRequest(`/api/reports/payment-alerts?filter=${alertFilter}`),
  });

  // Fetch AR aging
  const { data: arAging = [] } = useQuery<ARAgingBucket[]>({
    queryKey: ['/api/reports/ar-aging', selectedTerritory],
    queryFn: () => apiRequest(`/api/reports/ar-aging?territory=${selectedTerritory}`),
  });

  // Fetch customer profitability
  const { data: customerProfitability = [] } = useQuery<CustomerProfitability[]>({
    queryKey: ['/api/reports/customer-profitability', selectedPeriod, selectedTerritory],
    queryFn: () => apiRequest(`/api/reports/customer-profitability?period=${selectedPeriod}&territory=${selectedTerritory}`),
  });

  // Fetch cash flow forecast
  const { data: cashFlowForecast = [] } = useQuery<CashFlowForecast[]>({
    queryKey: ['/api/reports/cash-flow-forecast'],
    queryFn: () => apiRequest('/api/reports/cash-flow-forecast?horizon=90d'),
  });

  // Fetch territory financials
  const { data: territoryFinancials = [] } = useQuery<TerritoryFinancials[]>({
    queryKey: ['/api/reports/territory-financials', selectedPeriod],
    queryFn: () => apiRequest(`/api/reports/territory-financials?period=${selectedPeriod}`),
  });

  // Get alert severity color
  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  // Get alert type icon
  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'overdue': return AlertTriangle;
      case 'upcoming': return Clock;
      case 'failed': return XCircle;
      case 'dispute': return Bell;
      default: return AlertTriangle;
    }
  };

  // Get trend color and icon
  const getTrendColor = (value: number) => value >= 0 ? 'text-green-600' : 'text-red-600';
  const getTrendIcon = (value: number) => value >= 0 ? ArrowUp : ArrowDown;

  return (
    <MainLayout
      title="Financial Intelligence"
      description="Comprehensive financial analytics with payment monitoring and cash flow insights"
    >
      <div className="space-y-6">
        {/* Filters and Controls */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col md:flex-row gap-4">
                <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="ytd">Year to date</SelectItem>
                    <SelectItem value="12m">Last 12 months</SelectItem>
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

        {/* Critical Alerts */}
        {paymentAlerts.filter(alert => alert.severity === 'critical').length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Critical Payment Issues:</strong> {paymentAlerts.filter(alert => alert.severity === 'critical').length} customers require immediate attention.
            </AlertDescription>
          </Alert>
        )}

        {/* Key Financial Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">
                    ${financialSummary?.totalRevenue?.toLocaleString() || '0'}
                  </p>
                  <div className="flex items-center text-xs mt-1">
                    {financialSummary?.revenueChange !== undefined && (
                      <>
                        {getTrendIcon(financialSummary.revenueChange)({ className: `h-3 w-3 mr-1 ${getTrendColor(financialSummary.revenueChange)}` })}
                        <span className={getTrendColor(financialSummary.revenueChange)}>
                          {financialSummary.revenueChange >= 0 ? '+' : ''}{financialSummary.revenueChange.toFixed(1)}% vs last period
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Accounts Receivable</p>
                  <p className="text-2xl font-bold">
                    ${financialSummary?.totalAR?.toLocaleString() || '0'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    DSO: {financialSummary?.dso || 0} days
                  </p>
                </div>
                <CreditCard className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overdue Amount</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${financialSummary?.overdueAmount?.toLocaleString() || '0'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {financialSummary?.overdueCount || 0} accounts
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
                  <p className="text-sm font-medium text-muted-foreground">Collection Rate</p>
                  <p className="text-2xl font-bold">
                    {financialSummary?.collectionRate || 0}%
                  </p>
                  <Progress value={financialSummary?.collectionRate || 0} className="mt-2" />
                </div>
                <Target className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="alerts" className="w-full">
          <TabsList>
            <TabsTrigger value="alerts">Payment Alerts</TabsTrigger>
            <TabsTrigger value="ar-aging">AR Aging</TabsTrigger>
            <TabsTrigger value="profitability">Customer Profitability</TabsTrigger>
            <TabsTrigger value="cash-flow">Cash Flow Forecast</TabsTrigger>
            <TabsTrigger value="territories">Territory Analysis</TabsTrigger>
          </TabsList>

          {/* Payment Alerts */}
          <TabsContent value="alerts" className="space-y-6">
            <div className="flex gap-4 mb-4">
              <Select value={alertFilter} onValueChange={(value: any) => setAlertFilter(value)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Alerts</SelectItem>
                  <SelectItem value="critical">Critical Only</SelectItem>
                  <SelectItem value="overdue">Overdue Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Active Payment Alerts</CardTitle>
                  <CardDescription>Automated payment monitoring and recommended actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {paymentAlerts.map((alert, index) => {
                      const AlertIcon = getAlertTypeIcon(alert.type);
                      return (
                        <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg">
                          <div className={`p-2 rounded-lg ${
                            alert.severity === 'critical' ? 'bg-red-100' :
                            alert.severity === 'high' ? 'bg-orange-100' :
                            alert.severity === 'medium' ? 'bg-yellow-100' :
                            'bg-blue-100'
                          }`}>
                            <AlertIcon className={`h-4 w-4 ${
                              alert.severity === 'critical' ? 'text-red-600' :
                              alert.severity === 'high' ? 'text-orange-600' :
                              alert.severity === 'medium' ? 'text-yellow-600' :
                              'text-blue-600'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-medium">{alert.customerName}</h4>
                              <Badge variant={getAlertSeverityColor(alert.severity)}>
                                {alert.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                            <div className="flex items-center justify-between">
                              <div className="text-sm">
                                <span className="font-medium">${alert.amount.toLocaleString()}</span>
                                {alert.daysPastDue && (
                                  <span className="text-red-600 ml-2">
                                    {alert.daysPastDue} days overdue
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {alert.autoActionAvailable && (
                                  <Button size="sm" variant="outline">
                                    Auto Action
                                  </Button>
                                )}
                                <Button size="sm">
                                  View Details
                                </Button>
                              </div>
                            </div>
                            <div className="mt-2 p-2 bg-muted rounded text-xs">
                              <strong>Recommended:</strong> {alert.recommendedAction}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Alert Summary</CardTitle>
                  <CardDescription>Distribution by severity</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                      <Pie
                        data={[
                          { name: 'Critical', value: paymentAlerts.filter(a => a.severity === 'critical').length },
                          { name: 'High', value: paymentAlerts.filter(a => a.severity === 'high').length },
                          { name: 'Medium', value: paymentAlerts.filter(a => a.severity === 'medium').length },
                          { name: 'Low', value: paymentAlerts.filter(a => a.severity === 'low').length },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AR Aging */}
          <TabsContent value="ar-aging" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>AR Aging Analysis</CardTitle>
                  <CardDescription>Outstanding receivables by aging bucket</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={arAging}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bucket" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Amount']} />
                      <Bar dataKey="amount" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Aging Distribution</CardTitle>
                  <CardDescription>Percentage breakdown by bucket</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {arAging.map((bucket, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span>{bucket.bucket}</span>
                          <div className="text-right">
                            <div className="font-medium">${bucket.amount.toLocaleString()}</div>
                            <div className="text-muted-foreground">{bucket.count} invoices</div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Progress value={bucket.percentage} />
                          <div className="text-xs text-muted-foreground">
                            {bucket.percentage.toFixed(1)}% of total AR
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Customer Profitability */}
          <TabsContent value="profitability" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Profitability Analysis</CardTitle>
                <CardDescription>Revenue, costs, and profit margins by customer</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {customerProfitability.slice(0, 10).map((customer, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{customer.customerName}</h4>
                          <Badge variant={
                            customer.profitMargin >= 30 ? 'default' :
                            customer.profitMargin >= 15 ? 'secondary' :
                            'destructive'
                          }>
                            {customer.profitMargin.toFixed(1)}% margin
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Revenue</p>
                            <p className="font-medium">${customer.totalRevenue.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Gross Profit</p>
                            <p className="font-medium">${customer.grossProfit.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Growth</p>
                            <p className={`font-medium ${getTrendColor(customer.revenueGrowth)}`}>
                              {customer.revenueGrowth >= 0 ? '+' : ''}{customer.revenueGrowth.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Risk Score</p>
                            <p className={`font-medium ${
                              customer.riskScore <= 30 ? 'text-green-600' :
                              customer.riskScore <= 60 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {customer.riskScore}/100
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Avg payment: {customer.paymentHistory.avgDaysToPay} days | 
                          On-time rate: {customer.paymentHistory.onTimePaymentRate}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cash Flow Forecast */}
          <TabsContent value="cash-flow" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cash Flow Forecast</CardTitle>
                <CardDescription>90-day projected inflows and outflows</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={cashFlowForecast}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'MMM dd')} />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                      formatter={(value) => [`$${Number(value).toLocaleString()}`, '']}
                    />
                    <Line type="monotone" dataKey="projectedInflow" stroke="#82ca9d" name="Inflow" />
                    <Line type="monotone" dataKey="projectedOutflow" stroke="#ff7c7c" name="Outflow" />
                    <Line type="monotone" dataKey="netCashFlow" stroke="#8884d8" name="Net Cash Flow" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Territory Analysis */}
          <TabsContent value="territories" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Territory Financial Performance</CardTitle>
                <CardDescription>Revenue and profitability by territory</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {territoryFinancials.map((territory, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{territory.territory} Territory</h4>
                        <Badge variant="outline">
                          {territory.customerCount} customers
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Revenue</p>
                          <p className="font-medium text-lg">${territory.revenue.toLocaleString()}</p>
                          <p className={`text-xs ${getTrendColor(territory.revenueGrowth)}`}>
                            {territory.revenueGrowth >= 0 ? '+' : ''}{territory.revenueGrowth.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Deal Size</p>
                          <p className="font-medium">${territory.avgDealSize.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Profitability</p>
                          <p className="font-medium">{territory.profitability.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Collection Rate</p>
                          <p className="font-medium">{territory.collectionRate.toFixed(1)}%</p>
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
    </MainLayout>
  );
}