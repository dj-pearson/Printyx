/**
 * Quick Actions Component
 *
 * UX-009: Contextual quick actions button strip for entity detail pages.
 *
 * Displays a row of action buttons relevant to the current entity context.
 * Supports permission gating, disabled states, and responsive layout.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

export interface QuickAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  disabled?: boolean;
  hidden?: boolean;
}

interface QuickActionsProps {
  actions: QuickAction[];
  maxVisible?: number;
  className?: string;
}

export function QuickActions({ actions, maxVisible = 4, className }: QuickActionsProps) {
  const visibleActions = actions.filter((a) => !a.hidden);
  const primary = visibleActions.slice(0, maxVisible);
  const overflow = visibleActions.slice(maxVisible);

  if (visibleActions.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className || ''}`}>
      {primary.map((action) => (
        <Button
          key={action.id}
          variant={action.variant || 'outline'}
          size="sm"
          onClick={action.onClick}
          disabled={action.disabled}
          className="gap-1.5"
        >
          {action.icon}
          {action.label}
        </Button>
      ))}

      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {overflow.map((action) => (
              <DropdownMenuItem
                key={action.id}
                onClick={action.onClick}
                disabled={action.disabled}
                className="gap-2"
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
