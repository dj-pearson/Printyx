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
  Wrench,
  BarChart3,
  ArrowLeft,
  Edit,
  Plus,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  Settings,
  Contact,
  Package,
  Activity,
  Printer,
  Receipt
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Customer {
  id: string;
  tenantId: string;
  businessName: string;
  customerNumber?: string;
  businessSite?: string;
  parentBusiness?: string;
  industry?: string;
  phone?: string;
  fax?: string;
  website?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  customerSince?: string;
  employees?: number;
  annualRevenue?: number;
  numberOfLocations?: number;
  businessOwner?: string;
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

interface Equipment {
  id: string;
  customerId: string;
  equipmentType: string;
  make: string;
  model: string;
  serialNumber: string;
  installDate?: string;
  location?: string;
  status: string;
  createdAt: string;
}

interface MeterReading {
  id: string;
  equipmentId: string;
  contractId: string;
  readingDate: string;
  blackMeter: number;
  colorMeter: number;
  blackCopies: number;
  colorCopies: number;
  collectionMethod: string;
  billingStatus: string;
  billingAmount?: number;
  createdAt: string;
}

interface Invoice {
  id: string;
  customerId: string;
  invoiceNumber: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  totalAmount: number;
  status: string;
  dueDate: string;
  paidDate?: string;
  createdAt: string;
}

interface ServiceTicket {
  id: string;
  customerId: string;
  equipmentId?: string;
  ticketNumber: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  assignedTechnicianId?: string;
  scheduledDate?: string;
  createdAt: string;
}

interface Contract {
  id: string;
  customerId: string;
  contractNumber: string;
  contractType: string;
  startDate: string;
  endDate?: string;
  status: string;
  monthlyRate?: number;
  createdAt: string;
}

export default function CustomerDetail() {
  const { slug } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  // Get all customers and find by slug
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['/api/companies'],
  });

  const customer = customers.find((c: any) => {
    const name = c.businessName || 'untitled-customer';
    return name.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim().replace(/^-+|-+$/g, '') === slug;
  });

  const isLoading = customersLoading;
  const customerId = customer?.id;

  // Fetch related data
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/companies", customerId, "contacts"],
    enabled: !!customerId,
  });

  const { data: equipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/customers", customerId, "equipment"],
    enabled: !!customerId,
  });

  const { data: meterReadings = [] } = useQuery<MeterReading[]>({
    queryKey: ["/api/customers", customerId, "meter-readings"],
    enabled: !!customerId,
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/customers", customerId, "invoices"],
    enabled: !!customerId,
  });

  const { data: serviceTickets = [] } = useQuery<ServiceTicket[]>({
    queryKey: ["/api/customers", customerId, "service-tickets"],
    enabled: !!customerId,
  });

  const { data: contracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/customers", customerId, "contracts"],
    enabled: !!customerId,
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

  if (!customer) {
    return (
      <MainLayout>
        <div className="container mx-auto px-6 py-8">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Customer Not Found</h3>
                <p className="text-gray-600 mb-4">The customer you're looking for doesn't exist or you don't have access to it.</p>
                <Button variant="outline" onClick={() => navigate("/customers")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Customers
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const primaryContact = contacts.find(c => c.isPrimaryContact) || contacts[0];
  const activeContracts = contracts.filter(c => c.status === "active");
  const recentInvoices = invoices.slice(0, 5);
  const openTickets = serviceTickets.filter(t => t.status !== "completed" && t.status !== "cancelled");

  return (
    <MainLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/customers")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{customer.businessName}</h1>
              <p className="text-sm text-gray-600">
                Customer #{customer.customerNumber} • {customer.businessSite}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Edit Customer
            </Button>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Service Ticket
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Equipment</p>
                  <p className="text-lg font-semibold">{equipment.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Receipt className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Contracts</p>
                  <p className="text-lg font-semibold">{activeContracts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Wrench className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Open Tickets</p>
                  <p className="text-lg font-semibold">{openTickets.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Invoices</p>
                  <p className="text-lg font-semibold">{invoices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Information Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Business Details</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Industry:</span>
                    <span>{customer.industry || "Not specified"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Owner:</span>
                    <span>{customer.businessOwner || "Not specified"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Customer Since:</span>
                    <span>{customer.customerSince ? format(new Date(customer.customerSince), "MMM d, yyyy") : "Not specified"}</span>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Contact Information</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Phone:</span>
                    <span>{customer.phone || "Not provided"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Website:</span>
                    <span>{customer.website || "Not provided"}</span>
                  </div>
                  {primaryContact && (
                    <div className="flex items-center gap-2 text-sm">
                      <Contact className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">Primary Contact:</span>
                      <span>{primaryContact.firstName} {primaryContact.lastName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Address Info */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Address</h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-gray-600">Billing Address:</div>
                      <div>
                        {customer.billingAddress && (
                          <div>
                            {customer.billingAddress}<br />
                            {customer.billingCity}, {customer.billingState} {customer.billingZip}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="equipment">Equipment</TabsTrigger>
            <TabsTrigger value="meters">Meter Readings</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="service">Service Tickets</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentInvoices.slice(0, 3).map((invoice) => (
                      <div key={invoice.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Receipt className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Invoice {invoice.invoiceNumber}</div>
                          <div className="text-xs text-gray-600">
                            ${invoice.totalAmount.toLocaleString()} • {format(new Date(invoice.createdAt), "MMM d, yyyy")}
                          </div>
                        </div>
                        <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                          {invoice.status}
                        </Badge>
                      </div>
                    ))}
                    {openTickets.slice(0, 2).map((ticket) => (
                      <div key={ticket.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Wrench className="h-4 w-4 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{ticket.title}</div>
                          <div className="text-xs text-gray-600">
                            Ticket #{ticket.ticketNumber} • {format(new Date(ticket.createdAt), "MMM d, yyyy")}
                          </div>
                        </div>
                        <Badge variant={ticket.priority === "high" ? "destructive" : "secondary"}>
                          {ticket.priority}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Active Contracts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Active Contracts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {activeContracts.map((contract) => (
                      <div key={contract.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">Contract {contract.contractNumber}</div>
                          <div className="text-xs text-gray-600">
                            {contract.contractType} • {contract.monthlyRate ? `$${contract.monthlyRate.toLocaleString()}/mo` : ""}
                          </div>
                          <div className="text-xs text-gray-600">
                            {format(new Date(contract.startDate), "MMM d, yyyy")} - {contract.endDate ? format(new Date(contract.endDate), "MMM d, yyyy") : "Ongoing"}
                          </div>
                        </div>
                        <Badge variant="default">Active</Badge>
                      </div>
                    ))}
                    {activeContracts.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No active contracts
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contacts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Contact className="h-5 w-5" />
                    Contacts ({contacts.length})
                  </div>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium">{contact.firstName} {contact.lastName}</div>
                              {contact.isPrimaryContact && (
                                <Badge variant="outline" className="text-xs">Primary</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{contact.title || "-"}</TableCell>
                        <TableCell>{contact.phone || "-"}</TableCell>
                        <TableCell>{contact.email || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{contact.leadStatus}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipment">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Printer className="h-5 w-5" />
                    Equipment ({equipment.length})
                  </div>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Equipment
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Install Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipment.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.make} {item.model}</div>
                            <div className="text-sm text-gray-600">{item.equipmentType}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.serialNumber}</TableCell>
                        <TableCell>{item.location || "-"}</TableCell>
                        <TableCell>
                          {item.installDate ? format(new Date(item.installDate), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={item.status === "active" ? "default" : "secondary"}
                            className={cn(
                              item.status === "active" && "bg-green-100 text-green-800",
                              item.status === "maintenance" && "bg-yellow-100 text-yellow-800"
                            )}
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="meters">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Meter Readings ({meterReadings.length})
                  </div>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Reading
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Black Copies</TableHead>
                      <TableHead>Color Copies</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Billing Status</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meterReadings.slice(0, 10).map((reading) => (
                      <TableRow key={reading.id}>
                        <TableCell>{format(new Date(reading.readingDate), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          {equipment.find(e => e.id === reading.equipmentId)?.make} {equipment.find(e => e.id === reading.equipmentId)?.model || "Unknown Equipment"}
                        </TableCell>
                        <TableCell className="text-right">{reading.blackCopies.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{reading.colorCopies.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{reading.collectionMethod}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={reading.billingStatus === "billed" ? "default" : "secondary"}
                            className={cn(
                              reading.billingStatus === "billed" && "bg-green-100 text-green-800",
                              reading.billingStatus === "pending" && "bg-yellow-100 text-yellow-800"
                            )}
                          >
                            {reading.billingStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {reading.billingAmount ? `$${reading.billingAmount.toFixed(2)}` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Invoices ({invoices.length})
                  </div>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Billing Period</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>
                          {format(new Date(invoice.billingPeriodStart), "MMM d")} - {format(new Date(invoice.billingPeriodEnd), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-medium">${invoice.totalAmount.toLocaleString()}</TableCell>
                        <TableCell>{format(new Date(invoice.dueDate), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={invoice.status === "paid" ? "default" : invoice.status === "overdue" ? "destructive" : "secondary"}
                            className={cn(
                              invoice.status === "paid" && "bg-green-100 text-green-800",
                              invoice.status === "pending" && "bg-yellow-100 text-yellow-800"
                            )}
                          >
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {invoice.paidDate ? format(new Date(invoice.paidDate), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="service">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Service Tickets ({serviceTickets.length})
                  </div>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Ticket
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceTickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-medium">{ticket.ticketNumber}</TableCell>
                        <TableCell>{ticket.title}</TableCell>
                        <TableCell>
                          {ticket.equipmentId ? (
                            equipment.find(e => e.id === ticket.equipmentId)?.make + " " + equipment.find(e => e.id === ticket.equipmentId)?.model
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={ticket.priority === "high" ? "destructive" : ticket.priority === "medium" ? "default" : "secondary"}
                          >
                            {ticket.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={ticket.status === "completed" ? "default" : "secondary"}
                            className={cn(
                              ticket.status === "completed" && "bg-green-100 text-green-800",
                              ticket.status === "in-progress" && "bg-blue-100 text-blue-800",
                              ticket.status === "open" && "bg-yellow-100 text-yellow-800"
                            )}
                          >
                            {ticket.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {ticket.scheduledDate ? format(new Date(ticket.scheduledDate), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}