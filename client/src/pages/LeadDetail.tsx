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
            <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
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
                    
                    {lead.notes && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Notes</Label>
                        <p className="text-gray-900 mt-1 bg-gray-50 p-3 rounded-md">{lead.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Primary Contact */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center">
                      <User className="h-5 w-5 mr-2 text-gray-600" />
                      <CardTitle>Primary Contact</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
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
                      <Button size="sm" variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Log Activity
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {activities.length > 0 ? (
                      <div className="space-y-4">
                        {activities.map((activity: any) => (
                          <div key={activity.id} className="flex space-x-3 p-3 border rounded-lg">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-blue-100">
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
                      <div className="text-center py-8">
                        <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No activities yet</h3>
                        <p className="text-gray-600 mb-4">Start tracking interactions with this lead.</p>
                        <Button size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Log First Activity
                        </Button>
                      </div>
                    )}
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