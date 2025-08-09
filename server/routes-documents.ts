import express from 'express';
import { db } from './db.js';
import { documents } from '../shared/schema.js';
import { eq, and } from 'drizzle-orm';

const router = express.Router();

// Middleware for authentication and tenant
const requireAuth = (req: any, res: any, next: any) => {
  const session = req.session as any;
  if (!session?.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

const requireTenant = (req: any, res: any, next: any) => {
  const session = req.session as any;
  if (!session?.tenantId) {
    return res.status(400).json({ message: 'Tenant ID is required' });
  }
  req.tenantId = session.tenantId;
  next();
};

// Get all documents for tenant
router.get('/', requireAuth, requireTenant, async (req: any, res) => {
  try {
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.tenantId, req.tenantId))
      .orderBy(documents.createdAt);
    
    res.json(docs);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

// Create a new document
router.post('/', requireAuth, requireTenant, async (req: any, res) => {
  try {
    const session = req.session as any;
    const userId = session.userId;
    
    const documentData = {
      ...req.body,
      tenantId: req.tenantId,
      createdBy: userId,
      updatedBy: userId,
      documentNumber: req.body.agreementNumber || `DOC-${Date.now()}`,
      documentType: req.body.includeServiceContract ? 'purchase_service' : 'purchase_only',
    };

    const [newDocument] = await db
      .insert(documents)
      .values(documentData)
      .returning();

    res.status(201).json(newDocument);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ message: 'Failed to create document' });
  }
});

// Get a specific document
router.get('/:id', requireAuth, requireTenant, async (req: any, res) => {
  try {
    const [document] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, req.params.id),
          eq(documents.tenantId, req.tenantId)
        )
      );

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ message: 'Failed to fetch document' });
  }
});

