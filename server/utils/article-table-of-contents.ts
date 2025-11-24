/**
 * Article Table of Contents Generator
 *
 * Automatically generates a table of contents from article content structure
 */

interface ContentSection {
  type: string;
  content: string | string[] | Record<string, any>;
  order: number;
  formatting?: Record<string, any>;
}

interface ArticleContent {
  sections: ContentSection[];
  metadata?: Record<string, any>;
}

interface TOCItem {
  id: string;
  title: string;
  level: number; // 1 = h1, 2 = h2, etc.
  order: number;
  children?: TOCItem[];
}

interface TableOfContents {
  items: TOCItem[];
  totalSections: number;
  estimatedReadingTime: number;
}

/**
 * Generate table of contents from article content
 */
export function generateTableOfContents(content: ArticleContent): TableOfContents {
  const headers = content.sections
    .filter(section => section.type === 'header')
    .map((section, index) => ({
      id: generateAnchorId(String(section.content)),
      title: String(section.content),
      level: inferHeaderLevel(String(section.content), index),
      order: section.order || index,
    }))
    .sort((a, b) => a.order - b.order);

  // Build hierarchical structure
  const items = buildHierarchy(headers);

  // Calculate reading time from all content
  const totalWords = calculateWordCount(content);
  const estimatedReadingTime = Math.ceil(totalWords / 200); // 200 words per minute

  return {
    items,
    totalSections: headers.length,
    estimatedReadingTime,
  };
}

/**
 * Generate a URL-safe anchor ID from header text
 */
export function generateAnchorId(headerText: string): string {
  return headerText
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 50); // Limit length
}

/**
 * Infer header level from content
 * Level 1: First header or headers with "Overview", "Introduction"
 * Level 2: Most headers (default)
 * Level 3: Headers like "Step 1", "Option A", or after colon
 */
function inferHeaderLevel(headerText: string, index: number): number {
  const text = headerText.toLowerCase();

  // Level 1 indicators
  if (index === 0) return 1;
  if (text.includes('overview') || text.includes('introduction') || text.includes('what you\'ll learn')) {
    return 1;
  }

  // Level 3 indicators
  if (text.match(/^step \d+/)) return 3;
  if (text.match(/^option [a-z]/)) return 3;
  if (text.match(/^solution \d+/)) return 3;
  if (text.includes(':') && text.length < 40) return 3;

  // Default to level 2
  return 2;
}

/**
 * Build hierarchical structure from flat list of headers
 */
function buildHierarchy(headers: Array<{ id: string; title: string; level: number; order: number }>): TOCItem[] {
  const root: TOCItem[] = [];
  const stack: TOCItem[] = [];

  for (const header of headers) {
    const item: TOCItem = {
      id: header.id,
      title: header.title,
      level: header.level,
      order: header.order,
    };

    // Find parent based on level
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top-level item
      root.push(item);
    } else {
      // Child item
      const parent = stack[stack.length - 1];
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(item);
    }

    stack.push(item);
  }

  return root;
}

/**
 * Calculate total word count from article content
 */
function calculateWordCount(content: ArticleContent): number {
  let totalWords = 0;

  for (const section of content.sections) {
    if (section.type === 'paragraph' || section.type === 'header') {
      const text = String(section.content);
      totalWords += text.split(/\s+/).filter(word => word.length > 0).length;
    } else if (section.type === 'list' && Array.isArray(section.content)) {
      for (const item of section.content) {
        totalWords += String(item).split(/\s+/).filter(word => word.length > 0).length;
      }
    } else if (section.type === 'callout') {
      const text = String(section.content);
      totalWords += text.split(/\s+/).filter(word => word.length > 0).length;
    }
  }

  return totalWords;
}

/**
 * Render table of contents as HTML
 */
export function renderTableOfContentsHTML(toc: TableOfContents): string {
  function renderItems(items: TOCItem[], level: number = 0): string {
    const indent = '  '.repeat(level);
    let html = `${indent}<ul class="toc-list toc-level-${level}">\n`;

    for (const item of items) {
      html += `${indent}  <li class="toc-item toc-level-${item.level}">\n`;
      html += `${indent}    <a href="#${item.id}" class="toc-link">${escapeHTML(item.title)}</a>\n`;

      if (item.children && item.children.length > 0) {
        html += renderItems(item.children, level + 1);
      }

      html += `${indent}  </li>\n`;
    }

    html += `${indent}</ul>\n`;
    return html;
  }

  let html = '<nav class="table-of-contents" aria-label="Table of Contents">\n';
  html += '  <h2 class="toc-title">Table of Contents</h2>\n';
  html += '  <div class="toc-meta">\n';
  html += `    <span class="toc-sections">${toc.totalSections} sections</span>\n`;
  html += `    <span class="toc-reading-time">${toc.estimatedReadingTime} min read</span>\n`;
  html += '  </div>\n';
  html += renderItems(toc.items);
  html += '</nav>\n';

  return html;
}

/**
 * Render table of contents as Markdown
 */
export function renderTableOfContentsMarkdown(toc: TableOfContents): string {
  function renderItems(items: TOCItem[], level: number = 0): string {
    let md = '';

    for (const item of items) {
      const indent = '  '.repeat(level);
      md += `${indent}- [${item.title}](#${item.id})\n`;

      if (item.children && item.children.length > 0) {
        md += renderItems(item.children, level + 1);
      }
    }

    return md;
  }

  let md = '## Table of Contents\n\n';
  md += `*${toc.totalSections} sections • ${toc.estimatedReadingTime} min read*\n\n`;
  md += renderItems(toc.items);

  return md;
}

/**
 * Add IDs to headers in HTML content
 */
export function addHeaderIdsToHTML(htmlContent: string, toc: TableOfContents): string {
  let updatedHTML = htmlContent;

  for (const item of flattenTOC(toc.items)) {
    // Find h1-h6 tags with this content and add ID
    const headerRegex = new RegExp(
      `<h([1-6])([^>]*)>${escapeRegex(item.title)}</h\\1>`,
      'gi'
    );

    updatedHTML = updatedHTML.replace(
      headerRegex,
      `<h$1$2 id="${item.id}">${item.title}</h$1>`
    );
  }

  return updatedHTML;
}

/**
 * Flatten hierarchical TOC to flat list
 */
function flattenTOC(items: TOCItem[]): TOCItem[] {
  const flat: TOCItem[] = [];

  function traverse(items: TOCItem[]) {
    for (const item of items) {
      flat.push(item);
      if (item.children) {
        traverse(item.children);
      }
    }
  }

  traverse(items);
  return flat;
}

/**
 * Escape HTML special characters
 */
function escapeHTML(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Escape special regex characters
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get progress percentage through article based on visible headers
 */
export function calculateReadingProgress(toc: TableOfContents, currentHeaderId: string): number {
  const flat = flattenTOC(toc.items);
  const currentIndex = flat.findIndex(item => item.id === currentHeaderId);

  if (currentIndex === -1) return 0;

  return Math.round(((currentIndex + 1) / flat.length) * 100);
}

/**
 * Get next/previous sections for navigation
 */
export function getSectionNavigation(toc: TableOfContents, currentHeaderId: string): {
  previous: TOCItem | null;
  next: TOCItem | null;
  current: TOCItem | null;
} {
  const flat = flattenTOC(toc.items);
  const currentIndex = flat.findIndex(item => item.id === currentHeaderId);

  if (currentIndex === -1) {
    return { previous: null, next: null, current: null };
  }

  return {
    previous: currentIndex > 0 ? flat[currentIndex - 1] : null,
    next: currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null,
    current: flat[currentIndex],
  };
}
