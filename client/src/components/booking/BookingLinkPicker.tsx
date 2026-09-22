/**
 * Booking link picker (COP-B14 AC5).
 *
 * AC5 has two halves. The first - a link copyable from the booking-pages admin
 * - shipped with CRMX-016. This is the second: the same link reachable from a
 * RECORD, where a rep is looking at the prospect they want to meet, and from
 * the SEQUENCE composer, where the link has to land inside the email body.
 *
 * One component serves both because the hard parts are shared: which pages are
 * offerable (active ones), which is likely meant (the caller's own), and what
 * origin the URL carries (see lib/booking-link.ts - a localhost link pasted
 * into a stored template is dead mail).
 *
 * `onInsert` is what separates the two uses. Given one, each row offers Insert
 * and the dialog closes on it; without one, the rows only copy. Nothing
 * fabricates a link: a tenant with no active page gets a sentence saying so
 * and a way to create one, not a disabled-looking row or a guessed slug.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { bookingLink } from '@/lib/booking-link';
import { Copy, CornerDownLeft, CalendarClock } from 'lucide-react';

interface BookingPageRow {
  id: string;
  slug: string;
  title: string;
  is_active: boolean;
  booking_type: string;
  duration_minutes: number;
  owner_user_id: string;
}

export interface BookingLinkPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Given, each row offers Insert and the dialog closes after one. */
  onInsert?: (url: string) => void;
}

export function BookingLinkPicker({ open, onOpenChange, onInsert }: BookingLinkPickerProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery<BookingPageRow[]>({
    // Same key as BookingPages.tsx so creating a page there refreshes this list.
    queryKey: ['/api/booking-pages'],
    queryFn: () => apiRequest('/api/booking-pages'),
    enabled: open,
  });

  const myId = user?.id;
  const pages = useMemo(() => {
    const rows = (data ?? []).filter((p) => p.is_active);
    return rows.sort((a, b) => {
      const mine = Number(b.owner_user_id === myId) - Number(a.owner_user_id === myId);
      if (mine !== 0) return mine;
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [data, myId]);

  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  function linkFor(slug: string) {
    return bookingLink(slug, origin);
  }

  async function copy(url: string, canonical: boolean) {
    await navigator.clipboard.writeText(url);
    toast({
      title: 'Booking link copied',
      description: canonical
        ? 'Copied with the printyx.net address, not this one - the page you are on is not reachable from outside.'
        : url,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Booking link</DialogTitle>
          <DialogDescription>
            {onInsert
              ? 'Insert a self-scheduling link into this step.'
              : 'Copy a self-scheduling link to send to this prospect.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive">
            Could not load your booking pages. Try again in a moment.
          </p>
        )}

        {!isLoading && !isError && pages.length === 0 && (
          <div className="text-sm text-muted-foreground space-y-3 py-2">
            <p>
              No active booking pages yet. A link only exists once there is a page behind it, so
              there is nothing to insert.
            </p>
            <Link href="/booking-pages">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                <CalendarClock className="h-4 w-4 mr-1" /> Create a booking page
              </Button>
            </Link>
          </div>
        )}

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {pages.map((page) => {
            const link = linkFor(page.slug);
            if (!link) return null;
            return (
              <div
                key={page.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{page.title}</span>
                    {page.owner_user_id === myId && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                        Mine
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      {page.duration_minutes} min
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Copy booking link for ${page.title}`}
                    onClick={() => copy(link.url, link.usedCanonicalOrigin)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {onInsert && (
                    <Button
                      size="sm"
                      onClick={() => {
                        onInsert(link.url);
                        onOpenChange(false);
                      }}
                    >
                      <CornerDownLeft className="h-4 w-4 mr-1" /> Insert
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {pages.some((p) => linkFor(p.slug)?.usedCanonicalOrigin) && (
          <p className="text-xs text-muted-foreground">
            These links use printyx.net because the address you are on now is not reachable from
            outside this machine.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
