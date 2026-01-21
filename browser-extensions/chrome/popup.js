/**
 * Popup script for Printyx Knowledge Capture
 */

// Tab switching
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;

    // Update active tab
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    // Update active content
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
  });
});

// Load settings on popup open
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get([
    'apiUrl',
    'authToken',
    'tenantId',
    'userId',
    'defaultCategoryId',
  ]);

  // Populate settings form
  if (settings.apiUrl) document.getElementById('apiUrl').value = settings.apiUrl;
  if (settings.authToken) document.getElementById('authToken').value = settings.authToken;
  if (settings.tenantId) document.getElementById('tenantId').value = settings.tenantId;
  if (settings.userId) document.getElementById('userId').value = settings.userId;
  if (settings.defaultCategoryId)
    document.getElementById('defaultCategoryId').value = settings.defaultCategoryId;

  // Load categories
  await loadCategories(settings);

  // Check if configured
  if (!settings.authToken || !settings.tenantId || !settings.userId) {
    showStatus('Please configure the extension in the Settings tab', 'error');
  }
});

// Capture current page
document.getElementById('capturePageBtn').addEventListener('click', async () => {
  try {
    showStatus('Capturing page...', 'info');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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

    showStatus('✅ Page captured successfully!', 'success');
  } catch (error) {
    showStatus(`❌ Error: ${error.message}`, 'error');
  }
});

// Show custom capture form
document.getElementById('customCaptureBtn').addEventListener('click', () => {
  document.getElementById('captureForm').classList.add('active');
});

// Cancel custom capture
document.getElementById('cancelBtn').addEventListener('click', () => {
  document.getElementById('captureForm').classList.remove('active');
  clearForm();
});

// Save custom capture
document.getElementById('saveBtn').addEventListener('click', async () => {
  try {
    const title = document.getElementById('title').value;
    const content = document.getElementById('content').value;
    const categoryId = document.getElementById('category').value;
    const tags = document
      .getElementById('tags')
      .value.split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (!title || !content) {
      showStatus('❌ Title and content are required', 'error');
      return;
    }

    showStatus('Saving...', 'info');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await saveToKnowledgeBase({
      title,
      content: {
        sections: [
          {
            type: 'paragraph',
            content,
            order: 1,
          },
        ],
      },
      categoryId,
      tags: [...tags, 'manual-capture'],
      sourceUrl: tab.url,
      captureType: 'manual',
    });

    showStatus('✅ Saved successfully!', 'success');
    document.getElementById('captureForm').classList.remove('active');
    clearForm();
  } catch (error) {
    showStatus(`❌ Error: ${error.message}`, 'error');
  }
});

// Save settings
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const settings = {
    apiUrl: document.getElementById('apiUrl').value,
    authToken: document.getElementById('authToken').value,
    tenantId: document.getElementById('tenantId').value,
    userId: document.getElementById('userId').value,
    defaultCategoryId: document.getElementById('defaultCategoryId').value,
  };

  await chrome.storage.sync.set(settings);
  showStatus('✅ Settings saved!', 'success');
});

/**
 * Save content to knowledge base
 */
async function saveToKnowledgeBase(data) {
  const response = await chrome.runtime.sendMessage({
    action: 'capture',
    data,
  });

  if (!response.success) {
    throw new Error(response.error);
  }

  return response.data;
}

/**
 * Load categories from API
 */
async function loadCategories(settings) {
  if (!settings.authToken || !settings.tenantId) {
    return;
  }

  try {
    const apiUrl = settings.apiUrl || 'https://printyx.net/api';

    const response = await fetch(`${apiUrl}/knowledge-base/categories`, {
      headers: {
        Authorization: `Bearer ${settings.authToken}`,
        'X-Tenant-ID': settings.tenantId,
      },
    });

    if (response.ok) {
      const categories = await response.json();
      const select = document.getElementById('category');

      categories.forEach((category) => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        select.appendChild(option);
      });

      // Set default if exists
      if (settings.defaultCategoryId) {
        select.value = settings.defaultCategoryId;
      }
    }
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = type === 'error' ? 'status error' : 'status';
  statusDiv.style.display = 'block';

  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 5000);
}

/**
 * Clear form
 */
function clearForm() {
  document.getElementById('title').value = '';
  document.getElementById('content').value = '';
  document.getElementById('tags').value = '';
}
