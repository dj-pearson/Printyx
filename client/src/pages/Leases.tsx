import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Plus,
  Search,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
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
  paymentsCompleted: number;
  totalPaid: string;
  paymentHealth: string;
};

export default function Leases() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: leases = [], isLoading } = useQuery<Lease[]>({
    queryKey: ['/api/leases'],
    queryFn: async () => {
      const response = await apiRequest('/api/leases', 'GET');
      return (response || []).map((lease: any) => ({
        ...lease,
        id: lease.id,
        leaseNumber: lease.lease_number || lease.leaseNumber || '',
        leaseName: lease.lease_name || lease.leaseName || '',
        customerId: lease.customer_id || lease.customerId || '',
        equipmentId: lease.equipment_id || lease.equipmentId || '',
        startDate: lease.start_date || lease.startDate || '',
        endDate: lease.end_date || lease.endDate || '',
        signedDate: lease.signed_date || lease.signedDate || null,
        createdAt: lease.created_at || lease.createdAt || '',
        updatedAt: lease.updated_at || lease.updatedAt || '',
      }));
    },
  });

  const filteredLeases = leases.filter((lease) => {
    const matchesSearch =
      searchQuery === '' ||
      lease.leaseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lease.leaseNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || lease.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const activeLeases = leases.filter((l) => l.status === 'active');
  const pendingRenewalLeases = leases.filter((l) => l.status === 'pending_renewal');
  const expiredLeases = leases.filter((l) => l.status === 'expired');

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
    return (
      <Badge variant={config.variant} data-testid={`badge-status-${status}`}>
        {config.label}
      </Badge>
    );
  };

  const getLeaseTypeBadge = (leaseType: string) => {
    const typeLabels: Record<string, string> = {
      fmv: 'FMV',
      dollar_buyout: '$1 Buyout',
      ten_percent: '10% Buyout',
      trac: 'TRAC',
      operating: 'Operating',
      capital: 'Capital',
    };

    return (
      <Badge variant="outline" data-testid={`badge-type-${leaseType}`}>
        {typeLabels[leaseType] || leaseType}
      </Badge>
    );
  };

  const getPaymentHealthIcon = (health: string) => {
    if (health === 'good') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (health === 'warning') return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    return <AlertCircle className="h-4 w-4 text-red-600" />;
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Lease Management
          </h1>
          <p className="text-muted-foreground">Manage equipment leases, payments, and renewals</p>
        </div>
        <Link href="/leases/new">
          <Button data-testid="button-create-lease">
            <Plus className="h-4 w-4 mr-2" />
            New Lease
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-stat-active">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Leases</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLeases.length}</div>
            <p className="text-xs text-muted-foreground">
              Total:{' '}
              {formatCurrency(
                activeLeases.reduce((sum, l) => sum + parseFloat(l.totalAmount), 0).toString(),
              )}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-pending-renewal">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Renewal</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRenewalLeases.length}</div>
            <p className="text-xs text-muted-foreground">Require action</p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-monthly-revenue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                activeLeases.reduce((sum, l) => sum + parseFloat(l.monthlyPayment), 0).toString(),
              )}
            </div>
            <p className="text-xs text-muted-foreground">From active leases</p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-expired">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired Leases</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiredLeases.length}</div>
            <p className="text-xs text-muted-foreground">Need disposition</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>All Leases</CardTitle>
          <CardDescription>View and manage all equipment leases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by lease name or number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-leases"
              />
            </div>
          </div>

          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList data-testid="tabs-status-filter">
              <TabsTrigger value="all" data-testid="tab-all">
                All ({leases.length})
              </TabsTrigger>
              <TabsTrigger value="active" data-testid="tab-active">
                Active ({activeLeases.length})
              </TabsTrigger>
              <TabsTrigger value="pending_renewal" data-testid="tab-pending-renewal">
                Pending Renewal ({pendingRenewalLeases.length})
              </TabsTrigger>
              <TabsTrigger value="expired" data-testid="tab-expired">
                Expired ({expiredLeases.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={statusFilter} className="mt-4">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-loading">
                  Loading leases...
                </div>
              ) : filteredLeases.length === 0 ? (
                <div
                  className="text-center py-8 text-muted-foreground"
                  data-testid="text-no-leases"
                >
                  No leases found
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lease</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Term</TableHead>
                        <TableHead>Monthly Payment</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Health</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeases.map((lease) => (
                        <TableRow key={lease.id} data-testid={`row-lease-${lease.id}`}>
                          <TableCell>
                            <div
                              className="font-medium"
                              data-testid={`text-lease-name-${lease.id}`}
                            >
                              {lease.leaseName}
                            </div>
                            <div
                              className="text-sm text-muted-foreground"
                              data-testid={`text-lease-number-${lease.id}`}
                            >
                              {lease.leaseNumber}
                            </div>
                          </TableCell>
                          <TableCell>{getLeaseTypeBadge(lease.leaseType)}</TableCell>
                          <TableCell>{getStatusBadge(lease.status)}</TableCell>
                          <TableCell data-testid={`text-term-${lease.id}`}>
                            {lease.term} months
                          </TableCell>
                          <TableCell data-testid={`text-payment-${lease.id}`}>
                            {formatCurrency(lease.monthlyPayment)}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm" data-testid={`text-progress-${lease.id}`}>
                                {lease.paymentsCompleted} / {lease.term} payments
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(lease.totalPaid)} /{' '}
                                {formatCurrency(lease.totalAmount)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div
                              className="flex items-center gap-2"
                              data-testid={`health-${lease.id}`}
                            >
                              {getPaymentHealthIcon(lease.paymentHealth)}
                              <span className="text-sm capitalize">{lease.paymentHealth}</span>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-end-date-${lease.id}`}>
                            {formatDate(lease.endDate)}
                          </TableCell>
                          <TableCell>
                            <Link href={`/leases/${lease.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-view-${lease.id}`}
                              >
                                View
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
