import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Clock, AlertCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, isPast, format } from 'date-fns';

interface Approval {
  id: string;
  executionId: string;
  stepExecutionId: string;
  assignedToUserId: string | null;
  assignedToGroupId: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy: string | null;
  approvalComment: string | null;
  dueDate: string | null;
  contextData: Record<string, any> | null;
  requestedAt: string;
  respondedAt: string | null;
}

export default function MyApprovals() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'responded'>('pending');
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [responseType, setResponseType] = useState<'approve' | 'reject'>('approve');
  const [comment, setComment] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch approvals
  const { data: approvals = [], isLoading } = useQuery<Approval[]>({
    queryKey: ['/api/approvals', statusFilter === 'pending' ? { status: 'pending' } : {}],
    queryFn: async () => {
      const params = statusFilter === 'pending' ? '?status=pending' : '';
      const response = await apiRequest(`/api/approvals${params}`, 'GET');
      return (response || []).map((approval: any) => ({
        ...approval,
        id: approval.id,
        requestType: approval.request_type || approval.requestType || '',
        requestedBy: approval.requested_by || approval.requestedBy || '',
        requestedAt: approval.requested_at || approval.requestedAt || '',
        createdAt: approval.created_at || approval.createdAt || '',
      }));
    },
  });

  // Respond to approval mutation
  const respondMutation = useMutation({
    mutationFn: async ({
      id,
      approved,
      comment,
    }: {
      id: string;
      approved: boolean;
      comment: string;
    }) => {
      const response = await fetch(`/api/approvals/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approved, comment }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to respond to approval');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/approvals'] });
      toast({
        title: variables.approved ? 'Approval granted' : 'Approval rejected',
        description: `You have ${variables.approved ? 'approved' : 'rejected'} this request.`,
      });
      setResponseDialogOpen(false);
      setDetailsDialogOpen(false);
      setComment('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to respond to approval. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleViewDetails = (approval: Approval) => {
    setSelectedApproval(approval);
    setDetailsDialogOpen(true);
  };

  const handleOpenResponse = (approval: Approval, type: 'approve' | 'reject') => {
    setSelectedApproval(approval);
    setResponseType(type);
    setComment('');
    setResponseDialogOpen(true);
  };

  const handleSubmitResponse = () => {
    if (!selectedApproval) return;

    respondMutation.mutate({
      id: selectedApproval.id,
      approved: responseType === 'approve',
      comment,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500">Rejected</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const isOverdue = (approval: Approval) => {
    return approval.dueDate && isPast(new Date(approval.dueDate)) && approval.status === 'pending';
  };

  // Filter approvals
  const filteredApprovals = approvals.filter((approval) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return approval.status === 'pending';
    if (statusFilter === 'responded') return ['approved', 'rejected'].includes(approval.status);
    return true;
  });

  // Group approvals
  const pendingApprovals = filteredApprovals.filter((a) => a.status === 'pending');
  const overdueApprovals = pendingApprovals.filter(isOverdue);
  const approvedCount = filteredApprovals.filter((a) => a.status === 'approved').length;
  const rejectedCount = filteredApprovals.filter((a) => a.status === 'rejected').length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Approvals</h1>
          <p className="text-muted-foreground mt-1">Approval requests requiring your review</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{pendingApprovals.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting your response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{overdueApprovals.length}</div>
            <p className="text-xs text-muted-foreground">Past due date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{approvedCount}</div>
            <p className="text-xs text-muted-foreground">Requests approved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{rejectedCount}</div>
            <p className="text-xs text-muted-foreground">Requests rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        <Button
          variant={statusFilter === 'pending' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('pending')}
        >
          Pending ({pendingApprovals.length})
        </Button>
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('all')}
        >
          All
        </Button>
        <Button
          variant={statusFilter === 'responded' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('responded')}
        >
          Responded
        </Button>
      </div>

      {/* Approvals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Requests ({filteredApprovals.length})</CardTitle>
          <CardDescription>Review and respond to approval requests</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading approvals...</div>
          ) : filteredApprovals.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No approval requests found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {statusFilter === 'pending'
                  ? "You're all caught up! No pending approvals."
                  : 'Try adjusting your filters.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApprovals.map((approval) => (
                  <TableRow key={approval.id} className={isOverdue(approval) ? 'bg-red-50' : ''}>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          Workflow Approval Request
                          {isOverdue(approval) && <AlertCircle className="w-4 h-4 text-red-500" />}
                        </div>
                        {approval.contextData?.approvalMessage && (
                          <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {approval.contextData.approvalMessage}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(approval.status)}</TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(approval.requestedAt), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {approval.dueDate ? (
                        <div>
                          <div className={isOverdue(approval) ? 'text-red-500 font-medium' : ''}>
                            {format(new Date(approval.dueDate), 'MMM d, yyyy')}
                          </div>
                          {isOverdue(approval) && (
                            <div className="text-xs text-red-500">Overdue</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No due date</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(approval)}
                        >
                          View Details
                        </Button>
                        {approval.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-500 hover:bg-green-600"
                              onClick={() => handleOpenResponse(approval, 'approve')}
                              disabled={respondMutation.isPending}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleOpenResponse(approval, 'reject')}
                              disabled={respondMutation.isPending}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Approval Request Details</DialogTitle>
            <DialogDescription>
              Review the context and details of this approval request
            </DialogDescription>
          </DialogHeader>

          {selectedApproval && (
            <div className="space-y-4 py-4">
              <div>
                <h4 className="font-medium mb-2">Status</h4>
                {getStatusBadge(selectedApproval.status)}
              </div>

              {selectedApproval.contextData?.approvalMessage && (
                <div>
                  <h4 className="font-medium mb-2">Message</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedApproval.contextData.approvalMessage}
                  </p>
                </div>
              )}

              {selectedApproval.contextData && (
                <div>
                  <h4 className="font-medium mb-2">Context Data</h4>
                  <div className="bg-muted p-3 rounded text-sm space-y-1 max-h-60 overflow-y-auto">
                    {Object.entries(selectedApproval.contextData)
                      .filter(([key]) => key !== 'approvalMessage')
                      .map(([key, value]) => (
                        <div key={key}>
                          <span className="font-medium">{key}:</span>{' '}
                          <span className="text-muted-foreground">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Requested</h4>
                  <p className="text-sm">
                    {format(new Date(selectedApproval.requestedAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                {selectedApproval.dueDate && (
                  <div>
                    <h4 className="font-medium mb-2">Due Date</h4>
                    <p className="text-sm">
                      {format(new Date(selectedApproval.dueDate), 'MMM d, yyyy h:mm a')}
                      {isOverdue(selectedApproval) && (
                        <span className="text-red-500 font-medium ml-2">(Overdue)</span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {selectedApproval.respondedAt && (
                <div>
                  <h4 className="font-medium mb-2">Response</h4>
                  <p className="text-sm">
                    Responded{' '}
                    {formatDistanceToNow(new Date(selectedApproval.respondedAt), {
                      addSuffix: true,
                    })}
                  </p>
                  {selectedApproval.approvalComment && (
                    <div className="bg-muted p-3 rounded text-sm mt-2">
                      <MessageSquare className="w-4 h-4 inline mr-2" />
                      {selectedApproval.approvalComment}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
            {selectedApproval && selectedApproval.status === 'pending' && (
              <>
                <Button
                  className="bg-green-500 hover:bg-green-600"
                  onClick={() => {
                    setDetailsDialogOpen(false);
                    handleOpenResponse(selectedApproval, 'approve');
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDetailsDialogOpen(false);
                    handleOpenResponse(selectedApproval, 'reject');
                  }}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Response Dialog */}
      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {responseType === 'approve' ? 'Approve Request' : 'Reject Request'}
            </DialogTitle>
            <DialogDescription>
              {responseType === 'approve'
                ? 'You are about to approve this request. The workflow will continue.'
                : 'You are about to reject this request. The workflow may be cancelled or require alternative actions.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="comment">Comment (optional)</Label>
              <Textarea
                id="comment"
                placeholder={`Explain why you are ${responseType === 'approve' ? 'approving' : 'rejecting'} this request...`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResponseDialogOpen(false)}
              disabled={respondMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className={responseType === 'approve' ? 'bg-green-500 hover:bg-green-600' : ''}
              variant={responseType === 'reject' ? 'destructive' : 'default'}
              onClick={handleSubmitResponse}
              disabled={respondMutation.isPending}
            >
              {respondMutation.isPending
                ? 'Submitting...'
                : responseType === 'approve'
                  ? 'Approve'
                  : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
