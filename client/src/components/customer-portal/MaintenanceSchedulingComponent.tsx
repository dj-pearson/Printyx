import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Wrench, CheckCircle, X, AlertCircle, Phone, Mail, MessageSquare, Edit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays, parseISO } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  maintenanceSchedulingRequestSchema,
  rescheduleAppointmentSchema,
  type MaintenanceSchedulingRequest,
  type RescheduleAppointmentRequest
} from "@shared/customer-portal-schema";

// Use shared schemas for consistency
type MaintenanceSchedulingFormData = MaintenanceSchedulingRequest;
type RescheduleFormData = RescheduleAppointmentRequest;

interface AvailableSlot {
  time: string;
  duration: number;
  technicianId: string;
  technicianName: string;
  isAvailable: boolean;
}

interface MaintenanceAppointment {
  id: string;
  maintenanceType: string;
  appointmentDate: string;
  appointmentTime: string;
  duration: number;
  status: string;
  confirmationCode?: string;
  technicianName?: string;
  equipmentName?: string;
  description?: string;
  specialInstructions?: string;
  contactMethod: string;
  estimatedCost?: number;
  rescheduleCount?: number;
  createdAt: string;
}

export const MaintenanceSchedulingComponent = () => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<MaintenanceAppointment | null>(null);
  const { toast } = useToast();

  const form = useForm<MaintenanceSchedulingFormData>({
    resolver: zodResolver(maintenanceSchedulingRequestSchema),
    defaultValues: {
      duration: 60,
      contactMethod: 'email',
      maintenanceType: 'routine_maintenance'
    }
  });

  // Get available time slots for selected date
  const { data: availabilityData, isLoading: availabilityLoading } = useQuery({
    queryKey: ['/api/customer-portal/maintenance-availability', selectedDate],
    queryFn: async () => {
      if (!selectedDate) return null;
      
      const params = new URLSearchParams({
        date: selectedDate,
        duration: '60', // Default duration
      });
      
      // Add customer portal session header
      const headers: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        const portalSession = localStorage.getItem('customer-portal-session');
        if (portalSession) {
          headers['x-portal-session'] = portalSession;
        }
      }
      
      return apiRequest(`/api/customer-portal/maintenance-availability?${params.toString()}`, 'GET', undefined, headers);
    },
    enabled: !!selectedDate,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get customer maintenance appointments
  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['/api/customer-portal/maintenance-appointments'],
    queryFn: async () => {
      // Add customer portal session header
      const headers: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        const portalSession = localStorage.getItem('customer-portal-session');
        if (portalSession) {
          headers['x-portal-session'] = portalSession;
        }
      }
      
      return apiRequest('/api/customer-portal/maintenance-appointments', 'GET', undefined, headers);
    },
    refetchOnWindowFocus: false,
  });

  // Book appointment mutation
  const bookAppointmentMutation = useMutation({
    mutationFn: (data: MaintenanceSchedulingFormData) => {
      // Add customer portal session header
      const headers: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        const portalSession = localStorage.getItem('customer-portal-session');
        if (portalSession) {
          headers['x-portal-session'] = portalSession;
        }
      }
      
      return apiRequest('/api/customer-portal/maintenance-appointments', 'POST', data, headers);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-portal/maintenance-appointments'] });
      setIsBookingDialogOpen(false);
      form.reset();
      setSelectedSlot(null);
      toast({
        title: "Appointment Booked",
        description: "Your maintenance appointment has been successfully scheduled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to book appointment. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Cancel appointment mutation
  const cancelAppointmentMutation = useMutation({
    mutationFn: ({ appointmentId, reason }: { appointmentId: string, reason?: string }) => {
      // Add customer portal session header
      const headers: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        const portalSession = localStorage.getItem('customer-portal-session');
        if (portalSession) {
          headers['x-portal-session'] = portalSession;
        }
      }
      
      return apiRequest(`/api/customer-portal/maintenance-appointments/${appointmentId}`, 'DELETE', { reason }, headers);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-portal/maintenance-appointments'] });
      toast({
        title: "Appointment Cancelled",
        description: "Your appointment has been cancelled successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel appointment. Please try again.",
        variant: "destructive",
      });
    }
  });

  const rescheduleForm = useForm<RescheduleFormData>({
    resolver: zodResolver(rescheduleAppointmentSchema),
    defaultValues: {
      reason: ''
    }
  });

  // Reschedule appointment mutation
  const rescheduleAppointmentMutation = useMutation({
    mutationFn: (data: RescheduleFormData) => {
      // Add customer portal session header
      const headers: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        const portalSession = localStorage.getItem('customer-portal-session');
        if (portalSession) {
          headers['x-portal-session'] = portalSession;
        }
      }
      
      return apiRequest(`/api/customer-portal/maintenance-appointments/${data.appointmentId}/reschedule`, 'PUT', data, headers);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-portal/maintenance-appointments'] });
      setIsRescheduleDialogOpen(false);
      setRescheduleAppointment(null);
      rescheduleForm.reset();
      toast({
        title: "Appointment Rescheduled",
        description: "Your appointment has been successfully rescheduled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Reschedule Failed",
        description: error.message || "Failed to reschedule appointment. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Generate next 14 days for date selection
  const availableDates = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(new Date(), i + 1);
    return format(date, 'yyyy-MM-dd');
  });

  const handleSlotSelect = (slot: AvailableSlot, date: string) => {
    if (!slot.isAvailable) return;
    
    setSelectedSlot(slot);
    form.setValue('appointmentDate', date);
    form.setValue('appointmentTime', slot.time);
    form.setValue('duration', slot.duration);
    setIsBookingDialogOpen(true);
  };

  const onSubmit = (data: MaintenanceSchedulingFormData) => {
    bookAppointmentMutation.mutate(data);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed': return 'default';
      case 'requested': return 'secondary';
      case 'in_progress': return 'outline';
      case 'completed': return 'outline';
      case 'cancelled': return 'destructive';
      case 'rescheduled': return 'secondary';
      default: return 'secondary';
    }
  };

  const getMaintenanceTypeLabel = (type: string) => {
    const labels = {
      'routine_maintenance': 'Routine Maintenance',
      'preventive_maintenance': 'Preventive Maintenance',
      'deep_cleaning': 'Deep Cleaning',
      'firmware_update': 'Firmware Update',
      'parts_replacement': 'Parts Replacement',
      'calibration': 'Calibration',
      'inspection': 'Inspection'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getContactMethodIcon = (method: string) => {
    switch (method) {
      case 'phone': return <Phone className="h-4 w-4" />;
      case 'text': return <MessageSquare className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const appointments = appointmentsData?.data || [];
  const upcomingAppointments = appointments.filter((apt: MaintenanceAppointment) => 
    apt.status !== 'completed' && apt.status !== 'cancelled'
  );
  const pastAppointments = appointments.filter((apt: MaintenanceAppointment) => 
    apt.status === 'completed' || apt.status === 'cancelled'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
          <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Maintenance Scheduling
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Schedule routine maintenance for your equipment
          </p>
        </div>
      </div>

      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="schedule" data-testid="tab-schedule">Schedule Appointment</TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">My Appointments</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-6">
          {/* Date Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Select Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-3">
                {availableDates.map((date) => (
                  <Button
                    key={date}
                    variant={selectedDate === date ? "default" : "outline"}
                    onClick={() => setSelectedDate(date)}
                    className="p-4 h-auto flex flex-col min-h-[48px] touch-target"
                    data-testid={`date-button-${date}`}
                  >
                    <span className="text-xs font-medium">
                      {format(parseISO(date), 'MMM dd')}
                    </span>
                    <span className="text-xs opacity-75">
                      {format(parseISO(date), 'EEE')}
                    </span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Available Time Slots */}
          {selectedDate && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Available Times for {format(parseISO(selectedDate), 'MMMM dd, yyyy')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {availabilityLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Loading available times...</p>
                  </div>
                ) : availabilityData?.data?.availableSlots ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {availabilityData.data.availableSlots.map((slot: AvailableSlot, index: number) => (
                      <Button
                        key={index}
                        variant={slot.isAvailable ? "outline" : "secondary"}
                        disabled={!slot.isAvailable}
                        onClick={() => handleSlotSelect(slot, selectedDate)}
                        className={`p-4 h-auto flex flex-col min-h-[56px] touch-target ${
                          slot.isAvailable 
                            ? "hover:bg-blue-50 dark:hover:bg-blue-900 border-blue-200 dark:border-blue-800" 
                            : "opacity-50 cursor-not-allowed"
                        }`}
                        data-testid={`time-slot-${slot.time}`}
                      >
                        <span className="font-medium">{slot.time}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {slot.duration}min • {slot.technicianName}
                        </span>
                        {!slot.isAvailable && (
                          <span className="text-xs text-red-500">Unavailable</span>
                        )}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">No available time slots for this date.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="appointments" className="space-y-6">
          {/* Upcoming Appointments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Upcoming Appointments ({upcomingAppointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appointmentsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">Loading appointments...</p>
                </div>
              ) : upcomingAppointments.length > 0 ? (
                <div className="space-y-4">
                  {upcomingAppointments.map((appointment: MaintenanceAppointment) => (
                    <div 
                      key={appointment.id} 
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3"
                      data-testid={`appointment-${appointment.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">
                              {getMaintenanceTypeLabel(appointment.maintenanceType)}
                            </h4>
                            <Badge variant={getStatusBadgeVariant(appointment.status)}>
                              {appointment.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(parseISO(appointment.appointmentDate), 'MMM dd, yyyy')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {appointment.appointmentTime}
                            </span>
                            <span className="flex items-center gap-1">
                              {getContactMethodIcon(appointment.contactMethod)}
                              {appointment.contactMethod}
                            </span>
                          </div>
                          {appointment.equipmentName && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Equipment: {appointment.equipmentName}
                            </p>
                          )}
                          {appointment.confirmationCode && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Confirmation: <span className="font-mono">{appointment.confirmationCode}</span>
                            </p>
                          )}
                        </div>
                        {appointment.status === 'requested' && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRescheduleAppointment(appointment);
                                rescheduleForm.setValue('appointmentId', appointment.id);
                                setIsRescheduleDialogOpen(true);
                              }}
                              disabled={rescheduleAppointmentMutation.isPending}
                              data-testid={`reschedule-button-${appointment.id}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Reschedule
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancelAppointmentMutation.mutate({ 
                                appointmentId: appointment.id,
                                reason: 'Cancelled by customer'
                              })}
                              disabled={cancelAppointmentMutation.isPending}
                              data-testid={`cancel-button-${appointment.id}`}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                      {appointment.description && (
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {appointment.description}
                        </p>
                      )}
                      {appointment.specialInstructions && (
                        <div className="bg-blue-50 dark:bg-blue-900/50 p-3 rounded-md">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Special Instructions:</strong> {appointment.specialInstructions}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">No upcoming appointments scheduled.</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Use the "Schedule Appointment" tab to book maintenance.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Past Appointments */}
          {pastAppointments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Past Appointments ({pastAppointments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pastAppointments.slice(0, 5).map((appointment: MaintenanceAppointment) => (
                    <div 
                      key={appointment.id} 
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 opacity-75"
                      data-testid={`past-appointment-${appointment.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-medium text-gray-900 dark:text-gray-100">
                            {getMaintenanceTypeLabel(appointment.maintenanceType)}
                          </h5>
                          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                            <span>{format(parseISO(appointment.appointmentDate), 'MMM dd, yyyy')}</span>
                            <span>{appointment.appointmentTime}</span>
                          </div>
                        </div>
                        <Badge variant={getStatusBadgeVariant(appointment.status)}>
                          {appointment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Booking Dialog */}
      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Maintenance Appointment</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Selected Time Display */}
              {selectedSlot && (
                <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Selected Time Slot</h4>
                  <div className="flex items-center gap-4 text-sm text-blue-800 dark:text-blue-200">
                    <span>{format(parseISO(form.getValues('appointmentDate')), 'MMMM dd, yyyy')}</span>
                    <span>{selectedSlot.time}</span>
                    <span>{selectedSlot.duration} minutes</span>
                    <span>with {selectedSlot.technicianName}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="maintenanceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maintenance Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-maintenance-type">
                            <SelectValue placeholder="Select maintenance type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="routine_maintenance">Routine Maintenance</SelectItem>
                          <SelectItem value="preventive_maintenance">Preventive Maintenance</SelectItem>
                          <SelectItem value="deep_cleaning">Deep Cleaning</SelectItem>
                          <SelectItem value="firmware_update">Firmware Update</SelectItem>
                          <SelectItem value="parts_replacement">Parts Replacement</SelectItem>
                          <SelectItem value="calibration">Calibration</SelectItem>
                          <SelectItem value="inspection">Inspection</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Contact Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-contact-method">
                            <SelectValue placeholder="Select contact method" />
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
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe any specific issues or requests"
                        className="min-h-[100px]"
                        data-testid="input-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specialInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Instructions (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any special instructions for the technician"
                        data-testid="input-special-instructions"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsBookingDialogOpen(false)}
                  data-testid="button-cancel-booking"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={bookAppointmentMutation.isPending}
                  data-testid="button-confirm-booking"
                >
                  {bookAppointmentMutation.isPending ? "Booking..." : "Book Appointment"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={isRescheduleDialogOpen} onOpenChange={setIsRescheduleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
          </DialogHeader>
          
          {rescheduleAppointment && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Current Appointment</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>{getMaintenanceTypeLabel(rescheduleAppointment.maintenanceType)}</div>
                  <div>{format(parseISO(rescheduleAppointment.appointmentDate), 'MMMM dd, yyyy')} at {rescheduleAppointment.appointmentTime}</div>
                </div>
              </div>

              <Form {...rescheduleForm}>
                <form onSubmit={rescheduleForm.handleSubmit((data) => rescheduleAppointmentMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={rescheduleForm.control}
                    name="newDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            min={format(new Date(), 'yyyy-MM-dd')}
                            data-testid="input-reschedule-date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={rescheduleForm.control}
                    name="newTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Time</FormLabel>
                        <FormControl>
                          <Input 
                            type="time" 
                            data-testid="input-reschedule-time"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={rescheduleForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason for Rescheduling (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Reason for rescheduling..."
                            data-testid="input-reschedule-reason"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-3">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsRescheduleDialogOpen(false);
                        setRescheduleAppointment(null);
                        rescheduleForm.reset();
                      }}
                      data-testid="button-cancel-reschedule"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={rescheduleAppointmentMutation.isPending}
                      data-testid="button-confirm-reschedule"
                    >
                      {rescheduleAppointmentMutation.isPending ? "Rescheduling..." : "Reschedule"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};