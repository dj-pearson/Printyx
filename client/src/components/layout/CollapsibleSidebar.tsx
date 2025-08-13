import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  Briefcase,
  BookOpen,
  AlertTriangle,
  Cpu,
  Hash,
  Wand2,
  MapPin,
  Headphones,
  Cog,
  Zap,
  Smartphone,
  Rocket
} from "lucide-react";
import useCollapsibleNavigation, { NavigationSection } from "@/hooks/useCollapsibleNavigation";

// Get role-aware navigation sections
function getNavigationSections(userRole: any): NavigationSection[] {
  const sections: NavigationSection[] = [];

  if (!userRole) return sections;

  const permissions = userRole.permissions || {};
  const isPlatformRole = userRole.canAccessAllTenants === true;
  const isCompanyAdmin = userRole.name?.includes("Admin");
  const level = userRole.level || 1;

  // Determine URL prefix based on role level and permissions
  const useAdminRoutes = isPlatformRole || isCompanyAdmin || level >= 4;
  const adminPrefix = useAdminRoutes ? "/admin" : "";

  // Always visible sections
  sections.push({
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
    matchPatterns: ['/dashboard*']
  });

  // Sales & CRM Hub - Role-aware
  if (permissions.sales || isPlatformRole || isCompanyAdmin) {
    sections.push({
      id: 'crm',
      title: 'CRM Hub',
      icon: Target,
      path: '/crm',
      matchPatterns: ['/crm*', '/leads*', '/contacts*', '/deals*', '/sales-pipeline*', '/quote*', '/proposal*', '/demo*', '/contracts*'],
      children: [
        { title: 'Leads Management', path: '/leads-management', icon: UserPlus },
        { title: 'Contacts', path: '/contacts', icon: Users },
        { title: 'Deals Management', path: '/deals-management', icon: Target },
        { title: 'Sales Pipeline', path: '/sales-pipeline', icon: TrendingUp },
        { title: 'Pipeline Forecasting', path: '/sales-pipeline-forecasting', icon: PieChart },
        { title: 'CRM Goals Dashboard', path: '/crm-goals-dashboard', icon: Calendar },
        { title: 'Quotes & Proposals', path: '/quote-proposal-generation', icon: FileText },
        { title: 'Proposal Builder', path: '/proposal-builder', icon: Wand2 }
      ]
    });
  }

  // Service Hub - Role-aware
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
        { title: 'Technician Management', path: '/technician-management', icon: Users }
      ]
    });
  }

  // Product Hub - Role-aware
  if (permissions.products || isPlatformRole || isCompanyAdmin) {
    sections.push({
      id: 'products',
      title: 'Product Hub',
      icon: Package,
      path: '/product-hub',
      matchPatterns: ['/product*', '/supplies*', '/professional-services*', '/managed-services*', '/software-products*'],
      children: [
        { title: 'Product Models', path: '/product-models', icon: Package },
        { title: 'Accessories', path: '/product-accessories', icon: Layers },
        { title: 'Supplies', path: '/supplies', icon: Package },
        { title: 'Professional Services', path: '/professional-services', icon: FileText },
        { title: 'Managed Services', path: '/managed-services', icon: Crown },
        { title: 'Software Products', path: '/software-products', icon: Monitor }
      ]
    });
  }

  // Equipment Lifecycle - Role-aware
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
        { title: 'Inventory Management', path: '/inventory', icon: Package }
      ]
    });
  }

  // Billing Hub - Role-aware
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
        { title: 'Accounts Payable', path: '/accounts-payable', icon: CreditCard }
      ]
    });
  }

  // Reports Hub - Role-aware
  if (permissions.reports || isPlatformRole || isCompanyAdmin) {
    sections.push({
      id: 'reports',
      title: 'Reports',
      icon: BarChart3,
      path: '/reports',
      matchPatterns: ['/reports*', '/advanced-reporting*', '/performance-monitoring*'],
      children: [
        { title: 'Advanced Reporting', path: '/advanced-reporting', icon: BarChart3 },
        { title: 'Performance Monitoring', path: '/performance-monitoring', icon: Activity }
      ]
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
      { title: 'Basic Task Management', path: '/basic-task-management', icon: CheckSquare }
    ]
  });

  // Always visible core sections
  sections.push({
    id: 'customers',
    title: 'Customers',
    icon: Building2,
    path: '/customers',
    matchPatterns: ['/customers*']
  });

  // Platform/Admin-specific sections
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
        { title: 'Tenant Management', path: `${adminPrefix}/tenant-management`, icon: Building2 },
        { title: 'User Management', path: `${adminPrefix}/user-management`, icon: UserCheck },
        { title: 'Role Management', path: `${adminPrefix}/role-management`, icon: Users },
        { title: 'System Settings', path: `${adminPrefix}/system-settings`, icon: Settings },
        { title: 'Platform Analytics', path: `${adminPrefix}/platform-analytics`, icon: BarChart3 }
      ]
    });
  }

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
        { title: 'Role Management', path: `${adminPrefix}/role-management`, icon: UserCheck }
      ]
    });
  }

  // Integrations
  sections.push({
    id: 'integrations',
    title: 'Integrations',
    icon: Plug,
    path: '/integrations',
    matchPatterns: ['/integrations*']
  });

  // Settings
  sections.push({
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    path: '/settings',
    matchPatterns: ['/settings*']
  });

  return sections;
}

