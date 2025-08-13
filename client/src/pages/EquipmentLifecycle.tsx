import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Package, 
  Truck, 
  Wrench, 
  FileCheck, 
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  Plus,
  BarChart3,
  ShoppingCart,
  Warehouse,
  Calendar,
  Camera,
  Shield,
  Zap,
  TrendingUp,
  Activity,
  Users,
  DollarSign,
  Target,
  Workflow,
  Settings,
  Eye,
  Edit,
  PlayCircle,
  PauseCircle,
  RotateCcw
} from "lucide-react";

interface LifecycleStage {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  category: string;
  status: "active" | "setup" | "coming-soon";
  activeItems?: number;
  completionRate?: number;
}

const lifecycleStages: LifecycleStage[] = [
  {
    id: "procurement",
    title: "Purchase Orders & Procurement",
    description: "Manage orders, vendor relationships, and equipment procurement workflows",
    icon: ShoppingCart,
    path: "/equipment/procurement",
    category: "Procurement",
    status: "active",
    activeItems: 12,
    completionRate: 85
  },
  {
    id: "warehouse",
    title: "Warehouse Operations",
    description: "Receiving, quality control, staging, and inventory management",
    icon: Warehouse,
    path: "/equipment/warehouse",
    category: "Operations",
    status: "active", 
    activeItems: 34,
    completionRate: 92
  },
  {
    id: "delivery",
    title: "Delivery Logistics",
    description: "Route optimization, scheduling, and white glove delivery services",
    icon: Truck,
    path: "/equipment/delivery",
    category: "Logistics",
    status: "active",
    activeItems: 8,
    completionRate: 78
  },
  {
    id: "installation",
    title: "Installation Management",
    description: "Field service, certified technician deployment, and setup workflows",
    icon: Wrench,
    path: "/equipment/installation",
    category: "Service",
    status: "active",
    activeItems: 15,
    completionRate: 88
  },
  {
    id: "documentation",
    title: "Documentation & Compliance",
    description: "Warranty registration, photo documentation, and compliance tracking",
    icon: FileCheck,
    path: "/equipment/documentation",
    category: "Compliance",
    status: "active",
    activeItems: 23,
    completionRate: 95
  },
  {
    id: "tracking",
    title: "Asset Lifecycle Tracking",
    description: "End-to-end equipment tracking with QR codes and manufacturer integration",
    icon: MapPin, 
    path: "/equipment/tracking",
    category: "Technology",
    status: "active",
    activeItems: 67,
    completionRate: 90
  }
];

const quickActions = [
  { title: "Create Purchase Order", icon: ShoppingCart, action: "create-po" },
  { title: "Schedule Installation", icon: Calendar, action: "schedule" },
  { title: "Generate QR Codes", icon: Camera, action: "qr-codes" },
  { title: "Warranty Registration", icon: Shield, action: "warranty" },
  { title: "Lifecycle Reports", icon: BarChart3, action: "reports" }
];

const recentActivity = [
  { id: 1, type: "delivery", message: "Canon IR-ADV C3330i delivered to TechCorp Solutions", time: "2 hours ago", status: "completed" },
  { id: 2, type: "installation", message: "Xerox VersaLink C405 - Installation scheduled for tomorrow", time: "4 hours ago", status: "pending" },
  { id: 3, type: "warehouse", message: "HP LaserJet Pro 4301fdw - Quality control completed", time: "6 hours ago", status: "completed" },
  { id: 4, type: "procurement", message: "Purchase order #PO-2025-001 approved", time: "1 day ago", status: "completed" },
  { id: 5, type: "documentation", message: "Warranty registration pending for 3 devices", time: "1 day ago", status: "warning" }
];

