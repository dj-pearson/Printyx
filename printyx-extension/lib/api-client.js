/**
 * Printyx API Client
 *
 * Handles all communication with the Printyx backend API
 */

class PrintyxApiClient {
  constructor() {
    this.baseUrl = null;
    this.sessionCookie = null;
    this.tenantId = null;
  }

  /**
   * Initialize client with stored configuration
   */
  async init() {
    const config = await chrome.storage.sync.get(['apiBaseUrl', 'tenantId']);

    this.baseUrl = config.apiBaseUrl || 'http://localhost:5000';
    this.tenantId = config.tenantId;

    console.log('[Printyx API] Initialized:', {
      baseUrl: this.baseUrl,
      tenantId: this.tenantId
    });
  }

  /**
   * Make authenticated API request
   */
  async request(endpoint, options = {}) {
    if (!this.baseUrl) {
      await this.init();
    }

    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add tenant ID header if available
    if (this.tenantId) {
      headers['X-Tenant-ID'] = this.tenantId;
    }

    try {
      console.log(`[Printyx API] ${options.method || 'GET'} ${endpoint}`);

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include' // Send cookies for session auth
      });

      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        throw new Error('Not authenticated. Please log in to Printyx first.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || `API error: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('[Printyx API] Request failed:', error);
      throw error;
    }
  }

  /**
   * Check API health and authentication status
   */
  async checkHealth() {
    return this.request('/api/extension/health');
  }

  /**
   * Check if a lead already exists
   */
  async checkDuplicate(params) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/extension/leads/check-duplicate?${query}`);
  }

  /**
   * Quick import lead from LinkedIn profile
   */
  async quickImport(profileData) {
    return this.request('/api/extension/leads/quick-import', {
      method: 'POST',
      body: JSON.stringify(profileData)
    });
  }

  /**
   * Get recent import history
   */
  async getImportHistory(limit = 10) {
    // TODO: Implement when backend endpoint is ready
    return [];
  }
}

// Export for use in background script and popup
if (typeof window !== 'undefined') {
  window.PrintyxApiClient = PrintyxApiClient;
}
