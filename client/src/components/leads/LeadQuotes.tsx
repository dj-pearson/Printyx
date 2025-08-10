import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  FileText,
  Plus,
  Search,
  Send,
  Eye,
  Edit,
  Copy,
  Download,
  MoreHorizontal,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Target,
  Calculator,
  RefreshCcw,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";

interface Quote {
  id: string;
  quoteNumber: string;
  title: string;
  customerId?: string;
  leadId?: string;
  status: string;
  totalAmount: number;
  validUntil: string;
  terms?: string;
  notes?: string;
  createdBy: string;
  sentDate?: string;
  acceptedDate?: string;
  createdAt: string;
  updatedAt: string;
  lineItems?: QuoteLineItem[];
}

interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface LeadQuotesProps {
  leadId: string;
  leadName: string;
}

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-yellow-100 text-yellow-800",
  converted: "bg-purple-100 text-purple-800",
};

const statusLabels = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  converted: "Converted",
};

const statusIcons = {
  draft: Edit,
  sent: Send,
  accepted: CheckCircle,
  rejected: XCircle,
  expired: Clock,
  converted: RefreshCcw,
};

export function LeadQuotes({ leadId, leadName }: LeadQuotesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [, setLocation] = useLocation();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch quotes for this lead
  const {
    data: quotes = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/quotes", "lead", leadId],
    enabled: !!leadId,
    queryFn: async () => apiRequest(`/api/quotes?leadId=${leadId}`),
  });

  // Update quote status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/api/quotes/${id}/status`, "PATCH", { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/quotes", "lead", leadId],
      });
      toast({
        title: "Success",
        description: "Quote status updated",
      });
    },
  });

  // Filter quotes based on search and status
  const filteredQuotes = quotes.filter((quote: Quote) => {
    const matchesSearch =
      quote.quoteNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.title?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || quote.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const stats = {
    total: quotes.length,
    totalValue: quotes.reduce((sum: number, q: Quote) => {
      const amount = parseFloat(q.totalAmount?.toString() || "0");
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0),
    pending: quotes.filter((q: Quote) => ["draft", "sent"].includes(q.status))
      .length,
    accepted: quotes.filter((q: Quote) => q.status === "accepted").length,
    winRate:
      quotes.length > 0
        ? (quotes.filter((q: Quote) => q.status === "accepted").length /
            quotes.length) *
          100
        : 0,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0);
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "MMM dd, yyyy");
  };

  const getStatusIcon = (status: string) => {
    const Icon = statusIcons[status as keyof typeof statusIcons] || Edit;
    return <Icon className="h-4 w-4" />;
  };

  const handleCreateQuote = () => {
    // Navigate to quote builder with lead info pre-filled
    const params = new URLSearchParams({
      leadId: leadId,
      companyName: leadName,
      prefill: "true",
    });
    setLocation(`/quotes/new?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Quote Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calculator className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Quotes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.totalValue)}
                </p>
                <p className="text-sm text-gray-600">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-2xl font-bold">
                  {stats.winRate.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600">Win Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search quotes by number or title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleCreateQuote}>
                <Plus className="h-4 w-4 mr-2" />
                Create Quote
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quotes Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="min-w-[120px]">Quote #</TableHead>
                    <TableHead className="min-w-[200px]">Title</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[120px]">Total Value</TableHead>
                    <TableHead className="min-w-[100px]">Valid Until</TableHead>
                    <TableHead className="min-w-[120px]">Created</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex flex-col items-center space-y-2">
                          <Calculator className="h-8 w-8 text-gray-400" />
                          <p className="text-gray-500">
                            No quotes found for this lead
                          </p>
                          <Button size="sm" onClick={handleCreateQuote}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create First Quote
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredQuotes.map((quote) => (
                      <TableRow key={quote.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="font-medium text-blue-600">
                            {quote.quoteNumber}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{quote.title}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              statusColors[
                                quote.status as keyof typeof statusColors
                              ]
                            }
                          >
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(quote.status)}
                              <span className="capitalize">
                                {
                                  statusLabels[
                                    quote.status as keyof typeof statusLabels
                                  ]
                                }
                              </span>
                            </div>
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(
                            parseFloat(quote.totalAmount?.toString() || "0")
                          )}
                        </TableCell>
                        <TableCell>
                          {quote.validUntil
                            ? formatDate(quote.validUntil)
                            : "-"}
                        </TableCell>
                        <TableCell>{formatDate(quote.createdAt)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() =>
                                  setLocation(`/quotes/${quote.id}`)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Quote
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setLocation(`/quotes/${quote.id}`)
                                }
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Quote
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: quote.id,
                                    status: "sent",
                                  })
                                }
                                disabled={quote.status === "sent"}
                              >
                                <Send className="mr-2 h-4 w-4" />
                                Send Quote
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: quote.id,
                                    status: "accepted",
                                  })
                                }
                                disabled={quote.status === "accepted"}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark Accepted
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
