import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import {
  SECTION_PERMISSIONS,
  ITEM_PERMISSIONS,
  checkNavigationAccess,
} from '@/lib/navigation-permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
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
  Bot,
  MessageSquare,
  Search,
  Video,
  Wand2,
  X,
  MapPin,
  Smartphone,
  Zap,
  AlertTriangle,
  Hash,
  Rocket,
  Share2,
  Code,
  Cog,
  BookOpen,
  FileSignature,
  CheckCircle2,
} from 'lucide-react';
import useCollapsibleNavigation, { type NavigationSection } from '@/hooks/useCollapsibleNavigation';

/**
 * Complete navigation structure for the mobile drawer.
 * Mirrors ALL_NAVIGATION_SECTIONS from RoleAwareCollapsibleSidebar.
 * Filtering by role/permissions happens separately via the permission map.
 */
const ALL_NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
    matchPatterns: ['/dashboard*'],
  },
  {
    id: 'platform-admin-hub',
    title: 'Platform Admin Hub',
    icon: Crown,
    path: '/admin-hub',
    matchPatterns: ['/admin-hub*'],
  },
  {
    id: 'tenant-org-management',
    title: 'Tenant & Organization',
    icon: Building2,
    path: '/admin/tenant-management',
    matchPatterns: ['/admin/tenant*', '/root-admin-signups*', '/customer-self-service-portal*'],
    children: [
      { title: 'Tenant Management', path: '/admin/tenant-management', icon: Building2 },
      { title: 'Tenant Onboarding', path: '/tenant-setup', icon: Rocket },
      { title: 'Signups & Trials CRM', path: '/root-admin-signups-crm', icon: TrendingUp },
      { title: 'Customer Portal', path: '/customer-self-service-portal', icon: UserCheck },
    ],
  },
  {
    id: 'user-access-management',
    title: 'User & Access',
    icon: UserCheck,
    path: '/admin/user-management',
    matchPatterns: [
      '/admin/user*',
      '/admin/root-admin-security*',
      '/role-management*',
      '/security-compliance-management*',
    ],
    children: [
      { title: 'User Management', path: '/admin/user-management', icon: Users },
      { title: 'Role Management', path: '/role-management', icon: Shield },
      { title: 'Security & Permissions', path: '/admin/root-admin-security', icon: Shield },
      { title: 'Audit & Compliance', path: '/security-compliance-management', icon: FileText },
    ],
  },
  {
    id: 'system-operations',
    title: 'System Operations',
    icon: Monitor,
    path: '/root-admin-dashboard',
    matchPatterns: ['/root-admin-dashboard*', '/database-management*', '/platform-configuration*'],
    children: [
      { title: 'System Dashboard', path: '/root-admin-dashboard', icon: Activity },
      { title: 'Database Management', path: '/database-management', icon: Database },
      { title: 'Platform Analytics', path: '/admin/platform-analytics', icon: BarChart3 },
      { title: 'System Configuration', path: '/platform-configuration', icon: Settings },
      { title: 'Mobile Optimization', path: '/mobile-optimization', icon: Smartphone },
    ],
  },
  {
    id: 'platform-features',
    title: 'Platform Features',
    icon: Zap,
    path: '/root-admin/seo',
    matchPatterns: ['/root-admin/seo*', '/social-media*', '/gpt5*'],
    children: [
      { title: 'SEO Management', path: '/root-admin/seo', icon: Globe },
      { title: 'Social Media Generator', path: '/social-media-generator', icon: Share2 },
      { title: 'GPT-5 AI Dashboard', path: '/gpt5-dashboard', icon: Brain },
    ],
  },
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
      '/deal-desk*',
      '/pipeline-config*',
    ],
    children: [
      { title: 'Leads Management', path: '/leads-management', icon: UserPlus },
      { title: 'Lead Enrichment', path: '/data-enrichment', icon: Search },
      { title: 'Contacts', path: '/contacts', icon: Users },
      { title: 'Opportunities', path: '/opportunities', icon: Target },
      { title: 'Sales Pipeline', path: '/sales-pipeline', icon: TrendingUp },
      { title: 'Pipeline Forecasting', path: '/sales-pipeline-forecasting', icon: TrendingUp },
      { title: 'CRM Goals Dashboard', path: '/crm-goals-dashboard', icon: TrendingUp },
      { title: 'Demo Scheduling', path: '/demo-scheduling', icon: Calendar },
      { title: 'Quotes & Proposals', path: '/quote-proposal-generation', icon: FileText },
      { title: 'Proposal Builder', path: '/proposal-builder', icon: FileText },
      { title: 'Deal Desk', path: '/deal-desk', icon: CheckCircle2 },
      { title: 'Pipeline Configuration', path: '/pipeline-config', icon: Settings },
      { title: 'Contracts', path: '/contracts', icon: FileSignature },
      { title: 'Document Builder', path: '/document-builder', icon: FileText },
      { title: 'Customer Success', path: '/customer-success-management', icon: UserCheck },
      { title: 'Sales Command Center', path: '/sales-command-center', icon: Monitor },
      { title: 'Sales Performance', path: '/sales-performance-analytics', icon: BarChart3 },
      { title: 'Commission Management', path: '/commission-management', icon: DollarSign },
      { title: 'Rep Assignments', path: '/sales-rep-assignments', icon: MapPin },
    ],
  },
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
      '/vehicle*',
      '/asset*',
      '/onboarding*',
      '/incident*',
      '/manufacturer*',
    ],
    children: [
      { title: 'Service Hub', path: '/service-hub', icon: Wrench },
      { title: 'Onboarding Checklists', path: '/onboarding', icon: CheckSquare },
      { title: 'Service Dispatch', path: '/service-dispatch', icon: Activity },
      { title: 'Technician Management', path: '/technician-management', icon: Users },
      { title: 'Vehicle Management', path: '/vehicle-management', icon: Truck },
      { title: 'Asset Management', path: '/asset-management', icon: Package },
      { title: 'Remote Monitoring', path: '/remote-monitoring', icon: Monitor },
      { title: 'Fleet Monitoring', path: '/fleet-monitoring', icon: Activity },
      { title: 'Meter Readings', path: '/meter-readings', icon: Monitor },
      { title: 'Preventive Maintenance', path: '/preventive-maintenance', icon: Calendar },
      { title: 'Maintenance Automation', path: '/preventive-maintenance-automation', icon: Zap },
      { title: 'Mobile Field Service', path: '/mobile-field-service', icon: MapPin },
      { title: 'Mobile Field Operations', path: '/mobile-field-operations', icon: Activity },
      { title: 'Mobile Service App', path: '/mobile-service-app', icon: Smartphone },
      { title: 'Service Analytics', path: '/service-analytics', icon: BarChart3 },
      { title: 'Service Forecasting', path: '/service-forecasting-analytics', icon: TrendingUp },
      { title: 'Incident Response', path: '/incident-response-system', icon: AlertTriangle },
      { title: 'Manufacturer Integration', path: '/manufacturer-integration', icon: Plug },
    ],
  },
  {
    id: 'products',
    title: 'Product Hub',
    icon: Package,
    path: '/product-hub',
    matchPatterns: [
      '/product*',
      '/supplies*',
      '/professional-services*',
      '/managed-services*',
      '/software-products*',
      '/service-products*',
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
    ],
  },
  {
    id: 'equipment',
    title: 'Equipment Lifecycle',
    icon: Truck,
    path: '/equipment-lifecycle',
    matchPatterns: ['/equipment*', '/purchase-orders*', '/warehouse*', '/inventory*'],
    children: [
      { title: 'Equipment Lifecycle', path: '/equipment-lifecycle', icon: Truck },
      { title: 'Purchase Orders', path: '/purchase-orders', icon: ShoppingCart },
      { title: 'Warehouse Operations', path: '/warehouse-operations', icon: Building2 },
      { title: 'Inventory Management', path: '/inventory', icon: Package },
      { title: 'Equipment Management', path: '/equipment-lifecycle-management', icon: Cog },
    ],
  },
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
  {
    id: 'reports',
    title: 'Reports',
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
  {
    id: 'tasks',
    title: 'Task Management',
    icon: CheckSquare,
    path: '/tasks',
    matchPatterns: ['/task*'],
    children: [
      { title: 'Advanced Tasks', path: '/task-management', icon: Brain },
      { title: 'Basic Tasks', path: '/basic-tasks', icon: CheckSquare },
    ],
  },
  {
    id: 'ai-hub',
    title: 'AI Hub',
    icon: Brain,
    path: '/ai-hub',
    matchPatterns: ['/ai*', '/calendar*', '/meeting*', '/search*', '/conversational-ai*'],
    children: [
      { title: 'AI Employees', path: '/ai-employees', icon: Bot },
      { title: 'Calendar Integration', path: '/calendar', icon: Calendar },
      { title: 'Meeting Transcription', path: '/meeting-transcription', icon: Video },
      { title: 'AI Search & Knowledge', path: '/ai-search', icon: Search },
      { title: 'AI Task Scheduling', path: '/ai-task-scheduling', icon: Brain },
      { title: 'Conversation AI', path: '/conversational-ai-dashboard', icon: MessageSquare },
    ],
  },
  {
    id: 'knowledge-base',
    title: 'Knowledge Base',
    icon: BookOpen,
    path: '/knowledge-base',
    matchPatterns: ['/knowledge-base*'],
  },
  {
    id: 'customers',
    title: 'Customers & CRM',
    icon: Building2,
    path: '/customers',
    matchPatterns: ['/customers*', '/crm*', '/business-records*'],
    children: [
      { title: 'All Records', path: '/customers', icon: Building2 },
      { title: 'Leads', path: '/customers?tab=leads', icon: UserPlus },
      { title: 'Prospects', path: '/customers?tab=prospects', icon: Users },
      { title: 'Active Customers', path: '/customers?tab=active', icon: UserCheck },
    ],
  },
  {
    id: 'integrations-hub',
    title: 'Integrations',
    icon: Plug,
    path: '/integration-hub',
    matchPatterns: [
      '/integration*',
      '/quickbooks*',
      '/erp*',
      '/esignature*',
      '/system-integrations*',
    ],
    children: [
      { title: 'Integration Hub', path: '/integration-hub', icon: Plug },
      { title: 'QuickBooks Integration', path: '/quickbooks-integration', icon: DollarSign },
      { title: 'ERP Integration', path: '/erp-integration', icon: Globe },
      { title: 'E-Signature Integration', path: '/esignature-integration', icon: FileSignature },
      { title: 'System Integrations', path: '/system-integrations', icon: Plug },
    ],
  },
  {
    id: 'system-admin',
    title: 'System Administration',
    icon: Settings,
    path: '/workflow-automation',
    matchPatterns: [
      '/workflow*',
      '/business-process*',
      '/document-management*',
      '/security-compliance*',
      '/deployment*',
      '/customer-number*',
      '/seo*',
    ],
    children: [
      { title: 'SEO Management', path: '/seo', icon: Search },
      { title: 'Workflow Automation', path: '/workflow-automation', icon: Zap },
      {
        title: 'Business Process Optimization',
        path: '/business-process-optimization',
        icon: TrendingUp,
      },
      { title: 'Document Management', path: '/document-management', icon: FileText },
      { title: 'Security & Compliance', path: '/security-compliance-management', icon: Shield },
      { title: 'Deployment Readiness', path: '/deployment-readiness', icon: Rocket },
      { title: 'Performance Monitoring', path: '/performance-monitoring', icon: Activity },
      { title: 'Customer Number Settings', path: '/customer-number-settings', icon: Hash },
    ],
  },
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
      const sectionRule = SECTION_PERMISSIONS[section.id];
      return checkNavigationAccess(sectionRule, userPermissions, userLevel, isPlatformUser);
    })
    .map((section) => {
      if (!section.children) return section;

      const filteredChildren = section.children.filter((child) => {
        const itemRule = ITEM_PERMISSIONS[child.path];
        return checkNavigationAccess(itemRule, userPermissions, userLevel, isPlatformUser);
      });

      if (filteredChildren.length === 0) return null;

      return { ...section, children: filteredChildren };
    })
    .filter((section): section is NavigationSection => section !== null);
}

