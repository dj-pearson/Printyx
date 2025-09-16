import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, Search, Filter, Bell, Clock, CheckCircle, AlertCircle,
  FileText, User, Calendar, MessageSquare, ChevronRight, MoreVertical,
  AlertTriangle, CheckCircle2, XCircle, Loader2, TrendingUp, Star,
  ThumbsUp, Heart
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { CustomerSatisfactionForm } from "./CustomerSatisfactionForm";

// Types - Aligned with actual API data structure (snake_case)
type ServiceRequest = {
  id: string;
  request_number?: string;
  request_type: 'service_call' | 'supply_order' | 'technical_support' | 'general_inquiry';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject: string;
  description: string;
  status: 'submitted' | 'acknowledged' | 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  equipment_make?: string;
  equipment_model?: string;
  equipment_serial?: string;
  assigned_technician_id?: string;
  estimated_completion_date?: string;
  actual_completion_date?: string;
  created_at: string;
  updated_at: string;
};

type ServiceRequestStatusHistory = {
  id: string;
  service_request_id: string;
  previous_status: string;
  new_status: string;
  change_reason?: string;
  customer_visible_notes?: string;
  internal_notes?: string;
  changed_by_type: 'customer' | 'dealer_user' | 'system' | 'technician';
  changed_by_id?: string;
  changed_by_name: string;
  estimated_completion_date?: string;
  actual_completion_date?: string;
  created_at: string;
};

