// =====================================================================
// REPORT EXPORT SERVICE
// Phase 2 Implementation - Multi-format Export Functionality
// =====================================================================

import fs from 'fs/promises';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { db } from './storage';
import { reportExecutions } from '../shared/reporting-schema';
import { eq } from 'drizzle-orm';

export interface ExportRequest {
  report_id: string;
  parameters: Record<string, any>;
  format: 'csv' | 'xlsx' | 'pdf';
  email_recipients?: string[];
  filename?: string;
}

export interface ExportResult {
  export_id: string;
  download_url?: string;
  file_path?: string;
  estimated_completion?: string;
  status: 'processing' | 'completed' | 'failed';
  error_message?: string;
}

// =====================================================================
// MAIN EXPORT SERVICE CLASS
// =====================================================================

export class ReportExportService {
  private static instance: ReportExportService;
  private exportDir: string;

  constructor() {
    this.exportDir = path.join(process.cwd(), 'exports');
    this.ensureExportDirectory();
  }

  public static getInstance(): ReportExportService {
    if (!ReportExportService.instance) {
      ReportExportService.instance = new ReportExportService();
    }
    return ReportExportService.instance;
  }

  // Ensure export directory exists
  private async ensureExportDirectory(): Promise<void> {
    try {
      await fs.access(this.exportDir);
    } catch {
      await fs.mkdir(this.exportDir, { recursive: true });
    }
  }

  // Main export method
  public async exportReport(
    tenantId: string,
    userId: string,
    exportRequest: ExportRequest
  ): Promise<ExportResult> {
    const exportId = this.generateExportId();
    
    try {
      // Log export request
      console.log(`🚀 Starting export ${exportId}:`, {
        reportId: exportRequest.report_id,
        format: exportRequest.format,
        userId,
        tenantId
      });

      // Generate filename if not provided
      const filename = exportRequest.filename || 
        `report_${exportRequest.report_id}_${new Date().toISOString().split('T')[0]}.${exportRequest.format}`;

      const filePath = path.join(this.exportDir, `${exportId}_${filename}`);

      // For now, we'll use mock data - in production, you'd fetch real report data
      const reportData = await this.fetchReportData(
        tenantId,
        exportRequest.report_id,
        exportRequest.parameters
      );

      // Export based on format
      let downloadUrl: string | undefined;
      
      switch (exportRequest.format) {
        case 'csv':
          await this.exportToCSV(reportData, filePath);
          downloadUrl = this.generateDownloadUrl(exportId, filename);
          break;
          
        case 'xlsx':
          await this.exportToExcel(reportData, filePath);
          downloadUrl = this.generateDownloadUrl(exportId, filename);
          break;
          
        case 'pdf':
          await this.exportToPDF(reportData, filePath, exportRequest);
          downloadUrl = this.generateDownloadUrl(exportId, filename);
          break;
          
        default:
          throw new Error(`Unsupported export format: ${exportRequest.format}`);
      }

      // Schedule cleanup (delete file after 24 hours)
      this.scheduleCleanup(filePath, 24 * 60 * 60 * 1000);

      console.log(`✅ Export ${exportId} completed successfully`);

      return {
        export_id: exportId,
        download_url: downloadUrl,
        file_path: filePath,
        status: 'completed'
      };

    } catch (error) {
      console.error(`❌ Export ${exportId} failed:`, error);
      
      return {
        export_id: exportId,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // =====================================================================
  // CSV EXPORT
  // =====================================================================

  private async exportToCSV(data: any[], filePath: string): Promise<void> {
    if (data.length === 0) {
      throw new Error('No data to export');
    }

    const headers = Object.keys(data[0]).map(key => ({
      id: key,
      title: this.formatColumnHeader(key)
    }));

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: headers,
      encoding: 'utf8'
    });

    // Format data for CSV
    const formattedData = data.map(row => {
      const formattedRow: any = {};
      Object.keys(row).forEach(key => {
        formattedRow[key] = this.formatCellValueForExport(row[key]);
      });
      return formattedRow;
    });

    await csvWriter.writeRecords(formattedData);
  }

  // =====================================================================
  // EXCEL EXPORT
  // =====================================================================

  private async exportToExcel(data: any[], filePath: string): Promise<void> {
    if (data.length === 0) {
      throw new Error('No data to export');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Printyx Reporting System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Report Data');

    // Add headers
    const headers = Object.keys(data[0]);
    const headerRow = worksheet.addRow(headers.map(h => this.formatColumnHeader(h)));
    
    // Style header row
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '366092' }
    };

    // Add data rows
    data.forEach(row => {
      const values = headers.map(header => this.formatCellValueForExport(row[header]));
      worksheet.addRow(values);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.header) {
        const maxLength = Math.max(
          column.header.toString().length,
          ...data.map(row => {
            const value = row[column.key as string];
            return value ? value.toString().length : 0;
          })
        );
        column.width = Math.min(maxLength + 2, 50); // Max width of 50
      }
    });

    // Add borders
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Add summary at the bottom if applicable
    if (data.length > 0) {
      worksheet.addRow([]); // Empty row
      const summaryRow = worksheet.addRow(['Total Records:', data.length]);
      summaryRow.font = { bold: true };
    }

