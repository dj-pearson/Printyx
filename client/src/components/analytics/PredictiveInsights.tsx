import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Target, 
  Calendar,
  DollarSign,
  Users,
  Award,
  ArrowRight,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';

interface RiskScore {
  score: number;
  level: 'low' | 'medium' | 'high';
  factors: string[];
  recommendations: string[];
}

interface PredictiveMetric {
  id: string;
  title: string;
  value: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
  timeframe: string;
  category: 'sales' | 'service' | 'finance' | 'operations';
}

interface CustomerRenewalPrediction {
  customerId: string;
  customerName: string;
  renewalDate: string;
  renewalProbability: number;
  currentValue: number;
  predictedValue: number;
  riskFactors: string[];
  recommendations: string[];
}

interface SalesOpportunityPrediction {
  opportunityId: string;
  opportunityName: string;
  closeDate: string;
  closeProbability: number;
  estimatedValue: number;
  stage: string;
  riskFactors: string[];
  accelerators: string[];
}

const mockRiskScores: Record<string, RiskScore> = {
  churn: {
    score: 23,
    level: 'medium',
    factors: [
      'Declined meter readings for 2+ months',
      'Multiple service complaints in Q3',
      'Payment delays averaging 15 days'
    ],
    recommendations: [
      'Schedule proactive customer check-in',
      'Offer service quality review',
      'Consider payment plan options'
    ]
  },
  revenue: {
    score: 12,
    level: 'low',
    factors: [
      'Stable equipment utilization',
      'Consistent payment history',
      'Growing monthly volumes'
    ],
    recommendations: [
      'Explore upselling opportunities',
      'Consider multi-year contract incentives'
    ]
  },
  service: {
    score: 67,
    level: 'high',
    factors: [
      'Aging equipment fleet (avg 7 years)',
      'Increased service call frequency',
      'Parts availability concerns'
    ],
    recommendations: [
      'Schedule equipment health assessment',
      'Propose preventive maintenance plan',
      'Present upgrade/refresh options'
    ]
  }
};

const mockPredictiveMetrics: PredictiveMetric[] = [
  {
    id: 'sales_forecast',
    title: 'Monthly Sales Forecast',
    value: 847500,
    trend: 'up',
    confidence: 87,
    timeframe: 'Next 30 days',
    category: 'sales'
  },
  {
    id: 'churn_rate',
    title: 'Customer Churn Rate',
    value: 2.3,
    trend: 'down',
    confidence: 92,
    timeframe: 'Next 90 days',
    category: 'sales'
  },
  {
    id: 'service_costs',
    title: 'Service Cost Reduction',
    value: 15.8,
    trend: 'up',
    confidence: 78,
    timeframe: 'Next quarter',
    category: 'service'
  },
  {
    id: 'payment_risk',
    title: 'Payment Risk Score',
    value: 8.2,
    trend: 'stable',
    confidence: 84,
    timeframe: 'Current month',
    category: 'finance'
  }
];

const mockRenewalPredictions: CustomerRenewalPrediction[] = [
  {
    customerId: '1',
    customerName: 'Acme Corporation',
    renewalDate: '2025-12-15',
    renewalProbability: 87,
    currentValue: 45000,
    predictedValue: 52000,
    riskFactors: [],
    recommendations: ['Present upgrade options early', 'Schedule executive review meeting']
  },
  {
    customerId: '2',
    customerName: 'Tech Solutions Inc',
    renewalDate: '2025-10-30',
    renewalProbability: 34,
    currentValue: 28000,
    predictedValue: 15000,
    riskFactors: ['Multiple service issues', 'Competitor proposal received'],
    recommendations: ['Immediate customer retention meeting', 'Service credit consideration', 'Executive escalation']
  },
  {
    customerId: '3',
    customerName: 'Local Government',
    renewalDate: '2026-03-01',
    renewalProbability: 92,
    currentValue: 75000,
    predictedValue: 78000,
    riskFactors: [],
    recommendations: ['Explore additional services', 'Multi-year contract benefits']
  }
];

const mockSalesOpportunities: SalesOpportunityPrediction[] = [
  {
    opportunityId: '1',
    opportunityName: 'Enterprise Print Fleet - Manufacturing Co',
    closeDate: '2025-09-15',
    closeProbability: 78,
    estimatedValue: 125000,
    stage: 'Proposal',
    riskFactors: ['Budget approval pending'],
    accelerators: ['Strong technical fit', 'Existing relationship', 'Competitive pricing']
  },
  {
    opportunityId: '2',
    opportunityName: 'Managed Services - Healthcare Group',
    closeDate: '2025-08-30',
    closeProbability: 45,
    estimatedValue: 89000,
    stage: 'Negotiation',
    riskFactors: ['Price concerns', 'Competitor proposal'],
    accelerators: ['Compliance requirements met', 'Reference customer available']
  }
];

