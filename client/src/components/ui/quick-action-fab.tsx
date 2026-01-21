import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface QuickAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'secondary';
}

interface QuickActionFABProps {
  actions: QuickAction[];
  primaryAction?: QuickAction;
  position?: 'bottom-right' | 'bottom-left';
  className?: string;
}

export function QuickActionFAB({
  actions,
  primaryAction,
  position = 'bottom-right',
  className,
}: QuickActionFABProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const positionClasses = {
    'bottom-right': 'bottom-20 right-4 md:bottom-6 md:right-6',
    'bottom-left': 'bottom-20 left-4 md:bottom-6 md:left-6',
  };

  // If there's a primary action and no other actions, just show the button
  if (primaryAction && actions.length === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="lg"
              onClick={primaryAction.onClick}
              className={cn(
                'fixed z-40 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all',
                positionClasses[position],
                className,
              )}
              variant={primaryAction.variant || 'default'}
            >
              {primaryAction.icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{primaryAction.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn('fixed z-40', positionClasses[position], className)}>
      <TooltipProvider>
        {/* Secondary Actions - Appear when expanded */}
        {isExpanded && (
          <div className="absolute bottom-16 right-0 flex flex-col gap-2 mb-2">
            {actions.map((action, index) => (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Button
                    size="lg"
                    onClick={() => {
                      action.onClick();
                      setIsExpanded(false);
                    }}
                    className={cn(
                      'h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all animate-in fade-in slide-in-from-bottom-2',
                      `animation-delay-${index * 50}`,
                    )}
                    variant={action.variant || 'secondary'}
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    {action.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>{action.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        {/* Primary Button - Always visible */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="lg"
              onClick={() => {
                if (primaryAction && !isExpanded) {
                  primaryAction.onClick();
                } else {
                  setIsExpanded(!isExpanded);
                }
              }}
              className={cn(
                'h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all',
                isExpanded && 'rotate-45',
              )}
              variant={primaryAction?.variant || 'default'}
            >
              {isExpanded ? (
                <X className="h-6 w-6" />
              ) : (
                primaryAction?.icon || <Plus className="h-6 w-6" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{isExpanded ? 'Close' : primaryAction?.label || 'Quick Actions'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
