import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
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
  PieChart
} from "lucide-react";

const navigationSections = [
  {
    name: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Customers', href: '/customers', icon: Users },
    ]
  },
  {
    name: 'Sales',
    items: [
      { name: 'CRM & Pipeline', href: '/crm', icon: Target },
      { name: 'Quotes & Proposals', href: '/quotes', icon: FileText },
      { name: 'Sales Reports', href: '/sales-reports', icon: TrendingUp },
    ]
  },
  {
    name: 'Service',
    items: [
      { name: 'Service Dispatch', href: '/service-dispatch', icon: Wrench },
      { name: 'Meter Readings', href: '/meter-readings', icon: Calculator },
      { name: 'Service Reports', href: '/service-reports', icon: ClipboardList },
    ]
  },
  {
    name: 'Financial',
    items: [
      { name: 'Invoices', href: '/invoices', icon: FileText },
      { name: 'Revenue Reports', href: '/revenue-reports', icon: DollarSign },
      { name: 'Financial Analytics', href: '/financial-analytics', icon: PieChart },
    ]
  },
  {
    name: 'Admin',
    items: [
      { name: 'Product Models', href: '/product-models', icon: Printer },
      { name: 'Product Accessories', href: '/product-accessories', icon: Package },
      { name: 'Inventory', href: '/inventory', icon: Package },
      { name: 'Contracts', href: '/contracts', icon: FileText },
      { name: 'User Management', href: '/user-management', icon: UserCog },
      { name: 'System Settings', href: '/settings', icon: Shield },
    ]
  },
  {
    name: 'Reports',
    items: [
      { name: 'All Reports', href: '/reports', icon: BarChart3 },
      { name: 'Custom Reports', href: '/custom-reports', icon: ClipboardList },
    ]
  }
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <aside className="hidden lg:flex w-64 bg-white shadow-sm border-r border-gray-200 flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Printer className="text-white text-sm h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Printyx</h1>
        </div>
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
