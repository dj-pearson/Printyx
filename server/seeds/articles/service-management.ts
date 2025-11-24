/**
 * Service Management Articles
 *
 * Service dispatch, technician management, mobile field service articles
 */

export const serviceManagementArticles = [
  {
    title: "Service Dispatch 101: Optimizing Your Field Service Operations",
    slug: "service-dispatch-101",
    categorySlug: "service-management",
    excerpt: "Master service dispatch with intelligent routing, real-time technician tracking, and automated scheduling. Reduce response times and maximize technician productivity.",
    contentType: "tutorial",
    difficultyLevel: "beginner",
    estimatedReadingTime: 12,
    featured: true,
    keywords: ["service dispatch", "field service", "technician routing", "scheduling", "optimization"],
    tags: ["dispatch", "service", "scheduling"],
    content: {
      sections: [
        {
          type: "header",
          content: "The Service Dispatch Dashboard",
          order: 1
        },
        {
          type: "paragraph",
          content: "Printyx's dispatch dashboard gives you a real-time view of all active service calls, technician locations, and upcoming appointments. The drag-and-drop interface makes scheduling intuitive and efficient.",
          order: 2
        },
        {
          type: "callout",
          content: "🚀 **Quick Win**: Enable GPS tracking for technicians to see real-time locations and estimated arrival times. Customers love the transparency!",
          formatting: { style: "success" },
          order: 3
        },
        {
          type: "header",
          content: "Creating a Service Call",
          order: 4
        },
        {
          type: "paragraph",
          content: "Service calls can originate from multiple sources: customer portal, phone calls, equipment alerts, or preventive maintenance schedules. Here's how to create one manually:",
          order: 5
        },
        {
          type: "list",
          content: [
            "**Navigate to Service → New Service Call**",
            "**Select Customer**: Search and select from business records",
            "**Choose Equipment**: Select the copier/printer needing service",
            "**Describe Issue**: Use the problem code library or free text",
            "**Set Priority**: Emergency, High, Normal, Low",
            "**Assign Technician**: Manual or let AI suggest best match",
            "**Schedule Time**: Based on SLA and technician availability"
          ],
          order: 6
        },
        {
          type: "header",
          content: "Priority Levels and SLAs",
          order: 7
        },
        {
          type: "table",
          content: {
            headers: ["Priority", "Response Time", "Resolution Target", "Use Case"],
            rows: [
              ["🔴 Emergency", "2 hours", "Same day", "Production printer down, business stopped"],
              ["🟠 High", "4 hours", "Next day", "Multiple users affected"],
              ["🟡 Normal", "8 hours", "3 business days", "Single device, workaround available"],
              ["🟢 Low", "24 hours", "7 business days", "Cosmetic issues, non-critical"]
            ]
          },
          order: 8
        },
        {
          type: "header",
          content: "Intelligent Technician Assignment",
          order: 9
        },
        {
          type: "paragraph",
          content: "Printyx's AI considers multiple factors when suggesting technician assignments:",
          order: 10
        },
        {
          type: "list",
          content: [
            "**Skills Match**: Does the tech have certification for this equipment?",
            "**Geographic Proximity**: Who's closest to minimize drive time?",
            "**Current Workload**: Balance calls across your team",
            "**Customer History**: Assign familiar techs for better service",
            "**Parts Availability**: Which tech has needed parts in their van?",
            "**SLA Compliance**: Ensure response time commitments are met"
          ],
          order: 11
        },
        {
          type: "code",
          content: `// Example: AI technician assignment scoring
{
  "serviceCallId": "sc-12345",
  "equipmentModel": "Canon imageRUNNER ADVANCE DX C5870i",
  "location": { "lat": 34.0522, "lng": -118.2437 },
  "suggestedTechnicians": [
    {
      "technicianId": "tech-001",
      "name": "Mike Johnson",
      "score": 95,
      "factors": {
        "skillMatch": 100,
        "proximity": 95,
        "availability": 90,
        "workload": 85,
        "partsAvailability": 100
      },
      "estimatedArrival": "45 minutes",
      "currentLocation": { "lat": 34.0489, "lng": -118.2500 }
    }
  ]
}`,
          formatting: { language: "json" },
          order: 12
        },
        {
          type: "header",
          content: "Mobile Field Service App",
          order: 13
        },
        {
          type: "paragraph",
          content: "Technicians use the mobile app to receive assignments, navigate to sites, log service details, capture photos, order parts, and collect signatures. Everything syncs in real-time with the dispatch dashboard.",
          order: 14
        },
        {
          type: "callout",
          content: "📱 **Productivity Boost**: Techs can complete paperwork in the mobile app while on-site, eliminating end-of-day data entry and improving billing accuracy.",
          formatting: { style: "info" },
          order: 15
        },
        {
          type: "header",
          content: "Dispatch Metrics to Monitor",
          order: 16
        },
        {
          type: "list",
          content: [
            "**First-Time Fix Rate**: Percentage resolved on first visit",
            "**Average Response Time**: How quickly techs arrive on-site",
            "**Technician Utilization**: Billable hours vs. total hours",
            "**SLA Compliance**: Meeting contractual response times",
            "**Customer Satisfaction**: Post-service survey scores",
            "**Parts Usage**: Track inventory consumed per call"
          ],
          order: 17
        },
        {
          type: "header",
          content: "Best Practices",
          order: 18
        },
        {
          type: "list",
          content: [
            "✅ Schedule preventive maintenance during low-priority windows",
            "✅ Use problem code libraries for consistent issue tracking",
            "✅ Enable customer self-service portal to reduce phone calls",
            "✅ Review daily dispatch efficiency reports",
            "✅ Maintain optimal parts inventory in service vans",
            "✅ Collect customer feedback after every service call"
          ],
          order: 19
        }
      ]
    },
    htmlContent: `<h2>The Service Dispatch Dashboard</h2><p>Printyx's dispatch dashboard gives you a real-time view...</p>`,
    metaTitle: "Service Dispatch 101 - Printyx Field Service Management",
    metaDescription: "Complete guide to service dispatch in Printyx with intelligent routing, technician assignment, and mobile field service.",
    relatedArticleSlugs: ["mobile-field-service-guide", "preventive-maintenance"],
    status: "published"
  },
  {
    title: "Mobile Field Service: The Complete Technician Guide",
    slug: "mobile-field-service-guide",
    categorySlug: "service-management",
    excerpt: "Everything technicians need to know about using the Printyx mobile app. From accepting service calls to capturing customer signatures on-site.",
    contentType: "tutorial",
    difficultyLevel: "beginner",
    estimatedReadingTime: 10,
    featured: true,
    keywords: ["mobile app", "field service", "technician", "mobile", "on-site"],
    tags: ["mobile", "technicians", "field-service"],
    content: {
      sections: [
        {
          type: "header",
          content: "Getting Started with the Mobile App",
          order: 1
        },
        {
          type: "paragraph",
          content: "The Printyx mobile app is your technician's command center. Download from the App Store (iOS) or Google Play (Android) and log in with your Printyx credentials.",
          order: 2
        },
        {
          type: "header",
          content: "Daily Workflow for Technicians",
          order: 3
        },
        {
          type: "list",
          content: [
            "**Morning**: Review scheduled calls for the day",
            "**En Route**: Navigate to customer site with built-in mapping",
            "**On-Site Check-in**: Tap 'Arrive' to log arrival time and start clock",
            "**Perform Service**: Access equipment history and technical docs",
            "**Document Work**: Log parts used, time spent, work performed",
            "**Capture Evidence**: Take before/after photos",
            "**Get Signature**: Digital customer signature for work completion",
            "**Checkout**: Mark call complete, sync to dispatch automatically"
          ],
          order: 4
        },
        {
          type: "callout",
          content: "⏱️ **Time Tracking**: The app automatically tracks billable time from arrival to departure. No more manual timesheets!",
          formatting: { style: "success" },
          order: 5
        },
        {
          type: "header",
          content: "Accessing Equipment Information",
          order: 6
        },
        {
          type: "paragraph",
          content: "Tap on the equipment serial number to view complete device history including:",
          order: 7
        },
        {
          type: "list",
          content: [
            "Previous service calls and resolutions",
            "Parts replaced historically",
            "Current meter readings",
            "Service contract details",
            "Manufacturer documentation links",
            "Common problem codes for this model"
          ],
          order: 8
        },
        {
          type: "header",
          content: "Parts Management",
          order: 9
        },
        {
          type: "paragraph",
          content: "When using parts from your service van inventory:",
          order: 10
        },
        {
          type: "list",
          content: [
            "Scan the part barcode or search by part number",
            "Select quantity used",
            "Part is automatically deducted from your van inventory",
            "If part isn't in your van, order from warehouse for next-day delivery",
            "Customer is billed automatically based on contract terms"
          ],
          order: 11
        },
        {
          type: "header",
          content: "Service Call Statuses",
          order: 12
        },
        {
          type: "table",
          content: {
            headers: ["Status", "When to Use", "Next Step"],
            rows: [
              ["Assigned", "Call assigned to you", "Review details, plan route"],
              ["En Route", "Traveling to customer", "Use GPS navigation"],
              ["On Site", "Arrived at location", "Begin diagnostics"],
              ["In Progress", "Actively working", "Document work performed"],
              ["Awaiting Parts", "Need additional parts", "Order from warehouse"],
              ["Completed", "Service finished", "Get signature, close call"],
              ["Follow-up Required", "Need to return", "Schedule follow-up visit"]
            ]
          },
          order: 13
        },
        {
          type: "header",
          content: "Handling Common Scenarios",
          order: 14
        },
        {
          type: "paragraph",
          content: "**Scenario: Part not in your van**",
          order: 15
        },
        {
          type: "list",
          content: [
            "Set status to 'Awaiting Parts'",
            "Order the part from warehouse inventory",
            "App suggests next available time slot for follow-up",
            "Customer receives automated notification"
          ],
          order: 16
        },
        {
          type: "paragraph",
          content: "**Scenario: Issue requires specialist**",
          order: 17
        },
        {
          type: "list",
          content: [
            "Document diagnostic findings in notes",
            "Use 'Escalate' function to request specialist",
            "Dispatch auto-assigns based on expertise",
            "You receive notification of specialist arrival time"
          ],
          order: 18
        },
        {
          type: "callout",
          content: "📸 **Pro Tip**: Always take photos of error codes, damaged parts, and completed repairs. Visual documentation reduces disputes and helps with warranty claims.",
          formatting: { style: "info" },
          order: 19
        },
        {
          type: "header",
          content: "Offline Mode",
          order: 20
        },
        {
          type: "paragraph",
          content: "The mobile app works offline! Service calls sync automatically when you regain connectivity. This is essential for basements or areas with poor signal.",
          order: 21
        }
      ]
    },
    htmlContent: `<h2>Getting Started with the Mobile App</h2><p>The Printyx mobile app is your technician's command center...</p>`,
    metaTitle: "Mobile Field Service Guide for Technicians",
    metaDescription: "Complete mobile app guide for field technicians using Printyx for service calls, parts management, and customer signatures.",
    relatedArticleSlugs: ["service-dispatch-101", "parts-inventory-management"],
    status: "published"
  },
  {
    title: "Preventive Maintenance Programs: Reduce Emergency Calls by 60%",
    slug: "preventive-maintenance-programs",
    categorySlug: "service-management",
    excerpt: "Set up automated preventive maintenance schedules to catch issues before they become emergencies. Increase customer satisfaction and reduce costly emergency service calls.",
    contentType: "best_practice",
    difficultyLevel: "intermediate",
    estimatedReadingTime: 11,
    featured: false,
    keywords: ["preventive maintenance", "PM", "scheduled maintenance", "proactive service"],
    tags: ["maintenance", "preventive", "scheduling"],
    content: {
      sections: [
        {
          type: "header",
          content: "Why Preventive Maintenance Matters",
          order: 1
        },
        {
          type: "paragraph",
          content: "Preventive maintenance (PM) programs identify and fix small issues before they become major problems. Dealers with robust PM programs report 60% fewer emergency calls, 40% longer equipment life, and 25% higher customer satisfaction scores.",
          order: 2
        },
        {
          type: "callout",
          content: "💰 **ROI Insight**: Every dollar spent on preventive maintenance saves $4-6 in emergency service costs and lost customer productivity.",
          formatting: { style: "success" },
          order: 3
        },
        {
          type: "header",
          content: "Setting Up PM Schedules",
          order: 4
        },
        {
          type: "paragraph",
          content: "Navigate to Service → Preventive Maintenance → New PM Schedule. Configure based on:",
          order: 5
        },
        {
          type: "list",
          content: [
            "**Meter-based**: Trigger after X number of copies (e.g., every 10,000 pages)",
            "**Time-based**: Fixed intervals (e.g., quarterly, semi-annual, annual)",
            "**Manufacturer Recommendations**: Follow OEM maintenance schedules",
            "**Equipment Age**: More frequent for older devices",
            "**Usage Patterns**: High-volume devices need more frequent PM"
          ],
          order: 6
        },
        {
          type: "header",
          content: "Standard PM Checklist by Equipment Type",
          order: 7
        },
        {
          type: "table",
          content: {
            headers: ["Equipment Type", "PM Frequency", "Key Tasks"],
            rows: [
              ["Desktop Printers", "Annual", "Clean internals, check toner system, test all functions"],
              ["Office MFPs", "Semi-annual", "Clean/lubricate rollers, check fuser, calibrate color"],
              ["Production Printers", "Quarterly", "Full inspection, replace wear items, precision alignment"],
              ["Wide Format", "Quarterly", "Print head maintenance, media path cleaning, calibration"],
              ["Mail Inserters", "Monthly", "Lubricate mechanisms, align feeders, test all stations"]
            ]
          },
          order: 8
        },
        {
          type: "header",
          content: "Automated PM Scheduling",
          order: 9
        },
        {
          type: "paragraph",
          content: "Printyx automatically creates PM work orders based on your configured schedules. The system:",
          order: 10
        },
        {
          type: "list",
          content: [
            "Monitors meter readings from fleet monitoring",
            "Tracks time since last PM",
            "Considers technician availability and customer preferences",
            "Sends customer notification for PM appointment scheduling",
            "Assigns appropriate technician based on equipment expertise",
            "Ensures parts are in stock before scheduling"
          ],
          order: 11
        },
        {
          type: "code",
          content: `// Example: Automated PM Schedule Configuration
{
  "scheduleId": "pm-schedule-001",
  "equipmentCategory": "office-mfp",
  "triggers": [
    {
      "type": "meter-based",
      "interval": 10000,
      "unit": "pages"
    },
    {
      "type": "time-based",
      "interval": 6,
      "unit": "months",
      "maxOverride": true // Time trigger even if meter not reached
    }
  ],
  "pmTasks": [
    { "task": "Clean paper path and rollers", "estimatedMinutes": 15 },
    { "task": "Check and clean fuser unit", "estimatedMinutes": 20 },
    { "task": "Inspect and clean transfer belt", "estimatedMinutes": 15 },
    { "task": "Calibrate color output", "estimatedMinutes": 10 },
    { "task": "Check all toner levels", "estimatedMinutes": 5 },
    { "task": "Test copy, print, scan, fax functions", "estimatedMinutes": 15 }
  ],
  "estimatedDuration": "90 minutes",
  "requiredParts": ["cleaning-kit", "pm-kit"],
  "requiredSkills": ["mfp-certified"]
}`,
          formatting: { language: "json" },
          order: 12
        },
        {
          type: "header",
          content: "PM Performance Metrics",
          order: 13
        },
        {
          type: "paragraph",
          content: "Track these KPIs to measure PM program effectiveness:",
          order: 14
        },
        {
          type: "list",
          content: [
            "**PM Completion Rate**: Target 95%+ scheduled PMs completed",
            "**Emergency Call Reduction**: Should decrease 40-60% with good PM",
            "**First-Time Fix Rate**: PM should increase overall FTF rate",
            "**Average Equipment Uptime**: Should increase to 98%+",
            "**Customer Satisfaction**: PM customers rate 20% higher on average",
            "**PM to Total Service Ratio**: Aim for 30-40% of calls being PM"
          ],
          order: 15
        },
        {
          type: "callout",
          content: "📊 **Benchmark**: Top-performing dealers maintain a 35% PM-to-total-service ratio, meaning 35% of all service calls are preventive rather than reactive.",
          formatting: { style: "info" },
          order: 16
        },
        {
          type: "header",
          content: "Customer Communication",
          order: 17
        },
        {
          type: "paragraph",
          content: "Proactive PM communication builds trust. Printyx automatically:",
          order: 18
        },
        {
          type: "list",
          content: [
            "Sends PM reminder emails 2 weeks before due date",
            "Allows customers to self-schedule via customer portal",
            "Sends appointment confirmation with tech name/photo",
            "Provides SMS updates when tech is en route",
            "Emails PM summary report after completion"
          ],
          order: 19
        },
        {
          type: "header",
          content: "Best Practices",
          order: 20
        },
        {
          type: "list",
          content: [
            "✅ Schedule PMs during customer's low-usage periods",
            "✅ Bundle multiple devices at same location into one PM visit",
            "✅ Use PM visits to upsell supplies, accessories, or upgrades",
            "✅ Track PM findings to predict future equipment issues",
            "✅ Offer PM-only service contracts for price-sensitive customers",
            "✅ Review PM schedules quarterly to optimize frequency"
          ],
          order: 21
        }
      ]
    },
    htmlContent: `<h2>Why Preventive Maintenance Matters</h2><p>Preventive maintenance programs identify and fix small issues...</p>`,
    metaTitle: "Preventive Maintenance Programs in Printyx",
    metaDescription: "Set up automated preventive maintenance schedules in Printyx to reduce emergency calls and increase customer satisfaction.",
    relatedArticleSlugs: ["service-dispatch-101", "service-contract-management"],
    status: "published"
  }
];
