/**
 * Article Templates for Knowledge Base
 *
 * Pre-defined templates for different content types to ensure consistency
 * and help content creators produce high-quality articles quickly.
 */

export const articleTemplates = {
  tutorial: {
    name: "Tutorial Template",
    description: "Step-by-step guide teaching a specific skill or workflow",
    contentType: "tutorial",
    recommendedDifficulty: "beginner",
    estimatedReadingTime: 10,
    structure: {
      sections: [
        {
          type: "header",
          content: "What You'll Learn",
          order: 1,
          guidance: "List 3-5 specific learning outcomes"
        },
        {
          type: "list",
          content: [
            "Learning outcome 1",
            "Learning outcome 2",
            "Learning outcome 3"
          ],
          order: 2
        },
        {
          type: "callout",
          content: "⏱️ **Time Required**: Estimate total time to complete this tutorial",
          formatting: { style: "info" },
          order: 3,
          guidance: "Set realistic time expectations"
        },
        {
          type: "header",
          content: "Prerequisites",
          order: 4,
          guidance: "What users should know or have before starting"
        },
        {
          type: "list",
          content: [
            "Prerequisite 1",
            "Prerequisite 2"
          ],
          order: 5
        },
        {
          type: "header",
          content: "Step 1: [Action Title]",
          order: 6,
          guidance: "Use descriptive action-oriented titles"
        },
        {
          type: "paragraph",
          content: "Explain what this step accomplishes and why it's important.",
          order: 7,
          guidance: "Provide context before instructions"
        },
        {
          type: "list",
          content: [
            "Specific action 1",
            "Specific action 2",
            "Specific action 3"
          ],
          order: 8,
          guidance: "Break down into clear, numbered sub-steps"
        },
        {
          type: "image",
          content: "/assets/kb/placeholder.png",
          formatting: { alt: "Screenshot description", width: "100%" },
          order: 9,
          guidance: "Add screenshots for visual clarity"
        },
        {
          type: "header",
          content: "Step 2: [Next Action Title]",
          order: 10,
          guidance: "Continue with subsequent steps"
        },
        {
          type: "callout",
          content: "💡 **Pro Tip**: Share insider tips or shortcuts that experienced users would know",
          formatting: { style: "info" },
          order: 11,
          guidance: "Add value with expert insights"
        },
        {
          type: "header",
          content: "Verify Your Work",
          order: 12,
          guidance: "Help users confirm they completed the tutorial correctly"
        },
        {
          type: "paragraph",
          content: "Describe how to verify the tutorial was completed successfully.",
          order: 13
        },
        {
          type: "header",
          content: "Next Steps",
          order: 14,
          guidance: "Guide users to related content or advanced topics"
        },
        {
          type: "list",
          content: [
            "Related article or next skill to learn",
            "Advanced topic to explore",
            "Common use case to try"
          ],
          order: 15
        }
      ]
    },
    tags: ["tutorial", "beginner", "step-by-step"],
    seoGuidance: {
      titleFormat: "How to [Do Something]: Step-by-Step Tutorial",
      excerptTips: "Summarize what users will accomplish and why it matters",
      keywordSuggestions: ["tutorial", "guide", "how-to", "step-by-step", feature name]
    }
  },

  howTo: {
    name: "How-To Guide Template",
    description: "Quick, focused guide for accomplishing a specific task",
    contentType: "how_to",
    recommendedDifficulty: "beginner",
    estimatedReadingTime: 7,
    structure: {
      sections: [
        {
          type: "header",
          content: "Overview",
          order: 1,
          guidance: "Briefly explain what this guide covers and the end result"
        },
        {
          type: "paragraph",
          content: "Describe the task and its purpose in 1-2 sentences.",
          order: 2
        },
        {
          type: "callout",
          content: "✅ **Before You Begin**: List any requirements or prerequisites",
          formatting: { style: "info" },
          order: 3
        },
        {
          type: "header",
          content: "Quick Steps",
          order: 4,
          guidance: "Numbered list of concise action steps"
        },
        {
          type: "list",
          content: [
            "**Step 1**: Navigate to [Location]",
            "**Step 2**: Click [Button/Option]",
            "**Step 3**: Enter [Information]",
            "**Step 4**: Save/Submit/Confirm"
          ],
          order: 5,
          guidance: "Keep steps action-oriented and concise"
        },
        {
          type: "header",
          content: "Detailed Instructions",
          order: 6,
          guidance: "Expand on each step with more detail"
        },
        {
          type: "paragraph",
          content: "**Step 1 Details**: Provide additional context, screenshots, or clarifications for users who need more guidance.",
          order: 7
        },
        {
          type: "header",
          content: "Common Issues",
          order: 8,
          guidance: "Address frequently encountered problems"
        },
        {
          type: "table",
          content: {
            headers: ["Issue", "Solution"],
            rows: [
              ["Common problem 1", "How to fix it"],
              ["Common problem 2", "How to fix it"]
            ]
          },
          order: 9,
          guidance: "Quick reference for troubleshooting"
        },
        {
          type: "callout",
          content: "🎯 **Result**: Describe what the user should see upon successful completion",
          formatting: { style: "success" },
          order: 10
        }
      ]
    },
    tags: ["how-to", "guide", "quick-reference"],
    seoGuidance: {
      titleFormat: "How to [Accomplish Task] in Printyx",
      excerptTips: "Focus on the problem solved and quick outcome",
      keywordSuggestions: ["how to", task name, feature name, "guide"]
    }
  },

  reference: {
    name: "Reference Documentation Template",
    description: "Comprehensive documentation for features, APIs, or configurations",
    contentType: "reference",
    recommendedDifficulty: "intermediate",
    estimatedReadingTime: 12,
    structure: {
      sections: [
        {
          type: "header",
          content: "Overview",
          order: 1,
          guidance: "High-level description of the feature or system"
        },
        {
          type: "paragraph",
          content: "Comprehensive overview explaining what this is, its purpose, and when to use it.",
          order: 2
        },
        {
          type: "header",
          content: "Key Concepts",
          order: 3,
          guidance: "Define important terms and concepts"
        },
        {
          type: "table",
          content: {
            headers: ["Term", "Definition", "Example"],
            rows: [
              ["Key term 1", "Clear definition", "Real-world example"],
              ["Key term 2", "Clear definition", "Real-world example"]
            ]
          },
          order: 4
        },
        {
          type: "header",
          content: "Configuration Options",
          order: 5,
          guidance: "Document all available settings and parameters"
        },
        {
          type: "table",
          content: {
            headers: ["Option", "Type", "Default", "Description"],
            rows: [
              ["option1", "string", "default-value", "What this option controls"],
              ["option2", "boolean", "true", "What this option controls"]
            ]
          },
          order: 6
        },
        {
          type: "header",
          content: "Code Examples",
          order: 7,
          guidance: "Provide working code samples"
        },
        {
          type: "code",
          content: `// Example configuration or API call
{
  "parameter1": "value1",
  "parameter2": true,
  "nested": {
    "option": "example"
  }
}`,
          formatting: { language: "json" },
          order: 8,
          guidance: "Use realistic, copy-paste-ready examples"
        },
        {
          type: "header",
          content: "Common Patterns",
          order: 9,
          guidance: "Document frequently used configurations or workflows"
        },
        {
          type: "paragraph",
          content: "Describe common use cases and best practices.",
          order: 10
        },
        {
          type: "callout",
          content: "⚠️ **Important**: Highlight critical information or gotchas",
          formatting: { style: "warning" },
          order: 11
        },
        {
          type: "header",
          content: "Advanced Usage",
          order: 12,
          guidance: "Cover advanced scenarios for power users"
        },
        {
          type: "header",
          content: "Related Resources",
          order: 13,
          guidance: "Link to related documentation"
        }
      ]
    },
    tags: ["reference", "documentation", "configuration"],
    seoGuidance: {
      titleFormat: "[Feature/API Name] Reference Guide",
      excerptTips: "Summarize what the feature does and its key capabilities",
      keywordSuggestions: ["reference", "documentation", feature name, "API", "configuration"]
    }
  },

  troubleshooting: {
    name: "Troubleshooting Guide Template",
    description: "Diagnostic guide for resolving specific issues or errors",
    contentType: "troubleshooting",
    recommendedDifficulty: "intermediate",
    estimatedReadingTime: 8,
    structure: {
      sections: [
        {
          type: "header",
          content: "Problem Description",
          order: 1,
          guidance: "Clearly describe the problem or error"
        },
        {
          type: "paragraph",
          content: "Detailed description of the issue, symptoms, and when it typically occurs.",
          order: 2
        },
        {
          type: "callout",
          content: "🔍 **Symptoms Checklist**: Quick way to confirm this is your issue",
          formatting: { style: "info" },
          order: 3
        },
        {
          type: "list",
          content: [
            "Symptom or error message 1",
            "Symptom or error message 2",
            "Symptom or error message 3"
          ],
          order: 4
        },
        {
          type: "header",
          content: "Common Causes",
          order: 5,
          guidance: "List typical reasons this issue occurs"
        },
        {
          type: "table",
          content: {
            headers: ["Cause", "Likelihood", "How to Check"],
            rows: [
              ["Most common cause", "High", "Quick diagnostic step"],
              ["Less common cause", "Medium", "How to verify"],
              ["Rare edge case", "Low", "When this applies"]
            ]
          },
          order: 6
        },
        {
          type: "header",
          content: "Solution Steps",
          order: 7,
          guidance: "Ordered troubleshooting steps from simple to complex"
        },
        {
          type: "paragraph",
          content: "**Solution 1: [Quick Fix Name]** (Try this first)",
          order: 8,
          guidance: "Start with fastest/easiest solutions"
        },
        {
          type: "list",
          content: [
            "Step 1 of quick fix",
            "Step 2 of quick fix",
            "Expected result"
          ],
          order: 9
        },
        {
          type: "paragraph",
          content: "**Solution 2: [More Involved Fix]** (If Solution 1 didn't work)",
          order: 10
        },
        {
          type: "list",
          content: [
            "Step 1 of advanced fix",
            "Step 2 of advanced fix",
            "Expected result"
          ],
          order: 11
        },
        {
          type: "callout",
          content: "✅ **Verification**: How to confirm the issue is resolved",
          formatting: { style: "success" },
          order: 12
        },
        {
          type: "header",
          content: "Prevention",
          order: 13,
          guidance: "Help users avoid this issue in the future"
        },
        {
          type: "list",
          content: [
            "Best practice to prevent recurrence",
            "Configuration recommendation",
            "Monitoring suggestion"
          ],
          order: 14
        },
        {
          type: "header",
          content: "When to Contact Support",
          order: 15,
          guidance: "Clear escalation criteria"
        },
        {
          type: "paragraph",
          content: "If none of the above solutions work, contact support with: error message, steps attempted, and system details.",
          order: 16
        }
      ]
    },
    tags: ["troubleshooting", "error", "fix", "solution"],
    seoGuidance: {
      titleFormat: "How to Fix: [Error or Problem]",
      excerptTips: "Include the error message or problem statement for SEO",
      keywordSuggestions: ["troubleshooting", "fix", "error", "solution", error code/message]
    }
  },

  bestPractice: {
    name: "Best Practice Guide Template",
    description: "Industry best practices and optimization recommendations",
    contentType: "best_practice",
    recommendedDifficulty: "intermediate",
    estimatedReadingTime: 10,
    structure: {
      sections: [
        {
          type: "header",
          content: "Why This Matters",
          order: 1,
          guidance: "Explain the business value and impact"
        },
        {
          type: "paragraph",
          content: "Describe the business problem this best practice solves and the measurable impact.",
          order: 2
        },
        {
          type: "callout",
          content: "📊 **By the Numbers**: Include statistics or benchmarks that demonstrate value",
          formatting: { style: "info" },
          order: 3,
          guidance: "Use real data when possible"
        },
        {
          type: "header",
          content: "The Problem",
          order: 4,
          guidance: "Describe the anti-pattern or common mistake"
        },
        {
          type: "paragraph",
          content: "Explain what typically goes wrong and why the common approach is suboptimal.",
          order: 5
        },
        {
          type: "header",
          content: "The Solution: Best Practices",
          order: 6,
          guidance: "Present the recommended approach"
        },
        {
          type: "list",
          content: [
            "**Practice 1**: Specific recommendation with rationale",
            "**Practice 2**: Specific recommendation with rationale",
            "**Practice 3**: Specific recommendation with rationale"
          ],
          order: 7
        },
        {
          type: "header",
          content: "Implementation Guide",
          order: 8,
          guidance: "How to put these practices into action"
        },
        {
          type: "table",
          content: {
            headers: ["Best Practice", "How to Implement", "Expected Outcome"],
            rows: [
              ["Practice name", "Step-by-step implementation", "What success looks like"],
              ["Practice name", "Step-by-step implementation", "What success looks like"]
            ]
          },
          order: 9
        },
        {
          type: "header",
          content: "Real-World Example",
          order: 10,
          guidance: "Provide a concrete success story or case study"
        },
        {
          type: "paragraph",
          content: "Describe how a typical dealer implemented these practices and the results achieved.",
          order: 11,
          guidance: "Use anonymized but realistic scenarios"
        },
        {
          type: "callout",
          content: "🎯 **Success Story**: Include measurable results (e.g., '35% increase in...', '50% reduction in...')",
          formatting: { style: "success" },
          order: 12
        },
        {
          type: "header",
          content: "Common Pitfalls to Avoid",
          order: 13,
          guidance: "Warn about mistakes when implementing"
        },
        {
          type: "list",
          content: [
            "❌ Don't: Common mistake and why it fails",
            "✅ Do: Correct approach instead"
          ],
          order: 14
        },
        {
          type: "header",
          content: "Measuring Success",
          order: 15,
          guidance: "Define KPIs to track effectiveness"
        },
        {
          type: "list",
          content: [
            "Metric 1 and target value",
            "Metric 2 and target value",
            "Metric 3 and target value"
          ],
          order: 16
        }
      ]
    },
    tags: ["best-practices", "optimization", "strategy"],
    seoGuidance: {
      titleFormat: "Best Practices for [Topic/Feature]",
      excerptTips: "Highlight the key benefit or problem solved",
      keywordSuggestions: ["best practices", topic name, "optimization", "strategy", "guide"]
    }
  },

  faq: {
    name: "FAQ Template",
    description: "Frequently asked questions in Q&A format",
    contentType: "faq",
    recommendedDifficulty: "beginner",
    estimatedReadingTime: 5,
    structure: {
      sections: [
        {
          type: "header",
          content: "Frequently Asked Questions",
          order: 1
        },
        {
          type: "paragraph",
          content: "Quick answers to common questions about [topic].",
          order: 2
        },
        {
          type: "header",
          content: "Q: [Question in user's own words]?",
          order: 3,
          guidance: "Use actual questions from customers when possible"
        },
        {
          type: "paragraph",
          content: "**A**: Direct, concise answer in 1-3 sentences. Provide just enough detail to answer the question without overwhelming.",
          order: 4,
          guidance: "Keep answers scannable and to-the-point"
        },
        {
          type: "callout",
          content: "💡 **Learn More**: [Link to related article] for detailed instructions",
          formatting: { style: "info" },
          order: 5,
          guidance: "Link to deep-dive articles for complex topics"
        },
        {
          type: "header",
          content: "Q: [Next common question]?",
          order: 6,
          guidance: "Order by frequency or logical flow"
        },
        {
          type: "paragraph",
          content: "**A**: Another concise answer.",
          order: 7
        }
      ]
    },
    tags: ["faq", "questions", "quick-answers"],
    seoGuidance: {
      titleFormat: "[Topic] FAQ: Common Questions Answered",
      excerptTips: "List the 3-5 most popular questions covered",
      keywordSuggestions: ["FAQ", "questions", topic name, "answers"]
    }
  },

  releaseNotes: {
    name: "Release Notes Template",
    description: "Document new features, improvements, and bug fixes in product updates",
    contentType: "release_notes",
    recommendedDifficulty: "beginner",
    estimatedReadingTime: 5,
    structure: {
      sections: [
        {
          type: "header",
          content: "Release [Version Number] - [Date]",
          order: 1,
          guidance: "Use semantic versioning (e.g., v2.5.0)"
        },
        {
          type: "paragraph",
          content: "Brief overview of this release: the theme or major focus areas.",
          order: 2
        },
        {
          type: "callout",
          content: "🎉 **Highlights**: Top 2-3 most significant changes in this release",
          formatting: { style: "success" },
          order: 3
        },
        {
          type: "header",
          content: "✨ New Features",
          order: 4,
          guidance: "List major new capabilities"
        },
        {
          type: "list",
          content: [
            "**[Feature Name]**: Description of what it does and why it's valuable. [Learn more →](link)",
            "**[Feature Name]**: Description and value proposition. [Learn more →](link)"
          ],
          order: 5,
          guidance: "Link to full documentation for each feature"
        },
        {
          type: "header",
          content: "⚡ Improvements",
          order: 6,
          guidance: "Enhancements to existing features"
        },
        {
          type: "list",
          content: [
            "Enhanced [feature] with [specific improvement] for [benefit]",
            "Improved [performance/usability] of [feature] by [amount/description]"
          ],
          order: 7
        },
        {
          type: "header",
          content: "🐛 Bug Fixes",
          order: 8,
          guidance: "Resolved issues from previous versions"
        },
        {
          type: "list",
          content: [
            "Fixed issue where [problem description] under [conditions]",
            "Resolved [error/bug] that affected [users/feature]"
          ],
          order: 9,
          guidance: "Be specific but user-friendly, avoid technical jargon"
        },
        {
          type: "header",
          content: "🔄 Changes & Deprecations",
          order: 10,
          guidance: "Breaking changes or removed features"
        },
        {
          type: "callout",
          content: "⚠️ **Action Required**: List any required migration steps or configuration changes",
          formatting: { style: "warning" },
          order: 11
        },
        {
          type: "header",
          content: "📚 Documentation Updates",
          order: 12,
          guidance: "Link to new/updated articles"
        },
        {
          type: "list",
          content: [
            "New guide: [Article title](link)",
            "Updated: [Article title](link) with [new information]"
          ],
          order: 13
        }
      ]
    },
    tags: ["release-notes", "updates", "changelog"],
    seoGuidance: {
      titleFormat: "Printyx Release Notes: Version [X.X.X]",
      excerptTips: "Highlight the most significant new features or changes",
      keywordSuggestions: ["release notes", "updates", "new features", "changelog", version number]
    }
  }
};

/**
 * Get template by content type
 */
export function getTemplateByType(contentType: string) {
  return articleTemplates[contentType as keyof typeof articleTemplates] || null;
}

/**
 * Get all available templates
 */
export function getAllTemplates() {
  return Object.entries(articleTemplates).map(([key, template]) => ({
    id: key,
    ...template
  }));
}

/**
 * Create article from template
 */
export function createArticleFromTemplate(
  templateType: string,
  customizations: {
    title?: string;
    categoryId?: string;
    difficultyLevel?: string;
  } = {}
) {
  const template = getTemplateByType(templateType);

  if (!template) {
    throw new Error(`Template type "${templateType}" not found`);
  }

  return {
    title: customizations.title || `New ${template.name}`,
    slug: '',  // Will be generated from title
    excerpt: `A comprehensive ${template.description.toLowerCase()}`,
    content: template.structure,
    categoryId: customizations.categoryId || '',
    contentType: template.contentType,
    difficultyLevel: customizations.difficultyLevel || template.recommendedDifficulty,
    estimatedReadingTime: template.estimatedReadingTime,
    tags: template.tags,
    status: 'draft'
  };
}
