import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { DollarSign, Users, TrendingUp, Calculator, AlertTriangle, Award, Target, Settings, Plus, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface CommissionPlan {
  id: string;
  planName: string;
  planType: string;
  description: string;
  isActive: boolean;
  effectiveDate: Date;
  tiers: Array<{
    tierLevel: number;
    tierName: string;
    minimumSales: number;
    maximumSales: number | null;
    commissionRate: number;
    bonusThreshold: number | null;
    bonusAmount: number | null;
  }>;
  rules: {
    paymentFrequency: string;
    paymentDelay: number;
    splitCommissionAllowed: boolean;
    chargebackEnabled: boolean;
    chargebackPeriod: number;
    minimumCommissionPayment: number;
  };
  productRates: Array<{
    category: string;
    rate: number;
    description: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface CommissionCalculation {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  planId: string;
  planName: string;
  calculationPeriod: {
    startDate: Date;
    endDate: Date;
    periodName: string;
  };
  salesMetrics: any;
  commissionDetails: Array<{
    category: string;
    salesAmount: number;
    commissionRate: number;
    commissionAmount: number;
    description: string;
  }>;
  bonuses: Array<{
    type: string;
    description: string;
    amount: number;
    eligibilityMet: boolean;
  }>;
  adjustments: Array<{
    type: string;
    description: string;
    amount: number;
    reason: string;
  }>;
  summary: {
    grossCommission: number;
    totalBonuses: number;
    totalAdjustments: number;
    netCommission: number;
    payoutDate: Date;
    status: string;
  };
  calculatedAt: Date;
  calculatedBy: string;
}

const getPlanTypeColor = (type: string) => {
  switch (type) {
    case 'sales_rep': return 'bg-blue-100 text-blue-800';
    case 'sales_manager': return 'bg-purple-100 text-purple-800';
    case 'service_tech': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'calculated': return 'bg-green-100 text-green-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'paid': return 'bg-blue-100 text-blue-800';
    case 'disputed': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

export default function CommissionManagement() {
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);
  const [isCalculateOpen, setIsCalculateOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  // Fetch commission plans
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['/api/commission/plans'],
    select: (data: any[]) => data.map(plan => ({
      ...plan,
      effectiveDate: new Date(plan.effectiveDate),
      createdAt: new Date(plan.createdAt),
      updatedAt: new Date(plan.updatedAt)
    }))
  });

  // Fetch commission calculations
  const { data: calculations = [] } = useQuery<CommissionCalculation[]>({
    queryKey: ['/api/commission/calculations'],
    select: (data: any[]) => data.map(calc => ({
      ...calc,
      calculationPeriod: {
        ...calc.calculationPeriod,
        startDate: new Date(calc.calculationPeriod.startDate),
        endDate: new Date(calc.calculationPeriod.endDate)
      },
      summary: {
        ...calc.summary,
        payoutDate: new Date(calc.summary.payoutDate)
      },
      calculatedAt: new Date(calc.calculatedAt)
    }))
  });

  // Fetch commission analytics
  const { data: analytics } = useQuery({
    queryKey: ['/api/commission/analytics', selectedPeriod]
  });

  // Fetch commission disputes
  const { data: disputes = [] } = useQuery({
    queryKey: ['/api/commission/disputes']
  });

  // Calculate commission mutation
  const calculateMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/commission/calculate', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/commission/calculations'] });
      setIsCalculateOpen(false);
      toast({
        title: "Commission Calculation Complete",
        description: "Commission calculations have been processed successfully.",
      });
    }
  });

  const handleCalculateCommissions = (data: any) => {
    calculateMutation.mutate({
      startDate: data.startDate,
      endDate: data.endDate,
      employeeIds: null, // Calculate for all employees
      planId: data.planId
    });
  };

  if (plansLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading commission data...</p>
          </div>
        </div>
      </div>
    );
  }

  const totalCommissionThisMonth = calculations.reduce((sum, calc) => sum + calc.summary.netCommission, 0);
  const averageCommissionPayout = calculations.length > 0 ? totalCommissionThisMonth / calculations.length : 0;
  const pendingDisputes = disputes.filter(d => d.status !== 'resolved').length;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Commission Management</h1>
          <p className="text-gray-600 mt-2">Automated commission calculations and performance tracking</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Dialog open={isCalculateOpen} onOpenChange={setIsCalculateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Calculate Commissions
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Calculate Commissions</DialogTitle>
                <DialogDescription>
                  Process commission calculations for a specific period.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(handleCalculateCommissions)} className="space-y-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    {...register('startDate', { required: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    {...register('endDate', { required: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="planId">Commission Plan (Optional)</Label>
                  <Select {...register('planId')}>
                    <SelectTrigger>
                      <SelectValue placeholder="All plans" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plans</SelectItem>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.planName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={calculateMutation.isPending}
                >
                  {calculateMutation.isPending ? 'Calculating...' : 'Calculate Commissions'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isCreatePlanOpen} onOpenChange={setIsCreatePlanOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Commission Plan</DialogTitle>
                <DialogDescription>
                  Set up a new commission structure with tiers and rates.
                </DialogDescription>
              </DialogHeader>
              <div className="text-sm text-gray-600">
                Commission plan creation form would be implemented here with tier configuration, rate settings, and rule definitions.
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${analytics.summary.totalCommissionPaid.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                This quarter total payout
              </p>
              <div className="text-xs text-green-600 mt-1">
                Avg rate: {analytics.summary.averageCommissionRate}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Participating Staff</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.summary.participatingEmployees}</div>
              <p className="text-xs text-muted-foreground">
                Active commission earners
              </p>
              <div className="text-xs text-gray-600 mt-1">
                Avg payout: ${analytics.summary.averagePayout.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quota Achievement</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.performance_metrics.quotaAchievementRate}%</div>
              <p className="text-xs text-muted-foreground">
                Overall quota achievement
              </p>
              <Progress value={analytics.performance_metrics.quotaAchievementRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Disputes</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingDisputes}</div>
              <p className="text-xs text-muted-foreground">
                Pending resolution
              </p>
              <div className="text-xs text-gray-600 mt-1">
                Avg resolution: {analytics.dispute_analysis.averageResolutionTime} days
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="calculations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="calculations">Commission Calculations</TabsTrigger>
          <TabsTrigger value="plans">Commission Plans</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="calculations" className="space-y-6">
          {calculations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Commission Calculations</h3>
                <p className="text-gray-600 mb-4">Run your first commission calculation for the current period.</p>
                <Button onClick={() => setIsCalculateOpen(true)}>
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate Commissions
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {calculations.map((calc) => (
                <Card key={calc.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{calc.employeeName}</h3>
                          <Badge variant="outline">{calc.employeeRole}</Badge>
                          <Badge className={getStatusColor(calc.summary.status)}>
                            {calc.summary.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                          <div>
                            <span className="font-medium">Period:</span>
                            <br />
                            {calc.calculationPeriod.periodName}
                          </div>
                          <div>
                            <span className="font-medium">Plan:</span>
                            <br />
                            {calc.planName}
                          </div>
                          <div>
                            <span className="font-medium">Total Sales:</span>
                            <br />
                            ${calc.salesMetrics.totalSales?.toLocaleString() || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Quota Achievement:</span>
                            <br />
                            {calc.salesMetrics.quotaAchievement?.toFixed(1) || 'N/A'}%
                          </div>
                        </div>

                        <div className="bg-blue-50 rounded-lg p-3 mb-3">
                          <h5 className="font-medium text-blue-800 mb-2">Commission Breakdown</h5>
                          <div className="space-y-2">
                            {calc.commissionDetails.map((detail, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span>{detail.description}</span>
                                <span className="font-medium">${detail.commissionAmount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {calc.bonuses.length > 0 && (
                          <div className="bg-green-50 rounded-lg p-3 mb-3">
                            <h5 className="font-medium text-green-800 mb-2">Bonuses</h5>
                            <div className="space-y-1">
                              {calc.bonuses.map((bonus, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                  <span>{bonus.description}</span>
                                  <span className="font-medium text-green-600">
                                    {bonus.eligibilityMet ? `+$${bonus.amount.toLocaleString()}` : 'Not earned'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {calc.adjustments.length > 0 && (
                          <div className="bg-yellow-50 rounded-lg p-3 mb-3">
                            <h5 className="font-medium text-yellow-800 mb-2">Adjustments</h5>
                            <div className="space-y-1">
                              {calc.adjustments.map((adj, idx) => (
                                <div key={idx} className="text-sm">
                                  <div className="flex justify-between">
                                    <span>{adj.description}</span>
                                    <span className="font-medium text-red-600">${adj.amount.toLocaleString()}</span>
                                  </div>
                                  <div className="text-xs text-gray-600">{adj.reason}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          ${calc.summary.netCommission.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">Net Commission</div>
                        
                        <div className="mt-2 text-xs">
                          <div>Gross: ${calc.summary.grossCommission.toLocaleString()}</div>
                          <div>Bonuses: ${calc.summary.totalBonuses.toLocaleString()}</div>
                          {calc.summary.totalAdjustments !== 0 && (
                            <div>Adjustments: ${calc.summary.totalAdjustments.toLocaleString()}</div>
                          )}
                        </div>
                        
                        <div className="mt-2 text-xs text-gray-600">
                          Payout: {format(calc.summary.payoutDate, 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                      <Button size="sm" variant="outline">
                        <FileText className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                      {calc.summary.status === 'calculated' && (
                        <Button size="sm">
                          Process Payment
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{plan.planName}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Badge className={getPlanTypeColor(plan.planType)}>
                        {plan.planType.replace('_', ' ')}
                      </Badge>
                      <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-sm font-medium mb-2">Commission Tiers</div>
                    <div className="space-y-2">
                      {plan.tiers.map((tier) => (
                        <div key={tier.tierLevel} className="text-xs bg-gray-50 rounded p-2">
                          <div className="font-medium">{tier.tierName}</div>
                          <div>Sales: ${tier.minimumSales.toLocaleString()} - {tier.maximumSales ? `$${tier.maximumSales.toLocaleString()}` : 'Unlimited'}</div>
                          <div>Rate: {tier.commissionRate}%</div>
                          {tier.bonusThreshold && (
                            <div>Bonus: ${tier.bonusAmount?.toLocaleString()} at ${tier.bonusThreshold.toLocaleString()}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Payment Rules</div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>Frequency: {plan.rules.paymentFrequency}</div>
                      <div>Delay: {plan.rules.paymentDelay} days</div>
                      <div>Minimum: ${plan.rules.minimumCommissionPayment}</div>
                      <div>Split allowed: {plan.rules.splitCommissionAllowed ? 'Yes' : 'No'}</div>
                      {plan.rules.chargebackEnabled && (
                        <div>Chargeback period: {plan.rules.chargebackPeriod} days</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Product Rates</div>
                    <div className="space-y-1">
                      {plan.productRates.slice(0, 3).map((rate, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span>{rate.category.replace('_', ' ')}</span>
                          <span>{rate.rate}%</span>
                        </div>
                      ))}
                      {plan.productRates.length > 3 && (
                        <div className="text-xs text-gray-500">+ {plan.productRates.length - 3} more</div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Settings className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button size="sm" className="flex-1">
                      View Users
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="disputes" className="space-y-6">
          {disputes.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Disputes</h3>
                <p className="text-gray-600">All commission calculations are accepted.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {disputes.map((dispute: any) => (
                <Card key={dispute.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{dispute.disputeNumber}</h3>
                          <Badge className={dispute.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {dispute.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline">{dispute.priority}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                          <div>
                            <span className="font-medium">Employee:</span>
                            <br />
                            {dispute.employeeName}
                          </div>
                          <div>
                            <span className="font-medium">Period:</span>
                            <br />
                            {dispute.calculationPeriod}
                          </div>
                          <div>
                            <span className="font-medium">Type:</span>
                            <br />
                            {dispute.disputeDetails.type.replace('_', ' ')}
                          </div>
                          <div>
                            <span className="font-medium">Amount:</span>
                            <br />
                            ${dispute.disputeDetails.difference.toLocaleString()}
                          </div>
                        </div>

                        <div className="text-sm text-gray-700 mb-3">
                          <strong>Description:</strong> {dispute.disputeDetails.description}
                        </div>

                        {dispute.resolution && (
                          <div className="bg-blue-50 rounded-lg p-3">
                            <h5 className="font-medium text-blue-800 mb-2">Resolution Status</h5>
                            <div className="text-sm">
                              <div><strong>Assigned to:</strong> {dispute.resolution.assignedToName}</div>
                              {dispute.resolution.estimatedResolution && (
                                <div><strong>Estimated resolution:</strong> {format(new Date(dispute.resolution.estimatedResolution), 'MMM dd, yyyy')}</div>
                              )}
                              {dispute.resolution.notes && (
                                <div><strong>Notes:</strong> {dispute.resolution.notes}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold text-red-600">
                          ${dispute.disputeDetails.disputedAmount.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">Disputed Amount</div>
                        
                        <div className="mt-1 text-xs">
                          <div>Expected: ${dispute.disputeDetails.expectedAmount.toLocaleString()}</div>
                          <div>Difference: ${dispute.disputeDetails.difference.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline">
                        View History
                      </Button>
                      {dispute.status !== 'resolved' && (
                        <>
                          <Button size="sm" variant="outline">
                            Update Status
                          </Button>
                          <Button size="sm">
                            Resolve Dispute
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analytics && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Commission Trends</CardTitle>
                    <CardDescription>Monthly commission payments and performance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analytics.monthly_trends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, '']} />
                        <Line 
                          type="monotone" 
                          dataKey="totalCommissions" 
                          stroke="#8884d8" 
                          name="Total Commissions"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="avgPayout" 
                          stroke="#82ca9d" 
                          name="Avg Payout"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Performers</CardTitle>
                    <CardDescription>Highest commission earners this period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analytics.top_performers.map((performer: any) => (
                        <div key={performer.employeeId} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{performer.name}</div>
                            <div className="text-sm text-gray-600">{performer.role}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${performer.totalCommission.toLocaleString()}</div>
                            <div className="text-sm text-gray-600">{performer.quotaAchievement}% quota</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Plan Performance Analysis</CardTitle>
                  <CardDescription>Commission plan effectiveness and participation</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={analytics.plan_performance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="planName" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${typeof value === 'number' && value > 100 ? '$' + value.toLocaleString() : value}`, '']} />
                      <Bar dataKey="participants" fill="#8884d8" name="Participants" />
                      <Bar dataKey="avgPayout" fill="#82ca9d" name="Avg Payout ($)" />
                      <Bar dataKey="avgQuotaAchievement" fill="#ffc658" name="Avg Quota Achievement (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}