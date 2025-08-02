import { useLocation } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, Target, FileText, Building2, ClipboardList, Wrench, 
  Calendar, Calculator, UserPlus, Package, ShoppingCart, DollarSign, 
  TrendingUp, Settings, UserCheck, Users, Zap, Smartphone, Activity,
  Plug, Rocket, CheckSquare, ChevronRight, BarChart3, Truck
} from "lucide-react";

// Navigation structure based on role permissions
interface NavigationItem {
  name: string;
  href: string;
  icon: any;
}

interface NavigationSection {
  name: string;
  items: NavigationItem[];
}

function getNavigationSections(userRole: any): NavigationSection[] {
  const sections: NavigationSection[] = [];
  
  if (!userRole) return sections;

  const permissions = userRole.permissions || {};
  const isPlatformRole = userRole.canAccessAllTenants === true;
  const isCompanyAdmin = userRole.name?.includes('Admin');
  const level = userRole.level || 1;
  
  // Determine URL prefix based on role level and permissions
  const useAdminRoutes = isPlatformRole || isCompanyAdmin || level >= 4;
  const adminPrefix = useAdminRoutes ? '/admin' : '';

  // Dashboard - always available
  sections.push({
    name: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ]
  });

  // Sales & CRM section
  if (permissions.sales || isPlatformRole || isCompanyAdmin) {
    sections.push({
      name: 'Sales & CRM',
      items: [
        { name: 'CRM & Pipeline', href: '/crm', icon: Target },
        { name: 'Contacts', href: '/contacts', icon: Users },
        { name: 'Deals Pipeline', href: '/deals', icon: Target },
        { name: 'Customers', href: '/customers', icon: Building2 },
        { name: 'Contracts', href: '/contracts', icon: ClipboardList },
        { name: 'Task Management', href: '/task-management', icon: CheckSquare },
      ]
    });
  }

  // Service section
  if (permissions.service || isPlatformRole || isCompanyAdmin) {
    sections.push({
      name: 'Service',
      items: [
        { name: 'Service Dispatch', href: '/service-dispatch', icon: Calendar },
        { name: 'Meter Readings', href: '/meter-readings', icon: Calculator },
      ]
    });
  }

  // Product Management section
  if (permissions.inventory || isPlatformRole || isCompanyAdmin) {
    sections.push({
      name: 'Product Management',
      items: [
        { name: 'Product Hub', href: `${adminPrefix}/product-hub`, icon: Package },
        { name: 'Equipment Lifecycle', href: `${adminPrefix}/equipment-lifecycle`, icon: Settings },
        { name: 'Purchase Orders', href: `${adminPrefix}/purchase-orders`, icon: ShoppingCart },
        { name: 'Warehouse Operations', href: `${adminPrefix}/warehouse-operations`, icon: Truck },
        { name: 'Inventory', href: '/inventory', icon: Package },
        { name: 'Supplies', href: `${adminPrefix}/supplies`, icon: Package },
        { name: 'Product Models', href: `${adminPrefix}/product-models`, icon: Package },
        { name: 'Product Accessories', href: `${adminPrefix}/product-accessories`, icon: Package },
      ]
    });
  }

  // Finance section
  if (permissions.finance || isPlatformRole || isCompanyAdmin) {
    sections.push({
      name: 'Billing & Finance',
      items: [
        { name: 'Invoices', href: '/invoices', icon: FileText },
        { name: 'Meter Billing', href: '/billing', icon: Calculator },
        { name: 'Vendors', href: '/vendors', icon: Building2 },
        { name: 'Accounts Payable', href: '/accounts-payable', icon: DollarSign },
        { name: 'Accounts Receivable', href: '/accounts-receivable', icon: DollarSign },
      ]
    });
  }

  // Reports section - show if user has reports permissions or is admin/director level  
  if (permissions.reports || isPlatformRole || isCompanyAdmin || level >= 3) {
    sections.push({
      name: 'Reports',
      items: [
        { name: 'Reports', href: '/reports', icon: BarChart3 },
        { name: 'Advanced Reporting', href: '/advanced-reporting', icon: TrendingUp },
      ]
    });
  }

  // System Administration section (for platform roles and high-level admins)
  if (isPlatformRole || (isCompanyAdmin && level >= 4)) {
    sections.push({
      name: 'System Administration',
      items: [
        { name: 'Workflow Automation', href: '/workflow-automation', icon: Zap },
        { name: 'System Integrations', href: '/system-integrations', icon: Plug },
        { name: 'Deployment Readiness', href: '/deployment-readiness', icon: Rocket },
        { name: 'Performance Monitoring', href: '/performance-monitoring', icon: Activity },
      ]
    });
  }

  // Platform-only section
  if (isPlatformRole) {
    sections.push({
      name: 'Platform Management',
      items: [
        { name: 'Tenant Setup', href: '/tenant-setup', icon: Settings },
        { name: 'Pricing Management', href: `${adminPrefix}/pricing-management`, icon: DollarSign },
      ]
    });
  }

  // User Settings - always available
  sections.push({
    name: 'Account',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ]
  });

  return sections;
}

export default function RoleBasedSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // Check if user is a platform role
  const isPlatformRole = user?.role?.canAccessAllTenants === true;
  
  // Fetch available tenants for platform users
  const { data: tenants, error: tenantsError } = useQuery({
    queryKey: ['/api/tenants'],
    enabled: isPlatformRole,
  });

  // Get navigation sections based on user role
  const navigationSections = getNavigationSections(user?.role);

  return (
    <Sidebar collapsible="icon" className="bg-white border-r border-gray-200">
      <SidebarHeader className="bg-white border-b border-gray-100">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <span className="text-sm font-bold">P</span>
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold text-gray-900">Printyx</span>
            <span className="truncate text-xs text-gray-500">
              {user?.role?.name || 'User'}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-white">
        {navigationSections.map((section, index) => (
          <SidebarGroup key={section.name}>
            <SidebarGroupLabel className="text-gray-600 font-medium text-xs uppercase tracking-wide px-4 py-2">
              {section.name}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item: NavigationItem) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.href}
                      className="mx-2 mb-1 rounded-md hover:bg-gray-50 data-[active=true]:bg-blue-50 data-[active=true]:text-blue-700 data-[active=true]:border-blue-200"
                    >
                      <a href={item.href} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:text-gray-900">
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="bg-white border-t border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profileImageUrl || ""} alt={user?.firstName || ""} />
            <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium text-gray-900">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="truncate text-xs text-gray-500">
              {user?.role?.name}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}