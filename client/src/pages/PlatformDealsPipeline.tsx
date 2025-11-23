import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  TrendingUp,
  Target,
  Briefcase,
  Plus,
  MoreVertical,
  Calendar,
  Building2,
  User,
  RefreshCw,
  BarChart3,
  Eye,
  Edit,
  ArrowRight,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { format } from "date-fns";
import MainLayout from "@/components/layout/main-layout";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
  assignedRep?: string;
  createdAt: string;
}

interface PipelineStage {
  stage: string;
  displayName: string;
  count: number;
  totalValue: number;
  weightedValue: number;
  probability: number;
  deals: Deal[];
}

const STAGE_CONFIG = [
  { stage: 'prospecting', displayName: 'Prospecting', color: 'bg-gray-100' },
  { stage: 'qualification', displayName: 'Qualification', color: 'bg-blue-100' },
  { stage: 'needs_analysis', displayName: 'Needs Analysis', color: 'bg-cyan-100' },
  { stage: 'proposal', displayName: 'Proposal', color: 'bg-purple-100' },
  { stage: 'negotiation', displayName: 'Negotiation', color: 'bg-yellow-100' },
  { stage: 'closed_won', displayName: 'Closed Won', color: 'bg-green-100' },
  { stage: 'closed_lost', displayName: 'Closed Lost', color: 'bg-red-100' },
];

