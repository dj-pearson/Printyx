import express from 'express';
import { desc, eq, and, sql, asc, gte, lte } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth-setup';

const router = express.Router();

// Document Management & Workflow Automation API Routes

// Get document library overview
router.get('/api/document-management/library', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { category, status, dateRange } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Document library with categorization and metadata
    const documentLibrary = {
      summary: {
        totalDocuments: 2847,
        categoriesCount: 12,
        pendingApproval: 23,
        expiringSoon: 8,
        storageUsed: '4.2 GB',
        storageLimit: '50 GB',
        lastBackup: new Date('2025-02-03T02:00:00Z'),
        complianceScore: 96.5
      },
      
      categories: [
        {
          id: 'contracts',
          name: 'Contracts & Agreements',
          documentCount: 456,
          subcategories: [
            { name: 'Service Contracts', count: 234, icon: 'FileText' },
            { name: 'Lease Agreements', count: 156, icon: 'FileSignature' },
            { name: 'Master Service Agreements', count: 45, icon: 'FileContract' },
            { name: 'Non-Disclosure Agreements', count: 21, icon: 'FileKey' }
          ],
          recentActivity: 12,
          complianceStatus: 'compliant',
          retentionPolicy: '7 years',
          accessLevel: 'restricted'
        },
        {
          id: 'service-docs',
          name: 'Service Documentation',
          documentCount: 1342,
          subcategories: [
            { name: 'Service Reports', count: 789, icon: 'FileText' },
            { name: 'Installation Docs', count: 234, icon: 'Settings' },
            { name: 'Maintenance Records', count: 198, icon: 'Wrench' },
            { name: 'Warranty Documentation', count: 121, icon: 'Shield' }
          ],
          recentActivity: 45,
          complianceStatus: 'compliant',
          retentionPolicy: '5 years',
          accessLevel: 'department'
        },
        {
          id: 'financial',
          name: 'Financial Records',
          documentCount: 678,
          subcategories: [
            { name: 'Invoices', count: 345, icon: 'Receipt' },
            { name: 'Purchase Orders', count: 156, icon: 'ShoppingCart' },
            { name: 'Payment Records', count: 98, icon: 'CreditCard' },
            { name: 'Tax Documents', count: 79, icon: 'Calculator' }
          ],
          recentActivity: 28,
          complianceStatus: 'compliant',
          retentionPolicy: '10 years',
          accessLevel: 'restricted'
        },
        {
          id: 'compliance',
          name: 'Compliance & Legal',
          documentCount: 234,
          subcategories: [
            { name: 'Regulatory Filings', count: 89, icon: 'FileCheck' },
            { name: 'Safety Documentation', count: 67, icon: 'Shield' },
            { name: 'Audit Reports', count: 45, icon: 'Search' },
            { name: 'Legal Correspondence', count: 33, icon: 'Mail' }
          ],
          recentActivity: 8,
          complianceStatus: 'review_required',
          retentionPolicy: 'permanent',
          accessLevel: 'restricted'
        },
        {
          id: 'training',
          name: 'Training & Procedures',
          documentCount: 137,
          subcategories: [
            { name: 'Training Materials', count: 67, icon: 'BookOpen' },
            { name: 'Standard Operating Procedures', count: 45, icon: 'ClipboardList' },
            { name: 'Safety Procedures', count: 25, icon: 'AlertTriangle' }
          ],
          recentActivity: 5,
          complianceStatus: 'compliant',
          retentionPolicy: '3 years',
          accessLevel: 'public'
        }
      ],
      
      // Recently accessed documents
      recentDocuments: [
        {
          id: 'doc-001',
          title: 'Metro Office Solutions - Service Contract Renewal',
          category: 'contracts',
          subcategory: 'Service Contracts',
          fileType: 'pdf',
          fileSize: '2.4 MB',
          lastModified: new Date('2025-02-03T16:30:00Z'),
          modifiedBy: 'Sarah Chen',
          status: 'active',
          version: '2.1',
          tags: ['renewal', 'service', 'metro-office'],
          permissions: {
            view: ['sales', 'service', 'management'],
            edit: ['sales', 'management'],
            approve: ['management']
          },
          workflow: {
            currentStage: 'customer_review',
            nextAction: 'awaiting_signature',
            dueDate: new Date('2025-02-10T17:00:00Z'),
            assignedTo: 'John Smith'
          },
          ocrText: 'Service Contract for printing equipment maintenance and support...',
          checksumMD5: '5d41402abc4b2a76b9719d911017c592'
        },
        {
          id: 'doc-002',
          title: 'Q4 2024 Compliance Audit Report',
          category: 'compliance',
          subcategory: 'Audit Reports',
          fileType: 'pdf',
          fileSize: '8.7 MB',
          lastModified: new Date('2025-02-02T14:15:00Z'),
          modifiedBy: 'Maria Rodriguez',
          status: 'final',
          version: '1.0',
          tags: ['audit', 'compliance', 'q4-2024'],
          permissions: {
            view: ['management', 'compliance'],
            edit: ['compliance'],
            approve: ['management']
          },
          workflow: {
            currentStage: 'completed',
            nextAction: 'archive',
            dueDate: new Date('2025-02-15T00:00:00Z'),
            assignedTo: 'Compliance Team'
          },
          ocrText: 'Annual compliance audit results and recommendations...',
          checksumMD5: '098f6bcd4621d373cade4e832627b4f6'
        },
        {
          id: 'doc-003',
          title: 'TechStart Innovations - Equipment Installation Report',
          category: 'service-docs',
          subcategory: 'Installation Docs',
          fileType: 'pdf',
          fileSize: '1.8 MB',
          lastModified: new Date('2025-02-01T11:45:00Z'),
          modifiedBy: 'Mike Rodriguez',
          status: 'approved',
          version: '1.2',
          tags: ['installation', 'techstart', 'xerox'],
          permissions: {
            view: ['service', 'management'],
            edit: ['service'],
            approve: ['management']
          },
          workflow: {
            currentStage: 'customer_approval',
            nextAction: 'final_signature',
            dueDate: new Date('2025-02-08T17:00:00Z'),
            assignedTo: 'Service Team'
          },
          ocrText: 'Installation completed successfully for Xerox WorkCentre 5855...',
          checksumMD5: 'e4d909c290d0fb1ca068ffaddf22cbd0'
        }
      ],
      
      // Documents requiring attention
      pendingActions: [
        {
          id: 'action-001',
          documentId: 'doc-001',
          documentTitle: 'Metro Office Solutions - Service Contract Renewal',
          actionType: 'approval_required',
          priority: 'high',
          assignedTo: 'John Smith',
          dueDate: new Date('2025-02-05T17:00:00Z'),
          description: 'Contract renewal requires final management approval before customer presentation',
          estimatedTime: 15 // minutes
        },
        {
          id: 'action-002',
          documentId: 'doc-004',
          documentTitle: 'Regional Medical Center - Master Service Agreement',
          actionType: 'signature_required',
          priority: 'critical',
          assignedTo: 'Legal Team',
          dueDate: new Date('2025-02-04T12:00:00Z'),
          description: 'MSA requires legal review and executive signature',
          estimatedTime: 45
        },
        {
          id: 'action-003',
          documentId: 'doc-005',
          documentTitle: 'Safety Procedure Update - Equipment Handling',
          actionType: 'review_required',
          priority: 'medium',
          assignedTo: 'Safety Team',
          dueDate: new Date('2025-02-12T17:00:00Z'),
          description: 'Annual safety procedure review and update required',
          estimatedTime: 120
        }
      ]
    };

    // Apply filters if provided
    let filteredData = documentLibrary;
    if (category) {
      filteredData.categories = documentLibrary.categories.filter(cat => cat.id === category);
    }

    res.json(filteredData);
    
  } catch (error) {
    console.error('Error fetching document library:', error);
    res.status(500).json({ message: 'Failed to fetch document library' });
  }
});

