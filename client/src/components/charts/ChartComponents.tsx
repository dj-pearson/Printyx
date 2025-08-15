// =====================================================================
// CHART COMPONENTS
// Phase 3 Implementation - Professional Data Visualizations
// =====================================================================

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Brush,
  ComposedChart
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  AreaChart as AreaChartIcon,
  Download,
  Maximize2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mobile-responsive chart containers
const MOBILE_BREAKPOINT = 768;

// Responsive chart height calculator
const getResponsiveHeight = (baseHeight: number, isMobile: boolean = false): number => {
  if (isMobile) {
    return Math.max(baseHeight * 0.7, 200); // Reduce height on mobile, minimum 200px
  }
  return baseHeight;
};

// Mobile-responsive font size calculator
const getResponsiveFontSize = (baseFontSize: number = 12, isMobile: boolean = false): number => {
  return isMobile ? Math.max(baseFontSize - 2, 8) : baseFontSize;
};

// Brand color palette - easily customizable
export const BRAND_COLORS = {
  primary: '#366092',
  secondary: '#4A90E2',
  accent: '#7ED321',
  warning: '#F5A623',
  danger: '#D0021B',
  success: '#50E3C2',
  neutral: '#9B9B9B',
  light: '#F8F9FA',
  dark: '#2C3E50'
};

export const CHART_COLORS = [
  BRAND_COLORS.primary,
  BRAND_COLORS.secondary,
  BRAND_COLORS.accent,
  BRAND_COLORS.warning,
  BRAND_COLORS.danger,
  BRAND_COLORS.success,
  '#8884D8',
  '#82CA9D',
  '#FFC658',
  '#FF7300',
  '#00C49F',
  '#FFBB28'
];

interface BaseChartProps {
  data: any[];
  title?: string;
  subtitle?: string;
  height?: number;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onExport?: () => void;
  onExpand?: () => void;
  className?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  showBrush?: boolean;
  interactive?: boolean;
}

interface MetricData {
  name: string;
  value: number;
  target?: number;
  previous?: number;
  color?: string;
  trend?: 'up' | 'down' | 'stable';
  percentage?: number;
}

// =====================================================================
// CHART WRAPPER COMPONENT
// =====================================================================

