import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { AlertCircle, TrendingDown, Phone, Mail } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ChurnPrediction {
  customerId: string;
  customerName: string;
  churnRisk: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: Array<{
    factor: string;
    impact: number;
    description: string;
  }>;
  recommendations: string[];
  lastInvoiceDate: Date | null;
  totalRevenue: number;
}

interface ChurnRiskHeatmapProps {
  data: ChurnPrediction[];
}

export function ChurnRiskHeatmap({ data }: ChurnRiskHeatmapProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        No churn prediction data available
      </div>
    );
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-amber-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getRiskBadge = (riskLevel: string, churnRisk: number) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-amber-100 text-amber-800',
      low: 'bg-green-100 text-green-800',
    };

    return (
      <Badge className={colors[riskLevel] || ''}>
        {riskLevel.toUpperCase()} ({churnRisk}%)
      </Badge>
    );
  };

  const getImpactColor = (impact: number) => {
    if (impact > 0) return 'text-green-600';
    if (impact < -20) return 'text-red-600';
    if (impact < 0) return 'text-orange-600';
    return 'text-gray-600';
  };

  // Sort by risk level (highest first)
  const sortedData = [...data].sort((a, b) => b.churnRisk - a.churnRisk);

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-4 pr-4">
        {sortedData.map((customer) => (
          <Card key={customer.customerId} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="font-semibold">{customer.customerName}</h4>
                  {getRiskBadge(customer.riskLevel, customer.churnRisk)}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Revenue: ${customer.totalRevenue.toFixed(0)}</span>
                  {customer.lastInvoiceDate && (
                    <span>
                      Last Invoice: {new Date(customer.lastInvoiceDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Call customer</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Mail className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Send email</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Risk Factors */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Risk Factors:</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {customer.factors.map((factor, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <div
                      className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                        factor.impact > 0 ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{factor.factor}:</span>
                        <span className={`text-xs font-medium ${getImpactColor(factor.impact)}`}>
                          {factor.impact > 0 ? '+' : ''}
                          {factor.impact}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{factor.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Recommended Actions:</span>
              </div>
              <ul className="space-y-1">
                {customer.recommendations.map((recommendation, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Visual Risk Indicator */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Churn Risk Level</span>
                <span>{customer.churnRisk}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getRiskColor(customer.riskLevel)}`}
                  style={{ width: `${customer.churnRisk}%` }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
