import { Component, Input, OnChanges, SimpleChanges, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { CategoryReport } from '../../shared/billing.model';

Chart.register(...registerables);

@Component({
  selector: 'app-category-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card shadow mb-4">
      <div class="card-header py-3">
        <h6 class="m-0 font-weight-bold text-primary">Category Revenue Breakdown</h6>
      </div>
      <div class="card-body">
        <div *ngIf="!categoryReport || categoryReport.categories.length === 0" class="text-center py-4">
          <p class="text-muted">No category data available for the selected period.</p>
        </div>
        <div *ngIf="categoryReport && categoryReport.categories.length > 0" class="chart-container" style="position: relative; height:400px;">
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
export class CategoryChartComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() categoryReport!: CategoryReport;
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  private chart: Chart | undefined;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categoryReport'] && this.categoryReport && this.chart) {
      this.updateChartData();
    } else if (changes['categoryReport'] && this.categoryReport && this.chartCanvas) {
      // If the chart hasn't been created yet but we have data and the canvas is available
      this.createChart();
    }
  }

  ngAfterViewInit(): void {
    if (this.categoryReport && this.categoryReport.categories.length > 0) {
      // Delay chart creation slightly to ensure the DOM is ready
      setTimeout(() => {
        this.createChart();
      }, 0);
    }
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
    if (!this.chartCanvas || !this.categoryReport || this.categoryReport.categories.length === 0) return;

    // Destroy existing chart if it exists
    this.destroyChart();
    
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Extract top 10 categories for better visualization
    const topCategories = this.categoryReport.categories
      .slice(0, 10); // Limit to top 10 categories

    const labels = topCategories.map(cat => cat.category);
    const revenueData = topCategories.map(cat => cat.revenue);
    const countData = topCategories.map(cat => cat.count);
    
    // Generate colors for each category
    const backgroundColors = [
      '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
      '#6f42c1', '#fd7e14', '#20c9a6', '#858796', '#5a5c69'
    ];

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Revenue',
            data: revenueData,
            backgroundColor: backgroundColors,
            borderWidth: 1,
            yAxisID: 'y'
          },
          {
            label: 'Count',
            data: countData,
            type: 'line',
            borderColor: '#858796',
            borderWidth: 2,
            pointBackgroundColor: '#858796',
            pointRadius: 3,
            fill: false,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            position: 'left',
            title: {
              display: true,
              text: 'Revenue (INR)'
            }
          },
          y1: {
            beginAtZero: true,
            position: 'right',
            title: {
              display: true,
              text: 'Count'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `${this.categoryReport.periodLabel} Category Analysis`,
            font: {
              size: 16
            }
          },
          legend: {
            display: true,
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw as number;
                if (context.datasetIndex === 0) {
                  return `Revenue: ₹${value.toLocaleString('en-IN')}`;
                } else {
                  return `Count: ${value}`;
                }
              }
            }
          }
        }
      }
    });
  }

  private updateChartData(): void {
    if (!this.chart || !this.categoryReport || this.categoryReport.categories.length === 0) return;
    
    // Extract top 10 categories for better visualization
    const topCategories = this.categoryReport.categories
      .slice(0, 10); // Limit to top 10 categories

    const labels = topCategories.map(cat => cat.category);
    const revenueData = topCategories.map(cat => cat.revenue);
    const countData = topCategories.map(cat => cat.count);
    
    // Update chart data
    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = revenueData;
    this.chart.data.datasets[1].data = countData;

    // Update title
    if (this.chart.options?.plugins?.title) {
      this.chart.options.plugins.title.text = `${this.categoryReport.periodLabel} Category Analysis`;
    }

    this.chart.update();
  }
}