// AI-Powered Workflow Templates
const workflowTemplates = [
  {
    id: "standard-delivery",
    name: "Standard Equipment Delivery",
    description: "Complete workflow from procurement to customer delivery",
    steps: ["Procurement", "Warehouse", "Delivery", "Installation", "Documentation"],
    estimatedDays: 7,
    successRate: 94,
    automationLevel: "High"
  },
  {
    id: "rush-installation", 
    name: "Rush Installation Service",
    description: "Expedited workflow for urgent equipment deployments",
    steps: ["Express Procurement", "Priority Warehouse", "Same-Day Delivery", "Emergency Install"],
    estimatedDays: 2,
    successRate: 87,
    automationLevel: "Medium"
  },
  {
    id: "bulk-deployment",
    name: "Bulk Equipment Deployment",
    description: "Optimized workflow for large-scale equipment rollouts",
    steps: ["Bulk Procurement", "Staged Warehouse", "Route Optimization", "Team Installation", "Batch Documentation"],
    estimatedDays: 14,
    successRate: 96,
    automationLevel: "Very High"
  }
];

// Asset Tracking Data
const assetTrackingMetrics = {
  totalAssets: 342,
  inTransit: 23,
  underMaintenance: 8,
  installed: 298,
  warrantyExpiring: 15,
  qrCodeGenerated: 325,
  integrationHealth: 98
};

