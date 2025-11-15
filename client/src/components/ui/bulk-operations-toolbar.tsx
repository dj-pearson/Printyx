import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Trash2,
  Download,
  Edit,
  MoreHorizontal,
  X,
  Archive,
  Tag,
  Mail,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface BulkAction {
  id: string;
  label: string;
  icon: React.ElementType;
  onClick: (selectedIds: string[]) => void | Promise<void>;
  variant?: "default" | "destructive";
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
}

export interface BulkOperationsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onClearSelection: () => void;
  onSelectAll?: () => void;
  actions: BulkAction[];
  selectedIds: string[];
  className?: string;
}

export function BulkOperationsToolbar({
  selectedCount,
  totalCount,
  onClearSelection,
  onSelectAll,
  actions,
  selectedIds,
  className,
}: BulkOperationsToolbarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<BulkAction | null>(null);

  if (selectedCount === 0) return null;

  const handleActionClick = (action: BulkAction) => {
    if (action.requiresConfirmation) {
      setPendingAction(action);
      setShowDeleteDialog(true);
    } else {
      action.onClick(selectedIds);
    }
  };

  const handleConfirmAction = async () => {
    if (pendingAction) {
      await pendingAction.onClick(selectedIds);
      setShowDeleteDialog(false);
      setPendingAction(null);
      onClearSelection();
    }
  };

  // Separate quick actions (up to 3) from dropdown actions
  const quickActions = actions.slice(0, 3);
  const dropdownActions = actions.slice(3);

  return (
    <>
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg transition-transform duration-200",
          "md:sticky md:top-0 md:bottom-auto md:border-b md:border-t-0",
          className
        )}
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Selection Info */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="text-sm font-medium">
                  {selectedCount} selected
                </span>
                {onSelectAll && selectedCount < totalCount && (
                  <>
                    <span className="hidden sm:inline text-muted-foreground">•</span>
                    <button
                      onClick={onSelectAll}
                      className="text-sm text-primary hover:underline"
                    >
                      Select all {totalCount}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.id}
                    variant={action.variant === "destructive" ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => handleActionClick(action)}
                    className="hidden sm:flex"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {action.label}
                  </Button>
                );
              })}

              {/* Mobile: All actions in dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild className="sm:hidden">
                  <Button variant="outline" size="sm">
                    Actions
                    <MoreHorizontal className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {actions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <DropdownMenuItem
                        key={action.id}
                        onClick={() => handleActionClick(action)}
                        className={action.variant === "destructive" ? "text-destructive" : ""}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {action.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Desktop: Additional actions dropdown */}
              {dropdownActions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild className="hidden sm:flex">
                    <Button variant="outline" size="sm">
                      More
                      <MoreHorizontal className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>More Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {dropdownActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <DropdownMenuItem
                          key={action.id}
                          onClick={() => handleActionClick(action)}
                          className={action.variant === "destructive" ? "text-destructive" : ""}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {action.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.confirmationTitle || "Confirm Action"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.confirmationDescription ||
                `Are you sure you want to perform this action on ${selectedCount} selected item(s)? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={
                pendingAction?.variant === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Hook for managing bulk selection state
export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  const selectAll = () => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isSelected = (id: string) => selectedIds.has(id);

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  return {
    selectedIds: Array.from(selectedIds),
    selectedIdsSet: selectedIds,
    selectedCount: selectedIds.size,
    toggleSelection,
    toggleAll,
    selectAll,
    clearSelection,
    isSelected,
    isAllSelected,
    isSomeSelected,
  };
}
