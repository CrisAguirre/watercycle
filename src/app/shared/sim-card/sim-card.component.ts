import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-sim-card',
  templateUrl: './sim-card.component.html',
  styleUrls: ['./sim-card.component.css']
})
export class SimCardComponent {
  @Input() simNumber: number = 0;
  @Input() title: string = '';
  @Input() description: string = '';
  @Input() icon: string = '';
  @Input() bloque: 'agua' | 'agro' | 'intro' = 'agua';
  @Input() available: boolean = true;
  @Input() routePath: string = '';
}
