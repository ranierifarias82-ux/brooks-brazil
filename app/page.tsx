"use client";

import React, { useEffect, useMemo, useState } from "react";

type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type TrendState = "BULL" | "BEAR" | "RANGE";
type Action = "COMPRA" | "VENDA" | "AGUARDAR";
type SignalQuality = "FORTE" | "MEDIA" | "FRACA";

type TradePlan = {
  action: Action;
  setup: string;
  context: string;
  signalQuality: SignalQuality;
  entry: number | null;
  stop: number | null;
  target: number | null;
  rr: number | null;
  explanation: string;
};

const DEFAULT_SYMBOL = "VALE3.SA";

function formatBRL(value: number | null) {
  if (value == null || Number.isNaN(value)) return "R$ --";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function getLast(candles: Candle[], n: number) {
  return candles.slice(-n);
}

function barRange(c: Candle) {
  return c.high - c.low;
}

function barBody(c: Candle) {
  return Math.abs(c.close - c.open);
}

function isBullBar(c: Candle) {
  return c.close > c.open;
}

function isBearBar(c: Candle) {
  return c.close < c.open;
}

function signalBarQuality(bar: Candle): SignalQuality {
  const range = barRange(bar);
  if (range <= 0) return "FRACA";
  const ratio = barBody(bar) / range;
  if (ratio >= 0.65) return "FORTE";
  if (ratio >= 0.4) return "MEDIA";
  return "FRACA";
}

function atr(candles: Candle[], period = 14) {
  if (candles.length < period + 1) return 0;

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }

  return average(trs.slice(-period));
}

function detectTrendState(candles: Candle[]): TrendState {
  const last = getLast(candles, 12);
  if (last.length < 12) return "RANGE";

  const bullBars = last.filter(isBullBar).length;
  const bearBars = last.filter(isBearBar).length;
  const strongBull = last.filter(
    (b) => isBullBar(b) && signalBarQuality(b) !== "FRACA"
  ).length;
  const strongBear = last.filter(
    (b) => isBearBar(b) && signalBarQuality(b) !== "FRACA"
  ).length;

  const overlapCount = last.slice(1).filter((b, i) => {
    const prev = last[i];
    return !(b.low > prev.high || b.high < prev.low);
  }).length;

  if (bullBars >= 8 && strongBull >= 4 && overlapCount <= 6) return "BULL";
  if (bearBars >= 8 && strongBear >= 4 && overlapCount <= 6) return "BEAR";
  return "RANGE";
}

function findSwingLows(candles: Candle[]) {
  const swings: { index: number; price: number }[] = [];
  for (let i = 1; i < candles.length - 1; i++) {
    if (candles[i].low < candles[i - 1].low && candles[i].low < candles[i + 1].low) {
      swings.push({ index: i, price: candles[i].low });
    }
  }
  return swings;
}

function findSwingHighs(candles: Candle[]) {
  const swings: { index: number; price: number }[] = [];
  for (let i = 1; i < candles.length - 1; i++) {
    if (candles[i].high > candles[i - 1].high && candles[i].high > candles[i + 1].high) {
      swings.push({ index: i, price: candles[i].high });
    }
  }
  return swings;
}

function detectH2Improved(candles: Candle[]) {
  const trend = detectTrendState(candles);
  if (trend !== "BULL" || candles.length < 10) return false;

  const last = getLast(candles, 10);
  const signal = last[last.length - 1];
  const prior = last[last.length - 2];

  const swingLows = findSwingLows(last);
  if (swingLows.length < 2) return false;

  const low1 = swingLows[swingLows.length - 2];
  const low2 = swingLows[swingLows.length - 1];

  const twoLeggedPullback = low2.index > low1.index;
  const secondLowHigherOrNear = low2.price >= low1.price * 0.985;
  const bullishSignal = signal.high > prior.high && !isBearBar(signal);

  return twoLeggedPullback && secondLowHigherOrNear && bullishSignal;
}