export default function PredictiveInsights() {
  const [selectedMetric, setSelectedMetric] = useState<string>('sales_forecast');

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      default: return 'outline';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Predictive Analytics
          </h2>
          <p className="text-muted-foreground">
            AI-powered insights and predictions for proactive decision making
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          Real-time ML
        </Badge>
      </div>

      <Tabs defaultValue="metrics" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="metrics">Key Metrics</TabsTrigger>
          <TabsTrigger value="renewals">Renewals</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="risks">Risk Analysis</TabsTrigger>
        </TabsList>

        {/* Key Metrics Tab */}
        <TabsContent value="metrics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {mockPredictiveMetrics.map((metric) => (
              <Card 
                key={metric.id} 
                className={`cursor-pointer transition-all ${selectedMetric === metric.id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedMetric(metric.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getTrendIcon(metric.trend)}
                      <span className="text-sm font-medium">{metric.category}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {formatPercentage(metric.confidence)} confidence
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm">{metric.title}</h3>
                    <p className="text-2xl font-bold">
                      {metric.category === 'sales' && metric.id === 'sales_forecast' 
                        ? formatCurrency(metric.value)
                        : `${metric.value}${metric.id.includes('rate') || metric.id.includes('reduction') ? '%' : ''}`
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">{metric.timeframe}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Renewals Tab */}
        <TabsContent value="renewals">
          <div className="space-y-4">
            {mockRenewalPredictions.map((renewal) => (
              <Card key={renewal.customerId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{renewal.customerName}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={renewal.renewalProbability > 70 ? 'default' : renewal.renewalProbability > 40 ? 'secondary' : 'destructive'}
                      >
                        {formatPercentage(renewal.renewalProbability)} likely
                      </Badge>
                      <Badge variant="outline">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(renewal.renewalDate).toLocaleDateString()}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Value</p>
                      <p className="text-lg font-semibold">{formatCurrency(renewal.currentValue)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Predicted Value</p>
                      <p className="text-lg font-semibold flex items-center gap-1">
                        {formatCurrency(renewal.predictedValue)}
                        {renewal.predictedValue > renewal.currentValue ? 
                          <TrendingUp className="h-4 w-4 text-green-600" /> : 
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        }
                      </p>
                    </div>
                    <div>
                      <Progress value={renewal.renewalProbability} className="w-full" />
                      <p className="text-xs text-muted-foreground mt-1">Renewal Probability</p>
                    </div>
                  </div>
                  
                  {renewal.riskFactors.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 rounded border border-red-200">
                      <h4 className="font-medium text-red-800 flex items-center gap-1 mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        Risk Factors
                      </h4>
                      <ul className="text-sm text-red-700 space-y-1">
                        {renewal.riskFactors.map((factor, idx) => (
                          <li key={idx}>• {factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <h4 className="font-medium text-blue-800 flex items-center gap-1 mb-2">
                      <Target className="h-4 w-4" />
                      Recommendations
                    </h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      {renewal.recommendations.map((rec, idx) => (
                        <li key={idx}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities">
          <div className="space-y-4">
            {mockSalesOpportunities.map((opp) => (
              <Card key={opp.opportunityId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{opp.opportunityName}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={opp.closeProbability > 70 ? 'default' : opp.closeProbability > 40 ? 'secondary' : 'destructive'}
                      >
                        {formatPercentage(opp.closeProbability)} close
                      </Badge>
                      <Badge variant="outline">{opp.stage}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Estimated Value</p>
                      <p className="text-lg font-semibold">{formatCurrency(opp.estimatedValue)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Expected Close</p>
                      <p className="text-lg font-semibold">{new Date(opp.closeDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Progress value={opp.closeProbability} className="w-full" />
                      <p className="text-xs text-muted-foreground mt-1">Close Probability</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {opp.riskFactors.length > 0 && (
                      <div className="p-3 bg-amber-50 rounded border border-amber-200">
                        <h4 className="font-medium text-amber-800 flex items-center gap-1 mb-2">
                          <AlertTriangle className="h-4 w-4" />
                          Risk Factors
                        </h4>
                        <ul className="text-sm text-amber-700 space-y-1">
                          {opp.riskFactors.map((factor, idx) => (
                            <li key={idx}>• {factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="p-3 bg-green-50 rounded border border-green-200">
                      <h4 className="font-medium text-green-800 flex items-center gap-1 mb-2">
                        <Award className="h-4 w-4" />
                        Accelerators
                      </h4>
                      <ul className="text-sm text-green-700 space-y-1">
                        {opp.accelerators.map((acc, idx) => (
                          <li key={idx}>• {acc}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Risk Analysis Tab */}
        <TabsContent value="risks">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(mockRiskScores).map(([key, risk]) => (
              <Card key={key}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="capitalize">{key} Risk</CardTitle>
                    <Badge variant={getRiskBadgeVariant(risk.level)}>
                      {risk.level} ({risk.score}%)
                    </Badge>
                  </div>
                  <Progress value={risk.score} className="w-full" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Key Factors:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {risk.factors.map((factor, idx) => (
                          <li key={idx}>• {factor}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm mb-2">Recommendations:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {risk.recommendations.map((rec, idx) => (
                          <li key={idx}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <Button variant="outline" size="sm" className="w-full">
                      <ArrowRight className="h-3 w-3 mr-1" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}