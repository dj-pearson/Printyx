import { useRef, useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  DollarSign,
  Calendar,
  User,
  Building2,
  Phone,
  Mail,
  TrendingUp,
  Filter,
  Search,
  ChevronDown,
  LayoutGrid,
  List,
  SlidersHorizontal,
  GripVertical,
  MoreHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Zod schemas for form validation
const dealFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  amount: z.string().optional(),
  companyId: z.string().min(1, "Company is required"),
  companyName: z.string().min(1, "Company name is required"),
  contactId: z.string().optional(),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z
    .string()
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  primaryContactPhone: z.string().optional(),
  source: z.string().optional(),
  dealType: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  expectedCloseDate: z.string().optional(),
  productsInterested: z.string().optional(),
  estimatedMonthlyValue: z.string().optional(),
  notes: z.string().optional(),
});

type DealFormData = z.infer<typeof dealFormSchema>;

interface Company {
  id: string;
  businessName: string;
  customerNumber?: string;
  phone?: string;
  billingCity?: string;
  billingState?: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
}

interface Deal {
  id: string;
  title: string;
  description?: string;
  amount?: number;
  companyName?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  source?: string;
  dealType?: string;
  priority: string;
  expectedCloseDate?: string;
  productsInterested?: string;
  estimatedMonthlyValue?: number;
  notes?: string;
  status: string;
  probability: number;
  stageId: string;
  stageName?: string;
  stageColor?: string;
  ownerId: string;
  ownerName?: string;
  createdAt: string;
  updatedAt: string;
}

interface DealStage {
  id: string;
  name: string;
  description?: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  isClosingStage: boolean;
  isWonStage: boolean;
}

// Droppable Stage Area Component
function DroppableStageArea({
  stageId,
  children,
}: {
  stageId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id: stageId,
  });

  return (
    <div ref={setNodeRef} className="h-full">
      {children}
    </div>
  );
}

// Draggable Deal Card Component
function DraggableDealCard({ deal }: { deal: Deal }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="bg-white border rounded-md p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between mb-1.5">
        <h4 className="font-medium text-[13px] text-gray-900 line-clamp-2">
          {deal.title}
        </h4>
        <div className="flex items-center gap-1">
          <div
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Edit Deal</DropdownMenuItem>
              <DropdownMenuItem>View Details</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {deal.amount && (
        <div className="text-base font-semibold text-green-600 mb-1.5">
          ${parseFloat(deal.amount.toString()).toLocaleString()}
        </div>
      )}

      <div className="space-y-0.5 text-[11px] text-gray-600">
        {deal.companyName && (
          <div className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            <span>{deal.companyName}</span>
          </div>
        )}

        {deal.ownerName && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>{deal.ownerName}</span>
          </div>
        )}

        {deal.expectedCloseDate && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>
              {format(new Date(deal.expectedCloseDate), "MMM d, yyyy")}
            </span>
          </div>
        )}

        {deal.source && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 capitalize">
              {deal.source}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        <Badge
          variant="secondary"
          className={cn(
            "text-[10px]",
            deal.priority === "high" && "bg-red-100 text-red-800",
            deal.priority === "medium" && "bg-yellow-100 text-yellow-800",
            deal.priority === "low" && "bg-green-100 text-green-800"
          )}
        >
          {deal.priority}
        </Badge>

        {deal.probability && (
          <span className="text-[10px] text-gray-500">{deal.probability}%</span>
        )}
      </div>
    </div>
  );
}

