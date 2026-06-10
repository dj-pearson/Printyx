// PROP-008: public, unauthenticated proposal view at /p/:token.
//
// Renders the branded, customer-safe proposal sections and lets the customer
// accept or decline. No app shell, no auth — data comes from the token-gated
// public edge route, which never returns cost/margin/internal fields.

import { useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/config';
import { sanitizeRichHtml } from '@/lib/sanitize-html';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface PublicProposal {
  proposal: {
    proposal_number: string;
    title: string;
    status: string;
    valid_until: string | null;
    total_amount: string | number | null;
    accepted_at: string | null;
    rejected_at: string | null;
  };
  sections: Array<{ section_title?: string | null; html_content?: string | null }>;
  branding: {
    companyName?: string | null;
    logoUrl?: string | null;
    primaryColor?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  customerName: string | null;
}

async function fetchPublic(token: string): Promise<PublicProposal> {
  const res = await fetch(getApiUrl(`/api/proposals/public/${token}`), {
    credentials: 'include',
  });
  if (res.status === 404) throw new Error('NOT_FOUND');
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  return res.json();
}

export default function ProposalPublicView() {
  const [, params] = useRoute('/p/:token');
  const token = params?.token ?? '';
  const [dialogAction, setDialogAction] = useState<'accept' | 'decline' | null>(null);
  const [signerName, setSignerName] = useState('');
  const [done, setDone] = useState<null | 'accepted' | 'rejected'>(null);

  const { data, isLoading, isError, error } = useQuery<PublicProposal>({
    queryKey: ['public-proposal', token],
    queryFn: () => fetchPublic(token),
    enabled: !!token,
    retry: false,
  });

  const respond = useMutation({
    mutationFn: async (action: 'accept' | 'decline') => {
      const res = await fetch(getApiUrl(`/api/proposals/public/${token}/respond`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, name: signerName }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      return res.json() as Promise<{ status: 'accepted' | 'rejected' }>;
    },
    onSuccess: (r) => {
      setDone(r.status);
      setDialogAction(null);
    },
  });

  const brandColor = data?.branding?.primaryColor || '#0066CC';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading proposal…
      </div>
    );
  }

  if (isError) {
    const notFound = (error as Error)?.message === 'NOT_FOUND';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
        <h1 className="text-xl font-semibold mb-1">
          {notFound ? 'This proposal link is no longer available' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {notFound
            ? 'The link may have expired or been revoked. Please contact your sales representative.'
            : (error as Error)?.message}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const { proposal, sections, branding } = data;
  const alreadyResolved =
    done ??
    (proposal.status === 'accepted'
      ? 'accepted'
      : proposal.status === 'rejected'
        ? 'rejected'
        : null);

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-3">
      {/* Branded header */}
      <header
        className="max-w-3xl mx-auto rounded-t-lg px-6 py-5 flex items-center justify-between"
        style={{ backgroundColor: brandColor }}
      >
        <div className="text-white">
          <h1 className="text-xl font-bold">{proposal.title}</h1>
          <p className="text-sm opacity-90">Quote #{proposal.proposal_number}</p>
        </div>
        {branding?.logoUrl && (
          <img
            src={branding.logoUrl}
            alt={branding.companyName ?? 'Company logo'}
            className="max-h-12 max-w-[160px] object-contain bg-white/0"
          />
        )}
      </header>

      {/* Document body */}
      <main className="max-w-3xl mx-auto bg-white shadow-sm px-6 py-8 space-y-6">
        {sections.length === 0 ? (
          <p className="text-muted-foreground">This proposal has no content yet.</p>
        ) : (
          sections.map((s, i) => (
            <section
              key={i}
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(s.html_content ?? '') }}
            />
          ))
        )}
      </main>

      {/* Actions / status */}
      <footer className="max-w-3xl mx-auto bg-white border-t rounded-b-lg px-6 py-5">
        {alreadyResolved === 'accepted' ? (
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" /> You accepted this proposal. Thank you!
          </div>
        ) : alreadyResolved === 'rejected' ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <XCircle className="h-5 w-5" /> This proposal was declined.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {proposal.valid_until
                ? `Valid until ${new Date(proposal.valid_until).toLocaleDateString()}`
                : 'Review and respond below.'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogAction('decline')}>
                Decline
              </Button>
              <Button
                style={{ backgroundColor: brandColor }}
                onClick={() => setDialogAction('accept')}
              >
                Accept Proposal
              </Button>
            </div>
          </div>
        )}
        {branding && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            {[branding.companyName, branding.phone, branding.email].filter(Boolean).join('  •  ')}
          </p>
        )}
      </footer>

      <Dialog open={dialogAction !== null} onOpenChange={(o) => !o && setDialogAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'accept' ? 'Accept this proposal' : 'Decline this proposal'}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === 'accept'
                ? 'Enter your name to confirm acceptance. This authorizes the work described.'
                : 'Enter your name to confirm you are declining this proposal.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Your full name</Label>
            <Input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Jane Buyer"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAction(null)}>
              Cancel
            </Button>
            <Button
              disabled={!signerName.trim() || respond.isPending}
              style={dialogAction === 'accept' ? { backgroundColor: brandColor } : undefined}
              variant={dialogAction === 'decline' ? 'destructive' : 'default'}
              onClick={() => respond.mutate(dialogAction!)}
            >
              {respond.isPending
                ? 'Submitting…'
                : dialogAction === 'accept'
                  ? 'Confirm Acceptance'
                  : 'Confirm Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
