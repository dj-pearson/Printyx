import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/**
 * Cross-Module Data Flow Integration Hook
 * 
 * Handles automated data synchronization and workflow triggers between modules:
 * - Customer → Service → Inventory → Billing pipeline
 * - Equipment lifecycle → Service dispatch automation  
 * - Inventory → Service dispatch parts availability
 */

export interface CrossModuleEvent {
  sourceModule: string;
  targetModule: string;
  eventType: string;
  data: Record<string, any>;
  timestamp: string;
}

export interface ServiceIntegration {
  customerId: string;
  equipmentId?: string;
  requiredParts?: string[];
  priority: "low" | "medium" | "high" | "urgent";
  estimatedDuration: number;
  serviceType: string;
}

export interface InventoryIntegration {
  serviceTicketId?: string;
  requiredParts: string[];
  autoReorder: boolean;
  urgency: "standard" | "expedited" | "emergency";
}

export interface BillingIntegration {
  serviceTicketId: string;
  customerId: string;
  serviceItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    category: string;
  }>;
  autoInvoice: boolean;
}

export function useCrossModuleIntegration() {
  const queryClient = useQueryClient();

  // 1. Customer → Service → Inventory → Billing Pipeline
  const triggerServiceFromCustomer = useMutation({
    mutationFn: async (integration: ServiceIntegration) => {
      return await apiRequest("/api/cross-module/trigger-service", "POST", integration);
    },
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["/api/service-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", integration.customerId] });
      
      // Trigger inventory check if parts are needed
      if (data.requiredParts?.length > 0) {
        triggerInventoryCheck.mutate({
          serviceTicketId: data.ticketId,
          requiredParts: data.requiredParts,
          autoReorder: true,
          urgency: integration.priority === "urgent" ? "emergency" : "standard"
        });
      }
    }
  });

  const triggerInventoryCheck = useMutation({
    mutationFn: async (integration: InventoryIntegration) => {
      return await apiRequest("/api/cross-module/check-inventory", "POST", integration);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      
      // Trigger purchase orders if parts unavailable
      if (data.unavailableParts?.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      }
    }
  });

  const triggerBillingFromService = useMutation({
    mutationFn: async (integration: BillingIntegration) => {
      return await apiRequest("/api/cross-module/trigger-billing", "POST", integration);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-tickets", integration.serviceTicketId] });
    }
  });

  // 2. Equipment Lifecycle → Service Dispatch Automation
  const triggerMaintenanceFromEquipment = useMutation({
    mutationFn: async (equipmentData: {
      equipmentId: string;
      customerId: string;
      maintenanceType: "preventive" | "predictive" | "emergency";
      priority: "low" | "medium" | "high" | "urgent";
      scheduledDate?: string;
    }) => {
      return await apiRequest("/api/cross-module/schedule-maintenance", "POST", equipmentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-lifecycle"] });
    }
  });

  // 3. Real-time Parts Availability for Service Dispatch
  const checkPartsAvailability = useQuery({
    queryKey: ["/api/cross-module/parts-availability"],
    queryFn: async () => {
      return await apiRequest("/api/cross-module/parts-availability", "GET");
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Get cross-module integration status
  const integrationStatus = useQuery({
    queryKey: ["/api/cross-module/status"],
    queryFn: async () => {
      return await apiRequest("/api/cross-module/status", "GET");
    }
  });

  // Event logging and tracking
  const logCrossModuleEvent = useMutation({
    mutationFn: async (event: CrossModuleEvent) => {
      return await apiRequest("/api/cross-module/log-event", "POST", event);
    }
  });

  return {
    // Pipeline triggers
    triggerServiceFromCustomer,
    triggerInventoryCheck, 
    triggerBillingFromService,
    triggerMaintenanceFromEquipment,
    
    // Real-time data
    checkPartsAvailability,
    integrationStatus,
    
    // Event tracking
    logCrossModuleEvent,
    
    // Helper functions
    isIntegrationHealthy: integrationStatus.data?.healthy ?? false,
    lastSyncTime: integrationStatus.data?.lastSync ?? null,
  };
}

// Workflow automation helpers
export function useWorkflowAutomation() {
  const crossModule = useCrossModuleIntegration();

  const automateCustomerToService = async (customerId: string, issueData: any) => {
    // Automatically create service ticket from customer issue
    await crossModule.triggerServiceFromCustomer.mutateAsync({
      customerId,
      serviceType: issueData.type,
      priority: issueData.priority || "medium",
      estimatedDuration: issueData.estimatedHours || 2,
      requiredParts: issueData.suspectedParts || []
    });
  };

  const automateServiceToBilling = async (serviceTicketId: string, serviceData: any) => {
    // Automatically generate invoice from completed service
    await crossModule.triggerBillingFromService.mutateAsync({
      serviceTicketId,
      customerId: serviceData.customerId,
      serviceItems: serviceData.completedItems || [],
      autoInvoice: true
    });
  };

  const automateEquipmentMaintenance = async (equipmentId: string, customerId: string) => {
    // Automatically schedule preventive maintenance
    await crossModule.triggerMaintenanceFromEquipment.mutateAsync({
      equipmentId,
      customerId,
      maintenanceType: "preventive",
      priority: "medium",
      scheduledDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
    });
  };

  return {
    automateCustomerToService,
    automateServiceToBilling,
    automateEquipmentMaintenance
  };
}