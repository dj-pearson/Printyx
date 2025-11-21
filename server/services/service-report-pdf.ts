import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

/**
 * Service Report PDF Generator
 *
 * Generates professional PDF service reports for completed service calls
 */

interface ServiceReportData {
  reportId: string;
  ticketNumber?: string;
  completedAt: Date;
  technician: {
    name: string;
    id?: string;
    phone?: string;
  };
  customer: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  equipment?: {
    make?: string;
    model?: string;
    serialNumber?: string;
    location?: string;
  };
  workSummary: {
    workPerformed: string[];
    timeSpent: number; // minutes
    issuesFound?: string[];
    recommendations?: string[];
  };
  partsAndMaterials: {
    partsUsed: Array<{
      partNumber?: string;
      description: string;
      quantity?: number;
      cost?: number;
    }>;
    laborCost: number;
    totalPartsCost: number;
    totalCost: number;
  };
  equipmentStatus?: {
    meterReading?: number;
    operationalStatus?: string;
    nextServiceDue?: Date;
  };
  customerApproval?: {
    signature?: string; // Base64 or URL
    signedAt?: Date;
    customerNotes?: string;
    satisfactionRating?: number;
  };
  qualityChecks?: {
    functionalTest: boolean;
    printQualityTest: boolean;
    networkConnectivity: boolean;
    customerTraining: boolean;
  };
}

