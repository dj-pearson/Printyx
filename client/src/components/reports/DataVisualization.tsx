import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  ScatterChart, 
  Scatter, 
  ComposedChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Maximize2, 
  Settings,
  MoreHorizontal
} from 'lucide-react';
import { format } from 'date-fns';

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#ffb366', '#a4de6c'];

interface ChartData {
  [key: string]: any;
}

interface ChartConfig {
  title?: string;
  description?: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  animated?: boolean;
  colors?: string[];
  formatters?: {
    xAxis?: (value: any) => string;
    yAxis?: (value: any) => string;
    tooltip?: (value: any, name: string) => [string, string];
  };
}

interface BaseChartProps {
  data: ChartData[];
  config?: ChartConfig;
  className?: string;
  onExport?: () => void;
  onMaximize?: () => void;
}

// Enhanced Line Chart with trends
export function TrendLineChart({ 
  data, 
  config = {}, 
  className = '', 
  onExport, 
  onMaximize,
  dataKeys,
  strokeWidth = 2
}: BaseChartProps & { dataKeys: string[]; strokeWidth?: number }) {
  const colors = config.colors || CHART_COLORS;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          {config.title && <CardTitle className="text-lg">{config.title}</CardTitle>}
          {config.description && <CardDescription>{config.description}</CardDescription>}
        </div>
        <div className="flex items-center gap-1">
          {onExport && (
            <Button variant="ghost" size="sm" onClick={onExport}>
              <Download className="h-4 w-4" />
            </Button>
          )}
          {onMaximize && (
            <Button variant="ghost" size="sm" onClick={onMaximize}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={config.height || 300}>
          <LineChart data={data}>
            {config.showGrid !== false && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis 
              dataKey="name" 
              tickFormatter={config.formatters?.xAxis}
            />
            <YAxis tickFormatter={config.formatters?.yAxis} />
            <Tooltip 
              formatter={config.formatters?.tooltip}
              labelFormatter={(label) => config.formatters?.xAxis?.(label) || label}
            />
            {config.showLegend !== false && <Legend />}
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={strokeWidth}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                animationDuration={config.animated !== false ? 1000 : 0}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Enhanced Area Chart for volume data
export function AreaVolumeChart({
  data,
  config = {},
  className = '',
  onExport,
  onMaximize,
  dataKeys,
  stacked = false
}: BaseChartProps & { dataKeys: string[]; stacked?: boolean }) {
  const colors = config.colors || CHART_COLORS;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          {config.title && <CardTitle className="text-lg">{config.title}</CardTitle>}
          {config.description && <CardDescription>{config.description}</CardDescription>}
        </div>
        <div className="flex items-center gap-1">
          {onExport && (
            <Button variant="ghost" size="sm" onClick={onExport}>
              <Download className="h-4 w-4" />
            </Button>
          )}
          {onMaximize && (
            <Button variant="ghost" size="sm" onClick={onMaximize}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={config.height || 300}>
          <AreaChart data={data}>
            {config.showGrid !== false && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            {config.showLegend !== false && <Legend />}
            {dataKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId={stacked ? "1" : undefined}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Enhanced Bar Chart with comparisons
export function ComparisonBarChart({
  data,
  config = {},
  className = '',
  onExport,
  onMaximize,
  dataKeys,
  layout = 'horizontal'
}: BaseChartProps & { dataKeys: string[]; layout?: 'horizontal' | 'vertical' }) {
  const colors = config.colors || CHART_COLORS;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          {config.title && <CardTitle className="text-lg">{config.title}</CardTitle>}
          {config.description && <CardDescription>{config.description}</CardDescription>}
        </div>
        <div className="flex items-center gap-1">
          {onExport && (
            <Button variant="ghost" size="sm" onClick={onExport}>
              <Download className="h-4 w-4" />
            </Button>
          )}
          {onMaximize && (
            <Button variant="ghost" size="sm" onClick={onMaximize}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={config.height || 300}>
          <BarChart data={data} layout={layout}>
            {config.showGrid !== false && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            {config.showLegend !== false && <Legend />}
            {dataKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[index % colors.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Enhanced Pie Chart with insights
export function InsightsPieChart({
  data,
  config = {},
  className = '',
  onExport,
  onMaximize,
  dataKey = 'value',
  nameKey = 'name'
}: BaseChartProps & { dataKey?: string; nameKey?: string }) {
  const colors = config.colors || CHART_COLORS;
  const total = data.reduce((sum, item) => sum + item[dataKey], 0);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          {config.title && <CardTitle className="text-lg">{config.title}</CardTitle>}
          {config.description && <CardDescription>{config.description}</CardDescription>}
        </div>
        <div className="flex items-center gap-1">
          {onExport && (
            <Button variant="ghost" size="sm" onClick={onExport}>
              <Download className="h-4 w-4" />
            </Button>
          )}
          {onMaximize && (
            <Button variant="ghost" size="sm" onClick={onMaximize}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={config.height || 300}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey={dataKey}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 lg:w-48">
            {data.map((item, index) => {
              const percentage = ((item[dataKey] / total) * 100).toFixed(1);
              return (
                <div key={index} className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{item[nameKey]}</div>
                    <div className="text-muted-foreground">
                      {item[dataKey].toLocaleString()} ({percentage}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Performance Radar Chart
export function PerformanceRadarChart({
  data,
  config = {},
  className = '',
  onExport,
  onMaximize,
  dataKey = 'value',
  nameKey = 'subject'
}: BaseChartProps & { dataKey?: string; nameKey?: string }) {
  const colors = config.colors || CHART_COLORS;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          {config.title && <CardTitle className="text-lg">{config.title}</CardTitle>}
          {config.description && <CardDescription>{config.description}</CardDescription>}
        </div>
        <div className="flex items-center gap-1">
          {onExport && (
            <Button variant="ghost" size="sm" onClick={onExport}>
              <Download className="h-4 w-4" />
            </Button>
          )}
          {onMaximize && (
            <Button variant="ghost" size="sm" onClick={onMaximize}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={config.height || 300}>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey={nameKey} />
            <PolarRadiusAxis />
            <Radar
              name="Performance"
              dataKey={dataKey}
              stroke={colors[0]}
              fill={colors[0]}
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Sales Funnel Chart
export function SalesFunnelChart({
  data,
  config = {},
  className = '',
  onExport,
  onMaximize,
  dataKey = 'value',
  nameKey = 'name'
}: BaseChartProps & { dataKey?: string; nameKey?: string }) {
  const colors = config.colors || CHART_COLORS;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          {config.title && <CardTitle className="text-lg">{config.title}</CardTitle>}
          {config.description && <CardDescription>{config.description}</CardDescription>}
        </div>
        <div className="flex items-center gap-1">
          {onExport && (
            <Button variant="ghost" size="sm" onClick={onExport}>
              <Download className="h-4 w-4" />
            </Button>
          )}
          {onMaximize && (
            <Button variant="ghost" size="sm" onClick={onMaximize}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={config.height || 400}>
          <FunnelChart width={730} height={250}>
            <Tooltip />
            <Funnel
              dataKey={dataKey}
              data={data}
              isAnimationActive={config.animated !== false}
            >
              <LabelList position="center" fill="#fff" stroke="none" />
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// KPI Summary Cards with trends
interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  period?: string;
  icon?: React.ComponentType<any>;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function KPICard({ 
  title, 
  value, 
  change, 
  period = 'vs last period', 
  icon: Icon,
  trend,
  className = '' 
}: KPICardProps) {
  const getTrendIcon = () => {
    if (trend === 'up' || (change && change > 0)) return TrendingUp;
    if (trend === 'down' || (change && change < 0)) return TrendingDown;
    return null;
  };

  const getTrendColor = () => {
    if (trend === 'up' || (change && change > 0)) return 'text-green-600';
    if (trend === 'down' || (change && change < 0)) return 'text-red-600';
    return 'text-muted-foreground';
  };

  const TrendIcon = getTrendIcon();

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center text-xs ${getTrendColor()}`}>
                {TrendIcon && <TrendIcon className="h-3 w-3 mr-1" />}
                <span>
                  {change > 0 ? '+' : ''}{change}% {period}
                </span>
              </div>
            )}
          </div>
          {Icon && (
            <div className="rounded-lg p-3 bg-muted">
              <Icon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Export utilities
export const chartExportUtils = {
  downloadChart: (chartRef: HTMLElement, filename: string) => {
    // Implementation for chart download
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    // Chart to canvas conversion logic would go here
  },

  exportToCSV: (data: any[], filename: string) => {
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
  }
};