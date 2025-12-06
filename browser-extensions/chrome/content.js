/**
 * Content script for Printyx Knowledge Capture
 * Runs on all web pages to enable content extraction
 */

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getPageContext') {
    sendResponse({
      title: document.title,
      url: window.location.href,
    });
  } else if (message.action === 'extractPageContent') {
    const content = extractArticleContent();
    sendResponse(content);
  }
  return true;
});

/**
 * Extract article content from the page using reader mode algorithms
 */
function extractArticleContent() {
  const title = extractTitle();
  const author = extractAuthor();
  const publishedDate = extractPublishedDate();
  const description = extractDescription();
  const mainContent = extractMainContent();

  return {
    title,
    author,
    publishedDate,
    description,
    content: {
      sections: mainContent,
    },
  };
}

/**
 * Extract page title
 */
function extractTitle() {
  // Try various methods to get the best title
  const titleSelectors = [
    'h1',
    '[class*="title"]',
    '[id*="title"]',
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
  ];

  for (const selector of titleSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.getAttribute('content') || element.textContent?.trim();
    }
  }

  return document.title;
}

/**
 * Extract author
 */
function extractAuthor() {
  const authorSelectors = [
    'meta[name="author"]',
    'meta[property="article:author"]',
    '[rel="author"]',
    '[class*="author"]',
    '[itemprop="author"]',
  ];

  for (const selector of authorSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.getAttribute('content') || element.textContent?.trim();
    }
  }

  return null;
}

/**
 * Extract published date
 */
function extractPublishedDate() {
  const dateSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="publish_date"]',
    'time[datetime]',
    '[class*="date"]',
  ];

  for (const selector of dateSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.getAttribute('content') ||
             element.getAttribute('datetime') ||
             element.textContent?.trim();
    }
  }

  return null;
}

/**
 * Extract description
 */
function extractDescription() {
  const descriptionSelectors = [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
  ];

  for (const selector of descriptionSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const content = element.getAttribute('content');
      if (content) return content;
    }
  }

  return null;
}

/**
 * Extract main content from the page
 */
function extractMainContent() {
  // Try to find the main content area
  const contentSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.article-content',
    '.post-content',
    '.entry-content',
    '#content',
  ];

  let contentElement = null;

  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      contentElement = element;
      break;
    }
  }

  // Fallback to body if no main content found
  if (!contentElement) {
    contentElement = document.body;
  }

  // Extract structured content
  const sections = [];
  let order = 1;

  // Process child elements
  const elements = contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, pre, blockquote, img');

  elements.forEach((element) => {
    const tagName = element.tagName.toLowerCase();

    // Skip if element is empty or too short
    const text = element.textContent?.trim() || '';
    if (text.length < 10 && tagName !== 'img') return;

    if (tagName.startsWith('h')) {
      // Header
      sections.push({
        type: 'header',
        content: text,
        order: order++,
        level: parseInt(tagName[1]),
      });
    } else if (tagName === 'p' || tagName === 'blockquote') {
      // Paragraph
      sections.push({
        type: 'paragraph',
        content: text,
        order: order++,
      });
    } else if (tagName === 'ul' || tagName === 'ol') {
      // List
      const items = Array.from(element.querySelectorAll('li')).map(
        (li) => li.textContent?.trim() || ''
      );
      sections.push({
        type: 'list',
        content: items,
        order: order++,
        listType: tagName === 'ul' ? 'bullet' : 'numbered',
      });
    } else if (tagName === 'pre') {
      // Code block
      sections.push({
        type: 'code',
        content: element.textContent || '',
        order: order++,
      });
    } else if (tagName === 'img') {
      // Image
      const src = element.getAttribute('src');
      const alt = element.getAttribute('alt') || '';
      if (src) {
        sections.push({
          type: 'image',
          content: {
            url: src,
            alt,
            caption: alt,
          },
          order: order++,
        });
      }
    }
  });

  return sections;
}

/**
 * Highlight captured content
 */
function highlightContent(element) {
  const originalBackground = element.style.backgroundColor;
  element.style.backgroundColor = '#fff3cd';
  element.style.transition = 'background-color 0.3s';

  setTimeout(() => {
    element.style.backgroundColor = originalBackground;
  }, 2000);
}

/**
 * Show capture overlay
 */
function showCaptureOverlay(message) {
  const overlay = document.createElement('div');
  overlay.id = 'printyx-capture-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  overlay.textContent = message;

  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => overlay.remove(), 300);
  }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
