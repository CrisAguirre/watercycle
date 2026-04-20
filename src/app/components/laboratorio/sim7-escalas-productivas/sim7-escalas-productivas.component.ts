import { Component, OnInit, OnDestroy } from '@angular/core';

interface ScaleVariables {
  cropType: string;             // 'papa' | 'cafe' | 'maiz'
  productionScale: number;      // 1–10000 m²
  irrigationMethod: string;     // 'goteo' | 'aspersion' | 'gravedad'
  fertilization: number;        // 0–200 kg/ha
}

interface ScaleOutputs {
  yieldEstimate: number;        // ton/ha
  waterRequired: number;        // m³
  productionCost: number;       // $COP
  waterEfficiency: number;      // kg/m³
  irrigationEfficiency: number; // %
  fertilizerCost: number;       // $COP
  waterCost: number;            // $COP
  revenueEstimate: number;      // $COP
  profitMargin: number;         // %
  scaleLabel: string;
  cropEmoji: string;
  waterPerPlant: number;        // L/plant
}

@Component({
  selector: 'app-sim7-escalas-productivas',
  templateUrl: './sim7-escalas-productivas.component.html',
  styleUrls: ['./sim7-escalas-productivas.component.css']
})
export class Sim7EscalasProductivasComponent implements OnInit, OnDestroy {

  vars: ScaleVariables = {
    cropType: 'papa',
    productionScale: 500,
    irrigationMethod: 'aspersion',
    fertilization: 80
  };

  outputs: ScaleOutputs = {
    yieldEstimate: 0,
    waterRequired: 0,
    productionCost: 0,
    waterEfficiency: 0,
    irrigationEfficiency: 75,
    fertilizerCost: 0,
    waterCost: 0,
    revenueEstimate: 0,
    profitMargin: 0,
    scaleLabel: 'Parcela',
    cropEmoji: '🥔',
    waterPerPlant: 0
  };

  cropTypes = ['papa', 'cafe', 'maiz'];
  irrigationMethods = ['goteo', 'aspersion', 'gravedad'];

  // Visual bars
  waterBar = 0;
  yieldBar = 0;
  costBar = 0;
  profitBar = 0;

  scaleIcons: string[] = [];

  private engineLoop: any;

  // Crop properties
  private cropProps: Record<string, {
    yieldMax: number; waterNeed: number; Kc: number;
    density: number; pricePerTon: number; emoji: string;
    fertResponse: number;
  }> = {
    papa:  { yieldMax: 30, waterNeed: 500, Kc: 1.05, density: 40000, pricePerTon: 800000, emoji: '🥔', fertResponse: 0.8 },
    cafe:  { yieldMax: 2.5, waterNeed: 1200, Kc: 0.95, density: 5000, pricePerTon: 8000000, emoji: '☕', fertResponse: 0.6 },
    maiz:  { yieldMax: 8, waterNeed: 600, Kc: 1.15, density: 70000, pricePerTon: 950000, emoji: '🌽', fertResponse: 0.9 }
  };

  // Irrigation efficiencies
  private irrigEfficiency: Record<string, number> = {
    goteo: 90,
    aspersion: 75,
    gravedad: 50
  };

  ngOnInit() {
    this.physicsTick();
    this.engineLoop = setInterval(() => this.physicsTick(), 500);
  }

  ngOnDestroy() {
    if (this.engineLoop) clearInterval(this.engineLoop);
  }

  onVarChange(event: Event, key: keyof ScaleVariables) {
    const el = event.target as HTMLInputElement;
    if (key === 'cropType' || key === 'irrigationMethod') {
      this.vars[key] = el.value;
    } else {
      (this.vars as any)[key] = Number(el.value);
    }
  }

  onCropChange(type: string) { this.vars.cropType = type; }
  onIrrigChange(method: string) { this.vars.irrigationMethod = method; }