export class ServiceReportPDFGenerator {
  /**
   * Generate a PDF service report and return as a stream
   */
  generatePDF(reportData: ServiceReportData): PassThrough {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      }
    });

    const stream = new PassThrough();
    doc.pipe(stream);

    // Header
    this.addHeader(doc, reportData);

    // Service Details
    doc.moveDown(1.5);
    this.addServiceDetails(doc, reportData);

    // Work Performed
    doc.moveDown();
    this.addWorkPerformed(doc, reportData);

    // Parts and Materials
    doc.moveDown();
    this.addPartsAndMaterials(doc, reportData);

    // Equipment Status
    if (reportData.equipmentStatus) {
      doc.moveDown();
      this.addEquipmentStatus(doc, reportData);
    }

    // Quality Checks
    if (reportData.qualityChecks) {
      doc.moveDown();
      this.addQualityChecks(doc, reportData);
    }

    // Customer Approval
    if (reportData.customerApproval) {
      doc.moveDown();
      this.addCustomerApproval(doc, reportData);
    }

    // Footer
    this.addFooter(doc, reportData);

    doc.end();
    return stream;
  }

  private addHeader(doc: PDFKit.PDFDocument, data: ServiceReportData) {
    // Company name/logo area (placeholder)
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('SERVICE REPORT', { align: 'center' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Report #${data.reportId}`, { align: 'center' });

    doc.moveDown(0.5);

    // Horizontal line
    doc
      .moveTo(50, doc.y)
      .lineTo(562, doc.y)
      .stroke();
  }

  private addServiceDetails(doc: PDFKit.PDFDocument, data: ServiceReportData) {
    doc.fontSize(14).font('Helvetica-Bold').text('Service Details');
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');

    // Two-column layout
    const leftColumn = 50;
    const rightColumn = 306;
    let y = doc.y;

    // Left column
    doc.text(`Date: ${this.formatDate(data.completedAt)}`, leftColumn, y);
    doc.text(`Ticket Number: ${data.ticketNumber || 'N/A'}`, leftColumn);
    doc.text(`Technician: ${data.technician.name}`, leftColumn);
    if (data.technician.phone) {
      doc.text(`Tech Phone: ${data.technician.phone}`, leftColumn);
    }

    // Right column
    doc.text(`Customer: ${data.customer.name}`, rightColumn, y);
    if (data.customer.address) {
      doc.text(`Address: ${data.customer.address}`, rightColumn);
    }
    if (data.customer.phone) {
      doc.text(`Phone: ${data.customer.phone}`, rightColumn);
    }

    doc.moveDown();

    // Equipment information (if available)
    if (data.equipment) {
      doc.fontSize(11).font('Helvetica-Bold').text('Equipment Information');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');

      if (data.equipment.make || data.equipment.model) {
        doc.text(`Make/Model: ${data.equipment.make || ''} ${data.equipment.model || ''}`.trim());
      }
      if (data.equipment.serialNumber) {
        doc.text(`Serial Number: ${data.equipment.serialNumber}`);
      }
      if (data.equipment.location) {
        doc.text(`Location: ${data.equipment.location}`);
      }
    }
  }

  private addWorkPerformed(doc: PDFKit.PDFDocument, data: ServiceReportData) {
    doc.fontSize(14).font('Helvetica-Bold').text('Work Performed');
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');
    doc.text(`Time Spent: ${data.workSummary.timeSpent} minutes`);
    doc.moveDown(0.5);

    if (data.workSummary.workPerformed.length > 0) {
      data.workSummary.workPerformed.forEach((work, index) => {
        doc.text(`${index + 1}. ${work}`, { indent: 10 });
      });
    } else {
      doc.text('No work items recorded.');
    }

    if (data.workSummary.issuesFound && data.workSummary.issuesFound.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica-Bold').text('Issues Found:');
      doc.fontSize(10).font('Helvetica');
      data.workSummary.issuesFound.forEach((issue, index) => {
        doc.text(`• ${issue}`, { indent: 10 });
      });
    }

    if (data.workSummary.recommendations && data.workSummary.recommendations.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica-Bold').text('Recommendations:');
      doc.fontSize(10).font('Helvetica');
      data.workSummary.recommendations.forEach((rec, index) => {
        doc.text(`• ${rec}`, { indent: 10 });
      });
    }
  }

  private addPartsAndMaterials(doc: PDFKit.PDFDocument, data: ServiceReportData) {
    doc.fontSize(14).font('Helvetica-Bold').text('Parts & Materials');
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');

    if (data.partsAndMaterials.partsUsed.length > 0) {
      // Table header
      const tableTop = doc.y;
      doc.font('Helvetica-Bold');
      doc.text('Part Number', 50, tableTop, { width: 100, continued: true });
      doc.text('Description', 160, tableTop, { width: 200, continued: true });
      doc.text('Qty', 370, tableTop, { width: 40, continued: true, align: 'right' });
      doc.text('Cost', 420, tableTop, { width: 80, align: 'right' });

      doc.moveDown(0.3);
      doc
        .moveTo(50, doc.y)
        .lineTo(510, doc.y)
        .stroke();
      doc.moveDown(0.3);

      // Table rows
      doc.font('Helvetica');
      data.partsAndMaterials.partsUsed.forEach((part) => {
        const rowY = doc.y;
        doc.text(part.partNumber || 'N/A', 50, rowY, { width: 100 });
        doc.text(part.description, 160, rowY, { width: 200 });
        doc.text((part.quantity || 1).toString(), 370, rowY, { width: 40, align: 'right' });
        doc.text(`$${(part.cost || 0).toFixed(2)}`, 420, rowY, { width: 80, align: 'right' });
        doc.moveDown(0.8);
      });
    } else {
      doc.text('No parts used.');
    }

    doc.moveDown(0.5);

    // Cost summary
    const summaryX = 350;
    doc.font('Helvetica');
    doc.text('Parts Total:', summaryX, doc.y, { width: 100, continued: true });
    doc.text(`$${data.partsAndMaterials.totalPartsCost.toFixed(2)}`, { width: 80, align: 'right' });

    doc.text('Labor:', summaryX, doc.y, { width: 100, continued: true });
    doc.text(`$${data.partsAndMaterials.laborCost.toFixed(2)}`, { width: 80, align: 'right' });

    doc.moveDown(0.3);
    doc
      .moveTo(summaryX, doc.y)
      .lineTo(530, doc.y)
      .stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica-Bold');
    doc.text('Total:', summaryX, doc.y, { width: 100, continued: true });
    doc.text(`$${data.partsAndMaterials.totalCost.toFixed(2)}`, { width: 80, align: 'right' });
  }

  private addEquipmentStatus(doc: PDFKit.PDFDocument, data: ServiceReportData) {
    if (!data.equipmentStatus) return;

    doc.fontSize(14).font('Helvetica-Bold').text('Equipment Status');
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');

    if (data.equipmentStatus.meterReading) {
      doc.text(`Meter Reading: ${data.equipmentStatus.meterReading.toLocaleString()}`);
    }
    if (data.equipmentStatus.operationalStatus) {
      doc.text(`Status: ${data.equipmentStatus.operationalStatus}`);
    }
    if (data.equipmentStatus.nextServiceDue) {
      doc.text(`Next Service Due: ${this.formatDate(data.equipmentStatus.nextServiceDue)}`);
    }
  }

  private addQualityChecks(doc: PDFKit.PDFDocument, data: ServiceReportData) {
    if (!data.qualityChecks) return;

    doc.fontSize(14).font('Helvetica-Bold').text('Quality Checks');
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');

    const checks = [
      { label: 'Functional Test', value: data.qualityChecks.functionalTest },
      { label: 'Print Quality Test', value: data.qualityChecks.printQualityTest },
      { label: 'Network Connectivity', value: data.qualityChecks.networkConnectivity },
      { label: 'Customer Training', value: data.qualityChecks.customerTraining }
    ];

    checks.forEach(check => {
      const symbol = check.value ? '✓' : '✗';
      const text = check.value ? 'PASS' : 'N/A';
      doc.text(`${symbol} ${check.label}: ${text}`);
    });
  }

  private addCustomerApproval(doc: PDFKit.PDFDocument, data: ServiceReportData) {
    if (!data.customerApproval) return;

    doc.fontSize(14).font('Helvetica-Bold').text('Customer Approval');
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica');

    if (data.customerApproval.satisfactionRating) {
      const rating = '★'.repeat(data.customerApproval.satisfactionRating) +
                    '☆'.repeat(5 - data.customerApproval.satisfactionRating);
      doc.text(`Satisfaction Rating: ${rating} (${data.customerApproval.satisfactionRating}/5)`);
    }

    if (data.customerApproval.customerNotes) {
      doc.moveDown(0.3);
      doc.text(`Customer Notes: ${data.customerApproval.customerNotes}`);
    }

    if (data.customerApproval.signedAt) {
      doc.moveDown(0.5);
      doc.text(`Signed: ${this.formatDateTime(data.customerApproval.signedAt)}`);
      doc.moveDown(0.3);

      // Signature area (placeholder if no actual signature image)
      if (data.customerApproval.signature) {
        doc.text('[Customer Signature on File]');
      } else {
        doc.text('Signature: _________________________');
      }
    }
  }

  private addFooter(doc: PDFKit.PDFDocument, data: ServiceReportData) {
    const bottomMargin = 50;
    const footerTop = 792 - bottomMargin - 30; // Letter height - margin - footer height

    doc
      .fontSize(8)
      .font('Helvetica')
      .text(
        `Generated: ${this.formatDateTime(new Date())} | Report ID: ${data.reportId}`,
        50,
        footerTop,
        {
          align: 'center',
          width: 512
        }
      );

    doc.text(
      'This service report is generated automatically by Printyx Service Management System',
      50,
      footerTop + 12,
      {
        align: 'center',
        width: 512
      }
    );
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private formatDateTime(date: Date): string {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}

// Singleton instance
export const serviceReportPDFGenerator = new ServiceReportPDFGenerator();
