// Utility helpers to export data as CSV or PDF
// To use: import { exportToCSV, exportToPDF } from '../utils/exportUtils';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToCSV = (dataArray = [], columns = [], filename = 'export.csv') => {
  if (!dataArray.length) return;
  const header = columns.map(c => c.label || c.key);
  const csvRows = [header.join(',')];
  dataArray.forEach(item => {
    const row = columns.map(col => {
      const raw = item[col.key] ?? '';
      const cell = typeof raw === 'string' ? raw.replace(/"/g, '""') : raw;
      return `"${cell}"`;
    });
    csvRows.push(row.join(','));
  });
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export tabular data plus optional summary metrics & images to PDF
 * @param {Array} dataArray - rows of objects
 * @param {Array} columns - [{ key, label }]
 * @param {string} filename - download name
 * @param {string} title - document title
 * @param {Object} options
 *    summary: { label: value }
 *    images: [{ src, width, height }] base64 PNGs e.g. from html2canvas
 */
export const exportToPDF = (
  dataArray = [],
  columns = [],
  filename = 'export.pdf',
  title = 'Export',
  options = {}
) => {
  if (!dataArray.length) return;
  const doc = new jsPDF({ orientation: 'landscape' });

  // Title
  doc.setFontSize(16);
  doc.text(title, 14, 16);

  let currentY = 22;

  // Summary block
  if (options.summary && Object.keys(options.summary).length) {
    doc.setFontSize(10);
    Object.entries(options.summary).forEach(([k, v]) => {
      doc.text(`${k}: ${v}`, 14, currentY);
      currentY += 5;
    });
    currentY += 4; // spacing
  }

  // Table
  const tableColumn = columns.map(c => c.label || c.key);
  const tableRows = dataArray.map(item => columns.map(col => item[col.key] ?? ''));
  autoTable(doc, {
    startY: currentY,
    head: [tableColumn],
    body: tableRows,
    styles: { fontSize: 8 },
    theme: 'grid',
  });

  // Attach images (charts)
  if (Array.isArray(options.images) && options.images.length) {
    options.images.forEach((img, idx) => {
      doc.addPage();
      const w = img.width || 260;
      const h = img.height || 130;
      doc.addImage(img.src, 'PNG', 20, 40, w, h);
      if (img.caption) {
        doc.text(img.caption, 20, 30);
      }
    });
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 40, doc.internal.pageSize.getHeight() - 10);
  }

  doc.save(filename);
}; 