  // ═══════════════════════════════════════════════════════
  //  MOTOR FÍSICO: ESCALAS PRODUCTIVAS
  //  Basado en:
  //  - Modelo de rendimiento FAO (Y = Ymax × f(agua,nutr,clima))
  //  - Regla de tres compuesta (escalado de áreas)
  //  - Eficiencia de riego (USDA)
  //  - Costos de producción colombianos
  // ═══════════════════════════════════════════════════════
  private physicsTick() {
    const { cropType, productionScale, irrigationMethod, fertilization } = this.vars;
    const crop = this.cropProps[cropType];
    const irrigEff = this.irrigEfficiency[irrigationMethod] / 100;

    // ─────────────────────────────────────────────────
    // 1. ESCALA
    // ─────────────────────────────────────────────────
    const areaHa = productionScale / 10000;
    let scaleLabel: string;
    if (productionScale <= 5) scaleLabel = '🪴 Maceta';
    else if (productionScale <= 50) scaleLabel = '🌱 Jardín';
    else if (productionScale <= 500) scaleLabel = '🌿 Parcela';
    else if (productionScale <= 5000) scaleLabel = '🌾 Finca';
    else scaleLabel = '🏭 Producción Comercial';

    // ─────────────────────────────────────────────────
    // 2. RENDIMIENTO (Y = Ymax × f(fert) × f(agua))
    //    Respuesta a fertilización: curva asintótica
    //    Optimo: ~120-150 kg/ha
    // ─────────────────────────────────────────────────
    const fertOptimum = 120;
    const fertFactor = 1 - Math.exp(-crop.fertResponse * fertilization / fertOptimum);
    const waterFactor = irrigEff; // Mejor riego → más agua disponible → más rendimiento

    const yieldPerHa = Math.round(crop.yieldMax * fertFactor * waterFactor * 100) / 100;
    const yieldTotal = Math.round(yieldPerHa * areaHa * 1000) / 1000;

    // ─────────────────────────────────────────────────
    // 3. AGUA REQUERIDA
    //    Necesidad bruta = Necesidad neta / Eficiencia riego
    //    Necesidad neta = ETc × Area (mm → m³)
    // ─────────────────────────────────────────────────
    const waterNeedNet = crop.waterNeed * areaHa; // m³/periodo
    const waterRequired = Math.round(waterNeedNet / irrigEff);

    // Water per plant
    const totalPlants = Math.round(crop.density * areaHa);
    const waterPerPlant = totalPlants > 0 ? Math.round((waterRequired * 1000 / totalPlants) * 10) / 10 : 0;

    // ─────────────────────────────────────────────────
    // 4. EFICIENCIA DEL AGUA
    //    kg producidos / m³ de agua usado
    // ─────────────────────────────────────────────────
    const waterEfficiency = waterRequired > 0
      ? Math.round((yieldTotal * 1000 / waterRequired) * 100) / 100
      : 0;

    // ─────────────────────────────────────────────────
    // 5. COSTOS DE PRODUCCIÓN
    //    Agua: $2500/m³ (Colombia)
    //    Fertilizante: $3000/kg
    //    Otros costos: semilla, mano de obra (simplificado)
    // ─────────────────────────────────────────────────
    const waterCostPerM3 = 2500;
    const fertCostPerKg = 3000;
    const waterCost = waterRequired * waterCostPerM3;
    const fertCost = Math.round(fertilization * areaHa * fertCostPerKg);
    const laborCost = Math.round(productionScale * 5); // $5/m² simplificado
    const seedCost = Math.round(areaHa * 2000000); // $2M/ha promedio

    const totalCost = waterCost + fertCost + laborCost + seedCost;

    // ─────────────────────────────────────────────────
    // 6. INGRESOS Y MARGEN
    // ─────────────────────────────────────────────────
    const revenue = Math.round(yieldTotal * crop.pricePerTon);
    const profitMargin = revenue > 0
      ? Math.round(((revenue - totalCost) / revenue) * 100)
      : 0;

    // Emit outputs
    this.outputs = {
      yieldEstimate: yieldPerHa,
      waterRequired,
      productionCost: totalCost,
      waterEfficiency,
      irrigationEfficiency: this.irrigEfficiency[irrigationMethod],
      fertilizerCost: fertCost,
      waterCost,
      revenueEstimate: revenue,
      profitMargin,
      scaleLabel,
      cropEmoji: crop.emoji,
      waterPerPlant
    };

    // Update visual bars
    this.waterBar = Math.min(100, waterRequired / 50 * 100);
    this.yieldBar = Math.min(100, yieldPerHa / crop.yieldMax * 100);
    this.costBar = Math.min(100, totalCost / 10000000 * 100);
    this.profitBar = Math.max(0, Math.min(100, (profitMargin + 50)));

    // Scale icons
    const iconCount = Math.min(20, Math.max(1, Math.floor(productionScale / 500)));
    this.scaleIcons = Array(iconCount).fill(crop.emoji);
  }

  formatCOP(value: number): string {
    return '$' + value.toLocaleString('es-CO');
  }

  getIrrigLabel(method: string): string {
    const map: Record<string, string> = {
      goteo: '💧 Goteo (90%)',
      aspersion: '🌊 Aspersión (75%)',
      gravedad: '🏞️ Gravedad (50%)'
    };
    return map[method] || method;
  }

  getCropLabel(type: string): string {
    const map: Record<string, string> = {
      papa: '🥔 Papa',
      cafe: '☕ Café',
      maiz: '🌽 Maíz'
    };
    return map[type] || type;
  }

  getProfitColor(): string {
    const p = this.outputs.profitMargin;
    if (p >= 30) return '#44cc66';
    if (p >= 10) return '#ccaa22';
    if (p >= 0) return '#cc8822';
    return '#cc2222';
  }
}
