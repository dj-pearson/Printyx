import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import {
  Building2,
  UserCheck,
  Monitor,
  Zap,
  ArrowRight,
  Users,
  Shield,
  Database,
  Globe,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Rocket,
  FileText,
  Settings,
  Smartphone,
  Share2,
  Brain
} from "lucide-react";

export default function AdminHub() {
  // Fetch quick stats for the dashboard
  const { data: stats } = useQuery({
    queryKey: ["/api/root-admin/overview"],
    refetchInterval: 30000,
  });

  const quickStats = [
    { label: "Total Tenants", value: stats?.totalTenants || 0, icon: Building2, color: "text-blue-600" },
    { label: "Active Users", value: stats?.activeUsers || 0, icon: Users, color: "text-green-600" },
    { label: "System Health", value: stats?.systemHealth || "healthy", icon: Activity, color: stats?.systemHealth === "healthy" ? "text-green-600" : "text-orange-600" },
    { label: "Critical Alerts", value: stats?.criticalAlerts || 0, icon: AlertTriangle, color: stats?.criticalAlerts > 0 ? "text-red-600" : "text-gray-400" },
  ];

  const adminSections = [
    {
      id: "tenant-org",
      title: "Tenant & Organization Management",
      description: "Manage tenants, onboarding, signups, and customer portals",
      icon: Building2,
      color: "from-blue-500 to-blue-600",
      stats: [
        { label: "Total Tenants", value: stats?.totalTenants || 0 },
        { label: "Active", value: stats?.activeTenants || 0 },
      ],
      links: [
        { title: "Tenant Management", path: "/admin/tenant-management", icon: Building2 },
        { title: "Tenant Onboarding", path: "/tenant-setup", icon: Rocket },
        { title: "Signups & Trials CRM", path: "/root-admin-signups-crm", icon: TrendingUp },
        { title: "Customer Portal", path: "/customer-self-service-portal", icon: UserCheck },
      ]
    },
    {
      id: "user-access",
      title: "User & Access Management",
      description: "Control users, roles, security permissions, and compliance",
      icon: UserCheck,
      color: "from-purple-500 to-purple-600",
      stats: [
        { label: "Total Users", value: stats?.totalUsers || 0 },
        { label: "Active", value: stats?.activeUsers || 0 },
      ],
      links: [
        { title: "User Management", path: "/admin/user-management", icon: Users },
        { title: "Role Management", path: "/role-management", icon: Shield },
        { title: "Security & Permissions", path: "/admin/root-admin-security", icon: Shield },
        { title: "Audit & Compliance", path: "/security-compliance-management", icon: FileText },
      ]
    },
    {
      id: "system-ops",
      title: "System Operations & Monitoring",
      description: "Monitor system health, manage databases, and configure platform",
      icon: Monitor,
      color: "from-green-500 to-green-600",
      stats: [
        { label: "System Uptime", value: `${stats?.systemUptime || 99.97}%` },
        { label: "Health", value: stats?.systemHealth || "healthy" },
      ],
      links: [
        { title: "Admin Command Center", path: "/admin-command-center", icon: Zap },
        { title: "System Dashboard", path: "/root-admin-dashboard", icon: Activity },
        { title: "Database Management", path: "/database-management", icon: Database },
        { title: "Platform Analytics", path: "/admin/platform-analytics", icon: TrendingUp },
        { title: "System Configuration", path: "/platform-configuration", icon: Settings },
        { title: "Mobile Optimization", path: "/mobile-optimization", icon: Smartphone },
      ]
    },
    {
      id: "platform-features",
      title: "Platform Features & Tools",
      description: "Manage SEO, social media, AI features, and advanced tools",
      icon: Zap,
      color: "from-orange-500 to-orange-600",
      stats: [
        { label: "Active Features", value: "12" },
        { label: "Integrations", value: "8" },
      ],
      links: [
        { title: "SEO Management", path: "/root-admin/seo", icon: Globe },
        { title: "Social Media Generator", path: "/social-media-generator", icon: Share2 },
        { title: "GPT-5 AI Dashboard", path: "/gpt5-dashboard", icon: Brain },
      ]
    }
  ];

  return (
    <MainLayout
      title="Platform Admin Hub"
      description="Centralized administration and management for the Printyx platform"
    >
      <div className="container mx-auto p-6 space-y-6">
        {/* Quick Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {quickStats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">
                      {typeof stat.value === 'string' ? stat.value : stat.value.toLocaleString()}
                    </p>
                  </div>
                  <stat.icon className={`w-8 h-8 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Admin Sections - 4 Quadrant Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {adminSections.map((section) => (
            <Card key={section.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${section.color} flex items-center justify-center`}>
                      <section.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        {section.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Section Stats */}
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  {section.stats.map((stat, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">{stat.label}</p>
                        <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                      </div>
                      {idx < section.stats.length - 1 && (
                        <div className="h-8 w-px bg-gray-300" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Quick Links */}
                <div className="space-y-2">
                  {section.links.map((link) => (
                    <Link key={link.path} href={link.path}>
                      <Button
                        variant="ghost"
                        className="w-full justify-between h-auto py-3 px-4 hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <link.icon className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium">{link.title}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </Button>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* System Status Banner */}
        {stats?.systemHealth === "healthy" && stats?.criticalAlerts === 0 ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">All Systems Operational</p>
                  <p className="text-sm text-green-700">
                    Platform is running smoothly with {stats?.systemUptime}% uptime
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-900">Attention Required</p>
                    <p className="text-sm text-orange-700">
                      {stats?.criticalAlerts || 0} critical alert(s) need review
                    </p>
                  </div>
                </div>
                <Link href="/root-admin-dashboard">
                  <Button size="sm" variant="outline" className="border-orange-300">
                    View Details
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
