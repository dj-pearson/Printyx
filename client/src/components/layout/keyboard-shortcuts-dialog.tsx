import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Home,
  Users,
  Wrench,
  Package,
  DollarSign,
  FileText,
  Calendar,
  Settings,
  HelpCircle,
  Keyboard,
} from "lucide-react";

interface Shortcut {
  keys: string[];
  description: string;
  icon?: React.ReactNode;
}

interface ShortcutCategory {
  title: string;
  shortcuts: Shortcut[];
}

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Open help with ? or Shift+/
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen(true);
      }
      // Close with Escape
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open]);

  const shortcuts: ShortcutCategory[] = [
    {
      title: "Global",
      shortcuts: [
        {
          keys: ["⌘", "K"],
          description: "Open command palette",
          icon: <Search className="h-4 w-4" />,
        },
        {
          keys: ["?"],
          description: "Show keyboard shortcuts",
          icon: <HelpCircle className="h-4 w-4" />,
        },
        {
          keys: ["G", "H"],
          description: "Go to home / dashboard",
          icon: <Home className="h-4 w-4" />,
        },
      ],
    },
    {
      title: "Navigation",
      shortcuts: [
        {
          keys: ["G", "C"],
          description: "Go to customers",
          icon: <Users className="h-4 w-4" />,
        },
        {
          keys: ["G", "S"],
          description: "Go to service hub",
          icon: <Wrench className="h-4 w-4" />,
        },
        {
          keys: ["G", "I"],
          description: "Go to invoices",
          icon: <DollarSign className="h-4 w-4" />,
        },
        {
          keys: ["G", "W"],
          description: "Go to warehouse",
          icon: <Package className="h-4 w-4" />,
        },
        {
          keys: ["G", "D"],
          description: "Go to dispatch board",
          icon: <Calendar className="h-4 w-4" />,
        },
      ],
    },
    {
      title: "Actions",
      shortcuts: [
        {
          keys: ["C"],
          description: "Create new (context-aware)",
          icon: <FileText className="h-4 w-4" />,
        },
        {
          keys: ["⌘", "S"],
          description: "Save current form",
        },
        {
          keys: ["⌘", "Enter"],
          description: "Submit current form",
        },
        {
          keys: ["Esc"],
          description: "Close dialog / cancel",
        },
      ],
    },
    {
      title: "List Views",
      shortcuts: [
        {
          keys: ["/"],
          description: "Focus search / filter",
        },
        {
          keys: ["↑", "↓"],
          description: "Navigate list items",
        },
        {
          keys: ["Enter"],
          description: "Open selected item",
        },
        {
          keys: ["⌘", "A"],
          description: "Select all",
        },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Master these shortcuts to navigate Printyx like a pro
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {shortcuts.map((category, idx) => (
            <div key={idx}>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {category.title}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, sidx) => (
                  <div
                    key={sidx}
                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {shortcut.icon && (
                        <span className="text-muted-foreground">
                          {shortcut.icon}
                        </span>
                      )}
                      <span className="text-sm">{shortcut.description}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, kidx) => (
                        <div key={kidx} className="flex items-center">
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs px-2 py-1 bg-muted"
                          >
                            {key}
                          </Badge>
                          {kidx < shortcut.keys.length - 1 && (
                            <span className="mx-1 text-xs text-muted-foreground">
                              then
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Pro tip:</strong> Press <Badge variant="secondary" className="font-mono text-xs px-1 mx-1">?</Badge> anytime to see this help.
            Most shortcuts work globally throughout the app.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to implement keyboard navigation
export function useKeyboardNavigation() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Navigation shortcuts (G + key)
      if (e.key.toLowerCase() === "g") {
        // Set a flag to listen for next key
        const handleNext = (nextE: KeyboardEvent) => {
          nextE.preventDefault();
          const routes: Record<string, string> = {
            h: "/dashboard",
            c: "/customers",
            s: "/service-hub",
            i: "/invoices",
            w: "/warehouse-operations",
            d: "/service-dispatch",
          };

          const route = routes[nextE.key.toLowerCase()];
          if (route) {
            window.location.href = route;
          }

          document.removeEventListener("keydown", handleNext);
        };

        document.addEventListener("keydown", handleNext);

        // Clean up after 2 seconds if no second key pressed
        setTimeout(() => {
          document.removeEventListener("keydown", handleNext);
        }, 2000);
      }

      // Search shortcut (/)
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[placeholder*="Search"]'
        );
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
}
