/**
 * RecordPageLayout — the configurable record page (CRM-008).
 *
 * The three-column engine the story asks for: header with the record name, the
 * stage picker and quick actions; a left column of editable property groups; a
 * centre column for the activity timeline; a right sidebar of associated
 * records. Which sections exist, where they sit, what order they are in and
 * which fields they carry all come from `record_layout_configs`.
 *
 * WHAT THIS COMPONENT REFUSES TO DO:
 *
 *  - It does not invent content. A section is rendered from a SLOT the page
 *    supplies or from property fields of the record. A section that is neither
 *    is reported on the page, not dropped - the alternative is an admin
 *    configuring something and quietly getting less than they asked for.
 *  - It does not render a quick action with no handler. An engine that draws a
 *    "Log Activity" button the page has not wired is a button that does
 *    nothing, which is worse than no button (AUDIT-016's rule).
 *  - It does not block on its own config. A layout request that fails falls
 *    back to the shipped layout, because a record page with no layout has
 *    nothing to show and the record is the point.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import {
  mergeLayout,
  resolveLayout,
  type LayoutPropertyField,
  type LayoutSection,
  type RecordObjectType,
} from '@shared/record-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InlineEdit } from '@/components/ui/inline-edit';
import { cn, formatCurrency } from '@/lib/utils';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';

export interface RecordQuickAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface RecordPageLayoutProps {
  objectType: RecordObjectType;
  /** The record itself. Its keys are what property fields are checked against. */
  record: Record<string, unknown>;
  title: string;
  subtitle?: ReactNode;
  /** Status/stage chips shown beside the title. */
  badges?: ReactNode;
  /** Rendered under the title: the stage picker belongs here. */
  headerContent?: ReactNode;
  /** Only actions with a handler are drawn. */
  quickActions?: RecordQuickAction[];
  /** sectionId -> what to render for it. A section with no slot and no fields is reported. */
  slots?: Record<string, ReactNode>;
  /** Called when an editable property field is saved. Absent = nothing is editable. */
  onFieldSave?: (field: string, value: string) => void | Promise<void>;
}

const EMPTY = '—';

function displayValue(field: LayoutPropertyField, raw: unknown): string {
  if (raw == null || raw === '') return EMPTY;
  switch (field.type) {
    case 'currency':
      return formatCurrency(raw as string | number);
    case 'percent':
      return `${raw}%`;
    case 'date': {
      const d = new Date(String(raw));
      return Number.isNaN(d.getTime()) ? String(raw) : format(d, 'MMM d, yyyy');
    }
    default:
      return String(raw);
  }
}

function editorType(field: LayoutPropertyField): 'text' | 'number' | 'textarea' {
  if (field.type === 'number' || field.type === 'percent' || field.type === 'currency') {
    return 'number';
  }
  return field.type === 'textarea' ? 'textarea' : 'text';
}

function PropertyRow({
  field,
  record,
  onFieldSave,
}: {
  field: LayoutPropertyField;
  record: Record<string, unknown>;
  onFieldSave?: (field: string, value: string) => void | Promise<void>;
}) {
  const raw = record[field.field];
  const shown = displayValue(field, raw);
  // Editable only when the page can actually persist it. A pencil that leads
  // nowhere is the same defect as a dead button.
  const canEdit = Boolean(field.editable && onFieldSave);

  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-2 items-center py-1">
      <span className="text-xs text-muted-foreground truncate">{field.label}</span>
      {canEdit ? (
        <InlineEdit
          value={raw == null ? '' : String(raw)}
          type={editorType(field)}
          displayFormat={() => shown}
          onSave={(v) => onFieldSave!(field.field, v)}
          className="text-sm"
        />
      ) : (
        <span className="text-sm break-words">{shown}</span>
      )}
    </div>
  );
}

