import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  ArrowRight,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { usePricingVisibility } from "@/hooks/usePricingVisibility";

interface MarginReportSummary {
  count: number;
  report: Array<{
    quoteNumber: string;
    quoteDate: string;
    salesRep: string;
    totalMargin: number;
    marginPercentage: number;
    totalCustomerPrice: number;
  }>;
}

interface ApprovalRequest {
  approval: {
    id: string;
    requestedDate: string;
    discountPercentage: string;
    requestedPrice: string;
  };
  requestedBy: {
    firstName: string;
    lastName: string;
  };
}

export function PendingApprovalsWidget() {
  const { data: visibility } = usePricingVisibility();
  const { data: approvals = [] } = useQuery<ApprovalRequest[]>({
    queryKey: ['/api/pricing/approvals/pending'],
    enabled: visibility?.showDealerCost === true, // Only for managers
  });

  if (!visibility?.showDealerCost) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return "Just now";
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            <CardTitle>Pending Price Approvals</CardTitle>
          </div>
          {approvals.length > 0 && (
            <Badge variant="destructive">{approvals.length}</Badge>
          )}
        </div>
        <CardDescription>
          Price change requests awaiting your approval
        </CardDescription>
      </CardHeader>
      <CardContent>
        {approvals.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No pending approvals</p>
          </div>
        ) : (
          <div className="space-y-3">
            {approvals.slice(0, 5).map((item) => (
              <div
                key={item.approval.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {item.requestedBy.firstName} {item.requestedBy.lastName}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {parseFloat(item.approval.discountPercentage).toFixed(1)}% off
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.approval.requestedPrice)}
                    </p>
                    <span className="text-xs text-muted-foreground">•</span>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.approval.requestedDate)}
                    </p>
                  </div>
                </div>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </div>
            ))}
            {approvals.length > 5 && (
              <p className="text-xs text-center text-muted-foreground">
                +{approvals.length - 5} more approvals pending
              </p>
            )}
            <Separator />
            <Link href="/pricing/approvals">
              <Button variant="outline" className="w-full" size="sm">
                <span>Review All Approvals</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MarginTrendsWidget() {
  const { data: visibility } = usePricingVisibility();
  const { data: reportData } = useQuery<MarginReportSummary>({
    queryKey: ['/api/pricing/margin-report', {}],
    enabled: visibility?.showDealerCost === true,
  });

  if (!visibility?.showDealerCost) return null;

  const summary = reportData?.report.reduce(
    (acc, item) => ({
      totalRevenue: acc.totalRevenue + item.totalCustomerPrice,
      totalMargin: acc.totalMargin + item.totalMargin,
      quoteCount: acc.quoteCount + 1,
      margins: [...acc.margins, item.marginPercentage],
    }),
    { totalRevenue: 0, totalMargin: 0, quoteCount: 0, margins: [] as number[] }
  ) || { totalRevenue: 0, totalMargin: 0, quoteCount: 0, margins: [] };

  const avgMargin = summary.margins.length > 0
    ? summary.margins.reduce((a, b) => a + b, 0) / summary.margins.length
    : 0;

  const lowMarginQuotes = summary.margins.filter(m => m < 10).length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getMarginColor = (percentage: number) => {
    if (percentage >= 20) return "text-green-600";
    if (percentage >= 10) return "text-blue-600";
    if (percentage >= 5) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-500" />
          <CardTitle>Margin Trends</CardTitle>
        </div>
        <CardDescription>
          Last {summary.quoteCount} quotes performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Margin</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.totalMargin)}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Avg Margin %</p>
              <p className={`text-xl font-bold ${getMarginColor(avgMargin)}`}>
                {avgMargin.toFixed(1)}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Low Margin Quotes</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold">{lowMarginQuotes}</p>
                {lowMarginQuotes > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <10%
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <Link href="/pricing/margin-report">
            <Button variant="outline" className="w-full" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              View Full Report
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function QuickPricingStatsWidget() {
  const { data: visibility } = usePricingVisibility();
  const { data: reportData } = useQuery<MarginReportSummary>({
    queryKey: ['/api/pricing/margin-report', {}],
    enabled: visibility?.showDealerCost === true,
  });

  const { data: approvals = [] } = useQuery<ApprovalRequest[]>({
    queryKey: ['/api/pricing/approvals/pending'],
    enabled: visibility?.showDealerCost === true,
  });

  if (!visibility?.showDealerCost) return null;

  const quoteCount = reportData?.count || 0;
  const pendingCount = approvals.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Active Quotes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-2xl font-bold">{quoteCount}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Pending Approvals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-500" />
            <p className="text-2xl font-bold">{pendingCount}</p>
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-auto">Action Needed</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Pricing Controls</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/pricing/settings">
            <Button variant="outline" className="w-full" size="sm">
              <DollarSign className="h-4 w-4 mr-2" />
              Manage Settings
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

// Combined widget for easy dashboard integration
export function PricingDashboard() {
  const { data: visibility } = usePricingVisibility();

  if (!visibility?.showDealerCost) {
    return null; // Don't show pricing dashboard to non-managers
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Pricing Management</h2>
        <Link href="/pricing/settings">
          <Button variant="outline" size="sm">
            <DollarSign className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </Link>
      </div>

      <QuickPricingStatsWidget />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PendingApprovalsWidget />
        <MarginTrendsWidget />
      </div>
    </div>
  );
}
