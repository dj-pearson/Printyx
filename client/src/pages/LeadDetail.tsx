import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar,
  User,
  DollarSign,
  FileText,
  Target,
  ArrowLeft,
  Edit,
  Plus,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  Settings,
  Contact,
  Activity,
  Users,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { findBySlug } from "@shared/utils";

interface Lead {
  id: string;
  tenantId: string;
  companyId: string;
  contactId: string;
  companyName: string;
  contactName: string;
  email?: string;
  phone?: string;
  leadSource: string;
  leadStatus: string;
  estimatedAmount?: number;
  estimatedCloseDate?: string;
  notes?: string;
  leadScore?: number;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface Contact {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  title?: string;
  department?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  isPrimaryContact: boolean;
  leadStatus: string;
  createdAt: string;
}

interface LeadActivity {
  id: string;
  leadId: string;
  activityType: string;
  subject: string;
  description?: string;
  outcome?: string;
  scheduledDate?: string;
  completedDate?: string;
  createdAt: string;
}

export default function LeadDetail() {
  const { slug } = useParams();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  // Get all leads and find by slug
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['/api/leads'],
  });

  const lead = leads.find((l: any) => {
    const name = l.companyName || 'untitled-lead';
    return name.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim().replace(/^-+|-+$/g, '') === slug;
  });

  const isLoading = leadsLoading;
  const leadId = lead?.id;

  // Fetch related data
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: [`/api/leads/${leadId}/contacts`],
    enabled: !!leadId,
  });

  const { data: activities = [] } = useQuery<LeadActivity[]>({
    queryKey: [`/api/leads/${leadId}/activities`],
    enabled: !!leadId,
  });

  const { data: relatedRecords = [] } = useQuery({
    queryKey: [`/api/leads/${leadId}/related-records`],
    enabled: !!leadId,
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!lead) {
    return (
      <MainLayout>
        <div className="container mx-auto px-6 py-8">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Lead Not Found</h3>
                <p className="text-gray-600 mb-4">The lead you're looking for doesn't exist or you don't have access to it.</p>
                <Button variant="outline" onClick={() => navigate("/crm")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to CRM
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'qualified': return 'text-green-600 bg-green-50 border-green-200';
      case 'proposal': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'negotiation': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'closed_won': return 'text-green-600 bg-green-100 border-green-300';
      case 'closed_lost': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/crm")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to CRM
            </Button>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                {lead.companyName}
                <Badge className={`${getStatusColor(lead.leadStatus)} border`}>
                  {lead.leadStatus?.replace('_', ' ') || 'new'}
                </Badge>
              </h1>
              <p className="text-gray-600">Lead #{lead.id}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Edit Lead
            </Button>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Log Activity
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Estimated Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${lead.estimatedAmount?.toLocaleString() || '0'}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Lead Source</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {lead.leadSource}
                  </p>
                </div>
                <Target className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Lead Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {lead.leadScore || 'N/A'}
                  </p>
                </div>
                <Star className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Expected Close</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {lead.estimatedCloseDate ? new Date(lead.estimatedCloseDate).toLocaleDateString() : 'TBD'}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
            <TabsTrigger value="activities">Activities ({activities.length})</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lead Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Contact className="w-5 h-5" />
                    Lead Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Primary Contact</label>
                    <p className="text-gray-900">{lead.contactName}</p>
                  </div>
                  
                  {lead.email && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Email</label>
                      <p className="text-gray-900 flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {lead.email}
                      </p>
                    </div>
                  )}
                  
                  {lead.phone && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Phone</label>
                      <p className="text-gray-900 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {lead.phone}
                      </p>
                    </div>
                  )}

                  {lead.notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Notes</label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{lead.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div>
                        <p className="font-medium">Lead Created</p>
                        <p className="text-sm text-gray-600">
                          {format(new Date(lead.createdAt), 'MMM dd, yyyy at h:mm a')}
                        </p>
                      </div>
                    </div>
                    
                    {lead.lastContactDate && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="font-medium">Last Contact</p>
                          <p className="text-sm text-gray-600">
                            {format(new Date(lead.lastContactDate), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {lead.nextFollowUpDate && (
                      <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <div>
                          <p className="font-medium">Next Follow-up</p>
                          <p className="text-sm text-gray-600">
                            {format(new Date(lead.nextFollowUpDate), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Contacts</CardTitle>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contact
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {contacts.length > 0 ? (
                  <div className="space-y-4">
                    {contacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium">{contact.firstName} {contact.lastName}</p>
                            <p className="text-sm text-gray-600">{contact.title || 'Contact'}</p>
                            {contact.email && (
                              <p className="text-sm text-gray-600">{contact.email}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant={contact.isPrimaryContact ? "default" : "secondary"}>
                          {contact.isPrimaryContact ? "Primary" : "Secondary"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No contacts yet</h3>
                    <p className="text-gray-600 mb-4">Add contacts to track communication with this lead.</p>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Contact
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activities" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Activities</CardTitle>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Log Activity
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {activities.length > 0 ? (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3 p-4 border rounded-lg">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Activity className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium">{activity.subject}</p>
                            <Badge variant="outline">{activity.activityType}</Badge>
                          </div>
                          {activity.description && (
                            <p className="text-gray-600 mb-2">{activity.description}</p>
                          )}
                          <p className="text-sm text-gray-500">
                            {format(new Date(activity.createdAt), 'MMM dd, yyyy at h:mm a')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No activities logged</h3>
                    <p className="text-gray-600 mb-4">Start tracking interactions with this lead.</p>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Log First Activity
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Documents</CardTitle>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents yet</h3>
                  <p className="text-gray-600 mb-4">Upload contracts, proposals, and other documents related to this lead.</p>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Upload First Document
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}