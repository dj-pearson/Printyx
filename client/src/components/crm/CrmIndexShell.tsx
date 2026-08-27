/**
 * CrmIndexShell - Unified CRM index page wrapper.
 * Provides consistent Table/Board view toggle, saved view tabs, search, and filters
 * for all CRM object types (deals, leads, contacts, companies).
 *
 * Part of CRM-002: Build unified CRM index shell.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutGrid,
  List,
  Search,
  Plus,
  ChevronDown,
  Pin,
  PinOff,
  Copy,
  Trash2,
  Share2,
  Star,
  MoreHorizontal,
  X,
  Save,
  Filter,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSavedViews, type SavedViewData } from '@/hooks/useSavedViews';
import { getCrmObjectConfig, type CrmObjectType } from '@/lib/crm-object-registry';
import { FirstRunTip } from '@/components/onboarding/FirstRunTip';
import { BulkOperationsToolbar, type BulkAction } from '@/components/ui/bulk-operations-toolbar';
import type { CrmRecord } from '@/components/crm/CrmDataTable';
import { exportToCSV, type ExportColumn } from '@/lib/export-utils';
import { apiRequest } from '@/lib/queryClient';
import { resolveVisibleColumns, buildColumnCatalog } from '@/lib/crm-columns';
import { useCustomFields, type CustomFieldObjectType } from '@/hooks/useCustomFields';
import { useCreateFromUrl } from '@/hooks/useCreateFromUrl';
import { cn } from '@/lib/utils';

const CUSTOM_FIELD_OBJECT_TYPES: CustomFieldObjectType[] = [
  'deals',
  'leads',
  'contacts',
  'companies',
];

/**
 * COP-M01: hard cap on an export. The table is server-paginated at 25/page, so
 * exporting "what is loaded" would silently emit one page. We fetch the whole
 * filtered set instead, and tell the user when we had to stop short rather than
 * handing them a truncated file that looks complete.
 */
const EXPORT_MAX_ROWS = 5000;

interface CrmIndexShellProps {
  objectType: CrmObjectType;
  children?: React.ReactNode;
  /** Render prop for the table view */
  renderTable?: (props: CrmViewRenderProps) => React.ReactNode;
  /** Render prop for the board view */
  renderBoard?: (props: CrmViewRenderProps) => React.ReactNode;
  /** Extra content for the header bar (e.g., pipeline selector) */
  headerExtra?: React.ReactNode;
  /** Callback when creating a new record */
  onCreateNew?: () => void;
  /**
   * COP-M01: bulk actions offered once rows are selected. The shell owns the
   * selection state and renders the toolbar; pages just declare the operations.
   */
  bulkActions?: BulkAction[];
}

export interface CrmViewRenderProps {
  objectType: CrmObjectType;
  search: string;
  activeFilters: Record<string, any>;
  sortConfig: { field: string; direction: 'asc' | 'desc' } | null;
  activeView: SavedViewData | null;
  /** CRMX-012: resolved column config for the active view (null ⇒ defaults). */
  columnConfig: SavedViewData['columnConfig'];
  /** CRMX-012: persist a new column config (to the active view when present). */
  onColumnConfigChange: (config: NonNullable<SavedViewData['columnConfig']>) => void;
  /** CRMX-012: whether column changes persist (an active view exists). */
  columnsPersist: boolean;
  /** COP-M01: selection state, owned by the shell so the bulk toolbar can live in the toolbar. */
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  /** COP-M01: let the table report its server-side total back to the shell. */
  onTotalCountChange: (total: number) => void;
  /**
   * COP-I04: empty-state wiring. `onClearFilters` lets a filtered-empty view
   * offer the action that actually helps (clear the filters) instead of a
   * create button that would not bring the missing rows back; `onCreateNew` is
   * the real create flow for a genuinely-empty view.
   */
  onClearFilters: () => void;
  onCreateNew?: () => void;
  /** COP-I04: true when a search or filter is narrowing the view. */
  isFiltered: boolean;
}

