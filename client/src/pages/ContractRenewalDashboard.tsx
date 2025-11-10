import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle, TrendingUp, DollarSign, Calendar, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface ExpiringContract {
  id: string;
  contractNumber: string;
  customerId: string;
  customerName: string;
  endDate: string;
  daysUntilExpiration: number;
  monthlyValue: number;
  annualValue: number;
  severity: 'critical' | 'high' | 'medium';
}

interface ContractAlertData {
  summary: {
    totalExpiring: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    totalAtRiskValue: number;
  };
  critical: ExpiringContract[];
  high: ExpiringContract[];
  medium: ExpiringContract[];
}

export default function ContractRenewalDashboard() {
  const [selectedTab, setSelectedTab] = useState<'critical' | 'high' | 'medium' | 'all'>('critical');
  const [creatingRenewal, setCreatingRenewal] = useState<string | null>(null);

  // Fetch contract expiration data
  const { data: alertData, isLoading, error, refetch } = useQuery<ContractAlertData>({
    queryKey: ['/api/alerts/contract-expirations'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Create renewal opportunity
  const handleCreateRenewal = async (contractId: string) => {
    setCreatingRenewal(contractId);
    try {
      const response = await fetch(`/api/alerts/contract-expirations/${contractId}/create-renewal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to create renewal opportunity');
      }

      const result = await response.json();
      console.log('Renewal opportunity created:', result);

      // Refresh the data
      refetch();
    } catch (err) {
      console.error('Error creating renewal:', err);
      alert('Failed to create renewal opportunity. Please try again.');
    } finally {
      setCreatingRenewal(null);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical - ≤30 Days</Badge>;
      case 'high':
        return <Badge variant="default" className="bg-orange-500">High - 31-90 Days</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium - 91-180 Days</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getContractsByTab = () => {
    if (!alertData) return [];

    switch (selectedTab) {
      case 'critical':
        return alertData.critical;
      case 'high':
        return alertData.high;
      case 'medium':
        return alertData.medium;
      case 'all':
        return [...alertData.critical, ...alertData.high, ...alertData.medium];
      default:
        return [];
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Contract Data</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to load contract renewal data'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const contracts = getContractsByTab();

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contract Renewals</h1>
          <p className="text-muted-foreground">
            Monitor expiring contracts and manage renewal opportunities
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expiring</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alertData?.summary.totalExpiring || 0}</div>
            <p className="text-xs text-muted-foreground">
              Contracts expiring in 180 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {alertData?.summary.criticalCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Expiring within 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At-Risk Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(alertData?.summary.totalAtRiskValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Annual recurring revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              Track renewal success
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts Banner */}
      {alertData && alertData.summary.criticalCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Urgent Action Required</AlertTitle>
          <AlertDescription>
            {alertData.summary.criticalCount} contract{alertData.summary.criticalCount !== 1 ? 's' : ''} expiring
            within 30 days. Total at-risk: {formatCurrency(
              alertData.critical.reduce((sum, c) => sum + c.annualValue, 0)
            )}/year
          </AlertDescription>
        </Alert>
      )}

      {/* Contract Tabs and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expiring Contracts</CardTitle>
          <CardDescription>
            Review and create renewal opportunities for expiring service contracts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="critical">
                Critical ({alertData?.summary.criticalCount || 0})
              </TabsTrigger>
              <TabsTrigger value="high">
                High ({alertData?.summary.highCount || 0})
              </TabsTrigger>
              <TabsTrigger value="medium">
                Medium ({alertData?.summary.mediumCount || 0})
              </TabsTrigger>
              <TabsTrigger value="all">
                All ({alertData?.summary.totalExpiring || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-6">
              {contracts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No contracts in this category</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contract #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Days Left</TableHead>
                        <TableHead className="text-right">Annual Value</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell className="font-medium">
                            {contract.contractNumber}
                          </TableCell>
                          <TableCell>{contract.customerName}</TableCell>
                          <TableCell>
                            {formatDate(new Date(contract.endDate))}
                          </TableCell>
                          <TableCell>
                            <span className={
                              contract.daysUntilExpiration <= 30
                                ? 'text-destructive font-semibold'
                                : contract.daysUntilExpiration <= 90
                                ? 'text-orange-600 font-semibold'
                                : ''
                            }>
                              {Math.round(contract.daysUntilExpiration)} days
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(contract.annualValue)}
                          </TableCell>
                          <TableCell>
                            {getSeverityBadge(contract.severity)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleCreateRenewal(contract.id)}
                              disabled={creatingRenewal === contract.id}
                            >
                              {creatingRenewal === contract.id ? (
                                <>
                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                'Create Renewal'
                              )}
                            </Button>
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
