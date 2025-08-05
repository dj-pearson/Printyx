import { ManufacturerIntegrationService } from './manufacturer-integration-service';
import { BaseManufacturerAdapter, CollectionResult } from './manufacturer-adapters/base-adapter';
import { CanonAdapter } from './manufacturer-adapters/canon-adapter';
import { XeroxAdapter } from './manufacturer-adapters/xerox-adapter';
import { HPAdapter } from './manufacturer-adapters/hp-adapter';
import { FMAuditAdapter } from './manufacturer-adapters/fmaudit-adapter';

/**
 * Unified Meter Collection Service
 * Orchestrates meter reading collection from all manufacturer integrations
 */
export class UnifiedMeterCollectionService {
  private integrationService: ManufacturerIntegrationService;
  private adapters: Map<string, BaseManufacturerAdapter> = new Map();

  constructor() {
    this.integrationService = new ManufacturerIntegrationService();
  }

  /**
   * Initialize adapter for a specific integration
   */
  private getAdapter(manufacturer: string, config: any): BaseManufacturerAdapter {
    const key = `${manufacturer}_${config.integrationId}`;
    
    if (this.adapters.has(key)) {
      return this.adapters.get(key)!;
    }

    let adapter: BaseManufacturerAdapter;

    switch (manufacturer.toLowerCase()) {
      case 'canon':
        adapter = new CanonAdapter(config);
        break;
      case 'xerox':
        adapter = new XeroxAdapter(config);
        break;
      case 'hp':
        adapter = new HPAdapter(config);
        break;
      case 'fmaudit':
      case 'printanista':
        adapter = new FMAuditAdapter(config);
        break;
      default:
        throw new Error(`Unsupported manufacturer: ${manufacturer}`);
    }

    this.adapters.set(key, adapter);
    return adapter;
  }

