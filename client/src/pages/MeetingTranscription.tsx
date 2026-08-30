/**
 * Meeting Transcription console.
 *
 * AUDIT-019. This page used to hold three recordings, a transcript and six
 * action items in `useState([...])` literals - named speakers, a "94% AI
 * confidence", "127.5 hours transcribed" - with no useQuery, apiRequest or
 * fetch anywhere in the file. It also had a Start Recording button that
 * flipped a boolean and captured nothing, which is worse than a fixture: it
 * invites someone to believe a conversation is being recorded when no audio is
 * touched, on the one feature where LEGAL-009 says a participant must be told
 * before capture begins.
 *
 * Meanwhile supabase/functions/meeting-transcription/ was complete - upload,
 * transcription, notes, highlights, search, analytics and the consent ledger -
 * and had ZERO callers. Nothing had ever exercised it from either host, which
 * is how a dispatcher that never routed /recordings/:id/consent survived.
 *
 * Everything below comes from that function. The capture UI is gone rather
 * than mocked: there is no browser recording implementation to put a consent
 * notice in front of, and upload is the path that actually has one.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { MainLayout } from '@/components/layout/main-layout';
import { QueryState } from '@/components/ui/query-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, apiFormRequest } from '@/lib/queryClient';
import { ShieldCheck, ShieldAlert, Upload, FileText } from 'lucide-react';

/**
 * Kept in step with DEFAULT_RECORDING_NOTICE in
 * supabase/functions/meeting-transcription/_consent.ts, which is the wording
 * the server records when the caller supplies none. The operator needs to see
 * the exact words they are attesting the participants were given, so the two
 * copies are locked by server/tests/unit/recording-consent-notice.test.ts.
 */
export const DEFAULT_RECORDING_NOTICE =
  'This meeting is being recorded and transcribed. The recording and its transcript ' +
  'are stored by Printyx on behalf of the organizing company. Tell the host now if ' +
  'you do not agree to be recorded.';

const CONSENT_METHODS = [
  { value: 'verbal', label: 'Verbal, on the call' },
  { value: 'written', label: 'Written (email or signature)' },
  { value: 'checkbox', label: 'Checkbox in a form' },
  { value: 'in_meeting_announcement', label: 'Announced in the meeting' },
] as const;

const API = '/api/meeting-transcription';

interface Recording {
  id: string;
  meeting_id: string | null;
  recording_name: string | null;
  recording_format: string | null;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  recording_source: string | null;
  processing_status: string | null;
  transcription_status: string | null;
  ai_confidence_score: number | string | null;
  ai_speaker_count: number | null;
  uploaded_at: string | null;
}

interface ContentAnalytics {
  windowDays: number;
  transcriptionsProcessed: number;
  totalWordsTranscribed: number;
  averageConfidence: number;
  byProvider: { provider: string; count: number }[];
}

interface Transcription {
  full_transcript: string | null;
  transcript_segments: unknown;
  transcription_service: string | null;
  overall_confidence: number | string | null;
  word_count: number | null;
  speaker_count: number | null;
  transcribed_at: string | null;
}

interface ConsentAnswer {
  recordingId: string;
  consented: boolean;
  reason?: string;
  consent?: {
    status: string | null;
    source: string | null;
    consent_text: string | null;
    given_at: string | null;
    withdrawn_at: string | null;
    notes: string | null;
  };
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return 'Unknown';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return 'Unknown';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string | null }) {
  const value = status ?? 'unknown';
  const tone =
    value === 'completed'
      ? 'border-green-300 text-green-700'
      : value === 'failed'
        ? 'border-red-300 text-red-700'
        : 'border-muted-foreground/30 text-muted-foreground';
  return (
    <Badge variant="outline" className={tone}>
      {value}
    </Badge>
  );
}