export default function DealsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [isCompanySelectOpen, setIsCompanySelectOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    owner: "",
    source: "all",
    dealType: "all",
    priority: "all",
    amountMin: "",
    amountMax: "",
    closeDateFrom: "",
    closeDateTo: "",
  });
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [editingCloseDate, setEditingCloseDate] = useState<string | null>(null);
  const [collapsedStages, setCollapsedStages] = useState<
    Record<string, boolean>
  >({});
  const boardRef = useRef<HTMLDivElement | null>(null);
  const stageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Table column chooser
  const ALL_COLUMNS = [
    "name",
    "stage",
    "amount",
    "probability",
    "company",
    "owner",
    "close",
    "source",
    "priority",
    "created",
    "actions",
  ] as const;
  type ColumnKey = (typeof ALL_COLUMNS)[number];
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("deals.visibleColumns")
        : null;
    return saved
      ? (JSON.parse(saved) as ColumnKey[])
      : [
          "name",
          "stage",
          "amount",
          "probability",
          "company",
          "owner",
          "close",
          "priority",
          "actions",
        ];
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "deals.visibleColumns",
        JSON.stringify(visibleColumns)
      );
    }
  }, [visibleColumns]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch deal stages
  const { data: stages = [], isLoading: stagesLoading } = useQuery<DealStage[]>(
    {
      queryKey: ["/api/deal-stages"],
    }
  );

  // Fetch companies for dropdown search
  const { data: companies = [], isLoading: companiesLoading } = useQuery<
    Company[]
  >({
    queryKey: ["/api/companies", companySearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companySearchTerm) params.append("search", companySearchTerm);

      return await apiRequest("/api/companies?" + params.toString());
    },
  });

  // Fetch contacts for selected company
  const { data: companyContacts = [], isLoading: contactsLoading } = useQuery<
    Contact[]
  >({
    queryKey: ["/api/companies", selectedCompanyId, "contacts"],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      return await apiRequest(`/api/companies/${selectedCompanyId}/contacts`);
    },
    enabled: !!selectedCompanyId,
  });

  // Fetch deals with optional stage filtering
  const {
    data: deals = [],
    isLoading: dealsLoading,
    refetch: refetchDeals,
  } = useQuery<Deal[]>({
    queryKey: ["/api/deals", selectedStageId, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStageId && selectedStageId !== "all")
        params.append("stageId", selectedStageId);
      if (searchTerm) params.append("search", searchTerm);

      const response = await fetch(`/api/deals?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch deals");
      return response.json();
    },
  });

  const form = useForm<DealFormData>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      priority: "medium",
      title: "",
      description: "",
      amount: "",
      companyId: "",
      companyName: "",
      contactId: "",
      primaryContactName: "",
      primaryContactEmail: "",
      primaryContactPhone: "",
      source: "",
      dealType: "",
      expectedCloseDate: "",
      productsInterested: "",
      estimatedMonthlyValue: "",
      notes: "",
    },
  });

  // Create deal mutation
  const createDealMutation = useMutation({
    mutationFn: async (data: DealFormData) => {
      const dealData = {
        ...data,
        amount: data.amount ? parseFloat(data.amount) : undefined,
        estimatedMonthlyValue: data.estimatedMonthlyValue
          ? parseFloat(data.estimatedMonthlyValue)
          : undefined,
      };

      return await apiRequest("/api/deals", "POST", dealData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      setIsCreateDialogOpen(false);
      form.reset();
      setSelectedCompanyId("");
      setSelectedContact(null);
      toast({
        title: "Success",
        description: "Deal created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create deal",
        variant: "destructive",
      });
    },
  });

  // Update deal stage mutation (for drag and drop)
  const updateDealStageMutation = useMutation({
    mutationFn: async ({
      dealId,
      stageId,
    }: {
      dealId: string;
      stageId: string;
    }) => {
      return await apiRequest(`/api/deals/${dealId}/stage`, "PUT", { stageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Success",
        description: "Deal moved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to move deal",
        variant: "destructive",
      });
    },
  });

  // Update deal close date mutation (for inline editing)
  const updateDealCloseDateMutation = useMutation({
    mutationFn: async ({
      dealId,
      expectedCloseDate,
    }: {
      dealId: string;
      expectedCloseDate: string;
    }) => {
      return await apiRequest(`/api/deals/${dealId}`, "PUT", {
        expectedCloseDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      setEditingCloseDate(null);
      toast({
        title: "Success",
        description: "Close date updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update close date",
        variant: "destructive",
      });
      setEditingCloseDate(null);
    },
  });

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const dealId = active.id as string;
    let newStageId = over.id as string;

    // Check if we're dropping on another deal (should get the stage from that deal's container)
    const isDeal = deals.some((d) => d.id === newStageId);
    if (isDeal) {
      // Find the stage of the deal we're dropping on
      const targetDeal = deals.find((d) => d.id === newStageId);
      if (targetDeal) {
        newStageId = targetDeal.stageId;
      }
    }

    // Verify it's a valid stage
    const validStage = stages.find((s) => s.id === newStageId);
    if (!validStage) {
      console.log("Invalid stage ID:", newStageId);
      return;
    }

    console.log("Drag end:", { dealId, newStageId, overId: over.id, isDeal });

    // Find the deal and check if it's actually moving to a different stage
    const deal = deals.find((d) => d.id === dealId);

    if (deal && deal.stageId !== newStageId) {
      console.log("Moving deal from", deal.stageId, "to", newStageId);

      // Optimistically update the UI first
      queryClient.setQueryData(
        ["/api/deals", selectedStageId, searchTerm],
        (oldDeals: Deal[] | undefined) => {
          if (!oldDeals) return oldDeals;
          return oldDeals.map((d) =>
            d.id === dealId ? { ...d, stageId: newStageId } : d
          );
        }
      );

      updateDealStageMutation.mutate({ dealId, stageId: newStageId });
    }
  };

  const onSubmit = (data: DealFormData) => {
    createDealMutation.mutate(data);
  };

  // Filter deals based on current filters
  const filteredDeals = deals.filter((deal) => {
    if (
      filters.owner &&
      deal.ownerName &&
      !deal.ownerName.toLowerCase().includes(filters.owner.toLowerCase())
    )
      return false;
    if (
      filters.source &&
      filters.source !== "all" &&
      deal.source &&
      !deal.source.toLowerCase().includes(filters.source.toLowerCase())
    )
      return false;
    if (
      filters.dealType &&
      filters.dealType !== "all" &&
      deal.dealType &&
      !deal.dealType.toLowerCase().includes(filters.dealType.toLowerCase())
    )
      return false;
    if (
      filters.priority &&
      filters.priority !== "all" &&
      deal.priority !== filters.priority
    )
      return false;
    if (
      filters.amountMin &&
      deal.amount &&
      deal.amount < parseFloat(filters.amountMin)
    )
      return false;
    if (
      filters.amountMax &&
      deal.amount &&
      deal.amount > parseFloat(filters.amountMax)
    )
      return false;
    if (
      filters.closeDateFrom &&
      deal.expectedCloseDate &&
      new Date(deal.expectedCloseDate) < new Date(filters.closeDateFrom)
    )
      return false;
    if (
      filters.closeDateTo &&
      deal.expectedCloseDate &&
      new Date(deal.expectedCloseDate) > new Date(filters.closeDateTo)
    )
      return false;
    return true;
  });

  // Group deals by stage for kanban view
  const dealsByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = filteredDeals.filter((deal) => deal.stageId === stage.id);
    return acc;
  }, {} as Record<string, Deal[]>);

  // Stage aggregates (count, sum amount, avg probability)
  const stageAggregates: Record<
    string,
    { count: number; totalAmount: number; avgProb: number }
  > = useMemo(() => {
    const map: Record<
      string,
      { count: number; totalAmount: number; avgProb: number }
    > = {};
    stages.forEach((s) => {
      const list = dealsByStage[s.id] || [];
      const count = list.length;
      // Guard against strings or undefined amounts
      const totalAmount = list.reduce((sum, d: any) => {
        const n =
          typeof d.amount === "number"
            ? d.amount
            : parseFloat(String(d.amount || "0"));
        return sum + (isFinite(n) && !isNaN(n) ? n : 0);
      }, 0);
      const avgProb = count
        ? Math.round(
            list.reduce((sum, d: any) => {
              const p =
                typeof d.probability === "number"
                  ? d.probability
                  : parseFloat(String(d.probability || "0"));
              return sum + (isFinite(p) && !isNaN(p) ? p : 0);
            }, 0) / count
          )
        : 0;
      map[s.id] = { count, totalAmount, avgProb };
    });
    return map;
  }, [stages, dealsByStage]);

  const scrollToStage = (stageId: string) => {
    const el = stageRefs.current[stageId];
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  };

  const activeDeal = activeId
    ? deals.find((deal) => deal.id === activeId)
    : null;

  const formatAmount = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value || 0);

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
              Deals
            </h1>
            <p className="text-sm text-gray-600">
              {filteredDeals.length} deals
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* View Mode Toggle */}
            <div className="flex items-center border rounded-lg p-1">
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="h-8 flex-1 sm:flex-none"
              >
                <LayoutGrid className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Board</span>
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-8 flex-1 sm:flex-none"
              >
                <List className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Table</span>
              </Button>
            </div>

            <div className="flex gap-2">
              {/* Filters Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "gap-2 flex-1 sm:flex-none",
                  showFilters && "bg-gray-100"
                )}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="sm:inline">Filters</span>
              </Button>
              {/* Column chooser for Table view */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <List className="h-4 w-4" /> Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ALL_COLUMNS.map((key) => (
                    <DropdownMenuItem
                      key={key}
                      onSelect={(e) => e.preventDefault()}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={visibleColumns.includes(key)}
                          onCheckedChange={(checked) => {
                            setVisibleColumns((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(key as ColumnKey);
                              else next.delete(key as ColumnKey);
                              return Array.from(next) as ColumnKey[];
                            });
                          }}
                        />
                        <span className="capitalize">{key}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() =>
                      setVisibleColumns([
                        "name",
                        "stage",
                        "amount",
                        "probability",
                        "company",
                        "close",
                        "priority",
                        "actions",
                      ])
                    }
                  >
                    Preset: Compact
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      setVisibleColumns([
                        "name",
                        "stage",
                        "amount",
                        "probability",
                        "company",
                        "owner",
                        "close",
                        "source",
                        "priority",
                        "actions",
                      ])
                    }
                  >
                    Preset: Pipeline
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      setVisibleColumns([
                        "name",
                        "amount",
                        "probability",
                        "close",
                        "owner",
                        "created",
                        "actions",
                      ])
                    }
                  >
                    Preset: Forecast
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Create Deal Button */}
              <Dialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="gap-2 flex-1 sm:flex-none">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Create Deal</span>
                    <span className="sm:hidden">New</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-lg lg:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl">
                      Create New Deal
                    </DialogTitle>
                  </DialogHeader>

                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>Deal Title *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter deal title"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Deal Amount</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Priority</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select priority" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Company Selection */}
                        <FormField
                          control={form.control}
                          name="companyName"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>Company *</FormLabel>
                              <Popover
                                open={isCompanySelectOpen}
                                onOpenChange={setIsCompanySelectOpen}
                              >
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className={cn(
                                        "w-full justify-between",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      {field.value || "Select company"}
                                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                  <Command>
                                    <CommandInput
                                      placeholder="Search companies..."
                                      value={companySearchTerm}
                                      onValueChange={setCompanySearchTerm}
                                    />
                                    <CommandEmpty>
                                      No companies found.
                                    </CommandEmpty>
                                    <CommandGroup>
                                      {companies.map((company) => (
                                        <CommandItem
                                          key={company.id}
                                          value={company.businessName}
                                          onSelect={() => {
                                            form.setValue(
                                              "companyName",
                                              company.businessName
                                            );
                                            form.setValue(
                                              "companyId",
                                              company.id
                                            );
                                            setSelectedCompanyId(company.id);
                                            setIsCompanySelectOpen(false);
                                          }}
                                        >
                                          <div className="flex flex-col">
                                            <span className="font-medium">
                                              {company.businessName}
                                            </span>
                                            {company.billingCity &&
                                              company.billingState && (
                                                <span className="text-sm text-gray-500">
                                                  {company.billingCity},{" "}
                                                  {company.billingState}
                                                </span>
                                              )}
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Additional fields... */}
                        <FormField
                          control={form.control}
                          name="source"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Lead Source</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select source" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="website">
                                    Website
                                  </SelectItem>
                                  <SelectItem value="referral">
                                    Referral
                                  </SelectItem>
                                  <SelectItem value="cold_call">
                                    Cold Call
                                  </SelectItem>
                                  <SelectItem value="email">
                                    Email Campaign
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="expectedCloseDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Expected Close Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Deal description..."
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateDialogOpen(false)}
                          className="order-2 sm:order-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createDealMutation.isPending}
                          className="order-1 sm:order-2"
                        >
                          {createDealMutation.isPending
                            ? "Creating..."
                            : "Create Deal"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === "kanban" ? (
            /* Kanban View */
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {/* Stage rail for quick navigation (mobile only) */}
              <div className="flex gap-2 overflow-x-auto pb-2 md:hidden">
                {stages.map((s) => (
                  <Button
                    key={s.id}
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                    onClick={() => scrollToStage(s.id)}
                  >
                    <span
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </Button>
                ))}
              </div>
              <div
                ref={boardRef}
                className="grid gap-4 h-full pb-4"
                style={{
                  gridTemplateColumns: `repeat(${
                    stages.length || 1
                  }, minmax(220px, 1fr))`,
                }}
              >
                {stages.map((stage) => (
                  <div
                    key={stage.id}
                    ref={(el) => (stageRefs.current[stage.id] = el)}
                    className="min-w-0"
                  >
                    <div className="bg-gray-50 rounded-md h-full flex flex-col min-h-80">
                      <div className="p-2 sm:p-3 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: stage.color }}
                            />
                            <h3 className="text-gray-900 text-sm font-medium leading-tight break-words">
                              {stage.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1"
                              onClick={() =>
                                setCollapsedStages((prev) => ({
                                  ...prev,
                                  [stage.id]: !prev[stage.id],
                                }))
                              }
                              title={
                                collapsedStages[stage.id]
                                  ? "Expand"
                                  : "Collapse"
                              }
                            >
                              {collapsedStages[stage.id] ? "▶" : "▾"}
                            </Button>
                          </div>
                        </div>
                        <div className="mt-1 text-[12px] font-semibold text-gray-700">
                          {formatAmount(
                            stageAggregates[stage.id]?.totalAmount || 0
                          )}
                        </div>
                      </div>

                      <SortableContext
                        items={(dealsByStage[stage.id] || []).map(
                          (deal) => deal.id
                        )}
                        strategy={verticalListSortingStrategy}
                      >
                        <DroppableStageArea stageId={stage.id}>
                          {!collapsedStages[stage.id] && (
                            <div className="flex-1 p-2 sm:p-3 space-y-2 overflow-y-auto min-h-0">
                              {(dealsByStage[stage.id] || []).map((deal) => (
                                <DraggableDealCard key={deal.id} deal={deal} />
                              ))}
                              {(!dealsByStage[stage.id] ||
                                dealsByStage[stage.id].length === 0) && (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                  No deals in this stage
                                </div>
                              )}
                            </div>
                          )}
                        </DroppableStageArea>
                      </SortableContext>
                    </div>
                  </div>
                ))}
              </div>

              <DragOverlay>
                {activeDeal && (
                  <div className="bg-white border rounded-lg p-4 shadow-lg rotate-3">
                    <h4 className="font-medium text-sm text-gray-900">
                      {activeDeal.title}
                    </h4>
                    {activeDeal.amount && (
                      <div className="text-lg font-semibold text-green-600 mt-1">
                        $
                        {parseFloat(
                          activeDeal.amount.toString()
                        ).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          ) : (
            /* Table View */
            <Card className="h-full">
              <CardContent className="p-0">
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-auto h-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {visibleColumns.includes("name") && (
                          <TableHead className="sticky left-0 bg-white z-10">
                            Deal Name
                          </TableHead>
                        )}
                        {visibleColumns.includes("stage") && (
                          <TableHead>Stage</TableHead>
                        )}
                        {visibleColumns.includes("amount") && (
                          <TableHead>Amount</TableHead>
                        )}
                        {visibleColumns.includes("probability") && (
                          <TableHead>Probability</TableHead>
                        )}
                        {visibleColumns.includes("company") && (
                          <TableHead>Company</TableHead>
                        )}
                        {visibleColumns.includes("owner") && (
                          <TableHead>Owner</TableHead>
                        )}
                        {visibleColumns.includes("close") && (
                          <TableHead>Expected Close</TableHead>
                        )}
                        {visibleColumns.includes("source") && (
                          <TableHead>Source</TableHead>
                        )}
                        {visibleColumns.includes("priority") && (
                          <TableHead>Priority</TableHead>
                        )}
                        {visibleColumns.includes("created") && (
                          <TableHead>Created</TableHead>
                        )}
                        {visibleColumns.includes("actions") && (
                          <TableHead className="sticky right-0 bg-white z-10">
                            Actions
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDeals.map((deal) => (
                        <TableRow key={deal.id}>
                          {visibleColumns.includes("name") && (
                            <TableCell className="font-medium sticky left-0 bg-white z-10">
                              {deal.title}
                            </TableCell>
                          )}
                          {visibleColumns.includes("stage") && (
                            <TableCell>
                              <Select
                                value={deal.stageId}
                                onValueChange={(stageId) => {
                                  updateDealStageMutation.mutate({
                                    dealId: deal.id,
                                    stageId,
                                  });
                                }}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {stages.map((stage) => (
                                    <SelectItem key={stage.id} value={stage.id}>
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{
                                            backgroundColor: stage.color,
                                          }}
                                        />
                                        {stage.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                          {visibleColumns.includes("amount") && (
                            <TableCell>
                              {deal.amount
                                ? `$${parseFloat(
                                    deal.amount.toString()
                                  ).toLocaleString()}`
                                : "-"}
                            </TableCell>
                          )}
                          {visibleColumns.includes("probability") && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    deal.probability >= 80
                                      ? "default"
                                      : deal.probability >= 60
                                      ? "secondary"
                                      : deal.probability >= 40
                                      ? "outline"
                                      : "destructive"
                                  }
                                >
                                  {deal.probability}%
                                </Badge>
                              </div>
                            </TableCell>
                          )}
                          {visibleColumns.includes("company") && (
                            <TableCell>{deal.companyName || "-"}</TableCell>
                          )}
                          {visibleColumns.includes("owner") && (
                            <TableCell>
                              <span className="text-sm">
                                {deal.ownerName || "Unassigned"}
                              </span>
                            </TableCell>
                          )}
                          {visibleColumns.includes("close") && (
                            <TableCell>
                              {editingCloseDate === deal.id ? (
                                <Input
                                  type="date"
                                  defaultValue={
                                    deal.expectedCloseDate
                                      ? deal.expectedCloseDate.split("T")[0]
                                      : ""
                                  }
                                  className="w-36 h-8 text-sm"
                                  autoFocus
                                  onBlur={(e) => {
                                    const newDate = e.target.value;
                                    if (
                                      newDate &&
                                      newDate !==
                                        deal.expectedCloseDate?.split("T")[0]
                                    ) {
                                      updateDealCloseDateMutation.mutate({
                                        dealId: deal.id,
                                        expectedCloseDate: newDate,
                                      });
                                    } else {
                                      setEditingCloseDate(null);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const newDate = (
                                        e.target as HTMLInputElement
                                      ).value;
                                      if (
                                        newDate &&
                                        newDate !==
                                          deal.expectedCloseDate?.split("T")[0]
                                      ) {
                                        updateDealCloseDateMutation.mutate({
                                          dealId: deal.id,
                                          expectedCloseDate: newDate,
                                        });
                                      } else {
                                        setEditingCloseDate(null);
                                      }
                                    } else if (e.key === "Escape") {
                                      setEditingCloseDate(null);
                                    }
                                  }}
                                />
                              ) : (
                                <span
                                  className="text-sm cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                                  onClick={() => setEditingCloseDate(deal.id)}
                                  title="Click to edit close date"
                                >
                                  {deal.expectedCloseDate
                                    ? format(
                                        new Date(deal.expectedCloseDate),
                                        "MMM d, yyyy"
                                      )
                                    : "Set date"}
                                </span>
                              )}
                            </TableCell>
                          )}
                          {visibleColumns.includes("source") && (
                            <TableCell>
                              <span className="text-sm capitalize">
                                {deal.source || "-"}
                              </span>
                            </TableCell>
                          )}
                          {visibleColumns.includes("priority") && (
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  deal.priority === "high" &&
                                    "bg-red-100 text-red-800",
                                  deal.priority === "medium" &&
                                    "bg-yellow-100 text-yellow-800",
                                  deal.priority === "low" &&
                                    "bg-green-100 text-green-800"
                                )}
                              >
                                {deal.priority}
                              </Badge>
                            </TableCell>
                          )}
                          {visibleColumns.includes("created") && (
                            <TableCell>
                              <span className="text-sm">
                                {format(
                                  new Date(deal.createdAt),
                                  "MMM d, yyyy"
                                )}
                              </span>
                            </TableCell>
                          )}
                          {visibleColumns.includes("actions") && (
                            <TableCell className="sticky right-0 bg-white z-10">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>Edit Deal</DropdownMenuItem>
                                  <DropdownMenuItem>
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-red-600">
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {filteredDeals.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No deals found.</p>
                    </div>
                  )}
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden h-full overflow-y-auto">
                  <div className="p-4 space-y-4">
                    {filteredDeals.length > 0 ? (
                      filteredDeals.map((deal) => (
                        <div
                          key={deal.id}
                          className="border rounded-lg p-4 bg-white"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 text-base mb-1 truncate">
                                {deal.title}
                              </h3>
                              <p className="text-sm text-gray-600 truncate">
                                {deal.companyName || "No company"}
                              </p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Edit Deal</DropdownMenuItem>
                                <DropdownMenuItem>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-600">
                                Stage:
                              </span>
                              <Select
                                value={deal.stageId}
                                onValueChange={(stageId) => {
                                  updateDealStageMutation.mutate({
                                    dealId: deal.id,
                                    stageId,
                                  });
                                }}
                              >
                                <SelectTrigger className="w-32 h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {stages.map((stage) => (
                                    <SelectItem key={stage.id} value={stage.id}>
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{
                                            backgroundColor: stage.color,
                                          }}
                                        />
                                        {stage.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {deal.amount && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-600">
                                  Amount:
                                </span>
                                <span className="text-sm font-semibold text-green-600">
                                  $
                                  {parseFloat(
                                    deal.amount.toString()
                                  ).toLocaleString()}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-600">
                                Probability:
                              </span>
                              <Badge
                                variant={
                                  deal.probability >= 80
                                    ? "default"
                                    : deal.probability >= 60
                                    ? "secondary"
                                    : deal.probability >= 40
                                    ? "outline"
                                    : "destructive"
                                }
                                className="text-xs"
                              >
                                {deal.probability}%
                              </Badge>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-600">
                                Priority:
                              </span>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-xs",
                                  deal.priority === "high" &&
                                    "bg-red-100 text-red-800",
                                  deal.priority === "medium" &&
                                    "bg-yellow-100 text-yellow-800",
                                  deal.priority === "low" &&
                                    "bg-green-100 text-green-800"
                                )}
                              >
                                {deal.priority}
                              </Badge>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-600">
                                Owner:
                              </span>
                              <span className="text-sm text-gray-900 truncate ml-2">
                                {deal.ownerName || "Unassigned"}
                              </span>
                            </div>

                            {deal.expectedCloseDate && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-600">
                                  Close Date:
                                </span>
                                <span className="text-sm text-gray-900">
                                  {format(
                                    new Date(deal.expectedCloseDate),
                                    "MMM d, yyyy"
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-500">No deals found.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