function detectLow2Improved(candles: Candle[]) {
  const trend = detectTrendState(candles);
  if (trend !== "BEAR" || candles.length < 10) return false;

  const last = getLast(candles, 10);
  const signal = last[last.length - 1];
  const prior = last[last.length - 2];

  const swingHighs = findSwingHighs(last);
  if (swingHighs.length < 2) return false;

  const high1 = swingHighs[swingHighs.length - 2];
  const high2 = swingHighs[swingHighs.length - 1];

  const twoLeggedPullback = high2.index > high1.index;
  const secondHighLowerOrNear = high2.price <= high1.price * 1.015;
  const bearishSignal = signal.low < prior.low && !isBullBar(signal);

  return twoLeggedPullback && secondHighLowerOrNear && bearishSignal;
}

function detectWedgeBull(candles: Candle[]) {
  if (candles.length < 20) return false;
  const last = getLast(candles, 20);
  const lows = findSwingLows(last);
  if (lows.length < 3) return false;

  const p1 = lows[lows.length - 3];
  const p2 = lows[lows.length - 2];
  const p3 = lows[lows.length - 1];

  const threePushes = p1.index < p2.index && p2.index < p3.index;
  const contractingOrFlat = p3.price >= p2.price * 0.97 || p3.price >= p1.price * 0.95;

  const signal = last[last.length - 1];
  const prior = last[last.length - 2];
  const bullishTrigger = signal.high > prior.high;

  return threePushes && contractingOrFlat && bullishTrigger;
}

function detectWedgeBear(candles: Candle[]) {
  if (candles.length < 20) return false;
  const last = getLast(candles, 20);
  const highs = findSwingHighs(last);
  if (highs.length < 3) return false;

  const p1 = highs[highs.length - 3];
  const p2 = highs[highs.length - 2];
  const p3 = highs[highs.length - 1];

  const threePushes = p1.index < p2.index && p2.index < p3.index;
  const contractingOrFlat = p3.price <= p2.price * 1.03 || p3.price <= p1.price * 1.05;

  const signal = last[last.length - 1];
  const prior = last[last.length - 2];
  const bearishTrigger = signal.low < prior.low;

  return threePushes && contractingOrFlat && bearishTrigger;
}

function detectMajorTrendReversalBull(candles: Candle[]) {
  if (candles.length < 25) return false;

  const last = getLast(candles, 25);
  const firstPart = last.slice(0, 12);
  const secondPart = last.slice(12);

  const priorTrend = detectTrendState(firstPart);
  if (priorTrend !== "BEAR") return false;

  const lowestLow = Math.min(...last.map((c) => c.low));
  const recentLow = Math.min(...secondPart.slice(0, 6).map((c) => c.low));
  const retestLow = Math.min(...secondPart.slice(6).map((c) => c.low));

  const retest = Math.abs(recentLow - retestLow) / lowestLow < 0.03;
  const lastBar = last[last.length - 1];
  const priorBar = last[last.length - 2];

  const strongBullReversal =
    signalBarQuality(lastBar) === "FORTE" &&
    isBullBar(lastBar) &&
    (lastBar.high > priorBar.high || lastBar.close > priorBar.close);

  return retest && strongBullReversal;
}

function detectMajorTrendReversalBear(candles: Candle[]) {
  if (candles.length < 25) return false;

  const last = getLast(candles, 25);
  const firstPart = last.slice(0, 12);
  const secondPart = last.slice(12);

  const priorTrend = detectTrendState(firstPart);
  if (priorTrend !== "BULL") return false;

  const highestHigh = Math.max(...last.map((c) => c.high));
  const recentHigh = Math.max(...secondPart.slice(0, 6).map((c) => c.high));
  const retestHigh = Math.max(...secondPart.slice(6).map((c) => c.high));

  const retest = Math.abs(recentHigh - retestHigh) / highestHigh < 0.03;
  const lastBar = last[last.length - 1];
  const priorBar = last[last.length - 2];

  const strongBearReversal =
    signalBarQuality(lastBar) === "FORTE" &&
    isBearBar(lastBar) &&
    (lastBar.low < priorBar.low || lastBar.close < priorBar.close);

  return retest && strongBearReversal;
}

