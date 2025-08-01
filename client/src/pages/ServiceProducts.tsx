import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Settings, Edit3, Tag, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertServiceProductSchema, type ServiceProduct, type InsertServiceProduct } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/layout";

export default function ServiceProducts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedServiceType, setSelectedServiceType] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceProduct | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: services = [], isLoading } = useQuery<ServiceProduct[]>({
    queryKey: ['/api/service-products'],
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: InsertServiceProduct) => {
      return await apiRequest('/api/service-products', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-products'] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Service product created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create service product",
        variant: "destructive",
      });
    },
  });

  const form = useForm<InsertServiceProduct>({
    resolver: zodResolver(insertServiceProductSchema),
    defaultValues: {
      tenantId: "",
      productCode: "",
      productName: "",
      category: "Service",
      serviceType: null,
      pricingLevel: null,
      description: null,
      summary: null,
      note: null,
      eaNotes: null,
      relatedProducts: null,
      isActive: true,
      availableForAll: false,
      repostEdit: false,
      salesRepCredit: true,
      funding: true,
      lease: false,
      paymentType: null,
      newActive: false,
      newRepPrice: null,
      upgradeActive: false,
      upgradeRepPrice: null,
      lexmarkActive: false,
      lexmarkRepPrice: null,
      graphicActive: false,
      graphicRepPrice: null,
    },
  });

  const onSubmit = (data: InsertServiceProduct) => {
    createServiceMutation.mutate(data);
  };

  // Get unique service types from services
  const serviceTypes = Array.from(new Set(services.map(s => s.serviceType).filter(Boolean)));

  // Filter services by search and service type
  const filteredServices = services.filter(service => {
    const matchesSearch = service.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (selectedServiceType === "all") return matchesSearch;
    
    const matchesType = service.serviceType === selectedServiceType;
    
    return matchesSearch && matchesType;
  });

  const formatCurrency = (value: string | null) => {
    if (!value) return "$0.00";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(value));
  };

  const ServiceCard = ({ service }: { service: ServiceProduct }) => {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">{service.productName}</CardTitle>
              <CardDescription>
                <span className="font-medium">{service.productCode}</span>
                {service.serviceType && <span className="ml-2 text-muted-foreground">• {service.serviceType}</span>}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {service.isActive ? (
                <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <Badge variant="outline">{service.category}</Badge>
            {service.serviceType && <Badge variant="outline">{service.serviceType}</Badge>}
            {service.pricingLevel && <Badge variant="outline">{service.pricingLevel}</Badge>}
          </div>

          {service.summary && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {service.summary}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-sm font-medium">New Rep Price</span>
              <p className="text-lg font-bold text-green-600">
                {service.newActive ? formatCurrency(service.newRepPrice) : "Not Set"}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">Upgrade Price</span>
              <p className="text-lg font-bold text-blue-600">
                {service.upgradeActive ? formatCurrency(service.upgradeRepPrice) : "Not Set"}
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground space-y-1">
              {service.paymentType && <div>Payment: {service.paymentType}</div>}
              <div className="flex gap-2">
                {service.salesRepCredit && <Badge variant="outline" className="text-xs">Rep Credit</Badge>}
                {service.funding && <Badge variant="outline" className="text-xs">Funding</Badge>}
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedService(service)}
            >
              <Edit3 className="h-4 w-4 mr-1" />
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Service Products</h1>
            <p className="text-muted-foreground">
              Manage service-based products and offerings for your customers
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Price Book List: Service</DialogTitle>
                <DialogDescription>
                  Create a new service product for your catalog
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Information Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Information</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="productName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="Equipment Service Plan" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Record Type</label>
                        <div className="text-sm text-blue-600">Service</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="productCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Code <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="SVC-PLAN-001" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Type</FormLabel>
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Service">Service</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="isActive"
                        render={({ field }) => (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                            <label className="text-sm font-medium">Active</label>
                          </div>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="availableForAll"
                        render={({ field }) => (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                            <label className="text-sm font-medium">Available for All</label>
                          </div>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="repostEdit"
                        render={({ field }) => (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                            <label className="text-sm font-medium">Repost Edit</label>
                          </div>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="salesRepCredit"
                        render={({ field }) => (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                            <label className="text-sm font-medium">Sales Rep Credit</label>
                          </div>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="funding"
                        render={({ field }) => (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                            <label className="text-sm font-medium">Funding</label>
                          </div>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="pricingLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pricing Level</FormLabel>
                            <FormControl>
                              <Input placeholder="Standard" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="serviceType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Service Type</FormLabel>
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="--None--" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">--None--</SelectItem>
                                <SelectItem value="Maintenance">Maintenance</SelectItem>
                                <SelectItem value="Support">Support</SelectItem>
                                <SelectItem value="Extended Warranty">Extended Warranty</SelectItem>
                                <SelectItem value="Service Plan">Service Plan</SelectItem>
                                <SelectItem value="Remote Monitoring">Remote Monitoring</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Detail Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Detail</h3>
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Detailed description of the service product..."
                              value={field.value || ""}
                              onChange={field.onChange}
                              rows={4}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="summary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Summary</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Brief summary of the service..."
                              value={field.value || ""}
                              onChange={field.onChange}
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="note"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Additional notes..."
                              value={field.value || ""}
                              onChange={field.onChange}
                              rows={2}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="eaNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>EA Notes</FormLabel>
                          <FormControl>
                            <Input placeholder="EA specific notes..." value={field.value || ""} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="relatedProducts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Related Products</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Related products and services..."
                              value={field.value || ""}
                              onChange={field.onChange}
                              rows={2}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  {/* Pricing Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Pricing Information</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="lease"
                        render={({ field }) => (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                            <label className="text-sm font-medium">Lease</label>
                          </div>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="paymentType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Type</FormLabel>
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="--None--" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">--None--</SelectItem>
                                <SelectItem value="Monthly">Monthly</SelectItem>
                                <SelectItem value="Annual">Annual</SelectItem>
                                <SelectItem value="One-time">One-time</SelectItem>
                                <SelectItem value="Per-incident">Per-incident</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Pricing Tiers */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <FormField
                          control={form.control}
                          name="newActive"
                          render={({ field }) => (
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={!!field.value}
                                onCheckedChange={field.onChange}
                              />
                              <label className="text-sm font-medium">New Active</label>
                            </div>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="newRepPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New Rep Price</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  placeholder="99.00" 
                                  value={field.value || ""} 
                                  onChange={field.onChange} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <FormField
                          control={form.control}
                          name="upgradeActive"
                          render={({ field }) => (
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={!!field.value}
                                onCheckedChange={field.onChange}
                              />
                              <label className="text-sm font-medium">Upgrade Active</label>
                            </div>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="upgradeRepPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Upgrade Rep Price</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  placeholder="89.00" 
                                  value={field.value || ""} 
                                  onChange={field.onChange} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <FormField
                          control={form.control}
                          name="lexmarkActive"
                          render={({ field }) => (
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={!!field.value}
                                onCheckedChange={field.onChange}
                              />
                              <label className="text-sm font-medium">Lexmark Active</label>
                            </div>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="lexmarkRepPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Lexmark Rep Price</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  placeholder="79.00" 
                                  value={field.value || ""} 
                                  onChange={field.onChange} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <FormField
                          control={form.control}
                          name="graphicActive"
                          render={({ field }) => (
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={!!field.value}
                                onCheckedChange={field.onChange}
                              />
                              <label className="text-sm font-medium">Graphic Active</label>
                            </div>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="graphicRepPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Graphic Rep Price</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  placeholder="109.00" 
                                  value={field.value || ""} 
                                  onChange={field.onChange} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="button" variant="outline">
                      Save & New
                    </Button>
                    <Button type="submit" disabled={createServiceMutation.isPending}>
                      {createServiceMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search service products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedServiceType} onValueChange={setSelectedServiceType}>
            <SelectTrigger className="w-48">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Service Types</SelectItem>
              {serviceTypes.map(serviceType => (
                <SelectItem key={serviceType} value={serviceType}>{serviceType}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Services Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-3 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded w-5/6"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredServices.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-8">
            <Settings className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Service Products Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || selectedServiceType !== "all" 
                ? "No service products match your current filters. Try adjusting your search criteria."
                : "Get started by adding your first service product to the catalog."
              }
            </p>
            {!searchTerm && selectedServiceType === "all" && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Service Product
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredServices.length} of {services.length} service products
          </span>
          <span>
            {services.filter(s => s.isActive).length} active products
          </span>
        </div>
      </div>
    </Layout>
  );
}