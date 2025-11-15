import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Star,
  StarOff,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface QuoteTemplate {
  id: string;
  name: string;
  description?: string;
  lineItems: any[];
  notes?: string;
  validityDays?: number;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
}

interface QuoteTemplatesProps {
  onApplyTemplate?: (template: QuoteTemplate) => void;
  className?: string;
}

export function QuoteTemplates({ onApplyTemplate, className }: QuoteTemplatesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = React.useState(false);
  const [selectedTemplate, setSelectedTemplate] = React.useState<QuoteTemplate | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<QuoteTemplate | null>(null);

  // Fetch templates from localStorage (in a real app, this would be an API call)
  const { data: templates = [] } = useQuery<QuoteTemplate[]>({
    queryKey: ['/api/quote-templates'],
    queryFn: async () => {
      // For now, use localStorage. In production, replace with API call
      const stored = localStorage.getItem('quoteTemplates');
      return stored ? JSON.parse(stored) : [];
    },
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: QuoteTemplate) => {
      // In production, this would be an API call
      const existing = localStorage.getItem('quoteTemplates');
      const templates: QuoteTemplate[] = existing ? JSON.parse(existing) : [];

      const index = templates.findIndex(t => t.id === template.id);
      if (index >= 0) {
        templates[index] = template;
      } else {
        templates.push(template);
      }

      localStorage.setItem('quoteTemplates', JSON.stringify(templates));
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quote-templates'] });
      toast({
        title: 'Success',
        description: 'Template saved successfully',
      });
      setEditingTemplate(null);
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const existing = localStorage.getItem('quoteTemplates');
      const templates: QuoteTemplate[] = existing ? JSON.parse(existing) : [];
      const filtered = templates.filter(t => t.id !== templateId);
      localStorage.setItem('quoteTemplates', JSON.stringify(filtered));
      return templateId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quote-templates'] });
      toast({
        title: 'Success',
        description: 'Template deleted successfully',
      });
      setShowDeleteDialog(false);
      setSelectedTemplate(null);
    },
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const existing = localStorage.getItem('quoteTemplates');
      const templates: QuoteTemplate[] = existing ? JSON.parse(existing) : [];
      const template = templates.find(t => t.id === templateId);
      if (template) {
        template.isFavorite = !template.isFavorite;
        localStorage.setItem('quoteTemplates', JSON.stringify(templates));
      }
      return templateId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quote-templates'] });
    },
  });

  const handleApplyTemplate = (template: QuoteTemplate) => {
    // Increment usage count
    const existing = localStorage.getItem('quoteTemplates');
    const templates: QuoteTemplate[] = existing ? JSON.parse(existing) : [];
    const foundTemplate = templates.find(t => t.id === template.id);
    if (foundTemplate) {
      foundTemplate.usageCount = (foundTemplate.usageCount || 0) + 1;
      localStorage.setItem('quoteTemplates', JSON.stringify(templates));
    }

    if (onApplyTemplate) {
      onApplyTemplate(template);
      setShowDialog(false);
      toast({
        title: 'Template Applied',
        description: `${template.name} has been applied to your quote`,
      });
    }
  };

  const handleDeleteTemplate = () => {
    if (selectedTemplate) {
      deleteTemplateMutation.mutate(selectedTemplate.id);
    }
  };

  const sortedTemplates = React.useMemo(() => {
    return [...templates].sort((a, b) => {
      // Favorites first
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      // Then by usage count
      return (b.usageCount || 0) - (a.usageCount || 0);
    });
  }, [templates]);

  return (
    <>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" className={className}>
            <FileText className="h-4 w-4 mr-2" />
            Use Template
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Quote Templates</DialogTitle>
            <DialogDescription>
              Choose a template to quickly create a quote with pre-configured items and settings.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {templates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Templates Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first template to save time on future quotes
                </p>
                <p className="text-sm text-muted-foreground">
                  Templates can be created from the quote builder by clicking "Save as Template"
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      template.isFavorite && "border-yellow-400 border-2"
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            {template.isFavorite && (
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            )}
                          </div>
                          {template.description && (
                            <CardDescription className="mt-1">
                              {template.description}
                            </CardDescription>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleApplyTemplate(template)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Use Template
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toggleFavoriteMutation.mutate(template.id)}
                            >
                              {template.isFavorite ? (
                                <>
                                  <StarOff className="h-4 w-4 mr-2" />
                                  Remove from Favorites
                                </>
                              ) : (
                                <>
                                  <Star className="h-4 w-4 mr-2" />
                                  Add to Favorites
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedTemplate(template);
                                setShowDeleteDialog(true);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Template
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Line Items:</span>
                          <Badge variant="secondary">{template.lineItems?.length || 0}</Badge>
                        </div>
                        {template.validityDays && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Valid for:</span>
                            <span className="font-medium">{template.validityDays} days</span>
                          </div>
                        )}
                        {template.usageCount !== undefined && template.usageCount > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Used:</span>
                            <span className="font-medium">{template.usageCount} times</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="text-xs">
                            {format(new Date(template.createdAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                      <Button
                        className="w-full mt-4"
                        onClick={() => handleApplyTemplate(template)}
                      >
                        Use This Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Component to save current quote as template
 */
interface SaveQuoteTemplateProps {
  quoteData: {
    title?: string;
    lineItems: any[];
    notes?: string;
    validityDays?: number;
  };
  onSaved?: () => void;
}

export function SaveQuoteTemplate({ quoteData, onSaved }: SaveQuoteTemplateProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = React.useState(false);
  const [templateName, setTemplateName] = React.useState(quoteData.title || '');
  const [description, setDescription] = React.useState('');

  const handleSave = () => {
    if (!templateName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a template name',
        variant: 'destructive',
      });
      return;
    }

    const template: QuoteTemplate = {
      id: `template-${Date.now()}`,
      name: templateName.trim(),
      description: description.trim() || undefined,
      lineItems: quoteData.lineItems,
      notes: quoteData.notes,
      validityDays: quoteData.validityDays,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
    };

    const existing = localStorage.getItem('quoteTemplates');
    const templates: QuoteTemplate[] = existing ? JSON.parse(existing) : [];
    templates.push(template);
    localStorage.setItem('quoteTemplates', JSON.stringify(templates));

    queryClient.invalidateQueries({ queryKey: ['/api/quote-templates'] });

    toast({
      title: 'Success',
      description: 'Quote saved as template',
    });

    setShowDialog(false);
    setTemplateName('');
    setDescription('');

    if (onSaved) onSaved();
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="h-4 w-4 mr-2" />
          Save as Template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Quote as Template</DialogTitle>
          <DialogDescription>
            Save this quote configuration as a template for future use.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              placeholder="e.g., Standard Office Equipment Package"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description (Optional)</Label>
            <Textarea
              id="template-description"
              placeholder="Describe when to use this template..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="rounded-lg border p-3 bg-muted/50">
            <div className="text-sm font-medium mb-1">Template will include:</div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {quoteData.lineItems.length} line items</li>
              {quoteData.notes && <li>• Quote notes</li>}
              {quoteData.validityDays && <li>• Validity period ({quoteData.validityDays} days)</li>}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <FileText className="h-4 w-4 mr-2" />
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