// Generate PDF for a document
router.post('/:id/pdf', requireAuth, requireTenant, async (req: any, res) => {
  try {
    const [document] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, req.params.id),
          eq(documents.tenantId, req.tenantId)
        )
      );

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Generate HTML content for PDF
    const htmlContent = generateDocumentHTML(document);
    
    // For now, return the HTML content as text
    // In production, you would use a library like puppeteer to generate PDF
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="document-${document.id}.html"`);
    res.send(htmlContent);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: 'Failed to generate PDF' });
  }
});

// Generate HTML content for document
function generateDocumentHTML(doc: any): string {
  const lineItems = doc.lineItems || [];
  const total = lineItems.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
  
  const currentDate = new Date().toLocaleDateString();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Purchase Agreement ${doc.agreementNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .agreement-title { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
    .section { margin-bottom: 25px; }
    .section-title { font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ccc; }
    .buyer-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .buyer-box, .shipto-box { width: 45%; }
    .line-items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .line-items th, .line-items td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    .line-items th { background-color: #f5f5f5; }
    .total-row { font-weight: bold; background-color: #f9f9f9; }
    .service-section { background-color: #f0f8ff; padding: 15px; margin: 20px 0; border-radius: 5px; }
    .terms-section { font-size: 12px; line-height: 1.4; margin-top: 30px; }
    .signature-section { display: flex; justify-content: space-between; margin-top: 40px; }
    .signature-box { width: 45%; border-top: 1px solid #000; padding-top: 5px; }
    @media print { 
      body { margin: 0; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="agreement-title">PURCHASE AGREEMENT</div>
    ${doc.includeServiceContract ? '<div>& MAINTENANCE SERVICE AGREEMENT</div>' : ''}
    <div>Agreement # ${doc.agreementNumber}</div>
  </div>

  <div class="buyer-info">
    <div class="buyer-box">
      <strong>BUYER</strong><br>
      ${doc.buyerName || doc.customerName}<br>
      ${doc.buyerAddress || ''}
    </div>
    <div class="shipto-box">
      <strong>SHIP TO</strong><br>
      ${doc.shipToName || doc.buyerName || doc.customerName}<br>
      ${doc.shipToAddress || doc.buyerAddress || ''}
    </div>
  </div>

  <div class="section">
    <div><strong>P.O. #:</strong> ${doc.poNumber || ''}</div>
    <div><strong>Date:</strong> ${doc.orderDate || currentDate}</div>
  </div>

  <div class="section">
    <div class="section-title">EQUIPMENT & SERVICES</div>
    <table class="line-items">
      <thead>
        <tr>
          <th>QTY</th>
          <th>DESCRIPTION</th>
          <th>UNIT PRICE</th>
          <th>AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.map((item: any) => `
          <tr>
            <td>${item.quantity || 1}</td>
            <td>${item.description || ''}</td>
            <td>$${(item.unitPrice || 0).toFixed(2)}</td>
            <td>$${(item.totalPrice || 0).toFixed(2)}</td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td colspan="3"><strong>Total*</strong></td>
          <td><strong>$${total.toFixed(2)}</strong></td>
        </tr>
      </tbody>
    </table>
    <div><em>*PLUS ALL APPLICABLE SALES TAX</em></div>
  </div>

  ${doc.includeServiceContract ? `
    <div class="page-break"></div>
    <div class="service-section">
      <div class="section-title">MAINTENANCE SERVICE AGREEMENT</div>
      
      <div><strong>TERM:</strong> This Agreement shall be for an initial term of ${doc.serviceTerm || 60} months commencing on ${doc.serviceStartDate || currentDate}.</div>
      
      <div style="margin: 15px 0;">
        <strong>MINIMUM PRINTS:</strong><br>
        • ${doc.minimumBlackPrints || 500} minimum black prints monthly<br>
        • ${doc.minimumColorPrints || 500} minimum color prints monthly
      </div>
      
      <div style="margin: 15px 0;">
        <strong>CHARGES:</strong><br>
        • Monthly Base Charge: $${(doc.monthlyBase || 30).toFixed(2)}<br>
        • Black & White Rate: $${(doc.blackRate || 0.008).toFixed(3)} per print over minimum<br>
        • Color Rate: $${(doc.colorRate || 0.050).toFixed(3)} per print over minimum
      </div>
      
      <div style="margin: 15px 0;">
        <strong>CONSUMABLE SUPPLIES:</strong><br>
        ${doc.includeBlackSupplies ? '• Black supplies INCLUDED (toner, developer, fuser lubricant)' : '• Black supplies EXCLUDED'}<br>
        ${doc.includeColorSupplies ? '• Color supplies INCLUDED (toner, developer, fuser lubricant)' : '• Color supplies EXCLUDED'}
      </div>
      
      ${doc.autoRenewal ? '<div><strong>AUTO-RENEWAL:</strong> This agreement will automatically renew for successive 12-month terms unless terminated with 30 days written notice.</div>' : ''}
    </div>
  ` : ''}

  <div class="terms-section">
    <strong>TERMS AND CONDITIONS</strong><br>
    <p>PURCHASER ACKNOWLEDGES THAT HE OR SHE HAS READ, UNDERSTANDS AND AGREES TO BE BOUND BY THE TERMS SET FORTH ON THE FRONT AND REVERSE SIDE OF THIS AGREEMENT, AND THAT THESE TERMS MAY NOT BE AMENDED OR MODIFIED EXCEPT IN WRITING EXECUTED BY AN AUTHORIZED OFFICER OF SELLER AND AN AUTHORIZED AGENT OF PURCHASER.</p>
    
    <p><strong>Payment Terms:</strong> ${doc.paymentTerms === 'net_30' ? 'Net 30 days' : doc.paymentTerms === 'net_15' ? 'Net 15 days' : doc.paymentTerms === 'net_60' ? 'Net 60 days' : 'Due on receipt'}</p>
    
    ${doc.specialTerms ? `<p><strong>Special Terms:</strong> ${doc.specialTerms}</p>` : ''}
  </div>

  <div class="signature-section">
    <div class="signature-box">
      <strong>ACCEPTED BY SELLER: INFOMAX OFFICE SYSTEMS, INC.</strong><br><br>
      _____________________________________________<br>
      AUTHORIZED OFFICER<br><br>
      _____________________________________________<br>
      TITLE<br><br>
      _____________________________________________<br>
      DATE
    </div>
    <div class="signature-box">
      <strong>PURCHASER:</strong><br><br>
      _____________________________________________<br>
      AUTHORIZED AGENT<br>
      ${doc.authorizedSignerTitle || ''}<br><br>
      _____________________________________________<br>
      TITLE<br><br>
      _____________________________________________<br>
      DATE
    </div>
  </div>
</body>
</html>`;
}

export default router;