import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Save, Plus, Trash2 } from 'lucide-react';

type ArrayField =
  | 'icpIndustries'
  | 'icpGeographies'
  | 'icpBuyerTitles'
  | 'icpPainPoints'
  | 'icpTriggerSignals'
  | 'offerOutcomes'
  | 'offerDifferentiators'
  | 'offerProof'
  | 'notForCustomers';

interface Objection {
  objection: string;
  response: string;
}

interface PastWin {
  company: string;
  industry?: string;
  size?: string;
  howFound?: string;
  triggerToBuy?: string;
  outcome?: string;
}

interface ContextData {
  icpSummary?: string;
  icpCompanySize?: string;
  icpIndustries?: string[];
  icpGeographies?: string[];
  icpBuyerTitles?: string[];
  icpPainPoints?: string[];
  icpTriggerSignals?: string[];
  offerSummary?: string;
  offerOutcomes?: string[];
  offerDifferentiators?: string[];
  offerProof?: string[];
  positioningStatement?: string;
  positioningObjections?: Objection[];
  notForCustomers?: string[];
  pastWins?: PastWin[];
  toolsNotes?: string;
  additionalNotes?: string;
}

function parseList(v: string): string[] {
  return v
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinList(v: string[] | undefined): string {
  return (v || []).join('\n');
}

export default function BusinessContext() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<'tenant' | 'user'>('tenant');
  const [form, setForm] = useState<ContextData>({});

  const { data, isLoading } = useQuery<{ context: any }>({
    queryKey: ['/api/outreach/business-context'],
    queryFn: () => apiRequest('/api/outreach/business-context'),
  });

  useEffect(() => {
    if (data?.context) {
      setForm(data.context);
    }
  }, [data?.context]);

  const saveMutation = useMutation({
    mutationFn: (payload: { scope: 'tenant' | 'user'; data: ContextData }) =>
      apiRequest('/api/outreach/business-context', 'PUT', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/business-context'] });
      toast({ title: 'Saved', description: 'Business context updated.' });
    },
    onError: (err: any) =>
      toast({
        title: 'Save failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      }),
  });

  const updateField = (key: keyof ContextData, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateListField = (key: ArrayField, text: string) =>
    setForm((prev) => ({ ...prev, [key]: parseList(text) }));

  const addObjection = () =>
    setForm((prev) => ({
      ...prev,
      positioningObjections: [
        ...(prev.positioningObjections || []),
        { objection: '', response: '' },
      ],
    }));

  const updateObjection = (i: number, k: keyof Objection, v: string) =>
    setForm((prev) => ({
      ...prev,
      positioningObjections: (prev.positioningObjections || []).map((o, idx) =>
        idx === i ? { ...o, [k]: v } : o,
      ),
    }));

  const removeObjection = (i: number) =>
    setForm((prev) => ({
      ...prev,
      positioningObjections: (prev.positioningObjections || []).filter((_, idx) => idx !== i),
    }));

  const addWin = () =>
    setForm((prev) => ({
      ...prev,
      pastWins: [...(prev.pastWins || []), { company: '' }],
    }));

  const updateWin = (i: number, k: keyof PastWin, v: string) =>
    setForm((prev) => ({
      ...prev,
      pastWins: (prev.pastWins || []).map((w, idx) => (idx === i ? { ...w, [k]: v } : w)),
    }));

  const removeWin = (i: number) =>
    setForm((prev) => ({
      ...prev,
      pastWins: (prev.pastWins || []).filter((_, idx) => idx !== i),
    }));

  const handleSave = () => saveMutation.mutate({ scope, data: form });

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-4 max-w-5xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-semibold">Business Context</h1>
              <Badge variant="outline">Fuel for the AI</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              The AI reads this before every draft. Be specific. Generic answers produce generic
              copy.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={scope}
              onChange={(e) => setScope(e.target.value as 'tenant' | 'user')}
            >
              <option value="tenant">Tenant default</option>
              <option value="user">My override</option>
            </select>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading...
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="icp">
            <TabsList>
              <TabsTrigger value="icp">ICP</TabsTrigger>
              <TabsTrigger value="offer">Offer</TabsTrigger>
              <TabsTrigger value="positioning">Positioning</TabsTrigger>
              <TabsTrigger value="wins">Past Wins</TabsTrigger>
              <TabsTrigger value="notes">Tools & Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="icp" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Who you sell to</CardTitle>
                  <CardDescription>
                    Answer these like you'd describe a lookalike to a sharp SDR.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>ICP summary (one paragraph)</Label>
                    <Textarea
                      rows={3}
                      value={form.icpSummary || ''}
                      onChange={(e) => updateField('icpSummary', e.target.value)}
                      placeholder="e.g. Mid-market professional services firms in the Midwest, 50-500 employees, aging copier fleet, no in-house fleet strategy"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Company size range</Label>
                      <Input
                        value={form.icpCompanySize || ''}
                        onChange={(e) => updateField('icpCompanySize', e.target.value)}
                        placeholder="e.g. 20-500 employees"
                      />
                    </div>
                    <div>
                      <Label>Geographies (one per line)</Label>
                      <Textarea
                        rows={3}
                        value={joinList(form.icpGeographies)}
                        onChange={(e) => updateListField('icpGeographies', e.target.value)}
                        placeholder="Cleveland metro\nColumbus metro\nCincinnati metro"
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Industries (one per line)</Label>
                      <Textarea
                        rows={4}
                        value={joinList(form.icpIndustries)}
                        onChange={(e) => updateListField('icpIndustries', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Buyer titles (one per line)</Label>
                      <Textarea
                        rows={4}
                        value={joinList(form.icpBuyerTitles)}
                        onChange={(e) => updateListField('icpBuyerTitles', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Pain points (one per line)</Label>
                      <Textarea
                        rows={5}
                        value={joinList(form.icpPainPoints)}
                        onChange={(e) => updateListField('icpPainPoints', e.target.value)}
                        placeholder="Overage charges\nSlow service\nAging fleet"
                      />
                    </div>
                    <div>
                      <Label>Trigger signals (one per line)</Label>
                      <Textarea
                        rows={5}
                        value={joinList(form.icpTriggerSignals)}
                        onChange={(e) => updateListField('icpTriggerSignals', e.target.value)}
                        placeholder="Lease expiring\nNew office opening\nRecent M&A"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="offer" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>What you deliver</CardTitle>
                  <CardDescription>Outcomes over features. Proof over promises.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Offer summary</Label>
                    <Textarea
                      rows={3}
                      value={form.offerSummary || ''}
                      onChange={(e) => updateField('offerSummary', e.target.value)}
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Outcomes we deliver (one per line)</Label>
                      <Textarea
                        rows={5}
                        value={joinList(form.offerOutcomes)}
                        onChange={(e) => updateListField('offerOutcomes', e.target.value)}
                        placeholder="Guaranteed 4-hr response SLA\nNo lease auto-renewal\nFlat CPP"
                      />
                    </div>
                    <div>
                      <Label>Differentiators (one per line)</Label>
                      <Textarea
                        rows={5}
                        value={joinList(form.offerDifferentiators)}
                        onChange={(e) => updateListField('offerDifferentiators', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>
                      Proof points (one per line — short, specific, ideally with numbers)
                    </Label>
                    <Textarea
                      rows={4}
                      value={joinList(form.offerProof)}
                      onChange={(e) => updateListField('offerProof', e.target.value)}
                      placeholder="Cut a 50-device fleet's monthly spend 27% for a regional law firm"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="positioning" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Why you — and who you're not for</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Positioning statement</Label>
                    <Textarea
                      rows={3}
                      value={form.positioningStatement || ''}
                      onChange={(e) => updateField('positioningStatement', e.target.value)}
                      placeholder="For mid-market firms frustrated with surprise overage charges, we are the only dealer in the region that guarantees..."
                    />
                  </div>
                  <div>
                    <Label>Who we're NOT for (one per line)</Label>
                    <Textarea
                      rows={3}
                      value={joinList(form.notForCustomers)}
                      onChange={(e) => updateListField('notForCustomers', e.target.value)}
                      placeholder="Price-only buyers\nShops under 5 devices\nBig box enterprise"
                    />
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-base">Common objections</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addObjection}>
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {(form.positioningObjections || []).map((obj, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                          <Input
                            value={obj.objection}
                            onChange={(e) => updateObjection(i, 'objection', e.target.value)}
                            placeholder="Objection"
                          />
                          <Input
                            value={obj.response}
                            onChange={(e) => updateObjection(i, 'response', e.target.value)}
                            placeholder="How you reframe it"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeObjection(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="wins" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Top 10 closed clients</CardTitle>
                      <CardDescription>How you found them, what triggered the buy.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={addWin}>
                      <Plus className="h-4 w-4 mr-1" /> Add win
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(form.pastWins || []).map((win, i) => (
                    <div key={i} className="border rounded-md p-3 space-y-2 bg-muted/30">
                      <div className="flex items-start justify-between gap-2">
                        <Input
                          value={win.company}
                          onChange={(e) => updateWin(i, 'company', e.target.value)}
                          placeholder="Company name"
                          className="font-medium"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeWin(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <Input
                          value={win.industry || ''}
                          onChange={(e) => updateWin(i, 'industry', e.target.value)}
                          placeholder="Industry"
                        />
                        <Input
                          value={win.size || ''}
                          onChange={(e) => updateWin(i, 'size', e.target.value)}
                          placeholder="Size (e.g. 120 employees)"
                        />
                        <Input
                          value={win.howFound || ''}
                          onChange={(e) => updateWin(i, 'howFound', e.target.value)}
                          placeholder="How we found them"
                        />
                        <Input
                          value={win.triggerToBuy || ''}
                          onChange={(e) => updateWin(i, 'triggerToBuy', e.target.value)}
                          placeholder="What triggered the buy"
                        />
                      </div>
                      <Input
                        value={win.outcome || ''}
                        onChange={(e) => updateWin(i, 'outcome', e.target.value)}
                        placeholder="Outcome (e.g. 45 devices, 3-yr MPS agreement, 22% savings)"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tools & additional notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Sending stack / CRM / enrichment tools</Label>
                    <Textarea
                      rows={4}
                      value={form.toolsNotes || ''}
                      onChange={(e) => updateField('toolsNotes', e.target.value)}
                      placeholder="e.g. Gmail + Apollo + Printyx CRM"
                    />
                  </div>
                  <div>
                    <Label>Anything else the AI should know</Label>
                    <Textarea
                      rows={6}
                      value={form.additionalNotes || ''}
                      onChange={(e) => updateField('additionalNotes', e.target.value)}
                      placeholder="Voice, taboo words, preferred phrases, internal style rules..."
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
