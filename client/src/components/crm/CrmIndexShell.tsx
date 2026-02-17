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
import { cn } from '@/lib/utils';

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
}

export interface CrmViewRenderProps {
  objectType: CrmObjectType;
  search: string;
  activeFilters: Record<string, any>;
  sortConfig: { field: string; direction: 'asc' | 'desc' } | null;
  activeView: SavedViewData | null;
}

export function CrmIndexShell({
  objectType,
  renderTable,
  renderBoard,
  headerExtra,
  onCreateNew,
}: CrmIndexShellProps) {
  const config = getCrmObjectConfig(objectType);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // ─── URL State ──────────────────────────────────────────────────
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const initialViewMode = (urlParams.get('mode') as 'table' | 'board') || (config.hasBoardView ? 'board' : 'table');
  const initialViewId = urlParams.get('view') || undefined;

  const [viewMode, setViewMode] = useState<'table' | 'board'>(initialViewMode);
  const [search, setSearch] = useState('');
  const [activeViewId, setActiveViewId] = useState<string | undefined>(initialViewId);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [activeSortConfig, setActiveSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
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
      setIsModified(false);
    }
  }, [activeView?.id]);

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

  const handleSaveView = useCallback(async (mode: 'save' | 'save_as') => {
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
  }, [activeView, activeFilters, activeSortConfig, updateView, toast]);

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
      visibility: saveVisibility,
    });
    setActiveViewId(result.id);
    setShowSaveDialog(false);
    setSaveViewName('');
    setIsModified(false);
    toast({ title: 'View created', description: `"${saveViewName}" has been saved.` });
  }, [saveViewName, objectType, activeFilters, activeSortConfig, saveVisibility, createView, toast]);

  const handleDeleteView = useCallback(async (viewId: string) => {
    await deleteView.mutateAsync(viewId);
    if (activeViewId === viewId) {
      setActiveViewId(defaultView?.id);
    }
    toast({ title: 'View deleted' });
  }, [deleteView, activeViewId, defaultView, toast]);

  const handleCloneView = useCallback(async (viewId: string) => {
    await cloneView.mutateAsync({ id: viewId });
    toast({ title: 'View cloned' });
  }, [cloneView, toast]);

  const handlePinView = useCallback(async (viewId: string) => {
    await pinView.mutateAsync(viewId);
  }, [pinView]);

  const handleUnpinView = useCallback(async (viewId: string) => {
    await unpinView.mutateAsync(viewId);
  }, [unpinView]);

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

  // ─── Render Props ───────────────────────────────────────────────
  const viewRenderProps: CrmViewRenderProps = {
    objectType,
    search,
    activeFilters,
    sortConfig: activeSortConfig,
    activeView,
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
                variant={activeViewId === view.id || (!activeViewId && view.isDefault) ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'h-7 px-3 text-xs rounded-b-none border-b-2',
                  (activeViewId === view.id || (!activeViewId && view.isDefault))
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
                  <Button variant="ghost" size="sm" className="h-7 w-5 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100">
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
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground shrink-0">
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
                <div className="px-2 py-1.5 text-xs text-muted-foreground">All views are pinned</div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                setShowSaveDialog(true);
                setShowAddViewDropdown(false);
              }}>
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
                  <DropdownMenuItem onClick={handleResetView}>
                    Reset to saved
                  </DropdownMenuItem>
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
              onValueChange={(value) => handleFilterChange(filter.field, value === '__all__' ? undefined : value)}
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

      {/* ─── Content Area ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
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
            <div className="space-y-2">
              <label className="text-sm font-medium">View Name</label>
              <Input
                value={saveViewName}
                onChange={(e) => setSaveViewName(e.target.value)}
                placeholder="My custom view"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Visibility</label>
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
            </div>
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
