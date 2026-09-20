/**
 * My Day layout: the hook, the per-card boundary, and the customiser
 * (COP-B01 AC2, AC5, AC6).
 *
 * THE BOUNDARY IS THE POINT OF AC5. One card whose query throws used to take
 * the whole workspace with it, so a rep with a single broken endpoint saw an
 * error page instead of the six cards that still worked. Each card now renders
 * inside its own boundary and a failure is one card saying so.
 *
 * The role gate is not applied here. It is applied on every READ by the
 * endpoint, against the live role level, so a promotion adds the team cards
 * immediately and a demotion withholds them immediately - whatever is in the
 * saved layout. A client that filtered by role would be a second, staler copy
 * of a permission decision.
 */
import { Component, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  reorder,
  toPrefs,
  type MyDayCardPref,
  type ResolvedMyDayCard,
} from '@shared/my-day-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  SlidersHorizontal,
} from 'lucide-react';

const LAYOUT_KEY = '/api/dashboard/my-day-layout';

export interface MyDayLayoutResponse {
  cards: ResolvedMyDayCard[];
  hidden: ResolvedMyDayCard[];
  unknown: string[];
  withheld: string[];
  roleLevel: number;
  isDefault: boolean;
}

/** Cards that belong in the wide column. The rest go to the sidebar. */
const MAIN_COLUMN = new Set([
  'due-today',
  'suggested-tasks',
  'awaiting-signature',
  'stalled-deals',
  'installed-base-radar',
  'recent-wins',
  'team-pipeline',
]);

export function useMyDayLayout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery<MyDayLayoutResponse>({
    queryKey: [LAYOUT_KEY],
    queryFn: () => apiRequest(LAYOUT_KEY),
    staleTime: 5 * 60_000,
  });

  const save = useMutation({
    mutationFn: (cards: MyDayCardPref[]) => apiRequest(LAYOUT_KEY, 'PUT', { cards }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [LAYOUT_KEY] }),
    onError: (err: unknown) =>
      toast({
        title: 'Could not save your layout',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  /**
   * A layout that has not loaded renders NOTHING rather than a guessed
   * default: showing a rep an arrangement that then rearranges under them is
   * worse than a moment of blank, and the request is cached for five minutes.
   */
  const cards = query.data?.cards ?? [];

  return useMemo(
    () => ({
      layout: query.data ?? null,
      mainCards: cards.filter((c) => MAIN_COLUMN.has(String(c.id))),
      sideCards: cards.filter((c) => !MAIN_COLUMN.has(String(c.id))),
      save: (next: MyDayCardPref[]) => save.mutate(next),
      isSaving: save.isPending,
      isLoading: query.isLoading,
    }),
    [query.data, query.isLoading, save.isPending],
  );
}

interface BoundaryState {
  failed: boolean;
}

/** AC5: one card's failure is one card's problem. */
export class MyDayCardBoundary extends Component<
  { title: string; children: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Logged rather than swallowed: a card that silently disappears is
    // indistinguishable from a card with nothing to show.
    console.error(`[my-day] card "${this.props.title}" failed`, error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>{this.props.title}</strong> could not load. The rest of your day is below.
          </span>
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}

export function MyDayCustomizer({
  layout,
  onSave,
  isSaving,
}: {
  layout: MyDayLayoutResponse | null;
  onSave: (cards: MyDayCardPref[]) => void;
  isSaving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ResolvedMyDayCard[] | null>(null);

  if (!layout) return null;

  // Hidden cards are edited alongside visible ones: a customiser that cannot
  // show you what you hid cannot let you get it back.
  const working =
    draft ??
    [...layout.cards, ...layout.hidden].sort((a, b) => a.order - b.order).map((c) => ({ ...c }));

  const toggle = (id: string) =>
    setDraft(working.map((c) => (c.id === id ? { ...c, hidden: !c.hidden } : c)));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Discard an abandoned edit rather than leaving it to reappear later.
        if (!next) setDraft(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="h-4 w-4 mr-1" /> Customize
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your day, your order</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          {working.map((card, i) => (
            <div key={card.id} className="flex items-center gap-2 rounded-md border p-2">
              <span className={card.hidden ? 'text-muted-foreground line-through' : ''}>
                {card.title}
              </span>
              {card.teamScope && (
                <Badge variant="outline" className="text-xs font-normal">
                  team
                </Badge>
              )}
              <div className="flex-1" />
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Move ${card.title} up`}
                disabled={i === 0}
                onClick={() => setDraft(reorder(working, String(card.id), 'up'))}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Move ${card.title} down`}
                disabled={i === working.length - 1}
                onClick={() => setDraft(reorder(working, String(card.id), 'down'))}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={card.hidden ? `Show ${card.title}` : `Hide ${card.title}`}
                onClick={() => toggle(String(card.id))}
              >
                {card.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          ))}
        </div>

        {layout.withheld.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {layout.withheld.length} card{layout.withheld.length === 1 ? '' : 's'} in your saved
            layout need a manager role and are not shown.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setDraft(null)}>
            Reset
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => {
              onSave(toPrefs(working));
              setDraft(null);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
