// =====================================================================
// WEBSOCKET HOOK FOR REAL-TIME UPDATES
// Phase 2 Implementation - React Hook for Live Data
// =====================================================================

import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketMessage {
  type:
    | 'data_update'
    | 'kpi_update'
    | 'notification'
    | 'heartbeat'
    | 'pong'
    | 'error'
    | 'connected';
  channel?: string;
  data?: any;
  timestamp?: number;
  error?: string;
}

interface WebSocketHookOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  /** @deprecated Use exponential backoff instead. Initial backoff delay in ms (default: 1000) */
  reconnectInterval?: number;
  heartbeatInterval?: number;
  /** JWT token for authenticated WebSocket connections */
  token?: string;
  /** Initial backoff delay in ms for reconnection (default: 1000) */
  initialBackoffMs?: number;
  /** Maximum backoff delay in ms (default: 30000) */
  maxBackoffMs?: number;
}

interface WebSocketHookReturn {
  isConnected: boolean;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  subscribe: (channel: string, callback: (data: any) => void) => void;
  unsubscribe: (channel: string) => void;
  send: (message: any) => void;
  disconnect: () => void;
  connect: () => void;
  error: string | null;
  lastMessage: WebSocketMessage | null;
}

export function useWebSocket(
  userId: string | null,
  tenantId: string | null,
  options: WebSocketHookOptions = {},
): WebSocketHookReturn {
  const {
    autoConnect = true,
    reconnectAttempts = 10,
    heartbeatInterval = 30000,
    token,
    initialBackoffMs = 1000,
    maxBackoffMs = 30000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subscriptionsRef = useRef<Map<string, (data: any) => void>>(new Map());

  /**
   * Calculate exponential backoff delay: 1s, 2s, 4s, 8s, 16s, max 30s
   */
  const getBackoffDelay = useCallback(
    (attempt: number): number => {
      const delay = initialBackoffMs * Math.pow(2, attempt);
      return Math.min(delay, maxBackoffMs);
    },
    [initialBackoffMs, maxBackoffMs],
  );

  // Generate WebSocket URL with JWT token support
  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const params = new URLSearchParams();
    if (token) {
      params.set('token', token);
    }
    // Include userId/tenantId as fallback for backwards compatibility
    if (userId) params.set('userId', userId);
    if (tenantId) params.set('tenantId', tenantId);
    return `${protocol}//${host}/ws/reporting?${params.toString()}`;
  }, [userId, tenantId, token]);

  // Send message to WebSocket
  const send = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
  }, []);

  // Subscribe to a channel
  const subscribe = useCallback(
    (channel: string, callback: (data: any) => void) => {
      subscriptionsRef.current.set(channel, callback);

      // Send subscription request if connected
      if (isConnected) {
        const [type, id] = channel.split(':');
        const subscriptionData: any = { channel };

        if (type === 'report') {
          subscriptionData.reportId = id;
        } else if (type === 'kpi') {
          subscriptionData.kpiId = id;
        }

        send({
          type: 'subscribe',
          data: subscriptionData,
        });
      }
    },
    [isConnected, send],
  );

  // Unsubscribe from a channel
  const unsubscribe = useCallback(
    (channel: string) => {
      subscriptionsRef.current.delete(channel);

      if (isConnected) {
        const [type, id] = channel.split(':');
        const unsubscriptionData: any = { channel };

        if (type === 'report') {
          unsubscriptionData.reportId = id;
        } else if (type === 'kpi') {
          unsubscriptionData.kpiId = id;
        }

        send({
          type: 'unsubscribe',
          data: unsubscriptionData,
        });
      }
    },
    [isConnected, send],
  );

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
    }

    heartbeatTimeoutRef.current = setInterval(() => {
      send({ type: 'heartbeat' });
    }, heartbeatInterval);
  }, [send, heartbeatInterval]);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // Handle WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setLastMessage(message);

        switch (message.type) {
          case 'connected':
            console.log('✅ WebSocket connected:', message.data);
            setIsConnected(true);
            setConnectionState('connected');
            setError(null);
            reconnectAttemptsRef.current = 0;
            startHeartbeat();

            // Re-subscribe to all channels
            subscriptionsRef.current.forEach((callback, channel) => {
              const [type, id] = channel.split(':');
              const subscriptionData: any = { channel };

              if (type === 'report') {
                subscriptionData.reportId = id;
              } else if (type === 'kpi') {
                subscriptionData.kpiId = id;
              }

              send({
                type: 'subscribe',
                data: subscriptionData,
              });
            });
            break;

          case 'data_update':
          case 'kpi_update':
            if (message.channel) {
              const callback = subscriptionsRef.current.get(message.channel);
              if (callback && message.data) {
                callback(message.data);
              }
            }
            break;

          case 'error':
            console.error('WebSocket error:', message.error);
            setError(message.error || 'Unknown error');
            break;

          case 'heartbeat':
          case 'pong':
            // Heartbeat received, connection is alive
            break;

          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    },
    [send, startHeartbeat],
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!userId || !tenantId) {
      console.warn('Cannot connect WebSocket: missing userId or tenantId');
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      return; // Already connecting
    }

    setConnectionState('connecting');
    setError(null);

    try {
      const url = getWebSocketUrl();
      console.log('🔌 Connecting to WebSocket:', url);

      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('🔌 WebSocket connection opened');
      };

      wsRef.current.onmessage = handleMessage;

      wsRef.current.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        setIsConnected(false);
        setConnectionState('disconnected');
        stopHeartbeat();

        // Don't reconnect on auth failure (401 manifests as code 1006 with no reason)
        // or manual close (1000)
        if (event.code === 1000) return;

        // Attempt reconnection with exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
        if (reconnectAttemptsRef.current < reconnectAttempts) {
          const delay = getBackoffDelay(reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;
          console.log(
            `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${reconnectAttempts})...`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setConnectionState('error');
          setError('Maximum reconnection attempts exceeded');
        }
      };

      wsRef.current.onerror = () => {
        setConnectionState('error');
        setError('WebSocket connection error');
      };
    } catch {
      setConnectionState('error');
      setError('Failed to create WebSocket connection');
    }
  }, [
    userId,
    tenantId,
    getWebSocketUrl,
    handleMessage,
    stopHeartbeat,
    reconnectAttempts,
    getBackoffDelay,
  ]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionState('disconnected');
    reconnectAttemptsRef.current = 0;
  }, [stopHeartbeat]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && userId && tenantId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, userId, tenantId, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    connectionState,
    subscribe,
    unsubscribe,
    send,
    disconnect,
    connect,
    error,
    lastMessage,
  };
}

