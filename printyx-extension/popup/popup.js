/**
 * Printyx Extension - Popup Logic
 */

let apiClient = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Printyx Popup] Initializing');

  // Initialize API client
  apiClient = new window.PrintyxApiClient();
  await apiClient.init();

  // Load configuration
  await loadConfiguration();

  // Check connection status
  await checkConnectionStatus();

  // Load import history
  await loadImportHistory();

  // Setup event listeners
  setupEventListeners();
});

/**
 * Load saved configuration
 */
async function loadConfiguration() {
  const config = await chrome.storage.sync.get(['apiBaseUrl', 'tenantId', 'configured']);

  // Set API URL input
  const apiUrlInput = document.getElementById('api-url');
  if (config.apiBaseUrl) {
    apiUrlInput.value = config.apiBaseUrl;
  }

  // Show/hide sections based on configuration
  if (config.configured) {
    document.getElementById('stats-section').style.display = 'block';
    document.getElementById('history-section').style.display = 'block';
  }
}

/**
 * Save configuration
 */
async function saveConfiguration() {
  const apiUrl = document.getElementById('api-url').value.trim();

  if (!apiUrl) {
    showAlert('Please enter a valid Printyx API URL', 'error');
    return;
  }

  // Validate URL format
  try {
    new URL(apiUrl);
  } catch (error) {
    showAlert('Invalid URL format', 'error');
    return;
  }

  // Save configuration
  await chrome.storage.sync.set({
    apiBaseUrl: apiUrl,
    configured: true,
  });

  // Update API client
  apiClient.baseUrl = apiUrl;

  showAlert('Configuration saved successfully!', 'success');

  // Test connection
  await checkConnectionStatus();

  // Show stats sections
  document.getElementById('stats-section').style.display = 'block';
  document.getElementById('history-section').style.display = 'block';
}

/**
 * Test API connection
 */
async function testConnection() {
  const button = document.getElementById('test-connection');
  const originalText = button.textContent;

  button.textContent = 'Testing...';
  button.disabled = true;

  try {
    const result = await apiClient.checkHealth();

    if (result.status === 'healthy') {
      showAlert('Connection successful!', 'success');

      // Save tenant ID if received
      if (result.tenant?.id) {
        await chrome.storage.sync.set({
          tenantId: result.tenant.id,
        });
        apiClient.tenantId = result.tenant.id;
      }

      // Update status indicator
      updateStatus('connected', 'Connected');
    } else {
      throw new Error('API returned unhealthy status');
    }
  } catch (error) {
    showAlert(`Connection failed: ${error.message}`, 'error');
    updateStatus('error', 'Connection Failed');
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

/**
 * Check connection status
 */
async function checkConnectionStatus() {
  try {
    const result = await apiClient.checkHealth();

    if (result.status === 'healthy') {
      updateStatus('connected', 'Connected');

      // Update tenant ID
      if (result.tenant?.id) {
        await chrome.storage.sync.set({
          tenantId: result.tenant.id,
        });
        apiClient.tenantId = result.tenant.id;
      }

      return true;
    } else {
      updateStatus('error', 'Unhealthy');
      return false;
    }
  } catch (error) {
    console.error('[Printyx Popup] Health check failed:', error);
    updateStatus('disconnected', 'Not Connected');
    return false;
  }
}

/**
 * Update connection status indicator
 */
function updateStatus(status, text) {
  const statusEl = document.getElementById('status');
  statusEl.className = `status status-${status}`;
  statusEl.querySelector('.status-text').textContent = text;
}

/**
 * Load import history
 */
async function loadImportHistory() {
  const storage = await chrome.storage.local.get(['importHistory']);
  const history = storage.importHistory || [];

  // Update stats
  updateStats(history);

  // Update history list
  updateHistoryList(history);
}

/**
 * Update statistics
 */
function updateStats(history) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const todayCount = history.filter((item) => new Date(item.importedAt) >= today).length;
  const weekCount = history.filter((item) => new Date(item.importedAt) >= weekAgo).length;

  document.getElementById('stat-total').textContent = history.length;
  document.getElementById('stat-today').textContent = todayCount;
  document.getElementById('stat-week').textContent = weekCount;
}

/**
 * Update history list
 */
function updateHistoryList(history) {
  const listEl = document.getElementById('import-list');

  if (history.length === 0) {
    listEl.innerHTML = '<p class="empty-state">No imports yet</p>';
    return;
  }

  // Show only last 10
  const recentHistory = history.slice(0, 10);

  listEl.innerHTML = recentHistory
    .map(
      (item) => `
    <div class="import-item">
      <div class="import-info">
        <strong>${item.name}</strong>
        <p>${item.jobTitle || 'Unknown Title'} at ${item.company}</p>
        <small>${formatTimeAgo(item.importedAt)}</small>
      </div>
      <div class="import-badge ${item.enrichmentSource === 'apollo' ? 'enriched' : ''}">
        ${item.enrichmentSource === 'apollo' ? '✓ Enriched' : 'Manual'}
      </div>
    </div>
  `,
    )
    .join('');
}

/**
 * Format time ago
 */
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

/**
 * Show alert message
 */
function showAlert(message, type = 'info') {
  // Remove existing alert
  const existingAlert = document.querySelector('.alert-toast');
  if (existingAlert) {
    existingAlert.remove();
  }

  // Create alert
  const alert = document.createElement('div');
  alert.className = `alert-toast alert-${type}`;
  alert.textContent = message;

  document.body.appendChild(alert);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    alert.remove();
  }, 3000);
}

/**
 * Clear import history
 */
async function clearHistory() {
  if (!confirm('Are you sure you want to clear all import history?')) {
    return;
  }

  await chrome.storage.local.set({ importHistory: [] });
  await loadImportHistory();

  showAlert('Import history cleared', 'success');
}

/**
 * Open Printyx CRM in new tab
 */
async function openCRM() {
  const config = await chrome.storage.sync.get(['apiBaseUrl']);
  const baseUrl = config.apiBaseUrl || 'http://localhost:5000';

  chrome.tabs.create({
    url: baseUrl,
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Save configuration
  document.getElementById('save-config').addEventListener('click', saveConfiguration);

  // Test connection
  document.getElementById('test-connection').addEventListener('click', testConnection);

  // Clear history
  document.getElementById('clear-history').addEventListener('click', clearHistory);

  // Open CRM
  document.getElementById('open-crm').addEventListener('click', openCRM);

  // View settings (same as config section)
  document.getElementById('view-settings').addEventListener('click', () => {
    document.getElementById('config-section').scrollIntoView({ behavior: 'smooth' });
  });

  // Listen for storage changes (updates from content script)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.importHistory) {
      loadImportHistory();
    }
  });
}

console.log('[Printyx Popup] Loaded');