function buildTradePlan(candles: Candle[], timeframe: "WEEKLY" | "DAILY"): TradePlan {
  if (candles.length < 30) {
    return {
      action: "AGUARDAR",
      setup: "Sem dados",
      context: "Dados insuficientes",
      signalQuality: "FRACA",
      entry: null,
      stop: null,
      target: null,
      rr: null,
      explanation: "Não há barras suficientes para leitura confiável.",
    };
  }

  const trend = detectTrendState(candles);
  const signal = candles[candles.length - 1];
  const quality = signalBarQuality(signal);
  const vola = atr(candles, 14);

  const isH2 = detectH2Improved(candles);
  const isLow2 = detectLow2Improved(candles);
  const isWedgeBull = detectWedgeBull(candles);
  const isWedgeBear = detectWedgeBear(candles);
  const isBullMTR = detectMajorTrendReversalBull(candles);
  const isBearMTR = detectMajorTrendReversalBear(candles);

  let action: Action = "AGUARDAR";
  let setup = "Sem setup";
  let entry: number | null = null;
  let stop: number | null = null;
  let target: number | null = null;
  let explanation = "";

  const tick = Math.max(0.01, vola * 0.03);

  if (isH2 || isWedgeBull || isBullMTR) {
    action = "COMPRA";
    setup = isH2 ? "H2" : isWedgeBull ? "Wedge Bull" : "MTR Bull";

    entry = signal.high + tick;

    if (setup === "H2") {
      stop = Math.min(...getLast(candles, 6).map((c) => c.low));
      explanation =
        timeframe === "WEEKLY"
          ? "Compra semanal por continuação em H2 dentro de contexto bull."
          : "Compra diária por H2 em continuação favorável.";
    } else if (setup === "Wedge Bull") {
      stop = Math.min(...getLast(candles, 10).map((c) => c.low));
      explanation =
        timeframe === "WEEKLY"
          ? "Compra semanal por wedge bull com gatilho acima da barra de sinal."
          : "Compra diária por wedge bull após 3 pushes.";
    } else {
      stop = signal.low;
      explanation =
        timeframe === "WEEKLY"
          ? "Compra semanal por Major Trend Reversal bull."
          : "Compra diária por reversão maior para alta.";
    }

    const risk = entry - stop;
    target = risk > 0 ? entry + risk * 2 : null;
  } else if (isLow2 || isWedgeBear || isBearMTR) {
    action = "VENDA";
    setup = isLow2 ? "Low 2" : isWedgeBear ? "Wedge Bear" : "MTR Bear";

    entry = signal.low - tick;

    if (setup === "Low 2") {
      stop = Math.max(...getLast(candles, 6).map((c) => c.high));
      explanation =
        timeframe === "WEEKLY"
          ? "Venda semanal por continuação em Low 2 dentro de contexto bear."
          : "Venda diária por Low 2 em continuação vendedora.";
    } else if (setup === "Wedge Bear") {
      stop = Math.max(...getLast(candles, 10).map((c) => c.high));
      explanation =
        timeframe === "WEEKLY"
          ? "Venda semanal por wedge bear com gatilho abaixo da barra de sinal."
          : "Venda diária por wedge bear após 3 pushes.";
    } else {
      stop = signal.high;
      explanation =
        timeframe === "WEEKLY"
          ? "Venda semanal por Major Trend Reversal bear."
          : "Venda diária por reversão maior para baixa.";
    }

    const risk = stop - entry;
    target = risk > 0 ? entry - risk * 2 : null;
  } else {
    explanation =
      timeframe === "WEEKLY"
        ? "O gráfico semanal não apresenta confluência suficiente entre contexto e setup."
        : "O gráfico diário não apresenta confluência suficiente entre contexto e setup.";
  }

  const rr =
    entry != null && stop != null && target != null && Math.abs(entry - stop) > 0
      ? Math.abs(target - entry) / Math.abs(entry - stop)
      : null;

  const contextLabel =
    trend === "BULL" ? "Bull Trend" : trend === "BEAR" ? "Bear Trend" : "Trading Range";

  return {
    action,
    setup,
    context: contextLabel,
    signalQuality: quality,
    entry,
    stop,
    target,
    rr,
    explanation,
  };
}

function transformYahooData(data: any): Candle[] {
  const result = data?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];

  if (!result || !quote) return [];

  const candles: Candle[] = [];

  for (let i = 0; i < result.timestamp.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];

    if (
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      Number.isNaN(open) ||
      Number.isNaN(high) ||
      Number.isNaN(low) ||
      Number.isNaN(close)
    ) {
      continue;
    }

    candles.push({
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume ?? 0),
    });
  }

  return candles;
}

