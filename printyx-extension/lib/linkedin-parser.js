/**
 * LinkedIn Profile Parser
 *
 * Extracts public profile data from LinkedIn pages.
 * Only parses visible DOM elements - no API calls, no heavy scraping.
 *
 * IMPORTANT: This only works on user-initiated actions and respects LinkedIn's ToS
 * by only reading publicly visible information.
 */

class LinkedInParser {
  constructor() {
    this.selectors = {
      // Name selectors (multiple fallbacks)
      name: [
        'h1.text-heading-xlarge',
        'h1.inline.t-24.v-align-middle.break-words',
        '.pv-text-details__left-panel h1',
        '.ph5.pb5 h1'
      ],

      // Job title
      title: [
        '.text-body-medium.break-words',
        '.pv-text-details__left-panel .text-body-medium',
        'div.text-body-medium.break-words'
      ],

      // Company name
      company: [
        '.pv-text-details__right-panel .text-body-small.inline',
        'div.inline-show-more-text--is-collapsed button span[aria-hidden="true"]',
        '.pv-top-card--list.pv-top-card--list-bullet li'
      ],

      // Location
      location: [
        '.text-body-small.inline.t-black--light.break-words',
        'span.text-body-small.inline.t-black--light.break-words',
        '.pv-top-card--list-bullet li:first-child'
      ],

      // Profile URL (from current page)
      profileUrl: window.location.href
    };
  }

  /**
   * Try multiple selectors until one returns a value
   */
  findElement(selectors) {
    if (Array.isArray(selectors)) {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
      }
    } else {
      return document.querySelector(selectors);
    }
    return null;
  }

  /**
   * Get text content from element, cleaned up
   */
  getTextContent(element) {
    if (!element) return null;
    return element.textContent.trim().replace(/\s+/g, ' ');
  }

  /**
   * Parse full name into first and last name
   */
  parseFullName(fullName) {
    if (!fullName) return { firstName: '', lastName: '' };

    const nameParts = fullName.trim().split(/\s+/);

    if (nameParts.length === 1) {
      return { firstName: nameParts[0], lastName: '' };
    }

    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    return { firstName, lastName };
  }

  /**
   * Extract company name from title/company string
   * LinkedIn often shows "Title at Company"
   */
  extractCompany(titleCompanyString) {
    if (!titleCompanyString) return null;

    // Try to extract company after "at"
    const atMatch = titleCompanyString.match(/\sat\s+(.+)$/i);
    if (atMatch) {
      return atMatch[1].trim();
    }

    return titleCompanyString;
  }

  /**
   * Clean LinkedIn URL to canonical form
   */
  cleanLinkedInUrl(url) {
    if (!url) return null;

    try {
      const urlObj = new URL(url);

      // Extract profile ID from path
      const pathMatch = urlObj.pathname.match(/\/in\/([^\/]+)/);
      if (pathMatch) {
        return `https://www.linkedin.com/in/${pathMatch[1]}`;
      }

      return url;
    } catch (error) {
      console.error('Error cleaning LinkedIn URL:', error);
      return url;
    }
  }

  /**
   * Wait for profile to load (LinkedIn is SPA)
   */
  async waitForProfile(maxWaitMs = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const nameElement = this.findElement(this.selectors.name);
      if (nameElement && nameElement.textContent.trim()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
  }

  /**
   * Main parsing function - extracts all available profile data
   */
  async parseProfile() {
    // Wait for profile to load
    const loaded = await this.waitForProfile();
    if (!loaded) {
      throw new Error('Profile did not load in time');
    }

    // Extract name
    const nameElement = this.findElement(this.selectors.name);
    const fullName = this.getTextContent(nameElement);
    const { firstName, lastName } = this.parseFullName(fullName);

    // Extract job title
    const titleElement = this.findElement(this.selectors.title);
    const jobTitleRaw = this.getTextContent(titleElement);

    // Extract company (might be combined with title)
    let company = null;
    let jobTitle = jobTitleRaw;

    // Try to find separate company element
    const companyElement = this.findElement(this.selectors.company);
    const companyText = this.getTextContent(companyElement);

    if (companyText && !companyText.toLowerCase().includes('connection')) {
      company = companyText;
    }

    // If no separate company, try to extract from title
    if (!company && jobTitleRaw) {
      company = this.extractCompany(jobTitleRaw);
      // If we extracted company, clean up job title
      if (company !== jobTitleRaw) {
        jobTitle = jobTitleRaw.replace(/\sat\s+.+$/i, '').trim();
      }
    }

    // Extract location
    const locationElement = this.findElement(this.selectors.location);
    const location = this.getTextContent(locationElement);

    // Get LinkedIn URL
    const linkedinUrl = this.cleanLinkedInUrl(window.location.href);

    // Construct profile data
    const profileData = {
      source: 'linkedin',
      name: fullName || '',
      firstName: firstName || '',
      lastName: lastName || '',
      jobTitle: jobTitle || '',
      company: company || 'Unknown Company',
      location: location || '',
      linkedinUrl: linkedinUrl || ''
    };

    console.log('[Printyx Extension] Parsed profile:', profileData);

    return profileData;
  }

  /**
   * Check if current page is a LinkedIn profile page
   */
  isProfilePage() {
    const url = window.location.href;
    return url.includes('linkedin.com/in/');
  }

  /**
   * Check if profile is viewable (not restricted)
   */
  isViewable() {
    // Check for "out of network" or "sign in to view" messages
    const restrictedMessages = [
      'Sign in to view',
      'out of your network',
      'LinkedIn Member'
    ];

    const bodyText = document.body.textContent;
    for (const message of restrictedMessages) {
      if (bodyText.includes(message)) {
        return false;
      }
    }

    return true;
  }
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.LinkedInParser = LinkedInParser;
}
