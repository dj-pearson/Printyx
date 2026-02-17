/**
 * EnhancedPipelineBoard - Dynamic pipeline board with configurable stages.
 * Replaces hardcoded PipelineBoard with dynamic stages from pipeline configuration.
 * Part of CRM-003: Enhanced Kanban board with dynamic pipeline stages and column aggregates.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getCrmObjectConfig, type CrmObjectType } from '@/lib/crm-object-registry';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GripVertical, MoreHorizontal, Eye, User, Building2, DollarSign, Calendar, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface EnhancedPipelineBoardProps {
  objectType: CrmObjectType;
  pipelineId?: string;
  search?: string;
  activeFilters?: Record<string, any>;
}

interface PipelineStageData {
  id: string;
  name: string;
  displayName: string;
  color: string;
  order: number;
  isClosedWon?: boolean;
  isClosedLost?: boolean;
  isFinalStage?: boolean;
  defaultProbability?: number;
}

interface DealRecord {
  id: string;
  title?: string;
  companyName?: string;
  primaryContactName?: string;
  value?: number;
  amount?: number;
  probability?: number;
  expectedCloseDate?: string;
  assignedToName?: string;
  ownerName?: string;
  stage?: string;
  status?: string;
  stageId?: string;
  priority?: string;
  [key: string]: any;
}

// ─── Droppable Column ────────────────────────────────────────────

function StageColumn({
  stage,
  records,
  aggregates,
  children,
}: {
  stage: PipelineStageData;
  records: DealRecord[];
  aggregates: { count: number; totalValue: number };
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-w-[280px] max-w-[320px] bg-muted/30 rounded-lg border',
        isOver && 'ring-2 ring-primary/50 bg-primary/5',
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color || '#6B7280' }} />
          <span className="text-sm font-medium truncate">{stage.displayName || stage.name}</span>
          <Badge variant="secondary" className="text-[10px] h-5 min-w-[20px] justify-center">
            {aggregates.count}
          </Badge>
        </div>
        {aggregates.totalValue > 0 && (
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            ${aggregates.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        )}
      </div>

      {/* Column Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-320px)] min-h-[100px]">
        {children}
        {records.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            No {records.length === 0 ? 'records' : 'deals'} in this stage
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Draggable Card ──────────────────────────────────────────────

function DealCard({
  record,
  isDragOverlay,
  onViewDetail,
}: {
  record: DealRecord;
  isDragOverlay?: boolean;
  onViewDetail?: (record: DealRecord) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: record.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const displayName = record.title || record.companyName || 'Untitled';
  const contactName = record.primaryContactName || record.assignedToName || record.ownerName;
  const dealValue = record.value || record.amount || record.estimatedAmount;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'p-3 cursor-grab active:cursor-grabbing transition-shadow',
        isDragging && 'opacity-50',
        isDragOverlay && 'shadow-lg rotate-2 ring-2 ring-primary',
        !isDragging && 'hover:shadow-md',
      )}
      {...attributes}
      {...listeners}
    >
      <div className="space-y-2">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-tight line-clamp-2">{displayName}</span>
          {!isDragOverlay && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewDetail?.(record)}>
                  <Eye className="h-4 w-4 mr-2" /> View Details
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Deal value */}
        {dealValue != null && dealValue > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <DollarSign className="h-3 w-3 text-green-600" />
            <span className="font-medium tabular-nums">
              {typeof dealValue === 'number'
                ? dealValue.toLocaleString('en-US', { maximumFractionDigits: 0 })
                : dealValue}
            </span>
          </div>
        )}

        {/* Contact */}
        {contactName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="truncate">{contactName}</span>
          </div>
        )}

        {/* Company (if different from title) */}
        {record.companyName && record.companyName !== displayName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span className="truncate">{record.companyName}</span>
          </div>
        )}

        {/* Close date */}
        {record.expectedCloseDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{new Date(record.expectedCloseDate).toLocaleDateString()}</span>
          </div>
        )}

        {/* Priority badge */}
        {record.priority && (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] h-4',
              record.priority === 'urgent' && 'border-red-300 text-red-700 bg-red-50',
              record.priority === 'high' && 'border-orange-300 text-orange-700 bg-orange-50',
              record.priority === 'medium' && 'border-yellow-300 text-yellow-700 bg-yellow-50',
              record.priority === 'low' && 'border-gray-300 text-gray-600',
            )}
          >
            {record.priority}
          </Badge>
        )}
      </div>
    </Card>
  );
}

// ─── Main Board Component ────────────────────────────────────────

