import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Brain, Code, Users, MessageSquare, BarChart3, FileText, Settings, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface GPT5Config {
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
}

const GPT5_CONFIGS: Record<string, GPT5Config> = {
  LEAD_ANALYSIS: {
    name: "Lead Analysis",
    description: "For CRM lead analysis and customer insights",
    icon: Users,
    color: "blue"
  },
  PROPOSAL_GENERATION: {
    name: "Proposal Generation", 
    description: "For quote and proposal generation",
    icon: FileText,
    color: "green"
  },
  SERVICE_ANALYSIS: {
    name: "Service Analysis",
    description: "For service ticket analysis and predictive maintenance",
    icon: Settings,
    color: "orange"
  },
  CUSTOMER_SUPPORT: {
    name: "Customer Support",
    description: "For quick customer support responses",
    icon: MessageSquare,
    color: "purple"
  },
  BUSINESS_ANALYTICS: {
    name: "Business Analytics",
    description: "For complex business analytics and forecasting",
    icon: BarChart3,
    color: "red"
  },
  CODE_GENERATION: {
    name: "Code Generation",
    description: "For code generation and technical tasks",
    icon: Code,
    color: "indigo"
  },
  CLASSIFICATION: {
    name: "Classification",
    description: "For high-throughput classification tasks",
    icon: Brain,
    color: "pink"
  }
};

