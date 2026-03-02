/**
 * Export Utilities
 *
 * Utilities for exporting data to CSV, PDF, etc.
 */
import { captureHandledError } from '../services/errorLog.service';

const removeUnsafeNodes = (root: ParentNode) => {
  root.querySelectorAll('script, iframe, object, embed').forEach((node) => node.remove());
  root.querySelectorAll<HTMLElement>('*').forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const key = attr.name.toLowerCase();
      if (key.startsWith('on')) node.removeAttribute(attr.name);
    });
  });
};

const renderPrintableDocument = (
  printWindow: Window,
  title: string,
  sourceElement: HTMLElement,
  extraHeadLinks: string[] = [],
) => {
  const doc = printWindow.document;
  doc.open();
  doc.write('<!doctype html><html><head></head><body></body></html>');
  doc.close();

  if (!doc.head || !doc.body) return;

  const titleEl = doc.createElement('title');
  titleEl.textContent = title;
  doc.head.appendChild(titleEl);

  extraHeadLinks.forEach((href) => {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    doc.head.appendChild(link);
  });

  const style = doc.createElement('style');
  style.textContent = `
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f3f4f6;
    }
    @media print {
      button {
        display: none;
      }
    }
  `;
  doc.head.appendChild(style);

  const safeClone = sourceElement.cloneNode(true) as HTMLElement;
  removeUnsafeNodes(safeClone);
  doc.body.appendChild(doc.importNode(safeClone, true));

  printWindow.addEventListener('load', () => {
    printWindow.print();
    printWindow.close();
  }, { once: true });
};

// ============================================================================
// CSV EXPORT
// ============================================================================

/**
 * Convert data to CSV format
 */
export const convertToCSV = (data: any[], headers?: string[]): string => {
  if (data.length === 0) return '';

  // Get headers from first object if not provided
  const csvHeaders = headers || Object.keys(data[0]);

  // Create header row
  const headerRow = csvHeaders.join(',');

  // Create data rows
  const dataRows = data.map(item => {
    return csvHeaders.map(header => {
      const value = item[header];

      // Handle different value types
      if (value === null || value === undefined) {
        return '';
      }

      // Convert dates to string
      if (value instanceof Date) {
        return value.toISOString();
      }

      // Escape commas and quotes in strings
      if (typeof value === 'string') {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }

      return value.toString();
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
};

/**
 * Download CSV file
 */
export const downloadCSV = (data: any[], filename: string, headers?: string[]): void => {
  const csv = convertToCSV(data, headers);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ============================================================================
// JSON EXPORT
// ============================================================================

/**
 * Download JSON file
 */
export const downloadJSON = (data: any, filename: string): void => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');

  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.json`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ============================================================================
// PDF EXPORT (Basic - for production use jsPDF or similar)
// ============================================================================

/**
 * Download HTML content as PDF (requires print functionality)
 */
export const exportToPDF = (elementId: string, filename: string): void => {
  const element = document.getElementById(elementId);

  if (!element) {
    void captureHandledError(new Error(`Element with id ${elementId} not found`), {
      source: 'frontend',
      scope: 'unknown',
      metadata: { kind: 'export.pdf.element_not_found', elementId, filename },
    });
    return;
  }

  // Create a new window for printing
  const printWindow = window.open('', '', 'width=800,height=600');

  if (!printWindow) {
    void captureHandledError(new Error('Could not open print window'), {
      source: 'frontend',
      scope: 'unknown',
      metadata: { kind: 'export.pdf.print_window', elementId, filename },
    });
    return;
  }

  renderPrintableDocument(printWindow, filename, element);
};

// ============================================================================
// EXCEL EXPORT (Basic)
// ============================================================================

/**
 * Download data as Excel file (using CSV with .xls extension)
 * For true Excel format, use a library like xlsx
 */
export const downloadExcel = (data: any[], filename: string, headers?: string[]): void => {
  const csv = convertToCSV(data, headers);
  const blob = new Blob([csv], { type: 'application/vnd.ms-excel' });
  const link = document.createElement('a');

  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.xls`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ============================================================================
// PRINT UTILITIES
// ============================================================================

/**
 * Print element content
 */
export const printElement = (elementId: string): void => {
  const element = document.getElementById(elementId);

  if (!element) {
    void captureHandledError(new Error(`Element with id ${elementId} not found`), {
      source: 'frontend',
      scope: 'unknown',
      metadata: { kind: 'export.print.element_not_found', elementId },
    });
    return;
  }

  const printWindow = window.open('', '', 'width=800,height=600');

  if (!printWindow) {
    void captureHandledError(new Error('Could not open print window'), {
      source: 'frontend',
      scope: 'unknown',
      metadata: { kind: 'export.print.print_window', elementId },
    });
    return;
  }

  renderPrintableDocument(printWindow, 'Print', element, [`${window.location.origin}/styles.css`]);
};

// ============================================================================
// FORMAT HELPERS
// ============================================================================

/**
 * Format data for export
 */
export const formatForExport = (data: any[]): any[] => {
  return data.map(item => {
    const formatted: any = {};

    Object.keys(item).forEach(key => {
      const value = item[key];

      // Skip functions and undefined
      if (typeof value === 'function' || value === undefined) {
        return;
      }

      // Format dates
      if (value instanceof Date) {
        formatted[key] = value.toLocaleDateString();
      }
      // Format timestamps
      else if (value && typeof value === 'object' && 'toDate' in value) {
        formatted[key] = value.toDate().toLocaleDateString();
      }
      // Format objects
      else if (typeof value === 'object' && value !== null) {
        formatted[key] = JSON.stringify(value);
      }
      // Keep primitives
      else {
        formatted[key] = value;
      }
    });

    return formatted;
  });
};

/**
 * Create filename with timestamp
 */
export const createFilename = (base: string, extension: string): string => {
  const timestamp = new Date().toISOString().split('T')[0];
  return `${base}_${timestamp}.${extension}`;
};
