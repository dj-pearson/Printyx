/**
 * LinkedIn Profile Injector
 *
 * Injects "Add to Printyx CRM" button on LinkedIn profile pages
 */

(function() {
  'use strict';

  let parser = null;
  let apiClient = null;
  let injectedButton = null;

  /**
   * Initialize parser and API client
   */
  function init() {
    parser = new window.LinkedInParser();
    apiClient = new window.PrintyxApiClient();

    console.log('[Printyx Extension] Initialized on LinkedIn');
  }

  /**
   * Create and inject the "Add to Printyx" button
   */
  function injectButton() {
    // Don't inject if button already exists
    if (injectedButton && document.body.contains(injectedButton)) {
      return;
    }

    // Check if we're on a profile page
    if (!parser.isProfilePage()) {
      return;
    }

    // Find the actions section to inject button
    const actionsSection = findActionsSection();
    if (!actionsSection) {
      console.log('[Printyx Extension] Actions section not found, will retry');
      return;
    }

    // Create button
    const button = createButton();
    injectedButton = button;

    // Insert button
    actionsSection.appendChild(button);

    console.log('[Printyx Extension] Button injected');
  }

  /**
   * Find the actions section on LinkedIn profile
   * LinkedIn frequently changes their DOM structure, so we have multiple fallbacks
   */
  function findActionsSection() {
    // Try to find the action buttons container
    const selectors = [
      '.pvs-profile-actions',
      '.pv-top-card-v2-ctas',
      '.pv-top-card--list-bullet',
      '.pv-text-details__left-panel'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    // Fallback: create our own container if needed
    const mainContent = document.querySelector('.scaffold-layout__main');
    if (mainContent) {
      const container = document.createElement('div');
      container.className = 'printyx-actions-container';
      mainContent.insertBefore(container, mainContent.firstChild);
      return container;
    }

    return null;
  }

  /**
   * Create the Printyx button element
   */
  function createButton() {
    const button = document.createElement('button');
    button.className = 'printyx-import-btn';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <line x1="19" y1="8" x2="19" y2="14"></line>
        <line x1="22" y1="11" x2="16" y2="11"></line>
      </svg>
      <span>Add to Printyx CRM</span>
    `;

    button.onclick = handleImportClick;

    return button;
  }

  /**
   * Handle click on import button
   */
  async function handleImportClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const button = injectedButton;
    const originalContent = button.innerHTML;

    try {
      // Update button to loading state
      setButtonState('loading', 'Importing...');

      // Parse profile data
      const profileData = await parser.parseProfile();

      // Check for duplicate first
      const duplicateCheck = await apiClient.checkDuplicate({
        linkedinUrl: profileData.linkedinUrl,
        name: profileData.name,
        company: profileData.company
      });

      if (duplicateCheck.exists) {
        setButtonState('exists', 'Already in CRM');

        // Show notification
        showNotification('Contact Already Exists',
          `${duplicateCheck.record.name} is already in your CRM`,
          'info');

        setTimeout(() => {
          setButtonState('exists', 'In CRM ✓');
        }, 2000);

        return;
      }

      // Import to CRM
      const result = await apiClient.quickImport(profileData);

      if (result.success) {
        setButtonState('success', 'Added to CRM ✓');

        // Show success notification with enrichment info
        const message = result.enrichmentSource === 'apollo'
          ? `Enriched with ${result.enrichedFields.email ? 'email' : 'profile'} data`
          : 'Added successfully';

        showNotification('Contact Added!', message, 'success');

        // Store import history
        await storeImportHistory(profileData, result);
      } else {
        throw new Error('Import failed');
      }

    } catch (error) {
      console.error('[Printyx Extension] Import error:', error);

      setButtonState('error', 'Import Failed');
      showNotification('Import Failed', error.message, 'error');

      // Reset button after delay
      setTimeout(() => {
        button.innerHTML = originalContent;
        button.className = 'printyx-import-btn';
      }, 3000);
    }
  }

  /**
   * Set button state (loading, success, error, exists)
   */
  function setButtonState(state, text) {
    const button = injectedButton;
    if (!button) return;

    button.className = `printyx-import-btn printyx-import-btn--${state}`;

    const icons = {
      loading: '<svg class="printyx-spinner" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>',
      success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      exists: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>'
    };

    button.innerHTML = `${icons[state] || ''}<span>${text}</span>`;
  }

  /**
   * Show toast notification
   */
  function showNotification(title, message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.printyx-notification');
    if (existing) {
      existing.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `printyx-notification printyx-notification--${type}`;
    notification.innerHTML = `
      <div class="printyx-notification__content">
        <strong>${title}</strong>
        <p>${message}</p>
      </div>
      <button class="printyx-notification__close">×</button>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Close button
    notification.querySelector('.printyx-notification__close').onclick = () => {
      notification.remove();
    };

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.remove();
      }
    }, 5000);
  }

  /**
   * Store import in local history
   */
  async function storeImportHistory(profileData, result) {
    const history = await chrome.storage.local.get(['importHistory']) || { importHistory: [] };
    const imports = history.importHistory || [];

    imports.unshift({
      ...profileData,
      importedAt: new Date().toISOString(),
      recordId: result.businessRecord?.id,
      enrichmentSource: result.enrichmentSource
    });

    // Keep only last 50 imports
    if (imports.length > 50) {
      imports.splice(50);
    }

    await chrome.storage.local.set({ importHistory: imports });
  }

  /**
   * Check if current profile is already imported
   */
  async function checkIfAlreadyImported() {
    if (!parser.isProfilePage()) return;

    try {
      const linkedinUrl = parser.cleanLinkedInUrl(window.location.href);
      const duplicateCheck = await apiClient.checkDuplicate({ linkedinUrl });

      if (duplicateCheck.exists && injectedButton) {
        setButtonState('exists', 'In CRM ✓');
      }
    } catch (error) {
      // Silently fail - not critical
      console.log('[Printyx Extension] Could not check import status');
    }
  }

  /**
   * Watch for navigation changes (LinkedIn is SPA)
   */
  function watchForNavigationChanges() {
    let lastUrl = window.location.href;

    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href;

      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('[Printyx Extension] Navigation detected');

        // Remove old button
        if (injectedButton) {
          injectedButton.remove();
          injectedButton = null;
        }

        // Wait for new page to load, then inject
        setTimeout(() => {
          injectButton();
          checkIfAlreadyImported();
        }, 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Main initialization
   */
  function main() {
    // Initialize
    init();

    // Inject button after page loads
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(injectButton, 1000);
      });
    } else {
      setTimeout(injectButton, 1000);
    }

    // Watch for navigation
    watchForNavigationChanges();

    // Check import status
    setTimeout(checkIfAlreadyImported, 2000);
  }

  // Start
  main();
})();
