import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
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
  Rocket,
  ClipboardList,
  FileSignature,
  Code,
  Menu,
  X
} from "lucide-react";

interface NavigationItem {
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavigationSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  children?: NavigationItem[];
  matchPatterns?: string[];
}

interface RoleAwareCollapsibleSidebarProps {
  className?: string;
}

// Static navigation structure - prevents hook ordering issues
const createNavigationSections = (userRole: any): NavigationSection[] => {
  if (!userRole) return [];

  const permissions = userRole.permissions || {};
  const isPlatformRole = userRole.canAccessAllTenants === true;
  const isCompanyAdmin = userRole.name?.includes("Admin");
  const level = userRole.level || 1;
  const useAdminRoutes = isPlatformRole || isCompanyAdmin || level >= 4;
  const adminPrefix = useAdminRoutes ? "/admin" : "";

  const sections: NavigationSection[] = [];

  // Always visible
  sections.push({
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
    matchPatterns: ['/dashboard*']
  });

  // Platform Admin Hub - Only for platform roles
  if (isPlatformRole) {
    sections.push({
      id: 'platform-admin',
      title: 'Platform Admin',
      icon: Crown,
      path: `${adminPrefix}/platform`,
      matchPatterns: [`${adminPrefix}/platform*`, `${adminPrefix}/root-admin*`, `${adminPrefix}/system*`, `${adminPrefix}/tenant*`],
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

  // CRM Hub
  if (permissions.sales || isPlatformRole || isCompanyAdmin) {
    sections.push({
      id: 'crm',
      title: 'CRM Hub',
      icon: Target,
      path: '/crm',
      matchPatterns: ['/crm*', '/leads*', '/contacts*', '/deals*', '/opportunities*', '/sales-pipeline*', '/quote*', '/proposal*', '/demo*', '/contracts*', '/commission*', '/customer-success*'],
      children: [
        { title: 'CRM Dashboard', path: '/crm', icon: Target },
        { title: 'Leads Management', path: '/leads-management', icon: UserPlus },
        { title: 'Contacts', path: '/contacts', icon: Users },
        { title: 'Opportunities', path: '/opportunities', icon: Target },
        { title: 'Sales Pipeline', path: '/sales-pipeline', icon: TrendingUp },
        { title: 'Quotes & Proposals', path: '/quote-proposal-generation', icon: FileText },
        { title: 'Proposal Builder', path: '/proposal-builder', icon: Wand2 },
        { title: 'Customer Success', path: '/customer-success-management', icon: UserCheck }
      ]
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
        { title: 'Technician Management', path: '/technician-management', icon: Users }
      ]
    });
  }

  // Product Hub
  if (permissions.products || isPlatformRole || isCompanyAdmin) {
    sections.push({
      id: 'products',
      title: 'Product Hub',
      icon: Package,
      path: '/product-hub',
      matchPatterns: ['/product*', '/supplies*', '/professional-services*', '/managed-services*', '/software-products*'],
      children: [
        { title: 'Product Models', path: '/product-models', icon: Package },
        { title: 'Product Accessories', path: '/product-accessories', icon: Layers },
        { title: 'Supplies', path: '/supplies', icon: Package },
        { title: 'Professional Services', path: '/professional-services', icon: FileText },
        { title: 'Managed Services', path: '/managed-services', icon: Crown },
        { title: 'Software Products', path: '/software-products', icon: Code }
      ]
    });
  }

  // Equipment Lifecycle Hub
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
        { title: 'Accounts Receivable', path: '/accounts-receivable', icon: CreditCard }
      ]
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
        { title: 'Performance Monitoring', path: '/performance-monitoring', icon: Activity }
      ]
    });
  }

  // Task Management Hub - Always available
  sections.push({
    id: 'tasks',
    title: 'Task Management',
    icon: CheckSquare,
    path: '/tasks',
    matchPatterns: ['/task*'],
    children: [
      { title: 'Advanced Tasks', path: '/task-management', icon: Brain },
      { title: 'Basic Tasks', path: '/basic-task-management', icon: CheckSquare }
    ]
  });

  // Always visible core sections
  sections.push(
    {
      id: 'customers',
      title: 'Customers',
      icon: Building2,
      path: '/customers',
      matchPatterns: ['/customers*']
    },
    {
      id: 'integrations',
      title: 'Integrations',
      icon: Plug,
      path: '/integrations',
      matchPatterns: ['/integrations*']
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: Settings,
      path: '/settings',
      matchPatterns: ['/settings*']
    }
  );

  return sections;
};

