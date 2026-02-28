/**
 * PipelineBoard - Kanban-style pipeline view for prospects.
 *
 * Drag-and-drop prospects between pipeline stages using @dnd-kit.
 * Each column represents a pipeline stage with a count badge.
 */

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  useDraggable,
} from '@dnd-kit/core';
import {
  GripVertical,
  MoreHorizontal,
  Eye,
  ArrowRightCircle,
  Trash2,
  Building2,
  MapPin,
  User,
  Clock,
} from 'lucide-react';

// ─── Pipeline Stage Config ──────────────────────────────────────────────────

export interface PipelineStage {
  id: string;
  label: string;
  color: string;
  bgColor: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'qualified',
    label: 'Qualified',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200',
  },
  {
    id: 'demo_scheduled',
    label: 'Demo Scheduled',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50 border-indigo-200',
  },
  {
    id: 'proposal_sent',
    label: 'Proposal Sent',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
  },
  {
    id: 'negotiation',
    label: 'Negotiation',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 border-purple-200',
  },
  {
    id: 'contract_review',
    label: 'Contract Review',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 border-orange-200',
  },
  {
    id: 'closed_won',
    label: 'Closed Won',
    color: 'text-green-700',
    bgColor: 'bg-green-50 border-green-200',
  },
  {
    id: 'closed_lost',
    label: 'Closed Lost',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
  },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProspectRecord {
  id: string;
  companyName?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  industry?: string;
  city?: string;
  state?: string;
  status?: string;
  activity?: string;
  [key: string]: any;
}

interface PipelineBoardProps {
  records: ProspectRecord[];
  onStageChange: (recordId: string, newStage: string) => void;
  onViewDetail: (record: ProspectRecord) => void;
  onConvertToCustomer: (record: ProspectRecord) => void;
  onDelete: (record: ProspectRecord) => void;
}

// ─── Droppable Column ───────────────────────────────────────────────────────

