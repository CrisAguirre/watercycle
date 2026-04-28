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

    // Clonar el contenido para no modificar el DOM original
    const clone = this.exportContent.nativeElement.cloneNode(true) as HTMLElement;

    // Reemplazar cada href relativo del botón con la URL absoluta del div .raw-link adyacente
    clone.querySelectorAll('a.link-btn').forEach((anchor: Element) => {
      const rawLinkDiv = anchor.nextElementSibling;
      if (rawLinkDiv && rawLinkDiv.classList.contains('raw-link')) {
        const fullUrl = rawLinkDiv.textContent?.trim() || '';
        if (fullUrl.startsWith('https://')) {
          (anchor as HTMLAnchorElement).href = fullUrl;
        }
      }
    });

    const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Resumen Laboratorios</title>
    <xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml>
    <style>
      @page {
        size: landscape;
        mso-page-orientation: landscape;
        margin: 1.5cm 1.8cm 1.5cm 1.8cm;
      }
      body { font-family: Arial, sans-serif; font-size: 10pt; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; font-size: 9pt; }
      th { background-color: #f2f2f2; font-weight: bold; }
      .text-center { text-align: center; }
      .raw-link { font-size: 8pt; color: #555; margin-top: 4px; word-break: break-all; }
      .link-btn { display: inline-block; margin-bottom: 4px; }
    </style>
    </head><body>`;
    const postHtml = "</body></html>";
    const html = preHtml + clone.innerHTML + postHtml;

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
