/**
 * Printyx Extension - Background Service Worker
 *
 * Handles background tasks:
 * - Extension installation and updates
 * - API health checks
 * - Badge updates
 * - Message passing between content scripts and popup
 */

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Printyx Extension] Installed:', details.reason);

  if (details.reason === 'install') {
    // First time installation
    showWelcomeNotification();

    // Set default configuration
    chrome.storage.sync.set({
      apiBaseUrl: 'http://localhost:5000', // Default to local development
      configured: false
    });

    // Open configuration page
    chrome.tabs.create({
      url: 'popup/popup.html'
    });
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('[Printyx Extension] Updated to', chrome.runtime.getManifest().version);
  }
});

// Show welcome notification
function showWelcomeNotification() {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'assets/icons/icon128.png',
    title: 'Welcome to Printyx CRM Extension!',
    message: 'Click the extension icon to configure your Printyx account.',
    priority: 2
  });
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Printyx Extension] Message received:', message.type);

  switch (message.type) {
    case 'IMPORT_SUCCESS':
      handleImportSuccess(message.data);
      break;

    case 'IMPORT_ERROR':
      handleImportError(message.error);
      break;

    case 'CHECK_HEALTH':
      checkApiHealth().then(sendResponse);
      return true; // Will respond asynchronously

    case 'GET_CONFIG':
      getConfiguration().then(sendResponse);
      return true;

    default:
      console.warn('[Printyx Extension] Unknown message type:', message.type);
  }
});

// Handle successful import
function handleImportSuccess(data) {
  // Update badge
  chrome.action.setBadgeText({ text: '✓' });
  chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });

  // Clear badge after 3 seconds
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 3000);

  // Show notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'assets/icons/icon128.png',
    title: 'Contact Added to Printyx!',
    message: `${data.name} has been imported to your CRM.`,
    priority: 1
  });
}

// Handle import error
function handleImportError(error) {
  // Update badge
  chrome.action.setBadgeText({ text: '!' });
  chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });

  // Clear badge after 5 seconds
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 5000);

  console.error('[Printyx Extension] Import error:', error);
}

// Check API health
async function checkApiHealth() {
  try {
    const config = await chrome.storage.sync.get(['apiBaseUrl']);
    const baseUrl = config.apiBaseUrl || 'http://localhost:5000';

    const response = await fetch(`${baseUrl}/api/extension/health`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    return {
      healthy: data.status === 'healthy',
      data
    };
  } catch (error) {
    console.error('[Printyx Extension] Health check failed:', error);
    return {
      healthy: false,
      error: error.message
    };
  }
}

// Get current configuration
async function getConfiguration() {
  const config = await chrome.storage.sync.get([
    'apiBaseUrl',
    'tenantId',
    'configured'
  ]);

  return config;
}

// Periodic health check (every 5 minutes)
chrome.alarms.create('healthCheck', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'healthCheck') {
    checkApiHealth().then((result) => {
      if (result.healthy) {
        console.log('[Printyx Extension] Health check passed');
      } else {
        console.warn('[Printyx Extension] Health check failed:', result.error);

        // Update badge to indicate issue
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
      }
    });
  }
});

// Handle extension icon click (opens popup automatically with action.default_popup)
chrome.action.onClicked.addListener((tab) => {
  console.log('[Printyx Extension] Icon clicked on tab:', tab.id);
});

console.log('[Printyx Extension] Background service worker loaded');
