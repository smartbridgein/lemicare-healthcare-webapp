import { Component, Input, OnChanges, SimpleChanges, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { RevenueStats } from '../../shared/billing.model';

Chart.register(...registerables);

@Component({
  selector: 'app-revenue-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card shadow mb-4">
      <div class="card-header py-3">
        <h6 class="m-0 font-weight-bold text-primary">Revenue Visualization</h6>
      </div>
      <div class="card-body">
        <div class="chart-container" style="position: relative; height:300px;">
          <canvas #chartCanvas></canvas>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chart-container {
      margin: auto;
      max-width: 100%;
    }
  `]
})
export class RevenueChartComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() revenueStats!: RevenueStats;
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  private chart: Chart | undefined;
  private chartId = `revenue-chart-${Math.random().toString(36).substring(2, 9)}`;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['revenueStats'] && this.revenueStats && this.chart) {
      this.updateChartData();
    }
  }

  ngAfterViewInit(): void {
    // Delay chart creation slightly to ensure the DOM is ready
    setTimeout(() => {
      this.createChart();
    }, 0);
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
  }

  private createChart(): void {
    if (!this.chartCanvas) return;

    // Destroy existing chart if it exists
    this.destroyChart();
    
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Invoices', 'Cash Memos', 'Receipts'],
        datasets: [{
          label: 'Revenue',
          data: [
            this.revenueStats?.invoicesRevenue || 0,
            this.revenueStats?.cashMemosRevenue || 0,
            this.revenueStats?.receiptsRevenue || 0
          ],
          backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Amount (INR)'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `${this.revenueStats?.periodLabel || ''} Revenue Breakdown`,
            font: {
              size: 16
            }
          },
          legend: {
            display: false
          }
        }
      }
    });
  }

  private updateChartData(): void {
    if (!this.chart || !this.chart.data.datasets) return;
    
    this.chart.data.datasets[0].data = [
      this.revenueStats.invoicesRevenue,
      this.revenueStats.cashMemosRevenue,
      this.revenueStats.receiptsRevenue
    ];

    // Update title
    if (this.chart.options?.plugins?.title) {
      this.chart.options.plugins.title.text = `${this.revenueStats.periodLabel} Revenue Breakdown`;
    }

    this.chart.update();
  }
}
