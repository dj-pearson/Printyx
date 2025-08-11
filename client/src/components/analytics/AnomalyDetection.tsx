import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign,
  Users,
  Wrench,
  Package,
  Bell,
  ArrowRight,
  Activity,
  BarChart3,
  Eye
} from 'lucide-react';

interface Anomaly {
  id: string;
  type: 'sales' | 'service' | 'financial' | 'operational';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  detectedAt: string;
  confidence: number;
  impact: string;
  affectedEntity: string;
  metric: string;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  suggestions: string[];
  drillDownUrl?: string;
}

interface AnomalyPattern {
  id: string;
  name: string;
  description: string;
  occurrences: number;
  lastOccurrence: string;
  severity: 'low' | 'medium' | 'high';
  category: string;
  pattern: string;
  predictedNext?: string;
}

const mockAnomalies: Anomaly[] = [
  {
    id: '1',
    type: 'sales',
    severity: 'high',
    title: 'Unusual Drop in Lead Conversion',
    description: 'Lead to quote conversion rate dropped 45% below normal threshold',
    detectedAt: '2025-08-11T14:30:00Z',
    confidence: 92,
    impact: 'Potential revenue loss of $125,000 this month',
    affectedEntity: 'Sales Pipeline',
    metric: 'Conversion Rate',
    expectedValue: 28.5,
    actualValue: 15.7,
    deviation: -45,
    suggestions: [
      'Review recent changes in sales process',
      'Analyze competitor activity',
      'Check lead quality sources',
      'Schedule sales team training session'
    ],
    drillDownUrl: '/quotes?filter=conversion_analysis'
  },
  {
    id: '2',
    type: 'service',
    severity: 'critical',
    title: 'Service Call Volume Spike',
    description: 'Service calls increased 180% above normal for Canon IR-ADV equipment',
    detectedAt: '2025-08-11T13:45:00Z',
    confidence: 88,
    impact: 'Technician capacity exceeded, SLA at risk',
    affectedEntity: 'Canon IR-ADV Fleet',
    metric: 'Service Calls per Day',
    expectedValue: 12,
    actualValue: 33.6,
    deviation: 180,
    suggestions: [
      'Immediate capacity assessment needed',
      'Check for equipment recalls or known issues',
      'Consider temporary contractor support',
      'Escalate to manufacturer technical support'
    ],
    drillDownUrl: '/service-hub?filter=equipment_type&value=canon_ir_adv'
  },
  {
    id: '3',
    type: 'financial',
    severity: 'medium',
    title: 'Payment Timing Shift',
    description: 'Average payment delay increased by 8.2 days in the past 2 weeks',
    detectedAt: '2025-08-11T12:15:00Z',
    confidence: 76,
    impact: 'Cash flow impact of ~$89,000',
    affectedEntity: 'Accounts Receivable',
    metric: 'Days Sales Outstanding',
    expectedValue: 32.1,
    actualValue: 40.3,
    deviation: 25.5,
    suggestions: [
      'Review customer payment terms',
      'Implement proactive collections process',
      'Analyze payment pattern by customer segment',
      'Consider early payment incentives'
    ],
    drillDownUrl: '/advanced-billing?filter=payment_delays'
  },
  {
    id: '4',
    type: 'operational',
    severity: 'high',
    title: 'Inventory Turnover Decline',
    description: 'Toner inventory turnover dropped 35% below optimal levels',
    detectedAt: '2025-08-11T11:30:00Z',
    confidence: 84,
    impact: 'Excess inventory carrying costs $23,000/month',
    affectedEntity: 'Toner Inventory',
    metric: 'Inventory Turnover Ratio',
    expectedValue: 6.8,
    actualValue: 4.4,
    deviation: -35,
    suggestions: [
      'Review demand forecasting accuracy',
      'Implement dynamic reorder points',
      'Consider vendor managed inventory',
      'Analyze customer usage patterns'
    ],
    drillDownUrl: '/supplies?filter=turnover_analysis'
  },
  {
    id: '5',
    type: 'service',
    severity: 'low',
    title: 'Unusual Meter Reading Pattern',
    description: 'Sharp decrease in meter readings for commercial accounts',
    detectedAt: '2025-08-11T10:45:00Z',
    confidence: 67,
    impact: 'Potential billing inaccuracy for 12 accounts',
    affectedEntity: 'Commercial Accounts',
    metric: 'Monthly Meter Volume',
    expectedValue: 125000,
    actualValue: 89000,
    deviation: -28.8,
    suggestions: [
      'Verify meter reading collection methods',
      'Contact affected customers for validation',
      'Check for equipment malfunctions',
      'Review seasonal usage patterns'
    ],
    drillDownUrl: '/meter-readings?filter=commercial_decline'
  }
];

const mockPatterns: AnomalyPattern[] = [
  {
    id: '1',
    name: 'End-of-Quarter Sales Push',
    description: 'Recurring pattern of increased sales activity in final week of quarter',
    occurrences: 8,
    lastOccurrence: '2025-06-30',
    severity: 'low',
    category: 'Sales Behavior',
    pattern: 'Quarterly',
    predictedNext: '2025-09-30'
  },
  {
    id: '2',
    name: 'Post-Holiday Service Surge',
    description: 'Increased service calls after major holidays due to usage spikes',
    occurrences: 12,
    lastOccurrence: '2025-07-08',
    severity: 'medium',
    category: 'Service Demand',
    pattern: 'Holiday-driven',
    predictedNext: '2025-09-03'
  },
  {
    id: '3',
    name: 'Monthly Billing Cycle Stress',
    description: 'System performance degradation during monthly billing processing',
    occurrences: 6,
    lastOccurrence: '2025-08-01',
    severity: 'high',
    category: 'System Performance',
    pattern: 'Monthly',
    predictedNext: '2025-09-01'
  }
];

