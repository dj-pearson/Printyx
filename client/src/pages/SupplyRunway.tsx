import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { AlertTriangle, Calendar, Clock, Droplet, ShoppingCart } from 'lucide-react';

interface SupplyForecast {
  deviceId: string;
  serialNumber: string | null;
  deviceName: string | null;
  manufacturer: string | null;
  model: string | null;
  supply: string;
  currentLevel: number;
  consumptionPerDay: number;
  daysRemaining: number;
  expectedEmptyAt: string | null;
  sampleCount: number;
  windowDays: number;
  confidence: 'high' | 'medium' | 'low';
}

interface ForecastResponse {
  windowDays: number;
  forecasts: SupplyForecast[];
}

const SUPPLY_COLORS: Record<string, string> = {
  black: 'bg-zinc-900',
  cyan: 'bg-cyan-500',
  magenta: 'bg-pink-500',
  yellow: 'bg-yellow-400',
};

const URGENCY = (days: number) =>
  days <= 3 ? 'critical' : days <= 7 ? 'urgent' : days <= 14 ? 'soon' : 'ok';

const URGENCY_BADGE: Record<string, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'bg-red-100 text-red-800 border-red-200' },
  urgent: { label: 'Urgent', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  soon: { label: 'Soon', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  ok: { label: 'OK', className: 'bg-green-100 text-green-800 border-green-200' },
};

export default function SupplyRunway() {
  const [windowDays, setWindowDays] = useState('14');
  const [filter, setFilter] = useState<'all' | 'low'>('all');

  const params = new URLSearchParams({ windowDays });
  if (filter === 'low') params.set('lowOnly', 'true');

  const { data, isLoading } = useQuery<ForecastResponse>({
    queryKey: ['/api/device-monitoring/supply-forecast', windowDays, filter],
    queryFn: async () => {
      const res = await fetch(`/api/device-monitoring/supply-forecast?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch forecast');
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const forecasts = data?.forecasts || [];
  const summary = {
    critical: forecasts.filter((f) => f.daysRemaining <= 3).length,
    urgent: forecasts.filter((f) => f.daysRemaining > 3 && f.daysRemaining <= 7).length,
    soon: forecasts.filter((f) => f.daysRemaining > 7 && f.daysRemaining <= 14).length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Supply Runway</h1>
          <p className="text-gray-500 mt-1">
            Days-until-empty forecast per supply, derived from {windowDays}-day toner consumption.
            Refreshes every minute.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={windowDays} onValueChange={setWindowDays}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7-day window</SelectItem>
              <SelectItem value="14">14-day window</SelectItem>
              <SelectItem value="30">30-day window</SelectItem>
              <SelectItem value="60">60-day window</SelectItem>
              <SelectItem value="90">90-day window</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={(v) => setFilter(v as 'all' | 'low')}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All supplies</SelectItem>
              <SelectItem value="low">≤ 14 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">≤ 3 days</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{summary.critical}</div>
            <p className="text-xs text-gray-500 mt-1">Order or swap immediately</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">4 – 7 days</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{summary.urgent}</div>
            <p className="text-xs text-gray-500 mt-1">Within the week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">8 – 14 days</CardTitle>
            <Calendar className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{summary.soon}</div>
            <p className="text-xs text-gray-500 mt-1">Plan replenishment</p>
          </CardContent>
        </Card>
      </div>

      {/* Forecast table */}
      <Card>
        <CardHeader>
          <CardTitle>Forecast</CardTitle>
          <CardDescription>
            Sorted most urgent first. A "low" confidence rating means we don't have enough samples
            in the window — let it run for a few more days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading forecast...</div>
          ) : forecasts.length === 0 ? (
            <div className="text-center py-12">
              <Droplet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nothing to forecast yet</h3>
              <p className="text-gray-500">
                We need at least two readings per supply within the selected window. Wait for the
                next polling cycle, or widen the window.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Supply</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Burn rate</TableHead>
                  <TableHead>Days remaining</TableHead>
                  <TableHead>Expected empty</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecasts.map((f) => {
                  const u = URGENCY(f.daysRemaining);
                  const badge = URGENCY_BADGE[u];
                  return (
                    <TableRow key={`${f.deviceId}:${f.supply}`}>
                      <TableCell className="font-medium">
                        <div>{f.deviceName || f.serialNumber || f.deviceId}</div>
                        <div className="text-xs text-gray-500">
                          {[f.manufacturer, f.model].filter(Boolean).join(' ')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-3 w-3 rounded-full ${
                              SUPPLY_COLORS[f.supply.toLowerCase()] || 'bg-gray-400'
                            }`}
                          />
                          <span className="capitalize">{f.supply}</span>
                        </div>
                      </TableCell>
                      <TableCell>{f.currentLevel}%</TableCell>
                      <TableCell>{f.consumptionPerDay} pp/day</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {f.daysRemaining < 1 ? '< 1 day' : `${f.daysRemaining.toFixed(1)} days`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {f.expectedEmptyAt ? (
                          <div>
                            <div className="text-sm">
                              {format(new Date(f.expectedEmptyAt), 'MMM d')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDistanceToNowStrict(new Date(f.expectedEmptyAt), {
                                addSuffix: true,
                              })}
                            </div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            f.confidence === 'high'
                              ? 'border-green-200 text-green-700'
                              : f.confidence === 'medium'
                                ? 'border-yellow-200 text-yellow-700'
                                : 'border-gray-200 text-gray-500'
                          }
                        >
                          {f.confidence} ({f.sampleCount} samples)
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {u === 'critical' || u === 'urgent' ? (
                          <Badge variant="outline" className="gap-1">
                            <ShoppingCart className="h-3 w-3" />
                            Order
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
