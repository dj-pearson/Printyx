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
  ChevronDown,
  ChevronRight,
  Zap,
  ShoppingCart,
  Warehouse,
  Truck,
  Camera,
  MapPin,
  Smartphone,
  UserPlus,
  Calendar,
  HeartHandshake,
  CreditCard,
  Wifi
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
  if (!userRole) {
    return [];
  }

  const roleCode = userRole.code;
  const department = userRole.department;
  const level = userRole.level;
  const permissions = userRole.permissions || {};
  
  // Platform roles get full access
  const isPlatformRole = userRole.canAccessAllTenants === true;
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
        { name: 'Business Records', href: '/business-records', icon: Building2 },
        { name: 'Leads Management', href: '/leads-management', icon: UserPlus },
        { name: 'CRM & Pipeline', href: '/crm', icon: Target },
        { name: 'Customer Success', href: '/customer-success', icon: HeartHandshake },
        { name: 'CRM Goals & Reporting', href: '/crm-goals', icon: TrendingUp },
        { name: 'Demo Scheduling', href: '/demo-scheduling', icon: Calendar },
        { name: 'Sales Forecasting', href: '/sales-pipeline-forecasting', icon: TrendingUp },
        { name: 'E-signature', href: '/esignature-integration', icon: FileText },
        { name: 'Contacts', href: '/contacts', icon: Users },
        { name: 'Deals Pipeline', href: '/deals', icon: Zap },
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
        { name: 'Dispatch Optimization', href: '/service-dispatch-optimization', icon: Target },
        { name: 'Preventive Maintenance', href: '/preventive-maintenance-automation', icon: Settings },
        { name: 'Remote Monitoring', href: '/remote-monitoring', icon: Wifi },
        { name: 'Mobile Field Service', href: '/mobile-field-service', icon: Smartphone },
        { 
          name: 'Equipment Lifecycle', 
          href: '/equipment-lifecycle', 
          icon: Package,
          isExpandable: true,
          subItems: [
            { name: 'Purchase Orders', href: '/purchase-orders', icon: ShoppingCart },
            { name: 'Warehouse Operations', href: '/equipment/warehouse', icon: Warehouse },
            { name: 'Delivery Logistics', href: '/equipment/delivery', icon: Truck },
            { name: 'Installation Management', href: '/equipment/installation', icon: Wrench },
            { name: 'Documentation & Compliance', href: '/equipment/documentation', icon: Camera },
            { name: 'Asset Tracking', href: '/equipment/tracking', icon: MapPin },
          ]
        },
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
        { name: 'Financial Forecasting', href: '/financial-forecasting', icon: TrendingUp },
        { name: 'Commission Management', href: '/commission-management', icon: DollarSign },
        { name: 'Advanced Billing', href: '/meter-billing', icon: CreditCard },
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
        { 
          name: 'Product Management', 
          href: '/product-hub', 
          icon: Package,
          isExpandable: true,
          subItems: [
            { name: 'Product Hub', href: '/product-management-hub', icon: DollarSign },
            { name: 'Product Models', href: '/admin/product-models', icon: Printer },
            { name: 'Product Accessories', href: '/admin/product-accessories', icon: Package },
            { name: 'Professional Services', href: '/admin/professional-services', icon: Users },
            { name: 'Service Products', href: '/admin/service-products', icon: Settings },
            { name: 'Supplies', href: '/admin/supplies', icon: Package },
            { name: 'IT & Managed Services', href: '/admin/it-services', icon: Shield },
          ]
        },
        { name: 'Inventory', href: '/inventory', icon: Package },
        { name: 'Contracts', href: '/contracts', icon: FileText },
        { name: 'User Management', href: '/user-management', icon: UserCog },
        { name: 'Multi-Tenant Setup', href: '/tenant-setup', icon: Building2 },
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showTenantDetails, setShowTenantDetails] = useState(false);

  // Check if user is a platform role
  const isPlatformRole = user?.role?.canAccessAllTenants === true;
  
  // Fetch available tenants for platform users
  const { data: tenants, error: tenantsError } = useQuery({
    queryKey: ['/api/tenants'],
    enabled: isPlatformRole,
  });

  // Fetch tenant summary for selected tenant
  const { data: tenantSummary } = useQuery({
    queryKey: ['/api/tenants', selectedTenantId, 'summary'],
    enabled: isPlatformRole && !!selectedTenantId,
  });

  // Fetch locations for selected tenant
  const { data: tenantLocations } = useQuery({
    queryKey: ['/api/tenants', selectedTenantId, 'locations'],
    enabled: isPlatformRole && !!selectedTenantId && showTenantDetails,
  });

  // Fetch regions for selected tenant
  const { data: tenantRegions } = useQuery({
    queryKey: ['/api/tenants', selectedTenantId, 'regions'],
    enabled: isPlatformRole && !!selectedTenantId && showTenantDetails,
  });

  // Get navigation sections based on user role
  const navigationSections = getNavigationSections(user?.role);
  

  


  // Handle tenant selection for platform users
  const handleTenantChange = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setShowTenantDetails(false); // Reset details view
    // Store selected tenant in localStorage for persistence
    localStorage.setItem('selectedTenantId', tenantId);
  };

  // Toggle tenant details visibility
  const toggleTenantDetails = () => {
    setShowTenantDetails(!showTenantDetails);
  };

  // Handle section expansion
  const toggleSection = (sectionName: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionName)) {
      newExpanded.delete(sectionName);
    } else {
      newExpanded.add(sectionName);
    }
    setExpandedSections(newExpanded);
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
    <aside className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Printer className="text-white text-sm h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Printyx</h1>
        </div>

        {/* Enhanced Tenant Selector for Platform Roles with Multi-Location Support */}
        {isPlatformRole && tenants && (
          <div className="space-y-3">
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
                {(tenants as any[])?.map((tenant: any) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                )) || []}
              </SelectContent>
            </Select>
            
            {selectedTenantId && tenantSummary && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-blue-600 font-medium">
                    {user?.role?.name} - Support Mode
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleTenantDetails}
                    className="h-6 px-2 text-xs"
                  >
                    {showTenantDetails ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                
                {/* Quick Summary */}
                <div className="bg-blue-50 rounded-lg p-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Locations:</span>
                    <span className="font-medium">{tenantSummary.locationCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Regions:</span>
                    <span className="font-medium">{tenantSummary.regionCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Employees:</span>
                    <span className="font-medium">{tenantSummary.totalEmployees}</span>
                  </div>
                </div>

                {/* Detailed Multi-Location View */}
                {showTenantDetails && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {tenantRegions && tenantRegions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-1">Regions</h4>
                        <div className="space-y-1">
                          {tenantRegions.map((region: any) => (
                            <div key={region.id} className="bg-gray-50 rounded p-2 text-xs">
                              <div className="font-medium">{region.name}</div>
                              <div className="text-gray-500">
                                {region.locationCount} locations
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {tenantLocations && tenantLocations.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-1">
                          Locations ({tenantLocations.length})
                        </h4>
                        <div className="space-y-1">
                          {tenantLocations.slice(0, 5).map((location: any) => (
                            <div key={location.id} className="bg-gray-50 rounded p-2 text-xs">
                              <div className="flex items-center justify-between">
                                <div className="font-medium">{location.name}</div>
                                <div className="flex items-center space-x-1">
                                  <MapPin className="h-3 w-3 text-gray-400" />
                                  <span className="text-gray-500">{location.city}, {location.state}</span>
                                </div>
                              </div>
                              {location.regionName && (
                                <div className="text-gray-500 mt-1">
                                  Region: {location.regionName}
                                </div>
                              )}
                              {location.employeeCount && (
                                <div className="text-gray-500">
                                  {location.employeeCount} employees
                                </div>
                              )}
                            </div>
                          ))}
                          {tenantLocations.length > 5 && (
                            <div className="text-xs text-gray-500 text-center py-1">
                              +{tenantLocations.length - 5} more locations
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
                const isExpanded = expandedSections.has(item.name);
                const Icon = item.icon;
                
                if (item.isExpandable) {
                  return (
                    <div key={item.name}>
                      <button
                        onClick={() => toggleSection(item.name)}
                        className={cn(
                          "flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                          isActive || (item.subItems && item.subItems.some(sub => location === sub.href))
                            ? "text-primary bg-primary/10"
                            : "text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        <div className="flex items-center">
                          <Icon className="w-4 h-4 mr-3" />
                          {item.name}
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      
                      {isExpanded && item.subItems && (
                        <div className="ml-4 mt-1 space-y-1">
                          <Link href={item.href}>
                            <div
                              className={cn(
                                "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                                isActive
                                  ? "text-primary bg-primary/10"
                                  : "text-gray-700 hover:bg-gray-100"
                              )}
                            >
                              <Icon className="w-4 h-4 mr-3" />
                              Overview
                            </div>
                          </Link>
                          {item.subItems.map((subItem) => {
                            const isSubActive = location === subItem.href;
                            const SubIcon = subItem.icon;
                            return (
                              <Link key={subItem.name} href={subItem.href}>
                                <div
                                  className={cn(
                                    "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                                    isSubActive
                                      ? "text-primary bg-primary/10"
                                      : "text-gray-700 hover:bg-gray-100"
                                  )}
                                >
                                  <SubIcon className="w-4 h-4 mr-3" />
                                  {subItem.name}
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                
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
