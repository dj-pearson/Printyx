import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BarChart, TrendingUp, AlertTriangle, Target, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

// Phase 3: Control Charts and Trend Widgets
interface ControlChartData {
  period: string;
  value: number;
  upperControlLimit: number;
  lowerControlLimit: number;
  centerLine: number;
  isOutOfControl: boolean;
}

interface TrendWidget {
  id: string;
  title: string;
  currentValue: number;
  previousValue: number;
  trend: 'up' | 'down' | 'stable';
  unit: string;
  target?: number;
  criticalThreshold?: number;
}

export const PipelineTrendWidgets: React.FC = () => {
  // Fetch control chart data
  const { data: controlCharts } = useQuery<ControlChartData[]>({
    queryKey: ['/api/analytics/control-charts'],
    select: (data: any) => data || [
      {
        period: 'Week 1',
        value: 15,
        upperControlLimit: 25,
        lowerControlLimit: 5,
        centerLine: 15,
        isOutOfControl: false
      },
      {
        period: 'Week 2',
        value: 22,
        upperControlLimit: 25,
        lowerControlLimit: 5,
        centerLine: 15,
        isOutOfControl: false
      },
      {
        period: 'Week 3',
        value: 28,
        upperControlLimit: 25,
        lowerControlLimit: 5,
        centerLine: 15,
        isOutOfControl: true
      },
      {
        period: 'Week 4',
        value: 12,
        upperControlLimit: 25,
        lowerControlLimit: 5,
        centerLine: 15,
        isOutOfControl: false
      }
    ]
  });

  // Fetch trend widgets data
  const { data: widgets } = useQuery<TrendWidget[]>({
    queryKey: ['/api/analytics/trend-widgets'],
    select: (data: any) => data || [
      {
        id: 'leads-generated',
        title: 'Leads Generated',
        currentValue: 42,
        previousValue: 38,
        trend: 'up',
        unit: 'leads',
        target: 50,
        criticalThreshold: 30
      },
      {
        id: 'demos-scheduled',
        title: 'Demos Scheduled',
        currentValue: 18,
        previousValue: 22,
        trend: 'down',
        unit: 'demos',
        target: 25,
        criticalThreshold: 15
      },
      {
        id: 'proposals-sent',
        title: 'Proposals Sent',
        currentValue: 12,
        previousValue: 12,
        trend: 'stable',
        unit: 'proposals',
        target: 15,
        criticalThreshold: 8
      },
      {
        id: 'deals-closed',
        title: 'Deals Closed',
        currentValue: 8,
        previousValue: 6,
        trend: 'up',
        unit: 'deals',
        target: 10,
        criticalThreshold: 5
      },
      {
        id: 'revenue-generated',
        title: 'Revenue Generated',
        currentValue: 145000,
        previousValue: 132000,
        trend: 'up',
        unit: '$',
        target: 200000,
        criticalThreshold: 100000
      },
      {
        id: 'avg-deal-size',
        title: 'Avg Deal Size',
        currentValue: 18125,
        previousValue: 22000,
        trend: 'down',
        unit: '$',
        target: 25000,
        criticalThreshold: 15000
      }
    ]
  });

  if (!controlCharts || !widgets) return null;

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
      default: return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === '$') {
      return `$${value.toLocaleString()}`;
    }
    return `${value} ${unit}`;
  };

  const getStatusColor = (widget: TrendWidget) => {
    if (widget.criticalThreshold && widget.currentValue < widget.criticalThreshold) {
      return 'border-red-200 bg-red-50';
    }
    if (widget.target && widget.currentValue >= widget.target) {
      return 'border-green-200 bg-green-50';
    }
    return 'border-gray-200 bg-white';
  };

  const calculateProgress = (widget: TrendWidget) => {
    if (!widget.target) return 0;
    return Math.min(100, (widget.currentValue / widget.target) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Control Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Pipeline Control Chart
          </CardTitle>
          <CardDescription>
            Statistical process control for deal flow monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Chart Visual Representation */}
            <div className="relative h-48 bg-gray-50 rounded-lg p-4">
              <div className="absolute inset-4">
                {/* Control limits lines */}
                <div className="absolute top-2 left-0 right-0 border-t-2 border-red-300 border-dashed" />
                <div className="absolute top-1/2 left-0 right-0 border-t border-gray-400" />
                <div className="absolute bottom-2 left-0 right-0 border-t-2 border-red-300 border-dashed" />
                
                {/* Data points */}
                <div className="flex justify-between items-end h-full">
                  {controlCharts.map((point, index) => (
                    <div key={index} className="flex flex-col items-center">
                      <div 
                        className={`w-3 h-3 rounded-full ${point.isOutOfControl ? 'bg-red-600' : 'bg-blue-600'}`}
                        style={{
                          marginBottom: `${((point.value - 5) / (30 - 5)) * 100}px`
                        }}
                      />
                      <div className="text-xs text-gray-600 mt-2">{point.period}</div>
                      <div className={`text-xs font-medium ${point.isOutOfControl ? 'text-red-600' : 'text-gray-800'}`}>
                        {point.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-red-300 border-dashed" />
                <span className="text-gray-600">Control Limits</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-gray-400" />
                <span className="text-gray-600">Center Line</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-600" />
                <span className="text-gray-600">Out of Control</span>
              </div>
            </div>

            {/* Alerts */}
            {controlCharts.some(point => point.isOutOfControl) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">Process Alert</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Pipeline metrics are showing out-of-control points. Review recent activities and adjust processes.
                    </p>
                    <Button size="sm" variant="outline" className="mt-2">
                      Investigate
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trend Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {widgets.map((widget) => (
          <Card key={widget.id} className={getStatusColor(widget)}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{widget.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-2xl font-bold text-gray-900">
                      {formatValue(widget.currentValue, widget.unit)}
                    </p>
                    {getTrendIcon(widget.trend)}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-sm font-medium ${getTrendColor(widget.trend)}`}>
                    {widget.trend === 'stable' ? '0%' : 
                     `${Math.abs(Math.round(((widget.currentValue - widget.previousValue) / widget.previousValue) * 100))}%`
                    }
                  </div>
                  <div className="text-xs text-gray-500">vs last period</div>
                </div>
              </div>

              {/* Progress towards target */}
              {widget.target && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Progress to Target</span>
                    <span>{formatValue(widget.target, widget.unit)}</span>
                  </div>
                  <Progress value={calculateProgress(widget)} className="h-2" />
                  <div className="text-xs text-gray-500 mt-1">
                    {Math.round(calculateProgress(widget))}% complete
                  </div>
                </div>
              )}

              {/* Status badges */}
              <div className="flex gap-2 mt-3">
                {widget.criticalThreshold && widget.currentValue < widget.criticalThreshold && (
                  <Badge variant="destructive" className="text-xs">
                    Critical
                  </Badge>
                )}
                {widget.target && widget.currentValue >= widget.target && (
                  <Badge variant="default" className="text-xs">
                    Target Achieved
                  </Badge>
                )}
                {widget.trend !== 'stable' && (
                  <Badge 
                    variant={widget.trend === 'up' ? 'default' : 'secondary'} 
                    className="text-xs"
                  >
                    {widget.trend === 'up' ? 'Trending Up' : 'Trending Down'}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};