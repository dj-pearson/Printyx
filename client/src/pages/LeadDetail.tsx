import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
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
  CheckCircle2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function LeadDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  // Fetch lead details
  const { data: lead, isLoading } = useQuery({
    queryKey: ['/api/leads', id],
    enabled: !!id,
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
      return await apiRequest(`/api/leads/${id}/convert`, 'POST');
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Lead successfully converted to customer!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      setLocation('/crm');
    },
  });

  // Add activity mutation
  const addActivityMutation = useMutation({
    mutationFn: async (activity: any) => {
      return await apiRequest(`/api/leads/${id}/activities`, 'POST', activity);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads', id, 'activities'] });
      toast({
        title: "Success",
        description: "Activity added successfully!",
      });
    },
  });

  const getStatusColor = (status: string) => {
    const colors = {
      'new': 'bg-blue-100 text-blue-800',
      'contacted': 'bg-yellow-100 text-yellow-800',
      'qualified': 'bg-green-100 text-green-800',
      'proposal': 'bg-purple-100 text-purple-800',
      'negotiation': 'bg-orange-100 text-orange-800',
      'closed_won': 'bg-green-100 text-green-800',
      'closed_lost': 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'call': return <PhoneCall className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      case 'note': return <FileText className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/crm')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to CRM
          </Button>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Lead not found</h2>
        <Button onClick={() => setLocation('/crm')} className="mt-4">
          Back to CRM
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/crm')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to CRM
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lead.company_name}</h1>
            <p className="text-gray-600">{lead.contact_name}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={getStatusColor(lead.status)}>
            {lead.status.replace('_', ' ').toUpperCase()}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          {lead.status !== 'closed_won' && (
            <Button 
              size="sm"
              onClick={() => convertMutation.mutate()}
              disabled={convertMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Convert to Customer
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="details" className="space-y-6">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="related">Related ({relatedRecords.length})</TabsTrigger>
              <TabsTrigger value="chatter">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
              {/* Company Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="h-5 w-5 mr-2" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Company Name</label>
                      <p className="text-gray-900">{lead.company_name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Source</label>
                      <p className="text-gray-900">{lead.source || 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <Badge className={getStatusColor(lead.status)}>
                        {lead.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Estimated Value</label>
                      <p className="text-gray-900">
                        {lead.estimated_value ? `$${Number(lead.estimated_value).toLocaleString()}` : 'Not specified'}
                      </p>
                    </div>
                  </div>
                  
                  {lead.notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Notes</label>
                      <p className="text-gray-900">{lead.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    Primary Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="font-medium">{lead.contact_name}</p>
                        <p className="text-sm text-gray-600">Primary Contact</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <p>{lead.phone || 'Not provided'}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <p>{lead.email || 'Not provided'}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <p>{lead.address || 'Not provided'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lead Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Lead Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Created</p>
                        <p className="font-medium">
                          {lead.created_at ? formatDate(lead.created_at) : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Last Contact</p>
                        <p className="font-medium">
                          {lead.last_contact_date ? formatDate(lead.last_contact_date) : 'Never'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Next Follow-up</p>
                        <p className="font-medium">
                          {lead.next_follow_up_date ? formatDate(lead.next_follow_up_date) : 'Not scheduled'}
                        </p>
                      </div>
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
                      <div key={item.type} className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <div className={`text-sm font-medium ${item.color}`}>
                          {item.type.replace('_', ' ').toUpperCase()} ({item.count})
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chatter" className="space-y-4">
              {/* Activity Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activities.length > 0 ? (
                    <div className="space-y-4">
                      {activities.map((activity: any) => (
                        <div key={activity.id} className="flex space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {getActivityIcon(activity.activityType)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900">
                                {activity.subject}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDate(activity.createdAt)}
                              </p>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {activity.description}
                            </p>
                            {activity.outcome && (
                              <Badge variant="outline" className="mt-2 text-xs">
                                {activity.outcome}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                      <p>No activities to show.</p>
                      <p className="text-sm">Get started by sending an email, scheduling a task, and more.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Lead Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">LEAD SUMMARY</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Sales Rep</p>
                <p className="font-medium">{lead.assigned_sales_rep_id || 'Not assigned'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Source</p>
                <p className="font-medium">{lead.source || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estimated Value</p>
                <p className="font-medium">
                  {lead.estimated_value ? `$${Number(lead.estimated_value).toLocaleString()}` : 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Expected Close Date</p>
                <p className="font-medium">
                  {lead.estimated_close_date ? formatDate(lead.estimated_close_date) : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Next Follow-up</p>
                <p className="font-medium">
                  {lead.next_follow_up_date ? formatDate(lead.next_follow_up_date) : 'Not scheduled'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">QUICK ACTIONS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <PhoneCall className="h-4 w-4 mr-2" />
                Log Call
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Meeting
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </CardContent>
          </Card>

          {/* Additional Contacts */}
          {contacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500">
                  ADDITIONAL CONTACTS ({contacts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contacts.map((contact: any) => (
                  <div key={contact.id} className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {contact.firstName?.[0]}{contact.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {contact.firstName} {contact.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{contact.title}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}