import { db } from './db';
import { masterProductModels, masterProductAccessories } from '@shared/schema';

// Sample master catalog data for seeding
const sampleProducts = [
  // Canon Products
  {
    manufacturer: 'Canon',
    modelCode: 'imageRUNNER ADVANCE DX C5560i',
    displayName: 'Canon imageRUNNER ADVANCE DX C5560i',
    category: 'MFP',
    productType: 'A3 Color',
    msrp: 18500,
    specsJson: {
      printSpeed: '60 ppm color/BW',
      resolution: '1200 x 1200 dpi',
      paperCapacity: '2,300 sheets standard',
      connectivity: ['Ethernet', 'Wi-Fi', 'USB'],
      features: ['Duplex printing', 'Scan to email', 'Mobile printing', 'Security features'],
      dimensions: '615 x 685 x 855 mm',
      weight: '85 kg'
    },
    status: 'active'
  },
  {
    manufacturer: 'Canon',
    modelCode: 'imageRUNNER ADVANCE DX C3330i',
    displayName: 'Canon imageRUNNER ADVANCE DX C3330i',
    category: 'MFP',
    productType: 'A3 Color',
    msrp: 8950,
    specsJson: {
      printSpeed: '30 ppm color/BW',
      resolution: '1200 x 1200 dpi',
      paperCapacity: '1,200 sheets standard',
      connectivity: ['Ethernet', 'Wi-Fi', 'USB'],
      features: ['Duplex printing', 'Scan to email', 'Mobile printing'],
      dimensions: '615 x 685 x 855 mm',
      weight: '75 kg'
    },
    status: 'active'
  },
  // Xerox Products
  {
    manufacturer: 'Xerox',
    modelCode: 'VersaLink C7000',
    displayName: 'Xerox VersaLink C7000 Color Printer',
    category: 'Printer',
    productType: 'A3 Color',
    msrp: 4299,
    specsJson: {
      printSpeed: '35 ppm color/BW',
      resolution: '1200 x 2400 dpi',
      paperCapacity: '620 sheets standard',
      connectivity: ['Ethernet', 'Wi-Fi', 'USB', 'NFC'],
      features: ['Duplex printing', 'Mobile printing', 'Cloud connectivity'],
      dimensions: '506 x 575 x 412 mm',
      weight: '40 kg'
    },
    status: 'active'
  },
  {
    manufacturer: 'Xerox',
    modelCode: 'AltaLink C8030',
    displayName: 'Xerox AltaLink C8030 Multifunction Printer',
    category: 'MFP',
    productType: 'A3 Color',
    msrp: 12500,
    specsJson: {
      printSpeed: '30 ppm color/BW',
      resolution: '1200 x 2400 dpi',
      paperCapacity: '1,140 sheets standard',
      connectivity: ['Ethernet', 'Wi-Fi', 'USB'],
      features: ['Duplex printing', 'Scan to email', 'Cloud workflows', 'Security'],
      dimensions: '622 x 737 x 1181 mm',
      weight: '119 kg'
    },
    status: 'active'
  },
  // HP Products
  {
    manufacturer: 'HP',
    modelCode: 'LaserJet Enterprise M507dn',
    displayName: 'HP LaserJet Enterprise M507dn',
    category: 'Printer',
    productType: 'A4 Mono',
    msrp: 449,
    specsJson: {
      printSpeed: '43 ppm',
      resolution: '1200 x 1200 dpi',
      paperCapacity: '650 sheets standard',
      connectivity: ['Ethernet', 'USB'],
      features: ['Duplex printing', 'Security features', 'Energy efficient'],
      dimensions: '416 x 372 x 252 mm',
      weight: '13.6 kg'
    },
    status: 'active'
  },
  {
    manufacturer: 'HP',
    modelCode: 'Color LaserJet Enterprise M751dn',
    displayName: 'HP Color LaserJet Enterprise M751dn',
    category: 'Printer',
    productType: 'A3 Color',
    msrp: 2799,
    specsJson: {
      printSpeed: '41 ppm color, 43 ppm BW',
      resolution: '1200 x 1200 dpi',
      paperCapacity: '650 sheets standard',
      connectivity: ['Ethernet', 'USB'],
      features: ['Duplex printing', 'Security features', 'Mobile printing'],
      dimensions: '471 x 527 x 385 mm',
      weight: '29.1 kg'
    },
    status: 'active'
  },
  // Ricoh Products
  {
    manufacturer: 'Ricoh',
    modelCode: 'IM C3010',
    displayName: 'Ricoh IM C3010 Color Laser Multifunction Printer',
    category: 'MFP',
    productType: 'A3 Color',
    msrp: 5995,
    specsJson: {
      printSpeed: '30 ppm color/BW',
      resolution: '1200 x 1200 dpi',
      paperCapacity: '650 sheets standard',
      connectivity: ['Ethernet', 'Wi-Fi', 'USB'],
      features: ['Duplex printing', 'Scan to email', 'Cloud connectivity'],
      dimensions: '587 x 685 x 595 mm',
      weight: '59 kg'
    },
    status: 'active'
  },
  {
    manufacturer: 'Ricoh',
    modelCode: 'IM C6010',
    displayName: 'Ricoh IM C6010 Color Laser Multifunction Printer',
    category: 'MFP',
    productType: 'A3 Color',
    msrp: 15995,
    specsJson: {
      printSpeed: '60 ppm color/BW',
      resolution: '1200 x 1200 dpi',
      paperCapacity: '2,300 sheets standard',
      connectivity: ['Ethernet', 'Wi-Fi', 'USB'],
      features: ['Duplex printing', 'Scan to email', 'Advanced finishing', 'Cloud workflows'],
      dimensions: '615 x 737 x 1181 mm',
      weight: '125 kg'
    },
    status: 'active'
  },
  // Lexmark Products
  {
    manufacturer: 'Lexmark',
    modelCode: 'CX725de',
    displayName: 'Lexmark CX725de Color Laser Multifunction Printer',
    category: 'MFP',
    productType: 'A4 Color',
    msrp: 2299,
    specsJson: {
      printSpeed: '47 ppm color/BW',
      resolution: '1200 x 1200 dpi',
      paperCapacity: '650 sheets standard',
      connectivity: ['Ethernet', 'Wi-Fi', 'USB'],
      features: ['Duplex printing', 'Scan to email', 'Mobile printing'],
      dimensions: '467 x 515 x 526 mm',
      weight: '33.7 kg'
    },
    status: 'active'
  },
  {
    manufacturer: 'Lexmark',
    modelCode: 'XC9265',
    displayName: 'Lexmark XC9265 Color MFP',
    category: 'MFP',
    productType: 'A3 Color',
    msrp: 18999,
    specsJson: {
      printSpeed: '65 ppm color/BW',
      resolution: '1200 x 1200 dpi',
      paperCapacity: '2,300 sheets standard',
      connectivity: ['Ethernet', 'Wi-Fi', 'USB'],
      features: ['Duplex printing', 'Advanced finishing', 'Security', 'Cloud workflows'],
      dimensions: '668 x 737 x 1273 mm',
      weight: '140 kg'
    },
    status: 'active'
  }
];

