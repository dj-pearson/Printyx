import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Users, Eye, Phone, Mail, MapPin } from "lucide-react";

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
            {customers.map((customer: any) => (
              <Card key={customer.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        <span className="text-primary-600 font-semibold text-sm">
                          {customer.businessName?.charAt(0) || 'C'}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{customer.businessName}</h3>
                        <p className="text-sm text-gray-600">{customer.businessSite || customer.industry || 'Customer'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {customer.phone && (
                      <p className="text-sm text-gray-600 flex items-center">
                        <Phone className="w-4 h-4 mr-2" />
                        {customer.phone}
                      </p>
                    )}
                    {customer.website && (
                      <p className="text-sm text-gray-600 flex items-center">
                        <Mail className="w-4 h-4 mr-2" />
                        {customer.website}
                      </p>
                    )}
                    {customer.billingAddress && (
                      <p className="text-sm text-gray-600 flex items-center">
                        <MapPin className="w-4 h-4 mr-2" />
                        {customer.billingCity}, {customer.billingState}
                      </p>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full flex items-center gap-2"
                      onClick={() => navigate(`/customers/${customer.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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