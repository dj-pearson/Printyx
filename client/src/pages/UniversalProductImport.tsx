/**
 * Universal Product Import Wizard
 *
 * A comprehensive wizard for importing products with:
 * - Product type selection (Models, Accessories, Services, Software, Supplies, Managed Services)
 * - Smart product type detection from CSV headers
 * - Column mapping with auto-detection and manual override
 * - Validation and duplicate detection
 * - Import execution with progress tracking
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Upload,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Sparkles,
  FileCheck,
  Package,
  Wrench,
  Cpu,
  Monitor,
  Server,
  Cloud,
  LayoutGrid,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wand2,
  Info,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

// Product type definitions with metadata
const PRODUCT_TYPES = [
  {
    id: 'product_models',
    name: 'Product Models',
    description: 'Hardware devices - copiers, printers, MFPs with 3-tier pricing',
    icon: Monitor,
    color: 'text-blue-600 bg-blue-50',
    keywords: ['model', 'copier', 'printer', 'mfp', 'device', 'hardware', 'color_speed', 'bw_speed'],
  },
  {
    id: 'product_accessories',
    name: 'Accessories',
    description: 'Finishers, document feeders, trays, and add-ons',
    icon: Package,
    color: 'text-purple-600 bg-purple-50',
    keywords: ['accessory', 'finisher', 'feeder', 'tray', 'stand', 'cabinet'],
  },
  {
    id: 'service_products',
    name: 'Service Products',
    description: 'Installation, maintenance, and professional services',
    icon: Wrench,
    color: 'text-orange-600 bg-orange-50',
    keywords: ['service', 'installation', 'maintenance', 'support', 'repair'],
  },
  {
    id: 'software_products',
    name: 'Software Products',
    description: 'Software licenses and solutions',
    icon: Cpu,
    color: 'text-green-600 bg-green-50',
    keywords: ['software', 'license', 'version', 'vendor', 'application'],
  },
  {
    id: 'supplies',
    name: 'Supplies',
    description: 'Toner, ink, paper, and consumables',
    icon: Server,
    color: 'text-red-600 bg-red-50',
    keywords: ['supply', 'supplies', 'toner', 'ink', 'paper', 'drum', 'cartridge'],
  },
  {
    id: 'managed_services',
    name: 'Managed Services',
    description: 'IT and managed service packages',
    icon: Cloud,
    color: 'text-cyan-600 bg-cyan-50',
    keywords: ['managed', 'it_service', 'remote_mgmt', 'support_hours', 'response_time'],
  },
];

// Universal import mode - auto-detects product type
const UNIVERSAL_MODE = {
  id: 'universal',
  name: 'Smart Detection',
  description: 'Automatically detect product type from CSV headers',
  icon: Wand2,
  color: 'text-indigo-600 bg-indigo-50',
};

// Wizard steps
const STEPS = [
  { id: 'select-type', title: 'Select Type', description: 'Choose product type' },
  { id: 'upload', title: 'Upload File', description: 'Upload your CSV file' },
  { id: 'mapping', title: 'Map Columns', description: 'Match columns to fields' },
  { id: 'validation', title: 'Validate', description: 'Review and fix issues' },
  { id: 'import', title: 'Import', description: 'Execute the import' },
];

interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  dataType: string;
  isRequired: boolean;
  aiSuggested: boolean;
  userConfirmed: boolean;
}

interface ValidationError {
  rowNumber: number;
  column: string;
  message: string;
}

interface Duplicate {
  id: string;
  rowNumber: number;
  rowData: Record<string, any>;
  existingRecordId: string;
  existingRecordData: Record<string, any>;
  matchScore: number;
  resolution: 'pending' | 'skip' | 'merge' | 'create_new';
}

export default function UniversalProductImport() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [productType, setProductType] = useState<string>('');
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [useAi, setUseAi] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<string>('prompt');

  // Data state
  const [previewData, setPreviewData] = useState<{
    headers: string[];
    rows: Record<string, any>[];
    mappings: ColumnMapping[];
    unmappedColumns: string[];
  } | null>(null);

  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [validationResult, setValidationResult] = useState<{
    validRows: number;
    invalidRows: number;
    errors: ValidationError[];
  } | null>(null);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    merged: number;
    errors: any[];
  } | null>(null);
  const [importProgress, setImportProgress] = useState(0);

  // Fetch template columns when product type changes
  const { data: templateColumns, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ['/api/import/templates', productType],
    queryFn: async () => {
      const response = await apiRequest(`/api/import/templates/${productType}`, 'GET');
      return response;
    },
    enabled: !!productType && productType !== 'universal',
  });

  // Check AI availability
  const { data: aiStatus } = useQuery({
    queryKey: ['/api/import/ai/status'],
    queryFn: async () => {
      const response = await apiRequest('/api/import/ai/status', 'GET');
      return response;
    },
  });

  // Auto-detect product type from CSV headers
  const detectProductType = useCallback((headers: string[]): string | null => {
    const headerLower = headers.map((h) => h.toLowerCase().replace(/[\s_-]/g, ''));

    let bestMatch: { type: string; score: number } | null = null;

    for (const pType of PRODUCT_TYPES) {
      let score = 0;
      for (const keyword of pType.keywords) {
        if (headerLower.some((h) => h.includes(keyword.toLowerCase()))) {
          score++;
        }
      }
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { type: pType.id, score };
      }
    }

    return bestMatch && bestMatch.score > 0 ? bestMatch.type : null;
  }, []);

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/import/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setMappings(data.columnMappings || []);
      setCurrentStep(2);
      toast({
        title: 'File uploaded',
        description: `Found ${data.totalRows} rows. Review column mappings.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Preview mapping mutation
  const previewMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/import/preview-mapping', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Preview failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setMappings(data.mappings || []);

      // Auto-detect product type in universal mode
      if (productType === 'universal' && data.headers) {
        const detected = detectProductType(data.headers);
        if (detected) {
          setDetectedType(detected);
          toast({
            title: 'Product type detected',
            description: `Detected: ${PRODUCT_TYPES.find((t) => t.id === detected)?.name}`,
          });
        }
      }
    },
  });

  // AI mapping mutation
  const aiMappingMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/import/ai/map-columns', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'AI mapping failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setMappings(data.mappings || []);
      toast({
        title: 'AI mapping complete',
        description: `Mapped ${data.mappings?.length || 0} columns with ${Math.round(data.overallConfidence || 0)}% confidence`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'AI mapping failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update mappings mutation
  const updateMappingsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/import/jobs/${jobId}/mappings`, 'PUT', {
        mappings: mappings.map((m) => ({
          sourceColumn: m.sourceColumn,
          targetField: m.targetField,
          confirmed: true,
        })),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Mappings saved',
        description: 'Column mappings have been updated',
      });
    },
  });

  // Validate mutation
  const validateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/import/jobs/${jobId}/validate`, 'POST');
    },
    onSuccess: (data) => {
      setValidationResult({
        validRows: data.validRows,
        invalidRows: data.invalidRows,
        errors: data.validationErrors || [],
      });
      if (data.needsDuplicateReview) {
        fetchDuplicates();
      }
      setCurrentStep(3);
    },
    onError: (error: any) => {
      toast({
        title: 'Validation failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Fetch duplicates
  const fetchDuplicates = async () => {
    try {
      const data = await apiRequest(`/api/import/jobs/${jobId}/duplicates`, 'GET');
      setDuplicates(data.duplicates || []);
    } catch (error) {
      console.error('Failed to fetch duplicates:', error);
    }
  };

  // Resolve duplicate mutation
  const resolveDuplicateMutation = useMutation({
    mutationFn: async ({
      duplicateId,
      resolution,
    }: {
      duplicateId: string;
      resolution: string;
    }) => {
      return await apiRequest(
        `/api/import/jobs/${jobId}/duplicates/${duplicateId}/resolve`,
        'POST',
        { resolution }
      );
    },
    onSuccess: () => {
      fetchDuplicates();
    },
  });

  // Resolve all duplicates mutation
  const resolveAllMutation = useMutation({
    mutationFn: async (resolution: string) => {
      return await apiRequest(`/api/import/jobs/${jobId}/duplicates/resolve-all`, 'POST', {
        resolution,
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Duplicates resolved',
        description: `${data.count} duplicates resolved`,
      });
      fetchDuplicates();
    },
  });

  // Execute import mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/import/jobs/${jobId}/execute`, 'POST');
    },
    onSuccess: (data) => {
      setImportResult({
        imported: data.imported || 0,
        skipped: data.skipped || 0,
        merged: data.merged || 0,
        errors: data.errors || [],
      });
      setImportProgress(100);
      queryClient.invalidateQueries({ queryKey: ['/api/product-models'] });
      queryClient.invalidateQueries({ queryKey: ['/api/product-accessories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/software-products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/managed-services'] });
      toast({
        title: 'Import complete',
        description: `Successfully imported ${data.imported} records`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle file selection
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        setDetectedType(null);

        // Use actual product type or first available for preview
        const previewType = productType === 'universal' ? 'products' : productType;

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('entityType', previewType);
        previewMutation.mutate(formData);
      }
    },
    [productType]
  );

  // Handle upload
  const handleUpload = useCallback(() => {
    if (!file) return;

    // Determine actual product type
    const actualType = productType === 'universal' && detectedType ? detectedType : productType;

    if (!actualType || actualType === 'universal') {
      toast({
        title: 'Select product type',
        description: 'Please select a product type or use Smart Detection',
        variant: 'destructive',
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', actualType);
    formData.append('useAiRefinement', String(useAi));
    formData.append('duplicateStrategy', duplicateStrategy);

    uploadMutation.mutate(formData);
  }, [file, productType, detectedType, useAi, duplicateStrategy]);

  // Handle AI mapping
  const handleAiMapping = useCallback(() => {
    if (!file) return;

    const actualType = productType === 'universal' && detectedType ? detectedType : productType;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', actualType);

    aiMappingMutation.mutate(formData);
  }, [file, productType, detectedType]);

  // Handle mapping change
  const handleMappingChange = useCallback((sourceColumn: string, targetField: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.sourceColumn === sourceColumn ? { ...m, targetField, userConfirmed: true } : m
      )
    );
  }, []);

  // Handle confirm detected type
  const handleConfirmDetectedType = useCallback(() => {
    if (detectedType) {
      setProductType(detectedType);
      toast({
        title: 'Product type confirmed',
        description: `Using: ${PRODUCT_TYPES.find((t) => t.id === detectedType)?.name}`,
      });
    }
  }, [detectedType]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (currentStep === 1) {
      handleUpload();
    } else if (currentStep === 2) {
      updateMappingsMutation.mutate();
      validateMutation.mutate();
    } else if (currentStep === 3) {
      setCurrentStep(4);
      setImportProgress(10);
      executeMutation.mutate();
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  }, [currentStep, handleUpload]);

  // Handle back
  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // Download template
  const handleDownloadTemplate = useCallback(() => {
    const actualType = productType === 'universal' && detectedType ? detectedType : productType;
    if (!actualType || actualType === 'universal') return;
    window.open(`/api/import/templates/${actualType}/download`, '_blank');
  }, [productType, detectedType]);

  // Check if can proceed
  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 0:
        return !!productType;
      case 1:
        return !!file && (productType !== 'universal' || !!detectedType);
      case 2:
        return mappings.some((m) => m.targetField);
      case 3:
        return (
          (validationResult && validationResult.invalidRows === 0) ||
          duplicates.every((d) => d.resolution !== 'pending')
        );
      default:
        return false;
    }
  }, [currentStep, productType, file, detectedType, mappings, validationResult, duplicates]);

  // Calculate pending duplicates
  const pendingDuplicates = duplicates.filter((d) => d.resolution === 'pending').length;

  // Get actual product type for display
  const getActualProductType = () => {
    if (productType === 'universal' && detectedType) {
      return PRODUCT_TYPES.find((t) => t.id === detectedType);
    }
    return PRODUCT_TYPES.find((t) => t.id === productType);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/settings/products')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" />
                  Universal Product Import
                </h1>
                <p className="text-sm text-muted-foreground">
                  Import products from CSV with smart field mapping
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(productType && productType !== 'universal') || detectedType ? (
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-2',
                  idx < currentStep && 'text-primary',
                  idx === currentStep && 'text-primary font-medium',
                  idx > currentStep && 'text-muted-foreground'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm',
                    idx < currentStep && 'bg-primary text-primary-foreground',
                    idx === currentStep && 'bg-primary text-primary-foreground',
                    idx > currentStep && 'bg-muted text-muted-foreground'
                  )}
                >
                  {idx < currentStep ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="hidden md:block">
                  <div className="text-sm">{step.title}</div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'hidden md:block h-px w-16 mx-2',
                      idx < currentStep ? 'bg-primary' : 'bg-border'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Step 0: Select Product Type */}
        {currentStep === 0 && (
          <div className="max-w-5xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Select Product Type</CardTitle>
                <CardDescription>
                  Choose which type of product you want to import, or use Smart Detection to
                  auto-detect from your CSV
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Universal/Smart Detection Mode */}
                  <Card
                    onClick={() => setProductType(UNIVERSAL_MODE.id)}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md col-span-2 md:col-span-4',
                      productType === UNIVERSAL_MODE.id && 'ring-2 ring-primary'
                    )}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={cn('p-3 rounded-lg', UNIVERSAL_MODE.color)}>
                        <UNIVERSAL_MODE.icon className="h-8 w-8" />
                      </div>
                      <div>
                        <h3 className="font-medium">{UNIVERSAL_MODE.name}</h3>
                        <p className="text-sm text-muted-foreground">{UNIVERSAL_MODE.description}</p>
                      </div>
                      {productType === UNIVERSAL_MODE.id && (
                        <Badge className="ml-auto">Selected</Badge>
                      )}
                    </CardContent>
                  </Card>

                  {/* Specific Product Types */}
                  {PRODUCT_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = productType === type.id;
                    return (
                      <Card
                        key={type.id}
                        onClick={() => setProductType(type.id)}
                        className={cn(
                          'cursor-pointer transition-all hover:shadow-md',
                          isSelected && 'ring-2 ring-primary'
                        )}
                      >
                        <CardContent className="p-4 text-center">
                          <div className={cn('p-2 rounded-lg inline-block mb-2', type.color)}>
                            <Icon className="h-8 w-8" />
                          </div>
                          <h3 className="font-medium text-sm">{type.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 1: Upload File */}
        {currentStep === 1 && (
          <div className="max-w-4xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload your CSV file</CardTitle>
                <CardDescription>
                  Select a CSV file to import. Maximum file size is 10MB.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* File upload area */}
                <div
                  className={cn(
                    'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                    file
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  )}
                >
                  {file ? (
                    <div className="space-y-2">
                      <FileCheck className="h-12 w-12 mx-auto text-primary" />
                      <div className="font-medium">{file.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFile(null);
                          setPreviewData(null);
                          setDetectedType(null);
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <div className="font-medium">Click to upload or drag and drop</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        CSV files only, up to 10MB
                      </div>
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                </div>

                {/* Detected Type Alert (for Universal mode) */}
                {productType === 'universal' && detectedType && (
                  <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertTitle>Product Type Detected</AlertTitle>
                    <AlertDescription className="flex items-center justify-between">
                      <span>
                        Based on your CSV headers, this appears to be:{' '}
                        <strong>{PRODUCT_TYPES.find((t) => t.id === detectedType)?.name}</strong>
                      </span>
                      <Button size="sm" onClick={handleConfirmDetectedType}>
                        Confirm & Use
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Options */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        AI-Powered Mapping
                        {!aiStatus?.available && <Badge variant="secondary">Premium</Badge>}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Use AI to automatically map columns to fields
                      </p>
                    </div>
                    <Switch
                      checked={useAi}
                      onCheckedChange={setUseAi}
                      disabled={!aiStatus?.available}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Duplicate Handling</Label>
                    <RadioGroup value={duplicateStrategy} onValueChange={setDuplicateStrategy}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="prompt" id="prompt" />
                        <Label htmlFor="prompt" className="font-normal">
                          Review each duplicate
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="skip_all" id="skip_all" />
                        <Label htmlFor="skip_all" className="font-normal">
                          Skip all duplicates
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="merge_all" id="merge_all" />
                        <Label htmlFor="merge_all" className="font-normal">
                          Merge with existing records
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="create_all" id="create_all" />
                        <Label htmlFor="create_all" className="font-normal">
                          Create new records anyway
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                {/* Preview */}
                {previewData && previewData.rows.length > 0 && (
                  <div className="space-y-2">
                    <Label>Preview (first 5 rows)</Label>
                    <ScrollArea className="h-48 border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {previewData.headers.map((header) => (
                              <TableHead key={header} className="whitespace-nowrap">
                                {header}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.rows.slice(0, 5).map((row, idx) => (
                            <TableRow key={idx}>
                              {previewData.headers.map((header) => (
                                <TableCell key={header} className="whitespace-nowrap">
                                  {row[header] || '—'}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {currentStep === 2 && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Product Type Badge */}
            {getActualProductType() && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Importing to: {getActualProductType()?.name}</AlertTitle>
                <AlertDescription>
                  {getActualProductType()?.description}
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Map Columns</CardTitle>
                    <CardDescription>
                      Match your CSV columns to the corresponding product fields
                    </CardDescription>
                  </div>
                  {aiStatus?.available && (
                    <Button
                      variant="outline"
                      onClick={handleAiMapping}
                      disabled={aiMappingMutation.isPending}
                    >
                      {aiMappingMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      AI Map Columns
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CSV Column</TableHead>
                      <TableHead>Map To Field</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Sample Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((mapping) => {
                      const sampleValue = previewData?.rows?.[0]?.[mapping.sourceColumn];
                      return (
                        <TableRow key={mapping.sourceColumn}>
                          <TableCell className="font-medium">{mapping.sourceColumn}</TableCell>
                          <TableCell>
                            <Select
                              value={mapping.targetField || ''}
                              onValueChange={(value) =>
                                handleMappingChange(mapping.sourceColumn, value)
                              }
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select field..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">-- Do not import --</SelectItem>
                                {templateColumns?.columns?.map((col: any) => (
                                  <SelectItem key={col.dbField} value={col.dbField}>
                                    {col.name}
                                    {col.required && ' *'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {mapping.aiSuggested && (
                              <div className="flex items-center gap-2">
                                <Progress value={mapping.confidence} className="w-16 h-2" />
                                <span className="text-sm text-muted-foreground">
                                  {mapping.confidence}%
                                </span>
                                {mapping.confidence >= 80 && (
                                  <Sparkles className="h-4 w-4 text-primary" />
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {sampleValue || '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {previewData?.unmappedColumns && previewData.unmappedColumns.length > 0 && (
                  <Alert variant="default" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Unmapped Columns</AlertTitle>
                    <AlertDescription>
                      The following columns were not automatically mapped:{' '}
                      {previewData.unmappedColumns.join(', ')}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Validation */}
        {currentStep === 3 && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Validation Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Validation Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                      <div className="text-2xl font-bold">{validationResult?.validRows || 0}</div>
                      <div className="text-sm text-muted-foreground">Valid Rows</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <XCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
                      <div className="text-2xl font-bold">{validationResult?.invalidRows || 0}</div>
                      <div className="text-sm text-muted-foreground">Invalid Rows</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <AlertTriangle className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                      <div className="text-2xl font-bold">{duplicates.length}</div>
                      <div className="text-sm text-muted-foreground">Duplicates Found</div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Validation Errors */}
            {validationResult?.errors && validationResult.errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Validation Errors</CardTitle>
                  <CardDescription>These rows have issues that need to be fixed</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Column</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationResult.errors.slice(0, 50).map((error, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{error.rowNumber}</TableCell>
                            <TableCell>{error.column}</TableCell>
                            <TableCell>{error.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Duplicates */}
            {duplicates.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Duplicate Records</CardTitle>
                      <CardDescription>
                        {pendingDuplicates} duplicates need resolution
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveAllMutation.mutate('skip')}
                        disabled={resolveAllMutation.isPending}
                      >
                        Skip All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveAllMutation.mutate('create_new')}
                        disabled={resolveAllMutation.isPending}
                      >
                        Create All New
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {duplicates.map((dup) => (
                      <div
                        key={dup.id}
                        className={cn(
                          'p-4 border rounded-lg mb-2',
                          dup.resolution === 'pending'
                            ? 'border-yellow-500 bg-yellow-50'
                            : 'border-green-500 bg-green-50'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">Row {dup.rowNumber}</div>
                          <Badge variant={dup.resolution === 'pending' ? 'secondary' : 'default'}>
                            {dup.resolution === 'pending'
                              ? `${dup.matchScore}% match`
                              : dup.resolution}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground mb-1">Import Data</div>
                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(dup.rowData, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <div className="text-muted-foreground mb-1">Existing Record</div>
                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(dup.existingRecordData, null, 2)}
                            </pre>
                          </div>
                        </div>
                        {dup.resolution === 'pending' && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                resolveDuplicateMutation.mutate({
                                  duplicateId: dup.id,
                                  resolution: 'skip',
                                })
                              }
                            >
                              Skip
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                resolveDuplicateMutation.mutate({
                                  duplicateId: dup.id,
                                  resolution: 'merge',
                                })
                              }
                            >
                              Merge
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                resolveDuplicateMutation.mutate({
                                  duplicateId: dup.id,
                                  resolution: 'create_new',
                                })
                              }
                            >
                              Create New
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 4: Import */}
        {currentStep === 4 && (
          <div className="max-w-xl mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CardTitle>{importResult ? 'Import Complete' : 'Importing Products...'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Progress value={importProgress} className="h-3" />

                {!importResult ? (
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">
                      Please wait while we import your products...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-3xl font-bold text-green-600">
                          {importResult.imported}
                        </div>
                        <div className="text-sm text-muted-foreground">Imported</div>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-yellow-600">
                          {importResult.skipped}
                        </div>
                        <div className="text-sm text-muted-foreground">Skipped</div>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-blue-600">
                          {importResult.merged}
                        </div>
                        <div className="text-sm text-muted-foreground">Merged</div>
                      </div>
                    </div>

                    {importResult.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Some errors occurred</AlertTitle>
                        <AlertDescription>
                          {importResult.errors.length} records failed to import
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex justify-center gap-4 pt-4">
                      <Button variant="outline" onClick={() => navigate('/settings/products')}>
                        Back to Products
                      </Button>
                      <Button
                        onClick={() => {
                          setCurrentStep(0);
                          setProductType('');
                          setDetectedType(null);
                          setFile(null);
                          setJobId(null);
                          setPreviewData(null);
                          setMappings([]);
                          setValidationResult(null);
                          setDuplicates([]);
                          setImportResult(null);
                          setImportProgress(0);
                        }}
                      >
                        Import Another File
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      {currentStep < 4 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canProceed() || uploadMutation.isPending || validateMutation.isPending}
              >
                {(uploadMutation.isPending || validateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {currentStep === STEPS.length - 2 ? 'Start Import' : 'Next'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
