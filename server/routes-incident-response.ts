import express from 'express';
import { desc, eq, and, sql, asc, gte, lte } from 'drizzle-orm';
import { db } from './db';

// Using inline auth middleware since requireAuth is not available
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  next();
};

const router = express.Router();

// Security Incident Response System API Routes

// Get incident response dashboard
router.get('/api/incident-response/dashboard', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    const incidentResponseData = {
      // Response Overview
      responseOverview: {
        activeIncidents: 7,
        criticalIncidents: 1,
        highIncidents: 2,
        mediumIncidents: 3,
        lowIncidents: 1,
        avgResponseTime: 12.5, // minutes
        avgResolutionTime: 4.2, // hours
        mttr: 3.8, // mean time to resolution in hours
        slaCompliance: 94.7, // percentage
        escalatedIncidents: 2,
        falsePositives: 8
      },

      // Active Incidents
      activeIncidents: [
        {
          id: 'INC-2025-007',
          title: 'Potential Data Exfiltration',
          severity: 'critical',
          priority: 'p1',
          status: 'investigating',
          category: 'data_breach',
          subcategory: 'data_exfiltration',
          detectedAt: new Date('2025-02-01T08:15:00Z'),
          reportedBy: 'DLP System',
          assignedTo: 'Incident Response Team Alpha',
          responder: 'Sarah Chen',
          affectedSystems: ['Customer Database', 'File Server', 'Email System'],
          affectedUsers: 15,
          estimatedImpact: 'high',
          businessImpact: 'Potential customer data exposure - regulatory compliance risk',
          detectionMethod: 'automated',
          confidenceLevel: 87.5,
          ttl: 2.3, // time to live in hours since detection
          slaDeadline: new Date('2025-02-01T12:15:00Z'), // 4 hours for critical
          currentPhase: 'containment',
          progress: 35,
          tags: ['gdpr', 'customer_data', 'regulatory'],
          threatActors: ['Unknown Internal User'],
          indicators: [
            'Unusual bulk data access pattern',
            'Large file transfers to external email',
            'After-hours system access'
          ]
        },
        {
          id: 'INC-2025-006',
          title: 'Advanced Persistent Threat Detection',
          severity: 'high',
          priority: 'p2',
          status: 'analyzing',
          category: 'malware',
          subcategory: 'apt',
          detectedAt: new Date('2025-01-31T22:30:00Z'),
          reportedBy: 'EDR System',
          assignedTo: 'Incident Response Team Beta',
          responder: 'Mike Rodriguez',
          affectedSystems: ['Workstation Network', 'Domain Controllers'],
          affectedUsers: 3,
          estimatedImpact: 'medium',
          businessImpact: 'Potential system compromise and lateral movement',
          detectionMethod: 'automated',
          confidenceLevel: 92.1,
          ttl: 9.8,
          slaDeadline: new Date('2025-02-01T14:30:00Z'), // 16 hours for high
          currentPhase: 'analysis',
          progress: 65,
          tags: ['apt', 'lateral_movement', 'edr'],
          threatActors: ['APT29 (Suspected)'],
          indicators: [
            'Suspicious PowerShell execution',
            'Unusual network traffic patterns',
            'Registry modifications'
          ]
        },
        {
          id: 'INC-2025-005',
          title: 'Phishing Campaign Targeting Executives',
          severity: 'high',
          priority: 'p2',
          status: 'contained',
          category: 'social_engineering',
          subcategory: 'spear_phishing',
          detectedAt: new Date('2025-01-31T14:45:00Z'),
          reportedBy: 'Email Security Gateway',
          assignedTo: 'Incident Response Team Beta',
          responder: 'Jennifer Walsh',
          affectedSystems: ['Email System', 'Executive Workstations'],
          affectedUsers: 8,
          estimatedImpact: 'medium',
          businessImpact: 'Attempted credential harvesting of executive accounts',
          detectionMethod: 'automated',
          confidenceLevel: 95.8,
          ttl: 41.5,
          slaDeadline: new Date('2025-02-01T06:45:00Z'), // 16 hours for high
          currentPhase: 'recovery',
          progress: 85,
          tags: ['phishing', 'executives', 'credential_harvesting'],
          threatActors: ['Unknown External Threat Actor'],
          indicators: [
            'Suspicious email domains',
            'Executive targeting pattern',
            'Credential harvesting URLs'
          ]
        }
      ],

      // Incident Statistics and Trends
      incidentStats: {
        monthlyTrends: [
          { month: '2024-08', incidents: 23, resolved: 21, avgTime: 5.2 },
          { month: '2024-09', incidents: 19, resolved: 18, avgTime: 4.8 },
          { month: '2024-10', incidents: 27, resolved: 25, avgTime: 4.1 },
          { month: '2024-11', incidents: 21, resolved: 20, avgTime: 3.9 },
          { month: '2024-12', incidents: 18, resolved: 17, avgTime: 3.7 },
          { month: '2025-01', incidents: 24, resolved: 22, avgTime: 4.2 },
          { month: '2025-02', incidents: 7, resolved: 0, avgTime: 0 } // current month
        ],

        categoriesBreakdown: [
          { category: 'malware', count: 35, percentage: 28.5, avgSeverity: 'medium' },
          { category: 'social_engineering', count: 28, percentage: 22.8, avgSeverity: 'high' },
          { category: 'network_intrusion', count: 22, percentage: 17.9, avgSeverity: 'high' },
          { category: 'data_breach', count: 18, percentage: 14.6, avgSeverity: 'critical' },
          { category: 'insider_threat', count: 12, percentage: 9.8, avgSeverity: 'medium' },
          { category: 'ddos', count: 8, percentage: 6.5, avgSeverity: 'low' }
        ],

        severityDistribution: {
          critical: { count: 8, percentage: 6.5, avgResolutionTime: 2.1 },
          high: { count: 31, percentage: 25.2, avgResolutionTime: 6.8 },
          medium: { count: 52, percentage: 42.3, avgResolutionTime: 12.4 },
          low: { count: 32, percentage: 26.0, avgResolutionTime: 24.7 }
        },

        detectionSources: [
          { source: 'SIEM/SOAR', incidents: 45, percentage: 36.6 },
          { source: 'EDR/XDR', incidents: 32, percentage: 26.0 },
          { source: 'Network Monitoring', incidents: 23, percentage: 18.7 },
          { source: 'User Reports', incidents: 15, percentage: 12.2 },
          { source: 'Vulnerability Scanners', incidents: 8, percentage: 6.5 }
        ]
      },

      // Response Team Performance
      teamPerformance: {
        teams: [
          {
            name: 'Incident Response Team Alpha',
            lead: 'Sarah Chen',
            members: 4,
            specialization: 'Critical Incidents & Data Breaches',
            activeIncidents: 3,
            avgResponseTime: 8.2, // minutes
            avgResolutionTime: 2.8, // hours
            slaCompliance: 97.3,
            workload: 'high',
            status: 'available',
            onCallSchedule: 'Week 1-2 February'
          },
          {
            name: 'Incident Response Team Beta',
            lead: 'Mike Rodriguez',
            members: 3,
            specialization: 'Malware & Network Intrusions',
            activeIncidents: 2,
            avgResponseTime: 11.5,
            avgResolutionTime: 5.1,
            slaCompliance: 94.2,
            workload: 'medium',
            status: 'available',
            onCallSchedule: 'Week 3-4 February'
          },
          {
            name: 'Incident Response Team Gamma',
            lead: 'Jennifer Walsh',
            members: 3,
            specialization: 'Social Engineering & Insider Threats',
            activeIncidents: 2,
            avgResponseTime: 15.3,
            avgResolutionTime: 6.7,
            slaCompliance: 91.8,
            workload: 'low',
            status: 'on_standby',
            onCallSchedule: 'Emergency Backup'
          }
        ],

        individuals: [
          {
            name: 'Sarah Chen',
            role: 'Senior Incident Response Analyst',
            team: 'Alpha',
            activeIncidents: 1,
            totalIncidents: 47,
            avgResponseTime: 6.2,
            avgResolutionTime: 2.1,
            specialties: ['Data Breaches', 'Forensics', 'Compliance'],
            certifications: ['GCIH', 'GCFA', 'CISSP'],
            availability: 'on_call',
            performance: 'excellent'
          },
          {
            name: 'Mike Rodriguez',
            role: 'Incident Response Analyst',
            team: 'Beta',
            activeIncidents: 2,
            totalIncidents: 38,
            avgResponseTime: 9.1,
            avgResolutionTime: 4.8,
            specialties: ['Malware Analysis', 'Network Security', 'Threat Hunting'],
            certifications: ['GCTI', 'GREM', 'CEH'],
            availability: 'available',
            performance: 'good'
          }
        ]
      },

      // Threat Intelligence Integration
      threatIntelligence: {
        activeThreatFeeds: 12,
        iocMatches: 156,
        newThreats: 23,
        
        currentThreats: [
          {
            threatId: 'TI-2025-001',
            name: 'Lazarus Group Campaign',
            threatActor: 'Lazarus Group (APT38)',
            firstSeen: new Date('2025-01-28T00:00:00Z'),
            lastUpdated: new Date('2025-02-01T06:30:00Z'),
            severity: 'high',
            confidence: 89.2,
            targeting: ['Financial Services', 'Technology'],
            ttps: ['T1566.001', 'T1055', 'T1071.001'],
            iocs: [
              { type: 'domain', value: 'malicious-domain.com', confidence: 95 },
              { type: 'ip', value: '192.168.1.100', confidence: 87 },
              { type: 'hash', value: 'a1b2c3d4e5f6...', confidence: 92 }
            ],
            mitigation: 'Block domains, monitor for lateral movement techniques',
            relevanceScore: 78.5
          },
          {
            threatId: 'TI-2025-002',
            name: 'Ransomware-as-a-Service Operation',
            threatActor: 'BlackCat (ALPHV)',
            firstSeen: new Date('2025-01-30T00:00:00Z'),
            lastUpdated: new Date('2025-02-01T08:00:00Z'),
            severity: 'critical',
            confidence: 94.7,
            targeting: ['Healthcare', 'Manufacturing', 'Professional Services'],
            ttps: ['T1486', 'T1490', 'T1562.001'],
            iocs: [
              { type: 'file', value: 'blackcat.exe', confidence: 98 },
              { type: 'registry', value: 'HKLM\\Software\\BlackCat', confidence: 96 }
            ],
            mitigation: 'Enhanced backup verification, endpoint hardening',
            relevanceScore: 85.3
          }
        ],

        feedSources: [
          { name: 'Commercial Threat Intelligence', status: 'active', lastUpdate: new Date(), indicators: 15678 },
          { name: 'MISP Community', status: 'active', lastUpdate: new Date(), indicators: 8934 },
          { name: 'Government Feeds', status: 'active', lastUpdate: new Date(), indicators: 4567 },
          { name: 'Industry Sharing', status: 'active', lastUpdate: new Date(), indicators: 2345 }
        ]
      },

      // Automated Response Capabilities
      automatedResponse: {
        playbooks: [
          {
            id: 'playbook-001',
            name: 'Malware Incident Response',
            triggers: ['malware_detected', 'suspicious_process'],
            automationLevel: 78.5,
            steps: 12,
            avgExecutionTime: 15.7, // minutes
            successRate: 94.2,
            lastUpdated: new Date('2025-01-15T00:00:00Z'),
            status: 'active'
          },
          {
            id: 'playbook-002',
            name: 'Data Breach Response',
            triggers: ['data_exfiltration', 'unauthorized_access'],
            automationLevel: 65.3,
            steps: 18,
            avgExecutionTime: 32.4,
            successRate: 89.7,
            lastUpdated: new Date('2025-01-20T00:00:00Z'),
            status: 'active'
          },
          {
            id: 'playbook-003',
            name: 'Phishing Campaign Response',
            triggers: ['phishing_detected', 'credential_harvesting'],
            automationLevel: 85.7,
            steps: 8,
            avgExecutionTime: 8.3,
            successRate: 97.1,
            lastUpdated: new Date('2025-01-25T00:00:00Z'),
            status: 'active'
          }
        ],

        automationMetrics: {
          totalAutomatedActions: 1247,
          automationSuccessRate: 92.8,
          timesSaved: 847.3, // hours saved through automation
          falsePositiveReduction: 67.4, // percentage
          humanInterventionRequired: 12.5 // percentage of cases
        },

        integrations: [
          { system: 'SIEM (Splunk)', status: 'active', automationLevel: 85 },
          { system: 'EDR (CrowdStrike)', status: 'active', automationLevel: 92 },
          { system: 'Email Security', status: 'active', automationLevel: 78 },
          { system: 'Network Firewall', status: 'active', automationLevel: 89 },
          { system: 'Identity Management', status: 'active', automationLevel: 76 }
        ]
      },

      // Communication and Escalation
      communication: {
        stakeholderNotifications: [
          {
            incident: 'INC-2025-007',
            stakeholder: 'CISO',
            notificationType: 'immediate',
            sentAt: new Date('2025-02-01T08:20:00Z'),
            method: 'email + sms',
            status: 'acknowledged'
          },
          {
            incident: 'INC-2025-007',
            stakeholder: 'Legal Team',
            notificationType: 'escalation',
            sentAt: new Date('2025-02-01T08:25:00Z'),
            method: 'email',
            status: 'pending'
          },
          {
            incident: 'INC-2025-006',
            stakeholder: 'IT Operations',
            notificationType: 'standard',
            sentAt: new Date('2025-01-31T22:35:00Z'),
            method: 'slack',
            status: 'acknowledged'
          }
        ],

        escalationMatrix: [
          { severity: 'critical', immediate: ['CISO', 'CEO'], within_1hr: ['Legal', 'PR'], within_4hr: ['Board'] },
          { severity: 'high', immediate: ['CISO', 'IT Director'], within_2hr: ['Legal'], within_8hr: ['Executive Team'] },
          { severity: 'medium', immediate: ['Security Manager'], within_4hr: ['IT Director'], within_24hr: ['CISO'] },
          { severity: 'low', immediate: ['Security Analyst'], within_8hr: ['Security Manager'], within_72hr: ['IT Director'] }
        ],

        externalCommunications: {
          regulatoryReports: 2,
          customerNotifications: 0,
          partnerAlerts: 1,
          lawEnforcementReports: 0,
          insuranceNotifications: 1
        }
      },

      // Lessons Learned and Improvements
      lessonsLearned: [
        {
          incidentId: 'INC-2025-003',
          title: 'Email Security Gap Identified',
          description: 'Phishing email bypassed initial filters due to domain reputation lag',
          improvementActions: [
            'Implement real-time domain reputation checking',
            'Add additional email security layers',
            'Update user training on latest phishing techniques'
          ],
          status: 'implemented',
          implementedDate: new Date('2025-01-25T00:00:00Z'),
          impact: 'Reduced similar incidents by 73%'
        },
        {
          incidentId: 'INC-2025-001',
          title: 'Response Time Optimization',
          description: 'Initial response delayed due to alert fatigue and unclear escalation',
          improvementActions: [
            'Refine SIEM alert correlation rules',
            'Update escalation procedures',
            'Implement alert prioritization algorithm'
          ],
          status: 'in_progress',
          targetDate: new Date('2025-02-15T00:00:00Z'),
          progress: 65
        }
      ]
    };

    res.json(incidentResponseData);
    
  } catch (error) {
    console.error('Error fetching incident response dashboard:', error);
    res.status(500).json({ message: 'Failed to fetch incident response dashboard' });
  }
});

