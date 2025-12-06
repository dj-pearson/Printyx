import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import {
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Percent,
  User,
  Building2,
  Calendar,
  FileText,
  MessageSquare,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  TrendingDown,
  TrendingUp,
  Target,
  ChevronRight,
  Send,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface ApprovalRequestDetail {
  id: string;
  requestType: string;
  requestTitle: string;
  requestDescription?: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  status: string;

  // Pricing details
  originalPrice?: number;
  proposedPrice?: number;
  discountAmount?: number;
  discountPercentage?: number;
  originalMargin?: number;
  proposedMargin?: number;
  dealValue?: number;
  totalContractValue?: number;

  // Justification
  businessJustification: string;
  competitiveContext?: string;
  strategicRationale?: string;
  riskAssessment?: string;

  // Workflow
  currentApprovalLevel: number;
  approvalChain: Array<{
    level: number;
    approverId: string;
    approverName: string;
    approverRole: string;
    status: string;
    decision?: string;
    comments?: string;
    decidedAt?: string;
  }>;

  // SLA
  slaDeadline?: string;
  slaBreached: boolean;

  // Timestamps
  submittedAt: string;
  firstReviewedAt?: string;
  completedAt?: string;

  // Related data
  deal?: any;
  quote?: any;
  comments?: Array<{
    id: string;
    commentText: string;
    authorName: string;
    authorRole: string;
    createdAt: string;
    isInternal: boolean;
  }>;
}

export default function ApprovalRequestDetail() {
  const [, params] = useRoute("/deal-desk/requests/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [commentText, setCommentText] = useState("");
  const [decisionComments, setDecisionComments] = useState("");
  const [showDecisionForm, setShowDecisionForm] = useState<"approve" | "reject" | null>(null);

  const requestId = params?.id;

  // Fetch request details
  const { data: request, isLoading } = useQuery<ApprovalRequestDetail>({
    queryKey: [`/api/deal-desk/requests/${requestId}`],
    enabled: !!requestId,
  });

  // Add comment mutation
  const commentMutation = useMutation({
    mutationFn: async (text: string) => {
      return apiRequest(`/api/deal-desk/requests/${requestId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ commentText: text, isInternal: false }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deal-desk/requests/${requestId}`] });
      setCommentText("");
      toast({
        title: "Comment Added",
        description: "Your comment has been posted.",
      });
    },
  });

  // Process decision mutation
  const decisionMutation = useMutation({
    mutationFn: async ({ decision, comments }: { decision: string; comments?: string }) => {
      return apiRequest(`/api/deal-desk/requests/${requestId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, comments }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deal-desk/requests/${requestId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/deal-desk/my-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deal-desk/dashboard'] });
      setShowDecisionForm(null);
      setDecisionComments("");
      toast({
        title: "Decision Recorded",
        description: "Your approval decision has been processed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process decision",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="text-center py-12">Loading approval request...</div>
        </div>
      </MainLayout>
    );
  }

  if (!request) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="text-center py-12">Approval request not found</div>
        </div>
      </MainLayout>
    );
  }

  const isMyTurn = request.approvalChain.some(
    (member) => member.status === 'pending' && member.level === request.currentApprovalLevel
  );

  const canTakeAction = isMyTurn && (request.status === 'pending' || request.status === 'in_review');

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

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/deal-desk')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Deal Desk
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{request.requestTitle}</h1>
            <p className="text-sm text-slate-600 mt-1">Request ID: {request.id}</p>
          </div>
          <Badge className={getStatusColor(request.status)}>
            {request.status.replace('_', ' ')}
          </Badge>
        </div>

        {/* SLA Warning */}
        {request.slaBreached && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="font-medium">SLA Deadline Breached</p>
                  <p className="text-sm">This request requires immediate attention</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pricing Details */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {request.originalPrice && request.proposedPrice && (
                    <>
                      <div>
                        <p className="text-sm text-slate-600">Original Price</p>
                        <p className="text-2xl font-bold">${request.originalPrice.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Proposed Price</p>
                        <p className="text-2xl font-bold text-orange-600">${request.proposedPrice.toLocaleString()}</p>
                      </div>
                    </>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {request.discountPercentage && (
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <Percent className="h-5 w-5 mx-auto text-orange-600 mb-1" />
                      <p className="text-sm text-slate-600">Discount</p>
                      <p className="text-xl font-bold text-orange-600">{request.discountPercentage}%</p>
                    </div>
                  )}
                  {request.discountAmount && (
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <DollarSign className="h-5 w-5 mx-auto text-slate-600 mb-1" />
                      <p className="text-sm text-slate-600">Discount $</p>
                      <p className="text-xl font-bold">${request.discountAmount.toLocaleString()}</p>
                    </div>
                  )}
                  {request.proposedMargin && (
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <TrendingUp className="h-5 w-5 mx-auto text-green-600 mb-1" />
                      <p className="text-sm text-slate-600">New Margin</p>
                      <p className="text-xl font-bold">{request.proposedMargin}%</p>
                    </div>
                  )}
                  {request.originalMargin && request.proposedMargin && (
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <TrendingDown className="h-5 w-5 mx-auto text-red-600 mb-1" />
                      <p className="text-sm text-slate-600">Margin Impact</p>
                      <p className="text-xl font-bold text-red-600">
                        -{(request.originalMargin - request.proposedMargin).toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>

                {request.dealValue && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Deal Value</p>
                        <p className="text-lg font-semibold">${request.dealValue.toLocaleString()}</p>
                      </div>
                      {request.totalContractValue && (
                        <div>
                          <p className="text-sm text-slate-600">Total Contract Value</p>
                          <p className="text-lg font-semibold">${request.totalContractValue.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Business Justification */}
            <Card>
              <CardHeader>
                <CardTitle>Business Justification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Primary Justification</p>
                  <p className="text-slate-600">{request.businessJustification}</p>
                </div>

                {request.competitiveContext && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Competitive Context</p>
                      <p className="text-slate-600">{request.competitiveContext}</p>
                    </div>
                  </>
                )}

                {request.strategicRationale && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Strategic Rationale</p>
                      <p className="text-slate-600">{request.strategicRationale}</p>
                    </div>
                  </>
                )}

                {request.riskAssessment && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Risk Assessment</p>
                      <p className="text-slate-600">{request.riskAssessment}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Comments & Discussion */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Discussion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {request.comments && request.comments.length > 0 ? (
                  <div className="space-y-3">
                    {request.comments.map((comment) => (
                      <div key={comment.id} className="bg-slate-50 p-3 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm">{comment.authorName}</p>
                            <p className="text-xs text-slate-500">{comment.authorRole}</p>
                          </div>
                          <p className="text-xs text-slate-500">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <p className="text-sm text-slate-700">{comment.commentText}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No comments yet</p>
                )}

                <Separator />

                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a comment or ask a question..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={() => commentMutation.mutate(commentText)}
                    disabled={!commentText.trim() || commentMutation.isPending}
                    size="sm"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Post Comment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Request Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Request Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 mt-0.5 text-slate-500" />
                  <div className="flex-1">
                    <p className="text-slate-600">Requested By</p>
                    <p className="font-medium">{request.requestedByName}</p>
                    <p className="text-xs text-slate-500">{request.requestedByRole}</p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-0.5 text-slate-500" />
                  <div className="flex-1">
                    <p className="text-slate-600">Submitted</p>
                    <p className="font-medium">{format(new Date(request.submittedAt), 'MMM dd, yyyy')}</p>
                    <p className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(request.submittedAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {request.slaDeadline && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 mt-0.5 text-slate-500" />
                      <div className="flex-1">
                        <p className="text-slate-600">SLA Deadline</p>
                        <p className="font-medium">{format(new Date(request.slaDeadline), 'MMM dd, yyyy HH:mm')}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Approval Chain */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Approval Chain</CardTitle>
                <CardDescription>Level {request.currentApprovalLevel} of {request.approvalChain.length}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {request.approvalChain.map((member, idx) => (
                    <div key={idx}>
                      <div className={`p-3 rounded-lg border ${
                        member.level === request.currentApprovalLevel && member.status === 'pending'
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                              member.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : member.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : member.level === request.currentApprovalLevel
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {member.status === 'approved' ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : member.status === 'rejected' ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                member.level
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{member.approverName}</p>
                              <p className="text-xs text-slate-500">{member.approverRole}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {member.status}
                          </Badge>
                        </div>
                        {member.comments && (
                          <p className="text-xs text-slate-600 mt-2 pl-10">"{member.comments}"</p>
                        )}
                        {member.decidedAt && (
                          <p className="text-xs text-slate-500 mt-1 pl-10">
                            {format(new Date(member.decidedAt), 'MMM dd, HH:mm')}
                          </p>
                        )}
                      </div>
                      {idx < request.approvalChain.length - 1 && (
                        <div className="flex justify-center my-1">
                          <ChevronRight className="h-4 w-4 text-slate-400 rotate-90" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            {canTakeAction && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Your Decision</CardTitle>
                  <CardDescription>You can approve or reject this request</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!showDecisionForm ? (
                    <>
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => setShowDecisionForm("approve")}
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Approve Request
                      </Button>
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => setShowDecisionForm("reject")}
                      >
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        Reject Request
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <Textarea
                        placeholder={showDecisionForm === 'approve' ? 'Comments (optional)' : 'Rejection reason (required)'}
                        value={decisionComments}
                        onChange={(e) => setDecisionComments(e.target.value)}
                        rows={4}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setShowDecisionForm(null);
                            setDecisionComments("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          className={`flex-1 ${showDecisionForm === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                          variant={showDecisionForm === 'reject' ? 'destructive' : 'default'}
                          onClick={() => decisionMutation.mutate({ decision: showDecisionForm, comments: decisionComments })}
                          disabled={decisionMutation.isPending || (showDecisionForm === 'reject' && !decisionComments)}
                        >
                          {decisionMutation.isPending ? 'Processing...' : `Confirm ${showDecisionForm === 'approve' ? 'Approval' : 'Rejection'}`}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