// Get workflow templates and automation rules
router.get('/api/document-management/workflows', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    const workflowTemplates = {
      templates: [
        {
          id: 'contract-approval',
          name: 'Contract Approval Workflow',
          description: 'Multi-stage approval process for service contracts and agreements',
          category: 'contracts',
          isActive: true,
          usage: 156, // times used
          
          stages: [
            {
              id: 'stage-1',
              name: 'Initial Review',
              description: 'Document review by sales team',
              assignedRole: 'sales',
              actions: ['review', 'edit', 'approve', 'reject'],
              slaHours: 24,
              automationRules: [
                {
                  trigger: 'document_uploaded',
                  action: 'assign_to_sales_manager',
                  condition: 'contract_value > 10000'
                }
              ]
            },
            {
              id: 'stage-2',
              name: 'Legal Review',
              description: 'Legal team review for compliance and terms',
              assignedRole: 'legal',
              actions: ['review', 'edit', 'approve', 'request_changes'],
              slaHours: 48,
              automationRules: [
                {
                  trigger: 'sales_approved',
                  action: 'assign_to_legal_team',
                  condition: 'always'
                }
              ]
            },
            {
              id: 'stage-3',
              name: 'Management Approval',
              description: 'Final approval by management',
              assignedRole: 'management',
              actions: ['approve', 'reject', 'request_revision'],
              slaHours: 12,
              automationRules: [
                {
                  trigger: 'legal_approved',
                  action: 'assign_to_manager',
                  condition: 'contract_value > 5000'
                }
              ]
            },
            {
              id: 'stage-4',
              name: 'Customer Presentation',
              description: 'Present approved contract to customer',
              assignedRole: 'sales',
              actions: ['send_to_customer', 'schedule_meeting'],
              slaHours: 24,
              automationRules: [
                {
                  trigger: 'management_approved',
                  action: 'send_notification_to_sales',
                  condition: 'always'
                }
              ]
            }
          ],
          
          notifications: [
            {
              event: 'stage_completed',
              recipients: ['assignee', 'manager'],
              template: 'stage_completion_notification'
            },
            {
              event: 'sla_warning',
              recipients: ['assignee', 'escalation_manager'],
              template: 'sla_warning_notification',
              timing: '4_hours_before_due'
            },
            {
              event: 'approval_required',
              recipients: ['approver'],
              template: 'approval_request_notification'
            }
          ],
          
          metrics: {
            averageCompletionTime: 4.2, // days
            approvalRate: 89.5, // percentage
            slaComplianceRate: 92.1,
            bottleneckStage: 'legal_review'
          }
        },
        {
          id: 'service-documentation',
          name: 'Service Documentation Workflow',
          description: 'Automated workflow for service reports and documentation',
          category: 'service-docs',
          isActive: true,
          usage: 342,
          
          stages: [
            {
              id: 'stage-1',
              name: 'Service Completion',
              description: 'Technician completes service and uploads documentation',
              assignedRole: 'technician',
              actions: ['upload_report', 'add_photos', 'submit'],
              slaHours: 2,
              automationRules: [
                {
                  trigger: 'service_ticket_closed',
                  action: 'create_documentation_task',
                  condition: 'always'
                }
              ]
            },
            {
              id: 'stage-2',
              name: 'Quality Review',
              description: 'Service manager reviews documentation quality',
              assignedRole: 'service_manager',
              actions: ['review', 'approve', 'request_revision'],
              slaHours: 8,
              automationRules: [
                {
                  trigger: 'documentation_submitted',
                  action: 'assign_to_service_manager',
                  condition: 'always'
                }
              ]
            },
            {
              id: 'stage-3',
              name: 'Customer Notification',
              description: 'Automatically notify customer of service completion',
              assignedRole: 'system',
              actions: ['send_email', 'update_portal'],
              slaHours: 1,
              automationRules: [
                {
                  trigger: 'documentation_approved',
                  action: 'send_customer_notification',
                  condition: 'always'
                }
              ]
            }
          ],
          
          metrics: {
            averageCompletionTime: 0.8, // days
            approvalRate: 94.7,
            slaComplianceRate: 96.3,
            bottleneckStage: 'quality_review'
          }
        },
        {
          id: 'compliance-review',
          name: 'Compliance Review Workflow',
          description: 'Periodic review workflow for compliance documentation',
          category: 'compliance',
          isActive: true,
          usage: 89,
          
          stages: [
            {
              id: 'stage-1',
              name: 'Document Assessment',
              description: 'Assess document for compliance requirements',
              assignedRole: 'compliance',
              actions: ['assess', 'flag_issues', 'approve'],
              slaHours: 72,
              automationRules: [
                {
                  trigger: 'scheduled_review',
                  action: 'create_assessment_task',
                  condition: 'document_age > review_interval'
                }
              ]
            },
            {
              id: 'stage-2',
              name: 'Remediation',
              description: 'Address any compliance issues identified',
              assignedRole: 'document_owner',
              actions: ['update_document', 'provide_explanation'],
              slaHours: 120,
              automationRules: [
                {
                  trigger: 'issues_identified',
                  action: 'assign_to_document_owner',
                  condition: 'compliance_issues_found'
                }
              ]
            },
            {
              id: 'stage-3',
              name: 'Final Certification',
              description: 'Final compliance certification',
              assignedRole: 'compliance_manager',
              actions: ['certify', 'schedule_next_review'],
              slaHours: 24,
              automationRules: [
                {
                  trigger: 'remediation_completed',
                  action: 'request_final_certification',
                  condition: 'always'
                }
              ]
            }
          ],
          
          metrics: {
            averageCompletionTime: 8.5, // days
            approvalRate: 85.2,
            slaComplianceRate: 78.9,
            bottleneckStage: 'remediation'
          }
        }
      ],
      
      // Active workflow instances
      activeWorkflows: [
        {
          id: 'wf-001',
          templateId: 'contract-approval',
          documentId: 'doc-001',
          documentTitle: 'Metro Office Solutions - Service Contract Renewal',
          currentStage: 'management_approval',
          progress: 75,
          startedAt: new Date('2025-01-30T09:00:00Z'),
          dueAt: new Date('2025-02-05T17:00:00Z'),
          assignedTo: 'John Smith',
          priority: 'high',
          slaStatus: 'on_track'
        },
        {
          id: 'wf-002',
          templateId: 'service-documentation',
          documentId: 'doc-003',
          documentTitle: 'TechStart Innovations - Equipment Installation Report',
          currentStage: 'customer_notification',
          progress: 90,
          startedAt: new Date('2025-02-01T14:30:00Z'),
          dueAt: new Date('2025-02-02T16:30:00Z'),
          assignedTo: 'System',
          priority: 'medium',
          slaStatus: 'completed'
        },
        {
          id: 'wf-003',
          templateId: 'compliance-review',
          documentId: 'doc-002',
          documentTitle: 'Q4 2024 Compliance Audit Report',
          currentStage: 'final_certification',
          progress: 85,
          startedAt: new Date('2025-01-25T10:00:00Z'),
          dueAt: new Date('2025-02-08T17:00:00Z'),
          assignedTo: 'Maria Rodriguez',
          priority: 'high',
          slaStatus: 'at_risk'
        }
      ],
      
      // Automation statistics
      automationStats: {
        totalRulesActive: 24,
        rulesTriggeredToday: 12,
        automationSuccessRate: 96.8,
        timesSaved: 145, // hours per month
        documentsProcessed: 2847,
        averageProcessingTime: 2.3 // days
      }
    };

    res.json(workflowTemplates);
    
  } catch (error) {
    console.error('Error fetching workflow templates:', error);
    res.status(500).json({ message: 'Failed to fetch workflow templates' });
  }
});