export default function GPT5Dashboard() {
  const [selectedConfig, setSelectedConfig] = useState<string>("LEAD_ANALYSIS");
  const [prompt, setPrompt] = useState("");
  const [previousResponseId, setPreviousResponseId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get available configurations
  const { data: configsData } = useQuery({
    queryKey: ['/api/ai/gpt5/configs'],
    enabled: true
  });

  // Custom prompt mutation
  const customPromptMutation = useMutation({
    mutationFn: async (data: { prompt: string; configType?: string; previousResponseId?: string }) => {
      return apiRequest('/api/ai/gpt5/custom-prompt', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Response Generated",
        description: "GPT-5 has successfully processed your request."
      });
      setPreviousResponseId(data.responseId);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate response",
        variant: "destructive"
      });
    }
  });

  // Lead analysis mutation
  const leadAnalysisMutation = useMutation({
    mutationFn: async (data: { leadData: any; customerHistory?: any }) => {
      return apiRequest('/api/ai/gpt5/analyze-lead', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      toast({
        title: "Lead Analysis Complete",
        description: "AI-powered lead insights generated successfully."
      });
    }
  });

  // Proposal generation mutation
  const proposalMutation = useMutation({
    mutationFn: async (data: { customerData: any; equipmentRequirements: any; pricingData: any }) => {
      return apiRequest('/api/ai/gpt5/generate-proposal', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      toast({
        title: "Proposal Generated",
        description: "Professional proposal content created successfully."
      });
    }
  });

  // Service analysis mutation
  const serviceAnalysisMutation = useMutation({
    mutationFn: async (data: { ticketData: any; equipmentHistory?: any }) => {
      return apiRequest('/api/ai/gpt5/analyze-service', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      toast({
        title: "Service Analysis Complete",
        description: "Predictive maintenance insights generated."
      });
    }
  });

  // Classification mutation
  const classifyMutation = useMutation({
    mutationFn: async (data: { inquiry: string }) => {
      return apiRequest('/api/ai/gpt5/classify-inquiry', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      toast({
        title: "Classification Complete",
        description: "Customer inquiry categorized successfully."
      });
    }
  });

  const handleCustomPrompt = () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt",
        variant: "destructive"
      });
      return;
    }

    customPromptMutation.mutate({
      prompt,
      configType: selectedConfig,
      previousResponseId: previousResponseId || undefined
    });
  };

  const handleLeadAnalysis = () => {
    const sampleLead = {
      company: "Sample Corp",
      contact: "John Doe",
      email: "john@sample.com",
      phone: "555-0123",
      industry: "Manufacturing",
      employees: 50,
      currentEquipment: "HP LaserJet Pro",
      monthlyCopies: 2500,
      requirements: "Color printing, scanning capabilities"
    };

    leadAnalysisMutation.mutate({
      leadData: sampleLead
    });
  };

  const handleProposalGeneration = () => {
    const sampleData = {
      customerData: {
        company: "Sample Corp",
        contact: "John Doe",
        industry: "Manufacturing"
      },
      equipmentRequirements: {
        type: "Multifunction Printer",
        features: ["Color printing", "Scanning", "Copying"],
        volume: "2500 pages/month"
      },
      pricingData: {
        equipmentCost: 2500,
        monthlyService: 150,
        supplies: 75
      }
    };

    proposalMutation.mutate(sampleData);
  };

  const getCurrentConfig = () => GPT5_CONFIGS[selectedConfig];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              GPT-5 AI Analytics Dashboard
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Advanced AI capabilities for copier dealer management and analytics
          </p>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary">GPT-5 Enabled</Badge>
            <Badge variant="outline">Responses API</Badge>
            <Badge variant="outline">Enterprise Ready</Badge>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="custom" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="custom">Custom Prompts</TabsTrigger>
            <TabsTrigger value="specialized">Specialized Tools</TabsTrigger>
            <TabsTrigger value="configs">Configurations</TabsTrigger>
          </TabsList>

          {/* Custom Prompts Tab */}
          <TabsContent value="custom" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Custom GPT-5 Prompt Interface
                </CardTitle>
                <CardDescription>
                  Execute custom prompts with GPT-5 using different reasoning configurations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="config">AI Configuration</Label>
                    <Select value={selectedConfig} onValueChange={setSelectedConfig}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(GPT5_CONFIGS).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <config.icon className="h-4 w-4" />
                              {config.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {getCurrentConfig() && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {getCurrentConfig().description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="responseId">Previous Response ID (Optional)</Label>
                    <Input
                      id="responseId"
                      value={previousResponseId}
                      onChange={(e) => setPreviousResponseId(e.target.value)}
                      placeholder="Enter response ID for chain of thought"
                    />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Chain previous reasoning for better performance
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">Custom Prompt</Label>
                  <Textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter your custom prompt for GPT-5..."
                    rows={6}
                    className="resize-none"
                  />
                </div>

                <Button
                  onClick={handleCustomPrompt}
                  disabled={customPromptMutation.isPending}
                  className="w-full"
                >
                  {customPromptMutation.isPending ? "Processing..." : "Generate Response"}
                </Button>

                {/* Response Display */}
                {customPromptMutation.data && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="font-semibold mb-2">GPT-5 Response:</h4>
                    <pre className="whitespace-pre-wrap text-sm">
                      {customPromptMutation.data.response}
                    </pre>
                    {customPromptMutation.data.usage && (
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        Tokens: {customPromptMutation.data.usage.total_tokens} | 
                        Response ID: {customPromptMutation.data.responseId}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Specialized Tools Tab */}
          <TabsContent value="specialized" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Lead Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Lead Analysis
                  </CardTitle>
                  <CardDescription>
                    AI-powered customer lead qualification and insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleLeadAnalysis}
                    disabled={leadAnalysisMutation.isPending}
                    className="w-full"
                  >
                    {leadAnalysisMutation.isPending ? "Analyzing..." : "Analyze Sample Lead"}
                  </Button>
                  {leadAnalysisMutation.data && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap">
                        {leadAnalysisMutation.data.analysis}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Proposal Generation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    Proposal Generation
                  </CardTitle>
                  <CardDescription>
                    Generate professional proposals and quotes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleProposalGeneration}
                    disabled={proposalMutation.isPending}
                    className="w-full"
                  >
                    {proposalMutation.isPending ? "Generating..." : "Generate Sample Proposal"}
                  </Button>
                  {proposalMutation.data && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap">
                        {proposalMutation.data.proposal}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Classification Demo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-pink-600" />
                    Inquiry Classification
                  </CardTitle>
                  <CardDescription>
                    Classify customer inquiries automatically
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Input
                      placeholder="Enter customer inquiry..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const value = (e.target as HTMLInputElement).value;
                          if (value.trim()) {
                            classifyMutation.mutate({ inquiry: value });
                          }
                        }
                      }}
                    />
                    <Button
                      onClick={() => {
                        classifyMutation.mutate({ 
                          inquiry: "My printer is making strange noises and won't print color pages properly" 
                        });
                      }}
                      disabled={classifyMutation.isPending}
                      className="w-full"
                      variant="outline"
                    >
                      {classifyMutation.isPending ? "Classifying..." : "Classify Sample Inquiry"}
                    </Button>
                  </div>
                  {classifyMutation.data && (
                    <div className="mt-4 p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap">
                        {classifyMutation.data.classification}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Configurations Tab */}
          <TabsContent value="configs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Available GPT-5 Configurations</CardTitle>
                <CardDescription>
                  Different AI configurations optimized for specific business tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(GPT5_CONFIGS).map(([key, config]) => {
                    const IconComponent = config.icon;
                    return (
                      <div
                        key={key}
                        className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <IconComponent className={`h-6 w-6 text-${config.color}-600`} />
                          <h3 className="font-semibold">{config.name}</h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {config.description}
                        </p>
                        <Badge
                          variant="secondary"
                          className={`mt-2 bg-${config.color}-100 text-${config.color}-800 dark:bg-${config.color}-900 dark:text-${config.color}-200`}
                        >
                          {key}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* API Information */}
            <Card>
              <CardHeader>
                <CardTitle>GPT-5 Implementation Details</CardTitle>
                <CardDescription>
                  Technical information about the GPT-5 integration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100">API Type</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Responses API (Recommended)
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <h4 className="font-semibold text-green-900 dark:text-green-100">Models</h4>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      gpt-5, gpt-5-mini, gpt-5-nano
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100">Features</h4>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Chain of Thought, Custom Tools, Verbosity Control
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h4 className="font-semibold mb-2">Key Features:</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Reasoning effort control (minimal, low, medium, high)</li>
                    <li>Verbosity settings for output length optimization</li>
                    <li>Chain of thought passing between requests</li>
                    <li>Custom tools for Printyx business operations</li>
                    <li>Specialized configurations for different use cases</li>
                    <li>Enterprise-grade authentication and security</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}