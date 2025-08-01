import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MobileTableProps {
  data: any[];
  columns: {
    key: string;
    label: string;
    render?: (value: any, item: any) => ReactNode;
    mobile?: boolean; // Show on mobile
    priority?: 'high' | 'medium' | 'low'; // Priority for responsive display
  }[];
  onRowClick?: (item: any) => void;
  className?: string;
}

export default function MobileTable({ data, columns, onRowClick, className }: MobileTableProps) {
  const mobileColumns = columns.filter(col => col.mobile !== false);
  const primaryColumn = mobileColumns.find(col => col.priority === 'high') || mobileColumns[0];
  const secondaryColumns = mobileColumns.filter(col => 
    col.priority === 'medium' || (col.priority !== 'high' && col !== primaryColumn)
  ).slice(0, 2);

  return (
    <div className={cn("space-y-3", className)}>
      {data.map((item, index) => (
        <Card 
          key={index} 
          className={cn(
            "cursor-pointer hover:shadow-md transition-shadow border-gray-200",
            onRowClick && "hover:bg-gray-50"
          )}
          onClick={() => onRowClick?.(item)}
        >
          <CardContent className="p-4">
            <div className="space-y-2">
              {/* Primary column - most prominent */}
              <div className="flex items-center justify-between">
                <div className="font-medium text-gray-900 text-base">
                  {primaryColumn.render 
                    ? primaryColumn.render(item[primaryColumn.key], item)
                    : item[primaryColumn.key]
                  }
                </div>
                {secondaryColumns[0] && (
                  <div className="text-sm text-gray-600">
                    {secondaryColumns[0].render 
                      ? secondaryColumns[0].render(item[secondaryColumns[0].key], item)
                      : item[secondaryColumns[0].key]
                    }
                  </div>
                )}
              </div>

              {/* Secondary information */}
              {secondaryColumns[1] && (
                <div className="text-sm text-gray-500">
                  <span className="font-medium">{secondaryColumns[1].label}:</span>{' '}
                  {secondaryColumns[1].render 
                    ? secondaryColumns[1].render(item[secondaryColumns[1].key], item)
                    : item[secondaryColumns[1].key]
                  }
                </div>
              )}

              {/* Additional low-priority columns */}
              {mobileColumns
                .filter(col => col.priority === 'low')
                .slice(0, 1)
                .map(col => (
                  <div key={col.key} className="text-xs text-gray-400">
                    <span className="font-medium">{col.label}:</span>{' '}
                    {col.render 
                      ? col.render(item[col.key], item)
                      : item[col.key]
                    }
                  </div>
                ))
              }
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}