    await workbook.xlsx.writeFile(filePath);
  }

  // =====================================================================
  // PDF EXPORT
  // =====================================================================

  private async exportToPDF(
    data: any[], 
    filePath: string, 
    exportRequest: ExportRequest
  ): Promise<void> {
    if (data.length === 0) {
      throw new Error('No data to export');
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = doc.pipe(require('fs').createWriteStream(filePath));

    // Add header
    doc.fontSize(20).text('Printyx Report', { align: 'center' });
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    // Add report metadata
    doc.fontSize(14).text(`Report ID: ${exportRequest.report_id}`);
    doc.text(`Format: PDF`);
    doc.text(`Records: ${data.length}`);
    doc.moveDown();

    // Table setup
    const headers = Object.keys(data[0]);
    const pageWidth = doc.page.width - 100; // Account for margins
    const columnWidth = pageWidth / headers.length;
    let yPosition = doc.y;

    // Draw table headers
    doc.fontSize(10).fillColor('black');
    headers.forEach((header, index) => {
      const x = 50 + (index * columnWidth);
      doc.rect(x, yPosition, columnWidth, 20).fill('#366092');
      doc.fillColor('white').text(
        this.formatColumnHeader(header), 
        x + 5, 
        yPosition + 5, 
        { width: columnWidth - 10, ellipsis: true }
      );
    });

    yPosition += 20;
    doc.fillColor('black');

    // Draw data rows
    const maxRowsPerPage = 25; // Adjust based on page size
    let rowCount = 0;

    for (const row of data) {
      // Check if we need a new page
      if (rowCount > 0 && rowCount % maxRowsPerPage === 0) {
        doc.addPage();
        yPosition = 50;
        
        // Redraw headers on new page
        headers.forEach((header, index) => {
          const x = 50 + (index * columnWidth);
          doc.rect(x, yPosition, columnWidth, 20).fill('#366092');
          doc.fillColor('white').text(
            this.formatColumnHeader(header), 
            x + 5, 
            yPosition + 5, 
            { width: columnWidth - 10, ellipsis: true }
          );
        });
        yPosition += 20;
        doc.fillColor('black');
      }

      // Draw row
      const rowColor = rowCount % 2 === 0 ? '#f9f9f9' : 'white';
      headers.forEach((header, index) => {
        const x = 50 + (index * columnWidth);
        doc.rect(x, yPosition, columnWidth, 20).fill(rowColor);
        doc.fillColor('black').text(
          this.formatCellValueForExport(row[header]), 
          x + 5, 
          yPosition + 5, 
          { width: columnWidth - 10, ellipsis: true }
        );
      });

      yPosition += 20;
      rowCount++;
    }

    // Add footer
    doc.fontSize(8).text(
      `Generated by Printyx Reporting System - ${new Date().toISOString()}`,
      50,
      doc.page.height - 30,
      { align: 'center' }
    );

    doc.end();

    // Wait for PDF to be written
    return new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  // =====================================================================
  // HELPER METHODS
  // =====================================================================

  private async fetchReportData(
    tenantId: string,
    reportId: string,
    parameters: Record<string, any>
  ): Promise<any[]> {
    // In production, this would execute the actual report query
    // For now, returning mock data structure
    return [
      {
        id: '1',
        company_name: 'Acme Corporation',
        estimated_amount: 15000,
        status: 'qualified',
        owner_name: 'John Smith',
        location_name: 'New York Office',
        created_at: '2025-01-01',
        pipeline_stage: 'Qualified'
      },
      {
        id: '2',
        company_name: 'Tech Solutions Inc',
        estimated_amount: 25000,
        status: 'proposal',
        owner_name: 'Jane Doe',
        location_name: 'Chicago Office',
        created_at: '2025-01-02',
        pipeline_stage: 'Proposal'
      },
      {
        id: '3',
        company_name: 'Global Enterprises',
        estimated_amount: 50000,
        status: 'negotiation',
        owner_name: 'Mike Johnson',
        location_name: 'Los Angeles Office',
        created_at: '2025-01-03',
        pipeline_stage: 'Negotiation'
      }
    ];
  }

  private formatColumnHeader(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private formatCellValueForExport(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value instanceof Date) return value.toLocaleDateString();
    if (typeof value === 'number') {
      // Format currency-like numbers
      if (value > 1000) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);
      }
      return value.toString();
    }
    return String(value);
  }

  private generateExportId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDownloadUrl(exportId: string, filename: string): string {
    // In production, this would be a secure signed URL
    return `/api/reporting/exports/${exportId}/download`;
  }

  private scheduleCleanup(filePath: string, delayMs: number): void {
    setTimeout(async () => {
      try {
        await fs.unlink(filePath);
        console.log(`🗑️ Cleaned up export file: ${filePath}`);
      } catch (error) {
        console.error(`Failed to cleanup export file: ${filePath}`, error);
      }
    }, delayMs);
  }

  // Public method to get export file
  public async getExportFile(exportId: string): Promise<{ filePath: string; filename: string } | null> {
    try {
      const files = await fs.readdir(this.exportDir);
      const exportFile = files.find(file => file.startsWith(exportId));
      
      if (!exportFile) {
        return null;
      }

      const filePath = path.join(this.exportDir, exportFile);
      const filename = exportFile.substring(exportFile.indexOf('_') + 1);
      
      return { filePath, filename };
    } catch (error) {
      console.error('Error finding export file:', error);
      return null;
    }
  }

  // Get export statistics
  public async getExportStats(): Promise<{
    totalExports: number;
    activeExports: number;
    exportsByFormat: Record<string, number>;
  }> {
    try {
      const files = await fs.readdir(this.exportDir);
      const exportsByFormat: Record<string, number> = {
        csv: 0,
        xlsx: 0,
        pdf: 0
      };

      files.forEach(file => {
        const extension = path.extname(file).substring(1);
        if (exportsByFormat.hasOwnProperty(extension)) {
          exportsByFormat[extension]++;
        }
      });

      return {
        totalExports: files.length,
        activeExports: files.length,
        exportsByFormat
      };
    } catch (error) {
      return {
        totalExports: 0,
        activeExports: 0,
        exportsByFormat: { csv: 0, xlsx: 0, pdf: 0 }
      };
    }
  }
}

// Export singleton instance
export const exportService = ReportExportService.getInstance();
