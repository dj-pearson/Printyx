import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileNav from "@/components/ui/mobile-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Users } from "lucide-react";

export default function Customers() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['/api/customers'],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <Header title="Customers" description="Manage your customer relationships and accounts" />
        
        <div className="p-6 space-y-6">
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
                            {customer.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                          <p className="text-sm text-gray-600">{customer.contactPerson}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {customer.email && (
                        <p className="text-sm text-gray-600 flex items-center">
                          <i className="fas fa-envelope w-4 h-4 mr-2"></i>
                          {customer.email}
                        </p>
                      )}
                      {customer.phone && (
                        <p className="text-sm text-gray-600 flex items-center">
                          <i className="fas fa-phone w-4 h-4 mr-2"></i>
                          {customer.phone}
                        </p>
                      )}
                      {customer.address && (
                        <p className="text-sm text-gray-600 flex items-center">
                          <i className="fas fa-map-marker-alt w-4 h-4 mr-2"></i>
                          {customer.address}
                        </p>
                      )}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <Button variant="outline" size="sm" className="w-full">
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
      </main>
      
      <MobileNav />
    </div>
  );
}