// Sample accessories
const sampleAccessories = [
  {
    manufacturer: 'Canon',
    accessoryCode: 'PF-C1',
    displayName: 'Canon PF-C1 Paper Feeding Unit',
    category: 'Paper Feeding',
    msrp: 895,
    specsJson: {
      capacity: '550 sheets',
      paperSizes: ['A4', 'A5', 'B5', 'Letter', 'Legal'],
      compatibility: ['imageRUNNER ADVANCE DX series']
    },
    status: 'active'
  },
  {
    manufacturer: 'Canon',
    accessoryCode: 'DF-C1',
    displayName: 'Canon DF-C1 Document Feeder',
    category: 'Document Feeding',
    msrp: 1295,
    specsJson: {
      capacity: '100 sheets',
      scanSpeed: '80 ipm',
      compatibility: ['imageRUNNER ADVANCE DX series']
    },
    status: 'active'
  },
  {
    manufacturer: 'Xerox',
    accessoryCode: '497K17750',
    displayName: 'Xerox High Capacity Feeder',
    category: 'Paper Feeding',
    msrp: 750,
    specsJson: {
      capacity: '2000 sheets',
      paperSizes: ['A4', 'A3', 'Letter', 'Legal'],
      compatibility: ['VersaLink C7000', 'AltaLink series']
    },
    status: 'active'
  },
  {
    manufacturer: 'HP',
    accessoryCode: 'T3V27A',
    displayName: 'HP 550-sheet Paper Tray',
    category: 'Paper Feeding',
    msrp: 399,
    specsJson: {
      capacity: '550 sheets',
      paperSizes: ['A4', 'Letter', 'Legal'],
      compatibility: ['LaserJet Enterprise M507', 'Color LaserJet Enterprise M751']
    },
    status: 'active'
  },
  {
    manufacturer: 'Ricoh',
    accessoryCode: 'PB1040',
    displayName: 'Ricoh PB1040 Paper Bank',
    category: 'Paper Feeding',
    msrp: 650,
    specsJson: {
      capacity: '500 sheets',
      paperSizes: ['A4', 'A3', 'B4', 'Letter'],
      compatibility: ['IM C series']
    },
    status: 'active'
  }
];

export async function seedMasterCatalog() {
  try {
    console.log('Seeding master product catalog...');
    
    // Insert master products
    for (const product of sampleProducts) {
      await db.insert(masterProductModels)
        .values(product)
        .onConflictDoNothing(); // Prevent duplicates
    }
    
    // Insert master accessories
    for (const accessory of sampleAccessories) {
      await db.insert(masterProductAccessories)
        .values(accessory)
        .onConflictDoNothing();
    }
    
    console.log(`Successfully seeded ${sampleProducts.length} master products and ${sampleAccessories.length} accessories`);
    return true;
  } catch (error) {
    console.error('Error seeding master catalog:', error);
    return false;
  }
}

// Run seeding if called directly (ESM compatible)
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  seedMasterCatalog().then((success) => {
    process.exit(success ? 0 : 1);
  });
}