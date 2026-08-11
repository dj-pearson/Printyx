import { useEffect, useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { usePermissions } from '@/hooks/usePermissions';
import { apiRequest } from '@/lib/queryClient';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  Search,
  FileText,
  Users,
  Wrench,
  Package,
  Calendar,
  DollarSign,
  Plus,
  Settings,
  Home,
  ClipboardList,
  Truck,
  AlertCircle,
  Building2,
  Monitor,
  Target,
  FileSignature,
} from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'customer' | 'equipment' | 'ticket' | 'invoice' | 'action';
  title: string;
  subtitle?: string;
  url?: string;
  icon?: React.ReactNode;
}

/** COP-I05: the shape /api/universal-search returns. */
interface UniversalSearchHit {
  id: string;
  type: 'customer' | 'lead' | 'deal' | 'activity' | 'quote' | 'invoice' | 'equipment' | 'contract';
  title: string;
  subtitle?: string;
  path?: string;
}

const TYPE_LABELS: Record<UniversalSearchHit['type'], string> = {
  customer: 'Customers',
  lead: 'Leads',
  deal: 'Deals',
  activity: 'Activities',
  quote: 'Quotes',
  invoice: 'Invoices',
  equipment: 'Equipment',
  contract: 'Contracts',
};

function iconForType(type: UniversalSearchHit['type']) {
  const cls = 'h-4 w-4';
  switch (type) {
    case 'customer':
      return <Building2 className={cls} />;
    case 'lead':
      return <Users className={cls} />;
    case 'deal':
      return <Target className={cls} />;
    case 'equipment':
      return <Monitor className={cls} />;
    case 'contract':
      return <FileSignature className={cls} />;
    case 'quote':
      return <FileText className={cls} />;
    case 'invoice':
      return <DollarSign className={cls} />;
    default:
      return <ClipboardList className={cls} />;
  }
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, navigate] = useLocation();
  // COP-I02: the palette must not offer what the sidebar hides. canAccessItem
  // resolves against the SAME navigation-permissions rules the sidebar uses, so
  // the two can never drift apart.
  const { canAccessItem } = usePermissions();
  const [search, setSearch] = useState('');
  const [recentItems, setRecentItems] = useState<SearchResult[]>([]);

  // Load recent items from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('printyx_recent_items');
      if (stored) {
        try {
          setRecentItems(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse recent items:', e);
        }
      }
    }
  }, []);

  // COP-I05: one ranked server search instead of downloading four full lists and
  // filtering them in the browser. /api/universal-search covers business records,
  // deals, activities, quotes, invoices, equipment (serial + asset tag) and
  // contracts (contract number), scores relevance server-side, and is tenant-scoped
  // in every branch. Debounced so it does not fire on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 180);
    return () => clearTimeout(t);
  }, [search]);

  const { data: searchHits = [], isFetching: searching } = useQuery<UniversalSearchHit[]>({
    queryKey: ['/api/universal-search', debouncedSearch],
    queryFn: () =>
      apiRequest(`/api/universal-search?q=${encodeURIComponent(debouncedSearch)}&limit=20`),
    enabled: open && debouncedSearch.trim().length >= 2,
    staleTime: 20_000,
  });

  // Quick actions
  // COP-I02: every "Create ..." entry below points at a surface that ACTUALLY
  // honours ?action=new (CrmIndexShell consumes it and opens the create dialog).
  // Before this story the param was read by nobody, so these entries just moved
  // you to a list page and did nothing.
  const quickActions: SearchResult[] = [
    {
      id: 'new-deal',
      type: 'action',
      title: 'Create New Deal',
      url: '/crm/deals?action=new',
      icon: <Plus className="h-4 w-4" />,
    },
    {
      id: 'new-lead',
      type: 'action',
      // Points at the CURRENT nav destination, not /crm/leads. Sending users to
      // the shell pages is COP-M01's job and is gated on COP-B00, so this entry
      // deliberately follows navigation rather than getting ahead of it.
      title: 'Create New Lead',
      url: '/leads-management?action=new',
      icon: <Plus className="h-4 w-4" />,
    },
    {
      id: 'new-quote',
      type: 'action',
      title: 'Create New Quote',
      url: '/quotes/new',
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: 'new-customer',
      type: 'action',
      title: 'Create New Customer',
      url: '/customers?action=new',
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: 'new-ticket',
      type: 'action',
      // TODO(service): ServiceHub does not consume ?action=new, so this
      // navigates rather than opening a form. Labelled for what it does.
      title: 'Open Service Hub',
      url: '/service-hub',
      icon: <Wrench className="h-4 w-4" />,
    },
    {
      id: 'new-invoice',
      type: 'action',
      // TODO(billing): Invoices does not consume ?action=new — see above.
      title: 'Open Invoices',
      url: '/invoices',
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      id: 'dispatch-board',
      type: 'action',
      title: 'Open Dispatch Board',
      url: '/service-dispatch',
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      id: 'meter-billing',
      type: 'action',
      title: 'Process Meter Billing',
      url: '/meter-billing',
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: 'inventory',
      type: 'action',
      title: 'View Inventory',
      url: '/warehouse-operations',
      icon: <Package className="h-4 w-4" />,
    },
  ];

  // COP-I02: drop any action whose destination the user cannot reach. Paths
  // carry a query string, so compare on the pathname only.
  const permittedActions = quickActions.filter((action) => {
    if (!action.url) return true;
    return canAccessItem(action.url.split('?')[0]);
  });

  // COP-I05: group the server's ranked hits by type, preserving relevance order
  // within each group. The server already sorted, so this only buckets.
  const grouped = useMemo(() => {
    const buckets = new Map<string, SearchResult[]>();
    for (const hit of searchHits) {
      const mapped: SearchResult = {
        id: hit.id,
        type: 'action',
        title: hit.title,
        subtitle: hit.subtitle,
        url: hit.path,
        icon: iconForType(hit.type),
      };
      const list = buckets.get(hit.type) ?? [];
      list.push(mapped);
      buckets.set(hit.type, list);
    }
    return buckets;
  }, [searchHits]);

  // Add to recent items
  const addToRecent = useCallback((item: SearchResult) => {
    setRecentItems((prev) => {
      const filtered = prev.filter((i) => i.id !== item.id);
      const updated = [item, ...filtered].slice(0, 10); // Keep last 10
      if (typeof window !== 'undefined') {
        localStorage.setItem('printyx_recent_items', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const onSelect = useCallback(
    (item: SearchResult) => {
      if (item.url) {
        addToRecent(item);
        navigate(item.url);
        onOpenChange(false);
        setSearch('');
      }
    },
    [navigate, onOpenChange, addToRecent],
  );

  // Filter quick actions by search
  const filteredActions = permittedActions.filter(
    (action) => search.length === 0 || action.title.toLowerCase().includes(search.toLowerCase()),
  );

  const hasResults = grouped.size > 0 || filteredActions.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search customers, equipment, tickets, or type a command..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {!hasResults && search.length > 0 && (
          <CommandEmpty>No results found for &quot;{search}&quot;</CommandEmpty>
        )}

        {/* Recent Items - Only show when no search */}
        {search.length === 0 && recentItems.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentItems.slice(0, 5).map((item) => (
                <CommandItem key={item.id} value={item.title} onSelect={() => onSelect(item)}>
                  {item.icon}
                  <div className="ml-2">
                    <div className="font-medium">{item.title}</div>
                    {item.subtitle && (
                      <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick Actions */}
        {filteredActions.length > 0 && (
          <>
            <CommandGroup heading="Quick Actions">
              {filteredActions.map((action) => (
                <CommandItem key={action.id} value={action.title} onSelect={() => onSelect(action)}>
                  {action.icon}
                  <span className="ml-2">{action.title}</span>
                  <CommandShortcut>⌘</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            {search.length > 0 && <CommandSeparator />}
          </>
        )}

        {/* Search Results */}
        {search.length > 0 && (
          <>
            {/* COP-I05: server-ranked hits, grouped by object type. */}
            {Array.from(grouped.entries()).map(([type, items]) => (
              <CommandGroup
                key={type}
                heading={TYPE_LABELS[type as UniversalSearchHit['type']] ?? type}
              >
                {items.map((item) => (
                  <CommandItem key={item.id} value={item.title} onSelect={() => onSelect(item)}>
                    {item.icon}
                    <div className="ml-2 min-w-0">
                      <div className="font-medium truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-xs text-muted-foreground truncate">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

// Hook to use the command palette
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return { open, setOpen };
}
