// =====================================================================
// REPORT VIEWER COMPONENT
// Phase 2 Implementation - Interactive Report Display with Drill-down
// =====================================================================

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Download, 
  Filter, 
  RefreshCw, 
  Calendar,
  BarChart3,
  PieChart,
  LineChart,
  Eye,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Clock,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { DateRangePicker } from '@/components/ui/date-range-picker';

interface ReportData {
  data: any[];
  metadata: {
    total_rows: number;
    execution_time_ms: number;
    cache_hit: boolean;
    data_freshness: string;
    available_drill_downs: string[];
    report_name: string;
    report_category: string;
  };
  summary_stats?: Record<string, number>;
}

interface ReportViewerProps {
  reportId: string;
  reportName?: string;
  category?: string;
  initialFilters?: Record<string, any>;
  onDrillDown?: (dimension: string, value: string) => void;
  height?: string;
  showExport?: boolean;
  showFilters?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
}

interface FilterState {
  dateRange?: { from: Date; to: Date };
  groupBy?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  [key: string]: any;
}

export function ReportViewer({
  reportId,
  reportName,
  category,
  initialFilters = {},
  onDrillDown,
  height = "500px",
  showExport = true,
  showFilters = true,
  autoRefresh = false,
  refreshInterval = 300 // 5 minutes default
}: ReportViewerProps) {
  const [filters, setFilters] = useState<FilterState>({
    page: 1,
    limit: 100,
    sortDirection: 'desc',
    ...initialFilters
  });
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Fetch report data
  const { 
    data: reportData, 
    isLoading, 
    error, 
    refetch,
    dataUpdatedAt 
  } = useQuery<ReportData>({
    queryKey: ['report', reportId, filters],
    queryFn: () => apiRequest(`/api/reporting/reports/${reportId}/data`, {
      params: {
        ...filters,
        from_date: filters.dateRange?.from?.toISOString(),
        to_date: filters.dateRange?.to?.toISOString()
      }
    }),
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
    staleTime: 30000, // 30 seconds
  });

  // Auto-refresh indicator
  const nextRefresh = useMemo(() => {
    if (!autoRefresh || !dataUpdatedAt) return null;
    return new Date(dataUpdatedAt + (refreshInterval * 1000));
  }, [autoRefresh, dataUpdatedAt, refreshInterval]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filtering
    }));
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      const response = await apiRequest('/api/reporting/reports/export', {
        method: 'POST',
        body: {
          report_id: reportId,
          parameters: filters,
          format
        }
      });
      
      if (response.download_url) {
        window.open(response.download_url, '_blank');
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleDrillDown = (dimension: string, value: string) => {
    if (onDrillDown) {
      onDrillDown(dimension, value);
    } else {
      // Default drill-down behavior - add as filter
      handleFilterChange(dimension, value);
    }
  };

  const toggleRowExpansion = (rowId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>Failed to load report: {error.message}</span>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()} 
          className="mt-4"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Report Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {reportName || reportData?.metadata.report_name || 'Report'}
          </h2>
          {category && (
            <Badge variant="outline" className="mt-1">
              {category}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Auto-refresh indicator */}
          {autoRefresh && nextRefresh && (
            <div className="flex items-center text-sm text-gray-500">
              <Clock className="h-4 w-4 mr-1" />
              Next refresh: {nextRefresh.toLocaleTimeString()}
            </div>
          )}
          
          {/* View mode toggle */}
          <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
            <TabsList>
              <TabsTrigger value="table">
                <Table className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="chart">
                <BarChart3 className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Refresh button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>

          {/* Export dropdown */}
          {showExport && (
            <Select onValueChange={(format: any) => handleExport(format)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Export" />
                <Download className="h-4 w-4 ml-2" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="xlsx">Excel</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Range */}
            <div>
              <Label>Date Range</Label>
              <DateRangePicker
                value={filters.dateRange}
                onChange={(dateRange) => handleFilterChange('dateRange', dateRange)}
              />
            </div>

            {/* Group By */}
            <div>
              <Label>Group By</Label>
              <Select 
                value={filters.groupBy} 
                onValueChange={(value) => handleFilterChange('groupBy', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select grouping" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="region">Region</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div>
              <Label>Sort By</Label>
              <Select 
                value={filters.sortBy} 
                onValueChange={(value) => handleFilterChange('sortBy', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="value">Value</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Direction */}
            <div>
              <Label>Direction</Label>
              <Select 
                value={filters.sortDirection} 
                onValueChange={(value) => handleFilterChange('sortDirection', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Report Content */}
      <Card style={{ height }}>
        <CardContent className="p-6 h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Loading report data...</span>
              </div>
            </div>
          ) : (
            <Tabs value={viewMode} className="h-full">
              <TabsContent value="table" className="h-full">
                <ReportTable 
                  data={reportData?.data || []}
                  metadata={reportData?.metadata}
                  onDrillDown={handleDrillDown}
                  expandedRows={expandedRows}
                  onToggleRow={toggleRowExpansion}
                />
              </TabsContent>
              <TabsContent value="chart" className="h-full">
                <ReportChart 
                  data={reportData?.data || []}
                  metadata={reportData?.metadata}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Report Metadata */}
      {reportData?.metadata && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <span>{reportData.metadata.total_rows} rows</span>
            <span>Executed in {reportData.metadata.execution_time_ms}ms</span>
            {reportData.metadata.cache_hit && (
              <Badge variant="outline" className="text-xs">
                Cached
              </Badge>
            )}
          </div>
          <div>
            Last updated: {new Date(reportData.metadata.data_freshness).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

// Table component for report data
interface ReportTableProps {
  data: any[];
  metadata?: any;
  onDrillDown: (dimension: string, value: string) => void;
  expandedRows: Set<string>;
  onToggleRow: (rowId: string) => void;
}

function ReportTable({ 
  data, 
  metadata, 
  onDrillDown, 
  expandedRows, 
  onToggleRow 
}: ReportTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No data available
      </div>
    );
  }

  const columns = Object.keys(data[0]);
  const drillDownColumns = metadata?.available_drill_downs || [];

  return (
    <div className="overflow-auto h-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            {columns.map((column) => (
              <TableHead key={column} className="font-medium">
                {column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => {
            const rowId = row.id || index.toString();
            const isExpanded = expandedRows.has(rowId);
            
            return (
              <React.Fragment key={rowId}>
                <TableRow className="hover:bg-gray-50">
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleRow(rowId)}
                      className="p-0 h-6 w-6"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column}>
                      {drillDownColumns.includes(column) ? (
                        <Button
                          variant="link"
                          className="p-0 h-auto text-left justify-start"
                          onClick={() => onDrillDown(column, row[column])}
                        >
                          {formatCellValue(row[column])}
                        </Button>
                      ) : (
                        formatCellValue(row[column])
                      )}
                    </TableCell>
                  ))}
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="bg-gray-50">
                      <div className="p-4 space-y-2">
                        <h4 className="font-medium">Row Details</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {Object.entries(row).map(([key, value]) => (
                            <div key={key}>
                              <span className="font-medium">{key}:</span>{' '}
                              <span>{formatCellValue(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// Chart component for report data
interface ReportChartProps {
  data: any[];
  metadata?: any;
}

function ReportChart({ data, metadata }: ReportChartProps) {
  const { LineChart, BarChart, PieChart, AreaChart } = require('@/components/charts/ChartComponents');
  const { getThemeForCategory } = require('@/lib/brandTheme');
  
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No data available for visualization</p>
        </div>
      </div>
    );
  }

  // Auto-detect chart type based on data structure
  const chartType = detectChartType(data);
  const category = metadata?.report_category || 'default';
  const theme = getThemeForCategory(category);

  // Format data for charts
  const chartData = formatDataForChart(data, chartType);

  switch (chartType) {
    case 'line':
      return (
        <LineChart
          data={chartData}
          height={400}
          xDataKey="name"
          lines={[
            { dataKey: 'value', name: 'Value', color: theme.primary },
            { dataKey: 'target', name: 'Target', color: theme.secondary, strokeDasharray: '5 5' }
          ]}
          showGrid={true}
          showLegend={true}
          formatTooltip={(value, name) => {
            if (typeof value === 'number' && value > 1000) {
              return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
              }).format(value);
            }
            return value?.toLocaleString();
          }}
        />
      );

    case 'bar':
      return (
        <BarChart
          data={chartData}
          height={400}
          xDataKey="name"
          bars={[
            { dataKey: 'value', name: 'Value', color: theme.primary },
            { dataKey: 'comparison', name: 'Previous Period', color: theme.secondary }
          ]}
          showGrid={true}
          showLegend={true}
          formatTooltip={(value, name) => {
            if (typeof value === 'number' && value > 1000) {
              return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
              }).format(value);
            }
            return value?.toLocaleString();
          }}
        />
      );

    case 'pie':
      return (
        <PieChart
          data={chartData}
          height={400}
          dataKey="value"
          nameKey="name"
          showLabels={true}
          showLegend={true}
          formatTooltip={(value, name) => {
            const total = chartData.reduce((sum: number, item: any) => sum + item.value, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${value?.toLocaleString()} (${percentage}%)`;
          }}
        />
      );

    case 'area':
      return (
        <AreaChart
          data={chartData}
          height={400}
          xDataKey="name"
          areas={[
            { dataKey: 'value', name: 'Value', color: theme.primary },
            { dataKey: 'cumulative', name: 'Cumulative', color: theme.secondary }
          ]}
          showGrid={true}
          showLegend={true}
          formatTooltip={(value, name) => {
            if (typeof value === 'number' && value > 1000) {
              return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
              }).format(value);
            }
            return value?.toLocaleString();
          }}
        />
      );

    default:
      return (
        <BarChart
          data={chartData}
          height={400}
          xDataKey="name"
          bars={[{ dataKey: 'value', name: 'Value', color: theme.primary }]}
          showGrid={true}
          showLegend={false}
        />
      );
  }
}

// Helper function to detect appropriate chart type
function detectChartType(data: any[]): string {
  if (!data || data.length === 0) return 'bar';
  
  const firstItem = data[0];
  const keys = Object.keys(firstItem);
  
  // Check for time-series data
  const hasDateField = keys.some(key => 
    key.toLowerCase().includes('date') || 
    key.toLowerCase().includes('time') ||
    key.toLowerCase().includes('month') ||
    key.toLowerCase().includes('day')
  );
  
  // Check for categorical data with percentages
  const hasPercentageField = keys.some(key => 
    key.toLowerCase().includes('percentage') ||
    key.toLowerCase().includes('percent') ||
    key.toLowerCase().includes('share')
  );
  
  // Detect chart type based on data characteristics
  if (hasDateField && data.length > 5) {
    return 'line'; // Time series data
  } else if (hasPercentageField || data.length <= 8) {
    return 'pie'; // Categorical data with few categories
  } else if (data.length > 10) {
    return 'area'; // Large datasets
  } else {
    return 'bar'; // Default to bar chart
  }
}

// Helper function to format data for charts
function formatDataForChart(data: any[], chartType: string): any[] {
  if (!data || data.length === 0) return [];
  
  return data.map((item, index) => {
    const keys = Object.keys(item);
    
    // Find the main value field
    const valueField = keys.find(key => 
      typeof item[key] === 'number' && 
      !key.toLowerCase().includes('id') &&
      !key.toLowerCase().includes('index')
    ) || keys[1];
    
    // Find the name/label field
    const nameField = keys.find(key => 
      typeof item[key] === 'string' &&
      !key.toLowerCase().includes('id')
    ) || keys[0];
    
    // Format the chart data point
    const formatted: any = {
      name: item[nameField] || `Item ${index + 1}`,
      value: item[valueField] || 0
    };
    
    // Add additional fields based on chart type
    if (chartType === 'line' || chartType === 'bar') {
      // Look for comparison values
      const comparisonField = keys.find(key => 
        key.toLowerCase().includes('previous') ||
        key.toLowerCase().includes('target') ||
        key.toLowerCase().includes('goal')
      );
      
      if (comparisonField) {
        formatted.comparison = item[comparisonField];
        formatted.target = item[comparisonField];
      }
    }
    
    if (chartType === 'area') {
      // Calculate cumulative values
      formatted.cumulative = data.slice(0, index + 1)
        .reduce((sum, d) => sum + (d[valueField] || 0), 0);
    }
    
    return formatted;
  });
}

// Helper function to format cell values
const formatCellValue = (value: any): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    // Check if it looks like currency
    if (value > 1000) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
      }).format(value);
    }
    return value.toLocaleString();
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
};

export default ReportViewer;