function PipelineColumn({
  stage,
  records,
  stalledCount,
  children,
}: {
  stage: PipelineStage;
  records: ProspectRecord[];
  stalledCount: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] w-[280px] lg:w-auto lg:flex-1 rounded-lg border transition-all ${
        isOver ? 'ring-2 ring-primary/50 bg-primary/5' : 'bg-muted/30'
      }`}
    >
      {/* Column Header */}
      <div
        className={`flex items-center justify-between p-3 rounded-t-lg border-b ${stage.bgColor}`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${stage.color}`}>{stage.label}</span>
          <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
            {records.length}
          </Badge>
          {stalledCount > 0 && (
            <Badge
              variant="outline"
              className="h-5 min-w-[20px] px-1.5 text-xs border-amber-300 bg-amber-50 text-amber-700"
            >
              <Clock className="h-3 w-3 mr-0.5" aria-hidden="true" />
              {stalledCount} stalled
            </Badge>
          )}
        </div>
      </div>

      {/* Column Body */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-380px)] min-h-[120px]">
        {children}
        {records.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Drop prospects here
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Draggable Prospect Card ────────────────────────────────────────────────

function ProspectCard({
  record,
  onViewDetail,
  onConvertToCustomer,
  onDelete,
  isDragOverlay,
}: {
  record: ProspectRecord;
  onViewDetail: (record: ProspectRecord) => void;
  onConvertToCustomer: (record: ProspectRecord) => void;
  onDelete: (record: ProspectRecord) => void;
  isDragOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: record.id,
    data: { record },
  });

  const style = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
      }
    : undefined;

  const location = [record.city, record.state].filter(Boolean).join(', ');

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`group transition-shadow ${
        isDragging ? 'opacity-30' : ''
      } ${isDragOverlay ? 'shadow-xl rotate-2 scale-105' : 'hover:shadow-md'}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          {/* Drag Handle */}
          <button
            {...listeners}
            {...attributes}
            className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            {/* Company Name */}
            <p className="font-semibold text-sm truncate">{record.companyName || 'Unnamed'}</p>

            {/* Contact */}
            {record.primaryContactName && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <User className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{record.primaryContactName}</span>
              </div>
            )}

            {/* Location */}
            {location && (
              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            )}

            {/* Industry Badge */}
            {record.industry && (
              <Badge variant="outline" className="mt-1.5 text-[10px] h-5">
                {record.industry}
              </Badge>
            )}

            {/* Stalled Badge - show when updatedAt is older than 7 days */}
            {(() => {
              const updatedAt = record.updatedAt || record.updated_at;
              if (!updatedAt) return null;
              const updatedDate = new Date(updatedAt);
              const now = new Date();
              const diffMs = now.getTime() - updatedDate.getTime();
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              if (diffDays <= 7) return null;
              return (
                <Badge
                  variant="outline"
                  className="mt-1.5 text-[10px] h-5 border-amber-300 bg-amber-50 text-amber-700"
                >
                  <Clock className="h-3 w-3 mr-1" aria-hidden="true" />
                  Stalled ({diffDays}d)
                </Badge>
              );
            })()}
          </div>

          {/* Actions */}
          {!isDragOverlay && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onViewDetail(record)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onConvertToCustomer(record)}>
                  <ArrowRightCircle className="h-4 w-4 mr-2" />
                  Convert to Customer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(record)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Pipeline Board ────────────────────────────────────────────────────

export function PipelineBoard({
  records,
  onStageChange,
  onViewDetail,
  onConvertToCustomer,
  onDelete,
}: PipelineBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sensors with touch support
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 10 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  // Group records by their status/activity into pipeline stages
  const stageGroups = useMemo(() => {
    const groups: Record<string, ProspectRecord[]> = {};
    for (const stage of PIPELINE_STAGES) {
      groups[stage.id] = [];
    }
    for (const record of records) {
      const stageKey = record.status || record.activity || 'qualified';
      if (groups[stageKey]) {
        groups[stageKey].push(record);
      } else {
        // Default to qualified if unknown stage
        groups['qualified'].push(record);
      }
    }
    return groups;
  }, [records]);

  // Count stalled deals per stage (updatedAt older than 7 days)
  const stalledCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    for (const stage of PIPELINE_STAGES) {
      const stageRecords = stageGroups[stage.id] || [];
      counts[stage.id] = stageRecords.filter((record) => {
        const updatedAt = record.updatedAt || record.updated_at;
        if (!updatedAt) return false;
        const updatedDate = new Date(updatedAt);
        return now.getTime() - updatedDate.getTime() > sevenDaysMs;
      }).length;
    }

    return counts;
  }, [stageGroups]);

  const activeRecord = useMemo(
    () => (activeId ? records.find((r) => r.id === activeId) : null),
    [activeId, records],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const recordId = active.id as string;
      const newStage = over.id as string;

      // Find current stage of the record
      const record = records.find((r) => r.id === recordId);
      const currentStage = record?.status || record?.activity || 'qualified';

      if (currentStage !== newStage) {
        onStageChange(recordId, newStage);
      }
    },
    [records, onStageChange],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
        {PIPELINE_STAGES.map((stage) => (
          <PipelineColumn
            key={stage.id}
            stage={stage}
            records={stageGroups[stage.id] || []}
            stalledCount={stalledCounts[stage.id] || 0}
          >
            {(stageGroups[stage.id] || []).map((record) => (
              <ProspectCard
                key={record.id}
                record={record}
                onViewDetail={onViewDetail}
                onConvertToCustomer={onConvertToCustomer}
                onDelete={onDelete}
              />
            ))}
          </PipelineColumn>
        ))}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeRecord ? (
          <ProspectCard
            record={activeRecord}
            onViewDetail={() => {}}
            onConvertToCustomer={() => {}}
            onDelete={() => {}}
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
