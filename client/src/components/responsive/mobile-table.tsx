import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileTableProps {
  data: any[];
  columns: {
    key: string;
    label: string;
    render?: (value: any, item: any) => ReactNode;
    mobile?: boolean; // Show on mobile
    priority?: 'high' | 'medium' | 'low'; // Priority for responsive display
    badge?: boolean; // Render as badge
    icon?: ReactNode; // Icon to show with column
  }[];
  onRowClick?: (item: any) => void;
  className?: string;
  loading?: boolean;
  emptyMessage?: string;
}

export default function MobileTable({ 
  data, 
  columns, 
  onRowClick, 
  className, 
  loading = false,
  emptyMessage = "No data available" 
}: MobileTableProps) {
  const mobileColumns = columns.filter(col => col.mobile !== false);
  const primaryColumn = mobileColumns.find(col => col.priority === 'high') || mobileColumns[0];
  const secondaryColumns = mobileColumns.filter(col => 
    col.priority === 'medium' || (col.priority !== 'high' && col !== primaryColumn)
  ).slice(0, 2);
  const lowPriorityColumns = mobileColumns.filter(col => col.priority === 'low').slice(0, 2);

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[...Array(3)].map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-muted rounded w-32"></div>
                  <div className="h-3 bg-muted rounded w-16"></div>
                </div>
                <div className="h-3 bg-muted rounded w-24"></div>
                <div className="h-3 bg-muted rounded w-20"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-3", className)} role="list">
      {data.map((item, index) => (
        <Card 
          key={item.id || index}
          role="listitem"
          tabIndex={onRowClick ? 0 : undefined}
          className={cn(
            "touch-manipulation transition-all duration-200",
            onRowClick && [
              "cursor-pointer hover:shadow-md hover:bg-accent/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "active:scale-[0.98] active:bg-accent/80"
            ]
          )}
          onClick={() => onRowClick?.(item)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onRowClick) {
              e.preventDefault();
              onRowClick(item);
            }
          }}
        >
          <CardContent className="p-4 min-h-20">
            <div className="space-y-3">
              {/* Primary row with main info and first secondary column */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {primaryColumn.icon && (
                      <span className="text-muted-foreground flex-shrink-0">
                        {primaryColumn.icon}
                      </span>
                    )}
                    <div className="font-medium text-foreground text-base leading-tight truncate">
                      {primaryColumn.render 
                        ? primaryColumn.render(item[primaryColumn.key], item)
                        : item[primaryColumn.key]
                      }
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {secondaryColumns[0] && (
                    <div className="text-sm text-muted-foreground text-right">
                      {secondaryColumns[0].badge ? (
                        <Badge variant="outline" className="text-xs">
                          {secondaryColumns[0].render 
                            ? secondaryColumns[0].render(item[secondaryColumns[0].key], item)
                            : item[secondaryColumns[0].key]
                          }
                        </Badge>
                      ) : (
                        <>
                          {secondaryColumns[0].render 
                            ? secondaryColumns[0].render(item[secondaryColumns[0].key], item)
                            : item[secondaryColumns[0].key]
                          }
                        </>
                      )}
                    </div>
                  )}
                  {onRowClick && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Secondary information row */}
              {secondaryColumns[1] && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {secondaryColumns[1].icon && (
                    <span className="flex-shrink-0">
                      {secondaryColumns[1].icon}
                    </span>
                  )}
                  <span className="font-medium">{secondaryColumns[1].label}:</span>
                  <span className="truncate">
                    {secondaryColumns[1].badge ? (
                      <Badge variant="secondary" className="text-xs ml-1">
                        {secondaryColumns[1].render 
                          ? secondaryColumns[1].render(item[secondaryColumns[1].key], item)
                          : item[secondaryColumns[1].key]
                        }
                      </Badge>
                    ) : (
                      <>
                        {secondaryColumns[1].render 
                          ? secondaryColumns[1].render(item[secondaryColumns[1].key], item)
                          : item[secondaryColumns[1].key]
                        }
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Additional low-priority columns */}
              {lowPriorityColumns.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {lowPriorityColumns.map(col => (
                    <div key={col.key} className="text-xs text-muted-foreground flex items-center gap-1">
                      {col.icon && (
                        <span className="flex-shrink-0">
                          {col.icon}
                        </span>
                      )}
                      <span className="font-medium">{col.label}:</span>
                      <span>
                        {col.badge ? (
                          <Badge variant="outline" className="text-xs ml-1">
                            {col.render 
                              ? col.render(item[col.key], item)
                              : item[col.key]
                            }
                          </Badge>
                        ) : (
                          <>
                            {col.render 
                              ? col.render(item[col.key], item)
                              : item[col.key]
                            }
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}