import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Building2,
  Users,
  Mail,
  Phone,
  MapPin,
  Globe,
  Calendar,
  DollarSign,
  TrendingUp,
  Target,
  Activity,
  Briefcase,
  Edit,
  Save,
  X,
  Plus,
  Heart,
  AlertTriangle,
  CheckCircle2,
  User,
  FileText,
  BarChart3,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Clock
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import MainLayout from "@/components/layout/main-layout";

interface BusinessRecord {
  id: string;
  recordType: 'prospect' | 'tenant';
  status: string;
  companyName: string;
  primaryContactEmail?: string;
  primaryContactName?: string;
  phone?: string;
  website?: string;
  industry?: string;
  employeeCount?: number;
  estimatedRevenue?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  leadScore?: number;
  leadGrade?: string;
  leadTier?: string;
  leadSource?: string;
  assignedRep?: string;
  currentMRR?: string;
  tenantId?: string;
  customerSince?: string;
  churnRisk?: string;
  createdAt: string;
  lastActivityDate?: string;
  notes?: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  role?: string;
  isDecisionMaker: boolean;
  isPrimary: boolean;
}

interface Deal {
  id: string;
  dealName: string;
  dealValue: string;
  stage: string;
  probability: number;
  expectedCloseDate?: string;
  createdAt: string;
}

interface ActivityItem {
  id: string;
  activityType: string;
  subject: string;
  description?: string;
  activityDate: string;
  createdBy: string;
}

