import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Building2,
  User,
  FileText,
  Calculator,
  Wrench,
  Package,
  DollarSign,
  Search,
  Clock,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  id: string;
  type: 'customer' | 'contact' | 'quote' | 'deal' | 'service' | 'product' | 'invoice';
  title: string;
  subtitle?: string;
  metadata?: string;
  url: string;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SEARCH_ICONS = {
  customer: Building2,
  contact: User,
  quote: Calculator,
  deal: TrendingUp,
  service: Wrench,
  product: Package,
  invoice: DollarSign,
};

const SEARCH_LABELS = {
  customer: 'Customers',
  contact: 'Contacts',
  quote: 'Quotes',
  deal: 'Deals',
  service: 'Service Tickets',
  product: 'Products',
  invoice: 'Invoices',
};

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [, setLocation] = useLocation();
  const [recentSearches, setRecentSearches] = React.useState<SearchResult[]>([]);

  // Load recent searches from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem('recentSearches');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save recent search
  const saveRecentSearch = (result: SearchResult) => {
    const updated = [
      result,
      ...recentSearches.filter((r) => r.id !== result.id),
    ].slice(0, 5); // Keep only 5 most recent

    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  // Search API call (debounced)
  const { data: results = [], isLoading } = useQuery<SearchResult[]>({
    queryKey: ['/api/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];

      // In production, this would call a real search API
      // For now, we'll return mock results based on localStorage data

      const mockResults: SearchResult[] = [];

      // Search quotes
      const quotesStr = localStorage.getItem('quotes');
      if (quotesStr) {
        try {
          const quotes = JSON.parse(quotesStr);
          quotes
            .filter((q: any) =>
              q.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              q.proposalNumber?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .slice(0, 3)
            .forEach((q: any) => {
              mockResults.push({
                id: q.id,
                type: 'quote',
                title: q.title || q.proposalNumber,
                subtitle: q.customerName,
                metadata: `$${q.totalAmount || 0}`,
                url: `/quotes/${q.id}`,
              });
            });
        } catch {
          // Ignore errors
        }
      }

      return mockResults;
    },
    enabled: searchQuery.length >= 2,
  });

  // Group results by type
  const groupedResults = React.useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};

    results.forEach((result) => {
      if (!groups[result.type]) {
        groups[result.type] = [];
      }
      groups[result.type].push(result);
    });

    return groups;
  }, [results]);

  const handleSelect = (result: SearchResult) => {
    saveRecentSearch(result);
    setLocation(result.url);
    onOpenChange(false);
    setSearchQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // cmd+k / ctrl+k to close
    if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search customers, quotes, deals, and more..."
        value={searchQuery}
        onValueChange={setSearchQuery}
        onKeyDown={handleKeyDown}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm">
              <Search className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                {searchQuery.length < 2
                  ? "Type at least 2 characters to search"
                  : "No results found"}
              </p>
            </div>
          )}
        </CommandEmpty>

        {/* Recent Searches */}
        {!searchQuery && recentSearches.length > 0 && (
          <>
            <CommandGroup heading={
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Recent Searches</span>
              </div>
            }>
              {recentSearches.map((result) => {
                const Icon = SEARCH_ICONS[result.type];
                return (
                  <CommandItem
                    key={result.id}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-xs text-muted-foreground truncate">
                          {result.subtitle}
                        </div>
                      )}
                    </div>
                    {result.metadata && (
                      <span className="text-xs text-muted-foreground">
                        {result.metadata}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {SEARCH_LABELS[result.type]}
                    </Badge>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Search Results */}
        {Object.entries(groupedResults).map(([type, items]) => {
          const Icon = SEARCH_ICONS[type as keyof typeof SEARCH_ICONS];
          const label = SEARCH_LABELS[type as keyof typeof SEARCH_LABELS];

          return (
            <React.Fragment key={type}>
              <CommandGroup heading={
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {items.length}
                  </Badge>
                </div>
              }>
                {items.map((result) => (
                  <CommandItem
                    key={result.id}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-xs text-muted-foreground truncate">
                          {result.subtitle}
                        </div>
                      )}
                    </div>
                    {result.metadata && (
                      <span className="text-xs text-muted-foreground">
                        {result.metadata}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </React.Fragment>
          );
        })}
      </CommandList>

      <div className="border-t p-2 text-xs text-muted-foreground text-center">
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>{" "}
        to close
      </div>
    </CommandDialog>
  );
}

/**
 * Hook to manage global search state
 */
export function useGlobalSearch() {
  const [open, setOpen] = React.useState(false);

  // cmd+k / ctrl+k to open
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return { open, setOpen };
}
