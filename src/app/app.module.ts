import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// Auth
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { AuthInterceptor } from './interceptors/auth.interceptor';

// Layout
import { LayoutComponent } from './components/layout/layout.component';
import { NavbarComponent } from './components/layout/navbar/navbar.component';

// Pages
import { LandingComponent } from './components/landing/landing.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { UsersListComponent } from './components/dashboard/users-list/users-list.component';
import { ResultsComponent } from './components/dashboard/results/results.component';
import { LaboratorioHubComponent } from './components/laboratorio/laboratorio-hub/laboratorio-hub.component';
import { RecursosComponent } from './components/recursos/recursos.component';
import { ExamComponent } from './components/laboratorio/exam/exam.component';

// Shared
import { SimulationWrapperComponent } from './shared/simulation-wrapper/simulation-wrapper.component';
import { SimCardComponent } from './shared/sim-card/sim-card.component';

// Simulaciones - Bloque 1: Ciclo del Agua
import { Sim1EvaporacionComponent } from './components/laboratorio/sim1-evaporacion/sim1-evaporacion.component';
import { Sim2CondensacionComponent } from './components/laboratorio/sim2-condensacion/sim2-condensacion.component';
import { Sim3PrecipitacionComponent } from './components/laboratorio/sim3-precipitacion/sim3-precipitacion.component';
import { Sim4InfiltracionComponent } from './components/laboratorio/sim4-infiltracion/sim4-infiltracion.component';
import { Sim5CicloConsolidadoComponent } from './components/laboratorio/sim5-ciclo-consolidado/sim5-ciclo-consolidado.component';

// Simulaciones - Bloque 2: Agroecosistemas
import { Sim6FactoresCultivoComponent } from './components/laboratorio/sim6-factores-cultivo/sim6-factores-cultivo.component';
import { Sim7EscalasProductivasComponent } from './components/laboratorio/sim7-escalas-productivas/sim7-escalas-productivas.component';
import { Sim8ResilienciaAgricolaComponent } from './components/laboratorio/sim8-resiliencia-agricola/sim8-resiliencia-agricola.component';

@NgModule({
  declarations: [
    AppComponent,

    // Auth
    LoginComponent,
    RegisterComponent,

    // Layout
    LayoutComponent,
    NavbarComponent,

    // Pages
    LandingComponent,
    DashboardComponent,
    UsersListComponent,
    ResultsComponent,
    LaboratorioHubComponent,
    RecursosComponent,

    // Shared
    SimulationWrapperComponent,
    SimCardComponent,

    // Simulaciones - Bloque Agua
    Sim1EvaporacionComponent,
    Sim2CondensacionComponent,
    Sim3PrecipitacionComponent,
    Sim4InfiltracionComponent,
    Sim5CicloConsolidadoComponent,

    // Simulaciones - Bloque Agro
    Sim6FactoresCultivoComponent,
    Sim7EscalasProductivasComponent,
    Sim8ResilienciaAgricolaComponent,

    // Exam
    ExamComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    CommonModule,
    HttpClientModule,
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
