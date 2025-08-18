import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Database, 
  Play, 
  Pause, 
  RefreshCw, 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Settings,
  BarChart3,
  Server,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';

interface DatabaseUpdaterStatus {
  isRunning: boolean;
  totalJobs: number;
  runningJobs: number;
  jobs: JobStatus[];
  lastUpdate: string;
  systemHealth: 'healthy' | 'warning' | 'error';
}

interface JobStatus {
  name: string;
  cronExpression: string;
  isRunning: boolean;
  lastExecution?: string;
  nextExecution?: string;
  executionCount: number;
  errorCount: number;
}

export default function DatabaseUpdaterPage() {
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch status with auto-refresh
  const { data: status, error, isLoading } = useQuery({
    queryKey: ['/api/database-updater/status'],
    refetchInterval: autoRefresh ? 5000 : false,
    refetchIntervalInBackground: true,
  });

  // Start system mutation
  const startMutation = useMutation({
    mutationFn: () => apiRequest('/api/database-updater/start', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/database-updater/status'] });
    },
  });

  // Stop system mutation
  const stopMutation = useMutation({
    mutationFn: () => apiRequest('/api/database-updater/stop', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/database-updater/status'] });
    },
  });

  // Execute job manually
  const executeJobMutation = useMutation({
    mutationFn: (jobName: string) => 
      apiRequest(`/api/database-updater/execute/${jobName}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/database-updater/status'] });
    },
  });

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'error': return XCircle;
      default: return Activity;
    }
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return 'Never';
    return new Date(timeString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Database className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Database Updater</h1>
            <p className="text-gray-600">Loading system status...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to connect to Database Updater system. Please check system status.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const HealthIcon = getHealthIcon(status?.systemHealth || 'error');

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Database Updater</h1>
            <p className="text-gray-600">Root Admin Control Panel</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-refresh">Auto Refresh</Label>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>
          
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/database-updater/status'] })}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <HealthIcon className={cn("h-4 w-4", getHealthColor(status?.systemHealth || 'error'))} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.isRunning ? (
                <Badge variant="default" className="bg-green-600">
                  <Play className="h-3 w-3 mr-1" />
                  Running
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Pause className="h-3 w-3 mr-1" />
                  Stopped
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Health: {status?.systemHealth || 'Unknown'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Settings className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.totalJobs || 0}</div>
            <p className="text-xs text-gray-600">
              {status?.runningJobs || 0} currently running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{status?.runningJobs || 0}</div>
            <p className="text-xs text-gray-600">
              Currently executing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Update</CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {status?.lastUpdate ? formatTime(status.lastUpdate) : 'Never'}
            </div>
            <p className="text-xs text-gray-600">
              System status
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            System Control
          </CardTitle>
          <CardDescription>
            Start, stop, and manage the Database Updater system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button
              onClick={() => startMutation.mutate()}
              disabled={status?.isRunning || startMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4 mr-2" />
              {startMutation.isPending ? 'Starting...' : 'Start System'}
            </Button>
            
            <Button
              onClick={() => stopMutation.mutate()}
              disabled={!status?.isRunning || stopMutation.isPending}
              variant="destructive"
            >
              <Pause className="h-4 w-4 mr-2" />
              {stopMutation.isPending ? 'Stopping...' : 'Stop System'}
            </Button>
          </div>

          {(startMutation.error || stopMutation.error) && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {(startMutation.error as any)?.message || (stopMutation.error as any)?.message || 'Operation failed'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Job Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Job Status
          </CardTitle>
          <CardDescription>
            Monitor individual updater jobs and their execution status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status?.jobs && status.jobs.length > 0 ? (
            <div className="space-y-4">
              {status.jobs.map((job, index) => (
                <div key={job.name} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold">{job.name}</h4>
                      {job.isRunning ? (
                        <Badge variant="default" className="bg-blue-600">
                          <Activity className="h-3 w-3 mr-1" />
                          Running
                        </Badge>
                      ) : (
                        <Badge variant="outline">Idle</Badge>
                      )}
                    </div>
                    
                    <Button
                      onClick={() => executeJobMutation.mutate(job.name)}
                      disabled={job.isRunning || executeJobMutation.isPending}
                      size="sm"
                      variant="outline"
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Execute Now
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Schedule</p>
                      <p className="font-medium">{job.cronExpression}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Last Execution</p>
                      <p className="font-medium">{formatTime(job.lastExecution)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Executions</p>
                      <p className="font-medium">{job.executionCount}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Errors</p>
                      <p className={cn("font-medium", job.errorCount > 0 ? "text-red-600" : "text-green-600")}>
                        {job.errorCount}
                      </p>
                    </div>
                  </div>
                  
                  {index < status.jobs.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No jobs configured</p>
            </div>
          )}
        </CardContent>
      </Card>

      {executeJobMutation.error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Job execution failed: {(executeJobMutation.error as any)?.message || 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}