export function RoleAwareCollapsibleSidebar({ className, ...props }: RoleAwareCollapsibleSidebarProps) {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [userExpandedSections, setUserExpandedSections] = useState<Set<string>>(new Set());


  // Use role from user object instead of separate API call
  const userRole = user?.role;

  // Stable navigation sections
  const navigationSections = useMemo(() => 
    createNavigationSections(userRole), 
    [userRole?.name, userRole?.canAccessAllTenants, userRole?.level, JSON.stringify(userRole?.permissions)]
  );

  // Debug removed for cleaner console output

  // Auto-expand based on current route
  useEffect(() => {
    const currentSection = navigationSections.find(section => {
      if (location === section.path) return true;
      
      if (section.matchPatterns) {
        return section.matchPatterns.some(pattern => {
          const regexPattern = pattern.replace(/\*/g, '.*');
          const regex = new RegExp(`^${regexPattern}`);
          return regex.test(location);
        });
      }

      if (section.children) {
        return section.children.some(child => location === child.path);
      }

      return false;
    });

    setExpandedSections(prevExpanded => {
      const newExpanded = new Set<string>();
      
      // Keep user-expanded sections
      userExpandedSections.forEach(sectionId => {
        newExpanded.add(sectionId);
      });

      // Add current section
      if (currentSection) {
        newExpanded.add(currentSection.id);
      }

      return newExpanded;
    });
  }, [location, navigationSections, userExpandedSections]);

  const toggleSection = (sectionId: string) => {
    setUserExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const isExpanded = (sectionId: string) => expandedSections.has(sectionId);
  const isActive = (path: string) => location === path || location.startsWith(path + '/');

  if (!isAuthenticated) {
    return (
      <div className={`bg-white border-r border-gray-200 ${className}`}>
        <div className="p-4">
          <div className="text-gray-500">Not authenticated</div>
        </div>
      </div>
    );
  }



  if (!navigationSections || navigationSections.length === 0) {
    return (
      <div className={`bg-white border-r border-gray-200 ${className}`}>
        <div className="p-4">
          <div className="text-gray-500">No navigation sections available</div>
          <div className="text-xs text-gray-400 mt-1">Role: {JSON.stringify(userRole)}</div>
        </div>
      </div>
    );
  }

  const renderNavigationItem = (section: NavigationSection) => {
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
              className="w-full justify-between h-auto py-3 px-4 mb-1"
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

          <CollapsibleContent className="space-y-1 ml-4 mr-2 border-l border-gray-200 pl-4">
            {section.children?.map((child) => (
              <Link key={child.path} href={child.path}>
                <Button
                  variant={isActive(child.path) ? "secondary" : "ghost"}
                  className="w-full justify-start h-auto py-2 px-3 text-sm"
                  data-testid={`nav-${child.path.replace(/[^a-zA-Z0-9]/g, '-')}`}
                >
                  <child.icon className="h-4 w-4 mr-2" />
                  {child.title}
                </Button>
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    // Single item without children
    return (
      <Link key={section.id} href={section.path}>
        <Button
          variant={shouldShowAsActive ? "secondary" : "ghost"}
          className="w-full justify-start h-auto py-3 px-4 mb-1"
          data-testid={`nav-${section.id}`}
        >
          <div className="flex items-center gap-3">
            <section.icon className="h-5 w-5" />
            <span className="font-medium">{section.title}</span>
          </div>
        </Button>
      </Link>
    );
  };

  const { open, openMobile, isMobile } = useSidebar();
  const sidebarOpen = isMobile ? openMobile : open;

  return (
    <Sidebar collapsible="icon" className="bg-slate-50 border-r border-slate-200" {...props}>
      <SidebarHeader className="border-b border-slate-200 bg-white">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center shadow-lg">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <h1 className="text-xl font-bold text-slate-900">Printyx</h1>
                <p className="text-xs text-slate-600 font-medium">Business Management</p>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent className="py-6 px-4">
        <SidebarGroup>
          <SidebarGroupContent className="space-y-3">
            <SidebarMenu>
              {navigationSections.map((section) => {
                const shouldShowAsActive = section.children
                  ? section.children.some(child => isActive(child.path)) || isActive(section.path) ||
                    (section.matchPatterns?.some(pattern => isActive(pattern)) ?? false)
                  : isActive(section.path) || (section.matchPatterns?.some(pattern => isActive(pattern)) ?? false);

                if (section.children) {
                  return (
                    <Collapsible key={section.id} open={isExpanded(section.id)} onOpenChange={() => toggleSection(section.id)}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton 
                            className={cn(
                              "w-full justify-between py-3 px-4 rounded-lg transition-all duration-200",
                              shouldShowAsActive
                                ? "bg-slate-800 hover:bg-slate-700 text-white" 
                                : "hover:bg-slate-100 text-slate-700",
                              "font-semibold text-sm mb-1"
                            )}
                            data-active={shouldShowAsActive}
                            data-testid={`nav-${section.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <section.icon className={cn(
                                "h-5 w-5", 
                                shouldShowAsActive ? "text-white" : "text-slate-600"
                              )} />
                              <span className="font-semibold">{section.title}</span>
                            </div>
                            {isExpanded(section.id) ? (
                              <ChevronDown className={cn(
                                "h-4 w-4", 
                                shouldShowAsActive ? "text-white" : "text-slate-500"
                              )} />
                            ) : (
                              <ChevronRight className={cn(
                                "h-4 w-4", 
                                shouldShowAsActive ? "text-white" : "text-slate-500"
                              )} />
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="ml-2 mt-1">
                          <SidebarMenu>
                            {section.children.map((child) => (
                              <SidebarMenuItem key={child.path}>
                                <SidebarMenuButton 
                                  asChild 
                                  className={cn(
                                    "py-2.5 px-4 ml-6 rounded-md transition-all duration-200 text-sm font-normal",
                                    "border-l-2 border-transparent hover:border-slate-300",
                                    isActive(child.path)
                                      ? "bg-blue-50 hover:bg-blue-100 text-blue-700 border-l-blue-500" 
                                      : "hover:bg-slate-50 text-slate-600"
                                  )}
                                  data-active={isActive(child.path)}
                                  data-testid={`nav-${child.path.replace(/[^a-zA-Z0-9]/g, '-')}`}
                                >
                                  <Link href={child.path}>
                                    <child.icon className={cn(
                                      "h-4 w-4", 
                                      isActive(child.path) ? "text-blue-600" : "text-slate-500"
                                    )} />
                                    <span>{child.title}</span>
                                    {isActive(child.path) && (
                                      <Badge className="ml-auto bg-blue-600 text-white text-xs">
                                        Active
                                      </Badge>
                                    )}
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={section.id}>
                    <SidebarMenuButton 
                      asChild 
                      className={cn(
                        "py-3 px-4 rounded-lg transition-all duration-200",
                        shouldShowAsActive
                          ? "bg-slate-800 hover:bg-slate-700 text-white" 
                          : "hover:bg-slate-100 text-slate-700",
                        "font-semibold text-sm mb-1"
                      )}
                      data-active={shouldShowAsActive}
                      data-testid={`nav-${section.id}`}
                    >
                      <Link href={section.path}>
                        <section.icon className={cn(
                          "h-5 w-5", 
                          shouldShowAsActive ? "text-white" : "text-slate-600"
                        )} />
                        <span className="font-semibold">{section.title}</span>
                        {shouldShowAsActive && (
                          <Badge className="ml-auto bg-blue-600 text-white text-xs">
                            Active
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User Profile Footer */}
      <div className="mt-auto p-4 border-t">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-blue-100 text-blue-600">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="group-data-[collapsible=icon]:hidden flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.username || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {userRole?.name || 'User'}
            </p>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}