export default function MeetingTranscription() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [meetingId, setMeetingId] = useState('');
  const [recordingName, setRecordingName] = useState('');
  const [consentMethod, setConsentMethod] = useState<string>('verbal');
  const [consentParticipants, setConsentParticipants] = useState('');
  const [consentNotice, setConsentNotice] = useState(DEFAULT_RECORDING_NOTICE);

  const recordingsQuery = useQuery<Recording[]>({
    queryKey: [`${API}/recordings`],
  });

  const analyticsQuery = useQuery<ContentAnalytics>({
    queryKey: [`${API}/analytics/content`],
  });

  const transcriptionQuery = useQuery<Transcription>({
    queryKey: [`${API}/recordings/${selectedId}/transcription`],
    enabled: selectedId !== null,
    retry: false,
  });

  const consentQuery = useQuery<ConsentAnswer>({
    queryKey: [`${API}/recordings/${selectedId}/consent`],
    enabled: selectedId !== null,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose an audio or video file first.');
      const form = new FormData();
      form.append('file', file);
      form.append('meetingId', meetingId);
      form.append('recordingName', recordingName || file.name);
      form.append('format', file.name.split('.').pop() || 'mp4');
      form.append('consentConfirmed', 'true');
      form.append('consentMethod', consentMethod);
      form.append('consentParticipants', consentParticipants);
      form.append('consentNoticeText', consentNotice);
      return await apiFormRequest(`${API}/upload`, 'POST', form);
    },
    onSuccess: () => {
      toast({ title: 'Recording uploaded', description: 'Consent was recorded with it.' });
      setUploadOpen(false);
      setFile(null);
      setMeetingId('');
      setRecordingName('');
      setConsentParticipants('');
      void queryClient.invalidateQueries({ queryKey: [`${API}/recordings`] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Upload refused',
        description: err instanceof Error ? err.message : 'The server rejected the upload.',
        variant: 'destructive',
      });
    },
  });

  const processMutation = useMutation({
    mutationFn: async (recordingId: string) =>
      await apiRequest(`${API}/recordings/${recordingId}/process`, 'POST'),
    onSuccess: () => {
      toast({ title: 'Transcription started' });
      void queryClient.invalidateQueries({ queryKey: [`${API}/recordings`] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Could not start transcription',
        description: err instanceof Error ? err.message : 'The request failed.',
        variant: 'destructive',
      });
    },
  });

  const selected = recordingsQuery.data?.find((r) => r.id === selectedId) ?? null;

  return (
    <MainLayout
      title="Meeting Transcription"
      description="Recordings, transcripts and the consent held for each one"
    >
      <div className="mb-6 flex justify-end">
        <Button onClick={() => setUploadOpen(true)} className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Upload recording
        </Button>
      </div>

      <QueryState
        query={analyticsQuery}
        loading={
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        }
        errorTitle="Could not load transcription analytics"
      >
        {(analytics) => (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-2xl font-bold tabular-nums">
                  {analytics.transcriptionsProcessed}
                </p>
                <p className="text-sm text-muted-foreground">
                  Transcriptions, last {analytics.windowDays} days
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-2xl font-bold tabular-nums">
                  {analytics.totalWordsTranscribed.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Words transcribed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-2xl font-bold tabular-nums">
                  {analytics.transcriptionsProcessed === 0
                    ? 'No data'
                    : analytics.averageConfidence.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Mean confidence reported by the provider
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-2xl font-bold">
                  {analytics.byProvider.length === 0
                    ? 'None'
                    : analytics.byProvider.map((p) => p.provider).join(', ')}
                </p>
                <p className="text-sm text-muted-foreground">Transcription provider</p>
              </CardContent>
            </Card>
          </div>
        )}
      </QueryState>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recordings</CardTitle>
            <CardDescription>Newest first. Select one to see its transcript.</CardDescription>
          </CardHeader>
          <CardContent>
            <QueryState
              query={recordingsQuery}
              loading={<Skeleton className="h-48" />}
              errorTitle="Could not load recordings"
              empty={
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No recordings yet. Upload one to get started.
                </p>
              }
            >
              {(recordings) => (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Name</th>
                        <th className="py-2 pr-4 font-medium">Length</th>
                        <th className="py-2 pr-4 font-medium">Size</th>
                        <th className="py-2 pr-4 font-medium">Transcription</th>
                        <th className="py-2 pr-4 font-medium">Uploaded</th>
                        <th className="py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {recordings.map((r) => (
                        <tr
                          key={r.id}
                          className={`border-b last:border-0 ${
                            r.id === selectedId ? 'bg-muted/50' : ''
                          }`}
                        >
                          <td className="py-3 pr-4">
                            <button
                              type="button"
                              className="text-left font-medium underline-offset-2 hover:underline"
                              onClick={() => setSelectedId(r.id)}
                            >
                              {r.recording_name || 'Untitled recording'}
                            </button>
                          </td>
                          <td className="py-3 pr-4 tabular-nums">
                            {formatDuration(r.duration_seconds)}
                          </td>
                          <td className="py-3 pr-4 tabular-nums">
                            {formatBytes(r.file_size_bytes)}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={r.transcription_status} />
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {r.uploaded_at
                              ? new Date(r.uploaded_at).toLocaleDateString()
                              : 'Unknown'}
                          </td>
                          <td className="py-3">
                            {r.transcription_status !== 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={processMutation.isPending}
                                onClick={() => processMutation.mutate(r.id)}
                              >
                                Transcribe
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </QueryState>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consent on file</CardTitle>
              <CardDescription>
                Recorded at upload and answerable months later, per LEGAL-009.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              {selectedId === null ? (
                <p className="text-muted-foreground">Select a recording.</p>
              ) : (
                <QueryState
                  query={consentQuery}
                  loading={<Skeleton className="h-24" />}
                  errorTitle="Could not read the consent record"
                >
                  {(answer) => (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {answer.consented ? (
                          <ShieldCheck className="h-4 w-4 text-green-600" />
                        ) : (
                          <ShieldAlert className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium">
                          {answer.consented ? 'Consent recorded' : 'No consent on file'}
                        </span>
                      </div>
                      {answer.reason && <p className="text-muted-foreground">{answer.reason}</p>}
                      {answer.consent && (
                        <dl className="space-y-1 text-muted-foreground">
                          <div className="flex justify-between gap-4">
                            <dt>How</dt>
                            <dd className="text-foreground">
                              {answer.consent.source ?? 'Unknown'}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt>Given</dt>
                            <dd className="text-foreground">
                              {answer.consent.given_at
                                ? new Date(answer.consent.given_at).toLocaleString()
                                : 'Unknown'}
                            </dd>
                          </div>
                          {answer.consent.withdrawn_at && (
                            <div className="flex justify-between gap-4">
                              <dt>Withdrawn</dt>
                              <dd className="text-foreground">
                                {new Date(answer.consent.withdrawn_at).toLocaleString()}
                              </dd>
                            </div>
                          )}
                          {answer.consent.consent_text && (
                            <p className="pt-2 text-foreground">{answer.consent.consent_text}</p>
                          )}
                          {answer.consent.notes && <p className="pt-1">{answer.consent.notes}</p>}
                        </dl>
                      )}
                    </div>
                  )}
                </QueryState>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transcript</CardTitle>
              {selected && <CardDescription>{selected.recording_name}</CardDescription>}
            </CardHeader>
            <CardContent className="text-sm">
              {selectedId === null ? (
                <p className="text-muted-foreground">Select a recording.</p>
              ) : transcriptionQuery.isLoading ? (
                <Skeleton className="h-32" />
              ) : transcriptionQuery.isError || !transcriptionQuery.data ? (
                <p className="text-muted-foreground">
                  No transcript yet. Use Transcribe on the recording to produce one.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                    <span>{transcriptionQuery.data.word_count ?? 0} words</span>
                    <span>{transcriptionQuery.data.speaker_count ?? 0} speakers</span>
                    <span>
                      {transcriptionQuery.data.transcription_service ?? 'unknown provider'}
                    </span>
                  </div>
                  <p className="max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {transcriptionQuery.data.full_transcript || 'The transcript is empty.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload a recording</DialogTitle>
            <DialogDescription>
              The server refuses a recording without consent. Say how the participants agreed and
              who they were; the answer is stored with the audio and can be produced later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recording-file">Audio or video file</Label>
              <Input
                id="recording-file"
                type="file"
                accept="audio/*,video/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recording-meeting">Meeting ID</Label>
              <Input
                id="recording-meeting"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                placeholder="UUID of the meeting this belongs to"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recording-name">Name</Label>
              <Input
                id="recording-name"
                value={recordingName}
                onChange={(e) => setRecordingName(e.target.value)}
                placeholder={file?.name ?? 'Defaults to the file name'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="consent-method">How consent was obtained</Label>
              <Select value={consentMethod} onValueChange={setConsentMethod}>
                <SelectTrigger id="consent-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONSENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="consent-participants">Who agreed</Label>
              <Textarea
                id="consent-participants"
                rows={3}
                value={consentParticipants}
                onChange={(e) => setConsentParticipants(e.target.value)}
                placeholder="One name per line, or comma separated"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="consent-notice">Notice they were given</Label>
              <Textarea
                id="consent-notice"
                rows={4}
                value={consentNotice}
                onChange={(e) => setConsentNotice(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || !file || !meetingId || !consentParticipants}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              {uploadMutation.isPending ? 'Uploading...' : 'Upload with consent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
