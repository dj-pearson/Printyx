import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import MainLayout from '@/components/layout/main-layout';
import {
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Percent,
  Calendar,
  User,
  MessageSquare,
  Filter,
  Search,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Timer,
  Target,
  BarChart3,
  FileText,
  Eye,
  Zap,
  Award,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface ApprovalRequest {
  id: string;
  requestType: string;
  requestTitle: string;
  requestedBy: string;
  requestedByName: string;
  status: string;
  dealValue?: number;
  discountPercentage?: number;
  proposedMargin?: number;
  currentApprovalLevel: number;
  approvalChain: Array<{
    level: number;
    approverId: string;
    approverName: string;
    status: string;
  }>;
  slaDeadline?: string;
  slaBreached: boolean;
  submittedAt: string;
  businessJustification?: string;
}

interface DashboardStats {
  myPendingApprovals: number;
  totalPending: number;
  slaBreached: number;
  approvalRate: number;
  avgApprovalTimeHours: number;
  recentApproved: number;
  recentRejected: number;
}

export default function DealDeskDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedTab, setSelectedTab] = useState<'my-queue' | 'all' | 'completed'>('my-queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [quickDecisionDialog, setQuickDecisionDialog] = useState<{
    open: boolean;
    requestId: string | null;
    decision: 'approve' | 'reject' | null;
  }>({ open: false, requestId: null, decision: null });
  const [decisionComments, setDecisionComments] = useState('');

  // Fetch dashboard stats
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['/api/deal-desk/dashboard'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch my pending approvals
  const { data: myApprovals = [], isLoading: myApprovalsLoading } = useQuery<ApprovalRequest[]>({
    queryKey: ['/api/deal-desk/my-approvals'],
    enabled: selectedTab === 'my-queue',
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch all approval requests
  const { data: allRequests = [], isLoading: allRequestsLoading } = useQuery<ApprovalRequest[]>({
    queryKey: [
      '/api/deal-desk/requests',
      { status: statusFilter !== 'all' ? statusFilter : undefined },
    ],
    enabled: selectedTab === 'all' || selectedTab === 'completed',
    refetchInterval: 30000,
  });

  // Process decision mutation
  const decisionMutation = useMutation({
    mutationFn: async ({
      id,
      decision,
      comments,
    }: {
      id: string;
      decision: string;
      comments?: string;
    }) => {
      return apiRequest(`/api/deal-desk/requests/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, comments }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deal-desk/my-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deal-desk/requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deal-desk/dashboard'] });
      setQuickDecisionDialog({ open: false, requestId: null, decision: null });
      setDecisionComments('');
      toast({
        title: 'Decision Recorded',
        description: 'Your approval decision has been processed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process decision',
        variant: 'destructive',
      });
    },
  });

  const handleQuickDecision = (requestId: string, decision: 'approve' | 'reject') => {
    setQuickDecisionDialog({ open: true, requestId, decision });
  };

  const confirmDecision = () => {
    if (!quickDecisionDialog.requestId || !quickDecisionDialog.decision) return;

    decisionMutation.mutate({
      id: quickDecisionDialog.requestId,
      decision: quickDecisionDialog.decision,
      comments: decisionComments,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_review':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'escalated':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRequestTypeIcon = (type: string) => {
    switch (type) {
      case 'discount':
        return <Percent className="h-4 w-4" />;
      case 'custom_pricing':
        return <DollarSign className="h-4 w-4" />;
      case 'payment_terms':
        return <Calendar className="h-4 w-4" />;
      case 'contract_terms':
        return <FileText className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  const filteredRequests = (selectedTab === 'my-queue' ? myApprovals : allRequests)
    .filter((req) => {
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        return (
          req.requestTitle.toLowerCase().includes(search) ||
          req.requestedByName.toLowerCase().includes(search) ||
          req.id.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .filter((req) => {
      if (selectedTab === 'completed') {
        return req.status === 'approved' || req.status === 'rejected' || req.status === 'cancelled';
      }
      return true;
    });

  const ApprovalCard = ({ request }: { request: ApprovalRequest }) => {
    const isMyTurn = request.approvalChain.some(
      (member) => member.status === 'pending' && member.level === request.currentApprovalLevel,
    );

    const hoursUntilSLA = request.slaDeadline
      ? (new Date(request.slaDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60)
      : null;

    return (
      <Card
        className={`hover:shadow-md transition-shadow ${request.slaBreached ? 'border-red-300' : ''}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="mt-1">{getRequestTypeIcon(request.requestType)}</div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg mb-1 flex items-center gap-2">
                  <span className="truncate">{request.requestTitle}</span>
                  {request.slaBreached && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      SLA Breached
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {request.requestedByName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(request.submittedAt), { addSuffix: true })}
                  </span>
                </CardDescription>
              </div>
            </div>
            <Badge className={getStatusColor(request.status)}>
              {request.status.replace('_', ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-2">
            {request.dealValue && (
              <div className="text-center p-2 bg-slate-50 rounded-md">
                <div className="text-xs text-slate-600">Deal Value</div>
                <div className="text-sm font-semibold">
                  ${(request.dealValue / 1000).toFixed(0)}K
                </div>
              </div>
            )}
            {request.discountPercentage && (
              <div className="text-center p-2 bg-slate-50 rounded-md">
                <div className="text-xs text-slate-600">Discount</div>
                <div className="text-sm font-semibold text-orange-600">
                  {request.discountPercentage}%
                </div>
              </div>
            )}
            {request.proposedMargin && (
              <div className="text-center p-2 bg-slate-50 rounded-md">
                <div className="text-xs text-slate-600">Margin</div>
                <div className="text-sm font-semibold">{request.proposedMargin}%</div>
              </div>
            )}
          </div>

          {/* Approval Chain Progress */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-600">Approval Chain</div>
            <div className="flex items-center gap-1">
              {request.approvalChain.map((member, idx) => (
                <div key={idx} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium ${
                      member.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : member.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : member.status === 'pending' &&
                              member.level === request.currentApprovalLevel
                            ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300'
                            : 'bg-gray-100 text-gray-500'
                    }`}
                    title={member.approverName}
                  >
                    {member.status === 'approved' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : member.status === 'rejected' ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <span>{member.level}</span>
                    )}
                  </div>
                  {idx < request.approvalChain.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-gray-400 mx-1" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SLA Timer */}
          {hoursUntilSLA !== null && (
            <div className="flex items-center gap-2 text-xs">
              <Timer
                className={`h-4 w-4 ${hoursUntilSLA < 0 ? 'text-red-500' : hoursUntilSLA < 4 ? 'text-orange-500' : 'text-slate-500'}`}
              />
              <span
                className={
                  hoursUntilSLA < 0
                    ? 'text-red-600 font-medium'
                    : hoursUntilSLA < 4
                      ? 'text-orange-600'
                      : 'text-slate-600'
                }
              >
                {hoursUntilSLA < 0
                  ? `SLA breached ${Math.abs(hoursUntilSLA).toFixed(1)}h ago`
                  : `${hoursUntilSLA.toFixed(1)}h until SLA deadline`}
              </span>
            </div>
          )}

          {/* Business Justification */}
          {request.businessJustification && (
            <div className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-md">
              <span className="font-medium">Justification: </span>
              {request.businessJustification}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => navigate(`/deal-desk/requests/${request.id}`)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View Details
            </Button>
            {isMyTurn && (request.status === 'pending' || request.status === 'in_review') && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleQuickDecision(request.id, 'approve')}
                >
                  <ThumbsUp className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleQuickDecision(request.id, 'reject')}
                >
                  <ThumbsDown className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Deal Desk</h1>
            <p className="text-slate-600 mt-1">Approval workflows and pricing governance</p>
          </div>
          <Button onClick={() => navigate('/deal-desk/rules')}>
            <Target className="h-4 w-4 mr-2" />
            Configure Rules
          </Button>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">My Queue</CardDescription>
              <CardTitle className="text-3xl font-bold">{stats?.myPendingApprovals || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Requiring your approval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Total Pending</CardDescription>
              <CardTitle className="text-3xl font-bold">{stats?.totalPending || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Across all approvers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">SLA Breached</CardDescription>
              <CardTitle
                className={`text-3xl font-bold ${(stats?.slaBreached || 0) > 0 ? 'text-red-600' : ''}`}
              >
                {stats?.slaBreached || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Need immediate attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Approval Rate (30d)</CardDescription>
              <CardTitle className="text-3xl font-bold">
                {stats?.approvalRate?.toFixed(0) || 0}%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Avg time: {stats?.avgApprovalTimeHours?.toFixed(1) || 0}h
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs and Filters */}
        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="my-queue">
                My Queue
                {stats?.myPendingApprovals ? (
                  <Badge className="ml-2 bg-blue-600">{stats.myPendingApprovals}</Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="all">All Requests</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              {selectedTab !== 'my-queue' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <TabsContent value="my-queue" className="space-y-4">
            {myApprovalsLoading ? (
              <div className="text-center py-12 text-slate-600">Loading...</div>
            ) : filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Award className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">No pending approvals</p>
                  <p className="text-sm text-slate-500 mt-1">You're all caught up!</p>
                </CardContent>
              </Card>
            ) : (
              filteredRequests.map((request) => <ApprovalCard key={request.id} request={request} />)
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {allRequestsLoading ? (
              <div className="text-center py-12 text-slate-600">Loading...</div>
            ) : filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">No approval requests found</p>
                  <p className="text-sm text-slate-500 mt-1">Try adjusting your filters</p>
                </CardContent>
              </Card>
            ) : (
              filteredRequests.map((request) => <ApprovalCard key={request.id} request={request} />)
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {allRequestsLoading ? (
              <div className="text-center py-12 text-slate-600">Loading...</div>
            ) : filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">No completed requests</p>
                </CardContent>
              </Card>
            ) : (
              filteredRequests.map((request) => <ApprovalCard key={request.id} request={request} />)
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick Decision Dialog */}
      <Dialog
        open={quickDecisionDialog.open}
        onOpenChange={(open) =>
          !open && setQuickDecisionDialog({ open: false, requestId: null, decision: null })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {quickDecisionDialog.decision === 'approve' ? 'Approve Request' : 'Reject Request'}
            </DialogTitle>
            <DialogDescription>
              {quickDecisionDialog.decision === 'approve'
                ? 'Add optional comments to explain your approval decision.'
                : 'Please provide a reason for rejection to help the requester understand.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder={
                quickDecisionDialog.decision === 'approve'
                  ? 'Comments (optional)'
                  : 'Rejection reason (required)'
              }
              value={decisionComments}
              onChange={(e) => setDecisionComments(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setQuickDecisionDialog({ open: false, requestId: null, decision: null })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDecision}
              disabled={
                decisionMutation.isPending ||
                (quickDecisionDialog.decision === 'reject' && !decisionComments)
              }
              className={
                quickDecisionDialog.decision === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''
              }
              variant={quickDecisionDialog.decision === 'reject' ? 'destructive' : 'default'}
            >
              {decisionMutation.isPending
                ? 'Processing...'
                : `Confirm ${quickDecisionDialog.decision === 'approve' ? 'Approval' : 'Rejection'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
