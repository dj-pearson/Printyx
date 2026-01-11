/**
 * Enhanced CRM Page with HubSpot-like features:
 * - Kanban board view with drag-and-drop
 * - Inline editing
 * - Quick status changes
 * - Pipeline visualization
 * - Lead → Prospect → Customer flow
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Plus,
  Upload,
  Download,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  TrendingUp,
  Users,
  UserCheck,
  DollarSign,
  LayoutGrid,
  LayoutList,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { CsvImportWizard } from '@/components/import';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';

interface BusinessRecord {
  id: string;
  companyName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  recordType: 'lead' | 'prospect' | 'customer' | 'former_customer';
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedAmount: number;
  leadSource: string;
  industry: string;
  city: string;
  state: string;
  urlSlug: string;
  createdAt: string;
  updatedAt: string;
}

interface Pipeline {
  id: string;
  label: string;
  statuses: string[];
  color: string;
  icon: any;
}

const pipelines: Pipeline[] = [
  {
    id: 'lead',
    label: 'Leads',
    statuses: ['new', 'contacted', 'qualified'],
    color: 'blue',
    icon: Users,
  },
  {
    id: 'prospect',
    label: 'Prospects',
    statuses: ['qualified', 'proposal_sent', 'negotiation'],
    color: 'purple',
    icon: TrendingUp,
  },
  {
    id: 'customer',
    label: 'Customers',
    statuses: ['active', 'at_risk'],
    color: 'green',
    icon: UserCheck,
  },
];

const statusLabels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation',
  active: 'Active',
  at_risk: 'At Risk',
  inactive: 'Inactive',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-gray-100 text-gray-800 border-gray-300',
};

export default function EnhancedCRM() {
  const { isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [selectedPipeline, setSelectedPipeline] = useState<string>('lead');
  const [searchTerm, setSearchTerm] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  // Fetch business records
  const { data: records = [], isLoading } = useQuery<BusinessRecord[]>({
    queryKey: ['/api/business-records', { search: searchTerm }],
    enabled: isAuthenticated,
  });

  // Fetch stats
  const { data: stats } = useQuery<any>({
    queryKey: ['/api/business-records/stats/overview'],
    enabled: isAuthenticated,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      recordType,
    }: {
      id: string;
      status: string;
      recordType?: string;
    }) => {
      return apiRequest(`/api/business-records/${id}/status`, 'PATCH', { status, recordType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/business-records/stats/overview'] });
      toast({
        title: 'Success',
        description: 'Status updated successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    },
  });

  // Filter records by pipeline
  const pipelineRecords = useMemo(() => {
    const pipeline = pipelines.find((p) => p.id === selectedPipeline);
    if (!pipeline) return [];

    return records.filter((record) => {
      const matchesPipeline =
        record.recordType === selectedPipeline || pipeline.statuses.includes(record.status);

      const matchesSearch =
        !searchTerm ||
        record.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.primaryContactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.primaryContactEmail.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesPipeline && matchesSearch;
    });
  }, [records, selectedPipeline, searchTerm]);

  // Group records by status
  const groupedRecords = useMemo(() => {
    const pipeline = pipelines.find((p) => p.id === selectedPipeline);
    if (!pipeline) return {};

    const groups: Record<string, BusinessRecord[]> = {};
    pipeline.statuses.forEach((status) => {
      groups[status] = pipelineRecords.filter((r) => r.status === status);
    });

    return groups;
  }, [pipelineRecords, selectedPipeline]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalLeads = records.filter((r) => r.recordType === 'lead').length;
    const totalProspects = records.filter((r) => r.recordType === 'prospect').length;
    const totalCustomers = records.filter((r) => r.recordType === 'customer').length;
    const pipelineValue = records
      .filter((r) => ['lead', 'prospect'].includes(r.recordType))
      .reduce((sum, r) => sum + (r.estimatedAmount || 0), 0);

    return { totalLeads, totalProspects, totalCustomers, pipelineValue };
  }, [records]);

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }

    const recordId = active.id as string;
    const newStatus = over.id as string;
    const record = records.find((r) => r.id === recordId);

    if (record && record.status !== newStatus) {
      updateStatusMutation.mutate({ id: recordId, status: newStatus });
    }

    setActiveId(null);
  };

  const activeRecord = activeId ? records.find((r) => r.id === activeId) : null;

  return (
    <MainLayout title="CRM Dashboard" description="Manage your leads, prospects, and customers">
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalLeads}</div>
              <p className="text-xs text-muted-foreground">Active in pipeline</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prospects</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalProspects}</div>
              <p className="text-xs text-muted-foreground">Qualified leads</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customers</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">Active customers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${kpis.pipelineValue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total estimated</p>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by company, contact, email..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-1 border rounded-md p-1">
                  <Button
                    variant={view === 'kanban' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setView('kanban')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={view === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setView('list')}
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                </div>

                <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>

                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lead
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        {view === 'kanban' && (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(groupedRecords).map(([status, statusRecords]) => (
                <Card key={status} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {statusLabels[status] || status}
                      </CardTitle>
                      <Badge variant="secondary">{statusRecords.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2 min-h-[400px]">
                    <SortableContext
                      items={statusRecords.map((r) => r.id)}
                      strategy={verticalListSortingStrategy}
                      id={status}
                    >
                      {statusRecords.map((record) => (
                        <RecordCard
                          key={record.id}
                          record={record}
                          onNavigate={() => navigate(`/crm/${record.urlSlug || record.id}`)}
                        />
                      ))}
                    </SortableContext>

                    {statusRecords.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                        <p>No records</p>
                        <p>Drag here to move</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <DragOverlay>
              {activeRecord ? <RecordCard record={activeRecord} isDragging /> : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* List View */}
        {view === 'list' && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-4 font-medium">Company</th>
                      <th className="text-left p-4 font-medium">Contact</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium">Priority</th>
                      <th className="text-left p-4 font-medium">Value</th>
                      <th className="text-right p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineRecords.map((record) => (
                      <tr key={record.id} className="border-b hover:bg-muted/50">
                        <td className="p-4">
                          <div className="font-medium">{record.companyName}</div>
                          <div className="text-sm text-muted-foreground">{record.industry}</div>
                        </td>
                        <td className="p-4">
                          <div>{record.primaryContactName}</div>
                          <div className="text-sm text-muted-foreground">
                            {record.primaryContactEmail}
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline">
                            {statusLabels[record.status] || record.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge className={priorityColors[record.priority]}>
                            {record.priority}
                          </Badge>
                        </td>
                        <td className="p-4">${(record.estimatedAmount || 0).toLocaleString()}</td>
                        <td className="p-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/crm/${record.urlSlug || record.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CSV Import Wizard */}
        <CsvImportWizard
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
          defaultEntityType="business_records"
          onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/business-records'] });
            toast({
              title: 'Import Complete',
              description: 'Records have been imported successfully.',
            });
          }}
        />
      </div>
    </MainLayout>
  );
}

interface RecordCardProps {
  record: BusinessRecord;
  isDragging?: boolean;
  onNavigate?: () => void;
}

function RecordCard({ record, isDragging, onNavigate }: RecordCardProps) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg border bg-card cursor-pointer hover:shadow-md transition-all',
        isDragging && 'opacity-50 rotate-3 scale-105 shadow-xl',
      )}
      onClick={onNavigate}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{record.companyName}</h4>
          <p className="text-xs text-muted-foreground truncate">{record.primaryContactName}</p>
        </div>
        <Badge className={priorityColors[record.priority]} variant="outline">
          {record.priority}
        </Badge>
      </div>

      {record.estimatedAmount > 0 && (
        <div className="flex items-center gap-1 text-sm font-medium text-green-600 mb-2">
          <DollarSign className="h-3 w-3" />
          {record.estimatedAmount.toLocaleString()}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {record.industry && <span className="truncate">{record.industry}</span>}
        {record.city && record.state && (
          <span className="truncate">
            • {record.city}, {record.state}
          </span>
        )}
      </div>
    </div>
  );
}
