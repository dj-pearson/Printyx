/**
 * BANT Assessment (WF-S-09).
 *
 * Budget, Authority, Need, Timeline - the qualification a rep works through on
 * a lead. The whole back end for this shipped and nothing rendered the form:
 * `grep -rn BANTAssessment client/src` returned only this file, so five
 * endpoints, two tables and a qualification-history trail existed for a screen
 * nobody could open. `/api/lead-scoring` had even been added to `crmProxies`
 * with a comment naming this component as its caller.
 *
 * It renders inside LeadDetail now, and two defects had to go with it, both of
 * which would have shipped as "the form loses everything":
 *
 *   - Both read paths answered raw snake_case rows while this hydrates with
 *     `{ ...defaultBANTData, ...bantData }`, so every stored key landed BESIDE
 *     an untouched default and the form came back blank after a save. Fixed in
 *     the handler, which now camelises (see its header).
 *   - The success toast read `data.qualificationStatus.replace(...)`, a
 *     TypeError on a snake row - so saving threw AFTER the write succeeded.
 *
 * THE SCORE PREVIEW AND THE STORED SCORE ARE ONE MODULE. `shared/bant-score.ts`
 * is imported here and by the edge handler; this file used to carry its own
 * copy of the same arithmetic, which is the drift that makes a live preview
 * quietly stop matching what the pipeline gets.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { InlineQueryError } from '@/components/ui/inline-query-error';
import { scoreBant, statusLabel, statusTone } from '@shared/bant-score';
import {
  DollarSign,
  UserCheck,
  Target,
  Calendar,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Award,
} from 'lucide-react';

interface BANTAssessmentProps {
  leadId: string;
  onUpdate?: () => void;
}

interface BANTData {
  // Budget
  budgetIdentified: boolean;
  budgetAmount: string;
  budgetTimeframe: string;
  budgetApproved: boolean;
  budgetScore: number;
  budgetNotes: string;
  // Authority
  decisionMakerIdentified: boolean;
  decisionMakerName: string;
  decisionMakerTitle: string;
  decisionMakerContact: string;
  decisionProcess: string;
  authorityScore: number;
  authorityNotes: string;
  // Need
  needIdentified: boolean;
  needType: string;
  needUrgency: string;
  needDescription: string;
  painPoints: string[];
  needScore: number;
  needNotes: string;
  // Timeline
  timelineIdentified: boolean;
  expectedCloseDate: string;
  decisionTimeline: string;
  implementationTimeline: string;
  blockers: string[];
  timelineScore: number;
  timelineNotes: string;
  // Overall
  totalBantScore: number;
  qualificationStatus: string;
}

const defaultBANTData: BANTData = {
  budgetIdentified: false,
  budgetAmount: '',
  budgetTimeframe: '',
  budgetApproved: false,
  budgetScore: 0,
  budgetNotes: '',
  decisionMakerIdentified: false,
  decisionMakerName: '',
  decisionMakerTitle: '',
  decisionMakerContact: '',
  decisionProcess: '',
  authorityScore: 0,
  authorityNotes: '',
  needIdentified: false,
  needType: '',
  needUrgency: '',
  needDescription: '',
  painPoints: [],
  needScore: 0,
  needNotes: '',
  timelineIdentified: false,
  expectedCloseDate: '',
  decisionTimeline: '',
  implementationTimeline: '',
  blockers: [],
  timelineScore: 0,
  timelineNotes: '',
  totalBantScore: 0,
  qualificationStatus: 'unqualified',
};

/**
 * The one query for a lead's stored assessment, exported so LeadDetail's
 * At-a-glance card reads the SAME cache entry rather than issuing a second
 * request that can disagree with the form beside it.
 *
 * A lead with no assessment yet is a 404 from the endpoint and `null` here,
 * which is not an error: it is the normal state of a lead nobody has qualified.
 * Anything else propagates, so a real failure renders as one.
 */
export function bantQueryKey(leadId: string) {
  return ['/api/lead-scoring/bant', leadId] as const;
}

