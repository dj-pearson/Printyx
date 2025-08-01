import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MobileDashboardGridProps {
  children: ReactNode;
  className?: string;
}

export default function MobileDashboardGrid({ children, className }: MobileDashboardGridProps) {
  return (
    <div className={cn(
      // Mobile-first responsive grid
      "grid grid-cols-1 gap-4", // 1 column on mobile
      "sm:grid-cols-2 sm:gap-6", // 2 columns on small tablets
      "lg:grid-cols-3 lg:gap-6", // 3 columns on desktop
      "xl:grid-cols-4 xl:gap-8", // 4 columns on large desktop
      className
    )}>
      {children}
    </div>
  );
}