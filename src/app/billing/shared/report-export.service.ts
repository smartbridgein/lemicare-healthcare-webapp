import { Injectable } from '@angular/core';
import { RevenueStats, CategoryReport } from './billing.model';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Injectable({
  providedIn: 'root'
})
export class ReportExportService {

  constructor() { }

  /**
   * Export revenue stats to Excel file
   * @param revenueStats Revenue statistics to export
   */
  exportRevenueToExcel(revenueStats: RevenueStats): void {
    // Create data for Excel
    const data = [
      ['Revenue Report', ''],
      ['Period', revenueStats.periodLabel],
      ['Date Generated', new Date().toLocaleString()],
      ['', ''],
      ['Revenue Source', 'Amount (INR)'],
      ['Invoices', revenueStats.invoicesRevenue],
      ['Cash Memos', revenueStats.cashMemosRevenue],
      ['Receipts', revenueStats.receiptsRevenue],
      ['Total Revenue', revenueStats.totalRevenue]
    ];

    // Create worksheet and workbook
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Revenue Report');

    // Auto-size columns
    const max_width = data.reduce((w, r) => Math.max(w, r[0].toString().length), 10);
    worksheet['!cols'] = [{ wch: max_width }, { wch: 15 }];

    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, `Revenue_Report_${revenueStats.periodLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  /**
   * Export category report to Excel file
   * @param categoryReport Category report to export
   */
  exportCategoryReportToExcel(categoryReport: CategoryReport): void {
    // Header data
    const headerData = [
      ['Category Revenue Report', '', '', ''],
      ['Period', categoryReport.periodLabel, '', ''],
      ['Date Generated', new Date().toLocaleString(), '', ''],
      ['Total Revenue', categoryReport.totalRevenue, '', ''],
      ['Total Transactions', categoryReport.totalCount, '', ''],
      ['', '', '', ''],
      ['Category', 'Revenue (INR)', 'Transaction Count', '% of Total Revenue']
    ];

    // Category data rows
    const categoryData = categoryReport.categories.map(category => [
      category.category,
      category.revenue,
      category.count,
      (category.revenue / categoryReport.totalRevenue * 100).toFixed(2) + '%'
    ]);

    // Combine header and category data
    const data = [...headerData, ...categoryData];

    // Create worksheet and workbook
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Category Report');

    // Auto-size columns
    const colWidths = [25, 15, 15, 15];
    worksheet['!cols'] = colWidths.map(wch => ({ wch }));

    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, `Category_Report_${categoryReport.periodLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  /**
   * Export revenue stats as PDF
   * @param revenueStats Revenue statistics to export
   * @param chartElement Optional HTML element containing chart to include in PDF
   */
  async exportRevenueToPdf(revenueStats: RevenueStats, chartElement?: HTMLElement): Promise<void> {
    // Create PDF document (A4 size)
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    
    // Add title
    doc.setFontSize(16);
    doc.text('Revenue Report', pageWidth / 2, 20, { align: 'center' });
    
    // Add period and date
    doc.setFontSize(12);
    doc.text(`Period: ${revenueStats.periodLabel}`, 20, 30);
    doc.text(`Date Generated: ${new Date().toLocaleString()}`, 20, 38);
    
    // Add revenue data table
    doc.setFontSize(12);
    doc.line(20, 45, pageWidth - 20, 45);
    
    doc.text('Revenue Source', 20, 52);
    doc.text('Amount (INR)', pageWidth - 50, 52);
    
    doc.text('Invoices', 20, 60);
    doc.text(this.formatCurrency(revenueStats.invoicesRevenue), pageWidth - 50, 60);
    
    doc.text('Cash Memos', 20, 68);
    doc.text(this.formatCurrency(revenueStats.cashMemosRevenue), pageWidth - 50, 68);
    
    doc.text('Receipts', 20, 76);
    doc.text(this.formatCurrency(revenueStats.receiptsRevenue), pageWidth - 50, 76);
    
    doc.line(20, 83, pageWidth - 20, 83);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Total Revenue', 20, 91);
    doc.text(this.formatCurrency(revenueStats.totalRevenue), pageWidth - 50, 91);
    doc.setFont('helvetica', 'normal');
    
    // Add chart if provided
    if (chartElement) {
      try {
        const canvas = await html2canvas(chartElement);
        const imageData = canvas.toDataURL('image/png');
        
        // Calculate dimensions to fit chart in PDF
        const imgWidth = pageWidth - 40;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        doc.addPage();
        doc.text('Revenue Chart', pageWidth / 2, 20, { align: 'center' });
        doc.addImage(imageData, 'PNG', 20, 30, imgWidth, imgHeight);
      } catch (error) {
        console.error('Error generating chart for PDF:', error);
      }
    }

    // Save the PDF
    doc.save(`Revenue_Report_${revenueStats.periodLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Export category report as PDF
   * @param categoryReport Category report to export
   * @param chartElement Optional HTML element containing chart to include in PDF
   */
  async exportCategoryReportToPdf(categoryReport: CategoryReport, chartElement?: HTMLElement): Promise<void> {
    // Create PDF document (A4 size)
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    
    // Add title
    doc.setFontSize(16);
    doc.text('Category Revenue Report', pageWidth / 2, 20, { align: 'center' });
    
    // Add period and date
    doc.setFontSize(12);
    doc.text(`Period: ${categoryReport.periodLabel}`, 20, 30);
    doc.text(`Date Generated: ${new Date().toLocaleString()}`, 20, 38);
    doc.text(`Total Revenue: ${this.formatCurrency(categoryReport.totalRevenue)}`, 20, 46);
    doc.text(`Total Transactions: ${categoryReport.totalCount}`, 20, 54);
    
    // Add category data table
    doc.setFontSize(10);
    const tableTop = 65;
    const rowHeight = 8;
    
    // Table headers
    doc.line(20, tableTop - 3, pageWidth - 20, tableTop - 3);
    doc.setFont('helvetica', 'bold');
    doc.text('Category', 20, tableTop);
    doc.text('Revenue (INR)', 90, tableTop);
    doc.text('Count', 130, tableTop);
    doc.text('% of Total', 160, tableTop);
    doc.setFont('helvetica', 'normal');
    doc.line(20, tableTop + 3, pageWidth - 20, tableTop + 3);
    
    // Table rows - limit to top 15 categories for space
    const categoriesToShow = categoryReport.categories.slice(0, 15);
    
    categoriesToShow.forEach((category, index) => {
      const y = tableTop + ((index + 1) * rowHeight);
      
      // Truncate long category names
      const displayCategory = category.category.length > 25 
        ? category.category.substring(0, 22) + '...' 
        : category.category;
      
      doc.text(displayCategory, 20, y);
      doc.text(this.formatCurrency(category.revenue), 90, y);
      doc.text(category.count.toString(), 130, y);
      doc.text((category.revenue / categoryReport.totalRevenue * 100).toFixed(2) + '%', 160, y);
    });
    
    // Add note if categories were truncated
    if (categoryReport.categories.length > 15) {
      const noteY = tableTop + ((categoriesToShow.length + 1) * rowHeight) + 5;
      doc.text(`* Showing top 15 of ${categoryReport.categories.length} categories`, 20, noteY);
    }
    
    // Add chart if provided
    if (chartElement) {
      try {
        const canvas = await html2canvas(chartElement);
        const imageData = canvas.toDataURL('image/png');
        
        // Calculate dimensions to fit chart in PDF
        const imgWidth = pageWidth - 40;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        doc.addPage();
        doc.text('Category Revenue Chart', pageWidth / 2, 20, { align: 'center' });
        doc.addImage(imageData, 'PNG', 20, 30, imgWidth, imgHeight);
      } catch (error) {
        console.error('Error generating chart for PDF:', error);
      }
    }

    // Save the PDF
    doc.save(`Category_Report_${categoryReport.periodLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Format currency value with Indian Rupee formatting
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  }
}
