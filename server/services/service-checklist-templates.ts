/**
 * Service Checklist Templates
 *
 * Pre-built checklist templates for common copier/printer service scenarios
 * Ensures consistent service quality and reduces callbacks
 */

export interface ChecklistItem {
  id: string;
  category: string;
  task: string;
  required: boolean;
  orderIndex: number;
  helpText?: string;
}

export interface ServiceChecklistTemplate {
  id: string;
  name: string;
  description: string;
  serviceType: string;
  estimatedTime: number; // minutes
  items: ChecklistItem[];
}

// Standard PM Checklist
export const preventiveMaintenanceTemplate: ServiceChecklistTemplate = {
  id: 'pm-standard',
  name: 'Standard Preventive Maintenance',
  description: 'Comprehensive preventive maintenance checklist for copiers and printers',
  serviceType: 'preventive_maintenance',
  estimatedTime: 45,
  items: [
    {
      id: 'pm-1',
      category: 'Inspection',
      task: 'Check meter reading and record',
      required: true,
      orderIndex: 1,
      helpText: 'Record total page count from device display',
    },
    {
      id: 'pm-2',
      category: 'Inspection',
      task: 'Inspect paper feed rollers for wear',
      required: true,
      orderIndex: 2,
      helpText: 'Look for cracks, flat spots, or excessive wear',
    },
    {
      id: 'pm-3',
      category: 'Inspection',
      task: 'Check all paper trays for damage',
      required: true,
      orderIndex: 3,
    },
    {
      id: 'pm-4',
      category: 'Cleaning',
      task: 'Clean imaging drum or belt',
      required: true,
      orderIndex: 4,
      helpText: 'Use manufacturer-approved cleaning materials',
    },
    {
      id: 'pm-5',
      category: 'Cleaning',
      task: 'Clean fuser assembly',
      required: true,
      orderIndex: 5,
      helpText: 'Allow fuser to cool before cleaning',
    },
    {
      id: 'pm-6',
      category: 'Cleaning',
      task: 'Clean scanner glass and cover',
      required: true,
      orderIndex: 6,
    },
    {
      id: 'pm-7',
      category: 'Replacement',
      task: 'Replace feed rollers (if due)',
      required: false,
      orderIndex: 7,
      helpText: 'Check service manual for replacement intervals',
    },
    {
      id: 'pm-8',
      category: 'Replacement',
      task: 'Replace separation pad (if due)',
      required: false,
      orderIndex: 8,
    },
    {
      id: 'pm-9',
      category: 'Testing',
      task: 'Run test print - check quality',
      required: true,
      orderIndex: 9,
      helpText: 'Print diagnostic page and verify quality',
    },
    {
      id: 'pm-10',
      category: 'Testing',
      task: 'Test scan function',
      required: true,
      orderIndex: 10,
    },
    {
      id: 'pm-11',
      category: 'Testing',
      task: 'Test copy function',
      required: true,
      orderIndex: 11,
    },
    {
      id: 'pm-12',
      category: 'Testing',
      task: 'Verify network connectivity',
      required: true,
      orderIndex: 12,
    },
    {
      id: 'pm-13',
      category: 'Final',
      task: 'Clean exterior and glass',
      required: true,
      orderIndex: 13,
    },
    {
      id: 'pm-14',
      category: 'Final',
      task: 'Update maintenance sticker with date and meter',
      required: true,
      orderIndex: 14,
    },
    {
      id: 'pm-15',
      category: 'Final',
      task: 'Brief customer on findings and recommendations',
      required: true,
      orderIndex: 15,
    },
  ],
};

// Toner Replacement Checklist
export const tonerReplacementTemplate: ServiceChecklistTemplate = {
  id: 'toner-replacement',
  name: 'Toner Cartridge Replacement',
  description: 'Quick toner replacement service with quality verification',
  serviceType: 'toner_replacement',
  estimatedTime: 15,
  items: [
    {
      id: 'toner-1',
      category: 'Preparation',
      task: 'Verify correct toner part number',
      required: true,
      orderIndex: 1,
      helpText: 'Match part number to device model',
    },
    {
      id: 'toner-2',
      category: 'Preparation',
      task: 'Check toner inventory and expiration date',
      required: true,
      orderIndex: 2,
    },
    {
      id: 'toner-3',
      category: 'Removal',
      task: 'Remove old toner cartridge safely',
      required: true,
      orderIndex: 3,
      helpText: 'Avoid toner spills - use protective covering',
    },
    {
      id: 'toner-4',
      category: 'Removal',
      task: 'Inspect imaging drum for damage',
      required: true,
      orderIndex: 4,
      helpText: 'Look for scratches or worn areas',
    },
    {
      id: 'toner-5',
      category: 'Installation',
      task: 'Shake new toner cartridge gently',
      required: true,
      orderIndex: 5,
      helpText: 'Distribute toner evenly inside cartridge',
    },
    {
      id: 'toner-6',
      category: 'Installation',
      task: 'Remove all protective seals/tape from new cartridge',
      required: true,
      orderIndex: 6,
    },
    {
      id: 'toner-7',
      category: 'Installation',
      task: 'Install new toner cartridge securely',
      required: true,
      orderIndex: 7,
    },
    {
      id: 'toner-8',
      category: 'Testing',
      task: 'Reset toner counter (if required)',
      required: false,
      orderIndex: 8,
      helpText: 'Some models require manual counter reset',
    },
    {
      id: 'toner-9',
      category: 'Testing',
      task: 'Print test page',
      required: true,
      orderIndex: 9,
      helpText: 'Check for consistent density and no streaks',
    },
    {
      id: 'toner-10',
      category: 'Testing',
      task: 'Verify no error messages on display',
      required: true,
      orderIndex: 10,
    },
    {
      id: 'toner-11',
      category: 'Final',
      task: 'Clean any toner spills',
      required: true,
      orderIndex: 11,
    },
    {
      id: 'toner-12',
      category: 'Final',
      task: 'Record part number and serial in system',
      required: true,
      orderIndex: 12,
    },
  ],
};

