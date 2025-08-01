import { useState } from "react";
import { useLocation } from "wouter";
import { Menu, X, BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { 
  Target, FileText, Building2, ClipboardList, Wrench, Calendar, 
  Calculator, UserPlus, Package, ShoppingCart, DollarSign, 
  TrendingUp, Settings, UserCheck, Users 
} from "lucide-react";

// Navigation structure (same as desktop)
const navigationStructure = {
  sales: {
    label: "Sales & CRM",
    icon: Target,
    modules: [
      { key: 'leads', label: 'Lead Pipeline', path: '/crm', icon: Target },
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
    ]
  }
};

// Role permissions (simplified for mobile)
const rolePermissions = {
  ADMIN: {
    sales: ['*'],
    service: ['*'],
    inventory: ['*'],
    billing: ['*'],
    reports: ['*'],
    admin: ['*']
  },
  SALES_MANAGER: {
    sales: ['*'],
    service: ['view-tickets'],
    inventory: ['inventory-view'],
    billing: ['invoices', 'meter-billing'],
    reports: ['*'],
    admin: ['user-management-sales', 'team-management']
  },
  SALES_REP: {
    sales: ['leads', 'quotes', 'my-customers', 'my-contracts'],
    service: ['my-tickets'],
    inventory: ['inventory-view'],
    billing: ['invoices'],
    reports: ['my-sales-reports'],
    admin: []
  },
  SERVICE_MANAGER: {
    sales: ['all-customers', 'all-contracts'],
    service: ['*'],
    inventory: ['*'],
    billing: ['meter-billing'],
    reports: ['*'],
    admin: ['user-management-service', 'technician-management']
  },
  TECHNICIAN: {
    sales: ['my-customers'],
    service: ['my-tickets', 'meter-readings'],
    inventory: ['inventory-view', 'parts-management'],
    billing: [],
    reports: ['my-service-reports'],
    admin: []
  }
};

interface MobileNavProps {
  className?: string;
}

export default function MobileNav({ className }: MobileNavProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['sales', 'service']);

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
    const deptPermissions = userPermissions[department as keyof typeof userPermissions] as string[] | undefined;
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
            className="w-full justify-start text-gray-700 hover:text-blue-900 hover:bg-blue-50 mb-1 h-12"
          >
            <SectionIcon className="h-5 w-5 mr-3" />
            <span className="flex-1 text-left font-medium">{section.label}</span>
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
                    "w-full justify-start text-sm h-11",
                    isActive
                      ? "bg-blue-100 text-blue-900 font-medium"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  )}
                  onClick={() => setIsOpen(false)}
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
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn("md:hidden", className)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0 flex flex-col h-full">
        <SheetHeader className="p-6 border-b border-gray-200 flex-shrink-0">
          <SheetTitle className="text-left">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Printyx</h1>
            </div>
            {user && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500">
                  {user.role?.name || 'User'} • {user.team?.name || 'Unassigned'}
                </p>
              </div>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4">
            <nav className="space-y-2 pb-6">
              {/* Dashboard - always visible */}
              <Link href="/">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start mb-4 h-12",
                    location === "/"
                      ? "bg-blue-100 text-blue-900 font-medium"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <BarChart3 className="h-5 w-5 mr-3" />
                  <span className="font-medium">Dashboard</span>
                </Button>
              </Link>

              {/* Role-based navigation sections */}
              {Object.entries(navigationStructure).map(([sectionKey, section]) =>
                renderNavSection(sectionKey, section)
              )}
            </nav>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}