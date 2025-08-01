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
  Plug, Rocket, CheckSquare, ChevronRight, BarChart3
} from "lucide-react";

// Navigation structure based on role permissions
function getNavigationSections(userRole: any) {
  const sections = [];
  
  if (!userRole) return sections;

  const permissions = userRole.permissions || {};
  const isPlatformRole = userRole.canAccessAllTenants === true;
  const isCompanyAdmin = userRole.name?.includes('Admin');
  const level = userRole.level || 1;

  // Dashboard - always available
  sections.push({
    name: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
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
        { name: 'Quotes & Proposals', href: '/quotes', icon: FileText },
        { name: 'Companies', href: '/companies', icon: Building2 },
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
        { name: 'Service Tickets', href: '/service-tickets', icon: Wrench },
        { name: 'Meter Readings', href: '/meter-readings', icon: Calculator },
        { name: 'Create Ticket', href: '/create-ticket', icon: UserPlus },
      ]
    });
  }

  // Inventory section
  if (permissions.inventory || isPlatformRole || isCompanyAdmin) {
    sections.push({
      name: 'Inventory',
      items: [
        { name: 'View Inventory', href: '/inventory', icon: Package },
        { name: 'Manage Inventory', href: '/inventory-manage', icon: Package },
        { name: 'Parts & Supplies', href: '/parts', icon: Package },
        { name: 'Suppliers', href: '/suppliers', icon: Building2 },
        { name: 'Purchase Orders', href: '/purchase-orders', icon: ShoppingCart },
      ]
    });
  }

  // Finance section
  if (permissions.finance || isPlatformRole || isCompanyAdmin) {
    sections.push({
      name: 'Billing & Finance',
      items: [
        { name: 'Invoices', href: '/invoices', icon: FileText },
        { name: 'Payments', href: '/payments', icon: DollarSign },
        { name: 'Meter Billing', href: '/billing', icon: Calculator },
        { name: 'Vendors', href: '/vendors', icon: Building2 },
      ]
    });
  }

  // Reports section - show if user has reports permissions or is admin/director level  
  if (permissions.reports || isPlatformRole || isCompanyAdmin || level >= 3) {
    sections.push({
      name: 'Reports',
      items: [
        { name: 'All Reports', href: '/reports', icon: BarChart3 },
        { name: 'Custom Reports', href: '/custom-reports', icon: ClipboardList },
      ]
    });
  }

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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <span className="text-sm font-bold">P</span>
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">Printyx</span>
            <span className="truncate text-xs text-muted-foreground">
              {user?.role?.name || 'User'}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigationSections.map((section, index) => (
          <SidebarGroup key={section.name}>
            <SidebarGroupLabel>{section.name}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.href}
                    >
                      <a href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profileImageUrl || ""} alt={user?.firstName || ""} />
            <AvatarFallback className="text-xs">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user?.role?.name}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}