/**
 * INTEGRATIONS SERVICE
 * Handles connections to real third-party APIs
 */

export class IntegrationsService {
  /**
   * Test connection to integration
   */
  static async testConnection(key: string, credentials: any): Promise<boolean> {
    try {
      switch (key) {
        case 'salesforce':
          return await this.testSalesforceConnection(credentials);
        case 'quickbooks':
          return await this.testQuickBooksConnection(credentials);
        case 'e-automate':
          return await this.testEAutomateConnection(credentials);
        case 'apollo':
          return await this.testApolloConnection(credentials);
        case 'zoominfo':
          return await this.testZoomInfoConnection(credentials);
        default:
          return false;
      }
    } catch (error) {
      console.error(`Error testing ${key} connection:`, error);
      return false;
    }
  }

  /**
   * Salesforce Connection Test
   */
  private static async testSalesforceConnection(credentials: any): Promise<boolean> {
    try {
      const response = await fetch(`${credentials.instanceUrl}/services/data/v59.0/`, {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Sync Salesforce Leads
   */
  static async syncSalesforceLeads(
    accessToken: string,
    instanceUrl: string,
    lastSyncedAt?: Date,
  ): Promise<any[]> {
    try {
      const query = `SELECT Id, Name, Email, Phone, Company FROM Lead`;
      const response = await fetch(
        `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.records || [];
    } catch (error) {
      console.error('Error syncing Salesforce leads:', error);
      return [];
    }
  }

  /**
   * QuickBooks Connection Test
   */
  private static async testQuickBooksConnection(credentials: any): Promise<boolean> {
    try {
      const response = await fetch(
        `https://quickbooks.api.intuit.com/v2/company/${credentials.realmId}/companyinfo/${credentials.realmId}`,
        {
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Sync QuickBooks Invoices
   */
  static async syncQuickBooksInvoices(
    realmId: string,
    accessToken: string,
    lastSyncedAt?: Date,
  ): Promise<any[]> {
    try {
      const query = "select * from Invoice";
      const response = await fetch(
        `https://quickbooks.api.intuit.com/v2/company/${realmId}/query?query=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.QueryResponse?.Invoice || [];
    } catch (error) {
      console.error('Error syncing QuickBooks invoices:', error);
      return [];
    }
  }

  /**
   * E-Automate Connection Test
   */
  private static async testEAutomateConnection(credentials: any): Promise<boolean> {
    try {
      const response = await fetch('https://api.e-automate.com/api/v1/equipment', {
        headers: {
          Authorization: `Bearer ${credentials.sessionToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Sync E-Automate Equipment
   */
  static async syncEAutomateEquipment(sessionToken: string): Promise<any[]> {
    try {
      const response = await fetch('https://api.e-automate.com/api/v1/equipment?limit=1000', {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.equipment || [];
    } catch (error) {
      console.error('Error syncing E-Automate equipment:', error);
      return [];
    }
  }

  /**
   * Apollo Connection Test
   */
  private static async testApolloConnection(credentials: any): Promise<boolean> {
    try {
      const response = await fetch('https://api.apollo.io/v1/contacts', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
          'x-api-key': credentials.apiKey,
        },
      });
      return response.ok || response.status === 400; // 400 means auth is ok but bad params
    } catch {
      return false;
    }
  }

  /**
   * Search Apollo Prospects
   */
  static async searchApolloProspects(apiKey: string, entityType: string): Promise<any[]> {
    try {
      const response = await fetch('https://api.apollo.io/v1/contacts', {
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          q_organization_industries: ['computer_software'],
          person_titles: ['sales'],
          limit: 100,
        }),
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.contacts || [];
    } catch (error) {
      console.error('Error searching Apollo prospects:', error);
      return [];
    }
  }

  /**
   * ZoomInfo Connection Test
   */
  private static async testZoomInfoConnection(credentials: any): Promise<boolean> {
    try {
      const response = await fetch('https://api.zoominfo.com/v2/company/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      return response.ok || response.status === 400;
    } catch {
      return false;
    }
  }

  /**
   * Search ZoomInfo Companies
   */
  static async searchZoomInfoCompanies(apiKey: string, entityType: string): Promise<any[]> {
    try {
      const response = await fetch('https://api.zoominfo.com/v2/company/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: 100,
          countries: ['United States'],
        }),
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error searching ZoomInfo companies:', error);
      return [];
    }
  }
}
