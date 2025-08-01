import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import {
  Users,
  Wrench,
  FileText,
  Calculator,
  Package,
  BarChart3,
  Settings,
  UserPlus,
  TrendingUp,
  ClipboardList,
  DollarSign,
  Calendar,
  ShoppingCart,
  Building2,
  UserCheck,
  Phone,
  Target,
  ChevronDown,
  ChevronRight,
  Zap,
  Smartphone,
  Activity,
  Plug,
  Rocket,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Define module permissions based on roles and departments
const rolePermissions = {
  // Sales Team Permissions
  SALES_REP: {
    sales: ['crm', 'leads', 'quotes', 'my-customers', 'my-contracts'],
    service: ['view-tickets'], // view only for customer context
    reports: ['my-sales-reports'],
  },
  SALES_TEAM_LEAD: {
    sales: ['crm', 'leads', 'quotes', 'team-customers', 'team-contracts', 'team-management'],
    service: ['view-tickets'],
    reports: ['team-sales-reports', 'my-sales-reports'],
  },
  SALES_MANAGER: {
    sales: ['crm', 'leads', 'quotes', 'all-customers', 'all-contracts', 'team-management', 'territory-management'],
    service: ['view-tickets', 'create-tickets'],
    reports: ['all-sales-reports', 'team-performance'],
    admin: ['user-management-sales'],
  },
  SALES_DIRECTOR: {
    sales: ['*'], // all sales modules
    service: ['view-tickets', 'create-tickets'],
    reports: ['*'], // all sales and performance reports
    admin: ['user-management-sales', 'sales-settings'],
  },

  // Service Team Permissions
  SERVICE_TECH: {
    service: ['my-tickets', 'dispatch', 'meter-readings', 'inventory-view'],
    customers: ['view-assigned'],
    reports: ['my-service-reports'],
  },
  SERVICE_SUPERVISOR: {
    service: ['team-tickets', 'dispatch', 'meter-readings', 'inventory-management', 'technician-management'],
    customers: ['view-all'],
    reports: ['team-service-reports'],
  },
  SERVICE_MANAGER: {
    service: ['*'], // all service modules
    customers: ['view-all', 'edit-service-info'],
    inventory: ['*'],
    reports: ['all-service-reports'],
    admin: ['user-management-service'],
  },

  // Finance Team Permissions
  FINANCE_CLERK: {
    billing: ['invoices', 'payments', 'meter-billing', 'vendors', 'accounts-payable', 'accounts-receivable'],
    customers: ['view-billing-info'],
    reports: ['billing-reports'],
  },
  FINANCE_MANAGER: {
    billing: ['*'],
    customers: ['view-all', 'edit-billing-info'],
    reports: ['all-financial-reports'],
    admin: ['billing-settings'],
  },

  // Purchasing Team Permissions
  PURCHASING_CLERK: {
    inventory: ['parts-management', 'suppliers', 'purchase-orders'],
    billing: ['vendors'],
    reports: ['inventory-reports'],
  },
  PURCHASING_MANAGER: {
    inventory: ['*'],
    reports: ['all-inventory-reports'],
    admin: ['supplier-management'],
  },

  // Admin Permissions
  ADMIN: {
    sales: ['*'],
    service: ['*'],
    billing: ['*'],
    inventory: ['*'],
    reports: ['*'],
    admin: ['*'],
  },
  COMPANY_OWNER: {
    sales: ['*'],
    service: ['*'],
    billing: ['*'],
    inventory: ['*'],
    reports: ['*'],
    admin: ['*'],
  },
};

// Navigation structure organized by department
const navigationStructure = {
  sales: {
    label: "Sales",
    icon: TrendingUp,
    modules: [
      { key: 'crm', label: 'CRM & Leads', path: '/crm', icon: Users },
      { key: 'leads', label: 'Lead Pipeline', path: '/leads', icon: Target },
      { key: 'quotes', label: 'Quotes & Proposals', path: '/quotes', icon: FileText },
      { key: 'my-customers', label: 'My Customers', path: '/my-customers', icon: Building2 },
      { key: 'team-customers', label: 'Team Customers', path: '/team-customers', icon: Building2 },
      { key: 'all-customers', label: 'All Customers', path: '/customers', icon: Building2 },
      { key: 'my-contracts', label: 'My Contracts', path: '/my-contracts', icon: ClipboardList },
      { key: 'team-contracts', label: 'Team Contracts', path: '/team-contracts', icon: ClipboardList },
      { key: 'all-contracts', label: 'All Contracts', path: '/contracts', icon: ClipboardList },
    ]
  },
  service: {
    label: "Service",
    icon: Wrench,
    modules: [
      { key: 'my-tickets', label: 'My Tickets', path: '/my-tickets', icon: Wrench },
      { key: 'team-tickets', label: 'Team Tickets', path: '/team-tickets', icon: Wrench },
      { key: 'dispatch', label: 'Service Dispatch', path: '/service-dispatch', icon: Calendar },
      { key: 'meter-readings', label: 'Meter Readings', path: '/meter-readings', icon: Calculator },
      { key: 'view-tickets', label: 'Service Tickets', path: '/service-tickets', icon: Wrench },
      { key: 'create-tickets', label: 'Create Ticket', path: '/create-ticket', icon: UserPlus },
    ]
  },
  inventory: {
    label: "Inventory",
    icon: Package,
    modules: [
      { key: 'inventory-view', label: 'View Inventory', path: '/inventory', icon: Package },
      { key: 'inventory-management', label: 'Manage Inventory', path: '/inventory-manage', icon: Package },
      { key: 'parts-management', label: 'Parts & Supplies', path: '/parts', icon: Package },
      { key: 'suppliers', label: 'Suppliers', path: '/suppliers', icon: Building2 },
      { key: 'purchase-orders', label: 'Purchase Orders', path: '/purchase-orders', icon: ShoppingCart },
    ]
  },
  billing: {
    label: "Billing & Finance",
    icon: DollarSign,
    modules: [
      { key: 'invoices', label: 'Invoices', path: '/invoices', icon: FileText },
      { key: 'payments', label: 'Payments', path: '/payments', icon: DollarSign },
      { key: 'meter-billing', label: 'Meter Billing', path: '/billing', icon: Calculator },
      { key: 'vendors', label: 'Vendors', path: '/vendors', icon: Building2 },
      { key: 'accounts-payable', label: 'Accounts Payable', path: '/accounts-payable', icon: FileText },
      { key: 'accounts-receivable', label: 'Accounts Receivable', path: '/accounts-receivable', icon: DollarSign },
      { key: 'chart-of-accounts', label: 'Chart of Accounts', path: '/chart-of-accounts', icon: Calculator },
      { key: 'journal-entries', label: 'Journal Entries', path: '/journal-entries', icon: FileText },
    ]
  },
  reports: {
    label: "Reports & Analytics",
    icon: BarChart3,
    modules: [
      { key: 'my-sales-reports', label: 'My Sales Reports', path: '/my-reports', icon: BarChart3 },
      { key: 'team-sales-reports', label: 'Team Sales Reports', path: '/team-reports', icon: BarChart3 },
      { key: 'all-sales-reports', label: 'All Sales Reports', path: '/sales-reports', icon: BarChart3 },
      { key: 'my-service-reports', label: 'My Service Reports', path: '/my-service-reports', icon: BarChart3 },
      { key: 'team-service-reports', label: 'Team Service Reports', path: '/team-service-reports', icon: BarChart3 },
      { key: 'all-service-reports', label: 'All Service Reports', path: '/service-reports', icon: BarChart3 },
      { key: 'billing-reports', label: 'Billing Reports', path: '/billing-reports', icon: BarChart3 },
      { key: 'all-financial-reports', label: 'Financial Reports', path: '/financial-reports', icon: BarChart3 },
      { key: 'inventory-reports', label: 'Inventory Reports', path: '/inventory-reports', icon: BarChart3 },
      { key: 'team-performance', label: 'Performance Analytics', path: '/performance', icon: TrendingUp },
      { key: 'advanced-reporting', label: 'Advanced Analytics', path: '/advanced-reporting', icon: TrendingUp },
    ]
  },
  admin: {
    label: "Administration",
    icon: Settings,
    modules: [
      { key: 'user-management-sales', label: 'Sales Team Management', path: '/admin/sales-users', icon: UserCheck },
      { key: 'user-management-service', label: 'Service Team Management', path: '/admin/service-users', icon: UserCheck },
      { key: 'team-management', label: 'Teams & Territories', path: '/admin/teams', icon: Users },
      { key: 'territory-management', label: 'Territory Management', path: '/admin/territories', icon: Building2 },
      { key: 'technician-management', label: 'Technician Management', path: '/admin/technicians', icon: Wrench },
      { key: 'supplier-management', label: 'Supplier Management', path: '/admin/suppliers', icon: Building2 },
      { key: 'sales-settings', label: 'Sales Settings', path: '/admin/sales-settings', icon: Settings },
      { key: 'billing-settings', label: 'Billing Settings', path: '/admin/billing-settings', icon: Settings },
      { key: 'workflow-automation', label: 'Workflow Automation', path: '/workflow-automation', icon: Zap },
      { key: 'mobile-optimization', label: 'Mobile Optimization', path: '/mobile-optimization', icon: Smartphone },
      { key: 'performance-monitoring', label: 'Performance Monitoring', path: '/performance-monitoring', icon: Activity },
      { key: 'system-integrations', label: 'System Integrations', path: '/system-integrations', icon: Plug },
      { key: 'deployment-readiness', label: 'Deployment Readiness', path: '/deployment-readiness', icon: Rocket },
    ]
  }
};

interface RoleBasedSidebarProps {
  className?: string;
}

export default function RoleBasedSidebar({ className }: RoleBasedSidebarProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const [expandedSections, setExpandedSections] = useState<string[]>(['sales', 'service']);

  // Mock user role for now - this would come from the actual user data
  const userRole = user?.role?.code || 'SALES_REP';
  const userPermissions = rolePermissions[userRole as keyof typeof rolePermissions] || {};

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const hasPermission = (department: string, moduleKey: string) => {
    const deptPermissions = userPermissions[department as keyof typeof userPermissions];
    if (!deptPermissions) return false;
    
    return deptPermissions.includes('*') || deptPermissions.includes(moduleKey);
  };

  const getVisibleModules = (department: string, modules: any[]) => {
    return modules.filter(module => hasPermission(department, module.key));
  };

  const renderNavSection = (sectionKey: string, section: any) => {
    const visibleModules = getVisibleModules(sectionKey, section.modules);
    
    if (visibleModules.length === 0) return null;

    const isExpanded = expandedSections.includes(sectionKey);
    const SectionIcon = section.icon;

    return (
      <Collapsible key={sectionKey} open={isExpanded} onOpenChange={() => toggleSection(sectionKey)}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-gray-700 hover:text-primary-900 hover:bg-primary-50 mb-1"
          >
            <SectionIcon className="h-4 w-4 mr-3" />
            <span className="flex-1 text-left">{section.label}</span>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 ml-4">
          {visibleModules.map((module) => {
            const ModuleIcon = module.icon;
            const isActive = location === module.path || location.startsWith(module.path + '/');
            
            return (
              <Link key={module.key} href={module.path}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-sm",
                    isActive
                      ? "bg-primary-100 text-primary-900 font-medium"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  <ModuleIcon className="h-4 w-4 mr-3" />
                  {module.label}
                </Button>
              </Link>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className={cn("w-64 bg-white border-r border-gray-200 flex flex-col", className)}>
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Printyx</h1>
        {user && (
          <div className="mt-2">
            <p className="text-sm font-medium text-gray-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-gray-500">
              {user.role?.name || 'User'} • {user.team?.name || 'Unassigned'}
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {/* Dashboard - always visible */}
        <Link href="/">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start mb-4",
              location === "/"
                ? "bg-primary-100 text-primary-900 font-medium"
                : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            <BarChart3 className="h-4 w-4 mr-3" />
            Dashboard
          </Button>
        </Link>

        {/* Role-based navigation sections */}
        {Object.entries(navigationStructure).map(([sectionKey, section]) =>
          renderNavSection(sectionKey, section)
        )}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <Link href="/profile">
          <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-gray-900">
            <Settings className="h-4 w-4 mr-3" />
            Settings
          </Button>
        </Link>
      </div>
    </div>
  );
}