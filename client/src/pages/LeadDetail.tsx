import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ActivityForm } from "@/components/forms/ActivityForms";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { ContactManager } from "@/components/ContactManager";
import { LeadProposals } from "@/components/leads/LeadProposals";
import { LeadQuotes } from "@/components/leads/LeadQuotes";
import { LeadDeals } from "@/components/leads/LeadDeals";
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
  UserPlus,
  StickyNote,
  MoreHorizontal,
  Eye,
  TrendingUp,
  Award,
  Star,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronRight,
  Settings,
  Briefcase,
  CreditCard,
  Truck,
  Calculator,
  Shield,
  Zap,
  BarChart3,
  FileCheck,
  Clock3,
  MapPin2,
  CheckSquare,
  BookOpen,
  Quote,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";

// Lead Contact Form Component
function LeadContactForm({ 
  leadId, 
  onSuccess, 
  onCancel 
}: {
  leadId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    title: "",
    email: "",
    phone: "",
    isPrimaryContact: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log("Creating lead contact:", { leadId, formData });
      
      const response = await apiRequest(`/api/leads/${leadId}/contacts`, {
        method: 'POST',
        data: formData,
      });

      console.log("Lead contact created successfully:", response);
      onSuccess();
    } catch (error) {
      console.error("Error creating lead contact:", error);
      toast({
        title: "Error",
        description: "Failed to create contact. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="isPrimaryContact"
          checked={formData.isPrimaryContact}
          onCheckedChange={(checked) => 
            setFormData({ ...formData, isPrimaryContact: !!checked })
          }
        />
        <Label htmlFor="isPrimaryContact">Set as primary contact</Label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Contact"}
        </Button>
      </div>
    </form>
  );
}

export default function LeadDetailHubspot() {
  const { slug } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Extract ID from URL query parameters
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get('id');
  const [isEditing, setIsEditing] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    company: true,
    contact: true,
    address: true,
    pipeline: true,
    external: false,
    financial: false,
    preferences: false,
  });

  // Dialog states
  const [dialogs, setDialogs] = useState({
    note: false,
    email: false,
    call: false,
    meeting: false,
    task: false,
    editRecord: false,
  });

  // Fetch lead details
  const { data: lead, isLoading } = useQuery({
    queryKey: ["/api/business-records", id],
    enabled: !!id,
  });

  // Form state for editing
  const [editForm, setEditForm] = useState({
    // Basic Information
    companyName: "",
    accountNumber: "",
    accountType: "Prospect",
    website: "",
    industry: "",
    companySize: "",
    employeeCount: null,
    annualRevenue: null,

    // Contact Information
    primaryContactName: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
    primaryContactTitle: "",

    // Billing Contact
    billingContactName: "",
    billingContactEmail: "",
    billingContactPhone: "",

    // Address Information
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",

    // Billing Address
    billingAddressLine1: "",
    billingAddressLine2: "",
    billingCity: "",
    billingState: "",
    billingPostalCode: "",
    billingCountry: "US",

    // Shipping Address
    shippingAddressLine1: "",
    shippingAddressLine2: "",
    shippingCity: "",
    shippingState: "",
    shippingPostalCode: "",
    shippingCountry: "US",

    // Communication
    phone: "",
    fax: "",
    preferredContactMethod: "email",

    // Pipeline Information
    leadSource: "website",
    estimatedAmount: null,
    probability: 50,
    closeDate: "",
    salesStage: "new",
    interestLevel: "warm",

    // Assignment & Ownership
    ownerId: "",
    assignedSalesRep: "",
    territory: "",
    accountManagerId: "",
    leadScore: 0,
    priority: "medium",

    // Salesforce-specific Fields
    customerRating: "Warm",
    parentAccountId: "",
    customerPriority: "Medium",
    slaLevel: "Standard",
    upsellOpportunity: "",
    accountNotes: "",

    // External System Integration
    externalCustomerId: "",
    externalSystemId: "",
    externalSalesforceId: "",
    externalLeadId: "",
    migrationStatus: "",

    // Financial Information
    creditLimit: null,
    paymentTerms: "Net 30",
    billingTerms: "",
    taxExempt: false,
    taxId: "",
    customerTier: "",

    // System Tracking
    notes: "",
  });

  // Initialize form when lead data loads
  useEffect(() => {
    if (lead) {
      setEditForm(lead);
    }
  }, [lead]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/business-records/${id}`, "PUT", data);
    },
    onSuccess: () => {
      toast({
        title: "Record Updated",
        description: "Lead information has been successfully updated.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/business-records", id],
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update lead information.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(editForm);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (isLoading) {
    return (
      <MainLayout
        title="Lead Details"
        description="Loading lead information..."
      >
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Lead not found
          </h3>
          <p className="text-gray-600 mb-4">
            The lead you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => setLocation("/leads-management")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leads
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        {/* Mobile-Optimized Header */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border mb-6">
          {/* Top Row: Back Button and Edit Button */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/leads-management")}
              className="px-2 sm:px-3"
            >
              <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Back to Leads</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="px-2 sm:px-3"
            >
              <Edit className="h-4 w-4 mr-1 sm:mr-2" />
              {isEditing ? "Cancel" : "Edit"}
            </Button>
          </div>

          {/* Quick Action CTAs */}
          <div className="mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  // Switch to deals tab first
                  const dealsTab = document.querySelector('[data-state="inactive"][value="deals"]') as HTMLElement;
                  if (dealsTab) {
                    dealsTab.click();
                    // Small delay to ensure tab is active before triggering action
                    setTimeout(() => {
                      const event = new CustomEvent('leadTabAction', { detail: { action: 'createDeal' } });
                      window.dispatchEvent(event);
                    }, 100);
                  }
                }}
                className="text-xs"
              >
                <Briefcase className="h-3 w-3 mr-1" />
                Create Deal
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setDialogs(prev => ({ ...prev, editRecord: true }))}
                className="text-xs"
              >
                <UserPlus className="h-3 w-3 mr-1" />
                Add Contacts
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setDialogs(prev => ({ ...prev, note: true }))}
                className="text-xs"
              >
                <StickyNote className="h-3 w-3 mr-1" />
                Log Activity
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setLocation('/demo-scheduling?leadId=' + id + '&companyName=' + encodeURIComponent(lead.companyName || ''))}
                className="text-xs"
              >
                <Calendar className="h-3 w-3 mr-1" />
                Schedule Demo
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  // Route through deals - switch to deals tab and trigger quote creation
                  const dealsTab = document.querySelector('[data-state="inactive"][value="deals"]') as HTMLElement;
                  if (dealsTab) {
                    dealsTab.click();
                    setTimeout(() => {
                      const event = new CustomEvent('leadTabAction', { 
                        detail: { 
                          action: 'createQuote', 
                          leadId: id, 
                          companyName: lead.companyName || '' 
                        } 
                      });
                      window.dispatchEvent(event);
                    }, 100);
                  }
                }}
                className="text-xs"
              >
                <Quote className="h-3 w-3 mr-1" />
                Create Quote
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  // Route through deals - switch to deals tab and trigger proposal creation
                  const dealsTab = document.querySelector('[data-state="inactive"][value="deals"]') as HTMLElement;
                  if (dealsTab) {
                    dealsTab.click();
                    setTimeout(() => {
                      const event = new CustomEvent('leadTabAction', { 
                        detail: { 
                          action: 'createProposal', 
                          leadId: id, 
                          companyName: lead.companyName || '' 
                        } 
                      });
                      window.dispatchEvent(event);
                    }, 100);
                  }
                }}
                className="text-xs"
              >
                <FileText className="h-3 w-3 mr-1" />
                Build Proposal
              </Button>
            </div>
          </div>

          {/* Company Info */}
          <div className="flex items-start space-x-3 mb-4">
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
              <AvatarFallback className="bg-blue-100 text-blue-600 text-base sm:text-lg font-semibold">
                {lead.companyName?.[0] || "L"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-semibold text-gray-900 truncate">
                {lead.companyName || "Unnamed Lead"}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600 mt-1">
                <Badge
                  variant={
                    lead.status === "qualified" ? "default" : "secondary"
                  }
                  className="text-xs"
                >
                  {lead.status || "New"}
                </Badge>
                <span className="hidden sm:inline">•</span>
                <span>Lead score: {lead.leadScore || 0}</span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">
                  Created{" "}
                  {lead.createdAt
                    ? format(new Date(lead.createdAt), "MMM d, yyyy")
                    : "Recently"}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons - Mobile Grid Layout */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogs((prev) => ({ ...prev, call: true }))}
              className="justify-center sm:justify-start"
            >
              <PhoneCall className="h-4 w-4 mr-1 sm:mr-2" />
              Call
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogs((prev) => ({ ...prev, email: true }))}
              className="justify-center sm:justify-start"
            >
              <Mail className="h-4 w-4 mr-1 sm:mr-2" />
              Email
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogs((prev) => ({ ...prev, meeting: true }))}
              className="justify-center sm:justify-start"
            >
              <Calendar className="h-4 w-4 mr-1 sm:mr-2" />
              Meeting
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogs((prev) => ({ ...prev, note: true }))}
              className="justify-center sm:justify-start"
            >
              <FileText className="h-4 w-4 mr-1 sm:mr-2" />
              Note
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogs((prev) => ({ ...prev, task: true }))}
              className="justify-center sm:justify-start"
            >
              <CheckSquare className="h-4 w-4 mr-1 sm:mr-2" />
              Task
            </Button>
            {isEditing && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="col-span-2 sm:col-span-1 justify-center sm:justify-start"
              >
                <Save className="h-4 w-4 mr-1 sm:mr-2" />
                Save Changes
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Left Column - Main Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Lead Management Tabs */}
            <Tabs defaultValue="overview" className="w-full" id="lead-tabs">
              <div className="border-b border-gray-200">
                <TabsList className="h-auto p-0 bg-transparent space-x-0">
                  <div className="flex flex-wrap gap-1 p-1">
                    <TabsTrigger
                      value="overview"
                      className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-300 border border-transparent rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Overview</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="activities"
                      className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-300 border border-transparent rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <Activity className="h-4 w-4" />
                      <span>Activities</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="contacts"
                      className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-300 border border-transparent rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <Users className="h-4 w-4" />
                      <span>Contacts</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="deals"
                      className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-300 border border-transparent rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <Target className="h-4 w-4" />
                      <span>Deals</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="proposals"
                      className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-300 border border-transparent rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <FileCheck className="h-4 w-4" />
                      <span>Proposals</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="quotes"
                      className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-300 border border-transparent rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <Quote className="h-4 w-4" />
                      <span>Quotes</span>
                    </TabsTrigger>
                  </div>
                </TabsList>
              </div>

              <TabsContent value="overview" className="space-y-6 mt-6">
                {/* Company Information */}
                <Card>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => toggleSection("company")}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center">
                        <Building2 className="h-5 w-5 mr-2" />
                        Company Information
                      </CardTitle>
                      {expandedSections.company ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>

                  {expandedSections.company && (
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label htmlFor="companyName">Company Name *</Label>
                          {isEditing ? (
                            <Input
                              id="companyName"
                              value={editForm.companyName}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  companyName: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.companyName || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="accountNumber">Account Number</Label>
                          {isEditing ? (
                            <Input
                              id="accountNumber"
                              value={editForm.accountNumber}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  accountNumber: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.accountNumber || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="accountType">Account Type</Label>
                          {isEditing ? (
                            <Select
                              value={editForm.accountType}
                              onValueChange={(value) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  accountType: value,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Prospect">
                                  Prospect
                                </SelectItem>
                                <SelectItem value="Customer">
                                  Customer
                                </SelectItem>
                                <SelectItem value="Partner">Partner</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.accountType || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="website">Website</Label>
                          {isEditing ? (
                            <Input
                              id="website"
                              type="url"
                              value={editForm.website}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  website: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.website ? (
                                <a
                                  href={lead.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline flex items-center"
                                >
                                  {lead.website}
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              ) : (
                                "--"
                              )}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="industry">Industry</Label>
                          {isEditing ? (
                            <Select
                              value={editForm.industry}
                              onValueChange={(value) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  industry: value,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select industry" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Healthcare">
                                  Healthcare
                                </SelectItem>
                                <SelectItem value="Education">
                                  Education
                                </SelectItem>
                                <SelectItem value="Manufacturing">
                                  Manufacturing
                                </SelectItem>
                                <SelectItem value="Financial Services">
                                  Financial Services
                                </SelectItem>
                                <SelectItem value="Government">
                                  Government
                                </SelectItem>
                                <SelectItem value="Legal">Legal</SelectItem>
                                <SelectItem value="Technology">
                                  Technology
                                </SelectItem>
                                <SelectItem value="Real Estate">
                                  Real Estate
                                </SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.industry || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="companySize">Company Size</Label>
                          {isEditing ? (
                            <Select
                              value={editForm.companySize}
                              onValueChange={(value) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  companySize: value,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select size" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1-10">
                                  1-10 employees
                                </SelectItem>
                                <SelectItem value="11-50">
                                  11-50 employees
                                </SelectItem>
                                <SelectItem value="51-200">
                                  51-200 employees
                                </SelectItem>
                                <SelectItem value="201-500">
                                  201-500 employees
                                </SelectItem>
                                <SelectItem value="501-1000">
                                  501-1000 employees
                                </SelectItem>
                                <SelectItem value="1000+">
                                  1000+ employees
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.companySize || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="employeeCount">Employee Count</Label>
                          {isEditing ? (
                            <Input
                              id="employeeCount"
                              type="number"
                              value={editForm.employeeCount || ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  employeeCount: e.target.value
                                    ? parseInt(e.target.value)
                                    : null,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.employeeCount || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="annualRevenue">Annual Revenue</Label>
                          {isEditing ? (
                            <Input
                              id="annualRevenue"
                              type="number"
                              value={editForm.annualRevenue || ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  annualRevenue: e.target.value
                                    ? parseFloat(e.target.value)
                                    : null,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.annualRevenue
                                ? `$${Number(
                                    lead.annualRevenue
                                  ).toLocaleString()}`
                                : "--"}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Contact Information */}
                <Card>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => toggleSection("contact")}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center">
                        <User className="h-5 w-5 mr-2" />
                        Primary Contact Information
                      </CardTitle>
                      {expandedSections.contact ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>

                  {expandedSections.contact && (
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="primaryContactName">
                            Contact Name
                          </Label>
                          {isEditing ? (
                            <Input
                              id="primaryContactName"
                              value={editForm.primaryContactName}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  primaryContactName: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.primaryContactName || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="primaryContactTitle">Title</Label>
                          {isEditing ? (
                            <Input
                              id="primaryContactTitle"
                              value={editForm.primaryContactTitle}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  primaryContactTitle: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.primaryContactTitle || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="primaryContactEmail">Email</Label>
                          {isEditing ? (
                            <Input
                              id="primaryContactEmail"
                              type="email"
                              value={editForm.primaryContactEmail}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  primaryContactEmail: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.primaryContactEmail ? (
                                <a
                                  href={`mailto:${lead.primaryContactEmail}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {lead.primaryContactEmail}
                                </a>
                              ) : (
                                "--"
                              )}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="primaryContactPhone">Phone</Label>
                          {isEditing ? (
                            <Input
                              id="primaryContactPhone"
                              type="tel"
                              value={editForm.primaryContactPhone}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  primaryContactPhone: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.primaryContactPhone ? (
                                <a
                                  href={`tel:${lead.primaryContactPhone}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {lead.primaryContactPhone}
                                </a>
                              ) : (
                                "--"
                              )}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="phone">Company Phone</Label>
                          {isEditing ? (
                            <Input
                              id="phone"
                              type="tel"
                              value={editForm.phone}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  phone: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.phone ? (
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {lead.phone}
                                </a>
                              ) : (
                                "--"
                              )}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="fax">Fax</Label>
                          {isEditing ? (
                            <Input
                              id="fax"
                              value={editForm.fax}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  fax: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.fax || "--"}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Billing Contact Section */}
                      <Separator />
                      <h4 className="text-sm font-medium text-gray-900">
                        Billing Contact
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="billingContactName">Name</Label>
                          {isEditing ? (
                            <Input
                              id="billingContactName"
                              value={editForm.billingContactName}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  billingContactName: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.billingContactName || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="billingContactEmail">Email</Label>
                          {isEditing ? (
                            <Input
                              id="billingContactEmail"
                              type="email"
                              value={editForm.billingContactEmail}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  billingContactEmail: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.billingContactEmail ? (
                                <a
                                  href={`mailto:${lead.billingContactEmail}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {lead.billingContactEmail}
                                </a>
                              ) : (
                                "--"
                              )}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="billingContactPhone">Phone</Label>
                          {isEditing ? (
                            <Input
                              id="billingContactPhone"
                              type="tel"
                              value={editForm.billingContactPhone}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  billingContactPhone: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.billingContactPhone ? (
                                <a
                                  href={`tel:${lead.billingContactPhone}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {lead.billingContactPhone}
                                </a>
                              ) : (
                                "--"
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Address Information */}
                <Card>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => toggleSection("address")}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center">
                        <MapPin className="h-5 w-5 mr-2" />
                        Address Information
                      </CardTitle>
                      {expandedSections.address ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>

                  {expandedSections.address && (
                    <CardContent className="space-y-6">
                      {/* Primary Address */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">
                          Primary Address
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <Label htmlFor="addressLine1">Address Line 1</Label>
                            {isEditing ? (
                              <Input
                                id="addressLine1"
                                value={editForm.addressLine1}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    addressLine1: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {lead.addressLine1 || "--"}
                              </p>
                            )}
                          </div>

                          <div className="md:col-span-2">
                            <Label htmlFor="addressLine2">Address Line 2</Label>
                            {isEditing ? (
                              <Input
                                id="addressLine2"
                                value={editForm.addressLine2}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    addressLine2: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {lead.addressLine2 || "--"}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="city">City</Label>
                            {isEditing ? (
                              <Input
                                id="city"
                                value={editForm.city}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    city: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {lead.city || "--"}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="state">State</Label>
                            {isEditing ? (
                              <Input
                                id="state"
                                value={editForm.state}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    state: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {lead.state || "--"}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="postalCode">Postal Code</Label>
                            {isEditing ? (
                              <Input
                                id="postalCode"
                                value={editForm.postalCode}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    postalCode: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {lead.postalCode || "--"}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="country">Country</Label>
                            {isEditing ? (
                              <Select
                                value={editForm.country}
                                onValueChange={(value) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    country: value,
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="US">
                                    United States
                                  </SelectItem>
                                  <SelectItem value="CA">Canada</SelectItem>
                                  <SelectItem value="MX">Mexico</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {lead.country || "US"}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Billing Address */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">
                          Billing Address
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <Label htmlFor="billingAddressLine1">
                              Billing Address Line 1
                            </Label>
                            {isEditing ? (
                              <Input
                                id="billingAddressLine1"
                                value={editForm.billingAddressLine1}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    billingAddressLine1: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {lead.billingAddressLine1 || "--"}
                              </p>
                            )}
                          </div>

                          <div className="md:col-span-2">
                            <Label htmlFor="billingAddressLine2">
                              Billing Address Line 2
                            </Label>
                            {isEditing ? (
                              <Input
                                id="billingAddressLine2"
                                value={editForm.billingAddressLine2}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    billingAddressLine2: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {lead.billingAddressLine2 || "--"}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="billingCity">City</Label>
                            {isEditing ? (
                              <Input
                                id="billingCity"
                                value={editForm.billingCity}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    billingCity: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {lead.billingCity || "--"}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="billingState">State</Label>
                            {isEditing ? (
                              <Input
                                id="billingState"
                                value={editForm.billingState}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    billingState: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {lead.billingState || "--"}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="billingPostalCode">
                              Postal Code
                            </Label>
                            {isEditing ? (
                              <Input
                                id="billingPostalCode"
                                value={editForm.billingPostalCode}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    billingPostalCode: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {lead.billingPostalCode || "--"}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="billingCountry">Country</Label>
                            {isEditing ? (
                              <Select
                                value={editForm.billingCountry}
                                onValueChange={(value) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    billingCountry: value,
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="US">
                                    United States
                                  </SelectItem>
                                  <SelectItem value="CA">Canada</SelectItem>
                                  <SelectItem value="MX">Mexico</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {lead.billingCountry || "US"}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Pipeline Information */}
                <Card>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => toggleSection("pipeline")}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center">
                        <Target className="h-5 w-5 mr-2" />
                        Pipeline & Sales Information
                      </CardTitle>
                      {expandedSections.pipeline ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>

                  {expandedSections.pipeline && (
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="leadSource">Lead Source</Label>
                          {isEditing ? (
                            <Select
                              value={editForm.leadSource}
                              onValueChange={(value) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  leadSource: value,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="website">Website</SelectItem>
                                <SelectItem value="referral">
                                  Referral
                                </SelectItem>
                                <SelectItem value="cold_call">
                                  Cold Call
                                </SelectItem>
                                <SelectItem value="trade_show">
                                  Trade Show
                                </SelectItem>
                                <SelectItem value="social_media">
                                  Social Media
                                </SelectItem>
                                <SelectItem value="advertising">
                                  Advertising
                                </SelectItem>
                                <SelectItem value="partner">Partner</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.leadSource || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="salesStage">Sales Stage</Label>
                          {isEditing ? (
                            <Select
                              value={editForm.salesStage}
                              onValueChange={(value) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  salesStage: value,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="contacted">
                                  Contacted
                                </SelectItem>
                                <SelectItem value="qualified">
                                  Qualified
                                </SelectItem>
                                <SelectItem value="proposal">
                                  Proposal
                                </SelectItem>
                                <SelectItem value="negotiation">
                                  Negotiation
                                </SelectItem>
                                <SelectItem value="closed_won">
                                  Closed Won
                                </SelectItem>
                                <SelectItem value="closed_lost">
                                  Closed Lost
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.salesStage || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="estimatedAmount">
                            Estimated Deal Value
                          </Label>
                          {isEditing ? (
                            <Input
                              id="estimatedAmount"
                              type="number"
                              value={editForm.estimatedAmount || ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  estimatedAmount: e.target.value
                                    ? parseFloat(e.target.value)
                                    : null,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.estimatedAmount
                                ? `$${Number(
                                    lead.estimatedAmount
                                  ).toLocaleString()}`
                                : "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="probability">Probability (%)</Label>
                          {isEditing ? (
                            <Input
                              id="probability"
                              type="number"
                              min="0"
                              max="100"
                              value={editForm.probability || ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  probability: e.target.value
                                    ? parseInt(e.target.value)
                                    : 0,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.probability || 0}%
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="closeDate">Expected Close Date</Label>
                          {isEditing ? (
                            <Input
                              id="closeDate"
                              type="date"
                              value={editForm.closeDate || ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  closeDate: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.closeDate
                                ? format(
                                    new Date(lead.closeDate),
                                    "MMM d, yyyy"
                                  )
                                : "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="interestLevel">Interest Level</Label>
                          {isEditing ? (
                            <Select
                              value={editForm.interestLevel}
                              onValueChange={(value) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  interestLevel: value,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hot">Hot</SelectItem>
                                <SelectItem value="warm">Warm</SelectItem>
                                <SelectItem value="cold">Cold</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.interestLevel || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="leadScore">Lead Score</Label>
                          {isEditing ? (
                            <Input
                              id="leadScore"
                              type="number"
                              min="0"
                              max="100"
                              value={editForm.leadScore || ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  leadScore: e.target.value
                                    ? parseInt(e.target.value)
                                    : 0,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.leadScore || 0}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="priority">Priority</Label>
                          {isEditing ? (
                            <Select
                              value={editForm.priority}
                              onValueChange={(value) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  priority: value,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.priority || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="assignedSalesRep">
                            Assigned Sales Rep
                          </Label>
                          {isEditing ? (
                            <Input
                              id="assignedSalesRep"
                              value={editForm.assignedSalesRep}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  assignedSalesRep: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.assignedSalesRep || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="territory">Territory</Label>
                          {isEditing ? (
                            <Input
                              id="territory"
                              value={editForm.territory}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  territory: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {lead.territory || "--"}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="activities" className="mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Activity Timeline</h3>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDialogs((prev) => ({ ...prev, note: true }))
                        }
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Note
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDialogs((prev) => ({ ...prev, call: true }))
                        }
                      >
                        <PhoneCall className="h-4 w-4 mr-2" />
                        Log Call
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDialogs((prev) => ({ ...prev, email: true }))
                        }
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Log Email
                      </Button>
                    </div>
                  </div>
                  <ActivityTimeline businessRecordId={id} />
                </div>
              </TabsContent>

              <TabsContent value="contacts" className="mt-6">
                <ContactManager
                  companyId={lead?.companyId || lead?.id || ""}
                  companyName={lead?.companyName || "Unknown Company"}
                />
              </TabsContent>

              <TabsContent value="deals" className="mt-6">
                <LeadDeals
                  leadId={lead?.id || ""}
                  leadName={lead?.companyName || "Unknown Lead"}
                  companyId={lead?.companyId || lead?.id || ""}
                />
              </TabsContent>

              <TabsContent value="proposals" className="mt-6">
                <LeadProposals
                  leadId={lead?.id || ""}
                  leadName={lead?.companyName || "Unknown Lead"}
                />
              </TabsContent>

              <TabsContent value="quotes" className="mt-6">
                <LeadQuotes
                  leadId={lead?.id || ""}
                  leadName={lead?.companyName || "Unknown Lead"}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Additional Information */}
          <div className="space-y-6">
            {/* Quick Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Lead Score</span>
                  <Badge
                    variant={
                      lead.leadScore > 70
                        ? "default"
                        : lead.leadScore > 40
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {lead.leadScore || 0}/100
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <Badge
                    variant={
                      lead.status === "qualified" ? "default" : "secondary"
                    }
                  >
                    {lead.status || "New"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Interest Level</span>
                  <Badge
                    variant={
                      lead.interestLevel === "hot"
                        ? "destructive"
                        : lead.interestLevel === "warm"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {lead.interestLevel || "Warm"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Priority</span>
                  <Badge
                    variant={
                      lead.priority === "high"
                        ? "destructive"
                        : lead.priority === "medium"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {lead.priority || "Medium"}
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Created</span>
                    <span className="text-sm text-gray-900">
                      {lead.createdAt
                        ? format(new Date(lead.createdAt), "MMM d, yyyy")
                        : "--"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Last Contact</span>
                    <span className="text-sm text-gray-900">
                      {lead.lastContactDate
                        ? format(new Date(lead.lastContactDate), "MMM d, yyyy")
                        : "--"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Next Follow-up
                    </span>
                    <span className="text-sm text-gray-900">
                      {lead.nextFollowUpDate
                        ? format(new Date(lead.nextFollowUpDate), "MMM d, yyyy")
                        : "--"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Information */}
            <Card>
              <CardHeader
                className="cursor-pointer"
                onClick={() => toggleSection("financial")}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-lg">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Financial Info
                  </CardTitle>
                  {expandedSections.financial ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              </CardHeader>

              {expandedSections.financial && (
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="creditLimit">Credit Limit</Label>
                    {isEditing ? (
                      <Input
                        id="creditLimit"
                        type="number"
                        value={editForm.creditLimit || ""}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            creditLimit: e.target.value
                              ? parseFloat(e.target.value)
                              : null,
                          }))
                        }
                      />
                    ) : (
                      <p className="text-sm text-gray-900 mt-1">
                        {lead.creditLimit
                          ? `$${Number(lead.creditLimit).toLocaleString()}`
                          : "--"}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="paymentTerms">Payment Terms</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.paymentTerms}
                        onValueChange={(value) =>
                          setEditForm((prev) => ({
                            ...prev,
                            paymentTerms: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Net 15">Net 15</SelectItem>
                          <SelectItem value="Net 30">Net 30</SelectItem>
                          <SelectItem value="Net 45">Net 45</SelectItem>
                          <SelectItem value="Net 60">Net 60</SelectItem>
                          <SelectItem value="COD">COD</SelectItem>
                          <SelectItem value="Prepaid">Prepaid</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-gray-900 mt-1">
                        {lead.paymentTerms || "--"}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="taxId">Tax ID</Label>
                    {isEditing ? (
                      <Input
                        id="taxId"
                        value={editForm.taxId}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            taxId: e.target.value,
                          }))
                        }
                      />
                    ) : (
                      <p className="text-sm text-gray-900 mt-1">
                        {lead.taxId || "--"}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {isEditing ? (
                      <Checkbox
                        id="taxExempt"
                        checked={editForm.taxExempt}
                        onCheckedChange={(checked) =>
                          setEditForm((prev) => ({
                            ...prev,
                            taxExempt: checked,
                          }))
                        }
                      />
                    ) : (
                      <Checkbox
                        id="taxExempt"
                        checked={lead.taxExempt}
                        disabled
                      />
                    )}
                    <Label htmlFor="taxExempt">Tax Exempt</Label>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* External System Integration */}
            <Card>
              <CardHeader
                className="cursor-pointer"
                onClick={() => toggleSection("external")}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-lg">
                    <Zap className="h-5 w-5 mr-2" />
                    External Systems
                  </CardTitle>
                  {expandedSections.external ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              </CardHeader>

              {expandedSections.external && (
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="externalCustomerId">
                      External Customer ID
                    </Label>
                    {isEditing ? (
                      <Input
                        id="externalCustomerId"
                        value={editForm.externalCustomerId}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            externalCustomerId: e.target.value,
                          }))
                        }
                      />
                    ) : (
                      <p className="text-sm text-gray-900 mt-1">
                        {lead.externalCustomerId || "--"}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="externalSystemId">External System</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.externalSystemId}
                        onValueChange={(value) =>
                          setEditForm((prev) => ({
                            ...prev,
                            externalSystemId: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select system" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="e-automate">E-Automate</SelectItem>
                          <SelectItem value="salesforce">Salesforce</SelectItem>
                          <SelectItem value="quickbooks">QuickBooks</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-gray-900 mt-1">
                        {lead.externalSystemId || "--"}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="migrationStatus">Migration Status</Label>
                    {isEditing ? (
                      <Select
                        value={editForm.migrationStatus}
                        onValueChange={(value) =>
                          setEditForm((prev) => ({
                            ...prev,
                            migrationStatus: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">
                            In Progress
                          </SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-gray-900 mt-1">
                        {lead.migrationStatus || "--"}
                      </p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <StickyNote className="h-5 w-5 mr-2" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea
                    value={editForm.notes}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    placeholder="Add notes about this lead..."
                    rows={4}
                  />
                ) : (
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {lead.notes || "No notes available."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Activity Forms */}
      <ActivityForm
        isOpen={dialogs.call}
        onClose={() => setDialogs((prev) => ({ ...prev, call: false }))}
        businessRecordId={id}
        activityType="call"
        recordType="lead"
        recordName={lead.companyName}
      />

      <ActivityForm
        isOpen={dialogs.email}
        onClose={() => setDialogs((prev) => ({ ...prev, email: false }))}
        businessRecordId={id}
        activityType="email"
        recordType="lead"
        recordName={lead.companyName}
      />

      <ActivityForm
        isOpen={dialogs.meeting}
        onClose={() => setDialogs((prev) => ({ ...prev, meeting: false }))}
        businessRecordId={id}
        activityType="meeting"
        recordType="lead"
        recordName={lead.companyName}
      />

      <ActivityForm
        isOpen={dialogs.note}
        onClose={() => setDialogs((prev) => ({ ...prev, note: false }))}
        businessRecordId={id}
        activityType="note"
        recordType="lead"
        recordName={lead.companyName}
      />

      <ActivityForm
        isOpen={dialogs.task}
        onClose={() => setDialogs((prev) => ({ ...prev, task: false }))}
        businessRecordId={id}
        activityType="task"
        recordType="lead"
        recordName={lead.companyName}
      />

      {/* Contact Creation Dialog */}
      <Dialog
        open={dialogs.editRecord}
        onOpenChange={(open) => setDialogs((prev) => ({ ...prev, editRecord: open }))}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
          </DialogHeader>
          <LeadContactForm
            leadId={id}
            onSuccess={() => {
              setDialogs((prev) => ({ ...prev, editRecord: false }));
              queryClient.invalidateQueries({ queryKey: ["/api/leads", id, "contacts"] });
              toast({
                title: "Success",
                description: "Contact created successfully",
              });
            }}
            onCancel={() => setDialogs((prev) => ({ ...prev, editRecord: false }))}
          />
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
