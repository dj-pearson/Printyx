/**
 * CrmDealsPage - Unified Deals CRM page using CrmIndexShell.
 * Provides table and board views with saved view management.
 * Part of CRM-002: Unified CRM index pages.
 */
import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import { CrmIndexShell, type CrmViewRenderProps } from '@/components/crm/CrmIndexShell';
import { EnhancedPipelineBoard } from '@/components/crm/EnhancedPipelineBoard';
import { CrmDataTable } from '@/components/crm/CrmDataTable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getCrmObjectConfig } from '@/lib/crm-object-registry';

const createDealSchema = z.object({
  title: z.string().min(1, 'Deal name is required'),
  value: z.string().optional(),
  customerId: z.string().optional(),
  stage: z.string().default('prospecting'),
  probability: z.string().default('50'),
  expectedCloseDate: z.string().optional(),
  description: z.string().optional(),
  priority: z.string().default('medium'),
});

type CreateDealForm = z.infer<typeof createDealSchema>;

export default function CrmDealsPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | undefined>();
  const config = getCrmObjectConfig('deals');

  const form = useForm<CreateDealForm>({
    resolver: zodResolver(createDealSchema),
    defaultValues: {
      title: '',
      value: '',
      stage: 'prospecting',
      probability: '50',
      priority: 'medium',
    },
  });

  // Pipeline templates for the selector
  const { data: pipelineTemplates } = useQuery({
    queryKey: ['/api/pipeline-config/templates'],
    queryFn: () => apiRequest('/api/pipeline-config/templates'),
    enabled: isAuthenticated,
    staleTime: 300_000,
  });

  const createDealMutation = useMutation({
    mutationFn: (data: CreateDealForm) =>
      apiRequest('/api/deals-management/deals', 'POST', {
        ...data,
        value: data.value ? parseFloat(data.value) : 0,
        probability: parseInt(data.probability, 10),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals-management/deals'] });
      setShowCreateDialog(false);
      form.reset();
      toast({ title: 'Deal created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create deal', variant: 'destructive' });
    },
  });

  const handleCreateDeal = (data: CreateDealForm) => {
    createDealMutation.mutate(data);
  };

  // Pipeline selector for header
  const pipelineSelector = pipelineTemplates?.length > 1 ? (
    <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
      <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs">
        <SelectValue placeholder="Pipeline" />
      </SelectTrigger>
      <SelectContent>
        {pipelineTemplates?.map((p: any) => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : null;

  const renderTable = useCallback((props: CrmViewRenderProps) => (
    <CrmDataTable
      objectType="deals"
      search={props.search}
      activeFilters={props.activeFilters}
      sortConfig={props.sortConfig}
    />
  ), []);

  const renderBoard = useCallback((props: CrmViewRenderProps) => (
    <EnhancedPipelineBoard
      objectType="deals"
      pipelineId={selectedPipelineId}
      search={props.search}
      activeFilters={props.activeFilters}
    />
  ), [selectedPipelineId]);

  return (
    <MainLayout>
      <CrmIndexShell
        objectType="deals"
        renderTable={renderTable}
        renderBoard={renderBoard}
        headerExtra={pipelineSelector}
        onCreateNew={() => setShowCreateDialog(true)}
      />

      {/* Create Deal Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateDeal)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Name</FormLabel>
                    <FormControl><Input {...field} placeholder="Enter deal name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl><Input {...field} type="number" placeholder="0.00" /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="probability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Probability (%)</FormLabel>
                      <FormControl><Input {...field} type="number" min="0" max="100" /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stage</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="prospecting">Prospecting</SelectItem>
                          <SelectItem value="qualification">Qualification</SelectItem>
                          <SelectItem value="proposal">Proposal</SelectItem>
                          <SelectItem value="negotiation">Negotiation</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="expectedCloseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Close Date</FormLabel>
                    <FormControl><Input {...field} type="date" /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea {...field} rows={3} /></FormControl>
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createDealMutation.isPending}>
                  {createDealMutation.isPending ? 'Creating...' : 'Create Deal'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
