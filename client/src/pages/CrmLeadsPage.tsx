/**
 * CrmLeadsPage - Unified Leads CRM page using CrmIndexShell.
 * Part of CRM-002: Unified CRM index pages.
 */
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
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

const createLeadSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal('')),
  primaryContactPhone: z.string().optional(),
  leadSource: z.string().optional(),
  estimatedAmount: z.string().optional(),
  priority: z.string().default('medium'),
  notes: z.string().optional(),
});

type CreateLeadForm = z.infer<typeof createLeadSchema>;

export default function CrmLeadsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const form = useForm<CreateLeadForm>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      companyName: '',
      priority: 'medium',
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: (data: CreateLeadForm) =>
      apiRequest('/api/business-records', 'POST', {
        ...data,
        recordType: 'lead',
        status: 'new',
        estimatedAmount: data.estimatedAmount ? parseFloat(data.estimatedAmount) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-records'] });
      setShowCreateDialog(false);
      form.reset();
      toast({ title: 'Lead created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create lead', variant: 'destructive' });
    },
  });

  const renderTable = useCallback((props: CrmViewRenderProps) => (
    <CrmDataTable
      objectType="leads"
      search={props.search}
      activeFilters={props.activeFilters}
      sortConfig={props.sortConfig}
    />
  ), []);

  const renderBoard = useCallback((props: CrmViewRenderProps) => (
    <EnhancedPipelineBoard
      objectType="leads"
      search={props.search}
      activeFilters={props.activeFilters}
    />
  ), []);

  return (
    <MainLayout>
      <CrmIndexShell
        objectType="leads"
        renderTable={renderTable}
        renderBoard={renderBoard}
        onCreateNew={() => setShowCreateDialog(true)}
      />

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createLeadMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl><Input {...field} placeholder="Enter company name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="primaryContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl><Input {...field} placeholder="Full name" /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="primaryContactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input {...field} type="email" placeholder="email@company.com" /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="leadSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="cold_call">Cold Call</SelectItem>
                          <SelectItem value="trade_show">Trade Show</SelectItem>
                          <SelectItem value="social_media">Social Media</SelectItem>
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
                name="estimatedAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Value</FormLabel>
                    <FormControl><Input {...field} type="number" placeholder="0.00" /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea {...field} rows={3} /></FormControl>
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={createLeadMutation.isPending}>
                  {createLeadMutation.isPending ? 'Creating...' : 'Create Lead'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
