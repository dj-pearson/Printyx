/**
 * BANT Assessment Component
 *
 * Provides a form for assessing leads using the BANT framework:
 * - Budget: Is there budget allocated?
 * - Authority: Is this the decision maker?
 * - Need: Is there a clear need?
 * - Timeline: When do they need to make a decision?
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Progress } from '@/components/ui/progress';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  DollarSign,
  UserCheck,
  Target,
  Calendar,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  Award,
  TrendingUp,
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

export default function BANTAssessment({ leadId, onUpdate }: BANTAssessmentProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<BANTData>(defaultBANTData);
  const [newPainPoint, setNewPainPoint] = useState('');
  const [newBlocker, setNewBlocker] = useState('');

  // Fetch existing BANT data
  const {
    data: bantData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['bant-assessment', leadId],
    queryFn: async () => {
      const res = await fetch(`/api/lead-scoring/bant/${leadId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch BANT data');
      return res.json();
    },
  });

  // Update form when data is loaded
  useEffect(() => {
    if (bantData) {
      setFormData({
        ...defaultBANTData,
        ...bantData,
        painPoints: bantData.painPoints || [],
        blockers: bantData.blockers || [],
      });
    }
  }, [bantData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: BANTData) => {
      const res = await fetch(`/api/lead-scoring/bant/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save BANT assessment');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Assessment Saved',
        description: `BANT qualification: ${data.qualificationStatus.replace('_', ' ')}`,
      });
      queryClient.invalidateQueries({ queryKey: ['bant-assessment', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-intelligence', leadId] });
      onUpdate?.();
    },
    onError: (error: any) => {
      toast({
        title: 'Save Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const updateField = (field: keyof BANTData, value: any) => {
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

  // Calculate estimated scores
  const calculateEstimatedScore = () => {
    let budgetScore = 0;
    let authorityScore = 0;
    let needScore = 0;
    let timelineScore = 0;

    if (formData.budgetIdentified) {
      budgetScore = formData.budgetApproved ? 25 : 15;
    }
    if (formData.decisionMakerIdentified) {
      authorityScore = 25;
    }
    if (formData.needIdentified) {
      if (formData.needUrgency === 'critical') needScore = 25;
      else if (formData.needUrgency === 'high') needScore = 20;
      else needScore = 15;
    }
    if (formData.timelineIdentified) {
      if (formData.decisionTimeline === 'immediate') timelineScore = 25;
      else if (formData.decisionTimeline === '30_days') timelineScore = 20;
      else timelineScore = 15;
    }

    return {
      budgetScore,
      authorityScore,
      needScore,
      timelineScore,
      total: budgetScore + authorityScore + needScore + timelineScore,
    };
  };

  const estimatedScores = calculateEstimatedScore();

  const getQualificationBadge = (total: number) => {
    if (total >= 75) return { label: 'Highly Qualified', color: 'bg-green-100 text-green-800' };
    if (total >= 50) return { label: 'Qualified', color: 'bg-blue-100 text-blue-800' };
    if (total >= 25)
      return { label: 'Partially Qualified', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Unqualified', color: 'bg-red-100 text-red-800' };
  };

  const qualification = getQualificationBadge(estimatedScores.total);

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
