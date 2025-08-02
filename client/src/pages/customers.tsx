import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Plus, 
  Users, 
  Eye, 
  Phone, 
  Mail, 
  MapPin, 
  Building2, 
  Calendar,
  DollarSign,
  Star,
  Clock,
  UserCheck,
  CheckCircle,
  Settings,
  FileText
} from "lucide-react";
import { createSlug } from "@shared/utils";

export default function Customers() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Use companies endpoint since that's what we have customers stored as
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['/api/companies'],
    enabled: isAuthenticated,
  });

  return (
    <MainLayout title="Customers" description="Manage your customer relationships and accounts">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search customers..."
              className="pl-10"
            />
          </div>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        </div>

        {customersLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : customers && customers.length > 0 ? (
          <div className="grid gap-4">
            {customers.map((customer: any) => {
              const customerSlug = createSlug(customer.businessName || 'untitled-customer');
              return (
                <Card key={customer.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-lg">
                            {customer.businessName || 'Untitled Customer'}
                          </CardTitle>
                          <Badge className="text-green-600 bg-green-50 border-green-200 border-0">
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Customer
                            </span>
                          </Badge>
                        </div>
                        <CardDescription>
                          Industry: {customer.industry || customer.businessSite || 'Business'} | Location: {customer.billingCity || 'No location'}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold">${customer.monthlyRecurring || '0'}</div>
                        {customer.customerSince && (
                          <div className="text-sm text-gray-500">
                            Since: {new Date(customer.customerSince).getFullYear()}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {customer.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{customer.phone}</span>
                          </div>
                        )}
                        {customer.website && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span>{customer.website}</span>
                          </div>
                        )}
                        {(customer.billingCity || customer.billingState) && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span>
                              {customer.billingCity}{customer.billingCity && customer.billingState ? ', ' : ''}{customer.billingState}
                            </span>
                          </div>
                        )}
                        {customer.customerSince && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>Since: {new Date(customer.customerSince).getFullYear()}</span>
                          </div>
                        )}
                      </div>

                      {customer.description && (
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{customer.description}</p>
                      )}

                      <div className="flex justify-between items-center pt-2 border-t">
                        <div className="flex gap-2">
                          <Button 
                            size="sm"
                            onClick={() => console.log('Create service ticket for', customer.id)}
                          >
                            <Settings className="w-4 h-4 mr-1" />
                            Service
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => console.log('Create invoice for', customer.id)}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            Invoice
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => console.log('Schedule maintenance for', customer.id)}
                          >
                            <Calendar className="w-4 h-4 mr-1" />
                            Schedule
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/companies/${customer.id}/contacts`)}
                          >
                            <UserCheck className="w-4 h-4 mr-1" />
                            Contacts
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/customers/${customerSlug}`)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No customers found</h3>
                <p className="text-gray-600 mb-6">Get started by adding your first customer.</p>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Customer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}