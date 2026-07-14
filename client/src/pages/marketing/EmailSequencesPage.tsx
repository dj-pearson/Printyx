/**
 * CRMX-009: Email Sequences admin — enroll recipients into a campaign's drip
 * sequence and view/unenroll per-recipient state.
 */
import { useMemo, useState } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { useEmailCampaigns, useSequenceEnrollments } from '@/hooks/useEmailSequences';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Mail, UserMinus, Send } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  sending: 'default',
  completed: 'secondary',
  stopped: 'outline',
  unsubscribed: 'outline',
  bounced: 'destructive',
  failed: 'destructive',
};

function parseEmails(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)),
    ),
  );
}

export default function EmailSequencesPage() {
  const { toast } = useToast();
  const { data: campaigns = [], isLoading: campaignsLoading } = useEmailCampaigns();
  const [campaignId, setCampaignId] = useState<string | undefined>(undefined);
  const [emailsInput, setEmailsInput] = useState('');

  const {
    data: enrollments = [],
    isLoading,
    enroll,
    unenroll,
  } = useSequenceEnrollments(campaignId);

  // Drip/automated campaigns are the ones with a step sequence.
  const sequenceCampaigns = useMemo(
    () => campaigns.filter((c) => ['drip', 'automated'].includes(c.campaignType)),
    [campaigns],
  );

  const parsedEmails = useMemo(() => parseEmails(emailsInput), [emailsInput]);

  const handleEnroll = async () => {
    if (!campaignId || parsedEmails.length === 0) return;
    try {
      const res = (await enroll.mutateAsync(parsedEmails.map((email) => ({ email })))) as {
        results?: Array<{ enrolled: boolean }>;
      };
      const added = (res.results ?? []).filter((r) => r.enrolled).length;
      setEmailsInput('');
      toast({
        title: `Enrolled ${added} recipient${added === 1 ? '' : 's'}`,
        description:
          added < parsedEmails.length
            ? `${parsedEmails.length - added} were already enrolled or suppressed.`
            : undefined,
      });
    } catch {
      toast({ title: 'Failed to enroll recipients', variant: 'destructive' });
    }
  };

  const handleUnenroll = async (id: string) => {
    try {
      await unenroll.mutateAsync(id);
      toast({ title: 'Recipient unenrolled' });
    } catch {
      toast({ title: 'Failed to unenroll', variant: 'destructive' });
    }
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Email Sequences</h1>
          <p className="text-muted-foreground text-sm">
            Enroll recipients into a drip campaign; steps auto-advance and stop on unsubscribe.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Campaign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaignsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : sequenceCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No drip or automated campaigns found. Create one (with sequence steps) to enroll
                recipients.
              </p>
            ) : (
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a drip campaign…" />
                </SelectTrigger>
                <SelectContent>
                  {sequenceCampaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.sequenceSteps?.length ?? 0} step
                      {(c.sequenceSteps?.length ?? 0) === 1 ? '' : 's'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {campaignId && (
              <div className="space-y-2 pt-1">
                <Label htmlFor="emails">Enroll recipients (emails)</Label>
                <Textarea
                  id="emails"
                  value={emailsInput}
                  onChange={(e) => setEmailsInput(e.target.value)}
                  placeholder="jane@acme.com, john@globex.com"
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {parsedEmails.length} valid email{parsedEmails.length === 1 ? '' : 's'}
                  </span>
                  <Button
                    size="sm"
                    onClick={handleEnroll}
                    disabled={parsedEmails.length === 0 || enroll.isPending}
                    className="gap-1.5"
                  >
                    <Send className="h-4 w-4" /> Enroll
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {campaignId && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Enrollments ({enrollments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : enrollments.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Mail className="mx-auto h-8 w-8 mb-2" />
                  <p className="text-sm">No recipients enrolled yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Step</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Next send</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrollments.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm">{e.recipientEmail}</TableCell>
                          <TableCell>
                            <Badge
                              variant={STATUS_VARIANT[e.status] ?? 'secondary'}
                              className="capitalize text-[10px]"
                            >
                              {e.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs tabular-nums">{e.currentStep}</TableCell>
                          <TableCell className="text-xs tabular-nums">{e.sendCount}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {e.nextSendAt ? new Date(e.nextSendAt).toLocaleString() : '—'}
                          </TableCell>
                          <TableCell>
                            {['active', 'sending'].includes(e.status) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 text-destructive"
                                onClick={() => handleUnenroll(e.id)}
                                disabled={unenroll.isPending}
                              >
                                <UserMinus className="h-3.5 w-3.5" /> Stop
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
