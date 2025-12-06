import { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Phone, Mail, Calendar, Presentation, FileText } from 'lucide-react';

interface ActivityMetric {
  date: string;
  calls: number;
  emails: number;
  meetings: number;
  demos: number;
  proposals: number;
}

interface ActivityChartProps {
  activities: ActivityMetric[];
  chartType?: 'line' | 'bar';
}

export default function ActivityChart({ activities, chartType = 'bar' }: ActivityChartProps) {
  // Transform data for Recharts
  const chartData = useMemo(() => {
    return activities.map(activity => ({
      date: format(parseISO(activity.date), 'MMM dd'),
      Calls: activity.calls,
      Emails: activity.emails,
      Meetings: activity.meetings,
      Demos: activity.demos,
      Proposals: activity.proposals,
    }));
  }, [activities]);

  // Calculate totals
  const totals = useMemo(() => {
    return activities.reduce(
      (acc, activity) => ({
        calls: acc.calls + activity.calls,
        emails: acc.emails + activity.emails,
        meetings: acc.meetings + activity.meetings,
        demos: acc.demos + activity.demos,
        proposals: acc.proposals + activity.proposals,
      }),
      { calls: 0, emails: 0, meetings: 0, demos: 0, proposals: 0 }
    );
  }, [activities]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="font-semibold text-sm mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span className="font-semibold">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
        <Calendar className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">No Activity Data</p>
        <p className="text-sm">Log activities to see your performance trends</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Line
                type="monotone"
                dataKey="Calls"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="Emails"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="Meetings"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="Demos"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="Proposals"
                stroke="#ec4899"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Bar dataKey="Calls" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Emails" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Meetings" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Demos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Proposals" fill="#ec4899" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Activity summary cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-800">
          <Phone className="h-5 w-5 mx-auto mb-2 text-blue-600" />
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {totals.calls}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            Calls
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-3 text-center border border-purple-200 dark:border-purple-800">
          <Mail className="h-5 w-5 mx-auto mb-2 text-purple-600" />
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {totals.emails}
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">
            Emails
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
          <Calendar className="h-5 w-5 mx-auto mb-2 text-green-600" />
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
            {totals.meetings}
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 font-medium">
            Meetings
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-3 text-center border border-orange-200 dark:border-orange-800">
          <Presentation className="h-5 w-5 mx-auto mb-2 text-orange-600" />
          <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
            {totals.demos}
          </div>
          <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">
            Demos
          </div>
        </div>

        <div className="bg-pink-50 dark:bg-pink-950 rounded-lg p-3 text-center border border-pink-200 dark:border-pink-800">
          <FileText className="h-5 w-5 mx-auto mb-2 text-pink-600" />
          <div className="text-2xl font-bold text-pink-700 dark:text-pink-300">
            {totals.proposals}
          </div>
          <div className="text-xs text-pink-600 dark:text-pink-400 font-medium">
            Proposals
          </div>
        </div>
      </div>

      {/* Daily averages */}
      <div className="pt-4 border-t">
        <div className="text-sm font-medium text-muted-foreground mb-2">
          Daily Averages (Period)
        </div>
        <div className="grid grid-cols-5 gap-4 text-center text-xs">
          <div>
            <span className="text-muted-foreground">Calls:</span>{' '}
            <span className="font-semibold">
              {(totals.calls / activities.length).toFixed(1)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Emails:</span>{' '}
            <span className="font-semibold">
              {(totals.emails / activities.length).toFixed(1)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Meetings:</span>{' '}
            <span className="font-semibold">
              {(totals.meetings / activities.length).toFixed(1)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Demos:</span>{' '}
            <span className="font-semibold">
              {(totals.demos / activities.length).toFixed(1)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Proposals:</span>{' '}
            <span className="font-semibold">
              {(totals.proposals / activities.length).toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
