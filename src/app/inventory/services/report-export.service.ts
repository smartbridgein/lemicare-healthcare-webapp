import { Injectable } from '@angular/core';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class ReportExportService {

  constructor() { }

  /**
   * Export data to Excel file
   * @param data Data to export
   * @param fileName Name of the file (without extension)
   */
  exportToExcel(data: any[], fileName: string): void {
    // Create worksheet
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    // Create workbook
    const workbook: XLSX.WorkBook = { 
      Sheets: { 'data': worksheet }, 
      SheetNames: ['data'] 
    };
    
    // Generate Excel buffer
    const excelBuffer: any = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array' 
    });
    
    // Save file
    this.saveExcelFile(excelBuffer, fileName);
  }

  /**
   * Save Excel buffer as file
   * @param buffer Excel buffer
   * @param fileName File name
   */
  private saveExcelFile(buffer: any, fileName: string): void {
    const data: Blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  /**
   * Export data to PDF
   * @param data Data to export
   * @param headers Table headers
   * @param title Report title
   * @param fileName File name (without extension)
   */
  exportToPdf(data: any[], headers: string[], title: string, fileName: string): void {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Add title
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    
    // Add timestamp
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    
    // Create table
    (doc as any).autoTable({
      head: [headers],
      body: data.map(item => headers.map(header => item[header.toLowerCase().replace(/ /g, '')])),
      startY: 35,
      theme: 'striped',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255
      }
    });
    
    // Save file
    doc.save(`${fileName}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Prepare data for chart rendering
   * @param data Raw data from API
   * @param labelField Field to use as label
   * @param valueField Field to use as value
   */
  prepareChartData(data: any[], labelField: string, valueField: string): { labels: string[], values: number[] } {
    const labels: string[] = [];
    const values: number[] = [];
    
    data.forEach(item => {
      labels.push(item[labelField]);
      values.push(item[valueField]);
    });
    
    return { labels, values };
  }
  
  /**
   * Export data to CSV file
   * @param data Array of arrays containing row data
   * @param headers Array of header strings
   * @param fileName Name of the file (without extension)
   */
  exportToCsv(data: any[][], headers: string[], fileName: string): void {
    // Create CSV content with headers
    let csvContent = headers.join(',') + '\n';
    
    // Add data rows
    data.forEach(row => {
      // Ensure values are properly escaped for CSV format
      const formattedRow = row.map(cell => {
        // If cell contains commas, quotes, or newlines, wrap it in quotes
        if (cell === null || cell === undefined) {
          return '';
        }
        
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          // Escape any existing quotes by doubling them
          return '"' + cellStr.replace(/"/g, '""') + '"';
        }
        return cellStr;
      }).join(',');
      
      csvContent += formattedRow + '\n';
    });
    
    // Create and save the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
  }
}
