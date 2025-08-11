import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  FileText, 
  Package, 
  Wrench, 
  AlertTriangle, 
  AlertCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { useLocation } from 'wouter';

interface Breach {
  type: string;
  title: string;
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  drillThroughUrl: string;
  icon: string;
  lastUpdated: string;
}

const iconMap = {
  Clock: Clock,
  FileText: FileText,
  Package: Package,
  Wrench: Wrench,
  AlertTriangle: AlertTriangle,
  AlertCircle: AlertCircle,
};

const severityConfig = {
  critical: {
    variant: 'destructive' as const,
    bgColor: 'bg-red-50 border-red-200',
    textColor: 'text-red-800',
    iconColor: 'text-red-600',
  },
  high: {
    variant: 'destructive' as const,
    bgColor: 'bg-orange-50 border-orange-200',
    textColor: 'text-orange-800',
    iconColor: 'text-orange-600',
  },
  medium: {
    variant: 'outline' as const,
    bgColor: 'bg-yellow-50 border-yellow-200',
    textColor: 'text-yellow-800',
    iconColor: 'text-yellow-600',
  },
  low: {
    variant: 'secondary' as const,
    bgColor: 'bg-blue-50 border-blue-200',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-600',
  },
};

export default function BreachTiles() {
  const [, setLocation] = useLocation();

  const { data: breaches = [], isLoading, refetch } = useQuery<Breach[]>({
    queryKey: ['/api/reports/breaches'],
    queryFn: async () => {
      const response = await fetch('/api/reports/breaches', {
        headers: {
          'x-tenant-id': localStorage.getItem('currentTenantId') || '',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch breach data');
      }
      return response.json();
    },
    refetchInterval: 60000, // Check for breaches every minute
  });

  const handleDrillThrough = (breach: Breach) => {
    setLocation(breach.drillThroughUrl);
  };

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            SLA & Process Breaches
          </CardTitle>
          <CardDescription>
            Real-time monitoring of service level agreements and process violations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin">
              <RefreshCw className="h-6 w-6" />
            </div>
            <span className="ml-2">Checking for breaches...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (breaches.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-green-600" />
            SLA & Process Breaches
          </CardTitle>
          <CardDescription>
            Real-time monitoring of service level agreements and process violations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="border-green-200 bg-green-50">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              No active breaches detected. All processes are within acceptable parameters.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            SLA & Process Breaches
            <Badge variant="destructive">{breaches.length}</Badge>
          </CardTitle>
          <CardDescription>
            Real-time monitoring of service level agreements and process violations
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {breaches.map((breach, index) => {
            const Icon = iconMap[breach.icon as keyof typeof iconMap] || AlertTriangle;
            const config = severityConfig[breach.severity];

            return (
              <div
                key={`${breach.type}-${index}`}
                className={`p-4 rounded-lg border-2 ${config.bgColor} hover:shadow-md transition-shadow cursor-pointer`}
                onClick={() => handleDrillThrough(breach)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${config.iconColor}`} />
                    <div>
                      <h3 className={`font-semibold ${config.textColor}`}>
                        {breach.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {breach.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={config.variant} className="text-lg font-bold px-3 py-1">
                      {breach.count}
                    </Badge>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Last updated: {new Date(breach.lastUpdated).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        
        {breaches.length > 0 && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <p className="text-sm text-amber-800 font-medium">
                Action Required: {breaches.length} breach{breaches.length !== 1 ? 'es' : ''} detected
              </p>
            </div>
            <p className="text-sm text-amber-700 mt-1">
              Click on any breach tile above to drill down and take corrective action.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}