import { Component, OnInit, OnDestroy } from '@angular/core';

interface CropVariables {
  temperature: number;          // 5–40 °C
  waterAvailability: number;    // 0–100 %
  nutrients: number;            // 0–100 % (N-P-K composite)
  pestPressure: number;         // 0–100 %
}

interface CropOutputs {
  cropHealth: number;           // 0–100 %
  biomass: number;              // kg/m²
  evapotranspiration: number;   // mm/day
  limitingFactor: string;
  growthStage: string;
  yieldEstimate: number;        // ton/ha
  waterStress: number;          // 0–1
  thermalStress: number;        // 0–1
  nutrientEfficiency: number;   // %
  cropStatus: string;
}

@Component({
  selector: 'app-sim6-factores-cultivo',
  templateUrl: './sim6-factores-cultivo.component.html',
  styleUrls: ['./sim6-factores-cultivo.component.css']
})
export class Sim6FactoresCultivoComponent implements OnInit, OnDestroy {

  vars: CropVariables = {
    temperature: 20,
    waterAvailability: 60,
    nutrients: 50,
    pestPressure: 10
  };

  outputs: CropOutputs = {
    cropHealth: 70,
    biomass: 0,
    evapotranspiration: 0,
    limitingFactor: 'Ninguno',
    growthStage: 'Vegetativo',
    yieldEstimate: 0,
    waterStress: 0,
    thermalStress: 0,
    nutrientEfficiency: 0,
    cropStatus: 'Saludable'
  };

  plantHeight = 50;
  leafColor = '#4a8c3f';
  pestIcons: any[] = [];
  rootDepth = 30;
  soilMoistureColor = '#6a5030';

  private engineLoop: any;
  private stockBiomass = 0.5;
  private growthDay = 30;

  ngOnInit() {
    this.physicsTick();
    this.engineLoop = setInterval(() => this.physicsTick(), 500);
  }

  ngOnDestroy() {
    if (this.engineLoop) clearInterval(this.engineLoop);
  }

  onVarChange(event: Event, key: keyof CropVariables) {
    const el = event.target as HTMLInputElement;
    this.vars[key] = Number(el.value);
  }

