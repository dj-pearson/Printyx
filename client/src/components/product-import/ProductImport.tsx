import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiFormRequest } from "@/lib/queryClient";

interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
  skipped: number;
}

const productTypes = [
  {
    value: "product-models",
    label: "Product Models",
    endpoint: "/api/product-models/import",
  },
  {
    value: "product-accessories",
    label: "Product Accessories",
    endpoint: "/api/product-accessories/import",
  },
  {
    value: "professional-services",
    label: "Professional Services",
    endpoint: "/api/professional-services/import",
  },
  {
    value: "service-products",
    label: "Service Products",
    endpoint: "/api/service-products/import",
  },
  {
    value: "software-products",
    label: "Software Products",
    endpoint: "/api/software-products/import",
  },
  { value: "supplies", label: "Supplies", endpoint: "/api/supplies/import" },
  {
    value: "managed-services",
    label: "IT & Managed Services",
    endpoint: "/api/managed-services/import",
  },
];

const csvTemplates = {
  "product-models": `Product Code,Product Name,Manufacturer,Model,Description,Category,Color Print,BW Print,Color Copy,BW Copy,Standard Cost,Standard Rep Price,New Cost,New Rep Price,Upgrade Cost,Upgrade Rep Price
PM-001,Canon imageRUNNER C3226i,Canon,imageRUNNER C3226i,Multifunction color printer with advanced features,Multifunction,Yes,Yes,Yes,Yes,2500.00,2999.00,2300.00,2799.00,1200.00,1499.00`,

  "product-accessories": `Product Code,Product Name,Accessory Type,Description,Compatible Models,Standard Cost,Standard Rep Price,New Cost,New Rep Price,Upgrade Cost,Upgrade Rep Price
PA-001,Document Feeder DF-701,Document Feeder,50-sheet document feeder for automated scanning,Canon imageRUNNER C3226i,150.00,199.00,140.00,189.00,120.00,159.00`,

  "professional-services": `Product Code,Product Name,Service Category,Service Type,Description,Duration Hours,Standard Cost,Standard Rep Price,New Cost,New Rep Price,Upgrade Cost,Upgrade Rep Price
PS-001,Printer Installation Service,Installation,On-site Installation,Complete printer setup and configuration,2,80.00,120.00,75.00,110.00,65.00,95.00`,

  "service-products": `Product Code,Product Name,Service Category,Service Type,Description,Billing Frequency,Standard Cost,Standard Rep Price,New Cost,New Rep Price,Upgrade Cost,Upgrade Rep Price
SP-001,Monthly Maintenance Plan,Maintenance,Preventive Maintenance,Regular maintenance and cleaning service,Monthly,45.00,65.00,40.00,60.00,35.00,50.00`,

  "software-products": `Product Code,Product Name,Product Type,Category,Description,Payment Type,Standard Cost,Standard Rep Price,New Cost,New Rep Price,Upgrade Cost,Upgrade Rep Price
SW-001,Document Management Suite,Application,Document Management,Comprehensive document management solution,License,800.00,1200.00,750.00,1100.00,400.00,600.00`,

  supplies: `Product Code,Product Name,Product Type,Dealer Comp,Inventory,In Stock,Description,New Rep Price,Upgrade Rep Price,Lexmark Rep Price,Graphic Rep Price
SUP-001,Black Toner Cartridge,Toner,Standard,Main Warehouse,50,High-yield black toner cartridge,89.99,79.99,75.99,95.99`,

  "managed-services": `Product Code,Product Name,Service Type,Service Level,Support Hours,Response Time,Remote Management,Onsite Support,Description,New Rep Price,Upgrade Rep Price,Lexmark Rep Price,Graphic Rep Price
IT-001,Network Monitoring Service,Network Management,Premium,24x7,15 minutes,Yes,Yes,Comprehensive network monitoring with proactive management,299.00,279.00,259.00,319.00`,
};

export default function ProductImport() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async ({
      file,
      productType,
    }: {
      file: File;
      productType: string;
    }) => {
      const formData = new FormData();
      formData.append("file", file);

      const selectedType = productTypes.find((p) => p.value === productType);
      if (!selectedType) throw new Error("Invalid product type");

      // Simulate upload progress
      setUploadProgress(25);

      const response = await apiFormRequest(
        selectedType.endpoint,
        "POST",
        formData
      );

      setUploadProgress(75);

      setUploadProgress(100);
      return response;
    },
    onSuccess: (result: ImportResult) => {
      setImportResult(result);
      setImporting(false);
      setUploadProgress(0);

      if (result.success) {
        // Invalidate relevant queries to refresh data
        const selectedType = productTypes.find(
          (p) => p.value === selectedProductType
        );
        if (selectedType) {
          queryClient.invalidateQueries({
            queryKey: [selectedType.endpoint.replace("/import", "")],
          });
        }

        toast({
          title: "Import Successful",
          description: `Successfully imported ${result.imported} products`,
        });
      } else {
        toast({
          title: "Import Completed with Errors",
          description: `Imported ${result.imported} products, ${result.errors.length} errors`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      setImporting(false);
      setUploadProgress(0);
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
      setImportResult(null);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a valid CSV file",
        variant: "destructive",
      });
    }
  };

  const handleImport = () => {
    if (!file || !selectedProductType) return;

    setImporting(true);
    setImportResult(null);
    importMutation.mutate({ file, productType: selectedProductType });
  };

  const downloadTemplate = (productType: string) => {
    const template = csvTemplates[productType as keyof typeof csvTemplates];
    if (!template) return;

    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${productType}-template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const resetImport = () => {
    setFile(null);
    setSelectedProductType("");
    setImportResult(null);
    setUploadProgress(0);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import Products
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Product Data</DialogTitle>
          <DialogDescription>
            Upload CSV files to bulk import products into your catalog. All data
            will be securely associated with your company account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Product Type</label>
            <Select
              value={selectedProductType}
              onValueChange={setSelectedProductType}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select product type to import" />
              </SelectTrigger>
              <SelectContent>
                {productTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template Download */}
          {selectedProductType && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">CSV Template</CardTitle>
                <CardDescription>
                  Download the template for{" "}
                  {
                    productTypes.find((p) => p.value === selectedProductType)
                      ?.label
                  }{" "}
                  to ensure your data is formatted correctly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => downloadTemplate(selectedProductType)}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV Template
                </Button>
              </CardContent>
            </Card>
          )}

          {/* File Upload */}
          {selectedProductType && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Upload CSV File</label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Click to select CSV file or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    CSV files only. Maximum file size: 10MB
                  </p>
                </label>
              </div>

              {file && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <Badge variant="secondary">
                      {(file.size / 1024).toFixed(1)} KB
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Upload Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing products...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {importResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  Import Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Imported:</span>
                    <span className="ml-2 font-medium text-green-600">
                      {importResult.imported} products
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Skipped:</span>
                    <span className="ml-2 font-medium text-yellow-600">
                      {importResult.skipped} products
                    </span>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-red-600">
                      Errors ({importResult.errors.length}):
                    </span>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {importResult.errors.map((error, index) => (
                        <Alert key={index} variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {error}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Data Security Notice */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Data Security:</strong> All imported data is automatically
              associated with your company account and remains completely
              isolated from other dealers. Your product information is secure
              and private.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
            {importResult && (
              <Button variant="outline" onClick={resetImport}>
                Import Another File
              </Button>
            )}
            <Button
              onClick={handleImport}
              disabled={!file || !selectedProductType || importing}
            >
              {importing ? "Importing..." : "Import Products"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
