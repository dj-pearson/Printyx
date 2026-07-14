/**
 * CRMX-009: admin hook for email sequence (drip) enrollment.
 * Campaigns come from /api/email-campaigns; enrollment state from
 * /api/email-sequences/* (server/routes-email-sequences.ts).
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

export function useEmailCampaigns() {
  return useQuery<EmailCampaign[]>({
    queryKey: ['/api/email-campaigns'],
    queryFn: async () => {
      const res = await apiRequest('/api/email-campaigns');
      return (Array.isArray(res) ? res : (res?.data ?? res?.campaigns ?? [])) as EmailCampaign[];
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
