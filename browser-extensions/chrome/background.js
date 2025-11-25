/**
 * Background service worker for Printyx Knowledge Capture
 */

// API Configuration
let API_URL = 'https://printyx.net/api';
let AUTH_TOKEN = '';

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Printyx Knowledge Capture extension installed');

  // Create context menu
  chrome.contextMenus.create({
    id: 'capture-selection',
    title: 'Capture to Printyx KB',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'capture-page',
    title: 'Capture entire page to Printyx KB',
    contexts: ['page'],
  });

  // Load settings
  chrome.storage.sync.get(['apiUrl', 'authToken'], (result) => {
    if (result.apiUrl) API_URL = result.apiUrl;
    if (result.authToken) AUTH_TOKEN = result.authToken;
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'capture-selection') {
    captureSelection(info, tab);
  } else if (info.menuItemId === 'capture-page') {
    capturePage(tab);
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'capture') {
    handleCapture(message.data)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  } else if (message.action === 'getSettings') {
    chrome.storage.sync.get(['apiUrl', 'authToken', 'tenantId', 'userId'], (result) => {
      sendResponse(result);
    });
    return true;
  }
});

/**
 * Capture selected text
 */
async function captureSelection(info, tab) {
  const selection = info.selectionText;
  const pageUrl = info.pageUrl;

  // Send to content script to get more context
  const response = await chrome.tabs.sendMessage(tab.id, {
    action: 'getPageContext',
  });

  const content = {
    sections: [
      {
        type: 'header',
        content: response.title,
        order: 1,
      },
      {
        type: 'paragraph',
        content: selection,
        order: 2,
      },
      {
        type: 'paragraph',
        content: `Source: ${pageUrl}`,
        order: 3,
      },
    ],
  };

  await saveToKnowledgeBase({
    title: `${response.title} - Captured Selection`,
    content,
    sourceUrl: pageUrl,
    captureType: 'selection',
  });

  // Show notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Printyx KB Capture',
    message: 'Selection captured successfully!',
  });
}

/**
 * Capture entire page
 */
async function capturePage(tab) {
  // Send message to content script to extract page content
  const response = await chrome.tabs.sendMessage(tab.id, {
    action: 'extractPageContent',
  });

  await saveToKnowledgeBase({
    title: response.title,
    content: response.content,
    sourceUrl: tab.url,
    captureType: 'full_page',
    metadata: {
      author: response.author,
      publishedDate: response.publishedDate,
      description: response.description,
    },
  });

  // Show notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Printyx KB Capture',
    message: 'Page captured successfully!',
  });
}

/**
 * Handle capture request
 */
async function handleCapture(data) {
  return await saveToKnowledgeBase(data);
}

/**
 * Save content to knowledge base via API
 */
async function saveToKnowledgeBase(data) {
  const settings = await chrome.storage.sync.get(['apiUrl', 'authToken', 'tenantId', 'userId', 'defaultCategoryId']);

  if (!settings.authToken) {
    throw new Error('Not authenticated. Please configure the extension.');
  }

  if (!settings.tenantId || !settings.userId) {
    throw new Error('Missing tenant or user ID. Please configure the extension.');
  }

  if (!settings.defaultCategoryId) {
    throw new Error('No default category set. Please configure the extension.');
  }

  const apiUrl = settings.apiUrl || API_URL;

  const articleData = {
    title: data.title,
    content: data.content,
    categoryId: data.categoryId || settings.defaultCategoryId,
    excerpt: data.excerpt || `Captured from ${data.sourceUrl}`,
    tags: data.tags || ['web-capture', ...(data.captureType ? [data.captureType] : [])],
    contentType: 'reference',
    difficultyLevel: 'beginner',
    metadata: {
      sourceUrl: data.sourceUrl,
      captureDate: new Date().toISOString(),
      captureType: data.captureType || 'manual',
      ...data.metadata,
    },
  };

  const response = await fetch(`${apiUrl}/knowledge-base/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.authToken}`,
      'X-Tenant-ID': settings.tenantId,
    },
    body: JSON.stringify(articleData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to save to knowledge base');
  }

  return await response.json();
}

/**
 * Listen for settings changes
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.apiUrl) API_URL = changes.apiUrl.newValue;
    if (changes.authToken) AUTH_TOKEN = changes.authToken.newValue;
  }
});
