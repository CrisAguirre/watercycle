import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { EvidenciaService } from '../../../services/evidencia.service';

@Component({
  selector: 'app-sim0-introduccion',
  templateUrl: './sim0-introduccion.component.html',
  styleUrls: ['./sim0-introduccion.component.css']
})
export class Sim0IntroduccionComponent implements OnInit {
  activeTab = 'ejemplos';
  videoUrl: SafeResourceUrl;
  
  lluviaIdeas = '';
  conclusion = '';
  
  isLluviaIdeasSaved = false;
  isConclusionSaved = false;
  
  loading = false;
  message = '';

  constructor(
    private sanitizer: DomSanitizer,
    private evidenciaService: EvidenciaService
  ) {
    // YouTube embed URL
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl('https://www.youtube.com/embed/5QvtYwyHpfc?start=148');
  }

  ngOnInit(): void {
    this.checkPreviousSubmissions();
  }

  checkPreviousSubmissions(): void {
    this.evidenciaService.getEvidencias().subscribe(evidencias => {
      this.isLluviaIdeasSaved = evidencias.some(e => e.titulo === 'Lluvia de Ideas: Laboratorio de Introducción' || e.titulo === 'Apreciación: Laboratorio de Introducción');
      this.isConclusionSaved = evidencias.some(e => e.titulo === 'Síntesis Final: Laboratorio de Introducción');
      
      const prevLluvia = evidencias.find(e => e.titulo === 'Lluvia de Ideas: Laboratorio de Introducción' || e.titulo === 'Apreciación: Laboratorio de Introducción');
      if (prevLluvia) this.lluviaIdeas = prevLluvia.contenido;
      
      const prevConclusion = evidencias.find(e => e.titulo === 'Síntesis Final: Laboratorio de Introducción');
      if (prevConclusion) this.conclusion = prevConclusion.contenido;
    });
  }

  setTab(tab: string): void {
    this.activeTab = tab;
  }

  saveLluviaIdeas(): void {
    if (this.isLluviaIdeasSaved || !this.lluviaIdeas.trim()) return;
    
    this.loading = true;
    this.evidenciaService.saveTextEvidencia({
      titulo: 'Lluvia de Ideas: Laboratorio de Introducción',
      contenido: this.lluviaIdeas,
      tipoArchivo: 'texto'
    }).subscribe({
      next: () => {
        this.isLluviaIdeasSaved = true;
        this.loading = false;
        this.message = 'Lluvia de Ideas guardada con éxito en la sección de evidencias.';
      },
      error: () => {
        this.loading = false;
        this.message = 'Error al guardar la Lluvia de Ideas.';
      }
    });
  }

  saveConclusion(): void {
    if (this.isConclusionSaved || !this.conclusion.trim()) return;
    
    this.loading = true;
    this.evidenciaService.saveTextEvidencia({
      titulo: 'Síntesis Final: Laboratorio de Introducción',
      contenido: this.conclusion,
      tipoArchivo: 'texto'
    }).subscribe({
      next: () => {
        this.isConclusionSaved = true;
        this.loading = false;
        this.message = 'Conclusión guardada con éxito en la sección de evidencias.';
      },
      error: () => {
        this.loading = false;
        this.message = 'Error al guardar la conclusión.';
      }
    });
  }
}
