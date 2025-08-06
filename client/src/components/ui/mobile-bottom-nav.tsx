import { useLocation } from "wouter";
import { BarChart3, Users, Calculator, Package, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const bottomNavItems = [
  {
    label: "Dashboard",
    path: "/",
    icon: BarChart3,
  },
  {
    label: "Customers",
    path: "/customers",
    icon: Users,
  },
  {
    label: "Billing",
    path: "/billing",
    icon: Calculator,
  },
  {
    label: "Inventory",
    path: "/inventory",
    icon: Package,
  },
  {
    label: "More",
    path: "/settings",
    icon: Settings,
  }
];

interface MobileBottomNavProps {
  className?: string;
}

export default function MobileBottomNav({ className }: MobileBottomNavProps) {
  const [location] = useLocation();

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border md:hidden",
      "pb-safe-bottom",
      className
    )}>
      <nav 
        role="tablist" 
        aria-label="Main navigation"
        className="flex items-center justify-around py-1 px-2 min-h-16"
      >
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || location.startsWith(item.path + '/');
          
          return (
            <Link key={item.path} href={item.path} className="flex-1">
              <Button
                variant="ghost"
                size="mobile"
                role="tab"
                aria-selected={isActive}
                aria-label={`Navigate to ${item.label}`}
                className={cn(
                  "flex flex-col items-center justify-center min-h-12 min-w-12 rounded-lg mx-1 touch-manipulation transition-colors",
                  "active:scale-95 active:bg-accent/80",
                  isActive
                    ? "text-primary bg-primary/10 shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <Icon className="h-5 w-5 mb-0.5" />
                <span className="text-xs font-medium leading-tight">{item.label}</span>
              </Button>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}