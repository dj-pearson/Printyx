import { useState, useEffect, useMemo } from "react";
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
  Rocket,
  ClipboardList,
  FileSignature
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
      matchPatterns: ['/crm*', '/leads*', '/contacts*', '/deals*', '/sales-pipeline*', '/quote*', '/proposal*', '/demo*', '/contracts*', '/commission*', '/customer-success*'],
      children: [
        { title: 'CRM Dashboard', path: '/crm', icon: Target },
        { title: 'Leads Management', path: '/leads-management', icon: UserPlus },
        { title: 'Contacts', path: '/contacts', icon: Users },
        { title: 'Deals Management', path: '/deals-management', icon: Target },
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
        { title: 'Accessories', path: '/product-accessories', icon: Layers },
        { title: 'Supplies', path: '/supplies', icon: Package },
        { title: 'Professional Services', path: '/professional-services', icon: FileText },
        { title: 'Managed Services', path: '/managed-services', icon: Crown }
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

export function RoleAwareCollapsibleSidebar({ className }: RoleAwareCollapsibleSidebarProps) {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [userExpandedSections, setUserExpandedSections] = useState<Set<string>>(new Set());

  // Fetch user role
  const { data: userRole } = useQuery({
    queryKey: ["/api/auth/role"],
    enabled: isAuthenticated,
  });

  // Stable navigation sections
  const navigationSections = useMemo(() => 
    createNavigationSections(userRole), 
    [userRole?.name, userRole?.canAccessAllTenants, userRole?.level, JSON.stringify(userRole?.permissions)]
  );

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
    return null;
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

  return (
    <div className={`bg-white border-r border-gray-200 ${className}`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-semibold text-sm">P</span>
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Printyx</h1>
              <p className="text-xs text-gray-500">Business Management</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navigationSections.map(renderNavigationItem)}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.username || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {userRole?.name || 'User'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}