/**
 * Log a platform CRM activity (round 198 on the business record page, shared
 * with the deal page in round 211, whose Log Activity button had no handler).
 *
 * One dialog so the two pages cannot drift: POST /platform-activities requires
 * a businessRecordId and records the CALLER as the author (round 198 removed
 * createdBy from the writable map), so neither page sends an author. A deal
 * page passes its dealId too, so the activity appears on the deal's timeline
 * as well as the account's.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { describeApiError } from '@/lib/api-error';

export const PLATFORM_ACTIVITY_TYPES = ['call', 'email', 'meeting', 'demo', 'note'] as const;

/** The POST body; blank text is omitted rather than stored as ''. */
export function platformActivityBody(input: {
  businessRecordId: string;
  dealId?: string;
  activityType: string;
  subject: string;
  description: string;
}): Record<string, string | undefined> {
  return {
    businessRecordId: input.businessRecordId,
    dealId: input.dealId || undefined,
    activityType: input.activityType,
    subject: input.subject.trim() || undefined,
    description: input.description.trim() || undefined,
  };
}

export function LogPlatformActivityDialog({
  open,
  onOpenChange,
  businessRecordId,
  dealId,
  invalidate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessRecordId: string;
  dealId?: string;
  /** Query keys to refresh after a successful log. */
  invalidate: string[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const empty = { activityType: 'call', subject: '', description: '' };
  const [draft, setDraft] = useState(empty);

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest(
        '/api/platform-activities',
        'POST',
        platformActivityBody({ businessRecordId, dealId, ...draft }),
      ),
    onSuccess: () => {
      for (const key of invalidate) queryClient.invalidateQueries({ queryKey: [key] });
      toast({ title: 'Activity logged' });
      setDraft(empty);
      onOpenChange(false);
    },
    onError: (err) =>
      toast({
        title: 'Could not log activity',
        description: describeApiError(err).message,
        variant: 'destructive',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log activity</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div>
            <Label htmlFor="activity-type">Type</Label>
            <Select
              value={draft.activityType}
              onValueChange={(activityType) => setDraft({ ...draft, activityType })}
            >
              <SelectTrigger id="activity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="activity-subject">Subject</Label>
            <Input
              id="activity-subject"
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="activity-description">Notes</Label>
            <Textarea
              id="activity-description"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Log activity'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
