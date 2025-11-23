import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  DollarSign,
  Calendar,
  Target,
  TrendingUp,
  Activity,
  Edit,
  Save,
  X,
  CheckCircle2,
  XCircle,
  ArrowRight,
  User,
  Clock,
  FileText,
  AlertTriangle,
  RefreshCw,
  Award,
  Gauge
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import MainLayout from "@/components/layout/main-layout";

interface Deal {
  id: string;
  dealName: string;
  businessRecordId: string;
  businessRecordName?: string;
  dealValue: string;
  probability: number;
  weightedValue: string;
  stage: string;
  expectedCloseDate?: string;
  actualCloseDate?: string;
  assignedRep?: string;
  dealSource?: string;
  competitorsEvaluating?: string[];
  lostReason?: string;
  wonReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ActivityItem {
  id: string;
  activityType: string;
  subject: string;
  description?: string;
  activityDate: string;
  createdBy: string;
}

interface BantQualification {
  budgetScore: number;
  authorityScore: number;
  needScore: number;
  timelineScore: number;
  totalBantScore: number;
  qualificationStatus: string;
  budgetNotes?: string;
  authorityNotes?: string;
  needNotes?: string;
  timelineNotes?: string;
}

const STAGE_CONFIG = [
  { stage: 'prospecting', displayName: 'Prospecting', probability: 10 },
  { stage: 'qualification', displayName: 'Qualification', probability: 20 },
  { stage: 'needs_analysis', displayName: 'Needs Analysis', probability: 30 },
  { stage: 'proposal', displayName: 'Proposal', probability: 50 },
  { stage: 'negotiation', displayName: 'Negotiation', probability: 75 },
  { stage: 'verbal_commit', displayName: 'Verbal Commit', probability: 90 },
  { stage: 'contract_sent', displayName: 'Contract Sent', probability: 95 },
  { stage: 'closed_won', displayName: 'Closed Won', probability: 100 },
  { stage: 'closed_lost', displayName: 'Closed Lost', probability: 0 },
];

export default function PlatformDealDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Deal>>({});

  // Fetch deal
  const { data: deal, isLoading } = useQuery<Deal>({
    queryKey: [`/api/platform-deals/${id}`],
    enabled: !!id,
  });

  // Fetch activities
  const { data: activities } = useQuery<ActivityItem[]>({
    queryKey: [`/api/platform-activities`, { dealId: id, limit: 50 }],
    enabled: !!id,
  });

