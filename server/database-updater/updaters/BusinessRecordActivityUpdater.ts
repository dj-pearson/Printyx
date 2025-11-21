/**
 * Business Record Activity Updater
 * Updates business_record_activities table with realistic CRM activities
 */

import { BaseUpdater, UpdaterOptions } from '../core/BaseUpdater';
import { db } from '../../db';
import { businessRecordActivities, businessRecords } from '../../../shared/schema';
import { and, eq } from 'drizzle-orm';

export interface BusinessRecordActivityData {
  id: string;
  tenantId: string;
  businessRecordId: string;
  activityType: string;
  subject: string;
  description: string;
  direction?: string;
  duration?: number;
  outcome?: string;
  nextAction?: string;
  followUpDate?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BusinessRecordActivityUpdater extends BaseUpdater {
  private activityTypes = {
    'call': 0.35,
    'email': 0.25,
    'meeting': 0.15,
    'demo': 0.10,
    'proposal': 0.05,
    'task': 0.05,
    'note': 0.05,
  };

  private callOutcomes = ['answered', 'no_answer', 'busy', 'voicemail'];
  private emailOutcomes = ['sent', 'opened', 'replied', 'bounced'];
  private meetingOutcomes = ['completed', 'no_show', 'rescheduled', 'cancelled'];
  private generalOutcomes = ['completed', 'in_progress', 'pending', 'cancelled'];

  private businessRecordIds: string[] = [];

  constructor(options: UpdaterOptions) {
    super('business_record_activities', options);
  }

  /**
   * Validate execution conditions
   */
  protected async validateExecution(): Promise<void> {
    // Fetch available business records for this tenant
    this.businessRecordIds = await this.fetchBusinessRecordIds();
    
    if (this.businessRecordIds.length === 0) {
      throw new Error('No business records found for tenant');
    }

    this.logger.debug(`Found ${this.businessRecordIds.length} business records for activities`);
  }

  /**
   * Generate realistic business record activities
   */
  protected async generateData(): Promise<BusinessRecordActivityData[]> {
    const activities: BusinessRecordActivityData[] = [];
    
    // Generate 1-3 activities per execution
    const activityCount = this.randomInRange(1, 3);
    
    for (let i = 0; i < activityCount; i++) {
      const activity = await this.generateSingleActivity();
      activities.push(activity);
    }

    return activities;
  }

  /**
   * Insert activities into database
   */
  protected async insertData(activities: BusinessRecordActivityData[]): Promise<number> {
    if (this.dryRun) {
      this.logger.info(`DRY RUN: Would insert ${activities.length} business record activities`);
      return activities.length;
    }

    try {
      // Insert activities in a transaction
      await db.transaction(async (tx) => {
        for (const activity of activities) {
          await tx.insert(businessRecordActivities).values({
            id: activity.id,
            tenantId: activity.tenantId,
            businessRecordId: activity.businessRecordId,
            activityType: activity.activityType,
            subject: activity.subject,
            description: activity.description,
            direction: activity.direction,
            callDuration: activity.duration,
            outcome: activity.outcome,
            nextAction: activity.nextAction,
            followUpDate: activity.followUpDate,
            createdBy: activity.createdBy,
            createdAt: activity.createdAt,
            updatedAt: activity.updatedAt,
          });
        }
      });

      this.logger.info(`Successfully inserted ${activities.length} business record activities`);
      return activities.length;
    } catch (error) {
      this.logger.error('Failed to insert business record activities', error);
      throw error;
    }
  }

  /**
   * Generate a single realistic activity
   */
  private async generateSingleActivity(): Promise<BusinessRecordActivityData> {
    const activityType = this.selectFromDistribution(this.activityTypes);
    const businessRecordId = this.randomFromArray(this.businessRecordIds);
    
    // Base activity data
    const activity: BusinessRecordActivityData = {
      id: this.generateUuid(),
      tenantId: this.tenantId,
      businessRecordId,
      activityType,
      subject: this.generateSubject(activityType),
      description: this.generateDescription(activityType),
      createdBy: 'system-user', // You might want to fetch actual user IDs
      createdAt: this.generateRecentBusinessDate(),
      updatedAt: new Date(),
    };

    // Add type-specific data
    switch (activityType) {
      case 'call':
        activity.direction = this.randomFromArray(['inbound', 'outbound']);
        activity.duration = this.randomInRange(2, 45); // 2-45 minutes
        activity.outcome = this.randomFromArray(this.callOutcomes);
        if (activity.outcome === 'answered') {
          activity.nextAction = this.generateCallNextAction();
          activity.followUpDate = this.generateFollowUpDate();
        }
        break;

      case 'email':
        activity.direction = this.randomFromArray(['inbound', 'outbound']);
        activity.outcome = this.randomFromArray(this.emailOutcomes);
        if (activity.outcome === 'replied') {
          activity.nextAction = 'Schedule follow-up call';
          activity.followUpDate = this.generateFollowUpDate();
        }
        break;

      case 'meeting':
        activity.duration = this.randomInRange(30, 120); // 30 minutes to 2 hours
        activity.outcome = this.randomFromArray(this.meetingOutcomes);
        if (activity.outcome === 'completed') {
          activity.nextAction = this.generateMeetingNextAction();
          activity.followUpDate = this.generateFollowUpDate();
        }
        break;

      case 'demo':
        activity.duration = this.randomInRange(45, 90); // 45-90 minutes
        activity.outcome = this.randomFromArray(['completed', 'technical_issues', 'rescheduled']);
        if (activity.outcome === 'completed') {
          activity.nextAction = 'Send proposal';
          activity.followUpDate = this.generateFollowUpDate(3); // 3 days out
        }
        break;

      case 'proposal':
        activity.outcome = this.randomFromArray(['sent', 'draft', 'approved', 'rejected']);
        if (activity.outcome === 'sent') {
          activity.nextAction = 'Follow up on proposal';
          activity.followUpDate = this.generateFollowUpDate(7); // 1 week out
        }
        break;

      default:
        activity.outcome = this.randomFromArray(this.generalOutcomes);
        if (activity.outcome === 'completed') {
          activity.nextAction = this.generateGeneralNextAction();
        }
    }

    return activity;
  }

  /**
   * Generate activity subject based on type
   */
  private generateSubject(activityType: string): string {
    const subjects = {
      call: [
        'Discovery call with prospect',
        'Follow-up call regarding copier needs',
        'Technical support call',
        'Pricing discussion',
        'Contract renewal discussion',
        'Service issue follow-up',
      ],
      email: [
        'Equipment proposal sent',
        'Monthly service reminder',
        'Welcome email to new customer',
        'Billing inquiry response',
        'Service appointment confirmation',
        'Product information request',
      ],
      meeting: [
        'On-site equipment assessment',
        'Contract negotiation meeting',
        'Quarterly business review',
        'Equipment demonstration',
        'Service planning session',
        'Budget planning meeting',
      ],
      demo: [
        'Canon imageRUNNER demonstration',
        'Xerox WorkCentre demo',
        'Multi-function printer showcase',
        'Print management software demo',
        'Large format printer demo',
        'Document workflow demonstration',
      ],
      proposal: [
        'Equipment lease proposal',
        'Service contract proposal',
        'Managed print services proposal',
        'Equipment upgrade proposal',
        'Cost reduction proposal',
        'Multi-location service proposal',
      ],
      task: [
        'Equipment delivery coordination',
        'Contract document preparation',
        'Service appointment scheduling',
        'Customer onboarding preparation',
        'Equipment configuration setup',
        'Follow-up task creation',
      ],
      note: [
        'Customer requirement notes',
        'Internal discussion summary',
        'Competitive analysis notes',
        'Service history update',
        'Account status update',
        'General customer information',
      ],
    };

    const typeSubjects = subjects[activityType as keyof typeof subjects] || subjects.note;
    return this.randomFromArray(typeSubjects);
  }

  /**
   * Generate activity description based on type
   */
  private generateDescription(activityType: string): string {
    const descriptions = {
      call: [
        'Discussed current printing needs and volume requirements. Customer interested in upgrading their current fleet.',
        'Customer called regarding service issues with Canon imageRUNNER. Scheduled technician visit.',
        'Follow-up call to discuss pricing proposal. Customer requested additional information.',
        'Discovery call revealed high printing volumes and need for managed print services.',
        'Customer expressed interest in color printing capabilities and finishing options.',
      ],
      email: [
        'Sent comprehensive equipment proposal including lease terms and service options.',
        'Responded to customer inquiry about service contract renewal options.',
        'Forwarded technical specifications for requested multifunction printer.',
        'Provided billing clarification and payment options for recent service call.',
        'Sent welcome package with account manager contact information.',
      ],
      meeting: [
        'Conducted on-site assessment of current equipment and workflow requirements.',
        'Reviewed quarterly service metrics and discussed optimization opportunities.',
        'Presented equipment demonstration focusing on productivity features.',
        'Negotiated contract terms and finalized service level agreements.',
        'Discussed budget planning for upcoming fiscal year equipment needs.',
      ],
      demo: [
        'Demonstrated advanced features including scan-to-email and mobile printing capabilities.',
        'Showcased document finishing options including stapling and hole punching.',
        'Highlighted security features and user authentication capabilities.',
        'Demonstrated cost-per-page savings compared to current equipment.',
        'Showed integration capabilities with existing document management systems.',
      ],
      proposal: [
        'Prepared comprehensive proposal including equipment specifications and pricing.',
        'Created customized service proposal based on customer requirements.',
        'Developed cost comparison analysis for managed print services.',
        'Drafted equipment upgrade proposal with trade-in value calculations.',
        'Prepared multi-year service contract with flexible terms.',
      ],
      task: [
        'Coordinated equipment delivery schedule with customer facilities team.',
        'Prepared contract documents for executive review and signature.',
        'Scheduled service appointment for preventive maintenance.',
        'Organized customer onboarding materials and training schedule.',
        'Set up follow-up reminders for proposal response deadline.',
      ],
      note: [
        'Customer prefers morning appointments and requires 24-hour advance notice.',
        'Facilities manager is key decision maker for equipment purchases.',
        'Company is planning office relocation in Q3, may affect equipment needs.',
        'Competitive situation with local dealer, price sensitivity noted.',
        'Strong relationship with IT department, good opportunity for expansion.',
      ],
    };

    const typeDescriptions = descriptions[activityType as keyof typeof descriptions] || descriptions.note;
    return this.randomFromArray(typeDescriptions);
  }

  /**
   * Generate call-specific next actions
   */
  private generateCallNextAction(): string {
    const actions = [
      'Schedule equipment demonstration',
      'Send detailed pricing proposal',
      'Follow up with technical specifications',
      'Schedule on-site assessment',
      'Connect with decision maker',
      'Provide references and case studies',
    ];
    return this.randomFromArray(actions);
  }

  /**
   * Generate meeting-specific next actions
   */
  private generateMeetingNextAction(): string {
    const actions = [
      'Prepare formal proposal',
      'Schedule technical demonstration',
      'Coordinate contract review',
      'Arrange financing options discussion',
      'Schedule follow-up meeting',
      'Provide implementation timeline',
    ];
    return this.randomFromArray(actions);
  }

  /**
   * Generate general next actions
   */
  private generateGeneralNextAction(): string {
    const actions = [
      'Schedule follow-up call',
      'Send additional information',
      'Coordinate with technical team',
      'Review contract terms',
      'Schedule next meeting',
      'Follow up on requirements',
    ];
    return this.randomFromArray(actions);
  }

  /**
   * Generate follow-up date
   */
  private generateFollowUpDate(daysOut = 0): Date {
    const date = new Date();
    const minDays = daysOut || this.randomInRange(1, 7);
    const maxDays = minDays + 7;
    const daysToAdd = this.randomInRange(minDays, maxDays);
    
    date.setDate(date.getDate() + daysToAdd);
    return this.generateBusinessHoursDate(daysToAdd);
  }

  /**
   * Generate recent business date (within last 7 days)
   */
  private generateRecentBusinessDate(): Date {
    const daysBack = this.randomInRange(0, 7);
    return this.generateBusinessHoursDate(-daysBack);
  }

  /**
   * Fetch business record IDs for the tenant
   */
  private async fetchBusinessRecordIds(): Promise<string[]> {
    try {
      const records = await db
        .select({ id: businessRecords.id })
        .from(businessRecords)
        .where(eq(businessRecords.tenantId, this.tenantId))
        .limit(50); // Limit to prevent too much data

      return records.map(record => record.id);
    } catch (error) {
      this.logger.error('Failed to fetch business record IDs', error);
      return [];
    }
  }
}

export default BusinessRecordActivityUpdater;
