import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Clock, 
  Building2, 
  Phone, 
  Mail, 
  Globe, 
  MapPin, 
  Calendar, 
  Users, 
  DollarSign,
  Edit,
  Plus,
  MessageSquare,
  PhoneCall,
  FileText,
  User,
  CheckCircle2,
  Save,
  X,
  AlertCircle,
  Target,
  Activity,
  UserPlus
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";

export default function LeadDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  
  // Dialog states
  const [dialogs, setDialogs] = useState({
    note: false,
    email: false,
    call: false,
    meeting: false,
    task: false,
    contact: false
  });
  
  // Fetch lead details first
  const { data: lead, isLoading } = useQuery({
    queryKey: ['/api/leads', id],
    enabled: !!id,
  });

  // Form states for each activity type
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



  // Fetch lead activities
  const { data: activities = [] } = useQuery({
    queryKey: ['/api/leads', id, 'activities'],
    enabled: !!id,
  });

  // Fetch lead contacts
  const { data: contacts = [] } = useQuery({
    queryKey: ['/api/leads', id, 'contacts'],
    enabled: !!id,
  });

  // Fetch related records
  const { data: relatedRecords = [] } = useQuery({
    queryKey: ['/api/leads', id, 'related-records'],
    enabled: !!id,
  });

  // Convert to customer mutation
  const convertMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/leads/${id}/convert`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Lead successfully converted to customer!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      setLocation('/customers');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to convert lead",
        variant: "destructive",
      });
    },
  });

  // Activity logging mutations
  const logActivityMutation = useMutation({
    mutationFn: async (activityData: { type: string; subject: string; notes?: string; scheduledDate?: string; contactId?: string }) => {
      return await apiRequest('POST', `/api/leads/${id}/activities`, {
        ...activityData,
        activityType: activityData.type, // Map 'type' to 'activityType' for database
        leadId: id,
        date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads', id, 'activities'] });
      toast({
        title: "Success",
        description: "Activity logged successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log activity",
        variant: "destructive",
      });
    },
  });

  // Lead update mutation
  const updateLeadMutation = useMutation({
    mutationFn: async (updateData: any) => {
      return await apiRequest('PUT', `/api/leads/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads', id] });
      setIsEditing(false);
      setEditForm({});
      toast({
        title: "Success",
        description: "Lead updated successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update lead",
        variant: "destructive",
      });
    },
  });

  // Add contact mutation
  const addContactMutation = useMutation({
    mutationFn: async (contactData: any) => {
      return await apiRequest('POST', `/api/leads/${id}/contacts`, contactData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads', id, 'contacts'] });
      closeDialog('contact');
      setActivityForms(prev => ({ ...prev, contact: { firstName: '', lastName: '', email: '', phone: '', jobTitle: '', isPrimary: false } }));
      toast({
        title: "Success",
        description: "Contact added successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add contact",
        variant: "destructive",
      });
    },
  });

  // Dialog handlers
  const openDialog = (type: keyof typeof dialogs) => {
    // Initialize form with lead data when opening dialog
    if (lead && (type === 'email' || type === 'meeting')) {
      setActivityForms(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          contacted: lead.contactName || '',
          attendees: lead.contactName || ''
        }
      }));
    }
    setDialogs(prev => ({ ...prev, [type]: true }));
  };

  const closeDialog = (type: keyof typeof dialogs) => {
    setDialogs(prev => ({ ...prev, [type]: false }));
  };

  const updateActivityForm = (type: keyof typeof activityForms, field: string, value: any) => {
    setActivityForms(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value }
    }));
  };

  const handleActivitySubmit = (type: string) => {
    if (type === 'contact') {
      const contactForm = activityForms.contact;
      addContactMutation.mutate({
        firstName: contactForm.firstName,
        lastName: contactForm.lastName,
        email: contactForm.email,
        phone: contactForm.phone,
        jobTitle: contactForm.jobTitle,
        isPrimary: contactForm.isPrimary
      });
      return;
    }

    const form = activityForms[type as keyof typeof activityForms];
    let activityData: any = {
      type,
      subject: `${type.charAt(0).toUpperCase() + type.slice(1)} logged`,
      notes: form.content || `${type} activity completed`
    };

    // Add contact information if selected
    if (form.contacted && form.contacted !== '0 contacts' && form.contacted !== '') {
      activityData.contactId = form.contacted;
    } else if (form.attendees && form.attendees !== '') {
      activityData.contactId = form.attendees;
    } else if (form.contactId && form.contactId !== '') {
      activityData.contactId = form.contactId;
    }

    if (type === 'meeting' && form.date) {
      activityData.scheduledDate = new Date(`${form.date}T${form.time || '09:00'}`).toISOString();
    }

    logActivityMutation.mutate(activityData);
    closeDialog(type as keyof typeof dialogs);
  };

  const handleSaveEdit = () => {
    updateLeadMutation.mutate(editForm);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'qualified': return 'bg-green-100 text-green-800 border-green-200';
      case 'proposal': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'negotiation': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'closed_won': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'closed_lost': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <PhoneCall className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'meeting': return <Users className="w-4 h-4" />;
      case 'demo': return <Target className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const formatDate = (date: string) => {
    return format(new Date(date), 'MMM dd, yyyy');
  };

  if (isLoading) {
    return (
      <MainLayout 
        title="Lead Details" 
        description="View and manage lead information"
      >
        <div className="animate-pulse space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="flex gap-2">
              <div className="h-9 bg-gray-200 rounded w-20"></div>
              <div className="h-9 bg-gray-200 rounded w-32"></div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-3 bg-gray-200 rounded w-full"></div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-3 bg-gray-200 rounded w-full"></div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!lead) {
    return (
      <MainLayout 
        title="Lead Not Found" 
        description="The requested lead could not be found"
      >
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Lead not found</h2>
          <p className="text-gray-600 mb-4">The lead you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => setLocation('/crm')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to CRM
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title={`Lead #${lead.id}`} 
      description="View and manage lead information"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/crm')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to CRM
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Lead #{lead.id}</h1>
              <p className="text-gray-600">{lead.leadSource || 'Unknown source'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge className={`${getStatusColor(lead.leadStatus || 'new')} px-3 py-1 text-sm font-medium`}>
              {(lead.leadStatus || 'new').replace('_', ' ').toUpperCase()}
            </Badge>
{isEditing ? (
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSaveEdit}
                  disabled={updateLeadMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {lead.leadStatus !== 'closed_won' && (
              <Button 
                size="sm"
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Convert to Customer
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="details" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="related">Related ({relatedRecords.length})</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6">
                {/* Company Information */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center">
                      <Building2 className="h-5 w-5 mr-2 text-gray-600" />
                      <CardTitle>Company Information</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Company Name</Label>
                          <Input
                            value={editForm.companyName || `Lead #${lead.id}`}
                            onChange={(e) => setEditForm(prev => ({ ...prev, companyName: e.target.value }))}
                            className="mt-1"
                            placeholder="Company name"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Source</Label>
                          <Select 
                            value={editForm.leadSource || lead.leadSource || 'website'}
                            onValueChange={(value) => setEditForm(prev => ({ ...prev, leadSource: value }))}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="website">Website</SelectItem>
                              <SelectItem value="referral">Referral</SelectItem>
                              <SelectItem value="cold_call">Cold Call</SelectItem>
                              <SelectItem value="trade_show">Trade Show</SelectItem>
                              <SelectItem value="advertising">Advertising</SelectItem>
                              <SelectItem value="social_media">Social Media</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Status</Label>
                          <Select 
                            value={editForm.leadStatus || lead.leadStatus || 'new'}
                            onValueChange={(value) => setEditForm(prev => ({ ...prev, leadStatus: value }))}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="qualified">Qualified</SelectItem>
                              <SelectItem value="proposal">Proposal</SelectItem>
                              <SelectItem value="negotiation">Negotiation</SelectItem>
                              <SelectItem value="closed_won">Closed Won</SelectItem>
                              <SelectItem value="closed_lost">Closed Lost</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Estimated Value</Label>
                          <Input
                            type="number"
                            value={editForm.estimatedAmount || lead.estimatedAmount || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, estimatedAmount: parseFloat(e.target.value) || null }))}
                            className="mt-1"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Company Name</Label>
                          <p className="text-gray-900 mt-1">Lead #{lead.id}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Source</Label>
                          <p className="text-gray-900 mt-1">{lead.leadSource || 'Not specified'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Status</Label>
                          <div className="mt-1">
                            <Badge className={getStatusColor(lead.leadStatus || 'new')}>
                              {(lead.leadStatus || 'new').replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Estimated Value</Label>
                          <p className="text-gray-900 mt-1 font-semibold">
                            {lead.estimatedAmount ? `$${Number(lead.estimatedAmount).toLocaleString()}` : 'Not specified'}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {isEditing ? (
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Notes</Label>
                        <Textarea
                          value={editForm.notes || lead.notes || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                          className="mt-1"
                          placeholder="Lead notes..."
                          rows={3}
                        />
                      </div>
                    ) : (
                      lead.notes && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Notes</Label>
                          <p className="text-gray-900 mt-1 bg-gray-50 p-3 rounded-md">{lead.notes}</p>
                        </div>
                      )
                    )}
                  </CardContent>
                </Card>

                {/* HubSpot-style Activity Buttons */}
                <div className="flex items-center justify-center space-x-4 py-6">
                  <Dialog open={dialogs.note} onOpenChange={(open) => setDialogs(prev => ({ ...prev, note: open }))}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-2 px-4 py-2 rounded-full hover:bg-gray-50"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Note</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                          <FileText className="w-5 h-5" />
                          <span>Add Note</span>
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm text-gray-600">About Contact (Optional)</Label>
                          <Select value={activityForms.note.contactId || 'no-contact'} onValueChange={(value) => updateActivityForm('note', 'contactId', value === 'no-contact' ? '' : value)}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select contact (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no-contact">{contacts.length} contacts - None selected</SelectItem>
                              {contacts.map((contact: any) => (
                                <SelectItem key={contact.id} value={contact.id}>
                                  {contact.firstName} {contact.lastName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          placeholder="Start typing to add a note..."
                          value={activityForms.note.content}
                          onChange={(e) => updateActivityForm('note', 'content', e.target.value)}
                          className="min-h-[120px] resize-none"
                        />
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="outline" onClick={() => closeDialog('note')}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => handleActivitySubmit('note')}
                            disabled={!activityForms.note.content.trim()}
                            className="bg-orange-500 hover:bg-orange-600"
                          >
                            Add note
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={dialogs.email} onOpenChange={(open) => setDialogs(prev => ({ ...prev, email: open }))}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-2 px-4 py-2 rounded-full hover:bg-gray-50"
                      >
                        <Mail className="w-4 h-4" />
                        <span>Email</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                          <Mail className="w-5 h-5" />
                          <span>Log Email</span>
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label className="text-sm text-gray-600">Contacted</Label>
                            <Select value={activityForms.email.contacted} onValueChange={(value) => updateActivityForm('email', 'contacted', value)}>
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select contact" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0 contacts">{contacts.length} contacts</SelectItem>
                                {contacts.map((contact: any) => (
                                  <SelectItem key={contact.id} value={contact.id}>
                                    {contact.firstName} {contact.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Date</Label>
                            <Input
                              type="date"
                              value={activityForms.email.date}
                              onChange={(e) => updateActivityForm('email', 'date', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Time</Label>
                            <Input
                              type="time"
                              value={activityForms.email.time}
                              onChange={(e) => updateActivityForm('email', 'time', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <Textarea
                          placeholder="Start typing to log an email..."
                          value={activityForms.email.content}
                          onChange={(e) => updateActivityForm('email', 'content', e.target.value)}
                          className="min-h-[120px] resize-none"
                        />
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={activityForms.email.createFollowUp}
                            onCheckedChange={(checked) => updateActivityForm('email', 'createFollowUp', checked)}
                          />
                          <span className="text-sm text-gray-600">Create a To-do task to follow up</span>
                          <Select value={`In ${activityForms.email.followUpDays} business days`}>
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="In 1 business day">In 1 business day</SelectItem>
                              <SelectItem value="In 3 business days">In 3 business days</SelectItem>
                              <SelectItem value="In 1 week">In 1 week</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="outline" onClick={() => closeDialog('email')}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => handleActivitySubmit('email')}
                            className="bg-blue-500 hover:bg-blue-600"
                          >
                            Log email
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={dialogs.call} onOpenChange={(open) => setDialogs(prev => ({ ...prev, call: open }))}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-2 px-4 py-2 rounded-full hover:bg-gray-50"
                      >
                        <PhoneCall className="w-4 h-4" />
                        <span>Call</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                          <PhoneCall className="w-5 h-5" />
                          <span>Log Call</span>
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-5 gap-4">
                          <div>
                            <Label className="text-sm text-gray-600">Contacted</Label>
                            <Select value={activityForms.call.contacted} onValueChange={(value) => updateActivityForm('call', 'contacted', value)}>
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select contact" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0 contacts">{contacts.length} contacts</SelectItem>
                                {contacts.map((contact: any) => (
                                  <SelectItem key={contact.id} value={contact.id}>
                                    {contact.firstName} {contact.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Call outcome</Label>
                            <Select value={activityForms.call.outcome} onValueChange={(value) => updateActivityForm('call', 'outcome', value)}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Connected">Connected</SelectItem>
                                <SelectItem value="No answer">No answer</SelectItem>
                                <SelectItem value="Busy">Busy</SelectItem>
                                <SelectItem value="Left voicemail">Left voicemail</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Direction</Label>
                            <Select value={activityForms.call.direction} onValueChange={(value) => updateActivityForm('call', 'direction', value)}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Outbound">Outbound</SelectItem>
                                <SelectItem value="Inbound">Inbound</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Date</Label>
                            <Input
                              type="date"
                              value={activityForms.call.date}
                              onChange={(e) => updateActivityForm('call', 'date', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Time</Label>
                            <Input
                              type="time"
                              value={activityForms.call.time}
                              onChange={(e) => updateActivityForm('call', 'time', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <Textarea
                          placeholder="Start typing to log a call..."
                          value={activityForms.call.content}
                          onChange={(e) => updateActivityForm('call', 'content', e.target.value)}
                          className="min-h-[120px] resize-none"
                        />
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={activityForms.call.createFollowUp}
                            onCheckedChange={(checked) => updateActivityForm('call', 'createFollowUp', checked)}
                          />
                          <span className="text-sm text-gray-600">Create a To-do task to follow up</span>
                          <Select value={`In ${activityForms.call.followUpDays} business days`}>
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="In 1 business day">In 1 business day</SelectItem>
                              <SelectItem value="In 3 business days">In 3 business days</SelectItem>
                              <SelectItem value="In 1 week">In 1 week</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="outline" onClick={() => closeDialog('call')}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => handleActivitySubmit('call')}
                            className="bg-orange-500 hover:bg-orange-600"
                          >
                            Log call
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={dialogs.meeting} onOpenChange={(open) => setDialogs(prev => ({ ...prev, meeting: open }))}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-2 px-4 py-2 rounded-full hover:bg-gray-50"
                      >
                        <Calendar className="w-4 h-4" />
                        <span>Meeting</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                          <Calendar className="w-5 h-5" />
                          <span>Log Meeting</span>
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-5 gap-4">
                          <div>
                            <Label className="text-sm text-gray-600">Attendees</Label>
                            <Select value={activityForms.meeting.attendees} onValueChange={(value) => updateActivityForm('meeting', 'attendees', value)}>
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select contact" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no-contact">{contacts.length} contacts</SelectItem>
                                {contacts.map((contact: any) => (
                                  <SelectItem key={contact.id} value={contact.id}>
                                    {contact.firstName} {contact.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Outcome</Label>
                            <Select value={activityForms.meeting.outcome} onValueChange={(value) => updateActivityForm('meeting', 'outcome', value)}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Scheduled">Scheduled</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                                <SelectItem value="Rescheduled">Rescheduled</SelectItem>
                                <SelectItem value="No show">No show</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Date</Label>
                            <Input
                              type="date"
                              value={activityForms.meeting.date}
                              onChange={(e) => updateActivityForm('meeting', 'date', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Time</Label>
                            <Input
                              type="time"
                              value={activityForms.meeting.time}
                              onChange={(e) => updateActivityForm('meeting', 'time', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Duration</Label>
                            <Select value={activityForms.meeting.duration} onValueChange={(value) => updateActivityForm('meeting', 'duration', value)}>
                              <SelectTrigger className="mt-1">
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
                        </div>
                        <Textarea
                          placeholder="Start typing to log a meeting..."
                          value={activityForms.meeting.content}
                          onChange={(e) => updateActivityForm('meeting', 'content', e.target.value)}
                          className="min-h-[120px] resize-none"
                        />
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={activityForms.meeting.createFollowUp}
                            onCheckedChange={(checked) => updateActivityForm('meeting', 'createFollowUp', checked)}
                          />
                          <span className="text-sm text-gray-600">Create a To-do task to follow up</span>
                          <Select value={`In ${activityForms.meeting.followUpDays} business days`}>
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="In 1 business day">In 1 business day</SelectItem>
                              <SelectItem value="In 3 business days">In 3 business days</SelectItem>
                              <SelectItem value="In 1 week">In 1 week</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="outline" onClick={() => closeDialog('meeting')}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => handleActivitySubmit('meeting')}
                            className="bg-orange-500 hover:bg-orange-600"
                          >
                            Log meeting
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={dialogs.task} onOpenChange={(open) => setDialogs(prev => ({ ...prev, task: open }))}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-2 px-4 py-2 rounded-full hover:bg-gray-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Task</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                          <CheckCircle2 className="w-5 h-5" />
                          <span>Create Task</span>
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm text-gray-600">Task type</Label>
                            <Select value={activityForms.task.taskType} onValueChange={(value) => updateActivityForm('task', 'taskType', value)}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="To-do">To-do</SelectItem>
                                <SelectItem value="Call">Call</SelectItem>
                                <SelectItem value="Email">Email</SelectItem>
                                <SelectItem value="Meeting">Meeting</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm text-gray-600">Due date</Label>
                            <Input
                              type="date"
                              value={activityForms.task.dueDate}
                              onChange={(e) => updateActivityForm('task', 'dueDate', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm text-gray-600">Title</Label>
                          <Input
                            placeholder="Task title"
                            value={activityForms.task.title}
                            onChange={(e) => updateActivityForm('task', 'title', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm text-gray-600">Related Contact (Optional)</Label>
                          <Select value={activityForms.task.contactId || 'no-contact'} onValueChange={(value) => updateActivityForm('task', 'contactId', value === 'no-contact' ? '' : value)}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select contact (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no-contact">{contacts.length} contacts - None selected</SelectItem>
                              {contacts.map((contact: any) => (
                                <SelectItem key={contact.id} value={contact.id}>
                                  {contact.firstName} {contact.lastName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          placeholder="Task description..."
                          value={activityForms.task.content}
                          onChange={(e) => updateActivityForm('task', 'content', e.target.value)}
                          className="min-h-[120px] resize-none"
                        />
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="outline" onClick={() => closeDialog('task')}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => handleActivitySubmit('task')}
                            disabled={!activityForms.task.title.trim()}
                            className="bg-orange-500 hover:bg-orange-600"
                          >
                            Create task
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2 px-4 py-2 rounded-full hover:bg-gray-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>More</span>
                  </Button>
                </div>

                {/* Add Contact Dialog */}
                <Dialog open={dialogs.contact} onOpenChange={(open) => setDialogs(prev => ({ ...prev, contact: open }))}>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center space-x-2">
                        <UserPlus className="w-5 h-5" />
                        <span>Add Contact</span>
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm text-gray-600">First Name</Label>
                          <Input
                            value={activityForms.contact.firstName}
                            onChange={(e) => updateActivityForm('contact', 'firstName', e.target.value)}
                            className="mt-1"
                            placeholder="First name"
                          />
                        </div>
                        <div>
                          <Label className="text-sm text-gray-600">Last Name</Label>
                          <Input
                            value={activityForms.contact.lastName}
                            onChange={(e) => updateActivityForm('contact', 'lastName', e.target.value)}
                            className="mt-1"
                            placeholder="Last name"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-600">Email</Label>
                        <Input
                          type="email"
                          value={activityForms.contact.email}
                          onChange={(e) => updateActivityForm('contact', 'email', e.target.value)}
                          className="mt-1"
                          placeholder="email@company.com"
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-gray-600">Phone</Label>
                        <Input
                          value={activityForms.contact.phone}
                          onChange={(e) => updateActivityForm('contact', 'phone', e.target.value)}
                          className="mt-1"
                          placeholder="Phone number"
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-gray-600">Job Title</Label>
                        <Input
                          value={activityForms.contact.jobTitle}
                          onChange={(e) => updateActivityForm('contact', 'jobTitle', e.target.value)}
                          className="mt-1"
                          placeholder="Job title"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          checked={activityForms.contact.isPrimary}
                          onCheckedChange={(checked) => updateActivityForm('contact', 'isPrimary', checked)}
                        />
                        <span className="text-sm text-gray-600">Set as primary contact</span>
                      </div>
                      <div className="flex items-center justify-end space-x-2">
                        <Button variant="outline" onClick={() => closeDialog('contact')}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={() => handleActivitySubmit('contact')}
                          disabled={!activityForms.contact.firstName.trim() || !activityForms.contact.lastName.trim()}
                          className="bg-blue-500 hover:bg-blue-600"
                        >
                          Add Contact
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Primary Contact */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <User className="h-5 w-5 mr-2 text-gray-600" />
                        <CardTitle>Primary Contact</CardTitle>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => openDialog('contact')}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Contact
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Primary Contact</Label>
                          <Input
                            value={editForm.contactName || lead.contactName || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, contactName: e.target.value }))}
                            className="mt-1"
                            placeholder="Contact name"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Phone</Label>
                          <Input
                            value={editForm.phone || lead.phone || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="mt-1"
                            placeholder="Phone number"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Email</Label>
                          <Input
                            type="email"
                            value={editForm.email || lead.email || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                            className="mt-1"
                            placeholder="Email address"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Location</Label>
                          <Input
                            value={editForm.address || lead.address || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                            className="mt-1"
                            placeholder="Address"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-6">
                        <div className="flex items-center space-x-3">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Primary Contact</Label>
                            <p className="text-gray-900">{lead.contactName || 'Not provided'}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Phone</Label>
                            <p className="text-gray-900">{lead.phone || 'Not provided'}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Email</Label>
                            <p className="text-gray-900">{lead.email || 'Not provided'}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Location</Label>
                            <p className="text-gray-900">{lead.address || 'Not provided'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Lead Timeline */}
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle>Lead Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="text-center">
                        <Calendar className="h-5 w-5 text-gray-400 mx-auto mb-2" />
                        <Label className="text-sm font-medium text-gray-500">Created</Label>
                        <p className="text-gray-900 text-sm">
                          {lead.createdAt ? formatDate(lead.createdAt) : 'Unknown'}
                        </p>
                      </div>
                      <div className="text-center">
                        <Clock className="h-5 w-5 text-gray-400 mx-auto mb-2" />
                        <Label className="text-sm font-medium text-gray-500">Last Contact</Label>
                        <p className="text-gray-900 text-sm">
                          {lead.lastContactDate ? formatDate(lead.lastContactDate) : 'Never'}
                        </p>
                      </div>
                      <div className="text-center">
                        <Target className="h-5 w-5 text-gray-400 mx-auto mb-2" />
                        <Label className="text-sm font-medium text-gray-500">Next Follow-up</Label>
                        <p className="text-gray-900 text-sm">
                          {lead.nextFollowUpDate ? formatDate(lead.nextFollowUpDate) : 'Not scheduled'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="related" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Related List Quick Links</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      {[
                        { type: 'notes', count: 0, color: 'text-pink-600' },
                        { type: 'contacts', count: contacts.length, color: 'text-blue-600' },
                        { type: 'deals', count: 0, color: 'text-green-600' },
                        { type: 'equipment', count: 0, color: 'text-gray-600' },
                        { type: 'agreements', count: 0, color: 'text-green-600' },
                        { type: 'service_requests', count: 0, color: 'text-yellow-600' },
                        { type: 'credit_applications', count: 0, color: 'text-blue-600' },
                        { type: 'tco_mps', count: 0, color: 'text-orange-600' },
                        { type: 'files', count: 0, color: 'text-gray-600' },
                        { type: 'business_history', count: 0, color: 'text-blue-600' },
                        { type: 'site_surveys', count: 0, color: 'text-blue-600' }
                      ].map((item) => (
                        <div key={item.type} className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                          <div className={`text-sm font-medium ${item.color}`}>
                            {item.type.replace('_', ' ').toUpperCase()} ({item.count})
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Activity Timeline</CardTitle>
                      <div className="text-sm text-gray-500">
                        {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {activities.length === 0 ? (
                        <div className="text-center py-8">
                          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No activities yet</h3>
                          <p className="text-gray-500 mb-4">
                            Start tracking interactions with this lead by logging calls, emails, meetings, and notes.
                          </p>
                          <p className="text-sm text-gray-400">
                            Use the activity buttons above to log your first interaction.
                          </p>
                        </div>
                      ) : (
                        <div className="relative">
                          {/* Timeline line */}
                          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                          
                          {activities
                            .sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
                            .map((activity: any, index: number) => {
                              const activityDate = new Date(activity.createdAt || activity.date);
                              const isToday = activityDate.toDateString() === new Date().toDateString();
                              const isRecent = (new Date().getTime() - activityDate.getTime()) < 24 * 60 * 60 * 1000;
                              
                              return (
                                <div key={activity.id} className="relative flex items-start space-x-4 pb-6">
                                  {/* Timeline dot */}
                                  <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-4 border-white shadow-sm ${
                                    activity.activityType === 'call' ? 'bg-blue-500' :
                                    activity.activityType === 'email' ? 'bg-green-500' :
                                    activity.activityType === 'meeting' ? 'bg-purple-500' :
                                    activity.activityType === 'note' ? 'bg-yellow-500' :
                                    'bg-gray-500'
                                  }`}>
                                    <div className="text-white">
                                      {getActivityIcon(activity.activityType)}
                                    </div>
                                  </div>
                                  
                                  {/* Activity content */}
                                  <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <p className="text-sm font-medium text-gray-900 capitalize">
                                          {activity.activityType} Activity
                                        </p>
                                        {isRecent && (
                                          <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                            {isToday ? 'Today' : 'Recent'}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs text-gray-500">
                                          {formatDate(activity.createdAt || activity.date)}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                          {activityDate.toLocaleTimeString('en-US', { 
                                            hour: '2-digit', 
                                            minute: '2-digit',
                                            hour12: true 
                                          })}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <div className="mt-2">
                                      <p className="text-sm text-gray-900 font-medium">
                                        {activity.subject || `${activity.activityType.charAt(0).toUpperCase() + activity.activityType.slice(1)} logged`}
                                      </p>
                                      {activity.notes && (
                                        <p className="text-sm text-gray-600 mt-1">{activity.notes}</p>
                                      )}
                                    </div>
                                    
                                    {/* Contact association */}
                                    {activity.contactId && contacts.find((c: any) => c.id === activity.contactId) && (
                                      <div className="mt-3 pt-3 border-t border-gray-100">
                                        <div className="flex items-center space-x-2">
                                          <User className="h-3 w-3 text-gray-400" />
                                          <span className="text-xs text-gray-500">
                                            Contact: {(() => {
                                              const contact = contacts.find((c: any) => c.id === activity.contactId);
                                              return contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown Contact';
                                            })()}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Activity metadata */}
                                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                                      <span>By {activity.createdBy || 'System'}</span>
                                      {activity.activityType === 'meeting' && activity.scheduledDate && (
                                        <span>Scheduled: {formatDate(activity.scheduledDate)}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Lead Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Lead Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sales Rep</Label>
                  <p className="text-sm text-gray-900 mt-1">Not assigned</p>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Source</Label>
                  <p className="text-sm text-gray-900 mt-1">{lead.leadSource || 'Unknown'}</p>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Estimated Value</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {lead.estimatedAmount ? `$${Number(lead.estimatedAmount).toLocaleString()}` : 'Not specified'}
                  </p>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Expected Close Date</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {lead.closeDate ? formatDate(lead.closeDate) : 'Not set'}
                  </p>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Next Follow-up</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {lead.nextFollowUpDate ? formatDate(lead.nextFollowUpDate) : 'Not scheduled'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Log Call
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Meeting
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Add Note
                </Button>
              </CardContent>
            </Card>

            {/* Company Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Company Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Primary Industry</Label>
                  <p className="text-gray-900 mt-1">Not specified</p>
                </div>
                <div className="text-sm">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Company Size</Label>
                  <p className="text-gray-900 mt-1">Not specified</p>
                </div>
                <div className="text-sm">
                  <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Annual Revenue</Label>
                  <p className="text-gray-900 mt-1">Not specified</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}