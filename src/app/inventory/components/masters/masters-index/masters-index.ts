import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-masters-index',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './masters-index.html',
  styleUrls: ['./masters-index.scss']
})
export class MastersIndexComponent implements OnInit {
  activeTab = 'medicine';

  constructor() { }

  ngOnInit(): void {
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
}
