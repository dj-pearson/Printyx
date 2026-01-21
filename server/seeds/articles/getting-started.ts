/**
 * Getting Started Articles
 *
 * Initial onboarding and platform introduction articles
 */

export const gettingStartedArticles = [
  {
    title: 'Welcome to Printyx: Your Complete Guide to Getting Started',
    slug: 'welcome-to-printyx',
    categorySlug: 'getting-started',
    excerpt:
      'Learn the basics of Printyx and get your copier dealership up and running in minutes. This comprehensive guide covers everything from initial setup to your first customer interaction.',
    contentType: 'tutorial',
    difficultyLevel: 'beginner',
    estimatedReadingTime: 10,
    featured: true,
    keywords: ['getting started', 'onboarding', 'setup', 'introduction', 'basics'],
    tags: ['welcome', 'setup', 'beginner'],
    content: {
      sections: [
        {
          type: 'header',
          content: 'Welcome to Printyx',
          order: 1,
        },
        {
          type: 'paragraph',
          content:
            "Printyx is the complete business management platform designed specifically for copier dealers. Whether you're managing leads, dispatching technicians, tracking inventory, or billing customers, Printyx streamlines every aspect of your dealership operations.",
          order: 2,
        },
        {
          type: 'callout',
          content:
            '💡 **Quick Start Tip**: Follow this guide step-by-step to get your dealership up and running in less than 30 minutes!',
          formatting: { style: 'info' },
          order: 3,
        },
        {
          type: 'header',
          content: "What You'll Learn",
          order: 4,
        },
        {
          type: 'list',
          content: [
            'Navigating the Printyx dashboard',
            'Understanding the main modules (CRM, Service, Inventory, Billing)',
            'Setting up your first customer',
            'Creating your first service call',
            'Accessing reports and analytics',
          ],
          order: 5,
        },
        {
          type: 'header',
          content: 'Dashboard Overview',
          order: 6,
        },
        {
          type: 'paragraph',
          content:
            'The Printyx dashboard is your command center. It provides real-time insights into your business performance with customizable widgets for sales, service, and operational metrics.',
          order: 7,
        },
        {
          type: 'image',
          content: '/assets/kb/dashboard-overview.png',
          formatting: { alt: 'Printyx Dashboard Overview', width: '100%' },
          order: 8,
        },
        {
          type: 'header',
          content: 'Core Modules',
          order: 9,
        },
        {
          type: 'table',
          content: {
            headers: ['Module', 'Purpose', 'Key Features'],
            rows: [
              [
                'CRM & Sales',
                'Manage leads and customers',
                'Lead tracking, quotes, proposals, pipeline',
              ],
              [
                'Service Management',
                'Dispatch and service calls',
                'Mobile dispatch, technician tracking, parts',
              ],
              ['Inventory', 'Stock and warehouse', 'Product catalog, FPY, purchase orders'],
              [
                'Billing',
                'Invoicing and payments',
                'Meter billing, contracts, automated invoicing',
              ],
              ['Reporting', 'Analytics and insights', 'Custom reports, forecasting, dashboards'],
            ],
          },
          order: 10,
        },
        {
          type: 'header',
          content: 'Quick Start Checklist',
          order: 11,
        },
        {
          type: 'list',
          content: [
            '✅ Complete your company profile in Settings',
            '✅ Add your first users and assign roles',
            '✅ Import existing customer data (or add manually)',
            '✅ Configure your service dispatch zones',
            '✅ Set up your product catalog',
            '✅ Create your first quote',
            '✅ Schedule a service call',
          ],
          order: 12,
        },
        {
          type: 'callout',
          content:
            "🚀 **Next Steps**: Once you've completed this checklist, explore our category-specific guides for deep dives into each module.",
          formatting: { style: 'success' },
          order: 13,
        },
        {
          type: 'header',
          content: 'Getting Help',
          order: 14,
        },
        {
          type: 'paragraph',
          content:
            'Need assistance? Our knowledge base is searchable, and each article includes step-by-step instructions. You can also access contextual help throughout the platform by clicking the question mark icons.',
          order: 15,
        },
      ],
    },
    htmlContent: `
      <h2>Welcome to Printyx</h2>
      <p>Printyx is the complete business management platform designed specifically for copier dealers...</p>
    `,
    metaTitle: 'Welcome to Printyx - Getting Started Guide',
    metaDescription:
      'Complete getting started guide for Printyx. Learn how to set up your copier dealership management platform in minutes.',
    relatedArticleSlugs: ['understanding-the-dashboard', 'creating-your-first-customer'],
    status: 'published',
  },
  {
    title: 'Understanding the Printyx Dashboard',
    slug: 'understanding-the-dashboard',
    categorySlug: 'getting-started',
    excerpt:
      'Master the Printyx dashboard with this comprehensive guide. Learn how to customize widgets, interpret metrics, and make data-driven decisions.',
    contentType: 'tutorial',
    difficultyLevel: 'beginner',
    estimatedReadingTime: 8,
    featured: true,
    keywords: ['dashboard', 'widgets', 'metrics', 'navigation', 'interface'],
    tags: ['dashboard', 'ui', 'navigation'],
    content: {
      sections: [
        {
          type: 'header',
          content: 'Dashboard Basics',
          order: 1,
        },
        {
          type: 'paragraph',
          content:
            "The Printyx dashboard is designed to give you a real-time snapshot of your business performance. It's fully customizable, allowing you to focus on the metrics that matter most to your dealership.",
          order: 2,
        },
        {
          type: 'header',
          content: 'Key Dashboard Sections',
          order: 3,
        },
        {
          type: 'list',
          content: [
            '**Sales Overview**: Track revenue, quotes in progress, and conversion rates',
            '**Service Metrics**: Monitor open service calls, technician utilization, and response times',
            '**Inventory Alerts**: View low stock items, pending orders, and warehouse status',
            '**Quick Actions**: Access frequently used features with one click',
            '**Recent Activity**: Stay updated on latest customer interactions and system events',
          ],
          order: 4,
        },
        {
          type: 'header',
          content: 'Customizing Your Dashboard',
          order: 5,
        },
        {
          type: 'paragraph',
          content:
            "To customize your dashboard, click the 'Customize' button in the top right corner. You can:",
          order: 6,
        },
        {
          type: 'list',
          content: [
            'Add or remove widgets',
            'Rearrange widget positions with drag-and-drop',
            'Resize widgets to fit your needs',
            'Set default time ranges for metrics',
            'Save multiple dashboard layouts',
          ],
          order: 7,
        },
        {
          type: 'code',
          content: `// Example: Dashboard widgets are stored in user preferences
{
  "widgets": [
    { "id": "sales-overview", "position": { "x": 0, "y": 0 }, "size": "large" },
    { "id": "service-metrics", "position": { "x": 1, "y": 0 }, "size": "medium" },
    { "id": "inventory-alerts", "position": { "x": 0, "y": 1 }, "size": "small" }
  ],
  "timeRange": "last-30-days",
  "refreshInterval": 300000
}`,
          formatting: { language: 'json' },
          order: 8,
        },
        {
          type: 'callout',
          content:
            '💡 **Pro Tip**: Create role-specific dashboards! Sales managers can focus on pipeline metrics, while service managers prioritize dispatch and technician data.',
          formatting: { style: 'info' },
          order: 9,
        },
        {
          type: 'header',
          content: 'Navigation Menu',
          order: 10,
        },
        {
          type: 'paragraph',
          content:
            'The left sidebar provides access to all major modules. Use the search bar at the top to quickly find any feature or customer record.',
          order: 11,
        },
      ],
    },
    htmlContent: `<h2>Dashboard Basics</h2><p>The Printyx dashboard is designed to give you a real-time snapshot...</p>`,
    metaTitle: 'Understanding the Printyx Dashboard',
    metaDescription:
      'Learn how to navigate and customize the Printyx dashboard for maximum productivity.',
    relatedArticleSlugs: ['welcome-to-printyx', 'customizing-your-workspace'],
    status: 'published',
  },
  {
    title: 'User Roles and Permissions Guide',
    slug: 'user-roles-and-permissions',
    categorySlug: 'getting-started',
    excerpt:
      "Understand Printyx's 8-level role hierarchy and permission system. Learn how to assign appropriate access levels to your team members.",
    contentType: 'reference',
    difficultyLevel: 'intermediate',
    estimatedReadingTime: 12,
    featured: false,
    keywords: ['roles', 'permissions', 'RBAC', 'security', 'access control', 'users'],
    tags: ['security', 'users', 'admin'],
    content: {
      sections: [
        {
          type: 'header',
          content: 'Role-Based Access Control (RBAC)',
          order: 1,
        },
        {
          type: 'paragraph',
          content:
            'Printyx implements a sophisticated 8-level role hierarchy designed to match your organizational structure. Each role has specific permissions that control what users can see and do within the platform.',
          order: 2,
        },
        {
          type: 'header',
          content: 'The 8 Role Levels',
          order: 3,
        },
        {
          type: 'table',
          content: {
            headers: ['Role', 'Level', 'Typical Use Case', 'Key Permissions'],
            rows: [
              [
                'Platform Admin',
                '1 (Highest)',
                'Platform operators',
                'Full system access, tenant management',
              ],
              ['Super Admin', '2', 'Business owners', 'All business functions, user management'],
              ['Admin', '3', 'General managers', 'Most administrative functions'],
              ['Manager', '4', 'Department heads', 'Team oversight, reporting'],
              ['Standard User', '5', 'Sales reps, technicians', 'Day-to-day operations'],
              ['Support', '6', 'Support staff', 'View and assist customers'],
              ['Read-Only', '7', 'Stakeholders, auditors', 'View-only access'],
              ['Guest', '8 (Lowest)', 'Temporary access', 'Limited viewing rights'],
            ],
          },
          order: 4,
        },
        {
          type: 'callout',
          content:
            '⚠️ **Security Best Practice**: Always assign the minimum permissions needed for each role. You can always grant additional access later.',
          formatting: { style: 'warning' },
          order: 5,
        },
        {
          type: 'header',
          content: 'Permission Inheritance',
          order: 6,
        },
        {
          type: 'paragraph',
          content:
            'Higher-level roles automatically inherit all permissions from lower-level roles. For example, a Manager has all Standard User permissions plus additional management capabilities.',
          order: 7,
        },
        {
          type: 'header',
          content: 'Common Permission Scenarios',
          order: 8,
        },
        {
          type: 'list',
          content: [
            '**Sales Team**: Standard User role with CRM, quotes, and customer access',
            '**Technicians**: Standard User role with service dispatch and mobile field service',
            '**Billing Department**: Standard User with billing, invoicing, and payment processing',
            '**Warehouse Staff**: Standard User with inventory, receiving, and warehouse operations',
            '**Customer Service**: Support role with read access to customer records and tickets',
          ],
          order: 9,
        },
        {
          type: 'header',
          content: 'Managing User Permissions',
          order: 10,
        },
        {
          type: 'paragraph',
          content:
            'To modify user permissions, navigate to Settings → Users. Select a user and adjust their role or customize individual permissions using the granular permission controls.',
          order: 11,
        },
      ],
    },
    htmlContent: `<h2>Role-Based Access Control (RBAC)</h2><p>Printyx implements a sophisticated 8-level role hierarchy...</p>`,
    metaTitle: 'User Roles and Permissions in Printyx',
    metaDescription:
      'Complete guide to understanding and managing user roles and permissions in Printyx.',
    relatedArticleSlugs: ['adding-new-users', 'security-best-practices'],
    status: 'published',
  },
];
