// =====================================================================
// ENHANCED REPORTS HUB
// Phase 2 Implementation - New Architecture Integration
// =====================================================================

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Target, 
  Calendar,
  AlertTriangle,
  Clock,
  Eye,
  Download,
  Filter,
  Settings,
  Zap,
  PieChart,
  Activity,
  Search,
  RefreshCw,
  ChevronRight,
  Star,
  Grid3X3,
  List
} from 'lucide-react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { KPIWidget, KPIGrid } from '@/components/reports/KPIWidget';
import { ReportViewer } from '@/components/reports/ReportViewer';
import { cn } from '@/lib/utils';

// Types for the new reporting architecture
interface ReportDefinition {
  id: string;
  name: string;
  code: string;
  description: string;
  category: 'sales' | 'service' | 'finance' | 'operations' | 'hr' | 'it' | 'compliance' | 'executive';
  organizationalScope: 'platform' | 'company' | 'regional' | 'location' | 'team' | 'individual';
  requiredPermissions: Record<string, boolean>;
  defaultVisualization: 'table' | 'chart' | 'dashboard' | 'kpi_widget';
  isRealTime: boolean;
  supportsDrillDown: boolean;
  supportsExport: boolean;
  lastUpdated?: string;
  tags?: string[];
}

interface KPIDefinition {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  displayFormat: 'number' | 'currency' | 'percentage' | 'decimal';
  current_value: number | null;
  target_value: number | null;
  performance_level: 'excellent' | 'good' | 'warning' | 'critical' | null;
  last_updated: string | null;
  variance_percentage: number | null;
}

interface DashboardState {
  selectedCategory: string;
  searchQuery: string;
  viewMode: 'grid' | 'list';
  sortBy: 'name' | 'category' | 'lastUpdated' | 'priority';
  showFavorites: boolean;
}