// Hook for KPI real-time updates
export function useRealtimeKPI(kpiId: string, userId: string | null, tenantId: string | null) {
  const [kpiData, setKpiData] = useState<any | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { isConnected, subscribe, unsubscribe, connectionState } = useWebSocket(userId, tenantId, {
    autoConnect: true,
    reconnectAttempts: 3,
    heartbeatInterval: 30000,
  });

  useEffect(() => {
    if (isConnected && kpiId) {
      const channel = `kpi:${kpiId}`;

      const handleKPIUpdate = (data: any) => {
        setKpiData(data);
        setLastUpdated(new Date());
      };

      subscribe(channel, handleKPIUpdate);

      return () => {
        unsubscribe(channel);
      };
    }
  }, [isConnected, kpiId, subscribe, unsubscribe]);

  return {
    data: kpiData,
    lastUpdated,
    isConnected,
    connectionState,
  };
}

// Hook for report real-time updates
export function useRealtimeReport(
  reportId: string,
  userId: string | null,
  tenantId: string | null,
  parameters: any = {},
) {
  const [reportData, setReportData] = useState<any | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { isConnected, subscribe, unsubscribe, connectionState } = useWebSocket(userId, tenantId, {
    autoConnect: true,
    reconnectAttempts: 3,
    heartbeatInterval: 30000,
  });

  useEffect(() => {
    if (isConnected && reportId) {
      const channel = `report:${reportId}`;

      const handleReportUpdate = (data: any) => {
        setReportData(data);
        setLastUpdated(new Date());
      };

      subscribe(channel, handleReportUpdate);

      return () => {
        unsubscribe(channel);
      };
    }
  }, [isConnected, reportId, subscribe, unsubscribe]);

  return {
    data: reportData,
    lastUpdated,
    isConnected,
    connectionState,
  };
}

export default useWebSocket;