  // ═══════════════════════════════════════════════════════
  //  MOTOR FÍSICO: FACTORES DEL CULTIVO
  //  Basado en:
  //  - FAO-56 simplificado (evapotranspiración)
  //  - Curva de crecimiento logístico (biomasa)
  //  - Factores de estrés (hídrico, térmico, nutricional)
  //  - Ley de Liebig (factor limitante mínimo)
  // ═══════════════════════════════════════════════════════
  private physicsTick() {
    const { temperature, waterAvailability, nutrients, pestPressure } = this.vars;

    // ─────────────────────────────────────────────────
    // 1. ESTRÉS TÉRMICO
    //    Rango óptimo: 15-30°C
    //    Fuera del rango → estrés proporcional
    // ─────────────────────────────────────────────────
    let thermalStress: number;
    if (temperature >= 15 && temperature <= 30) {
      thermalStress = 0;
    } else if (temperature < 15) {
      thermalStress = Math.min(1, (15 - temperature) / 10);
    } else {
      thermalStress = Math.min(1, (temperature - 30) / 10);
    }

    // ─────────────────────────────────────────────────
    // 2. ESTRÉS HÍDRICO (FAO-56 simplificado)
    //    Ks = (AWC - Dr) / (AWC - RAW)
    //    Si agua < 40% → estrés significativo
    // ─────────────────────────────────────────────────
    let waterStress: number;
    if (waterAvailability >= 60) {
      waterStress = 0;
    } else if (waterAvailability >= 30) {
      waterStress = (60 - waterAvailability) / 30 * 0.5;
    } else {
      waterStress = 0.5 + (30 - waterAvailability) / 30 * 0.5;
    }

    // ─────────────────────────────────────────────────
    // 3. EFECTO DE NUTRIENTES (Ley de Liebig)
    //    El crecimiento se limita por el nutriente más escaso
    // ─────────────────────────────────────────────────
    const nutrientFactor = Math.pow(nutrients / 100, 0.7);
    const nutrientEfficiency = Math.round(nutrientFactor * 100);

    // ─────────────────────────────────────────────────
    // 4. EFECTO DE PLAGAS
    //    Reducción directa del rendimiento
    //    Exponencial a alta presión
    // ─────────────────────────────────────────────────
    const pestDamage = Math.pow(pestPressure / 100, 1.5);

    // ─────────────────────────────────────────────────
    // 5. EVAPOTRANSPIRACIÓN (ETc = Kc × ET0)
    //    ET0 (referencia) basado en temperatura
    //    Kc depende del estado de crecimiento
    // ─────────────────────────────────────────────────
    const et0 = Math.max(0, 0.0023 * (temperature + 17.8) * Math.sqrt(Math.max(0, temperature)) * 12);
    const kc = this.growthDay < 30 ? 0.4 : this.growthDay < 90 ? 0.8 : 1.1;
    const evapotranspiration = Math.round(et0 * kc * (1 - waterStress * 0.5) * 10) / 10;

    // ─────────────────────────────────────────────────
    // 6. CRECIMIENTO DE BIOMASA (Logístico)
    //    dB/dt = r × B × (1 - B/K) × Π(factores)
    // ─────────────────────────────────────────────────
    const K = 8;           // Capacidad de carga (kg/m²)
    const r = 0.05;        // Tasa intrínseca
    const combinedFactor = (1 - thermalStress) * (1 - waterStress) * nutrientFactor * (1 - pestDamage);
    const growth = r * this.stockBiomass * (1 - this.stockBiomass / K) * combinedFactor;
    this.stockBiomass = Math.max(0.1, Math.min(K, this.stockBiomass + growth));
    this.growthDay += 0.5;
    if (this.growthDay > 180) this.growthDay = 180;

    // ─────────────────────────────────────────────────
    // 7. SALUD DEL CULTIVO (Índice compuesto)
    // ─────────────────────────────────────────────────
    const cropHealth = Math.round(
      Math.max(0, Math.min(100,
        (1 - thermalStress * 0.3) *
        (1 - waterStress * 0.35) *
        nutrientFactor *
        (1 - pestDamage * 0.35) * 100
      ))
    );

    // ─────────────────────────────────────────────────
    // 8. FACTOR LIMITANTE (Liebig)
    // ─────────────────────────────────────────────────
    const factors: Record<string, number> = {
      'Temperatura': 1 - thermalStress,
      'Agua': 1 - waterStress,
      'Nutrientes': nutrientFactor,
      'Plagas': 1 - pestDamage
    };
    const limitingFactor = Object.entries(factors)
      .reduce((min, curr) => curr[1] < min[1] ? curr : min)[0];

    // Growth stage
    let growthStage: string;
    if (this.growthDay < 20) growthStage = 'Germinación';
    else if (this.growthDay < 50) growthStage = 'Vegetativo';
    else if (this.growthDay < 100) growthStage = 'Floración';
    else if (this.growthDay < 150) growthStage = 'Fructificación';
    else growthStage = 'Maduración';

    // Crop status
    let cropStatus: string;
    if (cropHealth >= 80) cropStatus = '🟢 Saludable';
    else if (cropHealth >= 60) cropStatus = '🟡 Moderado';
    else if (cropHealth >= 35) cropStatus = '🟠 Estrés';
    else if (cropHealth >= 15) cropStatus = '🔴 Crítico';
    else cropStatus = '⚫ Marchito';

    // Yield estimate (ton/ha)
    const yieldEstimate = Math.round(this.stockBiomass * 1.2 * 10) / 10;

    // Emit outputs
    this.outputs = {
      cropHealth,
      biomass: Math.round(this.stockBiomass * 100) / 100,
      evapotranspiration,
      limitingFactor,
      growthStage,
      yieldEstimate,
      waterStress: Math.round(waterStress * 100) / 100,
      thermalStress: Math.round(thermalStress * 100) / 100,
      nutrientEfficiency,
      cropStatus
    };

    // Update visuals
    this.updateVisuals(cropHealth, waterAvailability, pestPressure);
  }

  private updateVisuals(health: number, water: number, pest: number) {
    // Plant height (30-100%)
    this.plantHeight = 30 + (this.stockBiomass / 8) * 70;

    // Leaf color: green → yellow → brown
    if (health >= 70) {
      this.leafColor = '#4a8c3f';
    } else if (health >= 50) {
      this.leafColor = '#8a9c3f';
    } else if (health >= 30) {
      this.leafColor = '#aa8c30';
    } else {
      this.leafColor = '#8a5a20';
    }

    // Root depth proportional to biomass
    this.rootDepth = 20 + (this.stockBiomass / 8) * 60;

    // Soil moisture color
    if (water > 70) this.soilMoistureColor = '#3a2810';
    else if (water > 40) this.soilMoistureColor = '#5a3820';
    else this.soilMoistureColor = '#7a5830';

    // Pest icons
    const pestCount = Math.floor(pest / 15);
    this.pestIcons = Array(Math.max(0, Math.min(8, pestCount))).fill(0).map(() => ({
      left: 15 + Math.random() * 70 + '%',
      top: 20 + Math.random() * 40 + '%',
      delay: Math.random() * 3 + 's'
    }));
  }

  getHealthBarColor(): string {
    const h = this.outputs.cropHealth;
    if (h >= 70) return '#44cc66';
    if (h >= 45) return '#ccaa22';
    if (h >= 20) return '#cc6622';
    return '#cc2222';
  }
}
