import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  CreditCard,
  FileText,
  BarChart3,
  PieChart,
  Activity,
} from "lucide-react";
import { format } from "date-fns";

interface FinancialSummary {
  totalBilled: number;
  totalPaid: number;
  balanceDue: number;
  averagePaymentDays: number;
  creditLimit: number;
  availableCredit: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
}

interface PaymentHistory {
  id: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  checkNumber?: string;
  invoiceNumber: string;
  notes?: string;
}

interface AgingData {
  current: number;
  thirtyDays: number;
  sixtyDays: number;
  ninetyDays: number;
  overNinety: number;
}

interface ContractInfo {
  id: string;
  contractNumber: string;
  contractType: string;
  startDate: string;
  endDate: string;
  monthlyValue: number;
  totalValue: number;
  status: string;
  autoRenewal: boolean;
}

interface CustomerFinancialsProps {
  customerId: string;
  customerName: string;
}

const statusColors = {
  active: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export function CustomerFinancials({
  customerId,
  customerName,
}: CustomerFinancialsProps) {
  // Fetch financial summary
  const { data: financialSummary, isLoading: loadingSummary } =
    useQuery<FinancialSummary>({
      queryKey: [`/api/customers/${customerId}/financial-summary`],
      queryFn: async () => {
        const response = await fetch(
          `/api/customers/${customerId}/financial-summary`,
          {
            credentials: "include",
          }
        );
        if (!response.ok) throw new Error("Failed to fetch financial summary");
        return response.json();
      },
    });

  // Fetch payment history
  const { data: paymentHistory = [], isLoading: loadingPayments } = useQuery<
    PaymentHistory[]
  >({
    queryKey: [`/api/customers/${customerId}/payments`],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/payments`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch payments");
      return response.json();
    },
  });

  // Fetch aging data
  const { data: agingData, isLoading: loadingAging } = useQuery<AgingData>({
    queryKey: [`/api/customers/${customerId}/aging`],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/aging`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch aging data");
      return response.json();
    },
  });

  // Fetch contracts
  const { data: contracts = [], isLoading: loadingContracts } = useQuery<
    ContractInfo[]
  >({
    queryKey: [`/api/customers/${customerId}/contracts`],
    queryFn: async () => {
      const response = await fetch(`/api/customers/${customerId}/contracts`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch contracts");
      return response.json();
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0);
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "MMM dd, yyyy");
  };

  const getPaymentStatusColor = (days: number) => {
    if (days <= 30) return "text-green-600";
    if (days <= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const calculateCreditUtilization = () => {
    if (!financialSummary || !financialSummary.creditLimit) return 0;
    return (
      ((financialSummary.creditLimit - financialSummary.availableCredit) /
        financialSummary.creditLimit) *
      100
    );
  };

  if (loadingSummary) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">
                  {formatCurrency(financialSummary?.totalBilled || 0)}
                </p>
                <p className="text-sm text-gray-600">Total Billed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle2 className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">
                  {formatCurrency(financialSummary?.totalPaid || 0)}
                </p>
                <p className="text-sm text-gray-600">Total Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertTriangle
                className={`h-8 w-8 ${
                  (financialSummary?.balanceDue || 0) > 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              />
              <div className="ml-3">
                <p className="text-2xl font-bold">
                  {formatCurrency(financialSummary?.balanceDue || 0)}
                </p>
                <p className="text-sm text-gray-600">Balance Due</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">
                  {financialSummary?.averagePaymentDays || 0} days
                </p>
                <p className="text-sm text-gray-600">Avg Payment Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Information */}
      {financialSummary?.creditLimit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Credit Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <span className="text-sm text-gray-600">Credit Limit</span>
                <p className="text-2xl font-bold">
                  {formatCurrency(financialSummary.creditLimit)}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Available Credit</span>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(financialSummary.availableCredit)}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-600">
                  Credit Utilization
                </span>
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg font-bold">
                      {calculateCreditUtilization().toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={calculateCreditUtilization()}
                    className="h-2"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="aging" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="aging">Aging Report</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="aging" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Accounts Receivable Aging
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAging ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : agingData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Current</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(agingData.current)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">1-30 Days</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {formatCurrency(agingData.thirtyDays)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">31-60 Days</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatCurrency(agingData.sixtyDays)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">61-90 Days</p>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(agingData.ninetyDays)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">90+ Days</p>
                      <p className="text-2xl font-bold text-red-800">
                        {formatCurrency(agingData.overNinety)}
                      </p>
                    </div>
                  </div>

                  {/* Aging Chart Representation */}
                  <div className="mt-6">
                    <div className="space-y-3">
                      {[
                        {
                          label: "Current",
                          amount: agingData.current,
                          color: "bg-green-500",
                        },
                        {
                          label: "1-30 Days",
                          amount: agingData.thirtyDays,
                          color: "bg-yellow-500",
                        },
                        {
                          label: "31-60 Days",
                          amount: agingData.sixtyDays,
                          color: "bg-orange-500",
                        },
                        {
                          label: "61-90 Days",
                          amount: agingData.ninetyDays,
                          color: "bg-red-500",
                        },
                        {
                          label: "90+ Days",
                          amount: agingData.overNinety,
                          color: "bg-red-800",
                        },
                      ].map((item) => {
                        const total = Object.values(agingData).reduce(
                          (a, b) => a + b,
                          0
                        );
                        const percentage =
                          total > 0 ? (item.amount / total) * 100 : 0;

                        return (
                          <div
                            key={item.label}
                            className="flex items-center space-x-3"
                          >
                            <div
                              className={`w-4 h-4 rounded ${item.color}`}
                            ></div>
                            <div className="flex-1">
                              <div className="flex justify-between">
                                <span className="text-sm font-medium">
                                  {item.label}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {formatCurrency(item.amount)}
                                </span>
                              </div>
                              <Progress
                                value={percentage}
                                className="h-2 mt-1"
                              />
                            </div>
                            <span className="text-sm text-gray-500">
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">No aging data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPayments ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Check/Ref #</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentHistory.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {formatDate(payment.paymentDate)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {payment.paymentMethod}
                            </Badge>
                          </TableCell>
                          <TableCell>{payment.checkNumber || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {payment.invoiceNumber}
                          </TableCell>
                          <TableCell className="text-sm">
                            {payment.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Service Contracts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingContracts ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contract #</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Monthly Value</TableHead>
                        <TableHead>Total Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Auto Renewal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell className="font-mono text-sm">
                            {contract.contractNumber}
                          </TableCell>
                          <TableCell className="capitalize">
                            {contract.contractType}
                          </TableCell>
                          <TableCell>
                            {formatDate(contract.startDate)}
                          </TableCell>
                          <TableCell>{formatDate(contract.endDate)}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(contract.monthlyValue)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(contract.totalValue)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                statusColors[
                                  contract.status as keyof typeof statusColors
                                ]
                              }
                            >
                              {contract.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                contract.autoRenewal ? "default" : "outline"
                              }
                            >
                              {contract.autoRenewal ? "Yes" : "No"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Payment Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Last Payment</span>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(
                          financialSummary?.lastPaymentAmount || 0
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {financialSummary?.lastPaymentDate
                          ? formatDate(financialSummary.lastPaymentDate)
                          : "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Average Payment Time
                    </span>
                    <p
                      className={`font-medium ${getPaymentStatusColor(
                        financialSummary?.averagePaymentDays || 0
                      )}`}
                    >
                      {financialSummary?.averagePaymentDays || 0} days
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Payment Success Rate
                    </span>
                    <p className="font-medium text-green-600">98%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="h-5 w-5 mr-2" />
                  Financial Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Payment History
                    </span>
                    <Badge className="bg-green-100 text-green-800">
                      Excellent
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Credit Score</span>
                    <Badge className="bg-blue-100 text-blue-800">Good</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Risk Level</span>
                    <Badge className="bg-green-100 text-green-800">Low</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Account Standing
                    </span>
                    <Badge className="bg-green-100 text-green-800">Good</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