// Paper Jam Troubleshooting
export const paperJamTemplate: ServiceChecklistTemplate = {
  id: 'paper-jam-fix',
  name: 'Paper Jam Troubleshooting',
  description: 'Comprehensive checklist for resolving paper jam issues',
  serviceType: 'repair',
  estimatedTime: 30,
  items: [
    {
      id: 'jam-1',
      category: 'Diagnosis',
      task: 'Note jam location code from display',
      required: true,
      orderIndex: 1,
    },
    {
      id: 'jam-2',
      category: 'Diagnosis',
      task: 'Check for recurring jam pattern',
      required: true,
      orderIndex: 2,
      helpText: 'Ask customer if jams occur in same location',
    },
    {
      id: 'jam-3',
      category: 'Clearing',
      task: 'Open all access doors and clear visible paper',
      required: true,
      orderIndex: 3,
      helpText: 'Pull paper in direction of paper path',
    },
    {
      id: 'jam-4',
      category: 'Clearing',
      task: 'Check fuser area for torn paper bits',
      required: true,
      orderIndex: 4,
    },
    {
      id: 'jam-5',
      category: 'Inspection',
      task: 'Inspect paper feed rollers for wear or debris',
      required: true,
      orderIndex: 5,
    },
    {
      id: 'jam-6',
      category: 'Inspection',
      task: 'Check separation pad condition',
      required: true,
      orderIndex: 6,
    },
    {
      id: 'jam-7',
      category: 'Inspection',
      task: 'Examine paper guides in trays for damage',
      required: true,
      orderIndex: 7,
    },
    {
      id: 'jam-8',
      category: 'Inspection',
      task: 'Check paper type and quality',
      required: true,
      orderIndex: 8,
      helpText: 'Verify paper meets manufacturer specifications',
    },
    {
      id: 'jam-9',
      category: 'Repair',
      task: 'Clean or replace feed rollers if worn',
      required: false,
      orderIndex: 9,
    },
    {
      id: 'jam-10',
      category: 'Repair',
      task: 'Replace separation pad if worn',
      required: false,
      orderIndex: 10,
    },
    {
      id: 'jam-11',
      category: 'Testing',
      task: 'Run 10-20 test copies',
      required: true,
      orderIndex: 11,
      helpText: 'Test with various paper sizes',
    },
    {
      id: 'jam-12',
      category: 'Testing',
      task: 'Test duplex printing (if equipped)',
      required: false,
      orderIndex: 12,
    },
    {
      id: 'jam-13',
      category: 'Final',
      task: 'Educate customer on proper paper loading',
      required: true,
      orderIndex: 13,
    },
    {
      id: 'jam-14',
      category: 'Final',
      task: 'Document root cause in ticket notes',
      required: true,
      orderIndex: 14,
    },
  ],
};

