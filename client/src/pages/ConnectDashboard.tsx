import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  CheckCircle,
  Settings,
  ArrowRight,
  Sparkles,
  Star,
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  BarChart3,
  Target,
  Palette,
  Globe,
  Shield,
  ChevronRight,
  Activity,
  Clock,
  DollarSign,
  XCircle,
  AlertCircle,
  Wrench,
  Package,
  FileText,
  ThumbsUp,
  Award,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';

export default function ConnectDashboard() {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  // In a real implementation, these would fetch from actual APIs
  const customerHealthData = {
    totalCustomers: 247,
    healthyCustomers: 182,
    atRiskCustomers: 48,
    criticalCustomers: 17,
    averageHealthScore: 78,
    churnRate: 5.2,
    churnReductionTarget: 25,
    portalAdoptionRate: 64,
    activeSessions: 127,
    satisfactionScore: 4.3,
    nps: 42,
  };

  const atRiskCustomers = [
    {
      id: 1,
      name: 'Acme Corporation',
      healthScore: 42,
      trend: 'declining',
      riskLevel: 'high',
      churnProbability: 68,
      mrr: 2400,
      issues: ['Low engagement', 'Payment delays', 'Support tickets'],
      recommendation: 'Schedule executive review',
    },
    {
      id: 2,
      name: 'Global Tech Solutions',
      healthScore: 38,
      trend: 'declining',
      riskLevel: 'critical',
      churnProbability: 82,
      mrr: 5200,
      issues: ['No portal login (30 days)', 'Missed renewals', 'Service complaints'],
      recommendation: 'Immediate outreach required',
    },
    {
      id: 3,
      name: 'Midwest Manufacturing',
      healthScore: 51,
      trend: 'stable',
      riskLevel: 'medium',
      churnProbability: 45,
      mrr: 1800,
      issues: ['Decreasing usage', 'Late payments'],
      recommendation: 'Offer training program',
    },
  ];

  const connectFeatures = [
    {
      id: 'white-label-portal',
      name: 'White-Label Customer Portal',
      description:
        'Give your customers a branded self-service portal with your logo, colors, and domain',
      icon: Palette,
      category: 'Customer Experience',
      impact: '50% reduction in support calls',
      color: 'bg-pink-500',
      features: ['Custom branding', 'Custom domain', 'Branded emails', 'Mobile app'],
      status: 'Available',
    },
    {
      id: 'health-monitoring',
      name: 'Customer Health Scoring',
      description:
        'AI-powered health scores predict which customers are at risk of churning before they leave',
      icon: Heart,
      category: 'Retention',
      impact: '25-30% churn reduction',
      color: 'bg-red-500',
      features: [
        'Real-time scoring',
        'Churn prediction',
        'Intervention triggers',
        'Success tracking',
      ],
      status: 'Active',
    },
    {
      id: 'equipment-health',
      name: 'Equipment Health Dashboards',
      description:
        'Customers see real-time equipment status, toner levels, and maintenance schedules',
      icon: Activity,
      category: 'Proactive Service',
      impact: '40% faster issue resolution',
      color: 'bg-green-500',
      features: [
        'Real-time monitoring',
        'Proactive alerts',
        'Usage analytics',
        'Predictive maintenance',
      ],
      status: 'Active',
    },
    {
      id: 'self-service',
      name: 'Self-Service Request Management',
      description: 'Customers submit service requests, order supplies, and track everything 24/7',
      icon: Wrench,
      category: 'Efficiency',
      impact: '60% faster response times',
      color: 'bg-blue-500',
      features: ['Service requests', 'Supply ordering', 'Meter submissions', 'Payment processing'],
      status: 'Active',
    },
    {
      id: 'satisfaction-tracking',
      name: 'Satisfaction Survey System',
      description: 'Automatically collect feedback after every interaction and track NPS over time',
      icon: Star,
      category: 'Experience',
      impact: 'NPS increase of 15-20 points',
      color: 'bg-yellow-500',
      features: ['Auto surveys', 'NPS tracking', 'Sentiment analysis', 'Trend reports'],
      status: 'Active',
    },
    {
      id: 'renewal-management',
      name: 'Automated Renewal Workflows',
      description: 'Never miss a renewal with automated reminders, proposals, and success tracking',
      icon: FileText,
      category: 'Revenue',
      impact: '15% higher renewal rates',
      color: 'bg-purple-500',
      features: ['Renewal tracking', 'Auto reminders', 'Proposal generation', 'Win/loss analysis'],
      status: 'Active',
    },
  ];

  const calculateChurnSavings = () => {
    const currentChurn = customerHealthData.churnRate;
    const targetReduction = customerHealthData.churnReductionTarget;
    const avgMRR = 500; // Average MRR per customer
    const totalCustomers = customerHealthData.totalCustomers;

    const currentLossPerMonth = totalCustomers * (currentChurn / 100) * avgMRR;
    const projectedReduction = currentLossPerMonth * (targetReduction / 100);

    return Math.round(projectedReduction * 12); // Annual savings
  };

  return (
    <MainLayout
      title="Printyx Connect"
      description="Turn your dealership into a customer success engine"
    >
      <div className="container mx-auto p-6 space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 text-white p-8 md:p-12">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="h-8 w-8" />
              <h1 className="text-4xl font-bold">Printyx Connect</h1>
              <Badge variant="secondary" className="ml-2 bg-white/20 text-white border-white/40">
                Customer Success Platform
              </Badge>
            </div>
            <p className="text-xl mb-6 max-w-2xl text-white/90">
              The first dealer platform built for B2B2C. While E-Automate helps you manage
              customers,
              <span className="font-bold"> Printyx helps you keep and grow them</span>.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/customer-success-management">
                  <Users className="mr-2 h-4 w-4" />
                  View Customer Health
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                asChild
              >
                <Link href="/customer-self-service-portal">
                  Customer Portal Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-0 right-0 opacity-10">
            <Users className="h-64 w-64" />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Health Score
              </CardTitle>
              <Heart className="h-4 w-4 text-pink-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{customerHealthData.averageHealthScore}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {customerHealthData.healthyCustomers} healthy • {customerHealthData.atRiskCustomers}{' '}
                at-risk
              </p>
              <Progress value={customerHealthData.averageHealthScore} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Churn Rate
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{customerHealthData.churnRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Target:{' '}
                {customerHealthData.churnRate * (1 - customerHealthData.churnReductionTarget / 100)}
                % (-{customerHealthData.churnReductionTarget}%)
              </p>
              <div className="flex items-center text-xs text-green-600 mt-2">
                <TrendingDown className="h-3 w-3 mr-1" />
                -1.2% vs last quarter
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Portal Adoption
              </CardTitle>
              <Globe className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{customerHealthData.portalAdoptionRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {customerHealthData.activeSessions} active sessions today
              </p>
              <Progress value={customerHealthData.portalAdoptionRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Customer Satisfaction
              </CardTitle>
              <Star className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{customerHealthData.satisfactionScore}/5.0</div>
              <p className="text-xs text-muted-foreground mt-1">
                NPS: {customerHealthData.nps} (Excellent)
              </p>
              <div className="flex items-center text-xs text-green-600 mt-2">
                <TrendingUp className="h-3 w-3 mr-1" />
                +0.3 vs last month
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="health" className="space-y-4">
          <TabsList>
            <TabsTrigger value="health">
              <Heart className="h-4 w-4 mr-2" />
              Customer Health
            </TabsTrigger>
            <TabsTrigger value="features">
              <Sparkles className="h-4 w-4 mr-2" />
              Connect Features
            </TabsTrigger>
            <TabsTrigger value="roi">
              <BarChart3 className="h-4 w-4 mr-2" />
              ROI Impact
            </TabsTrigger>
          </TabsList>

          {/* Customer Health */}
          <TabsContent value="health" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>At-Risk Customers Requiring Attention</CardTitle>
                <CardDescription>
                  AI-predicted churn risk with recommended interventions to save these accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {atRiskCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-lg">{customer.name}</h4>
                            <Badge
                              variant={
                                customer.riskLevel === 'critical'
                                  ? 'destructive'
                                  : customer.riskLevel === 'high'
                                    ? 'default'
                                    : 'secondary'
                              }
                            >
                              {customer.riskLevel} risk
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            MRR: ${customer.mrr.toLocaleString()} • {customer.churnProbability}%
                            churn probability
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-red-600">
                            {customer.healthScore}
                          </div>
                          <p className="text-xs text-muted-foreground">Health Score</p>
                          <div className="flex items-center justify-end text-xs text-red-600 mt-1">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Declining
                          </div>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-sm font-medium mb-2">Issues Detected:</p>
                          <div className="flex flex-wrap gap-1">
                            {customer.issues.map((issue) => (
                              <Badge key={issue} variant="outline" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">AI Recommendation:</p>
                          <div className="flex items-start gap-2">
                            <Target className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm font-semibold text-blue-600">
                              {customer.recommendation}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="default">
                          <Phone className="mr-2 h-4 w-4" />
                          Call Customer
                        </Button>
                        <Button size="sm" variant="outline">
                          <Mail className="mr-2 h-4 w-4" />
                          Send Email
                        </Button>
                        <Button size="sm" variant="outline">
                          <Calendar className="mr-2 h-4 w-4" />
                          Schedule Review
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/customer-success-management">
                      View All {customerHealthData.atRiskCustomers} At-Risk Customers
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Why Connect Beats E-Automate */}
            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-orange-600" />
                  Why Connect Beats E-Automate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-red-700 mb-3">❌ E-Automate (Dealer-Only)</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>No customer-facing portal (customers call/email for everything)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>No churn prediction or early warning system</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>Customers can't see equipment health or usage data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>Manual satisfaction tracking (if any)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>Reactive support model only</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-700 mb-3">
                      ✅ Printyx Connect (B2B2C Platform)
                    </h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">
                          White-label portal for customer self-service 24/7
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">
                          AI predicts churn weeks before customers leave
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">
                          Real-time equipment dashboards with proactive alerts
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">
                          Automated satisfaction surveys with NPS tracking
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">
                          Proactive interventions prevent churn (25-30% reduction)
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-white rounded-lg border border-orange-200">
                  <p className="text-sm font-semibold text-center">
                    <Heart className="inline h-4 w-4 mr-1 text-pink-600" />
                    Dealers using Connect retain{' '}
                    <span className="text-orange-600">25-30% more customers</span> annually (avg.
                    $300K+ in saved revenue)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Connect Features */}
          <TabsContent value="features" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Customer Success Platform Features</CardTitle>
                <CardDescription>
                  Transform from a transactional vendor into a strategic partner your customers
                  can't live without
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {connectFeatures.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <Card
                        key={feature.id}
                        className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
                        onClick={() => setSelectedFeature(feature.id)}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className={`p-3 rounded-lg ${feature.color} bg-opacity-10`}>
                              <Icon
                                className={`h-6 w-6 ${feature.color.replace('bg-', 'text-')}`}
                              />
                            </div>
                            <Badge variant="secondary">{feature.category}</Badge>
                          </div>
                          <CardTitle className="text-lg mt-4">{feature.name}</CardTitle>
                          <CardDescription className="text-sm">
                            {feature.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="p-2 bg-green-50 rounded-lg border border-green-200">
                              <p className="text-xs text-muted-foreground">Impact:</p>
                              <p className="text-sm font-semibold text-green-700">
                                {feature.impact}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-medium">Features:</p>
                              <div className="flex flex-wrap gap-1">
                                {feature.features.slice(0, 2).map((f) => (
                                  <Badge key={f} variant="outline" className="text-xs">
                                    {f}
                                  </Badge>
                                ))}
                                {feature.features.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{feature.features.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Badge
                              variant={feature.status === 'Active' ? 'default' : 'secondary'}
                              className="w-full justify-center"
                            >
                              {feature.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ROI Impact */}
          <TabsContent value="roi" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Connect ROI Calculator</CardTitle>
                <CardDescription>
                  Calculate the financial impact of transforming customer relationships with Connect
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid md:grid-cols-3 gap-6">
                    <Card className="bg-pink-50 border-pink-200">
                      <CardHeader>
                        <CardTitle className="text-lg">Churn Reduction</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-pink-600">-25%</div>
                        <p className="text-sm text-muted-foreground mt-1">customer churn</p>
                        <div className="mt-4 text-sm">
                          <p className="text-muted-foreground">Annual revenue saved:</p>
                          <p className="text-2xl font-bold text-pink-600 mt-1">
                            ${calculateChurnSavings().toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Based on {customerHealthData.totalCustomers} customers
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-blue-50 border-blue-200">
                      <CardHeader>
                        <CardTitle className="text-lg">Operational Efficiency</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-blue-600">-50%</div>
                        <p className="text-sm text-muted-foreground mt-1">support call volume</p>
                        <div className="mt-4 text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Portal self-service</span>
                            <span className="font-semibold">64% adoption</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Faster responses</span>
                            <span className="font-semibold">40% improvement</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Time saved</span>
                            <span className="font-semibold">15 hrs/week</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-green-50 border-green-200">
                      <CardHeader>
                        <CardTitle className="text-lg">Revenue Growth</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-600">+15%</div>
                        <p className="text-sm text-muted-foreground mt-1">renewal rates</p>
                        <div className="mt-4 text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Better retention</span>
                            <span className="font-semibold">+15%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Upsell opportunities</span>
                            <span className="font-semibold">+10%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Customer LTV</span>
                            <span className="font-semibold">+28%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <h3 className="text-2xl font-bold mb-2">Total Annual Impact</h3>
                        <div className="text-5xl font-bold text-green-600 mb-4">
                          ${(calculateChurnSavings() + 78000).toLocaleString()}
                        </div>
                        <p className="text-muted-foreground">
                          Revenue retention + operational savings
                        </p>
                        <div className="grid md:grid-cols-3 gap-4 mt-6 text-sm">
                          <div className="p-3 bg-white rounded-lg">
                            <p className="text-muted-foreground">Churn Prevention</p>
                            <p className="text-xl font-bold text-green-600">
                              ${calculateChurnSavings().toLocaleString()}
                            </p>
                          </div>
                          <div className="p-3 bg-white rounded-lg">
                            <p className="text-muted-foreground">Efficiency Gains</p>
                            <p className="text-xl font-bold text-green-600">$78,000</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg">
                            <p className="text-muted-foreground">Customer LTV Increase</p>
                            <p className="text-xl font-bold text-green-600">+28%</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-blue-200">
                    <CardHeader>
                      <CardTitle className="text-lg">Customer Testimonial</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-start gap-4">
                        <ThumbsUp className="h-8 w-8 text-blue-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm italic mb-2">
                            "Since implementing Printyx Connect, our customer churn dropped from 8%
                            to 3%. The AI health scores helped us identify at-risk accounts before
                            they cancelled, and the customer portal reduced support calls by 60%.
                            Our customers love the self-service capabilities."
                          </p>
                          <p className="text-sm font-semibold">— Regional Dealer, 300+ customers</p>
                          <div className="flex items-center gap-1 mt-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-pink-600 to-purple-600 text-white border-0">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Transform Customer Relationships?</h2>
            <p className="text-xl mb-6 text-white/90">
              Join forward-thinking dealers who retain 25-30% more customers with Printyx Connect
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/customer-success-management">
                  <Heart className="mr-2 h-5 w-5" />
                  View Customer Health Dashboard
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                asChild
              >
                <Link href="/customer-self-service-portal">
                  Try Customer Portal Demo
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