  /**
   * Run scheduled meter collection for all active integrations
   */
  async runScheduledCollection(): Promise<void> {
    try {
      console.log('Starting scheduled meter collection...');
      
      // Get all integrations due for collection
      const integrationsdue = await this.integrationService.getIntegrationsDueForCollection();
      
      console.log(`Found ${integrationsdue.length} integrations due for collection`);

      // Process each integration
      for (const integration of integrationsdue) {
        try {
          await this.collectFromIntegration(integration);
        } catch (error) {
          console.error(`Failed to collect from integration ${integration.id}:`, error);
          await this.integrationService.updateIntegrationStatus(
            integration.tenantId,
            integration.id,
            'error',
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }

      console.log('Scheduled meter collection completed');
    } catch (error) {
      console.error('Failed to run scheduled collection:', error);
    }
  }

  /**
   * Collect meter data from a specific integration
   */
  async collectFromIntegration(integration: any): Promise<void> {
    console.log(`Collecting data from ${integration.manufacturer} integration ${integration.id}`);

    try {
      // Get adapter for this integration
      const adapter = this.getAdapter(integration.manufacturer, {
        integrationId: integration.id,
        apiEndpoint: integration.apiEndpoint,
        apiVersion: integration.apiVersion,
        authType: integration.authType,
        authCredentials: integration.authCredentials,
        settings: integration.settings,
        fieldMappings: integration.fieldMappings
      });

      // Get all registered devices for this integration
      const devices = await this.integrationService.getDevices(integration.tenantId, integration.id);
      
      console.log(`Found ${devices.length} devices for integration ${integration.id}`);

      let successCount = 0;
      let errorCount = 0;

      // Collect metrics from each device
      for (const device of devices) {
        try {
          const result = await adapter.collectDeviceMetrics(device.deviceId);
          
          if (result.success && result.metrics.length > 0) {
            // Store collected metrics
            await this.integrationService.collectDeviceMetrics(
              integration.tenantId,
              device.id,
              result.metrics.map(metric => ({
                metricType: metric.metricType,
                metricName: metric.metricName,
                metricCategory: metric.metricCategory,
                numericValue: metric.numericValue,
                stringValue: metric.stringValue,
                booleanValue: metric.booleanValue,
                jsonValue: metric.jsonValue,
                unit: metric.unit,
                measurementTimestamp: metric.measurementTimestamp,
                collectionMethod: integration.integrationMethod,
                dataSource: integration.platformName,
                rawData: metric.rawData
              }))
            );

            successCount++;
            
            // Log successful collection
            await this.integrationService.logAuditEvent(
              integration.tenantId,
              integration.id,
              'data_collection',
              'success',
              `Successfully collected ${result.metrics.length} metrics from device ${device.serialNumber || device.deviceId}`,
              device.id,
              undefined,
              result.rawResponse,
              200,
              result.responseTimeMs
            );
          } else {
            errorCount++;
            
            // Log collection failure
            await this.integrationService.logAuditEvent(
              integration.tenantId,
              integration.id,
              'data_collection',
              'error',
              `Failed to collect metrics from device ${device.serialNumber || device.deviceId}: ${result.error}`,
              device.id,
              undefined,
              result.rawResponse,
              undefined,
              result.responseTimeMs
            );
          }

          // Add small delay between device collections to avoid rate limiting
          await this.sleep(1000);
          
        } catch (error) {
          errorCount++;
          console.error(`Failed to collect from device ${device.deviceId}:`, error);
          
          await this.integrationService.logAuditEvent(
            integration.tenantId,
            integration.id,
            'data_collection',
            'error',
            `Exception collecting from device ${device.serialNumber || device.deviceId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            device.id
          );
        }
      }

      // Update integration status based on results
      if (errorCount === 0) {
        await this.integrationService.updateIntegrationStatus(
          integration.tenantId,
          integration.id,
          'active'
        );
      } else if (successCount > 0) {
        await this.integrationService.updateIntegrationStatus(
          integration.tenantId,
          integration.id,
          'active',
          `Partial success: ${successCount} succeeded, ${errorCount} failed`
        );
      } else {
        await this.integrationService.updateIntegrationStatus(
          integration.tenantId,
          integration.id,
          'error',
          `All device collections failed (${errorCount} devices)`
        );
      }

      // Calculate and update next collection time
      const nextCollectionTime = this.integrationService.calculateNextCollectionTime(
        integration.collectionFrequency,
        new Date()
      );
      
      await this.integrationService.updateNextCollectionTime(integration.id, nextCollectionTime);

      console.log(`Integration ${integration.id} collection completed: ${successCount} success, ${errorCount} errors`);

    } catch (error) {
      console.error(`Failed to process integration ${integration.id}:`, error);
      
      await this.integrationService.updateIntegrationStatus(
        integration.tenantId,
        integration.id,
        'error',
        error instanceof Error ? error.message : 'Unknown error'
      );

      await this.integrationService.logAuditEvent(
        integration.tenantId,
        integration.id,
        'integration_error',
        'error',
        `Integration processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Test connection for a specific integration
   */
  async testIntegrationConnection(tenantId: string, integrationId: string): Promise<boolean> {
    try {
      const integration = await this.integrationService.getIntegrationById(tenantId, integrationId);
      if (!integration) {
        throw new Error('Integration not found');
      }

      const adapter = this.getAdapter(integration.manufacturer, {
        integrationId: integration.id,
        apiEndpoint: integration.apiEndpoint,
        apiVersion: integration.apiVersion,
        authType: integration.authType,
        authCredentials: integration.authCredentials,
        settings: integration.settings,
        fieldMappings: integration.fieldMappings
      });

      const success = await adapter.testConnection();
      
      await this.integrationService.logAuditEvent(
        tenantId,
        integrationId,
        'connection_test',
        success ? 'success' : 'error',
        success ? 'Connection test successful' : 'Connection test failed'
      );

      return success;
    } catch (error) {
      await this.integrationService.logAuditEvent(
        tenantId,
        integrationId,
        'connection_test',
        'error',
        `Connection test error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  }

  /**
   * Discover devices for a specific integration
   */
  async discoverDevicesForIntegration(tenantId: string, integrationId: string): Promise<any[]> {
    try {
      const integration = await this.integrationService.getIntegrationById(tenantId, integrationId);
      if (!integration) {
        throw new Error('Integration not found');
      }

      const adapter = this.getAdapter(integration.manufacturer, {
        integrationId: integration.id,
        apiEndpoint: integration.apiEndpoint,
        apiVersion: integration.apiVersion,
        authType: integration.authType,
        authCredentials: integration.authCredentials,
        settings: integration.settings,
        fieldMappings: integration.fieldMappings
      });

      const devices = await adapter.discoverDevices();
      
      await this.integrationService.logAuditEvent(
        tenantId,
        integrationId,
        'device_discovery',
        'success',
        `Discovered ${devices.length} devices`
      );

      return devices;
    } catch (error) {
      await this.integrationService.logAuditEvent(
        tenantId,
        integrationId,
        'device_discovery',
        'error',
        `Device discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return [];
    }
  }

  /**
   * Manually trigger collection for a specific device
   */
  async collectFromDevice(tenantId: string, deviceRegistrationId: string): Promise<CollectionResult> {
    try {
      const device = await this.integrationService.getDeviceById(tenantId, deviceRegistrationId);
      if (!device) {
        throw new Error('Device not found');
      }

      const integration = await this.integrationService.getIntegrationById(tenantId, device.integrationId);
      if (!integration) {
        throw new Error('Integration not found');
      }

      const adapter = this.getAdapter(integration.manufacturer, {
        integrationId: integration.id,
        apiEndpoint: integration.apiEndpoint,
        apiVersion: integration.apiVersion,
        authType: integration.authType,
        authCredentials: integration.authCredentials,
        settings: integration.settings,
        fieldMappings: integration.fieldMappings
      });

      const result = await adapter.collectDeviceMetrics(device.deviceId);
      
      if (result.success && result.metrics.length > 0) {
        // Store collected metrics
        await this.integrationService.collectDeviceMetrics(
          tenantId,
          deviceRegistrationId,
          result.metrics.map(metric => ({
            metricType: metric.metricType,
            metricName: metric.metricName,
            metricCategory: metric.metricCategory,
            numericValue: metric.numericValue,
            stringValue: metric.stringValue,
            booleanValue: metric.booleanValue,
            jsonValue: metric.jsonValue,
            unit: metric.unit,
            measurementTimestamp: metric.measurementTimestamp,
            collectionMethod: integration.integrationMethod,
            dataSource: integration.platformName,
            rawData: metric.rawData
          }))
        );
      }

      // Log the collection attempt
      await this.integrationService.logAuditEvent(
        tenantId,
        integration.id,
        'manual_collection',
        result.success ? 'success' : 'error',
        `Manual collection from device ${device.serialNumber || device.deviceId}: ${result.success ? `${result.metrics.length} metrics collected` : result.error}`,
        deviceRegistrationId,
        undefined,
        result.rawResponse,
        undefined,
        result.responseTimeMs
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        deviceId: deviceRegistrationId,
        metrics: [],
        error: errorMessage
      };
    }
  }

  /**
   * Get collection statistics for monitoring
   */
  async getCollectionStatistics(): Promise<any> {
    // This would be implemented to provide statistics for monitoring dashboard
    // For now, return placeholder data
    return {
      totalIntegrations: 0,
      activeIntegrations: 0,
      totalDevices: 0,
      successfulCollections: 0,
      failedCollections: 0,
      lastCollectionTime: new Date()
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const unifiedMeterCollectionService = new UnifiedMeterCollectionService();