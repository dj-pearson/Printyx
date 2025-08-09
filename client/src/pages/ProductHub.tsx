import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import MainLayout from "@/components/layout/main-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Monitor,
  Wrench,
  Users,
  Cog,
  Package,
  Server,
  Layers,
  Search,
  Plus,
  BarChart3,
  FileText,
  Settings,
} from "lucide-react";

interface ProductModule {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  category: string;
  itemCount?: number;
  status: "active" | "setup" | "coming-soon";
}

const productModules: ProductModule[] = [
  {
    id: "product-models",
    title: "Product Models",
    description:
      "Manage copier equipment with CPC rates and manufacturer specifications",
    icon: Monitor,
    path: "/product-models",
    category: "Hardware",
    itemCount: 45,
    status: "active",
  },
  {
    id: "product-accessories",
    title: "Product Accessories",
    description: "Hardware add-ons with model compatibility tracking",
    icon: Wrench,
    path: "/product-accessories",
    category: "Hardware",
    itemCount: 23,
    status: "active",
  },
  {
    id: "professional-services",
    title: "Professional Services",
    description: "Consulting, installation, and training service offerings",
    icon: Users,
    path: "/professional-services",
    category: "Services",
    itemCount: 12,
    status: "active",
  },
  {
    id: "service-products",
    title: "Service Products",
    description: "Ongoing service offerings with subscription models",
    icon: Cog,
    path: "/service-products",
    category: "Services",
    itemCount: 8,
    status: "active",
  },
  {
    id: "supplies",
    title: "Supplies",
    description:
      "Consumables, toner, paper, and maintenance kits with inventory tracking",
    icon: Package,
    path: "/supplies",
    category: "Consumables",
    itemCount: 156,
    status: "active",
  },
  {
    id: "inventory",
    title: "Inventory",
    description: "Stock levels, adjustments, reorders, and receiving",
    icon: Package,
    path: "/inventory",
    category: "Operations",
    itemCount: 0,
    status: "active",
  },
  {
    id: "it-services",
    title: "IT & Managed Services",
    description: "Network management, cloud services, security, and IT support",
    icon: Server,
    path: "/managed-services",
    category: "Technology",
    itemCount: 18,
    status: "active",
  },
  {
    id: "software-products",
    title: "Software Products",
    description: "Licenses and software offerings with pricing and bundles",
    icon: Layers,
    path: "/software-products",
    category: "Technology",
    itemCount: 0,
    status: "active",
  },
];

const quickActions = [
  { title: "Bulk Import Products", icon: FileText, action: "import" },
  { title: "Generate Product Reports", icon: BarChart3, action: "reports" },
  { title: "Product Settings", icon: Settings, action: "settings" },
];

export default function ProductHub() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Filter modules based on search and category
  const filteredModules = productModules.filter((module) => {
    const matchesSearch =
      module.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      module.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || module.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    "all",
    ...Array.from(new Set(productModules.map((m) => m.category))),
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "setup":
        return "bg-yellow-100 text-yellow-800";
      case "coming-soon":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "setup":
        return "Setup Required";
      case "coming-soon":
        return "Coming Soon";
      default:
        return "Unknown";
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Product Management Hub
            </h1>
            <p className="text-muted-foreground mt-2">
              Centralized management for all product categories and services
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Products
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {productModules.reduce(
                  (sum, module) => sum + (module.itemCount || 0),
                  0
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Modules
              </CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {productModules.filter((m) => m.status === "active").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length - 1}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Services</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {productModules
                  .filter((m) => m.category === "Services")
                  .reduce((sum, module) => sum + (module.itemCount || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search product modules..."
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>Common product management tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center space-y-2"
                >
                  <action.icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{action.title}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Product Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModules.map((module) => {
            const IconComponent = module.icon;
            return (
              <Card
                key={module.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
              >
                <Link href={module.path}>
                  <CardHeader className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <IconComponent className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {module.title}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {module.category}
                          </Badge>
                        </div>
                      </div>
                      <Badge
                        className={`text-xs ${getStatusColor(module.status)}`}
                      >
                        {getStatusText(module.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm mb-4">
                      {module.description}
                    </CardDescription>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {module.itemCount
                          ? `${module.itemCount} items`
                          : "No items"}
                      </div>
                      <Button size="sm" variant="ghost">
                        Manage <Plus className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>

        {filteredModules.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No modules found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search terms or category filter.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
