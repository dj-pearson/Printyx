import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, Plus, Save, Download, CheckCircle, Clock, AlertTriangle, 
  Monitor, Network, Settings, ListTodo, FileText, Edit, Trash2, Calendar
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface OnboardingData {
  checklist: any;
  equipment: any[];
  networkConfigs: any[];
  printConfigs: any[];
  dynamicSections: any[];
  tasks: any[];
}

export default function OnboardingDetails() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch onboarding data
  const { data, isLoading, error } = useQuery<OnboardingData>({
    queryKey: [`/api/onboarding/checklists/${id}`],
    enabled: !!id,
  });

  // Update checklist mutation
  const updateChecklistMutation = useMutation({
    mutationFn: (updates: any) => apiRequest(`/api/onboarding/checklists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/onboarding/checklists/${id}`] });
      toast({
        title: "Success",
        description: "Checklist updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update checklist",
        variant: "destructive",
      });
    },
  });

  // Add equipment mutation
  const addEquipmentMutation = useMutation({
    mutationFn: (equipment: any) => apiRequest(`/api/onboarding/checklists/${id}/equipment`, {
      method: 'POST',
      body: JSON.stringify(equipment),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/onboarding/checklists/${id}`] });
      setIsAddEquipmentOpen(false);
      toast({
        title: "Success",
        description: "Equipment added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add equipment",
        variant: "destructive",
      });
    },
  });

  // Add dynamic section mutation
  const addSectionMutation = useMutation({
    mutationFn: (section: any) => apiRequest(`/api/onboarding/checklists/${id}/sections`, {
      method: 'POST',
      body: JSON.stringify(section),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/onboarding/checklists/${id}`] });
      setIsAddSectionOpen(false);
      toast({
        title: "Success",
        description: "Section added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add section",
        variant: "destructive",
      });
    },
  });

  // Add task mutation
  const addTaskMutation = useMutation({
    mutationFn: (task: any) => apiRequest(`/api/onboarding/checklists/${id}/tasks`, {
      method: 'POST',
      body: JSON.stringify(task),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/onboarding/checklists/${id}`] });
      setIsAddTaskOpen(false);
      toast({
        title: "Success",
        description: "Task added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add task",
        variant: "destructive",
      });
    },
  });

  // Generate PDF mutation
  const generatePdfMutation = useMutation({
    mutationFn: () => apiRequest(`/api/onboarding/checklists/${id}/generate-pdf`, {
      method: 'POST',
    }),
    onSuccess: (data: { pdfUrl: string }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/onboarding/checklists/${id}`] });
      toast({
        title: "Success",
        description: "PDF generated successfully",
      });
      window.open(data.pdfUrl, '_blank');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate PDF",
        variant: "destructive",
      });
    },
  });

  const handleAddEquipment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const equipment = {
      manufacturer: formData.get('manufacturer') as string,
      model: formData.get('model') as string,
      serialNumber: formData.get('serialNumber') as string,
      assetTag: formData.get('assetTag') as string,
      buildingLocation: formData.get('buildingLocation') as string,
      roomLocation: formData.get('roomLocation') as string,
      specificLocation: formData.get('specificLocation') as string,
      targetIpAddress: formData.get('targetIpAddress') as string,
      hostname: formData.get('hostname') as string,
    };

    addEquipmentMutation.mutate(equipment);
  };

  const handleAddSection = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const section = {
      sectionTitle: formData.get('sectionTitle') as string,
      sectionDescription: formData.get('sectionDescription') as string,
      sectionOrder: data?.dynamicSections?.length || 0,
    };

    addSectionMutation.mutate(section);
  };

  const handleAddTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const task = {
      taskTitle: formData.get('taskTitle') as string,
      taskDescription: formData.get('taskDescription') as string,
      priority: formData.get('priority') as string,
      assignedTo: formData.get('assignedTo') as string || null,
      dueDate: formData.get('dueDate') as string || null,
    };

    addTaskMutation.mutate(task);
  };

  const updateStatus = (status: string) => {
    updateChecklistMutation.mutate({ status });
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardContent className="text-center py-12">
            <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">Error Loading Checklist</h3>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Checklist not found"}
            </p>
            <Button onClick={() => navigate('/onboarding')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { checklist, equipment, networkConfigs, printConfigs, dynamicSections, tasks } = data;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const completedTasks = tasks.filter((task: any) => task.status === 'completed').length;
  const totalProgress = Math.round(((completedTasks / Math.max(tasks.length, 1)) * 100));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/onboarding')}
            className="min-h-8"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{checklist.checklistTitle}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {checklist.customerData?.companyName} • {checklist.installationType?.replace('_', ' ')}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Select value={checklist.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-40 min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => generatePdfMutation.mutate()}
            disabled={generatePdfMutation.isPending}
            className="min-h-11"
          >
            <Download className="w-4 h-4 mr-2" />
            Generate PDF
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={getStatusColor(checklist.status)}>
              {checklist.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{totalProgress}%</div>
              <Progress value={totalProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Equipment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{equipment.length}</div>
            <p className="text-xs text-muted-foreground">
              {equipment.filter((e: any) => e.isInstalled).length} installed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks}/{tasks.length}</div>
            <p className="text-xs text-muted-foreground">completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Company:</span>
                    <span>{checklist.customerData?.companyName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contact:</span>
                    <span>{checklist.customerData?.primaryContact || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone:</span>
                    <span>{checklist.customerData?.phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span>{checklist.customerData?.email || 'N/A'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Site Information */}
            <Card>
              <CardHeader>
                <CardTitle>Site Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Address:</span>
                    <span className="text-right max-w-xs">
                      {checklist.siteInformation?.address || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Scheduled:</span>
                    <span>
                      {checklist.scheduledInstallDate 
                        ? format(new Date(checklist.scheduledInstallDate), 'MMM dd, yyyy')
                        : 'TBD'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Installation Type:</span>
                    <span>{checklist.installationType?.replace('_', ' ')}</span>
                  </div>
                </div>
                {checklist.accessRequirements && (
                  <div>
                    <h4 className="font-medium mb-2">Access Requirements</h4>
                    <p className="text-sm text-muted-foreground">{checklist.accessRequirements}</p>
                  </div>
                )}
                {checklist.specialInstructions && (
                  <div>
                    <h4 className="font-medium mb-2">Special Instructions</h4>
                    <p className="text-sm text-muted-foreground">{checklist.specialInstructions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="equipment" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Equipment List</h3>
            <Dialog open={isAddEquipmentOpen} onOpenChange={setIsAddEquipmentOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Equipment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Equipment</DialogTitle>
                  <DialogDescription>
                    Add a new piece of equipment to this installation
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddEquipment} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="manufacturer">Manufacturer</Label>
                      <Input id="manufacturer" name="manufacturer" required className="min-h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model">Model</Label>
                      <Input id="model" name="model" required className="min-h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serialNumber">Serial Number</Label>
                      <Input id="serialNumber" name="serialNumber" className="min-h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assetTag">Asset Tag</Label>
                      <Input id="assetTag" name="assetTag" className="min-h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="buildingLocation">Building</Label>
                      <Input id="buildingLocation" name="buildingLocation" className="min-h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="roomLocation">Room</Label>
                      <Input id="roomLocation" name="roomLocation" className="min-h-11" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="specificLocation">Specific Location</Label>
                      <Input id="specificLocation" name="specificLocation" className="min-h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetIpAddress">IP Address</Label>
                      <Input id="targetIpAddress" name="targetIpAddress" className="min-h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hostname">Hostname</Label>
                      <Input id="hostname" name="hostname" className="min-h-11" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsAddEquipmentOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addEquipmentMutation.isPending}>
                      {addEquipmentMutation.isPending ? "Adding..." : "Add Equipment"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {equipment.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Monitor className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No equipment added</h3>
                  <p className="text-muted-foreground mb-4">
                    Add equipment to track installation progress
                  </p>
                  <Button onClick={() => setIsAddEquipmentOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Equipment
                  </Button>
                </CardContent>
              </Card>
            ) : (
              equipment.map((item: any) => (
                <Card key={item.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{item.manufacturer} {item.model}</CardTitle>
                        <CardDescription>
                          {item.serialNumber && `S/N: ${item.serialNumber}`}
                          {item.assetTag && ` • Asset: ${item.assetTag}`}
                        </CardDescription>
                      </div>
                      <Badge variant={item.isInstalled ? "default" : "secondary"}>
                        {item.isInstalled ? "Installed" : "Pending"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location:</span>
                        <span>
                          {[item.buildingLocation, item.roomLocation, item.specificLocation]
                            .filter(Boolean).join(' • ') || 'Not specified'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IP Address:</span>
                        <span>{item.targetIpAddress || 'TBD'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hostname:</span>
                        <span>{item.hostname || 'TBD'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="network" className="space-y-6">
          <Card>
            <CardContent className="text-center py-12">
              <Network className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">Network Configuration</h3>
              <p className="text-muted-foreground">
                Network configuration features coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Custom Sections</h3>
            <Dialog open={isAddSectionOpen} onOpenChange={setIsAddSectionOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Section
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Custom Section</DialogTitle>
                  <DialogDescription>
                    Create a custom section for additional requirements
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddSection} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sectionTitle">Section Title</Label>
                    <Input id="sectionTitle" name="sectionTitle" required className="min-h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sectionDescription">Description</Label>
                    <Textarea id="sectionDescription" name="sectionDescription" rows={3} />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsAddSectionOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addSectionMutation.isPending}>
                      {addSectionMutation.isPending ? "Adding..." : "Add Section"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {dynamicSections.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No custom sections</h3>
                  <p className="text-muted-foreground mb-4">
                    Add custom sections for specific installation requirements
                  </p>
                  <Button onClick={() => setIsAddSectionOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Section
                  </Button>
                </CardContent>
              </Card>
            ) : (
              dynamicSections.map((section: any) => (
                <Card key={section.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{section.sectionTitle}</CardTitle>
                        {section.sectionDescription && (
                          <CardDescription>{section.sectionDescription}</CardDescription>
                        )}
                      </div>
                      <Badge variant={section.isCompleted ? "default" : "secondary"}>
                        {section.isCompleted ? "Completed" : "Pending"}
                      </Badge>
                    </div>
                  </CardHeader>
                  {section.notes && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{section.notes}</p>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Installation Tasks</h3>
            <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Task</DialogTitle>
                  <DialogDescription>
                    Create a new task for this installation
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddTask} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="taskTitle">Task Title</Label>
                    <Input id="taskTitle" name="taskTitle" required className="min-h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taskDescription">Description</Label>
                    <Textarea id="taskDescription" name="taskDescription" rows={3} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select name="priority" defaultValue="medium">
                        <SelectTrigger className="min-h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Due Date</Label>
                      <Input id="dueDate" name="dueDate" type="date" className="min-h-11" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignedTo">Assigned To (Optional)</Label>
                    <Input id="assignedTo" name="assignedTo" placeholder="Technician name" className="min-h-11" />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsAddTaskOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addTaskMutation.isPending}>
                      {addTaskMutation.isPending ? "Adding..." : "Add Task"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {tasks.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <ListTodo className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No tasks created</h3>
                  <p className="text-muted-foreground mb-4">
                    Add tasks to track installation progress
                  </p>
                  <Button onClick={() => setIsAddTaskOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Task
                  </Button>
                </CardContent>
              </Card>
            ) : (
              tasks.map((task: any) => (
                <Card key={task.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{task.taskTitle}</CardTitle>
                        {task.taskDescription && (
                          <CardDescription>{task.taskDescription}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={task.priority === 'critical' ? 'destructive' : 'secondary'}>
                          {task.priority}
                        </Badge>
                        <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 text-sm">
                      {task.assignedTo && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Assigned to:</span>
                          <span>{task.assignedTo}</span>
                        </div>
                      )}
                      {task.dueDate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Due date:</span>
                          <span>{format(new Date(task.dueDate), 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                      {task.completedDate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Completed:</span>
                          <span>{format(new Date(task.completedDate), 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}