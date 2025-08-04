/**
 * Smart real-time data hooks with optimized polling
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { POLLING_INTERVALS, CACHE_TIMES } from '../lib/queryOptimizations';

interface UseRealTimeDataOptions {
  enabled?: boolean;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  pauseOnHidden?: boolean;
  adaptive?: boolean;
}

export function useRealTimeData<T>(
  queryKey: any[],
  queryFn: () => Promise<T>,
  options: UseRealTimeDataOptions
) {
  const { enabled = true, priority, pauseOnHidden = true, adaptive = true } = options;
  const [isVisible, setIsVisible] = useState(true);
  const [errorCount, setErrorCount] = useState(0);

  // Track page visibility
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pauseOnHidden]);

  // Adaptive polling interval based on errors
  const getAdaptiveInterval = () => {
    if (!adaptive) return POLLING_INTERVALS[priority];
    
    // Increase interval on repeated errors
    const baseInterval = POLLING_INTERVALS[priority];
    return baseInterval * Math.min(Math.pow(2, errorCount), 8); // Max 8x slowdown
  };

  const shouldPoll = enabled && (!pauseOnHidden || isVisible);

  return useQuery({
    queryKey,
    queryFn,
    enabled: shouldPoll,
    refetchInterval: shouldPoll ? getAdaptiveInterval() : false,
    refetchIntervalInBackground: priority === 'CRITICAL',
    staleTime: priority === 'CRITICAL' ? 0 : CACHE_TIMES.REAL_TIME,
    cacheTime: CACHE_TIMES.REAL_TIME * 2,
    onError: () => setErrorCount(prev => prev + 1),
    onSuccess: () => setErrorCount(0),
    retry: (failureCount, error: any) => {
      if (error?.status === 404 || error?.status === 403) return false;
      return failureCount < 2;
    },
  });
}

// Specialized real-time hooks
export function useDashboardMetrics(enabled = true) {
  return useRealTimeData(
    ['/api/dashboard/metrics'],
    () => fetch('/api/dashboard/metrics', { credentials: 'include' }).then(r => r.json()),
    { priority: 'HIGH', enabled }
  );
}

export function useSystemAlerts(enabled = true) {
  return useRealTimeData(
    ['/api/dashboard/alerts'],
    () => fetch('/api/dashboard/alerts', { credentials: 'include' }).then(r => r.json()),
    { priority: 'CRITICAL', enabled }
  );
}

export function useActiveServiceTickets(enabled = true) {
  return useRealTimeData(
    ['/api/service-tickets', { status: 'open' }],
    () => fetch('/api/service-tickets?status=open', { credentials: 'include' }).then(r => r.json()),
    { priority: 'HIGH', enabled }
  );
}

export function useEquipmentStatus(equipmentId?: string, enabled = true) {
  return useRealTimeData(
    ['/api/equipment', equipmentId, 'status'],
    () => fetch(`/api/equipment/${equipmentId}/status`, { credentials: 'include' }).then(r => r.json()),
    { priority: 'MEDIUM', enabled: enabled && !!equipmentId }
  );
}

// WebSocket alternative for truly real-time data
export function useWebSocketData<T>(
  endpoint: string,
  fallbackQueryKey: any[],
  fallbackQueryFn: () => Promise<T>,
  enabled = true
) {
  const [wsData, setWsData] = useState<T | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}${endpoint}`);

    ws.onopen = () => {
      setWsConnected(true);
      console.log(`WebSocket connected: ${endpoint}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setWsData(data);
      } catch (error) {
        console.error('Failed to parse WebSocket data:', error);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.log(`WebSocket disconnected: ${endpoint}`);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [endpoint, enabled]);

  // Fallback to polling if WebSocket not available
  const fallbackQuery = useQuery({
    queryKey: fallbackQueryKey,
    queryFn: fallbackQueryFn,
    enabled: enabled && !wsConnected,
    refetchInterval: POLLING_INTERVALS.HIGH,
    staleTime: CACHE_TIMES.REAL_TIME,
  });

  return {
    data: wsData || fallbackQuery.data,
    isLoading: !wsConnected && fallbackQuery.isLoading,
    error: fallbackQuery.error,
    isConnected: wsConnected,
    isWebSocket: wsConnected,
  };
}