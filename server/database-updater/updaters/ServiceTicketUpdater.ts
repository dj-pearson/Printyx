/**
 * Service Ticket Updater
 * Updates service_tickets table with realistic service requests
 */

import { BaseUpdater, UpdaterOptions } from '../core/BaseUpdater';
import { db } from '../../db';
import { serviceTickets, equipment } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';

export interface ServiceTicketData {
  id: string;
  tenantId: string;
  customerId: string;
  equipmentId?: string;
  ticketNumber: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assignedTechnicianId?: string;
  scheduledDate?: Date;
  estimatedDuration?: number;
  customerAddress?: string;
  customerPhone?: string;
  requiredSkills?: string[];
  requiredParts?: string[];
  workOrderNotes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ServiceTicketUpdater extends BaseUpdater {
  private priorities = {
    'low': 0.40,
    'medium': 0.35,
    'high': 0.20,
    'urgent': 0.05,
  };

  private statuses = {
    'open': 0.30,
    'assigned': 0.25,
    'in-progress': 0.25,
    'completed': 0.20,
  };

  private ticketCounter = 1000; // Starting ticket number
  private availableEquipmentIds: string[] = [];

  constructor(options: UpdaterOptions) {
    super('service_tickets', options);
    
    if (!options.customerId) {
      throw new Error('Service ticket updater requires customer ID');
    }
  }

  /**
   * Validate execution conditions
   */
  protected async validateExecution(): Promise<void> {
    // Fetch available equipment for this customer
    this.availableEquipmentIds = await this.fetchCustomerEquipmentIds();
    
    if (this.availableEquipmentIds.length === 0) {
      this.logger.warn('No equipment found for customer, will create tickets without equipment reference');
    }

    // Get next ticket number
    this.ticketCounter = await this.getNextTicketNumber();

    this.logger.debug(`Service ticket validation complete`, {
      equipmentCount: this.availableEquipmentIds.length,
      nextTicketNumber: this.ticketCounter,
    });
  }

  /**
   * Generate realistic service tickets
   */
  protected async generateData(): Promise<ServiceTicketData[]> {
    const tickets: ServiceTicketData[] = [];
    
    // Generate 1-2 service tickets per execution
    const ticketCount = this.randomInRange(1, 2);
    
    for (let i = 0; i < ticketCount; i++) {
      const ticket = await this.generateSingleTicket();
      tickets.push(ticket);
    }

    return tickets;
  }

  /**
   * Insert tickets into database
   */
  protected async insertData(tickets: ServiceTicketData[]): Promise<number> {
    if (this.dryRun) {
      this.logger.info(`DRY RUN: Would insert ${tickets.length} service tickets`);
      return tickets.length;
    }

    try {
      // Insert tickets in a transaction
      await db.transaction(async (tx) => {
        for (const ticket of tickets) {
          await tx.insert(serviceTickets).values({
            id: ticket.id,
            tenantId: ticket.tenantId,
            customerId: ticket.customerId,
            equipmentId: ticket.equipmentId,
            ticketNumber: ticket.ticketNumber,
            title: ticket.title,
            description: ticket.description,
            priority: ticket.priority,
            status: ticket.status,
            assignedTechnicianId: ticket.assignedTechnicianId,
            scheduledDate: ticket.scheduledDate,
            estimatedDuration: ticket.estimatedDuration,
            customerAddress: ticket.customerAddress,
            customerPhone: ticket.customerPhone,
            requiredSkills: ticket.requiredSkills,
            requiredParts: ticket.requiredParts,
            workOrderNotes: ticket.workOrderNotes,
            createdBy: ticket.createdBy,
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
          });
        }
      });

      this.logger.info(`Successfully inserted ${tickets.length} service tickets`);
      return tickets.length;
    } catch (error) {
      this.logger.error('Failed to insert service tickets', error);
      throw error;
    }
  }

  /**
   * Generate a single realistic service ticket
   */
  private async generateSingleTicket(): Promise<ServiceTicketData> {
    const priority = this.selectFromDistribution(this.priorities);
    const status = this.selectFromDistribution(this.statuses);
    const ticketType = this.selectTicketType();
    
    const ticket: ServiceTicketData = {
      id: this.generateUuid(),
      tenantId: this.tenantId,
      customerId: this.customerId!,
      ticketNumber: `ST-${this.ticketCounter++}`,
      title: this.generateTitle(ticketType),
      description: this.generateDescription(ticketType),
      priority,
      status,
      customerAddress: this.generateCustomerAddress(),
      customerPhone: this.generateCustomerPhone(),
      requiredSkills: this.generateRequiredSkills(ticketType),
      requiredParts: this.generateRequiredParts(ticketType),
      workOrderNotes: this.generateWorkOrderNotes(ticketType),
      createdBy: 'system-user', // You might want to fetch actual user IDs
      createdAt: this.generateRecentDate(),
      updatedAt: new Date(),
    };

    // Add equipment reference if available
    if (this.availableEquipmentIds.length > 0) {
      ticket.equipmentId = this.randomFromArray(this.availableEquipmentIds);
    }

    // Set schedule and duration based on status
    if (status === 'assigned' || status === 'in-progress') {
      ticket.scheduledDate = this.generateScheduledDate();
      ticket.estimatedDuration = this.generateEstimatedDuration(ticketType, priority);
      ticket.assignedTechnicianId = 'tech-user-1'; // You might want to fetch actual technician IDs
    }

    return ticket;
  }

  /**
   * Select ticket type based on common service scenarios
   */
  private selectTicketType(): string {
    const types = {
      'paper_jam': 0.20,
      'quality_issue': 0.15,
      'network_connectivity': 0.12,
      'preventive_maintenance': 0.10,
      'toner_replacement': 0.08,
      'drum_replacement': 0.08,
      'error_codes': 0.10,
      'user_training': 0.05,
      'software_issue': 0.07,
      'hardware_failure': 0.05,
    };

    return this.selectFromDistribution(types);
  }

  /**
   * Generate ticket title based on type
   */
  private generateTitle(ticketType: string): string {
    const titles = {
      paper_jam: [
        'Paper Jam Error Code J1',
        'Recurring Paper Jams in Tray 2',
        'Multiple Paper Jams - Main Tray',
        'Paper Feed Issue - Manual Tray',
        'Jam in Finisher Unit',
      ],
      quality_issue: [
        'Color Quality Issues',
        'Print Quality Degradation',
        'Streaking on Printed Documents',
        'Faded Print Output',
        'Uneven Color Distribution',
      ],
      network_connectivity: [
        'Network Connection Lost',
        'Cannot Print from Network',
        'Wireless Connectivity Issues',
        'IP Address Configuration Problem',
        'Print Queue Stuck',
      ],
      preventive_maintenance: [
        'Quarterly Preventive Maintenance',
        'Annual Service Inspection',
        'Monthly Maintenance Check',
        'Drum Unit Replacement PM',
        'Fuser Unit Maintenance',
      ],
      toner_replacement: [
        'Toner Cartridge Replacement',
        'Low Toner Warning',
        'Color Toner Empty',
        'Black Toner Replacement Needed',
        'Multiple Toner Cartridges Low',
      ],
      drum_replacement: [
        'Drum Unit Replacement Required',
        'Drum Life Warning',
        'Color Drum Units Near End',
        'Replace Drum Assembly',
        'Drum Unit Error Message',
      ],
      error_codes: [
        'Error Code E020 Displayed',
        'Scanner Error Code SC320',
        'Fuser Error E052',
        'Communication Error E110',
        'Memory Error E730',
      ],
      user_training: [
        'New User Training Request',
        'Advanced Features Training',
        'Scan to Email Setup',
        'Mobile Printing Setup',
        'Departmental Billing Training',
      ],
      software_issue: [
        'Print Driver Issues',
        'Scan Software Malfunction',
        'Mobile App Connectivity',
        'Document Management Integration',
        'Authentication Problems',
      ],
      hardware_failure: [
        'Scanner Unit Malfunction',
        'Finisher Not Working',
        'Display Panel Issues',
        'Paper Tray Mechanism Broken',
        'Automatic Document Feeder Jammed',
      ],
    };

    const typeTitles = titles[ticketType as keyof typeof titles] || titles.paper_jam;
    return this.randomFromArray(typeTitles);
  }

  /**
   * Generate detailed description based on ticket type
   */
  private generateDescription(ticketType: string): string {
    const descriptions = {
      paper_jam: [
        'Customer reports frequent paper jams occurring in the main paper tray. Error code J1 is displayed on the control panel. Jams happen approximately 3-4 times per day during normal printing operations.',
        'Multiple paper jams reported in Tray 2 over the past week. Customer indicates jams occur primarily with standard 20lb paper. Manual clearing required each time.',
        'Paper jam error in the finisher unit preventing proper document output. Customer unable to complete large print jobs due to consistent jamming in the stapling section.',
      ],
      quality_issue: [
        'Customer reports declining print quality with visible streaking on all printed documents. Issue affects both color and black & white printing. Quality degradation noticed over the past two weeks.',
        'Printed documents showing uneven color distribution and fading. Customer particularly concerned about marketing materials quality. Issue worse with glossy paper stock.',
        'Vertical lines appearing on all printed output. Customer reports issue started after recent high-volume print job. Both simplex and duplex printing affected.',
      ],
      network_connectivity: [
        'Equipment suddenly lost network connectivity yesterday. Customer unable to print from any networked computers. Local IT team unable to resolve. Static IP configuration appears correct.',
        'Wireless printing functionality stopped working after recent network infrastructure changes. Wired connections still functional. Customer needs wireless restored for mobile users.',
        'Print jobs getting stuck in queue and not processing. Network connection appears stable but communication with print server intermittent.',
      ],
      preventive_maintenance: [
        'Quarterly preventive maintenance service due. Customer requests standard cleaning, calibration, and parts inspection. Equipment has been running normally with no current issues.',
        'Annual comprehensive service inspection required per service contract. Include full diagnostic, parts replacement as needed, and software updates.',
        'Monthly maintenance check requested by customer. Focus on high-usage areas and verify all consumable levels.',
      ],
      toner_replacement: [
        'Black toner cartridge showing low warning for past week. Customer requests replacement and wants to understand optimal timing for future orders.',
        'Multiple color toner cartridges (Cyan, Magenta) indicating low levels. Customer expects high-volume color printing next week and wants preemptive replacement.',
        'Toner cartridge replacement needed. Customer reports quality beginning to fade and wants service before important presentation materials are printed.',
      ],
      drum_replacement: [
        'Drum unit warning message appeared on control panel. Customer reports print quality still acceptable but wants proactive replacement to avoid downtime.',
        'Color drum units showing wear indicators. Customer notes slight color shifting in recent prints and wants replacement before quality degrades further.',
        'Drum life indicator showing red warning. Customer experiencing occasional light spots on printed documents.',
      ],
      error_codes: [
        'Error code E020 appearing intermittently on display panel. Customer able to clear error and continue printing but code returns after several hours of operation.',
        'Scanner error SC320 preventing all scan operations. Customer unable to use copy, scan to email, or document storage functions. Printing still works normally.',
        'Fuser error E052 causing equipment to shut down. Customer reports normal operation until error appears, then complete shutdown. Manual restart required.',
      ],
      user_training: [
        'New office manager needs comprehensive training on equipment operation. Focus on departmental billing setup, scan to email configuration, and basic troubleshooting.',
        'Customer requesting advanced features training for administrative staff. Include mobile printing setup, secure printing, and document workflow optimization.',
        'Multiple new employees need basic operation training. Customer prefers group session covering copy, scan, and print functions.',
      ],
      software_issue: [
        'Print driver causing intermittent print job failures on Windows 10 workstations. Customer reports jobs appear to process but no output produced.',
        'Scan to email function stopped working after recent email server migration. Customer needs reconfiguration for new SMTP settings.',
        'Mobile printing app connectivity issues reported by multiple users. Authentication appears successful but print jobs not processing.',
      ],
      hardware_failure: [
        'Automatic Document Feeder (ADF) not feeding documents properly. Customer reports documents jam frequently and scan quality poor when ADF used.',
        'Display panel showing flickering and occasional blank screen. Customer able to operate using mobile app but prefers panel functionality restored.',
        'Finisher stapling unit not functioning. Customer reports documents output normally but stapling mechanism not engaging.',
      ],
    };

    const typeDescriptions = descriptions[ticketType as keyof typeof descriptions] || descriptions.paper_jam;
    return this.randomFromArray(typeDescriptions);
  }

  /**
   * Generate required skills based on ticket type
   */
  private generateRequiredSkills(ticketType: string): string[] {
    const skillSets = {
      paper_jam: ['mechanical_repair', 'paper_path_troubleshooting'],
      quality_issue: ['print_quality_diagnostics', 'color_calibration', 'mechanical_repair'],
      network_connectivity: ['network_troubleshooting', 'tcp_ip_configuration'],
      preventive_maintenance: ['general_maintenance', 'mechanical_repair', 'electrical_systems'],
      toner_replacement: ['consumables_replacement', 'basic_maintenance'],
      drum_replacement: ['consumables_replacement', 'mechanical_repair'],
      error_codes: ['diagnostic_troubleshooting', 'mechanical_repair', 'electrical_systems'],
      user_training: ['customer_training', 'software_configuration'],
      software_issue: ['software_troubleshooting', 'network_configuration'],
      hardware_failure: ['advanced_mechanical_repair', 'electrical_systems', 'component_replacement'],
    };

    return skillSets[ticketType as keyof typeof skillSets] || ['general_maintenance'];
  }

  /**
   * Generate required parts based on ticket type
   */
  private generateRequiredParts(ticketType: string): string[] {
    const partSets = {
      paper_jam: ['pickup_rollers', 'separation_pads'],
      quality_issue: ['drum_unit', 'developer_unit'],
      network_connectivity: [],
      preventive_maintenance: ['pickup_rollers', 'separation_pads', 'waste_toner_box'],
      toner_replacement: ['toner_cartridge_black', 'toner_cartridge_color'],
      drum_replacement: ['drum_unit', 'waste_toner_box'],
      error_codes: ['fuser_unit', 'transfer_belt'],
      user_training: [],
      software_issue: [],
      hardware_failure: ['adf_mechanism', 'display_panel', 'finisher_stapler'],
    };

    return partSets[ticketType as keyof typeof partSets] || [];
  }

  /**
   * Generate work order notes
   */
  private generateWorkOrderNotes(ticketType: string): string {
    const notes = [
      'Customer prefers morning appointments between 9-11 AM',
      'Facilities contact: John Smith (ext. 2345) for building access',
      'Equipment located on 3rd floor, northeast corner',
      'Customer requests advance call 30 minutes before arrival',
      'Parking available in visitor lot, check in at front desk',
      'High-priority customer, expedite service if possible',
    ];

    return this.randomFromArray(notes);
  }

  /**
   * Generate customer address
   */
  private generateCustomerAddress(): string {
    const addresses = [
      '1234 Business Park Dr, Suite 100, City, ST 12345',
      '5678 Corporate Blvd, Building A, City, ST 12345',
      '9012 Industrial Way, Floor 2, City, ST 12345',
      '3456 Office Plaza, Suite 250, City, ST 12345',
      '7890 Technology Center, Building C, City, ST 12345',
    ];

    return this.randomFromArray(addresses);
  }

  /**
   * Generate customer phone
   */
  private generateCustomerPhone(): string {
    const area = this.randomInRange(200, 999);
    const exchange = this.randomInRange(200, 999);
    const number = this.randomInRange(1000, 9999);
    
    return `(${area}) ${exchange}-${number}`;
  }

  /**
   * Generate scheduled date (1-3 business days out)
   */
  private generateScheduledDate(): Date {
    const daysOut = this.randomInRange(1, 3);
    return this.generateBusinessHoursDate(daysOut);
  }

  /**
   * Generate estimated duration based on ticket type and priority
   */
  private generateEstimatedDuration(ticketType: string, priority: string): number {
    const baseDurations = {
      paper_jam: 60,
      quality_issue: 90,
      network_connectivity: 45,
      preventive_maintenance: 120,
      toner_replacement: 30,
      drum_replacement: 60,
      error_codes: 75,
      user_training: 90,
      software_issue: 60,
      hardware_failure: 180,
    };

    let duration = baseDurations[ticketType as keyof typeof baseDurations] || 60;

    // Adjust based on priority
    if (priority === 'urgent') {
      duration = Math.round(duration * 0.8); // Faster service
    } else if (priority === 'low') {
      duration = Math.round(duration * 1.2); // Allow more time
    }

    return duration;
  }

  /**
   * Generate recent date (within last 3 days)
   */
  private generateRecentDate(): Date {
    const daysBack = this.randomInRange(0, 3);
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    
    // Set random business hour
    const hour = this.randomInRange(8, 17);
    const minute = this.randomInRange(0, 59);
    date.setHours(hour, minute, 0, 0);
    
    return date;
  }

  /**
   * Get next available ticket number
   */
  private async getNextTicketNumber(): Promise<number> {
    try {
      // Get the latest ticket number for this tenant
      const latestTicket = await db
        .select({ ticketNumber: serviceTickets.ticketNumber })
        .from(serviceTickets)
        .where(eq(serviceTickets.tenantId, this.tenantId))
        .orderBy(serviceTickets.createdAt)
        .limit(1);

      if (latestTicket.length > 0) {
        // Extract number from format "ST-1234"
        const match = latestTicket[0].ticketNumber.match(/ST-(\d+)/);
        if (match) {
          return parseInt(match[1]) + 1;
        }
      }

      return 1000; // Default starting number
    } catch (error) {
      this.logger.error('Failed to get next ticket number', error);
      return 1000;
    }
  }

  /**
   * Fetch customer equipment IDs
   */
  private async fetchCustomerEquipmentIds(): Promise<string[]> {
    try {
      const equipmentRecords = await db
        .select({ id: equipment.id })
        .from(equipment)
        .where(
          and(
            eq(equipment.tenantId, this.tenantId),
            eq(equipment.customerId, this.customerId!)
          )
        )
        .limit(20);

      return equipmentRecords.map(record => record.id);
    } catch (error) {
      this.logger.error('Failed to fetch customer equipment IDs', error);
      return [];
    }
  }
}

export default ServiceTicketUpdater;
