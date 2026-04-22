import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AnalisisService {
  private apiUrl = `${environment.apiUrl}/analisis`;

  constructor(private http: HttpClient) {}

  submitAnalisis(analisisData: {
    tipoAnalisis: string,
    descripcion: string,
    metricas?: any
  }): Observable<any> {
    return this.http.post<any>(this.apiUrl, analisisData);
  }

  getAnalisisList(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }
}