export function EnhancedPipelineBoard({
  objectType,
  pipelineId,
  search,
  activeFilters = {},
}: EnhancedPipelineBoardProps) {
  const config = getCrmObjectConfig(objectType);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sensors for drag and drop
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 10 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  // Fetch pipeline stages
  const { data: stagesData } = useQuery<PipelineStageData[]>({
    queryKey: ['/api/pipeline-config/stages', pipelineId],
    queryFn: async () => {
      if (pipelineId) {
        const result = await apiRequest(`/api/pipeline-config/stages/${pipelineId}`);
        return Array.isArray(result) ? result : result?.stages ?? [];
      }
      // Fallback: use templates list and get first default
      const templates = await apiRequest('/api/pipeline-config/templates');
      const defaultTemplate = templates?.find?.((t: any) => t.isDefault) ?? templates?.[0];
      if (defaultTemplate) {
        const result = await apiRequest(`/api/pipeline-config/stages/${defaultTemplate.id}`);
        return Array.isArray(result) ? result : result?.stages ?? [];
      }
      // Ultimate fallback: hardcoded stages for deals
      return [
        { id: 'prospecting', name: 'prospecting', displayName: 'Prospecting', color: '#3B82F6', order: 1 },
        { id: 'qualification', name: 'qualification', displayName: 'Qualification', color: '#8B5CF6', order: 2 },
        { id: 'proposal', name: 'proposal', displayName: 'Proposal', color: '#F59E0B', order: 3 },
        { id: 'negotiation', name: 'negotiation', displayName: 'Negotiation', color: '#EF4444', order: 4 },
        { id: 'closed_won', name: 'closed_won', displayName: 'Closed Won', color: '#10B981', order: 5, isClosedWon: true },
        { id: 'closed_lost', name: 'closed_lost', displayName: 'Closed Lost', color: '#6B7280', order: 6, isClosedLost: true },
      ];
    },
    enabled: isAuthenticated,
    staleTime: 300_000,
  });

  const stages = useMemo(
    () => (stagesData ?? []).sort((a, b) => a.order - b.order),
    [stagesData],
  );

  // Fetch records
  const { data: records = [], isLoading: recordsLoading } = useQuery<DealRecord[]>({
    queryKey: [config.apiEndpoint, 'board', { search, ...activeFilters }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '500' });
      if (search) params.set('search', search);
      if (config.recordType) params.set('recordType', config.recordType);
      for (const [key, value] of Object.entries(activeFilters)) {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      }
      const result = await apiRequest(`${config.apiEndpoint}?${params}`);
      return Array.isArray(result) ? result : result?.records ?? result?.data ?? [];
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  // Group records by stage
  const stageGroups = useMemo(() => {
    const groups: Record<string, DealRecord[]> = {};
    for (const stage of stages) {
      groups[stage.id] = [];
      groups[stage.name] = groups[stage.name] || [];
    }
    for (const record of records) {
      const stageKey = record.stageId || record.stage || record.status || record.activity;
      // Try exact match first, then name match
      if (stageKey && groups[stageKey]) {
        groups[stageKey].push(record);
      } else {
        // Put in first stage as default
        const firstStage = stages[0];
        if (firstStage) {
          groups[firstStage.id]?.push(record);
        }
      }
    }
    return groups;
  }, [records, stages]);

  // Compute aggregates per stage
  const stageAggregates = useMemo(() => {
    const aggs: Record<string, { count: number; totalValue: number }> = {};
    for (const stage of stages) {
      const stageRecords = stageGroups[stage.id] ?? [];
      aggs[stage.id] = {
        count: stageRecords.length,
        totalValue: stageRecords.reduce((sum, r) => sum + (r.value || r.amount || r.estimatedAmount || 0), 0),
      };
    }
    return aggs;
  }, [stages, stageGroups]);

  // Stage change mutation (optimistic)
  const stageChangeMutation = useMutation({
    mutationFn: async ({ recordId, newStageId }: { recordId: string; newStageId: string }) => {
      // Try different endpoints based on object type
      if (objectType === 'deals') {
        return apiRequest(`/api/deals-management/deals/${recordId}`, 'PUT', { stage: newStageId });
      }
      return apiRequest(`/api/business-records/${recordId}/status`, 'PATCH', { status: newStageId });
    },
    onMutate: async ({ recordId, newStageId }) => {
      await queryClient.cancelQueries({ queryKey: [config.apiEndpoint, 'board'] });
      const previousData = queryClient.getQueryData([config.apiEndpoint, 'board', { search, ...activeFilters }]);
      queryClient.setQueryData(
        [config.apiEndpoint, 'board', { search, ...activeFilters }],
        (old: DealRecord[] | undefined) =>
          old?.map((r) =>
            r.id === recordId ? { ...r, stage: newStageId, stageId: newStageId, status: newStageId } : r,
          ),
      );
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          [config.apiEndpoint, 'board', { search, ...activeFilters }],
          context.previousData,
        );
      }
      toast({ title: 'Failed to update stage', variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [config.apiEndpoint] });
    },
  });

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const recordId = String(active.id);
    const newStageId = String(over.id);

    // Find current stage
    const record = records.find((r) => r.id === recordId);
    const currentStage = record?.stageId || record?.stage || record?.status;
    if (currentStage === newStageId) return;

    stageChangeMutation.mutate({ recordId, newStageId });
    toast({
      title: 'Stage updated',
      description: `Moved to ${stages.find((s) => s.id === newStageId)?.displayName ?? newStageId}`,
    });
  }, [records, stages, stageChangeMutation, toast]);

  // Active dragging record
  const activeRecord = activeId ? records.find((r) => r.id === activeId) : null;

  if (recordsLoading && records.length === 0) {
    return (
      <div className="flex gap-4 p-4 overflow-x-auto">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="min-w-[280px] space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 p-4 overflow-x-auto h-full">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            records={stageGroups[stage.id] ?? []}
            aggregates={stageAggregates[stage.id] ?? { count: 0, totalValue: 0 }}
          >
            {(stageGroups[stage.id] ?? []).map((record) => (
              <DealCard key={record.id} record={record} />
            ))}
          </StageColumn>
        ))}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeRecord ? <DealCard record={activeRecord} isDragOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
