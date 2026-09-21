import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Plus,
  Search,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MoreHorizontal,
  Eye,
  Edit,
  RefreshCcw,
  Calculator,
} from 'lucide-react';
import { format, isAfter, isBefore, addMonths } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

/**
 * Every field here is a REAL column on `contracts` (migration 0000 plus the
 * four 0070 adds), reached through the camelCase the edge function now
 * answers with - it used to return the raw PostgREST row, so `contractNumber`
 * and the dates were undefined on every contract and `matchesSearch` below
 * was therefore undefined, which made `filteredContracts` EMPTY for every
 * customer whatever they typed. The tab rendered nothing, always.
 *
 * REMOVED, because `contracts` has no column for them and nothing derives
 * them (AUDIT-016: delete a claim with no backing data rather than fake it):
 * contractType, autoRenewal, renewalTerms, totalContractValue,
 * currentMonthlyBilling, lastBillingDate, nextBillingDate, equipmentCount.
 * The last five were declared and never rendered; the first three drove a
 * billing-model badge and a renewal row that could only ever have said "no".
 * `acquisitionType` IS a column and is NOT the same concept - it records how
 * the equipment was acquired (cash/lease), not the billing model - so it is
 * deliberately not substituted in.
 *
 * hasTieredRates is derived server-side from contract_tiered_rates.
 */
interface Contract {
  id: string;
  contractNumber: string;
  customerId: string;
  startDate: string;
  endDate: string;
  blackRate?: number;
  colorRate?: number;
  monthlyBase?: number;
  hasTieredRates: boolean;
  status: string;
  acquisitionType?: string;
  createdAt: string;
  updatedAt: string;
}

interface CustomerContractsProps {
  customerId: string;
  customerName: string;
}

const statusColors = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  expired: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  renewal_pending: 'bg-blue-100 text-blue-800',
};

export function CustomerContracts({ customerId, customerName }: CustomerContractsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch contracts for this customer
  const {
    data: contracts = [],
    isLoading,
    refetch,
  } = useQuery<Contract[]>({
    // Not a sub-resource: supabase/functions/contracts/ reads parts[0] as a
    // CONTRACT id, so /api/contracts/customer/<id> looked up a contract called
    // "customer" and 404'd. The list branch takes ?customerId.
    queryKey: [`/api/contracts?customerId=${customerId}`],
    enabled: !!customerId,
  });

  // start_date and end_date are nullable, so format() would throw
  // "Invalid time value" on a contract that carries neither.
  const formatDate = (value?: string) => {
    if (!value) return <span className="text-gray-400">&mdash;</span>;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return <span className="text-gray-400">&mdash;</span>;
    return format(d, 'MMM d, yyyy');
  };

  // Filter contracts based on search and status. An EMPTY search term matches
  // everything: the old expression was `a?.toLowerCase().includes(term) ||
  // b?.toLowerCase().includes(term)`, which is `undefined` rather than `true`
  // when the fields are absent, so it excluded every row even with nothing
  // typed. A contract whose number is null must not vanish either.
  const term = searchTerm.trim().toLowerCase();
  const filteredContracts = contracts.filter((contract: Contract) => {
    const matchesSearch =
      term === '' || (contract.contractNumber ?? '').toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // start_date and end_date are NULLABLE (migration 0070 dropped both NOT
  // NULLs), so a contract can carry neither and `new Date(undefined)` is an
  // Invalid Date that compares false against everything - which would have
  // silently reported 'active'. Fall back to the stored status instead of
  // inferring one from dates that are not there.
  const getContractStatus = (contract: Contract) => {
    const now = new Date();
    const start = contract.startDate ? new Date(contract.startDate) : null;
    const end = contract.endDate ? new Date(contract.endDate) : null;
    const valid = (d: Date | null): d is Date => d !== null && !Number.isNaN(d.getTime());

    if (valid(start) && isBefore(now, start)) return 'pending';
    // 'renewal_pending' is gone with autoRenewal: nothing records whether a
    // contract renews, so every contract would have read as simply expired.
    if (valid(end) && isAfter(now, end)) return 'expired';
    if (!valid(start) && !valid(end)) return contract.status || 'active';
    return 'active';
  };

  // The end date is a real column, so "this contract is nearly up" is a real
  // signal and the alert stays. It used to be gated on autoRenewal, which is
  // not a column, and it said "Renewal coming up" - a claim about what happens
  // next that nothing here records. It says what is known instead.
  const getExpiryAlert = (contract: Contract) => {
    if (!contract.endDate) return null;
    const endDate = new Date(contract.endDate);
    if (Number.isNaN(endDate.getTime())) return null;

    const now = new Date();
    if (isBefore(endDate, now)) return null; // already expired; the badge says so
    if (isAfter(addMonths(now, 3), endDate)) {
      return 'Expires within 3 months';
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Contracts</h2>
          <p className="text-sm text-gray-600">Manage service contracts for {customerName}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  aria-label="Search contracts"
                  placeholder="Search contracts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="renewal_pending">Renewal Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Contracts ({filteredContracts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredContracts.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No contracts found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? 'No contracts match your current filters.'
                  : "This customer doesn't have any contracts yet."}
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create First Contract
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract #</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Monthly Base</TableHead>
                    <TableHead>Tiered Rates</TableHead>
                    <TableHead>Alerts</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract: Contract) => {
                    const status = getContractStatus(contract);
                    const expiryAlert = getExpiryAlert(contract);

                    return (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                        <TableCell>{formatDate(contract.startDate)}</TableCell>
                        <TableCell>{formatDate(contract.endDate)}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[status as keyof typeof statusColors]}>
                            {status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(contract.monthlyBase)}</TableCell>
                        <TableCell>
                          {contract.hasTieredRates ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="text-gray-400">&mdash;</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {expiryAlert && (
                            <div className="flex items-center">
                              <AlertTriangle className="h-4 w-4 text-amber-500 mr-1" />
                              <span className="text-xs text-amber-700">{expiryAlert}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button aria-label="More options" variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedContract(contract);
                                  setShowDetails(true);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Contract
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Calculator className="h-4 w-4 mr-2" />
                                Generate Invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Calendar className="h-4 w-4 mr-2" />
                                Schedule Service
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contract Details</DialogTitle>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900">Contract Number</h4>
                  <p className="text-gray-600">{selectedContract.contractNumber}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Status</h4>
                  <p className="text-gray-600">{selectedContract.status}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Start Date</h4>
                  <p className="text-gray-600">{formatDate(selectedContract.startDate)}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">End Date</h4>
                  <p className="text-gray-600">{formatDate(selectedContract.endDate)}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Monthly Base</h4>
                  <p className="text-gray-600">{formatCurrency(selectedContract.monthlyBase)}</p>
                </div>
              </div>

              {/* Shown when the contract carries per-click rates, rather than
                  when it is typed 'cost_per_click' - there is no contract-type
                  column, and the rates themselves are the evidence. */}
              {(selectedContract.blackRate != null || selectedContract.colorRate != null) && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Per-Click Rates</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Black & White</span>
                      <p className="font-medium">{formatCurrency(selectedContract.blackRate)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Color</span>
                      <p className="font-medium">{formatCurrency(selectedContract.colorRate)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDetails(false)}>
                  Close
                </Button>
                <Button>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Contract
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
