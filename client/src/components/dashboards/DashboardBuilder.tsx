/**
 * DashboardBuilder - Drag-and-Drop Dashboard Layout System
 *
 * Allows users to:
 * - Reorder widgets via drag-and-drop
 * - Add/remove widgets from a catalog
 * - Resize widgets (small/medium/large/full)
 * - Toggle widget visibility
 * - Save layouts to the backend (persisted per user)
 * - Reset to role-based defaults
 */

import { useState, useCallback } from 'react';
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
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Settings,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  Plus,
  X,
  Maximize2,
  Minimize2,
  ChevronDown,
  LayoutGrid,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { WidgetRenderer } from './widget-components';
import {
  WIDGET_DEFINITIONS,
  getDefaultLayout,
  getAvailableWidgets,
  getWidgetDefinition,
  getRoleLabel,
  type LayoutWidgetConfig,
  type WidgetDefinition,
  type WidgetCategory,
} from '@/lib/dashboard-widget-registry';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardBuilderProps {
  roleCode: string;
  level: number;
  permissions: Set<string>;
  isPlatformUser: boolean;
  initialLayout: LayoutWidgetConfig[];
  onSaveLayout: (layout: LayoutWidgetConfig[]) => Promise<void>;
}

// Size presets for the resize dropdown
const SIZE_PRESETS = [
  { label: 'Small', w: 3, icon: Minimize2 },
  { label: 'Medium', w: 4, icon: LayoutGrid },
  { label: 'Large', w: 6, icon: Maximize2 },
  { label: 'Full Width', w: 12, icon: Maximize2 },
];

// Category labels and colors
const CATEGORY_CONFIG: Record<WidgetCategory, { label: string; color: string }> = {
  sales: { label: 'Sales', color: 'bg-green-100 text-green-700' },
  service: { label: 'Service', color: 'bg-orange-100 text-orange-700' },
  finance: { label: 'Finance', color: 'bg-blue-100 text-blue-700' },
  operations: { label: 'Operations', color: 'bg-purple-100 text-purple-700' },
  team: { label: 'Team', color: 'bg-indigo-100 text-indigo-700' },
  tasks: { label: 'Tasks', color: 'bg-yellow-100 text-yellow-700' },
  analytics: { label: 'Analytics', color: 'bg-pink-100 text-pink-700' },
};

// ============================================================================
// SORTABLE WIDGET WRAPPER
// ============================================================================

