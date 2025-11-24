import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface RevenueForecastChartProps {
  data: any[];
}

export function RevenueForecastChart({ data }: RevenueForecastChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        No forecast data available
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map((item) => ({
    period: item.period,
    forecasted: Math.round(item.forecastedRevenue),
    upper: Math.round(item.upperBound),
    lower: Math.round(item.lowerBound),
    confidence: item.confidence,
  }));

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-semibold mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Forecasted:</span>
              <span className="font-medium">{formatCurrency(payload[0].value)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Upper Bound:</span>
              <span className="font-medium text-green-600">{formatCurrency(payload[1].value)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Lower Bound:</span>
              <span className="font-medium text-orange-600">{formatCurrency(payload[2].value)}</span>
            </div>
            {payload[0].payload.confidence && (
              <div className="flex justify-between gap-4 pt-1 border-t">
                <span className="text-muted-foreground">Confidence:</span>
                <span className="font-medium">{payload[0].payload.confidence}%</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            tickFormatter={formatCurrency}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: "20px" }}
            iconType="line"
            formatter={(value) => {
              const labels: Record<string, string> = {
                forecasted: "Forecasted Revenue",
                upper: "Upper Bound (95%)",
                lower: "Lower Bound (95%)",
              };
              return labels[value] || value;
            }}
          />

          {/* Confidence interval area */}
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill="#22c55e"
            fillOpacity={0.1}
            strokeWidth={0}
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill="#f59e0b"
            fillOpacity={0.1}
            strokeWidth={0}
          />

          {/* Forecasted line */}
          <Line
            type="monotone"
            dataKey="forecasted"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: "#3b82f6", strokeWidth: 2, r: 5 }}
            activeDot={{ r: 7 }}
          />

          {/* Bound lines */}
          <Line
            type="monotone"
            dataKey="upper"
            stroke="#22c55e"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="lower"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
