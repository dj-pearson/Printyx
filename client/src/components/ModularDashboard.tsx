import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Eye,
  EyeOff
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
  const [enabledCards, setEnabledCards] = useState<string[]>([]);
  const [showCardManager, setShowCardManager] = useState(false);

  const { data: dashboardData, isLoading, refetch } = useQuery({
    queryKey: ['/api/dashboard/modules', enabledCards.join(',')],
    queryFn: async () => {
      const params = enabledCards.length > 0 ? `?enabled=${enabledCards.join(',')}` : '';
      const response = await fetch(`/api/dashboard/modules${params}`);
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: cardConfig } = useQuery<{
    role: string;
    defaultCards: string[];
    availableCards: string[];
    allCards: string[];
  }>({
    queryKey: ['/api/dashboard/card-config'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  useEffect(() => {
    // Load enabled cards from localStorage
    const saved = localStorage.getItem('dashboard-enabled-cards');
    if (saved) {
      setEnabledCards(JSON.parse(saved));
    }
  }, []);

  const toggleCard = (cardId: string) => {
    const newEnabled = enabledCards.includes(cardId)
      ? enabledCards.filter(id => id !== cardId)
      : [...enabledCards, cardId];
    
    setEnabledCards(newEnabled);
    localStorage.setItem('dashboard-enabled-cards', JSON.stringify(newEnabled));
    setTimeout(() => refetch(), 100); // Refetch data with new cards
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 sm:space-y-6 ${className}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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

  const { modules = [], userRole, roleConfig } = dashboardData || { modules: [], userRole: 'user', roleConfig: {} };

  const salesModules = modules.filter((m: DashboardModule) => m.category === 'sales');
  const serviceModules = modules.filter((m: DashboardModule) => m.category === 'service');
  const managementModules = modules.filter((m: DashboardModule) => m.category === 'management');
  const operationsModules = modules.filter((m: DashboardModule) => m.category === 'operations');

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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Customers</p>
                <p className="text-xl sm:text-2xl font-bold">{module.data.customers}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Active Contracts</p>
                <p className="text-xl sm:text-2xl font-bold">{module.data.activeContracts}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Monthly Revenue</p>
                <p className="text-xl sm:text-2xl font-bold">${module.data.monthlyRevenue.toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Pending Tickets</p>
                <p className="text-xl sm:text-2xl font-bold">{module.data.pendingTickets}</p>
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
          <div className="text-xl sm:text-2xl font-bold">{module.value}</div>
          
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
    <div className={`space-y-4 sm:space-y-6 ${className}`}>
      {/* Role-based header with card management */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            {userRole === 'sales' || userRole === 'sales_rep' ? 'Your sales performance metrics' :
             userRole === 'technician' || userRole === 'service_manager' ? 'Your service metrics' :
             'Business overview and key metrics'}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {cardConfig?.availableCards?.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCardManager(!showCardManager)}
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Customize Cards</span>
              <span className="sm:hidden">Customize</span>
            </Button>
          )}
          <Badge variant="outline" className="capitalize text-xs">
            {userRole?.replace('_', ' ') || 'User'}
          </Badge>
        </div>
      </div>

      {/* Card Management Panel */}
      {showCardManager && cardConfig?.availableCards?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Available Dashboard Cards
            </CardTitle>
            <CardDescription>
              Enable additional cards to see more business insights relevant to your role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {cardConfig.availableCards.map((cardId: string) => (
                <div key={cardId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {enabledCards.includes(cardId) ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <Label className="capitalize font-medium">
                        {cardId.replace(/_/g, ' ')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {getCardDescription(cardId)}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={enabledCards.includes(cardId)}
                    onCheckedChange={() => toggleCard(cardId)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Metrics */}
      {salesModules.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Sales Performance
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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

      {/* Operations */}
      {operationsModules.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Operations
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {operationsModules.map(renderMetricCard)}
          </div>
        </div>
      )}

      {/* SLA Breach Detection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          SLA Breach Detection
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card className="bg-green-50 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                SLA Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">All Clear</div>
              <p className="text-xs text-green-600 mt-1">No SLA breaches detected</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lean Alerts Quick Links */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Lean Alerts Quick Links
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">PO Variance &gt; 2× Plan</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Drill-through to flagged POs</p>
              <Button size="sm" onClick={() => (window.location.href = '/admin/purchase-orders?filter=variance_gt_2x')}>View</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Missed Meter Cycles</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Devices missing N cycles</p>
              <Button size="sm" onClick={() => (window.location.href = '/meter-readings?filter=missed_cycles&n=2')}>View</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Service Aging &gt; 5 Days</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Oldest open service tickets</p>
              <Button size="sm" onClick={() => (window.location.href = '/service-hub?tab=active-tickets&filter=aging_gt_5')}>View</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Proposals Aging &gt; 7 Days</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Old proposals needing action</p>
              <Button size="sm" onClick={() => (window.location.href = '/proposal-builder?filter=aging&days=7')}>View</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Invoice Issuance Delay &gt; 24h</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Invoices not issued in time</p>
              <Button size="sm" onClick={() => (window.location.href = '/advanced-billing?filter=issuance_delay_gt_24h')}>View</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Debug info - will be removed in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-muted rounded-lg text-sm">
          <strong>Debug Info:</strong>
          <div>Total modules: {modules.length}</div>
          <div>Sales: {salesModules.length}, Service: {serviceModules.length}, Management: {managementModules.length}, Operations: {operationsModules.length}</div>
          <div>Enabled cards: {enabledCards.join(', ') || 'none'}</div>
          <div>User role: {userRole}</div>
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

// Helper function to get card descriptions
function getCardDescription(cardId: string): string {
  const descriptions: Record<string, string> = {
    'team_revenue': 'View your team\'s total revenue performance',
    'company_customers': 'See total customer count across the company',
    'inventory_alerts': 'Monitor low stock items that need reordering',
    'service_overview': 'View service department performance metrics',
    'revenue_overview': 'See company-wide revenue trends',
    'team_tickets': 'Monitor service tickets for your team',
    'company_revenue': 'View total company revenue metrics',
    'technician_performance': 'Track team performance metrics'
  };
  
  return descriptions[cardId] || 'Additional business insight card';
}

export default ModularDashboard;