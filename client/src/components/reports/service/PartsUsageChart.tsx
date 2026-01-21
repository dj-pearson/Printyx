import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Package, DollarSign, TrendingUp } from 'lucide-react';

interface PartsUsage {
  date: Date;
  partNumber: string;
  partName: string;
  category: string;
  quantityUsed: number;
  unitCost: number;
  totalCost: number;
  ticketNumber: string;
  customerName: string;
  billable: boolean;
}

interface PartsUsageSummary {
  totalParts: number;
  totalCost: number;
  billableCost: number;
  nonBillableCost: number;
  topParts: Array<{ partNumber: string; partName: string; quantity: number; cost: number }>;
  costByCategory: Record<string, number>;
}

interface PartsUsageMetrics {
  costPerCall: number;
  billablePercentage: number;
  averagePartCost: number;
}

interface PartsUsageChartProps {
  parts: PartsUsage[];
  summary?: PartsUsageSummary;
  metrics?: PartsUsageMetrics;
}

const COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#22c55e',
  '#f59e0b',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#06b6d4',
];

export default function PartsUsageChart({ parts, summary, metrics }: PartsUsageChartProps) {
  // Top 10 parts by cost
  const topPartsData = useMemo(() => {
    return (
      summary?.topParts?.slice(0, 10).map((part) => ({
        name: `${part.partNumber}`,
        cost: part.cost,
        quantity: part.quantity,
      })) || []
    );
  }, [summary]);

  // Cost by category for pie chart
  const categoryData = useMemo(() => {
    if (!summary?.costByCategory) return [];
    return Object.entries(summary.costByCategory).map(([category, cost]) => ({
      name: category,
      value: cost,
    }));
  }, [summary]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="font-semibold text-sm mb-2">{payload[0].payload.name}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-xs">
              <span>Cost:</span>
              <span className="font-semibold">${entry.value.toLocaleString()}</span>
            </div>
          ))}
          {payload[0].payload.quantity && (
            <div className="flex items-center justify-between gap-4 text-xs">
              <span>Quantity:</span>
              <span className="font-semibold">{payload[0].payload.quantity}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (parts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
        <Package className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">No Parts Usage</p>
        <p className="text-sm">Parts usage will be tracked here</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Total Parts
            </span>
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {summary?.totalParts || 0}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Avg: ${metrics?.averagePartCost?.toFixed(2) || 0} per part
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-900 dark:text-green-100">
              Total Cost
            </span>
          </div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
            ${(summary?.totalCost || 0).toLocaleString()}
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            ${(summary?.billableCost || 0).toLocaleString()} billable
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
              Billable %
            </span>
          </div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {metrics?.billablePercentage?.toFixed(0) || 0}%
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            ${(summary?.nonBillableCost || 0).toLocaleString()} non-billable
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Parts Bar Chart */}
        <div>
          <h3 className="text-sm font-semibold mb-4">Top 10 Parts by Cost</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPartsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost by Category Pie Chart */}
        <div>
          <h3 className="text-sm font-semibold mb-4">Cost by Category</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: $${entry.value.toFixed(0)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Parts List */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Top Parts Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {summary?.topParts?.slice(0, 10).map((part, index) => (
            <div
              key={part.partNumber}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium text-sm">{part.partNumber}</div>
                  <div className="text-xs text-muted-foreground">{part.partName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm">${part.cost.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{part.quantity} units</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
