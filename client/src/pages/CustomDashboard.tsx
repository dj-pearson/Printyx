/**
 * Custom Dashboard Page
 *
 * A fully customizable dashboard with:
 * - Drag-and-drop widget reordering
 * - Widget resizing
 * - Widget visibility control
 * - Backend persistence via dashboardLayouts table
 * - Widget library with various widget types
 */

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Settings,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  Plus,
  LayoutGrid,
  Maximize2,
  Minimize2,
  X,
  Loader2,
  TrendingUp,
  Users,
  DollarSign,
  Wrench,
  Package,
  Calendar,
  Target,
  BarChart3,
  PieChart,
  LineChart,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

// Widget definitions
interface WidgetDefinition {
  id: string;
  type: string;
  title: string;
  description: string;
  icon: typeof TrendingUp;
  category: "metrics" | "charts" | "activity" | "tasks" | "team" | "custom";
  defaultSize: "small" | "medium" | "large" | "full";
  minSize: "small" | "medium" | "large" | "full";
  dataEndpoint?: string;
  configurable?: boolean;
}

// Widget instance in a layout
interface WidgetInstance {
  id: string;
  definitionId: string;
  size: "small" | "medium" | "large" | "full";
  visible: boolean;
  order: number;
  config?: Record<string, any>;
}

// Dashboard layout
interface DashboardLayout {
  id?: string;
  name: string;
  widgets: WidgetInstance[];
  isDefault: boolean;
}

// Available widget definitions
const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  // Metric widgets
  {
    id: "total-revenue",
    type: "stat",
    title: "Total Revenue",
    description: "Current month's total revenue",
    icon: DollarSign,
    category: "metrics",
    defaultSize: "small",
    minSize: "small",
    dataEndpoint: "/api/dashboard/metrics/revenue",
  },
  {
    id: "active-customers",
    type: "stat",
    title: "Active Customers",
    description: "Number of active customers",
    icon: Users,
    category: "metrics",
    defaultSize: "small",
    minSize: "small",
    dataEndpoint: "/api/dashboard/metrics/customers",
  },
  {
    id: "open-opportunities",
    type: "stat",
    title: "Open Opportunities",
    description: "Total value of open deals",
    icon: Target,
    category: "metrics",
    defaultSize: "small",
    minSize: "small",
    dataEndpoint: "/api/dashboard/metrics/opportunities",
  },
  {
    id: "service-tickets",
    type: "stat",
    title: "Open Tickets",
    description: "Number of open service tickets",
    icon: Wrench,
    category: "metrics",
    defaultSize: "small",
    minSize: "small",
    dataEndpoint: "/api/dashboard/metrics/tickets",
  },
  {
    id: "inventory-alerts",
    type: "stat",
    title: "Low Stock Items",
    description: "Items below reorder point",
    icon: Package,
    category: "metrics",
    defaultSize: "small",
    minSize: "small",
    dataEndpoint: "/api/dashboard/metrics/inventory-alerts",
  },
  {
    id: "upcoming-renewals",
    type: "stat",
    title: "Upcoming Renewals",
    description: "Contracts expiring in 30 days",
    icon: Calendar,
    category: "metrics",
    defaultSize: "small",
    minSize: "small",
    dataEndpoint: "/api/dashboard/metrics/renewals",
  },

  // Chart widgets
  {
    id: "sales-pipeline",
    type: "bar-chart",
    title: "Sales Pipeline",
    description: "Opportunities by stage",
    icon: BarChart3,
    category: "charts",
    defaultSize: "large",
    minSize: "medium",
    dataEndpoint: "/api/dashboard/charts/pipeline",
    configurable: true,
  },
  {
    id: "revenue-trend",
    type: "line-chart",
    title: "Revenue Trend",
    description: "Monthly revenue over time",
    icon: LineChart,
    category: "charts",
    defaultSize: "large",
    minSize: "medium",
    dataEndpoint: "/api/dashboard/charts/revenue-trend",
    configurable: true,
  },
  {
    id: "customer-distribution",
    type: "pie-chart",
    title: "Customer Distribution",
    description: "Customers by industry",
    icon: PieChart,
    category: "charts",
    defaultSize: "medium",
    minSize: "medium",
    dataEndpoint: "/api/dashboard/charts/customer-distribution",
    configurable: true,
  },
  {
    id: "service-metrics",
    type: "bar-chart",
    title: "Service Metrics",
    description: "Tickets by status",
    icon: BarChart3,
    category: "charts",
    defaultSize: "medium",
    minSize: "medium",
    dataEndpoint: "/api/dashboard/charts/service-metrics",
  },

  // Activity widgets
  {
    id: "recent-activity",
    type: "activity-feed",
    title: "Recent Activity",
    description: "Latest system activity",
    icon: Clock,
    category: "activity",
    defaultSize: "medium",
    minSize: "small",
    dataEndpoint: "/api/dashboard/activity",
  },
  {
    id: "urgent-items",
    type: "priority-list",
    title: "Urgent Items",
    description: "High priority items needing attention",
    icon: AlertCircle,
    category: "activity",
    defaultSize: "medium",
    minSize: "small",
    dataEndpoint: "/api/dashboard/urgent",
  },

  // Task widgets
  {
    id: "my-tasks",
    type: "task-list",
    title: "My Tasks",
    description: "Your assigned tasks",
    icon: CheckCircle2,
    category: "tasks",
    defaultSize: "medium",
    minSize: "small",
    dataEndpoint: "/api/dashboard/my-tasks",
  },

  // Team widgets
  {
    id: "team-performance",
    type: "leaderboard",
    title: "Team Performance",
    description: "Sales team leaderboard",
    icon: TrendingUp,
    category: "team",
    defaultSize: "medium",
    minSize: "medium",
    dataEndpoint: "/api/dashboard/team-performance",
  },
];

