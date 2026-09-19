/**
 * Enroll a record in an email sequence, from the record (WF-S-04).
 *
 * The enrol/unenrol endpoints, the step state machine and the SendGrid send
 * have all worked since CRMX-009, and the only surface that could reach them
 * was EmailSequencesPage - a standalone campaign screen. A rep looking at a
 * lead had no way to nurture it without leaving the record, finding the
 * campaign and typing the address back in. This is the same mutation, offered
 * where the decision is made.
 *
 * One component for every caller: the lead record, the account record and the
 * CRM list's bulk action. Bulk is the same endpoint - it takes an array of
 * recipients - so nothing special happens for many records.
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useEmailCampaigns, useSequenceEnrollments } from '@/hooks/useEmailSequences';

/** A record that can be enrolled: an id to link to, and an address to send to. */
export interface EnrollableRecord {
  id: string;
  email?: string | null;
  name?: string | null;
}

interface EnrollInSequenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: EnrollableRecord[];
}

/**
 * Only drip and automated campaigns run as sequences. A one-off blast has no
 * steps, so enrolling into it would complete immediately and send nothing -
 * which reads to the rep as a sequence that silently did not work.
 */
const SEQUENCE_TYPES = ['drip', 'automated'];

export function EnrollInSequenceDialog({
  open,
  onOpenChange,
  records,
}: EnrollInSequenceDialogProps) {
  const { toast } = useToast();
  const [campaignId, setCampaignId] = useState<string>('');
  const { data: campaigns = [], isLoading: campaignsLoading } = useEmailCampaigns();
  const { enroll } = useSequenceEnrollments(campaignId || undefined);

  const sequences = campaigns.filter((c) => SEQUENCE_TYPES.includes(c.campaignType));

  // A record with no address cannot be enrolled - the endpoint requires a valid
  // email on every recipient and rejects the whole batch otherwise, so they are
  // separated here and reported rather than silently dropped.
  const sendable = records.filter((r) => Boolean(r.email && r.email.trim()));
  const unreachable = records.length - sendable.length;

  useEffect(() => {
    if (!open) setCampaignId('');
  }, [open]);

  const submit = async () => {
    if (!campaignId || sendable.length === 0) return;
    try {
      const response = (await enroll.mutateAsync(
        sendable.map((r) => ({ email: String(r.email).trim(), businessRecordId: r.id })),
      )) as { results?: Array<{ email: string; enrolled: boolean }> };

      // The endpoint reports per recipient, because "already enrolled" and
      // "unsubscribed" both come back as enrolled:false and a count of
      // successes alone would hide them. Say which happened.
      const results = response?.results ?? [];
      const added = results.filter((r) => r.enrolled).length;
      const skipped = results.length - added;
      toast({
        title: added > 0 ? 'Enrolled' : 'Nothing enrolled',
        description:
          skipped > 0
            ? `${added} enrolled, ${skipped} skipped (already enrolled or unsubscribed).`
            : `${added} enrolled.`,
        variant: added > 0 ? undefined : 'destructive',
      });
      if (added > 0) onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Could not enroll',
        description: error?.message || 'The sequence enrollment failed.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll in an email sequence</DialogTitle>
          <DialogDescription>
            {records.length === 1
              ? (records[0]?.name ?? 'This record')
              : `${records.length} records`}{' '}
            will receive the sequence from its first step.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {unreachable > 0 && (
            <p className="text-sm text-amber-700">
              {unreachable} of {records.length} have no email address and will be left out.
            </p>
          )}

          {campaignsLoading ? (
            <p className="text-sm text-muted-foreground">Loading sequences...</p>
          ) : sequences.length === 0 ? (
            /* Said plainly rather than shown as an empty dropdown: there is
               nothing wrong here, the tenant has not built a sequence yet. */
            <p className="text-sm text-muted-foreground">
              No drip or automated campaigns exist yet. Create one under Email Sequences first.
            </p>
          ) : (
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger aria-label="Sequence">
                <SelectValue placeholder="Choose a sequence" />
              </SelectTrigger>
              <SelectContent>
                {sequences.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name || 'Untitled campaign'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!campaignId || sendable.length === 0 || enroll.isPending}
            >
              {enroll.isPending ? 'Enrolling...' : `Enroll ${sendable.length || ''}`.trim()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
