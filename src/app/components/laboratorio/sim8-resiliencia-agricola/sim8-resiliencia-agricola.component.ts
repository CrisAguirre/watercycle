import { Component, OnInit, OnDestroy } from '@angular/core';

interface ResilienceVariables {
  crisisType: string;           // 'sequia' | 'plaga' | 'inundacion' | 'helada'
  crisisSeverity: number;       // 1–10
  intervention: string;         // 'ninguna' | 'riego' | 'biocontrol' | 'drenaje' | 'proteccion'
  interventionIntensity: number;// 0–100 %
}

interface ResilienceOutputs {
  systemHealth: number;         // 0–100
  accumulatedDamage: number;    // 0–100
  interventionEfficacy: number; // 0–100 %
  systemStatus: string;
  recoveryRate: number;         // %/tick
  daysInCrisis: number;
  crisisDescription: string;
  interventionDescription: string;
  tippingPointReached: boolean;
  resilience: string;
}

@Component({
  selector: 'app-sim8-resiliencia-agricola',
  templateUrl: './sim8-resiliencia-agricola.component.html',
  styleUrls: ['./sim8-resiliencia-agricola.component.css']
})
export class Sim8ResilienciaAgricolaComponent implements OnInit, OnDestroy {

  Math = Math; // Expose to template

  vars: ResilienceVariables = {
    crisisType: 'sequia',
    crisisSeverity: 5,
    intervention: 'ninguna',
    interventionIntensity: 50
  };

  outputs: ResilienceOutputs = {
    systemHealth: 80,
    accumulatedDamage: 0,
    interventionEfficacy: 0,
    systemStatus: '🟢 Estable',
    recoveryRate: 0,
    daysInCrisis: 0,
    crisisDescription: '',
    interventionDescription: '',
    tippingPointReached: false,
    resilience: 'Alta'
  };

  crisisTypes = ['sequia', 'plaga', 'inundacion', 'helada'];
  interventionTypes = ['ninguna', 'riego', 'biocontrol', 'drenaje', 'proteccion'];

  // Visual state
  crackLevel = 0;
  floodLevel = 0;
  frostLevel = 0;
  pestLevel = 0;
  shieldActive = false;
  plantSway = 0;
  fieldGreen = 70;

  private engineLoop: any;
  private stockHealth = 80;
  private stockDamage = 0;
  private dayCount = 0;

  // Crisis damage profiles
  private crisisDamage: Record<string, { base: number; accel: number; desc: string }> = {
    sequia:     { base: 1.2, accel: 0.15, desc: 'Déficit hídrico severo — El suelo se agrieta y las raíces no pueden absorber agua' },
    plaga:      { base: 1.0, accel: 0.20, desc: 'Ataque masivo de insectos — Larvas devoran hojas y tallos, reduciendo fotosíntesis' },
    inundacion: { base: 1.5, accel: 0.10, desc: 'Exceso de agua — Las raíces se ahogan por falta de oxígeno (anoxia)' },
    helada:     { base: 2.0, accel: 0.08, desc: 'Temperaturas bajo cero — Los cristales de hielo rompen las células vegetales' }
  };

  // Intervention effectiveness per crisis
  private interventionEffectiveness: Record<string, Record<string, number>> = {
    sequia:     { ninguna: 0, riego: 0.85, biocontrol: 0.05, drenaje: 0, proteccion: 0.15 },
    plaga:      { ninguna: 0, riego: 0.05, biocontrol: 0.90, drenaje: 0, proteccion: 0.20 },
    inundacion: { ninguna: 0, riego: 0,    biocontrol: 0.05, drenaje: 0.85, proteccion: 0.10 },
    helada:     { ninguna: 0, riego: 0.20, biocontrol: 0,    drenaje: 0, proteccion: 0.80 }
  };

  ngOnInit() {
    this.physicsTick();
    this.engineLoop = setInterval(() => this.physicsTick(), 600);
  }

  ngOnDestroy() {
    if (this.engineLoop) clearInterval(this.engineLoop);
  }

  onVarChange(event: Event, key: keyof ResilienceVariables) {
    const el = event.target as HTMLInputElement;
    if (key === 'crisisType' || key === 'intervention') {
      this.vars[key] = el.value;
    } else {
      (this.vars as any)[key] = Number(el.value);
    }
  }

  onCrisisChange(type: string) {
    this.vars.crisisType = type;
    this.resetSimulation();
  }

  onInterventionChange(type: string) { this.vars.intervention = type; }

  resetSimulation() {
    this.stockHealth = 80;
    this.stockDamage = 0;
    this.dayCount = 0;
  }