// Size to grid column mapping
const SIZE_TO_COLS = {
  small: "col-span-1",
  medium: "col-span-1 md:col-span-2",
  large: "col-span-1 md:col-span-3",
  full: "col-span-1 md:col-span-4",
};

// Sortable widget component
function SortableWidget({
  widget,
  definition,
  isEditMode,
  onToggleVisibility,
  onResize,
  onRemove,
  data,
  isLoading,
}: {
  widget: WidgetInstance;
  definition: WidgetDefinition;
  isEditMode: boolean;
  onToggleVisibility: () => void;
  onResize: (size: WidgetInstance["size"]) => void;
  onRemove: () => void;
  data?: any;
  isLoading?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (!widget.visible && !isEditMode) return null;

  const Icon = definition.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        SIZE_TO_COLS[widget.size],
        isDragging && "opacity-50 z-50",
        !widget.visible && "opacity-50"
      )}
    >
      <Card className={cn(
        "h-full transition-all",
        isEditMode && "ring-2 ring-primary/20 ring-offset-2"
      )}>
        {/* Edit mode overlay */}
        {isEditMode && (
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-background/90 to-transparent p-2 flex items-center justify-between rounded-t-lg">
            <div
              {...attributes}
              {...listeners}
              className="flex items-center gap-2 cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">{definition.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Maximize2 className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Widget Size</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onResize("small")}>
                    Small (1 column)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onResize("medium")}>
                    Medium (2 columns)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onResize("large")}>
                    Large (3 columns)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onResize("full")}>
                    Full Width (4 columns)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onToggleVisibility}
              >
                {widget.visible ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={onRemove}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Widget Content */}
        <CardHeader className={cn(isEditMode && "pt-10")}>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{definition.title}</CardTitle>
          </div>
          <CardDescription className="text-xs">
            {definition.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <WidgetContent
              type={definition.type}
              data={data}
              size={widget.size}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Widget content renderer
function WidgetContent({
  type,
  data,
  size,
}: {
  type: string;
  data?: any;
  size: string;
}) {
  // Mock data for demo - in production this would come from API
  switch (type) {
    case "stat":
      return (
        <div className="space-y-2">
          <div className="text-3xl font-bold">
            {data?.value || "—"}
          </div>
          {data?.change !== undefined && (
            <div className={cn(
              "text-sm flex items-center gap-1",
              data.change > 0 ? "text-green-600" : data.change < 0 ? "text-red-600" : "text-muted-foreground"
            )}>
              <TrendingUp className={cn(
                "h-4 w-4",
                data.change < 0 && "rotate-180"
              )} />
              {Math.abs(data.change)}% vs last period
            </div>
          )}
        </div>
      );

    case "bar-chart":
    case "line-chart":
    case "pie-chart":
      return (
        <div className={cn(
          "flex items-center justify-center bg-muted/50 rounded-md",
          size === "small" ? "h-24" : size === "medium" ? "h-40" : "h-60"
        )}>
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Chart visualization</p>
            <p className="text-xs">Connect data source to display</p>
          </div>
        </div>
      );

    case "activity-feed":
      return (
        <div className="space-y-3">
          {(data?.items || [
            { id: 1, text: "New customer added", time: "2 min ago" },
            { id: 2, text: "Invoice #1234 paid", time: "1 hour ago" },
            { id: 3, text: "Service ticket resolved", time: "3 hours ago" },
          ]).slice(0, 5).map((item: any) => (
            <div key={item.id} className="flex items-start gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
              <div className="flex-1">
                <p>{item.text}</p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      );

    case "priority-list":
      return (
        <div className="space-y-2">
          {(data?.items || [
            { id: 1, title: "Critical server issue", priority: "critical" },
            { id: 2, title: "Customer escalation", priority: "high" },
            { id: 3, title: "Contract expiring", priority: "medium" },
          ]).slice(0, 5).map((item: any) => (
            <div key={item.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
              <div className={cn(
                "h-2 w-2 rounded-full",
                item.priority === "critical" ? "bg-red-500" :
                item.priority === "high" ? "bg-orange-500" :
                item.priority === "medium" ? "bg-yellow-500" : "bg-gray-400"
              )} />
              <span className="text-sm truncate">{item.title}</span>
            </div>
          ))}
        </div>
      );

    case "task-list":
      return (
        <div className="space-y-2">
          {(data?.items || [
            { id: 1, title: "Follow up with client", done: false },
            { id: 2, title: "Submit proposal", done: false },
            { id: 3, title: "Review contract", done: true },
          ]).slice(0, 5).map((item: any) => (
            <div key={item.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
              <CheckCircle2 className={cn(
                "h-4 w-4",
                item.done ? "text-green-500" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-sm truncate",
                item.done && "line-through text-muted-foreground"
              )}>{item.title}</span>
            </div>
          ))}
        </div>
      );

    case "leaderboard":
      return (
        <div className="space-y-2">
          {(data?.items || [
            { id: 1, name: "John Smith", value: "$125,000", rank: 1 },
            { id: 2, name: "Jane Doe", value: "$98,000", rank: 2 },
            { id: 3, name: "Bob Johnson", value: "$87,000", rank: 3 },
          ]).slice(0, 5).map((item: any) => (
            <div key={item.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                item.rank === 1 ? "bg-yellow-500 text-yellow-950" :
                item.rank === 2 ? "bg-gray-300 text-gray-700" :
                item.rank === 3 ? "bg-orange-400 text-orange-950" : "bg-muted"
              )}>
                {item.rank}
              </div>
              <span className="text-sm flex-1 truncate">{item.name}</span>
              <span className="text-sm font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      );

    default:
      return (
        <div className="text-center text-muted-foreground p-4">
          <p className="text-sm">Widget type not supported</p>
        </div>
      );
  }
}

export default function CustomDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [layout, setLayout] = useState<DashboardLayout>({
    name: "My Dashboard",
    widgets: [],
    isDefault: true,
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch saved layout
  const { data: savedLayout, isLoading: isLoadingLayout } = useQuery({
    queryKey: ["/api/dashboard/layouts", user?.id],
    queryFn: async () => {
      try {
        const response = await apiRequest("/api/dashboard/layouts/default", "GET");
        return response;
      } catch {
        return null;
      }
    },
    enabled: !!user?.id,
  });

  // Initialize layout from saved or default
  useEffect(() => {
    if (savedLayout?.widgets) {
      setLayout(savedLayout);
    } else {
      // Default layout with some widgets
      const defaultWidgets: WidgetInstance[] = [
        { id: "w1", definitionId: "total-revenue", size: "small", visible: true, order: 0 },
        { id: "w2", definitionId: "active-customers", size: "small", visible: true, order: 1 },
        { id: "w3", definitionId: "open-opportunities", size: "small", visible: true, order: 2 },
        { id: "w4", definitionId: "service-tickets", size: "small", visible: true, order: 3 },
        { id: "w5", definitionId: "sales-pipeline", size: "large", visible: true, order: 4 },
        { id: "w6", definitionId: "recent-activity", size: "medium", visible: true, order: 5 },
      ];
      setLayout({
        name: "My Dashboard",
        widgets: defaultWidgets,
        isDefault: true,
      });
    }
  }, [savedLayout]);

  // Save layout mutation
  const saveLayoutMutation = useMutation({
    mutationFn: async (layoutData: DashboardLayout) => {
      return await apiRequest("/api/dashboard/layouts", "POST", layoutData);
    },
    onSuccess: () => {
      toast({
        title: "Dashboard saved",
        description: "Your dashboard layout has been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/layouts"] });
      setIsEditMode(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save",
        description: error.message || "Could not save dashboard layout.",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setLayout((prev) => {
        const oldIndex = prev.widgets.findIndex((w) => w.id === active.id);
        const newIndex = prev.widgets.findIndex((w) => w.id === over.id);
        const newWidgets = arrayMove(prev.widgets, oldIndex, newIndex).map(
          (w, i) => ({ ...w, order: i })
        );
        return { ...prev, widgets: newWidgets };
      });
    }
  };

  const handleToggleVisibility = (widgetId: string) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId ? { ...w, visible: !w.visible } : w
      ),
    }));
  };

  const handleResize = (widgetId: string, size: WidgetInstance["size"]) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId ? { ...w, size } : w
      ),
    }));
  };

  const handleRemove = (widgetId: string) => {
    setLayout((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((w) => w.id !== widgetId),
    }));
  };

  const handleAddWidget = (definitionId: string) => {
    const definition = WIDGET_DEFINITIONS.find((d) => d.id === definitionId);
    if (!definition) return;

    const newWidget: WidgetInstance = {
      id: `w${Date.now()}`,
      definitionId,
      size: definition.defaultSize,
      visible: true,
      order: layout.widgets.length,
    };

    setLayout((prev) => ({
      ...prev,
      widgets: [...prev.widgets, newWidget],
    }));
    setIsAddWidgetOpen(false);
  };

  const handleSave = () => {
    saveLayoutMutation.mutate(layout);
  };

  const handleReset = () => {
    const defaultWidgets: WidgetInstance[] = [
      { id: "w1", definitionId: "total-revenue", size: "small", visible: true, order: 0 },
      { id: "w2", definitionId: "active-customers", size: "small", visible: true, order: 1 },
      { id: "w3", definitionId: "open-opportunities", size: "small", visible: true, order: 2 },
      { id: "w4", definitionId: "service-tickets", size: "small", visible: true, order: 3 },
      { id: "w5", definitionId: "sales-pipeline", size: "large", visible: true, order: 4 },
      { id: "w6", definitionId: "recent-activity", size: "medium", visible: true, order: 5 },
    ];
    setLayout({
      name: "My Dashboard",
      widgets: defaultWidgets,
      isDefault: true,
    });
    toast({
      title: "Dashboard reset",
      description: "Your dashboard has been reset to the default layout.",
    });
  };

  // Get sorted visible widgets
  const sortedWidgets = useMemo(() => {
    return [...layout.widgets]
      .filter((w) => w.visible || isEditMode)
      .sort((a, b) => a.order - b.order);
  }, [layout.widgets, isEditMode]);

  // Get hidden widgets count
  const hiddenCount = layout.widgets.filter((w) => !w.visible).length;

  // Filter widget definitions by category
  const filteredDefinitions = useMemo(() => {
    if (selectedCategory === "all") return WIDGET_DEFINITIONS;
    return WIDGET_DEFINITIONS.filter((d) => d.category === selectedCategory);
  }, [selectedCategory]);

  // Get widgets not yet added
  const availableDefinitions = useMemo(() => {
    const addedIds = new Set(layout.widgets.map((w) => w.definitionId));
    return filteredDefinitions.filter((d) => !addedIds.has(d.id));
  }, [filteredDefinitions, layout.widgets]);

  if (isLoadingLayout) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          {isEditMode && (
            <Badge variant="secondary" className="animate-pulse">
              Edit Mode
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Hidden widgets dropdown */}
          {hiddenCount > 0 && !isEditMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Show Hidden ({hiddenCount})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Hidden Widgets</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {layout.widgets
                  .filter((w) => !w.visible)
                  .map((widget) => {
                    const def = WIDGET_DEFINITIONS.find((d) => d.id === widget.definitionId);
                    return (
                      <DropdownMenuCheckboxItem
                        key={widget.id}
                        checked={false}
                        onCheckedChange={() => handleToggleVisibility(widget.id)}
                      >
                        {def?.title || widget.definitionId}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Edit mode controls */}
          {isEditMode ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsAddWidgetOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Widget
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditMode(false)}>
                Cancel
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saveLayoutMutation.isPending}
              >
                {saveLayoutMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Layout
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Customize
            </Button>
          )}
        </div>
      </div>

      {/* Dashboard Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedWidgets.map((w) => w.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {sortedWidgets.map((widget) => {
              const definition = WIDGET_DEFINITIONS.find(
                (d) => d.id === widget.definitionId
              );
              if (!definition) return null;

              return (
                <SortableWidget
                  key={widget.id}
                  widget={widget}
                  definition={definition}
                  isEditMode={isEditMode}
                  onToggleVisibility={() => handleToggleVisibility(widget.id)}
                  onResize={(size) => handleResize(widget.id, size)}
                  onRemove={() => handleRemove(widget.id)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Empty state */}
      {sortedWidgets.length === 0 && (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground space-y-2">
            <LayoutGrid className="h-12 w-12 mx-auto opacity-20" />
            <p className="text-lg font-medium">No widgets visible</p>
            <p className="text-sm">
              {isEditMode
                ? "Click 'Add Widget' to add widgets to your dashboard"
                : "Click 'Customize' to configure your dashboard"}
            </p>
            {!isEditMode && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsEditMode(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Customize Dashboard
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Add Widget Dialog */}
      <Dialog open={isAddWidgetOpen} onOpenChange={setIsAddWidgetOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add Widget</DialogTitle>
            <DialogDescription>
              Choose a widget to add to your dashboard
            </DialogDescription>
          </DialogHeader>

          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid grid-cols-7 w-full">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="charts">Charts</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px] mt-4">
              {availableDefinitions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>All widgets in this category have been added</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-1">
                  {availableDefinitions.map((def) => {
                    const Icon = def.icon;
                    return (
                      <Card
                        key={def.id}
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => handleAddWidget(def.id)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-sm">{def.title}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-3">
                          <p className="text-xs text-muted-foreground">
                            {def.description}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {def.category}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {def.defaultSize}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