export function CrmIndexShell({
  objectType,
  renderTable,
  renderBoard,
  headerExtra,
  onCreateNew,
  bulkActions,
}: CrmIndexShellProps) {
  const config = getCrmObjectConfig(objectType);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // ─── URL State ──────────────────────────────────────────────────
  const urlParams = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : '',
  );
  const initialViewMode =
    (urlParams.get('mode') as 'table' | 'board') || (config.hasBoardView ? 'board' : 'table');
  const initialViewId = urlParams.get('view') || undefined;

  const [viewMode, setViewMode] = useState<'table' | 'board'>(initialViewMode);
  const [search, setSearch] = useState('');
  const [activeViewId, setActiveViewId] = useState<string | undefined>(initialViewId);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [activeSortConfig, setActiveSortConfig] = useState<{
    field: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  // CRMX-012: session-local column override (until saved / view switch).
  const [localColumnConfig, setLocalColumnConfig] = useState<SavedViewData['columnConfig']>(null);
  const [isModified, setIsModified] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [saveVisibility, setSaveVisibility] = useState<'private' | 'team' | 'everyone'>('private');
  const [showAddViewDropdown, setShowAddViewDropdown] = useState(false);

  // ─── Saved Views ────────────────────────────────────────────────
  const {
    views,
    pinnedViews,
    defaultView,
    isLoading: viewsLoading,
    createView,
    updateView,
    deleteView,
    cloneView,
    pinView,
    unpinView,
  } = useSavedViews(objectType);

  // Resolve active view
  const activeView = useMemo(() => {
    if (activeViewId) {
      return views.find((v) => v.id === activeViewId) ?? null;
    }
    return defaultView ?? null;
  }, [activeViewId, views, defaultView]);

  // Apply view config when active view changes
  useEffect(() => {
    if (activeView) {
      setActiveFilters(
        activeView.filterDefinition
          ? Object.fromEntries(activeView.filterDefinition.map((f) => [f.field, f.value]))
          : {},
      );
      setActiveSortConfig(activeView.sortConfig ?? null);
      setLocalColumnConfig(null); // adopt the view's own column set
      setIsModified(false);
    }
  }, [activeView?.id]);

  // CRMX-012: resolved column config + persistence. Local override wins until a
  // view switch; changes persist to the active saved view when one exists.
  const resolvedColumnConfig = localColumnConfig ?? activeView?.columnConfig ?? null;
  const handleColumnConfigChange = useCallback(
    async (config: NonNullable<SavedViewData['columnConfig']>) => {
      setLocalColumnConfig(config);
      if (activeView) {
        try {
          await updateView.mutateAsync({ id: activeView.id, columnConfig: config });
        } catch {
          toast({
            title: 'Could not save columns',
            description: 'Your column changes are applied for this session only.',
            variant: 'destructive',
          });
        }
      }
    },
    [activeView, updateView, toast],
  );

  // ─── URL Sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (activeViewId) params.set('view', activeViewId);
    else params.delete('view');
    params.set('mode', viewMode);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [activeViewId, viewMode]);

  // ─── View Tab Handlers ──────────────────────────────────────────
  const handleViewTabClick = useCallback((viewId: string) => {
    setActiveViewId(viewId);
    setIsModified(false);
  }, []);

  const handleSaveView = useCallback(
    async (mode: 'save' | 'save_as') => {
      if (mode === 'save' && activeView) {
        const filterDef = Object.entries(activeFilters).map(([field, value]) => ({
          field,
          operator: 'eq',
          value,
        }));
        await updateView.mutateAsync({
          id: activeView.id,
          filterDefinition: filterDef.length > 0 ? filterDef : null,
          sortConfig: activeSortConfig,
        });
        setIsModified(false);
        toast({ title: 'View saved', description: `"${activeView.name}" has been updated.` });
      } else {
        setShowSaveDialog(true);
      }
    },
    [activeView, activeFilters, activeSortConfig, updateView, toast],
  );

  const handleSaveNewView = useCallback(async () => {
    if (!saveViewName.trim()) return;
    const filterDef = Object.entries(activeFilters).map(([field, value]) => ({
      field,
      operator: 'eq',
      value,
    }));
    const result = await createView.mutateAsync({
      name: saveViewName.trim(),
      objectType,
      filterDefinition: filterDef.length > 0 ? filterDef : undefined,
      sortConfig: activeSortConfig ?? undefined,
      // CRMX-012: carry the current column customization into the new view.
      columnConfig: localColumnConfig ?? activeView?.columnConfig ?? undefined,
      visibility: saveVisibility,
    });
    setActiveViewId(result.id);
    setShowSaveDialog(false);
    setSaveViewName('');
    setLocalColumnConfig(null);
    setIsModified(false);
    toast({ title: 'View created', description: `"${saveViewName}" has been saved.` });
  }, [
    saveViewName,
    objectType,
    activeFilters,
    activeSortConfig,
    localColumnConfig,
    activeView,
    saveVisibility,
    createView,
    toast,
  ]);

  const handleDeleteView = useCallback(
    async (viewId: string) => {
      await deleteView.mutateAsync(viewId);
      if (activeViewId === viewId) {
        setActiveViewId(defaultView?.id);
      }
      toast({ title: 'View deleted' });
    },
    [deleteView, activeViewId, defaultView, toast],
  );

  const handleCloneView = useCallback(
    async (viewId: string) => {
      await cloneView.mutateAsync({ id: viewId });
      toast({ title: 'View cloned' });
    },
    [cloneView, toast],
  );

  const handlePinView = useCallback(
    async (viewId: string) => {
      await pinView.mutateAsync(viewId);
    },
    [pinView],
  );

  const handleUnpinView = useCallback(
    async (viewId: string) => {
      await unpinView.mutateAsync(viewId);
    },
    [unpinView],
  );

  const handleFilterChange = useCallback((field: string, value: any) => {
    setActiveFilters((prev) => {
      if (value === undefined || value === null || value === '') {
        const { [field]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [field]: value };
    });
    setIsModified(true);
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters({});
    setIsModified(true);
  }, []);

  const handleResetView = useCallback(() => {
    if (activeView) {
      setActiveFilters(
        activeView.filterDefinition
          ? Object.fromEntries(activeView.filterDefinition.map((f) => [f.field, f.value]))
          : {},
      );
      setActiveSortConfig(activeView.sortConfig ?? null);
      setIsModified(false);
    }
  }, [activeView]);

  // ─── COP-M01: Selection + Export ────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [totalCount, setTotalCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const { fields: customFieldDefs } = useCustomFields(
    CUSTOM_FIELD_OBJECT_TYPES.includes(objectType as CustomFieldObjectType)
      ? (objectType as CustomFieldObjectType)
      : undefined,
  );

  // Clear the selection whenever the visible result set changes underneath it —
  // otherwise a bulk action would apply to rows the user can no longer see.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [objectType, search, activeFilters, activeViewId]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        limit: String(EXPORT_MAX_ROWS),
        offset: '0',
        ...(search ? { search } : {}),
        ...(activeSortConfig
          ? { sortBy: activeSortConfig.field, sortOrder: activeSortConfig.direction }
          : {}),
        ...(config.recordType ? { recordType: config.recordType } : {}),
      });
      for (const [key, value] of Object.entries(activeFilters)) {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      }

      const response = await apiRequest(`${config.apiEndpoint}?${params.toString()}`, 'GET');
      const rows: CrmRecord[] = Array.isArray(response)
        ? response
        : (response?.data ?? response?.records ?? []);
      const total: number = response?.total ?? rows.length;

      if (rows.length === 0) {
        toast({ title: 'Nothing to export', description: 'This view has no records.' });
        return;
      }

      // Export exactly the columns the user has visible, in their order.
      const catalog = buildColumnCatalog(config.fields, customFieldDefs ?? []);
      const visible = resolveVisibleColumns(catalog, resolvedColumnConfig, config.defaultColumns);
      const columns: ExportColumn<CrmRecord>[] = visible.map((col) => ({
        key: col.field,
        label: col.label,
        format: (value: unknown, row: CrmRecord) => {
          const custom = row?.customFields as Record<string, unknown> | undefined;
          const raw = col.customKey ? custom?.[col.customKey] : value;
          if (raw === null || raw === undefined) return '';
          if (raw instanceof Date) return raw.toISOString();
          if (typeof raw === 'object') return JSON.stringify(raw);
          return String(raw);
        },
      }));

      exportToCSV(rows, columns, {
        filename: `${config.labelPlural.toLowerCase().replace(/\s+/g, '-')}-export`,
      });

      // Be explicit when the cap bit — a silently truncated export is worse than none.
      if (total > rows.length) {
        toast({
          title: `Exported ${rows.length.toLocaleString()} of ${total.toLocaleString()}`,
          description: `Exports are capped at ${EXPORT_MAX_ROWS.toLocaleString()} rows. Narrow the view with filters to export the rest.`,
        });
      } else {
        toast({ title: `Exported ${rows.length.toLocaleString()} ${config.labelPlural}` });
      }
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Could not export this view.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    config,
    search,
    activeFilters,
    activeSortConfig,
    resolvedColumnConfig,
    customFieldDefs,
    toast,
  ]);

  // COP-I02: the command palette's "Create ..." entries hand off via ?action=new.
  useCreateFromUrl(onCreateNew);

  // COP-I04: clear everything narrowing the view, so a "no matches" empty state
  // can offer the one action that brings the rows back. Distinct from the
  // toolbar's handleClearFilters, which deliberately leaves the search box alone.
  const handleClearSearchAndFilters = useCallback(() => {
    setSearch('');
    setActiveFilters({});
    setIsModified(true);
  }, []);

  // ─── Render Props ───────────────────────────────────────────────
  const viewRenderProps: CrmViewRenderProps = {
    objectType,
    search,
    activeFilters,
    sortConfig: activeSortConfig,
    activeView,
    columnConfig: resolvedColumnConfig,
    onColumnConfigChange: handleColumnConfigChange,
    columnsPersist: Boolean(activeView),
    selectedIds,
    onSelectionChange: setSelectedIds,
    onTotalCountChange: setTotalCount,
    // COP-I04: empty-state wiring.
    isFiltered: Boolean(search.trim()) || Object.keys(activeFilters).length > 0,
    onClearFilters: handleClearSearchAndFilters,
    onCreateNew,
  };

  const activeFilterCount = Object.keys(activeFilters).length;

  // ─── Unpinned views for "Add View" dropdown ─────────────────────
  const unpinnedViews = views.filter((v) => !v.isPinned);

  return (
    <div className="flex flex-col h-full">
      {/* ─── Top Bar ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 px-4 pt-4 pb-2 border-b bg-background">
        <div className="flex items-center justify-between gap-3">
          {/* Title + View Mode Toggle */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{config.labelPlural}</h1>

            {config.hasBoardView && (
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-1.5 h-7 px-2.5"
                  onClick={() => setViewMode('table')}
                >
                  <List className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Table</span>
                </Button>
                <Button
                  variant={viewMode === 'board' ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-1.5 h-7 px-2.5"
                  onClick={() => setViewMode('board')}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Board</span>
                </Button>
              </div>
            )}

            {headerExtra}
          </div>

          {/* Search + Create */}
          <div className="flex items-center gap-2">
            <div className="relative w-64 hidden md:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${config.labelPlural.toLowerCase()}...`}
                className="pl-9 h-8"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 p-0"
                  onClick={() => setSearch('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* COP-M01: export the whole filtered view, not just the loaded page. */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExport}
              disabled={isExporting}
              title={`Export these ${config.labelPlural.toLowerCase()} to CSV`}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{isExporting ? 'Exporting…' : 'Export'}</span>
            </Button>

            {onCreateNew && (
              <Button size="sm" className="gap-1.5" onClick={onCreateNew}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create {config.label}</span>
              </Button>
            )}
          </div>
        </div>

        {/* ─── View Tabs ─────────────────────────────────────────── */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 -mb-2">
          {pinnedViews.map((view) => (
            <div key={view.id} className="flex items-center shrink-0">
              <Button
                variant={
                  activeViewId === view.id || (!activeViewId && view.isDefault)
                    ? 'secondary'
                    : 'ghost'
                }
                size="sm"
                className={cn(
                  'h-7 px-3 text-xs rounded-b-none border-b-2',
                  activeViewId === view.id || (!activeViewId && view.isDefault)
                    ? 'border-b-primary font-medium'
                    : 'border-b-transparent',
                )}
                onClick={() => handleViewTabClick(view.id)}
              >
                {view.name}
                {isModified && (activeViewId === view.id || (!activeViewId && view.isDefault)) && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full bg-orange-500" />
                )}
              </Button>

              {/* View tab context menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label="More options"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-5 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onClick={() => handleCloneView(view.id)}>
                    <Copy className="h-4 w-4 mr-2" /> Clone
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUnpinView(view.id)}>
                    <PinOff className="h-4 w-4 mr-2" /> Remove from tabs
                  </DropdownMenuItem>
                  {!view.isSystemView && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteView(view.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {/* Add View Button */}
          <DropdownMenu open={showAddViewDropdown} onOpenChange={setShowAddViewDropdown}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground shrink-0"
              >
                <Plus className="h-3 w-3 mr-1" /> Add view
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto">
              {unpinnedViews.length > 0 ? (
                unpinnedViews.map((view) => (
                  <DropdownMenuItem
                    key={view.id}
                    onClick={() => {
                      handlePinView(view.id);
                      setShowAddViewDropdown(false);
                    }}
                  >
                    <Pin className="h-4 w-4 mr-2" /> {view.name}
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {view.visibility}
                    </Badge>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  All views are pinned
                </div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setShowSaveDialog(true);
                  setShowAddViewDropdown(false);
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Create new view
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save View Button (when modified) */}
          {isModified && (
            <div className="flex items-center gap-1 ml-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                    <Save className="h-3 w-3" /> Save view
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {activeView && !activeView.isSystemView && (
                    <DropdownMenuItem onClick={() => handleSaveView('save')}>
                      Save "{activeView.name}"
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleSaveView('save_as')}>
                    Save as new view
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleResetView}>Reset to saved</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* ─── Quick Filters ────────────────────────────────────────── */}
      {config.quickFilters.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {config.quickFilters.map((filter) => (
            <Select
              key={filter.field}
              value={activeFilters[filter.field] ?? ''}
              onValueChange={(value) =>
                handleFilterChange(filter.field, value === '__all__' ? undefined : value)
              }
            >
              <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All {filter.label}</SelectItem>
                {filter.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {activeFilterCount > 0 && (
            <>
              <Badge variant="secondary" className="text-[10px]">
                {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={handleClearFilters}
              >
                Clear all
              </Button>
            </>
          )}
        </div>
      )}

      {/* ─── COP-M01: Bulk Operations ─────────────────────────────── */}
      {bulkActions && bulkActions.length > 0 && selectedIds.size > 0 && (
        <div className="px-3 pt-2">
          <BulkOperationsToolbar
            selectedCount={selectedIds.size}
            totalCount={totalCount}
            actions={bulkActions}
            selectedIds={Array.from(selectedIds)}
            onClearSelection={() => setSelectedIds(new Set())}
          />
        </div>
      )}

      {/* ─── Content Area ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {/* CRMX-014: first-visit coach mark for core CRM pages. */}
        <div className="px-3 pt-3">
          <FirstRunTip
            tipKey={`crm-index-${objectType}`}
            title={`Welcome to your ${config.labelPlural}`}
          >
            Switch between Table and Board views, save filtered views, and customize columns from
            the toolbar. New here?{' '}
            <button
              type="button"
              className="underline font-medium"
              onClick={() => setLocation('/getting-started')}
            >
              Open the getting-started guide
            </button>
            .
          </FirstRunTip>
        </div>
        {viewMode === 'table' && renderTable?.(viewRenderProps)}
        {viewMode === 'board' && renderBoard?.(viewRenderProps)}
        {viewMode === 'table' && !renderTable && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Table view not yet configured for {config.labelPlural}
          </div>
        )}
        {viewMode === 'board' && !renderBoard && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Board view not yet configured for {config.labelPlural}
          </div>
        )}
      </div>

      {/* ─── Save View Dialog ─────────────────────────────────────── */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">View Name</span>
              <Input
                value={saveViewName}
                onChange={(e) => setSaveViewName(e.target.value)}
                placeholder="My custom view"
                autoFocus
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Visibility</span>
              <Select value={saveVisibility} onValueChange={(v) => setSaveVisibility(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private (only me)</SelectItem>
                  <SelectItem value="team">Team (my team)</SelectItem>
                  <SelectItem value="everyone">Everyone (all users)</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNewView} disabled={!saveViewName.trim()}>
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
