import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Settings, GripVertical, Eye, EyeOff, RotateCcw, Save, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Widget configuration type
export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  component: React.ComponentType<any>;
  defaultProps?: any;
  size?: 'small' | 'medium' | 'large' | 'full';
  visible?: boolean;
  category?: 'metrics' | 'activity' | 'tasks' | 'team' | 'analytics';
}

interface CustomizableDashboardProps {
  userId: string;
  defaultWidgets: DashboardWidget[];
  availableWidgets?: DashboardWidget[];
}

// Sortable Widget Wrapper
function SortableWidget({
  widget,
  isEditMode,
  onToggleVisibility,
}: {
  widget: DashboardWidget;
  isEditMode: boolean;
  onToggleVisibility: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Component = widget.component;

  // Map size to grid columns
  const sizeClasses = {
    small: 'col-span-1',
    medium: 'col-span-1 md:col-span-2',
    large: 'col-span-1 md:col-span-3',
    full: 'col-span-1 md:col-span-4',
  };

  if (!widget.visible) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        sizeClasses[widget.size || 'medium'],
        isEditMode && 'ring-2 ring-blue-500 ring-offset-2 rounded-lg',
      )}
    >
      {/* Edit Mode Overlay */}
      {isEditMode && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent rounded-t-lg p-2 flex items-center justify-between">
          <div
            {...attributes}
            {...listeners}
            className="flex items-center gap-2 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 text-white" />
            <span className="text-xs text-white font-medium">{widget.title}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white hover:bg-white/20"
            onClick={() => onToggleVisibility(widget.id)}
          >
            <EyeOff className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Widget Content */}
      <Component {...(widget.defaultProps || {})} />
    </div>
  );
}

export function CustomizableDashboard({
  userId,
  defaultWidgets,
  availableWidgets = [],
}: CustomizableDashboardProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(defaultWidgets);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load saved layout from localStorage
  useEffect(() => {
    const savedLayout = localStorage.getItem(`dashboard_layout_${userId}`);
    if (savedLayout) {
      try {
        const layout = JSON.parse(savedLayout);
        // Merge saved layout with default widgets (in case new widgets were added)
        const mergedWidgets = defaultWidgets.map((widget) => {
          const saved = layout.find((w: DashboardWidget) => w.id === widget.id);
          return saved ? { ...widget, ...saved } : widget;
        });
        setWidgets(mergedWidgets);
      } catch (err) {
        console.error('Failed to load dashboard layout:', err);
      }
    }
  }, [userId, defaultWidgets]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleToggleVisibility = (id: string) => {
    setWidgets((items) =>
      items.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item)),
    );
  };

  const handleSaveLayout = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage (in production, save to backend)
      const layout = widgets.map((w) => ({
        id: w.id,
        visible: w.visible,
        size: w.size,
      }));
      localStorage.setItem(`dashboard_layout_${userId}`, JSON.stringify(layout));

      // Optional: Save to backend
      // await apiRequest(`/api/users/${userId}/dashboard-layout`, "PUT", { layout });

      toast({
        title: 'Dashboard saved',
        description: 'Your dashboard layout has been saved.',
      });
    } catch (err) {
      toast({
        title: 'Failed to save',
        description: 'Could not save dashboard layout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setIsEditMode(false);
    }
  };

  const handleResetLayout = () => {
    setWidgets(defaultWidgets);
    localStorage.removeItem(`dashboard_layout_${userId}`);
    toast({
      title: 'Dashboard reset',
      description: 'Your dashboard has been reset to default.',
    });
  };

  const handleAddWidget = (widget: DashboardWidget) => {
    setWidgets((items) => [...items, { ...widget, visible: true }]);
  };

  const visibleWidgets = widgets.filter((w) => w.visible || isEditMode);
  const hiddenWidgets = widgets.filter((w) => !w.visible);

  return (
    <div className="space-y-4">
      {/* Dashboard Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Dashboard</h2>
          {isEditMode && (
            <Badge variant="secondary" className="animate-pulse">
              Edit Mode
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Widget Visibility Dropdown */}
          {hiddenWidgets.length > 0 && !isEditMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Show Widgets ({hiddenWidgets.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {hiddenWidgets.map((widget) => (
                  <DropdownMenuCheckboxItem
                    key={widget.id}
                    checked={false}
                    onCheckedChange={() => handleToggleVisibility(widget.id)}
                  >
                    {widget.title}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Add Widget Dialog */}
          {availableWidgets.length > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Widget
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Widget</DialogTitle>
                  <DialogDescription>Choose a widget to add to your dashboard</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  {availableWidgets
                    .filter((w) => !widgets.find((existing) => existing.id === w.id))
                    .map((widget) => (
                      <Card
                        key={widget.id}
                        className="cursor-pointer hover:border-blue-500 transition-colors"
                        onClick={() => handleAddWidget(widget)}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">{widget.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-3">
                          <Badge variant="secondary" className="text-xs">
                            {widget.category}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Edit/Save Controls */}
          {isEditMode ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditMode(false)}>
                Cancel
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetLayout}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button size="sm" onClick={handleSaveLayout} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Layout'}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Customize
            </Button>
          )}
        </div>
      </div>

      {/* Dashboard Grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleWidgets.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {visibleWidgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                isEditMode={isEditMode}
                onToggleVisibility={handleToggleVisibility}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Empty State */}
      {visibleWidgets.length === 0 && (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground space-y-2">
            <Settings className="h-12 w-12 mx-auto opacity-20" />
            <p className="text-lg font-medium">No widgets visible</p>
            <p className="text-sm">
              Click "Show Widgets" or "Add Widget" to customize your dashboard
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

// Hook for dashboard customization
export function useDashboardCustomization(userId: string) {
  const [layout, setLayout] = useState<any>(null);

  useEffect(() => {
    const savedLayout = localStorage.getItem(`dashboard_layout_${userId}`);
    if (savedLayout) {
      try {
        setLayout(JSON.parse(savedLayout));
      } catch (err) {
        console.error('Failed to load dashboard layout:', err);
      }
    }
  }, [userId]);

  const saveLayout = (newLayout: any) => {
    localStorage.setItem(`dashboard_layout_${userId}`, JSON.stringify(newLayout));
    setLayout(newLayout);
  };

  const resetLayout = () => {
    localStorage.removeItem(`dashboard_layout_${userId}`);
    setLayout(null);
  };

  return {
    layout,
    saveLayout,
    resetLayout,
  };
}
