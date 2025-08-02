import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  UserCheck
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customers.map((customer: any) => {
              const customerSlug = createSlug(customer.businessName || 'untitled-customer');
              return (
                <Card key={customer.id} className="hover:shadow-md transition-shadow border-l-4 border-l-green-500">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-green-600" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <UserCheck className="w-3 h-3 text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 text-base">
                              {customer.businessName || 'Untitled Customer'}
                            </h3>
                            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">
                              Customer
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {customer.industry || customer.businessSite || 'Business'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      {customer.phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="w-4 h-4 mr-3 text-gray-400" />
                          <span className="truncate">{customer.phone}</span>
                        </div>
                      )}
                      
                      {customer.website && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="w-4 h-4 mr-3 text-gray-400" />
                          <span className="truncate">{customer.website}</span>
                        </div>
                      )}
                      
                      {(customer.billingCity || customer.billingState) && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-3 text-gray-400" />
                          <span className="truncate">
                            {customer.billingCity}{customer.billingCity && customer.billingState ? ', ' : ''}{customer.billingState}
                          </span>
                        </div>
                      )}

                      {customer.customerSince && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="w-4 h-4 mr-3 text-gray-400" />
                          <span>Customer since {new Date(customer.customerSince).getFullYear()}</span>
                        </div>
                      )}
                    </div>

                    {/* Customer-specific metrics */}
                    <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">
                          {customer.activeContracts || 0}
                        </div>
                        <div className="text-xs text-gray-600">Active Contracts</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-green-600">
                          ${customer.monthlyRecurring || '0'}
                        </div>
                        <div className="text-xs text-gray-600">Monthly Recurring</div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => navigate(`/customers/${customerSlug}`)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
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