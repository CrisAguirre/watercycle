import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProgressService {
  private apiUrl = `${environment.apiUrl}/progress`;

  constructor(private http: HttpClient) {}

  getProgress(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }

  updateProgress(progressData: { 
    currentSimulationId?: number, 
    simulationData?: any, 
    completedSimulation?: number 
  }): Observable<any> {
    return this.http.put<any>(this.apiUrl, progressData);
  }
}
