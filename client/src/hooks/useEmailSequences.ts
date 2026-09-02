/**
 * CRMX-009: admin hook for email sequence (drip) enrollment.
 * Campaigns come from /api/email-marketing/email-campaigns; enrollment state
 * from /api/email-sequences/* (server/routes-email-sequences.ts).
 *
 * AUDIT-037: this used to call /api/email-campaigns and read camelCase off the
 * response. Every campaigns endpoint here returns raw snake_case rows, so
 * campaignType was undefined on every row and EmailSequencesPage's
 * `['drip','automated'].includes(c.campaignType)` filter matched nothing - the
 * page said "No drip or automated campaigns found" whatever the tenant had, and
 * nobody could enroll anyone. The mapping below is why the interface stays
 * camelCase: the page reads it, and the boundary is the right place to convert.
 *
 * The column names are not guesses - email_campaigns stores campaign_name and
 * campaign_type, not name and type, and there is no `name` column at all.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface EmailCampaign {
  id: string;
  name: string;
  campaignType: string;
  status: string;
  subject: string;
  sequenceSteps?: unknown[] | null;
  currentStep?: number | null;
}

export interface SequenceHistoryEntry {
  step: number;
  sentAt: string;
  status: 'sent' | 'failed' | 'skipped';
  messageId?: string;
  error?: string;
}

export interface SequenceEnrollment {
  id: string;
  campaignId: string;
  recipientEmail: string;
  businessRecordId: string | null;
  currentStep: number;
  status: 'active' | 'sending' | 'completed' | 'stopped' | 'unsubscribed' | 'bounced' | 'failed';
  nextSendAt: string | null;
  lastSentAt: string | null;
  stoppedReason: string | null;
  sendCount: number;
  history: SequenceHistoryEntry[];
  createdAt: string;
}

/** One row of email_campaigns as PostgREST returns it. */
interface EmailCampaignRow {
  id: string;
  campaign_name?: string | null;
  campaign_type?: string | null;
  status?: string | null;
  subject?: string | null;
  sequence_steps?: unknown[] | null;
  current_step?: number | null;
}

function toCampaign(row: EmailCampaignRow): EmailCampaign {
  return {
    id: row.id,
    name: row.campaign_name ?? '',
    campaignType: row.campaign_type ?? '',
    status: row.status ?? '',
    subject: row.subject ?? '',
    sequenceSteps: Array.isArray(row.sequence_steps) ? row.sequence_steps : null,
    currentStep: row.current_step ?? null,
  };
}

export function useEmailCampaigns() {
  return useQuery<EmailCampaign[]>({
    queryKey: ['/api/email-marketing/email-campaigns'],
    queryFn: async () => {
      const res = await apiRequest('/api/email-marketing/email-campaigns');
      const rows = (Array.isArray(res) ? res : (res?.data ?? res?.campaigns ?? [])) as
        | EmailCampaignRow[]
        | undefined;
      return (rows ?? []).map(toCampaign);
    },
    staleTime: 30_000,
  });
}

export function useSequenceEnrollments(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['/api/email-sequences', campaignId, 'enrollments'];

  const query = useQuery<SequenceEnrollment[]>({
    queryKey,
    queryFn: async () =>
      (await apiRequest(`/api/email-sequences/${campaignId}/enrollments`)) as SequenceEnrollment[],
    enabled: !!campaignId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const enroll = useMutation({
    mutationFn: async (recipients: Array<{ email: string; businessRecordId?: string }>) =>
      apiRequest(`/api/email-sequences/${campaignId}/enroll`, 'POST', { recipients }),
    onSuccess: invalidate,
  });

  const unenroll = useMutation({
    mutationFn: async (enrollmentId: string) =>
      apiRequest(`/api/email-sequences/enrollments/${enrollmentId}/unenroll`, 'POST', {
        reason: 'manual',
      }),
    onSuccess: invalidate,
  });

  return { ...query, enroll, unenroll };
}
