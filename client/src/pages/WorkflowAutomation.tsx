import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
  Settings,
  Plus,
  Play,
  Pause,
  Edit,
  Trash2,
  BarChart3,
  Mail,
  Bell,
  UserCheck,
  FileText
} from "lucide-react";

interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: 'service_ticket_created' | 'meter_reading_overdue' | 'contract_expiring' | 'customer_payment_overdue';
    conditions: Record<string, any>;
  };
  actions: Array<{
    type: 'assign_technician' | 'send_email' | 'create_task' | 'update_priority' | 'send_notification';
    parameters: Record<string, any>;
  }>;
  isActive: boolean;
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

export default function WorkflowAutomation() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<WorkflowRule | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: workflowRules, isLoading } = useQuery<WorkflowRule[]>({
    queryKey: ["/api/workflow-rules"],
  });

  const createRuleMutation = useMutation({
    mutationFn: async (ruleData: Partial<WorkflowRule>) => {
      return await apiRequest("/api/workflow-rules", "POST", ruleData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-rules"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Workflow rule created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create workflow rule",
        variant: "destructive",
      });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest(`/api/workflow-rules/${id}`, "PATCH", { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-rules"] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/workflow-rules/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-rules"] });
      toast({
        title: "Success",
        description: "Workflow rule deleted successfully",
      });
    },
  });

  const handleCreateRule = (formData: FormData) => {
    const ruleData = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      trigger: {
        type: formData.get("triggerType") as string,
        conditions: {}
      },
      actions: [{
        type: formData.get("actionType") as string,
        parameters: {}
      }],
      isActive: true
    };

    createRuleMutation.mutate(ruleData);
  };

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case 'service_ticket_created': return <FileText className="w-4 h-4" />;
      case 'meter_reading_overdue': return <Clock className="w-4 h-4" />;
      case 'contract_expiring': return <AlertTriangle className="w-4 h-4" />;
      case 'customer_payment_overdue': return <Mail className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'assign_technician': return <UserCheck className="w-4 h-4" />;
      case 'send_email': return <Mail className="w-4 h-4" />;
      case 'create_task': return <Plus className="w-4 h-4" />;
      case 'send_notification': return <Bell className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const filteredRules = workflowRules?.filter(rule => {
    if (filterStatus === "all") return true;
    if (filterStatus === "active") return rule.isActive;
    if (filterStatus === "inactive") return !rule.isActive;
    return true;
  }) || [];

  // Demo workflow templates
  const workflowTemplates = [
    {
      name: "Auto-Assign High Priority Tickets",
      description: "Automatically assign high priority service tickets to available senior technicians",
      trigger: "service_ticket_created",
      triggerConditions: "Priority = High",
      actions: "Assign to senior technician with matching skills"
    },
    {
      name: "Contract Expiration Alerts",
      description: "Send email notifications 30 days before contract expiration",
      trigger: "contract_expiring",
      triggerConditions: "30 days before expiration",
      actions: "Send email to account manager and customer"
    },
    {
      name: "Overdue Payment Reminders",
      description: "Automatically send payment reminders for overdue invoices",
      trigger: "customer_payment_overdue",
      triggerConditions: "Payment overdue by 15 days",
      actions: "Send email reminder and create follow-up task"
    },
    {
      name: "Meter Reading Automation",
      description: "Create service tickets for overdue meter readings",
      trigger: "meter_reading_overdue",
      triggerConditions: "Reading overdue by 7 days",
      actions: "Create service ticket and notify technician"
    }
  ];

  return (
    <MainLayout 
      title="Workflow Automation" 
      description="Automate routine tasks and business processes to improve efficiency"
    >
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Active Rules</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {filteredRules.filter(r => r.isActive).length}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Total Executions</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {filteredRules.reduce((sum, rule) => sum + rule.triggerCount, 0)}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Templates</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{workflowTemplates.length}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Time Saved</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">24h</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="rules" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList className="grid w-full sm:w-auto grid-cols-2 h-auto sm:h-10">
              <TabsTrigger value="rules" className="text-xs sm:text-sm">Workflow Rules</TabsTrigger>
              <TabsTrigger value="templates" className="text-xs sm:text-sm">Templates</TabsTrigger>
            </TabsList>

            <div className="flex gap-2 w-full sm:w-auto">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rules</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Rule
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Create Workflow Rule</DialogTitle>
                    <DialogDescription>
                      Define triggers and actions to automate your business processes
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    handleCreateRule(new FormData(e.currentTarget));
                  }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Rule Name</Label>
                        <Input id="name" name="name" placeholder="Auto-assign tickets" required />
                      </div>
                      <div>
                        <Label htmlFor="triggerType">Trigger</Label>
                        <Select name="triggerType" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select trigger" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="service_ticket_created">Service Ticket Created</SelectItem>
                            <SelectItem value="meter_reading_overdue">Meter Reading Overdue</SelectItem>
                            <SelectItem value="contract_expiring">Contract Expiring</SelectItem>
                            <SelectItem value="customer_payment_overdue">Payment Overdue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea 
                        id="description" 
                        name="description" 
                        placeholder="Describe what this rule does..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="actionType">Action</Label>
                      <Select name="actionType" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="assign_technician">Assign Technician</SelectItem>
                          <SelectItem value="send_email">Send Email</SelectItem>
                          <SelectItem value="create_task">Create Task</SelectItem>
                          <SelectItem value="send_notification">Send Notification</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createRuleMutation.isPending}>
                        {createRuleMutation.isPending ? "Creating..." : "Create Rule"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <TabsContent value="rules" className="space-y-4">
            {isLoading ? (
              <div className="grid gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredRules.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Workflow Rules</h3>
                  <p className="text-gray-600 mb-4">
                    Create your first workflow rule to start automating your business processes.
                  </p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredRules.map((rule) => (
                  <Card key={rule.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
                            <Badge variant={rule.isActive ? "default" : "secondary"}>
                              {rule.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-gray-600 mb-4">{rule.description}</p>
                          
                          <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                {getTriggerIcon(rule.trigger.type)}
                              </div>
                              <div>
                                <p className="text-sm font-medium">Trigger</p>
                                <p className="text-xs text-gray-600">
                                  {rule.trigger.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                {getActionIcon(rule.actions[0]?.type || '')}
                              </div>
                              <div>
                                <p className="text-sm font-medium">Action</p>
                                <p className="text-xs text-gray-600">
                                  {rule.actions[0]?.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'None'}
                                </p>
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium">Executions</p>
                              <p className="text-xs text-gray-600">{rule.triggerCount} times</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={(checked) => 
                              toggleRuleMutation.mutate({ id: rule.id, isActive: checked })
                            }
                          />
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => deleteRuleMutation.mutate(rule.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="grid gap-4">
              {workflowTemplates.map((template, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{template.name}</h3>
                        <p className="text-gray-600 mb-4">{template.description}</p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-900">Trigger: </span>
                            <span className="text-gray-600">{template.triggerConditions}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">Action: </span>
                            <span className="text-gray-600">{template.actions}</span>
                          </div>
                        </div>
                      </div>
                      
                      <Button variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}