import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MobileOptimizedCardProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
}

export default function MobileOptimizedCard({ 
  children, 
  title, 
  description, 
  className,
  compact = false 
}: MobileOptimizedCardProps) {
  return (
    <Card className={cn(
      "w-full shadow-sm border-gray-200",
      compact && "p-2 sm:p-4",
      className
    )}>
      {title && (
        <CardHeader className={cn(compact ? "pb-2 px-4 pt-4" : "pb-4")}>
          <CardTitle className={cn(
            "text-gray-900",
            compact ? "text-base sm:text-lg" : "text-lg sm:text-xl"
          )}>
            {title}
          </CardTitle>
          {description && (
            <CardDescription className="text-sm text-gray-600">
              {description}
            </CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent className={cn(
        compact ? "p-4 pt-0" : "p-6 pt-0",
        !title && (compact ? "p-4" : "p-6")
      )}>
        {children}
      </CardContent>
    </Card>
  );
}