export default function EquipmentLifecycle() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTab, setSelectedTab] = useState("overview");
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [isAssetTrackingDialogOpen, setIsAssetTrackingDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);

  // Filter stages based on search and category
  const filteredStages = lifecycleStages.filter(stage => {
    const matchesSearch = stage.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         stage.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || stage.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ["all", ...Array.from(new Set(lifecycleStages.map(s => s.category)))];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "warning": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return CheckCircle;
      case "pending": return Clock;
      case "warning": return AlertTriangle;
      default: return Clock;
    }
  };

  const totalActiveItems = lifecycleStages.reduce((sum, stage) => sum + (stage.activeItems || 0), 0);
  const averageCompletion = lifecycleStages.reduce((sum, stage) => sum + (stage.completionRate || 0), 0) / lifecycleStages.length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Enhanced Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Equipment Lifecycle Management</h1>
            <p className="text-muted-foreground mt-2">
              AI-powered equipment lifecycle with workflow automation and asset tracking
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={() => setIsWorkflowDialogOpen(true)}
            >
              <Workflow className="h-4 w-4 mr-2" />
              Workflow Automation
            </Button>
            <Button 
              variant="outline"
              onClick={() => setIsAssetTrackingDialogOpen(true)}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Asset Tracking
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Start New Lifecycle
            </Button>
          </div>
        </div>

        {/* Enhanced Navigation Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="workflows">AI Workflows</TabsTrigger>
            <TabsTrigger value="tracking">Asset Tracking</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalActiveItems}</div>
              <p className="text-xs text-muted-foreground">Across all stages</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(averageCompletion)}%</div>
              <Progress value={averageCompletion} className="mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Installations</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">15</div>
              <p className="text-xs text-muted-foreground">Next 7 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">95%</div>
              <p className="text-xs text-muted-foreground">Documentation complete</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search lifecycle stages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="capitalize"
              >
                {category === "all" ? "All Categories" : category}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Lifecycle Stages */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Lifecycle Stages</h2>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Order
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredStages.map((stage) => {
                const IconComponent = stage.icon;
                return (
                  <Card key={stage.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <Link href={stage.path}>
                      <CardHeader className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <IconComponent className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{stage.title}</CardTitle>
                              <Badge variant="secondary" className="text-xs">
                                {stage.category}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <CardDescription className="text-sm mb-4">
                          {stage.description}
                        </CardDescription>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Active Items</span>
                            <span className="font-medium">{stage.activeItems || 0}</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Completion</span>
                              <span className="font-medium">{stage.completionRate || 0}%</span>
                            </div>
                            <Progress value={stage.completionRate || 0} className="h-2" />
                          </div>
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Sidebar - Quick Actions & Recent Activity */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
                <CardDescription>Common lifecycle management tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    <action.icon className="h-4 w-4 mr-2" />
                    {action.title}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Latest lifecycle updates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentActivity.map((activity) => {
                  const StatusIcon = getStatusIcon(activity.status);
                  return (
                    <div key={activity.id} className="flex items-start space-x-3">
                      <StatusIcon className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {activity.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.time}
                        </p>
                      </div>
                      <Badge className={`text-xs ${getStatusColor(activity.status)}`}>
                        {activity.status}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>

            {filteredStages.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No stages found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search terms or category filter.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* AI Workflows Tab */}
          <TabsContent value="workflows" className="space-y-6">
            <div className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {workflowTemplates.map((template) => (
                  <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow" 
                        onClick={() => {
                          setSelectedWorkflow(template);
                          setIsWorkflowDialogOpen(true);
                        }}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant={
                          template.automationLevel === "Very High" ? "default" :
                          template.automationLevel === "High" ? "secondary" : 
                          "outline"
                        }>
                          {template.automationLevel}
                        </Badge>
                      </div>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Duration</span>
                          <span className="font-medium">{template.estimatedDays} days</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Success Rate</span>
                          <span className="font-medium text-green-600">{template.successRate}%</span>
                        </div>
                        <div className="space-y-2">
                          <span className="text-sm text-muted-foreground">Workflow Steps</span>
                          <div className="flex flex-wrap gap-1">
                            {template.steps.map((step, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {step}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Asset Tracking Tab */}
          <TabsContent value="tracking" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{assetTrackingMetrics.totalAssets}</div>
                  <p className="text-xs text-muted-foreground">Tracked equipment</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">In Transit</CardTitle>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{assetTrackingMetrics.inTransit}</div>
                  <p className="text-xs text-muted-foreground">Currently shipping</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">QR Generated</CardTitle>
                  <Camera className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{assetTrackingMetrics.qrCodeGenerated}</div>
                  <p className="text-xs text-muted-foreground">Asset labels ready</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Integration Health</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{assetTrackingMetrics.integrationHealth}%</div>
                  <p className="text-xs text-muted-foreground">System connectivity</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Equipment Lifecycle Analytics
                </CardTitle>
                <CardDescription>
                  AI-powered insights and performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Workflow Efficiency</h4>
                      <Progress value={92} className="h-2" />
                      <p className="text-xs text-muted-foreground">92% average completion rate</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Time to Deployment</h4>
                      <Progress value={78} className="h-2" />
                      <p className="text-xs text-muted-foreground">22% faster than industry average</p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <h4 className="font-medium mb-3">Performance Insights</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Automated Tasks</span>
                        <Badge variant="secondary">89% automation rate</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Customer Satisfaction</span>
                        <Badge variant="default">4.8/5 rating</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Cost Optimization</span>
                        <Badge variant="outline">$12K monthly savings</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Workflow Automation Dialog */}
        <Dialog open={isWorkflowDialogOpen} onOpenChange={setIsWorkflowDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Workflow Automation</DialogTitle>
              <DialogDescription>
                Configure AI-powered equipment lifecycle workflows
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {workflowTemplates.map((template) => (
                <div key={template.id} className="p-4 border rounded-lg">
                  <h4 className="font-medium">{template.name}</h4>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge variant="outline">{template.automationLevel}</Badge>
                    <Button size="sm">
                      <PlayCircle className="h-4 w-4 mr-1" />
                      Start
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Asset Tracking Dialog */}
        <Dialog open={isAssetTrackingDialogOpen} onOpenChange={setIsAssetTrackingDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Asset Tracking Dashboard</DialogTitle>
              <DialogDescription>
                Real-time equipment tracking and monitoring
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 border rounded">
                  <div className="text-2xl font-bold text-green-600">{assetTrackingMetrics.installed}</div>
                  <div className="text-sm text-muted-foreground">Installed</div>
                </div>
                <div className="text-center p-4 border rounded">
                  <div className="text-2xl font-bold text-orange-600">{assetTrackingMetrics.warrantyExpiring}</div>
                  <div className="text-sm text-muted-foreground">Warranty Expiring</div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Quick Actions</h4>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Camera className="h-4 w-4 mr-2" />
                    Generate QR Codes
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <MapPin className="h-4 w-4 mr-2" />
                    Track Location
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Reports
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}