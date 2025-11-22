import { db } from './db';
import { oidMappings } from '@shared/printyx-client-schema';
import { eq, and } from 'drizzle-orm';

/**
 * Seed default OID mappings for common printer manufacturers
 * Based on standard Printer MIB (RFC 3805) and vendor-specific MIBs
 */

const defaultOidMappings = [
  {
    manufacturer: 'Canon',
    modelSeries: 'imageRUNNER ADVANCE',
    mappingName: 'Canon imageRUNNER ADVANCE Standard',
    description:
      'Standard OID mapping for Canon imageRUNNER ADVANCE series copiers. Includes total counter, color counter, B&W counter, and toner levels.',
    isDefault: true,
    oids: {
      // Device information
      deviceSerialNumber: '1.3.6.1.2.1.43.5.1.1.17.1',
      deviceManufacturer: '1.3.6.1.2.1.43.8.2.1.14.1.1',
      deviceModel: '1.3.6.1.2.1.43.5.1.1.16.1',
      sysDescr: '1.3.6.1.2.1.1.1.0',
      sysName: '1.3.6.1.2.1.1.5.0',

      // Canon-specific meter readings
      totalCounter: '1.3.6.1.4.1.1602.1.11.1.3.1.4.101',
      bwCounter: '1.3.6.1.4.1.1602.1.11.1.3.1.4.102',
      colorCounter: '1.3.6.1.4.1.1602.1.11.1.3.1.4.103',

      // Toner levels (Marker supplies from Printer MIB)
      markerSupplyCurrentLevel: '1.3.6.1.2.1.43.11.1.1.9.1',
      markerSupplyMaxCapacity: '1.3.6.1.2.1.43.11.1.1.8.1',
      markerSupplyDescription: '1.3.6.1.2.1.43.11.1.1.6.1',

      // Paper levels
      inputCurrentLevel: '1.3.6.1.2.1.43.8.2.1.10.1',
      inputMaxCapacity: '1.3.6.1.2.1.43.8.2.1.9.1',
    },
  },
  {
    manufacturer: 'Canon',
    modelSeries: null,
    mappingName: 'Canon Generic (Printer MIB)',
    description:
      'Generic Canon printer support using standard Printer MIB (RFC 3805). Compatible with most Canon devices.',
    isDefault: false,
    oids: {
      deviceSerialNumber: '1.3.6.1.2.1.43.5.1.1.17.1',
      deviceManufacturer: '1.3.6.1.2.1.43.8.2.1.14.1.1',
      deviceModel: '1.3.6.1.2.1.43.5.1.1.16.1',
      sysDescr: '1.3.6.1.2.1.1.1.0',
      sysName: '1.3.6.1.2.1.1.5.0',
      totalPrinted: '1.3.6.1.2.1.43.10.2.1.4.1.1',
      markerSupplyCurrentLevel: '1.3.6.1.2.1.43.11.1.1.9.1',
      markerSupplyMaxCapacity: '1.3.6.1.2.1.43.11.1.1.8.1',
      markerSupplyDescription: '1.3.6.1.2.1.43.11.1.1.6.1',
      inputCurrentLevel: '1.3.6.1.2.1.43.8.2.1.10.1',
      inputMaxCapacity: '1.3.6.1.2.1.43.8.2.1.9.1',
    },
  },
  {
    manufacturer: 'Xerox',
    modelSeries: 'VersaLink/AltaLink',
    mappingName: 'Xerox VersaLink/AltaLink Standard',
    description:
      'Standard OID mapping for Xerox VersaLink and AltaLink series. Includes Xerox-specific meter readings and supply levels.',
    isDefault: true,
    oids: {
      deviceSerialNumber: '1.3.6.1.2.1.43.5.1.1.17.1',
      deviceManufacturer: '1.3.6.1.2.1.43.8.2.1.14.1.1',
      deviceModel: '1.3.6.1.2.1.43.5.1.1.16.1',
      sysDescr: '1.3.6.1.2.1.1.1.0',
      sysName: '1.3.6.1.2.1.1.5.0',

      // Xerox-specific meter readings
      totalCounter: '1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.1',
      bwCounter: '1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.33',
      colorCounter: '1.3.6.1.4.1.253.8.53.13.2.1.6.1.20.34',

      // Toner levels
      markerSupplyCurrentLevel: '1.3.6.1.2.1.43.11.1.1.9.1',
      markerSupplyMaxCapacity: '1.3.6.1.2.1.43.11.1.1.8.1',
      markerSupplyDescription: '1.3.6.1.2.1.43.11.1.1.6.1',

      // Paper levels
      inputCurrentLevel: '1.3.6.1.2.1.43.8.2.1.10.1',
      inputMaxCapacity: '1.3.6.1.2.1.43.8.2.1.9.1',
    },
  },
  {
    manufacturer: 'HP',
    modelSeries: 'LaserJet',
    mappingName: 'HP LaserJet Standard',
    description:
      'Standard OID mapping for HP LaserJet series printers. Includes HP-specific meter readings and supply levels.',
    isDefault: true,
    oids: {
      deviceSerialNumber: '1.3.6.1.4.1.11.2.3.9.4.2.1.1.3.3.0',
      deviceManufacturer: '1.3.6.1.2.1.43.8.2.1.14.1.1',
      deviceModel: '1.3.6.1.2.1.43.5.1.1.16.1',
      sysDescr: '1.3.6.1.2.1.1.1.0',
      sysName: '1.3.6.1.2.1.1.5.0',

      // HP-specific meter readings
      totalCounter: '1.3.6.1.4.1.11.2.3.9.4.2.1.4.1.2.6.0',

      // Toner levels
      markerSupplyCurrentLevel: '1.3.6.1.2.1.43.11.1.1.9.1',
      markerSupplyMaxCapacity: '1.3.6.1.2.1.43.11.1.1.8.1',
      markerSupplyDescription: '1.3.6.1.2.1.43.11.1.1.6.1',

      // Paper levels
      inputCurrentLevel: '1.3.6.1.2.1.43.8.2.1.10.1',
      inputMaxCapacity: '1.3.6.1.2.1.43.8.2.1.9.1',
    },
  },
  {
    manufacturer: 'Ricoh',
    modelSeries: null,
    mappingName: 'Ricoh Standard',
    description:
      'Standard OID mapping for Ricoh copiers and printers. Includes Ricoh-specific meter readings.',
    isDefault: true,
    oids: {
      deviceSerialNumber: '1.3.6.1.4.1.367.3.2.1.2.1.4.0',
      deviceManufacturer: '1.3.6.1.2.1.43.8.2.1.14.1.1',
      deviceModel: '1.3.6.1.2.1.43.5.1.1.16.1',
      sysDescr: '1.3.6.1.2.1.1.1.0',
      sysName: '1.3.6.1.2.1.1.5.0',

      // Ricoh-specific meter readings
      totalCounter: '1.3.6.1.4.1.367.3.2.1.2.19.5.1.5.1',

      // Toner levels
      markerSupplyCurrentLevel: '1.3.6.1.2.1.43.11.1.1.9.1',
      markerSupplyMaxCapacity: '1.3.6.1.2.1.43.11.1.1.8.1',
      markerSupplyDescription: '1.3.6.1.2.1.43.11.1.1.6.1',

      // Paper levels
      inputCurrentLevel: '1.3.6.1.2.1.43.8.2.1.10.1',
      inputMaxCapacity: '1.3.6.1.2.1.43.8.2.1.9.1',
    },
  },
  {
    manufacturer: 'Konica Minolta',
    modelSeries: 'bizhub',
    mappingName: 'Konica Minolta bizhub Standard',
    description: 'Standard OID mapping for Konica Minolta bizhub series copiers.',
    isDefault: true,
    oids: {
      deviceSerialNumber: '1.3.6.1.2.1.43.5.1.1.17.1',
      deviceManufacturer: '1.3.6.1.2.1.43.8.2.1.14.1.1',
      deviceModel: '1.3.6.1.2.1.43.5.1.1.16.1',
      sysDescr: '1.3.6.1.2.1.1.1.0',
      sysName: '1.3.6.1.2.1.1.5.0',

      // Generic Printer MIB counter
      totalPrinted: '1.3.6.1.2.1.43.10.2.1.4.1.1',

      // Toner levels
      markerSupplyCurrentLevel: '1.3.6.1.2.1.43.11.1.1.9.1',
      markerSupplyMaxCapacity: '1.3.6.1.2.1.43.11.1.1.8.1',
      markerSupplyDescription: '1.3.6.1.2.1.43.11.1.1.6.1',

      // Paper levels
      inputCurrentLevel: '1.3.6.1.2.1.43.8.2.1.10.1',
      inputMaxCapacity: '1.3.6.1.2.1.43.8.2.1.9.1',
    },
  },
  {
    manufacturer: 'Generic',
    modelSeries: null,
    mappingName: 'Generic Printer MIB (RFC 3805)',
    description:
      'Generic printer support using standard Printer MIB (RFC 3805). Compatible with most SNMP-enabled printers.',
    isDefault: true,
    oids: {
      deviceSerialNumber: '1.3.6.1.2.1.43.5.1.1.17.1',
      deviceManufacturer: '1.3.6.1.2.1.43.8.2.1.14.1.1',
      deviceModel: '1.3.6.1.2.1.43.5.1.1.16.1',
      deviceStatus: '1.3.6.1.2.1.25.3.2.1.5.1',
      sysDescr: '1.3.6.1.2.1.1.1.0',
      sysName: '1.3.6.1.2.1.1.5.0',

      // Meter readings
      totalPrinted: '1.3.6.1.2.1.43.10.2.1.4.1.1',

      // Toner levels (marker supplies)
      markerSupplyType: '1.3.6.1.2.1.43.11.1.1.6.1',
      markerSupplyDescription: '1.3.6.1.2.1.43.11.1.1.6.1',
      markerSupplyMaxCapacity: '1.3.6.1.2.1.43.11.1.1.8.1',
      markerSupplyCurrentLevel: '1.3.6.1.2.1.43.11.1.1.9.1',
      markerSupplyColorantValue: '1.3.6.1.2.1.43.12.1.1.4.1',

      // Paper levels (input trays)
      inputType: '1.3.6.1.2.1.43.8.2.1.2.1',
      inputCurrentLevel: '1.3.6.1.2.1.43.8.2.1.10.1',
      inputMaxCapacity: '1.3.6.1.2.1.43.8.2.1.9.1',
    },
  },
];

export async function seedOidMappings() {
  console.log('Starting OID mappings seed...');

  for (const mapping of defaultOidMappings) {
    try {
      // Check if mapping already exists
      const existing = await db
        .select()
        .from(oidMappings)
        .where(
          and(
            eq(oidMappings.manufacturer, mapping.manufacturer),
            eq(oidMappings.mappingName, mapping.mappingName),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(
          `  ✓ Skipping existing mapping: ${mapping.manufacturer} - ${mapping.mappingName}`,
        );
        continue;
      }

      // Create new mapping
      await db.insert(oidMappings).values({
        manufacturer: mapping.manufacturer,
        modelSeries: mapping.modelSeries,
        mappingName: mapping.mappingName,
        description: mapping.description,
        isDefault: mapping.isDefault,
        isCustom: false, // These are system presets
        oids: mapping.oids,
      });

      console.log(`  ✓ Created mapping: ${mapping.manufacturer} - ${mapping.mappingName}`);
    } catch (error) {
      console.error(`  ✗ Failed to create mapping: ${mapping.mappingName}`, error);
    }
  }

  console.log('OID mappings seed completed!');
}

// Run seed if called directly
if (require.main === module) {
  seedOidMappings()
    .then(() => {
      console.log('Seed completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
