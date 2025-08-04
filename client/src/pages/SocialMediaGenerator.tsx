import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Send, 
  Plus, 
  Calendar, 
  Clock, 
  Twitter, 
  Facebook, 
  Linkedin, 
  Globe,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Copy,
  ExternalLink,
  Zap
} from "lucide-react";
import { format } from "date-fns";
import MainLayout from "@/components/layout/main-layout";

interface SocialMediaPost {
  id: string;
  title: string;
  shortContent: string;
  longContent: string;
  websiteLink: string;
  status: 'draft' | 'generated' | 'published' | 'failed';
  generationType: 'manual' | 'scheduled' | 'cron';
  targetPlatforms: string[];
  webhookStatus: string;
  createdAt: string;
  scheduledFor?: string;
}

interface CronJob {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  isActive: boolean;
  promptTemplate: string;
  targetPlatforms: string[];
  webhookUrl: string;
  lastExecuted?: string;
  nextExecution?: string;
  executionCount: number;
  failureCount: number;
}

export default function SocialMediaGenerator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("manual");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Manual Generation Form State
  const [manualForm, setManualForm] = useState({
    prompt: "",
    platforms: ["twitter", "facebook", "linkedin"],
    webhookUrl: "",
    generateNow: true
  });

  // Cron Job Form State
  const [cronForm, setCronForm] = useState({
    name: "",
    description: "",
    cronExpression: "0 9 * * 1", // Monday at 9 AM
    promptTemplate: "",
    platforms: ["twitter", "facebook", "linkedin"],
    webhookUrl: "",
    isActive: true
  });

  const [editingCron, setEditingCron] = useState<CronJob | null>(null);
  const [showCronDialog, setShowCronDialog] = useState(false);

  // Fetch social media posts
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['/api/social-media/posts'],
  });

  // Fetch cron jobs
  const { data: cronJobs = [], isLoading: cronLoading } = useQuery({
    queryKey: ['/api/social-media/cron-jobs'],
  });

  // Generate post mutation
  const generatePostMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/social-media/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to generate post');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-media/posts'] });
      toast({ title: "Post generated successfully!" });
      setManualForm({ prompt: "", platforms: ["twitter", "facebook", "linkedin"], webhookUrl: "", generateNow: true });
      setIsGenerating(false);
    },
    onError: (error: any) => {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
      setIsGenerating(false);
    },
  });

  // Create cron job mutation
  const createCronMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/social-media/cron-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create cron job');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-media/cron-jobs'] });
      toast({ title: "Cron job created successfully!" });
      setCronForm({
        name: "",
        description: "",
        cronExpression: "0 9 * * 1",
        promptTemplate: "",
        platforms: ["twitter", "facebook", "linkedin"],
        webhookUrl: "",
        isActive: true
      });
      setShowCronDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to create cron job", description: error.message, variant: "destructive" });
    },
  });

  // Execute cron job mutation
  const executeCronMutation = useMutation({
    mutationFn: async (cronId: string) => {
      const response = await fetch(`/api/social-media/cron-jobs/${cronId}/execute`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to execute cron job');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-media/posts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/social-media/cron-jobs'] });
      toast({ title: "Cron job executed successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Execution failed", description: error.message, variant: "destructive" });
    },
  });

  // Broadcast post mutation
  const broadcastMutation = useMutation({
    mutationFn: async ({ postId, webhookUrl }: { postId: string; webhookUrl: string }) => {
      const response = await fetch(`/api/social-media/posts/${postId}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl }),
      });
      if (!response.ok) throw new Error('Failed to broadcast post');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-media/posts'] });
      toast({ title: "Post broadcasted successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Broadcast failed", description: error.message, variant: "destructive" });
    },
  });

  const handleManualGenerate = () => {
    if (!manualForm.prompt.trim()) {
      toast({ title: "Please enter a prompt", variant: "destructive" });
      return;
    }
    
    setIsGenerating(true);
    generatePostMutation.mutate({
      prompt: manualForm.prompt,
      platforms: manualForm.platforms,
      webhookUrl: manualForm.webhookUrl,
      generationType: 'manual'
    });
  };

  const handleCreateCron = () => {
    if (!cronForm.name.trim() || !cronForm.promptTemplate.trim() || !cronForm.webhookUrl.trim()) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    createCronMutation.mutate({
      name: cronForm.name,
      description: cronForm.description,
      cronExpression: cronForm.cronExpression,
      promptTemplate: cronForm.promptTemplate,
      targetPlatforms: cronForm.platforms,
      webhookUrl: cronForm.webhookUrl,
      isActive: cronForm.isActive
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'generated': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'twitter': return <Twitter className="w-4 h-4" />;
      case 'facebook': return <Facebook className="w-4 h-4" />;
      case 'linkedin': return <Linkedin className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Social Media Generator</h1>
            <p className="text-gray-600 mt-2">Generate and schedule social media posts using Claude 4 AI</p>
          </div>
          <Badge variant="outline" className="flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span>Claude 4 Powered</span>
          </Badge>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual">Manual Generation</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled Posts</TabsTrigger>
            <TabsTrigger value="cron">Automation</TabsTrigger>
          </TabsList>

          {/* Manual Generation */}
          <TabsContent value="manual" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Send className="w-5 h-5" />
                  <span>Generate Social Media Post</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="prompt">Content Prompt</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Describe what kind of post you want to generate (e.g., 'Create a post about the benefits of modern copier technology for small businesses')"
                    value={manualForm.prompt}
                    onChange={(e) => setManualForm(prev => ({ ...prev, prompt: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Target Platforms</Label>
                  <div className="flex space-x-4 mt-2">
                    {[
                      { key: 'twitter', label: 'Twitter', icon: <Twitter className="w-4 h-4" /> },
                      { key: 'facebook', label: 'Facebook', icon: <Facebook className="w-4 h-4" /> },
                      { key: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="w-4 h-4" /> }
                    ].map(platform => (
                      <label key={platform.key} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={manualForm.platforms.includes(platform.key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setManualForm(prev => ({ 
                                ...prev, 
                                platforms: [...prev.platforms, platform.key] 
                              }));
                            } else {
                              setManualForm(prev => ({ 
                                ...prev, 
                                platforms: prev.platforms.filter(p => p !== platform.key) 
                              }));
                            }
                          }}
                          className="rounded"
                        />
                        {platform.icon}
                        <span>{platform.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="webhook">Make.com Webhook URL</Label>
                  <Input
                    id="webhook"
                    placeholder="https://hook.make.com/your-webhook-url"
                    value={manualForm.webhookUrl}
                    onChange={(e) => setManualForm(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Webhook will receive JSON with title, shortContent, longContent, and websiteLink
                  </p>
                </div>

                <Button 
                  onClick={handleManualGenerate} 
                  disabled={isGenerating || !manualForm.prompt.trim()}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                      Generating with Claude 4...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Generate & Broadcast Post
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scheduled Posts */}
          <TabsContent value="scheduled" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Generated Posts</CardTitle>
              </CardHeader>
              <CardContent>
                {postsLoading ? (
                  <div className="text-center py-8">Loading posts...</div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No posts generated yet. Create your first post in the Manual Generation tab.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post: SocialMediaPost) => (
                      <Card key={post.id} className="border">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h3 className="font-semibold">{post.title}</h3>
                                <Badge className={getStatusColor(post.status)}>
                                  {post.status}
                                </Badge>
                                <Badge variant="outline">
                                  {post.generationType}
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                <div>
                                  <Label className="text-sm font-medium text-gray-500">Short Content (Twitter)</Label>
                                  <div className="bg-gray-50 p-3 rounded-md mt-1">
                                    <p className="text-sm">{post.shortContent}</p>
                                    <div className="flex items-center justify-between mt-2">
                                      <span className="text-xs text-gray-500">
                                        {post.shortContent.length}/200 characters
                                      </span>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => copyToClipboard(post.shortContent)}
                                      >
                                        <Copy className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                                
                                <div>
                                  <Label className="text-sm font-medium text-gray-500">Long Content (Facebook/LinkedIn)</Label>
                                  <div className="bg-gray-50 p-3 rounded-md mt-1">
                                    <p className="text-sm">{post.longContent}</p>
                                    <div className="flex items-center justify-between mt-2">
                                      <span className="text-xs text-gray-500">
                                        {post.longContent.length} characters
                                      </span>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => copyToClipboard(post.longContent)}
                                      >
                                        <Copy className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <div className="flex items-center space-x-1">
                                  {post.targetPlatforms.map(platform => (
                                    <span key={platform}>{getPlatformIcon(platform)}</span>
                                  ))}
                                </div>
                                <span>•</span>
                                <span>Created {format(new Date(post.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                                <span>•</span>
                                <a 
                                  href={post.websiteLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-1 text-blue-600 hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>{post.websiteLink}</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cron Jobs */}
          <TabsContent value="cron" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Automated Post Generation</h2>
              <Dialog open={showCronDialog} onOpenChange={setShowCronDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Automation
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Automated Post Generation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="cronName">Automation Name</Label>
                        <Input
                          id="cronName"
                          placeholder="Weekly Marketing Posts"
                          value={cronForm.name}
                          onChange={(e) => setCronForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="cronExpression">Schedule (Cron)</Label>
                        <Select 
                          value={cronForm.cronExpression} 
                          onValueChange={(value) => setCronForm(prev => ({ ...prev, cronExpression: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0 9 * * 1">Monday at 9 AM</SelectItem>
                            <SelectItem value="0 9 * * 3">Wednesday at 9 AM</SelectItem>
                            <SelectItem value="0 9 * * 5">Friday at 9 AM</SelectItem>
                            <SelectItem value="0 9 * * 1,3,5">Mon, Wed, Fri at 9 AM</SelectItem>
                            <SelectItem value="0 9 1 * *">1st of month at 9 AM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="cronDescription">Description</Label>
                      <Input
                        id="cronDescription"
                        placeholder="Generate weekly posts about copier technology and business solutions"
                        value={cronForm.description}
                        onChange={(e) => setCronForm(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>

                    <div>
                      <Label htmlFor="cronPrompt">Prompt Template</Label>
                      <Textarea
                        id="cronPrompt"
                        placeholder="Generate a social media post about copier solutions for business efficiency, highlighting different aspects each time"
                        value={cronForm.promptTemplate}
                        onChange={(e) => setCronForm(prev => ({ ...prev, promptTemplate: e.target.value }))}
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="cronWebhook">Make.com Webhook URL</Label>
                      <Input
                        id="cronWebhook"
                        placeholder="https://hook.make.com/your-webhook-url"
                        value={cronForm.webhookUrl}
                        onChange={(e) => setCronForm(prev => ({ ...prev, webhookUrl: e.target.value }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Active</Label>
                      <Switch
                        checked={cronForm.isActive}
                        onCheckedChange={(checked) => setCronForm(prev => ({ ...prev, isActive: checked }))}
                      />
                    </div>

                    <Button onClick={handleCreateCron} className="w-full">
                      Create Automation
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                {cronLoading ? (
                  <div className="text-center py-8">Loading automations...</div>
                ) : cronJobs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No automations configured yet. Create your first automation above.
                  </div>
                ) : (
                  <div className="divide-y">
                    {cronJobs.map((job: CronJob) => (
                      <div key={job.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="font-semibold">{job.name}</h3>
                              <Badge variant={job.isActive ? "default" : "secondary"}>
                                {job.isActive ? "Active" : "Paused"}
                              </Badge>
                              <Badge variant="outline">
                                <Clock className="w-3 h-3 mr-1" />
                                {job.cronExpression}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2">{job.description}</p>
                            
                            <div className="grid grid-cols-3 gap-4 text-xs text-gray-500">
                              <div>
                                <span className="font-medium">Last Run:</span><br />
                                {job.lastExecuted ? format(new Date(job.lastExecuted), 'MMM dd, HH:mm') : 'Never'}
                              </div>
                              <div>
                                <span className="font-medium">Executions:</span><br />
                                {job.executionCount} total
                              </div>
                              <div>
                                <span className="font-medium">Failures:</span><br />
                                {job.failureCount} failed
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => executeCronMutation.mutate(job.id)}
                              disabled={executeCronMutation.isPending}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}