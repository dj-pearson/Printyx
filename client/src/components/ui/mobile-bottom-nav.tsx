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
      "fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden",
      className
    )}>
      <div className="flex items-center justify-around py-2 px-4">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || location.startsWith(item.path + '/');
          
          return (
            <Link key={item.path} href={item.path}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "flex flex-col items-center justify-center h-14 w-14 rounded-lg",
                  isActive
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
              </Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}