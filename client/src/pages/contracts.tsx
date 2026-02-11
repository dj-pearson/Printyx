import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Search,
  Plus,
  FileText,
  Loader2,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { type Contract } from '@shared/schema';
import { relativeDate, expiryDisplay } from '@/lib/date-utils';
import MobileFAB from '@/components/layout/MobileFAB';
import { useToast } from '@/hooks/use-toast';

type QuickFilter = 'all' | 'active' | 'expiring' | 'expired';

export default function Contracts() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  const { data: contracts, isLoading: contractsLoading } = useQuery<Contract[]>({
    queryKey: ['/api/contracts'],
    queryFn: async () => {
      const response = await apiRequest('/api/contracts', 'GET');
      return (response || []).map((contract: any) => ({
        ...contract,
        id: contract.id,
        contractNumber: contract.contractNumber || '',
        customerId: contract.customerId || '',
        quoteId: contract.quoteId || null,
        startDate: contract.startDate || '',
        endDate: contract.endDate || '',
        signedDate: contract.signed_date || contract.signedDate || null,
        createdAt: contract.createdAt || '',
        updatedAt: contract.updatedAt || '',
      }));
    },
  });

  // Create Contract dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [quoteSearch, setQuoteSearch] = useState('');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');
  const [contractForm, setContractForm] = useState({
    customerId: '',
    startDate: '',
    endDate: '',
    monthlyBase: '',
    blackRate: '',
    colorRate: '',
    terms: '',
  });

  // Fetch active/accepted quotes for building contracts
  const { data: availableQuotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ['/api/quotes', 'contract-source', quoteSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (quoteSearch.trim()) params.append('search', quoteSearch.trim());
      params.append('status', 'accepted');
      params.append('limit', '50');
      const response = await apiRequest(`/api/quotes?${params.toString()}`);
      return (response || []).map((quote: any) => ({
        ...quote,
        id: quote.id,
        quoteNumber: quote.quoteNumber || '',
        customerId: quote.customerId || '',
      }));
    },
    enabled: isCreateOpen,
  });

  // Fetch line items when a quote is selected
  const { data: quoteLineItems = [], isLoading: lineItemsLoading } = useQuery({
    queryKey: ['/api/quotes', selectedQuoteId, 'line-items'],
    queryFn: async () => {
      if (!selectedQuoteId) return [];
      const response = await apiRequest(`/api/quotes/${selectedQuoteId}/line-items`, 'GET');
      return response || [];
    },
    enabled: !!selectedQuoteId,
  });

  useEffect(() => {
    if (!selectedQuoteId) return;
    const quote = (availableQuotes as any[]).find((q) => q.id === selectedQuoteId);
    if (quote) {
      setContractForm((prev) => ({
        ...prev,
        customerId: quote.customerId || prev.customerId,
        startDate: prev.startDate || format(new Date(), 'yyyy-MM-dd'),
        endDate:
          prev.endDate ||
          format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd'),
      }));
    }
  }, [selectedQuoteId, availableQuotes]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const quoteIdFromUrl = params.get('quoteId');
    if (quoteIdFromUrl) {
      setIsCreateOpen(true);
      setQuoteSearch(quoteIdFromUrl);
      setSelectedQuoteId(quoteIdFromUrl);
    }
  }, []);

  const createContractMutation = useMutation({
    mutationFn: async () => {
      const selectedQuote = (availableQuotes as any[]).find((q) => q.id === selectedQuoteId);
      const customerId = contractForm.customerId || selectedQuote?.customerId;
      if (!customerId) {
        throw new Error('No customer ID available.');
      }
      const payload: any = {
        customerId,
        startDate: contractForm.startDate,
        endDate: contractForm.endDate,
        monthlyBase: contractForm.monthlyBase ? Number(contractForm.monthlyBase) : undefined,
        blackRate: contractForm.blackRate ? Number(contractForm.blackRate) : undefined,
        colorRate: contractForm.colorRate ? Number(contractForm.colorRate) : undefined,
        status: 'active',
        sourceQuoteId: selectedQuoteId || undefined,
        terms: contractForm.terms,
      };
      return await apiRequest('/api/contracts', 'POST', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      setIsCreateOpen(false);
      setSelectedQuoteId('');
      toast({ title: 'Success', description: 'Contract created successfully' });
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to create contract',
        variant: 'destructive',
      });
    },
  });

  const formatCurrency = (amount?: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
      Number(amount ?? 0),
    );

  // Helper: is contract expiring within 30 days?
  const isExpiringSoon = (endDate: string) => {
    if (!endDate) return false;
    const diff = (new Date(endDate).getTime() - Date.now()) / 86_400_000;
    return diff > 0 && diff <= 30;
  };

  const isExpired = (endDate: string) => {
    if (!endDate) return false;
    return new Date(endDate).getTime() < Date.now();
  };

  // KPI stats
  const kpiStats = useMemo(() => {
    const all = contracts || [];
    return {
      total: all.length,
      active: all.filter((c) => c.status === 'active').length,
      expiringSoon: all.filter((c) => c.status === 'active' && isExpiringSoon(c.endDate)).length,
      expired: all.filter((c) => c.status === 'expired' || isExpired(c.endDate)).length,
    };
  }, [contracts]);

  // Filter contracts
  const filteredContracts = useMemo(() => {
    let list = contracts || [];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.contractNumber?.toLowerCase().includes(q) || c.customerId?.toLowerCase().includes(q),
      );
    }

    // Quick filter
    switch (quickFilter) {
      case 'active':
        list = list.filter((c) => c.status === 'active' && !isExpired(c.endDate));
        break;
      case 'expiring':
        list = list.filter((c) => isExpiringSoon(c.endDate));
        break;
      case 'expired':
        list = list.filter((c) => c.status === 'expired' || isExpired(c.endDate));
        break;
    }

    return list;
  }, [contracts, searchQuery, quickFilter]);

  const getStatusBadge = (contract: Contract) => {
    if (isExpired(contract.endDate) || contract.status === 'expired') {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (isExpiringSoon(contract.endDate)) {
      return <Badge className="bg-amber-100 text-amber-800 border-0">Expiring Soon</Badge>;
    }
    if (contract.status === 'active') {
      return <Badge className="bg-green-100 text-green-800 border-0">Active</Badge>;
    }
    if (contract.status === 'pending') {
      return <Badge className="bg-blue-100 text-blue-800 border-0">Pending</Badge>;
    }
    return (
      <Badge variant="outline" className="capitalize">
        {contract.status}
      </Badge>
    );
  };

  const quickFilterTabs: { key: QuickFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: kpiStats.total },
    { key: 'active', label: 'Active', count: kpiStats.active },
    { key: 'expiring', label: 'Expiring Soon', count: kpiStats.expiringSoon },
    { key: 'expired', label: 'Expired', count: kpiStats.expired },
  ];

  if (contractsLoading) {
    return (
      <MainLayout title="Contracts" description="Manage service contracts and billing agreements">
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-12 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Contracts" description="Manage service contracts and billing agreements">
      <div className="space-y-4 sm:space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contracts</CardTitle>
              <FileText className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.total}</div>
              <p className="text-xs text-muted-foreground">All contracts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.active}</div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.expiringSoon}</div>
              <p className="text-xs text-muted-foreground">Within 30 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expired</CardTitle>
              <Clock className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiStats.expired}</div>
              <p className="text-xs text-muted-foreground">Need renewal</p>
            </CardContent>
          </Card>
        </div>

        {/* Header + Actions */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search contracts..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="hidden sm:flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Contract
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Contract</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Quote selector */}
                <Card className="md:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-sm">Select Quote (optional)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        value={quoteSearch}
                        onChange={(e) => setQuoteSearch(e.target.value)}
                        placeholder="Search quotes..."
                        className="pl-10"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto border rounded p-2 space-y-2">
                      {quotesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      ) : (
                        (availableQuotes as any[]).map((q) => (
                          <button
                            key={q.id}
                            className={cn(
                              'w-full text-left rounded border p-2 hover:bg-muted',
                              selectedQuoteId === q.id && 'ring-2 ring-primary',
                            )}
                            onClick={() => setSelectedQuoteId(q.id)}
                          >
                            <div className="font-medium text-sm">
                              {q.quoteNumber} — {q.title}
                            </div>
                            <div className="text-xs text-gray-600">
                              {formatCurrency(q.totalAmount)}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
                {/* Contract form */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-sm">Contract Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        placeholder="Customer ID"
                        value={contractForm.customerId}
                        onChange={(e) =>
                          setContractForm((p) => ({ ...p, customerId: e.target.value }))
                        }
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          type="date"
                          value={contractForm.startDate}
                          onChange={(e) =>
                            setContractForm((p) => ({ ...p, startDate: e.target.value }))
                          }
                        />
                        <Input
                          type="date"
                          value={contractForm.endDate}
                          onChange={(e) =>
                            setContractForm((p) => ({ ...p, endDate: e.target.value }))
                          }
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Monthly Base"
                          value={contractForm.monthlyBase}
                          onChange={(e) =>
                            setContractForm((p) => ({ ...p, monthlyBase: e.target.value }))
                          }
                        />
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder="Black Rate"
                          value={contractForm.blackRate}
                          onChange={(e) =>
                            setContractForm((p) => ({ ...p, blackRate: e.target.value }))
                          }
                        />
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder="Color Rate"
                          value={contractForm.colorRate}
                          onChange={(e) =>
                            setContractForm((p) => ({ ...p, colorRate: e.target.value }))
                          }
                        />
                      </div>
                      <Input
                        placeholder="Terms & conditions"
                        value={contractForm.terms}
                        onChange={(e) => setContractForm((p) => ({ ...p, terms: e.target.value }))}
                      />
                      <div className="flex justify-end gap-2 pt-2 col-span-full">
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => createContractMutation.mutate()}
                          disabled={createContractMutation.isPending}
                        >
                          {createContractMutation.isPending && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          )}
                          Create Contract
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {quickFilterTabs.map((tab) => (
            <Button
              key={tab.key}
              variant={quickFilter === tab.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuickFilter(tab.key)}
              className="touch-manipulation"
            >
              {tab.label} ({tab.count})
            </Button>
          ))}
        </div>

        {/* Contracts List */}
        {filteredContracts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No contracts found"
            description={
              searchQuery || quickFilter !== 'all'
                ? 'No contracts match your current filters.'
                : 'Create your first service contract to get started.'
            }
            type={searchQuery || quickFilter !== 'all' ? 'search' : 'default'}
            action={{
              label: searchQuery || quickFilter !== 'all' ? 'Clear filters' : 'New Contract',
              onClick: () => {
                if (searchQuery || quickFilter !== 'all') {
                  setSearchQuery('');
                  setQuickFilter('all');
                } else {
                  setIsCreateOpen(true);
                }
              },
              icon: searchQuery || quickFilter !== 'all' ? undefined : Plus,
            }}
          />
        ) : (
          <>
            {/* Desktop Table */}
            <Card className="hidden lg:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-4 font-medium text-gray-700">CONTRACT #</th>
                        <th className="text-left p-4 font-medium text-gray-700">CUSTOMER</th>
                        <th className="text-left p-4 font-medium text-gray-700">STATUS</th>
                        <th className="text-left p-4 font-medium text-gray-700">START</th>
                        <th className="text-left p-4 font-medium text-gray-700">END</th>
                        <th className="text-left p-4 font-medium text-gray-700">MONTHLY BASE</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContracts.map((contract: Contract) => {
                        const expiry = expiryDisplay(contract.endDate);
                        return (
                          <tr key={contract.id} className="border-b hover:bg-gray-50">
                            <td className="p-4">
                              <div className="font-semibold text-gray-900">
                                {contract.contractNumber}
                              </div>
                              <p className="text-xs text-gray-500">
                                ID: {contract.id?.slice(0, 8)}...
                              </p>
                            </td>
                            <td className="p-4 text-sm text-gray-900">
                              {contract.customerId?.slice(0, 12)}...
                            </td>
                            <td className="p-4">{getStatusBadge(contract)}</td>
                            <td className="p-4 text-sm text-gray-600">
                              {contract.startDate
                                ? new Date(contract.startDate).toLocaleDateString()
                                : '--'}
                            </td>
                            <td className="p-4">
                              <div className="text-sm text-gray-600">
                                {contract.endDate
                                  ? new Date(contract.endDate).toLocaleDateString()
                                  : '--'}
                              </div>
                              {expiry.urgent && (
                                <span className="text-xs text-red-600 font-medium">
                                  {expiry.text}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-sm font-medium">
                              {formatCurrency(
                                contract.monthlyBase ? Number(contract.monthlyBase) : 0,
                              )}
                            </td>
                            <td className="p-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  {(isExpiringSoon(contract.endDate) ||
                                    isExpired(contract.endDate)) && (
                                    <DropdownMenuItem>
                                      <RefreshCw className="w-4 h-4 mr-2" />
                                      Renew
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setLocation(
                                        `/admin/purchase-orders?contractId=${contract.id}`,
                                      )
                                    }
                                  >
                                    <FileText className="w-4 h-4 mr-2" />
                                    Book Order
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Mobile Card Layout */}
            <div className="lg:hidden space-y-3">
              {filteredContracts.map((contract: Contract) => {
                const expiry = expiryDisplay(contract.endDate);
                return (
                  <Card key={contract.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{contract.contractNumber}</h3>
                          <p className="text-sm text-gray-500">
                            Customer: {contract.customerId?.slice(0, 12)}...
                          </p>
                        </div>
                        {getStatusBadge(contract)}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Start</span>
                          <span>
                            {contract.startDate
                              ? new Date(contract.startDate).toLocaleDateString()
                              : '--'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">End</span>
                          <div className="text-right">
                            <span>
                              {contract.endDate
                                ? new Date(contract.endDate).toLocaleDateString()
                                : '--'}
                            </span>
                            {expiry.urgent && (
                              <span className="block text-xs text-red-600 font-medium">
                                {expiry.text}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Monthly Base</span>
                          <span className="font-medium">
                            {formatCurrency(
                              contract.monthlyBase ? Number(contract.monthlyBase) : 0,
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          View Details
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            setLocation(`/admin/purchase-orders?contractId=${contract.id}`)
                          }
                        >
                          Book Order
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* Mobile FAB */}
        <MobileFAB onClick={() => setIsCreateOpen(true)} label="New Contract" />
      </div>
    </MainLayout>
  );
}
