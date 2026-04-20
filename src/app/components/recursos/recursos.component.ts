import { Component } from '@angular/core';

@Component({
  selector: 'app-recursos',
  templateUrl: './recursos.component.html',
  styleUrls: ['./recursos.component.css']
})
export class RecursosComponent {
  activeSection: 'videos' | 'guias' | 'evidencias' = 'videos';

  setSection(section: 'videos' | 'guias' | 'evidencias') {
    this.activeSection = section;
  }
}
