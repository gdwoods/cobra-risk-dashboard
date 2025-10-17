
"use client";
import { useEffect, useMemo, useState } from "react";
import { PRESET_MAP, type Mode, type RiskSettings, dollars, pct } from "@/lib/calc";

type Status = "Safe" | "Caution" | "Danger";

// Tooltip component
function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <div className="relative group inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-64">
        {content}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
      </div>
    </div>
  );
}

function useLocalState<T>(key: string, defaultValue: T) {
  const [val, setVal] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);
  
  useEffect(() => {
    // Load from localStorage after hydration
    const raw = localStorage.getItem(key);
    if (raw) {
      setVal(JSON.parse(raw) as T);
    }
    setIsHydrated(true);
  }, [key]);
  
  useEffect(() => { 
    if (isHydrated) {
      localStorage.setItem(key, JSON.stringify(val)); 
    }
  }, [key, val, isHydrated]);
  
  return [val, setVal, isHydrated] as const;
}

export default function Page() {
  const [mode, setMode, modeHydrated] = useLocalState<Mode>("risk_mode", "Standard");
  const [equity, setEquity, equityHydrated] = useLocalState<number>("equity", 55000);
  const [priorEquity, setPriorEquity, priorEquityHydrated] = useLocalState<number>("prior_equity", 55000);
  const [todaysPnL, setTodaysPnL, todaysPnLHydrated] = useLocalState<number>("todays_pnl", 0);
  const [haltedExposure, setHaltedExposure, haltedExposureHydrated] = useLocalState<number>("halted_exposure", 0);
  const [customSettings, setCustomSettings, customSettingsHydrated] = useLocalState<RiskSettings>("custom_settings_v2", PRESET_MAP.Custom);

  // Only proceed with calculations after all values are hydrated
  const isHydrated = modeHydrated && equityHydrated && priorEquityHydrated && todaysPnLHydrated && haltedExposureHydrated && customSettingsHydrated;

  // Input validation
  const validationErrors = {
    equity: equity <= 0 ? "Equity must be greater than 0" : null,
    priorEquity: priorEquity <= 0 ? "Prior equity must be greater than 0" : null,
    haltedExposure: haltedExposure < 0 ? "Halted exposure cannot be negative" : null,
  };

  const hasValidationErrors = Object.values(validationErrors).some(error => error !== null);

  // Get current settings based on mode
  const currentSettings = mode === "Custom" ? customSettings : PRESET_MAP[mode];

  // Custom settings are now independent - no automatic copying from presets

  const drawdown = useMemo(() => priorEquity > 0 ? (equity / priorEquity - 1) : 0, [equity, priorEquity]);
  const drawdownStatus: Status = drawdown <= -0.10 ? "Danger" : drawdown <= -0.05 ? "Caution" : "Safe";

  const dayLossLimit = -(equity * currentSettings.dailyLossLimit);
  const totalLossLimit = -(equity * currentSettings.totalLossLimit);
  const perSymbolLimit = -(equity * currentSettings.perSymbolLossLimit);
  const perTickerExposure = (equity * currentSettings.perSymbolExposureLimit);
  const totalExposure = (equity * currentSettings.totalExposureLimit);
  const profitLockStart = (equity * currentSettings.profitLockStart);
  const profitLockDrawdown = currentSettings.profitLockDrawdown;

  const remainingBudget = dayLossLimit - todaysPnL;
  // For status, we want to check how much of the loss limit has been used
  const lossUsed = Math.abs(todaysPnL);
  const lossLimit = Math.abs(dayLossLimit);
  const remainingStatus: Status = lossUsed > 0.8 * lossLimit ? "Danger"
                                : lossUsed > 0.5 * lossLimit ? "Caution"
                                : "Safe";

  // Total loss calculation should be based on total unrealized + realized losses
  const totalUnrealizedLoss = 0; // This would come from actual positions in DAS
  const totalLossUsed = todaysPnL + totalUnrealizedLoss;
  const totalLossRemaining = totalLossLimit - totalLossUsed;
  const haltedPct = equity > 0 ? haltedExposure / equity : 0;
  const haltedStatus: Status = haltedPct > 0.40 ? "Danger" : haltedPct > 0.20 ? "Caution" : "Safe";

  const flattenNow = (lossUsed > 0.9 * lossLimit) || (haltedPct > 0.40);

  function statusColor(s: Status) {
    return s === "Danger" ? "bg-danger" : s === "Caution" ? "bg-caution" : "bg-safe";
  }

  function statusIcon(s: Status) {
    return s === "Danger" ? "🔴" : s === "Caution" ? "🟡" : "🟢";
  }

  // Show loading state until hydrated
  if (!isHydrated) {
    return (
      <main className="mx-auto max-w-6xl p-6 md:p-10 space-y-8">
        <div className="card p-6 text-center">
          <div className="text-lg">Loading...</div>
        </div>
      </main>
    );
  }

  function exportCfg() {
    const cfg = [
      `# DAS Risk Control Configuration`,
      `# Generated by COBRA Risk Dashboard`,
      `# Mode: ${mode}`,
      ``,
      `# Basic Risk Limits`,
      `DayLossLimit=${Math.round(dayLossLimit)}`,
      `TotalLossLimit=${Math.round(totalLossLimit)}`,
      `PosUnrealLossLimit=${Math.round(perSymbolLimit)}`,
      `PosMktValueLimit=${Math.round(perTickerExposure)}`,
      `OpenPosValueLimit=${Math.round(totalExposure)}`,
      ``,
      `# Profit Protection`,
      `ProfitLockStart=${Math.round(profitLockStart)}`,
      `ProfitLockDrawdown%=${Math.round(profitLockDrawdown*100)}`,
      ``,
      `# Trading Controls`,
      `StopTime=${currentSettings.stopTime}`,
      `AutoStopLoss=${currentSettings.autoStopLoss ? 1 : 0}`,
      `DisableNewOrders=${currentSettings.disableNewOrders ? 1 : 0}`,
      `LiquidateAllPositions=${currentSettings.liquidateAllPositions ? 1 : 0}`,
      ``,
      `# Advanced Controls`,
      `MaxSharesPerPosition=${currentSettings.maxSharesPerPosition}`,
      `MaxOrderSize=${currentSettings.maxOrderSize}`,
      `MaxDailyTrades=${currentSettings.maxDailyTrades}`,
      `MaxPositions=${currentSettings.maxPositions}`,
    ].join("\n");
    const blob = new Blob([cfg], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "RiskControl.cfg"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8" style={{ backgroundColor: '#0a0a0a', color: '#ffffff', minHeight: '100vh' }}>
      <header className="card p-4 sm:p-6" style={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#ffffff' }}>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Cobra Risk Dashboard</h1>
          <p className="text-gray-400 text-sm sm:text-base">v1.0 – October 2025</p>
        </div>
      </header>

      <section className="card p-4 sm:p-6 space-y-4" style={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#ffffff' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold">How to Use</h2>
          <button 
            onClick={exportCfg} 
            className="btn btn-primary px-6 py-3 text-base font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            style={{ 
              backgroundColor: '#3b82f6', 
              borderColor: '#3b82f6',
              color: '#ffffff',
              border: '2px solid #3b82f6'
            }}
          >
            📥 Export RiskControl.cfg
          </button>
        </div>
        <ol className="list-decimal list-inside text-gray-300 space-y-1">
          <li>Choose a <b>Risk Mode</b> (Conservative, Standard, Aggressive, or Custom) and enter your <b>Equity</b>, <b>Today's P&L</b>, and <b>Halted Exposure</b>.</li>
          <li>If using <b>Custom</b> mode, adjust all risk settings to your preferences using the comprehensive controls above.</li>
          <li>Watch the color-coded <b>Status</b> chips (🟢🟡🔴) and the <b>Flatten</b> recommendation for real-time risk assessment.</li>
          <li>Click <b>Export RiskControl.cfg</b> to download a complete DAS configuration file with all your settings.</li>
          <li>All inputs and custom settings persist in your browser (local only - no data leaves your device).</li>
        </ol>
        <div className="mt-4 pt-3 border-t border-gray-600">
          <p className="text-sm text-gray-400">
            📚 For detailed DAS Risk Control documentation, visit: 
            <a 
              href="https://dastrader.com/docs/risk-control/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline ml-1"
            >
              DAS Risk Control Guide
            </a>
          </p>
        </div>
      </section>

      <section className="card p-4 sm:p-6" style={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#ffffff' }}>
        <h2 className="text-lg font-semibold mb-4">Risk Mode Comparison</h2>
        <div className="gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {(["Conservative", "Standard", "Aggressive"] as Mode[]).map((presetMode) => {
            const preset = PRESET_MAP[presetMode];
            const isSelected = mode === presetMode;
            return (
              <div 
                key={presetMode}
                style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  border: '2px solid',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  borderColor: isSelected 
                    ? presetMode === "Conservative" 
                      ? '#10b981' 
                      : presetMode === "Standard"
                      ? '#eab308'
                      : '#ef4444'
                    : '#4b5563',
                  backgroundColor: isSelected 
                    ? presetMode === "Conservative" 
                      ? 'rgba(20, 83, 45, 0.4)' 
                      : presetMode === "Standard"
                      ? 'rgba(133, 77, 14, 0.4)'
                      : 'rgba(127, 29, 29, 0.4)'
                    : presetMode === "Conservative"
                    ? 'rgba(22, 101, 52, 0.2)'
                    : presetMode === "Standard"
                    ? 'rgba(133, 77, 14, 0.2)'
                    : 'rgba(127, 29, 29, 0.2)'
                }}
                onClick={() => setMode(presetMode)}
              >
                <div className="flex items-center justify-between mb-3">
                  <button 
                    className="font-semibold text-sm transition-colors text-white px-3 py-1 rounded"
                    style={{
                      backgroundColor: presetMode === "Conservative" 
                        ? '#10b981' 
                        : presetMode === "Standard"
                        ? '#eab308'
                        : '#ef4444'
                    }}
                    onClick={() => setMode(presetMode)}
                  >
                    {presetMode}
                  </button>
                  {isSelected && (
                    <span className={`text-xs ${
                      presetMode === "Conservative" 
                        ? 'text-green-400' 
                        : presetMode === "Standard"
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}>✓ Selected</span>
                  )}
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Daily Loss:</span>
                    <span className="font-medium">{pct(preset.dailyLossLimit, 1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Loss:</span>
                    <span className="font-medium">{pct(preset.totalLossLimit, 1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Per-Symbol:</span>
                    <span className="font-medium">{pct(preset.perSymbolLossLimit, 1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Exposure:</span>
                    <span className="font-medium">{pct(preset.perSymbolExposureLimit, 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Open Exposure Total:</span>
                    <span className="font-medium">{pct(preset.totalExposureLimit, 0)}</span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-600">
                  <div 
                    className="text-xs font-medium px-2 py-1 rounded"
                    style={{
                      color: '#e5e7eb',
                      backgroundColor: '#374151',
                      border: '1px solid #4b5563'
                    }}
                  >
                    {presetMode === "Conservative" && "Ultra-safe limits for capital preservation"}
                    {presetMode === "Standard" && "Balanced approach for steady growth"}
                    {presetMode === "Aggressive" && "Higher limits for experienced traders"}
                  </div>
                </div>
              </div>
            );
          })}
          <div 
            style={{
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '2px solid',
              cursor: 'pointer',
              transition: 'all 0.2s',
              borderColor: mode === "Custom" ? '#3b82f6' : '#4b5563',
              backgroundColor: mode === "Custom" ? 'rgba(30, 58, 138, 0.4)' : 'rgba(30, 64, 175, 0.2)'
            }}
            onClick={() => setMode("Custom")}
          >
            <div className="flex items-center justify-between mb-3">
              <button 
                className="font-semibold text-sm transition-colors text-white px-3 py-1 rounded"
                style={{ backgroundColor: '#3b82f6' }}
                onClick={() => setMode("Custom")}
              >
                Custom
              </button>
              {mode === "Custom" && <span className="text-blue-400 text-xs">✓ Selected</span>}
            </div>
            <div 
              className="text-xs font-medium px-2 py-1 rounded"
              style={{
                color: '#e5e7eb',
                backgroundColor: '#374151',
                border: '1px solid #4b5563'
              }}
            >
              Fully customizable settings for advanced users
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }} className="grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="card p-8 pb-10" style={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#ffffff' }}>
          <h2 className="text-xl font-bold mb-6 text-center">📊 Inputs</h2>
          
          <div className="space-y-6">
            {/* Equity Section */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-lg">💰</span>
                <h3 className="text-md font-semibold text-gray-100">Account Equity</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Current Equity ($)
                  </label>
                  <input 
                    className={`w-full px-3 py-2 rounded-md border bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.equity ? 'border-red-500' : 'border-gray-600'}`} 
                    type="number" 
                    placeholder="100,000"
                    value={equity} 
                    onChange={(e)=>setEquity(Number(e.target.value))} 
                  />
                  {validationErrors.equity && <p className="text-red-400 text-xs mt-1">{validationErrors.equity}</p>}
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Prior Equity ($)
                  </label>
                  <input 
                    className={`w-full px-3 py-2 rounded-md border bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.priorEquity ? 'border-red-500' : 'border-gray-600'}`} 
                    type="number" 
                    placeholder="95,000"
                    value={priorEquity} 
                    onChange={(e)=>setPriorEquity(Number(e.target.value))} 
                  />
                  {validationErrors.priorEquity && <p className="text-red-400 text-xs mt-1">{validationErrors.priorEquity}</p>}
                </div>
              </div>
            </div>

            {/* Trading Data Section */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-lg">📈</span>
                <h3 className="text-md font-semibold text-gray-100">Trading Data</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Today's Realized P&L ($)
                  </label>
                  <input 
                    className="w-full px-3 py-2 rounded-md border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    type="number" 
                    placeholder="2,500"
                    value={todaysPnL} 
                    onChange={(e)=>setTodaysPnL(Number(e.target.value))} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Total Halted Exposure ($)
                  </label>
                  <input 
                    className={`w-full px-3 py-2 rounded-md border bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.haltedExposure ? 'border-red-500' : 'border-gray-600'}`} 
                    type="number" 
                    placeholder="0"
                    value={haltedExposure} 
                    onChange={(e)=>setHaltedExposure(Number(e.target.value))} 
                  />
                  {validationErrors.haltedExposure && <p className="text-red-400 text-xs mt-1">{validationErrors.haltedExposure}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-8 space-y-4" style={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#ffffff' }}>
          <h2 className="text-lg font-semibold">Status</h2>
          {hasValidationErrors && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
              <p className="text-red-400 text-sm">⚠️ Please fix input errors above to see accurate calculations</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-center">
            <div>Drawdown % vs Prior</div>
            <div className={"rounded-full px-2.5 py-0.5 text-xs font-medium text-center " + statusColor(drawdownStatus)}>
              {statusIcon(drawdownStatus)} {pct(drawdown,1)} · {drawdownStatus}
            </div>

            <div>Remaining Loss Budget (today)</div>
            <div className={"rounded-full px-2.5 py-0.5 text-xs font-medium text-center " + statusColor(remainingStatus)}>
              {statusIcon(remainingStatus)} {dollars(remainingBudget)} · {remainingStatus}
            </div>

            <div>Halted Exposure %</div>
            <div className={"rounded-full px-2.5 py-0.5 text-xs font-medium text-center " + statusColor(haltedStatus)}>
              {statusIcon(haltedStatus)} {pct(haltedPct,0)} · {haltedStatus}
            </div>

            <div>Total Loss Used</div>
            <div className={"rounded-full px-2.5 py-0.5 text-xs font-medium text-center " + (Math.abs(totalLossUsed) > Math.abs(totalLossLimit) * 0.8 ? "bg-danger" : Math.abs(totalLossUsed) > Math.abs(totalLossLimit) * 0.5 ? "bg-caution" : "bg-safe")}>
              {statusIcon(Math.abs(totalLossUsed) > Math.abs(totalLossLimit) * 0.8 ? "Danger" : Math.abs(totalLossUsed) > Math.abs(totalLossLimit) * 0.5 ? "Caution" : "Safe")} {dollars(totalLossUsed)} · {Math.abs(totalLossRemaining) > Math.abs(totalLossLimit) * 0.2 ? "Safe" : "Danger"}
            </div>

            <div>Flatten Recommendation</div>
            <div className={flattenNow ? "text-danger font-semibold" : "text-safe font-semibold"}>
              {flattenNow ? "⚠ Flatten Now – High Risk" : "OK – Within Risk Limits"}
            </div>
          </div>
        </div>

        <div className="card p-8 space-y-4" style={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#ffffff' }}>
        <h2 className="text-lg font-semibold">Calculated Limits</h2>
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {mode === "Custom" ? (
              // Show all settings for Custom mode
              <>
          <Metric label="Daily Realized Loss (DayLossLimit)" value={dollars(dayLossLimit)} />
          <Metric label="Total Loss (TotalLossLimit)" value={dollars(totalLossLimit)} />
          <Metric label="Per-Symbol Unrealized (PosUnrealLossLimit)" value={dollars(perSymbolLimit)} />
          <Metric label="Max Exposure / Ticker (PosMktValueLimit)" value={dollars(perTickerExposure)} />
          <Metric label="Total Exposure (OpenPosValueLimit)" value={dollars(totalExposure)} />
          <Metric label="Profit Lock Trigger (ProfitLockStart)" value={dollars(profitLockStart)} />
          <Metric label="Profit Lock Drawdown %" value={pct(profitLockDrawdown,0)} />
                <Metric label="Trading Cutoff Time (ET)" value={currentSettings.stopTime} />
                <Metric label="Max Shares Per Position" value={currentSettings.maxSharesPerPosition.toLocaleString()} />
                <Metric label="Max Order Size" value={currentSettings.maxOrderSize.toLocaleString()} />
                <Metric label="Max Daily Trades" value={currentSettings.maxDailyTrades.toString()} />
                <Metric label="Max Concurrent Positions" value={currentSettings.maxPositions.toString()} />
              </>
            ) : (
              // Show only basic settings for presets
              <>
                <Metric label="Daily Realized Loss (DayLossLimit)" value={dollars(dayLossLimit)} />
                <Metric label="Total Loss (TotalLossLimit)" value={dollars(totalLossLimit)} />
                <Metric label="Per-Symbol Unrealized (PosUnrealLossLimit)" value={dollars(perSymbolLimit)} />
                <Metric label="Max Exposure / Ticker (PosMktValueLimit)" value={dollars(perTickerExposure)} />
                <Metric label="Total Exposure (OpenPosValueLimit)" value={dollars(totalExposure)} />
              </>
            )}
          </div>
        </div>
      </section>

      {mode === "Custom" && (
        <section className="card p-4 sm:p-6 space-y-4" style={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#ffffff' }}>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Custom Risk Settings</h2>
            <button 
              onClick={() => setCustomSettings(PRESET_MAP.Custom)}
              className="text-sm text-blue-400 hover:text-blue-300 underline"
            >
              Reset to Defaults
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Tooltip content="Maximum daily realized loss allowed. When reached, new orders are disabled but existing positions remain intact.">
                <label className="text-sm text-gray-300 cursor-help">Daily Loss Limit (%) <span className="text-blue-400">ℹ️</span></label>
              </Tooltip>
              <input 
                className="input" 
                type="number" 
                step="0.1"
                min="0"
                max="100"
                value={customSettings.dailyLossLimit * 100} 
                onChange={(e)=>setCustomSettings({...customSettings, dailyLossLimit: Number(e.target.value) / 100})} 
              />
            </div>
            <div>
              <Tooltip content="Maximum total loss (realized + unrealized) allowed. When reached, all positions are liquidated and new orders are disabled.">
                <label className="text-sm text-gray-300 cursor-help">Total Loss Limit (%) <span className="text-blue-400">ℹ️</span></label>
              </Tooltip>
              <input 
                className="input" 
                type="number" 
                step="0.1"
                min="0"
                max="100"
                value={customSettings.totalLossLimit * 100} 
                onChange={(e)=>setCustomSettings({...customSettings, totalLossLimit: Number(e.target.value) / 100})} 
              />
            </div>
            <div>
              <Tooltip content="Maximum unrealized loss allowed per individual symbol. When reached, only that specific position is liquidated.">
                <label className="text-sm text-gray-300 cursor-help">Per-Symbol Loss Limit (%) <span className="text-blue-400">ℹ️</span></label>
              </Tooltip>
              <input 
                className="input" 
                type="number" 
                step="0.1"
                min="0"
                max="100"
                value={customSettings.perSymbolLossLimit * 100} 
                onChange={(e)=>setCustomSettings({...customSettings, perSymbolLossLimit: Number(e.target.value) / 100})} 
              />
            </div>
            <div>
              <Tooltip content="Maximum market value exposure allowed per individual symbol. Prevents over-concentration in a single position.">
                <label className="text-sm text-gray-300 cursor-help">Per-Symbol Exposure Limit (%) <span className="text-blue-400">ℹ️</span></label>
              </Tooltip>
              <input 
                className="input" 
                type="number" 
                step="0.1"
                min="0"
                max="100"
                value={customSettings.perSymbolExposureLimit * 100} 
                onChange={(e)=>setCustomSettings({...customSettings, perSymbolExposureLimit: Number(e.target.value) / 100})} 
              />
            </div>
            <div>
              <Tooltip content="Maximum total market value exposure across all positions. Caps gross leverage during active trading sessions.">
                <label className="text-sm text-gray-300 cursor-help">Total Exposure Limit (%) <span className="text-blue-400">ℹ️</span></label>
              </Tooltip>
              <input 
                className="input" 
                type="number" 
                step="0.1"
                min="0"
                max="100"
                value={customSettings.totalExposureLimit * 100} 
                onChange={(e)=>setCustomSettings({...customSettings, totalExposureLimit: Number(e.target.value) / 100})} 
              />
            </div>
            <div>
              <Tooltip content="Profit level at which profit protection is activated. Once reached, positions are protected from giving back profits beyond the drawdown limit.">
                <label className="text-sm text-gray-300 cursor-help">Profit Lock Start (%) <span className="text-blue-400">ℹ️</span></label>
              </Tooltip>
              <input 
                className="input" 
                type="number" 
                step="0.1"
                min="0"
                max="100"
                value={customSettings.profitLockStart * 100} 
                onChange={(e)=>setCustomSettings({...customSettings, profitLockStart: Number(e.target.value) / 100})} 
              />
            </div>
            <div>
              <Tooltip content="Maximum drawdown allowed from peak profits before profit protection triggers liquidation.">
                <label className="text-sm text-gray-300 cursor-help">Profit Lock Drawdown (%) <span className="text-blue-400">ℹ️</span></label>
              </Tooltip>
              <input 
                className="input" 
                type="number" 
                step="0.1"
                min="0"
                max="100"
                value={customSettings.profitLockDrawdown * 100} 
                onChange={(e)=>setCustomSettings({...customSettings, profitLockDrawdown: Number(e.target.value) / 100})} 
              />
            </div>
            <div>
              <Tooltip content="Time of day when trading is automatically stopped. All positions are closed and new orders are disabled at this time.">
                <label className="text-sm text-gray-300 cursor-help">Stop Time <span className="text-blue-400">ℹ️</span></label>
              </Tooltip>
              <input 
                className="input" 
                type="time" 
                value={customSettings.stopTime} 
                onChange={(e)=>setCustomSettings({...customSettings, stopTime: e.target.value})} 
              />
            </div>
            <div>
              <Tooltip content="Maximum number of shares allowed in any single position. Orders exceeding this limit will be rejected.">
                <label className="text-sm text-gray-300 cursor-help">Max Shares Per Position <span className="text-blue-400">ℹ️</span></label>
              </Tooltip>
              <input 
                className="input" 
                type="number" 
                min="0"
                value={customSettings.maxSharesPerPosition} 
                onChange={(e)=>setCustomSettings({...customSettings, maxSharesPerPosition: Number(e.target.value)})} 
              />
            </div>
            <div>
              <Tooltip content="Maximum order size allowed per individual order. Prevents oversized trades that could cause excessive risk.">
                <label className="text-sm text-gray-300 cursor-help">Max Order Size <span className="text-blue-400">ℹ️</span></label>
              </Tooltip>
              <input 
                className="input" 
                type="number" 
                min="0"
                value={customSettings.maxOrderSize} 
                onChange={(e)=>setCustomSettings({...customSettings, maxOrderSize: Number(e.target.value)})} 
              />
            </div>
            <div>
              <Tooltip content="Maximum number of trades allowed per day. Helps prevent overtrading and excessive commission costs.">
                <label className="text-sm text-gray-300 cursor-help">Max Daily Trades <span className="text-blue-400">ℹ️</span></label>
              </Tooltip>
              <input 
                className="input" 
                type="number" 
                min="0"
                value={customSettings.maxDailyTrades} 
                onChange={(e)=>setCustomSettings({...customSettings, maxDailyTrades: Number(e.target.value)})} 
              />
            </div>
            <div>
              <Tooltip content="Maximum number of concurrent positions allowed. Helps manage portfolio complexity and risk concentration.">
                <label className="text-sm text-gray-300 cursor-help">Max Positions <span className="text-blue-400">ℹ️</span></label>
              </Tooltip>
              <input 
                className="input" 
                type="number" 
                min="0"
                value={customSettings.maxPositions} 
                onChange={(e)=>setCustomSettings({...customSettings, maxPositions: Number(e.target.value)})} 
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-600">
            <Tooltip content="Automatically applies stop-loss orders to protect against large losses. When enabled, stop-loss orders are placed automatically.">
              <label className="flex items-center space-x-2 cursor-help">
                <input 
                  type="checkbox" 
                  checked={customSettings.autoStopLoss}
                  onChange={(e)=>setCustomSettings({...customSettings, autoStopLoss: e.target.checked})}
                  className="rounded"
                />
                <span className="text-sm text-gray-300">Auto Stop Loss <span className="text-blue-400">ℹ️</span></span>
              </label>
            </Tooltip>
            <Tooltip content="Disables new order entry when risk limits are reached. Existing positions remain open but no new trades can be placed.">
              <label className="flex items-center space-x-2 cursor-help">
                <input 
                  type="checkbox" 
                  checked={customSettings.disableNewOrders}
                  onChange={(e)=>setCustomSettings({...customSettings, disableNewOrders: e.target.checked})}
                  className="rounded"
                />
                <span className="text-sm text-gray-300">Disable New Orders <span className="text-blue-400">ℹ️</span></span>
              </label>
            </Tooltip>
            <Tooltip content="Automatically liquidates all positions when total loss limits are reached. Provides maximum protection by closing all trades.">
              <label className="flex items-center space-x-2 cursor-help">
                <input 
                  type="checkbox" 
                  checked={customSettings.liquidateAllPositions}
                  onChange={(e)=>setCustomSettings({...customSettings, liquidateAllPositions: e.target.checked})}
                  className="rounded"
                />
                <span className="text-sm text-gray-300">Liquidate All Positions <span className="text-blue-400">ℹ️</span></span>
              </label>
            </Tooltip>
          </div>
      </section>
      )}



      <footer className="text-center text-xs text-gray-400 pb-8">
        © {new Date().getFullYear()} Cobra Risk Dashboard · Dark theme · No data leaves your browser.
      </footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string; }) {
  return (
    <div className="p-3 sm:p-4 rounded-xl bg-gray-700 border border-gray-600" style={{ backgroundColor: '#374151', borderColor: '#4b5563', color: '#ffffff' }}>
      <div className="text-xs text-gray-400" style={{ color: '#9ca3af' }}>{label}</div>
      <div className="text-base sm:text-lg font-semibold" style={{ color: '#ffffff' }}>{value}</div>
    </div>
  );
}
