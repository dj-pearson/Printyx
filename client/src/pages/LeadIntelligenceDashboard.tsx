/**
 * Lead Intelligence Dashboard
 *
 * Unified dashboard for lead scoring, Apollo.io enrichment, and Salesforce sync.
 * Provides AI-powered lead qualification insights and recommended actions.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  Brain,
  Target,
  TrendingUp,
  Users,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Phone,
  Mail,
  Building2,
  Flame,
  ThermometerSun,
  Snowflake,
  CheckCircle,
  AlertTriangle,
  Clock,
  BarChart3,
  PieChart,
  Loader2,
  Zap,
  DollarSign,
  Calendar,
  Award,
  Cloud,
  Search,
} from 'lucide-react';
import { Link } from 'wouter';

interface LeadScore {
  leadId: string;
  totalScore: number;
  leadGrade: string;
  leadTier: string;
  recommendedAction: string;
  calculatedAt: string;
  lead?: {
    id: string;
    companyName: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    status: string;
    ownerId?: string;
    lastActivityDate?: string;
  };
}

interface ScoringAnalytics {
  totalLeads: number;
  scoredLeads: number;
  averageScore: number;
  scoreDistribution: { tier: string; count: number }[];
  gradeDistribution: { grade: string; count: number }[];
  topRules: { ruleName: string; timesApplied: number; totalPoints: number }[];
  recentActivity: { date: string; leadsScored: number; averageScore: number }[];
}

export default function LeadIntelligenceDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch analytics overview
  const { data: analytics, isLoading: isLoadingAnalytics, refetch: refetchAnalytics } = useQuery<ScoringAnalytics>({
    queryKey: ['lead-intelligence-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/lead-intelligence/analytics/overview');
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
  });

  // Fetch leads requiring attention
  const { data: attentionLeads, isLoading: isLoadingAttention, refetch: refetchAttention } = useQuery<LeadScore[]>({
    queryKey: ['lead-intelligence-attention'],
    queryFn: async () => {
      const res = await fetch('/api/lead-intelligence/attention/required?limit=10');
      if (!res.ok) throw new Error('Failed to fetch attention leads');
      return res.json();
    },
  });

  // Fetch Apollo.io stats
  const { data: apolloStats, isLoading: isLoadingApollo } = useQuery({
    queryKey: ['apollo-stats'],
    queryFn: async () => {
      const res = await fetch('/api/apollo/stats');
      if (!res.ok) throw new Error('Failed to fetch Apollo stats');
      return res.json();
    },
  });

  // Batch score mutation
  const batchScoreMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const res = await fetch('/api/lead-intelligence/batch/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds }),
      });
      if (!res.ok) throw new Error('Batch scoring failed');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Batch Scoring Complete',
        description: `Scored ${data.processed} leads successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['lead-intelligence-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['lead-intelligence-attention'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Scoring Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'hot':
        return <Flame className="h-4 w-4 text-red-500" />;
      case 'warm':
        return <ThermometerSun className="h-4 w-4 text-orange-500" />;
      case 'cold':
        return <Snowflake className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'hot':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warm':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'cold':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-600';
    if (grade.startsWith('B')) return 'text-blue-600';
    if (grade.startsWith('C')) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'contact_immediately':
        return <Phone className="h-4 w-4" />;
      case 'nurture':
        return <Mail className="h-4 w-4" />;
      case 'request_more_info':
        return <Search className="h-4 w-4" />;
      case 'disqualify':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const isLoading = isLoadingAnalytics || isLoadingAttention;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Lead Intelligence</h1>
            <p className="text-muted-foreground">
              AI-powered lead qualification and scoring insights
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchAnalytics();
              refetchAttention();
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.totalLeads?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics?.scoredLeads?.toLocaleString() || 0} scored
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.averageScore || 0}
              <span className="text-sm font-normal text-muted-foreground">/100</span>
            </div>
            <Progress value={analytics?.averageScore || 0} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Hot Leads</CardTitle>
            <Flame className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {analytics?.scoreDistribution?.find((d) => d.tier === 'hot')?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">Ready to contact</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Enriched</CardTitle>
            <Sparkles className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {apolloStats?.totalLeadsEnriched || 0}
            </div>
            <p className="text-xs text-muted-foreground">From Apollo.io</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attention">Needs Attention</TabsTrigger>
          <TabsTrigger value="scoring">Scoring Rules</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Lead Score Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics?.scoreDistribution?.map((dist) => (
                    <div key={dist.tier} className="flex items-center gap-4">
                      <div className="flex items-center gap-2 w-24">
                        {getTierIcon(dist.tier)}
                        <span className="capitalize font-medium">{dist.tier}</span>
                      </div>
                      <div className="flex-1">
                        <Progress
                          value={
                            analytics.scoredLeads > 0
                              ? (dist.count / analytics.scoredLeads) * 100
                              : 0
                          }
                          className={`h-3 ${
                            dist.tier === 'hot'
                              ? '[&>div]:bg-red-500'
                              : dist.tier === 'warm'
                              ? '[&>div]:bg-orange-500'
                              : '[&>div]:bg-blue-500'
                          }`}
                        />
                      </div>
                      <div className="w-16 text-right font-medium">{dist.count}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Grade Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Lead Grade Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3">
                  {['A+', 'A', 'B+', 'B', 'C+', 'C', 'D'].map((grade) => {
                    const count =
                      analytics?.gradeDistribution?.find((g) => g.grade === grade)?.count || 0;
                    return (
                      <div
                        key={grade}
                        className="p-3 rounded-lg border text-center"
                      >
                        <div className={`text-2xl font-bold ${getGradeColor(grade)}`}>
                          {grade}
                        </div>
                        <div className="text-sm text-muted-foreground">{count} leads</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Performing Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Top Scoring Rules
              </CardTitle>
              <CardDescription>Rules contributing most to lead scores</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule Name</TableHead>
                    <TableHead className="text-right">Times Applied</TableHead>
                    <TableHead className="text-right">Total Points</TableHead>
                    <TableHead className="text-right">Avg Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics?.topRules?.slice(0, 5).map((rule, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{rule.ruleName}</TableCell>
                      <TableCell className="text-right">{rule.timesApplied}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        +{rule.totalPoints}
                      </TableCell>
                      <TableCell className="text-right">
                        {rule.timesApplied > 0
                          ? Math.round(rule.totalPoints / rule.timesApplied)
                          : 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attention" className="space-y-4">
          <Alert>
            <Flame className="h-4 w-4" />
            <AlertTitle>Hot Leads Requiring Action</AlertTitle>
            <AlertDescription>
              These high-scoring leads should be contacted immediately for best conversion rates.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Priority Leads</CardTitle>
              <CardDescription>
                Leads with highest scores and recommended immediate action
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAttention ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : attentionLeads && attentionLeads.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Recommended Action</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attentionLeads.map((lead) => (
                      <TableRow key={lead.leadId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {lead.lead?.companyName || 'Unknown'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {lead.lead?.firstName} {lead.lead?.lastName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={lead.totalScore} className="w-16 h-2" />
                            <span className="font-bold">{lead.totalScore}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold text-lg ${getGradeColor(lead.leadGrade)}`}>
                            {lead.leadGrade}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 ${getTierColor(lead.leadTier)}`}>
                            {getTierIcon(lead.leadTier)}
                            {lead.leadTier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1">
                            {getActionIcon(lead.recommendedAction)}
                            {formatAction(lead.recommendedAction)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {lead.lead?.lastActivityDate
                            ? new Date(lead.lead.lastActivityDate).toLocaleDateString()
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Link href={`/leads/${lead.leadId}`}>
                            <Button variant="ghost" size="sm">
                              View
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No leads requiring immediate attention
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Scoring Configuration
              </CardTitle>
              <CardDescription>
                Configure how leads are scored based on various criteria
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Firmographic Scoring</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Company size, industry, revenue, and location-based scoring
                  </p>
                  <Badge variant="secondary" className="mt-2">Max 20 points</Badge>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Demographic Scoring</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Job title, seniority, department, and role-based scoring
                  </p>
                  <Badge variant="secondary" className="mt-2">Max 20 points</Badge>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">Behavioral Scoring</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Website visits, content downloads, and activity patterns
                  </p>
                  <Badge variant="secondary" className="mt-2">Max 20 points</Badge>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-5 w-5 text-orange-500" />
                    <span className="font-medium">Engagement Scoring</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Email opens, meeting attendance, and response rates
                  </p>
                  <Badge variant="secondary" className="mt-2">Max 20 points</Badge>
                </div>

                <div className="p-4 border rounded-lg md:col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-yellow-500" />
                    <span className="font-medium">BANT Qualification</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Budget, Authority, Need, and Timeline assessment (weighted at 80%)
                  </p>
                  <Badge variant="secondary" className="mt-2">Max 25 points (20 weighted)</Badge>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">Total Maximum Score: 100</div>
                  <div className="text-sm text-muted-foreground">
                    Hot: 75+ | Warm: 50-74 | Cold: Below 50
                  </div>
                </div>
                <Link href="/settings/lead-scoring">
                  <Button>
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Rules
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Apollo.io Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-purple-500" />
                  Apollo.io Enrichment
                </CardTitle>
                <CardDescription>
                  Lead data enrichment and prospecting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg text-center">
                    <div className="text-2xl font-bold">
                      {apolloStats?.totalSearches || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Searches</div>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {apolloStats?.totalLeadsEnriched || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Enriched</div>
                  </div>
                </div>

                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    Auto-enrichment is active. New leads are automatically enriched from Apollo.io.
                  </AlertDescription>
                </Alert>

                <Link href="/data-enrichment">
                  <Button variant="outline" className="w-full">
                    <Search className="h-4 w-4 mr-2" />
                    Open Apollo Search
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Salesforce Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-blue-500" />
                  Salesforce Sync
                </CardTitle>
                <CardDescription>
                  Bi-directional CRM synchronization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg text-center">
                    <div className="text-2xl font-bold">-</div>
                    <div className="text-sm text-muted-foreground">Synced Records</div>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">-</div>
                    <div className="text-sm text-muted-foreground">Last Sync</div>
                  </div>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription>
                    Configure Salesforce integration to enable data synchronization.
                  </AlertDescription>
                </Alert>

                <Link href="/settings/integrations/salesforce">
                  <Button variant="outline" className="w-full">
                    <Cloud className="h-4 w-4 mr-2" />
                    Configure Salesforce
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
