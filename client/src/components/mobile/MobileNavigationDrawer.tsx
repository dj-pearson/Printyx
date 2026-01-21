import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Target,
  Wrench,
  Package,
  Truck,
  DollarSign,
  BarChart3,
  CheckSquare,
  Settings,
  Plug,
  ChevronDown,
  ChevronRight,
  Users,
  UserPlus,
  FileText,
  TrendingUp,
  PieChart,
  Calendar,
  Building2,
  ShoppingCart,
  Calculator,
  CreditCard,
  Activity,
  Monitor,
  Brain,
  Layers,
  Crown,
  Globe,
  Shield,
  Database,
  UserCheck,
  Bot,
  MessageSquare,
  Search,
  Video,
  Wand2,
  X,
} from 'lucide-react';
import useCollapsibleNavigation, { NavigationSection } from '@/hooks/useCollapsibleNavigation';

// Get role-aware navigation sections (same logic as CollapsibleSidebar)
function getNavigationSections(userRole: any): NavigationSection[] {
  const sections: NavigationSection[] = [];

  if (!userRole) return sections;

  const permissions = userRole.permissions || {};
  const isPlatformRole = userRole.canAccessAllTenants === true;
  const isCompanyAdmin = userRole.name?.includes('Admin');
  const level = userRole.level || 1;

  const useAdminRoutes = isPlatformRole || isCompanyAdmin || level >= 4;
  const adminPrefix = useAdminRoutes ? '/admin' : '';

  // Always visible sections
  sections.push({
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
    matchPatterns: ['/dashboard*'],
  });

  // Sales & CRM Hub
  if (permissions.sales || isPlatformRole || isCompanyAdmin) {
    sections.push({
      id: 'crm',
      title: 'CRM Hub',
      icon: Target,
      path: '/crm',
      matchPatterns: [
        '/crm*',
        '/leads*',
        '/contacts*',
        '/deals*',
        '/sales-pipeline*',
        '/quote*',
        '/proposal*',
        '/demo*',
        '/contracts*',
      ],
      children: [
        { title: 'Leads Management', path: '/leads-management', icon: UserPlus },
        { title: 'Contacts', path: '/contacts', icon: Users },
        { title: 'Deals Management', path: '/deals-management', icon: Target },
        { title: 'Sales Pipeline', path: '/sales-pipeline', icon: TrendingUp },
        { title: 'Pipeline Forecasting', path: '/sales-pipeline-forecasting', icon: PieChart },
        { title: 'CRM Goals Dashboard', path: '/crm-goals-dashboard', icon: Calendar },
        { title: 'Quotes & Proposals', path: '/quote-proposal-generation', icon: FileText },
        { title: 'Proposal Builder', path: '/proposal-builder', icon: Wand2 },
      ],
    });
  }

  // Service Hub
  if (permissions.service || isPlatformRole || isCompanyAdmin) {
    sections.push({
      id: 'service',
      title: 'Service Hub',
      icon: Wrench,
      path: '/service-hub',
      matchPatterns: ['/service*', '/meter-readings*', '/technician*'],
      children: [
        { title: 'Service Dispatch', path: '/service-dispatch-optimization', icon: Activity },
        { title: 'Meter Readings', path: '/meter-readings', icon: Monitor },
        { title: 'Service Billing', path: '/billing', icon: Calculator },
        { title: 'Technician Management', path: '/technician-management', icon: Users },
      ],
    });
  }

  // Product Hub
  if (permissions.products || isPlatformRole || isCompanyAdmin) {
    sections.push({
      id: 'products',
      title: 'Product Hub',
      icon: Package,
      path: '/product-hub',
      matchPatterns: [
        '/product*',
        '/supplies*',
        '/professional-services*',
        '/managed-services*',
        '/software-products*',
      ],
      children: [
        { title: 'Product Models', path: '/product-models', icon: Package },
        { title: 'Accessories', path: '/product-accessories', icon: Layers },
        { title: 'Supplies', path: '/supplies', icon: Package },
        { title: 'Professional Services', path: '/professional-services', icon: FileText },
        { title: 'Managed Services', path: '/managed-services', icon: Crown },
        { title: 'Software Products', path: '/software-products', icon: Monitor },
      ],
    });
  }

  // Equipment Lifecycle
  if (permissions.inventory || permissions.purchasing || isPlatformRole || isCompanyAdmin) {
    sections.push({
      id: 'equipment',
      title: 'Equipment Lifecycle',
      icon: Truck,
      path: '/equipment-lifecycle',
      matchPatterns: ['/equipment*', '/purchase-orders*', '/warehouse*', '/inventory*'],
      children: [
        { title: 'Purchase Orders', path: '/purchase-orders', icon: ShoppingCart },
        { title: 'Warehouse Operations', path: '/warehouse-operations', icon: Building2 },
        { title: 'Inventory Management', path: '/inventory', icon: Package },
      ],
    });
  }

  // Billing Hub
  if (permissions.billing || permissions.finance || isPlatformRole || isCompanyAdmin) {
    sections.push({
      id: 'billing',
      title: 'Billing Hub',
      icon: DollarSign,
      path: '/billing-hub',
      matchPatterns: ['/billing*', '/invoices*', '/accounts*', '/meter-billing*'],
      children: [
        { title: 'Invoices', path: '/invoices', icon: FileText },
        { title: 'Meter Billing', path: '/meter-billing', icon: Calculator },
        { title: 'Accounts Receivable', path: '/accounts-receivable', icon: CreditCard },
        { title: 'Accounts Payable', path: '/accounts-payable', icon: CreditCard },
      ],
    });
  }

  // Reports Hub
  if (permissions.reports || isPlatformRole || isCompanyAdmin) {
    sections.push({
      id: 'reports',
      title: 'Reports',
      icon: BarChart3,
      path: '/reports',
      matchPatterns: ['/reports*', '/advanced-reporting*', '/performance-monitoring*'],
      children: [
        { title: 'Advanced Reporting', path: '/advanced-reporting', icon: BarChart3 },
        { title: 'Performance Monitoring', path: '/performance-monitoring', icon: Activity },
      ],
    });
  }

  // Task Management Hub
  sections.push({
    id: 'tasks',
    title: 'Tasks',
    icon: CheckSquare,
    path: '/tasks',
    matchPatterns: ['/task*'],
    children: [
      { title: 'Advanced Task Management', path: '/task-management', icon: Brain },
      { title: 'Basic Task Management', path: '/basic-task-management', icon: CheckSquare },
    ],
  });

  // AI Hub
  sections.push({
    id: 'ai-hub',
    title: 'AI Hub',
    icon: Brain,
    path: '/ai-hub',
    matchPatterns: ['/ai*', '/calendar*', '/meeting*', '/search*'],
    children: [
      { title: 'AI Employees', path: '/ai-employees', icon: Bot },
      { title: 'Calendar Integration', path: '/calendar', icon: Calendar },
      { title: 'Meeting Transcription', path: '/meeting-transcription', icon: Video },
      { title: 'AI Search & Knowledge', path: '/ai-search', icon: Search },
      { title: 'AI Task Scheduling', path: '/ai-task-scheduling', icon: Brain },
      { title: 'Conversation AI', path: '/conversational-ai-dashboard', icon: MessageSquare },
    ],
  });

  // Customers
  sections.push({
    id: 'customers',
    title: 'Customers',
    icon: Building2,
    path: '/customers',
    matchPatterns: ['/customers*'],
  });

  // Platform Admin
  if (isPlatformRole) {
    sections.push({
      id: 'platform-admin',
      title: 'Platform Admin',
      icon: Crown,
      path: `${adminPrefix}/platform`,
      matchPatterns: [`${adminPrefix}/platform*`],
      children: [
        { title: 'Root Admin Security', path: `${adminPrefix}/root-admin-security`, icon: Shield },
        { title: 'System Security', path: `${adminPrefix}/system-security`, icon: Shield },
        { title: 'Database Updater', path: `${adminPrefix}/database-updater`, icon: Database },
        { title: 'Tenant Management', path: `${adminPrefix}/tenant-management`, icon: Building2 },
        { title: 'User Management', path: `${adminPrefix}/user-management`, icon: UserCheck },
        { title: 'Role Management', path: `${adminPrefix}/role-management`, icon: Users },
        { title: 'System Settings', path: `${adminPrefix}/system-settings`, icon: Settings },
        { title: 'Platform Analytics', path: `${adminPrefix}/platform-analytics`, icon: BarChart3 },
      ],
    });
  }

  // Administration
  if (isCompanyAdmin || isPlatformRole) {
    sections.push({
      id: 'admin',
      title: 'Administration',
      icon: Settings,
      path: `${adminPrefix}/company`,
      matchPatterns: [`${adminPrefix}/company*`, `${adminPrefix}/admin*`],
      children: [
        { title: 'Company Settings', path: `${adminPrefix}/company-settings`, icon: Building2 },
        { title: 'User Management', path: `${adminPrefix}/user-management`, icon: Users },
        { title: 'Role Management', path: `${adminPrefix}/role-management`, icon: UserCheck },
      ],
    });
  }

  // Integrations
  sections.push({
    id: 'integrations',
    title: 'Integrations',
    icon: Plug,
    path: '/integrations',
    matchPatterns: ['/integrations*'],
  });

  // Settings
  sections.push({
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    path: '/settings',
    matchPatterns: ['/settings*'],
  });

  return sections;
}