  // Fetch BANT qualification
  const { data: bant } = useQuery<BantQualification>({
    queryKey: [`/api/platform-deals/${id}/bant`],
    enabled: !!id,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Deal>) => {
      const response = await fetch(`/api/platform-deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update deal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platform-deals/${id}`] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Deal updated successfully",
      });
    },
  });

  // Move stage mutation
  const moveStageMutation = useMutation({
    mutationFn: async (newStage: string) => {
      const response = await fetch(`/api/platform-deals/${id}/move-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStage }),
      });
      if (!response.ok) throw new Error('Failed to move deal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platform-deals/${id}`] });
      toast({
        title: "Success",
        description: "Deal stage updated",
      });
    },
  });

  // Close won mutation
  const closeWonMutation = useMutation({
    mutationFn: async (wonReason: string) => {
      const response = await fetch(`/api/platform-deals/${id}/close-won`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wonReason, actualCloseDate: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error('Failed to close deal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platform-deals/${id}`] });
      toast({
        title: "Success",
        description: "Deal marked as won! 🎉",
      });
    },
  });

  // Close lost mutation
  const closeLostMutation = useMutation({
    mutationFn: async (lostReason: string) => {
      const response = await fetch(`/api/platform-deals/${id}/close-lost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lostReason, actualCloseDate: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error('Failed to close deal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platform-deals/${id}`] });
      toast({
        title: "Deal Closed",
        description: "Deal marked as lost",
      });
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading deal...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!deal) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
            <h2 className="text-2xl font-bold mb-2">Deal Not Found</h2>
            <p className="text-muted-foreground mb-4">The deal you're looking for doesn't exist.</p>
            <Button onClick={() => setLocation('/platform-crm/pipeline')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Pipeline
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const currentStageIndex = STAGE_CONFIG.findIndex(s => s.stage === deal.stage);
  const currentStage = STAGE_CONFIG[currentStageIndex];
  const nextStage = STAGE_CONFIG[currentStageIndex + 1];

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({});
  };

  const handleCloseWon = () => {
    const reason = prompt('Why was this deal won?');
    if (reason) {
      closeWonMutation.mutate(reason);
    }
  };

  const handleCloseLost = () => {
    const reason = prompt('Why was this deal lost?');
    if (reason) {
      closeLostMutation.mutate(reason);
    }
  };

  const getStageBadge = (stage: string) => {
    if (stage === 'closed_won') return <Badge className="bg-green-600 text-white">Won</Badge>;
    if (stage === 'closed_lost') return <Badge variant="destructive">Lost</Badge>;
    return <Badge variant="outline">{currentStage?.displayName || stage}</Badge>;
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/platform-crm/pipeline')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <Briefcase className="w-8 h-8 text-primary" />
                <div>
                  <h1 className="text-3xl font-bold">{deal.dealName}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    {getStageBadge(deal.stage)}
                    <span className="text-sm text-muted-foreground">
                      {deal.probability}% likely
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                {deal.stage !== 'closed_won' && deal.stage !== 'closed_lost' && (
                  <>
                    {nextStage && (
                      <Button
                        variant="outline"
                        onClick={() => moveStageMutation.mutate(nextStage.stage)}
                      >
                        Move to {nextStage.displayName}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                    <Button variant="outline" className="text-green-600" onClick={handleCloseWon}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Mark as Won
                    </Button>
                    <Button variant="outline" className="text-red-600" onClick={handleCloseLost}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Mark as Lost
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deal Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(deal.dealValue)}</div>
              <p className="text-xs text-muted-foreground">
                Weighted: {formatCurrency(deal.weightedValue)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Probability</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{deal.probability}%</div>
              <Progress value={deal.probability} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expected Close</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {deal.expectedCloseDate
                  ? format(new Date(deal.expectedCloseDate), 'MMM d')
                  : 'TBD'}
              </div>
              {deal.expectedCloseDate && (
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(deal.expectedCloseDate), { addSuffix: true })}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">BANT Score</CardTitle>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bant?.totalBantScore || 0}/100</div>
              <p className="text-xs text-muted-foreground">
                {bant?.qualificationStatus || 'Not assessed'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stage Progress */}
        {deal.stage !== 'closed_won' && deal.stage !== 'closed_lost' && (
          <Card>
            <CardHeader>
              <CardTitle>Deal Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {STAGE_CONFIG.filter(s => s.stage !== 'closed_won' && s.stage !== 'closed_lost').map((stage, idx) => (
                    <div key={stage.stage} className="flex items-center">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                        stage.stage === deal.stage
                          ? 'bg-primary text-white'
                          : currentStageIndex > idx
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {currentStageIndex > idx ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <span className="text-sm font-semibold">{idx + 1}</span>
                        )}
                      </div>
                      {idx < STAGE_CONFIG.filter(s => s.stage !== 'closed_won' && s.stage !== 'closed_lost').length - 1 && (
                        <div className={`h-1 w-16 ${currentStageIndex > idx ? 'bg-green-600' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {STAGE_CONFIG.filter(s => s.stage !== 'closed_won' && s.stage !== 'closed_lost').map((stage) => (
                    <div key={stage.stage} className="text-center w-24">
                      {stage.displayName}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bant">BANT</TabsTrigger>
            <TabsTrigger value="activities">Activities ({activities?.length || 0})</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Deal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Deal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <>
                      <div className="space-y-2">
                        <Label>Deal Name</Label>
                        <Input
                          value={formData.dealName ?? deal.dealName}
                          onChange={(e) => setFormData({ ...formData, dealName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Deal Value</Label>
                        <Input
                          type="number"
                          value={formData.dealValue ?? deal.dealValue}
                          onChange={(e) => setFormData({ ...formData, dealValue: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expected Close Date</Label>
                        <Input
                          type="date"
                          value={formData.expectedCloseDate ?? deal.expectedCloseDate?.split('T')[0]}
                          onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Company:</span>
                        <span
                          className="font-semibold text-primary hover:underline cursor-pointer"
                          onClick={() => setLocation(`/platform-crm/business-records/${deal.businessRecordId}`)}
                        >
                          {deal.businessRecordName || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Value:</span>
                        <span className="font-semibold">{formatCurrency(deal.dealValue)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Target className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Probability:</span>
                        <span className="font-semibold">{deal.probability}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Weighted Value:</span>
                        <span className="font-semibold">{formatCurrency(deal.weightedValue)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Expected Close:</span>
                        <span className="font-semibold">
                          {deal.expectedCloseDate
                            ? format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')
                            : 'Not set'}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Team & Source */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Team & Source
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Assigned Rep:</span>
                    <span className="font-semibold">{deal.assignedRep || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Award className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Source:</span>
                    <span className="font-semibold">{deal.dealSource || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-semibold">
                      {format(new Date(deal.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span className="font-semibold">
                      {formatDistanceToNow(new Date(deal.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Outcome (if closed) */}
            {(deal.stage === 'closed_won' || deal.stage === 'closed_lost') && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {deal.stage === 'closed_won' ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="text-green-600">Deal Won</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span className="text-red-600">Deal Lost</span>
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Closed Date:</span>
                      <span className="font-semibold">
                        {deal.actualCloseDate
                          ? format(new Date(deal.actualCloseDate), 'MMM d, yyyy')
                          : 'Unknown'}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Reason:</span>
                      <p className="mt-1 font-semibold">
                        {deal.stage === 'closed_won' ? deal.wonReason : deal.lostReason}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea
                    value={formData.notes ?? deal.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    placeholder="Add notes about this deal..."
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {deal.notes || 'No notes added yet.'}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BANT Tab */}
          <TabsContent value="bant" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Budget</CardTitle>
                  <CardDescription>Financial qualification</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Score</span>
                      <span className="text-2xl font-bold">{bant?.budgetScore || 0}/25</span>
                    </div>
                    <Progress value={(bant?.budgetScore || 0) * 4} />
                    {bant?.budgetNotes && (
                      <p className="text-sm text-muted-foreground mt-2">{bant.budgetNotes}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Authority</CardTitle>
                  <CardDescription>Decision-making power</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Score</span>
                      <span className="text-2xl font-bold">{bant?.authorityScore || 0}/25</span>
                    </div>
                    <Progress value={(bant?.authorityScore || 0) * 4} />
                    {bant?.authorityNotes && (
                      <p className="text-sm text-muted-foreground mt-2">{bant.authorityNotes}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Need</CardTitle>
                  <CardDescription>Problem urgency</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Score</span>
                      <span className="text-2xl font-bold">{bant?.needScore || 0}/25</span>
                    </div>
                    <Progress value={(bant?.needScore || 0) * 4} />
                    {bant?.needNotes && (
                      <p className="text-sm text-muted-foreground mt-2">{bant.needNotes}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                  <CardDescription>Purchase timeline</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Score</span>
                      <span className="text-2xl font-bold">{bant?.timelineScore || 0}/25</span>
                    </div>
                    <Progress value={(bant?.timelineScore || 0) * 4} />
                    {bant?.timelineNotes && (
                      <p className="text-sm text-muted-foreground mt-2">{bant.timelineNotes}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Overall BANT Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">Total Score</span>
                    <span className="text-3xl font-bold">{bant?.totalBantScore || 0}/100</span>
                  </div>
                  <Progress value={bant?.totalBantScore || 0} />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant={
                      bant?.qualificationStatus === 'highly_qualified' ? 'default' :
                      bant?.qualificationStatus === 'qualified' ? 'default' :
                      bant?.qualificationStatus === 'partially_qualified' ? 'secondary' :
                      'destructive'
                    }>
                      {bant?.qualificationStatus || 'Not assessed'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Activity Timeline</CardTitle>
                  <Button size="sm">
                    <Activity className="w-4 h-4 mr-2" />
                    Log Activity
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {activities && activities.length > 0 ? (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex gap-4 pb-4 border-b last:border-0">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{activity.activityType}</Badge>
                                <span className="font-semibold text-sm">{activity.subject}</span>
                              </div>
                              {activity.description && (
                                <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatDistanceToNow(new Date(activity.activityDate), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            by {activity.createdBy}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No activities logged for this deal yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