export function useBantAssessment(leadId: string | undefined) {
  return useQuery<Partial<BANTData> | null>({
    queryKey: bantQueryKey(leadId ?? ''),
    enabled: Boolean(leadId),
    // apiRequest, not fetch: a relative /api/... never passes through
    // getApiUrl, so in production it went to the static-bundle origin instead
    // of the functions host and carried no Bearer token either (PROD-013).
    queryFn: async () => {
      try {
        return (await apiRequest(`/api/lead-scoring/bant/${leadId}`)) as Partial<BANTData>;
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('404')) return null;
        throw err;
      }
    },
  });
}

export default function BANTAssessment({ leadId, onUpdate }: BANTAssessmentProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<BANTData>(defaultBANTData);
  const [newPainPoint, setNewPainPoint] = useState('');
  const [newBlocker, setNewBlocker] = useState('');

  const { data: bantData, isLoading, isError, refetch } = useBantAssessment(leadId);

  /**
   * Hydrate from the FIRST row to arrive, behind a ref. A plain
   * `useEffect([bantData])` re-runs on every refetch - a window focus, a
   * sibling invalidation - and would overwrite whatever the rep has typed
   * since (the WhiteLabelDashboard lesson, QUALITY-002). Saving deliberately
   * re-arms it, because the server's scores are what should be on screen
   * afterwards.
   */
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!bantData || hydratedFor.current === leadId) return;
    hydratedFor.current = leadId;
    setFormData({
      ...defaultBANTData,
      ...bantData,
      painPoints: bantData.painPoints ?? [],
      blockers: bantData.blockers ?? [],
    });
  }, [bantData, leadId]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (data: BANTData) =>
      apiRequest(`/api/lead-scoring/bant/${leadId}`, 'POST', data) as Promise<Partial<BANTData>>,
    onSuccess: (data) => {
      toast({
        title: 'Assessment saved',
        // statusLabel tolerates a missing or unfamiliar status; the previous
        // `data.qualificationStatus.replace(...)` threw on the snake-case row
        // the endpoint actually returned.
        description: `BANT qualification: ${statusLabel(data?.qualificationStatus)}`,
      });
      // Let the saved row re-hydrate the form: the server owns the scores and
      // the status, so what is on screen after a save should be what it stored.
      hydratedFor.current = null;
      queryClient.invalidateQueries({ queryKey: bantQueryKey(leadId) });
      onUpdate?.();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Save failed',
        // apiRequest throws a plain Error, so error.response?.data?.message is
        // always undefined here and every failure showed a generic fallback
        // (CRM-008's finding). The server's reason is on .message.
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const updateField = (field: keyof BANTData, value: BANTData[keyof BANTData]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addPainPoint = () => {
    if (newPainPoint.trim()) {
      setFormData((prev) => ({
        ...prev,
        painPoints: [...prev.painPoints, newPainPoint.trim()],
      }));
      setNewPainPoint('');
    }
  };

  const removePainPoint = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      painPoints: prev.painPoints.filter((_, i) => i !== index),
    }));
  };

  const addBlocker = () => {
    if (newBlocker.trim()) {
      setFormData((prev) => ({
        ...prev,
        blockers: [...prev.blockers, newBlocker.trim()],
      }));
      setNewBlocker('');
    }
  };

  const removeBlocker = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      blockers: prev.blockers.filter((_, i) => i !== index),
    }));
  };

  // The live preview is the SERVER's arithmetic, imported rather than copied
  // (shared/bant-score.ts). A preview that drifts from what gets stored is
  // worse than no preview: the rep reads it as the answer.
  const estimatedScores = scoreBant(formData);
  const qualification = {
    label: statusLabel(estimatedScores.status),
    color: statusTone(estimatedScores.status),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              BANT Qualification Assessment
            </CardTitle>
            <CardDescription>
              Budget, Authority, Need, Timeline - comprehensive lead qualification
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Estimated Score</div>
            <div className="text-3xl font-bold">{estimatedScores.total}</div>
            <Badge className={qualification.color}>{qualification.label}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* CR-033: a failed read left this form sitting at its defaults, which
            reads as "nobody has qualified this lead yet" - the one thing a rep
            would act on. Saving over it would then overwrite a real assessment
            with blanks. */}
        {isError ? (
          <InlineQueryError
            label="this lead's saved assessment"
            onRetry={() => refetch()}
            className="mb-4"
          />
        ) : null}
        <Accordion type="multiple" defaultValue={['budget', 'authority', 'need', 'timeline']}>
          {/* Budget Section */}
          <AccordionItem value="budget">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <span>Budget</span>
                <Badge variant="outline">{estimatedScores.budgetScore}/25</Badge>
                {formData.budgetIdentified && (
                  <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.budgetIdentified}
                  onCheckedChange={(checked) => updateField('budgetIdentified', checked)}
                />
                <Label>Budget has been identified</Label>
              </div>

              {formData.budgetIdentified && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Budget Amount</Label>
                      <Input
                        type="number"
                        placeholder="e.g., 50000"
                        value={formData.budgetAmount}
                        onChange={(e) => updateField('budgetAmount', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Budget Timeframe</Label>
                      <Select
                        value={formData.budgetTimeframe}
                        onValueChange={(value) => updateField('budgetTimeframe', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="current_quarter">Current Quarter</SelectItem>
                          <SelectItem value="next_quarter">Next Quarter</SelectItem>
                          <SelectItem value="this_year">This Year</SelectItem>
                          <SelectItem value="next_year">Next Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.budgetApproved}
                      onCheckedChange={(checked) => updateField('budgetApproved', checked)}
                    />
                    <Label>Budget is approved</Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Budget Notes</Label>
                    <Textarea
                      placeholder="Additional notes about budget..."
                      value={formData.budgetNotes}
                      onChange={(e) => updateField('budgetNotes', e.target.value)}
                    />
                  </div>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Authority Section */}
          <AccordionItem value="authority">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <UserCheck className="h-4 w-4 text-blue-600" />
                </div>
                <span>Authority</span>
                <Badge variant="outline">{estimatedScores.authorityScore}/25</Badge>
                {formData.decisionMakerIdentified && (
                  <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.decisionMakerIdentified}
                  onCheckedChange={(checked) => updateField('decisionMakerIdentified', checked)}
                />
                <Label>Decision maker has been identified</Label>
              </div>

              {formData.decisionMakerIdentified && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Decision Maker Name</Label>
                      <Input
                        placeholder="e.g., John Smith"
                        value={formData.decisionMakerName}
                        onChange={(e) => updateField('decisionMakerName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        placeholder="e.g., VP of Operations"
                        value={formData.decisionMakerTitle}
                        onChange={(e) => updateField('decisionMakerTitle', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Contact Information</Label>
                    <Input
                      placeholder="Email or phone"
                      value={formData.decisionMakerContact}
                      onChange={(e) => updateField('decisionMakerContact', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Decision Process</Label>
                    <Textarea
                      placeholder="Describe the decision-making process, approvals needed..."
                      value={formData.decisionProcess}
                      onChange={(e) => updateField('decisionProcess', e.target.value)}
                    />
                  </div>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Need Section */}
          <AccordionItem value="need">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Target className="h-4 w-4 text-purple-600" />
                </div>
                <span>Need</span>
                <Badge variant="outline">{estimatedScores.needScore}/25</Badge>
                {formData.needIdentified && <CheckCircle className="h-4 w-4 text-green-500 ml-2" />}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.needIdentified}
                  onCheckedChange={(checked) => updateField('needIdentified', checked)}
                />
                <Label>Need has been identified</Label>
              </div>

              {formData.needIdentified && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Need Type</Label>
                      <Select
                        value={formData.needType}
                        onValueChange={(value) => updateField('needType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select need type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new_equipment">New Equipment</SelectItem>
                          <SelectItem value="replacement">Replacement</SelectItem>
                          <SelectItem value="expansion">Expansion</SelectItem>
                          <SelectItem value="cost_reduction">Cost Reduction</SelectItem>
                          <SelectItem value="service_improvement">Service Improvement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Urgency</Label>
                      <Select
                        value={formData.needUrgency}
                        onValueChange={(value) => updateField('needUrgency', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select urgency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">Critical - Immediate</SelectItem>
                          <SelectItem value="high">High - This Quarter</SelectItem>
                          <SelectItem value="medium">Medium - This Year</SelectItem>
                          <SelectItem value="low">Low - No Rush</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Need Description</Label>
                    <Textarea
                      placeholder="Describe the need in detail..."
                      value={formData.needDescription}
                      onChange={(e) => updateField('needDescription', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Pain Points</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a pain point..."
                        value={newPainPoint}
                        onChange={(e) => setNewPainPoint(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addPainPoint()}
                      />
                      <Button type="button" variant="outline" onClick={addPainPoint}>
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.painPoints.map((point, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => removePainPoint(idx)}
                        >
                          {point} <XCircle className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Timeline Section */}
          <AccordionItem value="timeline">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calendar className="h-4 w-4 text-orange-600" />
                </div>
                <span>Timeline</span>
                <Badge variant="outline">{estimatedScores.timelineScore}/25</Badge>
                {formData.timelineIdentified && (
                  <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.timelineIdentified}
                  onCheckedChange={(checked) => updateField('timelineIdentified', checked)}
                />
                <Label>Timeline has been identified</Label>
              </div>

              {formData.timelineIdentified && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Decision Timeline</Label>
                      <Select
                        value={formData.decisionTimeline}
                        onValueChange={(value) => updateField('decisionTimeline', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select timeline" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediate</SelectItem>
                          <SelectItem value="30_days">Within 30 Days</SelectItem>
                          <SelectItem value="90_days">Within 90 Days</SelectItem>
                          <SelectItem value="6_months">Within 6 Months</SelectItem>
                          <SelectItem value="1_year">Within 1 Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Expected Close Date</Label>
                      <Input
                        type="date"
                        value={formData.expectedCloseDate?.split('T')[0] || ''}
                        onChange={(e) => updateField('expectedCloseDate', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Implementation Timeline</Label>
                    <Input
                      placeholder="e.g., 2-4 weeks after decision"
                      value={formData.implementationTimeline}
                      onChange={(e) => updateField('implementationTimeline', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Potential Blockers</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a potential blocker..."
                        value={newBlocker}
                        onChange={(e) => setNewBlocker(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addBlocker()}
                      />
                      <Button type="button" variant="outline" onClick={addBlocker}>
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.blockers.map((blocker, idx) => (
                        <Badge
                          key={idx}
                          variant="destructive"
                          className="cursor-pointer"
                          onClick={() => removeBlocker(idx)}
                        >
                          {blocker} <XCircle className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Score Summary */}
        <Separator className="my-6" />

        <div className="space-y-4">
          <div className="font-medium">Score Breakdown</div>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-sm text-muted-foreground">Budget</div>
              <div className="text-2xl font-bold text-green-600">{estimatedScores.budgetScore}</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-sm text-muted-foreground">Authority</div>
              <div className="text-2xl font-bold text-blue-600">
                {estimatedScores.authorityScore}
              </div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-sm text-muted-foreground">Need</div>
              <div className="text-2xl font-bold text-purple-600">{estimatedScores.needScore}</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-sm text-muted-foreground">Timeline</div>
              <div className="text-2xl font-bold text-orange-600">
                {estimatedScores.timelineScore}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <div className="font-medium">Total BANT Score</div>
              <div className="text-sm text-muted-foreground">
                Contributes to overall lead score (weighted at 80%)
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">{estimatedScores.total}</div>
              <Badge className={qualification.color}>{qualification.label}</Badge>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Assessment
        </Button>
      </CardFooter>
    </Card>
  );
}
