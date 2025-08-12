import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Plus,
  Users,
  Eye,
  Phone,
  Mail,
  MapPin,
  LayoutGrid,
  Rows,
} from "lucide-react";

export default function Customers() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "cards" : "table";
    }
    return "cards";
  });

  useEffect(() => {
    const handler = () => {
      if (window.innerWidth < 768 && viewMode === "table") {
        setViewMode("cards");
      }
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [viewMode]);

  // Fetch customers from unified business_records view
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ["/api/customers"],
    enabled: isAuthenticated,
  });

  // Optional companies for enrichment
  const { data: companies = [] } = useQuery({
    queryKey: ["/api/companies"],
    enabled: isAuthenticated,
  });

  const enriched = useMemo(() => {
    return (customers as any[]).map((c) => {
      const company = (companies as any[]).find(
        (co) => co.id === (c.companyId || c.company_id)
      );
      // Prefer snake_case from business_records: company_name
      const companyName =
        c.company_name ||
        c.companyName ||
        company?.businessName ||
        company?.name ||
        `Customer ${String(c.id).slice(0, 8)}`;
      const city = c.city || company?.city || "";
      const state = c.state || company?.state || "";
      return {
        ...c,
        companyName,
        city,
        state,
        phone: c.phone || company?.phone || "",
        website: c.website || company?.website || "",
        industry: c.industry || company?.industry || "",
      };
    });
  }, [customers, companies]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return enriched;
    return enriched.filter((r: any) =>
      [
        r.companyName,
        r.primaryContactName,
        r.primaryContactEmail,
        r.industry,
        r.city,
        r.state,
      ]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(term))
    );
  }, [enriched, searchTerm]);

  return (
    <MainLayout
      title="Customers"
      description="Manage your customer relationships and accounts"
    >
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search customers..."
              className="pl-10 min-h-11 text-base sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "cards" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("cards")}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("table")}
              title="Table view"
            >
              <Rows className="h-4 w-4" />
            </Button>
            <Button
              size="default"
              className="flex items-center gap-2 min-h-11 px-4 py-2"
            >
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
          </div>
        </div>

        {customersLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 sm:p-6">
                  <div className="h-4 bg-muted rounded mb-2" />
                  <div className="h-3 bg-muted rounded mb-4 w-2/3" />
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-3/4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          viewMode === "cards" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filtered.map((customer: any) => {
                const displayName = customer.companyName as string;
                const subtitle = [
                  customer.industry,
                  [customer.city, customer.state].filter(Boolean).join(", "),
                ]
                  .filter(Boolean)
                  .join(" • ");

                return (
                  <Card
                    key={customer.id}
                    className="hover:shadow-md transition-shadow touch-manipulation"
                  >
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-semibold text-sm sm:text-base">
                              {displayName?.charAt(0)?.toUpperCase() || "C"}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                              {displayName}
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">
                              {subtitle || "Customer"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {customer.phone && (
                          <p className="text-xs sm:text-sm text-muted-foreground flex items-center">
                            <Phone className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                            <span className="truncate">{customer.phone}</span>
                          </p>
                        )}
                        {customer.website && (
                          <p className="text-xs sm:text-sm text-muted-foreground flex items-center">
                            <Mail className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                            <span className="truncate">{customer.website}</span>
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-4 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full flex items-center gap-2 min-h-11 sm:h-9"
                          onClick={() => navigate(`/customers/${customer.urlSlug || customer.url_slug || customer.id}`)}
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
            <div className="bg-background rounded-md border">
              <UITable>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row: any) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/customers/${row.urlSlug || row.url_slug || row.id}`)}
                    >
                      <TableCell className="font-medium">
                        {row.companyName}
                      </TableCell>
                      <TableCell>{row.industry || "—"}</TableCell>
                      <TableCell>
                        {[row.city, row.state].filter(Boolean).join(", ") ||
                          "—"}
                      </TableCell>
                      <TableCell>{row.phone || "—"}</TableCell>
                      <TableCell className="truncate max-w-[260px]">
                        {row.website || "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/customers/${row.urlSlug || row.url_slug || row.id}`);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </UITable>
            </div>
          )
        ) : (
          <Card>
            <CardContent className="py-8 sm:py-12">
              <div className="text-center">
                <Users className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                  No customers found
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-6">
                  Get started by adding your first customer.
                </p>
                <Button
                  size="default"
                  className="flex items-center gap-2 min-h-11 px-4 py-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Customer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Edit Customer Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Customer</DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Company Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Company Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Acme Corporation" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry</FormLabel>
                          <FormControl>
                            <Input placeholder="Technology, Healthcare, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="companySize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Size</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select size" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="startup">Startup (1-10)</SelectItem>
                              <SelectItem value="small">Small (11-50)</SelectItem>
                              <SelectItem value="medium">Medium (51-250)</SelectItem>
                              <SelectItem value="large">Large (251-1000)</SelectItem>
                              <SelectItem value="enterprise">Enterprise (1000+)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Primary Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Primary Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="primaryContactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John Smith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="primaryContactTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Title</FormLabel>
                          <FormControl>
                            <Input placeholder="CEO, Manager, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="primaryContactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@company.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="primaryContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone *</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="addressLine1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 1</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main Street" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="addressLine2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 2</FormLabel>
                          <FormControl>
                            <Input placeholder="Suite 100" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="New York" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="NY" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input placeholder="10001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input placeholder="US" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Customer Management */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Customer Management</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="customerTier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Tier</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select tier" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="bronze">Bronze</SelectItem>
                              <SelectItem value="silver">Silver</SelectItem>
                              <SelectItem value="gold">Gold</SelectItem>
                              <SelectItem value="platinum">Platinum</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="assignedSalesRep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned Sales Rep</FormLabel>
                          <FormControl>
                            <Input placeholder="Sales rep name or ID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Notes and Tags */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags</FormLabel>
                        <FormControl>
                          <Input placeholder="enterprise, vip, tech-forward (comma-separated)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Additional notes about this customer..."
                            className="min-h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingCustomer(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateCustomerMutation.isPending}
                  >
                    {updateCustomerMutation.isPending
                      ? "Updating..."
                      : "Update Customer"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
