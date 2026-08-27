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
import type { ScopedActivityCounts, ScopedUnitActivity } from '@/types/scoped-sales-reports';

/**
 * CR-034: rebuilt against the shape the report actually returns.
 *
 * The per-unit collection is `regions` (so named for every scope, including
 * locations) with rows of { unitId, unitName, calls, emails, meetings, demos,
 * proposals }. This read `activities` with locationId, locationName,
 * totalActivities, activitiesPerRep and teamSize, and took the summary tiles
 * from `insights.activityBreakdown` — the report puts them under `totals`. Every
 * tile therefore showed 0 and the chart had no bars. Totals are summed per row
 * here because the handler does not send one, and Per Rep / Team are gone: there
 * is no head-count anywhere in this response.
 */
interface LocationActivityChartProps {
  regions: ScopedUnitActivity[];
  totals?: ScopedActivityCounts;
}

const TILES: Array<{ key: keyof ScopedActivityCounts; label: string; className: string }> = [
  { key: 'calls', label: 'Calls', className: 'bg-blue-50 dark:bg-blue-950' },
  { key: 'emails', label: 'Emails', className: 'bg-purple-50 dark:bg-purple-950' },
  { key: 'meetings', label: 'Meetings', className: 'bg-green-50 dark:bg-green-950' },
  { key: 'demos', label: 'Demos', className: 'bg-orange-50 dark:bg-orange-950' },
  { key: 'proposals', label: 'Proposals', className: 'bg-pink-50 dark:bg-pink-950' },
];

const sumOf = (a: ScopedActivityCounts) => a.calls + a.emails + a.meetings + a.demos + a.proposals;

export default function LocationActivityChart({ regions, totals }: LocationActivityChartProps) {
  const chartData = regions.map((a) => ({
    name: a.unitName,
    Calls: a.calls,
    Emails: a.emails,
    Meetings: a.meetings,
    Demos: a.demos,
    Proposals: a.proposals,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {TILES.map((tile) => (
          <div key={tile.key} className={`p-3 ${tile.className} rounded-lg text-center`}>
            <div className="text-sm text-muted-foreground">{tile.label}</div>
            <div className="text-2xl font-bold">{totals?.[tile.key] ?? 0}</div>
          </div>
        ))}
      </div>

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

      <div className="grid md:grid-cols-2 gap-4">
        {regions.slice(0, 6).map((loc) => (
          <div key={loc.unitId} className="p-3 bg-muted rounded-lg">
            <div className="font-semibold mb-2">{loc.unitName}</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Total:</span>{' '}
                <span className="font-semibold">{sumOf(loc)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Calls:</span>{' '}
                <span className="font-semibold">{loc.calls}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Meetings:</span>{' '}
                <span className="font-semibold">{loc.meetings}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
