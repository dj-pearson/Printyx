import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, Edit, Plus, Phone, Mail, MapPin, Building2, User, Eye, FileText, Users, StickyNote,
  PhoneCall, Video, Clock, MoreHorizontal, Calendar, Save, X, MessageSquare
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import { useAuth } from "@/hooks/useAuth";

export default function CustomerDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Dialog states - copied from Lead record
  const [dialogs, setDialogs] = useState({
    note: false,
    email: false,
    call: false,
    meeting: false,
    task: false,
    contact: false,
    viewServiceTickets: false,
    viewInvoices: false,
    viewContacts: false,
    viewNotes: false
  });
  
  // Form states for each activity type - copied from Lead record
  const [activityForms, setActivityForms] = useState({
    note: { content: '' },
    email: { 
      contacted: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      content: '',
      createFollowUp: true,
      followUpDays: 3
    },
    call: {
      contacted: '0 contacts',
      outcome: 'Connected',
      direction: 'Outbound',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      content: '',
      createFollowUp: true,
      followUpDays: 3
    },
    meeting: {
      attendees: '',
      outcome: 'Scheduled',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      duration: '15 Minutes',
      content: '',
      createFollowUp: true,
      followUpDays: 3
    },
    task: {
      taskType: 'To-do',
      title: '',
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'Medium',
      assignedTo: 'Me',
      content: ''
    },
    contact: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      jobTitle: '',
      isPrimary: false
    }
  });

  // Activity mutation handlers - adapted from Lead record
  const activityMutation = useMutation({
    mutationFn: async ({ type, data }: { type: string, data: any }) => {
      return await apiRequest('POST', `/api/customers/${id}/activities`, { type, ...data });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Activity logged successfully!",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${id}/activities`] });
      // Reset form and close dialog
      setDialogs(prev => ({ ...prev, [activityForms]: false }));
    },
    onError: (error) => {
      console.error('Activity error:', error);
      toast({
        title: "Error",
        description: "Failed to log activity. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle activity form submission
  const handleActivitySubmit = (type: string) => {
    const formData = activityForms[type as keyof typeof activityForms];
    activityMutation.mutate({ type, data: formData });
  };

  // Handle form field changes
  const handleFormChange = (type: string, field: string, value: any) => {
    setActivityForms(prev => ({
      ...prev,
      [type]: {
        ...prev[type as keyof typeof prev],
        [field]: value
      }
    }));
  };

  // Dialog helper functions
  const openDialog = (type: string) => {
    setDialogs(prev => ({ ...prev, [type]: true }));
  };

  const closeDialog = (type: string) => {
    setDialogs(prev => ({ ...prev, [type]: false }));
  };

  // Fetch customer data
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: [`/api/customers/${id}`],
  });

  // Fetch company data if customer has companyId
  const { data: company } = useQuery({
    queryKey: [`/api/companies/${customer?.companyId}`],
    enabled: !!customer?.companyId,
  });

  // Fetch company contacts
  const { data: contacts = [] } = useQuery({
    queryKey: [`/api/companies/${customer?.companyId}/contacts`],
    enabled: !!customer?.companyId,
  });

  // Fetch customer equipment
  const { data: equipment = [] } = useQuery({
    queryKey: [`/api/customers/${id}/equipment`],
    enabled: !!id,
  });

  // Fetch customer meter readings
  const { data: meterReadings = [] } = useQuery({
    queryKey: [`/api/customers/${id}/meter-readings`],
    enabled: !!id,
  });

  // Fetch customer invoices
  const { data: invoices = [] } = useQuery({
    queryKey: [`/api/customers/${id}/invoices`],
    enabled: !!id,
  });

  // Fetch customer service tickets
  const { data: serviceTickets = [] } = useQuery({
    queryKey: [`/api/customers/${id}/service-tickets`],
    enabled: !!id,
  });

  // Fetch customer contracts
  const { data: contracts = [] } = useQuery({
    queryKey: [`/api/customers/${id}/contracts`],
    enabled: !!id,
  });

  if (customerLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Customer Detail</h1>
          </header>
          <main className="flex-1 p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="space-y-4">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Customer Detail</h1>
          </header>
          <main className="flex-1 p-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Customer not found</h2>
              <p className="text-gray-600 mb-4">The customer you're looking for doesn't exist.</p>
              <Link href="/customers">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Customers
                </Button>
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Customer Detail</h1>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
      {/* Header - matches Lead layout exactly */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/customers">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to CRM
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Customer #{customer.id.slice(0, 8)}</h1>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {customer.leadStatus?.toUpperCase() || 'CUSTOMER'}
              </Badge>
            </div>
            <p className="text-gray-600">{customer.leadSource || 'Unknown source'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Service Ticket
          </Button>
        </div>
      </div>


      <div className="grid grid-cols-4 gap-6">
        {/* Main Content - Left Side (3 columns on large screens) */}
        <div className="col-span-3 space-y-6">
          
          {/* Tabs - matches Lead layout */}
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="related">Related ({equipment.length + invoices.length + serviceTickets.length})</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-6">
              {/* Company Information Section - matches Lead layout exactly */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Company Name</label>
                      <p className="text-base">{company?.businessName || `Customer ${customer.id.slice(0, 8)}`}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Source</label>
                      <p className="text-base">{customer.leadSource || 'Not specified'}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status</label>
                      <div>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {customer.leadStatus?.toUpperCase() || 'CUSTOMER'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Estimated Value</label>
                      <p className="text-base">${customer.estimatedAmount ? Number(customer.estimatedAmount).toLocaleString() : '0'}</p>
                    </div>
                  </div>

                  {customer.notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Notes</label>
                      <div className="mt-2 p-3 bg-gray-50 rounded border">
                        <p className="text-sm">{customer.notes}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons - matches Lead layout */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => openDialog('note')}>
                  <StickyNote className="h-4 w-4 mr-2" />
                  Note
                </Button>
                <Button variant="outline" size="sm" onClick={() => openDialog('email')}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button variant="outline" size="sm" onClick={() => openDialog('call')}>
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
                <Button variant="outline" size="sm" onClick={() => openDialog('meeting')}>
                  <Video className="h-4 w-4 mr-2" />
                  Meeting
                </Button>
                <Button variant="outline" size="sm" onClick={() => openDialog('task')}>
                  <Clock className="h-4 w-4 mr-2" />
                  Task
                </Button>
                <Button variant="outline" size="sm" onClick={() => openDialog('contact')}>
                  <Plus className="h-4 w-4 mr-2" />
                  More
                </Button>
              </div>

              {/* Primary Contact Section - matches Lead layout exactly */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Primary Contact
                    </div>
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Contact
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Primary Contact</label>
                      <p className="text-base">{primaryContact ? `${primaryContact.firstName} ${primaryContact.lastName}` : 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Phone</label>
                      <p className="text-base">{primaryContact?.phone || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Email</label>
                      <p className="text-base">{primaryContact?.email || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Location</label>
                      <p className="text-base">{company?.city && company?.state ? `${company.city}, ${company.state}` : 'Not provided'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="related" className="mt-6">
              <div className="space-y-4">
                {/* Service Tickets */}
                {serviceTickets.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Service Tickets ({serviceTickets.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {serviceTickets.slice(0, 3).map((ticket) => (
                          <div key={ticket.id} className="flex justify-between items-center p-2 border rounded">
                            <span className="text-sm">{ticket.title || `Ticket #${ticket.id.slice(0, 8)}`}</span>
                            <Badge variant="outline">{ticket.status}</Badge>
                          </div>
                        ))}
                        {serviceTickets.length > 3 && (
                          <p className="text-sm text-gray-500">And {serviceTickets.length - 3} more...</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Invoices */}
                {invoices.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Invoices ({invoices.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {invoices.slice(0, 3).map((invoice) => (
                          <div key={invoice.id} className="flex justify-between items-center p-2 border rounded">
                            <span className="text-sm">Invoice #{invoice.id.slice(0, 8)}</span>
                            <span className="text-sm font-medium">${Number(invoice.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                        {invoices.length > 3 && (
                          <p className="text-sm text-gray-500">And {invoices.length - 3} more...</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Equipment */}
                {equipment.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Equipment ({equipment.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {equipment.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex justify-between items-center p-2 border rounded">
                            <span className="text-sm">{item.model || `Equipment #${item.id.slice(0, 8)}`}</span>
                            <Badge variant="outline">{item.status}</Badge>
                          </div>
                        ))}
                        {equipment.length > 3 && (
                          <p className="text-sm text-gray-500">And {equipment.length - 3} more...</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Meter Readings */}
                {meterReadings.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Meter Readings ({meterReadings.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {meterReadings.slice(0, 3).map((reading) => (
                          <div key={reading.id} className="flex justify-between items-center p-2 border rounded">
                            <span className="text-sm">Reading #{reading.id.slice(0, 8)}</span>
                            <span className="text-sm font-medium">{reading.currentMeterCount?.toLocaleString() || 'N/A'}</span>
                          </div>
                        ))}
                        {meterReadings.length > 3 && (
                          <p className="text-sm text-gray-500">And {meterReadings.length - 3} more...</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {equipment.length === 0 && invoices.length === 0 && serviceTickets.length === 0 && meterReadings.length === 0 && (
                  <Card>
                    <CardContent className="text-center py-8">
                      <p className="text-gray-500">No related records found</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500 py-4">No activities recorded</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar - matches Lead layout exactly */}
        <div className="col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">SALES REP</label>
                <p className="text-sm">{customer.ownerId ? 'Assigned' : 'Not assigned'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">SOURCE</label>
                <p className="text-sm">{customer.leadSource || 'Unknown'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">ESTIMATED VALUE</label>
                <p className="text-sm">${customer.estimatedAmount ? Number(customer.estimatedAmount).toLocaleString() : '0'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">EXPECTED CLOSE DATE</label>
                <p className="text-sm">{customer.closeDate ? new Date(customer.closeDate).toLocaleDateString() : 'Not set'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">NEXT FOLLOW-UP</label>
                <p className="text-sm">{customer.nextFollowUpDate ? new Date(customer.nextFollowUpDate).toLocaleDateString() : 'Not scheduled'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Eye className="h-4 w-4 mr-2" />
                View Service Tickets
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                View Invoices
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                View Contacts
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <StickyNote className="h-4 w-4 mr-2" />
                View Notes
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Note Dialog */}
      <Dialog open={dialogs.note} onOpenChange={(open) => setDialogs(prev => ({ ...prev, note: open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note-content">Note</Label>
              <Textarea
                id="note-content"
                placeholder="Add your note here..."
                value={activityForms.note.content}
                onChange={(e) => handleFormChange('note', 'content', e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => closeDialog('note')}>
                Cancel
              </Button>
              <Button onClick={() => handleActivitySubmit('note')}>
                <Save className="h-4 w-4 mr-2" />
                Save Note
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={dialogs.email} onOpenChange={(open) => setDialogs(prev => ({ ...prev, email: open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email-contacted">Contacted</Label>
              <Input
                id="email-contacted"
                value={activityForms.email.contacted}
                onChange={(e) => handleFormChange('email', 'contacted', e.target.value)}
                placeholder="Who was contacted?"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="email-date">Date</Label>
                <Input
                  id="email-date"
                  type="date"
                  value={activityForms.email.date}
                  onChange={(e) => handleFormChange('email', 'date', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="email-time">Time</Label>
                <Input
                  id="email-time"
                  type="time"
                  value={activityForms.email.time}
                  onChange={(e) => handleFormChange('email', 'time', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email-content">Email Content</Label>
              <Textarea
                id="email-content"
                placeholder="What was discussed?"
                value={activityForms.email.content}
                onChange={(e) => handleFormChange('email', 'content', e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="email-followup"
                checked={activityForms.email.createFollowUp}
                onCheckedChange={(checked) => handleFormChange('email', 'createFollowUp', checked)}
              />
              <Label htmlFor="email-followup">Create follow-up task</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => closeDialog('email')}>
                Cancel
              </Button>
              <Button onClick={() => handleActivitySubmit('email')}>
                <Save className="h-4 w-4 mr-2" />
                Log Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Call Dialog */}
      <Dialog open={dialogs.call} onOpenChange={(open) => setDialogs(prev => ({ ...prev, call: open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="call-contacted">Contacted</Label>
              <Input
                id="call-contacted"
                value={activityForms.call.contacted}
                onChange={(e) => handleFormChange('call', 'contacted', e.target.value)}
                placeholder="Who was contacted?"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Outcome</Label>
                <Select
                  value={activityForms.call.outcome}
                  onValueChange={(value) => handleFormChange('call', 'outcome', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Connected">Connected</SelectItem>
                    <SelectItem value="Left voicemail">Left voicemail</SelectItem>
                    <SelectItem value="No answer">No answer</SelectItem>
                    <SelectItem value="Busy">Busy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Direction</Label>
                <Select
                  value={activityForms.call.direction}
                  onValueChange={(value) => handleFormChange('call', 'direction', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Outbound">Outbound</SelectItem>
                    <SelectItem value="Inbound">Inbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="call-date">Date</Label>
                <Input
                  id="call-date"
                  type="date"
                  value={activityForms.call.date}
                  onChange={(e) => handleFormChange('call', 'date', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="call-time">Time</Label>
                <Input
                  id="call-time"
                  type="time"
                  value={activityForms.call.time}
                  onChange={(e) => handleFormChange('call', 'time', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="call-content">Call Notes</Label>
              <Textarea
                id="call-content"
                placeholder="What was discussed?"
                value={activityForms.call.content}
                onChange={(e) => handleFormChange('call', 'content', e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="call-followup"
                checked={activityForms.call.createFollowUp}
                onCheckedChange={(checked) => handleFormChange('call', 'createFollowUp', checked)}
              />
              <Label htmlFor="call-followup">Create follow-up task</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => closeDialog('call')}>
                Cancel
              </Button>
              <Button onClick={() => handleActivitySubmit('call')}>
                <Save className="h-4 w-4 mr-2" />
                Log Call
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Meeting Dialog */}
      <Dialog open={dialogs.meeting} onOpenChange={(open) => setDialogs(prev => ({ ...prev, meeting: open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Meeting</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="meeting-attendees">Attendees</Label>
              <Input
                id="meeting-attendees"
                value={activityForms.meeting.attendees}
                onChange={(e) => handleFormChange('meeting', 'attendees', e.target.value)}
                placeholder="Who attended the meeting?"
              />
            </div>
            <div>
              <Label>Outcome</Label>
              <Select
                value={activityForms.meeting.outcome}
                onValueChange={(value) => handleFormChange('meeting', 'outcome', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Rescheduled">Rescheduled</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="meeting-date">Date</Label>
                <Input
                  id="meeting-date"
                  type="date"
                  value={activityForms.meeting.date}
                  onChange={(e) => handleFormChange('meeting', 'date', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="meeting-time">Time</Label>
                <Input
                  id="meeting-time"
                  type="time"
                  value={activityForms.meeting.time}
                  onChange={(e) => handleFormChange('meeting', 'time', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Duration</Label>
              <Select
                value={activityForms.meeting.duration}
                onValueChange={(value) => handleFormChange('meeting', 'duration', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15 Minutes">15 Minutes</SelectItem>
                  <SelectItem value="30 Minutes">30 Minutes</SelectItem>
                  <SelectItem value="1 Hour">1 Hour</SelectItem>
                  <SelectItem value="2 Hours">2 Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="meeting-content">Meeting Notes</Label>
              <Textarea
                id="meeting-content"
                placeholder="What was discussed?"
                value={activityForms.meeting.content}
                onChange={(e) => handleFormChange('meeting', 'content', e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="meeting-followup"
                checked={activityForms.meeting.createFollowUp}
                onCheckedChange={(checked) => handleFormChange('meeting', 'createFollowUp', checked)}
              />
              <Label htmlFor="meeting-followup">Create follow-up task</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => closeDialog('meeting')}>
                Cancel
              </Button>
              <Button onClick={() => handleActivitySubmit('meeting')}>
                <Save className="h-4 w-4 mr-2" />
                Log Meeting
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={dialogs.task} onOpenChange={(open) => setDialogs(prev => ({ ...prev, task: open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Task Type</Label>
              <Select
                value={activityForms.task.taskType}
                onValueChange={(value) => handleFormChange('task', 'taskType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="To-do">To-do</SelectItem>
                  <SelectItem value="Follow-up">Follow-up</SelectItem>
                  <SelectItem value="Call">Call</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={activityForms.task.title}
                onChange={(e) => handleFormChange('task', 'title', e.target.value)}
                placeholder="Task title"
              />
            </div>
            <div>
              <Label htmlFor="task-due-date">Due Date</Label>
              <Input
                id="task-due-date"
                type="date"
                value={activityForms.task.dueDate}
                onChange={(e) => handleFormChange('task', 'dueDate', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Priority</Label>
                <Select
                  value={activityForms.task.priority}
                  onValueChange={(value) => handleFormChange('task', 'priority', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assigned To</Label>
                <Select
                  value={activityForms.task.assignedTo}
                  onValueChange={(value) => handleFormChange('task', 'assignedTo', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Me">Me</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Team">Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="task-content">Description</Label>
              <Textarea
                id="task-content"
                placeholder="Task description..."
                value={activityForms.task.content}
                onChange={(e) => handleFormChange('task', 'content', e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => closeDialog('task')}>
                Cancel
              </Button>
              <Button onClick={() => handleActivitySubmit('task')}>
                <Save className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
          </div>
        </main>
      </div>
    </div>
  );
}