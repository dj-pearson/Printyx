import { useQuery } from "@tanstack/react-query";
import { Bell, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { usePricingVisibility } from "@/hooks/usePricingVisibility";

interface ApprovalRequest {
  approval: {
    id: string;
    requestedDate: string;
    discountPercentage: string;
    requestedPrice: string;
  };
  requestedBy: {
    firstName: string;
    lastName: string;
  };
}

export function PricingNotificationBadge() {
  const { data: visibility } = usePricingVisibility();
  const { data: approvals = [] } = useQuery<ApprovalRequest[]>({
    queryKey: ['/api/pricing/approvals/pending'],
    enabled: visibility?.showDealerCost === true,
    refetchInterval: 60000, // Refetch every minute
  });

  // Don't show to non-managers
  if (!visibility?.showDealerCost) return null;

  const pendingCount = approvals.length;

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return "Just now";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {pendingCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {pendingCount > 9 ? '9+' : pendingCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Price Approval Requests</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {pendingCount === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No pending approvals
          </div>
        ) : (
          <>
            <div className="max-h-96 overflow-y-auto">
              {approvals.slice(0, 5).map((item) => (
                <DropdownMenuItem key={item.approval.id} asChild>
                  <Link href="/pricing/approvals" className="cursor-pointer">
                    <div className="flex flex-col gap-1 py-2 w-full">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {item.requestedBy.firstName} {item.requestedBy.lastName}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {parseFloat(item.approval.discountPercentage).toFixed(1)}% off
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatCurrency(item.approval.requestedPrice)}</span>
                        <span>{formatDate(item.approval.requestedDate)}</span>
                      </div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
            {pendingCount > 5 && (
              <div className="p-2 text-center text-xs text-muted-foreground border-t">
                +{pendingCount - 5} more pending
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/pricing/approvals" className="cursor-pointer w-full">
                <Button variant="ghost" className="w-full justify-start" size="sm">
                  <DollarSign className="h-4 w-4 mr-2" />
                  View All Approvals
                </Button>
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Simplified badge for use in navigation menus
export function PricingApprovalCount() {
  const { data: visibility } = usePricingVisibility();
  const { data: approvals = [] } = useQuery<ApprovalRequest[]>({
    queryKey: ['/api/pricing/approvals/pending'],
    enabled: visibility?.showDealerCost === true,
    refetchInterval: 60000,
  });

  if (!visibility?.showDealerCost || approvals.length === 0) return null;

  return (
    <Badge variant="destructive" className="ml-2">
      {approvals.length > 9 ? '9+' : approvals.length}
    </Badge>
  );
}
