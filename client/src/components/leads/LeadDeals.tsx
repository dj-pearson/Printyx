import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  Target,
  Plus,
  DollarSign,
  Calendar,
  Building2,
  Users,
  TrendingUp,
  Clock,
  ArrowRight,
  Edit,
  MoreHorizontal,
  ExternalLink,
  Briefcase
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LeadDealsProps {
  leadId: string;
  leadName: string;
  companyId: string;
}

interface Deal {
  id: string;
  title: string;
  description?: string;
  amount?: number;
  companyName?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  source?: string;
  dealType?: string;
  priority: "low" | "medium" | "high";
  stageId: string;
  stageName?: string;
  stageColor?: string;
  probability?: number;
  expectedCloseDate?: string;
  ownerId?: string;
  ownerName?: string;
  createdAt: string;
  updatedAt?: string;
  leadId?: string;
}

interface DealStage {
  id: string;
  name: string;
  color: string;
  order: number;
  probability: number;
}

interface CreateDealFormData {
  title: string;
  description: string;
  amount: string;
  dealType: string;
  priority: "low" | "medium" | "high";
  expectedCloseDate: string;
  notes: string;
  stageId: string;
}

export function LeadDeals({ leadId, leadName, companyId }: LeadDealsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateDealFormData>({
    title: "",
    description: "",
    amount: "",
    dealType: "",
    priority: "medium",
    expectedCloseDate: "",
    notes: "",
    stageId: "",
  });

  // Handle Quick Actions CTA events from LeadDetail
  useEffect(() => {
    const handleTabAction = (event: CustomEvent) => {
      const { action, leadId: eventLeadId, companyName } = event.detail || {};
      
      if (action === 'createDeal') {
        setIsCreateDialogOpen(true);
      } else if (action === 'createQuote') {
        // Route to quote builder with deal context
        const params = new URLSearchParams({
          leadId: eventLeadId || leadId,
          companyName: companyName || leadName,
          prefill: 'true',
          source: 'deal'
        });
        window.open(`/quotes/new?${params.toString()}`, '_blank');
      } else if (action === 'createProposal') {
        // Route to proposal builder with deal context
        const params = new URLSearchParams({
          leadId: eventLeadId || leadId,
          companyName: companyName || leadName,
          prefill: 'true',
          source: 'deal'
        });
        window.open(`/proposals/new?${params.toString()}`, '_blank');
      }
    };

    window.addEventListener('leadTabAction', handleTabAction as EventListener);
    return () => {
      window.removeEventListener('leadTabAction', handleTabAction as EventListener);
    };
  }, [leadId, leadName]);

  // Fetch deals associated with this lead
  const { data: deals = [], isLoading: dealsLoading } = useQuery<Deal[]>({
    queryKey: ['/api/deals', { leadId }],
    queryFn: async () => {
      const response = await apiRequest(`/api/deals?leadId=${leadId}`, 'GET');
      return response || [];
    },
  });

  // Fetch deal stages for dropdown
  const { data: stages = [], isLoading: stagesLoading } = useQuery<DealStage[]>({
    queryKey: ['/api/deal-stages'],
    queryFn: async () => {
      const response = await apiRequest('/api/deal-stages', 'GET');
      return response || [];
    },
  });

  // Create deal mutation
  const createDealMutation = useMutation({
    mutationFn: async (dealData: any) => {
      return await apiRequest('/api/deals', 'POST', dealData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      setIsCreateDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        amount: "",
        dealType: "",
        priority: "medium",
        expectedCloseDate: "",
        notes: "",
        stageId: "",
      });
      toast({
        title: "Success",
        description: "Deal created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to create deal",
        variant: "destructive",
      });
    },
  });

  // Phase 2: Enhanced validation with stage guards (poka-yoke)
  const validateDealData = (data: CreateDealFormData) => {
    const errors = [];
    
    // Required field validations
    if (!data.title.trim()) {
      errors.push("Deal title is required");
    }
    
    if (!data.stageId) {
      errors.push("Deal stage must be selected");
    }
    
    // Stage-specific validations (stage guards)
    const selectedStage = stages.find(s => s.id === data.stageId);
    if (selectedStage) {
      // Early stage requirements
      if (selectedStage.name === 'Qualified' || selectedStage.name === 'Needs Analysis') {
        if (!data.description.trim()) {
          errors.push("Description is required for qualified deals");
        }
      }
      
      // Proposal/negotiation stage requirements
      if (selectedStage.name === 'Proposal' || selectedStage.name === 'Negotiation') {
        if (!data.amount || parseFloat(data.amount) <= 0) {
          errors.push("Deal amount is required for proposal stage and beyond");
        }
        if (!data.expectedCloseDate) {
          errors.push("Expected close date is required for proposal stage and beyond");
        }
      }
      
      // High-value deal requirements (poka-yoke)
      if (data.amount && parseFloat(data.amount) > 50000) {
        if (data.priority === 'low') {
          errors.push("High-value deals (>$50K) cannot be set as low priority");
        }
        if (!data.notes.trim()) {
          errors.push("Notes are required for high-value deals (>$50K)");
        }
      }
    }
    
    // Business logic validations
    if (data.expectedCloseDate) {
      const closeDate = new Date(data.expectedCloseDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (closeDate < today) {
        errors.push("Expected close date cannot be in the past");
      }
      
      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
      
      if (closeDate > threeMonthsFromNow && !data.notes.trim()) {
        errors.push("Deals with close dates beyond 3 months require notes explaining the timeline");
      }
    }
    
    return errors;
  };

  const handleCreateDeal = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Phase 2: Apply stage guards and validations
    const validationErrors = validateDealData(formData);
    if (validationErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: validationErrors[0], // Show first error
        variant: "destructive",
      });
      return;
    }

    const dealData = {
      title: formData.title,
      description: formData.description,
      amount: formData.amount ? parseFloat(formData.amount) : undefined,
      dealType: formData.dealType || undefined,
      priority: formData.priority,
      expectedCloseDate: formData.expectedCloseDate || undefined,
      notes: formData.notes || undefined,
      stageId: formData.stageId || stages[0]?.id,
      companyId: companyId,
      companyName: leadName,
      leadId: leadId, // Associate with the lead
      ownerId: user?.id,
    };

    createDealMutation.mutate(dealData);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStageColor = (stageColor?: string) => {
    return stageColor || "#6B7280";
  };

  if (dealsLoading || stagesLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-sm text-gray-600">Loading deals...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Associated Deals
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Track opportunities and deals for {leadName}
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Deal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Create New Deal for {leadName}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleCreateDeal} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="title">Deal Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., New copier lease for Q4"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="amount">Deal Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <Label htmlFor="dealType">Deal Type</Label>
                  <Select
                    value={formData.dealType}
                    onValueChange={(value) => setFormData({ ...formData, dealType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lease">Lease</SelectItem>
                      <SelectItem value="purchase">Purchase</SelectItem>
                      <SelectItem value="service">Service Agreement</SelectItem>
                      <SelectItem value="upgrade">Equipment Upgrade</SelectItem>
                      <SelectItem value="renewal">Contract Renewal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: "low" | "medium" | "high") => 
                      setFormData({ ...formData, priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
                  <Input
                    id="expectedCloseDate"
                    type="date"
                    value={formData.expectedCloseDate}
                    onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="stageId">Initial Stage</Label>
                  <Select
                    value={formData.stageId}
                    onValueChange={(value) => setFormData({ ...formData, stageId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the opportunity..."
                    rows={3}
                  />
                </div>
                
                <div className="col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={2}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createDealMutation.isPending}
                >
                  {createDealMutation.isPending ? "Creating..." : "Create Deal"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Deals List */}
      {deals.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <Target className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No deals yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first deal to start tracking opportunities for {leadName}
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Deal
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {deals.map((deal) => (
            <Card key={deal.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900 truncate">
                        {deal.title}
                      </h4>
                      <Badge className={getPriorityColor(deal.priority)}>
                        {deal.priority}
                      </Badge>
                      {deal.stageName && (
                        <Badge 
                          variant="outline"
                          className="border-2"
                          style={{ 
                            borderColor: getStageColor(deal.stageColor),
                            color: getStageColor(deal.stageColor)
                          }}
                        >
                          {deal.stageName}
                        </Badge>
                      )}
                    </div>
                    
                    {deal.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {deal.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {deal.amount && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          ${deal.amount.toLocaleString()}
                        </div>
                      )}
                      {deal.probability && (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          {deal.probability}%
                        </div>
                      )}
                      {deal.expectedCloseDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(deal.expectedCloseDate), "MMM d, yyyy")}
                        </div>
                      )}
                      {deal.ownerName && (
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {deal.ownerName}
                        </div>
                      )}
                    </div>
                    
                    {deal.dealType && (
                      <div className="flex items-center gap-1 mt-2">
                        <Briefcase className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{deal.dealType}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => window.open(`/deals/${deal.id}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Enhanced Summary Stats with Goal Attainment */}
      {deals.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{deals.length}</div>
                <div className="text-sm text-gray-600">Total Deals</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  ${deals.reduce((sum, deal) => sum + (deal.amount || 0), 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Total Value</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {(() => {
                    const totalValue = deals.reduce((sum, deal) => sum + (deal.amount || 0), 0);
                    const monthlyGoal = 50000; // Lead-specific goal (smaller than company-wide)
                    const attainmentPct = Math.min(100, Math.round((totalValue / monthlyGoal) * 100));
                    return `${attainmentPct}%`;
                  })()}
                </div>
                <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                  Goal Attainment
                  <Badge 
                    variant={(() => {
                      const totalValue = deals.reduce((sum, deal) => sum + (deal.amount || 0), 0);
                      const monthlyGoal = 50000;
                      const attainment = (totalValue / monthlyGoal) * 100;
                      return attainment >= 90 ? 'default' : attainment >= 70 ? 'secondary' : 'destructive';
                    })()} 
                    className="text-xs ml-1"
                  >
                    {(() => {
                      const totalValue = deals.reduce((sum, deal) => sum + (deal.amount || 0), 0);
                      const monthlyGoal = 50000;
                      const attainment = (totalValue / monthlyGoal) * 100;
                      return attainment >= 90 ? 'On Track' : attainment >= 70 ? 'At Risk' : 'Behind';
                    })()}
                  </Badge>
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {(() => {
                    const totalValue = deals.reduce((sum, deal) => sum + (deal.amount || 0), 0);
                    const monthlyGoal = 50000;
                    const remaining = Math.max(0, monthlyGoal - totalValue);
                    return `$${remaining.toLocaleString()}`;
                  })()}
                </div>
                <div className="text-sm text-gray-600">Remaining to Goal</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}