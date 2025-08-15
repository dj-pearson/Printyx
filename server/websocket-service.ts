// =====================================================================
// WEBSOCKET SERVICE FOR REAL-TIME UPDATES
// Phase 2 Implementation - Live Data Streaming
// =====================================================================

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { reportingCache } from './cache-service';

interface WebSocketClient {
  id: string;
  socket: WebSocket;
  userId: string;
  tenantId: string;
  subscriptions: Set<string>;
  permissions: Record<string, boolean>;
  lastHeartbeat: number;
}

interface ClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'heartbeat' | 'ping';
  data?: {
    reportId?: string;
    kpiId?: string;
    channel?: string;
    parameters?: Record<string, any>;
  };
}

interface ServerMessage {
  type: 'data_update' | 'kpi_update' | 'heartbeat' | 'pong' | 'error' | 'connected';
  channel?: string;
  data?: any;
  timestamp?: number;
  error?: string;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private dataUpdateInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  // Initialize WebSocket server
  public initialize(server: Server): void {
    console.log('🚀 Initializing WebSocket service for real-time updates...');

    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/reporting',
      clientTracking: true
    });

    this.wss.on('connection', (socket, request) => {
      this.handleNewConnection(socket, request);
    });

    this.startHeartbeat();
    this.startDataUpdateLoop();

    console.log('✅ WebSocket service initialized on /ws/reporting');
  }

  // Handle new WebSocket connection
  private handleNewConnection(socket: WebSocket, request: any): void {
    const clientId = uuidv4();
    
    // Extract user info from request (you'd implement proper authentication here)
    const userId = this.extractUserIdFromRequest(request);
    const tenantId = this.extractTenantIdFromRequest(request);
    const permissions = this.extractPermissionsFromRequest(request);

    if (!userId || !tenantId) {
      socket.close(1008, 'Authentication required');
      return;
    }

    const client: WebSocketClient = {
      id: clientId,
      socket,
      userId,
      tenantId,
      subscriptions: new Set(),
      permissions,
      lastHeartbeat: Date.now()
    };

    this.clients.set(clientId, client);

    console.log(`📡 New WebSocket client connected: ${clientId} (user: ${userId}, tenant: ${tenantId})`);

    // Send welcome message
    this.sendToClient(client, {
      type: 'connected',
      data: {
        clientId,
        serverTime: Date.now(),
        supportedChannels: ['reports', 'kpis', 'dashboard']
      }
    });

    // Set up event handlers
    socket.on('message', (message) => {
      this.handleClientMessage(client, message);
    });

    socket.on('close', () => {
      this.handleClientDisconnect(clientId);
    });

    socket.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.clients.delete(clientId);
    });
  }

  // Handle incoming client messages
  private handleClientMessage(client: WebSocketClient, message: any): void {
    try {
      const parsedMessage: ClientMessage = JSON.parse(message.toString());
      
      switch (parsedMessage.type) {
        case 'subscribe':
          this.handleSubscription(client, parsedMessage.data);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscription(client, parsedMessage.data);
          break;
          
        case 'heartbeat':
          client.lastHeartbeat = Date.now();
          this.sendToClient(client, { type: 'heartbeat', timestamp: Date.now() });
          break;
          
        case 'ping':
          this.sendToClient(client, { type: 'pong', timestamp: Date.now() });
          break;
          
        default:
          this.sendToClient(client, { 
            type: 'error', 
            error: `Unknown message type: ${parsedMessage.type}` 
          });
      }
    } catch (error) {
      console.error('Error parsing client message:', error);
      this.sendToClient(client, { 
        type: 'error', 
        error: 'Invalid message format' 
      });
    }
  }

  // Handle subscription requests
  private handleSubscription(client: WebSocketClient, data: any): void {
    if (!data) return;

    let channel: string;
    
    if (data.reportId) {
      channel = `report:${data.reportId}`;
      
      // Check if user has permission for this report
      if (!this.hasReportPermission(client, data.reportId)) {
        this.sendToClient(client, {
          type: 'error',
          error: 'Insufficient permissions for this report'
        });
        return;
      }
    } else if (data.kpiId) {
      channel = `kpi:${data.kpiId}`;
      
      // Check if user has permission for this KPI
      if (!this.hasKPIPermission(client, data.kpiId)) {
        this.sendToClient(client, {
          type: 'error',
          error: 'Insufficient permissions for this KPI'
        });
        return;
      }
    } else if (data.channel) {
      channel = data.channel;
    } else {
      this.sendToClient(client, {
        type: 'error',
        error: 'Invalid subscription request'
      });
      return;
    }

    client.subscriptions.add(channel);
    console.log(`📊 Client ${client.id} subscribed to: ${channel}`);
    
    // Send current data immediately
    this.sendCurrentData(client, channel, data);
  }

  // Handle unsubscription requests
  private handleUnsubscription(client: WebSocketClient, data: any): void {
    if (!data) return;

    const channel = data.reportId ? `report:${data.reportId}` :
                   data.kpiId ? `kpi:${data.kpiId}` :
                   data.channel;

    if (channel) {
      client.subscriptions.delete(channel);
      console.log(`📊 Client ${client.id} unsubscribed from: ${channel}`);
    }
  }

  // Handle client disconnect
  private handleClientDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`📡 Client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    }
  }

  // Send current data for a channel
  private async sendCurrentData(client: WebSocketClient, channel: string, data: any): Promise<void> {
    try {
      if (channel.startsWith('report:')) {
        const reportId = channel.split(':')[1];
        // Get cached report data or fetch fresh data
        const reportData = await this.getCurrentReportData(client.tenantId, reportId, data.parameters);
        
        this.sendToClient(client, {
          type: 'data_update',
          channel,
          data: reportData,
          timestamp: Date.now()
        });
      } else if (channel.startsWith('kpi:')) {
        const kpiId = channel.split(':')[1];
        const kpiData = await this.getCurrentKPIData(client.tenantId, kpiId);
        
        this.sendToClient(client, {
          type: 'kpi_update',
          channel,
          data: kpiData,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error sending current data:', error);
      this.sendToClient(client, {
        type: 'error',
        channel,
        error: 'Failed to retrieve current data'
      });
    }
  }

  // Broadcast data update to all subscribed clients
  public broadcastDataUpdate(channel: string, data: any): void {
    const message: ServerMessage = {
      type: channel.startsWith('kpi:') ? 'kpi_update' : 'data_update',
      channel,
      data,
      timestamp: Date.now()
    };

    this.clients.forEach(client => {
      if (client.subscriptions.has(channel)) {
        this.sendToClient(client, message);
      }
    });

    console.log(`📡 Broadcasted update to channel: ${channel} (${this.getSubscriberCount(channel)} subscribers)`);
  }

  // Send message to specific client
  private sendToClient(client: WebSocketClient, message: ServerMessage): void {
    if (client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to client ${client.id}:`, error);
      }
    }
  }

  // Start heartbeat to detect disconnected clients
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60 seconds

      this.clients.forEach((client, clientId) => {
        if (now - client.lastHeartbeat > timeout) {
          console.log(`💀 Client ${clientId} timed out`);
          client.socket.close();
          this.clients.delete(clientId);
        }
      });
    }, 30000); // Check every 30 seconds
  }

  // Start data update loop for real-time channels
  private startDataUpdateLoop(): void {
    this.dataUpdateInterval = setInterval(async () => {
      // Update real-time KPIs
      await this.updateRealTimeKPIs();
      
      // Update real-time reports
      await this.updateRealTimeReports();
    }, 60000); // Update every minute
  }

  // Update real-time KPIs
  private async updateRealTimeKPIs(): Promise<void> {
    const kpiChannels = new Set<string>();
    
    // Collect all KPI channels that have subscribers
    this.clients.forEach(client => {
      client.subscriptions.forEach(subscription => {
        if (subscription.startsWith('kpi:')) {
          kpiChannels.add(subscription);
        }
      });
    });

    // Update each KPI channel
    for (const channel of kpiChannels) {
      try {
        const kpiId = channel.split(':')[1];
        const tenantIds = new Set(
          Array.from(this.clients.values())
            .filter(client => client.subscriptions.has(channel))
            .map(client => client.tenantId)
        );

        // Update for each tenant
        for (const tenantId of tenantIds) {
          const kpiData = await this.getCurrentKPIData(tenantId, kpiId);
          this.broadcastDataUpdate(channel, kpiData);
        }
      } catch (error) {
        console.error(`Error updating KPI ${channel}:`, error);
      }
    }
  }

  // Update real-time reports
  private async updateRealTimeReports(): Promise<void> {
    const reportChannels = new Set<string>();
    
    // Collect all report channels that have subscribers
    this.clients.forEach(client => {
      client.subscriptions.forEach(subscription => {
        if (subscription.startsWith('report:')) {
          reportChannels.add(subscription);
        }
      });
    });

    // Update each report channel (only for real-time reports)
    for (const channel of reportChannels) {
      try {
        const reportId = channel.split(':')[1];
        
        // Check if this is a real-time report
        if (await this.isRealTimeReport(reportId)) {
          const tenantIds = new Set(
            Array.from(this.clients.values())
              .filter(client => client.subscriptions.has(channel))
              .map(client => client.tenantId)
          );

          // Update for each tenant
          for (const tenantId of tenantIds) {
            const reportData = await this.getCurrentReportData(tenantId, reportId);
            this.broadcastDataUpdate(channel, reportData);
          }
        }
      } catch (error) {
        console.error(`Error updating report ${channel}:`, error);
      }
    }
  }

  // Helper methods
  private extractUserIdFromRequest(request: any): string | null {
    // Extract from query parameters, headers, or session
    // This is a simplified implementation
    return request.url?.includes('userId=') ? 
      new URL(request.url, 'http://localhost').searchParams.get('userId') : 
      null;
  }

  private extractTenantIdFromRequest(request: any): string | null {
    // Extract from query parameters, headers, or session
    return request.url?.includes('tenantId=') ? 
      new URL(request.url, 'http://localhost').searchParams.get('tenantId') : 
      null;
  }

  private extractPermissionsFromRequest(request: any): Record<string, boolean> {
    // In production, you'd extract from JWT token or session
    return {
      canViewReports: true,
      canViewKPIs: true,
      canViewSalesReports: true,
      canViewServiceReports: true
    };
  }

  private hasReportPermission(client: WebSocketClient, reportId: string): boolean {
    // Check if client has permission for specific report
    return client.permissions.canViewReports || false;
  }

  private hasKPIPermission(client: WebSocketClient, kpiId: string): boolean {
    // Check if client has permission for specific KPI
    return client.permissions.canViewKPIs || false;
  }

  private async getCurrentReportData(tenantId: string, reportId: string, parameters?: any): Promise<any> {
    // Try to get from cache first
    const cached = await reportingCache.getCachedReportData(tenantId, reportId, parameters || {});
    
    if (cached) {
      return cached.data;
    }

    // If not cached, return placeholder data
    // In production, you'd execute the actual report query
    return {
      timestamp: Date.now(),
      rows: [
        { metric: 'Active Users', value: Math.floor(Math.random() * 1000) + 500 },
        { metric: 'Revenue', value: Math.floor(Math.random() * 50000) + 25000 },
        { metric: 'Conversion Rate', value: (Math.random() * 10 + 5).toFixed(2) + '%' }
      ]
    };
  }

  private async getCurrentKPIData(tenantId: string, kpiId: string): Promise<any> {
    // Generate mock real-time KPI data
    return {
      id: kpiId,
      value: Math.floor(Math.random() * 1000) + 100,
      target: 1000,
      trend: {
        direction: Math.random() > 0.5 ? 'up' : 'down',
        percentage: (Math.random() * 10).toFixed(1)
      },
      last_updated: new Date().toISOString()
    };
  }

  private async isRealTimeReport(reportId: string): boolean {
    // Check if report is configured for real-time updates
    // For now, assume reports with 'sla' or 'real_time' in the ID are real-time
    return reportId.includes('sla') || reportId.includes('real_time');
  }

  private getSubscriberCount(channel: string): number {
    return Array.from(this.clients.values())
      .filter(client => client.subscriptions.has(channel))
      .length;
  }

  // Public methods for external use
  public getConnectedClients(): number {
    return this.clients.size;
  }

  public getActiveSubscriptions(): Record<string, number> {
    const subscriptions: Record<string, number> = {};
    
    this.clients.forEach(client => {
      client.subscriptions.forEach(subscription => {
        subscriptions[subscription] = (subscriptions[subscription] || 0) + 1;
      });
    });

    return subscriptions;
  }

  // Cleanup
  public destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.dataUpdateInterval) {
      clearInterval(this.dataUpdateInterval);
    }

    this.clients.forEach(client => {
      client.socket.close();
    });
    
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
    }

    console.log('🔌 WebSocket service destroyed');
  }
}

// Export singleton instance
export const webSocketService = WebSocketService.getInstance();
