import { db } from './db';
import { storage } from './storage';

async function seedManufacturerOrders() {
  try {
    console.log('Seeding manufacturer order submission system...');

    const tenantId = 'demo-tenant';

    // 1. Create manufacturer connections (3 manufacturers)
    console.log('Creating manufacturer connections...');

    const canonConnection = await storage.createManufacturerConnection({
      tenantId,
      manufacturerType: 'canon',
      manufacturerName: 'Canon USA',
      connectionStatus: 'active',
      apiEndpoint: 'https://api.canon-usa.com/v1',
      orderMethod: 'api',
      autoSubmitEnabled: true,
      sandboxMode: false,
      dealerAccountNumber: 'CAN-12345',
      dealerAccountName: 'XYZ Office Solutions',
      lastConnectionTest: new Date(),
      lastSuccessfulOrder: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      consecutiveFailures: 0,
      notes: 'Primary Canon supplier with automated ordering',
    });

    const xeroxConnection = await storage.createManufacturerConnection({
      tenantId,
      manufacturerType: 'xerox',
      manufacturerName: 'Xerox Corporation',
      connectionStatus: 'active',
      apiEndpoint: 'https://api.xerox.com/dealer/v2',
      orderMethod: 'edi',
      autoSubmitEnabled: false,
      sandboxMode: false,
      ediEnabled: true,
      ediInterchangeId: 'XRX987654',
      ediQualifier: '14',
      dealerAccountNumber: 'XRX-98765',
      dealerAccountName: 'XYZ Office Solutions',
      lastConnectionTest: new Date(),
      lastSuccessfulOrder: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      consecutiveFailures: 0,
      notes: 'Secondary supplier for Xerox equipment',
    });

    const hpConnection = await storage.createManufacturerConnection({
      tenantId,
      manufacturerType: 'hp',
      manufacturerName: 'HP Inc.',
      connectionStatus: 'inactive',
      apiEndpoint: 'https://api.hp.com/partners/v1',
      orderMethod: 'portal',
      autoSubmitEnabled: false,
      sandboxMode: true,
      dealerAccountNumber: 'HP-54321',
      dealerAccountName: 'XYZ Office Solutions',
      lastConnectionTest: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      consecutiveFailures: 3,
      lastError: 'Authentication failed: Invalid API credentials',
      notes: 'Connection needs reconfiguration',
    });

    console.log(`Created ${3} manufacturer connections`);

    // 2. Create manufacturer orders (5 orders)
    console.log('Creating manufacturer orders...');

    // Order 1: Canon - Delivered
    const canonOrder1 = await storage.createManufacturerOrder({
      tenantId,
      connectionId: canonConnection.id,
      orderNumber: 'PO-2025-001',
      manufacturerOrderNumber: 'CAN-ORD-789456',
      orderStatus: 'delivered',
      orderMethod: 'api',
      orderDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      acknowledgedAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000),
      subtotal: 12500.0,
      taxAmount: 1000.0,
      shippingCost: 150.0,
      totalAmount: 13650.0,
      currency: 'USD',
      shipToName: 'XYZ Office Solutions - Main Warehouse',
      shipToAddress: '123 Business Park Drive',
      shipToCity: 'Austin',
      shipToState: 'TX',
      shipToZip: '78701',
      shipToCountry: 'USA',
      shippingMethod: 'Ground',
      requestedDeliveryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      estimatedDeliveryDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      contactName: 'John Smith',
      contactEmail: 'john.smith@xyzoffice.com',
      contactPhone: '512-555-0100',
      totalQuantityOrdered: 10,
      totalQuantityShipped: 10,
      totalQuantityDelivered: 10,
      shipmentCount: 1,
      autoSubmitted: true,
    });

    // Order 2: Xerox - Shipped
    const xeroxOrder1 = await storage.createManufacturerOrder({
      tenantId,
      connectionId: xeroxConnection.id,
      orderNumber: 'PO-2025-002',
      manufacturerOrderNumber: 'XRX-123789',
      orderStatus: 'shipped',
      orderMethod: 'edi',
      orderDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      acknowledgedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      subtotal: 28900.0,
      taxAmount: 2312.0,
      shippingCost: 250.0,
      totalAmount: 31462.0,
      currency: 'USD',
      shipToName: 'XYZ Office Solutions - East Location',
      shipToAddress: '456 Commerce Boulevard',
      shipToCity: 'Dallas',
      shipToState: 'TX',
      shipToZip: '75201',
      shipToCountry: 'USA',
      shippingMethod: 'Expedited',
      requestedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      contactName: 'Sarah Johnson',
      contactEmail: 'sarah.johnson@xyzoffice.com',
      contactPhone: '214-555-0200',
      totalQuantityOrdered: 5,
      totalQuantityShipped: 5,
      shipmentCount: 1,
    });

    // Order 3: Canon - Processing
    const canonOrder2 = await storage.createManufacturerOrder({
      tenantId,
      connectionId: canonConnection.id,
      orderNumber: 'PO-2025-003',
      manufacturerOrderNumber: 'CAN-ORD-789457',
      orderStatus: 'processing',
      orderMethod: 'api',
      orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      acknowledgedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      subtotal: 15750.0,
      taxAmount: 1260.0,
      shippingCost: 200.0,
      totalAmount: 17210.0,
      currency: 'USD',
      shipToName: 'XYZ Office Solutions - Main Warehouse',
      shipToAddress: '123 Business Park Drive',
      shipToCity: 'Austin',
      shipToState: 'TX',
      shipToZip: '78701',
      shipToCountry: 'USA',
      shippingMethod: 'Ground',
      requestedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      estimatedDeliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      contactName: 'John Smith',
      contactEmail: 'john.smith@xyzoffice.com',
      contactPhone: '512-555-0100',
      totalQuantityOrdered: 8,
      autoSubmitted: true,
    });

    // Order 4: Canon - Draft
    const canonOrder3 = await storage.createManufacturerOrder({
      tenantId,
      connectionId: canonConnection.id,
      orderNumber: 'PO-2025-004',
      orderStatus: 'draft',
      orderMethod: 'api',
      orderDate: new Date(),
      subtotal: 8950.0,
      taxAmount: 716.0,
      shippingCost: 100.0,
      totalAmount: 9766.0,
      currency: 'USD',
      shipToName: 'XYZ Office Solutions - North Location',
      shipToAddress: '789 Technology Way',
      shipToCity: 'Houston',
      shipToState: 'TX',
      shipToZip: '77001',
      shipToCountry: 'USA',
      shippingMethod: 'Ground',
      requestedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      contactName: 'Mike Williams',
      contactEmail: 'mike.williams@xyzoffice.com',
      contactPhone: '713-555-0300',
      totalQuantityOrdered: 12,
      autoSubmitted: false,
      internalNotes: 'Waiting for customer confirmation before submitting',
    });

    // Order 5: HP - Error (connection issue)
    const hpOrder1 = await storage.createManufacturerOrder({
      tenantId,
      connectionId: hpConnection.id,
      orderNumber: 'PO-2025-005',
      orderStatus: 'error',
      orderMethod: 'portal',
      orderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      subtotal: 5600.0,
      taxAmount: 448.0,
      shippingCost: 75.0,
      totalAmount: 6123.0,
      currency: 'USD',
      shipToName: 'XYZ Office Solutions - South Location',
      shipToAddress: '321 Enterprise Lane',
      shipToCity: 'San Antonio',
      shipToState: 'TX',
      shipToZip: '78201',
      shipToCountry: 'USA',
      shippingMethod: 'Ground',
      requestedDeliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      contactName: 'Lisa Brown',
      contactEmail: 'lisa.brown@xyzoffice.com',
      contactPhone: '210-555-0400',
      totalQuantityOrdered: 6,
      retryCount: 2,
      lastRetryAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      autoSubmitted: false,
    });

    console.log(`Created ${5} manufacturer orders`);

    // 3. Create order line items
    console.log('Creating order line items...');

    // Canon Order 1 line items
    await storage.bulkCreateOrderLineItems([
      {
        tenantId,
        orderId: canonOrder1.id,
        lineNumber: 1,
        productCode: 'iR-ADV-C5560i',
        manufacturerPartNumber: 'CAN-5560-01',
        description: 'Canon imageRUNNER ADVANCE C5560i Color Copier',
        quantityOrdered: 2,
        quantityShipped: 2,
        quantityDelivered: 2,
        unitPrice: 4500.0,
        listPrice: 5000.0,
        discountPercent: 10.0,
        discountAmount: 500.0,
        lineTotal: 9000.0,
        uom: 'EA',
        actualShipDate: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
        lineStatus: 'delivered',
      },
      {
        tenantId,
        orderId: canonOrder1.id,
        lineNumber: 2,
        productCode: 'TONER-C5560-BK',
        manufacturerPartNumber: 'CAN-TON-BK-02',
        description: 'Canon Black Toner Cartridge for C5560i',
        quantityOrdered: 8,
        quantityShipped: 8,
        quantityDelivered: 8,
        unitPrice: 125.0,
        listPrice: 150.0,
        discountPercent: 16.67,
        discountAmount: 25.0,
        lineTotal: 1000.0,
        uom: 'EA',
        actualShipDate: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
        lineStatus: 'delivered',
      },
    ]);

    // Xerox Order 1 line items
    await storage.bulkCreateOrderLineItems([
      {
        tenantId,
        orderId: xeroxOrder1.id,
        lineNumber: 1,
        productCode: 'VersaLink-C7030',
        manufacturerPartNumber: 'XRX-C7030-01',
        description: 'Xerox VersaLink C7030 Color Multifunction Printer',
        quantityOrdered: 3,
        quantityShipped: 3,
        unitPrice: 8500.0,
        listPrice: 9500.0,
        discountPercent: 10.53,
        discountAmount: 1000.0,
        lineTotal: 25500.0,
        uom: 'EA',
        estimatedShipDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        actualShipDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        lineStatus: 'shipped',
      },
      {
        tenantId,
        orderId: xeroxOrder1.id,
        lineNumber: 2,
        productCode: 'TONER-C7030-CMYK',
        manufacturerPartNumber: 'XRX-TON-CMYK-01',
        description: 'Xerox CMYK Toner Set for C7030',
        quantityOrdered: 2,
        quantityShipped: 2,
        unitPrice: 850.0,
        listPrice: 950.0,
        discountPercent: 10.53,
        discountAmount: 100.0,
        lineTotal: 1700.0,
        uom: 'SET',
        actualShipDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        lineStatus: 'shipped',
      },
    ]);

    // Canon Order 2 line items
    await storage.bulkCreateOrderLineItems([
      {
        tenantId,
        orderId: canonOrder2.id,
        lineNumber: 1,
        productCode: 'iR-ADV-DX-C5870i',
        manufacturerPartNumber: 'CAN-DX5870-01',
        description: 'Canon imageRUNNER ADVANCE DX C5870i',
        quantityOrdered: 1,
        unitPrice: 12000.0,
        listPrice: 13000.0,
        discountPercent: 7.69,
        discountAmount: 1000.0,
        lineTotal: 12000.0,
        uom: 'EA',
        estimatedShipDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        lineStatus: 'processing',
      },
      {
        tenantId,
        orderId: canonOrder2.id,
        lineNumber: 2,
        productCode: 'STAPLER-J1',
        manufacturerPartNumber: 'CAN-STP-J1-01',
        description: 'Canon Inner Finisher J1 with Stapler',
        quantityOrdered: 1,
        unitPrice: 1500.0,
        listPrice: 1750.0,
        discountPercent: 14.29,
        discountAmount: 250.0,
        lineTotal: 1500.0,
        uom: 'EA',
        estimatedShipDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        lineStatus: 'processing',
      },
    ]);

    console.log('Created order line items');

    // 4. Create order confirmations
    console.log('Creating order confirmations...');

    await storage.createOrderConfirmation({
      tenantId,
      orderId: canonOrder1.id,
      confirmationNumber: 'CAN-CONF-789456',
      confirmationType: 'order_acknowledgment',
      confirmedAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000),
      confirmationStatus: 'processed',
      confirmedAmount: 13650.0,
      confirmedDeliveryDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      processedAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000),
      rawConfirmationData: {
        confirmationId: 'CAN-CONF-789456',
        orderNumber: 'CAN-ORD-789456',
        status: 'accepted',
        estimatedShipDate: '2025-01-15',
      },
    });

    await storage.createOrderConfirmation({
      tenantId,
      orderId: xeroxOrder1.id,
      confirmationNumber: 'XRX-CONF-123789',
      confirmationType: 'order_acknowledgment',
      confirmedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      confirmationStatus: 'processed',
      confirmedAmount: 31462.0,
      confirmedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      processedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      rawConfirmationData: {
        confirmationId: 'XRX-CONF-123789',
        orderNumber: 'XRX-123789',
        status: 'accepted',
        estimatedShipDate: '2025-01-29',
      },
    });

    console.log('Created order confirmations');

    // 5. Create order shipments
    console.log('Creating order shipments...');

    await storage.createOrderShipment({
      tenantId,
      orderId: canonOrder1.id,
      shipmentNumber: 'CAN-SHIP-456789',
      trackingNumber: '1Z999AA10123456784',
      carrier: 'UPS',
      carrierService: 'UPS Ground',
      shipmentStatus: 'delivered',
      shippedDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      estimatedDeliveryDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      actualDeliveryDate: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
      packageCount: 3,
      totalWeight: 450.5,
      weightUnit: 'lbs',
      lineItemsShipped: [
        { lineNumber: 1, quantity: 2 },
        { lineNumber: 2, quantity: 8 },
      ],
      trackingUrl: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
      deliveredTo: 'John Smith - Receiving',
      signatureRequired: true,
      signatureName: 'J. Smith',
      signatureTimestamp: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
      shippingCost: 150.0,
      trackingEvents: [
        {
          timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          status: 'picked_up',
          location: 'Canon Distribution Center',
        },
        {
          timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          status: 'in_transit',
          location: 'Memphis, TN',
        },
        {
          timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
          status: 'out_for_delivery',
          location: 'Austin, TX',
        },
        {
          timestamp: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
          status: 'delivered',
          location: 'Austin, TX',
        },
      ],
      lastTrackingUpdate: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
    });

    await storage.createOrderShipment({
      tenantId,
      orderId: xeroxOrder1.id,
      shipmentNumber: 'XRX-SHIP-987654',
      trackingNumber: '1Z999AA10987654321',
      carrier: 'FedEx',
      carrierService: 'FedEx 2Day',
      shipmentStatus: 'in_transit',
      shippedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      packageCount: 4,
      totalWeight: 620.75,
      weightUnit: 'lbs',
      lineItemsShipped: [
        { lineNumber: 1, quantity: 3 },
        { lineNumber: 2, quantity: 2 },
      ],
      trackingUrl: 'https://www.fedex.com/fedextrack/?tracknumber=1Z999AA10987654321',
      signatureRequired: true,
      shippingCost: 250.0,
      trackingEvents: [
        {
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          status: 'picked_up',
          location: 'Xerox Distribution Center',
        },
        {
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          status: 'in_transit',
          location: 'Fort Worth, TX',
        },
      ],
      lastTrackingUpdate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    });

    console.log('Created order shipments');

    // 6. Create order exceptions
    console.log('Creating order exceptions...');

    await storage.createOrderException({
      tenantId,
      orderId: hpOrder1.id,
      connectionId: hpConnection.id,
      exceptionType: 'authentication_failed',
      severity: 'critical',
      exceptionMessage: 'Failed to authenticate with HP API: Invalid credentials',
      exceptionCode: 'AUTH_001',
      context: 'order_submission',
      errorDetails: {
        endpoint: 'https://api.hp.com/partners/v1/orders',
        method: 'POST',
        statusCode: 401,
        responseBody: { error: 'Unauthorized', message: 'Invalid API key' },
      },
      resolved: false,
      retryable: true,
      retryCount: 2,
      nextRetryAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
      notificationSent: true,
      notifiedUsers: ['admin@xyzoffice.com', 'operations@xyzoffice.com'],
      occurredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });

    await storage.createOrderException({
      tenantId,
      orderId: canonOrder2.id,
      connectionId: canonConnection.id,
      exceptionType: 'product_not_found',
      severity: 'warning',
      exceptionMessage: 'Product SKU not found in manufacturer catalog: STAPLER-J2',
      exceptionCode: 'PROD_404',
      context: 'order_validation',
      affectedLineItems: [{ lineNumber: 3, productCode: 'STAPLER-J2' }],
      errorDetails: {
        invalidSku: 'STAPLER-J2',
        suggestion: 'Use STAPLER-J1 instead',
      },
      resolved: true,
      resolvedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      resolvedBy: 'admin@xyzoffice.com',
      resolutionNotes: 'Updated line item to use STAPLER-J1 instead of J2',
      retryable: false,
      retryCount: 0,
      notificationSent: true,
      notifiedUsers: ['purchasing@xyzoffice.com'],
      occurredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    console.log('Created order exceptions');

    console.log('✅ Manufacturer order submission system seeded successfully');
    console.log(`Summary:
  - 3 manufacturer connections (Canon, Xerox, HP)
  - 5 manufacturer orders (various statuses)
  - 7 order line items
  - 2 order confirmations
  - 2 order shipments
  - 2 order exceptions
    `);
  } catch (error) {
    console.error('❌ Error seeding manufacturer orders:', error);
    throw error;
  }
}

// Run the seed function if called directly
if (require.main === module) {
  seedManufacturerOrders()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedManufacturerOrders };
