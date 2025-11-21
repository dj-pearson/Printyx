import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, AlertTriangle, User, Calendar, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MainLayout from "@/components/layout/main-layout";
import { usePricingVisibility } from "@/hooks/usePricingVisibility";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ApprovalRequest {
  approval: {
    id: string;
    tenantId: string;
    requestType: string;
    referenceId: string;
    requestedBy: string;
    requestedDate: string;
    requestReason: string;
    originalPrice: string | null;
    requestedPrice: string;
    discountAmount: string;
    discountPercentage: string;
    originalMarginPercentage: string | null;
    newMarginPercentage: string | null;
    status: string;
    approvedBy: string | null;
    approvedDate: string | null;
    approvalNotes: string | null;
    rejectionReason: string | null;
    escalatedTo: string | null;
    escalatedDate: string | null;
    escalationReason: string | null;
    createdAt: string;
    updatedAt: string;
  };
  requestedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export default function PriceApprovals() {
  const { data: visibility } = usePricingVisibility();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [notes, setNotes] = useState("");

  const { data: approvals = [], isLoading } = useQuery<ApprovalRequest[]>({
    queryKey: ['/api/pricing/approvals/pending'],
    enabled: visibility?.showDealerCost === true, // Only managers can see approvals
  });

  const approveMutation = useMutation({
    mutationFn: async (data: { id: string; status: string; notes: string }) => {
      return await apiRequest(`/api/pricing/approval/${data.id}`, 'PATCH', {
        status: data.status,
        [data.status === 'approved' ? 'approvalNotes' : 'rejectionReason']: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/approvals/pending'] });
      setDialogOpen(false);
      setSelectedApproval(null);
      setNotes("");
      toast({
        title: "Success",
        description: `Price change ${actionType === 'approve' ? 'approved' : 'rejected'} successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process approval",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: string | number | null): string => {
    if (value === null || value === undefined) return "—";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(num);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleAction = (approval: ApprovalRequest, type: "approve" | "reject") => {
    setSelectedApproval(approval);
    setActionType(type);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!selectedApproval) return;

    approveMutation.mutate({
      id: selectedApproval.approval.id,
      status: actionType === "approve" ? "approved" : "rejected",
      notes,
    });
  };

  const getImpactColor = (percentage: number): string => {
    if (percentage >= 20) return "text-red-600";
    if (percentage >= 10) return "text-orange-600";
    return "text-yellow-600";
  };

  if (!visibility?.showDealerCost) {
    return (
      <MainLayout title="Price Approvals" description="Manage pricing approval requests">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              You do not have permission to view price approvals. Only managers and above can access this page.
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Price Approvals"
      description="Review and approve price change requests from sales reps"
    >
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Approvals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <p className="text-2xl font-bold">{approvals.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Discount Requested</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                <p className="text-2xl font-bold">
                  {approvals.length > 0
                    ? (
                        approvals.reduce(
                          (sum, a) => sum + parseFloat(a.approval.discountPercentage),
                          0
                        ) / approvals.length
                      ).toFixed(1)
                    : "0"}%
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Value Pending</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    approvals.reduce((sum, a) => sum + parseFloat(a.approval.requestedPrice), 0)
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Approval Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Approval Requests</CardTitle>
            <CardDescription>
              Review and take action on price change requests that exceed auto-approval thresholds
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">Loading approvals...</p>
              </div>
            ) : approvals.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm text-muted-foreground">
                  There are no pending price approval requests at this time.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {approvals.map((item) => (
                  <Card key={item.approval.id} className="border-l-4 border-l-orange-500">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-orange-50 text-orange-700">
                                {item.approval.requestType.replace('_', ' ').toUpperCase()}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                Reference: {item.approval.referenceId}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span>
                                  {item.requestedBy.firstName} {item.requestedBy.lastName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  {formatDate(item.approval.requestedDate)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-600 text-green-600 hover:bg-green-50"
                              onClick={() => handleAction(item, "approve")}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-600 text-red-600 hover:bg-red-50"
                              onClick={() => handleAction(item, "reject")}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>

                        <Separator />

                        {/* Pricing Details */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          {item.approval.originalPrice && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Original Price</p>
                              <p className="text-sm font-medium">
                                {formatCurrency(item.approval.originalPrice)}
                              </p>
                            </div>
                          )}
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Requested Price</p>
                            <p className="text-sm font-bold text-blue-600">
                              {formatCurrency(item.approval.requestedPrice)}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Discount Amount</p>
                            <p className="text-sm font-medium text-orange-600">
                              -{formatCurrency(item.approval.discountAmount)}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Discount %</p>
                            <p className={`text-sm font-bold ${getImpactColor(parseFloat(item.approval.discountPercentage))}`}>
                              {parseFloat(item.approval.discountPercentage).toFixed(1)}%
                            </p>
                          </div>
                        </div>

                        {/* Margin Impact */}
                        {item.approval.originalMarginPercentage && item.approval.newMarginPercentage && (
                          <Alert>
                            <TrendingDown className="h-4 w-4" />
                            <AlertDescription>
                              <strong>Margin Impact:</strong> From{" "}
                              {parseFloat(item.approval.originalMarginPercentage).toFixed(1)}% to{" "}
                              {parseFloat(item.approval.newMarginPercentage).toFixed(1)}% (
                              {(
                                parseFloat(item.approval.newMarginPercentage) -
                                parseFloat(item.approval.originalMarginPercentage)
                              ).toFixed(1)}
                              % decrease)
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Request Reason */}
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Request Reason</Label>
                          <p className="text-sm p-3 bg-muted/50 rounded-md">
                            {item.approval.requestReason}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === "approve" ? "Approve" : "Reject"} Price Change Request
              </DialogTitle>
              <DialogDescription>
                {actionType === "approve"
                  ? "Approve this price change request. You can add notes for the sales rep."
                  : "Reject this price change request. Please provide a reason for rejection."}
              </DialogDescription>
            </DialogHeader>

            {selectedApproval && (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-md space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sales Rep:</span>
                    <span className="font-medium">
                      {selectedApproval.requestedBy.firstName} {selectedApproval.requestedBy.lastName}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Requested Price:</span>
                    <span className="font-bold text-blue-600">
                      {formatCurrency(selectedApproval.approval.requestedPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Discount:</span>
                    <span className="font-medium text-orange-600">
                      {parseFloat(selectedApproval.approval.discountPercentage).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">
                    {actionType === "approve" ? "Approval Notes (Optional)" : "Rejection Reason"}
                  </Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      actionType === "approve"
                        ? "Add any notes or conditions for this approval..."
                        : "Explain why this request is being rejected..."
                    }
                    rows={4}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={approveMutation.isPending || (actionType === "reject" && !notes.trim())}
                variant={actionType === "approve" ? "default" : "destructive"}
              >
                {approveMutation.isPending
                  ? "Processing..."
                  : actionType === "approve"
                  ? "Approve"
                  : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
