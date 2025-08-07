import { Request, Response } from "express";
import { db } from "./db";
import { onboardingChecklists, onboardingEquipment } from "../shared/schema";
import { eq } from "drizzle-orm";

export async function exportChecklistPDF(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = req.user as any;

    if (!user?.tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    // Get checklist with equipment
    const [checklist] = await db
      .select()
      .from(onboardingChecklists)
      .where(eq(onboardingChecklists.id, id));

    if (!checklist || checklist.tenantId !== user.tenantId) {
      return res.status(404).json({ error: "Checklist not found" });
    }

    const equipment = await db
      .select()
      .from(onboardingEquipment)
      .where(eq(onboardingEquipment.checklistId, id));

    // Generate PDF content
    const pdfContent = generatePDFContent(checklist, equipment);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="checklist-${checklist.id}.pdf"`);
    res.send(pdfContent);
  } catch (error) {
    console.error("Error exporting PDF:", error);
    res.status(500).json({ error: "Failed to export PDF" });
  }
}

export async function exportChecklistExcel(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = req.user as any;

    if (!user?.tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    // Get checklist with equipment
    const [checklist] = await db
      .select()
      .from(onboardingChecklists)
      .where(eq(onboardingChecklists.id, id));

    if (!checklist || checklist.tenantId !== user.tenantId) {
      return res.status(404).json({ error: "Checklist not found" });
    }

    const equipment = await db
      .select()
      .from(onboardingEquipment)
      .where(eq(onboardingEquipment.checklistId, id));

    // Generate Excel content
    const excelContent = generateExcelContent(checklist, equipment);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="checklist-${checklist.id}.xlsx"`);
    res.send(excelContent);
  } catch (error) {
    console.error("Error exporting Excel:", error);
    res.status(500).json({ error: "Failed to export Excel" });
  }
}

export async function exportChecklistCSV(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = req.user as any;

    if (!user?.tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    // Get checklist with equipment
    const [checklist] = await db
      .select()
      .from(onboardingChecklists)
      .where(eq(onboardingChecklists.id, id));

    if (!checklist || checklist.tenantId !== user.tenantId) {
      return res.status(404).json({ error: "Checklist not found" });
    }

    const equipment = await db
      .select()
      .from(onboardingEquipment)
      .where(eq(onboardingEquipment.checklistId, id));

    // Generate CSV content
    const csvContent = generateCSVContent(checklist, equipment);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="checklist-${checklist.id}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    res.status(500).json({ error: "Failed to export CSV" });
  }
}

function generatePDFContent(checklist: any, equipment: any[]) {
  // Simple HTML to PDF conversion - in production use puppeteer or similar
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Onboarding Checklist - ${checklist.checklistTitle}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .section { margin-bottom: 20px; }
        .section h3 { border-bottom: 2px solid #333; padding-bottom: 5px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .equipment-item { border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Equipment Installation Checklist</h1>
        <h2>${checklist.checklistTitle}</h2>
        <p>Created: ${new Date(checklist.createdAt).toLocaleDateString()}</p>
      </div>

      <div class="section">
        <h3>Customer Information</h3>
        <div class="grid">
          <div><strong>Company:</strong> ${checklist.customerData?.companyName || 'N/A'}</div>
          <div><strong>Contact:</strong> ${checklist.customerData?.primaryContact || 'N/A'}</div>
          <div><strong>Phone:</strong> ${checklist.customerData?.phone || 'N/A'}</div>
          <div><strong>Email:</strong> ${checklist.customerData?.email || 'N/A'}</div>
          <div><strong>Address:</strong> ${checklist.customerData?.address || 'N/A'}</div>
          <div><strong>Industry:</strong> ${checklist.customerData?.industry || 'N/A'}</div>
        </div>
      </div>

      <div class="section">
        <h3>Installation Details</h3>
        <div class="grid">
          <div><strong>Installation Address:</strong> ${checklist.siteInformation?.installationAddress || 'N/A'}</div>
          <div><strong>Contact Person:</strong> ${checklist.siteInformation?.contactPerson || 'N/A'}</div>
          <div><strong>Phone:</strong> ${checklist.siteInformation?.phoneNumber || 'N/A'}</div>
          <div><strong>Building Type:</strong> ${checklist.siteInformation?.buildingType || 'N/A'}</div>
          <div><strong>Scheduled Date:</strong> ${checklist.scheduledInstallDate ? new Date(checklist.scheduledInstallDate).toLocaleDateString() : 'Not scheduled'}</div>
          <div><strong>Installation Type:</strong> ${checklist.installationType || 'N/A'}</div>
        </div>
      </div>

      <div class="section">
        <h3>Equipment (${equipment.length} items)</h3>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Manufacturer</th>
              <th>Model</th>
              <th>Serial Number</th>
              <th>Location</th>
              <th>Replacement</th>
            </tr>
          </thead>
          <tbody>
            ${equipment.map(item => `
              <tr>
                <td>${item.equipmentType}</td>
                <td>${item.manufacturer || ''}</td>
                <td>${item.model || ''}</td>
                <td>${item.serialNumber || ''}</td>
                <td>${item.location || ''}</td>
                <td>${item.isReplacement ? 'Yes' : 'No'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h3>Status</h3>
        <p><strong>Current Status:</strong> ${checklist.status}</p>
        <p><strong>Last Updated:</strong> ${new Date(checklist.updatedAt).toLocaleDateString()}</p>
      </div>
    </body>
    </html>
  `;
  
  // Return HTML content (in production, convert to PDF using puppeteer)
  return html;
}

function generateExcelContent(checklist: any, equipment: any[]) {
  // Generate Excel-compatible data structure
  const data = {
    checklist: {
      title: checklist.checklistTitle,
      status: checklist.status,
      createdAt: checklist.createdAt,
      customer: checklist.customerData,
      site: checklist.siteInformation,
      scheduledDate: checklist.scheduledInstallDate
    },
    equipment: equipment.map(item => ({
      type: item.equipmentType,
      manufacturer: item.manufacturer,
      model: item.model,
      serialNumber: item.serialNumber,
      location: item.location,
      isReplacement: item.isReplacement,
      macAddress: item.macAddress,
      assetTag: item.assetTag
    }))
  };

  // Simple JSON format (in production, use a library like xlsx to generate actual Excel)
  return JSON.stringify(data, null, 2);
}

function generateCSVContent(checklist: any, equipment: any[]) {
  const headers = [
    'Checklist Title',
    'Customer Company', 
    'Contact Person',
    'Equipment Type',
    'Manufacturer',
    'Model',
    'Serial Number',
    'Location',
    'Is Replacement',
    'Status',
    'Created Date'
  ];

  const rows = equipment.map(item => [
    checklist.checklistTitle,
    checklist.customerData?.companyName || '',
    checklist.customerData?.primaryContact || '',
    item.equipmentType,
    item.manufacturer || '',
    item.model || '',
    item.serialNumber || '',
    item.location || '',
    item.isReplacement ? 'Yes' : 'No',
    checklist.status,
    new Date(checklist.createdAt).toLocaleDateString()
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n');

  return csvContent;
}