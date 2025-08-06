import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { 
  MapPin, Clock, Smartphone, Navigation, Mic, Camera, 
  CheckCircle, Users, TrendingUp, Zap, Calendar, Target,
  Wifi, WifiOff, Battery, Signal, Settings, Edit, Eye,
  Plus, Play, Pause, Square, Upload, Download, RefreshCw,
  AlertTriangle, Shield, Award, PhoneCall, FileText, Route
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

// Types
type FieldTechnician = {
  id: string;
  employee_id: string;
  technician_name: string;
  technician_email?: string;
  technician_phone?: string;
  device_type?: string;
  availability_status: string;
  current_location?: any;
  jobs_completed_today: number;
  jobs_completed_week: number;
  customer_satisfaction_rating?: number;
  first_time_fix_rate: number;
  employment_status: string;
  last_sync_timestamp?: string;
  created_at: string;
};

type FieldWorkOrder = {
  id: string;
  work_order_number: string;
  work_order_type: string;
  priority: string;
  customer_name: string;
  service_location: any;
  assigned_technician_id?: string;
  status: string;
  scheduled_date?: string;
  scheduled_time_start?: string;
  estimated_duration_minutes?: number;
  work_description: string;
  customer_satisfaction_score?: number;
  created_at: string;
};

type VoiceNote = {
  id: string;
  technician_id: string;
  work_order_id?: string;
  note_category: string;
  audio_duration_seconds?: number;
  transcription_text?: string;
  transcription_confidence?: number;
  note_title?: string;
  urgency_level?: string;
  recorded_timestamp: string;
  created_at: string;
};

type MobileMetrics = {
  activeTechnicians: number;
  workOrdersToday: number;
  completionRate: number;
  averageResponseTime: number;
  customerSatisfaction: number;
  gpsAccuracy: number;
};

// Form Schemas
const technicianSchema = z.object({
  employee_id: z.string().min(2, "Employee ID required"),
  technician_name: z.string().min(3, "Technician name required"),
  technician_email: z.string().email().optional(),
  technician_phone: z.string().optional(),
  device_type: z.enum(['ios', 'android', 'tablet']).optional(),
  skill_categories: z.string().optional(),
  work_schedule: z.string().optional(),
  gps_tracking_enabled: z.boolean(),
  voice_notes_enabled: z.boolean(),
  photo_upload_enabled: z.boolean(),
});

const workOrderSchema = z.object({
  work_order_type: z.enum(['installation', 'maintenance', 'repair', 'inspection', 'delivery']),
  priority: z.enum(['low', 'medium', 'high', 'urgent', 'emergency']),
  customer_name: z.string().min(2, "Customer name required"),
  service_address: z.string().min(5, "Service address required"),
  work_description: z.string().min(10, "Work description required"),
  estimated_duration_minutes: z.number().min(15).max(480),
  scheduled_date: z.string(),
  scheduled_time_start: z.string(),
  assigned_technician_id: z.string().optional(),
  special_instructions: z.string().optional(),
});

const voiceNoteSchema = z.object({
  work_order_id: z.string().optional(),
  note_category: z.enum(['work_progress', 'customer_interaction', 'safety_concern', 'parts_needed', 'follow_up']),
  note_title: z.string().min(3, "Note title required"),
  transcription_text: z.string().optional(),
  urgency_level: z.enum(['low', 'medium', 'high']),
  tags: z.string().optional(),
});

type TechnicianForm = z.infer<typeof technicianSchema>;
type WorkOrderForm = z.infer<typeof workOrderSchema>;
type VoiceNoteForm = z.infer<typeof voiceNoteSchema>;

export default function MobileFieldOperations() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isTechnicianDialogOpen, setIsTechnicianDialogOpen] = useState(false);
  const [isWorkOrderDialogOpen, setIsWorkOrderDialogOpen] = useState(false);
  const [isVoiceNoteDialogOpen, setIsVoiceNoteDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedTechnician, setSelectedTechnician] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  
  const queryClient = useQueryClient();

  // Fetch mobile metrics
  const { data: metrics } = useQuery<MobileMetrics>({
    queryKey: ["/api/mobile-field/metrics"],
  });

  // Fetch field technicians
  const { data: technicians = [], isLoading: techniciansLoading } = useQuery<FieldTechnician[]>({
    queryKey: ["/api/mobile-field/technicians"],
  });

  // Fetch field work orders
  const { data: workOrders = [], isLoading: workOrdersLoading } = useQuery<FieldWorkOrder[]>({
    queryKey: ["/api/mobile-field/work-orders", selectedStatus, selectedTechnician, selectedPriority],
  });

  // Fetch voice notes
  const { data: voiceNotes = [], isLoading: voiceNotesLoading } = useQuery<VoiceNote[]>({
    queryKey: ["/api/mobile-field/voice-notes"],
  });

  // Create technician mutation
  const createTechnicianMutation = useMutation({
    mutationFn: async (data: TechnicianForm) => {
      const response = await fetch("/api/mobile-field/technicians", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create technician");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-field/technicians"] });
      setIsTechnicianDialogOpen(false);
    },
  });

  // Create work order mutation
  const createWorkOrderMutation = useMutation({
    mutationFn: async (data: WorkOrderForm) => {
      const response = await fetch("/api/mobile-field/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create work order");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-field/work-orders"] });
      setIsWorkOrderDialogOpen(false);
    },
  });

  // Create voice note mutation
  const createVoiceNoteMutation = useMutation({
    mutationFn: async (data: VoiceNoteForm) => {
      const response = await fetch("/api/mobile-field/voice-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create voice note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mobile-field/voice-notes"] });
      setIsVoiceNoteDialogOpen(false);
    },
  });

  // Form setup
  const technicianForm = useForm<TechnicianForm>({
    resolver: zodResolver(technicianSchema),
    defaultValues: {
      device_type: "android",
      gps_tracking_enabled: true,
      voice_notes_enabled: true,
      photo_upload_enabled: true,
    },
  });

  const workOrderForm = useForm<WorkOrderForm>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      work_order_type: "maintenance",
      priority: "medium",
      estimated_duration_minutes: 120,
    },
  });

  const voiceNoteForm = useForm<VoiceNoteForm>({
    resolver: zodResolver(voiceNoteSchema),
    defaultValues: {
      note_category: "work_progress",
      urgency_level: "medium",
    },
  });

  const onTechnicianSubmit = (data: TechnicianForm) => {
    createTechnicianMutation.mutate(data);
  };

  const onWorkOrderSubmit = (data: WorkOrderForm) => {
    createWorkOrderMutation.mutate(data);
  };

  const onVoiceNoteSubmit = (data: VoiceNoteForm) => {
    createVoiceNoteMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': case 'on_site': return 'default';
      case 'assigned': case 'en_route': return 'secondary';
      case 'created': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': case 'urgent': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'outline';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'available': return 'default';
      case 'busy': return 'secondary';
      case 'offline': return 'destructive';
      case 'emergency_only': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress': case 'on_site': return <Play className="h-4 w-4 text-blue-600" />;
      case 'assigned': case 'en_route': return <Navigation className="h-4 w-4 text-orange-600" />;
      case 'created': return <Clock className="h-4 w-4 text-gray-600" />;
      case 'cancelled': return <Square className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getWorkOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'installation': return <Settings className="h-4 w-4" />;
      case 'maintenance': return <Zap className="h-4 w-4" />;
      case 'repair': return <AlertTriangle className="h-4 w-4" />;
      case 'inspection': return <Eye className="h-4 w-4" />;
      case 'delivery': return <Upload className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatLocation = (location: any) => {
    if (!location) return "Location not available";
    if (typeof location === 'string') return location;
    if (location.address) return location.address;
    if (location.lat && location.lng) return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
    return "Location data available";
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Mobile Field Operations</h1>
          <p className="text-muted-foreground mt-2">
            Offline-capable mobile field service with GPS tracking, time tracking, and voice-to-text capabilities
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isTechnicianDialogOpen} onOpenChange={setIsTechnicianDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Technician
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Field Technician</DialogTitle>
              </DialogHeader>
              <Form {...technicianForm}>
                <form onSubmit={technicianForm.handleSubmit(onTechnicianSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={technicianForm.control}
                      name="employee_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employee ID</FormLabel>
                          <FormControl>
                            <Input placeholder="EMP001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={technicianForm.control}
                      name="technician_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Technician Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Smith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={technicianForm.control}
                      name="technician_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@company.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={technicianForm.control}
                      name="technician_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+1 (555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={technicianForm.control}
                    name="device_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Device Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ios">iOS</SelectItem>
                            <SelectItem value="android">Android</SelectItem>
                            <SelectItem value="tablet">Tablet</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={technicianForm.control}
                    name="skill_categories"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Skills (comma-separated)</FormLabel>
                        <FormControl>
                          <Input placeholder="Printer Repair, Installation, Network Setup" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={technicianForm.control}
                      name="gps_tracking_enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>GPS Tracking</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={technicianForm.control}
                      name="voice_notes_enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>Voice Notes</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={technicianForm.control}
                      name="photo_upload_enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>Photo Upload</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsTechnicianDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createTechnicianMutation.isPending}>
                      {createTechnicianMutation.isPending ? "Adding..." : "Add Technician"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isWorkOrderDialogOpen} onOpenChange={setIsWorkOrderDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Create Work Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Field Work Order</DialogTitle>
              </DialogHeader>
              <Form {...workOrderForm}>
                <form onSubmit={workOrderForm.handleSubmit(onWorkOrderSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={workOrderForm.control}
                      name="work_order_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work Order Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="installation">Installation</SelectItem>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                              <SelectItem value="repair">Repair</SelectItem>
                              <SelectItem value="inspection">Inspection</SelectItem>
                              <SelectItem value="delivery">Delivery</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={workOrderForm.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                              <SelectItem value="emergency">Emergency</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={workOrderForm.control}
                    name="customer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input placeholder="ABC Corporation" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={workOrderForm.control}
                    name="service_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main Street, City, State 12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={workOrderForm.control}
                    name="work_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Detailed description of work to be performed..."
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={workOrderForm.control}
                      name="estimated_duration_minutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="15" 
                              max="480"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 120)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={workOrderForm.control}
                      name="scheduled_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scheduled Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={workOrderForm.control}
                      name="scheduled_time_start"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={workOrderForm.control}
                      name="assigned_technician_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned Technician</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Auto-assign" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="auto">Auto-assign</SelectItem>
                              {(technicians as FieldTechnician[]).map((tech) => (
                                <SelectItem key={tech.id} value={tech.id}>
                                  {tech.technician_name} ({tech.employee_id})
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
                    control={workOrderForm.control}
                    name="special_instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Special Instructions</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any special instructions for the technician..."
                            rows={2}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsWorkOrderDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createWorkOrderMutation.isPending}>
                      {createWorkOrderMutation.isPending ? "Creating..." : "Create Work Order"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isVoiceNoteDialogOpen} onOpenChange={setIsVoiceNoteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Mic className="mr-2 h-4 w-4" />
                Add Voice Note
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Voice Note</DialogTitle>
              </DialogHeader>
              <Form {...voiceNoteForm}>
                <form onSubmit={voiceNoteForm.handleSubmit(onVoiceNoteSubmit)} className="space-y-4">
                  <FormField
                    control={voiceNoteForm.control}
                    name="note_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Note Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Brief description of the voice note" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={voiceNoteForm.control}
                      name="note_category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="work_progress">Work Progress</SelectItem>
                              <SelectItem value="customer_interaction">Customer Interaction</SelectItem>
                              <SelectItem value="safety_concern">Safety Concern</SelectItem>
                              <SelectItem value="parts_needed">Parts Needed</SelectItem>
                              <SelectItem value="follow_up">Follow Up</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={voiceNoteForm.control}
                      name="urgency_level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Urgency Level</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={voiceNoteForm.control}
                    name="work_order_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Related Work Order</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select work order (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No work order</SelectItem>
                            {(workOrders as FieldWorkOrder[]).slice(0, 10).map((wo) => (
                              <SelectItem key={wo.id} value={wo.id}>
                                {wo.work_order_number} - {wo.customer_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={voiceNoteForm.control}
                    name="transcription_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transcription (optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Text transcription of the voice note..."
                            rows={4}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={voiceNoteForm.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags (comma-separated)</FormLabel>
                        <FormControl>
                          <Input placeholder="urgent, customer-request, follow-up" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsVoiceNoteDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createVoiceNoteMutation.isPending}>
                      {createVoiceNoteMutation.isPending ? "Adding..." : "Add Voice Note"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
          <TabsTrigger value="work-orders">Work Orders</TabsTrigger>
          <TabsTrigger value="voice-notes">Voice Notes</TabsTrigger>
          <TabsTrigger value="tracking">GPS Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Mobile Field Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Technicians</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.activeTechnicians || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently in field
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Work Orders Today</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.workOrdersToday || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.completionRate || 0}% completion rate
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Response</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.averageResponseTime || 0}m
                </div>
                <p className="text-xs text-muted-foreground">
                  Response time
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Field Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Customer Satisfaction</span>
                    <span className="font-medium">
                      {metrics?.customerSatisfaction?.toFixed(1) || "0"}★
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">GPS Accuracy</span>
                    <span className="font-medium">
                      {metrics?.gpsAccuracy?.toFixed(1) || "0"}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">First Time Fix Rate</span>
                    <span className="font-medium">
                      {technicians.length > 0 ? 
                        (technicians.reduce((sum, tech) => sum + tech.first_time_fix_rate, 0) / technicians.length).toFixed(1) 
                        : "0"}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Work Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {workOrdersLoading ? (
                  <p className="text-center py-4">Loading work orders...</p>
                ) : (workOrders as FieldWorkOrder[]).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No recent work orders</p>
                ) : (
                  <div className="space-y-3">
                    {(workOrders as FieldWorkOrder[]).slice(0, 5).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(order.status)}
                          <div>
                            <h4 className="font-medium text-sm">{order.work_order_number}</h4>
                            <p className="text-xs text-muted-foreground">
                              {order.customer_name} • {order.work_order_type}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={getStatusColor(order.status)} className="text-xs">
                            {order.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant={getPriorityColor(order.priority)} className="text-xs ml-1">
                            {order.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="technicians" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Field Technicians</CardTitle>
            </CardHeader>
            <CardContent>
              {techniciansLoading ? (
                <p className="text-center py-8">Loading technicians...</p>
              ) : technicians.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No field technicians found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {technicians.map((technician) => (
                    <Card key={technician.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{technician.technician_name}</CardTitle>
                          <Badge variant={getAvailabilityColor(technician.availability_status)}>
                            {technician.availability_status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {technician.employee_id} • {technician.device_type || 'Unknown device'}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Jobs Today:</span>
                            <span>{technician.jobs_completed_today}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Jobs This Week:</span>
                            <span>{technician.jobs_completed_week}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Satisfaction:</span>
                            <span>{Number(technician.customer_satisfaction_rating || 0).toFixed(1)}★</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">First Time Fix:</span>
                            <span>{Number(technician.first_time_fix_rate || 0).toFixed(1)}%</span>
                          </div>
                        </div>

                        {technician.current_location && (
                          <div className="text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 inline mr-1" />
                            {formatLocation(technician.current_location)}
                          </div>
                        )}

                        {technician.last_sync_timestamp && (
                          <div className="text-xs text-muted-foreground">
                            Last sync: {format(new Date(technician.last_sync_timestamp), 'MMM dd, HH:mm')}
                          </div>
                        )}

                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1">
                            <MapPin className="h-3 w-3 mr-1" />
                            Track
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="work-orders" className="space-y-6">
          {/* Work Order Filters */}
          <div className="flex space-x-4">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="en_route">En Route</SelectItem>
                <SelectItem value="on_site">On Site</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Technicians</SelectItem>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.technician_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Field Work Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {workOrdersLoading ? (
                <p className="text-center py-8">Loading work orders...</p>
              ) : (workOrders as FieldWorkOrder[]).length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No work orders found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(workOrders as FieldWorkOrder[]).map((order) => (
                    <div key={order.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            {getWorkOrderTypeIcon(order.work_order_type)}
                            <h3 className="font-medium">{order.work_order_number}</h3>
                            <Badge variant={getStatusColor(order.status)}>
                              {order.status.replace('_', ' ')}
                            </Badge>
                            <Badge variant={getPriorityColor(order.priority)}>
                              {order.priority}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p><strong>Customer:</strong> {order.customer_name}</p>
                            <p><strong>Type:</strong> {order.work_order_type.replace('_', ' ')}</p>
                            <p><strong>Location:</strong> {formatLocation(order.service_location)}</p>
                            <p><strong>Description:</strong> {order.work_description}</p>
                            {order.scheduled_date && (
                              <p><strong>Scheduled:</strong> {format(new Date(order.scheduled_date), 'MMM dd, yyyy')} 
                                {order.scheduled_time_start && ` at ${order.scheduled_time_start}`}
                              </p>
                            )}
                            {order.estimated_duration_minutes && (
                              <p><strong>Estimated Duration:</strong> {formatDuration(order.estimated_duration_minutes)}</p>
                            )}
                            {order.assigned_technician_id && (
                              <p><strong>Assigned Technician:</strong> {
                                (technicians as FieldTechnician[]).find(t => t.id === order.assigned_technician_id)?.technician_name || 'Unknown'
                              }</p>
                            )}
                            {order.customer_satisfaction_score && (
                              <p><strong>Customer Rating:</strong> {order.customer_satisfaction_score}★</p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <MapPin className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice-notes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Voice Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {voiceNotesLoading ? (
                <p className="text-center py-8">Loading voice notes...</p>
              ) : voiceNotes.length === 0 ? (
                <div className="text-center py-8">
                  <Mic className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No voice notes found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(voiceNotes as VoiceNote[]).map((note) => (
                    <div key={note.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Mic className="h-4 w-4" />
                            <h3 className="font-medium">{note.note_title}</h3>
                            <Badge variant="outline">
                              {note.note_category.replace('_', ' ')}
                            </Badge>
                            {note.urgency_level && (
                              <Badge variant={getPriorityColor(note.urgency_level)}>
                                {note.urgency_level}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p><strong>Technician:</strong> {
                              (technicians as FieldTechnician[]).find(t => t.id === note.technician_id)?.technician_name || 'Unknown'
                            }</p>
                            {note.work_order_id && (
                              <p><strong>Work Order:</strong> {
                                (workOrders as FieldWorkOrder[]).find(wo => wo.id === note.work_order_id)?.work_order_number || 'Unknown'
                              }</p>
                            )}
                            {note.audio_duration_seconds && (
                              <p><strong>Duration:</strong> {Math.floor(note.audio_duration_seconds / 60)}:{(note.audio_duration_seconds % 60).toString().padStart(2, '0')}</p>
                            )}
                            <p><strong>Recorded:</strong> {format(new Date(note.recorded_timestamp), 'MMM dd, yyyy HH:mm')}</p>
                            {note.transcription_text && (
                              <div className="mt-2">
                                <strong>Transcription:</strong>
                                <p className="mt-1 p-2 bg-gray-50 rounded text-sm">
                                  {note.transcription_text}
                                </p>
                                {note.transcription_confidence && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Confidence: {(note.transcription_confidence * 100).toFixed(1)}%
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button variant="outline" size="sm">
                            <Play className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tracking" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active GPS Devices</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {technicians.filter(t => t.availability_status === 'available' || t.availability_status === 'busy').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently tracking
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Geofence Compliance</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">98.5%</div>
                <p className="text-xs text-muted-foreground">
                  Within service areas
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Speed</CardTitle>
                <Navigation className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">45 km/h</div>
                <p className="text-xs text-muted-foreground">
                  During travel
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Distance</CardTitle>
                <Route className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,247 km</div>
                <p className="text-xs text-muted-foreground">
                  Today's total
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Live Technician Locations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {technicians.filter(t => t.current_location).map((technician) => (
                  <div key={technician.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${
                          technician.availability_status === 'available' ? 'bg-green-500' :
                          technician.availability_status === 'busy' ? 'bg-blue-500' :
                          technician.availability_status === 'offline' ? 'bg-red-500' : 'bg-gray-500'
                        }`}></div>
                        <span className="font-medium">{technician.technician_name}</span>
                      </div>
                      <Badge variant={getAvailabilityColor(technician.availability_status)}>
                        {technician.availability_status}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{formatLocation(technician.current_location)}</p>
                      {technician.last_sync_timestamp && (
                        <p className="text-xs text-muted-foreground">
                          Updated {format(new Date(technician.last_sync_timestamp), 'HH:mm')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {technicians.filter(t => t.current_location).length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">
                    No active GPS tracking data available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </MainLayout>
  );
}