interface MobileNavigationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MobileNavigationDrawer({
  open,
  onOpenChange,
}: MobileNavigationDrawerProps) {
  const { user } = useAuth();
  const [location] = useLocation();

  const navigationSections = getNavigationSections(user?.role);
  const { expandedSections, toggleSection, isExpanded, isActive } =
    useCollapsibleNavigation(navigationSections);

  const renderNavigationItem = (section: NavigationSection) => {
    const hasChildren = section.children && section.children.length > 0;
    const isCurrentlyActive = isActive(section.path);
    const isParentActive = section.children?.some((child) => isActive(child.path));
    const shouldShowAsActive = isCurrentlyActive || isParentActive;

    if (hasChildren) {
      return (
        <Collapsible
          key={section.id}
          open={isExpanded(section.id)}
          onOpenChange={() => toggleSection(section.id)}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-between h-auto py-3 px-4 rounded-lg transition-all duration-200 touch-manipulation',
                'active:scale-[0.98]',
                shouldShowAsActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'hover:bg-accent text-foreground',
                'font-semibold text-sm',
              )}
            >
              <div className="flex items-center gap-3">
                <section.icon className="h-5 w-5 min-w-5" />
                <span className="font-semibold text-left">{section.title}</span>
              </div>
              {isExpanded(section.id) ? (
                <ChevronDown className="h-4 w-4 min-w-4" />
              ) : (
                <ChevronRight className="h-4 w-4 min-w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-1 mt-1">
            {section.children?.map((child) => (
              <Link key={child.path} href={child.path}>
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    'w-full justify-start h-auto py-2.5 px-4 pl-12 rounded-md transition-all duration-200 touch-manipulation',
                    'active:scale-[0.98]',
                    isActive(child.path)
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'hover:bg-accent/50 text-muted-foreground',
                    'text-sm',
                  )}
                >
                  <div className="flex items-center gap-3 w-full">
                    {child.icon && <child.icon className="h-4 w-4 min-w-4" />}
                    <span className="text-left flex-1">{child.title}</span>
                  </div>
                </Button>
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
      );
    } else {
      return (
        <Link key={section.id} href={section.path}>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className={cn(
              'w-full justify-start h-auto py-3 px-4 rounded-lg transition-all duration-200 touch-manipulation',
              'active:scale-[0.98]',
              isCurrentlyActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'hover:bg-accent text-foreground',
              'font-semibold text-sm',
            )}
          >
            <div className="flex items-center gap-3">
              <section.icon className="h-5 w-5 min-w-5" />
              <span className="font-semibold text-left">{section.title}</span>
            </div>
          </Button>
        </Link>
      );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b bg-background sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-md">
                <Globe className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <SheetTitle className="text-lg">Navigation</SheetTitle>
                <SheetDescription className="text-xs">Access all features</SheetDescription>
              </div>
            </div>
            <SheetClose className="rounded-full h-10 w-10 flex items-center justify-center hover:bg-accent touch-manipulation active:scale-95">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>
        </SheetHeader>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {navigationSections.map((section) => renderNavigationItem(section))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-background sticky bottom-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-border">
              <AvatarImage src={user?.picture} alt={user?.name} />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                {user?.name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('') || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
