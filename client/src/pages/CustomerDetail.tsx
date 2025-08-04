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
import { CustomerInvoices } from "@/components/customer/CustomerInvoices";
import { CustomerServiceHistory } from "@/components/customer/CustomerServiceHistory";
import { CustomerEquipment } from "@/components/customer/CustomerEquipment";
import { CustomerSupplies } from "@/components/customer/CustomerSupplies";
import { CustomerFinancials } from "@/components/customer/CustomerFinancials";
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
  Wrench,
  Package,
  CheckSquare,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";

export default function CustomerDetailHubspot() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    company: true,
    contact: true,
    address: true,
    service: true,
    billing: true,
    financial: false,
    external: false,
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

  // Fetch customer details
  const { data: customer, isLoading } = useQuery({
    queryKey: ["/api/business-records", id],
    enabled: !!id,
  });

  // Form state for editing - All business_records fields
  const [editForm, setEditForm] = useState({
    // Basic Information
    companyName: "",
    accountNumber: "",
    accountType: "Customer",
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

    // Customer-Specific Information
    customerNumber: "",
    customerSince: "",
    customerTier: "",

    // Service Information
    preferredTechnician: "",
    lastServiceDate: "",
    nextScheduledService: "",

    // Billing Information
    lastInvoiceDate: "",
    lastPaymentDate: "",
    currentBalance: 0,

    // Meter Reading Information
    lastMeterReadingDate: "",
    nextMeterReadingDate: "",

    // Assignment & Ownership
    ownerId: "",
    assignedSalesRep: "",
    territory: "",
    accountManagerId: "",
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

    // System Tracking
    notes: "",
  });

  // Initialize form when customer data loads
  useState(() => {
    if (customer) {
      setEditForm(customer);
    }
  }, [customer]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", `/api/business-records/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Customer Updated",
        description: "Customer information has been successfully updated.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/business-records", id],
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update customer information.",
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
        title="Customer Details"
        description="Loading customer information..."
      >
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </MainLayout>
    );
  }

  if (!customer) {
    return (
      <MainLayout
        title="Customer Not Found"
        description="The requested customer could not be found"
      >
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Customer not found
          </h3>
          <p className="text-gray-600 mb-4">
            The customer you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => setLocation("/customers")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        {/* HubSpot-style Header */}
        <div className="flex items-center justify-between mb-6 bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/customers")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-green-100 text-green-600 text-lg font-semibold">
                  {customer.companyName?.[0] || "C"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {customer.companyName || "Unnamed Customer"}
                </h1>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Badge
                    variant="default"
                    className="bg-green-100 text-green-800"
                  >
                    Active Customer
                  </Badge>
                  <span>•</span>
                  <span>#{customer.customerNumber || "PENDING"}</span>
                  <span>•</span>
                  <span>
                    Since{" "}
                    {customer.customerSince
                      ? format(new Date(customer.customerSince), "MMM yyyy")
                      : "Recently"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogs((prev) => ({ ...prev, call: true }))}
            >
              <PhoneCall className="h-4 w-4 mr-2" />
              Call
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogs((prev) => ({ ...prev, email: true }))}
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogs((prev) => ({ ...prev, meeting: true }))}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Service
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogs((prev) => ({ ...prev, note: true }))}
            >
              <FileText className="h-4 w-4 mr-2" />
              Note
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogs((prev) => ({ ...prev, task: true }))}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Task
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit className="h-4 w-4 mr-2" />
              {isEditing ? "Cancel" : "Edit"}
            </Button>
            {isEditing && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview Tab Content */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-8">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="activities">Activities</TabsTrigger>
                <TabsTrigger value="contacts">Contacts</TabsTrigger>
                <TabsTrigger value="service">Service</TabsTrigger>
                <TabsTrigger value="equipment">Equipment</TabsTrigger>
                <TabsTrigger value="supplies">Supplies</TabsTrigger>
                <TabsTrigger value="invoices">Invoices</TabsTrigger>
                <TabsTrigger value="financials">Financials</TabsTrigger>
              </TabsList>

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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              {customer.companyName || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="customerNumber">
                            Customer Number
                          </Label>
                          {isEditing ? (
                            <Input
                              id="customerNumber"
                              value={editForm.customerNumber}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  customerNumber: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {customer.customerNumber || "--"}
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
                              {customer.accountNumber || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="customerSince">Customer Since</Label>
                          {isEditing ? (
                            <Input
                              id="customerSince"
                              type="date"
                              value={editForm.customerSince || ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  customerSince: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {customer.customerSince
                                ? format(
                                    new Date(customer.customerSince),
                                    "MMM d, yyyy"
                                  )
                                : "--"}
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
                              {customer.website ? (
                                <a
                                  href={customer.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline flex items-center"
                                >
                                  {customer.website}
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
                              {customer.industry || "--"}
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
                              {customer.employeeCount || "--"}
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
                              {customer.annualRevenue
                                ? `$${Number(
                                    customer.annualRevenue
                                  ).toLocaleString()}`
                                : "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="customerTier">Customer Tier</Label>
                          {isEditing ? (
                            <Select
                              value={editForm.customerTier}
                              onValueChange={(value) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  customerTier: value,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select tier" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Platinum">
                                  Platinum
                                </SelectItem>
                                <SelectItem value="Gold">Gold</SelectItem>
                                <SelectItem value="Silver">Silver</SelectItem>
                                <SelectItem value="Bronze">Bronze</SelectItem>
                                <SelectItem value="Standard">
                                  Standard
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {customer.customerTier || "--"}
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
                              {customer.priority || "--"}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Contact Information - Same as Lead */}
                <Card>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => toggleSection("contact")}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center">
                        <User className="h-5 w-5 mr-2" />
                        Contact Information
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
                            Primary Contact Name
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
                              {customer.primaryContactName || "--"}
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
                              {customer.primaryContactTitle || "--"}
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
                              {customer.primaryContactEmail ? (
                                <a
                                  href={`mailto:${customer.primaryContactEmail}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {customer.primaryContactEmail}
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
                              {customer.primaryContactPhone ? (
                                <a
                                  href={`tel:${customer.primaryContactPhone}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {customer.primaryContactPhone}
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
                              {customer.phone ? (
                                <a
                                  href={`tel:${customer.phone}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {customer.phone}
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
                              {customer.fax || "--"}
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
                              {customer.billingContactName || "--"}
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
                              {customer.billingContactEmail ? (
                                <a
                                  href={`mailto:${customer.billingContactEmail}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {customer.billingContactEmail}
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
                              {customer.billingContactPhone ? (
                                <a
                                  href={`tel:${customer.billingContactPhone}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {customer.billingContactPhone}
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

                {/* Service Information - Customer-specific */}
                <Card>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => toggleSection("service")}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center">
                        <Wrench className="h-5 w-5 mr-2" />
                        Service Information
                      </CardTitle>
                      {expandedSections.service ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>

                  {expandedSections.service && (
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="preferredTechnician">
                            Preferred Technician
                          </Label>
                          {isEditing ? (
                            <Input
                              id="preferredTechnician"
                              value={editForm.preferredTechnician}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  preferredTechnician: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {customer.preferredTechnician || "--"}
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
                              {customer.assignedSalesRep || "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="lastServiceDate">
                            Last Service Date
                          </Label>
                          {isEditing ? (
                            <Input
                              id="lastServiceDate"
                              type="date"
                              value={editForm.lastServiceDate || ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  lastServiceDate: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {customer.lastServiceDate
                                ? format(
                                    new Date(customer.lastServiceDate),
                                    "MMM d, yyyy"
                                  )
                                : "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="nextScheduledService">
                            Next Scheduled Service
                          </Label>
                          {isEditing ? (
                            <Input
                              id="nextScheduledService"
                              type="date"
                              value={editForm.nextScheduledService || ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  nextScheduledService: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {customer.nextScheduledService
                                ? format(
                                    new Date(customer.nextScheduledService),
                                    "MMM d, yyyy"
                                  )
                                : "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="lastMeterReadingDate">
                            Last Meter Reading
                          </Label>
                          {isEditing ? (
                            <Input
                              id="lastMeterReadingDate"
                              type="date"
                              value={editForm.lastMeterReadingDate || ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  lastMeterReadingDate: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {customer.lastMeterReadingDate
                                ? format(
                                    new Date(customer.lastMeterReadingDate),
                                    "MMM d, yyyy"
                                  )
                                : "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="nextMeterReadingDate">
                            Next Meter Reading
                          </Label>
                          {isEditing ? (
                            <Input
                              id="nextMeterReadingDate"
                              type="date"
                              value={editForm.nextMeterReadingDate || ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  nextMeterReadingDate: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {customer.nextMeterReadingDate
                                ? format(
                                    new Date(customer.nextMeterReadingDate),
                                    "MMM d, yyyy"
                                  )
                                : "--"}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Billing Information - Customer-specific */}
                <Card>
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => toggleSection("billing")}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center">
                        <CreditCard className="h-5 w-5 mr-2" />
                        Billing Information
                      </CardTitle>
                      {expandedSections.billing ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>

                  {expandedSections.billing && (
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="currentBalance">
                            Current Balance
                          </Label>
                          {isEditing ? (
                            <Input
                              id="currentBalance"
                              type="number"
                              step="0.01"
                              value={editForm.currentBalance || ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  currentBalance: e.target.value
                                    ? parseFloat(e.target.value)
                                    : 0,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              <span
                                className={`font-medium ${
                                  Number(customer.currentBalance) > 0
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                $
                                {Number(
                                  customer.currentBalance || 0
                                ).toLocaleString()}
                              </span>
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="lastInvoiceDate">
                            Last Invoice Date
                          </Label>
                          {isEditing ? (
                            <Input
                              id="lastInvoiceDate"
                              type="date"
                              value={editForm.lastInvoiceDate || ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  lastInvoiceDate: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {customer.lastInvoiceDate
                                ? format(
                                    new Date(customer.lastInvoiceDate),
                                    "MMM d, yyyy"
                                  )
                                : "--"}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="lastPaymentDate">
                            Last Payment Date
                          </Label>
                          {isEditing ? (
                            <Input
                              id="lastPaymentDate"
                              type="date"
                              value={editForm.lastPaymentDate || ""}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  lastPaymentDate: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <p className="text-sm text-gray-900 mt-1">
                              {customer.lastPaymentDate
                                ? format(
                                    new Date(customer.lastPaymentDate),
                                    "MMM d, yyyy"
                                  )
                                : "--"}
                            </p>
                          )}
                        </div>

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
                              {customer.creditLimit
                                ? `$${Number(
                                    customer.creditLimit
                                  ).toLocaleString()}`
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
                              {customer.paymentTerms || "--"}
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
                              {customer.taxId || "--"}
                            </p>
                          )}
                        </div>
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
                            checked={customer.taxExempt}
                            disabled
                          />
                        )}
                        <Label htmlFor="taxExempt">Tax Exempt</Label>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Address Information - Same as Lead but including shipping */}
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
                                {customer.addressLine1 || "--"}
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
                                {customer.addressLine2 || "--"}
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
                                {customer.city || "--"}
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
                                {customer.state || "--"}
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
                                {customer.postalCode || "--"}
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
                                {customer.country || "US"}
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
                              Address Line 1
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
                                {customer.billingAddressLine1 || "--"}
                              </p>
                            )}
                          </div>

                          <div className="md:col-span-2">
                            <Label htmlFor="billingAddressLine2">
                              Address Line 2
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
                                {customer.billingAddressLine2 || "--"}
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
                                {customer.billingCity || "--"}
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
                                {customer.billingState || "--"}
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
                                {customer.billingPostalCode || "--"}
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
                                {customer.billingCountry || "US"}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Shipping Address */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">
                          Shipping Address
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <Label htmlFor="shippingAddressLine1">
                              Address Line 1
                            </Label>
                            {isEditing ? (
                              <Input
                                id="shippingAddressLine1"
                                value={editForm.shippingAddressLine1}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    shippingAddressLine1: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {customer.shippingAddressLine1 || "--"}
                              </p>
                            )}
                          </div>

                          <div className="md:col-span-2">
                            <Label htmlFor="shippingAddressLine2">
                              Address Line 2
                            </Label>
                            {isEditing ? (
                              <Input
                                id="shippingAddressLine2"
                                value={editForm.shippingAddressLine2}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    shippingAddressLine2: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {customer.shippingAddressLine2 || "--"}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="shippingCity">City</Label>
                            {isEditing ? (
                              <Input
                                id="shippingCity"
                                value={editForm.shippingCity}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    shippingCity: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {customer.shippingCity || "--"}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="shippingState">State</Label>
                            {isEditing ? (
                              <Input
                                id="shippingState"
                                value={editForm.shippingState}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    shippingState: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {customer.shippingState || "--"}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="shippingPostalCode">
                              Postal Code
                            </Label>
                            {isEditing ? (
                              <Input
                                id="shippingPostalCode"
                                value={editForm.shippingPostalCode}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    shippingPostalCode: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <p className="text-sm text-gray-900 mt-1">
                                {customer.shippingPostalCode || "--"}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="shippingCountry">Country</Label>
                            {isEditing ? (
                              <Select
                                value={editForm.shippingCountry}
                                onValueChange={(value) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    shippingCountry: value,
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
                                {customer.shippingCountry || "US"}
                              </p>
                            )}
                          </div>
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
                  companyId={customer?.companyId || customer?.id || ""}
                  companyName={customer?.companyName || "Unknown Company"}
                />
              </TabsContent>

              <TabsContent value="service" className="mt-6">
                <CustomerServiceHistory
                  customerId={customer?.id || ""}
                  customerName={customer?.companyName || "Unknown Customer"}
                />
              </TabsContent>

              <TabsContent value="equipment" className="mt-6">
                <CustomerEquipment
                  customerId={customer?.id || ""}
                  customerName={customer?.companyName || "Unknown Customer"}
                />
              </TabsContent>

              <TabsContent value="supplies" className="mt-6">
                <CustomerSupplies
                  customerId={customer?.id || ""}
                  customerName={customer?.companyName || "Unknown Customer"}
                />
              </TabsContent>

              <TabsContent value="invoices" className="mt-6">
                <CustomerInvoices
                  customerId={customer?.id || ""}
                  customerName={customer?.companyName || "Unknown Customer"}
                />
              </TabsContent>

              <TabsContent value="financials" className="mt-6">
                <CustomerFinancials
                  customerId={customer?.id || ""}
                  customerName={customer?.companyName || "Unknown Customer"}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Additional Information */}
          <div className="space-y-6">
            {/* Quick Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customer Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Customer #</span>
                  <span className="text-sm font-medium text-gray-900">
                    {customer.customerNumber || "PENDING"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <Badge
                    variant="default"
                    className="bg-green-100 text-green-800"
                  >
                    Active
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Customer Tier</span>
                  <Badge
                    variant={
                      customer.customerTier === "Platinum"
                        ? "default"
                        : customer.customerTier === "Gold"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {customer.customerTier || "Standard"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Priority</span>
                  <Badge
                    variant={
                      customer.priority === "high"
                        ? "destructive"
                        : customer.priority === "medium"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {customer.priority || "Medium"}
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Customer Since
                    </span>
                    <span className="text-sm text-gray-900">
                      {customer.customerSince
                        ? format(
                            new Date(customer.customerSince),
                            "MMM d, yyyy"
                          )
                        : "--"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Current Balance
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        Number(customer.currentBalance) > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      ${Number(customer.currentBalance || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Credit Limit</span>
                    <span className="text-sm text-gray-900">
                      {customer.creditLimit
                        ? `$${Number(customer.creditLimit).toLocaleString()}`
                        : "--"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Wrench className="h-5 w-5 mr-2" />
                  Service Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Service</span>
                  <span className="text-sm text-gray-900">
                    {customer.lastServiceDate
                      ? format(
                          new Date(customer.lastServiceDate),
                          "MMM d, yyyy"
                        )
                      : "--"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Next Service</span>
                  <span className="text-sm text-gray-900">
                    {customer.nextScheduledService
                      ? format(
                          new Date(customer.nextScheduledService),
                          "MMM d, yyyy"
                        )
                      : "--"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Preferred Tech</span>
                  <span className="text-sm text-gray-900">
                    {customer.preferredTechnician || "--"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Last Meter Reading
                  </span>
                  <span className="text-sm text-gray-900">
                    {customer.lastMeterReadingDate
                      ? format(
                          new Date(customer.lastMeterReadingDate),
                          "MMM d, yyyy"
                        )
                      : "--"}
                  </span>
                </div>
              </CardContent>
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
                        {customer.externalCustomerId || "--"}
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
                        {customer.externalSystemId || "--"}
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
                        {customer.migrationStatus || "--"}
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
                    placeholder="Add notes about this customer..."
                    rows={4}
                  />
                ) : (
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {customer.notes || "No notes available."}
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
        recordType="customer"
        recordName={customer.companyName}
      />

      <ActivityForm
        isOpen={dialogs.email}
        onClose={() => setDialogs((prev) => ({ ...prev, email: false }))}
        businessRecordId={id}
        activityType="email"
        recordType="customer"
        recordName={customer.companyName}
      />

      <ActivityForm
        isOpen={dialogs.meeting}
        onClose={() => setDialogs((prev) => ({ ...prev, meeting: false }))}
        businessRecordId={id}
        activityType="meeting"
        recordType="customer"
        recordName={customer.companyName}
      />

      <ActivityForm
        isOpen={dialogs.note}
        onClose={() => setDialogs((prev) => ({ ...prev, note: false }))}
        businessRecordId={id}
        activityType="note"
        recordType="customer"
        recordName={customer.companyName}
      />

      <ActivityForm
        isOpen={dialogs.task}
        onClose={() => setDialogs((prev) => ({ ...prev, task: false }))}
        businessRecordId={id}
        activityType="task"
        recordType="customer"
        recordName={customer.companyName}
      />
    </MainLayout>
  );
}
