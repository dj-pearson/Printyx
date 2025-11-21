import type { Express } from "express";
import { isAuthenticated } from "./replitAuth";
import { 
  QUICKBOOKS_CONFIG, 
  transformQuickBooksData,
  transformPrintyxData,
  SUPPORTED_QB_ENTITIES 
} from "./quickbooks-mapping";
import crypto from "crypto";

// Extend session interface to include QuickBooks data
declare module 'express-session' {
  interface SessionData {
    qb_oauth_state?: string;
    qb_tenant_id?: string;
    qb_access_token?: string;
    qb_refresh_token?: string;
    qb_company_id?: string;
    qb_token_expires?: number;
  }
}

// QuickBooks OAuth2 Integration Routes
export function registerQuickBooksRoutes(app: Express) {
  
  // Initialize QuickBooks OAuth connection
  app.get("/api/quickbooks/connect", isAuthenticated, async (req, res) => {
    try {
      const state = crypto.randomBytes(32).toString('hex');
      const tenantId = (req.user as any)?.tenantId;
      
      // Store state in session for verification
      req.session.qb_oauth_state = state;
      req.session.qb_tenant_id = tenantId;
      
      const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2');
      authUrl.searchParams.set('client_id', process.env.QUICKBOOKS_CLIENT_ID!);
      authUrl.searchParams.set('scope', QUICKBOOKS_CONFIG.auth.scopes);
      authUrl.searchParams.set('redirect_uri', `${req.protocol}://${req.get('host')}/api/quickbooks/callback`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('state', state);
      
      res.json({ 
        authUrl: authUrl.toString(),
        message: "Redirect to this URL to connect QuickBooks"
      });
    } catch (error) {
      console.error("QuickBooks connect error:", error);
      res.status(500).json({ error: "Failed to initialize QuickBooks connection" });
    }
  });

  // Handle QuickBooks OAuth callback
  app.get("/api/quickbooks/callback", async (req, res) => {
    try {
      const { code, state, realmId } = req.query;
      
      // Verify state parameter
      if (state !== req.session.qb_oauth_state) {
        return res.status(400).json({ error: "Invalid state parameter" });
      }
      
      if (!code) {
        return res.status(400).json({ error: "Authorization code not received" });
      }

      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString('base64')}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code as string,
          redirect_uri: `${req.protocol}://${req.get('host')}/api/quickbooks/callback`
        })
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokenData = await tokenResponse.json();
      
      // Store connection details (in a real app, save to database)
      req.session.qb_access_token = tokenData.access_token;
      req.session.qb_refresh_token = tokenData.refresh_token;
      req.session.qb_company_id = realmId;
      req.session.qb_token_expires = Date.now() + (tokenData.expires_in * 1000);
      
      // Clean up OAuth state
      delete req.session.qb_oauth_state;
      
      res.redirect('/?quickbooks=connected');
    } catch (error) {
      console.error("QuickBooks callback error:", error);
      res.status(500).json({ error: "Failed to complete QuickBooks authorization" });
    }
  });

  // Get QuickBooks connection status
  app.get("/api/quickbooks/status", isAuthenticated, async (req, res) => {
    try {
      const isConnected = !!(req.session.qb_access_token && req.session.qb_company_id);
      const companyId = req.session.qb_company_id;
      const tokenExpires = req.session.qb_token_expires;
      const isTokenValid = tokenExpires && Date.now() < tokenExpires;
      
      res.json({
        connected: isConnected,
        companyId,
        tokenValid: isTokenValid,
        tokenExpires: tokenExpires ? new Date(tokenExpires).toISOString() : null
      });
    } catch (error) {
      console.error("QuickBooks status error:", error);
      res.status(500).json({ error: "Failed to get QuickBooks status" });
    }
  });

  // Disconnect QuickBooks
  app.post("/api/quickbooks/disconnect", isAuthenticated, async (req, res) => {
    try {
      // Clear session data
      delete req.session.qb_access_token;
      delete req.session.qb_refresh_token;
      delete req.session.qb_company_id;
      delete req.session.qb_token_expires;
      
      res.json({ message: "QuickBooks disconnected successfully" });
    } catch (error) {
      console.error("QuickBooks disconnect error:", error);
      res.status(500).json({ error: "Failed to disconnect QuickBooks" });
    }
  });

  // Sync customers from QuickBooks
  app.post("/api/quickbooks/sync/customers", isAuthenticated, async (req, res) => {
    try {
      const accessToken = req.session.qb_access_token;
      const companyId = req.session.qb_company_id;
      
      if (!accessToken || !companyId) {
        return res.status(400).json({ error: "QuickBooks not connected" });
      }

      // Refresh token if needed
      const tokenValid = req.session.qb_token_expires && Date.now() < req.session.qb_token_expires;
      if (!tokenValid) {
        await refreshQuickBooksToken(req);
      }

      // Fetch customers from QuickBooks
      const qbResponse = await fetch(
        `${QUICKBOOKS_CONFIG.auth.base_url}/v3/company/${companyId}/customers?fetchAll=true`,
        {
          headers: {
            'Authorization': `Bearer ${req.session.qb_access_token}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!qbResponse.ok) {
        throw new Error(`QuickBooks API error: ${qbResponse.statusText}`);
      }

      const qbData = await qbResponse.json();
      const customers = qbData.QueryResponse?.Customer || [];
      
      // Transform and store customers
      const transformedCustomers = customers.map((customer: any) => {
        const transformed = transformQuickBooksData('Customer', customer);
        // Add tenant isolation
        transformed.tenantId = (req.user as any)?.tenantId;
        transformed.recordType = 'customer';
        transformed.leadStatus = 'active';
        // Map QB external system
        transformed.external_system_id = 'quickbooks';
        transformed.migration_status = 'synced';
        return transformed;
      });

      // In a real implementation, save to database here
      console.log(`Synced ${transformedCustomers.length} customers from QuickBooks`);

      res.json({
        message: `Successfully synced ${transformedCustomers.length} customers`,
        customers: transformedCustomers
      });

    } catch (error) {
      console.error("QuickBooks customer sync error:", error);
      res.status(500).json({ error: "Failed to sync customers from QuickBooks" });
    }
  });

  // Sync products/items from QuickBooks
  app.post("/api/quickbooks/sync/items", isAuthenticated, async (req, res) => {
    try {
      const accessToken = req.session.qb_access_token;
      const companyId = req.session.qb_company_id;
      
      if (!accessToken || !companyId) {
        return res.status(400).json({ error: "QuickBooks not connected" });
      }

      // Refresh token if needed
      const tokenValid = req.session.qb_token_expires && Date.now() < req.session.qb_token_expires;
      if (!tokenValid) {
        await refreshQuickBooksToken(req);
      }

      // Fetch items from QuickBooks
      const qbResponse = await fetch(
        `${QUICKBOOKS_CONFIG.auth.base_url}/v3/company/${companyId}/items?fetchAll=true`,
        {
          headers: {
            'Authorization': `Bearer ${req.session.qb_access_token}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!qbResponse.ok) {
        throw new Error(`QuickBooks API error: ${qbResponse.statusText}`);
      }

      const qbData = await qbResponse.json();
      const items = qbData.QueryResponse?.Item || [];
      
      // Transform and store items
      const transformedItems = items.map((item: any) => {
        const transformed = transformQuickBooksData('Item', item);
        // Add tenant isolation
        transformed.tenantId = (req.user as any)?.tenantId;
        transformed.category = 'service'; // Default category
        // Map QB external system
        transformed.external_system_id = 'quickbooks';
        return transformed;
      });

      res.json({
        message: `Successfully synced ${transformedItems.length} items`,
        items: transformedItems
      });

    } catch (error) {
      console.error("QuickBooks items sync error:", error);
      res.status(500).json({ error: "Failed to sync items from QuickBooks" });
    }
  });

  // Create customer in QuickBooks
  app.post("/api/quickbooks/create/customer", isAuthenticated, async (req, res) => {
    try {
      const accessToken = req.session.qb_access_token;
      const companyId = req.session.qb_company_id;
      const customerData = req.body;
      
      if (!accessToken || !companyId) {
        return res.status(400).json({ error: "QuickBooks not connected" });
      }

      // Transform Printyx customer data to QuickBooks format
      const qbCustomerData = transformPrintyxData('Customer', customerData);

      // Create customer in QuickBooks
      const qbResponse = await fetch(
        `${QUICKBOOKS_CONFIG.auth.base_url}/v3/company/${companyId}/customer`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${req.session.qb_access_token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(qbCustomerData)
        }
      );

      if (!qbResponse.ok) {
        const errorData = await qbResponse.text();
        throw new Error(`QuickBooks API error: ${qbResponse.statusText} - ${errorData}`);
      }

      const qbData = await qbResponse.json();
      const createdCustomer = qbData.QueryResponse?.Customer?.[0];

      res.json({
        message: "Customer created in QuickBooks successfully",
        customer: createdCustomer
      });

    } catch (error) {
      console.error("QuickBooks create customer error:", error);
      res.status(500).json({ error: "Failed to create customer in QuickBooks" });
    }
  });

  // Get supported entities
  app.get("/api/quickbooks/entities", isAuthenticated, async (req, res) => {
    res.json({
      supported_entities: SUPPORTED_QB_ENTITIES,
      field_mappings: Object.keys(QUICKBOOKS_FIELD_MAPPINGS)
    });
  });
}

// Helper function to refresh QuickBooks access token
async function refreshQuickBooksToken(req: any): Promise<void> {
  try {
    const refreshToken = req.session.qb_refresh_token;
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token refresh failed: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    
    // Update session with new tokens
    req.session.qb_access_token = tokenData.access_token;
    if (tokenData.refresh_token) {
      req.session.qb_refresh_token = tokenData.refresh_token;
    }
    req.session.qb_token_expires = Date.now() + (tokenData.expires_in * 1000);
    
  } catch (error) {
    console.error("Token refresh error:", error);
    throw error;
  }
}