// Get detailed incident information
router.get('/api/incident-response/incidents/:incidentId', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { incidentId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Mock detailed incident data
    const incidentDetails = {
      id: incidentId,
      title: 'Potential Data Exfiltration',
      severity: 'critical',
      priority: 'p1',
      status: 'investigating',
      
      timeline: [
        {
          timestamp: new Date('2025-02-01T08:15:00Z'),
          phase: 'detection',
          event: 'Anomaly Detected',
          description: 'DLP system flagged unusual bulk data access pattern',
          actor: 'DLP System',
          details: 'Employee accessed 15,000+ customer records in 10 minutes'
        },
        {
          timestamp: new Date('2025-02-01T08:17:00Z'),
          phase: 'detection',
          event: 'Alert Generated',
          description: 'High-severity security alert created and routed',
          actor: 'SIEM System',
          details: 'Alert ID: SIEM-2025-001847, Confidence: 87.5%'
        },
        {
          timestamp: new Date('2025-02-01T08:20:00Z'),
          phase: 'response',
          event: 'Incident Declared',
          description: 'Security analyst declared formal incident',
          actor: 'Sarah Chen',
          details: 'Escalated to P1 Critical due to data sensitivity'
        },
        {
          timestamp: new Date('2025-02-01T08:22:00Z'),
          phase: 'containment',
          event: 'User Account Suspended',
          description: 'Suspected user account temporarily suspended',
          actor: 'Sarah Chen',
          details: 'Account: john.insider@company.com suspended pending investigation'
        },
        {
          timestamp: new Date('2025-02-01T08:25:00Z'),
          phase: 'communication',
          event: 'Stakeholder Notification',
          description: 'CISO and Legal team notified of critical incident',
          actor: 'Automated System',
          details: 'Email and SMS notifications sent, acknowledgments received'
        }
      ],

      evidence: [
        {
          type: 'log_analysis',
          title: 'Database Access Logs',
          description: 'Comprehensive database query logs showing access patterns',
          collectedAt: new Date('2025-02-01T08:18:00Z'),
          collector: 'Sarah Chen',
          hash: 'sha256:1a2b3c4d5e6f...',
          size: '2.4 MB',
          status: 'analyzed'
        },
        {
          type: 'network_traffic',
          title: 'Network Flow Analysis',
          description: 'Network traffic capture during suspected exfiltration timeframe',
          collectedAt: new Date('2025-02-01T08:30:00Z'),
          collector: 'Mike Rodriguez',
          hash: 'sha256:f6e5d4c3b2a1...',
          size: '156 MB',
          status: 'processing'
        },
        {
          type: 'user_activity',
          title: 'User Behavior Analytics',
          description: 'Complete user activity timeline and behavioral analysis',
          collectedAt: new Date('2025-02-01T08:35:00Z'),
          collector: 'Jennifer Walsh',
          hash: 'sha256:9z8y7x6w5v4u...',
          size: '894 KB',
          status: 'ready'
        }
      ],

      impactAssessment: {
        dataAtRisk: {
          customers: 15247,
          records: 15247,
          dataTypes: ['PII', 'Contact Information', 'Account Numbers'],
          sensitivity: 'high',
          regulatoryImplications: ['GDPR', 'CCPA', 'SOX']
        },
        businessImpact: {
          revenue: 0, // no direct revenue impact yet
          operations: 'minimal', // suspended one user account
          reputation: 'potential_high',
          compliance: 'breach_notification_required',
          estimatedCost: 125000 // potential regulatory fines and response costs
        },
        affectedSystems: [
          { system: 'Customer Database', impact: 'data_accessed', criticality: 'high' },
          { system: 'File Server', impact: 'potential_exfiltration', criticality: 'medium' },
          { system: 'Email System', impact: 'transmission_method', criticality: 'low' }
        ]
      },

      responseActions: [
        {
          action: 'Immediate user account suspension',
          status: 'completed',
          assignedTo: 'Sarah Chen',
          completedAt: new Date('2025-02-01T08:22:00Z'),
          effectiveness: 'high'
        },
        {
          action: 'Network traffic analysis and capture',
          status: 'in_progress',
          assignedTo: 'Mike Rodriguez',
          estimatedCompletion: new Date('2025-02-01T10:00:00Z'),
          progress: 75
        },
        {
          action: 'Forensic imaging of user workstation',
          status: 'pending',
          assignedTo: 'Digital Forensics Team',
          scheduledStart: new Date('2025-02-01T12:00:00Z'),
          priority: 'high'
        },
        {
          action: 'Legal and compliance notification',
          status: 'completed',
          assignedTo: 'Sarah Chen',
          completedAt: new Date('2025-02-01T08:25:00Z'),
          effectiveness: 'standard'
        }
      ],

      nextSteps: [
        'Complete network traffic analysis',
        'Conduct forensic examination of user workstation',
        'Interview affected employee and supervisor',
        'Assess scope of data actually exfiltrated',
        'Determine if external transmission occurred',
        'Prepare regulatory breach notifications if required'
      ]
    };

    res.json(incidentDetails);
    
  } catch (error) {
    console.error('Error fetching incident details:', error);
    res.status(500).json({ message: 'Failed to fetch incident details' });
  }
});

// Execute incident response playbook
router.post('/api/incident-response/playbooks/:playbookId/execute', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { playbookId } = req.params;
    const { incidentId, parameters } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Mock playbook execution
    const execution = {
      executionId: `exec-${Date.now()}`,
      playbookId,
      incidentId,
      status: 'running',
      startTime: new Date(),
      parameters,
      progress: 0,
      currentStep: 1,
      totalSteps: 12,
      estimatedCompletion: new Date(Date.now() + 15.7 * 60 * 1000), // 15.7 minutes
      
      steps: [
        { step: 1, name: 'Initial Assessment', status: 'completed', startTime: new Date(), duration: 45 },
        { step: 2, name: 'Containment Actions', status: 'running', startTime: new Date(), duration: null },
        { step: 3, name: 'Evidence Collection', status: 'pending', startTime: null, duration: null }
      ]
    };

    res.status(202).json(execution);
    
  } catch (error) {
    console.error('Error executing playbook:', error);
    res.status(500).json({ message: 'Failed to execute playbook' });
  }
});

export default router;