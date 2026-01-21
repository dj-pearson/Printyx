import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  GripVertical,
  Plus,
  Settings,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  Save,
  RotateCcw,
} from 'lucide-react';

interface Widget {
  id: string;
  key: string;
  name: string;
  icon?: string;
  type: string;
}

interface LayoutWidget {
  id: string;
  widgetId: string;
  position: number;
  size: { width: number; height: number };
  visible: boolean;
  config?: Record<string, any>;
}

interface Layout {
  id: string;
  name: string;
  widgets: LayoutWidget[];
  columns: number;
}

export function DashboardCustomizer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingWidget, setIsAddingWidget] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWidgets, setSelectedWidgets] = useState<LayoutWidget[]>([]);
  const [layoutName, setLayoutName] = useState('');

  // Fetch available widgets
  const { data: widgetsData } = useQuery({
    queryKey: ['/api/dashboard/widgets'],
  });

  // Fetch current layout
  const { data: layoutData } = useQuery({
    queryKey: ['/api/dashboard/layout'],
  });

  // Save layout mutation
  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/dashboard/layout', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/layout'] });
      setIsOpen(false);
    },
  });

  const widgets = (widgetsData?.data || []) as Widget[];
  const layout = layoutData?.data as Layout | undefined;

  const filteredWidgets = widgets.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleAddWidget = (widget: Widget) => {
    const newWidget: LayoutWidget = {
      id: `widget-${Date.now()}`,
      widgetId: widget.id,
      position: selectedWidgets.length,
      size: { width: 1, height: 300 },
      visible: true,
    };
    setSelectedWidgets([...selectedWidgets, newWidget]);
  };

  const handleRemoveWidget = (widgetId: string) => {
    setSelectedWidgets(selectedWidgets.filter((w) => w.id !== widgetId));
  };

  const handleToggleWidget = (widgetId: string) => {
    setSelectedWidgets(
      selectedWidgets.map((w) => (w.id === widgetId ? { ...w, visible: !w.visible } : w)),
    );
  };

  const handleSaveLayout = () => {
    saveMutation.mutate({
      name: layoutName || 'My Dashboard',
      widgets: selectedWidgets,
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = selectedWidgets.findIndex((w) => w.id === active.id);
      const newIndex = selectedWidgets.findIndex((w) => w.id === over.id);
      setSelectedWidgets(arrayMove(selectedWidgets, oldIndex, newIndex));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize Your Dashboard</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 flex-1 overflow-hidden">
          {/* Available Widgets */}
          <div className="w-1/3 border-r pr-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Available Widgets</h3>
                <Input
                  placeholder="Search widgets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-3"
                />
              </div>

              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredWidgets.map((widget) => (
                    <div
                      key={widget.id}
                      className="flex items-center justify-between p-2 border rounded hover:bg-accent cursor-pointer"
                      onClick={() => handleAddWidget(widget)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{widget.name}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {widget.type}
                        </Badge>
                      </div>
                      <Plus className="w-4 h-4 ml-2 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Layout Configuration */}
          <div className="w-2/3 pl-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Layout Name</label>
                <Input
                  value={layoutName}
                  onChange={(e) => setLayoutName(e.target.value)}
                  placeholder="e.g., Sales Focus, Service Manager"
                  className="mt-1"
                />
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <GripVertical className="w-4 h-4" />
                  Selected Widgets
                </h3>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={selectedWidgets.map((w) => w.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2 pr-4">
                        {selectedWidgets.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <p>Add widgets from the left to customize</p>
                          </div>
                        ) : (
                          selectedWidgets.map((widget) => {
                            const widgetDef = widgets.find((w) => w.id === widget.widgetId);
                            return (
                              <SortableWidgetItem
                                key={widget.id}
                                id={widget.id}
                                widget={widget}
                                widgetDef={widgetDef}
                                onToggle={() => handleToggleWidget(widget.id)}
                                onRemove={() => handleRemoveWidget(widget.id)}
                              />
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t pt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveLayout} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            Save Layout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SortableWidgetItem({
  id,
  widget,
  widgetDef,
  onToggle,
  onRemove,
}: {
  id: string;
  widget: any;
  widgetDef?: any;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 border rounded bg-card hover:bg-accent transition-colors"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{widgetDef?.name}</p>
      </div>

      <button
        onClick={onToggle}
        className="p-1 hover:bg-gray-200 rounded transition-colors"
        title={widget.visible ? 'Hide widget' : 'Show widget'}
      >
        {widget.visible ? (
          <Eye className="w-4 h-4" />
        ) : (
          <EyeOff className="w-4 h-4 text-gray-400" />
        )}
      </button>

      <button
        onClick={onRemove}
        className="p-1 hover:bg-red-100 rounded transition-colors"
        title="Remove widget"
      >
        <Trash2 className="w-4 h-4 text-red-500" />
      </button>
    </div>
  );
}