export default function EnhancedReportsHub() {
  const [, setLocation] = useLocation();
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    selectedCategory: 'all',
    searchQuery: '',
    viewMode: 'grid',
    sortBy: 'name',
    showFavorites: false
  });
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  // Fetch available reports from new architecture
  const { data: reports, isLoading: reportsLoading, refetch: refetchReports } = useQuery<ReportDefinition[]>({
    queryKey: ['reporting/reports', dashboardState.selectedCategory, dashboardState.searchQuery],
    queryFn: () => apiRequest('/api/reporting/reports', {
      params: {
        category: dashboardState.selectedCategory !== 'all' ? dashboardState.selectedCategory : undefined,
        search: dashboardState.searchQuery || undefined
      }
    }).then(response => response.reports || []),
    staleTime: 30000 // 30 seconds
  });

  // Fetch KPIs from new architecture
  const { data: kpis, isLoading: kpisLoading, refetch: refetchKPIs } = useQuery<KPIDefinition[]>({
    queryKey: ['reporting/kpis', dashboardState.selectedCategory],
    queryFn: () => apiRequest('/api/reporting/kpis', {
      params: {
        category: dashboardState.selectedCategory !== 'all' ? dashboardState.selectedCategory : undefined
      }
    }).then(response => response.kpis || []),
    refetchInterval: 60000, // Refresh KPIs every minute
    staleTime: 30000
  });

  // Filter and sort reports
  const filteredReports = useMemo(() => {
    if (!reports) return [];

    let filtered = reports;

    // Apply search filter
    if (dashboardState.searchQuery) {
      const query = dashboardState.searchQuery.toLowerCase();
      filtered = filtered.filter(report => 
        report.name.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query) ||
        report.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (dashboardState.sortBy) {
        case 'category':
          return a.category.localeCompare(b.category);
        case 'lastUpdated':
          return (new Date(b.lastUpdated || 0)).getTime() - (new Date(a.lastUpdated || 0)).getTime();
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [reports, dashboardState.searchQuery, dashboardState.sortBy]);

  // Group reports by category
  const reportsByCategory = useMemo(() => {
    const grouped: Record<string, ReportDefinition[]> = {};
    filteredReports.forEach(report => {
      if (!grouped[report.category]) {
        grouped[report.category] = [];
      }
      grouped[report.category].push(report);
    });
    return grouped;
  }, [filteredReports]);

  // Category icons mapping
  const categoryIcons = {
    sales: Target,
    service: Zap,
    finance: DollarSign,
    operations: Activity,
    hr: Users,
    it: Settings,
    compliance: AlertTriangle,
    executive: BarChart3
  };

  const handleStateChange = (key: keyof DashboardState, value: any) => {
    setDashboardState(prev => ({ ...prev, [key]: value }));
  };

  const handleReportClick = (reportId: string) => {
    setSelectedReport(reportId);
  };

  const handleRefreshAll = () => {
    refetchReports();
    refetchKPIs();
  };

  // Show individual report view
  if (selectedReport) {
    const report = reports?.find(r => r.id === selectedReport);
    return (
      <MainLayout>
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => setSelectedReport(null)}
            >
              ← Back to Reports
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{report?.name}</h1>
              <p className="text-gray-600">{report?.description}</p>
            </div>
          </div>
          
          <ReportViewer
            reportId={selectedReport}
            reportName={report?.name}
            category={report?.category}
            showExport={report?.supportsExport}
            autoRefresh={report?.isRealTime}
            onDrillDown={(dimension, value) => {
              console.log('Drill down:', dimension, value);
            }}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              Comprehensive reporting across all departments with real-time insights
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              onClick={handleRefreshAll}
              disabled={reportsLoading || kpisLoading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", (reportsLoading || kpisLoading) && "animate-spin")} />
              Refresh
            </Button>
            <Button variant="default">
              <Settings className="h-4 w-4 mr-2" />
              Customize
            </Button>
          </div>
        </div>

        {/* KPI Overview */}
        {kpis && kpis.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Key Performance Indicators</h2>
            <KPIGrid
              kpis={kpis.map(kpi => ({
                id: kpi.id,
                title: kpi.name,
                value: kpi.current_value || 0,
                target: kpi.target_value || undefined,
                format: kpi.displayFormat,
                performanceLevel: kpi.performance_level || undefined,
                description: kpi.description,
                lastUpdated: kpi.last_updated || undefined,
                trend: kpi.variance_percentage ? {
                  direction: kpi.variance_percentage > 0 ? 'up' : kpi.variance_percentage < 0 ? 'down' : 'stable',
                  percentage: Math.abs(kpi.variance_percentage)
                } : undefined,
                onClick: () => console.log('KPI clicked:', kpi.id)
              }))}
              columns={4}
              isLoading={kpisLoading}
            />
          </div>
        )}

        {/* Filters and Controls */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Reports Catalog</h3>
            <div className="flex items-center space-x-2">
              <Button
                variant={dashboardState.viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStateChange('viewMode', 'grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={dashboardState.viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStateChange('viewMode', 'list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search reports..."
                value={dashboardState.searchQuery}
                onChange={(e) => handleStateChange('searchQuery', e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <Select 
              value={dashboardState.selectedCategory} 
              onValueChange={(value) => handleStateChange('selectedCategory', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="it">IT</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
                <SelectItem value="executive">Executive</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select 
              value={dashboardState.sortBy} 
              onValueChange={(value: any) => handleStateChange('sortBy', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="lastUpdated">Last Updated</SelectItem>
              </SelectContent>
            </Select>

            {/* Show Favorites Toggle */}
            <Button
              variant={dashboardState.showFavorites ? 'default' : 'outline'}
              onClick={() => handleStateChange('showFavorites', !dashboardState.showFavorites)}
            >
              <Star className="h-4 w-4 mr-2" />
              Favorites
            </Button>
          </div>
        </Card>

        {/* Reports Grid/List */}
        <div className="space-y-6">
          {reportsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : dashboardState.selectedCategory === 'all' ? (
            // Show reports grouped by category
            Object.entries(reportsByCategory).map(([category, categoryReports]) => {
              const IconComponent = categoryIcons[category as keyof typeof categoryIcons] || BarChart3;
              
              return (
                <div key={category} className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <IconComponent className="h-5 w-5" />
                    <h3 className="text-lg font-semibold capitalize">
                      {category} Reports ({categoryReports.length})
                    </h3>
                  </div>
                  
                  <div className={cn(
                    dashboardState.viewMode === 'grid' 
                      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                      : "space-y-2"
                  )}>
                    {categoryReports.map((report) => (
                      <ReportCard
                        key={report.id}
                        report={report}
                        viewMode={dashboardState.viewMode}
                        onClick={() => handleReportClick(report.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            // Show reports for selected category
            <div className={cn(
              dashboardState.viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                : "space-y-2"
            )}>
              {filteredReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  viewMode={dashboardState.viewMode}
                  onClick={() => handleReportClick(report.id)}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!reportsLoading && filteredReports.length === 0 && (
            <Card className="p-8">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
                <p className="text-gray-500">
                  {dashboardState.searchQuery 
                    ? "Try adjusting your search terms or filters"
                    : "No reports are available for the selected category"}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

// Individual Report Card Component
interface ReportCardProps {
  report: ReportDefinition;
  viewMode: 'grid' | 'list';
  onClick: () => void;
}

function ReportCard({ report, viewMode, onClick }: ReportCardProps) {
  const IconComponent = categoryIcons[report.category as keyof typeof categoryIcons] || BarChart3;

  if (viewMode === 'list') {
    return (
      <Card 
        className="p-4 hover:shadow-md hover:scale-[1.01] transition-all duration-200 cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-gray-100 rounded-lg">
              <IconComponent className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-medium">{report.name}</h4>
              <p className="text-sm text-gray-600 truncate max-w-md">
                {report.description}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="capitalize">
              {report.category}
            </Badge>
            {report.isRealTime && (
              <Badge variant="outline" className="bg-green-50 text-green-700">
                Live
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className="hover:shadow-md hover:scale-[1.02] transition-all duration-200 cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="p-2 bg-gray-100 rounded-lg">
            <IconComponent className="h-6 w-6" />
          </div>
          {report.isRealTime && (
            <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
              Live
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg">{report.name}</CardTitle>
        <CardDescription className="text-sm">
          {report.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="capitalize">
            {report.category}
          </Badge>
          
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            {report.supportsDrillDown && <Eye className="h-3 w-3" />}
            {report.supportsExport && <Download className="h-3 w-3" />}
            {report.lastUpdated && (
              <span>{new Date(report.lastUpdated).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const categoryIcons = {
  sales: Target,
  service: Zap,
  finance: DollarSign,
  operations: Activity,
  hr: Users,
  it: Settings,
  compliance: AlertTriangle,
  executive: BarChart3
};
