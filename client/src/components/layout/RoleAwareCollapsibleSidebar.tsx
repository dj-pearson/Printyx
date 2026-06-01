import { useState, useEffect, useMemo } from 'react';
import { useLocation, Link } from 'wouter';
// useQuery removed - permissions are now resolved via usePermissions hook
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import {
  SECTION_PERMISSIONS,
  ITEM_PERMISSIONS,
  checkNavigationAccess,
} from '@/lib/navigation-permissions';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import {
  LayoutDashboard,
  Target,
  Wrench,
  Package,
  Truck,
  DollarSign,
  BarChart3,
  CheckSquare,
  CheckCircle2,
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
  X,
  Bot,
  MessageSquare,
  Search,
  Mic,
  Video,
  Share2,
  ChevronsUpDown,
  Minimize2,
  Maximize2,
  Newspaper,
} from 'lucide-react';

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

/**
 * Consolidated navigation structure - reduced from 18 to 11 top-level sections.
 * Merges: Platform Admin sections → Platform Management, Products + Equipment → Products & Equipment,
 * Tasks + AI Hub → Productivity, Integrations + System Admin → Administration.
 * All navigation destinations preserved. RBAC filtering still applied via permission map.
 */
const ALL_NAVIGATION_SECTIONS: NavigationSection[] = [
  // Always visible
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
    matchPatterns: ['/dashboard*'],
  },

  // Platform Management (merged: Platform Admin Hub + Tenant & Org + User & Access + System Ops + Platform Features)
  {
    id: 'platform-management',
    title: 'Platform Management',
    icon: Crown,
    path: '/admin-hub',
    matchPatterns: [
      '/admin-hub*',
      '/admin/tenant*',
      '/root-admin-signups*',
      '/customer-self-service-portal*',
      '/admin/user*',
      '/admin/root-admin-security*',
      '/admin/system-security*',
      '/role-management*',
      '/root-admin-dashboard*',
      '/system-monitoring*',
      '/database-management*',
      '/admin/platform*',
      '/admin/system*',
      '/admin/mobile-logs*',
      '/admin/disposable-emails*',
      '/platform-configuration*',
      '/mobile-optimization*',
      '/root-admin/seo*',
      '/social-media*',
      '/gpt5*',
      '/tenant-setup*',
    ],
    children: [
      { title: 'Admin Hub', path: '/admin-hub', icon: Crown },
      { title: 'Tenant Management', path: '/admin/tenant-management', icon: Building2 },
      { title: 'Tenant Onboarding', path: '/tenant-setup', icon: Rocket },
      { title: 'Signups & Trials CRM', path: '/root-admin-signups-crm', icon: TrendingUp },
      { title: 'Customer Portal', path: '/customer-self-service-portal', icon: UserCheck },
      { title: 'User Management', path: '/admin/user-management', icon: Users },
      { title: 'Role Management', path: '/role-management', icon: Shield },
      { title: 'Security & Permissions', path: '/admin/root-admin-security', icon: Shield },
      { title: 'Disposable Email Blocklist', path: '/admin/disposable-emails', icon: Shield },
      { title: 'Audit & Compliance', path: '/security-compliance-management', icon: FileText },
      { title: 'System Dashboard', path: '/root-admin-dashboard', icon: Activity },
      { title: 'Database Management', path: '/database-management', icon: Database },
      { title: 'Platform Analytics', path: '/admin/platform-analytics', icon: BarChart3 },
      { title: 'System Configuration', path: '/platform-configuration', icon: Settings },
      { title: 'Mobile Optimization', path: '/mobile-optimization', icon: Smartphone },
      { title: 'Mobile App Logs', path: '/admin/mobile-logs', icon: Smartphone },
      { title: 'SEO Management', path: '/root-admin/seo', icon: Globe },
      { title: 'Social Media Generator', path: '/social-media-generator', icon: Share2 },
      { title: 'GPT-5 AI Dashboard', path: '/gpt5-dashboard', icon: Brain },
    ],
  },

  // Blog (Platform Admin Blog System — US-BLOG-001 foundation; full nav in US-BLOG-007)
  {
    id: 'blog',
    title: 'Blog',
    icon: Newspaper,
    path: '/platform-admin/blog',
    matchPatterns: ['/platform-admin/blog*'],
  },

  // Sales Hub - core CRM and sales operations
  {
    id: 'crm',
    title: 'Sales Hub',
    icon: Target,
    path: '/opportunities',
    matchPatterns: [
      '/leads*',
      '/contacts*',
      '/deals*',
      '/opportunities*',
      '/sales-pipeline*',
      '/quote*',
      '/proposal*',
      '/demo*',
      '/contracts*',
      '/commission*',
      '/customer-success*',
      '/sales-command*',
      '/sales-performance*',
      '/data-enrichment*',
      '/document-builder*',
      '/deal-desk*',
      '/crm-goals*',
      '/pipeline-config*',
      '/sales-rep-assignments*',
      '/lead-map*',
      '/customers*',
      '/prospects*',
      '/crm*',
      '/business-records*',
    ],
    children: [
      { title: 'Leads', path: '/leads-management', icon: UserPlus },
      { title: 'Prospects', path: '/prospects', icon: Users },
      { title: 'Customers', path: '/customers', icon: UserCheck },
      { title: 'Contacts', path: '/contacts', icon: Users },
      { title: 'Opportunities', path: '/opportunities', icon: Target },
      { title: 'Sales Pipeline', path: '/sales-pipeline', icon: TrendingUp },
      { title: 'Quotes & Proposals', path: '/quote-proposal-generation', icon: FileText },
      { title: 'Contracts', path: '/contracts', icon: FileSignature },
      { title: 'Deal Desk', path: '/deal-desk', icon: CheckCircle2 },
      { title: 'Sales Command Center', path: '/sales-command-center', icon: Monitor },
      { title: 'Customer Success', path: '/customer-success-management', icon: UserCheck },
      { title: 'Commission Management', path: '/commission-management', icon: DollarSign },
    ],
  },

  // Outreach Hub — AI-assisted cold email / LinkedIn drafting
  {
    id: 'outreach',
    title: 'Outreach',
    icon: Wand2,
    path: '/outreach',
    matchPatterns: ['/outreach*'],
    children: [
      { title: 'Overview', path: '/outreach', icon: Target },
      { title: 'Business Context', path: '/outreach/business-context', icon: BookOpen },
      { title: 'My Specialty', path: '/outreach/my-specialty', icon: Users },
      { title: 'Sequence Studio', path: '/outreach/sequence-studio', icon: Layers },
      { title: 'Draft Generator', path: '/outreach/draft-generator', icon: Wand2 },
    ],
  },

  // Service Hub
  {
    id: 'service',
    title: 'Service Hub',
    icon: Wrench,
    path: '/service-hub',
    matchPatterns: [
      '/service*',
      '/meter-readings*',
      '/technician*',
      '/preventive*',
      '/mobile-service*',
      '/mobile-field*',
      '/remote-monitoring*',
      '/fleet-monitoring*',
      '/monitoring-clients*',
      '/supply-runway*',
      '/supply-orders*',
      '/vehicle*',
      '/asset*',
      '/onboarding*',
      '/incident*',
      '/manufacturer*',
    ],
    children: [
      { title: 'Service Hub', path: '/service-hub', icon: Wrench },
      { title: 'Service Dispatch', path: '/service-dispatch', icon: Activity },
      { title: 'Technicians', path: '/technician-management', icon: Users },
      { title: 'Meter Readings', path: '/meter-readings', icon: Monitor },
      { title: 'Preventive Maintenance', path: '/preventive-maintenance', icon: Calendar },
      { title: 'Remote Monitoring', path: '/remote-monitoring', icon: Monitor },
      { title: 'Fleet Monitoring', path: '/fleet-monitoring', icon: Activity },
      { title: 'Monitoring Clients', path: '/monitoring-clients', icon: Monitor },
      { title: 'Supply Runway', path: '/supply-runway', icon: Activity },
      { title: 'Supply Orders', path: '/supply-orders', icon: Activity },
      { title: 'Mobile Field Service', path: '/mobile-field-service', icon: MapPin },
      { title: 'Service Analytics', path: '/service-analytics', icon: BarChart3 },
      { title: 'Incident Response', path: '/incident-response-system', icon: AlertTriangle },
    ],
  },

  // Products & Equipment (merged: Product Hub + Equipment Lifecycle)
  {
    id: 'products-equipment',
    title: 'Products & Equipment',
    icon: Package,
    path: '/product-hub',
    matchPatterns: [
      '/product*',
      '/supplies*',
      '/professional-services*',
      '/managed-services*',
      '/software-products*',
      '/service-products*',
      '/equipment*',
      '/purchase-orders*',
      '/warehouse*',
      '/inventory*',
    ],
    children: [
      { title: 'Product Hub', path: '/product-hub', icon: Package },
      { title: 'Product Catalog', path: '/product-catalog', icon: Package },
      { title: 'Product Models', path: '/product-models', icon: Package },
      { title: 'Product Accessories', path: '/product-accessories', icon: Layers },
      { title: 'Supplies', path: '/supplies', icon: Package },
      { title: 'Software Products', path: '/software-products', icon: Code },
      { title: 'Professional Services', path: '/professional-services', icon: FileText },
      { title: 'Managed Services', path: '/managed-services', icon: Crown },
      { title: 'Service Products', path: '/service-products', icon: Wrench },
      { title: 'Equipment Lifecycle', path: '/equipment-lifecycle', icon: Truck },
      { title: 'Purchase Orders', path: '/purchase-orders', icon: ShoppingCart },
      { title: 'Warehouse Operations', path: '/warehouse-operations', icon: Building2 },
      { title: 'Inventory Management', path: '/inventory', icon: Package },
      { title: 'Equipment Management', path: '/equipment-lifecycle-management', icon: Cog },
    ],
  },

  // Billing Hub
  {
    id: 'billing',
    title: 'Billing Hub',
    icon: DollarSign,
    path: '/billing-hub',
    matchPatterns: [
      '/billing*',
      '/invoices*',
      '/accounts*',
      '/meter-billing*',
      '/journal*',
      '/chart-of-accounts*',
      '/financial*',
      '/leases*',
      '/advanced-billing*',
      '/vendors*',
    ],
    children: [
      { title: 'Billing Hub', path: '/billing', icon: DollarSign },
      { title: 'Leases', path: '/leases', icon: FileText },
      { title: 'Chart of Accounts', path: '/chart-of-accounts', icon: Database },
      { title: 'Advanced Billing Engine', path: '/advanced-billing', icon: Zap },
      { title: 'Meter Billing', path: '/meter-billing', icon: Calculator },
      { title: 'Invoices', path: '/invoices', icon: FileText },
      { title: 'Accounts Receivable', path: '/accounts-receivable', icon: CreditCard },
      { title: 'Accounts Payable', path: '/accounts-payable', icon: CreditCard },
      { title: 'Vendors', path: '/vendors', icon: Building2 },
      { title: 'Journal Entries', path: '/journal-entries', icon: BookOpen },
      { title: 'Financial Forecasting', path: '/financial-forecasting', icon: TrendingUp },
    ],
  },

  // Reports & Analytics
  {
    id: 'reports',
    title: 'Reports & Analytics',
    icon: BarChart3,
    path: '/reports',
    matchPatterns: [
      '/reports*',
      '/advanced-reporting*',
      '/performance-monitoring*',
      '/analytics*',
      '/advanced-analytics*',
      '/executive*',
      '/financial-intelligence*',
      '/predictive*',
    ],
    children: [
      { title: 'Reports Hub', path: '/reports', icon: BarChart3 },
      { title: 'Performance Monitoring', path: '/performance-monitoring', icon: Activity },
      { title: 'Advanced Reporting', path: '/advanced-reporting', icon: BarChart3 },
      { title: 'Advanced Analytics', path: '/advanced-analytics', icon: Brain },
      {
        title: 'Financial Intelligence',
        path: '/financial-intelligence-dashboard',
        icon: PieChart,
      },
      { title: 'Predictive Analytics', path: '/predictive-analytics', icon: TrendingUp },
      { title: 'AI Analytics Dashboard', path: '/ai-analytics-dashboard', icon: Brain },
      { title: 'Executive Dashboard', path: '/executive-dashboard', icon: Crown },
    ],
  },

  // Productivity (merged: Task Management + AI Hub)
  {
    id: 'productivity',
    title: 'Productivity',
    icon: CheckSquare,
    path: '/task-management',
    matchPatterns: [
      '/task*',
      '/workflows*',
      '/ai*',
      '/calendar*',
      '/meeting*',
      '/search*',
      '/conversational-ai*',
    ],
    children: [
      { title: 'Advanced Tasks', path: '/task-management', icon: Brain },
      { title: 'Workflows', path: '/workflows', icon: CheckCircle2 },
      { title: 'Basic Tasks', path: '/basic-tasks', icon: CheckSquare },
      { title: 'AI Employees', path: '/ai-employees', icon: Bot },
      { title: 'Calendar Integration', path: '/calendar', icon: Calendar },
      { title: 'Meeting Transcription', path: '/meeting-transcription', icon: Video },
      { title: 'AI Search & Knowledge', path: '/ai-search', icon: Search },
      { title: 'AI Task Scheduling', path: '/ai-task-scheduling', icon: Brain },
      { title: 'Conversation AI', path: '/conversational-ai-dashboard', icon: MessageSquare },
    ],
  },

  // Knowledge Base
  {
    id: 'knowledge-base',
    title: 'Knowledge Base',
    icon: BookOpen,
    path: '/knowledge-base',
    matchPatterns: ['/knowledge-base*'],
  },

  // Administration (merged: Integrations + System Administration)
  {
    id: 'administration',
    title: 'Administration',
    icon: Plug,
    path: '/integration-hub',
    matchPatterns: [
      '/integration*',
      '/quickbooks*',
      '/erp*',
      '/esignature*',
      '/system-integrations*',
      '/workflow*',
      '/business-process*',
      '/document-management*',
      '/security-compliance*',
      '/deployment*',
      '/customer-number*',
      '/seo*',
    ],
    children: [
      { title: 'Integration Hub', path: '/integration-hub', icon: Plug },
      { title: 'QuickBooks Integration', path: '/quickbooks-integration', icon: DollarSign },
      { title: 'ERP Integration', path: '/erp-integration', icon: Globe },
      { title: 'E-Signature Integration', path: '/esignature-integration', icon: FileSignature },
      { title: 'System Integrations', path: '/system-integrations', icon: Plug },
      { title: 'SEO Management', path: '/seo', icon: Search },
      { title: 'Workflow Automation', path: '/workflow-automation', icon: Zap },
      {
        title: 'Business Process Optimization',
        path: '/business-process-optimization',
        icon: TrendingUp,
      },
      { title: 'Document Management', path: '/document-management', icon: FileText },
      { title: 'Deployment Readiness', path: '/deployment-readiness', icon: Rocket },
      { title: 'Customer Number Settings', path: '/customer-number-settings', icon: Hash },
    ],
  },

  // Settings
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    path: '/settings',
    matchPatterns: ['/settings*'],
  },
];