async function fetchCandles(symbol: string, interval: "1wk" | "1d", range: string) {
  const res = await fetch(
    `/api/history?symbol=${encodeURIComponent(symbol)}&interval=${interval}&range=${range}`,
    { cache: "no-store" }
  );
  const data = await res.json();
  return transformYahooData(data);
}

function TradingViewChart({
  symbol,
  interval,
  title,
}: {
  symbol: string;
  interval: "W" | "D";
  title: string;
}) {
  const tvSymbol = symbol.replace(".SA", "");
  const src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_${interval}_${tvSymbol}&symbol=BMFBOVESPA:${tvSymbol}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=F1F3F6&studies=[]&theme=dark&style=1&timezone=America%2FSao_Paulo&withdateranges=1&hideideas=1`;

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <iframe
        title={title}
        src={src}
        style={{
          width: "100%",
          height: 420,
          border: "1px solid #333",
          borderRadius: 12,
          background: "#111",
        }}
      />
    </div>
  );
}

function AnalysisCard({
  title,
  plan,
}: {
  title: string;
  plan: TradePlan | null;
}) {
  return (
    <div
      style={{
        background: "#171717",
        color: "#fff",
        padding: 20,
        borderRadius: 16,
        border: "1px solid #2a2a2a",
        marginBottom: 16,
      }}
    >
      <h2 style={{ marginTop: 0 }}>{title}</h2>

      {!plan ? (
        <p>Carregando...</p>
      ) : (
        <>
          <p>
            <strong>Sugestão:</strong> {plan.action}
          </p>
          <p>
            <strong>Setup:</strong> {plan.setup}
          </p>
          <p>
            <strong>Contexto:</strong> {plan.context}
          </p>
          <p>
            <strong>Qualidade da barra:</strong> {plan.signalQuality}
          </p>
          <p>
            <strong>Ponto de entrada:</strong> {formatBRL(plan.entry)}
          </p>
          <p>
            <strong>Stop Loss:</strong> {formatBRL(plan.stop)}
          </p>
          <p>
            <strong>Take Profit:</strong> {formatBRL(plan.target)}
          </p>
          <p>
            <strong>Risco/Retorno:</strong>{" "}
            {plan.rr != null ? `1:${plan.rr.toFixed(2)}` : "--"}
          </p>
          <p>
            <strong>Leitura:</strong> {plan.explanation}
          </p>
        </>
      )}
    </div>
  );
}

export default function Page() {
  const [symbolInput, setSymbolInput] = useState(DEFAULT_SYMBOL);
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [weeklyPlan, setWeeklyPlan] = useState<TradePlan | null>(null);
  const [dailyPlan, setDailyPlan] = useState<TradePlan | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAnalysis(activeSymbol: string) {
    setLoading(true);
    try {
      const [weeklyCandles, dailyCandles] = await Promise.all([
        fetchCandles(activeSymbol, "1wk", "2y"),
        fetchCandles(activeSymbol, "1d", "1y"),
      ]);

      setWeeklyPlan(buildTradePlan(weeklyCandles, "WEEKLY"));
      setDailyPlan(buildTradePlan(dailyCandles, "DAILY"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runAnalysis(symbol);
  }, [symbol]);

  const cleanTicker = useMemo(() => symbol.replace(".SA", ""), [symbol]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b0b",
        color: "#fff",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Brooks Brazil — Weekly + Daily</h1>
        <p style={{ color: "#bbb" }}>
          Análise em dois timeframes com lógica modelada nos 3 livros do Al Brooks.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <input
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
            placeholder="Ex: VALE3.SA"
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid #333",
              background: "#151515",
              color: "#fff",
              minWidth: 220,
            }}
          />
          <button
            onClick={() => setSymbol(symbolInput)}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "none",
              background: "#16a34a",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Analisar
          </button>
        </div>

        {loading && <p>Atualizando análise...</p>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <div>
            <AnalysisCard title={`Semanal — ${cleanTicker}`} plan={weeklyPlan} />
            <TradingViewChart
              symbol={symbol}
              interval="W"
              title={`Gráfico Semanal — ${cleanTicker}`}
            />
          </div>

          <div>
            <AnalysisCard title={`Diário — ${cleanTicker}`} plan={dailyPlan} />
            <TradingViewChart
              symbol={symbol}
              interval="D"
              title={`Gráfico Diário — ${cleanTicker}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}