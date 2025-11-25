import { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Clock, TrendingUp, Activity, Car } from 'lucide-react';

interface TimeEntry {
  date: Date;
  ticketNumber: string;
  customerName: string;
  activityType: string;
  hours: number;
  billable: boolean;
  status: string;
  notes: string | null;
}

interface TimeTrackingSummary {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  travelHours: number;
  productiveHours: number;
  utilizationRate: number;
  hoursByActivity: Record<string, number>;
  hoursByDay: Array<{ date: string; hours: number }>;
}

interface TimeTrackingMetrics {
  productivityRate: number;
  travelPercentage: number;
  averageHoursPerDay: number;
  billableRate: number;
}

interface TimeTrackingChartProps {
  entries: TimeEntry[];
  summary?: TimeTrackingSummary;
  metrics?: TimeTrackingMetrics;
}

export default function TimeTrackingChart({ entries, summary, metrics }: TimeTrackingChartProps) {
  // Hours by day for line chart
  const dailyHoursData = useMemo(() => {
    return summary?.hoursByDay?.map(day => ({
      date: day.date,
      hours: day.hours,
    })) || [];
  }, [summary]);

  // Hours by activity type for bar chart
  const activityData = useMemo(() => {
    if (!summary?.hoursByActivity) return [];
    return Object.entries(summary.hoursByActivity).map(([activity, hours]) => ({
      name: activity.charAt(0).toUpperCase() + activity.slice(1),
      hours: hours,
    }));
  }, [summary]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="font-semibold text-sm mb-2">{payload[0].payload.date || payload[0].payload.name}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-xs">
              <span>{entry.name}:</span>
              <span className="font-semibold">{entry.value.toFixed(1)}h</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
        <Clock className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">No Time Entries</p>
        <p className="text-sm">Time tracking data will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Total Hours</span>
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {summary?.totalHours?.toFixed(1) || 0}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {metrics?.averageHoursPerDay?.toFixed(1) || 0}h per day
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-900 dark:text-green-100">Billable</span>
          </div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
            {summary?.billableHours?.toFixed(1) || 0}h
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            {metrics?.billableRate?.toFixed(0) || 0}% utilization
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Productive</span>
          </div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {summary?.productiveHours?.toFixed(1) || 0}h
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            {metrics?.productivityRate?.toFixed(0) || 0}% of total
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 mb-2">
            <Car className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-900 dark:text-orange-100">Travel</span>
          </div>
          <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
            {summary?.travelHours?.toFixed(1) || 0}h
          </div>
          <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
            {metrics?.travelPercentage?.toFixed(0) || 0}% of total
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-6">
        {/* Daily Hours Line Chart */}
        <div>
          <h3 className="text-sm font-semibold mb-4">Hours by Day</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyHoursData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Breakdown Bar Chart */}
        <div>
          <h3 className="text-sm font-semibold mb-4">Hours by Activity Type</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Time Breakdown */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Time Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(summary?.hoursByActivity || {}).map(([activity, hours]) => (
            <div key={activity} className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                {activity}
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold">{(hours as number).toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">hours</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {summary?.totalHours ? `${((hours as number / summary.totalHours) * 100).toFixed(0)}% of total` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Billable vs Non-Billable */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">Billable Hours</h4>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">
              {summary?.billableHours?.toFixed(1) || 0}
            </div>
            <div className="text-sm text-green-600 dark:text-green-400">hours</div>
          </div>
          <div className="w-full bg-green-200 dark:bg-green-900 rounded-full h-2 mt-3">
            <div
              className="bg-green-600 h-2 rounded-full"
              style={{ width: `${metrics?.billableRate || 0}%` }}
            />
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            {metrics?.billableRate?.toFixed(0) || 0}% of total hours
          </div>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Non-Billable Hours</h4>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-bold text-gray-700 dark:text-gray-300">
              {summary?.nonBillableHours?.toFixed(1) || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">hours</div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 mt-3">
            <div
              className="bg-gray-600 h-2 rounded-full"
              style={{ width: `${100 - (metrics?.billableRate || 0)}%` }}
            />
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {(100 - (metrics?.billableRate || 0)).toFixed(0)}% of total hours
          </div>
        </div>
      </div>
    </div>
  );
}
