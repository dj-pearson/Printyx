// =====================================================================
// KPI WIDGET COMPONENT
// Phase 2 Implementation - Real-time KPI Display with Trend Analysis
// =====================================================================

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPIWidgetProps {
  title: string;
  value: string | number;
  target?: string | number;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    confidenceLevel?: number;
  };
  format?: 'currency' | 'percentage' | 'number' | 'decimal';
  colorScheme?: {
    excellent?: string;
    good?: string;
    warning?: string;
    critical?: string;
  };
  lastUpdated?: string;
  isLoading?: boolean;
  onClick?: () => void;
  drillDownPath?: string;
  performanceLevel?: 'excellent' | 'good' | 'warning' | 'critical';
  description?: string;
  size?: 'small' | 'medium' | 'large';
}

const formatValue = (value: string | number, format?: string, suffix?: string, prefix?: string): string => {
  if (typeof value === 'string') return value;
  
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
      
    case 'percentage':
      return `${value.toFixed(1)}%`;
      
    case 'decimal':
      return value.toFixed(2);
      
    default:
      return value.toLocaleString();
  }
};

const getPerformanceColor = (level?: string): string => {
  switch (level) {
    case 'excellent':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'good':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'warning':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

const getTrendIcon = (direction?: string) => {
  switch (direction) {
    case 'up':
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'down':
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    default:
      return <Minus className="h-4 w-4 text-gray-400" />;
  }
};

const getSizeClasses = (size?: string) => {
  switch (size) {
    case 'small':
      return {
        card: 'p-3',
        title: 'text-sm font-medium',
        value: 'text-lg font-bold',
        description: 'text-xs'
      };
    case 'large':
      return {
        card: 'p-6',
        title: 'text-lg font-semibold',
        value: 'text-3xl font-bold',
        description: 'text-base'
      };
    default: // medium
      return {
        card: 'p-4',
        title: 'text-base font-medium',
        value: 'text-2xl font-bold',
        description: 'text-sm'
      };
  }
};

export function KPIWidget({
  title,
  value,
  target,
  trend,
  format,
  colorScheme,
  lastUpdated,
  isLoading = false,
  onClick,
  drillDownPath,
  performanceLevel,
  description,
  size = 'medium'
}: KPIWidgetProps) {
  const sizeClasses = getSizeClasses(size);
  const performanceColor = getPerformanceColor(performanceLevel);
  const isClickable = onClick || drillDownPath;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (drillDownPath) {
      // Navigate to drill-down path
      window.location.href = drillDownPath;
    }
  };

  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", sizeClasses.card)}>
        <CardHeader className="pb-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </CardHeader>
        <CardContent>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/4"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={cn(
        "transition-all duration-200",
        sizeClasses.card,
        performanceLevel && `border-2 ${performanceColor}`,
        isClickable && "hover:shadow-md hover:scale-[1.02] cursor-pointer"
      )}
      onClick={isClickable ? handleClick : undefined}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className={cn(sizeClasses.title, "text-gray-700")}>
            {title}
          </CardTitle>
          {performanceLevel && (
            <Badge 
              variant="outline" 
              className={cn("text-xs", performanceColor)}
            >
              {performanceLevel}
            </Badge>
          )}
        </div>
        {description && (
          <p className={cn(sizeClasses.description, "text-gray-500 mt-1")}>
            {description}
          </p>
        )}
      </CardHeader>
      
      <CardContent>
        <div className="space-y-2">
          {/* Main Value */}
          <div className="flex items-baseline space-x-2">
            <span className={cn(sizeClasses.value, "text-gray-900")}>
              {formatValue(value, format)}
            </span>
            {target && (
              <span className="text-sm text-gray-500">
                / {formatValue(target, format)}
              </span>
            )}
          </div>

          {/* Trend and Performance Indicators */}
          <div className="flex items-center justify-between">
            {trend && (
              <div className="flex items-center space-x-1">
                {getTrendIcon(trend.direction)}
                <span 
                  className={cn(
                    "text-xs font-medium",
                    trend.direction === 'up' ? 'text-green-600' :
                    trend.direction === 'down' ? 'text-red-600' : 'text-gray-500'
                  )}
                >
                  {Math.abs(trend.percentage).toFixed(1)}%
                </span>
                {trend.confidenceLevel && trend.confidenceLevel < 50 && (
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                )}
              </div>
            )}

            {lastUpdated && (
              <div className="flex items-center space-x-1 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                <span>{formatLastUpdated(lastUpdated)}</span>
              </div>
            )}
          </div>

          {/* Target Progress Bar (if target is provided) */}
          {target && typeof value === 'number' && typeof target === 'number' && (
            <div className="w-full">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    performanceLevel === 'excellent' ? 'bg-green-500' :
                    performanceLevel === 'good' ? 'bg-blue-500' :
                    performanceLevel === 'warning' ? 'bg-yellow-500' :
                    performanceLevel === 'critical' ? 'bg-red-500' : 'bg-gray-400'
                  )}
                  style={{ 
                    width: `${Math.min((value / target) * 100, 100)}%` 
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span className="font-medium">
                  {((value / target) * 100).toFixed(0)}% of target
                </span>
                <span>{formatValue(target, format)}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to format last updated time
const formatLastUpdated = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return date.toLocaleDateString();
};

// Grid component for multiple KPIs
interface KPIGridProps {
  kpis: Array<Omit<KPIWidgetProps, 'size'> & { id: string }>;
  columns?: number;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function KPIGrid({ 
  kpis, 
  columns = 4, 
  isLoading = false, 
  emptyMessage = "No KPIs available" 
}: KPIGridProps) {
  if (isLoading) {
    return (
      <div className={`grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-${columns}`}>
        {Array.from({ length: 4 }).map((_, index) => (
          <KPIWidget
            key={index}
            title=""
            value=""
            isLoading={true}
          />
        ))}
      </div>
    );
  }

  if (kpis.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-${columns}`}>
      {kpis.map((kpi) => (
        <KPIWidget
          key={kpi.id}
          {...kpi}
        />
      ))}
    </div>
  );
}

export default KPIWidget;
