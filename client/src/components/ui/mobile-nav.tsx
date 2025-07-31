import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  Wrench, 
  Package
} from "lucide-react";

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Service', href: '/service-dispatch', icon: Wrench },
  { name: 'Inventory', href: '/inventory', icon: Package },
];

export default function MobileNav() {
  const [location] = useLocation();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-50">
      <div className="flex justify-around">
        {navigation.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.name} href={item.href}>
              <a
                className={cn(
                  "flex flex-col items-center py-2 px-3 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-gray-500"
                )}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs">{item.name}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
