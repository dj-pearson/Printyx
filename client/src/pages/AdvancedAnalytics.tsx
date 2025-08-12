import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  TrendingUp, 
  Eye, 
  Brain, 
  Activity,
  AlertTriangle,
  Target,
  Lightbulb,
  ArrowRight
} from 'lucide-react';
import PredictiveInsights from '@/components/analytics/PredictiveInsights';
import AnomalyDetection from '@/components/analytics/AnomalyDetection';
import ProcessHelpBanner from '@/components/training/ProcessHelpBanner';

export default function AdvancedAnalytics() {
  const [activeTab, setActiveTab] = useState('overview');

  const analyticsFeatures = [
    {
      id: 'predictive',
      title: 'Predictive Analytics',
      description: 'AI-powered forecasting and trend analysis',
      icon: Brain,
      status: 'active',
      capabilities: [
        'Sales forecasting with 87% accuracy',
        'Customer churn prediction',
        'Revenue optimization insights',
        'Service cost reduction recommendations'
      ]
    },
    {
      id: 'anomaly',
      title: 'Anomaly Detection',
      description: 'Real-time detection of unusual patterns',
      icon: Eye,
      status: 'active',
      capabilities: [
        'Automated pattern recognition',
        'Performance deviation alerts',
        'Root cause analysis suggestions',
        'Historical pattern learning'
      ]
    },
    {
      id: 'optimization',
      title: 'Performance Optimization',
      description: 'Continuous improvement recommendations',
      icon: Target,
      status: 'beta',
      capabilities: [
        'Process efficiency scoring',
        'Resource allocation optimization',
        'Workflow bottleneck identification',
        'ROI improvement suggestions'
      ]
    },
    {
      id: 'insights',
      title: 'Business Intelligence',
      description: 'Advanced reporting and data insights',
      icon: Lightbulb,
      status: 'planning',
      capabilities: [
        'Cross-functional analytics',
        'Market trend analysis',
        'Competitive positioning insights',
        'Strategic planning support'
      ]
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
      case 'beta':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Beta</Badge>;
      case 'planning':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Planned</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <MainLayout title="Advanced Analytics" description="Leverage AI and machine learning for predictive insights and automated detection">
      <div className="container mx-auto p-6 space-y-6">
        {/* Process Help Banner */}
        <ProcessHelpBanner 
          processType="advanced-analytics"
          currentStage="data-analysis"
          nextStage="actionable-insights"
          estimatedTime="Real-time"
        />
        {/* Header with Overview */}
        <div className="flex justify-end items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Real-time ML
              </Badge>
              <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                <Brain className="h-3 w-3 mr-1" />
                AI-Powered
              </Badge>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="predictive">Predictive Analytics</TabsTrigger>
            <TabsTrigger value="anomaly">Anomaly Detection</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="space-y-6">
              {/* Feature Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {analyticsFeatures.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <Card key={feature.id} className="relative">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{feature.title}</CardTitle>
                              <CardDescription>{feature.description}</CardDescription>
                            </div>
                          </div>
                          {getStatusBadge(feature.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm">Key Capabilities:</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {feature.capabilities.map((capability, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                                {capability}
                              </li>
                            ))}
                          </ul>
                          {feature.status === 'active' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full mt-3"
                              onClick={() => setActiveTab(feature.id === 'predictive' ? 'predictive' : feature.id === 'anomaly' ? 'anomaly' : 'performance')}
                            >
                              <ArrowRight className="h-3 w-3 mr-1" />
                              Explore {feature.title}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Active Models</p>
                        <p className="text-2xl font-bold">12</p>
                      </div>
                      <Brain className="h-8 w-8 text-blue-600" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Machine learning models deployed
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Predictions Made</p>
                        <p className="text-2xl font-bold">1,247</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-green-600" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      This month with 89% accuracy
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Anomalies Detected</p>
                        <p className="text-2xl font-bold">23</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-amber-600" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Issues caught before impact
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Coming Soon Features */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Coming Soon
                  </CardTitle>
                  <CardDescription>
                    Advanced analytics features in development
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 border rounded-lg">
                      <h4 className="font-medium text-sm mb-1">Natural Language Queries</h4>
                      <p className="text-xs text-muted-foreground">
                        Ask questions about your data in plain English
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <h4 className="font-medium text-sm mb-1">Automated Reporting</h4>
                      <p className="text-xs text-muted-foreground">
                        AI-generated insights and recommendations
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <h4 className="font-medium text-sm mb-1">Predictive Maintenance</h4>
                      <p className="text-xs text-muted-foreground">
                        Equipment failure prediction and prevention
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <h4 className="font-medium text-sm mb-1">Market Intelligence</h4>
                      <p className="text-xs text-muted-foreground">
                        Competitive analysis and market trends
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Predictive Analytics Tab */}
          <TabsContent value="predictive">
            <PredictiveInsights />
          </TabsContent>

          {/* Anomaly Detection Tab */}
          <TabsContent value="anomaly">
            <AnomalyDetection />
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Performance Optimization
                  </CardTitle>
                  <CardDescription>
                    Advanced performance analytics and optimization recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Performance Analytics</h3>
                    <p className="text-muted-foreground mb-4">
                      Advanced performance optimization features are currently in development.
                    </p>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}