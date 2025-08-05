import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  DollarSign, 
  Target, 
  TrendingUp, 
  Users, 
  Wrench, 
  Clock, 
  CheckCircle, 
  BarChart3,
  TrendingDown,
  AlertCircle 
} from 'lucide-react';

const IconMap = {
  DollarSign,
  Target, 
  TrendingUp,
  Users,
  Wrench,
  Clock,
  CheckCircle,
  BarChart3
};

interface DashboardModule {
  id: string;
  category: string;
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  trend?: 'up' | 'down';
  progress?: number;
  icon: keyof typeof IconMap;
  data?: any;
}

interface ModularDashboardProps {
  className?: string;
}

export function ModularDashboard({ className }: ModularDashboardProps) {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['/api/dashboard/modules'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-4 w-4 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16 mb-2" />
                <div className="h-3 bg-muted rounded w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const { modules = [], userRole } = dashboardData || { modules: [], userRole: 'user' };

  const salesModules = modules.filter((m: DashboardModule) => m.category === 'sales');
  const serviceModules = modules.filter((m: DashboardModule) => m.category === 'service');
  const managementModules = modules.filter((m: DashboardModule) => m.category === 'management');

  const renderMetricCard = (module: DashboardModule) => {
    const IconComponent = IconMap[module.icon] || BarChart3;
    
    if (module.category === 'management' && module.data) {
      return (
        <Card key={module.id} className="col-span-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconComponent className="h-5 w-5" />
              {module.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Customers</p>
                <p className="text-2xl font-bold">{module.data.customers}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Active Contracts</p>
                <p className="text-2xl font-bold">{module.data.activeContracts}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Monthly Revenue</p>
                <p className="text-2xl font-bold">${module.data.monthlyRevenue.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Pending Tickets</p>
                <p className="text-2xl font-bold">{module.data.pendingTickets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card key={module.id}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{module.title}</CardTitle>
          <IconComponent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{module.value}</div>
          
          {module.change && (
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {module.trend === 'up' && <TrendingUp className="h-3 w-3 mr-1 text-green-500" />}
              {module.trend === 'down' && <TrendingDown className="h-3 w-3 mr-1 text-red-500" />}
              <span className={module.trend === 'up' ? 'text-green-500' : 'text-red-500'}>
                {module.change}
              </span>
              {module.subtitle && <span className="ml-1">{module.subtitle}</span>}
            </div>
          )}
          
          {module.progress !== undefined && (
            <div className="mt-3">
              <Progress value={module.progress} className="h-2" />
            </div>
          )}
          
          {module.subtitle && !module.change && (
            <p className="text-xs text-muted-foreground mt-1">
              {module.subtitle}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Role-based header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            {userRole === 'sales' || userRole === 'sales_rep' ? 'Your sales performance metrics' :
             userRole === 'technician' || userRole === 'service_manager' ? 'Your service metrics' :
             'Business overview and key metrics'}
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          {userRole?.replace('_', ' ') || 'User'}
        </Badge>
      </div>

      {/* Sales Metrics */}
      {salesModules.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Sales Performance
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {salesModules.map(renderMetricCard)}
          </div>
        </div>
      )}

      {/* Service Metrics */}
      {serviceModules.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Service Operations
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {serviceModules.map(renderMetricCard)}
          </div>
        </div>
      )}

      {/* Management Overview */}
      {managementModules.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Business Overview
          </h3>
          <div className="grid gap-4">
            {managementModules.map(renderMetricCard)}
          </div>
        </div>
      )}

      {/* No modules fallback */}
      {modules.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Dashboard Modules Available</h3>
            <p className="text-muted-foreground text-center">
              Dashboard modules will appear here based on your role and permissions.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ModularDashboard;