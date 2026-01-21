import { useState } from 'react';
import { Link } from 'wouter';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Check,
  X,
  Zap,
  Heart,
  TrendingUp,
  Clock,
  DollarSign,
  Users,
  Brain,
  Smartphone,
  Globe,
  Shield,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Target,
  Award,
  BarChart3,
  Rocket,
} from 'lucide-react';

export default function CompareEAutomate() {
  const [employees, setEmployees] = useState(10);
  const [customers, setCustomers] = useState(200);
  const [avgMRR, setAvgMRR] = useState(500);

  const calculateROI = () => {
    // Time savings calculations
    const autopilotHoursSaved = 40; // hours per week
    const hourlyRate = 35;
    const weeksPerYear = 52;
    const timeSavings = autopilotHoursSaved * hourlyRate * weeksPerYear;

    // Churn reduction calculations
    const currentChurnRate = 0.08; // 8% annual churn (E-Automate typical)
    const printyxChurnRate = 0.03; // 3% annual churn (with Connect)
    const churnImprovement = currentChurnRate - printyxChurnRate;
    const annualChurnSavings = customers * churnImprovement * avgMRR * 12;

    // Revenue increase calculations
    const closeRateIncrease = 0.15; // 15% better close rate with Autopilot
    const avgDealSize = avgMRR * 12;
    const estimatedNewDeals = 50; // per year
    const revenueIncrease = estimatedNewDeals * closeRateIncrease * avgDealSize;

    // Total ROI
    const totalAnnualBenefit = timeSavings + annualChurnSavings + revenueIncrease;

    return {
      timeSavings: Math.round(timeSavings),
      churnSavings: Math.round(annualChurnSavings),
      revenueIncrease: Math.round(revenueIncrease),
      totalAnnualBenefit: Math.round(totalAnnualBenefit),
    };
  };

  const roi = calculateROI();

  const featureComparison = [
    {
      category: 'AI & Automation',
      icon: Brain,
      features: [
        {
          name: 'AI Lead Scoring & Auto-Routing',
          printyx: true,
          eautomate: false,
          description: 'AI scores leads and auto-assigns to best rep in under 5 minutes',
        },
        {
          name: 'Predictive Service Dispatch',
          printyx: true,
          eautomate: false,
          description: 'AI predicts maintenance needs and auto-schedules technicians',
        },
        {
          name: 'Workflow Automation (56+ action types)',
          printyx: true,
          eautomate: false,
          description: 'Email, SMS, tasks, approvals, conditional logic, and more',
        },
        {
          name: 'AI Meeting Notes → Proposal Pipeline',
          printyx: true,
          eautomate: false,
          description:
            'Upload meeting notes, AI extracts requirements and generates full proposals with pricing',
        },
        {
          name: 'Smart Churn Prediction',
          printyx: true,
          eautomate: false,
          description: 'ML-powered prediction of which customers will leave (68-82% accuracy)',
        },
        {
          name: 'Manual Lead Assignment',
          printyx: false,
          eautomate: true,
          description: 'Dispatcher manually assigns leads to reps',
        },
      ],
    },
    {
      category: 'Customer Portal (B2B2C)',
      icon: Heart,
      features: [
        {
          name: 'White-Label Customer Portal',
          printyx: true,
          eautomate: false,
          description: 'Customers get branded self-service portal with your logo/domain',
        },
        {
          name: 'Self-Service Request Management',
          printyx: true,
          eautomate: false,
          description: 'Customers submit service requests, track status, rate satisfaction',
        },
        {
          name: 'Real-Time Equipment Health Dashboards',
          printyx: true,
          eautomate: false,
          description: 'Customers see toner levels, status, usage analytics 24/7',
        },
        {
          name: 'Online Supply Ordering',
          printyx: true,
          eautomate: false,
          description: 'Customers order supplies directly with auto-pricing',
        },
        {
          name: 'Meter Reading Submissions (Photo Upload)',
          printyx: true,
          eautomate: false,
          description: 'Customers submit meter readings via photo or manual entry',
        },
        {
          name: 'Customer Health Scoring',
          printyx: true,
          eautomate: false,
          description: 'Track customer health (0-100) with churn risk alerts',
        },
        {
          name: 'Customer Portal',
          printyx: false,
          eautomate: false,
          description: 'E-Automate has no customer-facing portal',
        },
      ],
    },
    {
      category: 'Mobile & Modern UX',
      icon: Smartphone,
      features: [
        {
          name: 'Mobile-First Design',
          printyx: true,
          eautomate: false,
          description: 'Optimized for mobile with touch interactions and responsive design',
        },
        {
          name: 'Progressive Web App (PWA)',
          printyx: true,
          eautomate: false,
          description: 'Install on mobile devices, works offline',
        },
        {
          name: 'Modern React UI',
          printyx: true,
          eautomate: false,
          description: 'Fast, intuitive interface with real-time updates',
        },
        {
          name: 'Real-Time WebSocket Updates',
          printyx: true,
          eautomate: false,
          description: 'Live notifications and data updates without page refresh',
        },
        {
          name: 'Desktop Application Only',
          printyx: false,
          eautomate: true,
          description: 'E-Automate requires desktop software installation',
        },
      ],
    },
    {
      category: 'Analytics & Reporting',
      icon: BarChart3,
      features: [
        {
          name: 'AI-Powered Sales Forecasting',
          printyx: true,
          eautomate: false,
          description: 'Predictive revenue forecasting with ML models',
        },
        {
          name: 'Customer Success Analytics',
          printyx: true,
          eautomate: false,
          description: 'Health scores, churn trends, intervention tracking',
        },
        {
          name: 'Real-Time Dashboards',
          printyx: true,
          eautomate: false,
          description: 'Live metrics updating in real-time via WebSocket',
        },
        {
          name: 'Custom Report Builder',
          printyx: true,
          eautomate: true,
          description: 'Both platforms support custom reporting',
        },
        {
          name: 'Conversational Analytics (AI Queries)',
          printyx: true,
          eautomate: false,
          description: 'Ask questions in plain English, get instant answers',
        },
        {
          name: 'Scheduled Reports with Email Delivery',
          printyx: true,
          eautomate: false,
          description: 'Auto-generate and email reports on daily/weekly/monthly schedules',
        },
      ],
    },
    {
      category: 'Core Dealer Features',
      icon: Target,
      features: [
        {
          name: 'CRM & Lead Management',
          printyx: true,
          eautomate: true,
          description: 'Both platforms support CRM functionality',
        },
        {
          name: 'Service Dispatch & Field Service',
          printyx: true,
          eautomate: true,
          description: 'Both support service dispatch',
        },
        {
          name: 'Inventory Management',
          printyx: true,
          eautomate: true,
          description: 'Both support inventory tracking',
        },
        {
          name: 'Meter Billing',
          printyx: true,
          eautomate: true,
          description: 'Both support meter-based billing',
        },
        {
          name: 'Contract Management',
          printyx: true,
          eautomate: true,
          description: 'Both support contract tracking',
        },
        {
          name: 'QuickBooks Integration',
          printyx: true,
          eautomate: true,
          description: 'Both integrate with QuickBooks',
        },
      ],
    },
    {
      category: 'Platform & Technology',
      icon: Rocket,
      features: [
        {
          name: 'Cloud-Native (Serverless)',
          printyx: true,
          eautomate: false,
          description: 'Scales automatically, no server management',
        },
        {
          name: 'Modern Tech Stack',
          printyx: true,
          eautomate: false,
          description: 'React, TypeScript, PostgreSQL, Node.js',
        },
        {
          name: 'API-First Architecture',
          printyx: true,
          eautomate: false,
          description: 'RESTful APIs for all features, easy integrations',
        },
        {
          name: 'Integration Marketplace (16+ Integrations)',
          printyx: true,
          eautomate: false,
          description:
            'Pre-built integrations with QuickBooks, Salesforce, Stripe, DocuSign, and more',
        },
        {
          name: 'Multi-Tenant SaaS',
          printyx: true,
          eautomate: true,
          description: 'Both are multi-tenant systems',
        },
        {
          name: 'Regular Updates & Features',
          printyx: true,
          eautomate: false,
          description: 'New features released monthly vs. yearly',
        },
        {
          name: 'Legacy .NET Architecture',
          printyx: false,
          eautomate: true,
          description: 'E-Automate built on older technology',
        },
      ],
    },
  ];

  return (
    <MainLayout
      title="Printyx vs E-Automate"
      description="See how Printyx outperforms E-Automate with AI automation and customer success features"
    >
      <div className="container mx-auto p-6 space-y-8">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="h-3 w-3 mr-1" />
            Competitive Comparison
          </Badge>
          <h1 className="text-5xl font-bold mb-4">Printyx vs E-Automate</h1>
          <p className="text-xl text-muted-foreground mb-8">
            E-Automate manages your dealership. Printyx{' '}
            <span className="font-bold text-primary">runs it for you</span>.
          </p>
          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">75+</div>
              <p className="text-sm text-muted-foreground">Unique features</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">40+</div>
              <p className="text-sm text-muted-foreground">Hours saved/week</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">-25%</div>
              <p className="text-sm text-muted-foreground">Customer churn</p>
            </div>
          </div>
        </div>

        {/* ROI Calculator */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              ROI Calculator: Your Annual Savings with Printyx
            </CardTitle>
            <CardDescription>
              Calculate your projected savings by switching from E-Automate to Printyx
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div>
                <Label htmlFor="employees">Number of Employees</Label>
                <Input
                  id="employees"
                  type="number"
                  value={employees}
                  onChange={(e) => setEmployees(parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="customers">Number of Customers</Label>
                <Input
                  id="customers"
                  type="number"
                  value={customers}
                  onChange={(e) => setCustomers(parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="avgMRR">Average MRR per Customer</Label>
                <Input
                  id="avgMRR"
                  type="number"
                  value={avgMRR}
                  onChange={(e) => setAvgMRR(parseInt(e.target.value) || 0)}
                  className="mt-1"
                  placeholder="$500"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Labor Savings (Autopilot)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    ${roi.timeSavings.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">40 hrs/week @ $35/hr</p>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Churn Prevention (Connect)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-pink-600">
                    ${roi.churnSavings.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">8% → 3% churn reduction</p>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Revenue Increase
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    ${roi.revenueIncrease.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">+15% better close rates</p>
                </CardContent>
              </Card>
            </div>

            <div className="p-6 bg-white rounded-lg border border-green-300 text-center">
              <p className="text-sm text-muted-foreground mb-2">Total Annual Benefit</p>
              <div className="text-5xl font-bold text-green-600 mb-2">
                ${roi.totalAnnualBenefit.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">
                Based on your dealership size and current metrics
              </p>
              <div className="flex justify-center gap-4 mt-4">
                <Button asChild>
                  <Link href="/autopilot">
                    <Zap className="mr-2 h-4 w-4" />
                    Explore Autopilot
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/connect">
                    <Heart className="mr-2 h-4 w-4" />
                    Explore Connect
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Feature-by-Feature Comparison</CardTitle>
            <CardDescription>
              See exactly how Printyx stacks up against E-Automate across all major categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={featureComparison[0].category} className="space-y-4">
              <TabsList className="grid grid-cols-2 lg:grid-cols-6">
                {featureComparison.map((category) => {
                  const Icon = category.icon;
                  return (
                    <TabsTrigger key={category.category} value={category.category}>
                      <Icon className="h-4 w-4 mr-2" />
                      <span className="hidden lg:inline">{category.category}</span>
                      <span className="lg:hidden">{category.category.split(' ')[0]}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {featureComparison.map((category) => (
                <TabsContent
                  key={category.category}
                  value={category.category}
                  className="space-y-3"
                >
                  {category.features.map((feature, index) => (
                    <div
                      key={index}
                      className="grid md:grid-cols-[1fr,100px,100px] gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div>
                        <h4 className="font-semibold mb-1">{feature.name}</h4>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                      <div className="flex items-center justify-center">
                        {feature.printyx ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <Check className="h-5 w-5" />
                            <span className="font-semibold hidden md:inline">Printyx</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-600">
                            <X className="h-5 w-5" />
                            <span className="font-semibold hidden md:inline">Printyx</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-center">
                        {feature.eautomate ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <Check className="h-5 w-5" />
                            <span className="font-semibold hidden md:inline">E-Automate</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-600">
                            <X className="h-5 w-5" />
                            <span className="font-semibold hidden md:inline">E-Automate</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Summary Comparison */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-green-600" />
                Why Dealers Choose Printyx
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">AI Automation = 40+ Hours Saved/Week</p>
                    <p className="text-sm text-muted-foreground">
                      Autopilot runs your dealership while you focus on growth
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Customer Portal = 25-30% Less Churn</p>
                    <p className="text-sm text-muted-foreground">
                      Connect prevents customers from leaving before they cancel
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Modern Technology = Faster Innovation</p>
                    <p className="text-sm text-muted-foreground">
                      New features monthly vs. yearly with E-Automate
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Mobile-First = Work from Anywhere</p>
                    <p className="text-sm text-muted-foreground">
                      Full functionality on phone/tablet, not just desktop
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Predictive Analytics = Stay Ahead</p>
                    <p className="text-sm text-muted-foreground">
                      Know what will happen before it does
                    </p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                E-Automate Limitations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <X className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Manual Workflows = Wasted Time</p>
                    <p className="text-sm text-muted-foreground">
                      No AI automation, everything requires human intervention
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <X className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">No Customer Portal = Higher Churn</p>
                    <p className="text-sm text-muted-foreground">
                      Customers call/email for everything, no self-service
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <X className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Legacy Technology = Slow Updates</p>
                    <p className="text-sm text-muted-foreground">
                      Built on old .NET stack, yearly release cycles
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <X className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Desktop-Only = Limited Mobility</p>
                    <p className="text-sm text-muted-foreground">
                      No mobile optimization, poor remote access
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <X className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Reactive Only = Always Behind</p>
                    <p className="text-sm text-muted-foreground">
                      No churn prediction or proactive maintenance
                    </p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Migration Guide CTA */}
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4">Ready to Make the Switch?</h2>
                <p className="text-lg mb-6 text-white/90">
                  Join forward-thinking dealers who are saving 40+ hours per week and retaining
                  25-30% more customers with Printyx.
                </p>
                <ul className="space-y-2 text-white/90 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    Free migration assistance
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    Data import from E-Automate
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    Dedicated onboarding team
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    Training for your entire team
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <Card className="bg-white/10 border-white/20 text-white">
                  <CardContent className="p-6">
                    <div className="text-4xl font-bold mb-2">
                      ${roi.totalAnnualBenefit.toLocaleString()}
                    </div>
                    <p className="text-white/80">Projected annual savings for your dealership</p>
                  </CardContent>
                </Card>
                <div className="flex gap-3">
                  <Button size="lg" variant="secondary" className="flex-1" asChild>
                    <Link href="/autopilot">
                      <Zap className="mr-2 h-5 w-5" />
                      See Autopilot
                    </Link>
                  </Button>
                  <Button size="lg" variant="secondary" className="flex-1" asChild>
                    <Link href="/connect">
                      <Heart className="mr-2 h-5 w-5" />
                      See Connect
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