interface MobileNavigationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MobileNavigationDrawer({
  open,
  onOpenChange,
}: MobileNavigationDrawerProps) {
  const { user } = useAuth();
  const { permissions, level, isPlatformUser } = usePermissions();
  const [location] = useLocation();

  const navigationSections = filterNavigationByPermissions(
    ALL_NAVIGATION_SECTIONS,
    permissions,
    level,
    isPlatformUser,
  );

  const { expandedSections, toggleSection, isExpanded, isActive } =
    useCollapsibleNavigation(navigationSections);

  const renderNavigationItem = (section: NavigationSection) => {
    const hasChildren = section.children && section.children.length > 0;
    const isCurrentlyActive = isActive(section.path);
    const isParentActive = section.children?.some((child) => isActive(child.path));
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
              variant="ghost"
              className={cn(
                'w-full justify-between h-auto py-3 px-4 rounded-lg transition-all duration-200 touch-manipulation',
                'active:scale-[0.98]',
                shouldShowAsActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'hover:bg-accent text-foreground',
                'font-semibold text-sm',
              )}
            >
              <div className="flex items-center gap-3">
                <section.icon className="h-5 w-5 min-w-5" />
                <span className="font-semibold text-left">{section.title}</span>
              </div>
              {isExpanded(section.id) ? (
                <ChevronDown className="h-4 w-4 min-w-4" />
              ) : (
                <ChevronRight className="h-4 w-4 min-w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-1 mt-1">
            {section.children?.map((child) => (
              <Link key={child.path} href={child.path}>
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    'w-full justify-start h-auto py-2.5 px-4 pl-12 rounded-md transition-all duration-200 touch-manipulation',
                    'active:scale-[0.98]',
                    isActive(child.path)
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'hover:bg-accent/50 text-muted-foreground',
                    'text-sm',
                  )}
                >
                  <div className="flex items-center gap-3 w-full">
                    {child.icon && <child.icon className="h-4 w-4 min-w-4" />}
                    <span className="text-left flex-1">{child.title}</span>
                  </div>
                </Button>
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
      );
    } else {
      return (
        <Link key={section.id} href={section.path}>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className={cn(
              'w-full justify-start h-auto py-3 px-4 rounded-lg transition-all duration-200 touch-manipulation',
              'active:scale-[0.98]',
              isCurrentlyActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'hover:bg-accent text-foreground',
              'font-semibold text-sm',
            )}
          >
            <div className="flex items-center gap-3">
              <section.icon className="h-5 w-5 min-w-5" />
              <span className="font-semibold text-left">{section.title}</span>
            </div>
          </Button>
        </Link>
      );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b bg-background sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-md">
                <Globe className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <SheetTitle className="text-lg">Navigation</SheetTitle>
                <SheetDescription className="text-xs">Access all features</SheetDescription>
              </div>
            </div>
            <SheetClose className="rounded-full h-10 w-10 flex items-center justify-center hover:bg-accent touch-manipulation active:scale-95">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>
        </SheetHeader>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {navigationSections.map((section) => renderNavigationItem(section))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-background sticky bottom-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-border">
              <AvatarImage src={user?.picture} alt={user?.name} />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                {user?.name
                  ?.split(' ')
                  .map((n: string) => n[0])
                  .join('') || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
