import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Mail, Loader2 } from 'lucide-react';

const emailFormSchema = z.object({
  recipientEmail: z.string().email('Please enter a valid email address'),
  customMessage: z.string().optional(),
  includeAttachment: z.boolean().default(true),
});

type EmailFormValues = z.infer<typeof emailFormSchema>;

interface InvoiceEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
}

export function InvoiceEmailDialog({ open, onOpenChange, invoiceId }: InvoiceEmailDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      recipientEmail: '',
      customMessage: '',
      includeAttachment: true,
    },
  });

  // Fetch invoice details
  const { data: invoice, isLoading: loadingInvoice } = useQuery({
    queryKey: [`/api/billing/invoices/${invoiceId}`],
    enabled: !!invoiceId && open,
  });

  // Populate email field when invoice loads
  useEffect(() => {
    if (invoice && invoice.customerEmail) {
      form.setValue('recipientEmail', invoice.customerEmail);
    }
  }, [invoice, form]);

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (data: EmailFormValues) => {
      if (!invoiceId) throw new Error('Invoice ID is required');
      return await apiRequest(`/api/billing/invoices/${invoiceId}/email`, 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/invoices'] });
      toast({
        title: 'Invoice sent',
        description: 'Invoice has been sent successfully via email.',
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send invoice',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EmailFormValues) => {
    sendEmailMutation.mutate(data);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!sendEmailMutation.isPending) {
      onOpenChange(newOpen);
      if (!newOpen) {
        form.reset();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Invoice via Email</DialogTitle>
          <DialogDescription>Send this invoice to your customer's email address</DialogDescription>
        </DialogHeader>

        {loadingInvoice ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Invoice Details */}
            {invoice && (
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Invoice #:</span>
                    <span className="ml-2 font-medium">{invoice.invoiceNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="ml-2 font-medium">{invoice.customerName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="ml-2 font-medium">
                      ${parseFloat(invoice.totalAmount || invoice.total || '0').toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <span className="ml-2 font-medium capitalize">
                      {invoice.invoiceStatus || invoice.status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Email Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="recipientEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="customer@example.com" {...field} />
                      </FormControl>
                      <FormDescription>
                        Email address where the invoice will be sent
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Message (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add a personalized message to your customer..."
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>This message will appear in the email body</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includeAttachment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Include PDF Attachment</FormLabel>
                        <FormDescription>Attach the invoice PDF to the email</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    disabled={sendEmailMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={sendEmailMutation.isPending}>
                    {sendEmailMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Invoice
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
