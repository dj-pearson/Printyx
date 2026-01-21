/**
 * Custom Report Builder
 *
 * A visual drag-and-drop report builder that allows users to create
 * custom reports with:
 * - Data source selection
 * - Column selection and ordering
 * - Filters and conditions
 * - Grouping and aggregation
 * - Chart visualization options
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  GripVertical,
  X,
  Play,
  Save,
  ArrowLeft,
  Settings,
  Filter,
  Table,
  BarChart3,
  LineChart,
  PieChart,
  FileText,
  Database,
  Eye,
  Download,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table as DataTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

// Available data sources for reporting
const DATA_SOURCES = [
  {
    id: 'business_records',
    name: 'Customers & Leads',
    icon: Database,
    description: 'Customer and lead records',
  },
  {
    id: 'opportunities',
    name: 'Opportunities',
    icon: BarChart3,
    description: 'Sales opportunities and deals',
  },
  {
    id: 'service_tickets',
    name: 'Service Tickets',
    icon: FileText,
    description: 'Service requests and tickets',
  },
  { id: 'equipment', name: 'Equipment', icon: Settings, description: 'Equipment and assets' },
  { id: 'invoices', name: 'Invoices', icon: FileText, description: 'Invoice records' },
  { id: 'inventory', name: 'Inventory', icon: LayoutGrid, description: 'Inventory items' },
  { id: 'products', name: 'Products', icon: LayoutGrid, description: 'Product catalog' },
  { id: 'contacts', name: 'Contacts', icon: Table, description: 'Contact records' },
];

// Available columns per data source
const SOURCE_COLUMNS: Record<
  string,
  Array<{ id: string; name: string; type: string; aggregatable: boolean }>
> = {
  business_records: [
    { id: 'companyName', name: 'Company Name', type: 'string', aggregatable: false },
    { id: 'recordType', name: 'Record Type', type: 'string', aggregatable: false },
    { id: 'status', name: 'Status', type: 'string', aggregatable: false },
    { id: 'industry', name: 'Industry', type: 'string', aggregatable: false },
    { id: 'city', name: 'City', type: 'string', aggregatable: false },
    { id: 'state', name: 'State', type: 'string', aggregatable: false },
    { id: 'leadSource', name: 'Lead Source', type: 'string', aggregatable: false },
    { id: 'annualRevenue', name: 'Annual Revenue', type: 'currency', aggregatable: true },
    { id: 'employeeCount', name: 'Employee Count', type: 'number', aggregatable: true },
    { id: 'createdAt', name: 'Created Date', type: 'date', aggregatable: false },
    { id: 'updatedAt', name: 'Updated Date', type: 'date', aggregatable: false },
  ],
  opportunities: [
    { id: 'name', name: 'Opportunity Name', type: 'string', aggregatable: false },
    { id: 'stage', name: 'Stage', type: 'string', aggregatable: false },
    { id: 'amount', name: 'Amount', type: 'currency', aggregatable: true },
    { id: 'probability', name: 'Probability', type: 'number', aggregatable: true },
    { id: 'expectedCloseDate', name: 'Expected Close Date', type: 'date', aggregatable: false },
    { id: 'createdAt', name: 'Created Date', type: 'date', aggregatable: false },
    { id: 'closedAt', name: 'Closed Date', type: 'date', aggregatable: false },
    { id: 'assignedTo', name: 'Assigned To', type: 'string', aggregatable: false },
    { id: 'product', name: 'Product', type: 'string', aggregatable: false },
    { id: 'quantity', name: 'Quantity', type: 'number', aggregatable: true },
  ],
  service_tickets: [
    { id: 'ticketNumber', name: 'Ticket Number', type: 'string', aggregatable: false },
    { id: 'subject', name: 'Subject', type: 'string', aggregatable: false },
    { id: 'status', name: 'Status', type: 'string', aggregatable: false },
    { id: 'priority', name: 'Priority', type: 'string', aggregatable: false },
    { id: 'category', name: 'Category', type: 'string', aggregatable: false },
    { id: 'assignedTo', name: 'Assigned To', type: 'string', aggregatable: false },
    { id: 'createdAt', name: 'Created Date', type: 'date', aggregatable: false },
    { id: 'resolvedAt', name: 'Resolved Date', type: 'date', aggregatable: false },
    { id: 'responseTime', name: 'Response Time (hrs)', type: 'number', aggregatable: true },
    { id: 'resolutionTime', name: 'Resolution Time (hrs)', type: 'number', aggregatable: true },
  ],
  equipment: [
    { id: 'serialNumber', name: 'Serial Number', type: 'string', aggregatable: false },
    { id: 'model', name: 'Model', type: 'string', aggregatable: false },
    { id: 'manufacturer', name: 'Manufacturer', type: 'string', aggregatable: false },
    { id: 'status', name: 'Status', type: 'string', aggregatable: false },
    { id: 'location', name: 'Location', type: 'string', aggregatable: false },
    { id: 'installDate', name: 'Install Date', type: 'date', aggregatable: false },
    { id: 'lastServiceDate', name: 'Last Service Date', type: 'date', aggregatable: false },
    { id: 'meterReading', name: 'Meter Reading', type: 'number', aggregatable: true },
    { id: 'contractEndDate', name: 'Contract End Date', type: 'date', aggregatable: false },
  ],
  invoices: [
    { id: 'invoiceNumber', name: 'Invoice Number', type: 'string', aggregatable: false },
    { id: 'status', name: 'Status', type: 'string', aggregatable: false },
    { id: 'amount', name: 'Amount', type: 'currency', aggregatable: true },
    { id: 'balance', name: 'Balance Due', type: 'currency', aggregatable: true },
    { id: 'invoiceDate', name: 'Invoice Date', type: 'date', aggregatable: false },
    { id: 'dueDate', name: 'Due Date', type: 'date', aggregatable: false },
    { id: 'paidDate', name: 'Paid Date', type: 'date', aggregatable: false },
    { id: 'daysOverdue', name: 'Days Overdue', type: 'number', aggregatable: true },
  ],
  inventory: [
    { id: 'partNumber', name: 'Part Number', type: 'string', aggregatable: false },
    { id: 'name', name: 'Item Name', type: 'string', aggregatable: false },
    { id: 'category', name: 'Category', type: 'string', aggregatable: false },
    { id: 'manufacturer', name: 'Manufacturer', type: 'string', aggregatable: false },
    { id: 'quantityOnHand', name: 'Quantity On Hand', type: 'number', aggregatable: true },
    { id: 'reorderPoint', name: 'Reorder Point', type: 'number', aggregatable: true },
    { id: 'unitCost', name: 'Unit Cost', type: 'currency', aggregatable: true },
    { id: 'unitPrice', name: 'Unit Price', type: 'currency', aggregatable: true },
    { id: 'location', name: 'Location', type: 'string', aggregatable: false },
  ],
  products: [
    { id: 'productName', name: 'Product Name', type: 'string', aggregatable: false },
    { id: 'sku', name: 'SKU', type: 'string', aggregatable: false },
    { id: 'category', name: 'Category', type: 'string', aggregatable: false },
    { id: 'manufacturer', name: 'Manufacturer', type: 'string', aggregatable: false },
    { id: 'listPrice', name: 'List Price', type: 'currency', aggregatable: true },
    { id: 'cost', name: 'Cost', type: 'currency', aggregatable: true },
    { id: 'isActive', name: 'Is Active', type: 'boolean', aggregatable: false },
  ],
  contacts: [
    { id: 'firstName', name: 'First Name', type: 'string', aggregatable: false },
    { id: 'lastName', name: 'Last Name', type: 'string', aggregatable: false },
    { id: 'email', name: 'Email', type: 'string', aggregatable: false },
    { id: 'phone', name: 'Phone', type: 'string', aggregatable: false },
    { id: 'title', name: 'Title', type: 'string', aggregatable: false },
    { id: 'department', name: 'Department', type: 'string', aggregatable: false },
    { id: 'isPrimary', name: 'Is Primary', type: 'boolean', aggregatable: false },
    { id: 'createdAt', name: 'Created Date', type: 'date', aggregatable: false },
  ],
};

// Filter operators by type
const FILTER_OPERATORS: Record<string, Array<{ id: string; name: string }>> = {
  string: [
    { id: 'equals', name: 'Equals' },
    { id: 'not_equals', name: 'Does not equal' },
    { id: 'contains', name: 'Contains' },
    { id: 'not_contains', name: 'Does not contain' },
    { id: 'starts_with', name: 'Starts with' },
    { id: 'ends_with', name: 'Ends with' },
    { id: 'is_empty', name: 'Is empty' },
    { id: 'is_not_empty', name: 'Is not empty' },
  ],
  number: [
    { id: 'equals', name: 'Equals' },
    { id: 'not_equals', name: 'Does not equal' },
    { id: 'greater_than', name: 'Greater than' },
    { id: 'less_than', name: 'Less than' },
    { id: 'greater_equal', name: 'Greater than or equal' },
    { id: 'less_equal', name: 'Less than or equal' },
    { id: 'between', name: 'Between' },
    { id: 'is_empty', name: 'Is empty' },
  ],
  currency: [
    { id: 'equals', name: 'Equals' },
    { id: 'greater_than', name: 'Greater than' },
    { id: 'less_than', name: 'Less than' },
    { id: 'between', name: 'Between' },
  ],
  date: [
    { id: 'equals', name: 'Equals' },
    { id: 'before', name: 'Before' },
    { id: 'after', name: 'After' },
    { id: 'between', name: 'Between' },
    { id: 'last_n_days', name: 'Last N days' },
    { id: 'this_week', name: 'This week' },
    { id: 'this_month', name: 'This month' },
    { id: 'this_quarter', name: 'This quarter' },
    { id: 'this_year', name: 'This year' },
  ],
  boolean: [
    { id: 'is_true', name: 'Is true' },
    { id: 'is_false', name: 'Is false' },
  ],
};

// Aggregation functions
const AGGREGATIONS = [
  { id: 'count', name: 'Count' },
  { id: 'sum', name: 'Sum' },
  { id: 'avg', name: 'Average' },
  { id: 'min', name: 'Minimum' },
  { id: 'max', name: 'Maximum' },
];

// Visualization types
const VISUALIZATIONS = [
  { id: 'table', name: 'Table', icon: Table },
  { id: 'bar_chart', name: 'Bar Chart', icon: BarChart3 },
  { id: 'line_chart', name: 'Line Chart', icon: LineChart },
  { id: 'pie_chart', name: 'Pie Chart', icon: PieChart },
];

// Report categories
const REPORT_CATEGORIES = [
  { id: 'sales', name: 'Sales' },
  { id: 'service', name: 'Service' },
  { id: 'finance', name: 'Finance' },
  { id: 'operations', name: 'Operations' },
  { id: 'executive', name: 'Executive' },
  { id: 'custom', name: 'Custom' },
];

interface ReportColumn {
  id: string;
  columnId: string;
  columnName: string;
  aggregation?: string;
  alias?: string;
  sortDirection?: 'asc' | 'desc';
  sortOrder?: number;
}

interface ReportFilter {
  id: string;
  columnId: string;
  columnName: string;
  operator: string;
  value: string;
  value2?: string; // For "between" operator
  conjunction: 'and' | 'or';
}

interface ReportGrouping {
  id: string;
  columnId: string;
  columnName: string;
}

interface ReportConfig {
  name: string;
  description: string;
  category: string;
  dataSource: string;
  columns: ReportColumn[];
  filters: ReportFilter[];
  groupings: ReportGrouping[];
  visualization: string;
  chartConfig: {
    xAxis?: string;
    yAxis?: string;
    colorField?: string;
  };
  isPublic: boolean;
  cacheDuration: number;
}

// Sortable column item
function SortableColumn({
  column,
  onRemove,
  onUpdate,
  availableColumns,
}: {
  column: ReportColumn;
  onRemove: () => void;
  onUpdate: (updates: Partial<ReportColumn>) => void;
  availableColumns: Array<{ id: string; name: string; type: string; aggregatable: boolean }>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const columnInfo = availableColumns.find((c) => c.id === column.columnId);
  const canAggregate = columnInfo?.aggregatable;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-3 bg-card border rounded-md',
        isDragging && 'opacity-50',
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 grid grid-cols-3 gap-2">
        <div className="text-sm font-medium">{column.columnName}</div>
        <Input
          placeholder="Alias (optional)"
          value={column.alias || ''}
          onChange={(e) => onUpdate({ alias: e.target.value })}
          className="h-8"
        />
        {canAggregate && (
          <Select
            value={column.aggregation || 'none'}
            onValueChange={(value) =>
              onUpdate({ aggregation: value === 'none' ? undefined : value })
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Aggregation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No aggregation</SelectItem>
              {AGGREGATIONS.map((agg) => (
                <SelectItem key={agg.id} value={agg.id}>
                  {agg.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove} className="h-8 w-8">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function CustomReportBuilder() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Report configuration state
  const [config, setConfig] = useState<ReportConfig>({
    name: '',
    description: '',
    category: 'custom',
    dataSource: '',
    columns: [],
    filters: [],
    groupings: [],
    visualization: 'table',
    chartConfig: {},
    isPublic: false,
    cacheDuration: 300,
  });

  // UI state
  const [activeTab, setActiveTab] = useState('source');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    columns: true,
    filters: true,
    groupings: true,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Get available columns for selected data source
  const availableColumns = config.dataSource ? SOURCE_COLUMNS[config.dataSource] || [] : [];

  // Handlers
  const handleDataSourceSelect = (sourceId: string) => {
    setConfig({
      ...config,
      dataSource: sourceId,
      columns: [],
      filters: [],
      groupings: [],
    });
    setActiveTab('columns');
  };

  const handleAddColumn = (columnId: string) => {
    const columnInfo = availableColumns.find((c) => c.id === columnId);
    if (!columnInfo) return;

    const newColumn: ReportColumn = {
      id: `col-${Date.now()}`,
      columnId,
      columnName: columnInfo.name,
    };

    setConfig({
      ...config,
      columns: [...config.columns, newColumn],
    });
  };

  const handleRemoveColumn = (id: string) => {
    setConfig({
      ...config,
      columns: config.columns.filter((c) => c.id !== id),
    });
  };

  const handleUpdateColumn = (id: string, updates: Partial<ReportColumn>) => {
    setConfig({
      ...config,
      columns: config.columns.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    });
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setConfig((prev) => {
        const oldIndex = prev.columns.findIndex((c) => c.id === active.id);
        const newIndex = prev.columns.findIndex((c) => c.id === over.id);
        return {
          ...prev,
          columns: arrayMove(prev.columns, oldIndex, newIndex),
        };
      });
    }
  };

  const handleAddFilter = () => {
    if (availableColumns.length === 0) return;

    const firstColumn = availableColumns[0];
    const columnType = firstColumn.type;
    const defaultOperator = FILTER_OPERATORS[columnType]?.[0]?.id || 'equals';

    const newFilter: ReportFilter = {
      id: `filter-${Date.now()}`,
      columnId: firstColumn.id,
      columnName: firstColumn.name,
      operator: defaultOperator,
      value: '',
      conjunction: 'and',
    };

    setConfig({
      ...config,
      filters: [...config.filters, newFilter],
    });
  };

  const handleRemoveFilter = (id: string) => {
    setConfig({
      ...config,
      filters: config.filters.filter((f) => f.id !== id),
    });
  };

  const handleUpdateFilter = (id: string, updates: Partial<ReportFilter>) => {
    setConfig({
      ...config,
      filters: config.filters.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    });
  };

  const handleAddGrouping = (columnId: string) => {
    const columnInfo = availableColumns.find((c) => c.id === columnId);
    if (!columnInfo) return;

    // Don't add if already grouped
    if (config.groupings.some((g) => g.columnId === columnId)) return;

    const newGrouping: ReportGrouping = {
      id: `group-${Date.now()}`,
      columnId,
      columnName: columnInfo.name,
    };

    setConfig({
      ...config,
      groupings: [...config.groupings, newGrouping],
    });
  };

  const handleRemoveGrouping = (id: string) => {
    setConfig({
      ...config,
      groupings: config.groupings.filter((g) => g.id !== id),
    });
  };

  // Preview report
  const handlePreview = async () => {
    if (!config.dataSource || config.columns.length === 0) {
      toast({
        title: 'Cannot preview',
        description: 'Please select a data source and at least one column',
        variant: 'destructive',
      });
      return;
    }

    setIsRunning(true);
    try {
      const response = await apiRequest('/api/reports/custom/preview', 'POST', {
        dataSource: config.dataSource,
        columns: config.columns,
        filters: config.filters,
        groupings: config.groupings,
        limit: 100,
      });
      setPreviewData(response.data || []);
      setIsPreviewOpen(true);
    } catch (error: any) {
      toast({
        title: 'Preview failed',
        description: error.message || 'Failed to generate preview',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Save report
  const saveReportMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/reports/custom', 'POST', config);
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Report saved',
        description: `"${config.name}" has been saved successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      navigate(`/reports/${data.code}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save',
        description: error.message || 'Could not save report',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (!config.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for the report',
        variant: 'destructive',
      });
      return;
    }
    saveReportMutation.mutate();
    setIsSaveDialogOpen(false);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Custom Report Builder</h1>
            <p className="text-sm text-muted-foreground">
              Create custom reports with visual configuration
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={!config.dataSource || config.columns.length === 0 || isRunning}
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Preview
          </Button>
          <Button
            onClick={() => setIsSaveDialogOpen(true)}
            disabled={!config.dataSource || config.columns.length === 0}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Report
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full">
          {/* Left Panel - Configuration */}
          <div className="w-1/3 border-r">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="w-full justify-start rounded-none border-b p-0 h-auto">
                <TabsTrigger
                  value="source"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Source
                </TabsTrigger>
                <TabsTrigger
                  value="columns"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  disabled={!config.dataSource}
                >
                  <Table className="h-4 w-4 mr-2" />
                  Columns
                </TabsTrigger>
                <TabsTrigger
                  value="filters"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  disabled={!config.dataSource}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </TabsTrigger>
                <TabsTrigger
                  value="visual"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  disabled={config.columns.length === 0}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Visual
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-auto p-4">
                {/* Source Tab */}
                <TabsContent value="source" className="mt-0 space-y-4">
                  <div>
                    <h3 className="font-medium mb-3">Select Data Source</h3>
                    <div className="grid gap-2">
                      {DATA_SOURCES.map((source) => {
                        const Icon = source.icon;
                        const isSelected = config.dataSource === source.id;
                        return (
                          <div
                            key={source.id}
                            onClick={() => handleDataSourceSelect(source.id)}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors',
                              isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent',
                            )}
                          >
                            <Icon className={cn('h-5 w-5', isSelected && 'text-primary')} />
                            <div className="flex-1">
                              <div className="font-medium">{source.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {source.description}
                              </div>
                            </div>
                            {isSelected && (
                              <Badge variant="secondary" className="text-xs">
                                Selected
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                {/* Columns Tab */}
                <TabsContent value="columns" className="mt-0 space-y-4">
                  {/* Available Columns */}
                  <div>
                    <h3 className="font-medium mb-3">Available Columns</h3>
                    <div className="flex flex-wrap gap-2">
                      {availableColumns
                        .filter((col) => !config.columns.some((c) => c.columnId === col.id))
                        .map((col) => (
                          <Badge
                            key={col.id}
                            variant="outline"
                            className="cursor-pointer hover:bg-accent"
                            onClick={() => handleAddColumn(col.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {col.name}
                          </Badge>
                        ))}
                    </div>
                  </div>

                  {/* Selected Columns */}
                  <div>
                    <div
                      className="flex items-center gap-2 cursor-pointer mb-3"
                      onClick={() => toggleSection('columns')}
                    >
                      {expandedSections.columns ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <h3 className="font-medium">Selected Columns ({config.columns.length})</h3>
                    </div>
                    {expandedSections.columns && (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleColumnDragEnd}
                      >
                        <SortableContext
                          items={config.columns.map((c) => c.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {config.columns.length === 0 ? (
                              <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-md">
                                Click columns above to add them
                              </div>
                            ) : (
                              config.columns.map((col) => (
                                <SortableColumn
                                  key={col.id}
                                  column={col}
                                  onRemove={() => handleRemoveColumn(col.id)}
                                  onUpdate={(updates) => handleUpdateColumn(col.id, updates)}
                                  availableColumns={availableColumns}
                                />
                              ))
                            )}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>

                  {/* Groupings */}
                  <div>
                    <div
                      className="flex items-center gap-2 cursor-pointer mb-3"
                      onClick={() => toggleSection('groupings')}
                    >
                      {expandedSections.groupings ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <h3 className="font-medium">Group By ({config.groupings.length})</h3>
                    </div>
                    {expandedSections.groupings && (
                      <div className="space-y-2">
                        <Select onValueChange={handleAddGrouping}>
                          <SelectTrigger>
                            <SelectValue placeholder="Add grouping..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableColumns
                              .filter((col) => !config.groupings.some((g) => g.columnId === col.id))
                              .filter((col) => col.type === 'string' || col.type === 'date')
                              .map((col) => (
                                <SelectItem key={col.id} value={col.id}>
                                  {col.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {config.groupings.map((group) => (
                          <div
                            key={group.id}
                            className="flex items-center gap-2 p-2 bg-muted rounded-md"
                          >
                            <span className="flex-1 text-sm">{group.columnName}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleRemoveGrouping(group.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Filters Tab */}
                <TabsContent value="filters" className="mt-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Filters</h3>
                    <Button variant="outline" size="sm" onClick={handleAddFilter}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Filter
                    </Button>
                  </div>

                  {config.filters.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-md">
                      No filters configured. Add filters to narrow down results.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {config.filters.map((filter, idx) => {
                        const columnInfo = availableColumns.find((c) => c.id === filter.columnId);
                        const columnType = columnInfo?.type || 'string';
                        const operators = FILTER_OPERATORS[columnType] || FILTER_OPERATORS.string;

                        return (
                          <Card key={filter.id}>
                            <CardContent className="p-3 space-y-2">
                              {idx > 0 && (
                                <Select
                                  value={filter.conjunction}
                                  onValueChange={(value: 'and' | 'or') =>
                                    handleUpdateFilter(filter.id, { conjunction: value })
                                  }
                                >
                                  <SelectTrigger className="w-20 h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="and">AND</SelectItem>
                                    <SelectItem value="or">OR</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                              <div className="flex items-center gap-2">
                                <Select
                                  value={filter.columnId}
                                  onValueChange={(value) => {
                                    const newCol = availableColumns.find((c) => c.id === value);
                                    if (newCol) {
                                      handleUpdateFilter(filter.id, {
                                        columnId: value,
                                        columnName: newCol.name,
                                        operator:
                                          FILTER_OPERATORS[newCol.type]?.[0]?.id || 'equals',
                                      });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select column" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableColumns.map((col) => (
                                      <SelectItem key={col.id} value={col.id}>
                                        {col.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleRemoveFilter(filter.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <Select
                                  value={filter.operator}
                                  onValueChange={(value) =>
                                    handleUpdateFilter(filter.id, { operator: value })
                                  }
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Operator" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {operators.map((op) => (
                                      <SelectItem key={op.id} value={op.id}>
                                        {op.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {![
                                  'is_empty',
                                  'is_not_empty',
                                  'is_true',
                                  'is_false',
                                  'this_week',
                                  'this_month',
                                  'this_quarter',
                                  'this_year',
                                ].includes(filter.operator) && (
                                  <Input
                                    placeholder="Value"
                                    value={filter.value}
                                    onChange={(e) =>
                                      handleUpdateFilter(filter.id, { value: e.target.value })
                                    }
                                    className="flex-1"
                                  />
                                )}
                                {filter.operator === 'between' && (
                                  <>
                                    <span className="text-sm text-muted-foreground">and</span>
                                    <Input
                                      placeholder="Value 2"
                                      value={filter.value2 || ''}
                                      onChange={(e) =>
                                        handleUpdateFilter(filter.id, { value2: e.target.value })
                                      }
                                      className="flex-1"
                                    />
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Visualization Tab */}
                <TabsContent value="visual" className="mt-0 space-y-4">
                  <div>
                    <h3 className="font-medium mb-3">Visualization Type</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {VISUALIZATIONS.map((vis) => {
                        const Icon = vis.icon;
                        const isSelected = config.visualization === vis.id;
                        return (
                          <div
                            key={vis.id}
                            onClick={() => setConfig({ ...config, visualization: vis.id })}
                            className={cn(
                              'flex flex-col items-center gap-2 p-4 rounded-md border cursor-pointer transition-colors',
                              isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent',
                            )}
                          >
                            <Icon className={cn('h-8 w-8', isSelected && 'text-primary')} />
                            <span className="text-sm font-medium">{vis.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chart Configuration */}
                  {config.visualization !== 'table' && (
                    <div className="space-y-3">
                      <h3 className="font-medium">Chart Configuration</h3>
                      {(config.visualization === 'bar_chart' ||
                        config.visualization === 'line_chart') && (
                        <>
                          <div>
                            <Label>X-Axis</Label>
                            <Select
                              value={config.chartConfig.xAxis || ''}
                              onValueChange={(value) =>
                                setConfig({
                                  ...config,
                                  chartConfig: { ...config.chartConfig, xAxis: value },
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select field" />
                              </SelectTrigger>
                              <SelectContent>
                                {config.columns.map((col) => (
                                  <SelectItem key={col.id} value={col.columnId}>
                                    {col.alias || col.columnName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Y-Axis</Label>
                            <Select
                              value={config.chartConfig.yAxis || ''}
                              onValueChange={(value) =>
                                setConfig({
                                  ...config,
                                  chartConfig: { ...config.chartConfig, yAxis: value },
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select field" />
                              </SelectTrigger>
                              <SelectContent>
                                {config.columns
                                  .filter((col) => {
                                    const info = availableColumns.find(
                                      (c) => c.id === col.columnId,
                                    );
                                    return info?.aggregatable || col.aggregation;
                                  })
                                  .map((col) => (
                                    <SelectItem key={col.id} value={col.columnId}>
                                      {col.alias || col.columnName}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      {config.visualization === 'pie_chart' && (
                        <>
                          <div>
                            <Label>Category Field</Label>
                            <Select
                              value={config.chartConfig.xAxis || ''}
                              onValueChange={(value) =>
                                setConfig({
                                  ...config,
                                  chartConfig: { ...config.chartConfig, xAxis: value },
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select field" />
                              </SelectTrigger>
                              <SelectContent>
                                {config.columns.map((col) => (
                                  <SelectItem key={col.id} value={col.columnId}>
                                    {col.alias || col.columnName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Value Field</Label>
                            <Select
                              value={config.chartConfig.yAxis || ''}
                              onValueChange={(value) =>
                                setConfig({
                                  ...config,
                                  chartConfig: { ...config.chartConfig, yAxis: value },
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select field" />
                              </SelectTrigger>
                              <SelectContent>
                                {config.columns
                                  .filter((col) => col.aggregation)
                                  .map((col) => (
                                    <SelectItem key={col.id} value={col.columnId}>
                                      {col.alias || col.columnName}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Right Panel - Preview */}
          <div className="flex-1 p-4 overflow-auto">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Report Preview
                </CardTitle>
                <CardDescription>
                  {config.dataSource
                    ? `Data from: ${DATA_SOURCES.find((s) => s.id === config.dataSource)?.name}`
                    : 'Select a data source to begin'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!config.dataSource ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Database className="h-12 w-12 mb-4 opacity-20" />
                    <p>Select a data source to start building your report</p>
                  </div>
                ) : config.columns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Table className="h-12 w-12 mb-4 opacity-20" />
                    <p>Add columns to see a preview</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Column Summary */}
                    <div className="flex flex-wrap gap-2">
                      {config.columns.map((col) => (
                        <Badge key={col.id} variant="secondary">
                          {col.alias || col.columnName}
                          {col.aggregation && ` (${col.aggregation.toUpperCase()})`}
                        </Badge>
                      ))}
                    </div>

                    {/* Filters Summary */}
                    {config.filters.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Filters:</span>{' '}
                        {config.filters
                          .map(
                            (f, i) =>
                              `${i > 0 ? f.conjunction.toUpperCase() + ' ' : ''}${f.columnName} ${f.operator} ${f.value}`,
                          )
                          .join(' ')}
                      </div>
                    )}

                    {/* Preview Prompt */}
                    <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-md">
                      <Button onClick={handlePreview} disabled={isRunning}>
                        {isRunning ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Running...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Run Preview
                          </>
                        )}
                      </Button>
                      <p className="text-sm text-muted-foreground mt-2">
                        Click to generate a preview with sample data
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Sheet open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <SheetContent side="right" className="w-[800px] sm:max-w-[800px]">
          <SheetHeader>
            <SheetTitle>Report Preview</SheetTitle>
            <SheetDescription>Showing first 100 rows of results</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {previewData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No data returned. Try adjusting your filters.
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-150px)]">
                <DataTable>
                  <TableHeader>
                    <TableRow>
                      {config.columns.map((col) => (
                        <TableHead key={col.id}>{col.alias || col.columnName}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, idx) => (
                      <TableRow key={idx}>
                        {config.columns.map((col) => (
                          <TableCell key={col.id}>
                            {formatCellValue(
                              row[col.columnId],
                              availableColumns.find((c) => c.id === col.columnId)?.type,
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </DataTable>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Report</DialogTitle>
            <DialogDescription>
              Enter a name and configure settings for your custom report
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reportName">Report Name</Label>
              <Input
                id="reportName"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder="e.g., Monthly Sales Summary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportDescription">Description</Label>
              <Textarea
                id="reportDescription"
                value={config.description}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                placeholder="Brief description of what this report shows..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportCategory">Category</Label>
              <Select
                value={config.category}
                onValueChange={(value) => setConfig({ ...config, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Public Report</Label>
                <p className="text-xs text-muted-foreground">
                  Allow other users in your organization to access this report
                </p>
              </div>
              <Switch
                checked={config.isPublic}
                onCheckedChange={(checked) => setConfig({ ...config, isPublic: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveReportMutation.isPending}>
              {saveReportMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper function to format cell values
function formatCellValue(value: any, type?: string): string {
  if (value === null || value === undefined) return '—';

  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(Number(value));
    case 'date':
      return new Date(value).toLocaleDateString();
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'number':
      return new Intl.NumberFormat().format(Number(value));
    default:
      return String(value);
  }
}
