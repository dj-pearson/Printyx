import { useMemo } from "react";
import { useLocation, Link } from "wouter";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  Plus,
  FileText,
  Calendar,
  DollarSign,
  Wrench,
  Package,
  Eye,
  Edit,
  Trash,
  Download,
} from "lucide-react";

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "destructive";
}

interface SmartBreadcrumbProps {
  customSegments?: BreadcrumbSegment[];
  quickActions?: QuickAction[];
}

export function SmartBreadcrumb({
  customSegments,
  quickActions,
}: SmartBreadcrumbProps) {
  const [location] = useLocation();

  // Auto-generate breadcrumbs from route if not provided
  const segments = useMemo((): BreadcrumbSegment[] => {
    if (customSegments) return customSegments;

    const pathParts = location.split("/").filter(Boolean);
    const breadcrumbs: BreadcrumbSegment[] = [
      { label: "Home", href: "/dashboard" },
    ];

    let currentPath = "";
    pathParts.forEach((part, index) => {
      currentPath += `/${part}`;
      const isLast = index === pathParts.length - 1;

      // Format label (capitalize, remove dashes, handle IDs)
      let label = part
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      // If it looks like a UUID or ID, use generic label
      if (
        part.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        ) ||
        part.match(/^\d+$/)
      ) {
        label = "Details";
      }

      // Map known routes to friendly names
      const routeMap: Record<string, string> = {
        "service-hub": "Service Management",
        "service-dispatch": "Dispatch Board",
        "meter-billing": "Meter Billing",
        "meter-readings": "Meter Readings",
        "warehouse-operations": "Warehouse",
        "performance-monitoring": "Analytics",
        "customer-portal": "Customer Portal",
      };

      if (routeMap[part]) {
        label = routeMap[part];
      }

      breadcrumbs.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    });

    return breadcrumbs;
  }, [location, customSegments]);

  // Context-aware quick actions based on current route
  const contextQuickActions = useMemo((): QuickAction[] => {
    if (quickActions) return quickActions;

    const actions: QuickAction[] = [];

    // Determine context from route
    if (location.includes("/customers")) {
      actions.push(
        {
          label: "New Customer",
          icon: <Plus className="h-4 w-4" />,
          href: "/customers?action=new",
        },
        {
          label: "View All",
          icon: <Eye className="h-4 w-4" />,
          href: "/customers",
        },
        {
          label: "Export List",
          icon: <Download className="h-4 w-4" />,
          onClick: () => console.log("Export customers"),
        }
      );

      // If viewing a specific customer, add customer-specific actions
      if (location.match(/\/customers\/[^/]+$/)) {
        actions.unshift(
          {
            label: "Create Service Request",
            icon: <Wrench className="h-4 w-4" />,
            href: "/service-hub?action=new",
          },
          {
            label: "Generate Invoice",
            icon: <DollarSign className="h-4 w-4" />,
            href: "/invoices?action=new",
          },
          {
            label: "Submit Meter Reading",
            icon: <FileText className="h-4 w-4" />,
            href: "/meter-readings?action=new",
          }
        );
      }
    } else if (location.includes("/service-hub") || location.includes("/service-dispatch")) {
      actions.push(
        {
          label: "New Service Request",
          icon: <Plus className="h-4 w-4" />,
          href: "/service-hub?action=new",
        },
        {
          label: "Dispatch Board",
          icon: <Calendar className="h-4 w-4" />,
          href: "/service-dispatch",
        },
        {
          label: "Service Hub",
          icon: <Wrench className="h-4 w-4" />,
          href: "/service-hub",
        }
      );
    } else if (location.includes("/equipment")) {
      actions.push(
        {
          label: "Add Equipment",
          icon: <Plus className="h-4 w-4" />,
          href: "/equipment?action=new",
        },
        {
          label: "View All Equipment",
          icon: <Eye className="h-4 w-4" />,
          href: "/equipment",
        }
      );
    } else if (location.includes("/invoices")) {
      actions.push(
        {
          label: "Generate Invoice",
          icon: <Plus className="h-4 w-4" />,
          href: "/invoices?action=new",
        },
        {
          label: "View All Invoices",
          icon: <Eye className="h-4 w-4" />,
          href: "/invoices",
        }
      );
    } else if (location.includes("/warehouse")) {
      actions.push(
        {
          label: "Add Part",
          icon: <Plus className="h-4 w-4" />,
          href: "/warehouse-operations?action=new-part",
        },
        {
          label: "Transfer Parts",
          icon: <Package className="h-4 w-4" />,
          href: "/warehouse-operations?action=transfer",
        }
      );
    }

    return actions;
  }, [location, quickActions]);

  // Don't show breadcrumbs on home/dashboard
  if (location === "/" || location === "/dashboard") {
    return null;
  }

  return (
    <div className="flex items-center justify-between py-2 px-1 border-b bg-white/50">
      <Breadcrumb>
        <BreadcrumbList>
          {segments.map((segment, index) => (
            <div key={index} className="contents">
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {segment.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={segment.href}>{segment.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Quick Actions Dropdown */}
      {contextQuickActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1">
              Quick Actions
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {contextQuickActions.map((action, index) => (
              <div key={index}>
                {index > 0 &&
                  action.variant === "destructive" &&
                  contextQuickActions[index - 1]?.variant !== "destructive" && (
                    <DropdownMenuSeparator />
                  )}
                <DropdownMenuItem
                  onClick={action.onClick}
                  asChild={!!action.href}
                  className={
                    action.variant === "destructive"
                      ? "text-destructive focus:text-destructive"
                      : ""
                  }
                >
                  {action.href ? (
                    <Link href={action.href}>
                      {action.icon}
                      <span className="ml-2">{action.label}</span>
                    </Link>
                  ) : (
                    <div className="flex items-center">
                      {action.icon}
                      <span className="ml-2">{action.label}</span>
                    </div>
                  )}
                </DropdownMenuItem>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
