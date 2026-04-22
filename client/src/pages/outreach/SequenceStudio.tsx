import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Layers, Plus, Mail, Linkedin, Sparkles, Trash2, Save, AlertCircle } from 'lucide-react';

interface Sequence {
  id: string;
  name: string;
  description?: string;
  angle?: string;
  targetSpecialty?: string;
  includesEmail: boolean;
  includesLinkedin: boolean;
  isDreamAccountOnly: boolean;
  updatedAt: string;
}

interface Step {
  id: string;
  stepOrder: number;
  channel: string;
  dayOffset: number;
  subjectTemplate?: string;
  bodyTemplate: string;
  variants?: Array<{ subject?: string; body: string; rationale?: string }>;
  spamFlags?: string[];
  notes?: string;
}

function channelIcon(channel: string) {
  if (channel === 'email') return <Mail className="h-4 w-4" />;
  return <Linkedin className="h-4 w-4" />;
}

function channelLabel(channel: string) {
  switch (channel) {
    case 'email':
      return 'Email';
    case 'linkedin_connect':
      return 'LinkedIn connect';
    case 'linkedin_message':
      return 'LinkedIn message';
    case 'linkedin_inmail':
      return 'LinkedIn InMail';
    default:
      return channel;
  }
}

export default function SequenceStudio() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [genForm, setGenForm] = useState({
    angle: '',
    name: '',
    includeEmail: true,
    includeLinkedin: false,
    isDreamAccountOnly: false,
  });

  const { data: seqsData, isLoading: listLoading } = useQuery<{ sequences: Sequence[] }>({
    queryKey: ['/api/outreach/sequences'],
    queryFn: () => apiRequest('/api/outreach/sequences'),
  });

  const { data: detailData, isLoading: detailLoading } = useQuery<{
    sequence: Sequence;
    steps: Step[];
  }>({
    queryKey: ['/api/outreach/sequences', selectedId],
    queryFn: () => apiRequest(`/api/outreach/sequences/${selectedId}`),
    enabled: !!selectedId,
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest('/api/outreach/sequences/generate', 'POST', genForm),
    onSuccess: (result: { sequence: Sequence }) => {
      toast({ title: 'Sequence generated', description: result.sequence.name });
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/sequences'] });
      setSelectedId(result.sequence.id);
      setDialogOpen(false);
      setGenForm({
        angle: '',
        name: '',
        includeEmail: true,
        includeLinkedin: false,
        isDreamAccountOnly: false,
      });
    },
    onError: (err: any) =>
      toast({
        title: 'Generation failed',
        description: err?.message || 'AI call failed — is CLAUDE_API_KEY set?',
        variant: 'destructive',
      }),
  });

  const updateStepMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Step> }) =>
      apiRequest(`/api/outreach/sequence-steps/${id}`, 'PATCH', patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/sequences', selectedId] });
      toast({ title: 'Step saved' });
    },
  });

  const deleteSequenceMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/outreach/sequences/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/sequences'] });
      setSelectedId(null);
      toast({ title: 'Sequence deleted' });
    },
  });

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-4 max-w-7xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-semibold">Sequence Studio</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              AI-drafted coordinated email + LinkedIn sequences. Edit, save, and reuse them per
              prospect in the Draft Generator.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" /> New sequence
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Generate sequence with AI</DialogTitle>
                <DialogDescription>
                  Pick a specific angle. Vague angles produce vague copy.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Angle / signal *</Label>
                  <Textarea
                    rows={3}
                    value={genForm.angle}
                    onChange={(e) => setGenForm({ ...genForm, angle: e.target.value })}
                    placeholder="e.g. law firms with copier leases expiring in the next 6 months"
                  />
                </div>
                <div>
                  <Label>Sequence name (optional)</Label>
                  <Input
                    value={genForm.name}
                    onChange={(e) => setGenForm({ ...genForm, name: e.target.value })}
                    placeholder="Auto-generated if blank"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="email"
                      checked={genForm.includeEmail}
                      onCheckedChange={(v) => setGenForm({ ...genForm, includeEmail: !!v })}
                    />
                    <Label htmlFor="email" className="font-normal cursor-pointer">
                      Include 2-email sequence
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="linkedin"
                      checked={genForm.includeLinkedin}
                      onCheckedChange={(v) => setGenForm({ ...genForm, includeLinkedin: !!v })}
                    />
                    <Label htmlFor="linkedin" className="font-normal cursor-pointer">
                      Include 3-touch LinkedIn sequence (dream accounts)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="dream"
                      checked={genForm.isDreamAccountOnly}
                      onCheckedChange={(v) => setGenForm({ ...genForm, isDreamAccountOnly: !!v })}
                    />
                    <Label htmlFor="dream" className="font-normal cursor-pointer">
                      Mark as dream-account only
                    </Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={
                    !genForm.angle.trim() ||
                    (!genForm.includeEmail && !genForm.includeLinkedin) ||
                    generateMutation.isPending
                  }
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  {generateMutation.isPending ? 'Generating...' : 'Generate'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your sequences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {listLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
              {!listLoading && !seqsData?.sequences.length && (
                <div className="text-sm text-muted-foreground">
                  No sequences yet. Click "New sequence" to create one.
                </div>
              )}
              {seqsData?.sequences.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left rounded-md border p-2 transition-colors ${
                    s.id === selectedId ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                  }`}
                >
                  <div className="font-medium text-sm truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {s.angle || 'No angle'}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {s.includesEmail && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                        <Mail className="h-2.5 w-2.5 mr-0.5" /> Email
                      </Badge>
                    )}
                    {s.includesLinkedin && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                        <Linkedin className="h-2.5 w-2.5 mr-0.5" /> LI
                      </Badge>
                    )}
                    {s.isDreamAccountOnly && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        Dream
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-3">
            {!selectedId && (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  Select a sequence or generate a new one.
                </CardContent>
              </Card>
            )}
            {selectedId && detailLoading && (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  Loading...
                </CardContent>
              </Card>
            )}
            {detailData && (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{detailData.sequence.name}</CardTitle>
                        <CardDescription>
                          {detailData.sequence.description || detailData.sequence.angle}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this sequence and all its steps?')) {
                            deleteSequenceMutation.mutate(detailData.sequence.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>

                {detailData.steps.map((step) => (
                  <StepEditor
                    key={step.id}
                    step={step}
                    onSave={(patch) => updateStepMutation.mutate({ id: step.id, patch })}
                    saving={updateStepMutation.isPending}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function StepEditor({
  step,
  onSave,
  saving,
}: {
  step: Step;
  onSave: (patch: Partial<Step>) => void;
  saving: boolean;
}) {
  const [subject, setSubject] = useState(step.subjectTemplate || '');
  const [body, setBody] = useState(step.bodyTemplate);
  const [showVariants, setShowVariants] = useState(false);
  const dirty = subject !== (step.subjectTemplate || '') || body !== step.bodyTemplate;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Step {step.stepOrder}</Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              {channelIcon(step.channel)}
              {channelLabel(step.channel)}
            </Badge>
            <Badge variant="outline">Day {step.dayOffset}</Badge>
          </div>
          {step.spamFlags && step.spamFlags.length > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {step.spamFlags.length} spam flag
              {step.spamFlags.length === 1 ? '' : 's'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {step.channel === 'email' && (
          <div>
            <Label className="text-xs">Subject template</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        )}
        <div>
          <Label className="text-xs">Body template</Label>
          <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="text-xs text-muted-foreground mt-1">
            Tokens: {'{{firstName}}'} {'{{companyName}}'} {'{{title}}'} {'{{industry}}'}{' '}
            {'{{triggerSignal}}'} {'{{city}}'}
          </div>
        </div>

        {step.spamFlags && step.spamFlags.length > 0 && (
          <div className="text-xs text-destructive">
            <strong>Spam flags:</strong> {step.spamFlags.join(', ')}
          </div>
        )}

        {step.notes && (
          <div className="text-xs text-muted-foreground italic">AI rationale: {step.notes}</div>
        )}

        {step.variants && step.variants.length > 1 && (
          <>
            <Separator />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowVariants(!showVariants)}
              className="w-full"
            >
              {showVariants ? 'Hide' : 'Show'} {step.variants.length} variants
            </Button>
            {showVariants &&
              step.variants.map((v, i) => (
                <div key={i} className="border rounded-md p-2 text-sm bg-muted/30 space-y-1">
                  <div className="text-xs text-muted-foreground">Variant {i + 1}</div>
                  {v.subject && (
                    <div>
                      <span className="font-semibold">Subject:</span> {v.subject}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{v.body}</div>
                  {v.rationale && (
                    <div className="text-xs text-muted-foreground italic">{v.rationale}</div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSubject(v.subject || '');
                      setBody(v.body);
                    }}
                  >
                    Use this variant
                  </Button>
                </div>
              ))}
          </>
        )}

        <div className="flex justify-end">
          <Button
            disabled={!dirty || saving}
            onClick={() => onSave({ subjectTemplate: subject, bodyTemplate: body })}
          >
            <Save className="h-4 w-4 mr-1" /> Save step
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
