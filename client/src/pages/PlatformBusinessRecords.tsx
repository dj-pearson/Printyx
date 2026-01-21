import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Users,
  Search,
  Filter,
  Download,
  Plus,
  MoreVertical,
  Mail,
  Phone,
  MapPin,
  Calendar,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Target,
  UserCheck,
  UserX,
  ArrowUpDown,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
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
  estimatedRevenue?: string;
  currentMRR?: string;
  assignedRep?: string;
  leadSource?: string;
  createdAt: string;
  lastActivityDate?: string;
}

export default function PlatformBusinessRecords() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
    queryKey: ['/api/platform-crm/business-records', queryParams.toString()],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/platform-crm/business-records/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete record');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/business-records'] });
      toast({
        title: 'Success',
        description: 'Business record deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete business record',
        variant: 'destructive',
      });
    },
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
      const response = await fetch('/api/platform-crm/business-records/bulk/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordIds, assignedRep }),
      });
      if (!response.ok) throw new Error('Failed to assign records');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/business-records'] });
      setSelectedRecords(new Set());
      toast({
        title: 'Success',
        description: 'Records assigned successfully',
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

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      const response = await fetch(
        `/api/platform-crm/business-records/export?${queryParams.toString()}&format=${format}`,
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `business-records-${format}-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: 'Success',
        description: `Exported ${records.length} records as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export records',
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
                      <DropdownMenuItem onClick={() => handleExport('csv')}>
                        Export as CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('excel')}>
                        Export as Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('pdf')}>
                        Export as PDF
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Bulk assign dialog would go here
                      toast({
                        title: 'Bulk Assign',
                        description: 'Bulk assign functionality coming soon',
                      });
                    }}
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Assign
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Delete ${selectedRecords.size} records?`)) {
                        // Bulk delete would go here
                        toast({
                          title: 'Bulk Delete',
                          description: 'Bulk delete functionality coming soon',
                        });
                      }
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
                                <Button variant="ghost" size="sm">
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
                                    setLocation(`/platform-crm/business-records/${record.id}/edit`)
                                  }
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    if (confirm(`Delete ${record.companyName}?`)) {
                                      deleteMutation.mutate(record.id);
                                    }
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
