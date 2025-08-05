import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import {
  Settings,
  Hash,
  Eye,
  Save,
  Plus,
  History,
  FileText,
  Zap,
} from "lucide-react";

interface CustomerNumberConfig {
  id: string;
  tenantId: string;
  prefix: string;
  currentSequence: number;
  sequenceLength: number;
  separatorChar: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CustomerNumberHistory {
  id: string;
  customerNumber: string;
  generatedAt: string;
  generatedBy: string;
  customerId: string;
  configId: string;
}

export default function CustomerNumberSettings() {
  const [formData, setFormData] = useState({
    prefix: "CUST",
    currentSequence: 1000,
    sequenceLength: 4,
    separatorChar: "-",
    isActive: true,
  });
  const [previewData, setPreviewData] = useState<{
    preview: string;
    nextNumbers: string[];
  } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current configurations
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["/api/customer-numbers/config"],
  });

  // Fetch customer number history
  const { data: history = [] } = useQuery({
    queryKey: ["/api/customer-numbers/history"],
  });

  // Create configuration mutation
  const createConfigMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/customer-numbers/config", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-numbers/config"] });
      toast({
        title: "Configuration Created",
        description: "Customer number configuration saved successfully",
      });
      // Reset form
      setFormData({
        prefix: "CUST",
        currentSequence: 1000,
        sequenceLength: 4,
        separatorChar: "-",
        isActive: true,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create configuration",
        variant: "destructive",
      });
    },
  });

  // Generate customer number mutation
  const generateNumberMutation = useMutation({
    mutationFn: () => apiRequest("/api/customer-numbers/generate", "POST"),
    onSuccess: (data) => {
      toast({
        title: "Customer Number Generated",
        description: `Generated: ${data.customerNumber}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/customer-numbers/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customer-numbers/config"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate customer number",
        variant: "destructive",
      });
    },
  });

  // Preview customer number mutation
  const previewMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/customer-numbers/preview", "POST", data),
    onSuccess: (data) => {
      setPreviewData(data);
    },
  });

  const handleFormChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    // Auto-preview on changes
    previewMutation.mutate(newFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createConfigMutation.mutate(formData);
  };

  const generateTestNumber = () => {
    generateNumberMutation.mutate();
  };

  const activeConfig = configs.find((config: CustomerNumberConfig) => config.isActive);

  return (
    <MainLayout>
      <div className="flex-1 space-y-6 p-8 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Customer Number Settings</h2>
            <p className="text-muted-foreground">
              Configure customer number generation for invoices and OCR tracking
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Configuration Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Customer Number Configuration
              </CardTitle>
              <CardDescription>
                Set up automatic customer number generation with custom prefixes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prefix">Prefix</Label>
                  <Input
                    id="prefix"
                    value={formData.prefix}
                    onChange={(e) => handleFormChange("prefix", e.target.value)}
                    placeholder="CUST"
                    maxLength={10}
                  />
                  <p className="text-sm text-muted-foreground">
                    Company abbreviation (e.g., CUST, CLI, ABC)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="separator">Separator</Label>
                  <Select
                    value={formData.separatorChar}
                    onValueChange={(value) => handleFormChange("separatorChar", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-">Dash (-)</SelectItem>
                      <SelectItem value="_">Underscore (_)</SelectItem>
                      <SelectItem value="">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sequence">Starting Number</Label>
                  <Input
                    id="sequence"
                    type="number"
                    value={formData.currentSequence}
                    onChange={(e) => handleFormChange("currentSequence", parseInt(e.target.value) || 1000)}
                    min={1}
                  />
                  <p className="text-sm text-muted-foreground">
                    Next customer number to generate
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="length">Minimum Digits</Label>
                  <Select
                    value={formData.sequenceLength.toString()}
                    onValueChange={(value) => handleFormChange("sequenceLength", parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 digits</SelectItem>
                      <SelectItem value="4">4 digits</SelectItem>
                      <SelectItem value="5">5 digits</SelectItem>
                      <SelectItem value="6">6 digits</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Pad with zeros if needed
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => handleFormChange("isActive", checked)}
                  />
                  <Label htmlFor="active">Set as active configuration</Label>
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={createConfigMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Configuration
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview
              </CardTitle>
              <CardDescription>
                See how your customer numbers will look
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {previewData ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-2">Current format:</div>
                    <div className="text-2xl font-mono font-bold">{previewData.preview}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Next numbers:</div>
                    <div className="space-y-1">
                      {previewData.nextNumbers.map((number, index) => (
                        <div key={index} className="font-mono text-sm p-2 bg-secondary rounded">
                          {number}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Hash className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Preview will appear as you configure settings</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Current Configuration & Actions */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Active Configuration
              </CardTitle>
              <CardDescription>
                Currently active customer number settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeConfig ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Format:</span>
                    <span className="font-mono font-bold">
                      {activeConfig.prefix}{activeConfig.separatorChar}
                      {activeConfig.currentSequence.toString().padStart(activeConfig.sequenceLength, "0")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Next Number:</span>
                    <span className="font-mono">{activeConfig.currentSequence}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <Button 
                    onClick={generateTestNumber}
                    className="w-full mt-4"
                    disabled={generateNumberMutation.isPending}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Test Number
                  </Button>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active configuration</p>
                  <p className="text-sm">Create one to get started</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Customer Numbers
              </CardTitle>
              <CardDescription>
                Recently generated customer numbers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.slice(0, 10).map((item: CustomerNumberHistory) => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-secondary rounded">
                      <span className="font-mono font-bold">{item.customerNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.generatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No customer numbers generated yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Information Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invoice Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Customer numbers automatically appear on all invoices for easy reference and payment attribution.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">OCR Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                OCR systems can read customer numbers from uploaded documents to automatically attribute them to the correct account.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Unique Identification</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Each customer gets a unique, sequential number that never changes, making account management easier.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}