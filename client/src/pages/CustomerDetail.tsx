import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Plus, Phone, Mail, MapPin, Building2, User, Eye, FileText, Users, StickyNote } from "lucide-react";
import { Link } from "wouter";

export default function CustomerDetail() {
  const { id } = useParams();

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
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Customer Not Found</h2>
          <p className="text-gray-600 mb-4">The customer you're looking for doesn't exist.</p>
          <Link href="/customers">
            <Button>Back to Customers</Button>
          </Link>
        </div>
      </div>
    );
  }

  const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];

  return (
    <div className="p-6 max-w-6xl mx-auto">
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
                <Button variant="outline" size="sm">
                  <StickyNote className="h-4 w-4 mr-2" />
                  Note
                </Button>
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button variant="outline" size="sm">
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Meeting
                </Button>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Task
                </Button>
                <Button variant="outline" size="sm">
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
    </div>
  );
}