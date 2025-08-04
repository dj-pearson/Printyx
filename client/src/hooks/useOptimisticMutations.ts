/**
 * Optimistic update mutations for better UX
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';
import { invalidateRelatedQueries } from '../lib/queryOptimizations';
import { useToast } from './use-toast';

export function useOptimisticCustomerMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/business-records', { method: 'POST', body: JSON.stringify(data) });
    },
    onMutate: async (newCustomer) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/business-records'] });

      // Snapshot previous value
      const previousCustomers = queryClient.getQueryData(['/api/business-records']);

      // Optimistically update
      queryClient.setQueryData(['/api/business-records'], (old: any) => {
        if (!old) return [{ ...newCustomer, id: `temp-${Date.now()}`, isOptimistic: true }];
        return [...old, { ...newCustomer, id: `temp-${Date.now()}`, isOptimistic: true }];
      });

      return { previousCustomers };
    },
    onError: (err, newCustomer, context) => {
      // Rollback on error
      if (context?.previousCustomers) {
        queryClient.setQueryData(['/api/business-records'], context.previousCustomers);
      }
      toast({
        title: "Error",
        description: "Failed to create customer. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      invalidateRelatedQueries('CUSTOMER_DATA');
      toast({
        title: "Success",
        description: "Customer created successfully",
      });
    },
  });
}

export function useOptimisticServiceTicketMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/service-tickets', { method: 'POST', body: JSON.stringify(data) });
    },
    onMutate: async (newTicket) => {
      await queryClient.cancelQueries({ queryKey: ['/api/service-tickets'] });
      
      const previousTickets = queryClient.getQueryData(['/api/service-tickets']);

      queryClient.setQueryData(['/api/service-tickets'], (old: any) => {
        if (!old) return [{ ...newTicket, id: `temp-${Date.now()}`, isOptimistic: true, status: 'open' }];
        return [{ ...newTicket, id: `temp-${Date.now()}`, isOptimistic: true, status: 'open' }, ...old];
      });

      return { previousTickets };
    },
    onError: (err, newTicket, context) => {
      if (context?.previousTickets) {
        queryClient.setQueryData(['/api/service-tickets'], context.previousTickets);
      }
      toast({
        title: "Error",
        description: "Failed to create service ticket. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      invalidateRelatedQueries('SERVICE_DATA');
      toast({
        title: "Success",
        description: "Service ticket created successfully",
      });
    },
  });
}

export function useOptimisticTicketStatusUpdate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest(`/api/service-tickets/${id}`, { 
        method: 'PATCH', 
        body: JSON.stringify({ status }) 
      });
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/service-tickets'] });
      
      const previousTickets = queryClient.getQueryData(['/api/service-tickets']);

      // Update ticket status optimistically
      queryClient.setQueryData(['/api/service-tickets'], (old: any) => {
        if (!old) return old;
        return old.map((ticket: any) => 
          ticket.id === id 
            ? { ...ticket, status, updatedAt: new Date().toISOString() }
            : ticket
        );
      });

      return { previousTickets };
    },
    onError: (err, variables, context) => {
      if (context?.previousTickets) {
        queryClient.setQueryData(['/api/service-tickets'], context.previousTickets);
      }
      toast({
        title: "Error", 
        description: "Failed to update ticket status. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      invalidateRelatedQueries('SERVICE_DATA');
      toast({
        title: "Success",
        description: "Ticket status updated successfully",
      });
    },
  });
}

export function useOptimisticInventoryUpdate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      return await apiRequest(`/api/inventory/${id}`, { 
        method: 'PATCH', 
        body: JSON.stringify({ currentStock: quantity }) 
      });
    },
    onMutate: async ({ id, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/inventory'] });
      
      const previousInventory = queryClient.getQueryData(['/api/inventory']);

      // Update inventory optimistically
      queryClient.setQueryData(['/api/inventory'], (old: any) => {
        if (!old) return old;
        return old.map((item: any) => 
          item.id === id 
            ? { ...item, currentStock: quantity, updatedAt: new Date().toISOString() }
            : item
        );
      });

      return { previousInventory };
    },
    onError: (err, variables, context) => {
      if (context?.previousInventory) {
        queryClient.setQueryData(['/api/inventory'], context.previousInventory);
      }
      toast({
        title: "Error",
        description: "Failed to update inventory. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      invalidateRelatedQueries('INVENTORY_DATA');
      toast({
        title: "Success",
        description: "Inventory updated successfully",
      });
    },
  });
}