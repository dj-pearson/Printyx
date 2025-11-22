import * as React from "react";
import { useLocation } from "wouter";
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
  Building,
  DollarSign,
  Users,
  Phone,
  Mail,
  Calendar,
  FileText,
  Package,
  TrendingUp,
  BarChart3,
  Settings,
  Plus,
  Search,
  Clock,
  Target,
  Briefcase,
  UserPlus,
  CheckSquare,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  id: string;
  type: "customer" | "lead" | "deal" | "activity" | "quote" | "page" | "action";
  title: string;
  subtitle?: string;
  path?: string;
  action?: () => void;
  icon?: LucideIcon;
  metadata?: {
    value?: string;
    status?: string;
    date?: string;
  };
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Quick action definitions
const QUICK_ACTIONS: SearchResult[] = [
  {
    id: "new-lead",
    type: "action",
    title: "New Lead",
    subtitle: "Create a new lead",
    icon: UserPlus,
    path: "/business-records?action=create&type=lead",
  },
  {
    id: "new-customer",
    type: "action",
    title: "New Customer",
    subtitle: "Create a new customer",
    icon: Building,
    path: "/business-records?action=create&type=customer",
  },
  {
    id: "new-deal",
    type: "action",
    title: "New Deal",
    subtitle: "Create a new deal",
    icon: DollarSign,
    path: "/deals?action=create",
  },
  {
    id: "log-call",
    type: "action",
    title: "Log Call",
    subtitle: "Record a phone call",
    icon: Phone,
    path: "/activities?action=create&type=call",
  },
  {
    id: "send-email",
    type: "action",
    title: "Send Email",
    subtitle: "Compose an email",
    icon: Mail,
    path: "/activities?action=create&type=email",
  },
  {
    id: "schedule-meeting",
    type: "action",
    title: "Schedule Meeting",
    subtitle: "Create a new meeting",
    icon: Calendar,
    path: "/activities?action=create&type=meeting",
  },
  {
    id: "new-quote",
    type: "action",
    title: "New Quote",
    subtitle: "Create a quote",
    icon: FileText,
    path: "/quotes?action=create",
  },
];

// Page navigation definitions
const PAGE_NAVIGATION: SearchResult[] = [
  {
    id: "dashboard",
    type: "page",
    title: "Dashboard",
    subtitle: "Go to dashboard",
    icon: BarChart3,
    path: "/dashboard",
  },
  {
    id: "customers",
    type: "page",
    title: "Customers",
    subtitle: "View all customers",
    icon: Users,
    path: "/customers",
  },
  {
    id: "leads",
    type: "page",
    title: "Leads",
    subtitle: "Manage leads",
    icon: Target,
    path: "/leads-management",
  },
  {
    id: "deals",
    type: "page",
    title: "Deals & Pipeline",
    subtitle: "View sales pipeline",
    icon: TrendingUp,
    path: "/deals",
  },
  {
    id: "activities",
    type: "page",
    title: "Activities",
    subtitle: "View all activities",
    icon: CheckSquare,
    path: "/activities",
  },
  {
    id: "quotes",
    type: "page",
    title: "Quotes",
    subtitle: "Manage quotes",
    icon: FileText,
    path: "/quotes",
  },
  {
    id: "reports",
    type: "page",
    title: "Reports",
    subtitle: "View reports",
    icon: BarChart3,
    path: "/reports",
  },
  {
    id: "inventory",
    type: "page",
    title: "Inventory",
    subtitle: "Manage inventory",
    icon: Package,
    path: "/inventory",
  },
  {
    id: "crm-goals",
    type: "page",
    title: "CRM Goals",
    subtitle: "Track sales goals",
    icon: Target,
    path: "/crm-goals",
  },
  {
    id: "settings",
    type: "page",
    title: "Settings",
    subtitle: "Application settings",
    icon: Settings,
    path: "/settings",
  },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState("");

  // Fetch search results from API when query changes
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["/api/universal-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) {
        return [];
      }

      const response = await fetch(
        `/api/universal-search?q=${encodeURIComponent(searchQuery)}&limit=20`
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      return response.json() as Promise<SearchResult[]>;
    },
    enabled: searchQuery.length >= 2,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Get recent items from localStorage
  const [recentItems, setRecentItems] = React.useState<SearchResult[]>(() => {
    try {
      const stored = localStorage.getItem("commandPalette:recent");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleSelect = React.useCallback(
    (result: SearchResult) => {
      // Add to recent items
      const newRecent = [
        result,
        ...recentItems.filter((item) => item.id !== result.id),
      ].slice(0, 5);

      setRecentItems(newRecent);
      localStorage.setItem("commandPalette:recent", JSON.stringify(newRecent));

      // Execute action or navigate
      if (result.action) {
        result.action();
      } else if (result.path) {
        navigate(result.path);
      }

      // Close the palette
      onOpenChange(false);
      setSearchQuery("");
    },
    [navigate, onOpenChange, recentItems]
  );

  const getIcon = (result: SearchResult): LucideIcon => {
    if (result.icon) return result.icon;

    switch (result.type) {
      case "customer":
        return Building;
      case "lead":
        return UserPlus;
      case "deal":
        return DollarSign;
      case "activity":
        return CheckSquare;
      case "quote":
        return FileText;
      case "page":
        return BarChart3;
      case "action":
        return Plus;
      default:
        return Search;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "active":
      case "won":
      case "completed":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "lead":
      case "prospect":
      case "open":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "proposal":
      case "negotiation":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
      case "lost":
      case "inactive":
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search customers, deals, or type a command..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? "Searching..." : "No results found."}
        </CommandEmpty>

        {/* Search Results from API */}
        {searchResults && searchResults.length > 0 && (
          <>
            <CommandGroup heading="Results">
              {searchResults.map((result) => {
                const Icon = getIcon(result);
                return (
                  <CommandItem
                    key={result.id}
                    value={result.title}
                    onSelect={() => handleSelect(result)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <div className="flex-1">
                      <div className="font-medium">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </div>
                      )}
                    </div>
                    {result.metadata && (
                      <div className="ml-2 flex items-center gap-2">
                        {result.metadata.value && (
                          <Badge variant="secondary" className="text-xs">
                            {result.metadata.value}
                          </Badge>
                        )}
                        {result.metadata.status && (
                          <Badge
                            variant="secondary"
                            className={getStatusColor(result.metadata.status)}
                          >
                            {result.metadata.status}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Show default content when no search query */}
        {!searchQuery && (
          <>
            {/* Recent Items */}
            {recentItems.length > 0 && (
              <>
                <CommandGroup heading="Recent">
                  {recentItems.map((result) => {
                    const Icon = getIcon(result);
                    return (
                      <CommandItem
                        key={result.id}
                        value={result.title}
                        onSelect={() => handleSelect(result)}
                      >
                        <Clock className="mr-2 h-4 w-4 opacity-50" />
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{result.title}</span>
                        {result.subtitle && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {result.subtitle}
                          </span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Quick Actions */}
            <CommandGroup heading="Quick Actions">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon || Plus;
                return (
                  <CommandItem
                    key={action.id}
                    value={action.title}
                    onSelect={() => handleSelect(action)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{action.title}</span>
                    {action.subtitle && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {action.subtitle}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />

            {/* Page Navigation */}
            <CommandGroup heading="Pages">
              {PAGE_NAVIGATION.map((page) => {
                const Icon = page.icon || BarChart3;
                return (
                  <CommandItem
                    key={page.id}
                    value={page.title}
                    onSelect={() => handleSelect(page)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{page.title}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
