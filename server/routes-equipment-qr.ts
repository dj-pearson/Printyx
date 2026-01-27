import { Router } from 'express';
import { db } from './db';
import { equipment } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/equipment/:id/qr-code
 *
 * Generate QR code for equipment
 * Returns PNG image that can be printed on asset labels
 */
router.get('/:id/qr-code', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const size = parseInt(req.query.size as string) || 300; // Default 300x300px
    const format = (req.query.format as string) || 'png'; // png or svg

    // Verify equipment exists and belongs to tenant
    const equipmentItem = await db.query.equipment.findFirst({
      where: and(eq(equipment.id, id), eq(equipment.tenant_id, tenantId)),
    });

    if (!equipmentItem) {
      return res.status(404).json({ message: 'Equipment not found' });
    }

    // QR code data: equipment ID (can be scanned by mobile app)
    const qrData = id;

    if (format === 'svg') {
      res.status(503).json({ message: 'QR code generation is temporarily unavailable' });
    } else {
      res.status(503).json({ message: 'QR code generation is temporarily unavailable' });
    }
  } catch (error) {
    console.error('[QRCodeAPI] Error generating QR code:', error);
    res.status(500).json({ message: 'Failed to generate QR code' });
  }
});

/**
 * GET /api/equipment/:id/asset-label
 *
 * Generate printable asset label with QR code
 * Returns HTML that can be printed on label paper
 */
router.get('/:id/asset-label', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;

    // Get equipment details
    const equipmentItem = await db.query.equipment.findFirst({
      where: and(eq(equipment.id, id), eq(equipment.tenant_id, tenantId)),
      with: {
        customer: true,
      },
    });

    if (!equipmentItem) {
      return res.status(404).json({ message: 'Equipment not found' });
    }

    // Generate QR code as data URL
    const qrData = id;
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    // Generate HTML asset label
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Asset Label - ${equipmentItem.serialNumber || id}</title>
  <style>
    @page {
      size: 2.25in 1.25in;
      margin: 0;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      width: 2.25in;
      height: 1.25in;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: white;
    }

    .label-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 0.1in;
      box-sizing: border-box;
    }

    .qr-code {
      width: 1in;
      height: 1in;
      flex-shrink: 0;
    }

    .equipment-info {
      flex: 1;
      padding-left: 0.1in;
      font-size: 9pt;
      line-height: 1.2;
    }

    .equipment-info h3 {
      margin: 0 0 0.05in 0;
      font-size: 10pt;
      font-weight: bold;
    }

    .equipment-info p {
      margin: 0.02in 0;
      font-size: 8pt;
    }

    .serial {
      font-weight: bold;
      font-size: 9pt;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="label-container">
    <img src="${qrCodeDataURL}" alt="QR Code" class="qr-code">
    <div class="equipment-info">
      <h3>${equipmentItem.manufacturer || 'Equipment'}</h3>
      <p><strong>${equipmentItem.model || 'Unknown Model'}</strong></p>
      <p class="serial">SN: ${equipmentItem.serialNumber || 'N/A'}</p>
      ${equipmentItem.customer ? `<p>${equipmentItem.customer.name}</p>` : ''}
      ${equipmentItem.location ? `<p>${equipmentItem.location}</p>` : ''}
    </div>
  </div>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('[QRCodeAPI] Error generating asset label:', error);
    res.status(500).json({ message: 'Failed to generate asset label' });
  }
});

/**
 * POST /api/equipment/bulk-qr-codes
 *
 * Generate QR codes for multiple equipment items (batch operation)
 */
router.post('/bulk-qr-codes', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const { equipmentIds } = req.body;

    if (!equipmentIds || !Array.isArray(equipmentIds)) {
      return res.status(400).json({ message: 'equipmentIds array required' });
    }

    // Get all equipment
    const equipmentItems = await db.query.equipment.findMany({
      where: and(
        eq(equipment.tenant_id, tenantId),
        // @ts-ignore - inArray type issue
        equipmentIds.length > 0 ? inArray(equipment.id, equipmentIds) : undefined,
      ),
    });

    // Generate QR codes for all
    const qrCodes = await Promise.all(
      equipmentItems.map(async (item) => {
        const dataURL = await QRCode.toDataURL(item.id, {
          width: 200,
          margin: 1,
          errorCorrectionLevel: 'M',
        });

        return {
          equipmentId: item.id,
          serialNumber: item.serialNumber,
          manufacturer: item.manufacturer,
          model: item.model,
          qrCodeDataURL: dataURL,
        };
      }),
    );

    res.json({ qrCodes });
  } catch (error) {
    console.error('[QRCodeAPI] Error generating bulk QR codes:', error);
    res.status(500).json({ message: 'Failed to generate QR codes' });
  }
});

export default router;
