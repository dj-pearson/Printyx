import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Award, Star } from "lucide-react";

interface CustomerLifetimeValue {
  customerId: string;
  customerName: string;
  historicalValue: number;
  predictedLifetimeValue: number;
  averageMonthlyRevenue: number;
  customerAge: number;
  retentionProbability: number;
}

interface CLVRankingsTableProps {
  data: CustomerLifetimeValue[];
}

export function CLVRankingsTable({ data }: CLVRankingsTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        No customer lifetime value data available
      </div>
    );
  }

  const getRetentionBadge = (probability: number) => {
    if (probability >= 0.9) {
      return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    } else if (probability >= 0.75) {
      return <Badge className="bg-blue-100 text-blue-800">Good</Badge>;
    } else if (probability >= 0.5) {
      return <Badge className="bg-amber-100 text-amber-800">Fair</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800">At Risk</Badge>;
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Award className="h-4 w-4 text-yellow-500" />;
    if (index === 1) return <Award className="h-4 w-4 text-gray-400" />;
    if (index === 2) return <Award className="h-4 w-4 text-amber-600" />;
    if (index < 10) return <Star className="h-4 w-4 text-blue-500" />;
    return null;
  };

  // Show top 20 customers
  const topCustomers = data.slice(0, 20);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Rank</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Historical Value</TableHead>
            <TableHead className="text-right">Predicted CLV</TableHead>
            <TableHead className="text-right">Avg Monthly</TableHead>
            <TableHead className="text-center">Customer Age</TableHead>
            <TableHead>Retention</TableHead>
            <TableHead className="text-center">Growth</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {topCustomers.map((customer, index) => {
            const growthFactor = customer.predictedLifetimeValue / (customer.historicalValue || 1);
            const growthPercentage = ((growthFactor - 1) * 100).toFixed(0);

            return (
              <TableRow key={customer.customerId}>
                {/* Rank */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getRankIcon(index)}
                    <span className="font-medium">{index + 1}</span>
                  </div>
                </TableCell>

                {/* Customer Name */}
                <TableCell>
                  <div>
                    <p className="font-medium">{customer.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      ID: {customer.customerId.substring(0, 8)}
                    </p>
                  </div>
                </TableCell>

                {/* Historical Value */}
                <TableCell className="text-right">
                  <div>
                    <p className="font-medium">
                      ${customer.historicalValue.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Actual</p>
                  </div>
                </TableCell>

                {/* Predicted CLV */}
                <TableCell className="text-right">
                  <div>
                    <p className="font-bold text-primary">
                      ${customer.predictedLifetimeValue.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Predicted</p>
                  </div>
                </TableCell>

                {/* Average Monthly Revenue */}
                <TableCell className="text-right">
                  <div>
                    <p className="font-medium">
                      ${customer.averageMonthlyRevenue.toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">/month</p>
                  </div>
                </TableCell>

                {/* Customer Age */}
                <TableCell className="text-center">
                  <Badge variant="outline">
                    {customer.customerAge} {customer.customerAge === 1 ? "month" : "months"}
                  </Badge>
                </TableCell>

                {/* Retention Probability */}
                <TableCell>
                  <div className="space-y-2">
                    {getRetentionBadge(customer.retentionProbability)}
                    <div className="flex items-center gap-2">
                      <Progress
                        value={customer.retentionProbability * 100}
                        className="h-1.5 w-16"
                      />
                      <span className="text-xs text-muted-foreground">
                        {(customer.retentionProbability * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </TableCell>

                {/* Growth Potential */}
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {growthFactor > 1 ? (
                      <>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">
                          +{growthPercentage}%
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {data.length > 20 && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Showing top 20 of {data.length} customers
        </div>
      )}
    </div>
  );
}