// Get document search and OCR results
router.get('/api/document-management/search', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { query, category, dateRange, fileType } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Simulated search results with OCR and metadata matching
    const searchResults = {
      query: query || '',
      totalResults: 42,
      searchTime: 0.18, // seconds
      filters: {
        category: category || 'all',
        dateRange: dateRange || 'all_time',
        fileType: fileType || 'all'
      },
      
      results: [
        {
          id: 'doc-001',
          title: 'Metro Office Solutions - Service Contract Renewal',
          category: 'contracts',
          subcategory: 'Service Contracts',
          relevanceScore: 98.5,
          matchType: 'title_and_content',
          
          highlights: [
            'Metro Office Solutions service <mark>contract</mark> for equipment maintenance',
            'Annual <mark>renewal</mark> terms and pricing structure',
            'Service level agreements and response times'
          ],
          
          metadata: {
            fileType: 'pdf',
            fileSize: '2.4 MB',
            pages: 12,
            lastModified: new Date('2025-02-03T16:30:00Z'),
            modifiedBy: 'Sarah Chen',
            version: '2.1',
            tags: ['renewal', 'service', 'metro-office'],
            language: 'en'
          },
          
          ocrConfidence: 94.7,
          textPreview: 'This Service Contract (Contract) is entered into between Metro Office Solutions and Printyx Service Division for the provision of comprehensive equipment maintenance...',
          
          permissions: {
            canView: true,
            canEdit: true,
            canDownload: true,
            canShare: false
          }
        },
        {
          id: 'doc-006',
          title: 'Service Level Agreement Template - Standard Terms',
          category: 'contracts',
          subcategory: 'Service Contracts',
          relevanceScore: 87.2,
          matchType: 'content_only',
          
          highlights: [
            'Standard <mark>service</mark> level agreement template',
            'Response time requirements and <mark>contract</mark> terms',
            'Equipment maintenance and support provisions'
          ],
          
          metadata: {
            fileType: 'docx',
            fileSize: '845 KB',
            pages: 8,
            lastModified: new Date('2025-01-28T10:15:00Z'),
            modifiedBy: 'Legal Team',
            version: '3.4',
            tags: ['template', 'sla', 'standard'],
            language: 'en'
          },
          
          ocrConfidence: 96.1,
          textPreview: 'This Service Level Agreement template defines standard terms for equipment maintenance contracts including response times, coverage areas...',
          
          permissions: {
            canView: true,
            canEdit: false,
            canDownload: true,
            canShare: true
          }
        },
        {
          id: 'doc-007',
          title: 'Equipment Installation Checklist - Canon ImageRunner Series',
          category: 'service-docs',
          subcategory: 'Installation Docs',
          relevanceScore: 75.8,
          matchType: 'metadata_and_content',
          
          highlights: [
            'Canon ImageRunner installation procedures and checklist',
            'Equipment setup and configuration requirements',
            'Post-installation testing and verification'
          ],
          
          metadata: {
            fileType: 'pdf',
            fileSize: '1.2 MB',
            pages: 6,
            lastModified: new Date('2025-01-25T14:22:00Z'),
            modifiedBy: 'Installation Team',
            version: '1.8',
            tags: ['canon', 'installation', 'checklist'],
            language: 'en'
          },
          
          ocrConfidence: 91.3,
          textPreview: 'Canon ImageRunner Installation Checklist: Pre-installation site survey, electrical requirements, network configuration...',
          
          permissions: {
            canView: true,
            canEdit: true,
            canDownload: true,
            canShare: true
          }
        }
      ],
      
      // Search suggestions and filters
      suggestions: [
        'service contract renewal',
        'maintenance agreement',
        'installation documentation',
        'compliance audit report',
        'training materials'
      ],
      
      availableFilters: {
        categories: [
          { id: 'contracts', name: 'Contracts & Agreements', count: 18 },
          { id: 'service-docs', name: 'Service Documentation', count: 15 },
          { id: 'financial', name: 'Financial Records', count: 6 },
          { id: 'compliance', name: 'Compliance & Legal', count: 3 }
        ],
        fileTypes: [
          { type: 'pdf', count: 28 },
          { type: 'docx', count: 8 },
          { type: 'xlsx', count: 4 },
          { type: 'jpg', count: 2 }
        ],
        dateRanges: [
          { range: 'last_week', count: 12 },
          { range: 'last_month', count: 25 },
          { range: 'last_quarter', count: 38 },
          { range: 'last_year', count: 42 }
        ]
      }
    };

    res.json(searchResults);
    
  } catch (error) {
    console.error('Error performing document search:', error);
    res.status(500).json({ message: 'Failed to perform document search' });
  }
});

