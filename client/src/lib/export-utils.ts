/**
 * Export utilities for bulk data export operations
 */

export interface ExportColumn<T> {
  key: keyof T | string;
  label: string;
  format?: (value: any, row: T) => string;
}

export interface ExportOptions {
  filename?: string;
  fileExtension?: 'csv' | 'json' | 'xlsx';
  includeHeaders?: boolean;
}

/**
 * Export data to CSV format
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions = {},
) {
  const { filename = 'export', includeHeaders = true } = options;

  // Build CSV content
  const rows: string[][] = [];

  // Add headers
  if (includeHeaders) {
    rows.push(columns.map((col) => col.label));
  }

  // Add data rows
  data.forEach((row) => {
    const rowData = columns.map((col) => {
      const key = col.key as keyof T;
      let value = row[key];

      // Apply custom formatting if provided
      if (col.format) {
        value = col.format(value, row);
      }

      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }

      // Convert to string and escape quotes
      let stringValue = String(value);

      // Wrap in quotes if contains comma, newline, or quotes
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        stringValue = `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    });
    rows.push(rowData);
  });

  // Convert to CSV string
  const csvContent = rows.map((row) => row.join(',')).join('\n');

  // Create blob and download
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Export data to JSON format
 */
export function exportToJSON<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions = {},
) {
  const { filename = 'export' } = options;

  // Transform data using columns
  const transformedData = data.map((row) => {
    const obj: Record<string, any> = {};
    columns.forEach((col) => {
      const key = col.key as keyof T;
      let value = row[key];

      if (col.format) {
        value = col.format(value, row);
      }

      obj[col.label] = value;
    });
    return obj;
  });

  const jsonContent = JSON.stringify(transformedData, null, 2);
  downloadFile(jsonContent, `${filename}.json`, 'application/json;charset=utf-8;');
}

/**
 * Helper function to trigger file download
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format currency value for export
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '$0.00';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numValue);
}

/**
 * Format date value for export
 */
export function formatDate(
  value: string | Date | null | undefined,
  format: 'short' | 'long' = 'short',
): string {
  if (!value) return '';

  const date = typeof value === 'string' ? new Date(value) : value;

  if (format === 'long') {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString('en-US');
}

/**
 * Format boolean value for export
 */
export function formatBoolean(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value ? 'Yes' : 'No';
}

/**
 * Format array/list value for export
 */
export function formatArray(value: any[] | null | undefined, separator: string = ', '): string {
  if (!value || !Array.isArray(value)) return '';
  return value.join(separator);
}

/**
 * Create export columns helper with common formatters
 */
export function createExportColumn<T>(
  key: keyof T | string,
  label: string,
  formatter?: 'currency' | 'date' | 'longDate' | 'boolean' | ((value: any, row: T) => string),
): ExportColumn<T> {
  let format: ((value: any, row: T) => string) | undefined;

  if (typeof formatter === 'function') {
    format = formatter;
  } else if (formatter === 'currency') {
    format = (value) => formatCurrency(value);
  } else if (formatter === 'date') {
    format = (value) => formatDate(value, 'short');
  } else if (formatter === 'longDate') {
    format = (value) => formatDate(value, 'long');
  } else if (formatter === 'boolean') {
    format = (value) => formatBoolean(value);
  }

  return { key, label, format };
}
