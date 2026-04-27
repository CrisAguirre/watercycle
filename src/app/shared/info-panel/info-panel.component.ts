import { Component, ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-info-panel',
  templateUrl: './info-panel.component.html',
  styleUrls: ['./info-panel.component.css']
})
export class InfoPanelComponent {
  isOpen = false;

  @ViewChild('exportContent') exportContent!: ElementRef;

  togglePanel() {
    this.isOpen = !this.isOpen;
  }

  exportToWord() {
    if (!this.exportContent) return;
    
    const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Resumen Laboratorios</title>
    <style>
      body { font-family: Arial, sans-serif; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #000; padding: 8px; text-align: left; vertical-align: top; }
      th { background-color: #f2f2f2; }
      .text-center { text-align: center; }
      .raw-link { font-size: 0.8em; color: #555; margin-top: 5px; word-break: break-all; }
      .link-btn { display: inline-block; margin-bottom: 5px; }
    </style>
    </head><body>`;
    const postHtml = "</body></html>";
    const html = preHtml + this.exportContent.nativeElement.innerHTML + postHtml;

    const blob = new Blob(['\ufeff', html], {
      type: 'application/msword'
    });
    
    const filename = 'Propuesta_Pedagogica_Ciclo_Agua.doc';
    const downloadLink = document.createElement("a");
    document.body.appendChild(downloadLink);
    
    if ((navigator as any).msSaveOrOpenBlob) {
        (navigator as any).msSaveOrOpenBlob(blob, filename);
    } else {
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = filename;
        downloadLink.click();
    }
    
    document.body.removeChild(downloadLink);
  }
}