export default function AnomalyDetection() {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'medium': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-blue-600" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sales': return <TrendingUp className="h-4 w-4" />;
      case 'service': return <Wrench className="h-4 w-4" />;
      case 'financial': return <DollarSign className="h-4 w-4" />;
      case 'operational': return <Package className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const filteredAnomalies = mockAnomalies.filter(anomaly => {
    const severityMatch = selectedSeverity === 'all' || anomaly.severity === selectedSeverity;
    const typeMatch = selectedType === 'all' || anomaly.type === selectedType;
    return severityMatch && typeMatch;
  });

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDeviation = (deviation: number) => {
    const sign = deviation > 0 ? '+' : '';
    return `${sign}${deviation.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Eye className="h-6 w-6" />
            Anomaly Detection
          </h2>
          <p className="text-muted-foreground">
            Automated detection of unusual patterns and potential issues
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Real-time monitoring
          </Badge>
          <Button variant="outline" size="sm">
            <Bell className="h-4 w-4 mr-1" />
            Configure Alerts
          </Button>
        </div>
      </div>

      <Tabs defaultValue="current" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="current">Current Anomalies</TabsTrigger>
          <TabsTrigger value="patterns">Historical Patterns</TabsTrigger>
          <TabsTrigger value="settings">Detection Settings</TabsTrigger>
        </TabsList>

        {/* Current Anomalies Tab */}
        <TabsContent value="current">
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Severity:</span>
              <div className="flex gap-1">
                {['all', 'low', 'medium', 'high', 'critical'].map((severity) => (
                  <Button
                    key={severity}
                    variant={selectedSeverity === severity ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedSeverity(severity)}
                    className="capitalize"
                  >
                    {severity}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Type:</span>
              <div className="flex gap-1">
                {['all', 'sales', 'service', 'financial', 'operational'].map((type) => (
                  <Button
                    key={type}
                    variant={selectedType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedType(type)}
                    className="capitalize"
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Anomalies List */}
          <div className="space-y-4">
            {filteredAnomalies.map((anomaly) => (
              <Card key={anomaly.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(anomaly.severity)}
                      <div>
                        <CardTitle className="text-lg">{anomaly.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {anomaly.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getSeverityBadge(anomaly.severity)} className="capitalize">
                        {anomaly.severity}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        {getTypeIcon(anomaly.type)}
                        {anomaly.type}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Expected</p>
                      <p className="font-semibold">{anomaly.expectedValue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Actual</p>
                      <p className="font-semibold">{anomaly.actualValue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Deviation</p>
                      <p className={`font-semibold ${anomaly.deviation > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatDeviation(anomaly.deviation)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Confidence</p>
                      <p className="font-semibold">{anomaly.confidence}%</p>
                    </div>
                  </div>

                  <Alert className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Impact:</strong> {anomaly.impact}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Suggested Actions:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {anomaly.suggestions.map((suggestion, idx) => (
                          <li key={idx}>• {suggestion}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Detected: {formatTimestamp(anomaly.detectedAt)}
                      </div>
                      {anomaly.drillDownUrl && (
                        <Button variant="outline" size="sm">
                          <ArrowRight className="h-3 w-3 mr-1" />
                          Investigate
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Patterns Tab */}
        <TabsContent value="patterns">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockPatterns.map((pattern) => (
              <Card key={pattern.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{pattern.name}</CardTitle>
                    <Badge variant={getSeverityBadge(pattern.severity)}>
                      {pattern.severity}
                    </Badge>
                  </div>
                  <CardDescription>{pattern.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Occurrences</p>
                        <p className="font-semibold">{pattern.occurrences}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pattern</p>
                        <p className="font-semibold">{pattern.pattern}</p>
                      </div>
                    </div>
                    
                    <div className="text-sm">
                      <p className="text-muted-foreground">Last Occurrence</p>
                      <p className="font-semibold">{new Date(pattern.lastOccurrence).toLocaleDateString()}</p>
                    </div>
                    
                    {pattern.predictedNext && (
                      <div className="p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-sm text-blue-800">
                          <strong>Predicted Next:</strong> {new Date(pattern.predictedNext).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Detection Sensitivity</CardTitle>
                <CardDescription>
                  Configure how sensitive the anomaly detection should be
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Sales Metrics</label>
                    <div className="mt-1 space-y-2">
                      <label className="flex items-center space-x-2">
                        <input type="radio" name="sales-sensitivity" value="low" />
                        <span className="text-sm">Low sensitivity (±30% deviation)</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="radio" name="sales-sensitivity" value="medium" defaultChecked />
                        <span className="text-sm">Medium sensitivity (±20% deviation)</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="radio" name="sales-sensitivity" value="high" />
                        <span className="text-sm">High sensitivity (±10% deviation)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alert Preferences</CardTitle>
                <CardDescription>
                  Choose how and when you want to be notified
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">Email notifications</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">Dashboard alerts</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" />
                      <span className="text-sm">SMS notifications (critical only)</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" />
                      <span className="text-sm">Slack integration</span>
                    </label>
                  </div>
                  <Button size="sm">Save Preferences</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}