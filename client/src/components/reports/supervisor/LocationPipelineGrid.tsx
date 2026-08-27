import { Badge } from '@/components/ui/badge';
import type {
  ScopedPipelineReport,
  ScopedStageAggregate,
  ScopedUnitPipeline,
} from '@/types/scoped-sales-reports';

/**
 * CR-034: rebuilt against the shape the report actually returns.
 *
 * This took `{ pipelines, aggregated, summary }: any` and drew a
 * location x stage matrix off `pipelines[]` rows of
 * { locationId, locationName, stage, dealCount, totalValue }. No such
 * collection exists. scoped-sales.ts returns `aggregated` (one row per stage,
 * summed across every unit) and `byUnit` (one row per unit, with no stage
 * breakdown at all), so a per-location-per-stage grid is not derivable from
 * this endpoint — the matrix was permanently empty. The two real cuts of the
 * data are shown instead.
 */
interface LocationPipelineGridProps {
  byUnit: ScopedUnitPipeline[];
  aggregated: ScopedStageAggregate[];
  summary?: ScopedPipelineReport['summary'];
}

const formatCurrency = (value: number) =>
  value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : `$${value.toFixed(0)}`;

export default function LocationPipelineGrid({
  byUnit,
  aggregated,
  summary,
}: LocationPipelineGridProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-xs text-muted-foreground">Locations</div>
          <div className="text-2xl font-bold">{byUnit.length}</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-xs text-muted-foreground">Total Pipeline</div>
          <div className="text-2xl font-bold">{formatCurrency(summary?.totalValue ?? 0)}</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-xs text-muted-foreground">Total Deals</div>
          <div className="text-2xl font-bold">{summary?.totalDeals ?? 0}</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-xs text-muted-foreground">Won Share</div>
          <div className="text-2xl font-bold">{(summary?.healthScore ?? 0).toFixed(0)}%</div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold">By Location</h4>
        {byUnit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No locations in scope.</p>
        ) : (
          byUnit.map((unit) => (
            <div
              key={unit.unitId}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div>
                <div className="font-medium">{unit.unitName}</div>
                <div className="text-xs text-muted-foreground">
                  {unit.totalDeals} {unit.totalDeals === 1 ? 'deal' : 'deals'}
                </div>
              </div>
              <Badge variant="outline">{formatCurrency(unit.totalValue)}</Badge>
            </div>
          ))
        )}
      </div>

      {aggregated.length > 0 && (
        <div className="pt-4 border-t">
          <h4 className="font-semibold mb-3">Aggregate by Stage</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {aggregated.map((agg) => (
              <div key={agg.stage} className="text-center p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium">{agg.stage}</div>
                <div className="text-xl font-bold">{agg.totalDeals}</div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(agg.totalValue)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