export default function PlatformBusinessRecordDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<BusinessRecord>>({});

  // Fetch business record
  const { data: record, isLoading } = useQuery<BusinessRecord>({
    queryKey: [`/api/platform-crm/business-records/${id}`],
    enabled: !!id,
  });

  // Fetch contacts
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: [`/api/platform-crm/business-records/${id}/contacts`],
    enabled: !!id,
  });

  // Fetch deals
  const { data: deals } = useQuery<Deal[]>({
    queryKey: [`/api/platform-deals`, { businessRecordId: id }],
    enabled: !!id,
  });

  // Fetch activities
  const { data: activities } = useQuery<ActivityItem[]>({
    queryKey: [`/api/platform-activities`, { businessRecordId: id, limit: 50 }],
    enabled: !!id,
  });

  // Fetch health score (if tenant)
  const { data: healthScore } = useQuery({
    queryKey: [`/api/platform-cs/health-scores`, { businessRecordId: id }],
    enabled: !!id && record?.recordType === 'tenant',
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<BusinessRecord>) => {
      const response = await fetch(`/api/platform-crm/business-records/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update record');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platform-crm/business-records/${id}`] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Business record updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update business record",
        variant: "destructive",
      });
    },
  });

  // Convert to tenant mutation
  const convertToTenantMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/platform-crm/business-records/${id}/convert-to-tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'new-tenant-id' }), // Would be generated
      });
      if (!response.ok) throw new Error('Failed to convert');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platform-crm/business-records/${id}`] });
      toast({
        title: "Success",
        description: "Prospect converted to tenant successfully!",
      });
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading business record...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!record) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
            <h2 className="text-2xl font-bold mb-2">Record Not Found</h2>
            <p className="text-muted-foreground mb-4">The business record you're looking for doesn't exist.</p>
            <Button onClick={() => setLocation('/platform-crm/business-records')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Records
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      new: { variant: "secondary", label: "New" },
      contacted: { variant: "outline", label: "Contacted" },
      qualified: { variant: "default", label: "Qualified" },
      trial_active: { variant: "default", label: "Trial Active" },
      active_customer: { variant: "default", label: "Active" },
      churned: { variant: "destructive", label: "Churned" },
      lost: { variant: "destructive", label: "Lost" },
    };
    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getLeadTierBadge = (tier?: string) => {
    if (!tier) return null;
    const colors: Record<string, string> = {
      hot: "bg-red-100 text-red-800 border-red-300",
      warm: "bg-orange-100 text-orange-800 border-orange-300",
      cold: "bg-blue-100 text-blue-800 border-blue-300",
    };
    return (
      <Badge className={colors[tier] || "bg-gray-100 text-gray-800"} variant="outline">
        {tier.toUpperCase()}
      </Badge>
    );
  };

  const getHealthBadge = (risk?: string) => {
    if (!risk) return null;
    const variants: Record<string, { icon: any; color: string; label: string }> = {
      low: { icon: CheckCircle2, color: "text-green-600", label: "Healthy" },
      medium: { icon: AlertTriangle, color: "text-yellow-600", label: "At Risk" },
      high: { icon: AlertTriangle, color: "text-red-600", label: "Critical" },
    };
    const config = variants[risk] || { icon: Heart, color: "text-gray-600", label: risk };
    const Icon = config.icon;
    return (
      <div className={`flex items-center gap-2 ${config.color}`}>
        <Icon className="w-4 h-4" />
        <span className="font-semibold">{config.label}</span>
      </div>
    );
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({});
  };

  const formatCurrency = (value?: string) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/platform-crm/business-records')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <Building2 className="w-8 h-8 text-primary" />
                <div>
                  <h1 className="text-3xl font-bold">{record.companyName}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={record.recordType === 'tenant' ? 'default' : 'secondary'}>
                      {record.recordType}
                    </Badge>
                    {getStatusBadge(record.status)}
                    {getLeadTierBadge(record.leadTier)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                {record.recordType === 'prospect' && (
                  <Button onClick={() => convertToTenantMutation.mutate()}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Convert to Tenant
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lead Score</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{record.leadScore || 0}</div>
              <p className="text-xs text-muted-foreground">Grade: {record.leadGrade || 'N/A'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MRR</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(record.currentMRR)}</div>
              <p className="text-xs text-muted-foreground">Monthly recurring</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deals</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{deals?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Active opportunities</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activities</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activities?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Total logged</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({contacts?.length || 0})</TabsTrigger>
            <TabsTrigger value="deals">Deals ({deals?.length || 0})</TabsTrigger>
            <TabsTrigger value="activities">Activities ({activities?.length || 0})</TabsTrigger>
            {record.recordType === 'tenant' && (
              <TabsTrigger value="health">Health</TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Company Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <>
                      <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input
                          value={formData.companyName ?? record.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Industry</Label>
                        <Input
                          value={formData.industry ?? record.industry}
                          onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Website</Label>
                        <Input
                          value={formData.website ?? record.website}
                          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Industry:</span>
                        <span className="font-semibold">{record.industry || 'Not specified'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Website:</span>
                        {record.website ? (
                          <a href={record.website} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline flex items-center gap-1">
                            {record.website}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="font-semibold">Not specified</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Employees:</span>
                        <span className="font-semibold">{record.employeeCount?.toLocaleString() || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Est. Revenue:</span>
                        <span className="font-semibold">{formatCurrency(record.estimatedRevenue)}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Primary Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <>
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={formData.primaryContactName ?? record.primaryContactName}
                          onChange={(e) => setFormData({ ...formData, primaryContactName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={formData.primaryContactEmail ?? record.primaryContactEmail}
                          onChange={(e) => setFormData({ ...formData, primaryContactEmail: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={formData.phone ?? record.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-semibold">{record.primaryContactName || 'Not specified'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Email:</span>
                        {record.primaryContactEmail ? (
                          <a href={`mailto:${record.primaryContactEmail}`} className="font-semibold text-primary hover:underline">
                            {record.primaryContactEmail}
                          </a>
                        ) : (
                          <span className="font-semibold">Not specified</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Phone:</span>
                        {record.phone ? (
                          <a href={`tel:${record.phone}`} className="font-semibold text-primary hover:underline">
                            {record.phone}
                          </a>
                        ) : (
                          <span className="font-semibold">Not specified</span>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Lead Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Lead Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Source:</span>
                    <span className="font-semibold">{record.leadSource || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Assigned Rep:</span>
                    <span className="font-semibold">{record.assignedRep || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-semibold">{format(new Date(record.createdAt), 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Last Activity:</span>
                    <span className="font-semibold">
                      {record.lastActivityDate
                        ? formatDistanceToNow(new Date(record.lastActivityDate), { addSuffix: true })
                        : 'Never'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Tenant Information (if applicable) */}
              {record.recordType === 'tenant' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      Tenant Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Customer Since:</span>
                      <span className="font-semibold">
                        {record.customerSince
                          ? format(new Date(record.customerSince), 'MMM d, yyyy')
                          : 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">MRR:</span>
                      <span className="font-semibold">{formatCurrency(record.currentMRR)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Churn Risk:</span>
                      {getHealthBadge(record.churnRisk)}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea
                    value={formData.notes ?? record.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    placeholder="Add notes about this business record..."
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {record.notes || 'No notes added yet.'}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-4">
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
                {contacts && contacts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">
                            {contact.firstName} {contact.lastName}
                            {contact.isPrimary && (
                              <Badge variant="outline" className="ml-2">Primary</Badge>
                            )}
                          </TableCell>
                          <TableCell>{contact.email}</TableCell>
                          <TableCell>{contact.phone || '-'}</TableCell>
                          <TableCell>{contact.title || '-'}</TableCell>
                          <TableCell>{contact.role || '-'}</TableCell>
                          <TableCell>
                            {contact.isDecisionMaker && (
                              <Badge variant="default">Decision Maker</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No contacts added yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deals Tab */}
          <TabsContent value="deals" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Active Deals</CardTitle>
                  <Button size="sm" onClick={() => setLocation(`/platform-crm/deals/new?businessRecordId=${id}`)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Deal
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {deals && deals.length > 0 ? (
                  <div className="space-y-3">
                    {deals.map((deal) => (
                      <Card
                        key={deal.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setLocation(`/platform-crm/deals/${deal.id}`)}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold">{deal.dealName}</h4>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge>{deal.stage.replace(/_/g, ' ')}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {deal.probability}% likely
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-primary">
                                {formatCurrency(deal.dealValue)}
                              </div>
                              {deal.expectedCloseDate && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Close: {format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No deals created yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Activity Timeline</CardTitle>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Log Activity
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {activities && activities.length > 0 ? (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex gap-4 pb-4 border-b last:border-0">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{activity.activityType}</Badge>
                                <span className="font-semibold text-sm">{activity.subject}</span>
                              </div>
                              {activity.description && (
                                <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatDistanceToNow(new Date(activity.activityDate), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            by {activity.createdBy}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No activities logged yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Health Tab (Tenants only) */}
          {record.recordType === 'tenant' && (
            <TabsContent value="health" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="w-5 h-5" />
                    Customer Health Score
                  </CardTitle>
                  <CardDescription>Monitor customer health and engagement</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="mb-4">Health score calculation coming soon</p>
                    <Button variant="outline">Calculate Health Score</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
