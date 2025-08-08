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
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Target,
  FileText,
  Building2,
  ClipboardList,
  Wrench,
  Calendar,
  Calculator,
  UserPlus,
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Settings,
  UserCheck,
  Users,
  Zap,
  Smartphone,
  Activity,
  Plug,
  Rocket,
  CheckSquare,
  ChevronRight,
  BarChart3,
  Truck,
  Shield,
  Briefcase,
  BookOpen,
  AlertTriangle,
  Brain,
  PieChart,
  Cpu,
  CreditCard,
  Globe,
  Layers,
  FileSignature,
  Monitor,
  Cog,
  Headphones,
  MapPin,
  Crown,
  Database,
  Hash,
  Wand2,
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
  const isCompanyAdmin = userRole.name?.includes("Admin");
  const level = userRole.level || 1;

  // Determine URL prefix based on role level and permissions
  const useAdminRoutes = isPlatformRole || isCompanyAdmin || level >= 4;
  const adminPrefix = useAdminRoutes ? "/admin" : "";

  // Dashboard and core universal items - always available
  sections.push({
    name: "Overview",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Customers", href: "/customers", icon: Building2 },
    ],
  });

  // Sales & CRM section - organized by workflow progression
  if (permissions.sales || isPlatformRole || isCompanyAdmin) {
    sections.push({
      name: "Sales & CRM",
      items: [
        { name: "CRM", href: "/crm", icon: Target },
        { name: "Leads Management", href: "/leads-management", icon: UserPlus },
        { name: "Contacts", href: "/contacts", icon: Users },
        { name: "Deals Management", href: "/deals-management", icon: Target },
        {
          name: "Sales Pipeline",
          href: "/sales-pipeline",
          icon: TrendingUp,
        },
        {
          name: "Pipeline Forecasting",
          href: "/sales-pipeline-forecasting",
          icon: BarChart3,
        },
        {
          name: "Quotes & Proposals",
          href: "/quote-proposal-generation",
          icon: FileText,
        },
        {
          name: "Proposal Builder",
          href: "/proposal-builder",
          icon: Wand2,
        },
        { name: "Demo Scheduling", href: "/demo-scheduling", icon: Calendar },
        { name: "Contracts", href: "/contracts", icon: ClipboardList },
        {
          name: "Customer Success",
          href: "/customer-success-management",
          icon: UserCheck,
        },
        {
          name: "Commission Management",
          href: "/commission-management",
          icon: DollarSign,
        },
        {
          name: "CRM Goals Dashboard",
          href: "/crm-goals-dashboard",
          icon: PieChart,
        },
        {
          name: "Task Management",
          href: "/task-management",
          icon: CheckSquare,
        },
      ],
    });
  }

  // Service section - organized by service workflow progression
  if (permissions.service || permissions.sales || isPlatformRole || isCompanyAdmin) {
    sections.push({
      name: "Service",
      items: [
        { name: "Service Hub", href: "/service-hub", icon: Headphones },
        { name: "Onboarding Checklists", href: "/onboarding", icon: CheckSquare },
        { name: "Service Dispatch", href: "/service-dispatch-optimization", icon: Calendar },
        {
          name: "Mobile Field Service",
          href: "/mobile-field-service",
          icon: Smartphone,
        },
        {
          name: "Mobile Field Operations",
          href: "/mobile-field-operations",
          icon: MapPin,
        },
        {
          name: "Service Analytics",
          href: "/service-analytics",
          icon: BarChart3,
        },
        {
          name: "Remote Monitoring",
          href: "/remote-monitoring",
          icon: Monitor,
        },
        {
          name: "Preventive Maintenance",
          href: "/preventive-maintenance-scheduling",
          icon: Calendar,
        },
        {
          name: "Maintenance Automation",
          href: "/preventive-maintenance-automation",
          icon: Cog,
        },
        { name: "Meter Readings", href: "/meter-readings", icon: Calculator },
        {
          name: "Incident Response",
          href: "/incident-response-system",
          icon: AlertTriangle,
        },
        { name: "Service Products", href: "/service-products", icon: Package },
        {
          name: "Manufacturer Integration",
          href: "/manufacturer-integration",
          icon: Plug,
        },
      ],
    });
  }

  // Product Management section - organized by product workflow progression
  if (permissions.inventory || isPlatformRole || isCompanyAdmin) {
    sections.push({
      name: "Product Management",
      items: [
        {
          name: "Product Hub",
          href: `${adminPrefix}/product-hub`,
          icon: Package,
        },
        { name: "Inventory", href: "/inventory", icon: Package },
        {
          name: "Product Models",
          href: `${adminPrefix}/product-models`,
          icon: Package,
        },
        {
          name: "Product Accessories",
          href: `${adminPrefix}/product-accessories`,
          icon: Package,
        },
        {
          name: "Software Products",
          href: `${adminPrefix}/software-products`,
          icon: Layers,
        },
        {
          name: "Equipment Lifecycle",
          href: `${adminPrefix}/equipment-lifecycle-management`,
          icon: Settings,
        },
        {
          name: "Purchase Orders",
          href: `${adminPrefix}/purchase-orders`,
          icon: ShoppingCart,
        },
        {
          name: "Warehouse Operations",
          href: `${adminPrefix}/warehouse-operations`,
          icon: Truck,
        },
        { name: "Supplies", href: `${adminPrefix}/supplies`, icon: Package },
        {
          name: "Vendor Management",
          href: `${adminPrefix}/vendor-management`,
          icon: Building2,
        },
      ],
    });
  }

  // Finance section - organized by financial workflow progression
  if (permissions.finance || isPlatformRole || isCompanyAdmin) {
    sections.push({
      name: "Billing & Finance",
      items: [
        { name: "Invoices", href: "/invoices", icon: FileText },
        {
          name: "Advanced Billing Engine",
          href: "/advanced-billing-engine",
          icon: Calculator,
        },
        { name: "Meter Billing", href: "/meter-billing", icon: Calculator },
        {
          name: "Accounts Receivable",
          href: "/accounts-receivable",
          icon: DollarSign,
        },
        {
          name: "Accounts Payable",
          href: "/accounts-payable",
          icon: DollarSign,
        },
        { name: "Vendors", href: "/vendors", icon: Building2 },
        { name: "Journal Entries", href: "/journal-entries", icon: FileText },
        {
          name: "Chart of Accounts",
          href: "/chart-of-accounts",
          icon: BookOpen,
        },
        {
          name: "Financial Forecasting",
          href: "/financial-forecasting",
          icon: TrendingUp,
        },
      ],
    });
  }

  // Reports & Analytics section - show if user has reports permissions or is admin/director level
  if (permissions.reports || isPlatformRole || isCompanyAdmin || level >= 3) {
    sections.push({
      name: "Reports & Analytics",
      items: [
        { name: "Reports", href: "/reports", icon: BarChart3 },
        {
          name: "Advanced Reporting",
          href: "/advanced-reporting",
          icon: TrendingUp,
        },
        {
          name: "Advanced Analytics Dashboard",
          href: "/advanced-analytics-dashboard",
          icon: PieChart,
        },
        {
          name: "AI Analytics Dashboard",
          href: "/ai-analytics-dashboard",
          icon: Brain,
        },
        {
          name: "Predictive Analytics",
          href: "/predictive-analytics",
          icon: Brain,
        },
      ],
    });
  }

  // Integration section - show if user has system permissions or is admin
  if (permissions.system || isPlatformRole || isCompanyAdmin || level >= 3) {
    sections.push({
      name: "Integrations",
      items: [
        { name: "Integration Hub", href: "/integration-hub", icon: Plug },
        {
          name: "QuickBooks Integration",
          href: "/quickbooks-integration",
          icon: CreditCard,
        },
        { name: "ERP Integration", href: "/erp-integration", icon: Globe },
        {
          name: "E-Signature Integration",
          href: "/esignature-integration",
          icon: FileSignature,
        },
        {
          name: "System Integrations",
          href: "/system-integrations",
          icon: Plug,
        },
      ],
    });
  }

  // System Administration section (for platform roles and high-level admins)
  if (isPlatformRole || (isCompanyAdmin && level >= 4)) {
    sections.push({
      name: "System Administration",
      items: [
        {
          name: "Workflow Automation",
          href: "/workflow-automation",
          icon: Zap,
        },
        {
          name: "Business Process Optimization",
          href: "/business-process-optimization",
          icon: TrendingUp,
        },
        { name: "Business Records", href: "/business-records", icon: BookOpen },
        {
          name: "Document Management",
          href: "/document-management",
          icon: FileText,
        },
        {
          name: "Security & Compliance Management",
          href: "/security-compliance-management",
          icon: Shield,
        },
        {
          name: "Deployment Readiness",
          href: "/deployment-readiness",
          icon: Rocket,
        },
        {
          name: "Performance Monitoring",
          href: "/performance-monitoring",
          icon: Activity,
        },
        { name: "Data Enrichment", href: "/data-enrichment", icon: Brain },
        { name: "Customer Number Settings", href: "/customer-number-settings", icon: Hash }
      ],
    });
  }

  // Root Admin section - show only for platform/root admin users
  if (
    isPlatformRole ||
    userRole?.role === "admin" ||
    userRole?.role === "super_admin"
  ) {
    sections.push({
      name: "Root Admin",
      items: [
        {
          name: "Root Admin Dashboard",
          href: "/root-admin-dashboard",
          icon: Settings,
        },
        {
          name: "Social Media Generator",
          href: "/social-media-generator",
          icon: Zap,
        },
        {
          name: "Security Management",
          href: "/security-management",
          icon: Shield,
        },
        {
          name: "System Monitoring",
          href: "/system-monitoring",
          icon: Monitor,
        },
        { name: "Role Management", href: "/role-management", icon: UserCheck },
        {
          name: "Platform Configuration",
          href: "/platform-configuration",
          icon: Settings,
        },
        {
          name: "Database Management",
          href: "/database-management",
          icon: Database,
        },
        {
          name: "GPT-5 AI Dashboard",
          href: "/gpt5-dashboard",
          icon: Brain,
        },
      ],
    });
  }

  // Platform-only section
  if (isPlatformRole) {
    sections.push({
      name: "Platform Management",
      items: [
        { name: "Tenant Setup", href: "/tenant-setup", icon: Settings },
        {
          name: "Pricing Management",
          href: `${adminPrefix}/pricing-management`,
          icon: DollarSign,
        },
        {
          name: "Professional Services",
          href: "/professional-services",
          icon: Briefcase,
        },
        {
          name: "Managed Services",
          href: "/managed-services",
          icon: Headphones,
        },
        {
          name: "Customer Self-Service Portal",
          href: "/customer-self-service-portal",
          icon: UserCheck,
        },
        {
          name: "Mobile Optimization",
          href: "/mobile-optimization",
          icon: Smartphone,
        },
      ],
    });
  }

  // User Settings - always available
  sections.push({
    name: "Account",
    items: [{ name: "Settings", href: "/settings", icon: Settings }],
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
    queryKey: ["/api/tenants"],
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
            <span className="truncate font-semibold text-gray-900">
              Printyx
            </span>
            <span className="truncate text-xs text-gray-500">
              {user?.role?.name || "User"}
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
                      <a
                        href={item.href}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:text-gray-900"
                      >
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
            <AvatarImage
              src={user?.profileImageUrl || ""}
              alt={user?.firstName || ""}
            />
            <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
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
