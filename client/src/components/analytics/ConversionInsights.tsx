import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Target, AlertCircle, CheckCircle, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

// Phase 3: Conversion Insights Component
interface ConversionMetrics {
  leadToQualifiedRate: number;
  qualifiedToDemoRate: number;
  demoToProposalRate: number;
  proposalToClosedWonRate: number;
  overallConversionRate: number;
  averageSalesCycle: number;
  topLossReasons: Array<{ reason: string; count: number }>;
  monthlyTrend: Array<{ month: string; conversions: number }>;
}

interface ActivityNudge {
  type: 'call' | 'email' | 'demo' | 'proposal';
  message: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
  dealId: string;
  dealTitle: string;
}

export const ConversionInsights: React.FC<{ dealId?: string }> = ({ dealId }) => {
  // Fetch conversion metrics
  const { data: metrics } = useQuery<ConversionMetrics>({
    queryKey: ['/api/analytics/conversion-metrics', dealId],
    select: (data: any) => data || {
      leadToQualifiedRate: 65,
      qualifiedToDemoRate: 45,
      demoToProposalRate: 72,
      proposalToClosedWonRate: 38,
      overallConversionRate: 8.2,
      averageSalesCycle: 45,
      topLossReasons: [
        { reason: 'Price too high', count: 15 },
        { reason: 'Competitor chosen', count: 12 },
        { reason: 'Budget not approved', count: 8 },
        { reason: 'Timeline mismatch', count: 6 },
      ],
      monthlyTrend: [
        { month: 'Aug', conversions: 12 },
        { month: 'Sep', conversions: 18 },
        { month: 'Oct', conversions: 15 },
        { month: 'Nov', conversions: 22 },
      ]
    }
  });

  // Fetch activity nudges
  const { data: nudges } = useQuery<ActivityNudge[]>({
    queryKey: ['/api/analytics/activity-nudges', dealId],
    select: (data: any) => data || [
      {
        type: 'call',
        message: 'Follow up call overdue - last contact 5 days ago',
        priority: 'high',
        dueDate: '2025-01-10',
        dealId: 'deal-1',
        dealTitle: 'ABC Corporation - Equipment Upgrade'
      },
      {
        type: 'demo',
        message: 'Schedule demo to move deal forward',
        priority: 'medium',
        dueDate: '2025-01-12',
        dealId: 'deal-2',
        dealTitle: 'XYZ Industries - Color Printing Solution'
      },
      {
        type: 'proposal',
        message: 'Proposal due - customer expecting quote',
        priority: 'high',
        dueDate: '2025-01-11',
        dealId: 'deal-3',
        dealTitle: 'Tech Solutions Inc - Multi-function Devices'
      }
    ]
  });

  if (!metrics || !nudges) return null;

  const getConversionColor = (rate: number) => {
    if (rate >= 60) return 'text-green-600';
    if (rate >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return '📞';
      case 'email': return '📧';
      case 'demo': return '🎯';
      case 'proposal': return '📄';
      default: return '📋';
    }
  };

  return (
    <div className="space-y-6">
      {/* Conversion Funnel Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Conversion Funnel Analysis
          </CardTitle>
          <CardDescription>
            Track conversion rates at each stage of your sales pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Funnel Stages */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className={`text-2xl font-bold ${getConversionColor(metrics.leadToQualifiedRate)}`}>
                  {metrics.leadToQualifiedRate}%
                </div>
                <div className="text-sm text-gray-600">Lead → Qualified</div>
                <Progress value={metrics.leadToQualifiedRate} className="mt-2" />
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className={`text-2xl font-bold ${getConversionColor(metrics.qualifiedToDemoRate)}`}>
                  {metrics.qualifiedToDemoRate}%
                </div>
                <div className="text-sm text-gray-600">Qualified → Demo</div>
                <Progress value={metrics.qualifiedToDemoRate} className="mt-2" />
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className={`text-2xl font-bold ${getConversionColor(metrics.demoToProposalRate)}`}>
                  {metrics.demoToProposalRate}%
                </div>
                <div className="text-sm text-gray-600">Demo → Proposal</div>
                <Progress value={metrics.demoToProposalRate} className="mt-2" />
              </div>
              
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className={`text-2xl font-bold ${getConversionColor(metrics.proposalToClosedWonRate)}`}>
                  {metrics.proposalToClosedWonRate}%
                </div>
                <div className="text-sm text-gray-600">Proposal → Closed Won</div>
                <Progress value={metrics.proposalToClosedWonRate} className="mt-2" />
              </div>
            </div>

            {/* Overall Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{metrics.overallConversionRate}%</div>
                <div className="text-sm text-gray-600">Overall Conversion Rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{metrics.averageSalesCycle}</div>
                <div className="text-sm text-gray-600">Avg Sales Cycle (days)</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Nudges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Activity Calculator Nudges
          </CardTitle>
          <CardDescription>
            AI-powered recommendations to hit your sales goals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {nudges.map((nudge, index) => (
              <div key={index} className={`p-4 rounded-lg border ${getPriorityColor(nudge.priority)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{getActivityIcon(nudge.type)}</span>
                    <div>
                      <div className="font-medium">{nudge.message}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Deal: {nudge.dealTitle}
                      </div>
                      <div className="text-sm text-gray-500">
                        Due: {new Date(nudge.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={nudge.priority === 'high' ? 'destructive' : nudge.priority === 'medium' ? 'secondary' : 'outline'}>
                      {nudge.priority.toUpperCase()}
                    </Badge>
                    <Button size="sm" variant="outline">
                      Take Action
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Loss Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Loss Reason Analysis
          </CardTitle>
          <CardDescription>
            Understand why deals are being lost and optimize accordingly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.topLossReasons.map((reason, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-medium">
                    {index + 1}
                  </div>
                  <div className="font-medium">{reason.reason}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{reason.count} deals</Badge>
                  <Progress value={(reason.count / 20) * 100} className="w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Conversion Trend
          </CardTitle>
          <CardDescription>
            Track your conversion performance over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.monthlyTrend.map((month, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="font-medium">{month.month}</div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-semibold">{month.conversions} deals</div>
                    <div className="text-sm text-gray-600">
                      {index > 0 && (
                        <span className={month.conversions > metrics.monthlyTrend[index - 1].conversions ? 'text-green-600' : 'text-red-600'}>
                          {month.conversions > metrics.monthlyTrend[index - 1].conversions ? '+' : ''}
                          {month.conversions - metrics.monthlyTrend[index - 1].conversions}
                        </span>
                      )}
                    </div>
                  </div>
                  <Progress value={(month.conversions / 30) * 100} className="w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};