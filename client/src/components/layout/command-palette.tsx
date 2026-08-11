import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { usePermissions } from '@/hooks/usePermissions';
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
} from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'customer' | 'equipment' | 'ticket' | 'invoice' | 'action';
  title: string;
  subtitle?: string;
  url?: string;
  icon?: React.ReactNode;
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

  // Fetch data for search
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ['/api/customers'],
    enabled: open && search.length > 0,
  });

  const { data: tickets = [] } = useQuery<any[]>({
    queryKey: ['/api/service-tickets'],
    enabled: open && search.length > 0,
  });

  const { data: equipment = [] } = useQuery<any[]>({
    queryKey: ['/api/equipment'],
    enabled: open && search.length > 0,
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ['/api/invoices'],
    enabled: open && search.length > 0,
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

  // Filter and map results
  const searchResults = useCallback((): {
    customers: SearchResult[];
    equipment: SearchResult[];
    tickets: SearchResult[];
    invoices: SearchResult[];
  } => {
    if (!search || search.length < 2) {
      return { customers: [], equipment: [], tickets: [], invoices: [] };
    }

    const searchLower = search.toLowerCase();

    const filteredCustomers: SearchResult[] = (customers || [])
      .filter(
        (c: any) =>
          c.companyName?.toLowerCase().includes(searchLower) ||
          c.primaryContactName?.toLowerCase().includes(searchLower) ||
          c.primaryContactEmail?.toLowerCase().includes(searchLower),
      )
      .slice(0, 5)
      .map((c: any) => ({
        id: c.id,
        type: 'customer' as const,
        title: c.companyName,
        subtitle: c.primaryContactName || c.primaryContactEmail,
        url: `/customers/${c.id}`,
        icon: <Building2 className="h-4 w-4" />,
      }));

    const filteredEquipment: SearchResult[] = (equipment || [])
      .filter(
        (e: any) =>
          e.equipmentName?.toLowerCase().includes(searchLower) ||
          e.model?.toLowerCase().includes(searchLower) ||
          e.serialNumber?.toLowerCase().includes(searchLower),
      )
      .slice(0, 5)
      .map((e: any) => ({
        id: e.id,
        type: 'equipment' as const,
        title: e.equipmentName || e.model,
        subtitle: `SN: ${e.serialNumber || 'N/A'}`,
        url: `/equipment/${e.id}`,
        icon: <Monitor className="h-4 w-4" />,
      }));

    const filteredTickets: SearchResult[] = (tickets || [])
      .filter(
        (t: any) =>
          t.ticketNumber?.toLowerCase().includes(searchLower) ||
          t.description?.toLowerCase().includes(searchLower) ||
          t.priority?.toLowerCase().includes(searchLower),
      )
      .slice(0, 5)
      .map((t: any) => ({
        id: t.id,
        type: 'ticket' as const,
        title: `${t.ticketNumber || 'Ticket'} - ${t.description?.substring(0, 50) || 'Service Request'}`,
        subtitle: `Priority: ${t.priority || 'Medium'}`,
        url: `/service-hub/${t.id}`,
        icon: <Wrench className="h-4 w-4" />,
      }));

    const filteredInvoices: SearchResult[] = (invoices || [])
      .filter(
        (i: any) =>
          i.invoiceNumber?.toLowerCase().includes(searchLower) ||
          i.customerName?.toLowerCase().includes(searchLower),
      )
      .slice(0, 5)
      .map((i: any) => ({
        id: i.id,
        type: 'invoice' as const,
        title: `${i.invoiceNumber || 'Invoice'} - ${i.customerName || 'Unknown'}`,
        subtitle: `$${i.totalAmount || '0.00'}`,
        url: `/invoices/${i.id}`,
        icon: <DollarSign className="h-4 w-4" />,
      }));

    return {
      customers: filteredCustomers,
      equipment: filteredEquipment,
      tickets: filteredTickets,
      invoices: filteredInvoices,
    };
  }, [search, customers, equipment, tickets, invoices]);

  const results = searchResults();

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

  // Handle item selection
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

  const hasResults =
    results.customers.length > 0 ||
    results.equipment.length > 0 ||
    results.tickets.length > 0 ||
    results.invoices.length > 0 ||
    filteredActions.length > 0;

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
            {results.customers.length > 0 && (
              <>
                <CommandGroup heading="Customers">
                  {results.customers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={customer.title}
                      onSelect={() => onSelect(customer)}
                    >
                      {customer.icon}
                      <div className="ml-2">
                        <div className="font-medium">{customer.title}</div>
                        {customer.subtitle && (
                          <div className="text-xs text-muted-foreground">{customer.subtitle}</div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {results.equipment.length > 0 && (
              <>
                <CommandGroup heading="Equipment">
                  {results.equipment.map((item) => (
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

            {results.tickets.length > 0 && (
              <>
                <CommandGroup heading="Service Requests">
                  {results.tickets.map((ticket) => (
                    <CommandItem
                      key={ticket.id}
                      value={ticket.title}
                      onSelect={() => onSelect(ticket)}
                    >
                      {ticket.icon}
                      <div className="ml-2">
                        <div className="font-medium">{ticket.title}</div>
                        {ticket.subtitle && (
                          <div className="text-xs text-muted-foreground">{ticket.subtitle}</div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {results.invoices.length > 0 && (
              <CommandGroup heading="Invoices">
                {results.invoices.map((invoice) => (
                  <CommandItem
                    key={invoice.id}
                    value={invoice.title}
                    onSelect={() => onSelect(invoice)}
                  >
                    {invoice.icon}
                    <div className="ml-2">
                      <div className="font-medium">{invoice.title}</div>
                      {invoice.subtitle && (
                        <div className="text-xs text-muted-foreground">{invoice.subtitle}</div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
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
