import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Users,
  MapPin,
  Map,
  History,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { loadZipCentroids, getZipCentroid } from '@/lib/zip-centroids';
import MainLayout from '@/components/layout/main-layout';

const TerritoryMap = lazy(() => import('@/components/maps/TerritoryMap'));

// Types
interface Rep {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  teamId: string | null;
  profileImageUrl: string | null;
  accountCount: number;
  territories: Array<{ id: string; name: string }>;
}

interface RepsSummary {
  totalReps: number;
  totalAccounts: number;
  unassignedCount: number;
  avgPerRep: number;
}

interface Account {
  id: string;
  companyName: string;
  recordType?: string;
  status?: string;
  phone?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  territory?: string;
  ownerId?: string | null;
  assignedSalesRep?: string | null;
  estimatedAmount?: string;
  createdAt?: string;
}

interface HistoryEntry {
  id: string;
  leadId: string;
  assignedFrom: string | null;
  assignedTo: string;
  assignmentReason: string;
  assignedBy: string | null;
  assignmentNotes: string | null;
  assignedAt: string;
  assignedFromName: string | null;
  assignedToName: string;
  assignedByName: string;
  accountName: string;
}

function getRepName(rep: Rep): string {
  return `${rep.firstName || ''} ${rep.lastName || ''}`.trim() || rep.email || 'Unknown';
}

// ==================== REP OVERVIEW TAB ====================

