import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Code, Edit3, Tag, DollarSign, Filter, Upload, Download, Eye, Edit, Sparkles } from "lucide-react";
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
import MainLayout from "@/components/layout/main-layout";

export default function SoftwareProducts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SoftwareProduct | null>(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const updateProductMutation = useMutation({
    mutationFn: async (data: { id: string } & InsertSoftwareProduct) => {
      return await apiRequest(`/api/software-products/${data.id}`, 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/software-products'] });
      setEditDialogOpen(false);
      editForm.reset();
      setSelectedProduct(null);
      toast({
        title: "Success",
        description: "Software product updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update software product",
        variant: "destructive",
      });
    },
  });

  const csvImportMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/software-products/import', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Import failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/software-products'] });
      setCsvDialogOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast({
        title: "Import Completed",
        description: `Successfully imported ${data.imported} products. ${data.skipped > 0 ? `Skipped ${data.skipped} rows.` : ''}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: "Failed to import CSV data. Please check your file format.",
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
      vendor: null,
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

  // Create form for new products
  const onSubmit = (data: InsertSoftwareProduct) => {
    createProductMutation.mutate(data);
  };

  // Edit form for existing products  
  const editForm = useForm<InsertSoftwareProduct>({
    resolver: zodResolver(insertSoftwareProductSchema),
    defaultValues: {
      tenantId: "",
      productCode: "",
      productName: "",
      vendor: null,
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

  const onEditSubmit = (data: InsertSoftwareProduct) => {
    if (selectedProduct) {
      // Convert empty strings back to null for database storage
      const sanitizedData = {
        ...data,
        productType: data.productType === "" ? null : data.productType,
        category: data.category === "" ? null : data.category,
        accessoryType: data.accessoryType === "" ? null : data.accessoryType,
        paymentType: data.paymentType === "" ? null : data.paymentType,
        description: data.description === "" ? null : data.description,
        summary: data.summary === "" ? null : data.summary,
        note: data.note === "" ? null : data.note,
        eaNotes: data.eaNotes === "" ? null : data.eaNotes,
        configNote: data.configNote === "" ? null : data.configNote,
        relatedProducts: data.relatedProducts === "" ? null : data.relatedProducts,
        standardCost: data.standardCost === "" ? null : data.standardCost,
        standardRepPrice: data.standardRepPrice === "" ? null : data.standardRepPrice,
        newCost: data.newCost === "" ? null : data.newCost,
        newRepPrice: data.newRepPrice === "" ? null : data.newRepPrice,
        upgradeCost: data.upgradeCost === "" ? null : data.upgradeCost,
        upgradeRepPrice: data.upgradeRepPrice === "" ? null : data.upgradeRepPrice,
        priceBookId: data.priceBookId === "" ? null : data.priceBookId,
        tempKey: data.tempKey === "" ? null : data.tempKey,
      };
      updateProductMutation.mutate({ ...sanitizedData, id: selectedProduct.id });
    }
  };

  const handleViewDetails = (product: SoftwareProduct) => {
    setSelectedProduct(product);
    setDetailsDialogOpen(true);
  };

  const handleEdit = (product: SoftwareProduct) => {
    setSelectedProduct(product);
    // Reset the edit form with the product's current values
    // Convert null values to empty strings for Select components
    editForm.reset({
      tenantId: product.tenantId || "",
      productCode: product.productCode || "",
      productName: product.productName || "",
      vendor: product.vendor || "",
      productType: product.productType || "",
      category: product.category || "",
      accessoryType: product.accessoryType || "",
      description: product.description || "",
      summary: product.summary || "",
      note: product.note || "",
      eaNotes: product.eaNotes || "",
      configNote: product.configNote || "",
      relatedProducts: product.relatedProducts || "",
      isActive: product.isActive ?? true,
      availableForAll: product.availableForAll ?? false,
      repostEdit: product.repostEdit ?? false,
      salesRepCredit: product.salesRepCredit ?? true,
      funding: product.funding ?? true,
      lease: product.lease ?? false,
      paymentType: product.paymentType || "",
      standardActive: product.standardActive ?? false,
      standardCost: product.standardCost || "",
      standardRepPrice: product.standardRepPrice || "",
      newActive: product.newActive ?? false,
      newCost: product.newCost || "",
      newRepPrice: product.newRepPrice || "",
      upgradeActive: product.upgradeActive ?? false,
      upgradeCost: product.upgradeCost || "",
      upgradeRepPrice: product.upgradeRepPrice || "",
      priceBookId: product.priceBookId || "",
      tempKey: product.tempKey || "",
    });
    setEditDialogOpen(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      csvImportMutation.mutate(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a valid CSV file",
        variant: "destructive",
      });
    }
  };

  const generateSampleCSV = () => {
    const sampleData = `productCode,productName,productType,category,accessoryType,paymentType,description,standardCost,standardRepPrice,newCost,newRepPrice,upgradeCost,upgradeRepPrice,isActive,availableForAll,salesRepCredit,funding,lease
SW-DMS-001,Document Management Suite,Application,Document Management,Software License,Monthly,Advanced document workflow and management solution,150.00,299.00,120.00,249.00,100.00,199.00,TRUE,TRUE,TRUE,TRUE,FALSE
SW-PRT-002,Print Management Pro,License,Print Management,Add-on Module,Annual,Comprehensive print monitoring and cost control,200.00,399.00,180.00,349.00,150.00,299.00,TRUE,TRUE,TRUE,TRUE,TRUE
SW-UNI-003,UniFlow License,License,UniFlow,Software License,Perpetual,UniFlow document workflow solution,500.00,999.00,450.00,899.00,400.00,799.00,TRUE,FALSE,TRUE,TRUE,FALSE
SW-PCU-004,Papercut MF,Application,Papercut,Cloud Subscription,Monthly,Print management and cost recovery solution,100.00,199.00,80.00,159.00,60.00,119.00,TRUE,TRUE,TRUE,TRUE,FALSE
SW-PLG-005,PrinterLogic Suite,License,PrinterLogic,Software License,Annual,Enterprise printer management solution,300.00,599.00,250.00,499.00,200.00,399.00,TRUE,FALSE,TRUE,TRUE,TRUE
SW-SEC-006,Security Scanner Pro,Application,Security Software,Support Package,Monthly,Document security and compliance scanning,75.00,149.00,60.00,119.00,50.00,99.00,TRUE,TRUE,TRUE,FALSE,FALSE
SW-WFL-007,Workflow Automation,Plugin,Workflow Automation,Add-on Module,Annual,Automated document processing workflows,250.00,499.00,200.00,399.00,175.00,349.00,TRUE,TRUE,TRUE,TRUE,FALSE
SW-CLD-008,Cloud Sync Service,Cloud Service,Cloud Solutions,Cloud Subscription,Monthly,Multi-device cloud synchronization service,50.00,99.00,40.00,79.00,30.00,59.00,TRUE,TRUE,FALSE,TRUE,FALSE`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'software_products_sample.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Sample Downloaded",
      description: "Sample CSV file has been downloaded to help guide your import",
    });
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
      <Card className="h-full flex flex-col hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 space-y-1">
              <CardTitle className="text-base sm:text-lg leading-tight line-clamp-2">
                {product.productName}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                <span className="font-medium">{product.productCode}</span>
                {product.vendor && <span className="ml-2 text-muted-foreground">• {product.vendor}</span>}
                {product.category && <span className="ml-2 text-muted-foreground">• {product.category}</span>}
              </CardDescription>
            </div>
            <Badge 
              variant={product.isActive ? "default" : "secondary"} 
              className={`shrink-0 text-xs ${product.isActive ? 'bg-green-100 text-green-800' : ''}`}
            >
              {product.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col space-y-3 pt-0">
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs">
              {product.productType || 'Software'}
            </Badge>
            {product.category && (
              <Badge variant="outline" className="text-xs">
                {product.category}
              </Badge>
            )}
            {product.paymentType && (
              <Badge variant="outline" className="text-xs">
                {product.paymentType}
              </Badge>
            )}
          </div>

          {product.summary && (
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
              {product.summary}
            </p>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Standard</span>
              </div>
              <p className="text-sm sm:text-base font-bold">
                {product.standardActive ? formatCurrency(product.standardRepPrice) : "Not Set"}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                <span className="text-xs font-medium">New</span>
              </div>
              <p className="text-sm sm:text-base font-bold text-green-600">
                {product.newActive ? formatCurrency(product.newRepPrice) : "Not Set"}
              </p>
            </div>
          </div>

          <Separator className="my-2" />

          <div className="mt-auto space-y-3">
            {(product.salesRepCredit || product.funding) && (
              <div className="flex flex-wrap gap-1">
                {product.salesRepCredit && (
                  <Badge variant="outline" className="text-xs">Rep Credit</Badge>
                )}
                {product.funding && (
                  <Badge variant="outline" className="text-xs">Funding</Badge>
                )}
              </div>
            )}
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 text-xs sm:text-sm py-1 h-8"
                onClick={() => handleViewDetails(product)}
                data-testid={`button-view-details-${product.id}`}
              >
                <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">View Details</span>
                <span className="sm:hidden">View</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 text-xs sm:text-sm py-1 h-8"
                onClick={() => handleEdit(product)}
                data-testid={`button-edit-${product.id}`}
              >
                <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Edit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout title="Software Products" description="Manage software products and licensing">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Software Products</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage software solutions and digital products for your customers
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="sm:hidden">Add</span>
                  <span className="hidden sm:inline">Add Software</span>
                </Button>
              </DialogTrigger>
            </Dialog>
            
            <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Upload className="h-4 w-4 mr-2" />
                  <span className="sm:hidden">Import</span>
                  <span className="hidden sm:inline">Import CSV</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Import Software Products from CSV</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file to import multiple software products at once. Download the sample file for reference.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium">CSV Template</h3>
                        <p className="text-sm text-muted-foreground">Download a sample CSV with example software products and variations</p>
                      </div>
                      <Button variant="outline" onClick={generateSampleCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        Download Sample
                      </Button>
                    </div>
                    
                    <div className="bg-muted p-4 rounded-md">
                      <h4 className="font-medium mb-2">Helpful Variations Included:</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>• <strong>Product Types:</strong> Application, License, Cloud Service, Plugin, Driver</div>
                        <div>• <strong>Categories:</strong> Document Management, UniFlow, Papercut, PrinterLogic, Print Management, Security Software</div>
                        <div>• <strong>Payment Types:</strong> Monthly, Annual, Perpetual</div>
                        <div>• <strong>Accessory Types:</strong> Software License, Add-on Module, Cloud Subscription, Support Package</div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="text-lg font-medium mb-4">Upload CSV File</h3>
                    <div className="space-y-4">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        disabled={csvImportMutation.isPending}
                      />
                      <p className="text-sm text-muted-foreground">
                        Select a CSV file containing your software product data. The file should include columns for 
                        productCode, productName, productType, category, paymentType, and pricing information.
                      </p>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                        name="vendor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vendor</FormLabel>
                            <FormControl>
                              <Input placeholder="Microsoft" value={field.value || ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                                <SelectItem value="none">--None--</SelectItem>
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
                                <SelectItem value="none">--None--</SelectItem>
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
                                <SelectItem value="none">--None--</SelectItem>
                                <SelectItem value="Document Management">Document Management</SelectItem>
                                <SelectItem value="Print Management">Print Management</SelectItem>
                                <SelectItem value="UniFlow">UniFlow</SelectItem>
                                <SelectItem value="Papercut">Papercut</SelectItem>
                                <SelectItem value="PrinterLogic">PrinterLogic</SelectItem>
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
                                <SelectItem value="none">--None--</SelectItem>
                                <SelectItem value="Monthly">Monthly</SelectItem>
                                <SelectItem value="Annual">Annual</SelectItem>
                                <SelectItem value="Perpetual">Perpetual</SelectItem>
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

        {/* View Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedProduct?.productName}</DialogTitle>
              <DialogDescription>
                View detailed information for this software product
              </DialogDescription>
            </DialogHeader>
            {selectedProduct && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Product Code</h4>
                      <p className="font-medium">{selectedProduct.productCode}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Category</h4>
                      <p>{selectedProduct.category || "Not specified"}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Product Type</h4>
                      <p>{selectedProduct.productType || "Not specified"}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Payment Type</h4>
                      <p>{selectedProduct.paymentType || "Not specified"}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                      <Badge variant={selectedProduct.isActive ? "default" : "secondary"}>
                        {selectedProduct.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Features</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.salesRepCredit && <Badge variant="outline">Sales Rep Credit</Badge>}
                        {selectedProduct.funding && <Badge variant="outline">Funding Available</Badge>}
                        {selectedProduct.lease && <Badge variant="outline">Lease Option</Badge>}
                        {selectedProduct.availableForAll && <Badge variant="outline">Available for All</Badge>}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-lg font-semibold">Pricing Information</h4>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <h5 className="font-medium">Standard Pricing</h5>
                        <Badge variant={selectedProduct.standardActive ? "default" : "secondary"}>
                          {selectedProduct.standardActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Cost: {formatCurrency(selectedProduct.standardCost)}</div>
                        <div className="text-lg font-bold">Rep: {formatCurrency(selectedProduct.standardRepPrice)}</div>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <h5 className="font-medium">New Pricing</h5>
                        <Badge variant={selectedProduct.newActive ? "default" : "secondary"}>
                          {selectedProduct.newActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Cost: {formatCurrency(selectedProduct.newCost)}</div>
                        <div className="text-lg font-bold">Rep: {formatCurrency(selectedProduct.newRepPrice)}</div>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <h5 className="font-medium">Upgrade Pricing</h5>
                        <Badge variant={selectedProduct.upgradeActive ? "default" : "secondary"}>
                          {selectedProduct.upgradeActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Cost: {formatCurrency(selectedProduct.upgradeCost)}</div>
                        <div className="text-lg font-bold">Rep: {formatCurrency(selectedProduct.upgradeRepPrice)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {(selectedProduct.description || selectedProduct.summary) && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold">Description</h4>
                      {selectedProduct.summary && (
                        <div>
                          <h5 className="text-sm font-medium text-muted-foreground mb-1">Summary</h5>
                          <p className="text-sm">{selectedProduct.summary}</p>
                        </div>
                      )}
                      {selectedProduct.description && (
                        <div>
                          <h5 className="text-sm font-medium text-muted-foreground mb-1">Description</h5>
                          <p className="text-sm">{selectedProduct.description}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                    Close
                  </Button>
                  <Button type="button" onClick={() => {
                    setDetailsDialogOpen(false);
                    handleEdit(selectedProduct);
                  }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Product
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Product Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Software Product</DialogTitle>
              <DialogDescription>
                Modify the software product information and pricing
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="productCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Code</FormLabel>
                          <FormControl>
                            <Input placeholder="SW-001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="productName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Software Product Name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={editForm.control}
                      name="vendor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor</FormLabel>
                          <FormControl>
                            <Input placeholder="Microsoft" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
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
                              <SelectItem value="none">--None--</SelectItem>
                              <SelectItem value="Application">Application</SelectItem>
                              <SelectItem value="License">License</SelectItem>
                              <SelectItem value="Cloud Service">Cloud Service</SelectItem>
                              <SelectItem value="Plugin">Plugin</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
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
                              <SelectItem value="none">--None--</SelectItem>
                              <SelectItem value="Document Management">Document Management</SelectItem>
                              <SelectItem value="UniFlow">UniFlow</SelectItem>
                              <SelectItem value="Papercut">Papercut</SelectItem>
                              <SelectItem value="PrinterLogic">PrinterLogic</SelectItem>
                              <SelectItem value="Print Management">Print Management</SelectItem>
                              <SelectItem value="Security Software">Security Software</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
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
                              <SelectItem value="none">--None--</SelectItem>
                              <SelectItem value="Monthly">Monthly</SelectItem>
                              <SelectItem value="Annual">Annual</SelectItem>
                              <SelectItem value="Perpetual">Perpetual</SelectItem>
                              <SelectItem value="Per-user">Per-user</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={editForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the software product features and capabilities..."
                            className="min-h-[80px]"
                            value={field.value || ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
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
                      control={editForm.control}
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
                  </div>
                </div>

                <Separator />

                {/* Pricing */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Pricing & Options</h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={editForm.control}
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
                      control={editForm.control}
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
                    <FormField
                      control={editForm.control}
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
                  </div>

                  {/* Standard Pricing */}
                  <div className="space-y-2">
                    <FormField
                      control={editForm.control}
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
                        control={editForm.control}
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
                        control={editForm.control}
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
                      control={editForm.control}
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
                        control={editForm.control}
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
                        control={editForm.control}
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
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateProductMutation.isPending}>
                    {updateProductMutation.isPending ? "Updating..." : "Update Product"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search software products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-48">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="h-3 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded w-5/6"></div>
                    <div className="h-8 bg-muted rounded w-full"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-6 sm:p-8">
            <Code className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-center">No Software Products Found</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              {searchTerm || selectedCategory !== "all" 
                ? "No software products match your current filters. Try adjusting your search criteria."
                : "Get started by adding your first software product to the catalog."
              }
            </p>
            {!searchTerm && selectedCategory === "all" && (
              <Button onClick={() => setDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add First Software Product
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-muted-foreground border-t pt-4">
          <span>
            {filteredProducts.length} of {products.length} software products
          </span>
          <div className="flex gap-4">
            <span>
              {products.filter(p => p.isActive).length} active
            </span>
            <span>
              {products.filter(p => !p.isActive).length} inactive
            </span>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}