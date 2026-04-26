/**
 * Mock eGauge Telemetry Service
 * Simulates real-time energy production and storage metrics.
 */

export interface TelemetryDataPoint {
  timestamp: string; // ISO date string
  solarProductionKwh: number;
  gridConsumptionKwh: number;
  batteryChargePct: number;
  batteryDischargeKwh: number;
}

export interface FinancialMetrics {
  totalGeneratedKwh: number;
  estimatedSavingsMxn: number;
  batteryCycles: number;
}

// Generate realistic daily curve (24 hours)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getDailyTelemetry(_proyectoId: string): Promise<TelemetryDataPoint[]> {
  const data: TelemetryDataPoint[] = [];
  const now = new Date();
  
  // Set to start of current day
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let currentBatteryPct = 40; // Start the day with 40% battery

  for (let i = 0; i < 24; i++) {
    const time = new Date(startOfDay.getTime() + i * 60 * 60 * 1000);
    
    // Simulate Solar Production (Bell curve peaking around 13:00)
    let solar = 0;
    if (i >= 7 && i <= 18) {
      // Peak production at 13:00
      const distanceToPeak = Math.abs(13 - i);
      solar = Math.max(0, 15 - distanceToPeak * 2.5) + (Math.random() * 2); // adding some noise
    }

    // Simulate Grid Consumption (Higher in morning and evening)
    let grid = 2 + Math.random() * 3;
    if (i >= 18 && i <= 22) grid += 5; // Evening peak
    if (i >= 6 && i <= 9) grid += 3;   // Morning peak

    // Simulate Battery Logic
    let batteryDischarge = 0;
    if (solar > grid) {
      // Excess solar charges battery
      currentBatteryPct = Math.min(100, currentBatteryPct + (solar - grid) * 2);
      grid = 0; // No grid consumption when solar covers it
    } else if (currentBatteryPct > 20) {
      // Not enough solar, discharge battery to cover deficit
      const deficit = grid - solar;
      batteryDischarge = Math.min(deficit, 5); // Max discharge rate 5kW
      currentBatteryPct -= (batteryDischarge * 2);
      grid = grid - batteryDischarge; 
    }

    data.push({
      timestamp: time.toISOString(),
      solarProductionKwh: Number(solar.toFixed(2)),
      gridConsumptionKwh: Number(Math.max(0, grid).toFixed(2)),
      batteryChargePct: Number(currentBatteryPct.toFixed(1)),
      batteryDischargeKwh: Number(batteryDischarge.toFixed(2))
    });
  }

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getFinancialMetrics(_proyectoId: string): Promise<FinancialMetrics> {
  // Mock data representing monthly savings
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    totalGeneratedKwh: 1245.5,
    estimatedSavingsMxn: 4850.75, // Assuming ~$3.9 MXN per kWh average CFE tariff
    batteryCycles: 28
  };
}
