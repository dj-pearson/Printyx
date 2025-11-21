import * as React from "react";
import { LucideIcon, Plus, FileQuestion, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
    icon?: LucideIcon;
  };
  suggestions?: string[];
  type?: "default" | "search" | "filter" | "error";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  suggestions,
  type = "default",
  className,
}: EmptyStateProps) {
  // Auto-select icon based on type if not provided
  const DisplayIcon = Icon || (
    type === "search" ? Search :
    type === "filter" ? Filter :
    type === "error" ? FileQuestion :
    Plus
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className={cn(
        "mb-4 rounded-full p-4",
        type === "error" ? "bg-destructive/10" : "bg-muted"
      )}>
        <DisplayIcon className={cn(
          "h-12 w-12",
          type === "error" ? "text-destructive" : "text-muted-foreground"
        )} />
      </div>

      <h3 className="text-lg font-semibold mb-2">{title}</h3>

      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          {description}
        </p>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="mt-4 mb-6 text-sm text-muted-foreground max-w-md">
          <p className="font-medium mb-2">Try:</p>
          <ul className="space-y-1 text-left">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-2">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mt-2">
        {action && (
          <Button
            onClick={action.onClick}
            variant={action.variant || "default"}
          >
            {action.icon && <action.icon className="h-4 w-4 mr-2" />}
            {action.label}
          </Button>
        )}

        {secondaryAction && (
          <Button
            onClick={secondaryAction.onClick}
            variant={secondaryAction.variant || "outline"}
          >
            {secondaryAction.icon && <secondaryAction.icon className="h-4 w-4 mr-2" />}
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}