function SectionCard({ section, children }: { section: LayoutSection; children: ReactNode }) {
  const [open, setOpen] = useState(!section.collapsed);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <Card>
      <CardHeader className="py-3">
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <Chevron className="h-4 w-4 text-muted-foreground shrink-0" />
          <CardTitle className="text-sm font-medium">{section.title}</CardTitle>
        </button>
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

interface LayoutResponse {
  objectType: string;
  sections: LayoutSection[];
  isDefault: boolean;
}

export function RecordPageLayout({
  objectType,
  record,
  title,
  subtitle,
  badges,
  headerContent,
  quickActions = [],
  slots = {},
  onFieldSave,
}: RecordPageLayoutProps) {
  const key = `/api/record-layout-config?objectType=${objectType}`;
  const layoutQuery = useQuery<LayoutResponse>({
    queryKey: [key],
    queryFn: () => apiRequest(key),
    // The layout changes when an admin changes it, not while a rep works.
    staleTime: 5 * 60_000,
    retry: false,
  });

  const resolved = useMemo(() => {
    // A failed config request falls back to the shipped layout rather than
    // leaving the record page blank.
    const sections = layoutQuery.data?.sections ?? mergeLayout(null, objectType);
    const slotIds = Object.keys(slots);
    const renderable = new Set(slotIds);
    for (const s of sections) {
      if ((s.propertyFields ?? []).length > 0) renderable.add(s.sectionId);
    }
    return resolveLayout(sections, renderable, Object.keys(record ?? {}));
  }, [layoutQuery.data, objectType, slots, record]);

  const renderSection = (section: LayoutSection) => {
    const slot = slots[section.sectionId];
    if (slot !== undefined) return <div key={section.sectionId}>{slot}</div>;
    return (
      <SectionCard key={section.sectionId} section={section}>
        <div className="divide-y">
          {section.propertyFields.map((field) => (
            <PropertyRow
              key={field.field}
              field={field}
              record={record}
              onFieldSave={onFieldSave}
            />
          ))}
        </div>
      </SectionCard>
    );
  };

  const headerFields = resolved.positions.header.flatMap((s) => s.propertyFields);

  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-tight break-words">{title}</h1>
              {subtitle && <div className="text-sm text-muted-foreground mt-0.5">{subtitle}</div>}
            </div>
            {badges && <div className="flex items-center gap-2">{badges}</div>}
          </div>

          {headerFields.length > 0 && (
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
              {headerFields.map((field) => (
                <PropertyRow
                  key={field.field}
                  field={field}
                  record={record}
                  onFieldSave={onFieldSave}
                />
              ))}
            </div>
          )}

          {headerContent}

          {quickActions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  size="sm"
                  variant="outline"
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Three columns; DOM order is the mobile stack order (AC11) ── */}
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="space-y-4 lg:col-span-1">{resolved.positions.left.map(renderSection)}</div>
        <div className="space-y-4 lg:col-span-2">
          {resolved.positions.center.map(renderSection)}
        </div>
        <div className="space-y-4 lg:col-span-1">{resolved.positions.right.map(renderSection)}</div>
      </div>

      {/* A layout naming something this version cannot draw is SAID, because
          an admin who configured a section deserves to know it did not appear. */}
      {(resolved.unrenderable.length > 0 || resolved.unknownFields.length > 0) && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {resolved.unrenderable.length > 0 && (
              <>
                This layout names {resolved.unrenderable.length} section
                {resolved.unrenderable.length === 1 ? '' : 's'} this version cannot render (
                {resolved.unrenderable.join(', ')}).{' '}
              </>
            )}
            {resolved.unknownFields.length > 0 && (
              <>
                {resolved.unknownFields.length} configured field
                {resolved.unknownFields.length === 1 ? '' : 's'} are not on this record (
                {resolved.unknownFields.join(', ')}).
              </>
            )}
          </span>
        </p>
      )}
    </div>
  );
}

export interface RecordStage {
  id: string;
  name: string;
  displayName?: string | null;
  color?: string | null;
}

/**
 * The stage picker (AC8): a horizontal progress bar of every stage with the
 * current one highlighted. Clicking another stage asks first, because a stage
 * change fires the same automation the board drag does and is not a hover
 * away from being an accident.
 */
export function RecordStageBar({
  stages,
  currentStageId,
  onChange,
  disabled,
}: {
  stages: RecordStage[];
  currentStageId?: string | null;
  onChange: (stageId: string) => void;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState<RecordStage | null>(null);
  if (stages.length === 0) return null;

  const currentIndex = stages.findIndex((s) => s.id === currentStageId);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {stages.map((stage, i) => {
          const isCurrent = stage.id === currentStageId;
          const isPast = currentIndex >= 0 && i < currentIndex;
          return (
            <button
              key={stage.id}
              type="button"
              disabled={disabled || isCurrent}
              onClick={() => setPending(stage)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs transition-colors',
                isCurrent
                  ? 'bg-primary text-primary-foreground font-medium'
                  : isPast
                    ? 'bg-muted text-foreground'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted',
              )}
            >
              {stage.displayName || stage.name}
            </button>
          );
        })}
      </div>

      {pending && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
          <Badge variant="outline">{pending.displayName || pending.name}</Badge>
          <span className="text-xs text-muted-foreground">
            Move this record to this stage? Stage automation runs on the change.
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onChange(pending.id);
              setPending(null);
            }}
          >
            Move
          </Button>
        </div>
      )}
    </div>
  );
}