/**
 * Filter navigation sections and their children based on the user's permissions.
 * Uses the granular permission map from navigation-permissions.ts.
 */
function filterNavigationByPermissions(
  sections: NavigationSection[],
  userPermissions: Set<string>,
  userLevel: number,
  isPlatformUser: boolean,
): NavigationSection[] {
  return sections
    .filter((section) => {
      // Check section-level access
      const sectionRule = SECTION_PERMISSIONS[section.id];
      return checkNavigationAccess(sectionRule, userPermissions, userLevel, isPlatformUser);
    })
    .map((section) => {
      // Filter children based on item-level permissions
      if (!section.children) return section;

      const filteredChildren = section.children.filter((child) => {
        const itemRule = ITEM_PERMISSIONS[child.path];
        return checkNavigationAccess(itemRule, userPermissions, userLevel, isPlatformUser);
      });

      // If no children remain after filtering, hide the section entirely
      if (filteredChildren.length === 0) return null;

      return { ...section, children: filteredChildren };
    })
    .filter((section): section is NavigationSection => section !== null);
}

export function RoleAwareCollapsibleSidebar({
  className,
  ...props
}: RoleAwareCollapsibleSidebarProps) {
  const { user, isAuthenticated } = useAuth();
  const { permissions, level, isPlatformUser } = usePermissions();
  const { t } = useTranslation();
  const [location] = useLocation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [userExpandedSections, setUserExpandedSections] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [compactMode, setCompactMode] = useState(false);

  // i18n key map for top-level navigation sections
  const NAV_I18N: Record<string, string> = {
    dashboard: 'nav.dashboard',
    'platform-management': 'nav.platformManagement',
    crm: 'nav.salesHub',
    service: 'nav.serviceHub',
    'products-equipment': 'nav.productsEquipment',
    billing: 'nav.billingHub',
    reports: 'nav.reports',
    productivity: 'nav.productivity',
    'knowledge-base': 'nav.knowledgeBase',
    administration: 'nav.administration',
    settings: 'nav.settings',
  };

  // Translate navigation title using i18n key map, falling back to hardcoded title
  const navTitle = (id: string, fallback: string) => {
    const key = NAV_I18N[id];
    if (!key) return fallback;
    const translated = t(key);
    return translated !== key ? translated : fallback;
  };

  // Use role from user object for display
  const userRole = user?.role;

  // Filter navigation sections based on granular RBAC permissions
  const navigationSections = useMemo(
    () =>
      filterNavigationByPermissions(ALL_NAVIGATION_SECTIONS, permissions, level, isPlatformUser),
    [permissions, level, isPlatformUser],
  );

  // Debug removed for cleaner console output

  // Auto-expand based on current route
  useEffect(() => {
    const currentSection = navigationSections.find((section) => {
      if (location === section.path) return true;

      if (section.matchPatterns) {
        return section.matchPatterns.some((pattern) => {
          const regexPattern = pattern.replace(/\*/g, '.*');
          const regex = new RegExp(`^${regexPattern}`);
          return regex.test(location);
        });
      }

      if (section.children) {
        return section.children.some((child) => location === child.path);
      }

      return false;
    });

    setExpandedSections((prevExpanded) => {
      const newExpanded = new Set<string>();

      // Keep user-expanded sections
      userExpandedSections.forEach((sectionId) => {
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
    setUserExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const collapseAll = () => {
    setUserExpandedSections(new Set());
  };

  const expandAll = () => {
    const allSectionIds = navigationSections
      .filter((s) => s.children && s.children.length > 0)
      .map((s) => s.id);
    setUserExpandedSections(new Set(allSectionIds));
  };

  const isExpanded = (sectionId: string) => expandedSections.has(sectionId);
  const isActive = (path: string) => location === path || location.startsWith(path + '/');

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return navigationSections;

    const query = searchQuery.toLowerCase();
    return navigationSections
      .map((section) => {
        // Check if section title matches
        if (section.title.toLowerCase().includes(query)) {
          return section;
        }

        // Check if any child matches
        if (section.children) {
          const matchingChildren = section.children.filter((child) =>
            child.title.toLowerCase().includes(query),
          );

          if (matchingChildren.length > 0) {
            return { ...section, children: matchingChildren };
          }
        }

        return null;
      })
      .filter((section): section is NavigationSection => section !== null);
  }, [navigationSections, searchQuery]);

  // Auto-expand sections when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const sectionsToExpand = filteredSections
        .filter((s) => s.children && s.children.length > 0)
        .map((s) => s.id);
      setUserExpandedSections(new Set(sectionsToExpand));
    }
  }, [searchQuery, filteredSections]);

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

  const { open, openMobile, isMobile } = useSidebar();
  const sidebarOpen = isMobile ? openMobile : open;

  return (
    <Sidebar
      collapsible="icon"
      className="bg-slate-50 border-r border-slate-200 flex flex-col"
      {...props}
    >
      <SidebarHeader className="border-b border-slate-200 bg-white shrink-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-2 py-2">
              <Logo className="h-10 w-10" />
              <div className="group-data-[collapsible=icon]:hidden">
                <h1 className="text-xl font-bold text-slate-900">Printyx</h1>
                <p className="text-xs text-slate-600 font-medium">Business Management</p>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Search Bar */}
        <div className="px-3 pb-3 group-data-[collapsible=icon]:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Collapse/Expand Controls */}
          {filteredSections.some((s) => s.children) && (
            <div className="flex gap-1 mt-2">
              <Button variant="ghost" size="sm" onClick={expandAll} className="flex-1 h-7 text-xs">
                <ChevronsUpDown className="h-3 w-3 mr-1" />
                Expand All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={collapseAll}
                className="flex-1 h-7 text-xs"
              >
                <Minimize2 className="h-3 w-3 mr-1" />
                Collapse All
              </Button>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-4 px-4 overflow-y-auto flex-1">
        <SidebarGroup>
          <SidebarGroupContent className="space-y-3">
            <SidebarMenu>
              {filteredSections.length === 0 && searchQuery ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No menu items found</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              ) : null}
              {filteredSections.map((section) => {
                const shouldShowAsActive = section.children
                  ? section.children.some((child) => isActive(child.path)) ||
                    isActive(section.path) ||
                    (section.matchPatterns?.some((pattern) => isActive(pattern)) ?? false)
                  : isActive(section.path) ||
                    (section.matchPatterns?.some((pattern) => isActive(pattern)) ?? false);

                if (section.children) {
                  return (
                    <Collapsible
                      key={section.id}
                      open={isExpanded(section.id)}
                      onOpenChange={() => toggleSection(section.id)}
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            className={cn(
                              'w-full justify-between py-3 px-4 rounded-lg transition-all duration-200',
                              shouldShowAsActive
                                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                                : 'hover:bg-slate-100 text-slate-700',
                              'font-semibold text-sm mb-1',
                            )}
                            data-active={shouldShowAsActive}
                            data-testid={`nav-${section.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <section.icon
                                className={cn(
                                  'h-5 w-5',
                                  shouldShowAsActive ? 'text-white' : 'text-slate-600',
                                )}
                              />
                              <span className="font-semibold">
                                {navTitle(section.id, section.title)}
                              </span>
                            </div>
                            {isExpanded(section.id) ? (
                              <ChevronDown
                                className={cn(
                                  'h-4 w-4',
                                  shouldShowAsActive ? 'text-white' : 'text-slate-500',
                                )}
                              />
                            ) : (
                              <ChevronRight
                                className={cn(
                                  'h-4 w-4',
                                  shouldShowAsActive ? 'text-white' : 'text-slate-500',
                                )}
                              />
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
                                    'py-2.5 px-4 ml-6 rounded-md transition-all duration-200 text-sm font-normal',
                                    'border-l-2 border-transparent hover:border-slate-300',
                                    isActive(child.path)
                                      ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-l-blue-500'
                                      : 'hover:bg-slate-50 text-slate-800',
                                  )}
                                  data-active={isActive(child.path)}
                                  data-testid={`nav-${child.path.replace(/[^a-zA-Z0-9]/g, '-')}`}
                                >
                                  <Link href={child.path}>
                                    <child.icon
                                      className={cn(
                                        'h-4 w-4',
                                        isActive(child.path) ? 'text-blue-600' : 'text-slate-700',
                                      )}
                                    />
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
                        'py-3 px-4 rounded-lg transition-all duration-200',
                        shouldShowAsActive
                          ? 'bg-slate-800 hover:bg-slate-700 text-white'
                          : 'hover:bg-slate-100 text-slate-900',
                        'font-semibold text-sm mb-1',
                      )}
                      data-active={shouldShowAsActive}
                      data-testid={`nav-${section.id}`}
                    >
                      <Link href={section.path}>
                        <section.icon
                          className={cn(
                            'h-5 w-5',
                            shouldShowAsActive ? 'text-white' : 'text-slate-800',
                          )}
                        />
                        <span className="font-semibold">{navTitle(section.id, section.title)}</span>
                        {shouldShowAsActive && (
                          <Badge className="ml-auto bg-blue-600 text-white text-xs">Active</Badge>
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

      {/* User Profile Footer - Sticky at bottom */}
      <SidebarFooter className="border-t border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3 p-3">
          <Avatar className="w-9 h-9 ring-2 ring-slate-200">
            <AvatarImage src={(user as any)?.avatar} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold">
              {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="group-data-[collapsible=icon]:hidden flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {user?.firstName || user?.email?.split('@')[0] || 'User'}
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-slate-600 truncate">{userRole?.name || 'User'}</p>
              {userRole?.level && userRole.level >= 8 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0"
                >
                  <Crown className="h-2.5 w-2.5 mr-0.5" />
                  Admin
                </Badge>
              )}
            </div>
          </div>
          <Link href="/settings">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 group-data-[collapsible=icon]:hidden"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