function RepOverviewTab({ reps, summary }: { reps: Rep[]; summary: RepsSummary }) {
  const [expandedRepId, setExpandedRepId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<{
    accountId: string;
    accountName: string;
  } | null>(null);
  const [bulkReassignOpen, setBulkReassignOpen] = useState(false);
  const [selectedRepId, setSelectedRepId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const repAccountsQuery = useQuery<{ accounts: Account[]; pagination: any }>({
    queryKey: ['/api/sales-rep-assignments/reps', expandedRepId, 'accounts'],
    queryFn: () => apiRequest(`/api/sales-rep-assignments/reps/${expandedRepId}/accounts?limit=50`),
    enabled: !!expandedRepId,
  });

  const assignMutation = useMutation({
    mutationFn: (data: { accountId: string; newRepId: string; reason?: string }) =>
      apiRequest('/api/sales-rep-assignments/assign', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-rep-assignments'] });
      setReassignDialogOpen(false);
      setReassignTarget(null);
      setSelectedRepId('');
      setReassignReason('');
      toast({ title: 'Account reassigned successfully' });
    },
    onError: () => toast({ title: 'Failed to reassign account', variant: 'destructive' }),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: (data: { accountIds: string[]; newRepId: string; reason?: string }) =>
      apiRequest('/api/sales-rep-assignments/bulk-assign', 'POST', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-rep-assignments'] });
      setBulkReassignOpen(false);
      setSelectedIds(new Set());
      setSelectedRepId('');
      setReassignReason('');
      toast({ title: `${data.assignedCount} accounts reassigned` });
    },
    onError: () => toast({ title: 'Failed to bulk reassign', variant: 'destructive' }),
  });

  const maxAccounts = Math.max(...reps.map((r) => r.accountCount), 1);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Total Accounts</p>
            <p className="text-2xl font-bold">{summary.totalAccounts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Unassigned</p>
            <p className="text-2xl font-bold text-orange-600">{summary.unassignedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Sales Reps</p>
            <p className="text-2xl font-bold">{summary.totalReps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Avg Per Rep</p>
            <p className="text-2xl font-bold">{summary.avgPerRep}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rep List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Sales Representatives</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {reps.map((rep) => {
              const isExpanded = expandedRepId === rep.id;
              const workloadPct = maxAccounts > 0 ? (rep.accountCount / maxAccounts) * 100 : 0;

              return (
                <div key={rep.id} className="border rounded-lg">
                  <button
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => setExpandedRepId(isExpanded ? null : rep.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{getRepName(rep)}</span>
                        {rep.role && (
                          <Badge variant="outline" className="text-xs">
                            {rep.role}
                          </Badge>
                        )}
                      </div>
                      {rep.territories.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {rep.territories.map((t) => t.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="w-32 hidden md:block">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${workloadPct}%` }}
                          />
                        </div>
                      </div>
                      <Badge variant="secondary" className="min-w-[50px] justify-center">
                        {rep.accountCount}
                      </Badge>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t px-3 pb-3">
                      {repAccountsQuery.isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      ) : repAccountsQuery.data?.accounts?.length ? (
                        <>
                          {selectedIds.size > 0 && (
                            <div className="flex items-center gap-2 py-2 border-b">
                              <span className="text-sm">{selectedIds.size} selected</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setBulkReassignOpen(true)}
                              >
                                Reassign Selected
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedIds(new Set())}
                              >
                                Clear
                              </Button>
                            </div>
                          )}
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-8">
                                  <Checkbox
                                    checked={
                                      selectedIds.size === repAccountsQuery.data.accounts.length &&
                                      selectedIds.size > 0
                                    }
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedIds(
                                          new Set(repAccountsQuery.data!.accounts.map((a) => a.id)),
                                        );
                                      } else {
                                        setSelectedIds(new Set());
                                      }
                                    }}
                                  />
                                </TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>City</TableHead>
                                <TableHead>State</TableHead>
                                <TableHead>ZIP</TableHead>
                                <TableHead className="w-[100px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {repAccountsQuery.data.accounts.map((account) => (
                                <TableRow key={account.id}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedIds.has(account.id)}
                                      onCheckedChange={(checked) => {
                                        setSelectedIds((prev) => {
                                          const next = new Set(prev);
                                          if (checked) next.add(account.id);
                                          else next.delete(account.id);
                                          return next;
                                        });
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {account.companyName}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs capitalize">
                                      {account.recordType || 'unknown'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{account.billingCity || '-'}</TableCell>
                                  <TableCell>{account.billingState || '-'}</TableCell>
                                  <TableCell>{account.billingPostalCode || '-'}</TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-xs"
                                      onClick={() => {
                                        setReassignTarget({
                                          accountId: account.id,
                                          accountName: account.companyName,
                                        });
                                        setReassignDialogOpen(true);
                                      }}
                                    >
                                      Reassign
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No accounts assigned
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Single Reassign Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Account</DialogTitle>
          </DialogHeader>
          {reassignTarget && (
            <div className="space-y-4">
              <p className="text-sm">
                Reassigning <strong>{reassignTarget.accountName}</strong>
              </p>
              <div>
                <label className="text-sm font-medium">New Sales Rep</label>
                <Select value={selectedRepId} onValueChange={setSelectedRepId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rep..." />
                  </SelectTrigger>
                  <SelectContent>
                    {reps.map((rep) => (
                      <SelectItem key={rep.id} value={rep.id}>
                        {getRepName(rep)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Reason (optional)</label>
                <Textarea
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="Reason for reassignment..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedRepId || assignMutation.isPending}
              onClick={() => {
                if (reassignTarget && selectedRepId) {
                  assignMutation.mutate({
                    accountId: reassignTarget.accountId,
                    newRepId: selectedRepId,
                    reason: reassignReason || undefined,
                  });
                }
              }}
            >
              {assignMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reassign Dialog */}
      <Dialog open={bulkReassignOpen} onOpenChange={setBulkReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Reassign ({selectedIds.size} accounts)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Sales Rep</label>
              <Select value={selectedRepId} onValueChange={setSelectedRepId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rep..." />
                </SelectTrigger>
                <SelectContent>
                  {reps.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {getRepName(rep)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                placeholder="Reason for reassignment..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkReassignOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedRepId || bulkAssignMutation.isPending}
              onClick={() => {
                if (selectedRepId) {
                  bulkAssignMutation.mutate({
                    accountIds: Array.from(selectedIds),
                    newRepId: selectedRepId,
                    reason: reassignReason || undefined,
                  });
                }
              }}
            >
              {bulkAssignMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Reassign {selectedIds.size} Accounts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== TERRITORY MAP TAB ====================

function TerritoryMapTab({ reps }: { reps: Rep[] }) {
  const [repFilter, setRepFilter] = useState<string>('all');
  const [showUnassigned, setShowUnassigned] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const accountsQuery = useQuery<Account[]>({
    queryKey: ['/api/sales-rep-assignments/accounts'],
    queryFn: () => apiRequest('/api/sales-rep-assignments/accounts'),
  });

  const [zipCentroids, setZipCentroids] = useState<Record<string, [number, number]>>({});

  // Load zip centroids on mount
  useState(() => {
    loadZipCentroids().then(setZipCentroids);
  });

  const accountsWithCoords = useMemo(() => {
    if (!accountsQuery.data) return [];
    return accountsQuery.data.map((a) => {
      const coords = getZipCentroid(a.billingPostalCode || '', zipCentroids);
      return {
        ...a,
        lat: coords?.[0],
        lng: coords?.[1],
      };
    });
  }, [accountsQuery.data, zipCentroids]);

  const assignMutation = useMutation({
    mutationFn: (data: { accountId: string; newRepId: string }) =>
      apiRequest('/api/sales-rep-assignments/assign', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-rep-assignments'] });
      toast({ title: 'Account reassigned' });
    },
  });

  const mapReps = reps.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={repFilter} onValueChange={setRepFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by rep" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reps</SelectItem>
            {reps.map((rep) => (
              <SelectItem key={rep.id} value={rep.id}>
                {getRepName(rep)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={showUnassigned} onCheckedChange={(c) => setShowUnassigned(!!c)} />
          Show Unassigned
        </label>
        {accountsQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        <span className="text-sm text-muted-foreground">
          {accountsWithCoords.filter((a) => a.lat && a.lng).length} of {accountsWithCoords.length}{' '}
          accounts mapped
        </span>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 h-[600px]">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            }
          >
            <TerritoryMap
              accounts={accountsWithCoords}
              reps={mapReps}
              repFilter={repFilter === 'all' ? null : repFilter}
              showUnassigned={showUnassigned}
              onReassign={(accountId, newRepId) => {
                assignMutation.mutate({ accountId, newRepId });
              }}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== AREA ASSIGNMENT TAB ====================

function AreaAssignmentTab({ reps }: { reps: Rep[] }) {
  const [selectedRepId, setSelectedRepId] = useState('');
  const [method, setMethod] = useState<'zip' | 'state' | 'city'>('zip');
  const [values, setValues] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const US_STATES = [
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY',
    'DC',
  ];

  const parsedValues = useMemo(() => {
    return values
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }, [values]);

  const previewMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/sales-rep-assignments/assign-by-area?preview=true', 'POST', {
        repId: selectedRepId,
        method,
        values: parsedValues,
        onlyUnassigned,
      }),
    onSuccess: (data) => setPreviewCount(data.previewCount),
  });

  const executeMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/sales-rep-assignments/assign-by-area', 'POST', {
        repId: selectedRepId,
        method,
        values: parsedValues,
        onlyUnassigned,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-rep-assignments'] });
      toast({ title: `${data.assignedCount} accounts assigned successfully` });
      setPreviewCount(null);
      setValues('');
    },
    onError: () => toast({ title: 'Failed to assign accounts', variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Assign Accounts by Area</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Sales Rep</label>
          <Select value={selectedRepId} onValueChange={setSelectedRepId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a sales rep..." />
            </SelectTrigger>
            <SelectContent>
              {reps.map((rep) => (
                <SelectItem key={rep.id} value={rep.id}>
                  {getRepName(rep)} ({rep.accountCount} accounts)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium">Assignment Method</label>
          <Select
            value={method}
            onValueChange={(v) => {
              setMethod(v as typeof method);
              setValues('');
              setPreviewCount(null);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zip">By ZIP Codes</SelectItem>
              <SelectItem value="state">By State</SelectItem>
              <SelectItem value="city">By City</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium">
            {method === 'zip'
              ? 'ZIP Codes (comma-separated)'
              : method === 'state'
                ? 'States'
                : 'Cities (comma-separated)'}
          </label>
          {method === 'state' ? (
            <div className="flex flex-wrap gap-1 mt-1 p-2 border rounded-md max-h-[150px] overflow-y-auto">
              {US_STATES.map((st) => (
                <Badge
                  key={st}
                  variant={parsedValues.includes(st) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => {
                    if (parsedValues.includes(st)) {
                      setValues(parsedValues.filter((v) => v !== st).join(', '));
                    } else {
                      setValues([...parsedValues, st].join(', '));
                    }
                    setPreviewCount(null);
                  }}
                >
                  {st}
                </Badge>
              ))}
            </div>
          ) : (
            <Input
              value={values}
              onChange={(e) => {
                setValues(e.target.value);
                setPreviewCount(null);
              }}
              placeholder={method === 'zip' ? '10001, 10002, 10003' : 'New York, Boston, Chicago'}
            />
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={onlyUnassigned}
            onCheckedChange={(c) => {
              setOnlyUnassigned(!!c);
              setPreviewCount(null);
            }}
          />
          Only assign unassigned accounts
        </label>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={!selectedRepId || parsedValues.length === 0 || previewMutation.isPending}
            onClick={() => previewMutation.mutate()}
          >
            {previewMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Preview
          </Button>

          {previewCount !== null && (
            <span className="text-sm">
              <strong>{previewCount}</strong> accounts will be assigned
            </span>
          )}

          <Button
            disabled={
              !selectedRepId ||
              parsedValues.length === 0 ||
              previewCount === null ||
              previewCount === 0 ||
              executeMutation.isPending
            }
            onClick={() => executeMutation.mutate()}
          >
            {executeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Assign {previewCount || 0} Accounts
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== ASSIGNMENT HISTORY TAB ====================

function AssignmentHistoryTab({ reps }: { reps: Rep[] }) {
  const [page, setPage] = useState(1);
  const [repFilter, setRepFilter] = useState<string>('all');

  const historyQuery = useQuery<{
    history: HistoryEntry[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ['/api/sales-rep-assignments/history', page, repFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (repFilter && repFilter !== 'all') params.set('repId', repFilter);
      return apiRequest(`/api/sales-rep-assignments/history?${params}`);
    },
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select
          value={repFilter}
          onValueChange={(v) => {
            setRepFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by rep" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reps</SelectItem>
            {reps.map((rep) => (
              <SelectItem key={rep.id} value={rep.id}>
                {getRepName(rep)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Changed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyQuery.data?.history.length ? (
                    historyQuery.data.history.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatDate(entry.assignedAt)}
                        </TableCell>
                        <TableCell className="font-medium">{entry.accountName}</TableCell>
                        <TableCell>{entry.assignedFromName || '-'}</TableCell>
                        <TableCell>{entry.assignedToName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {entry.assignmentReason.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{entry.assignedByName}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No assignment history found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {historyQuery.data?.pagination && historyQuery.data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    Page {historyQuery.data.pagination.page} of{' '}
                    {historyQuery.data.pagination.totalPages} ({historyQuery.data.pagination.total}{' '}
                    total)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= historyQuery.data.pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== MAIN PAGE ====================

export default function SalesRepAssignments() {
  const repsQuery = useQuery<{ reps: Rep[]; summary: RepsSummary }>({
    queryKey: ['/api/sales-rep-assignments/reps'],
    queryFn: () => apiRequest('/api/sales-rep-assignments/reps'),
  });

  const reps = repsQuery.data?.reps || [];
  const summary = repsQuery.data?.summary || {
    totalReps: 0,
    totalAccounts: 0,
    unassignedCount: 0,
    avgPerRep: 0,
  };

  if (repsQuery.isLoading) {
    return (
      <MainLayout
        title="Sales Rep Assignments"
        description="Manage account assignments, territories, and sales rep workload"
      >
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Sales Rep Assignments"
      description="Manage account assignments, territories, and sales rep workload"
    >
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Rep Assignments</h1>
          <p className="text-muted-foreground text-sm">
            Manage account assignments, territories, and sales rep workload
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalAccounts}</div>
              <p className="text-xs text-muted-foreground">Across all reps</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{summary.unassignedCount}</div>
              <p className="text-xs text-muted-foreground">Need assignment</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sales Reps</CardTitle>
              <Users className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalReps}</div>
              <p className="text-xs text-muted-foreground">Active reps</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Per Rep</CardTitle>
              <MapPin className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.avgPerRep}</div>
              <p className="text-xs text-muted-foreground">Accounts per rep</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview" className="gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Rep Overview</span>
              <span className="sm:hidden">Reps</span>
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-1.5">
              <Map className="h-4 w-4" />
              <span className="hidden sm:inline">Territory Map</span>
              <span className="sm:hidden">Map</span>
            </TabsTrigger>
            <TabsTrigger value="area" className="gap-1.5">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Area Assignment</span>
              <span className="sm:hidden">Area</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <RepOverviewTab reps={reps} summary={summary} />
          </TabsContent>

          <TabsContent value="map">
            <TerritoryMapTab reps={reps} />
          </TabsContent>

          <TabsContent value="area">
            <AreaAssignmentTab reps={reps} />
          </TabsContent>

          <TabsContent value="history">
            <AssignmentHistoryTab reps={reps} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
