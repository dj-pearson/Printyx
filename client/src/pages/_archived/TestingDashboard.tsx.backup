import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  TestTube,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Database,
  Brain,
  Server,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Gauge,
  RefreshCw,
  PlayCircle,
  PauseCircle,
} from 'lucide-react';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'running' | 'skipped';
  duration: number;
  error?: string;
  details?: string;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  coverage: number;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  change: number;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  score: number;
  lastChecked: Date;
  issues: string[];
  recommendations: string[];
}

export default function TestingDashboard() {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [loading, setLoading] = useState(true);

  // Mock data initialization
  useEffect(() => {
    const mockTestSuites: TestSuite[] = [
      {
        name: 'Task Scheduling Algorithm',
        totalTests: 25,
        passedTests: 23,
        failedTests: 2,
        duration: 1250,
        coverage: 89,
        tests: [
          { name: 'should schedule high priority tasks first', status: 'passed', duration: 45 },
          { name: 'should respect work hours constraints', status: 'passed', duration: 67 },
          { name: 'should avoid scheduling on weekends', status: 'passed', duration: 32 },
          { name: 'should handle empty task list gracefully', status: 'passed', duration: 12 },
          {
            name: 'should handle conflicting existing events',
            status: 'failed',
            duration: 89,
            error: 'Assertion failed: expected task to not overlap with existing event',
          },
          { name: 'should provide scheduling confidence scores', status: 'passed', duration: 78 },
          {
            name: 'should calculate utilization percentage correctly',
            status: 'passed',
            duration: 34,
          },
          { name: 'should generate optimization insights', status: 'passed', duration: 56 },
          {
            name: 'should handle very long tasks',
            status: 'failed',
            duration: 123,
            error: 'Task duration exceeds maximum allowed time slot',
          },
          {
            name: 'should handle large number of tasks efficiently',
            status: 'passed',
            duration: 234,
          },
        ],
      },
      {
        name: 'API Endpoints',
        totalTests: 42,
        passedTests: 40,
        failedTests: 1,
        duration: 2340,
        coverage: 95,
        tests: [
          {
            name: 'GET /api/ai/health should return health status',
            status: 'passed',
            duration: 23,
          },
          {
            name: 'POST /api/ai/leads/analyze should analyze lead data',
            status: 'passed',
            duration: 156,
          },
          {
            name: 'GET /api/calendar/events should return calendar events',
            status: 'passed',
            duration: 89,
          },
          {
            name: 'POST /api/tasks/schedule should schedule tasks with AI',
            status: 'passed',
            duration: 345,
          },
          {
            name: 'should handle malformed JSON gracefully',
            status: 'failed',
            duration: 67,
            error: 'Unexpected token in JSON at position 15',
          },
          { name: 'should validate required fields', status: 'passed', duration: 45 },
          { name: 'should handle concurrent requests', status: 'passed', duration: 567 },
        ],
      },
      {
        name: 'Calendar Integration',
        totalTests: 18,
        passedTests: 17,
        failedTests: 0,
        duration: 890,
        coverage: 92,
        tests: [
          { name: 'should sync Google Calendar events', status: 'passed', duration: 234 },
          { name: 'should sync Outlook Calendar events', status: 'passed', duration: 198 },
          { name: 'should handle calendar connection errors', status: 'passed', duration: 67 },
          { name: 'should create external events', status: 'passed', duration: 123 },
          { name: 'should find optimal meeting times', status: 'passed', duration: 89 },
        ],
      },
      {
        name: 'Claude AI Integration',
        totalTests: 15,
        passedTests: 14,
        failedTests: 1,
        duration: 3450,
        coverage: 87,
        tests: [
          { name: 'should analyze lead data with AI', status: 'passed', duration: 1234 },
          { name: 'should generate task priority scores', status: 'passed', duration: 987 },
          {
            name: 'should handle API rate limits',
            status: 'failed',
            duration: 2345,
            error: 'Rate limit exceeded: 429 Too Many Requests',
          },
          { name: 'should provide scheduling recommendations', status: 'passed', duration: 876 },
          {
            name: 'should fallback gracefully when AI unavailable',
            status: 'passed',
            duration: 45,
          },
        ],
      },
    ];

    const mockPerformanceMetrics: PerformanceMetric[] = [
      {
        name: 'Database Query Time',
        value: 145,
        unit: 'ms',
        status: 'good',
        trend: 'down',
        change: -12,
      },
      {
        name: 'Claude API Latency',
        value: 850,
        unit: 'ms',
        status: 'warning',
        trend: 'up',
        change: 8,
      },
      { name: 'Cache Hit Rate', value: 87, unit: '%', status: 'good', trend: 'stable', change: 0 },
      { name: 'Memory Usage', value: 234, unit: 'MB', status: 'good', trend: 'stable', change: 2 },
      { name: 'CPU Usage', value: 45, unit: '%', status: 'good', trend: 'down', change: -5 },
      {
        name: 'API Response Time',
        value: 95,
        unit: 'ms',
        status: 'good',
        trend: 'down',
        change: -18,
      },
      { name: 'Error Rate', value: 0.5, unit: '%', status: 'good', trend: 'stable', change: 0 },
      {
        name: 'Scheduling Algorithm Time',
        value: 180,
        unit: 'ms',
        status: 'good',
        trend: 'stable',
        change: -2,
      },
    ];

    const mockSystemHealth: SystemHealth = {
      status: 'warning',
      score: 78,
      lastChecked: new Date(),
      issues: [
        'Claude API response time is above optimal threshold',
        'Some test failures in task scheduling algorithm',
      ],
      recommendations: [
        'Optimize Claude API request caching',
        'Review and fix failing test cases',
        'Consider database query optimization',
        'Monitor memory usage trends',
      ],
    };

    setTestSuites(mockTestSuites);
    setPerformanceMetrics(mockPerformanceMetrics);
    setSystemHealth(mockSystemHealth);
    setLoading(false);
  }, []);

  const runAllTests = async () => {
    setIsRunningTests(true);

    // Simulate running tests
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      // Update progress could be shown here
    }

    // Simulate some test results changing
    setTestSuites((prev) =>
      prev.map((suite) => ({
        ...suite,
        tests: suite.tests.map((test) => ({
          ...test,
          status: Math.random() > 0.1 ? 'passed' : ('failed' as any),
          duration: test.duration + Math.floor(Math.random() * 20 - 10),
        })),
      })),
    );

    setIsRunningTests(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'skipped':
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
      case 'good':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'failed':
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'running':
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-green-500" />;
      default:
        return <Activity className="h-3 w-3 text-gray-500" />;
    }
  };

  const totalTests = testSuites.reduce((sum, suite) => sum + suite.totalTests, 0);
  const totalPassed = testSuites.reduce((sum, suite) => sum + suite.passedTests, 0);
  const totalFailed = testSuites.reduce((sum, suite) => sum + suite.failedTests, 0);
  const overallCoverage =
    testSuites.length > 0
      ? testSuites.reduce((sum, suite) => sum + suite.coverage, 0) / testSuites.length
      : 0;

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <TestTube className="h-8 w-8 animate-pulse mx-auto mb-2" />
            <p>Loading testing dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <TestTube className="mr-3 h-8 w-8 text-blue-600" />
            Motion AI Testing & Performance
          </h1>
          <p className="text-gray-600 mt-1">
            Comprehensive testing and performance monitoring dashboard
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={runAllTests} disabled={isRunningTests}>
            {isRunningTests ? (
              <PauseCircle className="h-4 w-4 mr-2" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            {isRunningTests ? 'Running Tests...' : 'Run All Tests'}
          </Button>

          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Metrics
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Test Success Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {Math.round((totalPassed / totalTests) * 100)}%
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {totalPassed}/{totalTests} tests passing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Code Coverage</p>
                <p className="text-2xl font-bold text-blue-600">{Math.round(overallCoverage)}%</p>
              </div>
              <Gauge className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Across all test suites</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Health</p>
                <p
                  className={`text-2xl font-bold ${
                    systemHealth?.status === 'healthy'
                      ? 'text-green-600'
                      : systemHealth?.status === 'warning'
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }`}
                >
                  {systemHealth?.score}/100
                </p>
              </div>
              <Activity className="h-8 w-8 text-purple-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {systemHealth?.issues.length || 0} issues detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed Tests</p>
                <p className="text-2xl font-bold text-red-600">{totalFailed}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Require immediate attention</p>
          </CardContent>
        </Card>
      </div>

      {/* System Health Alert */}
      {systemHealth && systemHealth.status !== 'healthy' && (
        <Alert
          className={`border-l-4 ${
            systemHealth.status === 'warning'
              ? 'border-yellow-500 bg-yellow-50'
              : 'border-red-500 bg-red-50'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>
              System Health {systemHealth.status === 'warning' ? 'Warning' : 'Critical'}:
            </strong>
            <ul className="mt-2 space-y-1">
              {systemHealth.issues.map((issue, index) => (
                <li key={index} className="text-sm">
                  • {issue}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="tests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tests" className="flex items-center">
            <TestTube className="h-4 w-4 mr-2" />
            Test Results
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center">
            <Zap className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center">
            <Server className="h-4 w-4 mr-2" />
            System Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {testSuites.map((suite, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{suite.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={getStatusColor(suite.failedTests === 0 ? 'passed' : 'failed')}
                    >
                      {suite.passedTests}/{suite.totalTests}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>Coverage: {suite.coverage}%</span>
                    <span>Duration: {suite.duration}ms</span>
                  </div>
                  <Progress value={suite.coverage} className="h-2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {suite.tests.map((test, testIndex) => (
                      <div
                        key={testIndex}
                        className="flex items-start justify-between p-2 rounded border"
                      >
                        <div className="flex items-start space-x-2 flex-1">
                          {getStatusIcon(test.status)}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{test.name}</p>
                            {test.error && (
                              <p className="text-xs text-red-600 mt-1">{test.error}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 ml-2">{test.duration}ms</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {performanceMetrics.map((metric, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{metric.name}</h4>
                    <div className="flex items-center space-x-1">
                      {getTrendIcon(metric.trend)}
                      <span
                        className={`text-xs ${
                          metric.change > 0
                            ? 'text-red-500'
                            : metric.change < 0
                              ? 'text-green-500'
                              : 'text-gray-500'
                        }`}
                      >
                        {metric.change > 0 ? '+' : ''}
                        {metric.change}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold">{metric.value}</p>
                      <p className="text-xs text-gray-500">{metric.unit}</p>
                    </div>
                    <Badge variant="outline" className={getStatusColor(metric.status)}>
                      {metric.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          {systemHealth && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="mr-2 h-5 w-5" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Overall Health Score</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={systemHealth.score} className="w-20 h-2" />
                      <span className="font-bold">{systemHealth.score}/100</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <Badge className={getStatusColor(systemHealth.status)}>
                      {systemHealth.status.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Last Checked</span>
                    <span className="text-sm text-gray-600">
                      {systemHealth.lastChecked.toLocaleTimeString()}
                    </span>
                  </div>

                  {systemHealth.issues.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-red-600">Issues Detected</h4>
                      <ul className="space-y-1">
                        {systemHealth.issues.map((issue, index) => (
                          <li key={index} className="text-sm text-red-600 flex items-start">
                            <AlertTriangle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="mr-2 h-5 w-5" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {systemHealth.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
