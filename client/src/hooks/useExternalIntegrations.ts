import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface IntegrationStatus {
  name: string;
  connected: boolean;
  lastSync: string | null;
  health: 'healthy' | 'warning' | 'error';
  syncFrequency: string;
  recordCount: number;
  errorCount: number;
}

export interface EAutomateIntegration {
  customerSync: boolean;
  equipmentSync: boolean;
  serviceSync: boolean;
  meterReadingSync: boolean;
  invoiceSync: boolean;
  autoSyncEnabled: boolean;
  syncInterval: number; // minutes
}

export interface SalesforceIntegration {
  leadSync: boolean;
  accountSync: boolean;
  opportunitySync: boolean;
  activitySync: boolean;
  contactSync: boolean;
  automatedWorkflows: boolean;
  realTimeSync: boolean;
}

export interface QuickBooksIntegration {
  customerSync: boolean;
  invoiceSync: boolean;
  paymentSync: boolean;
  itemSync: boolean;
  taxSync: boolean;
  automaticReconciliation: boolean;
  duplicateDetection: boolean;
}

export function useExternalIntegrations() {
  const queryClient = useQueryClient();

  // Get integration statuses
  const integrationStatuses = useQuery({
    queryKey: ['/api/integrations/status'],
    queryFn: () => apiRequest<IntegrationStatus[]>('/api/integrations/status'),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // E-Automate Integration
  const eAutomateConfig = useQuery({
    queryKey: ['/api/integrations/eautomate/config'],
    queryFn: () => apiRequest<EAutomateIntegration>('/api/integrations/eautomate/config'),
  });

  const updateEAutomateConfig = useMutation({
    mutationFn: (config: Partial<EAutomateIntegration>) =>
      apiRequest('/api/integrations/eautomate/config', {
        method: 'PATCH',
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/eautomate/config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/status'] });
    },
  });

  const triggerEAutomateSync = useMutation({
    mutationFn: (syncType: 'full' | 'incremental' | 'selective') =>
      apiRequest('/api/integrations/eautomate/sync', {
        method: 'POST',
        body: JSON.stringify({ type: syncType }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/status'] });
    },
  });

  // Salesforce Integration  
  const salesforceConfig = useQuery({
    queryKey: ['/api/integrations/salesforce/config'],
    queryFn: () => apiRequest<SalesforceIntegration>('/api/integrations/salesforce/config'),
  });

  const updateSalesforceConfig = useMutation({
    mutationFn: (config: Partial<SalesforceIntegration>) =>
      apiRequest('/api/integrations/salesforce/config', {
        method: 'PATCH',
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/salesforce/config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/status'] });
    },
  });

  const triggerSalesforceSync = useMutation({
    mutationFn: (entities: string[]) =>
      apiRequest('/api/integrations/salesforce/sync', {
        method: 'POST',
        body: JSON.stringify({ entities }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/status'] });
    },
  });

  // QuickBooks Integration
  const quickBooksConfig = useQuery({
    queryKey: ['/api/integrations/quickbooks/config'],
    queryFn: () => apiRequest<QuickBooksIntegration>('/api/integrations/quickbooks/config'),
  });

  const updateQuickBooksConfig = useMutation({
    mutationFn: (config: Partial<QuickBooksIntegration>) =>
      apiRequest('/api/integrations/quickbooks/config', {
        method: 'PATCH',
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/quickbooks/config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/status'] });
    },
  });

  const triggerQuickBooksSync = useMutation({
    mutationFn: (entities: string[]) =>
      apiRequest('/api/integrations/quickbooks/sync', {
        method: 'POST',
        body: JSON.stringify({ entities }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/status'] });
    },
  });

  // Bulk operations
  const triggerBulkSync = useMutation({
    mutationFn: (integrations: string[]) =>
      apiRequest('/api/integrations/bulk-sync', {
        method: 'POST',
        body: JSON.stringify({ integrations }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/status'] });
    },
  });

  return {
    integrationStatuses,
    eAutomate: {
      config: eAutomateConfig,
      updateConfig: updateEAutomateConfig,
      triggerSync: triggerEAutomateSync,
    },
    salesforce: {
      config: salesforceConfig,
      updateConfig: updateSalesforceConfig,
      triggerSync: triggerSalesforceSync,
    },
    quickBooks: {
      config: quickBooksConfig,
      updateConfig: updateQuickBooksConfig,
      triggerSync: triggerQuickBooksSync,
    },
    bulkSync: triggerBulkSync,
  };
}

// Mobile device detection hook
export function useMobileDetection() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isTabletDevice = /iPad|Android(?=.*Mobile)/i.test(userAgent) && window.innerWidth >= 768;
      
      setIsMobile(isMobileDevice && !isTabletDevice);
      setIsTablet(isTabletDevice);
      setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  return { isMobile, isTablet, orientation };
}

// Mobile scanning capabilities hook
export function useMobileScanning() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  
  const startScan = async (type: 'barcode' | 'qr' | 'text') => {
    setIsScanning(true);
    
    try {
      // Check if device supports camera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported');
      }

      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera
      });

      // In a real implementation, you would use a barcode scanning library here
      // For now, we'll simulate scanning
      setTimeout(() => {
        setScanResult(`${type.toUpperCase()}_${Date.now()}`);
        setIsScanning(false);
        stream.getTracks().forEach(track => track.stop());
      }, 3000);

    } catch (error) {
      console.error('Scanning failed:', error);
      setIsScanning(false);
    }
  };

  const stopScan = () => {
    setIsScanning(false);
    setScanResult(null);
  };

  return {
    isScanning,
    scanResult,
    startScan,
    stopScan,
    isSupported: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices
  };
}

export default useExternalIntegrations;