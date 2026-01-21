import { Badge } from '@/components/ui/badge';

interface LocationPipeline {
  locationId: string;
  locationName: string;
  stage: string;
  dealCount: number;
  totalValue: number;
}

export default function LocationPipelineGrid({ pipelines, aggregated, summary }: any) {
  const formatCurrency = (value: number) =>
    value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : `$${value.toFixed(0)}`;

  const locationMap = new Map<string, Map<string, LocationPipeline>>();
  pipelines.forEach((p: LocationPipeline) => {
    if (!locationMap.has(p.locationId)) locationMap.set(p.locationId, new Map());
    locationMap.get(p.locationId)!.set(p.stage, p);
  });

  const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won'];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-xs text-muted-foreground">Locations</div>
          <div className="text-2xl font-bold">{summary?.totalLocations || 0}</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-xs text-muted-foreground">Total Pipeline</div>
          <div className="text-2xl font-bold">{formatCurrency(summary?.totalPipeline || 0)}</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-xs text-muted-foreground">Total Deals</div>
          <div className="text-2xl font-bold">{summary?.totalDeals || 0}</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-xs text-muted-foreground">Health Score</div>
          <div className="text-2xl font-bold">{summary?.healthScore?.toFixed(0) || 0}</div>
        </div>
      </div>

      {/* Location Grid */}
      <div className="space-y-4">
        {Array.from(locationMap.entries()).map(([locationId, stageMap]) => {
          const firstStage = Array.from(stageMap.values())[0];
          const totalValue = Array.from(stageMap.values()).reduce(
            (sum, p) => sum + p.totalValue,
            0,
          );
          return (
            <div key={locationId} className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">{firstStage.locationName}</h4>
                <Badge variant="outline">{formatCurrency(totalValue)}</Badge>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {stages.map((stage) => {
                  const data = stageMap.get(stage);
                  return (
                    <div key={stage} className="text-center p-2 bg-background rounded">
                      <div className="text-xs text-muted-foreground">{stage}</div>
                      <div className="text-lg font-bold">{data?.dealCount || 0}</div>
                      <div className="text-xs">{formatCurrency(data?.totalValue || 0)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Aggregated Summary */}
      {aggregated && aggregated.length > 0 && (
        <div className="pt-4 border-t">
          <h4 className="font-semibold mb-3">Aggregate by Stage</h4>
          <div className="grid grid-cols-5 gap-4">
            {aggregated.map((agg: any) => (
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