  // ═══════════════════════════════════════════════════════
  //  MOTOR FÍSICO: RESILIENCIA AGRÍCOLA
  //  Basado en:
  //  - Modelo de estrés acumulativo
  //  - Puntos de inflexión (umbrales de resiliencia)
  //  - Intervención vs recuperación
  //  - Dinámicas de colapso y recuperación ecológica
  // ═══════════════════════════════════════════════════════
  private physicsTick() {
    const { crisisType, crisisSeverity, intervention, interventionIntensity } = this.vars;
    const crisis = this.crisisDamage[crisisType];

    this.dayCount++;

    // ─────────────────────────────────────────────────
    // 1. DAÑO POR CRISIS (acumulativo, acelerado)
    //    D(t) = base × severidad × (1 + accel × t)
    //    El daño se acelera con el tiempo (retroalimentación)
    // ─────────────────────────────────────────────────
    const timeAcceleration = 1 + crisis.accel * Math.sqrt(this.dayCount);
    const rawDamage = crisis.base * (crisisSeverity / 10) * timeAcceleration;

    // ─────────────────────────────────────────────────
    // 2. EFICACIA DE LA INTERVENCIÓN
    //    Depende de: tipo de intervención × tipo de crisis
    //    + intensidad aplicada
    // ─────────────────────────────────────────────────
    const matchFactor = this.interventionEffectiveness[crisisType]?.[intervention] || 0;
    const interventionEfficacy = Math.round(matchFactor * (interventionIntensity / 100) * 100);

    // ─────────────────────────────────────────────────
    // 3. DAÑO NETO = Daño bruto - Mitigación
    // ─────────────────────────────────────────────────
    const mitigation = rawDamage * (interventionEfficacy / 100);
    const netDamage = Math.max(0, rawDamage - mitigation);

    // ─────────────────────────────────────────────────
    // 4. RECUPERACIÓN NATURAL
    //    Tasa base de recuperación (resiliencia del sistema)
    //    Disminuye si la salud es muy baja
    // ─────────────────────────────────────────────────
    let recoveryRate = 0;
    if (this.stockHealth > 50) {
      recoveryRate = 0.5; // Buena capacidad de recuperación
    } else if (this.stockHealth > 20) {
      recoveryRate = 0.2; // Capacidad reducida
    } else {
      recoveryRate = 0;   // Sin capacidad natural
    }

    // Intervention boosts recovery
    if (interventionEfficacy > 50) {
      recoveryRate += 0.3 * (interventionEfficacy / 100);
    }

    // ─────────────────────────────────────────────────
    // 5. ACTUALIZAR SALUD DEL SISTEMA
    // ─────────────────────────────────────────────────
    this.stockHealth -= netDamage;
    this.stockHealth += recoveryRate;
    this.stockHealth = Math.max(0, Math.min(100, this.stockHealth));

    this.stockDamage += netDamage * 0.3;
    this.stockDamage = Math.min(100, this.stockDamage);

    // ─────────────────────────────────────────────────
    // 6. PUNTO DE INFLEXIÓN (COLAPSO)
    //    Si salud < 15% → colapso irreversible sin intervención fuerte
    // ─────────────────────────────────────────────────
    const tippingPointReached = this.stockHealth < 15;
    if (tippingPointReached && interventionEfficacy < 60) {
      this.stockHealth = Math.max(0, this.stockHealth - 0.5);
    }

    // ─────────────────────────────────────────────────
    // 7. ESTADOS DEL SISTEMA
    // ─────────────────────────────────────────────────
    let systemStatus: string;
    let resilience: string;
    if (this.stockHealth >= 70) {
      systemStatus = '🟢 Estable';
      resilience = 'Alta';
    } else if (this.stockHealth >= 50) {
      systemStatus = '🟡 En Riesgo';
      resilience = 'Media';
    } else if (this.stockHealth >= 25) {
      systemStatus = '🟠 Crítico';
      resilience = 'Baja';
    } else if (this.stockHealth > 5) {
      systemStatus = '🔴 Colapso Inminente';
      resilience = 'Mínima';
    } else {
      systemStatus = '⚫ Colapsado';
      resilience = 'Nula';
    }

    // Intervention description
    const interventionDescs: Record<string, string> = {
      ninguna: 'Sin intervención — El sistema depende solo de su resiliencia natural',
      riego: '💧 Riego de emergencia — Inyección de agua para compensar déficit hídrico',
      biocontrol: '🐞 Biocontrol — Liberación de depredadores naturales de plagas',
      drenaje: '🏗️ Drenaje — Canales para evacuar exceso de agua del campo',
      proteccion: '🛡️ Protección térmica — Cubiertas y mantas para proteger contra heladas'
    };

    // Emit outputs
    this.outputs = {
      systemHealth: Math.round(this.stockHealth),
      accumulatedDamage: Math.round(this.stockDamage),
      interventionEfficacy,
      systemStatus,
      recoveryRate: Math.round(recoveryRate * 100) / 100,
      daysInCrisis: this.dayCount,
      crisisDescription: crisis.desc,
      interventionDescription: interventionDescs[intervention] || '',
      tippingPointReached,
      resilience
    };

    this.updateVisuals(crisisType, this.stockHealth, interventionEfficacy);
  }

  private updateVisuals(crisis: string, health: number, efficacy: number) {
    // Field green (100 = lush, 0 = dead)
    this.fieldGreen = Math.max(0, health);

    // Crisis-specific visuals
    this.crackLevel = crisis === 'sequia' ? (100 - health) : 0;
    this.floodLevel = crisis === 'inundacion' ? (100 - health) * 0.5 : 0;
    this.frostLevel = crisis === 'helada' ? (100 - health) * 0.6 : 0;
    this.pestLevel = crisis === 'plaga' ? (100 - health) * 0.4 : 0;

    // Shield active when intervention efficacy is high
    this.shieldActive = efficacy > 40;

    // Plant sway (wind/stress)
    this.plantSway = (100 - health) * 0.3;
  }

  getCrisisLabel(type: string): string {
    const map: Record<string, string> = {
      sequia: '☀️ Sequía', plaga: '🐛 Plaga',
      inundacion: '🌊 Inundación', helada: '❄️ Helada'
    };
    return map[type] || type;
  }

  getInterventionLabel(type: string): string {
    const map: Record<string, string> = {
      ninguna: '❌ Ninguna', riego: '💧 Riego',
      biocontrol: '🐞 Biocontrol', drenaje: '🏗️ Drenaje',
      proteccion: '🛡️ Protección'
    };
    return map[type] || type;
  }

  getHealthColor(): string {
    const h = this.outputs.systemHealth;
    if (h >= 70) return '#44cc66';
    if (h >= 45) return '#ccaa22';
    if (h >= 20) return '#cc6622';
    return '#cc2222';
  }
}
