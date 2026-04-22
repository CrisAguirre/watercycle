import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EvidenciaService {
  private apiUrl = `${environment.apiUrl}/evidencias`;

  constructor(private http: HttpClient) {}

  getEvidencias(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  uploadEvidencia(formData: FormData): Observable<any> {
    return this.http.post<any>(this.apiUrl, formData);
  }

  saveTextEvidencia(data: { titulo: string, contenido: string, tipoArchivo?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/texto`, data);
  }
}
