/**
 * What is outstanding across all three supply-order tables (WF-V-06).
 *
 * READ-ONLY BY DESIGN. The table below this panel is device_supply_orders and
 * its Approve/Cancel buttons only work there - a toner-pipeline order ships
 * through toner-replenish and a portal basket is the customer's. Offering one
 * Approve button over three lifecycles would be a control that works for a
 * third of what it lists, so this answers "what is outstanding" and sends you
 * to the surface that owns each one.
 */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InlineQueryError } from '@/components/ui/inline-query-error';
import { formatCurrencyWhole } from '@/lib/utils';
import { Package } from 'lucide-react';

const SOURCE_LABEL: Record<string, string> = {
  toner: 'Auto-replenish',
  device: 'Fleet',
  portal: 'Customer portal',
};

interface UnifiedOrder {
  id: string;
  source: keyof typeof SOURCE_LABEL;
  status: string;
  rawStatus: string | null;
  reference: string | null;
  description: string | null;
  quantity: number | null;
  total: number | null;
  createdAt: string | null;
}

interface UnifiedResponse {
  orders: UnifiedOrder[];
  outstandingCount: number;
  outstandingValue: { total: number; isFloor: boolean; uncosted: number };
  coercions: Array<{ source: string; count: number; values: string[] }>;
  degraded: string[];
}

export function PendingSupplyOrders() {
  const { data, isLoading, isError, refetch } = useQuery<UnifiedResponse>({
    queryKey: ['/api/device-monitoring/supply-orders?sources=all'],
    queryFn: () => apiRequest('/api/device-monitoring/supply-orders?sources=all'),
    refetchInterval: 60_000,
  });

  if (isError) {
    return <InlineQueryError label="the cross-source supply queue" onRetry={() => refetch()} />;
  }

  const outstanding = (data?.orders ?? []).filter((o) =>
    ['pending_approval', 'approved', 'ordered'].includes(o.status),
  );
  const bySource = outstanding.reduce<Record<string, number>>((acc, o) => {
    acc[o.source] = (acc[o.source] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4" />
          Pending across every supply source
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div>
                <span className="text-2xl font-semibold">{data?.outstandingCount ?? 0}</span>
                <span className="text-sm text-muted-foreground ml-2">outstanding</span>
              </div>
              {/* A total over rows where some carry no money column is a FLOOR,
                  and saying so is the difference between a number and a claim. */}
              <div className="text-sm text-muted-foreground">
                {data?.outstandingValue.isFloor ? 'at least ' : ''}
                <span className="font-medium text-foreground">
                  {formatCurrencyWhole(data?.outstandingValue.total ?? 0)}
                </span>
                {data?.outstandingValue.isFloor
                  ? ` (${data.outstandingValue.uncosted} order(s) carry no price)`
                  : ''}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(SOURCE_LABEL).map(([key, label]) => (
                <Badge key={key} variant="outline" className="font-normal">
                  {label}: {bySource[key] ?? 0}
                </Badge>
              ))}
            </div>

            {/* A source that could not be READ is named, never counted as
                having nothing outstanding. */}
            {data?.degraded?.length ? (
              <p className="text-sm text-destructive">
                Could not read: {data.degraded.join(', ')}. The counts above exclude them.
              </p>
            ) : null}

            {data?.coercions?.length ? (
              <p className="text-xs text-muted-foreground">
                {data.coercions
                  .map(
                    (c) =>
                      `${SOURCE_LABEL[c.source] ?? c.source}: ${c.count} order(s) in an unrecognised state (${c.values.join(', ')})`,
                  )
                  .join(' · ')}
              </p>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Auto-replenish orders ship from Toner Replenish and portal baskets belong to the
              customer; only fleet orders can be approved on this page.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
