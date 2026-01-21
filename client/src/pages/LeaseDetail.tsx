import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute, useLocation, Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  FileText,
  RotateCcw,
  Package,
  AlertCircle,
  CheckCircle,
  Edit,
} from 'lucide-react';

type Lease = {
  id: string;
  leaseNumber: string;
  leaseName: string;
  customerId: string;
  status: string;
  leaseType: string;
  monthlyPayment: string;
  totalAmount: string;
  term: number;
  startDate: string;
  endDate: string;
  firstPaymentDate: string;
  lastPaymentDate: string;
  paymentsCompleted: number;
  totalPaid: string;
  paymentHealth: string;
  residualValue?: string;
  buyoutAmount?: string;
  autoPayEnabled: boolean;
  notes?: string;
};

type LeasePayment = {
  id: string;
  paymentNumber: number;
  scheduledDate: string;
  scheduledAmount: string;
  status: string;
  paidDate?: string;
  paidAmount?: string;
  transactionId?: string;
};

export default function LeaseDetail() {
  const [, params] = useRoute('/leases/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const leaseId = params?.id;

  const { data: lease, isLoading } = useQuery<Lease>({
    queryKey: [`/api/leases/${leaseId}`],
    enabled: !!leaseId,
  });

  const { data: payments = [] } = useQuery<LeasePayment[]>({
    queryKey: [`/api/leases/${leaseId}/payments`],
    enabled: !!leaseId,
  });

  const processPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      return await apiRequest(`/api/lease-payments/${paymentId}/process`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Payment Processed',
        description: 'Payment has been successfully processed',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/leases/${leaseId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/leases/${leaseId}/payments`] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to process payment',
        variant: 'destructive',
      });
    },
  });

  const initiateRenewalMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/leases/${leaseId}/initiate-renewal`, {
        method: 'POST',
        body: JSON.stringify({
          renewalTerm: lease?.term,
          renewalMonthlyPayment: lease?.monthlyPayment,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Renewal Initiated',
        description: 'Lease renewal has been initiated',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/leases/${leaseId}`] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to initiate renewal',
        variant: 'destructive',
      });
    },
  });

  if (isLoading || !lease) {
    return (
      <div className="container mx-auto py-6" data-testid="text-loading">
        <div className="text-center">Loading lease details...</div>
      </div>
    );
  }

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
    > = {
      active: { label: 'Active', variant: 'default' },
      pending: { label: 'Pending', variant: 'secondary' },
      pending_renewal: { label: 'Pending Renewal', variant: 'outline' },
      renewed: { label: 'Renewed', variant: 'default' },
      expired: { label: 'Expired', variant: 'destructive' },
      terminated: { label: 'Terminated', variant: 'destructive' },
      defaulted: { label: 'Defaulted', variant: 'destructive' },
    };

    const config = statusConfig[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPaymentStatusBadge = (status: string) => {
    if (status === 'completed') {
      return (
        <Badge variant="default">
          <CheckCircle className="h-3 w-3 mr-1" /> Paid
        </Badge>
      );
    }
    if (status === 'scheduled') {
      return <Badge variant="outline">Scheduled</Badge>;
    }
    return (
      <Badge variant="destructive">
        <AlertCircle className="h-3 w-3 mr-1" /> {status}
      </Badge>
    );
  };

  const completedPayments = payments.filter((p) => p.status === 'completed');
  const upcomingPayments = payments.filter((p) => p.status === 'scheduled');
  const progressPercentage = (lease.paymentsCompleted / lease.term) * 100;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/leases">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold" data-testid="text-lease-name">
                {lease.leaseName}
              </h1>
              {getStatusBadge(lease.status)}
            </div>
            <p className="text-muted-foreground" data-testid="text-lease-number">
              {lease.leaseNumber}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/leases/${lease.id}/edit`}>
            <Button variant="outline" data-testid="button-edit">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          {lease.status === 'active' && (
            <Button
              onClick={() => initiateRenewalMutation.mutate()}
              disabled={initiateRenewalMutation.isPending}
              data-testid="button-initiate-renewal"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Initiate Renewal
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-monthly-payment">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Payment</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(lease.monthlyPayment)}</div>
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(lease.totalAmount)}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-term">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Term</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lease.term} months</div>
            <p className="text-xs text-muted-foreground">
              {formatDate(lease.startDate)} - {formatDate(lease.endDate)}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-progress">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lease.paymentsCompleted} / {lease.term}
            </div>
            <div className="w-full bg-secondary rounded-full h-2 mt-2">
              <div
                className="bg-primary h-2 rounded-full"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-paid">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(lease.totalPaid)}</div>
            <p className="text-xs text-muted-foreground">
              {((parseFloat(lease.totalPaid) / parseFloat(lease.totalAmount)) * 100).toFixed(1)}% of
              total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" data-testid="tabs-lease-detail">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            Overview
          </TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">
            Payments ({payments.length})
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lease Details</CardTitle>
              <CardDescription>Financial and contract information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Lease Type</div>
                  <div className="mt-1">{lease.leaseType.toUpperCase()}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Payment Health</div>
                  <div className="mt-1 capitalize">{lease.paymentHealth}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">First Payment</div>
                  <div className="mt-1">{formatDate(lease.firstPaymentDate)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Last Payment</div>
                  <div className="mt-1">{formatDate(lease.lastPaymentDate)}</div>
                </div>
                {lease.residualValue && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Residual Value</div>
                    <div className="mt-1">{formatCurrency(lease.residualValue)}</div>
                  </div>
                )}
                {lease.buyoutAmount && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Buyout Amount</div>
                    <div className="mt-1">{formatCurrency(lease.buyoutAmount)}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Auto-Pay</div>
                  <div className="mt-1">{lease.autoPayEnabled ? 'Enabled' : 'Disabled'}</div>
                </div>
              </div>

              {lease.notes && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">Notes</div>
                    <p className="text-sm">{lease.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Schedule</CardTitle>
              <CardDescription>
                {completedPayments.length} completed, {upcomingPayments.length} upcoming
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment #</TableHead>
                      <TableHead>Scheduled Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid Date</TableHead>
                      <TableHead>Transaction</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No payments found
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((payment) => (
                        <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                          <TableCell className="font-medium">#{payment.paymentNumber}</TableCell>
                          <TableCell>{formatDate(payment.scheduledDate)}</TableCell>
                          <TableCell>{formatCurrency(payment.scheduledAmount)}</TableCell>
                          <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                          <TableCell>
                            {payment.paidDate ? formatDate(payment.paidDate) : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {payment.transactionId || '-'}
                          </TableCell>
                          <TableCell>
                            {payment.status === 'scheduled' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => processPaymentMutation.mutate(payment.id)}
                                disabled={processPaymentMutation.isPending}
                                data-testid={`button-process-${payment.id}`}
                              >
                                Process
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Contracts, agreements, and related documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No documents uploaded</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
