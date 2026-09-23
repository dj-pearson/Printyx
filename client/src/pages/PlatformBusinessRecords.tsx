import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, invalidateApiPath } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Search,
  Filter,
  Download,
  Plus,
  MoreVertical,
  Target,
  UserCheck,
  ArrowUpDown,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import MainLayout from '@/components/layout/main-layout';
import { useLocation } from 'wouter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadAuthedFile } from '@/lib/authed-download';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { describeApiError } from '@/lib/api-error';
import { bulkDeleteMessage, type BlockedRecord } from '@shared/platform-record-deletion';

interface BusinessRecord {
  id: string;
  recordType: 'prospect' | 'tenant';
  status: string;
  companyName: string;
  primaryContactEmail?: string;
  primaryContactName?: string;
  leadScore?: number;
  leadGrade?: string;
  leadTier?: string;
  industry?: string;
  employeeCount?: number;
  annualRevenue?: string;
  currentMRR?: string;
  assignedSalesRep?: string;
  leadSource?: string;
  createdAt: string;
  lastContactDate?: string;
}

export default function PlatformBusinessRecords() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [, setLocation] = useLocation();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [recordType, setRecordType] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [leadTierFilter, setLeadTierFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  // Selection
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());

  // Bulk assign
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState('');

  // `assigned_sales_rep` holds a USER ID, so the picker offers the same
  // platform users a territory or an assignment rule can be given to - typing
  // one in free text would store an id nobody can verify.
  const { data: managers = [] } = useQuery<{ id: string; name: string; email: string }[]>({
    queryKey: ['/api/platform-crm/managers'],
    enabled: assignOpen,
  });

  // Build query params
  const queryParams = new URLSearchParams();
  if (searchTerm) queryParams.set('search', searchTerm);
  if (recordType !== 'all') queryParams.set('recordType', recordType);
  if (statusFilter !== 'all') queryParams.set('status', statusFilter);
  if (leadTierFilter !== 'all') queryParams.set('leadTier', leadTierFilter);
  queryParams.set('sortBy', sortBy);
  queryParams.set('sortOrder', sortOrder);
  queryParams.set('page', page.toString());
  queryParams.set('limit', limit.toString());

  // Fetch records
  const { data, isLoading, refetch } = useQuery<{
    records: BusinessRecord[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: [`/api/platform-crm/business-records?${queryParams.toString()}`],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/platform-crm/business-records/${id}`, 'DELETE');
    },
    onSuccess: () => {
      // The list key is one URL carrying the filters, so an exact-key
      // invalidation stopped matching it (QUERYKEY-002).
      invalidateApiPath('/api/platform-crm/business-records');
      toast({
        title: 'Success',
        description: 'Business record deleted successfully',
      });
    },
    // Round 212: the server now refuses a record that still has deals,
    // contacts or activities (they would cascade), and says which.
    onError: (err) => {
      toast({
        title: 'Could not delete',
        description: describeApiError(err).message,
        variant: 'destructive',
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (recordIds: string[]) =>
      apiRequest('/api/platform-crm/business-records/bulk/delete', 'POST', {
        recordIds,
      }) as Promise<{
        deleted: string[];
        blocked: BlockedRecord[];
        missing: string[];
      }>,
    onSuccess: (result) => {
      invalidateApiPath('/api/platform-crm/business-records');
      const msg = bulkDeleteMessage(result);
      toast({
        title: msg.title,
        description: msg.description,
        variant: msg.destructive ? 'destructive' : undefined,
      });
      // Keep what was not deleted selected, so it can be dealt with.
      setSelectedRecords(new Set(result.blocked.map((b) => b.id)));
    },
    onError: (err) =>
      toast({
        title: 'Could not delete',
        description: describeApiError(err).message,
        variant: 'destructive',
      }),
  });

  // Bulk assign mutation
  const bulkAssignMutation = useMutation({
    mutationFn: async ({
      recordIds,
      assignedRep,
    }: {
      recordIds: string[];
      assignedRep: string;
    }) => {
      // PROD-013: a bare fetch resolved against the static origin in
      // production, so response.json() parsed the SPA shell and the mutation
      // reported "Failed to assign records" - which was also true in dev,
      // where no route serves this path either. Round 130 built the branch.
      return apiRequest<{ assigned: number; unchanged: number; missing: string[] }>(
        '/api/platform-crm/business-records/bulk/assign',
        { method: 'POST', body: { recordIds, assignedRep } },
      );
    },
    onSuccess: (result) => {
      invalidateApiPath('/api/platform-crm/business-records');
      setAssignOpen(false);
      setAssignTo('');
      // Whatever did NOT move stays selected, so a retry does not mean finding
      // those records again (round 78).
      setSelectedRecords(new Set(result.missing));
      // Say what moved. "Records assigned successfully" over a count of
      // attempts is the shape round 78 found on a bulk delete that deleted
      // nothing, and the server already knows the difference.
      const parts = [`${result.assigned} assigned`];
      if (result.unchanged > 0) parts.push(`${result.unchanged} already assigned`);
      if (result.missing.length > 0) parts.push(`${result.missing.length} not found`);
      toast({
        title: result.assigned > 0 ? 'Records assigned' : 'Nothing to assign',
        description: parts.join(', '),
      });
    },
    onError: (error) => {
      // The selection is deliberately left alone: nothing moved, so the
      // operator retries from where they were.
      toast({
        title: 'Assignment failed',
        description:
          error instanceof Error ? error.message : 'Could not assign the selected records.',
        variant: 'destructive',
      });
    },
  });

  const records = data?.records || [];
  const totalPages = data?.totalPages || 1;

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }
    > = {
      new: { variant: 'secondary', label: 'New' },
      contacted: { variant: 'outline', label: 'Contacted' },
      qualified: { variant: 'default', label: 'Qualified' },
      trial_active: { variant: 'default', label: 'Trial Active' },
      active_customer: { variant: 'default', label: 'Active' },
      churned: { variant: 'destructive', label: 'Churned' },
      lost: { variant: 'destructive', label: 'Lost' },
    };
    const config = variants[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getLeadTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      hot: 'bg-red-100 text-red-800',
      warm: 'bg-orange-100 text-orange-800',
      cold: 'bg-blue-100 text-blue-800',
    };
    return (
      <Badge className={colors[tier] || 'bg-gray-100 text-gray-800'}>
        {tier?.toUpperCase() || 'N/A'}
      </Badge>
    );
  };

  const getLeadGradeBadge = (grade: string) => {
    const colors: Record<string, string> = {
      'A+': 'bg-green-600 text-white',
      A: 'bg-green-500 text-white',
      B: 'bg-blue-500 text-white',
      C: 'bg-yellow-500 text-white',
      D: 'bg-orange-500 text-white',
      F: 'bg-red-500 text-white',
    };
    return <Badge className={colors[grade] || 'bg-gray-500 text-white'}>{grade || 'N/A'}</Badge>;
  };

  const handleSelectAll = () => {
    if (selectedRecords.size === records.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(records.map((r) => r.id)));
    }
  };

  const handleSelectRecord = (id: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRecords(newSelected);
  };

  /*
   * CSV, and only CSV (PLATFORM-EXPORT-001).
   *
   * This menu offered CSV, Excel and PDF against an endpoint that existed on no
   * backend - not in the platform-crm edge function the prefix is proxied to,
   * and not in Express - so all three 404'd in dev as well as production. Before
   * EXPORT-DOWNLOAD-001 nothing even threw: the 404 body went to disk under a
   * .csv name and the toast said the export had worked.
   *
   * Excel and PDF are REMOVED rather than pointed at the new endpoint. A second
   * synchronous generator on that request thread is what PA-028 says not to add,
   * and serving CSV bytes under an .xlsx name is a lie the file extension tells
   * on your behalf.
   *
   * The filters go with it: the server applies the same ones the list is showing
   * (page and limit excluded), so this exports the filtered SET rather than the
   * page on screen. Over 5,000 rows it refuses with a 413 naming the count,
   * which surfaces here as the error toast - a spreadsheet silently missing its
   * tail is worse than no spreadsheet, because nothing about the file says it is
   * partial and somebody will sum it.
   */
  const handleExport = async () => {
    const exportParams = new URLSearchParams(queryParams);
    exportParams.delete('page');
    exportParams.delete('limit');
    try {
      await downloadAuthedFile(
        `/api/platform-crm/business-records/export?${exportParams.toString()}`,
        `platform-business-records-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      toast({
        title: 'Export ready',
        description: 'Downloaded the filtered business records as CSV',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description:
          error instanceof Error ? error.message : 'Could not export the business records.',
        variant: 'destructive',
      });
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="w-8 h-8 text-primary" />
              Business Records
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage prospects and tenants across the platform
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => setLocation('/platform-crm/business-records/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Record
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    aria-label="Search business records"
                    placeholder="Company name, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Record Type */}
              <div className="space-y-2">
                <Label>Record Type</Label>
                <Select value={recordType} onValueChange={setRecordType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="prospect">Prospects</SelectItem>
                    <SelectItem value="tenant">Tenants</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="trial_active">Trial Active</SelectItem>
                    <SelectItem value="active_customer">Active Customer</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Lead Tier */}
              <div className="space-y-2">
                <Label>Lead Tier</Label>
                <Select value={leadTierFilter} onValueChange={setLeadTierFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="hot">Hot</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="cold">Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Label>Actions</Label>
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleExport()}>
                        Export as CSV
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedRecords.size > 0 && (
          <Card className="border-primary">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="font-semibold">
                    {selectedRecords.size} record{selectedRecords.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedRecords(new Set())}>
                    Clear Selection
                  </Button>
                  {/* PA-047 disabled these rather than showing buttons that only
                      toast "coming soon". Round 130 built the assign endpoint, so
                      that one is live; bulk delete still has no backend. */}
                  <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <UserCheck className="w-4 h-4 mr-2" />
                        Assign
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          Assign {selectedRecords.size} record
                          {selectedRecords.size !== 1 ? 's' : ''}
                        </DialogTitle>
                        <DialogDescription>
                          Records already held by this person are left alone, and the change is
                          recorded in the assignment history.
                        </DialogDescription>
                      </DialogHeader>
                      <Select value={assignTo} onValueChange={setAssignTo}>
                        <SelectTrigger aria-label="Assign to">
                          <SelectValue placeholder="Select a sales rep" />
                        </SelectTrigger>
                        <SelectContent>
                          {managers.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {managers.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No platform users are available to assign to.
                        </p>
                      )}
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          disabled={!assignTo || bulkAssignMutation.isPending}
                          onClick={() =>
                            bulkAssignMutation.mutate({
                              recordIds: Array.from(selectedRecords),
                              assignedRep: assignTo,
                            })
                          }
                        >
                          {bulkAssignMutation.isPending ? 'Assigning...' : 'Assign'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={bulkDeleteMutation.isPending}
                    onClick={async () => {
                      const ids = [...selectedRecords];
                      const ok = await confirm({
                        title: `Delete ${ids.length} record${ids.length === 1 ? '' : 's'}?`,
                        description:
                          'Records that still have deals, contacts or activities are kept and listed; deleting them would delete those too.',
                      });
                      if (ok) bulkDeleteMutation.mutate(ids);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {data ? `${data.total.toLocaleString()} Records` : 'Business Records'}
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Loading records...</p>
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-semibold mb-2">No records found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your filters or create a new record
                </p>
                <Button onClick={() => setLocation('/platform-crm/business-records/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Record
                </Button>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedRecords.size === records.length && records.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer"
                          onClick={() => handleSort('companyName')}
                        >
                          <div className="flex items-center gap-1">
                            Company
                            <ArrowUpDown className="w-4 h-4" />
                          </div>
                        </TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead
                          className="cursor-pointer"
                          onClick={() => handleSort('leadScore')}
                        >
                          <div className="flex items-center gap-1">
                            Score
                            <ArrowUpDown className="w-4 h-4" />
                          </div>
                        </TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>MRR</TableHead>
                        <TableHead
                          className="cursor-pointer"
                          onClick={() => handleSort('createdAt')}
                        >
                          <div className="flex items-center gap-1">
                            Created
                            <ArrowUpDown className="w-4 h-4" />
                          </div>
                        </TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record) => (
                        <TableRow
                          key={record.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={(e) => {
                            if ((e.target as HTMLElement).tagName !== 'INPUT') {
                              setLocation(`/platform-crm/business-records/${record.id}`);
                            }
                          }}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedRecords.has(record.id)}
                              onCheckedChange={() => handleSelectRecord(record.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              {record.companyName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{record.primaryContactName || 'N/A'}</div>
                              <div className="text-muted-foreground text-xs">
                                {record.primaryContactEmail}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={record.recordType === 'tenant' ? 'default' : 'secondary'}
                            >
                              {record.recordType}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Target className="w-4 h-4 text-muted-foreground" />
                              <span className="font-semibold">{record.leadScore || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getLeadTierBadge(record.leadTier || '')}</TableCell>
                          <TableCell>{getLeadGradeBadge(record.leadGrade || '')}</TableCell>
                          <TableCell>
                            {record.currentMRR
                              ? `$${parseFloat(record.currentMRR).toLocaleString()}`
                              : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(record.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button aria-label="More options" variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setLocation(`/platform-crm/business-records/${record.id}`)
                                  }
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    // AUDIT-014: /edit is not a registered route (it 404'd). The DETAIL page is the
                                    // editor — it owns the isEditing state and the PATCH mutation.
                                    setLocation(`/platform-crm/business-records/${record.id}`)
                                  }
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: `Delete ${record.companyName}?`,
                                    });
                                    if (!ok) return;
                                    deleteMutation.mutate(record.id);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, data?.total || 0)}{' '}
                    of {data?.total || 0} records
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {page} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
