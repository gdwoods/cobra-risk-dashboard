
export type Mode = "Conservative" | "Standard" | "Aggressive" | "Custom";

export interface RiskSettings {
  // Basic Risk Limits
  dailyLossLimit: number;        // DayLossLimit
  totalLossLimit: number;        // TotalLossLimit
  perSymbolLossLimit: number;    // PosUnrealLossLimit
  perSymbolExposureLimit: number; // PosMktValueLimit
  totalExposureLimit: number;    // OpenPosValueLimit
  
  // Profit Protection
  profitLockStart: number;       // ProfitLockStart
  profitLockDrawdown: number;    // ProfitLockDrawdown%
  
  // Trading Controls
  stopTime: string;              // StopTime
  autoStopLoss: boolean;         // AutoStopLoss
  disableNewOrders: boolean;     // DisableNewOrders
  liquidateAllPositions: boolean; // LiquidateAllPositions
  
  // Advanced Controls
  maxSharesPerPosition: number;  // Max shares per position
  maxOrderSize: number;          // Max order size
  maxDailyTrades: number;        // Max daily trades
  maxPositions: number;          // Max concurrent positions
}

export const PRESET_MAP: Record<Mode, RiskSettings> = {
  Conservative: {
    dailyLossLimit: 0,           // Not used in simplified presets
    totalLossLimit: 0.08,        // 8% (more conservative than standard 12%)
    perSymbolLossLimit: 0.015,   // 1.5% (more conservative than standard 2%)
    perSymbolExposureLimit: 0.10, // 10% (more conservative than standard 15%)
    totalExposureLimit: 0.40,    // 40% (more conservative than standard 50%)
    profitLockStart: 0.06,       // 6% (warning at 6% instead of 9%)
    profitLockDrawdown: 0.30,    // 30%
    stopTime: "15:30",
    autoStopLoss: true,
    disableNewOrders: true,
    liquidateAllPositions: true,
    maxSharesPerPosition: 10000,
    maxOrderSize: 5000,
    maxDailyTrades: 50,
    maxPositions: 5,
  },
  Standard: {
    dailyLossLimit: 0,           // Not used in simplified presets
    totalLossLimit: 0.12,        // 12%
    perSymbolLossLimit: 0.02,    // 2%
    perSymbolExposureLimit: 0.15, // 15%
    totalExposureLimit: 0.50,    // 50%
    profitLockStart: 0.09,       // 9% (WarningLoss)
    profitLockDrawdown: 0.30,    // 30%
    stopTime: "15:30",
    autoStopLoss: true,
    disableNewOrders: true,
    liquidateAllPositions: true,
    maxSharesPerPosition: 20000,
    maxOrderSize: 10000,
    maxDailyTrades: 100,
    maxPositions: 10,
  },
  Aggressive: {
    dailyLossLimit: 0,           // Not used in simplified presets
    totalLossLimit: 0.15,        // 15% (more aggressive than standard 12%)
    perSymbolLossLimit: 0.025,   // 2.5% (more aggressive than standard 2%)
    perSymbolExposureLimit: 0.20, // 20% (more aggressive than standard 15%)
    totalExposureLimit: 0.60,    // 60% (more aggressive than standard 50%)
    profitLockStart: 0.12,       // 12% (warning at 12% instead of 9%)
    profitLockDrawdown: 0.35,    // 35%
    stopTime: "15:30",
    autoStopLoss: true,
    disableNewOrders: true,
    liquidateAllPositions: true,
    maxSharesPerPosition: 50000,
    maxOrderSize: 25000,
    maxDailyTrades: 200,
    maxPositions: 20,
  },
  Custom: {
    dailyLossLimit: 0,           // Start with no limits set
    totalLossLimit: 0,
    perSymbolLossLimit: 0,
    perSymbolExposureLimit: 0,
    totalExposureLimit: 0,
    profitLockStart: 0,
    profitLockDrawdown: 0,
    stopTime: "",
    autoStopLoss: false,
    disableNewOrders: false,
    liquidateAllPositions: false,
    maxSharesPerPosition: 0,
    maxOrderSize: 0,
    maxDailyTrades: 0,
    maxPositions: 0,
  },
};

export function dollars(n: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
export function pct(n: number, digits=1): string {
  return (n*100).toFixed(digits) + "%";
}
