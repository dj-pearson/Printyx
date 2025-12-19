import { useState } from 'react';
import { useLocation } from 'wouter';
import { BarChart3, Users, Target, Wrench, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import MobileNavigationDrawer from '@/components/mobile/MobileNavigationDrawer';

const bottomNavItems = [
  {
    label: 'Dashboard',
    path: '/',
    icon: BarChart3,
  },
  {
    label: 'CRM',
    path: '/leads-management',
    icon: Target,
  },
  {
    label: 'Service',
    path: '/service-dispatch-optimization',
    icon: Wrench,
  },
  {
    label: 'Customers',
    path: '/customers',
    icon: Users,
  },
];

interface MobileBottomNavProps {
  className?: string;
}

export default function MobileBottomNav({ className }: MobileBottomNavProps) {
  const [location] = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95 border-t border-border md:hidden',
          className,
        )}
      >
        <nav
          role="tablist"
          aria-label="Main navigation"
          className="flex items-center justify-around py-1 px-1 min-h-16"
        >
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || location.startsWith(item.path + '/');

            return (
              <Link key={item.path} href={item.path} className="flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Navigate to ${item.label}`}
                  className={cn(
                    'flex flex-col items-center justify-center min-h-12 min-w-12 rounded-lg mx-0.5 touch-manipulation transition-all duration-200',
                    'active:scale-[0.98]',
                    isActive
                      ? 'text-primary bg-primary/10 shadow-sm font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                  )}
                >
                  <Icon className="h-5 w-5 mb-0.5" />
                  <span className="text-xs font-medium leading-tight">{item.label}</span>
                </Button>
              </Link>
            );
          })}

          {/* More button opens navigation drawer */}
          <Button
            variant="ghost"
            size="sm"
            role="tab"
            aria-label="Open navigation menu"
            onClick={() => setIsDrawerOpen(true)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center min-h-12 min-w-12 rounded-lg mx-0.5 touch-manipulation transition-all duration-200',
              'active:scale-[0.98]',
              'text-muted-foreground hover:text-foreground hover:bg-accent/50',
            )}
          >
            <Menu className="h-5 w-5 mb-0.5" />
            <span className="text-xs font-medium leading-tight">More</span>
          </Button>
        </nav>
      </div>

      {/* Full navigation drawer */}
      <MobileNavigationDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
    </>
  );
}
