/**
 * CSV Import Wizard Component
 *
 * A comprehensive multi-step import wizard that supports:
 * - File upload with drag-and-drop
 * - Column mapping (auto and manual)
 * - Data validation with error preview
 * - Duplicate detection and resolution
 * - AI-powered refinement (premium feature)
 * - Import execution with progress tracking
 */

import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Eye,
  Merge,
  Plus,
  SkipForward,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";

// Types
interface EntityType {
  type: string;
  label: string;
  columnCount: number;
  requiredColumns: number;
}

interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  dataType: string;
  isRequired: boolean;
  aiSuggested: boolean;
  userConfirmed: boolean;
}

interface TemplateColumn {
  name: string;
  dbField: string;
  type: string;
  required: boolean;
  description: string;
  example: string;
}

interface ValidationError {
  rowNumber: number;
  column: string;
  value: any;
  errorType: string;
  message: string;
  suggestion?: string;
}

interface Duplicate {
  id: string;
  rowNumber: number;
  rowData: Record<string, any>;
  existingRecordId: string;
  existingRecordData: Record<string, any>;
  matchingFields: Array<{
    fieldName: string;
    importValue: any;
    existingValue: any;
    similarity: number;
  }>;
  matchScore: number;
  resolution: string;
}

interface ImportJob {
  id: string;
  status: string;
  entityType: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  skippedRows: number;
  mergedRows: number;
  duplicatesDetected: number;
  duplicatesResolved: number;
  columnMappings: ColumnMapping[];
  unmappedColumns: string[];
  validationErrors: ValidationError[];
  aiMappingConfidence?: number;
}

interface CsvImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityType?: string;
  onImportComplete?: (result: any) => void;
}

type WizardStep = "select" | "upload" | "mapping" | "validation" | "duplicates" | "import" | "complete";