export function ChartWrapper({ 
  children, 
  title, 
  subtitle, 
  loading, 
  error, 
  onRefresh, 
  onExport, 
  onExpand,
  className 
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onExport?: () => void;
  onExpand?: () => void;
  className?: string;
}) {
  // Detect mobile viewport
  const [isMobile, setIsMobile] = React.useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader className="pb-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-200 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("border-red-200", className)}>
        <CardHeader>
          <CardTitle className="text-red-600">Chart Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500 mb-4">{error}</p>
          {onRefresh && (
            <Button variant="outline" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full overflow-hidden", className)}>
      {(title || subtitle || onRefresh || onExport || onExpand) && (
        <CardHeader className="pb-2">
          <div className={cn(
            "flex items-center justify-between",
            isMobile && "flex-col space-y-2 items-start"
          )}>
            <div className="min-w-0 flex-1">
              {title && (
                <CardTitle className={cn(
                  "truncate",
                  isMobile ? "text-base" : "text-lg"
                )}>
                  {title}
                </CardTitle>
              )}
              {subtitle && (
                <p className={cn(
                  "text-gray-600 mt-1 truncate",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  {subtitle}
                </p>
              )}
            </div>
            <div className={cn(
              "flex items-center",
              isMobile ? "space-x-1 self-end" : "space-x-2"
            )}>
              {onRefresh && (
                <Button 
                  variant="ghost" 
                  size={isMobile ? "sm" : "sm"} 
                  onClick={onRefresh}
                  className={isMobile ? "p-2" : ""}
                >
                  <RefreshCw className={cn(isMobile ? "h-3 w-3" : "h-4 w-4")} />
                </Button>
              )}
              {onExport && (
                <Button 
                  variant="ghost" 
                  size={isMobile ? "sm" : "sm"} 
                  onClick={onExport}
                  className={isMobile ? "p-2" : ""}
                >
                  <Download className={cn(isMobile ? "h-3 w-3" : "h-4 w-4")} />
                </Button>
              )}
              {onExpand && (
                <Button 
                  variant="ghost" 
                  size={isMobile ? "sm" : "sm"} 
                  onClick={onExpand}
                  className={isMobile ? "p-2" : ""}
                >
                  <Maximize2 className={cn(isMobile ? "h-3 w-3" : "h-4 w-4")} />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className={cn(isMobile && "px-3 py-2")}>
        {children}
      </CardContent>
    </Card>
  );
}

// =====================================================================
// CUSTOM TOOLTIP COMPONENT
// =====================================================================

export function CustomTooltip({ active, payload, label, formatter }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center space-x-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-medium text-gray-900">
              {formatter ? formatter(entry.value, entry.name) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// =====================================================================
// LINE CHART COMPONENT
// =====================================================================

interface LineChartProps extends BaseChartProps {
  xDataKey: string;
  lines: Array<{
    dataKey: string;
    name: string;
    color?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
  }>;
  formatXAxis?: (value: any) => string;
  formatYAxis?: (value: any) => string;
  formatTooltip?: (value: any, name: string) => string;
}

export function LineChartComponent({
  data,
  title,
  subtitle,
  height = 300,
  loading,
  error,
  onRefresh,
  onExport,
  onExpand,
  className,
  showLegend = true,
  showGrid = true,
  showBrush = false,
  xDataKey,
  lines,
  formatXAxis,
  formatYAxis,
  formatTooltip
}: LineChartProps) {
  // Mobile responsiveness
  const [isMobile, setIsMobile] = React.useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const responsiveHeight = getResponsiveHeight(height, isMobile);
  const responsiveFontSize = getResponsiveFontSize(12, isMobile);
  const formattedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      [xDataKey]: formatXAxis ? formatXAxis(item[xDataKey]) : item[xDataKey]
    }));
  }, [data, xDataKey, formatXAxis]);

  return (
    <ChartWrapper
      title={title}
      subtitle={subtitle}
      loading={loading}
      error={error}
      onRefresh={onRefresh}
      onExport={onExport}
      onExpand={onExpand}
      className={className}
    >
      <ResponsiveContainer width="100%" height={responsiveHeight}>
        <LineChart 
          data={formattedData} 
          margin={{ 
            top: 5, 
            right: isMobile ? 10 : 30, 
            left: isMobile ? 10 : 20, 
            bottom: isMobile ? 20 : 5 
          }}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis 
            dataKey={xDataKey} 
            tick={{ fontSize: responsiveFontSize }}
            stroke="#666"
            interval={isMobile ? 'preserveStartEnd' : 0}
            angle={isMobile ? -45 : 0}
            textAnchor={isMobile ? 'end' : 'middle'}
            height={isMobile ? 60 : 30}
          />
          <YAxis 
            tick={{ fontSize: responsiveFontSize }}
            stroke="#666"
            tickFormatter={formatYAxis}
            width={isMobile ? 40 : 60}
          />
          <Tooltip 
            content={<CustomTooltip formatter={formatTooltip} />}
          />
          {showLegend && <Legend />}
          
          {lines.map((line, index) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.color || CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={line.strokeWidth || (isMobile ? 1.5 : 2)}
              strokeDasharray={line.strokeDasharray}
              dot={{ r: isMobile ? 2 : 4 }}
              activeDot={{ r: isMobile ? 4 : 6 }}
            />
          ))}
          
          {showBrush && <Brush dataKey={xDataKey} height={30} stroke={BRAND_COLORS.primary} />}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

// =====================================================================
// BAR CHART COMPONENT
// =====================================================================

interface BarChartProps extends BaseChartProps {
  xDataKey: string;
  bars: Array<{
    dataKey: string;
    name: string;
    color?: string;
  }>;
  orientation?: 'horizontal' | 'vertical';
  formatXAxis?: (value: any) => string;
  formatYAxis?: (value: any) => string;
  formatTooltip?: (value: any, name: string) => string;
}

export function BarChartComponent({
  data,
  title,
  subtitle,
  height = 300,
  loading,
  error,
  onRefresh,
  onExport,
  onExpand,
  className,
  showLegend = true,
  showGrid = true,
  xDataKey,
  bars,
  orientation = 'vertical',
  formatXAxis,
  formatYAxis,
  formatTooltip
}: BarChartProps) {
  return (
    <ChartWrapper
      title={title}
      subtitle={subtitle}
      loading={loading}
      error={error}
      onRefresh={onRefresh}
      onExport={onExport}
      onExpand={onExpand}
      className={className}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart 
          data={data} 
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          layout={orientation === 'horizontal' ? 'horizontal' : 'vertical'}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis 
            dataKey={orientation === 'horizontal' ? undefined : xDataKey}
            type={orientation === 'horizontal' ? 'number' : 'category'}
            tick={{ fontSize: 12 }}
            stroke="#666"
            tickFormatter={formatXAxis}
          />
          <YAxis 
            dataKey={orientation === 'horizontal' ? xDataKey : undefined}
            type={orientation === 'horizontal' ? 'category' : 'number'}
            tick={{ fontSize: 12 }}
            stroke="#666"
            tickFormatter={formatYAxis}
          />
          <Tooltip 
            content={<CustomTooltip formatter={formatTooltip} />}
          />
          {showLegend && <Legend />}
          
          {bars.map((bar, index) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name}
              fill={bar.color || CHART_COLORS[index % CHART_COLORS.length]}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

// =====================================================================
// PIE CHART COMPONENT
// =====================================================================

interface PieChartProps extends BaseChartProps {
  dataKey: string;
  nameKey: string;
  showLabels?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  formatTooltip?: (value: any, name: string) => string;
}

export function PieChartComponent({
  data,
  title,
  subtitle,
  height = 300,
  loading,
  error,
  onRefresh,
  onExport,
  onExpand,
  className,
  showLegend = true,
  dataKey,
  nameKey,
  showLabels = true,
  innerRadius = 0,
  outerRadius = 100,
  formatTooltip
}: PieChartProps) {
  const renderLabel = (entry: any) => {
    const percent = ((entry.value / data.reduce((sum, item) => sum + item[dataKey], 0)) * 100).toFixed(1);
    return `${entry[nameKey]}: ${percent}%`;
  };

  return (
    <ChartWrapper
      title={title}
      subtitle={subtitle}
      loading={loading}
      error={error}
      onRefresh={onRefresh}
      onExport={onExport}
      onExpand={onExpand}
      className={className}
    >
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={showLabels ? renderLabel : false}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            fill="#8884d8"
            dataKey={dataKey}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={CHART_COLORS[index % CHART_COLORS.length]} 
              />
            ))}
          </Pie>
          <Tooltip 
            content={<CustomTooltip formatter={formatTooltip} />}
          />
          {showLegend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

// =====================================================================
// AREA CHART COMPONENT
// =====================================================================

interface AreaChartProps extends BaseChartProps {
  xDataKey: string;
  areas: Array<{
    dataKey: string;
    name: string;
    color?: string;
    stackId?: string;
  }>;
  stacked?: boolean;
  formatXAxis?: (value: any) => string;
  formatYAxis?: (value: any) => string;
  formatTooltip?: (value: any, name: string) => string;
}

export function AreaChartComponent({
  data,
  title,
  subtitle,
  height = 300,
  loading,
  error,
  onRefresh,
  onExport,
  onExpand,
  className,
  showLegend = true,
  showGrid = true,
  showBrush = false,
  xDataKey,
  areas,
  stacked = false,
  formatXAxis,
  formatYAxis,
  formatTooltip
}: AreaChartProps) {
  return (
    <ChartWrapper
      title={title}
      subtitle={subtitle}
      loading={loading}
      error={error}
      onRefresh={onRefresh}
      onExport={onExport}
      onExpand={onExpand}
      className={className}
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis 
            dataKey={xDataKey} 
            tick={{ fontSize: 12 }}
            stroke="#666"
            tickFormatter={formatXAxis}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            stroke="#666"
            tickFormatter={formatYAxis}
          />
          <Tooltip 
            content={<CustomTooltip formatter={formatTooltip} />}
          />
          {showLegend && <Legend />}
          
          {areas.map((area, index) => (
            <Area
              key={area.dataKey}
              type="monotone"
              dataKey={area.dataKey}
              name={area.name}
              stackId={stacked ? (area.stackId || '1') : undefined}
              stroke={area.color || CHART_COLORS[index % CHART_COLORS.length]}
              fill={area.color || CHART_COLORS[index % CHART_COLORS.length]}
              fillOpacity={0.6}
            />
          ))}
          
          {showBrush && <Brush dataKey={xDataKey} height={30} stroke={BRAND_COLORS.primary} />}
        </AreaChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

// =====================================================================
// COMPOSED CHART COMPONENT (Bar + Line)
// =====================================================================

interface ComposedChartProps extends BaseChartProps {
  xDataKey: string;
  bars?: Array<{
    dataKey: string;
    name: string;
    color?: string;
  }>;
  lines?: Array<{
    dataKey: string;
    name: string;
    color?: string;
    yAxisId?: string;
  }>;
  areas?: Array<{
    dataKey: string;
    name: string;
    color?: string;
    yAxisId?: string;
  }>;
  formatXAxis?: (value: any) => string;
  formatYAxis?: (value: any) => string;
  formatTooltip?: (value: any, name: string) => string;
}

export function ComposedChartComponent({
  data,
  title,
  subtitle,
  height = 300,
  loading,
  error,
  onRefresh,
  onExport,
  onExpand,
  className,
  showLegend = true,
  showGrid = true,
  xDataKey,
  bars = [],
  lines = [],
  areas = [],
  formatXAxis,
  formatYAxis,
  formatTooltip
}: ComposedChartProps) {
  return (
    <ChartWrapper
      title={title}
      subtitle={subtitle}
      loading={loading}
      error={error}
      onRefresh={onRefresh}
      onExport={onExport}
      onExpand={onExpand}
      className={className}
    >
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis 
            dataKey={xDataKey} 
            tick={{ fontSize: 12 }}
            stroke="#666"
            tickFormatter={formatXAxis}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            stroke="#666"
            tickFormatter={formatYAxis}
          />
          <Tooltip 
            content={<CustomTooltip formatter={formatTooltip} />}
          />
          {showLegend && <Legend />}
          
          {areas.map((area, index) => (
            <Area
              key={area.dataKey}
              type="monotone"
              dataKey={area.dataKey}
              name={area.name}
              fill={area.color || CHART_COLORS[index % CHART_COLORS.length]}
              fillOpacity={0.3}
              yAxisId={area.yAxisId}
            />
          ))}
          
          {bars.map((bar, index) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name}
              fill={bar.color || CHART_COLORS[index % CHART_COLORS.length]}
              radius={[2, 2, 0, 0]}
            />
          ))}
          
          {lines.map((line, index) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.color || CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              yAxisId={line.yAxisId}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

// =====================================================================
// METRIC CARDS WITH MINI CHARTS
// =====================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  sparklineData?: number[];
  target?: number;
  format?: 'currency' | 'percentage' | 'number';
  color?: string;
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  change,
  trend,
  sparklineData,
  target,
  format = 'number',
  color = BRAND_COLORS.primary,
  onClick
}: MetricCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
        }).format(val);
      case 'percentage':
        return `${val}%`;
      default:
        return val.toLocaleString();
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <Card 
      className={cn(
        "transition-all duration-200 hover:shadow-md",
        onClick && "cursor-pointer hover:scale-[1.02]"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          {getTrendIcon()}
        </div>
        
        <div className="flex items-baseline space-x-2 mb-2">
          <span className="text-2xl font-bold text-gray-900">
            {formatValue(value)}
          </span>
          {change !== undefined && (
            <span 
              className={cn(
                "text-sm font-medium",
                change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
              )}
            >
              {change > 0 ? '+' : ''}{change}%
            </span>
          )}
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="h-12 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData.map((val, index) => ({ value: val, index }))}>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  fill={color}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {target && typeof value === 'number' && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progress</span>
              <span>{Math.round((value / target) * 100)}% of target</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min((value / target) * 100, 100)}%`,
                  backgroundColor: color
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================================
// EXPORT ALL COMPONENTS
// =====================================================================

export {
  BRAND_COLORS,
  CHART_COLORS,
  LineChartComponent as LineChart,
  BarChartComponent as BarChart,
  PieChartComponent as PieChart,
  AreaChartComponent as AreaChart,
  ComposedChartComponent as ComposedChart,
  MetricCard
};
