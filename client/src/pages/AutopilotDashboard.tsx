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
  Zap,
  TrendingUp,
  Clock,
  CheckCircle,
  PlayCircle,
  Settings,
  ArrowRight,
  Sparkles,
  Target,
  Users,
  Calendar,
  Mail,
  Phone,
  Package,
  Wrench,
  FileText,
  BarChart3,
  AlertCircle,
  Brain,
  Workflow,
  ChevronRight,
  DollarSign,
  Timer,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';

export default function AutopilotDashboard() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Fetch workflow automation data
  const { data: automationData, isLoading } = useQuery({
    queryKey: ['/api/workflow-automation/dashboard'],
    queryFn: () => apiRequest('/api/workflow-automation/dashboard'),
  });

  const overview = automationData?.automationOverview;
  const activeWorkflows = automationData?.activeWorkflows || [];
  const templates = automationData?.workflowTemplates || [];

  // Calculate additional metrics
  const calculateMonthlyROI = () => {
    if (!overview) return 0;
    const hoursSaved = overview.timeSaved || 0;
    const hourlyRate = 35; // Average admin hourly rate
    return Math.round(hoursSaved * hourlyRate);
  };

  const quickStartTemplates = [
    {
      id: 'lead-routing',
      name: 'Auto Lead Routing',
      description: 'Automatically score and assign leads to the best sales rep based on territory, expertise, and workload',
      icon: Users,
      category: 'Sales',
      timeSaved: '5 hrs/week',
      color: 'bg-blue-500',
      features: ['AI Lead Scoring', 'Auto Assignment', 'Email Notifications', 'Performance Tracking']
    },
    {
      id: 'service-dispatch',
      name: 'Smart Service Dispatch',
      description: 'Predict maintenance needs and auto-schedule technicians based on location, skills, and availability',
      icon: Wrench,
      category: 'Service',
      timeSaved: '10 hrs/week',
      color: 'bg-green-500',
      features: ['Predictive Maintenance', 'Auto Scheduling', 'Route Optimization', 'Parts Ordering']
    },
    {
      id: 'supply-replenishment',
      name: 'Supply Auto-Replenishment',
      description: 'Monitor toner levels and automatically create supply orders when inventory is low',
      icon: Package,
      category: 'Inventory',
      timeSaved: '8 hrs/week',
      color: 'bg-purple-500',
      features: ['Real-time Monitoring', 'Auto Orders', 'Customer Approval', 'Inventory Sync']
    },
    {
      id: 'contract-renewal',
      name: 'Contract Renewal Autopilot',
      description: 'Automatically track contract renewals, predict churn risk, and trigger retention campaigns',
      icon: FileText,
      category: 'Customer Success',
      timeSaved: '12 hrs/week',
      color: 'bg-orange-500',
      features: ['Churn Prediction', 'Auto Reminders', 'Proposal Generation', 'Success Tracking']
    },
    {
      id: 'customer-onboarding',
      name: 'Customer Onboarding Flow',
      description: 'Welcome new customers with automated email sequences, task creation, and installation scheduling',
      icon: Sparkles,
      category: 'Customer Success',
      timeSaved: '6 hrs/week',
      color: 'bg-pink-500',
      features: ['Welcome Emails', 'Task Creation', 'Install Scheduling', 'Training Setup']
    },
    {
      id: 'invoice-collection',
      name: 'Invoice Collection Workflow',
      description: 'Automatically send payment reminders, track overdue invoices, and escalate to collections',
      icon: DollarSign,
      category: 'Finance',
      timeSaved: '4 hrs/week',
      color: 'bg-yellow-500',
      features: ['Payment Reminders', 'Overdue Tracking', 'Auto Escalation', 'Collection Reports']
    }
  ];

  if (isLoading) {
    return (
      <MainLayout title="Printyx Autopilot" description="AI-Powered Dealer Operations on Autopilot">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading automation dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Printyx Autopilot"
      description="The first self-running dealer management system"
    >
      <div className="container mx-auto p-6 space-y-8">

        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 md:p-12">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-8 w-8" />
              <h1 className="text-4xl font-bold">Printyx Autopilot</h1>
              <Badge variant="secondary" className="ml-2 bg-white/20 text-white border-white/40">
                AI-Powered
              </Badge>
            </div>
            <p className="text-xl mb-6 max-w-2xl text-white/90">
              The first dealer management system that runs itself. While E-Automate manages your business,
              <span className="font-bold"> Printyx runs it for you</span>.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/workflow-automation">
                  <Settings className="mr-2 h-4 w-4" />
                  Configure Workflows
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20" asChild>
                <Link href="/compare-eautomate">
                  Compare with E-Automate
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="absolute top-0 right-0 opacity-10">
            <Brain className="h-64 w-64" />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Automations
              </CardTitle>
              <Workflow className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{overview?.activeWorkflows || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {overview?.pausedWorkflows || 0} paused • {overview?.totalWorkflows || 0} total
              </p>
              <Progress value={(overview?.activeWorkflows / overview?.totalWorkflows) * 100 || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Time Saved This Month
              </CardTitle>
              <Clock className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{overview?.timeSaved?.toFixed(1) || 0} hrs</div>
              <p className="text-xs text-muted-foreground mt-1">
                ≈ ${calculateMonthlyROI().toLocaleString()} in labor costs
              </p>
              <div className="flex items-center text-xs text-green-600 mt-2">
                <TrendingUp className="h-3 w-3 mr-1" />
                +23% vs last month
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Success Rate
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{overview?.successRate?.toFixed(1) || 0}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {overview?.executionsToday?.toLocaleString() || 0} executions today
              </p>
              <Progress value={overview?.successRate || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Automation Coverage
              </CardTitle>
              <Target className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{overview?.automationCoverage?.toFixed(1) || 0}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                of processes automated
              </p>
              <Progress value={overview?.automationCoverage || 0} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="quickstart" className="space-y-4">
          <TabsList>
            <TabsTrigger value="quickstart">
              <Sparkles className="h-4 w-4 mr-2" />
              Quick Start Templates
            </TabsTrigger>
            <TabsTrigger value="active">
              <Activity className="h-4 w-4 mr-2" />
              Active Workflows
            </TabsTrigger>
            <TabsTrigger value="roi">
              <BarChart3 className="h-4 w-4 mr-2" />
              ROI Calculator
            </TabsTrigger>
          </TabsList>

          {/* Quick Start Templates */}
          <TabsContent value="quickstart" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Quick Start Templates</CardTitle>
                <CardDescription>
                  Pre-built automation workflows that you can activate in minutes. These are the exact workflows
                  that top-performing dealers use to save 40+ hours per week.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quickStartTemplates.map((template) => {
                    const Icon = template.icon;
                    return (
                      <Card
                        key={template.id}
                        className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
                        onClick={() => setSelectedTemplate(template.id)}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className={`p-3 rounded-lg ${template.color} bg-opacity-10`}>
                              <Icon className={`h-6 w-6 ${template.color.replace('bg-', 'text-')}`} />
                            </div>
                            <Badge variant="secondary">{template.category}</Badge>
                          </div>
                          <CardTitle className="text-lg mt-4">{template.name}</CardTitle>
                          <CardDescription className="text-sm">
                            {template.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Time Saved:</span>
                              <span className="font-semibold text-green-600">{template.timeSaved}</span>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-medium">Features:</p>
                              <div className="flex flex-wrap gap-1">
                                {template.features.slice(0, 2).map((feature) => (
                                  <Badge key={feature} variant="outline" className="text-xs">
                                    {feature}
                                  </Badge>
                                ))}
                                {template.features.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{template.features.length - 2} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button className="w-full mt-2" size="sm">
                              <PlayCircle className="mr-2 h-4 w-4" />
                              Activate Workflow
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Why Autopilot Beats E-Automate */}
            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-orange-600" />
                  Why Autopilot Beats E-Automate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-red-700 mb-3">❌ E-Automate (Manual)</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>Leads require manual assignment to reps</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>Service calls scheduled manually by dispatcher</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>Supply ordering requires staff to check inventory</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>Contract renewals tracked in spreadsheets</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>No churn prediction or prevention</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-700 mb-3">✅ Printyx Autopilot (AI-Powered)</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">AI scores and auto-assigns leads in under 5 minutes</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">Predictive maintenance schedules techs automatically</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">Auto-creates supply orders when toner drops below 15%</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">AI-powered renewal campaigns with churn prediction</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">Prevents churn before customers leave (20-30% reduction)</span>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-white rounded-lg border border-orange-200">
                  <p className="text-sm font-semibold text-center">
                    <Timer className="inline h-4 w-4 mr-1 text-orange-600" />
                    Average dealer saves <span className="text-orange-600">40-50 hours per week</span> with Autopilot
                    (equivalent to 1+ full-time employee)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Workflows */}
          <TabsContent value="active" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Currently Running Automations</CardTitle>
                <CardDescription>
                  Workflows that are actively running in your dealership right now
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeWorkflows.length === 0 ? (
                  <div className="text-center py-12">
                    <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No active workflows yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Get started by activating a quick-start template above
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeWorkflows.slice(0, 5).map((workflow: any) => (
                      <div key={workflow.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">{workflow.name}</h4>
                              <Badge variant={workflow.status === 'active' ? 'default' : 'secondary'}>
                                {workflow.status}
                              </Badge>
                              <Badge variant="outline">{workflow.category}</Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
                              <div>
                                <p className="text-muted-foreground">Success Rate</p>
                                <p className="font-semibold text-green-600">{workflow.successRate}%</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Executions</p>
                                <p className="font-semibold">{workflow.executionCount?.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Time Saved</p>
                                <p className="font-semibold">{workflow.estimatedTimeSaved} hrs/mo</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Last Run</p>
                                <p className="font-semibold">
                                  {workflow.lastExecution ? format(new Date(workflow.lastExecution), 'MMM d, h:mm a') : 'Never'}
                                </p>
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href="/workflow-automation">
                              <Settings className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/workflow-automation">
                        View All Workflows
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ROI Calculator */}
          <TabsContent value="roi" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Autopilot ROI Calculator</CardTitle>
                <CardDescription>
                  Calculate the financial impact of automating your dealer operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid md:grid-cols-3 gap-6">
                    <Card className="bg-blue-50 border-blue-200">
                      <CardHeader>
                        <CardTitle className="text-lg">Time Savings</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-blue-600">
                          {overview?.timeSaved?.toFixed(0) || 0} hrs
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">per month</p>
                        <div className="mt-4 text-sm">
                          <p className="text-muted-foreground">At $35/hour avg rate:</p>
                          <p className="text-2xl font-bold text-blue-600 mt-1">
                            ${calculateMonthlyROI().toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">monthly labor savings</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-green-50 border-green-200">
                      <CardHeader>
                        <CardTitle className="text-lg">Revenue Impact</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-600">
                          +15%
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">average close rate</p>
                        <div className="mt-4 text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Faster lead response</span>
                            <span className="font-semibold">+10%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Better renewals</span>
                            <span className="font-semibold">+15%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Supply automation</span>
                            <span className="font-semibold">+5%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-purple-50 border-purple-200">
                      <CardHeader>
                        <CardTitle className="text-lg">Churn Reduction</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-purple-600">
                          -25%
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">customer churn</p>
                        <div className="mt-4 text-sm">
                          <p className="text-muted-foreground">For avg dealer with:</p>
                          <p className="text-muted-foreground">200 customers @ $500 MRR</p>
                          <p className="text-2xl font-bold text-purple-600 mt-2">
                            $300K
                          </p>
                          <p className="text-xs text-muted-foreground">annual revenue saved</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <h3 className="text-2xl font-bold mb-2">Total Annual ROI</h3>
                        <div className="text-5xl font-bold text-green-600 mb-4">
                          ${(calculateMonthlyROI() * 12 + 300000).toLocaleString()}
                        </div>
                        <p className="text-muted-foreground">
                          Based on current automation usage + projected revenue retention
                        </p>
                        <div className="grid md:grid-cols-3 gap-4 mt-6 text-sm">
                          <div className="p-3 bg-white rounded-lg">
                            <p className="text-muted-foreground">Labor Savings</p>
                            <p className="text-xl font-bold text-green-600">
                              ${(calculateMonthlyROI() * 12).toLocaleString()}
                            </p>
                          </div>
                          <div className="p-3 bg-white rounded-lg">
                            <p className="text-muted-foreground">Revenue Retention</p>
                            <p className="text-xl font-bold text-green-600">$300,000</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg">
                            <p className="text-muted-foreground">Payback Period</p>
                            <p className="text-xl font-bold text-green-600">&lt; 30 days</p>
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
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Put Your Dealership on Autopilot?</h2>
            <p className="text-xl mb-6 text-white/90">
              Join top-performing dealers who save 40+ hours per week with AI automation
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/workflow-automation">
                  <Zap className="mr-2 h-5 w-5" />
                  Configure Your Automations
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                asChild
              >
                <Link href="/compare-eautomate">
                  See How We Compare
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
