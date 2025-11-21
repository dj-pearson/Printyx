import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Filter,
  TrendingUp,
  DollarSign,
  Calendar,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import MainLayout from "@/components/layout/main-layout";
import { usePricingVisibility } from "@/hooks/usePricingVisibility";

interface LineItem {
  productName: string;
  productCode: string;
  quantity: string;
  unitDealerCost: number;
  unitRepCost: number;
  unitCustomerPrice: number;
  totalDealerCost: number;
  totalRepCost: number;
  totalCustomerPrice: number;
  lineMargin: number;
  lineMarginPercentage: number;
  discountAmount: number;
  discountPercentage: number;
}

interface MarginReportItem {
  quoteNumber: string;
  quoteDate: string;
  quoteStatus: string;
  salesRep: string;
  salesRepEmail: string;
  totalDealerCost: number;
  totalRepCost: number;
  totalCustomerPrice: number;
  totalMargin: number;
  marginPercentage: number;
  totalRepMargin: number;
  repMarginPercentage: number;
  lineItems: LineItem[];
}

export default function MarginAnalysisReport() {
  const { data: visibility } = usePricingVisibility();
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    salesRepId: "",
    quoteId: "",
  });
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set());

  const { data: reportData, isLoading } = useQuery<{
    count: number;
    report: MarginReportItem[];
  }>({
    queryKey: ['/api/pricing/margin-report', filters],
    enabled: visibility?.showDealerCost === true, // Only managers can see this report
  });

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getMarginColor = (percentage: number): string => {
    if (percentage >= 20) return "text-green-600";
    if (percentage >= 10) return "text-blue-600";
    if (percentage >= 5) return "text-orange-600";
    return "text-red-600";
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      pending_approval: { variant: "outline", label: "Pending Approval" },
      approved: { variant: "default", label: "Approved" },
      sent: { variant: "default", label: "Sent" },
      accepted: { variant: "default", label: "Accepted" },
      rejected: { variant: "destructive", label: "Rejected" },
      expired: { variant: "secondary", label: "Expired" },
    };

    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const toggleQuoteExpansion = (quoteNumber: string) => {
    const newExpanded = new Set(expandedQuotes);
    if (newExpanded.has(quoteNumber)) {
      newExpanded.delete(quoteNumber);
    } else {
      newExpanded.add(quoteNumber);
    }
    setExpandedQuotes(newExpanded);
  };

  const handleExport = async () => {
    const queryParams = new URLSearchParams();
    if (filters.startDate) queryParams.append("startDate", filters.startDate);
    if (filters.endDate) queryParams.append("endDate", filters.endDate);
    if (filters.salesRepId) queryParams.append("salesRepId", filters.salesRepId);

    const response = await fetch(`/api/pricing/margin-report/export?${queryParams.toString()}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `margin-report-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Calculate summary statistics
  const summary = reportData?.report.reduce(
    (acc, item) => ({
      totalRevenue: acc.totalRevenue + item.totalCustomerPrice,
      totalMargin: acc.totalMargin + item.totalMargin,
      quoteCount: acc.quoteCount + 1,
    }),
    { totalRevenue: 0, totalMargin: 0, quoteCount: 0 }
  ) || { totalRevenue: 0, totalMargin: 0, quoteCount: 0 };

  const avgMarginPercentage =
    summary.totalRevenue > 0 ? (summary.totalMargin / (summary.totalRevenue - summary.totalMargin)) * 100 : 0;

  if (!visibility?.showDealerCost) {
    return (
      <MainLayout title="Margin Analysis Report" description="Sales manager margin analysis">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              You do not have permission to view this report. Only managers and above can access margin analysis.
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Margin Analysis Report"
      description="Analyze profitability across quotes and sales reps"
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Quotes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-2xl font-bold">{summary.quoteCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Margin</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-2xl font-bold">{formatCurrency(summary.totalMargin)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Margin %</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className={`text-2xl font-bold ${getMarginColor(avgMarginPercentage)}`}>
                  {avgMarginPercentage.toFixed(1)}%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <CardTitle>Filters</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quoteId">Quote Number</Label>
                <Input
                  id="quoteId"
                  placeholder="Q-2025-1234"
                  value={filters.quoteId}
                  onChange={(e) => setFilters({ ...filters, quoteId: e.target.value })}
                />
              </div>

              <div className="flex items-end">
                <Button onClick={handleExport} variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Table */}
        <Card>
          <CardHeader>
            <CardTitle>Quote Margin Details</CardTitle>
            <CardDescription>
              Click on a quote to expand and see line-by-line margin breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">Loading report...</p>
              </div>
            ) : !reportData?.report.length ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">No quotes found matching the filters.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reportData.report.map((quote) => (
                  <Collapsible
                    key={quote.quoteNumber}
                    open={expandedQuotes.has(quote.quoteNumber)}
                    onOpenChange={() => toggleQuoteExpansion(quote.quoteNumber)}
                  >
                    <div className="border rounded-lg">
                      <CollapsibleTrigger className="w-full">
                        <div className="p-4 hover:bg-muted/50 cursor-pointer">
                          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            <div className="flex items-center gap-2">
                              {expandedQuotes.has(quote.quoteNumber) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              <div className="text-left">
                                <p className="font-medium">{quote.quoteNumber}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(quote.quoteDate)}
                                </p>
                              </div>
                            </div>

                            <div>
                              <p className="text-sm text-muted-foreground">Sales Rep</p>
                              <p className="text-sm font-medium">{quote.salesRep}</p>
                            </div>

                            <div>
                              <p className="text-sm text-muted-foreground">Status</p>
                              {getStatusBadge(quote.quoteStatus)}
                            </div>

                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Total Price</p>
                              <p className="text-sm font-bold">{formatCurrency(quote.totalCustomerPrice)}</p>
                            </div>

                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Margin $</p>
                              <p className="text-sm font-bold text-green-600">
                                {formatCurrency(quote.totalMargin)}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Margin %</p>
                              <p className={`text-sm font-bold ${getMarginColor(quote.marginPercentage)}`}>
                                {quote.marginPercentage.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <Separator />
                        <div className="p-4 bg-muted/30">
                          <h4 className="text-sm font-semibold mb-3">Line Items</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Dealer Cost</TableHead>
                                <TableHead className="text-right">Rep Cost</TableHead>
                                <TableHead className="text-right">Customer Price</TableHead>
                                <TableHead className="text-right">Margin $</TableHead>
                                <TableHead className="text-right">Margin %</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {quote.lineItems.map((item, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{item.productName}</p>
                                      <p className="text-xs text-muted-foreground">{item.productCode}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">{item.quantity}</TableCell>
                                  <TableCell className="text-right text-blue-600">
                                    {formatCurrency(item.totalDealerCost)}
                                  </TableCell>
                                  <TableCell className="text-right text-purple-600">
                                    {formatCurrency(item.totalRepCost)}
                                  </TableCell>
                                  <TableCell className="text-right font-bold">
                                    {formatCurrency(item.totalCustomerPrice)}
                                  </TableCell>
                                  <TableCell className="text-right text-green-600 font-medium">
                                    {formatCurrency(item.lineMargin)}
                                  </TableCell>
                                  <TableCell className={`text-right font-bold ${getMarginColor(item.lineMarginPercentage)}`}>
                                    {item.lineMarginPercentage.toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
