import { Component, EventEmitter, Input, Output, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { formatDate } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-revenue-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './revenue-details-modal.component.html',
  styleUrls: ['./revenue-details-modal.component.scss']
})
export class RevenueDetailsModalComponent implements AfterViewInit, OnDestroy {
  @Input() cashMemos: any[] = [];
  @Input() invoices: any[] = [];
  @Input() sales: any[] = [];
  @Input() advances: any[] = [];
  
  @Output() closed = new EventEmitter<void>();

  // Chart ViewChild references
  @ViewChild('revenueChart') revenueChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChart') categoryChartCanvas!: ElementRef<HTMLCanvasElement>;
  
  // Chart instances
  private revenueChart: Chart<'doughnut'> | undefined;
  private categoryChart: Chart<'bar'> | undefined;

  // Calculate totals
  get cashMemoTotal(): number {
    return this.cashMemos.reduce((sum, memo) => sum + (memo.amount || 0), 0);
  }

  get otcSalesTotal(): number {
    return this.sales
      .filter(sale => sale.saleType === 'OTC')
      .reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);
  }

  get prescriptionSalesTotal(): number {
    return this.sales
      .filter(sale => sale.saleType === 'PRESCRIPTION')
      .reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);
  }

  get invoiceTotal(): number {
    return this.invoices.reduce((sum, invoice) => sum + (invoice.grandTotal || 0), 0);
  }

  get advanceTotal(): number {
    return this.advances.reduce((sum, advance) => sum + (advance.amount || 0), 0);
  }

  get grandTotal(): number {
    return this.cashMemoTotal + this.invoiceTotal + this.otcSalesTotal + this.prescriptionSalesTotal + this.advanceTotal;
  }

  // Get OTC sales only
  get otcSales(): any[] {
    return this.sales.filter(sale => sale.saleType === 'OTC');
  }

  // Get Prescription sales only
  get prescriptionSales(): any[] {
    return this.sales.filter(sale => sale.saleType === 'PRESCRIPTION');
  }

  /**
   * Export revenue details to Excel
   */
  exportToExcel(): void {
    const today = new Date();
    const formattedDate = formatDate(today, 'yyyy-MM-dd', 'en-US');
    
    // Create header for the report
    const headerRows = [
      ['Today\'s Revenue Details Report', '', '', '', '', ''],
      ['Date:', formattedDate, '', '', '', ''],
      ['', '', '', '', '', ''],
      ['SUMMARY', '', '', '', '', ''],
      ['Revenue Type', 'Amount (₹)', '', '', '', ''],
      ['Cash Memo Revenue', this.cashMemoTotal, '', '', '', ''],
      ['Invoice Revenue', this.invoiceTotal, '', '', '', ''],
      ['OTC Sales Revenue', this.otcSalesTotal, '', '', '', ''],
      ['Prescription Sales Revenue', this.prescriptionSalesTotal, '', '', '', ''],
      ['Advance Payments', this.advanceTotal, '', '', '', ''],
      ['TOTAL REVENUE', this.grandTotal, '', '', '', ''],
      ['', '', '', '', '', ''],
    ];

    // Cash Memo Details
    const cashMemoHeaders = [
      ['CASH MEMO DETAILS', '', '', '', '', ''],
      ['Memo Number', 'Patient', 'Doctor', 'Date', 'Amount (₹)', 'Notes']
    ];
    
    // Log cash memos for debugging
    console.log('Cash Memos for Excel export:', this.cashMemos);
    
    const cashMemoRows = this.cashMemos.map(memo => {
      // Debug individual memo
      console.log('Processing cash memo:', memo);
      return [
        memo.memoNumber || memo.id || '',
        memo.patientName || (memo.patient ? memo.patient.name : '') || '',
        memo.doctorName || (memo.doctor ? memo.doctor.name : '') || '',
        memo.createdDate || formatDate(memo.createdAt || new Date(), 'yyyy-MM-dd', 'en-US') || '',
        memo.amount || 0,
        memo.notes || ''
      ];
    });
    
    // Invoice Details
    const invoiceHeaders = [
      ['', '', '', '', '', ''],
      ['INVOICE DETAILS', '', '', '', '', ''],
      ['Invoice Number', 'Patient', 'Date', 'Items', 'Grand Total (₹)', 'Status']
    ];
    
    // Log invoices for debugging
    console.log('Invoices for Excel export:', this.invoices);
    
    const invoiceRows = this.invoices.map(invoice => {
      // Debug individual invoice
      console.log('Processing invoice:', invoice);
      return [
        invoice.invoiceNumber || invoice.invoiceId || invoice.id || '',
        invoice.patientName || (invoice.patient ? invoice.patient.name : '') || '',
        invoice.createdDate || invoice.date || formatDate(invoice.createdAt || new Date(), 'yyyy-MM-dd', 'en-US') || '',
        (invoice.items || invoice.lineItems || []).length + ' items',
        invoice.grandTotal || invoice.amount || 0,
        invoice.status || 'PENDING'
      ];
    });
    
    // OTC Sales Details
    const otcSalesHeaders = [
      ['', '', '', '', '', ''],
      ['OTC SALES DETAILS', '', '', '', '', ''],
      ['Sale ID', 'Customer', 'Date', 'Products', 'Grand Total (₹)', 'Payment Mode']
    ];
    
    // Log OTC sales for debugging
    console.log('OTC Sales for Excel export:', this.otcSales);
    
    const otcSalesRows = this.otcSales.map(sale => {
      // Debug individual sale
      console.log('Processing OTC sale:', sale);
      // Log all possible ID fields to see what's available
      console.log('OTC Sale ID fields:', { 
        id: sale.id, 
        saleId: sale.saleId, 
        _id: sale._id 
      });
      
      // Extract the sale ID, checking all possible field names
      const saleId = sale.saleId || sale.id || sale._id || '';
      
      return [
        saleId,
        sale.customerName || sale.walkInCustomerName || sale.patientName || '',
        this.formatDate(sale.saleDate) || '',
        (sale.items || []).length + ' items',
        sale.grandTotal || 0,
        sale.paymentMode || sale.paymentMethod || 'CASH'
      ];
    });
    
    console.log('OTC sales rows:', otcSalesRows);
    
    // Prescription Sales Details
    const prescriptionSalesHeaders = [
      ['', '', '', '', '', ''],
      ['PRESCRIPTION SALES DETAILS', '', '', '', '', ''],
      ['Sale ID', 'Patient', 'Doctor', 'Date', 'Grand Total (₹)', 'Payment Mode']
    ];
    
    // Log prescription sales for debugging
    console.log('Prescription Sales for Excel export:', this.prescriptionSales);
    
    const prescriptionSalesRows = this.prescriptionSales.map(sale => {
      // Debug individual sale
      console.log('Processing Prescription sale:', sale);
      // Log all possible ID fields to see what's available
      console.log('Prescription Sale ID fields:', { 
        id: sale.id, 
        saleId: sale.saleId, 
        _id: sale._id 
      });
      
      // Extract the sale ID, checking all possible field names
      const saleId = sale.saleId || sale.id || sale._id || '';
      
      return [
        saleId,
        sale.patientName || (sale.patient ? sale.patient.name : '') || '',
        sale.doctorName || (sale.doctor ? sale.doctor.name : '') || '',
        this.formatDate(sale.saleDate) || '',
        sale.grandTotal || 0,
        sale.paymentMode || sale.paymentMethod || 'CASH'
      ];
    });
    
    console.log('Prescription sales rows:', prescriptionSalesRows);
    
    // Advance Payments Details
    const advanceHeaders = [
      ['', '', '', '', '', ''],
      ['ADVANCE PAYMENTS DETAILS', '', '', '', '', ''],
      ['Advance ID', 'Patient', 'Date', 'Amount (₹)', 'Payment Mode', 'Created By']
    ];
    
    // Log advances for debugging
    console.log('Advances for Excel export:', this.advances);
    
    const advanceRows = this.advances.map(advance => {
      // Debug individual advance
      console.log('Processing advance:', advance);
      return [
        advance.advanceId || advance.id || '',
        advance.patientName || '',
        advance.createdDate || advance.date || '',
        advance.amount || 0,
        advance.modeOfPayment || 'CASH',
        advance.createdBy || 'System'
      ];
    });
    
    // Combine all rows for the worksheet
    const allRows = [
      ...headerRows,
      ...cashMemoHeaders,
      ...cashMemoRows,
      ...invoiceHeaders,
      ...invoiceRows,
      ...otcSalesHeaders,
      ...otcSalesRows,
      ...prescriptionSalesHeaders,
      ...prescriptionSalesRows,
      ...advanceHeaders,
      ...advanceRows
    ];
    
    // Create the workbook and worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(allRows);
    const workbook = XLSX.utils.book_new();
    
    // Set column widths
    const columnWidths = [20, 20, 20, 15, 15, 25];
    worksheet['!cols'] = columnWidths.map(width => ({ wch: width }));
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Revenue Details');
    
    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, `Revenue_Details_${formattedDate}.xlsx`);
  }

  /**
   * Close the modal
   */
  close(): void {
    this.closed.emit();
  }

  /**
   * Format timestamp to readable date
   * @param dateObj Firebase timestamp or date object
   */
  private formatDate(dateObj: any): string {
    if (!dateObj) return '';
    
    let date: Date;
    // Handle Firebase Timestamp format with seconds and nanoseconds
    if (dateObj.seconds) {
      date = new Date(dateObj.seconds * 1000);
    } else if (dateObj instanceof Date) {
      date = dateObj;
    } else if (typeof dateObj === 'string') {
      // Try to parse as ISO string
      try {
        date = new Date(dateObj);
      } catch (e) {
        return dateObj; // Return the string if it can't be parsed
      }
    } else if (typeof dateObj === 'number') {
      // Handle timestamp as number
      date = new Date(dateObj);
    } else {
      return '';
    }
    
    return formatDate(date, 'yyyy-MM-dd', 'en-US');
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeCharts();
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.revenueChart) {
      this.revenueChart.destroy();
    }
    if (this.categoryChart) {
      this.categoryChart.destroy();
    }
  }

  private initializeCharts(): void {
    this.createRevenueChart();
    this.createCategoryChart();
  }

  private createRevenueChart(): void {
    if (!this.revenueChartCanvas) return;

    const ctx = this.revenueChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const data = {
      labels: ['Cash Memo', 'Invoice', 'OTC Sales', 'Prescription', 'Advances'],
      datasets: [{
        data: [
          this.cashMemoTotal,
          this.invoiceTotal,
          this.otcSalesTotal,
          this.prescriptionSalesTotal,
          this.advanceTotal
        ],
        backgroundColor: [
          '#6b1d14', // Maroon
          '#8b2635', // Dark red
          '#e6c157', // Yellow
          '#d4af37', // Gold
          '#b8860b'  // Dark goldenrod
        ],
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 10
      }]
    };

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true,
              font: {
                family: 'Inter, sans-serif',
                size: 12,
                weight: '500'
              },
              color: '#2c3e50'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#6b1d14',
            borderWidth: 1,
            cornerRadius: 8,
            callbacks: {
              label: (context) => {
                const value = context.parsed;
                const data = context.dataset.data as number[];
                const total = data.reduce((a: number, b: number) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                return `${context.label}: ₹${value.toLocaleString()} (${percentage}%)`;
              }
            }
          }
        },
        cutout: '60%',
        animation: {
          duration: 1000
        }
      }
    };

    this.revenueChart = new Chart(ctx, config);
  }

  private createCategoryChart(): void {
    if (!this.categoryChartCanvas) return;

    const ctx = this.categoryChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const categories = ['Cash Memo', 'Invoice', 'OTC Sales', 'Prescription', 'Advances'];
    const values = [
      this.cashMemoTotal,
      this.invoiceTotal,
      this.otcSalesTotal,
      this.prescriptionSalesTotal,
      this.advanceTotal
    ];

    const data = {
      labels: categories,
      datasets: [{
        label: 'Revenue Amount (₹)',
        data: values,
        backgroundColor: [
          'rgba(107, 29, 20, 0.8)',
          'rgba(139, 38, 53, 0.8)',
          'rgba(230, 193, 87, 0.8)',
          'rgba(212, 175, 55, 0.8)',
          'rgba(184, 134, 11, 0.8)'
        ],
        borderColor: [
          '#6b1d14',
          '#8b2635',
          '#e6c157',
          '#d4af37',
          '#b8860b'
        ],
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }]
    };

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#6b1d14',
            borderWidth: 1,
            cornerRadius: 8,
            callbacks: {
              label: (context) => {
                return `${context.label}: ₹${context.parsed.y.toLocaleString()}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
              color: '#666666',
              font: {
                family: 'Inter, sans-serif',
                size: 11
              },
              callback: function(value) {
                return '₹' + Number(value).toLocaleString();
              }
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#666666',
              font: {
                family: 'Inter, sans-serif',
                size: 11,
                weight: '500'
              },
              maxRotation: 45
            }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        }
      }
    };

    this.categoryChart = new Chart(ctx, config);
  }
}
