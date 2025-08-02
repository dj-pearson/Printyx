import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import ServiceTicketAnalysis from "@/components/service/ServiceTicketAnalysis";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Search, 
  Clock, 
  User, 
  MapPin, 
  Calendar, 
  Wrench, 
  AlertTriangle, 
  CheckCircle, 
  Phone,
  Settings,
  TrendingUp,
  UserCheck,
  Clipboard,
  Package,
  FileText
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertServiceTicketSchema } from "@shared/schema";
import type { ServiceTicket, Customer, Equipment, Technician, InventoryItem } from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";

const createServiceTicketSchema = insertServiceTicketSchema.extend({
  scheduledDate: z.string().optional(),
});

type CreateServiceTicketInput = z.infer<typeof createServiceTicketSchema>;

export default function ServiceDispatchEnhanced() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [analysisTicket, setAnalysisTicket] = useState<ServiceTicket | null>(null);
  const queryClient = useQueryClient();

  const { data: tickets, isLoading: isLoadingTickets } = useQuery<ServiceTicket[]>({
    queryKey: ["/api/service-tickets"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: equipment } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: technicians } = useQuery<Technician[]>({
    queryKey: ["/api/technicians"],
  });

  const { data: inventory } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  const form = useForm<CreateServiceTicketInput>({
    resolver: zodResolver(createServiceTicketSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "open",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateServiceTicketInput) => {
      const response = await fetch('/api/service-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
          requiredSkills: data.requiredSkills || [],
          requiredParts: data.requiredParts || [],
        }),
      });
      if (!response.ok) throw new Error('Failed to create service ticket');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-tickets"] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
  });

  const assignTechnicianMutation = useMutation({
    mutationFn: async ({ ticketId, technicianId, scheduledDate }: { ticketId: string; technicianId: string; scheduledDate: Date }) => {
      const response = await fetch(`/api/service-tickets/${ticketId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ technicianId, scheduledDate }),
      });
      if (!response.ok) throw new Error('Failed to assign technician');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-tickets"] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const response = await fetch(`/api/service-tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update ticket status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-tickets"] });
    },
  });

  const handleSubmit = (data: CreateServiceTicketInput) => {
    createMutation.mutate(data);
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  const getEquipmentInfo = (equipmentId: string | null) => {
    if (!equipmentId) return 'No equipment specified';
    const eq = equipment?.find(e => e.id === equipmentId);
    return eq ? `${eq.manufacturer} ${eq.model} (${eq.serialNumber})` : 'Unknown Equipment';
  };

  const getTechnicianName = (technicianId: string | null) => {
    if (!technicianId) return 'Unassigned';
    const tech = technicians?.find(t => t.id === technicianId);
    return tech ? `${tech.firstName} ${tech.lastName}` : 'Unknown Technician';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in-progress': return 'text-blue-600 bg-blue-50';
      case 'assigned': return 'text-purple-600 bg-purple-50';
      case 'open': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'in-progress': return <Wrench className="w-4 h-4" />;
      case 'assigned': return <UserCheck className="w-4 h-4" />;
      case 'open': return <Clock className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const filteredTickets = tickets?.filter(ticket => {
    const statusMatch = filterStatus === "all" || ticket.status === filterStatus;
    const priorityMatch = filterPriority === "all" || ticket.priority === filterPriority;
    return statusMatch && priorityMatch;
  });

  const getAvailableTechnicians = (requiredSkills: string[] = []) => {
    if (!technicians) return [];
    
    return technicians.filter(tech => {
      if (!tech.isActive || !tech.isAvailable) return false;
      
      // Simple skill matching - in production this would be more sophisticated
      if (requiredSkills.length === 0) return true;
      
      return requiredSkills.some(skill => 
        tech.skills?.some(techSkill => 
          techSkill.toLowerCase().includes(skill.toLowerCase())
        )
      );
    });
  };

  if (isLoadingTickets) {
    return (
      <MainLayout 
        title="Enhanced Service Dispatch" 
        description="Smart technician assignment with skills matching and automated routing"
      >
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
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Enhanced Service Dispatch" 
      description="Smart technician assignment with skills matching and automated routing"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div />
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Service Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Service Ticket</DialogTitle>
              <DialogDescription>
                Create a new service request with smart technician assignment
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customers?.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="equipmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipment (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select equipment" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {equipment?.map((eq) => (
                              <SelectItem key={eq.id} value={eq.id}>
                                {eq.manufacturer} {eq.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Summary</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Brief description of the issue" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detailed Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Detailed description of the problem and symptoms..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Service Date</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Ticket"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input placeholder="Search tickets..." className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Service Tickets Grid */}
      <div className="grid gap-4">
        {filteredTickets?.map((ticket) => (
          <Card key={ticket.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <CardTitle className="text-lg">{ticket.title}</CardTitle>
                    <Badge className={`${getPriorityColor(ticket.priority)} border-0`}>
                      {ticket.priority}
                    </Badge>
                    <Badge className={`${getStatusColor(ticket.status)} border-0`}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(ticket.status)}
                        {ticket.status}
                      </span>
                    </Badge>
                  </div>
                  <CardDescription>
                    Ticket #{ticket.ticketNumber} • {getCustomerName(ticket.customerId)}
                  </CardDescription>
                </div>
                <div className="text-sm text-gray-500">
                  {format(new Date(ticket.createdAt || new Date()), 'MMM dd, yyyy')}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-700">{ticket.description}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span>Technician: {getTechnicianName(ticket.assignedTechnicianId)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-gray-400" />
                    <span>Equipment: {getEquipmentInfo(ticket.equipmentId)}</span>
                  </div>
                  {ticket.scheduledDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>Scheduled: {format(new Date(ticket.scheduledDate), 'MMM dd, HH:mm')}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="flex gap-2">
                    {ticket.status === 'open' && (
                      <Button 
                        size="sm" 
                        onClick={() => {/* Auto-assign logic */}}
                        disabled={assignTechnicianMutation.isPending}
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        Smart Assign
                      </Button>
                    )}
                    {ticket.status === 'assigned' && (
                      <Button 
                        size="sm" 
                        onClick={() => updateStatusMutation.mutate({ ticketId: ticket.id, status: 'in-progress' })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <Wrench className="w-4 h-4 mr-1" />
                        Start Work
                      </Button>
                    )}
                    {ticket.status === 'in-progress' && (
                      <Button 
                        size="sm" 
                        onClick={() => updateStatusMutation.mutate({ ticketId: ticket.id, status: 'completed' })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Complete
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setAnalysisTicket(ticket);
                        setShowAnalysisDialog(true);
                      }}
                    >
                      <Clipboard className="w-4 h-4 mr-1" />
                      Analysis
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-1" />
                      Details
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredTickets?.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No service tickets found</h3>
              <p className="text-gray-600 mb-4">Create your first service ticket to start managing field service operations.</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Ticket
              </Button>
            </CardContent>
          </Card>
        )}
        </div>

        {/* Service Ticket Analysis Dialog */}
        {analysisTicket && (
          <ServiceTicketAnalysis
            ticket={analysisTicket}
            isOpen={showAnalysisDialog}
            onClose={() => {
              setShowAnalysisDialog(false);
              setAnalysisTicket(null);
            }}
          />
        )}
      </div>
    </MainLayout>
  );
}