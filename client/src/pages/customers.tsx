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

  // Fetch actual customers
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['/api/customers'],
    enabled: isAuthenticated,
  });

  // Fetch companies data for customer details
  const { data: companies = [] } = useQuery({
    queryKey: ['/api/companies'],
    enabled: isAuthenticated,
  });

  return (
    <MainLayout title="Customers" description="Manage your customer relationships and accounts">
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search customers..."
              className="pl-10 min-h-11 text-base sm:text-sm"
            />
          </div>
          <Button size="default" className="flex items-center gap-2 min-h-11 px-4 py-2">
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        </div>

        {customersLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 sm:p-6">
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-3 bg-muted rounded mb-4 w-2/3"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                    <div className="h-3 bg-muted rounded w-3/4"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : customers && customers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {customers.map((customer: any) => {
              // Find the associated company for this customer
              const company = companies.find((c: any) => c.id === customer.companyId);
              const displayName = company?.businessName || `Customer ${customer.id.slice(0, 8)}`;
              
              return (
                <Card key={customer.id} className="hover:shadow-md transition-shadow touch-manipulation">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-semibold text-sm sm:text-base">
                            {displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">{displayName}</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {customer.leadSource} • {customer.leadStatus?.toUpperCase() || 'CUSTOMER'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {company?.phone && (
                        <p className="text-xs sm:text-sm text-muted-foreground flex items-center">
                          <Phone className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                          <span className="truncate">{company.phone}</span>
                        </p>
                      )}
                      {company?.website && (
                        <p className="text-xs sm:text-sm text-muted-foreground flex items-center">
                          <Mail className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                          <span className="truncate">{company.website}</span>
                        </p>
                      )}
                      {customer.estimatedAmount && (
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          <strong className="text-foreground">Value:</strong> ${Number(customer.estimatedAmount).toLocaleString()}
                        </p>
                      )}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-border">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full flex items-center gap-2 min-h-11 sm:h-9"
                        onClick={() => navigate(`/customers/${customer.id}`)}
                      >
                        <Eye className="h-4 w-4" />
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
            <CardContent className="py-8 sm:py-12">
              <div className="text-center">
                <Users className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">No customers found</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-6">Get started by adding your first customer.</p>
                <Button size="default" className="flex items-center gap-2 min-h-11 px-4 py-2">
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