function SortableWidget({
  config,
  definition,
  isEditMode,
  roleCode,
  onToggleVisibility,
  onRemove,
  onResize,
}: {
  config: LayoutWidgetConfig;
  definition: WidgetDefinition;
  isEditMode: boolean;
  roleCode: string;
  onToggleVisibility: (key: string) => void;
  onRemove: (key: string) => void;
  onResize: (key: string, w: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: config.key,
    disabled: !isEditMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Map grid width to CSS class
  const getColSpan = () => {
    if (config.w >= 12) return 'col-span-12';
    if (config.w >= 8) return 'col-span-12 lg:col-span-8';
    if (config.w >= 6) return 'col-span-12 md:col-span-6';
    if (config.w >= 4) return 'col-span-12 sm:col-span-6 lg:col-span-4';
    return 'col-span-12 sm:col-span-6 lg:col-span-3';
  };

  const getRowSpan = () => {
    if (config.h >= 2) return 'row-span-2';
    return 'row-span-1';
  };

  if (!config.visible && !isEditMode) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        getColSpan(),
        getRowSpan(),
        'relative group',
        isEditMode && 'ring-2 ring-primary/30 ring-offset-1 rounded-lg',
        !config.visible && isEditMode && 'opacity-40',
      )}
    >
      {/* Edit Mode Controls */}
      {isEditMode && (
        <div className="absolute -top-2 left-0 right-0 z-20 flex items-center justify-between px-1">
          <div
            {...attributes}
            {...listeners}
            className="flex items-center gap-1 bg-background border rounded-md px-2 py-0.5 cursor-grab active:cursor-grabbing shadow-sm"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[100px]">
              {definition.name}
            </span>
          </div>
          <div className="flex items-center gap-0.5 bg-background border rounded-md shadow-sm">
            {/* Resize */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-accent rounded transition-colors" title="Resize">
                  <Maximize2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {SIZE_PRESETS.map((preset) => (
                  <DropdownMenuItem
                    key={preset.label}
                    onClick={() => onResize(config.key, preset.w)}
                    className={cn(config.w === preset.w && 'bg-accent')}
                  >
                    <preset.icon className="h-3 w-3 mr-2" />
                    {preset.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Toggle Visibility */}
            <button
              className="p-1 hover:bg-accent rounded transition-colors"
              onClick={() => onToggleVisibility(config.key)}
              title={config.visible ? 'Hide' : 'Show'}
            >
              {config.visible ? (
                <Eye className="h-3 w-3 text-muted-foreground" />
              ) : (
                <EyeOff className="h-3 w-3 text-muted-foreground" />
              )}
            </button>

            {/* Remove */}
            <button
              className="p-1 hover:bg-destructive/10 rounded transition-colors"
              onClick={() => onRemove(config.key)}
              title="Remove"
            >
              <X className="h-3 w-3 text-destructive" />
            </button>
          </div>
        </div>
      )}

      {/* Widget Content */}
      <div className={cn(isEditMode && 'mt-4 pointer-events-none')}>
        <WidgetRenderer definition={definition} roleCode={roleCode} />
      </div>
    </div>
  );
}

// ============================================================================
// WIDGET CATALOG (Add Widget Sheet)
// ============================================================================

function WidgetCatalog({
  availableWidgets,
  currentWidgetKeys,
  onAddWidget,
}: {
  availableWidgets: WidgetDefinition[];
  currentWidgetKeys: Set<string>;
  onAddWidget: (key: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<WidgetCategory | 'all'>('all');

  const filtered = availableWidgets.filter((w) => {
    if (currentWidgetKeys.has(w.key)) return false;
    if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== 'all' && w.category !== categoryFilter) return false;
    return true;
  });

  const categories = [...new Set(availableWidgets.map((w) => w.category))];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search widgets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <Badge
            variant={categoryFilter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setCategoryFilter('all')}
          >
            All
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={categoryFilter === cat ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer text-xs',
                categoryFilter !== cat && CATEGORY_CONFIG[cat]?.color,
              )}
              onClick={() => setCategoryFilter(cat)}
            >
              {CATEGORY_CONFIG[cat]?.label || cat}
            </Badge>
          ))}
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-260px)]">
        <div className="space-y-2 pr-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {currentWidgetKeys.size === availableWidgets.length
                ? 'All available widgets are already on your dashboard'
                : 'No matching widgets found'}
            </div>
          ) : (
            filtered.map((widget) => (
              <Card
                key={widget.key}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => onAddWidget(widget.key)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{widget.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {widget.description}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] mt-1.5',
                          CATEGORY_CONFIG[widget.category]?.color,
                        )}
                      >
                        {CATEGORY_CONFIG[widget.category]?.label || widget.category}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD BUILDER
// ============================================================================

export function DashboardBuilder({
  roleCode,
  level,
  permissions,
  isPlatformUser,
  initialLayout,
  onSaveLayout,
}: DashboardBuilderProps) {
  const [layout, setLayout] = useState<LayoutWidgetConfig[]>(initialLayout);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const availableWidgets = getAvailableWidgets(level, roleCode, permissions, isPlatformUser);
  const currentWidgetKeys = new Set(layout.map((w) => w.key));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Handlers ──────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLayout((items) => {
        const oldIndex = items.findIndex((item) => item.key === active.id);
        const newIndex = items.findIndex((item) => item.key === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const handleToggleVisibility = useCallback((key: string) => {
    setLayout((items) =>
      items.map((item) => (item.key === key ? { ...item, visible: !item.visible } : item)),
    );
  }, []);

  const handleRemove = useCallback((key: string) => {
    setLayout((items) => items.filter((item) => item.key !== key));
  }, []);

  const handleResize = useCallback((key: string, w: number) => {
    setLayout((items) => items.map((item) => (item.key === key ? { ...item, w } : item)));
  }, []);

  const handleAddWidget = useCallback((key: string) => {
    const def = getWidgetDefinition(key);
    if (!def) return;

    const newWidget: LayoutWidgetConfig = {
      key,
      x: 0,
      y: 999, // Push to end
      w: def.defaultSize.w,
      h: def.defaultSize.h,
      visible: true,
    };

    setLayout((items) => [...items, newWidget]);

    toast({
      title: 'Widget added',
      description: `${def.name} has been added to your dashboard.`,
    });
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSaveLayout(layout);
      setIsEditMode(false);
      toast({
        title: 'Dashboard saved',
        description: 'Your dashboard layout has been saved.',
      });
    } catch {
      toast({
        title: 'Failed to save',
        description: 'Could not save dashboard layout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [layout, onSaveLayout]);

  const handleReset = useCallback(() => {
    const defaultLayout = getDefaultLayout(roleCode);
    setLayout(defaultLayout);
    toast({
      title: 'Dashboard reset',
      description: 'Layout has been reset to the default for your role.',
    });
  }, [roleCode]);

  const handleCancelEdit = useCallback(() => {
    setLayout(initialLayout);
    setIsEditMode(false);
  }, [initialLayout]);

  // ── Render ────────────────────────────────────────────────────────

  const visibleWidgets = isEditMode ? layout : layout.filter((w) => w.visible);
  const hiddenCount = layout.filter((w) => !w.visible).length;

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">{getRoleLabel(roleCode)} View</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isEditMode ? (
            <>
              {/* Add Widget */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Widget
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[340px] sm:w-[380px]">
                  <SheetHeader>
                    <SheetTitle>Widget Catalog</SheetTitle>
                    <SheetDescription>Browse and add widgets to your dashboard</SheetDescription>
                  </SheetHeader>
                  <div className="mt-4">
                    <WidgetCatalog
                      availableWidgets={availableWidgets}
                      currentWidgetKeys={currentWidgetKeys}
                      onAddWidget={handleAddWidget}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>

              <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                Cancel
              </Button>

              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>

              <Badge variant="secondary" className="animate-pulse text-xs">
                Edit Mode
              </Badge>
            </>
          ) : (
            <>
              {hiddenCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  {hiddenCount} hidden
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                <Settings className="h-4 w-4 mr-1" />
                Customize
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Widget Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleWidgets.map((w) => w.key)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-12 gap-4 auto-rows-[minmax(140px,auto)]">
            {visibleWidgets.map((config) => {
              const def = getWidgetDefinition(config.key);
              if (!def) return null;
              return (
                <SortableWidget
                  key={config.key}
                  config={config}
                  definition={def}
                  isEditMode={isEditMode}
                  roleCode={roleCode}
                  onToggleVisibility={handleToggleVisibility}
                  onRemove={handleRemove}
                  onResize={handleResize}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Empty State */}
      {visibleWidgets.length === 0 && (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground space-y-2">
            <LayoutGrid className="h-12 w-12 mx-auto opacity-20" />
            <p className="text-lg font-medium">No widgets on your dashboard</p>
            <p className="text-sm">
              Click "Customize" and add widgets to build your personalized dashboard.
            </p>
            {!isEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditMode(true)}
                className="mt-4"
              >
                <Settings className="h-4 w-4 mr-1" />
                Customize Dashboard
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
