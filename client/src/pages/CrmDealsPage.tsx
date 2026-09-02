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
import { CrmDataTable, type CrmRowAction } from '@/components/crm/CrmDataTable';
import type { BulkAction } from '@/components/ui/bulk-operations-toolbar';
import { Mail, Phone, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { CustomFieldsSection } from '@/components/custom-fields/CustomFieldsSection';

// WF-C-02: the board's stage shape, as GET /api/pipeline-config/board returns it.
// `id` is the LEGACY deal_stages.id, which is what the move endpoint expects and
// what deals group by - COP-E02's two vocabularies, so the type says which one.
interface PipelineBoardStage {
  id: string;
  name?: string;
  isClosedWon?: boolean;
  isClosedLost?: boolean;
}

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
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
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
      apiRequest('/api/deals', 'POST', {
        ...data,
        value: data.value ? parseFloat(data.value) : 0,
        probability: parseInt(data.probability, 10),
        customFields,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      setShowCreateDialog(false);
      form.reset();
      setCustomFields({});
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
  const pipelineSelector =
    pipelineTemplates?.length > 1 ? (
      <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
        <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs">
          <SelectValue placeholder="Pipeline" />
        </SelectTrigger>
        <SelectContent>
          {pipelineTemplates?.map((p: any) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : null;

  // ─── COP-M01: row + bulk actions ──────────────────────────────────────────
  // These reach parity with what the legacy index pages offered, so the shell
  // is a strict upgrade rather than a trade-off.

  // WF-C-02: Mark Won used to PUT status + actualCloseDate and nothing else, so
  // the table said Won while the board - which groups strictly by stageId - kept
  // the deal in whatever column it was already in. The two views of the same deal
  // disagreed, and the one a manager forecasts from was the wrong one.
  //
  // Same key as DealDetail.tsx so the two pages share one cached board.
  const { data: board } = useQuery<{ stages?: PipelineBoardStage[] }>({
    queryKey: ['/api/pipeline-config/board'],
    queryFn: () => apiRequest('/api/pipeline-config/board'),
  });

  const closingStageId = useCallback(
    (outcome: 'won' | 'lost'): string | null => {
      const stages = board?.stages ?? [];
      const match = stages.find((s) => (outcome === 'won' ? s.isClosedWon : s.isClosedLost));
      return match?.id ?? null;
    },
    [board],
  );

  // The move endpoint sets status, probability and actual_close_date from the
  // stage's own flags and fires deal.stage_changed (WF-C-01), so this is one call,
  // not a patch plus a move.
  const closeDeal = useCallback(
    async (id: string, outcome: 'won' | 'lost') => {
      const toStageId = closingStageId(outcome);
      if (!toStageId) {
        // Refusing beats writing a status the board cannot show. A pipeline with
        // no closed-won stage is a configuration problem, and silently patching
        // status is what produced the disagreement in the first place.
        throw new Error(
          `This pipeline has no Closed ${outcome === 'won' ? 'Won' : 'Lost'} stage. ` +
            'Add one in Pipeline Configuration first.',
        );
      }
      return apiRequest(`/api/pipeline-config/deals/${id}/move`, 'POST', { toStageId });
    },
    [closingStageId],
  );

  const closeDeals = useCallback(
    async (ids: string[], outcome: 'won' | 'lost') => {
      await Promise.all(ids.map((id) => closeDeal(id, outcome)));
    },
    [closeDeal],
  );

  const afterMutate = useCallback(
    (title: string) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({ title });
    },
    [queryClient, toast],
  );

  const rowActions = useMemo<CrmRowAction[]>(
    () => [
      {
        id: 'email',
        label: 'Send Email',
        icon: Mail,
        onClick: (record) => {
          if (record.primaryContactEmail) {
            window.open(`mailto:${record.primaryContactEmail}`, '_self');
          } else {
            toast({ title: 'No email', description: 'No email address on this deal.' });
          }
        },
      },
      {
        id: 'call',
        label: 'Call',
        icon: Phone,
        onClick: (record) => {
          if (record.primaryContactPhone) {
            window.open(`tel:${record.primaryContactPhone}`, '_self');
          } else {
            toast({ title: 'No phone', description: 'No phone number on this deal.' });
          }
        },
      },
      {
        id: 'won',
        label: 'Mark Won',
        icon: CheckCircle2,
        isAvailable: (record) => record.status === 'open' || !record.status,
        onClick: async (record) => {
          try {
            await closeDeal(record.id, 'won');
          } catch (err) {
            toast({
              title: 'Could not mark the deal won',
              description: err instanceof Error ? err.message : undefined,
              variant: 'destructive',
            });
            return;
          }
          afterMutate('Deal marked won');
        },
      },
      {
        id: 'lost',
        label: 'Mark Lost',
        icon: XCircle,
        isAvailable: (record) => record.status === 'open' || !record.status,
        onClick: async (record) => {
          try {
            await closeDeal(record.id, 'lost');
          } catch (err) {
            toast({
              title: 'Could not mark the deal lost',
              description: err instanceof Error ? err.message : undefined,
              variant: 'destructive',
            });
            return;
          }
          afterMutate('Deal marked lost');
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        variant: 'destructive',
        onClick: async (record) => {
          await apiRequest(`/api/deals/${record.id}`, 'DELETE');
          afterMutate('Deal deleted');
        },
      },
    ],
    [closeDeal, afterMutate, toast],
  );

  const bulkActions = useMemo<BulkAction[]>(
    () => [
      {
        id: 'bulk-won',
        label: 'Mark Won',
        icon: CheckCircle2,
        onClick: async (ids) => {
          try {
            await closeDeals(ids, 'won');
          } catch (err) {
            toast({
              title: 'Could not mark the deals won',
              description: err instanceof Error ? err.message : undefined,
              variant: 'destructive',
            });
            return;
          }
          afterMutate(`${ids.length} deal(s) marked won`);
        },
      },
      {
        id: 'bulk-lost',
        label: 'Mark Lost',
        icon: XCircle,
        onClick: async (ids) => {
          try {
            await closeDeals(ids, 'lost');
          } catch (err) {
            toast({
              title: 'Could not mark the deals lost',
              description: err instanceof Error ? err.message : undefined,
              variant: 'destructive',
            });
            return;
          }
          afterMutate(`${ids.length} deal(s) marked lost`);
        },
      },
      {
        id: 'bulk-delete',
        label: 'Delete',
        icon: Trash2,
        variant: 'destructive',
        requiresConfirmation: true,
        onClick: async (ids) => {
          await Promise.all(ids.map((id) => apiRequest(`/api/deals/${id}`, 'DELETE')));
          afterMutate(`${ids.length} deal(s) deleted`);
        },
      },
    ],
    [closeDeals, afterMutate, toast],
  );

  const renderTable = useCallback(
    (props: CrmViewRenderProps) => (
      <CrmDataTable
        objectType="deals"
        search={props.search}
        activeFilters={props.activeFilters}
        selectedIds={props.selectedIds}
        onSelectionChange={props.onSelectionChange}
        onTotalCountChange={props.onTotalCountChange}
        rowActions={rowActions}
        sortConfig={props.sortConfig}
        isFiltered={props.isFiltered}
        onClearFilters={props.onClearFilters}
        onCreateNew={props.onCreateNew}
        columnConfig={props.columnConfig}
        onColumnConfigChange={props.onColumnConfigChange}
        columnsPersist={props.columnsPersist}
      />
    ),
    [rowActions],
  );

  const renderBoard = useCallback(
    (props: CrmViewRenderProps) => (
      <EnhancedPipelineBoard
        objectType="deals"
        pipelineId={selectedPipelineId}
        search={props.search}
        activeFilters={props.activeFilters}
        boardConfig={props.boardConfig}
        onBoardConfigChange={props.onBoardConfigChange}
        boardConfigPersists={props.boardConfigPersists}
      />
    ),
    [selectedPipelineId],
  );

  return (
    <MainLayout>
      <CrmIndexShell
        objectType="deals"
        renderTable={renderTable}
        renderBoard={renderBoard}
        headerExtra={pipelineSelector}
        onCreateNew={() => setShowCreateDialog(true)}
        bulkActions={bulkActions}
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
                    <FormControl>
                      <Input {...field} placeholder="Enter deal name" />
                    </FormControl>
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
                      <FormControl>
                        <Input {...field} type="number" placeholder="0.00" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="probability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Probability (%)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="0" max="100" />
                      </FormControl>
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
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
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
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
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
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <CustomFieldsSection
                objectType="deals"
                values={customFields}
                onChange={setCustomFields}
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
