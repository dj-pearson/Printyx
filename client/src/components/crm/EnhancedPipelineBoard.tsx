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
import { useLocation } from 'wouter';
import {
  getCrmObjectConfig,
  type CrmFieldDef,
  type CrmObjectType,
} from '@/lib/crm-object-registry';
import { BOARD_PAGE_SIZE, boardTruncation } from '@shared/board-truncation';
// COP-M04: what a card shows, and what a column totals, both persisted into
// saved_views.board_config. The helpers are pure so the rules are testable.
import {
  DEFAULT_COLUMN_TOTALS,
  columnTotal,
  formatCardValue,
  resolveCardFields,
  type BoardConfig,
} from '@/lib/crm-board-config';
import { BoardOptionsMenu } from '@/components/crm/BoardOptionsMenu';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
// COP-M04: the per-field icons went with the fixed card layout. A card whose
// rows are chosen at runtime cannot carry a hand-picked icon per row.
import { MoreHorizontal, Eye, AlertTriangle, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { useListKeyboardNav } from '@/hooks/useListKeyboardNav';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface EnhancedPipelineBoardProps {
  objectType: CrmObjectType;
  pipelineId?: string;
  search?: string;
  activeFilters?: Record<string, any>;
  /** COP-M04: the active saved view's board_config, or null for the defaults. */
  boardConfig?: BoardConfig | null;
  onBoardConfigChange?: (config: BoardConfig) => void;
  /** False when no saved view is active, so a change lasts the session only. */
  boardConfigPersists?: boolean;
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
  total,
  children,
}: {
  stage: PipelineStageData;
  records: DealRecord[];
  /** COP-M04: null when the chosen total cannot be answered from these rows. */
  total: { value: number; kind: 'currency' | 'count' } | null;
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
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: stage.color || '#6B7280' }}
          />
          <span className="text-sm font-medium truncate">{stage.displayName || stage.name}</span>
          <Badge variant="secondary" className="text-[10px] h-5 min-w-[20px] justify-center">
            {records.length}
          </Badge>
        </div>
        {total !== null && (
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {total.kind === 'currency' ? '$' : ''}
            {total.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        )}
      </div>

      {/* Column Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-320px)] min-h-[100px]">
        {children}
        {records.length === 0 && (
          // COP-I04: this used to read `records.length === 0 ? 'records' : 'deals'`
          // inside a block already guarded by that same condition, so the 'deals'
          // branch was unreachable. Say the thing plainly instead.
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Nothing in this stage
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Draggable Card ──────────────────────────────────────────────

function DealCard({
  record,
  cardFields,
  isDragOverlay,
  onViewDetail,
}: {
  record: DealRecord;
  /** COP-M04: the configured fields, in card order. */
  cardFields: CrmFieldDef[];
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

  return (
    <Card
      ref={setNodeRef}
      style={style}
      // COP-I02: cards join the j/k roving-focus list and open on Enter.
      // Drag remains pointer-only; this is the keyboard path to the same action.
      {...(!isDragOverlay ? { 'data-list-row': true, tabIndex: 0 } : {})}
      onClick={() => !isDragOverlay && onViewDetail?.(record)}
      className={cn(
        'p-3 cursor-grab active:cursor-grabbing transition-shadow',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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

        {/* COP-M04: the configured fields. The card used to hold a fixed five -
            value, contact, company, close date, priority - so none of the ten
            copier fields could appear on it, and a rep working lease rollovers
            could not see buyout exposure without opening every deal. A field the
            record has no value for renders NO ROW, rather than a label with a
            blank beside it. */}
        {cardFields.map((field) => {
          if (field.field === 'title') return null;
          const value = formatCardValue(record, field);
          if (value === null) return null;
          if (field.type === 'badge') {
            return (
              <Badge
                key={field.field}
                variant="outline"
                className={cn(
                  'text-[10px] h-4 mr-1',
                  value === 'Urgent' && 'border-red-300 text-red-700 bg-red-50',
                  value === 'High' && 'border-orange-300 text-orange-700 bg-orange-50',
                )}
              >
                {value}
              </Badge>
            );
          }
          return (
            <div
              key={field.field}
              className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
            >
              <span className="truncate">{field.label}</span>
              <span
                className={cn(
                  'truncate text-right',
                  field.type === 'currency' || field.type === 'number'
                    ? 'tabular-nums font-medium text-foreground'
                    : '',
                )}
              >
                {value}
              </span>
            </div>
          );
        })}
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
  boardConfig,
  onBoardConfigChange,
  boardConfigPersists,
}: EnhancedPipelineBoardProps) {
  const config = getCrmObjectConfig(objectType);
  const [, setLocation] = useLocation();
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
    queryKey: ['/api/pipeline-config/stages', pipelineId, objectType],
    queryFn: async () => {
      // CRMX-005: deals board reads the canonical (auto-seeded) pipeline. Stage `id`
      // is the legacy deal_stages.id, so existing deals group correctly and moves
      // persist. If it yields no stages, fall through to the legacy/hardcoded path.
      if (objectType === 'deals') {
        const board = await apiRequest('/api/pipeline-config/board');
        const boardStages = Array.isArray(board?.stages) ? board.stages : [];
        if (boardStages.length > 0) return boardStages;
      }
      if (pipelineId) {
        const result = await apiRequest(`/api/pipeline-config/stages/${pipelineId}`);
        return Array.isArray(result) ? result : (result?.stages ?? []);
      }
      // Fallback: use templates list and get first default
      const templates = await apiRequest('/api/pipeline-config/templates');
      const defaultTemplate = templates?.find?.((t: any) => t.isDefault) ?? templates?.[0];
      if (defaultTemplate) {
        const result = await apiRequest(`/api/pipeline-config/stages/${defaultTemplate.id}`);
        return Array.isArray(result) ? result : (result?.stages ?? []);
      }
      // Ultimate fallback: hardcoded stages for deals
      return [
        {
          id: 'prospecting',
          name: 'prospecting',
          displayName: 'Prospecting',
          color: '#3B82F6',
          order: 1,
        },
        {
          id: 'qualification',
          name: 'qualification',
          displayName: 'Qualification',
          color: '#8B5CF6',
          order: 2,
        },
        { id: 'proposal', name: 'proposal', displayName: 'Proposal', color: '#F59E0B', order: 3 },
        {
          id: 'negotiation',
          name: 'negotiation',
          displayName: 'Negotiation',
          color: '#EF4444',
          order: 4,
        },
        {
          id: 'closed_won',
          name: 'closed_won',
          displayName: 'Closed Won',
          color: '#10B981',
          order: 5,
          isClosedWon: true,
        },
        {
          id: 'closed_lost',
          name: 'closed_lost',
          displayName: 'Closed Lost',
          color: '#6B7280',
          order: 6,
          isClosedLost: true,
        },
      ];
    },
    enabled: isAuthenticated,
    staleTime: 300_000,
  });

  const stages = useMemo(() => (stagesData ?? []).sort((a, b) => a.order - b.order), [stagesData]);

  // Fetch records
  const {
    data: board,
    isLoading: recordsLoading,
    isError: recordsError,
    error: recordsErrorObj,
    refetch: refetchRecords,
  } = useQuery<{ records: DealRecord[]; total: number | null }>({
    queryKey: [config.apiEndpoint, 'board', { search, ...activeFilters }],
    queryFn: async () => {
      // COP-I01: this asked for 500. Every CRM list endpoint caps at
      // MAX_CRM_PAGE_SIZE (200), so the board got 200 rows and believed it had
      // everything - a tenant with 250 deals was missing 50 from the board with
      // nothing on screen saying so. Ask for what the server will give.
      const params = new URLSearchParams({ limit: String(BOARD_PAGE_SIZE) });
      if (search) params.set('search', search);
      if (config.recordType) params.set('recordType', config.recordType);
      for (const [key, value] of Object.entries(activeFilters)) {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      }
      const result = await apiRequest(`${config.apiEndpoint}?${params}`);
      if (Array.isArray(result)) {
        // A bare array carries no count, so nothing can be said about what is
        // missing. null, not a guess.
        return { records: result, total: null };
      }
      const rows = result?.records ?? result?.data ?? [];
      const total = typeof result?.total === 'number' ? result.total : null;
      return { records: rows, total };
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  // useMemo, not a bare `?? []`: a fresh array literal every render changes the
  // identity of every downstream useMemo's dependency, so the stage grouping
  // and the column totals would recompute on each keystroke in the search box.
  const records = useMemo(() => board?.records ?? [], [board]);
  const truncation = boardTruncation(
    records.length,
    board?.total,
    config.labelPlural?.toLowerCase() ?? 'records',
  );

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

  // COP-M04: the stage header total, in whichever mode the board is configured
  // for. It used to be a hardcoded sum with `r.value || r.amount || ...`, which
  // reads a legitimate 0 as absent, and it rendered nothing when the sum was 0 -
  // so a stage of genuinely zero-value deals and a stage the total could not be
  // computed for looked identical. columnTotal answers null for the second.
  const totalsMode = boardConfig?.columnTotals ?? DEFAULT_COLUMN_TOTALS;
  const stageTotals = useMemo(() => {
    const totals: Record<string, { value: number; kind: 'currency' | 'count' } | null> = {};
    for (const stage of stages) {
      totals[stage.id] = columnTotal(stageGroups[stage.id] ?? [], totalsMode);
    }
    return totals;
  }, [stages, stageGroups, totalsMode]);

  // COP-M04: the fields each card carries, from the same registry the table
  // columns come from - so the ten copier fields reach the board too.
  const cardFields = useMemo(
    () => resolveCardFields(config.fields, boardConfig, objectType),
    [config.fields, boardConfig, objectType],
  );

  // Stage change mutation (optimistic)
  const stageChangeMutation = useMutation({
    mutationFn: async ({
      recordId,
      newStageId,
    }: {
      recordId: string;
      newStageId: string;
      stageLabel: string;
    }) => {
      // Try different endpoints based on object type
      if (objectType === 'deals') {
        // CRMX-005: persistent stage move (writes deal.stage_id + history +
        // automation log). newStageId is the legacy deal_stages.id from the board.
        return apiRequest(`/api/pipeline-config/deals/${recordId}/move`, 'POST', {
          toStageId: newStageId,
        });
      }
      return apiRequest(`/api/business-records/${recordId}/status`, 'PATCH', {
        status: newStageId,
      });
    },
    onMutate: async ({ recordId, newStageId }) => {
      await queryClient.cancelQueries({ queryKey: [config.apiEndpoint, 'board'] });
      const previousData = queryClient.getQueryData([
        config.apiEndpoint,
        'board',
        { search, ...activeFilters },
      ]);
      queryClient.setQueryData(
        [config.apiEndpoint, 'board', { search, ...activeFilters }],
        (old: { records: DealRecord[]; total: number | null } | undefined) =>
          old && {
            ...old,
            records: old.records.map((r) =>
              r.id === recordId
                ? { ...r, stage: newStageId, stageId: newStageId, status: newStageId }
                : r,
            ),
          },
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
    onSuccess: (_data, { stageLabel }) => {
      toast({ title: 'Stage updated', description: `Moved to ${stageLabel}` });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [config.apiEndpoint] });
    },
  });

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const recordId = String(active.id);
      const newStageId = String(over.id);

      // Find current stage
      const record = records.find((r) => r.id === recordId);
      const currentStage = record?.stageId || record?.stage || record?.status;
      if (currentStage === newStageId) return;

      // The success toast used to fire HERE, before the mutation resolved, so a
      // failed move showed "Stage updated" and then "Failed to update stage" -
      // two contradictory toasts, with the optimistic one read as the outcome.
      stageChangeMutation.mutate({
        recordId,
        newStageId,
        stageLabel: stages.find((s) => s.id === newStageId)?.displayName ?? newStageId,
      });
    },
    // `toast` is gone from here: the success message belongs to the mutation's
    // onSuccess now, so this callback no longer raises one.
    [records, stages, stageChangeMutation],
  );

  // COP-I02: j/k + arrow navigation over the board cards.
  const boardNavRef = useListKeyboardNav<HTMLDivElement>();

  // The card's onClick and its "View Details" item both took an onViewDetail
  // prop that nothing ever passed, so clicking a card did nothing. The registry
  // already knows where a record of this type lives.
  const openDetail = useCallback(
    (record: DealRecord) => setLocation(`${config.detailPath}/${record.id}`),
    [setLocation, config.detailPath],
  );

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

  // COP-I04: a failed board fetch used to render as an empty board — every stage
  // column showing "nothing here", which reads as "you have no deals". Say what
  // actually happened.
  if (recordsError && records.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={AlertTriangle}
          type="error"
          title="Could not load the board"
          description={
            recordsErrorObj instanceof Error
              ? recordsErrorObj.message
              : 'The request failed. This is a loading problem, not an empty pipeline.'
          }
          action={{ label: 'Try again', onClick: () => refetchRecords(), icon: RefreshCw }}
        />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* COP-I01: the board is capped at the server's page size, and a board
          quietly showing a subset of the pipeline is worse than a slow one -
          the column badges and the column totals both describe only what
          loaded. Say it, with the real number and what to do about it. */}
      {truncation && (
        <div
          role="status"
          className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{truncation.message}</span>
        </div>
      )}

      {/* COP-M04: the board's own configuration. BoardOptionsMenu existed and
          was imported by nothing, so saved_views.board_config - present since
          migration 0003 and fully served by the saved-views edge function - had
          no writer at all. */}
      {onBoardConfigChange && (
        <div className="flex justify-end px-4 pt-3">
          <BoardOptionsMenu
            objectType={objectType}
            fields={config.fields}
            boardConfig={boardConfig}
            onBoardConfigChange={onBoardConfigChange}
            persists={Boolean(boardConfigPersists)}
          />
        </div>
      )}
      <div className="flex gap-3 p-4 overflow-x-auto h-full" ref={boardNavRef}>
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            records={stageGroups[stage.id] ?? []}
            total={stageTotals[stage.id] ?? null}
          >
            {(stageGroups[stage.id] ?? []).map((record) => (
              <DealCard
                key={record.id}
                record={record}
                cardFields={cardFields}
                onViewDetail={openDetail}
              />
            ))}
          </StageColumn>
        ))}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeRecord ? (
          <DealCard record={activeRecord} cardFields={cardFields} isDragOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
