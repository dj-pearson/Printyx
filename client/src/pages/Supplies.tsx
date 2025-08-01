import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Package, Edit3, Tag, DollarSign, Filter, Archive } from "lucide-react";
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
import { insertSupplySchema, type Supply, type InsertSupply } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/layout";
import ProductImport from "@/components/product-import/ProductImport";

export default function Supplies() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: supplies = [], isLoading } = useQuery<Supply[]>({
    queryKey: ['/api/supplies'],
  });

  const createSupplyMutation = useMutation({
    mutationFn: async (data: InsertSupply) => {
      return await apiRequest('/api/supplies', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supplies'] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Supply product created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create supply product",
        variant: "destructive",
      });
    },
  });

  const form = useForm<InsertSupply>({
    resolver: zodResolver(insertSupplySchema),
    defaultValues: {
      tenantId: "",
      productCode: "",
      productName: "",
      productType: "Supplies",
      dealerComp: null,
      inventory: null,
      inStock: null,
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
      priceBookId: null,
      tempKey: null,
    },
  });

  const onSubmit = (data: InsertSupply) => {
    createSupplyMutation.mutate(data);
  };

  // Get unique categories from supplies for filtering
  const categories = Array.from(new Set(supplies.map(s => s.productType).filter(Boolean)));

  // Filter supplies by search and category
  const filteredSupplies = supplies.filter(supply => {
    const matchesSearch = supply.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supply.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (supply.summary && supply.summary.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (selectedCategory === "all") return matchesSearch;
    
    const matchesCategory = supply.productType === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const formatCurrency = (value: string | null) => {
    if (!value) return "$0.00";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(value));
  };

  const SupplyCard = ({ supply }: { supply: Supply }) => {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">{supply.productName}</CardTitle>
              <CardDescription>
                <span className="font-medium">{supply.productCode}</span>
                {supply.dealerComp && <span className="ml-2 text-muted-foreground">• {supply.dealerComp}</span>}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {supply.isActive ? (
                <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
              {supply.inStock && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  <Archive className="h-3 w-3 mr-1" />
                  In Stock: {supply.inStock}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <Badge variant="outline">Supplies</Badge>
            {supply.productType && <Badge variant="outline">{supply.productType}</Badge>}
          </div>

          {supply.summary && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {supply.summary}
            </p>
          )}

          {supply.inventory && (
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Inventory:</span>
              <span className="font-medium">{supply.inventory}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">New Price</span>
              </div>
              <p className="text-lg font-bold text-green-600">
                {supply.newActive ? formatCurrency(supply.newRepPrice) : "Not Set"}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">Upgrade Price</span>
              <p className="text-lg font-bold text-blue-600">
                {supply.upgradeActive ? formatCurrency(supply.upgradeRepPrice) : "Not Set"}
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground space-y-1">
              {supply.paymentType && <div>Payment: {supply.paymentType}</div>}
              <div className="flex gap-2">
                {supply.salesRepCredit && <Badge variant="outline" className="text-xs">Rep Credit</Badge>}
                {supply.funding && <Badge variant="outline" className="text-xs">Funding</Badge>}
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedSupply(supply)}
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
            <h1 className="text-3xl font-bold tracking-tight">Supplies</h1>
            <p className="text-muted-foreground">
              Manage supply products, consumables, and inventory items for your customers
            </p>
          </div>
          <div className="flex gap-2">
            <ProductImport />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Supply
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Price Book List: Supply</DialogTitle>
                <DialogDescription>
                  Create a new supply product for your catalog
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
                              <Input placeholder="Black Toner Cartridge" value={field.value || ""} onChange={field.onChange} />
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
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Supplies">Supplies</SelectItem>
                                <SelectItem value="Toner">Toner</SelectItem>
                                <SelectItem value="Ink">Ink</SelectItem>
                                <SelectItem value="Paper">Paper</SelectItem>
                                <SelectItem value="Maintenance Kit">Maintenance Kit</SelectItem>
                                <SelectItem value="Parts">Parts</SelectItem>
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
                              <Input placeholder="SUP-TON-001" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Record Type</label>
                        <div className="text-sm text-blue-600">Supply</div>
                      </div>
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

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="dealerComp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dealer Comp</FormLabel>
                            <FormControl>
                              <Input placeholder="Standard" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="inventory"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Inventory</FormLabel>
                            <FormControl>
                              <Input placeholder="Main Warehouse" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="inStock"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>In Stock</FormLabel>
                            <FormControl>
                              <Input placeholder="50" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
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
                      name="summary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Summary</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Brief summary of the supply product..."
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
                              placeholder="Additional notes about the supply..."
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
                              placeholder="Related products and compatible equipment..."
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
                                <SelectItem value="One-time">One-time</SelectItem>
                                <SelectItem value="Per-unit">Per-unit</SelectItem>
                                <SelectItem value="Bulk">Bulk</SelectItem>
                                <SelectItem value="Subscription">Subscription</SelectItem>
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
                                  placeholder="89.99" 
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
                                  placeholder="79.99" 
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
                                  placeholder="75.99" 
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
                                  placeholder="99.99" 
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
                              <Input placeholder="PB-SUP-001" value={field.value || ""} onChange={field.onChange} />
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
                              <Input placeholder="TK-SUP-001" value={field.value || ""} onChange={field.onChange} />
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
                    <Button type="submit" disabled={createSupplyMutation.isPending}>
                      {createSupplyMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search supplies..."
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
              <SelectItem value="all">All Supply Types</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Supplies Grid */}
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
        ) : filteredSupplies.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-8">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Supplies Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || selectedCategory !== "all" 
                ? "No supplies match your current filters. Try adjusting your search criteria."
                : "Get started by adding your first supply product to the catalog."
              }
            </p>
            {!searchTerm && selectedCategory === "all" && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Supply
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSupplies.map((supply) => (
              <SupplyCard key={supply.id} supply={supply} />
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredSupplies.length} of {supplies.length} supply products
          </span>
          <span>
            {supplies.filter(s => s.isActive).length} active supplies
          </span>
        </div>
      </div>
    </Layout>
  );
}