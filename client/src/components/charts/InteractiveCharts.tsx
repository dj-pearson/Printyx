// =====================================================================
// INTERACTIVE CHART COMPONENTS
// Phase 3 Implementation - Charts with Drill-down and Interactions
// =====================================================================

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  BarChart,
  PieChart,
  AreaChart,
  ComposedChart,
  MetricCard,
  BRAND_COLORS,
  ChartWrapper
} from './ChartComponents';
import { getThemeForCategory } from '@/lib/brandTheme';
import { 
  Calendar,
  Filter,
  TrendingUp,
  Users,
  MapPin,
  Building,
  ChevronLeft,
  Layers,
  ZoomIn
} from 'lucide-react';

interface DrillDownLevel {
  id: string;
  name: string;
  field: string;
  value: any;
}

interface InteractiveChartProps {
  data: any[];
  title: string;
  category?: string;
  type?: 'line' | 'bar' | 'pie' | 'area' | 'composed';
  enableDrillDown?: boolean;
  drillDownFields?: string[];
  onDrillDown?: (field: string, value: any, path: DrillDownLevel[]) => void;
  onDataPointClick?: (data: any, path: DrillDownLevel[]) => void;
  height?: number;
  loading?: boolean;
  className?: string;
}

export function InteractiveChart({
  data,
  title,
  category = 'default',
  type = 'bar',
  enableDrillDown = true,
  drillDownFields = ['location', 'region', 'user', 'department'],
  onDrillDown,
  onDataPointClick,
  height = 400,
  loading = false,
  className
}: InteractiveChartProps) {
  const [drillDownPath, setDrillDownPath] = useState<DrillDownLevel[]>([]);
  const [filteredData, setFilteredData] = useState(data);
  const [selectedMetric, setSelectedMetric] = useState<string>('value');

  const theme = getThemeForCategory(category);

  // Get current data based on drill-down path
  const currentData = useMemo(() => {
    if (drillDownPath.length === 0) return data;
    
    let filtered = data;
    drillDownPath.forEach(level => {
      filtered = filtered.filter(item => item[level.field] === level.value);
    });
    
    return filtered;
  }, [data, drillDownPath]);

  // Handle drill-down
  const handleDrillDown = useCallback((field: string, value: any) => {
    const newLevel: DrillDownLevel = {
      id: `${field}-${value}`,
      name: `${field}: ${value}`,
      field,
      value
    };
    
    const newPath = [...drillDownPath, newLevel];
    setDrillDownPath(newPath);
    
    if (onDrillDown) {
      onDrillDown(field, value, newPath);
    }
  }, [drillDownPath, onDrillDown]);

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = useCallback((levelIndex: number) => {
    const newPath = drillDownPath.slice(0, levelIndex + 1);
    setDrillDownPath(newPath);
  }, [drillDownPath]);

  // Handle chart click events
  const handleChartClick = useCallback((data: any, index: number) => {
    if (!enableDrillDown) return;

    // Find the next available drill-down field
    const availableFields = drillDownFields.filter(field => 
      !drillDownPath.some(level => level.field === field)
    );

    if (availableFields.length > 0 && data && data.activeLabel) {
      const nextField = availableFields[0];
      if (data.activePayload && data.activePayload.length > 0) {
        const clickedData = data.activePayload[0].payload;
        
        if (clickedData[nextField]) {
          handleDrillDown(nextField, clickedData[nextField]);
        }
      }
    }

    if (onDataPointClick) {
      onDataPointClick(data, drillDownPath);
    }
  }, [enableDrillDown, drillDownFields, drillDownPath, handleDrillDown, onDataPointClick]);

  // Get available metrics for the chart
  const availableMetrics = useMemo(() => {
    if (currentData.length === 0) return [];
    
    const firstItem = currentData[0];
    return Object.keys(firstItem).filter(key => 
      typeof firstItem[key] === 'number' &&
      !key.toLowerCase().includes('id') &&
      !key.toLowerCase().includes('index')
    );
  }, [currentData]);

  // Render breadcrumb navigation
  const renderBreadcrumbs = () => {
    if (drillDownPath.length === 0) return null;

    return (
      <div className="flex items-center space-x-2 mb-4 p-2 bg-gray-50 rounded-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDrillDownPath([])}
          className="text-sm"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          All Data
        </Button>
        
        {drillDownPath.map((level, index) => (
          <React.Fragment key={level.id}>
            <span className="text-gray-400">/</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBreadcrumbClick(index)}
              className="text-sm"
            >
              {level.name}
            </Button>
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Render chart controls
  const renderControls = () => {
    return (
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          {availableMetrics.length > 1 && (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Metric:</label>
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMetrics.map(metric => (
                    <SelectItem key={metric} value={metric}>
                      {metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {enableDrillDown && (
            <Badge variant="outline" className="text-xs">
              <ZoomIn className="h-3 w-3 mr-1" />
              Click to drill down
            </Badge>
          )}
          
          <Badge variant="outline" className="text-xs">
            {currentData.length} records
          </Badge>
        </div>
      </div>
    );
  };

  // Format chart data based on selected metric
  const chartData = useMemo(() => {
    return currentData.map(item => ({
      ...item,
      value: item[selectedMetric] || 0,
      name: item.name || item.label || 'Unknown'
    }));
  }, [currentData, selectedMetric]);

  // Custom chart props with click handler
  const chartProps = {
    data: chartData,
    height,
    loading,
    onClick: handleChartClick,
    title: `${title}${drillDownPath.length > 0 ? ` - ${drillDownPath.map(l => l.name).join(' > ')}` : ''}`,
    className
  };

  // Render appropriate chart type
  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart
            {...chartProps}
            xDataKey="name"
            lines={[
              { dataKey: 'value', name: selectedMetric, color: theme.primary }
            ]}
            showGrid={true}
            showLegend={false}
          />
        );

      case 'pie':
        return (
          <PieChart
            {...chartProps}
            dataKey="value"
            nameKey="name"
            showLabels={true}
            showLegend={true}
          />
        );

      case 'area':
        return (
          <AreaChart
            {...chartProps}
            xDataKey="name"
            areas={[
              { dataKey: 'value', name: selectedMetric, color: theme.primary }
            ]}
            showGrid={true}
            showLegend={false}
          />
        );

      case 'composed':
        return (
          <ComposedChart
            {...chartProps}
            xDataKey="name"
            bars={[{ dataKey: 'value', name: selectedMetric, color: theme.primary }]}
            lines={[{ dataKey: 'target', name: 'Target', color: theme.secondary }]}
            showGrid={true}
            showLegend={true}
          />
        );

      default: // 'bar'
        return (
          <BarChart
            {...chartProps}
            xDataKey="name"
            bars={[
              { dataKey: 'value', name: selectedMetric, color: theme.primary }
            ]}
            showGrid={true}
            showLegend={false}
          />
        );
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <div className="flex items-center space-x-2">
            <Layers className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">
              Level {drillDownPath.length + 1}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {renderBreadcrumbs()}
        {renderControls()}
        {renderChart()}
        
        {/* Drill-down suggestions */}
        {enableDrillDown && drillDownPath.length < drillDownFields.length && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700 mb-2">
              💡 <strong>Tip:</strong> Click on chart elements to drill down by:
            </p>
            <div className="flex flex-wrap gap-2">
              {drillDownFields
                .filter(field => !drillDownPath.some(level => level.field === field))
                .slice(0, 3)
                .map(field => (
                  <Badge key={field} variant="outline" className="text-xs">
                    {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================================
// DASHBOARD CHART GRID
// =====================================================================

interface DashboardChartsProps {
  charts: Array<{
    id: string;
    title: string;
    data: any[];
    type: 'line' | 'bar' | 'pie' | 'area' | 'composed';
    category?: string;
    span?: number; // Grid span (1-2)
  }>;
  onChartDrillDown?: (chartId: string, field: string, value: any) => void;
  loading?: boolean;
  className?: string;
}

export function DashboardCharts({
  charts,
  onChartDrillDown,
  loading = false,
  className
}: DashboardChartsProps) {
  const handleDrillDown = useCallback((chartId: string) => 
    (field: string, value: any, path: DrillDownLevel[]) => {
      if (onChartDrillDown) {
        onChartDrillDown(chartId, field, value);
      }
    }, [onChartDrillDown]);

  if (loading) {
    return (
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
      {charts.map(chart => (
        <div
          key={chart.id}
          className={chart.span === 2 ? 'lg:col-span-2' : ''}
        >
          <InteractiveChart
            data={chart.data}
            title={chart.title}
            type={chart.type}
            category={chart.category}
            enableDrillDown={true}
            drillDownFields={['location', 'region', 'user', 'department', 'team']}
            onDrillDown={handleDrillDown(chart.id)}
            height={chart.span === 2 ? 350 : 300}
          />
        </div>
      ))}
    </div>
  );
}

// =====================================================================
// EXPORT COMPONENTS
// =====================================================================

export default InteractiveChart;
export { DashboardCharts };
