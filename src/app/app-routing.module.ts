import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LoginComponent } from './components/login/login.component';
import { LayoutComponent } from './components/layout/layout.component';
import { LandingComponent } from './components/landing/landing.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LaboratorioHubComponent } from './components/laboratorio/laboratorio-hub/laboratorio-hub.component';
import { RecursosComponent } from './components/recursos/recursos.component';

// Simulaciones - Bloque Agua
import { Sim1EvaporacionComponent } from './components/laboratorio/sim1-evaporacion/sim1-evaporacion.component';
import { Sim2CondensacionComponent } from './components/laboratorio/sim2-condensacion/sim2-condensacion.component';
import { Sim3PrecipitacionComponent } from './components/laboratorio/sim3-precipitacion/sim3-precipitacion.component';
import { Sim4InfiltracionComponent } from './components/laboratorio/sim4-infiltracion/sim4-infiltracion.component';
import { Sim5CicloConsolidadoComponent } from './components/laboratorio/sim5-ciclo-consolidado/sim5-ciclo-consolidado.component';

// Simulaciones - Bloque Agro
import { Sim6FactoresCultivoComponent } from './components/laboratorio/sim6-factores-cultivo/sim6-factores-cultivo.component';
import { Sim7EscalasProductivasComponent } from './components/laboratorio/sim7-escalas-productivas/sim7-escalas-productivas.component';
import { Sim8ResilienciaAgricolaComponent } from './components/laboratorio/sim8-resiliencia-agricola/sim8-resiliencia-agricola.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: 'landing', component: LandingComponent },
      { path: 'dashboard', component: DashboardComponent },
      {
        path: 'laboratorio',
        children: [
          { path: '', component: LaboratorioHubComponent },
          { path: 'evaporacion', component: Sim1EvaporacionComponent },
          { path: 'condensacion', component: Sim2CondensacionComponent },
          { path: 'precipitacion', component: Sim3PrecipitacionComponent },
          { path: 'infiltracion', component: Sim4InfiltracionComponent },
          { path: 'ciclo-consolidado', component: Sim5CicloConsolidadoComponent },
          { path: 'factores-cultivo', component: Sim6FactoresCultivoComponent },
          { path: 'escalas-productivas', component: Sim7EscalasProductivasComponent },
          { path: 'resiliencia-agricola', component: Sim8ResilienciaAgricolaComponent },
        ]
      },
      { path: 'recursos', component: RecursosComponent },
    ]
  },
  { path: '**', redirectTo: '/login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