export default function PlatformDealsPipeline() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch pipeline data
  const { data: pipelineData, isLoading, refetch } = useQuery<{ pipeline: PipelineStage[] }>({
    queryKey: ["/api/platform-deals/pipeline"],
    refetchInterval: 30000,
  });

  // Move stage mutation
  const moveStageMutation = useMutation({
    mutationFn: async ({ dealId, newStage }: { dealId: string; newStage: string }) => {
      const response = await fetch(`/api/platform-deals/${dealId}/move-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStage }),
      });
      if (!response.ok) throw new Error('Failed to move deal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-deals/pipeline"] });
      toast({
        title: "Success",
        description: "Deal moved successfully",
      });
    },
  });

  // Close won mutation
  const closeWonMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const response = await fetch(`/api/platform-deals/${dealId}/close-won`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualCloseDate: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error('Failed to close deal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-deals/pipeline"] });
      toast({
        title: "Success",
        description: "Deal marked as won!",
      });
    },
  });

  // Close lost mutation
  const closeLostMutation = useMutation({
    mutationFn: async ({ dealId, lostReason }: { dealId: string; lostReason: string }) => {
      const response = await fetch(`/api/platform-deals/${dealId}/close-lost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lostReason, actualCloseDate: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error('Failed to close deal');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-deals/pipeline"] });
      toast({
        title: "Deal Closed",
        description: "Deal marked as lost",
      });
    },
  });

  const pipeline = pipelineData?.pipeline || [];

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const totalPipelineValue = pipeline.reduce((sum, stage) => sum + stage.totalValue, 0);
  const totalWeightedValue = pipeline.reduce((sum, stage) => sum + stage.weightedValue, 0);
  const totalDeals = pipeline.reduce((sum, stage) => sum + stage.count, 0);

  const getStageColor = (stageName: string) => {
    return STAGE_CONFIG.find(s => s.stage === stageName)?.color || 'bg-gray-100';
  };

  const getStageDisplayName = (stageName: string) => {
    return STAGE_CONFIG.find(s => s.stage === stageName)?.displayName || stageName;
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Briefcase className="w-8 h-8 text-primary" />
              Sales Pipeline
            </h1>
            <p className="text-muted-foreground mt-1">
              Track deals through your sales process
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => setLocation('/platform-crm/deals/new')}>
              <Plus className="w-4 h-4 mr-2" />
              New Deal
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDeals}</div>
              <p className="text-xs text-muted-foreground">Active opportunities</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalPipelineValue)}</div>
              <p className="text-xs text-muted-foreground">Total potential revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weighted Value</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalWeightedValue)}</div>
              <p className="text-xs text-muted-foreground">Probability-adjusted</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalWeightedValue > 0
                  ? ((totalWeightedValue / totalPipelineValue) * 100).toFixed(1)
                  : 0}%
              </div>
              <p className="text-xs text-muted-foreground">Expected conversion</p>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline View */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Loading pipeline...</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Pipeline Stages
              </CardTitle>
              <CardDescription>Drag deals between stages or use quick actions</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-4 pb-4">
                  {STAGE_CONFIG.filter(config =>
                    pipeline.some(s => s.stage === config.stage)
                  ).map((stageConfig) => {
                    const stage = pipeline.find(s => s.stage === stageConfig.stage);
                    if (!stage) return null;

                    return (
                      <div
                        key={stage.stage}
                        className="flex-shrink-0 w-80 space-y-3"
                      >
                        {/* Stage Header */}
                        <div className={`${getStageColor(stage.stage)} p-4 rounded-lg`}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold">{getStageDisplayName(stage.stage)}</h3>
                            <Badge variant="secondary">{stage.count}</Badge>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total:</span>
                              <span className="font-semibold">{formatCurrency(stage.totalValue)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Weighted:</span>
                              <span className="font-semibold">{formatCurrency(stage.weightedValue)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Probability:</span>
                              <span className="font-semibold">{stage.probability}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Stage Deals */}
                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                          {stage.deals?.map((deal) => (
                            <Card
                              key={deal.id}
                              className="cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => setLocation(`/platform-crm/deals/${deal.id}`)}
                            >
                              <CardContent className="p-4 space-y-3">
                                {/* Deal Header */}
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-semibold text-sm leading-tight">
                                    {deal.dealName}
                                  </h4>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                      <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        setLocation(`/platform-crm/deals/${deal.id}`);
                                      }}>
                                        <Eye className="w-4 h-4 mr-2" />
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        setLocation(`/platform-crm/deals/${deal.id}/edit`);
                                      }}>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-green-600"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          closeWonMutation.mutate(deal.id);
                                        }}
                                      >
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Mark as Won
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-red-600"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const reason = prompt('Reason for loss:');
                                          if (reason) {
                                            closeLostMutation.mutate({ dealId: deal.id, lostReason: reason });
                                          }
                                        }}
                                      >
                                        <XCircle className="w-4 h-4 mr-2" />
                                        Mark as Lost
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>

                                {/* Company */}
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Building2 className="w-3 h-3" />
                                  <span className="truncate">{deal.businessRecordName || 'Unknown'}</span>
                                </div>

                                {/* Value */}
                                <div className="flex items-center justify-between">
                                  <div className="text-lg font-bold text-primary">
                                    {formatCurrency(deal.dealValue)}
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {deal.probability}% likely
                                  </Badge>
                                </div>

                                {/* Meta */}
                                <div className="space-y-1 text-xs text-muted-foreground">
                                  {deal.expectedCloseDate && (
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      <span>Close: {format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')}</span>
                                    </div>
                                  )}
                                  {deal.assignedRep && (
                                    <div className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      <span>{deal.assignedRep}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Stage Navigation */}
                                {stage.stage !== 'closed_won' && stage.stage !== 'closed_lost' && (
                                  <div className="pt-2 border-t">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="w-full text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const currentIndex = STAGE_CONFIG.findIndex(s => s.stage === stage.stage);
                                        const nextStage = STAGE_CONFIG[currentIndex + 1];
                                        if (nextStage) {
                                          moveStageMutation.mutate({
                                            dealId: deal.id,
                                            newStage: nextStage.stage
                                          });
                                        }
                                      }}
                                    >
                                      Move to Next Stage
                                      <ArrowRight className="w-3 h-3 ml-1" />
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}

                          {stage.deals?.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                              No deals in this stage
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && totalDeals === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-semibold mb-2">No deals in pipeline</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first deal to start tracking opportunities
                </p>
                <Button onClick={() => setLocation('/platform-crm/deals/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Deal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