interface CollapsibleSidebarProps {
  className?: string;
}

export function CollapsibleSidebar({ className }: CollapsibleSidebarProps) {
  const { user, isAuthenticated } = useAuth();
  
  // Fetch user role
  const { data: userRole } = useQuery({
    queryKey: ["/api/auth/role"],
    enabled: isAuthenticated,
  });

  // Get role-aware navigation sections
  const navigationSections = getNavigationSections(userRole);
  const {
    expandedSections,
    toggleSection,
    isExpanded,
    isActive,
    getActiveSection,
    currentLocation
  } = useCollapsibleNavigation(navigationSections);

  if (!isAuthenticated) {
    return null;
  }

  const renderNavigationItem = (section: NavigationSection, isChild = false) => {
    const hasChildren = section.children && section.children.length > 0;
    const isCurrentlyActive = isActive(section.path);
    const isParentActive = section.children?.some(child => isActive(child.path));
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
              variant={shouldShowAsActive ? "secondary" : "ghost"}
              className={`w-full justify-between h-auto py-3 px-4 ${isChild ? 'ml-4 w-[calc(100%-1rem)]' : ''}`}
              data-testid={`nav-${section.id}`}
            >
              <div className="flex items-center gap-3">
                <section.icon className="h-5 w-5" />
                <span className="font-medium">{section.title}</span>
              </div>
              {isExpanded(section.id) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-1 pl-4">
            {section.children?.map((child) => (
              <Link key={child.path} href={child.path}>
                <Button
                  variant={isActive(child.path) ? "secondary" : "ghost"}
                  className="w-full justify-start h-auto py-2 px-4 ml-8"
                  data-testid={`nav-child-${child.path.replace('/', '')}`}
                >
                  <div className="flex items-center gap-3">
                    {child.icon && <child.icon className="h-4 w-4" />}
                    <span className="text-sm">{child.title}</span>
                  </div>
                  {isActive(child.path) && (
                    <Badge variant="secondary" className="ml-auto">
                      Active
                    </Badge>
                  )}
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
            variant={isCurrentlyActive ? "secondary" : "ghost"}
            className={`w-full justify-start h-auto py-3 px-4 ${isChild ? 'ml-4 w-[calc(100%-1rem)]' : ''}`}
            data-testid={`nav-${section.id}`}
          >
            <div className="flex items-center gap-3">
              <section.icon className="h-5 w-5" />
              <span className="font-medium">{section.title}</span>
            </div>
            {isCurrentlyActive && (
              <Badge variant="secondary" className="ml-auto">
                Active
              </Badge>
            )}
          </Button>
        </Link>
      );
    }
  };

  return (
    <div className={`flex flex-col h-full bg-white border-r border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Printyx</h1>
            <p className="text-xs text-gray-500">Business Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 space-y-2 px-3">
        {navigationSections.map((section) => renderNavigationItem(section))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.picture} alt={user?.name} />
            <AvatarFallback>
              {user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.email || 'user@example.com'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CollapsibleSidebar;