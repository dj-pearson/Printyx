import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Wrench, 
  Package, 
  Calculator, 
  BarChart3,
  Settings,
  Printer,
  TrendingUp,
  Target,
  DollarSign,
  ClipboardList,
  Shield,
  UserCog,
  PieChart,
  Building2,
  ChevronDown
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// Get navigation sections based on user role
function getNavigationSections(userRole: any) {
  if (!userRole) return [];

  const roleCode = userRole.code;
  const department = userRole.department;
  const level = userRole.level;
  const permissions = userRole.permissions || {};
  
  // Platform roles get full access
  const isPlatformRole = roleCode === 'ROOT_ADMIN' || roleCode === 'PRINTYX_SUPPORT' || roleCode === 'PRINTYX_TECHNICAL';
  const isCompanyAdmin = roleCode === 'COMPANY_ADMIN';
  
  // Build navigation sections based on permissions
  const sections = [];
  
  // Overview - everyone gets this
  sections.push({
    name: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Customers', href: '/customers', icon: Users },
    ]
  });

  // Sales section - show if user has sales permissions or is admin/director level
  if (permissions.sales || isPlatformRole || isCompanyAdmin || level >= 4) {
    sections.push({
      name: 'Sales',
      items: [
        { name: 'CRM & Pipeline', href: '/crm', icon: Target },
        { name: 'Quotes & Proposals', href: '/quotes', icon: FileText },
        { name: 'Sales Reports', href: '/sales-reports', icon: TrendingUp },
      ]
    });
  }

  // Service section - show if user has service permissions or is admin/director level
  if (permissions.service || isPlatformRole || isCompanyAdmin || level >= 4) {
    sections.push({
      name: 'Service',
      items: [
        { name: 'Service Dispatch', href: '/service-dispatch', icon: Wrench },
        { name: 'Meter Readings', href: '/meter-readings', icon: Calculator },
        { name: 'Service Reports', href: '/service-reports', icon: ClipboardList },
      ]
    });
  }

  // Financial section - show if user has finance permissions or is admin/director level
  if (permissions.finance || isPlatformRole || isCompanyAdmin || level >= 4) {
    sections.push({
      name: 'Financial',
      items: [
        { name: 'Invoices', href: '/invoices', icon: FileText },
        { name: 'Revenue Reports', href: '/revenue-reports', icon: DollarSign },
        { name: 'Financial Analytics', href: '/financial-analytics', icon: PieChart },
      ]
    });
  }

  // Admin section - show for platform roles, company admin, or director+ level
  if (isPlatformRole || isCompanyAdmin || level >= 4 || permissions.admin) {
    sections.push({
      name: 'Admin',
      items: [
        { name: 'Product Models', href: '/product-models', icon: Printer },
        { name: 'Product Accessories', href: '/product-accessories', icon: Package },
        { name: 'Professional Services', href: '/professional-services', icon: Package },
        { name: 'Service Products', href: '/service-products', icon: Package },
        { name: 'Software Products', href: '/software-products', icon: Package },
        { name: 'Supplies', href: '/supplies', icon: Package },
        { name: 'IT & Managed Services', href: '/managed-services', icon: Package },
        { name: 'Inventory', href: '/inventory', icon: Package },
        { name: 'Contracts', href: '/contracts', icon: FileText },
        { name: 'User Management', href: '/user-management', icon: UserCog },
        { name: 'System Settings', href: '/settings', icon: Shield },
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

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // Check if user is a platform role
  const isPlatformRole = user?.role?.canAccessAllTenants === true;
  
  // Fetch available tenants for platform users
  const { data: tenants } = useQuery({
    queryKey: ['/api/tenants'],
    enabled: isPlatformRole,
  });

  // Get navigation sections based on user role
  const navigationSections = getNavigationSections(user?.role);

  // Handle tenant selection for platform users
  const handleTenantChange = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    // Store selected tenant in localStorage for persistence
    localStorage.setItem('selectedTenantId', tenantId);
  };

  // Load saved tenant selection on mount
  useEffect(() => {
    if (isPlatformRole) {
      const savedTenantId = localStorage.getItem('selectedTenantId');
      if (savedTenantId) {
        setSelectedTenantId(savedTenantId);
      }
    }
  }, [isPlatformRole]);

  return (
    <aside className="hidden lg:flex w-64 bg-white shadow-sm border-r border-gray-200 flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Printer className="text-white text-sm h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Printyx</h1>
        </div>

        {/* Tenant Selector for Platform Roles */}
        {isPlatformRole && tenants && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Client Company
            </p>
            <Select value={selectedTenantId || ""} onValueChange={handleTenantChange}>
              <SelectTrigger className="w-full">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <SelectValue placeholder="Select company..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant: any) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTenantId && (
              <p className="text-xs text-blue-600 font-medium">
                {user?.role?.name} - Support Mode
              </p>
            )}
          </div>
        )}

        {/* Show user role and company for non-platform users */}
        {!isPlatformRole && user && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500">{user.role?.name}</p>
            <p className="text-xs text-gray-400">{user.role?.department}</p>
          </div>
        )}
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
        {navigationSections.map((section) => (
          <div key={section.name}>
            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {section.name}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                
                return (
                  <Link key={item.name} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                        isActive
                          ? "text-primary bg-primary/10"
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <Icon className="w-4 h-4 mr-3" />
                      {item.name}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <img 
            src={(user as any)?.profileImageUrl || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=64&h=64"} 
            alt="User profile" 
            className="w-8 h-8 rounded-full object-cover" 
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {(user as any)?.firstName && (user as any)?.lastName 
                ? `${(user as any).firstName} ${(user as any).lastName}` 
                : (user as any)?.email || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">{(user as any)?.role?.name || (user as any)?.role || 'Manager'}</p>
          </div>
          <button 
            className="text-gray-400 hover:text-gray-600"
            onClick={() => window.location.href = '/api/logout'}
          >
            <Settings className="text-sm h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
