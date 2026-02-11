import { useRef, useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import ContextualHelp from '@/components/contextual/ContextualHelp';
import PageAlerts from '@/components/contextual/PageAlerts';
import { relativeDate } from '@/lib/date-utils';
import { MobileFAB } from '@/components/ui/mobile-fab';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Enhanced Zod schema with complete deal database fields including BANT tracking
const dealFormSchema = z.object({
  // Basic Deal Information
  title: z.string().min(1, 'Title is required'),
  dealName: z.string().min(1, 'Deal name is required'),
  description: z.string().optional(),
  amount: z.string().optional(),
  dealValue: z.string().min(1, 'Deal value is required'),

  // Company and Contact Information
  companyId: z.string().min(1, 'Company is required'),
  companyName: z.string().min(1, 'Company name is required'),
  businessRecordId: z.string().optional(),
  contactId: z.string().optional(),
  contactName: z.string().optional(),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  primaryContactPhone: z.string().optional(),

  // Deal Stage and Pipeline
  dealStage: z.string().default('prospecting'),
  probability: z.string().default('10'),
  closeDate: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  actualCloseDate: z.string().optional(),

  // Lead Source and Assignment
  leadSource: z.string().optional(),
  source: z.string().optional(),
  assignedTo: z.string().optional(),

  // Product and Competition Information
  productInterest: z.string().optional(),
  productsInterested: z.string().optional(),
  competitorInfo: z.string().optional(),

  // BANT Qualification Framework
  budgetConfirmed: z.boolean().default(false),
  authorityConfirmed: z.boolean().default(false),
  needConfirmed: z.boolean().default(false),
  timelineConfirmed: z.boolean().default(false),
  decisionMaker: z.string().optional(),

  // Sales Process Tracking
  proposalSent: z.boolean().default(false),
  contractSent: z.boolean().default(false),

  // Deal Management
  dealType: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  estimatedMonthlyValue: z.string().optional(),
  commissionAmount: z.string().optional(),
  forecastCategory: z.enum(['pipeline', 'best_case', 'commit', 'omitted']).default('pipeline'),

  // Outcome Tracking
  lostReason: z.string().optional(),
  winReason: z.string().optional(),

  // Notes and Tags
  notes: z.string().optional(),
  tags: z.string().optional(),
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
  tenantId?: string;
  businessRecordId?: string;

  // Basic Deal Information
  title: string;
  dealName?: string;
  description?: string;
  amount?: number;
  dealValue?: number;

  // Company and Contact Information
  companyName?: string;
  contactName?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;

  // Deal Stage and Pipeline
  dealStage: string;
  probability: number;
  closeDate?: string;
  expectedCloseDate?: string;
  actualCloseDate?: string;

  // Lead Source and Assignment
  leadSource?: string;
  source?: string;
  assignedTo?: string;

  // Product and Competition Information
  productInterest?: string;
  productsInterested?: string;
  competitorInfo?: string;

  // BANT Qualification Framework
  budgetConfirmed?: boolean;
  authorityConfirmed?: boolean;
  needConfirmed?: boolean;
  timelineConfirmed?: boolean;
  decisionMaker?: string;

  // Sales Process Tracking
  proposalSent?: boolean;
  contractSent?: boolean;

  // Deal Management
  dealType?: string;
  priority: string;
  estimatedMonthlyValue?: number;
  commissionAmount?: number;
  forecastCategory?: string;

  // Outcome Tracking
  lostReason?: string;
  winReason?: string;

  // Notes and Tags
  notes?: string;
  tags?: string | string[];

  // System Fields
  status: string;
  stageId: string;
  stageName?: string;
  stageColor?: string;
  ownerId: string;
  ownerName?: string;
  createdBy?: string;
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
function DroppableStageArea({ stageId, children }: { stageId: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({
    id: stageId,
  });

  return (
    <div ref={setNodeRef} className="h-full">
      {children}
    </div>
  );
}

// Mobile-Optimized Deal Card Component
function MobileDealCard({
  deal,
  stageColor,
  onDelete,
}: {
  deal: Deal;
  stageColor: string;
  onDelete: (dealId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
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
      {...attributes}
      className="bg-white border-2 border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 touch-manipulation active:scale-[0.98]"
    >
      {/* Mobile Deal Header with Drag Handle */}
      <div className="flex items-center justify-between p-4 sm:p-5 pb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-base line-clamp-2 mb-1">{deal.title}</h4>
          {deal.companyName && (
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{deal.companyName}</span>
            </div>
          )}
        </div>

        {/* Mobile-friendly drag handle */}
        <div className="flex items-center gap-3 ml-3">
          <div
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-3 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <GripVertical className="h-5 w-5 text-gray-400" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 touch-manipulation"
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="py-3">
                <span className="text-base">Edit Deal</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="py-3">
                <span className="text-base">View Details</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600 py-3"
                onClick={() => {
                  if (confirm(`Delete deal "${deal.title}"? This cannot be undone.`)) {
                    onDelete(deal.id);
                  }
                }}
              >
                <span className="text-base">Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Deal Amount */}
      {deal.amount && (
        <div className="px-4 sm:px-5 pb-3">
          <div className="text-xl font-bold text-green-600">
            ${parseFloat(deal.amount.toString()).toLocaleString()}
          </div>
        </div>
      )}

      {/* Deal Info Grid */}
      <div className="px-4 sm:px-5 pb-3 space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          {deal.ownerName && (
            <div className="flex items-center gap-2 text-gray-600">
              <User className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{deal.ownerName}</span>
            </div>
          )}
          {deal.expectedCloseDate && (
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{format(new Date(deal.expectedCloseDate), 'MMM d')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="flex items-center justify-between p-4 sm:p-5 pt-0">
        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className={cn(
              'text-sm px-3 py-1',
              deal.priority === 'high' && 'bg-red-100 text-red-800',
              deal.priority === 'medium' && 'bg-yellow-100 text-yellow-800',
              deal.priority === 'low' && 'bg-green-100 text-green-800',
            )}
          >
            {deal.priority}
          </Badge>
          {deal.source && (
            <span className="text-xs text-gray-500 capitalize bg-gray-100 px-2 py-1 rounded">
              {deal.source}
            </span>
          )}
        </div>

        {deal.probability && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">{deal.probability}%</span>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stageColor }} />
          </div>
        )}
      </div>
    </div>
  );
}

// Draggable Deal Card Component
function DraggableDealCard({ deal, onDelete }: { deal: Deal; onDelete: (dealId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
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
      {...attributes}
      className="bg-white border rounded-md p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between mb-1.5">
        <h4 className="font-medium text-[13px] text-gray-900 line-clamp-2">{deal.title}</h4>
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
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => {
                  if (confirm(`Delete deal "${deal.title}"? This cannot be undone.`)) {
                    onDelete(deal.id);
                  }
                }}
              >
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
            <span>{format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')}</span>
          </div>
        )}

        {deal.source && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 capitalize">{deal.source}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        <Badge
          variant="secondary"
          className={cn(
            'text-[10px]',
            deal.priority === 'high' && 'bg-red-100 text-red-800',
            deal.priority === 'medium' && 'bg-yellow-100 text-yellow-800',
            deal.priority === 'low' && 'bg-green-100 text-green-800',
          )}
        >
          {deal.priority}
        </Badge>

        {deal.probability && <span className="text-[10px] text-gray-500">{deal.probability}%</span>}
      </div>
    </div>
  );
}

export default function DealsManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [isCompanySelectOpen, setIsCompanySelectOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    owner: '',
    source: 'all',
    dealType: 'all',
    priority: 'all',
    amountMin: '',
    amountMax: '',
    closeDateFrom: '',
    closeDateTo: '',
  });
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [editingCloseDate, setEditingCloseDate] = useState<string | null>(null);
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const boardRef = useRef<HTMLDivElement | null>(null);
  const stageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Table column chooser
  const ALL_COLUMNS = [
    'name',
    'stage',
    'amount',
    'probability',
    'company',
    'owner',
    'close',
    'source',
    'priority',
    'created',
    'actions',
  ] as const;
  type ColumnKey = (typeof ALL_COLUMNS)[number];
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => {
    const saved =
      typeof window !== 'undefined' ? localStorage.getItem('deals.visibleColumns') : null;
    return saved
      ? (JSON.parse(saved) as ColumnKey[])
      : [
          'name',
          'stage',
          'amount',
          'probability',
          'company',
          'owner',
          'close',
          'priority',
          'actions',
        ];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('deals.visibleColumns', JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  // Drag and drop sensors optimized for mobile
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
  );

  // Fetch deal stages
  const { data: stages = [], isLoading: stagesLoading } = useQuery<DealStage[]>({
    queryKey: ['/api/deal-stages'],
    queryFn: async () => {
      const response = await apiRequest('/api/deal-stages', 'GET');
      return (response || []).map((stage: any) => ({
        ...stage,
        id: stage.id,
        displayOrder: stage.display_order || stage.displayOrder || 0,
        createdAt: stage.createdAt || stage.createdAt || '',
      }));
    },
  });

  // Fetch companies for dropdown search
  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies', companySearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companySearchTerm) params.append('search', companySearchTerm);

      const response = await apiRequest('/api/companies?' + params.toString());
      return (response?.records || response || []).map((c: any) => ({
        ...c,
        id: c.id,
        companyName: c.businessName || c.companyName || '',
        businessRecordType: c.business_record_type || c.businessRecordType || '',
      }));
    },
  });

  // Fetch contacts for selected company
  const { data: companyContacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ['/api/companies', selectedCompanyId, 'contacts'],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const response = await apiRequest(`/api/companies/${selectedCompanyId}/contacts`);
      return (response || []).map((c: any) => ({
        ...c,
        id: c.id,
        firstName: c.firstName || c.firstName || '',
        lastName: c.lastName || c.lastName || '',
        isPrimaryContact: c.is_primary_contact || c.isPrimaryContact || false,
        companyId: c.companyId || c.companyId || '',
      }));
    },
    enabled: !!selectedCompanyId,
  });

  // Fetch deals with optional stage filtering
  const {
    data: deals = [],
    isLoading: dealsLoading,
    refetch: refetchDeals,
  } = useQuery<Deal[]>({
    queryKey: ['/api/deals', selectedStageId, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStageId && selectedStageId !== 'all') params.append('stageId', selectedStageId);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/deals?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch deals');
      return response.json();
    },
  });

  const form = useForm<DealFormData>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      // Basic Deal Information
      title: '',
      dealName: '',
      description: '',
      amount: '',
      dealValue: '',

      // Company and Contact Information
      companyId: '',
      companyName: '',
      businessRecordId: '',
      contactId: '',
      contactName: '',
      primaryContactName: '',
      primaryContactEmail: '',
      primaryContactPhone: '',

      // Deal Stage and Pipeline
      dealStage: 'prospecting',
      probability: '10',
      closeDate: '',
      expectedCloseDate: '',
      actualCloseDate: '',

      // Lead Source and Assignment
      leadSource: '',
      source: '',
      assignedTo: '',

      // Product and Competition Information
      productInterest: '',
      productsInterested: '',
      competitorInfo: '',

      // BANT Qualification Framework
      budgetConfirmed: false,
      authorityConfirmed: false,
      needConfirmed: false,
      timelineConfirmed: false,
      decisionMaker: '',

      // Sales Process Tracking
      proposalSent: false,
      contractSent: false,

      // Deal Management
      dealType: '',
      priority: 'medium',
      estimatedMonthlyValue: '',
      commissionAmount: '',
      forecastCategory: 'pipeline',

      // Outcome Tracking
      lostReason: '',
      winReason: '',

      // Notes and Tags
      notes: '',
      tags: '',
    },
  });

  // Create deal mutation
  const createDealMutation = useMutation({
    mutationFn: async (data: DealFormData) => {
      const dealData = {
        ...data,
        // Convert string amounts to numbers
        amount: data.amount ? parseFloat(data.amount) : undefined,
        dealValue: data.dealValue ? parseFloat(data.dealValue) : undefined,
        estimatedMonthlyValue: data.estimatedMonthlyValue
          ? parseFloat(data.estimatedMonthlyValue)
          : undefined,
        commissionAmount: data.commissionAmount ? parseFloat(data.commissionAmount) : undefined,
        // Convert string probability to number
        probability: data.probability ? parseFloat(data.probability) : undefined,
        // Convert string tags to array if needed
        tags: data.tags
          ? data.tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
        // Ensure proper date formatting
        closeDate: data.closeDate || undefined,
        expectedCloseDate: data.expectedCloseDate || undefined,
        actualCloseDate: data.actualCloseDate || undefined,
      };

      return await apiRequest('/api/deals', 'POST', dealData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      setIsCreateDialogOpen(false);
      form.reset();
      setSelectedCompanyId('');
      setSelectedContact(null);
      toast({
        title: 'Success',
        description: 'Deal created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create deal',
        variant: 'destructive',
      });
    },
  });

  // Update deal stage mutation (for drag and drop)
  const updateDealStageMutation = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      return await apiRequest(`/api/deals/${dealId}/stage`, 'PUT', { stageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({
        title: 'Success',
        description: 'Deal moved successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to move deal',
        variant: 'destructive',
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
      return await apiRequest(`/api/deals/${dealId}`, 'PUT', {
        expectedCloseDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      setEditingCloseDate(null);
      toast({
        title: 'Success',
        description: 'Close date updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update close date',
        variant: 'destructive',
      });
      setEditingCloseDate(null);
    },
  });

  // Delete deal mutation
  const deleteDealMutation = useMutation({
    mutationFn: async (dealId: string) => apiRequest(`/api/deals/${dealId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({ title: 'Success', description: 'Deal deleted' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete deal',
        variant: 'destructive',
      });
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
      console.log('Invalid stage ID:', newStageId);
      return;
    }

    console.log('Drag end:', { dealId, newStageId, overId: over.id, isDeal });

    // Find the deal and check if it's actually moving to a different stage
    const deal = deals.find((d) => d.id === dealId);

    if (deal && deal.stageId !== newStageId) {
      console.log('Moving deal from', deal.stageId, 'to', newStageId);

      // Optimistically update the UI first
      queryClient.setQueryData(
        ['/api/deals', selectedStageId, searchTerm],
        (oldDeals: Deal[] | undefined) => {
          if (!oldDeals) return oldDeals;
          return oldDeals.map((d) => (d.id === dealId ? { ...d, stageId: newStageId } : d));
        },
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
      filters.source !== 'all' &&
      deal.source &&
      !deal.source.toLowerCase().includes(filters.source.toLowerCase())
    )
      return false;
    if (
      filters.dealType &&
      filters.dealType !== 'all' &&
      deal.dealType &&
      !deal.dealType.toLowerCase().includes(filters.dealType.toLowerCase())
    )
      return false;
    if (filters.priority && filters.priority !== 'all' && deal.priority !== filters.priority)
      return false;
    if (filters.amountMin && deal.amount && deal.amount < parseFloat(filters.amountMin))
      return false;
    if (filters.amountMax && deal.amount && deal.amount > parseFloat(filters.amountMax))
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
  const dealsByStage = stages.reduce(
    (acc, stage) => {
      acc[stage.id] = filteredDeals.filter((deal) => deal.stageId === stage.id);
      return acc;
    },
    {} as Record<string, Deal[]>,
  );

  // Stage aggregates (count, sum amount, avg probability)
  const stageAggregates: Record<string, { count: number; totalAmount: number; avgProb: number }> =
    useMemo(() => {
      const map: Record<string, { count: number; totalAmount: number; avgProb: number }> = {};
      stages.forEach((s) => {
        const list = dealsByStage[s.id] || [];
        const count = list.length;
        // Guard against strings or undefined amounts
        const totalAmount = list.reduce((sum, d: any) => {
          const n = typeof d.amount === 'number' ? d.amount : parseFloat(String(d.amount || '0'));
          return sum + (isFinite(n) && !isNaN(n) ? n : 0);
        }, 0);
        const avgProb = count
          ? Math.round(
              list.reduce((sum, d: any) => {
                const p =
                  typeof d.probability === 'number'
                    ? d.probability
                    : parseFloat(String(d.probability || '0'));
                return sum + (isFinite(p) && !isNaN(p) ? p : 0);
              }, 0) / count,
            )
          : 0;
        map[s.id] = { count, totalAmount, avgProb };
      });
      return map;
    }, [stages, dealsByStage]);

  // Deal KPI stats
  const dealKpis = useMemo(() => {
    const totalValue = filteredDeals.reduce((sum, d) => {
      const n = typeof d.amount === 'number' ? d.amount : parseFloat(String(d.amount || '0'));
      return sum + (isFinite(n) && !isNaN(n) ? n : 0);
    }, 0);
    const weightedValue = filteredDeals.reduce((sum, d) => {
      const amt = typeof d.amount === 'number' ? d.amount : parseFloat(String(d.amount || '0'));
      const prob =
        typeof d.probability === 'number'
          ? d.probability
          : parseFloat(String(d.probability || '0'));
      return sum + ((isFinite(amt) ? amt : 0) * (isFinite(prob) ? prob : 0)) / 100;
    }, 0);
    const wonStages = stages.filter((s) => s.isWonStage).map((s) => s.id);
    const wonCount = filteredDeals.filter((d) => wonStages.includes(d.stageId)).length;
    return { total: filteredDeals.length, totalValue, weightedValue, wonCount };
  }, [filteredDeals, stages]);

  const scrollToStage = (stageId: string) => {
    const el = stageRefs.current[stageId];
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  };

  const activeDeal = activeId ? deals.find((deal) => deal.id === activeId) : null;

  const formatAmount = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value || 0);

  return (
    <MainLayout title="Opportunities" description="Manage your sales pipeline and opportunities">
      <div className="flex flex-col h-full">
        <div className="mb-4">
          <ContextualHelp page="deals-management" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-2 mb-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dealKpis.total}</div>
                <p className="text-xs text-muted-foreground">In pipeline</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatAmount(dealKpis.totalValue)}</div>
                <p className="text-xs text-muted-foreground">Total deal value</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Weighted Value</CardTitle>
                <TrendingUp className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatAmount(dealKpis.weightedValue)}</div>
                <p className="text-xs text-muted-foreground">Probability-adjusted</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Won Deals</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dealKpis.wonCount}</div>
                <p className="text-xs text-muted-foreground">Closed won</p>
              </CardContent>
            </Card>
          </div>
          <PageAlerts
            categories={['business']}
            severities={['medium', 'high', 'critical']}
            className="-mt-2"
          />
        </div>
        {/* Mobile-First Search and Filters Bar */}
        <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
          {/* Search Bar - Full Width on Mobile */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search deals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 h-11 touch-manipulation"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0 touch-manipulation"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Top Action Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600 order-2 sm:order-1">
              {filteredDeals.length} deals
            </div>

            <div className="flex flex-wrap gap-2 order-1 sm:order-2">
              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-lg p-1 bg-white">
                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('kanban')}
                  className="h-10 px-3 sm:h-8 touch-manipulation active:scale-95 transition-transform"
                  style={{ minWidth: '44px', minHeight: '44px' }}
                >
                  <LayoutGrid className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Board</span>
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="h-10 px-3 sm:h-8 touch-manipulation active:scale-95 transition-transform"
                  style={{ minWidth: '44px', minHeight: '44px' }}
                >
                  <List className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Table</span>
                </Button>
              </div>

              {/* Filters Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'gap-2 h-10 px-3 sm:h-8 touch-manipulation active:scale-95 transition-transform',
                  showFilters && 'bg-blue-50 border-blue-300',
                )}
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filters</span>
                {(filters.owner ||
                  filters.source !== 'all' ||
                  filters.priority !== 'all' ||
                  filters.amountMin ||
                  filters.amountMax) && (
                  <Badge
                    variant="default"
                    className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full"
                  >
                    !
                  </Badge>
                )}
              </Button>

              {/* Column chooser for Table view - Desktop Only */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 hidden lg:flex h-10 px-3 sm:h-8 touch-manipulation active:scale-95 transition-transform"
                  >
                    <List className="h-4 w-4" /> Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ALL_COLUMNS.map((key) => (
                    <DropdownMenuItem key={key} onSelect={(e) => e.preventDefault()}>
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
                        'name',
                        'stage',
                        'amount',
                        'probability',
                        'company',
                        'close',
                        'priority',
                        'actions',
                      ])
                    }
                  >
                    Preset: Compact
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      setVisibleColumns([
                        'name',
                        'stage',
                        'amount',
                        'probability',
                        'company',
                        'owner',
                        'close',
                        'source',
                        'priority',
                        'actions',
                      ])
                    }
                  >
                    Preset: Pipeline
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      setVisibleColumns([
                        'name',
                        'amount',
                        'probability',
                        'close',
                        'owner',
                        'created',
                        'actions',
                      ])
                    }
                  >
                    Preset: Forecast
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Create Opportunity Button - Desktop Only */}
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 hidden md:flex h-10 px-4 sm:h-8 touch-manipulation active:scale-95 transition-transform">
                    <Plus className="h-4 w-4" />
                    <span>+ Opportunity</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-0">
                  <div className="sticky top-0 bg-white border-b z-10 p-4 sm:p-6">
                    <DialogHeader>
                      <DialogTitle className="text-lg sm:text-xl">
                        Create New Opportunity
                      </DialogTitle>
                    </DialogHeader>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 sm:p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel className="text-base">Opportunity Title *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter opportunity title"
                                  className="h-11 touch-manipulation text-base"
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
                              <FormLabel className="text-base">Opportunity Amount</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  className="h-11 touch-manipulation text-base"
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
                              <FormLabel className="text-base">Priority</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-11 touch-manipulation">
                                    <SelectValue placeholder="Select priority" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="low" className="py-3 text-base">
                                    Low
                                  </SelectItem>
                                  <SelectItem value="medium" className="py-3 text-base">
                                    Medium
                                  </SelectItem>
                                  <SelectItem value="high" className="py-3 text-base">
                                    High
                                  </SelectItem>
                                  <SelectItem value="urgent" className="py-3 text-base">
                                    Urgent
                                  </SelectItem>
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
                              <FormLabel className="text-base">Company *</FormLabel>
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
                                        'w-full justify-between h-11 touch-manipulation text-base',
                                        !field.value && 'text-muted-foreground',
                                      )}
                                    >
                                      {field.value || 'Select company'}
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
                                    <CommandEmpty>No companies found.</CommandEmpty>
                                    <CommandGroup>
                                      {companies.map((company) => (
                                        <CommandItem
                                          key={company.id}
                                          value={company.businessName}
                                          onSelect={() => {
                                            form.setValue('companyName', company.businessName);
                                            form.setValue('companyId', company.id);
                                            setSelectedCompanyId(company.id);
                                            setIsCompanySelectOpen(false);
                                          }}
                                        >
                                          <div className="flex flex-col">
                                            <span className="font-medium">
                                              {company.businessName}
                                            </span>
                                            {company.billingCity && company.billingState && (
                                              <span className="text-sm text-gray-500">
                                                {company.billingCity}, {company.billingState}
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
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select source" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="website">Website</SelectItem>
                                  <SelectItem value="referral">Referral</SelectItem>
                                  <SelectItem value="cold_call">Cold Call</SelectItem>
                                  <SelectItem value="email">Email Campaign</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="dealName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Deal Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="Q1 2025 Office Equipment" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="dealValue"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Deal Value *</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="25000" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="dealStage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Opportunity Stage</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select stage" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="prospecting">Prospecting</SelectItem>
                                  <SelectItem value="qualification">Qualification</SelectItem>
                                  <SelectItem value="needs_analysis">Needs Analysis</SelectItem>
                                  <SelectItem value="proposal">Proposal</SelectItem>
                                  <SelectItem value="negotiation">Negotiation</SelectItem>
                                  <SelectItem value="closed_won">Closed Won</SelectItem>
                                  <SelectItem value="closed_lost">Closed Lost</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="probability"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Probability (%)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="75"
                                  {...field}
                                />
                              </FormControl>
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
                          name="leadSource"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Lead Source</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select source" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="website">Website</SelectItem>
                                  <SelectItem value="referral">Referral</SelectItem>
                                  <SelectItem value="cold_call">Cold Call</SelectItem>
                                  <SelectItem value="trade_show">Trade Show</SelectItem>
                                  <SelectItem value="email">Email Campaign</SelectItem>
                                  <SelectItem value="social_media">Social Media</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="assignedTo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Assigned To</FormLabel>
                              <FormControl>
                                <Input placeholder="Sales rep ID or name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="productInterest"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product Interest</FormLabel>
                              <FormControl>
                                <Input placeholder="Canon imageRUNNER, HP LaserJet" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="competitorInfo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Competitor Info</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Currently using Xerox, considering HP"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="decisionMaker"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Decision Maker</FormLabel>
                              <FormControl>
                                <Input placeholder="John Smith, IT Director" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="forecastCategory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Forecast Category</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="pipeline">Pipeline</SelectItem>
                                  <SelectItem value="best_case">Best Case</SelectItem>
                                  <SelectItem value="commit">Commit</SelectItem>
                                  <SelectItem value="omitted">Omitted</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* BANT Qualification Section */}
                        <div className="sm:col-span-2 space-y-4">
                          <h4 className="text-sm font-medium text-gray-900 border-b pb-2">
                            BANT Qualification
                          </h4>

                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="budgetConfirmed"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel>Budget Confirmed</FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="authorityConfirmed"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel>Authority Confirmed</FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="needConfirmed"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel>Need Confirmed</FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="timelineConfirmed"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel>Timeline Confirmed</FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Sales Process Tracking */}
                        <div className="sm:col-span-2 space-y-4">
                          <h4 className="text-sm font-medium text-gray-900 border-b pb-2">
                            Sales Process Tracking
                          </h4>

                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="proposalSent"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel>Proposal Sent</FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="contractSent"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel>Contract Sent</FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        <FormField
                          control={form.control}
                          name="tags"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>Tags</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="enterprise, urgent, q1-target (comma-separated)"
                                  {...field}
                                />
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
                                <Textarea placeholder="Opportunity description..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="sticky bottom-0 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 mt-6 p-4 sm:p-6 bg-gray-50 border-t flex flex-col sm:flex-row sm:justify-end gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateDialogOpen(false)}
                          className="order-2 sm:order-1 h-11 text-base touch-manipulation active:scale-95 transition-transform"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createDealMutation.isPending}
                          className="order-1 sm:order-2 h-11 text-base touch-manipulation active:scale-95 transition-transform"
                        >
                          {createDealMutation.isPending ? 'Creating...' : 'Create Opportunity'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Mobile-Optimized Filters Panel */}
          {showFilters && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Filters</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilters({
                        owner: '',
                        source: 'all',
                        dealType: 'all',
                        priority: 'all',
                        amountMin: '',
                        amountMax: '',
                        closeDateFrom: '',
                        closeDateTo: '',
                      });
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 h-auto p-0 touch-manipulation"
                  >
                    Clear all
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* Owner Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Owner</label>
                    <Input
                      placeholder="Filter by owner..."
                      value={filters.owner}
                      onChange={(e) => setFilters((prev) => ({ ...prev, owner: e.target.value }))}
                      className="h-11 touch-manipulation"
                    />
                  </div>

                  {/* Source Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Source</label>
                    <Select
                      value={filters.source}
                      onValueChange={(value) => setFilters((prev) => ({ ...prev, source: value }))}
                    >
                      <SelectTrigger className="h-11 touch-manipulation">
                        <SelectValue placeholder="All sources" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All sources</SelectItem>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="referral">Referral</SelectItem>
                        <SelectItem value="cold_call">Cold Call</SelectItem>
                        <SelectItem value="email">Email Campaign</SelectItem>
                        <SelectItem value="trade_show">Trade Show</SelectItem>
                        <SelectItem value="social_media">Social Media</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Priority</label>
                    <Select
                      value={filters.priority}
                      onValueChange={(value) =>
                        setFilters((prev) => ({ ...prev, priority: value }))
                      }
                    >
                      <SelectTrigger className="h-11 touch-manipulation">
                        <SelectValue placeholder="All priorities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All priorities</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Deal Type Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Deal Type</label>
                    <Select
                      value={filters.dealType}
                      onValueChange={(value) =>
                        setFilters((prev) => ({ ...prev, dealType: value }))
                      }
                    >
                      <SelectTrigger className="h-11 touch-manipulation">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="new_business">New Business</SelectItem>
                        <SelectItem value="renewal">Renewal</SelectItem>
                        <SelectItem value="upsell">Upsell</SelectItem>
                        <SelectItem value="cross_sell">Cross-sell</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Amount Range */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Min Amount</label>
                    <Input
                      type="number"
                      placeholder="$0"
                      value={filters.amountMin}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, amountMin: e.target.value }))
                      }
                      className="h-11 touch-manipulation"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Max Amount</label>
                    <Input
                      type="number"
                      placeholder="$999,999"
                      value={filters.amountMax}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, amountMax: e.target.value }))
                      }
                      className="h-11 touch-manipulation"
                    />
                  </div>

                  {/* Close Date Range */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Close From</label>
                    <Input
                      type="date"
                      value={filters.closeDateFrom}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, closeDateFrom: e.target.value }))
                      }
                      className="h-11 touch-manipulation"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Close To</label>
                    <Input
                      type="date"
                      value={filters.closeDateTo}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, closeDateTo: e.target.value }))
                      }
                      className="h-11 touch-manipulation"
                    />
                  </div>
                </div>

                {/* Active Filters Summary */}
                {(filters.owner ||
                  filters.source !== 'all' ||
                  filters.priority !== 'all' ||
                  filters.dealType !== 'all' ||
                  filters.amountMin ||
                  filters.amountMax ||
                  filters.closeDateFrom ||
                  filters.closeDateTo) && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <div className="flex flex-wrap gap-2">
                      {filters.owner && (
                        <Badge variant="secondary" className="gap-2 pr-1">
                          Owner: {filters.owner}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilters((prev) => ({ ...prev, owner: '' }))}
                            className="h-4 w-4 p-0 hover:bg-transparent"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      )}
                      {filters.source !== 'all' && (
                        <Badge variant="secondary" className="gap-2 pr-1">
                          Source: {filters.source}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilters((prev) => ({ ...prev, source: 'all' }))}
                            className="h-4 w-4 p-0 hover:bg-transparent"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      )}
                      {filters.priority !== 'all' && (
                        <Badge variant="secondary" className="gap-2 pr-1">
                          Priority: {filters.priority}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilters((prev) => ({ ...prev, priority: 'all' }))}
                            className="h-4 w-4 p-0 hover:bg-transparent"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      )}
                      {filters.dealType !== 'all' && (
                        <Badge variant="secondary" className="gap-2 pr-1">
                          Type: {filters.dealType}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilters((prev) => ({ ...prev, dealType: 'all' }))}
                            className="h-4 w-4 p-0 hover:bg-transparent"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      )}
                      {(filters.amountMin || filters.amountMax) && (
                        <Badge variant="secondary" className="gap-2 pr-1">
                          Amount: ${filters.amountMin || '0'} - ${filters.amountMax || '∞'}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setFilters((prev) => ({ ...prev, amountMin: '', amountMax: '' }))
                            }
                            className="h-4 w-4 p-0 hover:bg-transparent"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      )}
                      {(filters.closeDateFrom || filters.closeDateTo) && (
                        <Badge variant="secondary" className="gap-2 pr-1">
                          Close Date: {filters.closeDateFrom || 'any'} to{' '}
                          {filters.closeDateTo || 'any'}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                closeDateFrom: '',
                                closeDateTo: '',
                              }))
                            }
                            className="h-4 w-4 p-0 hover:bg-transparent"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'kanban' ? (
            /* Kanban View */
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {/* Mobile Vertical Layout */}
              <div className="block md:hidden h-full overflow-y-auto">
                <div className="space-y-4 p-4 sm:p-6">
                  {stages.map((stage) => (
                    <div
                      key={stage.id}
                      ref={(el) => (stageRefs.current[stage.id] = el)}
                      className="w-full"
                    >
                      <div className="bg-white border-2 rounded-lg shadow-sm">
                        {/* Mobile Stage Header */}
                        <div className="p-4 sm:p-5 border-b bg-gray-50 rounded-t-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-4 h-4 rounded-full flex-shrink-0"
                                style={{ backgroundColor: stage.color }}
                              />
                              <div>
                                <h3 className="font-semibold text-gray-900 text-base">
                                  {stage.name}
                                </h3>
                                <div className="text-sm text-gray-600">
                                  {stageAggregates[stage.id]?.count || 0} deals •{' '}
                                  {formatAmount(stageAggregates[stage.id]?.totalAmount || 0)}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-10 w-10 p-0 touch-manipulation active:scale-95 transition-transform"
                              style={{ minWidth: '44px', minHeight: '44px' }}
                              onClick={() =>
                                setCollapsedStages((prev) => ({
                                  ...prev,
                                  [stage.id]: !prev[stage.id],
                                }))
                              }
                            >
                              {collapsedStages[stage.id] ? '▶' : '▾'}
                            </Button>
                          </div>
                        </div>

                        {/* Mobile Deals List */}
                        {!collapsedStages[stage.id] && (
                          <SortableContext
                            items={(dealsByStage[stage.id] || []).map((deal) => deal.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <DroppableStageArea stageId={stage.id}>
                              <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                                {(dealsByStage[stage.id] || []).length === 0 ? (
                                  <div className="text-center py-12 text-gray-500">
                                    <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                      <DollarSign className="h-6 w-6 text-gray-400" />
                                    </div>
                                    <p className="text-sm">No deals in this stage</p>
                                  </div>
                                ) : (
                                  (dealsByStage[stage.id] || []).map((deal) => (
                                    <MobileDealCard
                                      key={deal.id}
                                      deal={deal}
                                      stageColor={stage.color}
                                      onDelete={(id) => deleteDealMutation.mutate(id)}
                                    />
                                  ))
                                )}
                              </div>
                            </DroppableStageArea>
                          </SortableContext>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop Horizontal Layout */}
              <div className="hidden md:block h-full">
                <div
                  ref={boardRef}
                  className="grid gap-4 h-full pb-4"
                  style={{
                    gridTemplateColumns: `repeat(${stages.length || 1}, minmax(220px, 1fr))`,
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
                                className="h-6 px-1 hover:bg-gray-200 active:scale-95 transition-transform"
                                onClick={() =>
                                  setCollapsedStages((prev) => ({
                                    ...prev,
                                    [stage.id]: !prev[stage.id],
                                  }))
                                }
                                title={collapsedStages[stage.id] ? 'Expand' : 'Collapse'}
                              >
                                {collapsedStages[stage.id] ? '▶' : '▾'}
                              </Button>
                            </div>
                          </div>
                          <div className="mt-1 text-[12px] font-semibold text-gray-700">
                            {formatAmount(stageAggregates[stage.id]?.totalAmount || 0)}
                          </div>
                        </div>

                        <SortableContext
                          items={(dealsByStage[stage.id] || []).map((deal) => deal.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <DroppableStageArea stageId={stage.id}>
                            {!collapsedStages[stage.id] && (
                              <div className="flex-1 p-2 sm:p-3 space-y-2 overflow-y-auto min-h-0">
                                {(dealsByStage[stage.id] || []).map((deal) => (
                                  <DraggableDealCard
                                    key={deal.id}
                                    deal={deal}
                                    onDelete={(id) => deleteDealMutation.mutate(id)}
                                  />
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
              </div>

              <DragOverlay>
                {activeDeal && (
                  <div className="bg-white border-2 border-blue-200 rounded-lg shadow-xl transform rotate-2 scale-105 touch-manipulation">
                    {/* Mobile optimized drag overlay */}
                    <div className="p-4 md:p-3">
                      <h4 className="font-semibold text-base md:text-sm text-gray-900 mb-2">
                        {activeDeal.title}
                      </h4>
                      {activeDeal.amount && (
                        <div className="text-xl md:text-lg font-bold text-green-600 mb-2">
                          ${parseFloat(activeDeal.amount.toString()).toLocaleString()}
                        </div>
                      )}
                      {activeDeal.companyName && (
                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                          <Building2 className="h-4 w-4" />
                          <span className="truncate">{activeDeal.companyName}</span>
                        </div>
                      )}
                    </div>
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
                        {visibleColumns.includes('name') && (
                          <TableHead className="sticky left-0 bg-white z-10">Deal Name</TableHead>
                        )}
                        {visibleColumns.includes('stage') && <TableHead>Stage</TableHead>}
                        {visibleColumns.includes('amount') && <TableHead>Amount</TableHead>}
                        {visibleColumns.includes('probability') && (
                          <TableHead>Probability</TableHead>
                        )}
                        {visibleColumns.includes('company') && <TableHead>Company</TableHead>}
                        {visibleColumns.includes('owner') && <TableHead>Owner</TableHead>}
                        {visibleColumns.includes('close') && <TableHead>Expected Close</TableHead>}
                        {visibleColumns.includes('source') && <TableHead>Source</TableHead>}
                        {visibleColumns.includes('priority') && <TableHead>Priority</TableHead>}
                        {visibleColumns.includes('created') && <TableHead>Created</TableHead>}
                        {visibleColumns.includes('actions') && (
                          <TableHead className="sticky right-0 bg-white z-10">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDeals.map((deal) => (
                        <TableRow key={deal.id}>
                          {visibleColumns.includes('name') && (
                            <TableCell className="font-medium sticky left-0 bg-white z-10">
                              {deal.title}
                            </TableCell>
                          )}
                          {visibleColumns.includes('stage') && (
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
                          {visibleColumns.includes('amount') && (
                            <TableCell>
                              {deal.amount
                                ? `$${parseFloat(deal.amount.toString()).toLocaleString()}`
                                : '-'}
                            </TableCell>
                          )}
                          {visibleColumns.includes('probability') && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    deal.probability >= 80
                                      ? 'default'
                                      : deal.probability >= 60
                                        ? 'secondary'
                                        : deal.probability >= 40
                                          ? 'outline'
                                          : 'destructive'
                                  }
                                >
                                  {deal.probability}%
                                </Badge>
                              </div>
                            </TableCell>
                          )}
                          {visibleColumns.includes('company') && (
                            <TableCell>{deal.companyName || '-'}</TableCell>
                          )}
                          {visibleColumns.includes('owner') && (
                            <TableCell>
                              <span className="text-sm">{deal.ownerName || 'Unassigned'}</span>
                            </TableCell>
                          )}
                          {visibleColumns.includes('close') && (
                            <TableCell>
                              {editingCloseDate === deal.id ? (
                                <Input
                                  type="date"
                                  defaultValue={
                                    deal.expectedCloseDate
                                      ? deal.expectedCloseDate.split('T')[0]
                                      : ''
                                  }
                                  className="w-36 h-8 text-sm"
                                  autoFocus
                                  onBlur={(e) => {
                                    const newDate = e.target.value;
                                    if (
                                      newDate &&
                                      newDate !== deal.expectedCloseDate?.split('T')[0]
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
                                    if (e.key === 'Enter') {
                                      const newDate = (e.target as HTMLInputElement).value;
                                      if (
                                        newDate &&
                                        newDate !== deal.expectedCloseDate?.split('T')[0]
                                      ) {
                                        updateDealCloseDateMutation.mutate({
                                          dealId: deal.id,
                                          expectedCloseDate: newDate,
                                        });
                                      } else {
                                        setEditingCloseDate(null);
                                      }
                                    } else if (e.key === 'Escape') {
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
                                    ? format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')
                                    : 'Set date'}
                                </span>
                              )}
                            </TableCell>
                          )}
                          {visibleColumns.includes('source') && (
                            <TableCell>
                              <span className="text-sm capitalize">{deal.source || '-'}</span>
                            </TableCell>
                          )}
                          {visibleColumns.includes('priority') && (
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  deal.priority === 'high' && 'bg-red-100 text-red-800',
                                  deal.priority === 'medium' && 'bg-yellow-100 text-yellow-800',
                                  deal.priority === 'low' && 'bg-green-100 text-green-800',
                                )}
                              >
                                {deal.priority}
                              </Badge>
                            </TableCell>
                          )}
                          {visibleColumns.includes('created') && (
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {relativeDate(deal.createdAt)}
                              </span>
                            </TableCell>
                          )}
                          {visibleColumns.includes('actions') && (
                            <TableCell className="sticky right-0 bg-white z-10">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>Edit Deal</DropdownMenuItem>
                                  <DropdownMenuItem>View Details</DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `Delete deal "${deal.title}"? This cannot be undone.`,
                                        )
                                      ) {
                                        deleteDealMutation.mutate(deal.id);
                                      }
                                    }}
                                  >
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

                {/* Mobile-Optimized Card View */}
                <div className="lg:hidden h-full overflow-y-auto">
                  <div className="p-4 space-y-4">
                    {filteredDeals.length > 0 ? (
                      filteredDeals.map((deal) => (
                        <Card
                          key={deal.id}
                          className="border-2 border-gray-200 hover:border-blue-300 transition-colors touch-manipulation active:scale-[0.98]"
                        >
                          <CardContent className="p-4 space-y-4">
                            {/* Header Section */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 text-base mb-2 line-clamp-2">
                                  {deal.title}
                                </h3>
                                {deal.companyName && (
                                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                                    <Building2 className="h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">{deal.companyName}</span>
                                  </div>
                                )}
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-11 w-11 p-0 touch-manipulation"
                                    style={{ minWidth: '44px', minHeight: '44px' }}
                                  >
                                    <MoreHorizontal className="h-5 w-5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem className="py-3">
                                    <span className="text-base">Edit Deal</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="py-3">
                                    <span className="text-base">View Details</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600 py-3"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `Delete deal "${deal.title}"? This cannot be undone.`,
                                        )
                                      ) {
                                        deleteDealMutation.mutate(deal.id);
                                      }
                                    }}
                                  >
                                    <span className="text-base">Delete</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {/* Amount Display */}
                            {deal.amount && (
                              <div className="py-3 px-4 bg-green-50 rounded-lg border border-green-200">
                                <div className="text-sm text-gray-600 mb-1">Deal Value</div>
                                <div className="text-2xl font-bold text-green-600">
                                  ${parseFloat(deal.amount.toString()).toLocaleString()}
                                </div>
                              </div>
                            )}

                            {/* Stage Selector */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">Stage</label>
                              <Select
                                value={deal.stageId}
                                onValueChange={(stageId) => {
                                  updateDealStageMutation.mutate({
                                    dealId: deal.id,
                                    stageId,
                                  });
                                }}
                              >
                                <SelectTrigger className="w-full h-11 touch-manipulation">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {stages.map((stage) => (
                                    <SelectItem key={stage.id} value={stage.id} className="py-3">
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="w-3 h-3 rounded-full"
                                          style={{ backgroundColor: stage.color }}
                                        />
                                        <span className="text-base">{stage.name}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Key Metrics Grid */}
                            <div className="grid grid-cols-2 gap-4 pt-2">
                              <div className="space-y-1">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">
                                  Probability
                                </div>
                                <Badge
                                  variant={
                                    deal.probability >= 80
                                      ? 'default'
                                      : deal.probability >= 60
                                        ? 'secondary'
                                        : deal.probability >= 40
                                          ? 'outline'
                                          : 'destructive'
                                  }
                                  className="text-sm px-3 py-1"
                                >
                                  {deal.probability}%
                                </Badge>
                              </div>

                              <div className="space-y-1">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">
                                  Priority
                                </div>
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'text-sm px-3 py-1',
                                    deal.priority === 'high' && 'bg-red-100 text-red-800',
                                    deal.priority === 'medium' && 'bg-yellow-100 text-yellow-800',
                                    deal.priority === 'low' && 'bg-green-100 text-green-800',
                                    deal.priority === 'urgent' && 'bg-red-200 text-red-900',
                                  )}
                                >
                                  {deal.priority}
                                </Badge>
                              </div>
                            </div>

                            {/* Additional Info */}
                            <div className="pt-3 border-t border-gray-200 space-y-3">
                              {deal.ownerName && (
                                <div className="flex items-center gap-3 text-sm">
                                  <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  <span className="text-gray-600">Owner:</span>
                                  <span className="font-medium text-gray-900 truncate">
                                    {deal.ownerName}
                                  </span>
                                </div>
                              )}

                              {deal.expectedCloseDate && (
                                <div className="flex items-center gap-3 text-sm">
                                  <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  <span className="text-gray-600">Close Date:</span>
                                  <span className="font-medium text-gray-900">
                                    {format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')}
                                  </span>
                                </div>
                              )}

                              {deal.source && (
                                <div className="flex items-center gap-3 text-sm">
                                  <TrendingUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  <span className="text-gray-600">Source:</span>
                                  <span className="font-medium text-gray-900 capitalize truncate">
                                    {deal.source.replace(/_/g, ' ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-16">
                        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <DollarSign className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-base">No deals found.</p>
                        <p className="text-gray-400 text-sm mt-2">
                          Try adjusting your filters or create a new deal.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Mobile FAB for Creating Deals */}
        <div className="md:hidden">
          <MobileFAB
            onClick={() => setIsCreateDialogOpen(true)}
            icon={Plus}
            label="New Deal"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
          />
        </div>
      </div>
    </MainLayout>
  );
}