// Form Schema for new service requests - Snake case to match API
const newServiceRequestSchema = z.object({
  request_type: z.enum(['service_call', 'supply_order', 'technical_support', 'general_inquiry']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  equipment_make: z.string().optional(),
  equipment_model: z.string().optional(),
  equipment_serial: z.string().optional(),
  preferred_contact_method: z.enum(['email', 'phone', 'text']),
  urgency_reason: z.string().optional(),
});

type NewServiceRequestForm = z.infer<typeof newServiceRequestSchema>;

// Status styling helpers
const getStatusColor = (status: string) => {
  switch (status) {
    case 'submitted': return 'bg-blue-100 text-blue-800';
    case 'acknowledged': return 'bg-purple-100 text-purple-800';
    case 'assigned': return 'bg-yellow-100 text-yellow-800';
    case 'in_progress': return 'bg-orange-100 text-orange-800';
    case 'on_hold': return 'bg-gray-100 text-gray-800';
    case 'completed': return 'bg-green-100 text-green-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'submitted': return <FileText className="h-4 w-4" />;
    case 'acknowledged': return <Bell className="h-4 w-4" />;
    case 'assigned': return <User className="h-4 w-4" />;
    case 'in_progress': return <Loader2 className="h-4 w-4" />;
    case 'on_hold': return <Clock className="h-4 w-4" />;
    case 'completed': return <CheckCircle2 className="h-4 w-4" />;
    case 'cancelled': return <XCircle className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'text-red-600 bg-red-50 border-red-200';
    case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low': return 'text-green-600 bg-green-50 border-green-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

// MetricCard component for dashboard summary
const MetricCard = ({ 
  title, 
  value, 
  icon, 
  color, 
  onClick,
  testId 
}: { 
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
  testId?: string;
}) => (
  <Card 
    className={`cursor-pointer hover:shadow-md transition-shadow ${onClick ? 'hover:bg-gray-50' : ''}`}
    onClick={onClick}
    data-testid={testId}
  >
    <CardContent className="p-6">
      <div className="flex items-center">
        <div className={`flex items-center justify-center w-12 h-12 ${color} rounded-lg`}>
          {icon}
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

// StatusTimeline component for showing request progress
const StatusTimeline = ({ statusHistory }: { statusHistory: ServiceRequestStatusHistory[] }) => {
  return (
    <div className="space-y-4" data-testid="status-timeline">
      {statusHistory.map((history, index) => (
        <div key={history.id} className="flex items-start space-x-3">
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getStatusColor(history.new_status)}`}>
            {getStatusIcon(history.new_status)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">
                {history.new_status.replace('_', ' ').toUpperCase()}
              </p>
              <p className="text-xs text-gray-500">
                {format(new Date(history.created_at), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
            {history.customer_visible_notes && (
              <p className="text-sm text-gray-600 mt-1">{history.customer_visible_notes}</p>
            )}
            {history.change_reason && (
              <p className="text-xs text-gray-500 mt-1">Reason: {history.change_reason}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">Updated by {history.changed_by_name}</p>
            {index < statusHistory.length - 1 && (
              <div className="w-px h-6 bg-gray-200 ml-4 mt-2"></div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export function ServiceRequestsDashboard() {
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewRequestDialogOpen, setIsNewRequestDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isSatisfactionFormOpen, setIsSatisfactionFormOpen] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  
  const queryClient = useQueryClient();

  // Auto-refresh every 30 seconds for real-time updates
  const [refreshInterval, setRefreshInterval] = useState(30000);
  
  // Fetch service requests
  const { data: serviceRequests = [], isLoading: isLoadingRequests, refetch: refetchRequests } = useQuery({
    queryKey: ['/api/customer-portal/service-requests'],
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: true,
  });

  // Fetch status history for selected request
  const { data: statusHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['/api/customer-portal/service-requests', selectedRequestId, 'history'],
    queryFn: () => apiRequest(`/api/customer-portal/service-requests/${selectedRequestId}/history`),
    enabled: !!selectedRequestId,
    refetchInterval: refreshInterval,
  });

  // Fetch satisfaction surveys for all service requests
  const { data: satisfactionSurveys = [] } = useQuery({
    queryKey: ['/api/customer-portal/satisfaction/surveys'],
    refetchInterval: refreshInterval,
  });

  // Create new service request mutation
  const createRequestMutation = useMutation({
    mutationFn: (data: NewServiceRequestForm) => 
      apiRequest('/api/customer-portal/service-requests', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-portal/service-requests'] });
      setIsNewRequestDialogOpen(false);
      form.reset();
    },
  });

  // Form for new service requests
  const form = useForm<NewServiceRequestForm>({
    resolver: zodResolver(newServiceRequestSchema),
    defaultValues: {
      request_type: 'service_call',
      priority: 'medium',
      subject: '',
      description: '',
      equipment_make: '',
      equipment_model: '',
      equipment_serial: '',
      preferred_contact_method: 'email',
      urgency_reason: '',
    },
  });

  // Calculate summary metrics
  const summaryMetrics = {
    total: serviceRequests.length,
    active: serviceRequests.filter((req: ServiceRequest) => 
      ['submitted', 'acknowledged', 'assigned', 'in_progress'].includes(req.status)
    ).length,
    completed: serviceRequests.filter((req: ServiceRequest) => 
      req.status === 'completed'
    ).length,
    urgent: serviceRequests.filter((req: ServiceRequest) => 
      req.priority === 'urgent' && !['completed', 'cancelled'].includes(req.status)
    ).length,
  };

  // Filter service requests
  const filteredRequests = serviceRequests.filter((request: ServiceRequest) => {
    const matchesStatus = selectedStatus === 'all' || request.status === selectedStatus;
    const matchesSearch = !searchQuery || 
      request.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (request.request_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const onSubmit = (data: NewServiceRequestForm) => {
    createRequestMutation.mutate(data);
  };

  // Helper function to find satisfaction survey for a service request
  const getSurveyForRequest = (serviceRequestId: string) => {
    return satisfactionSurveys.find((survey: any) => 
      survey.related_service_request_id === serviceRequestId
    );
  };

  // Helper function to handle satisfaction survey action
  const handleSurveyAction = (serviceRequestId: string) => {
    const survey = getSurveyForRequest(serviceRequestId);
    if (survey) {
      setSelectedSurveyId(survey.id);
      setIsSatisfactionFormOpen(true);
    }
  };

  if (isLoadingRequests) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-service-requests">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading service requests...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="service-requests-dashboard">
      {/* Summary Cards - Mobile Optimized */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <MetricCard
          title="Total Requests"
          value={summaryMetrics.total}
          icon={<FileText className="h-6 w-6 text-blue-600" />}
          color="bg-blue-100"
          testId="metric-total-requests"
        />
        
        <MetricCard
          title="Active Requests"
          value={summaryMetrics.active}
          icon={<Clock className="h-6 w-6 text-orange-600" />}
          color="bg-orange-100"
          onClick={() => setSelectedStatus('in_progress')}
          testId="metric-active-requests"
        />
        
        <MetricCard
          title="Completed"
          value={summaryMetrics.completed}
          icon={<CheckCircle className="h-6 w-6 text-green-600" />}
          color="bg-green-100"
          onClick={() => setSelectedStatus('completed')}
          testId="metric-completed-requests"
        />
        
        <MetricCard
          title="Urgent"
          value={summaryMetrics.urgent}
          icon={<AlertTriangle className="h-6 w-6 text-red-600" />}
          color="bg-red-100"
          onClick={() => setSelectedStatus('urgent')}
          testId="metric-urgent-requests"
        />
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-4 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
              data-testid="input-search-requests"
            />
          </div>
          
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isNewRequestDialogOpen} onOpenChange={setIsNewRequestDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-request">
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Service Request</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="request_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Request Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-request-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="service_call">Service Call</SelectItem>
                            <SelectItem value="supply_order">Supply Order</SelectItem>
                            <SelectItem value="technical_support">Technical Support</SelectItem>
                            <SelectItem value="general_inquiry">General Inquiry</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority">
                              <SelectValue placeholder="Select priority" />
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
                </div>

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Brief description of the issue..."
                          data-testid="input-subject"
                          {...field}
                        />
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Detailed description of the issue or request..."
                          className="min-h-20"
                          data-testid="textarea-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="equipment_make"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipment Make</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Canon, HP, etc."
                            data-testid="input-equipment-make"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="equipment_model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipment Model</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Model number"
                            data-testid="input-equipment-model"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="equipment_serial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Serial number"
                            data-testid="input-equipment-serial"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="preferred_contact_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Contact Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-contact-method">
                              <SelectValue placeholder="How should we contact you?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="text">Text Message</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="urgency_reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Urgency Reason (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Why is this urgent?"
                            data-testid="input-urgency-reason"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsNewRequestDialogOpen(false)}
                    data-testid="button-cancel-request"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createRequestMutation.isPending}
                    data-testid="button-submit-request"
                  >
                    {createRequestMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Request'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Requests List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Service Requests</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchRequests()}
                  data-testid="button-refresh-requests"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRequests.length === 0 ? (
                <div className="text-center py-8" data-testid="no-requests-message">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No service requests found</h3>
                  <p className="text-gray-600 mb-4">
                    {selectedStatus === 'all' ? 
                      "You haven't created any service requests yet." : 
                      `No requests found with status: ${selectedStatus}`
                    }
                  </p>
                  <Button onClick={() => setIsNewRequestDialogOpen(true)}>
                    Create your first request
                  </Button>
                </div>
              ) : (
                <div className="space-y-4" data-testid="requests-list">
                  {filteredRequests.map((request: ServiceRequest) => (
                    <div 
                      key={request.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                        selectedRequestId === request.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedRequestId(request.id)}
                      data-testid={`request-item-${request.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getStatusColor(request.status)}>
                              {getStatusIcon(request.status)}
                              <span className="ml-1">{request.status.replace('_', ' ')}</span>
                            </Badge>
                            <Badge variant="outline" className={getPriorityColor(request.priority)}>
                              {request.priority}
                            </Badge>
                            <span className="text-xs text-gray-500">#{request.requestNumber}</span>
                          </div>
                          
                          <h4 className="font-medium text-gray-900 mb-1">{request.subject}</h4>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{request.description}</p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Created: {format(new Date(request.createdAt), 'MMM dd, yyyy')}</span>
                            {request.equipmentMake && (
                              <span>Equipment: {request.equipmentMake} {request.equipmentModel}</span>
                            )}
                            {request.estimatedCompletionDate && (
                              <span>Est. completion: {format(new Date(request.estimatedCompletionDate), 'MMM dd')}</span>
                            )}
                          </div>

                          {/* Satisfaction Survey Integration for Completed Requests */}
                          {request.status === 'completed' && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              {(() => {
                                const survey = getSurveyForRequest(request.id);
                                if (survey) {
                                  return (
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Heart className="h-4 w-4 text-pink-500" />
                                        <span className="text-sm text-gray-600">Satisfaction Survey</span>
                                        <Badge 
                                          variant={survey.status === 'completed' ? 'secondary' : 
                                                  survey.status === 'started' ? 'default' : 'outline'}
                                          className="text-xs"
                                        >
                                          {survey.status === 'completed' ? 'Completed' :
                                           survey.status === 'started' ? 'In Progress' : 'Available'}
                                        </Badge>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSurveyAction(request.id);
                                        }}
                                        disabled={survey.status === 'completed'}
                                        className="text-xs px-3 py-1 h-7"
                                        data-testid={`button-survey-${request.id}`}
                                      >
                                        {survey.status === 'completed' ? (
                                          <>
                                            <Star className="h-3 w-3 mr-1" />
                                            View Results
                                          </>
                                        ) : survey.status === 'started' ? (
                                          <>
                                            <ThumbsUp className="h-3 w-3 mr-1" />
                                            Continue
                                          </>
                                        ) : (
                                          <>
                                            <MessageSquare className="h-3 w-3 mr-1" />
                                            Rate Service
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div className="flex items-center gap-2 text-gray-500">
                                      <MessageSquare className="h-4 w-4" />
                                      <span className="text-sm">Survey will be available soon</span>
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col items-center gap-2">
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                          {/* Status indicator for completed requests with surveys */}
                          {request.status === 'completed' && getSurveyForRequest(request.id) && (
                            <div className="flex items-center gap-1">
                              {getSurveyForRequest(request.id)?.status === 'completed' ? (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              ) : getSurveyForRequest(request.id)?.status === 'started' ? (
                                <Clock className="h-3 w-3 text-blue-500" />
                              ) : (
                                <Star className="h-3 w-3 text-yellow-500" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Request Details and Status Timeline */}
        <div className="lg:col-span-1">
          {selectedRequestId ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Status Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-8" data-testid="loading-timeline">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading timeline...</span>
                  </div>
                ) : statusHistory.length > 0 ? (
                  <StatusTimeline statusHistory={statusHistory} />
                ) : (
                  <div className="text-center py-8" data-testid="no-timeline-message">
                    <Clock className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">No status updates yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8" data-testid="select-request-message">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="font-medium text-gray-900 mb-2">Select a Request</h3>
                  <p className="text-sm text-gray-600">
                    Click on a service request to view its status timeline and details.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Customer Satisfaction Form Dialog */}
      {selectedSurveyId && (
        <CustomerSatisfactionForm
          surveyId={selectedSurveyId}
          isOpen={isSatisfactionFormOpen}
          onClose={() => {
            setIsSatisfactionFormOpen(false);
            setSelectedSurveyId("");
          }}
          onComplete={() => {
            // Refresh surveys and service requests data after completion
            queryClient.invalidateQueries({ queryKey: ["/api/customer-portal/satisfaction/surveys"] });
            queryClient.invalidateQueries({ queryKey: ["/api/customer-portal/service-requests"] });
          }}
        />
      )}
    </div>
  );
}