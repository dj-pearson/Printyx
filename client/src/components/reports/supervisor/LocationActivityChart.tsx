import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function LocationActivityChart({ activities, summary, insights }: any) {
  const chartData = activities.map((a: any) => ({
    name: a.locationName,
    Calls: a.calls,
    Emails: a.emails,
    Meetings: a.meetings,
    Demos: a.demos,
    Proposals: a.proposals,
    Total: a.totalActivities,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-center">
          <div className="text-sm text-blue-900 dark:text-blue-100">Calls</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {insights?.activityBreakdown?.calls || 0}
          </div>
        </div>
        <div className="p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg text-center">
          <div className="text-sm text-purple-900 dark:text-purple-100">Emails</div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {insights?.activityBreakdown?.emails || 0}
          </div>
        </div>
        <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-center">
          <div className="text-sm text-green-900 dark:text-green-100">Meetings</div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
            {insights?.activityBreakdown?.meetings || 0}
          </div>
        </div>
        <div className="p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg text-center">
          <div className="text-sm text-orange-900 dark:text-orange-100">Demos</div>
          <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
            {insights?.activityBreakdown?.demos || 0}
          </div>
        </div>
        <div className="p-3 bg-pink-50 dark:bg-pink-950 border border-pink-200 dark:border-pink-800 rounded-lg text-center">
          <div className="text-sm text-pink-900 dark:text-pink-100">Proposals</div>
          <div className="text-2xl font-bold text-pink-700 dark:text-pink-300">
            {insights?.activityBreakdown?.proposals || 0}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="Calls" fill="#3b82f6" />
            <Bar dataKey="Emails" fill="#8b5cf6" />
            <Bar dataKey="Meetings" fill="#22c55e" />
            <Bar dataKey="Demos" fill="#f59e0b" />
            <Bar dataKey="Proposals" fill="#ec4899" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Location Details */}
      <div className="grid md:grid-cols-2 gap-4">
        {activities.slice(0, 6).map((loc: any) => (
          <div key={loc.locationId} className="p-3 bg-muted rounded-lg">
            <div className="font-semibold mb-2">{loc.locationName}</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Total:</span>{' '}
                <span className="font-semibold">{loc.totalActivities}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Per Rep:</span>{' '}
                <span className="font-semibold">{loc.activitiesPerRep.toFixed(0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Team:</span>{' '}
                <span className="font-semibold">{loc.teamSize || 'N/A'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
