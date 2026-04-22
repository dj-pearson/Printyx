import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Wand2,
  Sparkles,
  Copy,
  Check,
  UserPlus,
  Mail,
  Linkedin,
  AlertCircle,
  Send,
} from 'lucide-react';

interface Prospect {
  id: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  companyName?: string;
  email?: string;
  industry?: string;
  city?: string;
  state?: string;
  triggerSignal?: string;
}

interface Sequence {
  id: string;
  name: string;
  angle?: string;
  includesEmail: boolean;
  includesLinkedin: boolean;
}

interface Step {
  id: string;
  stepOrder: number;
  channel: string;
  subjectTemplate?: string;
  bodyTemplate: string;
}

interface Draft {
  id: string;
  channel: string;
  subject?: string;
  body: string;
  variants?: Array<{ subject?: string; body: string; rationale?: string }>;
  selectedVariantIndex?: number;
  status: string;
  generationContext?: { spamFlags?: string[] };
  prospect?: Prospect | null;
}

export default function DraftGenerator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedProspectId, setSelectedProspectId] = useState<string>('');
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>('');
  const [selectedStepId, setSelectedStepId] = useState<string>('');
  const [channel, setChannel] = useState<
    'email' | 'linkedin_connect' | 'linkedin_message' | 'linkedin_inmail'
  >('email');
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [showNewProspect, setShowNewProspect] = useState(false);
  const [newProspect, setNewProspect] = useState<Partial<Prospect>>({});

  const { data: prospectsData } = useQuery<{ prospects: Prospect[] }>({
    queryKey: ['/api/outreach/prospects'],
    queryFn: () => apiRequest('/api/outreach/prospects'),
  });

  const { data: seqsData } = useQuery<{ sequences: Sequence[] }>({
    queryKey: ['/api/outreach/sequences'],
    queryFn: () => apiRequest('/api/outreach/sequences'),
  });

  const { data: seqDetailData } = useQuery<{ sequence: Sequence; steps: Step[] }>({
    queryKey: ['/api/outreach/sequences', selectedSequenceId],
    queryFn: () => apiRequest(`/api/outreach/sequences/${selectedSequenceId}`),
    enabled: !!selectedSequenceId,
  });

  const { data: draftsData } = useQuery<{ drafts: Draft[] }>({
    queryKey: ['/api/outreach/drafts'],
    queryFn: () => apiRequest('/api/outreach/drafts'),
  });

  const createProspectMutation = useMutation({
    mutationFn: (data: Partial<Prospect>) =>
      apiRequest('/api/outreach/prospects', 'POST', { ...data, source: 'manual' }),
    onSuccess: (result: { prospect: Prospect }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/prospects'] });
      setSelectedProspectId(result.prospect.id);
      setShowNewProspect(false);
      setNewProspect({});
      toast({ title: 'Prospect added' });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/outreach/drafts/generate', 'POST', {
        prospectId: selectedProspectId,
        sequenceId: selectedSequenceId || undefined,
        stepId: selectedStepId || undefined,
        channel,
      }),
    onSuccess: (result: { draft: Draft }) => {
      setActiveDraft(result.draft);
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/drafts'] });
      toast({ title: 'Draft generated' });
    },
    onError: (err: any) =>
      toast({
        title: 'Generation failed',
        description: err?.message || 'AI call failed',
        variant: 'destructive',
      }),
  });

  const markSentMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/outreach/drafts/${id}/mark-sent`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/drafts'] });
      toast({ title: 'Marked as sent' });
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Draft> }) =>
      apiRequest(`/api/outreach/drafts/${id}`, 'PATCH', patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/drafts'] });
    },
  });

  const selectedProspect = prospectsData?.prospects.find((p) => p.id === selectedProspectId);

  const copyToClipboard = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Select and copy manually',
        variant: 'destructive',
      });
    }
  };

  const canGenerate = !!selectedProspectId && !generateMutation.isPending;

  const availableSteps = seqDetailData?.steps.filter((s) => {
    if (channel === 'email') return s.channel === 'email';
    return s.channel.startsWith('linkedin');
  });

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-4 max-w-7xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Wand2 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-semibold">Draft Generator</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Pick a prospect, pick a sequence step, generate. Copy. Paste. Send.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[380px_1fr] gap-4">
          {/* Left panel: generate controls */}
          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">1. Prospect</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Select value={selectedProspectId} onValueChange={setSelectedProspectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a prospect" />
                  </SelectTrigger>
                  <SelectContent>
                    {prospectsData?.prospects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {[p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown'} —{' '}
                        {p.companyName || p.email || '(no company)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowNewProspect(!showNewProspect)}
                >
                  <UserPlus className="h-4 w-4 mr-1" /> Add new prospect
                </Button>
                {showNewProspect && (
                  <div className="space-y-2 border rounded-md p-3 bg-muted/30">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="First name"
                        value={newProspect.firstName || ''}
                        onChange={(e) =>
                          setNewProspect({ ...newProspect, firstName: e.target.value })
                        }
                      />
                      <Input
                        placeholder="Last name"
                        value={newProspect.lastName || ''}
                        onChange={(e) =>
                          setNewProspect({ ...newProspect, lastName: e.target.value })
                        }
                      />
                    </div>
                    <Input
                      placeholder="Title"
                      value={newProspect.title || ''}
                      onChange={(e) => setNewProspect({ ...newProspect, title: e.target.value })}
                    />
                    <Input
                      placeholder="Company"
                      value={newProspect.companyName || ''}
                      onChange={(e) =>
                        setNewProspect({ ...newProspect, companyName: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Email"
                      value={newProspect.email || ''}
                      onChange={(e) => setNewProspect({ ...newProspect, email: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Industry"
                        value={newProspect.industry || ''}
                        onChange={(e) =>
                          setNewProspect({ ...newProspect, industry: e.target.value })
                        }
                      />
                      <Input
                        placeholder="City"
                        value={newProspect.city || ''}
                        onChange={(e) => setNewProspect({ ...newProspect, city: e.target.value })}
                      />
                    </div>
                    <Textarea
                      placeholder="Trigger signal (what makes this prospect timely)"
                      rows={2}
                      value={newProspect.triggerSignal || ''}
                      onChange={(e) =>
                        setNewProspect({ ...newProspect, triggerSignal: e.target.value })
                      }
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => createProspectMutation.mutate(newProspect)}
                      disabled={createProspectMutation.isPending}
                    >
                      Save prospect
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedProspect && (
              <Card>
                <CardContent className="py-3 text-sm space-y-1">
                  <div className="font-medium">
                    {[selectedProspect.firstName, selectedProspect.lastName]
                      .filter(Boolean)
                      .join(' ')}
                  </div>
                  {selectedProspect.title && (
                    <div className="text-muted-foreground">{selectedProspect.title}</div>
                  )}
                  {selectedProspect.companyName && <div>{selectedProspect.companyName}</div>}
                  {selectedProspect.triggerSignal && (
                    <div className="text-xs bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded p-2 mt-1">
                      <strong>Trigger:</strong> {selectedProspect.triggerSignal}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">2. Channel</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="linkedin_connect">LinkedIn connect request</SelectItem>
                    <SelectItem value="linkedin_message">LinkedIn message</SelectItem>
                    <SelectItem value="linkedin_inmail">LinkedIn InMail</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">3. Sequence step (optional)</CardTitle>
                <CardDescription className="text-xs">
                  Base on a saved template, or skip for ad-hoc
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Select
                  value={selectedSequenceId || '__adhoc__'}
                  onValueChange={(v) => {
                    setSelectedSequenceId(v === '__adhoc__' ? '' : v);
                    setSelectedStepId('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ad-hoc (no sequence)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__adhoc__">Ad-hoc (no sequence)</SelectItem>
                    {seqsData?.sequences.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSequenceId && availableSteps && availableSteps.length > 0 && (
                  <Select value={selectedStepId} onValueChange={setSelectedStepId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a step" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSteps.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          Step {s.stepOrder} — {s.subjectTemplate || s.bodyTemplate.slice(0, 40)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>

            <Button
              className="w-full"
              size="lg"
              disabled={!canGenerate}
              onClick={() => generateMutation.mutate()}
            >
              <Sparkles className="h-5 w-5 mr-2" />
              {generateMutation.isPending ? 'Generating...' : 'Generate draft'}
            </Button>
          </div>

          {/* Right panel: draft + history */}
          <div className="space-y-4">
            {activeDraft && (
              <Card className="border-primary">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {activeDraft.channel === 'email' ? (
                        <Mail className="h-5 w-5 text-primary" />
                      ) : (
                        <Linkedin className="h-5 w-5 text-primary" />
                      )}
                      <div>
                        <CardTitle className="text-lg">Generated draft</CardTitle>
                        <CardDescription>
                          {activeDraft.variants?.length || 1} variant
                          {activeDraft.variants?.length === 1 ? '' : 's'} — review and pick the
                          strongest
                        </CardDescription>
                      </div>
                    </div>
                    {activeDraft.generationContext?.spamFlags &&
                      activeDraft.generationContext.spamFlags.length > 0 && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {activeDraft.generationContext.spamFlags.length} spam flag
                        </Badge>
                      )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(
                    activeDraft.variants || [
                      { subject: activeDraft.subject, body: activeDraft.body },
                    ]
                  ).map((v, i) => {
                    const fullText = v.subject ? `Subject: ${v.subject}\n\n${v.body}` : v.body;
                    const isRecommended = i === (activeDraft.selectedVariantIndex || 0);
                    return (
                      <div
                        key={i}
                        className={`border rounded-md p-3 space-y-2 ${
                          isRecommended ? 'border-primary bg-primary/5' : 'bg-muted/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">Variant {i + 1}</span>
                            {isRecommended && <Badge variant="secondary">Recommended</Badge>}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(fullText, i)}
                          >
                            {copiedIdx === i ? (
                              <>
                                <Check className="h-3 w-3 mr-1" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 mr-1" /> Copy
                              </>
                            )}
                          </Button>
                        </div>
                        {v.subject && (
                          <div className="text-sm">
                            <span className="font-semibold">Subject:</span> {v.subject}
                          </div>
                        )}
                        <div className="text-sm whitespace-pre-wrap">{v.body}</div>
                        {v.rationale && (
                          <div className="text-xs text-muted-foreground italic">
                            Why: {v.rationale}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {activeDraft.generationContext?.spamFlags &&
                    activeDraft.generationContext.spamFlags.length > 0 && (
                      <div className="text-xs text-destructive border border-destructive/50 rounded p-2">
                        <strong>Spam flags detected:</strong>{' '}
                        {activeDraft.generationContext.spamFlags.join(', ')}
                      </div>
                    )}

                  <Separator />
                  <div className="flex justify-between items-center">
                    <Badge variant="outline">Status: {activeDraft.status}</Badge>
                    <Button
                      variant="outline"
                      onClick={() => markSentMutation.mutate(activeDraft.id)}
                      disabled={activeDraft.status === 'sent'}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {activeDraft.status === 'sent' ? 'Sent' : 'Mark as sent'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent drafts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!draftsData?.drafts.length && (
                  <div className="text-sm text-muted-foreground py-6 text-center">
                    No drafts yet.
                  </div>
                )}
                {draftsData?.drafts.slice(0, 20).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setActiveDraft(d)}
                    className="w-full text-left border rounded-md p-2 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {d.channel === 'email' ? (
                          <Mail className="h-3 w-3" />
                        ) : (
                          <Linkedin className="h-3 w-3" />
                        )}
                        <span className="text-sm font-medium">
                          {d.prospect
                            ? [d.prospect.firstName, d.prospect.lastName]
                                .filter(Boolean)
                                .join(' ') || d.prospect.companyName
                            : 'Unknown'}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {d.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {d.subject || d.body.slice(0, 80)}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
