import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Users,
  FileSpreadsheet,
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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
  skipped: number;
  duplicates: number;
}

interface LeadsImportProps {
  onImportComplete?: () => void;
}

export function LeadsImport({ onImportComplete }: LeadsImportProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sample CSV headers based on business_records schema
  const csvHeaders = [
    "companyName",
    "primaryContactName", 
    "primaryContactEmail",
    "primaryContactPhone",
    "primaryContactTitle",
    "website",
    "industry",
    "employeeCount",
    "annualRevenue",
    "addressLine1",
    "addressLine2", 
    "city",
    "state",
    "postalCode",
    "country",
    "phone",
    "fax",
    "leadSource",
    "estimatedAmount",
    "probability",
    "salesStage",
    "interestLevel",
    "priority",
    "territory",
    "notes",
    "assignedSalesRep"
  ];

  const sampleData = [
    {
      companyName: "Acme Corporation",
      primaryContactName: "John Smith",
      primaryContactEmail: "john.smith@acme.com",
      primaryContactPhone: "(555) 123-4567",
      primaryContactTitle: "IT Director",
      website: "https://www.acme.com",
      industry: "Technology",
      employeeCount: "150",
      annualRevenue: "5000000",
      addressLine1: "123 Business Street",
      addressLine2: "Suite 100",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      country: "US",
      phone: "(555) 123-4567",
      fax: "(555) 123-4568",
      leadSource: "website",
      estimatedAmount: "25000",
      probability: "75",
      salesStage: "qualified",
      interestLevel: "hot",
      priority: "high",
      territory: "Northeast",
      notes: "Interested in copier leasing program",
      assignedSalesRep: "current_user"
    },
    {
      companyName: "Global Services Inc",
      primaryContactName: "Sarah Johnson", 
      primaryContactEmail: "sarah.johnson@globalservices.com",
      primaryContactPhone: "(555) 987-6543",
      primaryContactTitle: "Office Manager",
      website: "https://www.globalservices.com",
      industry: "Professional Services",
      employeeCount: "75",
      annualRevenue: "2500000",
      addressLine1: "456 Commerce Ave",
      addressLine2: "",
      city: "Chicago",
      state: "IL", 
      postalCode: "60601",
      country: "US",
      phone: "(555) 987-6543",
      fax: "",
      leadSource: "referral",
      estimatedAmount: "15000",
      probability: "50",
      salesStage: "contacted",
      interestLevel: "warm",
      priority: "medium",
      territory: "Midwest",
      notes: "Looking to upgrade existing fleet",
      assignedSalesRep: "current_user"
    }
  ];

  // Download sample CSV template
  const downloadTemplate = () => {
    const csvContent = [
      csvHeaders.join(","),
      ...sampleData.map(row => 
        csvHeaders.map(header => {
          const value = row[header as keyof typeof row] || "";
          // Escape values that contain commas or quotes
          if (value.includes(",") || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "leads-import-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import leads mutation
  const importLeadsMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/business-records/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Import failed");
      }
      
      return await response.json();
    },
    onSuccess: (result) => {
      setImportResult(result);
      toast({
        title: "Import Completed",
        description: `Successfully imported ${result.imported} leads. ${result.skipped > 0 ? `${result.skipped} rows skipped.` : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/business-records"] });
      onImportComplete?.();
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "An error occurred during import",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      setSelectedFile(file);
      setImportResult(null);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file",
        variant: "destructive",
      });
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      importLeadsMutation.mutate(selectedFile);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedFile(null);
    setImportResult(null);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Import Leads
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Import Leads from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to import leads into your system. Download the template to see the required format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Download */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Step 1: Download Template
              </CardTitle>
              <CardDescription>
                Download the CSV template with sample data and all required headers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={downloadTemplate} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download Template (CSV)
              </Button>
              <div className="mt-3 text-sm text-muted-foreground">
                <p>Template includes sample data for:</p>
                <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
                  <span>• Company Information</span>
                  <span>• Contact Details</span>
                  <span>• Address Fields</span>
                  <span>• Lead Pipeline Data</span>
                  <span>• Assignment Fields</span>
                  <span>• Financial Information</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Step 2: Upload Your CSV File
              </CardTitle>
              <CardDescription>
                Select your completed CSV file to import leads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    Choose CSV File
                  </label>
                  {selectedFile && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{selectedFile.name}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {selectedFile && (
                  <Button
                    onClick={handleImport}
                    disabled={importLeadsMutation.isPending}
                    className="gap-2"
                  >
                    {importLeadsMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Import Leads
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Import Progress/Results */}
          {importLeadsMutation.isPending && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Processing CSV file...</span>
                  </div>
                  <Progress value={50} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import Results */}
          {importResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {importResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  Import Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-green-600">Imported:</span>
                      <span className="ml-2">{importResult.imported} leads</span>
                    </div>
                    <div>
                      <span className="font-medium text-yellow-600">Skipped:</span>
                      <span className="ml-2">{importResult.skipped} rows</span>
                    </div>
                    {importResult.duplicates > 0 && (
                      <div>
                        <span className="font-medium text-blue-600">Duplicates:</span>
                        <span className="ml-2">{importResult.duplicates} found</span>
                      </div>
                    )}
                  </div>

                  {importResult.errors && importResult.errors.length > 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-1">
                          <p className="font-medium">Errors encountered:</p>
                          {importResult.errors.slice(0, 5).map((error, index) => (
                            <p key={index} className="text-sm">• {error}</p>
                          ))}
                          {importResult.errors.length > 5 && (
                            <p className="text-sm">... and {importResult.errors.length - 5} more</p>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleDialogClose}>
              {importResult ? "Close" : "Cancel"}
            </Button>
            {importResult && (
              <Button onClick={handleDialogClose}>
                View Imported Leads
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}