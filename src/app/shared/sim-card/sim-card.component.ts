import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-sim-card',
  templateUrl: './sim-card.component.html',
  styleUrls: ['./sim-card.component.css']
})
export class SimCardComponent implements OnInit {
  @Input() simNumber: number = 0;
  @Input() title: string = '';
  @Input() description: string = '';
  @Input() icon: string = '';
  @Input() bloque: 'agua' | 'agro' | 'intro' = 'agua';
  @Input() available: boolean = true;
  @Input() routePath: string = '';

  isHighlighted: boolean = false;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['highlight'] !== undefined) {
        const highlightedSim = parseInt(params['highlight'], 10);
        if (this.simNumber === highlightedSim) {
          this.isHighlighted = true;
          // Remove animation class after it finishes (5 times 0.5s = 2.5s)
          setTimeout(() => {
            this.isHighlighted = false;
          }, 2600);
        }
      }
    });
  }
}
