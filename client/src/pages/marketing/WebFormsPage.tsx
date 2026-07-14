/**
 * CRMX-011: Web Forms admin — list + create. Each form links to the builder.
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import MainLayout from '@/components/layout/main-layout';
import { useWebForms } from '@/hooks/useWebForms';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, FileText, ArrowRight } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  published: 'default',
  draft: 'secondary',
  archived: 'outline',
};

export default function WebFormsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { forms, isLoading, isError, createForm } = useWebForms();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const created = await createForm.mutateAsync({ name: name.trim(), description });
      setShowCreate(false);
      setName('');
      setDescription('');
      toast({ title: 'Form created' });
      navigate(`/marketing/forms/${(created as { id: string }).id}`);
    } catch {
      toast({ title: 'Failed to create form', variant: 'destructive' });
    }
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Web Forms</h1>
            <p className="text-muted-foreground text-sm">
              Capture leads from embeddable forms and landing pages.
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Form
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Failed to load forms. Please try again.
            </CardContent>
          </Card>
        ) : forms.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium">No forms yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Build a form to start capturing leads from your website.
              </p>
              <Button onClick={() => setShowCreate(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Create your first form
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {forms.map((form) => (
              <Card
                key={form.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/marketing/forms/${form.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base truncate">{form.name}</CardTitle>
                    <Badge
                      variant={STATUS_VARIANT[form.status] ?? 'secondary'}
                      className="capitalize"
                    >
                      {form.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="line-clamp-2 min-h-[2.5rem]">
                    {form.description || 'No description'}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span>
                      {form.fields?.length ?? 0} field{(form.fields?.length ?? 0) === 1 ? '' : 's'}{' '}
                      · {form.submissionCount} submission{form.submissionCount === 1 ? '' : 's'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>New Web Form</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="form-name">Name</Label>
              <Input
                id="form-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contact Us"
              />
            </div>
            <div>
              <Label htmlFor="form-desc">Description</Label>
              <Textarea
                id="form-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || createForm.isPending}>
              {createForm.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