// Installation Checklist
export const installationTemplate: ServiceChecklistTemplate = {
  id: 'equipment-install',
  name: 'Equipment Installation',
  description: 'Complete installation checklist for new equipment',
  serviceType: 'installation',
  estimatedTime: 60,
  items: [
    {
      id: 'install-1',
      category: 'Pre-Installation',
      task: 'Verify equipment location with customer',
      required: true,
      orderIndex: 1,
    },
    {
      id: 'install-2',
      category: 'Pre-Installation',
      task: 'Check electrical outlet and voltage',
      required: true,
      orderIndex: 2,
      helpText: 'Verify dedicated circuit if required',
    },
    {
      id: 'install-3',
      category: 'Pre-Installation',
      task: 'Confirm network connection availability',
      required: true,
      orderIndex: 3,
    },
    {
      id: 'install-4',
      category: 'Unpacking',
      task: 'Inspect shipping box for damage',
      required: true,
      orderIndex: 4,
    },
    {
      id: 'install-5',
      category: 'Unpacking',
      task: 'Remove all packing materials and protective tape',
      required: true,
      orderIndex: 5,
      helpText: 'Check service manual for all tape locations',
    },
    {
      id: 'install-6',
      category: 'Setup',
      task: 'Install imaging drums and toner',
      required: true,
      orderIndex: 6,
    },
    {
      id: 'install-7',
      category: 'Setup',
      task: 'Load paper in all trays',
      required: true,
      orderIndex: 7,
    },
    {
      id: 'install-8',
      category: 'Setup',
      task: 'Power on device and complete initialization',
      required: true,
      orderIndex: 8,
    },
    {
      id: 'install-9',
      category: 'Configuration',
      task: 'Configure network settings (IP, subnet, gateway)',
      required: true,
      orderIndex: 9,
    },
    {
      id: 'install-10',
      category: 'Configuration',
      task: 'Set date, time, and location info',
      required: true,
      orderIndex: 10,
    },
    {
      id: 'install-11',
      category: 'Configuration',
      task: 'Configure scan destinations (email/SMB)',
      required: false,
      orderIndex: 11,
    },
    {
      id: 'install-12',
      category: 'Testing',
      task: 'Print configuration page',
      required: true,
      orderIndex: 12,
    },
    {
      id: 'install-13',
      category: 'Testing',
      task: 'Test print from network computer',
      required: true,
      orderIndex: 13,
    },
    {
      id: 'install-14',
      category: 'Testing',
      task: 'Test scan to email',
      required: false,
      orderIndex: 14,
    },
    {
      id: 'install-15',
      category: 'Testing',
      task: 'Test copy function',
      required: true,
      orderIndex: 15,
    },
    {
      id: 'install-16',
      category: 'Training',
      task: 'Train customer on basic operation',
      required: true,
      orderIndex: 16,
    },
    {
      id: 'install-17',
      category: 'Training',
      task: 'Show customer how to load paper and clear jams',
      required: true,
      orderIndex: 17,
    },
    {
      id: 'install-18',
      category: 'Final',
      task: 'Provide customer with user manual',
      required: true,
      orderIndex: 18,
    },
    {
      id: 'install-19',
      category: 'Final',
      task: 'Complete installation documentation',
      required: true,
      orderIndex: 19,
    },
    {
      id: 'install-20',
      category: 'Final',
      task: 'Get customer signature on installation form',
      required: true,
      orderIndex: 20,
    },
  ],
};

// Network Troubleshooting
export const networkTroubleshootingTemplate: ServiceChecklistTemplate = {
  id: 'network-troubleshoot',
  name: 'Network Connectivity Troubleshooting',
  description: 'Systematic network issue diagnosis and resolution',
  serviceType: 'repair',
  estimatedTime: 30,
  items: [
    {
      id: 'net-1',
      category: 'Basic Checks',
      task: 'Verify physical network cable connection',
      required: true,
      orderIndex: 1,
    },
    {
      id: 'net-2',
      category: 'Basic Checks',
      task: 'Check link lights on network port',
      required: true,
      orderIndex: 2,
    },
    {
      id: 'net-3',
      category: 'Basic Checks',
      task: 'Print network configuration page',
      required: true,
      orderIndex: 3,
    },
    {
      id: 'net-4',
      category: 'Diagnosis',
      task: 'Verify IP address is on correct subnet',
      required: true,
      orderIndex: 4,
    },
    {
      id: 'net-5',
      category: 'Diagnosis',
      task: 'Check for IP address conflicts',
      required: true,
      orderIndex: 5,
    },
    {
      id: 'net-6',
      category: 'Diagnosis',
      task: 'Ping device from computer',
      required: true,
      orderIndex: 6,
      helpText: 'Use command: ping [device-ip]',
    },
    {
      id: 'net-7',
      category: 'Diagnosis',
      task: 'Test with different network cable',
      required: false,
      orderIndex: 7,
    },
    {
      id: 'net-8',
      category: 'Resolution',
      task: 'Reconfigure IP settings if needed',
      required: false,
      orderIndex: 8,
    },
    {
      id: 'net-9',
      category: 'Resolution',
      task: 'Update firmware if outdated',
      required: false,
      orderIndex: 9,
    },
    {
      id: 'net-10',
      category: 'Testing',
      task: 'Test print from multiple computers',
      required: true,
      orderIndex: 10,
    },
    {
      id: 'net-11',
      category: 'Testing',
      task: 'Verify scan to network folder works',
      required: false,
      orderIndex: 11,
    },
    {
      id: 'net-12',
      category: 'Final',
      task: 'Document network settings in ticket',
      required: true,
      orderIndex: 12,
    },
  ],
};

// Export all templates
export const SERVICE_CHECKLIST_TEMPLATES: ServiceChecklistTemplate[] = [
  preventiveMaintenanceTemplate,
  tonerReplacementTemplate,
  paperJamTemplate,
  installationTemplate,
  networkTroubleshootingTemplate,
];

// Helper function to get template by ID
export function getTemplateById(templateId: string): ServiceChecklistTemplate | undefined {
  return SERVICE_CHECKLIST_TEMPLATES.find((t) => t.id === templateId);
}

// Helper function to get templates by service type
export function getTemplatesByServiceType(serviceType: string): ServiceChecklistTemplate[] {
  return SERVICE_CHECKLIST_TEMPLATES.filter((t) => t.serviceType === serviceType);
}