export function CsvImportWizard({
  open,
  onOpenChange,
  defaultEntityType,
  onImportComplete,
}: CsvImportWizardProps) {
  const [step, setStep] = useState<WizardStep>("select");
  const [entityType, setEntityType] = useState(defaultEntityType || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [useAiRefinement, setUseAiRefinement] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<string>("prompt");
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [expandedErrors, setExpandedErrors] = useState(false);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch entity types
  const { data: entityTypes = [] } = useQuery<EntityType[]>({
    queryKey: ["/api/import/entity-types"],
    enabled: open,
  });

  // Fetch template columns for selected entity type
  const { data: templateData } = useQuery<{ columns: TemplateColumn[] }>({
    queryKey: ["/api/import/templates", entityType],
    enabled: !!entityType,
  });

  // Fetch import job details
  const { data: importJob, refetch: refetchJob } = useQuery<ImportJob>({
    queryKey: ["/api/import/jobs", importJobId],
    enabled: !!importJobId,
    refetchInterval: (data) => {
      if (data?.status === "processing") return 1000;
      return false;
    },
  });

  // Fetch duplicates
  const { data: duplicatesData } = useQuery<{ duplicates: Duplicate[] }>({
    queryKey: ["/api/import/jobs", importJobId, "duplicates"],
    enabled: !!importJobId && step === "duplicates",
  });

  // Check AI availability
  const { data: aiStatus } = useQuery<{ available: boolean }>({
    queryKey: ["/api/import/ai/status"],
    enabled: open,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/import/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setImportJobId(data.jobId);
      setColumnMappings(data.columnMappings || []);
      setStep("mapping");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message,
      });
    },
  });

  // Validate mutation
  const validateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/import/jobs/${importJobId}/validate`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Validation failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      refetchJob();
      if (data.needsDuplicateReview && data.duplicatesDetected > 0) {
        setStep("duplicates");
      } else if (data.canProceed) {
        setStep("import");
      } else {
        toast({
          variant: "destructive",
          title: "Validation Failed",
          description: "Too many errors to proceed. Please fix the data and try again.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Validation Failed",
        description: error.message,
      });
    },
  });

  // Execute import mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/import/jobs/${importJobId}/execute`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Import failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      refetchJob();
      setStep("complete");
      queryClient.invalidateQueries({ queryKey: ["/api/business-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      if (onImportComplete) {
        onImportComplete(data);
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message,
      });
    },
  });

  // Resolve duplicates mutation
  const resolveAllDuplicatesMutation = useMutation({
    mutationFn: async (resolution: string) => {
      const response = await fetch(`/api/import/jobs/${importJobId}/duplicates/resolve-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to resolve duplicates");
      }
      return response.json();
    },
    onSuccess: () => {
      refetchJob();
      setStep("import");
    },
  });

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      toast({
        variant: "destructive",
        title: "Invalid File",
        description: "Please select a CSV file",
      });
      return;
    }
    setSelectedFile(file);
  }, [toast]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  // Handle upload
  const handleUpload = useCallback(() => {
    if (!selectedFile || !entityType) return;

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("entityType", entityType);
    formData.append("useAiRefinement", String(useAiRefinement));
    formData.append("duplicateStrategy", duplicateStrategy);

    uploadMutation.mutate(formData);
  }, [selectedFile, entityType, useAiRefinement, duplicateStrategy, uploadMutation]);

  // Download template
  const handleDownloadTemplate = useCallback(() => {
    if (!entityType) return;
    window.open(`/api/import/templates/${entityType}/download`, "_blank");
  }, [entityType]);

  // Reset wizard
  const handleReset = useCallback(() => {
    setStep("select");
    setEntityType(defaultEntityType || "");
    setSelectedFile(null);
    setImportJobId(null);
    setColumnMappings([]);
    setSelectedDuplicates({});
  }, [defaultEntityType]);

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case "select":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>What would you like to import?</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select data type..." />
                </SelectTrigger>
                <SelectContent>
                  {entityTypes.map((type) => (
                    <SelectItem key={type.type} value={type.type}>
                      <div className="flex items-center justify-between w-full">
                        <span>{type.label}</span>
                        <Badge variant="outline" className="ml-2">
                          {type.columnCount} fields
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {entityType && templateData && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {templateData.columns.filter((c) => c.required).length} required fields
                  </span>
                  <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </Button>
                </div>

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      View available fields
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ScrollArea className="h-64 mt-2 rounded-md border p-2">
                      <div className="space-y-2">
                        {templateData.columns.map((col) => (
                          <div
                            key={col.dbField}
                            className="flex items-start gap-2 p-2 rounded hover:bg-muted"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{col.name}</span>
                                {col.required && (
                                  <Badge variant="destructive" className="text-xs">
                                    Required
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {col.type}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{col.description}</p>
                              <p className="text-xs text-muted-foreground">
                                Example: {col.example}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </div>
        );

      case "upload":
        return (
          <div className="space-y-6">
            {/* File drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                selectedFile ? "border-green-500 bg-green-50" : "border-muted-foreground/25 hover:border-primary"
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              {selectedFile ? (
                <div className="space-y-2">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="font-medium">Drop your CSV file here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                </div>
              )}
            </div>

            {/* Import options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Duplicate Handling</Label>
                  <p className="text-xs text-muted-foreground">
                    What to do when we find existing records that match
                  </p>
                </div>
                <Select value={duplicateStrategy} onValueChange={setDuplicateStrategy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prompt">Review each</SelectItem>
                    <SelectItem value="skip_all">Skip all</SelectItem>
                    <SelectItem value="merge_all">Merge all</SelectItem>
                    <SelectItem value="create_all">Create new</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {aiStatus?.available && (
                <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-purple-50 to-blue-50">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    <div className="space-y-0.5">
                      <Label>AI-Powered Import</Label>
                      <p className="text-xs text-muted-foreground">
                        Auto-map columns and clean data with AI
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={useAiRefinement}
                    onCheckedChange={setUseAiRefinement}
                  />
                </div>
              )}
            </div>
          </div>
        );

      case "mapping":
        return (
          <div className="space-y-4">
            {importJob?.aiMappingConfidence && (
              <Alert>
                <Sparkles className="w-4 h-4" />
                <AlertTitle>AI Mapping Complete</AlertTitle>
                <AlertDescription>
                  {importJob.aiMappingConfidence}% confidence in column mappings
                </AlertDescription>
              </Alert>
            )}

            <div className="text-sm text-muted-foreground">
              Review and confirm column mappings. Click on a mapping to change it.
            </div>

            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CSV Column</TableHead>
                    <TableHead>Maps To</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columnMappings.map((mapping, index) => (
                    <TableRow key={mapping.sourceColumn}>
                      <TableCell className="font-medium">
                        {mapping.sourceColumn}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping.targetField}
                          onValueChange={(value) => {
                            const newMappings = [...columnMappings];
                            newMappings[index] = {
                              ...mapping,
                              targetField: value,
                              userConfirmed: true,
                            };
                            setColumnMappings(newMappings);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">-- Skip this column --</SelectItem>
                            {templateData?.columns.map((col) => (
                              <SelectItem key={col.dbField} value={col.dbField}>
                                {col.name}
                                {col.required && " *"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            mapping.confidence >= 90
                              ? "default"
                              : mapping.confidence >= 70
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {mapping.confidence}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {mapping.userConfirmed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : mapping.aiSuggested ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Sparkles className="w-4 h-4 text-purple-500" />
                              </TooltipTrigger>
                              <TooltipContent>AI suggested</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Info className="w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {importJob?.unmappedColumns && importJob.unmappedColumns.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertTitle>Unmapped Columns</AlertTitle>
                <AlertDescription>
                  The following columns could not be mapped:{" "}
                  {importJob.unmappedColumns.join(", ")}
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case "validation":
        return (
          <div className="space-y-4">
            {validateMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Validating data...</p>
              </div>
            ) : importJob ? (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-2xl">{importJob.totalRows}</CardTitle>
                      <CardDescription>Total Rows</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-2xl text-green-500">
                        {importJob.validRows}
                      </CardTitle>
                      <CardDescription>Valid</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-2xl text-red-500">
                        {importJob.invalidRows}
                      </CardTitle>
                      <CardDescription>Invalid</CardDescription>
                    </CardHeader>
                  </Card>
                </div>

                {importJob.duplicatesDetected > 0 && (
                  <Alert>
                    <Merge className="w-4 h-4" />
                    <AlertTitle>Duplicates Detected</AlertTitle>
                    <AlertDescription>
                      Found {importJob.duplicatesDetected} potential duplicate records
                    </AlertDescription>
                  </Alert>
                )}

                {importJob.validationErrors && importJob.validationErrors.length > 0 && (
                  <Collapsible open={expandedErrors} onOpenChange={setExpandedErrors}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          {importJob.validationErrors.length} validation errors
                        </span>
                        {expandedErrors ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ScrollArea className="h-48 mt-2 rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Row</TableHead>
                              <TableHead>Column</TableHead>
                              <TableHead>Error</TableHead>
                              <TableHead>Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importJob.validationErrors.slice(0, 50).map((error, i) => (
                              <TableRow key={i}>
                                <TableCell>{error.rowNumber}</TableCell>
                                <TableCell>{error.column}</TableCell>
                                <TableCell>{error.message}</TableCell>
                                <TableCell className="max-w-[100px] truncate">
                                  {String(error.value)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </>
            ) : null}
          </div>
        );

      case "duplicates":
        return (
          <div className="space-y-4">
            <Alert>
              <Merge className="w-4 h-4" />
              <AlertTitle>Resolve Duplicates</AlertTitle>
              <AlertDescription>
                We found records that may already exist. Choose how to handle each one.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => resolveAllDuplicatesMutation.mutate("skip")}
                disabled={resolveAllDuplicatesMutation.isPending}
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Skip All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resolveAllDuplicatesMutation.mutate("merge")}
                disabled={resolveAllDuplicatesMutation.isPending}
              >
                <Merge className="w-4 h-4 mr-1" />
                Merge All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resolveAllDuplicatesMutation.mutate("create_new")}
                disabled={resolveAllDuplicatesMutation.isPending}
              >
                <Plus className="w-4 h-4 mr-1" />
                Create All New
              </Button>
            </div>

            <ScrollArea className="h-[350px] rounded-md border">
              <div className="p-4 space-y-4">
                {duplicatesData?.duplicates.map((dup) => (
                  <Card key={dup.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">
                          Row {dup.rowNumber}
                        </CardTitle>
                        <Badge variant="outline">{dup.matchScore}% match</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium mb-1">Import Data</p>
                          {Object.entries(dup.rowData).slice(0, 3).map(([key, val]) => (
                            <p key={key} className="text-muted-foreground truncate">
                              {key}: {String(val)}
                            </p>
                          ))}
                        </div>
                        <div>
                          <p className="font-medium mb-1">Existing Record</p>
                          {Object.entries(dup.existingRecordData || {}).slice(0, 3).map(([key, val]) => (
                            <p key={key} className="text-muted-foreground truncate">
                              {key}: {String(val)}
                            </p>
                          ))}
                        </div>
                      </div>

                      <RadioGroup
                        value={selectedDuplicates[dup.id] || "skip"}
                        onValueChange={(value) =>
                          setSelectedDuplicates({ ...selectedDuplicates, [dup.id]: value })
                        }
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="skip" id={`skip-${dup.id}`} />
                          <Label htmlFor={`skip-${dup.id}`}>Skip</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="merge" id={`merge-${dup.id}`} />
                          <Label htmlFor={`merge-${dup.id}`}>Merge</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="create_new" id={`create-${dup.id}`} />
                          <Label htmlFor={`create-${dup.id}`}>Create New</Label>
                        </div>
                      </RadioGroup>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        );

      case "import":
        return (
          <div className="space-y-4">
            {executeMutation.isPending || importJob?.status === "processing" ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Importing records...</p>
                {importJob && (
                  <Progress
                    value={
                      ((importJob.importedRows || 0) / (importJob.totalRows || 1)) * 100
                    }
                    className="w-64"
                  />
                )}
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
                <h3 className="text-lg font-semibold">Ready to Import</h3>
                <p className="text-muted-foreground">
                  {importJob?.validRows} records will be imported
                </p>
                <Button onClick={() => executeMutation.mutate()}>
                  Start Import
                </Button>
              </div>
            )}
          </div>
        );

      case "complete":
        return (
          <div className="text-center py-8 space-y-6">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Import Complete!</h3>
              <p className="text-muted-foreground">
                Your data has been successfully imported.
              </p>
            </div>

            {importJob && (
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">
                    {importJob.importedRows}
                  </p>
                  <p className="text-sm text-muted-foreground">Imported</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-500">
                    {importJob.mergedRows}
                  </p>
                  <p className="text-sm text-muted-foreground">Merged</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-muted-foreground">
                    {importJob.skippedRows}
                  </p>
                  <p className="text-sm text-muted-foreground">Skipped</p>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleReset}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Import More
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Navigation buttons
  const canProceed = () => {
    switch (step) {
      case "select":
        return !!entityType;
      case "upload":
        return !!selectedFile;
      case "mapping":
        return columnMappings.length > 0;
      case "validation":
        return importJob?.status !== "failed";
      case "duplicates":
        return true;
      case "import":
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    switch (step) {
      case "select":
        setStep("upload");
        break;
      case "upload":
        handleUpload();
        break;
      case "mapping":
        setStep("validation");
        validateMutation.mutate();
        break;
      case "duplicates":
        setStep("import");
        break;
      default:
        break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case "upload":
        setStep("select");
        break;
      case "mapping":
        setStep("upload");
        break;
      case "validation":
        setStep("mapping");
        break;
      case "duplicates":
        setStep("validation");
        break;
      case "import":
        if (importJob?.duplicatesDetected) {
          setStep("duplicates");
        } else {
          setStep("validation");
        }
        break;
      default:
        break;
    }
  };

  const stepTitles: Record<WizardStep, string> = {
    select: "Select Data Type",
    upload: "Upload CSV File",
    mapping: "Review Column Mapping",
    validation: "Validate Data",
    duplicates: "Resolve Duplicates",
    import: "Import Data",
    complete: "Import Complete",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            CSV Import - {stepTitles[step]}
          </DialogTitle>
          <DialogDescription>
            Import data from a CSV file with automatic mapping and duplicate detection
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        {step !== "complete" && (
          <div className="flex items-center gap-2 py-2">
            {(["select", "upload", "mapping", "validation", "duplicates", "import"] as WizardStep[]).map(
              (s, i) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                      step === s
                        ? "bg-primary text-primary-foreground"
                        : (["select", "upload", "mapping", "validation", "duplicates", "import"] as WizardStep[]).indexOf(step) > i
                        ? "bg-green-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {(["select", "upload", "mapping", "validation", "duplicates", "import"] as WizardStep[]).indexOf(step) > i ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < 5 && (
                    <div
                      className={`w-8 h-0.5 ${
                        (["select", "upload", "mapping", "validation", "duplicates", "import"] as WizardStep[]).indexOf(step) > i
                          ? "bg-green-500"
                          : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              )
            )}
          </div>
        )}

        <Separator />

        {/* Step content */}
        <div className="flex-1 overflow-y-auto py-4">{renderStepContent()}</div>

        {/* Navigation */}
        {step !== "complete" && (
          <>
            <Separator />
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === "select" || uploadMutation.isPending || validateMutation.isPending}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={
                  !canProceed() ||
                  uploadMutation.isPending ||
                  validateMutation.isPending ||
                  executeMutation.isPending
                }
              >
                {uploadMutation.isPending || validateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {step === "import" ? "Start Import" : "Next"}
                {step !== "import" && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CsvImportWizard;
