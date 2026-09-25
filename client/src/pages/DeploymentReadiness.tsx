import { formatPercent, percentOf } from '@/lib/utils';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/main-layout';
import { exportToCSV, type ExportColumn } from '@/lib/export-utils';
import type { DeploymentMetrics, ReadinessCheck } from '@shared/deployment-readiness';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { InlineQueryError } from '@/components/ui/inline-query-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Rocket,
  Shield,
  Database,
  Users,
  Settings,
  Activity,
  FileText,
} from 'lucide-react';

const CHECKLIST_EXPORT_COLUMNS: ExportColumn<ReadinessCheck>[] = [
  { key: 'category', label: 'Category' },
  { key: 'name', label: 'Check' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'details', label: 'Details' },
  { key: 'lastChecked', label: 'Last Checked' },
];

export default function DeploymentReadiness() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const readinessQuery = useQuery<ReadinessCheck[]>({
    queryKey: ['/api/deployment/readiness'],
  });

  const { data: metrics } = useQuery<DeploymentMetrics>({
    queryKey: ['/api/deployment/metrics'],
  });

  // No fallback: this page used to render eighteen typed-in checks and a 78%
  // readiness score whenever the endpoint failed, which reads as a launch
  // status nobody measured.
  const checks = readinessQuery.data ?? [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'incomplete':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      complete: 'default',
      incomplete: 'destructive',
      warning: 'secondary',
      'in-progress': 'outline',
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status === 'in-progress'
          ? 'In Progress'
          : status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    };

    return (
      <Badge className={colors[priority as keyof typeof colors] || colors.medium}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  const categories = ['all', ...Array.from(new Set(checks.map((check) => check.category)))];
  const filteredChecks =
    selectedCategory === 'all'
      ? checks
      : checks.filter((check) => check.category === selectedCategory);

  const categoryIcons = {
    Infrastructure: Database,
    Security: Shield,
    Testing: Activity,
    Documentation: FileText,
    Business: Users,
  };

  return (
    <MainLayout
      title="Deployment Readiness"
      description="Monitor go-live preparation and deployment checklist"
    >
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Overall Readiness</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {metrics?.overallReadiness != null ? `${metrics.overallReadiness}%` : '—'}
                  </p>
                  {metrics?.overallReadiness != null && (
                    <Progress value={metrics.overallReadiness} className="mt-2 h-2" />
                  )}
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Critical Issues</p>
                  <p className="text-2xl sm:text-3xl font-bold text-red-600">
                    {metrics ? metrics.criticalIssues : '—'}
                  </p>
                  <p className="text-xs text-gray-500">Require immediate attention</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {metrics ? `${metrics.completedChecks}/${metrics.totalChecks}` : '—'}
                  </p>
                  {metrics && metrics.totalChecks > 0 && (
                    <p className="text-xs text-green-600">
                      {formatPercent(percentOf(metrics.completedChecks, metrics.totalChecks))}{' '}
                      complete
                    </p>
                  )}
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Not measured here</p>
              <ul className="mt-2 space-y-1 text-xs text-gray-500">
                {(metrics?.unbacked ?? []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Critical Issues Alert */}
        {metrics && metrics.criticalIssues > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Critical Issues Require Attention</AlertTitle>
            <AlertDescription>
              {metrics.criticalIssues} critical issue{metrics.criticalIssues > 1 ? 's' : ''} must be
              resolved before deployment. Review the checklist below for details.
            </AlertDescription>
          </Alert>
        )}

        {/* Category Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Deployment Checklist</CardTitle>
            <CardDescription>
              Track progress across all deployment readiness categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-6">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="capitalize"
                >
                  {category === 'all' ? 'All Categories' : category}
                </Button>
              ))}
            </div>

            {readinessQuery.isLoading && <p className="text-sm text-gray-500">Running checks...</p>}
            {readinessQuery.isError && (
              <InlineQueryError label="readiness checks" onRetry={readinessQuery.refetch} />
            )}
            <div className="space-y-4">
              {filteredChecks.map((check) => {
                const IconComponent =
                  categoryIcons[check.category as keyof typeof categoryIcons] || Settings;

                return (
                  <div
                    key={check.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(check.status)}
                      <IconComponent className="h-5 w-5 text-gray-500" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{check.name}</h4>
                          {getPriorityBadge(check.priority)}
                        </div>
                        <p className="text-sm text-gray-600">{check.description}</p>
                        {check.details && (
                          <p className="text-xs text-gray-500 mt-1">{check.details}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          Last checked: {new Date(check.lastChecked).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">{getStatusBadge(check.status)}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* There is no deploy or test-run action behind this page, so the
            Deploy to Production and Run Final Tests buttons it used to show
            are gone rather than left as controls that do nothing. */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            disabled={checks.length === 0}
            onClick={() =>
              exportToCSV(checks, CHECKLIST_EXPORT_COLUMNS, {
                filename: 'deployment-readiness-checklist',
              })
            }
          >
            <FileText className="h-4 w-4 mr-2" />
            Export Checklist
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
