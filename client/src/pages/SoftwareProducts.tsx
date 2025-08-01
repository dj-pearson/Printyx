import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Code, Edit3, Tag, DollarSign, Filter } from "lucide-react";
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
import { insertSoftwareProductSchema, type SoftwareProduct, type InsertSoftwareProduct } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/layout";

export default function SoftwareProducts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SoftwareProduct | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery<SoftwareProduct[]>({
    queryKey: ['/api/software-products'],
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: InsertSoftwareProduct) => {
      return await apiRequest('/api/software-products', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/software-products'] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Software product created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create software product",
        variant: "destructive",
      });
    },
  });

  const form = useForm<InsertSoftwareProduct>({
    resolver: zodResolver(insertSoftwareProductSchema),
    defaultValues: {
      tenantId: "",
      productCode: "",
      productName: "",
      productType: null,
      category: null,
      accessoryType: null,
      description: null,
      summary: null,
      note: null,
      eaNotes: null,
      configNote: null,
      relatedProducts: null,
      isActive: true,
      availableForAll: false,
      repostEdit: false,
      salesRepCredit: true,
      funding: true,
      lease: false,
      paymentType: null,
      standardActive: false,
      standardCost: null,
      standardRepPrice: null,
      newActive: false,
      newCost: null,
      newRepPrice: null,
      upgradeActive: false,
      upgradeCost: null,
      upgradeRepPrice: null,
      priceBookId: null,
      tempKey: null,
    },
  });

  const onSubmit = (data: InsertSoftwareProduct) => {
    createProductMutation.mutate(data);
  };

  // Get unique categories from products
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  // Filter products by search and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (selectedCategory === "all") return matchesSearch;
    
    const matchesCategory = product.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const formatCurrency = (value: string | null) => {
    if (!value) return "$0.00";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(value));
  };

  const ProductCard = ({ product }: { product: SoftwareProduct }) => {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">{product.productName}</CardTitle>
              <CardDescription>
                <span className="font-medium">{product.productCode}</span>
                {product.category && <span className="ml-2 text-muted-foreground">• {product.category}</span>}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {product.isActive ? (
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
            <Badge variant="outline">Software</Badge>
            {product.category && <Badge variant="outline">{product.category}</Badge>}
            {product.productType && <Badge variant="outline">{product.productType}</Badge>}
          </div>

          {product.summary && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {product.summary}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Standard Price</span>
              </div>
              <p className="text-lg font-bold">
                {product.standardActive ? formatCurrency(product.standardRepPrice) : "Not Set"}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">New Price</span>
              <p className="text-lg font-bold text-green-600">
                {product.newActive ? formatCurrency(product.newRepPrice) : "Not Set"}
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground space-y-1">
              {product.paymentType && <div>Payment: {product.paymentType}</div>}
              <div className="flex gap-2">
                {product.salesRepCredit && <Badge variant="outline" className="text-xs">Rep Credit</Badge>}
                {product.funding && <Badge variant="outline" className="text-xs">Funding</Badge>}
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedProduct(product)}
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
            <h1 className="text-3xl font-bold tracking-tight">Software Products</h1>
            <p className="text-muted-foreground">
              Manage software solutions and digital products for your customers
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Software
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Price Book List: Software</DialogTitle>
                <DialogDescription>
                  Create a new software product for your catalog
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
                              <Input placeholder="Document Management Suite" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="productType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Type</FormLabel>
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="--None--" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">--None--</SelectItem>
                                <SelectItem value="Application">Application</SelectItem>
                                <SelectItem value="License">License</SelectItem>
                                <SelectItem value="Cloud Service">Cloud Service</SelectItem>
                                <SelectItem value="Plugin">Plugin</SelectItem>
                                <SelectItem value="Driver">Driver</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="productCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Code <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="SW-DMS-001" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Record Type</label>
                        <div className="text-sm text-blue-600">Software</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="accessoryType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Accessory Type</FormLabel>
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="--None--" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">--None--</SelectItem>
                                <SelectItem value="Software License">Software License</SelectItem>
                                <SelectItem value="Add-on Module">Add-on Module</SelectItem>
                                <SelectItem value="Cloud Subscription">Cloud Subscription</SelectItem>
                                <SelectItem value="Support Package">Support Package</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select value={field.value || ""} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="--None--" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">--None--</SelectItem>
                                <SelectItem value="Document Management">Document Management</SelectItem>
                                <SelectItem value="Print Management">Print Management</SelectItem>
                                <SelectItem value="Security Software">Security Software</SelectItem>
                                <SelectItem value="Workflow Automation">Workflow Automation</SelectItem>
                                <SelectItem value="Cloud Solutions">Cloud Solutions</SelectItem>
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

                    <div className="grid grid-cols-2 gap-4">
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
                  </div>

                  <Separator />

                  {/* Detail Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Detail</h3>
                    
                    <FormField
                      control={form.control}
                      name="summary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Summary</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Brief summary of the software product..."
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
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Detailed description of the software product..."
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
                      name="configNote"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Config Note</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Configuration notes and requirements..."
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
                      name="relatedProducts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Related Products</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Related products and dependencies..."
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
                                <SelectItem value="License">License</SelectItem>
                                <SelectItem value="Subscription">Subscription</SelectItem>
                                <SelectItem value="One-time">One-time</SelectItem>
                                <SelectItem value="Per-user">Per-user</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Standard Pricing */}
                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name="standardActive"
                        render={({ field }) => (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                            <label className="text-sm font-medium">Standard Active</label>
                          </div>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="standardCost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Standard Cost</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  placeholder="500.00" 
                                  value={field.value || ""} 
                                  onChange={field.onChange} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="standardRepPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Standard Rep Price</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  placeholder="599.00" 
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

                    {/* New Pricing */}
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
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="newCost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New Cost</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  placeholder="450.00" 
                                  value={field.value || ""} 
                                  onChange={field.onChange} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
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
                                  placeholder="549.00" 
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

                    {/* Upgrade Pricing */}
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
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="upgradeCost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Upgrade Cost</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  placeholder="200.00" 
                                  value={field.value || ""} 
                                  onChange={field.onChange} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
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
                                  placeholder="249.00" 
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

                  <Separator />

                  {/* System Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">System Information</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="priceBookId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price Book ID</FormLabel>
                            <FormControl>
                              <Input placeholder="PB-SW-001" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="tempKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Temp Key</FormLabel>
                            <FormControl>
                              <Input placeholder="TK-SW-001" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="button" variant="outline">
                      Save & New
                    </Button>
                    <Button type="submit" disabled={createProductMutation.isPending}>
                      {createProductMutation.isPending ? "Saving..." : "Save"}
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
              placeholder="Search software products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Products Grid */}
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
        ) : filteredProducts.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-8">
            <Code className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Software Products Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || selectedCategory !== "all" 
                ? "No software products match your current filters. Try adjusting your search criteria."
                : "Get started by adding your first software product to the catalog."
              }
            </p>
            {!searchTerm && selectedCategory === "all" && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Software Product
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredProducts.length} of {products.length} software products
          </span>
          <span>
            {products.filter(p => p.isActive).length} active products
          </span>
        </div>
      </div>
    </Layout>
  );
}