// Create or update workflow automation rule
router.post('/api/document-management/automation-rules', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { ruleName, trigger, condition, action, targetRole, templateId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Simulate rule creation
    const newRule = {
      id: `rule-${Date.now()}`,
      name: ruleName,
      templateId,
      trigger,
      condition,
      action,
      targetRole,
      isActive: true,
      createdAt: new Date(),
      createdBy: req.user.name,
      triggeredCount: 0,
      successRate: 100
    };

    res.json({ 
      success: true, 
      rule: newRule,
      message: 'Automation rule created successfully'
    });
    
  } catch (error) {
    console.error('Error creating automation rule:', error);
    res.status(500).json({ message: 'Failed to create automation rule' });
  }
});

// Upload document with OCR processing
router.post('/api/document-management/upload', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { fileName, fileSize, fileType, category, tags } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Simulate document upload and OCR processing
    const uploadResult = {
      documentId: `doc-${Date.now()}`,
      fileName,
      fileSize,
      fileType,
      category,
      uploadedAt: new Date(),
      uploadedBy: req.user.name,
      
      // OCR processing results
      ocrProcessing: {
        status: 'completed',
        confidence: 94.2,
        pagesProcessed: 8,
        processingTime: 12.5, // seconds
        extractedText: 'Service Agreement for comprehensive equipment maintenance and support services...',
        detectedLanguage: 'en',
        metadata: {
          documentType: 'contract',
          signaturesDetected: 2,
          tablesDetected: 3,
          formsDetected: 1
        }
      },
      
      // Auto-generated metadata
      generatedMetadata: {
        suggestedTags: ['service', 'contract', 'maintenance'],
        suggestedCategory: 'contracts',
        confidenceLevel: 87.5,
        detectedEntities: [
          { type: 'company', value: 'Metro Office Solutions', confidence: 95.2 },
          { type: 'date', value: '2025-02-01', confidence: 98.1 },
          { type: 'amount', value: '$15,600', confidence: 91.7 }
        ]
      },
      
      // Workflow automation
      triggeredWorkflows: [
        {
          workflowId: 'contract-approval',
          status: 'initiated',
          currentStage: 'initial_review',
          assignedTo: 'Sales Team'
        }
      ]
    };

    res.json(uploadResult);
    
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ message: 'Failed to upload document' });
  }
});

export default router;