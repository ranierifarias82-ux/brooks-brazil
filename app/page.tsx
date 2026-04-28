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
type TF = "WEEKLY" | "DAILY" | "H4";

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
  brooksReason: string;
  brooksReference: string;
  probability: number | null;
  grade: "A+" | "A" | "B" | "C" | "Neutro";
};

type ScannerItem = {
  ticker: string;
  name: string;
  sector: string;
  weekly: TradePlan;
  daily: TradePlan;
  h4: TradePlan;
  palexDaily: TradePlan;
  score: number;
};

const STOCK_CATALOG = [
  { ticker: "VALE3", name: "Vale", sector: "Materiais Básicos" },
  { ticker: "PETR4", name: "Petrobras PN", sector: "Petróleo, Gás e Biocombustíveis" },
  { ticker: "ITUB4", name: "Itaú Unibanco PN", sector: "Financeiro" },
  { ticker: "BBDC4", name: "Bradesco PN", sector: "Financeiro" },
  { ticker: "BBAS3", name: "Banco do Brasil", sector: "Financeiro" },
  { ticker: "B3SA3", name: "B3", sector: "Financeiro" },
  { ticker: "WEGE3", name: "WEG", sector: "Bens Industriais" },
  { ticker: "RENT3", name: "Localiza", sector: "Consumo Cíclico" },
  { ticker: "LREN3", name: "Lojas Renner", sector: "Consumo Cíclico" },
  { ticker: "MGLU3", name: "Magazine Luiza", sector: "Consumo Cíclico" },
  { ticker: "ABEV3", name: "Ambev", sector: "Consumo Não Cíclico" },
  { ticker: "JBSS3", name: "JBS", sector: "Consumo Não Cíclico" },
  { ticker: "SUZB3", name: "Suzano", sector: "Materiais Básicos" },
  { ticker: "GGBR4", name: "Gerdau PN", sector: "Materiais Básicos" },
  { ticker: "CSNA3", name: "CSN", sector: "Materiais Básicos" },
  { ticker: "USIM5", name: "Usiminas PNA", sector: "Materiais Básicos" },
  { ticker: "RAIL3", name: "Rumo", sector: "Bens Industriais" },
  { ticker: "CCRO3", name: "CCR", sector: "Bens Industriais" },
  { ticker: "EQTL3", name: "Equatorial", sector: "Utilidade Pública" },
  { ticker: "CPFE3", name: "CPFL Energia", sector: "Utilidade Pública" },
  { ticker: "ELET3", name: "Eletrobras", sector: "Utilidade Pública" },
  { ticker: "SBSP3", name: "Sabesp", sector: "Utilidade Pública" },
  { ticker: "VIVT3", name: "Telefônica Brasil", sector: "Comunicações" },
  { ticker: "TIMS3", name: "TIM", sector: "Comunicações" },
  { ticker: "RADL3", name: "Raia Drogasil", sector: "Saúde" },
  { ticker: "RDOR3", name: "Rede D'Or", sector: "Saúde" },
  { ticker: "HAPV3", name: "Hapvida", sector: "Saúde" },
];

function formatBRL(value: number | null) {
  if (value == null || Number.isNaN(value)) return "R$ --";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeSymbol(input: string) {
  const s = input.trim().toUpperCase();
  if (!s) return "VALE3.SA";
  if (s.endsWith(".SA")) return s;
  if (s.startsWith("^")) return s;
  if (s.includes("-")) return s;
  return `${s}.SA`;
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
  const last = getLast(candles, 20);
  if (last.length < 20) return "RANGE";

  const bullBars = last.filter(isBullBar).length;
  const bearBars = last.filter(isBearBar).length;

  const strongBull = last.filter(
    (b) => isBullBar(b) && signalBarQuality(b) !== "FRACA"
  ).length;

  const strongBear = last.filter(
    (b) => isBearBar(b) && signalBarQuality(b) !== "FRACA"
  ).length;

  const closes = last.map((c) => c.close);
  const firstHalf = closes.slice(0, 10);
  const secondHalf = closes.slice(10);

  const firstAvg = average(firstHalf);
  const secondAvg = average(secondHalf);

  if (bullBars >= 11 && strongBull >= 5 && secondAvg > firstAvg) return "BULL";
  if (bearBars >= 11 && strongBear >= 5 && secondAvg < firstAvg) return "BEAR";

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

function getRecentSwingLow(candles: Candle[], lookback = 10) {
  return Math.min(...getLast(candles, lookback).map((c) => c.low));
}

function getRecentSwingHigh(candles: Candle[], lookback = 10) {
  return Math.max(...getLast(candles, lookback).map((c) => c.high));
}

function getMeasuredMoveTarget(
  entry: number,
  stop: number,
  direction: "LONG" | "SHORT",
  multiplier = 2
) {
  const risk = Math.abs(entry - stop);
  if (direction === "LONG") return entry + risk * multiplier;
  return entry - risk * multiplier;
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

  return (
    low2.index > low1.index &&
    low2.price >= low1.price * 0.985 &&
    signal.high > prior.high &&
    !isBearBar(signal)
  );
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

  return (
    high2.index > high1.index &&
    high2.price <= high1.price * 1.015 &&
    signal.low < prior.low &&
    !isBullBar(signal)
  );
}

function detectWedgeBull(candles: Candle[]) {
  if (candles.length < 20) return false;

  const last = getLast(candles, 20);
  const lows = findSwingLows(last);

  if (lows.length < 3) return false;

  const p1 = lows[lows.length - 3];
  const p2 = lows[lows.length - 2];
  const p3 = lows[lows.length - 1];

  const signal = last[last.length - 1];
  const prior = last[last.length - 2];

  return (
    p1.index < p2.index &&
    p2.index < p3.index &&
    (p3.price >= p2.price * 0.97 || p3.price >= p1.price * 0.95) &&
    signal.high > prior.high
  );
}

function detectWedgeBear(candles: Candle[]) {
  if (candles.length < 20) return false;

  const last = getLast(candles, 20);
  const highs = findSwingHighs(last);

  if (highs.length < 3) return false;

  const p1 = highs[highs.length - 3];
  const p2 = highs[highs.length - 2];
  const p3 = highs[highs.length - 1];

  const signal = last[last.length - 1];
  const prior = last[last.length - 2];

  return (
    p1.index < p2.index &&
    p2.index < p3.index &&
    (p3.price <= p2.price * 1.03 || p3.price <= p1.price * 1.05) &&
    signal.low < prior.low
  );
}

function detectMajorTrendReversalBull(candles: Candle[]) {
  if (candles.length < 25) return false;

  const last = getLast(candles, 25);
  const firstPart = last.slice(0, 12);
  const secondPart = last.slice(12);

  if (detectTrendState(firstPart) !== "BEAR") return false;

  const lowestLow = Math.min(...last.map((c) => c.low));
  const recentLow = Math.min(...secondPart.slice(0, 6).map((c) => c.low));
  const retestLow = Math.min(...secondPart.slice(6).map((c) => c.low));

  const lastBar = last[last.length - 1];
  const priorBar = last[last.length - 2];

  return (
    Math.abs(recentLow - retestLow) / lowestLow < 0.03 &&
    signalBarQuality(lastBar) === "FORTE" &&
    isBullBar(lastBar) &&
    (lastBar.high > priorBar.high || lastBar.close > priorBar.close)
  );
}

function detectMajorTrendReversalBear(candles: Candle[]) {
  if (candles.length < 25) return false;

  const last = getLast(candles, 25);
  const firstPart = last.slice(0, 12);
  const secondPart = last.slice(12);

  if (detectTrendState(firstPart) !== "BULL") return false;

  const highestHigh = Math.max(...last.map((c) => c.high));
  const recentHigh = Math.max(...secondPart.slice(0, 6).map((c) => c.high));
  const retestHigh = Math.max(...secondPart.slice(6).map((c) => c.high));

  const lastBar = last[last.length - 1];
  const priorBar = last[last.length - 2];

  return (
    Math.abs(recentHigh - retestHigh) / highestHigh < 0.03 &&
    signalBarQuality(lastBar) === "FORTE" &&
    isBearBar(lastBar) &&
    (lastBar.low < priorBar.low || lastBar.close < priorBar.close)
  );
}

function calculateProbability(params: {
  trend: TrendState;
  setup: string;
  signalQuality: SignalQuality;
  rr: number | null;
}) {
  let score = 50;

  if (params.trend === "BULL" || params.trend === "BEAR") score += 10;
  if (params.signalQuality === "FORTE") score += 12;
  if (params.signalQuality === "MEDIA") score += 6;

  if (params.setup === "H2" || params.setup === "Low 2") score += 12;
  if (params.setup === "Wedge Bull" || params.setup === "Wedge Bear") score += 9;
  if (params.setup === "MTR Bull" || params.setup === "MTR Bear") score += 10;
  if (params.setup === "Continuação de Tendência") score += 6;

  if (params.rr != null) {
    if (params.rr >= 2) score += 8;
    else if (params.rr >= 1.5) score += 4;
    else score -= 4;
  }

  if (score > 80) score = 80;
  if (score < 35) score = 35;

  return score;
}

function probabilityToGrade(probability: number | null): "A+" | "A" | "B" | "C" | "Neutro" {
  if (probability == null) return "Neutro";
  if (probability >= 76) return "A+";
  if (probability >= 70) return "A";
  if (probability >= 62) return "B";
  return "C";
}

function getGradeColor(grade: "A+" | "A" | "B" | "C" | "Neutro") {
  switch (grade) {
    case "A+":
      return "#22c55e";
    case "A":
      return "#16a34a";
    case "B":
      return "#eab308";
    case "C":
      return "#f97316";
    default:
      return "#6b7280";
  }
}

function buildTradePlan(candles: Candle[], timeframe: TF): TradePlan {
  if (candles.length < 20) {
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
      brooksReason: "Sem candles suficientes para leitura técnica consistente.",
      brooksReference:
        "Base insuficiente para aplicar a teoria de Trends, Reversals e Trading Ranges.",
      probability: null,
      grade: "Neutro",
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
  let brooksReason = "";
  let brooksReference = "";

  const tick = Math.max(0.01, vola * 0.03);

  if (isH2 || isWedgeBull || isBullMTR) {
    action = "COMPRA";
    setup = isH2 ? "H2" : isWedgeBull ? "Wedge Bull" : "MTR Bull";
    entry = signal.high + tick;

    if (setup === "H2") {
      stop = getRecentSwingLow(candles, 6);
      explanation =
        timeframe === "WEEKLY"
          ? "Compra por continuação em H2 dentro de tendência de alta."
          : timeframe === "DAILY"
          ? "Compra diária por H2 em contexto favorável."
          : "Compra em 4h por H2 dentro de contexto favorável.";
      brooksReason =
        "O mercado segue em tendência de alta e o pullback mostra duas pernas corretivas, favorecendo a segunda entrada compradora.";
      brooksReference =
        "Al Brooks - Trends: High 2 Buy Setup, Pullbacks em tendência, Always In Long.";
    } else if (setup === "Wedge Bull") {
      stop = getRecentSwingLow(candles, 10);
      explanation =
        timeframe === "WEEKLY"
          ? "Compra por wedge bull com rompimento da barra de sinal."
          : timeframe === "DAILY"
          ? "Compra diária por wedge bull após 3 pushes."
          : "Compra em 4h por wedge bull após 3 pushes.";
      brooksReason =
        "Há exaustão vendedora em três pushes para baixo, seguida de gatilho comprador acima da barra de sinal.";
      brooksReference =
        "Al Brooks - Reversals: Wedge Bottom, Three Push Pattern, reversão após exaustão.";
    } else {
      stop = signal.low;
      explanation =
        timeframe === "WEEKLY"
          ? "Compra por Major Trend Reversal de alta."
          : timeframe === "DAILY"
          ? "Compra diária por reversão maior para alta."
          : "Compra em 4h por reversão maior para alta.";
      brooksReason =
        "O mercado mostra falha em continuar a queda, reteste do fundo e barra forte de reversão, sugerindo mudança de lado dominante.";
      brooksReference =
        "Al Brooks - Reversals: Major Trend Reversal, Double Bottom, falha de continuação.";
    }

    target = stop != null ? getMeasuredMoveTarget(entry, stop, "LONG", 2) : null;
  } else if (isLow2 || isWedgeBear || isBearMTR) {
    action = "VENDA";
    setup = isLow2 ? "Low 2" : isWedgeBear ? "Wedge Bear" : "MTR Bear";
    entry = signal.low - tick;

    if (setup === "Low 2") {
      stop = getRecentSwingHigh(candles, 6);
      explanation =
        timeframe === "WEEKLY"
          ? "Venda por continuação em Low 2 dentro de tendência de baixa."
          : timeframe === "DAILY"
          ? "Venda diária por Low 2 em contexto vendedor."
          : "Venda em 4h por Low 2 em contexto vendedor.";
      brooksReason =
        "O mercado segue em tendência de baixa e o pullback mostra duas pernas corretivas, favorecendo a segunda entrada vendedora.";
      brooksReference =
        "Al Brooks - Trends: Low 2 Sell Setup, Pullbacks em bear trend, Always In Short.";
    } else if (setup === "Wedge Bear") {
      stop = getRecentSwingHigh(candles, 10);
      explanation =
        timeframe === "WEEKLY"
          ? "Venda por wedge bear com rompimento da barra de sinal."
          : timeframe === "DAILY"
          ? "Venda diária por wedge bear após 3 pushes."
          : "Venda em 4h por wedge bear após 3 pushes.";
      brooksReason =
        "Há exaustão compradora em três pushes para cima, seguida de gatilho vendedor abaixo da barra de sinal.";
      brooksReference =
        "Al Brooks - Reversals: Wedge Top, Three Push Pattern, reversão após exaustão.";
    } else {
      stop = signal.high;
      explanation =
        timeframe === "WEEKLY"
          ? "Venda por Major Trend Reversal de baixa."
          : timeframe === "DAILY"
          ? "Venda diária por reversão maior para baixa."
          : "Venda em 4h por reversão maior para baixa.";
      brooksReason =
        "O mercado mostra falha em continuar a alta, reteste do topo e barra forte de reversão, sugerindo troca do controle para vendedores.";
      brooksReference =
        "Al Brooks - Reversals: Major Trend Reversal, Double Top, falha de continuação.";
    }

    target = stop != null ? getMeasuredMoveTarget(entry, stop, "SHORT", 2) : null;
  }

  if (action === "AGUARDAR") {
    if (trend === "BULL") {
      action = "COMPRA";
      setup = "Continuação de Tendência";
      entry = signal.high + tick;
      stop = getRecentSwingLow(candles, 8);
      target = stop != null ? getMeasuredMoveTarget(entry, stop, "LONG", 1.8) : null;
      explanation =
        timeframe === "WEEKLY"
          ? "Sem setup clássico perfeito, mas o semanal segue em bull trend e permite leitura de continuação."
          : timeframe === "DAILY"
          ? "Sem setup clássico perfeito, mas o diário segue em bull trend e favorece continuidade."
          : "Sem setup clássico perfeito, mas o 4h segue em bull trend e favorece continuidade.";
      brooksReason =
        "Mesmo sem um gatilho clássico como H2, a direção dominante continua sendo de alta e o mercado permanece favorecendo continuação.";
      brooksReference =
        "Al Brooks - Trends: Trend Continuation, Always In Direction, pullbacks rasos.";
    } else if (trend === "BEAR") {
      action = "VENDA";
      setup = "Continuação de Tendência";
      entry = signal.low - tick;
      stop = getRecentSwingHigh(candles, 8);
      target = stop != null ? getMeasuredMoveTarget(entry, stop, "SHORT", 1.8) : null;
      explanation =
        timeframe === "WEEKLY"
          ? "Sem setup clássico perfeito, mas o semanal segue em bear trend e permite leitura de continuação."
          : timeframe === "DAILY"
          ? "Sem setup clássico perfeito, mas o diário segue em bear trend e favorece continuidade."
          : "Sem setup clássico perfeito, mas o 4h segue em bear trend e favorece continuidade.";
      brooksReason =
        "Mesmo sem um gatilho clássico como Low 2, a direção dominante continua sendo de baixa e o mercado segue pressionado para baixo.";
      brooksReference =
        "Al Brooks - Trends: Bear Trend Continuation, Always In Short, pullbacks em tendência.";
    } else {
      brooksReason =
        "O mercado está em equilíbrio entre compradores e vendedores, sem vantagem estatística clara para operação.";
      brooksReference =
        "Al Brooks - Trading Ranges: mercados laterais, Breakout Mode, equilíbrio entre forças.";
      explanation =
        timeframe === "WEEKLY"
          ? "O semanal está em trading range. Sem vantagem estatística clara para compra ou venda."
          : timeframe === "DAILY"
          ? "O diário está em trading range. Melhor aguardar um breakout ou reversão mais clara."
          : "O 4h está em trading range. Melhor aguardar rompimento ou reversão melhor definida.";
    }
  }

  const rr =
    entry != null && stop != null && target != null && Math.abs(entry - stop) > 0
      ? Math.abs(target - entry) / Math.abs(entry - stop)
      : null;

  const probability = calculateProbability({
    trend,
    setup,
    signalQuality: quality,
    rr,
  });

  const grade = probabilityToGrade(probability);

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
    brooksReason,
    brooksReference,
    probability,
    grade,
  };
}


function sma(values: number[], period: number) {
  if (values.length < period) return null;
  return average(values.slice(-period));
}

function smaAt(values: number[], period: number, endExclusive: number) {
  if (endExclusive < period) return null;
  return average(values.slice(endExclusive - period, endExclusive));
}

function stdDev(values: number[]) {
  if (!values.length) return 0;
  const avg = average(values);
  const variance = average(values.map((v) => Math.pow(v - avg, 2)));
  return Math.sqrt(variance);
}

function emaSeries(values: number[], period: number) {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = values[0];
  for (let i = 0; i < values.length; i++) {
    ema = i === 0 ? values[i] : values[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function rsiSeries(values: number[], period = 14) {
  if (values.length < period + 1) return [];
  const rsis: number[] = Array(period).fill(50);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsis.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = Math.max(diff, 0);
    const loss = Math.max(-diff, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsis.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }

  return rsis;
}

function highestHigh(candles: Candle[], lookback: number, offsetFromEnd = 0) {
  const end = candles.length - offsetFromEnd;
  const slice = candles.slice(Math.max(0, end - lookback), end);
  return slice.length ? Math.max(...slice.map((c) => c.high)) : null;
}

function lowestLow(candles: Candle[], lookback: number, offsetFromEnd = 0) {
  const end = candles.length - offsetFromEnd;
  const slice = candles.slice(Math.max(0, end - lookback), end);
  return slice.length ? Math.min(...slice.map((c) => c.low)) : null;
}

function volumeAverage(candles: Candle[], lookback = 20) {
  return average(getLast(candles, lookback).map((c) => c.volume || 0));
}

function isGapUp(current: Candle, previous: Candle, minPct = 0.003) {
  return current.open > previous.high * (1 + minPct);
}

function isGapDown(current: Candle, previous: Candle, minPct = 0.003) {
  return current.open < previous.low * (1 - minPct);
}

function lowerShadow(c: Candle) {
  return Math.min(c.open, c.close) - c.low;
}

function upperShadow(c: Candle) {
  return c.high - Math.max(c.open, c.close);
}

function isBullishReversalCandle(c: Candle) {
  const range = barRange(c);
  if (range <= 0) return false;
  return isBullBar(c) && c.close >= c.low + range * 0.6 && lowerShadow(c) >= barBody(c) * 0.6;
}

function isBearishReversalCandle(c: Candle) {
  const range = barRange(c);
  if (range <= 0) return false;
  return isBearBar(c) && c.close <= c.low + range * 0.4 && upperShadow(c) >= barBody(c) * 0.6;
}

function detectThreeLineBarDirection(candles: Candle[]): TrendState {
  if (candles.length < 4) return "RANGE";
  const last = candles[candles.length - 1];
  const prev3 = candles.slice(-4, -1);
  if (last.close > Math.max(...prev3.map((c) => c.high))) return "BULL";
  if (last.close < Math.min(...prev3.map((c) => c.low))) return "BEAR";
  return "RANGE";
}

type PalexCandidate = {
  action: Action;
  setup: string;
  score: number;
  entry: number;
  stop: number;
  target: number;
  context: string;
  explanation: string;
  reference: string;
};

function buildCandidate(params: {
  action: Exclude<Action, "AGUARDAR">;
  setup: string;
  score: number;
  entry: number;
  stop: number;
  context: string;
  explanation: string;
  reference: string;
  multiplier?: number;
}): PalexCandidate | null {
  if (!Number.isFinite(params.entry) || !Number.isFinite(params.stop)) return null;
  if (Math.abs(params.entry - params.stop) <= 0) return null;
  const target = getMeasuredMoveTarget(
    params.entry,
    params.stop,
    params.action === "COMPRA" ? "LONG" : "SHORT",
    params.multiplier ?? 2
  );
  return { ...params, target };
}

function buildPalexPlanDaily(candles: Candle[]): TradePlan {
  if (candles.length < 60) {
    return {
      action: "AGUARDAR",
      setup: "PALEX sem dados",
      context: "Dados insuficientes",
      signalQuality: "FRACA",
      entry: null,
      stop: null,
      target: null,
      rr: null,
      explanation: "São necessários pelo menos 60 candles diários para aplicar os filtros PALEX com médias, IFR, Bollinger, rompimentos, gaps e seleção de força.",
      brooksReason: "Leitura PALEX indisponível por insuficiência de dados diários.",
      brooksReference:
        "PALEX — Estratégias Operacionais de Análise Técnica de Ações: setups com MME9, MM21, MM200, Bollinger, IFR, gaps, rompimentos, seleção por tendência e controle de risco.",
      probability: null,
      grade: "Neutro",
    };
  }

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const signal = candles[candles.length - 1];
  const prior = candles[candles.length - 2];
  const beforePrior = candles[candles.length - 3];
  const quality = signalBarQuality(signal);
  const vola = atr(candles, 14);
  const tick = Math.max(0.01, vola * 0.03);

  const ema9 = emaSeries(closes, 9);
  const ema10 = emaSeries(closes, 10);
  const ema21 = emaSeries(closes, 21);
  const ema50 = emaSeries(closes, 50);
  const sma21 = sma(closes, 21) ?? signal.close;
  const sma50 = sma(closes, 50) ?? signal.close;
  const sma200 = sma(closes, 200);
  const rsi14 = rsiSeries(closes, 14);
  const rsi6 = rsiSeries(closes, 6);
  const rsi2 = rsiSeries(closes, 2);
  const lastRsi14 = rsi14[rsi14.length - 1] ?? 50;
  const priorRsi14 = rsi14[rsi14.length - 2] ?? 50;
  const lastRsi6 = rsi6[rsi6.length - 1] ?? 50;
  const priorRsi6 = rsi6[rsi6.length - 2] ?? 50;
  const lastRsi2 = rsi2[rsi2.length - 1] ?? 50;

  const last20 = getLast(candles, 20);
  const last10 = getLast(candles, 10);
  const avgRange20 = average(last20.map(barRange));
  const currentRange = barRange(signal);
  const avgVolume20 = volumeAverage(candles, 20);
  const volumeExpansion = avgVolume20 > 0 && signal.volume > avgVolume20 * 1.2;
  const expansionBar = avgRange20 > 0 && currentRange >= avgRange20 * 1.15;
  const narrowRange = avgRange20 > 0 && currentRange <= avgRange20 * 0.65;
  const bullCloseStrength = currentRange > 0 && signal.close >= signal.low + currentRange * 0.65;
  const bearCloseStrength = currentRange > 0 && signal.close <= signal.low + currentRange * 0.35;

  const high20Prev = highestHigh(candles, 20, 1) ?? prior.high;
  const low20Prev = lowestLow(candles, 20, 1) ?? prior.low;
  const high10Prev = highestHigh(candles, 10, 1) ?? prior.high;
  const low10Prev = lowestLow(candles, 10, 1) ?? prior.low;
  const high5Prev = highestHigh(candles, 5, 1) ?? prior.high;
  const low5Prev = lowestLow(candles, 5, 1) ?? prior.low;

  const ma9Now = ema9[ema9.length - 1];
  const ma9Prev = ema9[ema9.length - 2];
  const ma10Now = ema10[ema10.length - 1];
  const ma21Now = ema21[ema21.length - 1];
  const ma21Prev = ema21[ema21.length - 2];
  const ma50Now = ema50[ema50.length - 1];

  const topBottomTrend = detectTrendState(candles);
  const threeLine = detectThreeLineBarDirection(candles);
  const maDirection = ma21Now > ma21Prev ? "BULL" : ma21Now < ma21Prev ? "BEAR" : "RANGE";
  const priceVsMa21 = signal.close > sma21 ? "BULL" : signal.close < sma21 ? "BEAR" : "RANGE";
  const ma9VsMa21 = ma9Now > ma21Now ? "BULL" : ma9Now < ma21Now ? "BEAR" : "RANGE";
  const bullCriteria = [topBottomTrend, maDirection, priceVsMa21, ma9VsMa21, threeLine].filter((v) => v === "BULL").length;
  const bearCriteria = [topBottomTrend, maDirection, priceVsMa21, ma9VsMa21, threeLine].filter((v) => v === "BEAR").length;
  const palexTrend: TrendState = bullCriteria >= 3 ? "BULL" : bearCriteria >= 3 ? "BEAR" : "RANGE";

  const bbMid = sma(closes, 20) ?? signal.close;
  const bbStd = stdDev(closes.slice(-20));
  const bbUpper = bbMid + 2 * bbStd;
  const bbLower = bbMid - 2 * bbStd;
  const prevBbMid = smaAt(closes, 20, closes.length - 1) ?? prior.close;
  const prevBbStd = stdDev(closes.slice(-21, -1));
  const prevBbUpper = prevBbMid + 2 * prevBbStd;
  const prevBbLower = prevBbMid - 2 * prevBbStd;
  const bbWidth = bbMid !== 0 ? (bbUpper - bbLower) / bbMid : 0;
  const prevBbWidth = prevBbMid !== 0 ? (prevBbUpper - prevBbLower) / prevBbMid : 0;

  const candidates: PalexCandidate[] = [];
  const push = (candidate: PalexCandidate | null) => {
    if (candidate) candidates.push(candidate);
  };

  const bullishEngulfing = isBullBar(signal) && isBearBar(prior) && signal.close > prior.open && signal.open <= prior.close;
  const bearishEngulfing = isBearBar(signal) && isBullBar(prior) && signal.close < prior.open && signal.open >= prior.close;
  const bullishHarami = isBullBar(signal) && isBearBar(prior) && signal.high < prior.high && signal.low > prior.low;
  const bearishHarami = isBearBar(signal) && isBullBar(prior) && signal.high < prior.high && signal.low > prior.low;
  const insideDay = signal.high < prior.high && signal.low > prior.low;

  // 1) Médias móveis: MME9, MM21, Linha da Sombra, cruzamentos, MM200.
  if (palexTrend === "BULL" && signal.low <= ma9Now && signal.close > ma9Now && bullCloseStrength) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Setup MME9 / retorno à média curta",
      score: 72 + (bullCriteria - bearCriteria) * 3,
      entry: signal.high + tick,
      stop: Math.min(signal.low, low5Prev),
      context: "PALEX Bull por tendência e médias",
      explanation: "Compra pelo retorno controlado à MME9 em tendência de alta, com fechamento comprador e retomada acima da máxima do candle de sinal.",
      reference: "PALEX: setups 9.1, 9.2, 9.3 e 9.4 com MME9, congruência, suporte/resistência e realinhamento.",
    }));
  }

  if (palexTrend === "BEAR" && signal.high >= ma9Now && signal.close < ma9Now && bearCloseStrength) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Setup MME9 venda / retorno à média curta",
      score: 72 + (bearCriteria - bullCriteria) * 3,
      entry: signal.low - tick,
      stop: Math.max(signal.high, high5Prev),
      context: "PALEX Bear por tendência e médias",
      explanation: "Venda pelo retorno controlado à MME9 em tendência de baixa, com fechamento vendedor e perda da mínima do candle de sinal.",
      reference: "PALEX: operação vendida em tendência, retorno à média e respeito à direção das médias móveis.",
    }));
  }

  if (palexTrend === "BULL" && signal.low <= sma21 && signal.close > sma21 && (bullishEngulfing || bullishHarami || isBullishReversalCandle(signal))) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Retorno para MM21 com candle de reversão",
      score: 74,
      entry: signal.high + tick,
      stop: Math.min(signal.low, low10Prev),
      context: "Correção saudável até MM21",
      explanation: "O preço corrigiu até a MM21 e deixou candle de reversão/absorção compradora, favorecendo retomada da tendência diária.",
      reference: "PALEX: retorno para MM21, retorno para MM21 + Fura-teto, Harami/Engolfo de alta e Ponto Contínuo.",
    }));
  }

  if (palexTrend === "BEAR" && signal.high >= sma21 && signal.close < sma21 && (bearishEngulfing || bearishHarami || isBearishReversalCandle(signal))) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Retorno para MM21 vendido",
      score: 74,
      entry: signal.low - tick,
      stop: Math.max(signal.high, high10Prev),
      context: "Pullback até MM21 em baixa",
      explanation: "O preço retornou até a MM21 em tendência de baixa e deixou candle vendedor, favorecendo continuação da pressão vendedora.",
      reference: "PALEX: venda no decorrer da tendência de baixa e trades de retorno à média móvel.",
    }));
  }

  if (sma200 && palexTrend === "BULL" && prior.close < sma200 && signal.close > sma200 && bullCloseStrength) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Rompimento da MM200 dias",
      score: 70,
      entry: signal.high + tick,
      stop: Math.min(signal.low, sma21),
      context: "Virada estrutural acima da MM200",
      explanation: "Fechamento acima da MM200 com força sugere melhora estrutural e possível migração para tendência de alta no diário.",
      reference: "PALEX: MM200 dias como filtro de tendência e região técnica relevante.",
    }));
  }

  if (sma200 && palexTrend === "BEAR" && prior.close > sma200 && signal.close < sma200 && bearCloseStrength) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Perda da MM200 dias",
      score: 70,
      entry: signal.low - tick,
      stop: Math.max(signal.high, sma21),
      context: "Deterioração estrutural abaixo da MM200",
      explanation: "Perda da MM200 com fechamento vendedor indica deterioração técnica e favorece venda ou proteção de posição.",
      reference: "PALEX: MM200 dias como filtro estrutural de tendência.",
    }));
  }

  // 2) Bollinger: FFFD, estreitamento, Walking Up/Down, escadaria/tobogã e TSI.
  if (prior.close < prevBbLower && signal.close > bbLower && isBullBar(signal)) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Bollinger FFFD comprador",
      score: 73,
      entry: signal.high + tick,
      stop: signal.low,
      context: "Fechou fora, fechou dentro",
      explanation: "Após fechamento fora da banda inferior, o preço voltou para dentro das Bandas de Bollinger com candle comprador, configurando reversão tática.",
      reference: "PALEX: Fechou Fora — Fechou Dentro, Tática da Sombra Inferior e reversão por exaustão.",
    }));
  }

  if (prior.close > prevBbUpper && signal.close < bbUpper && isBearBar(signal)) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Bollinger FFFD vendedor",
      score: 73,
      entry: signal.low - tick,
      stop: signal.high,
      context: "Fechou fora, fechou dentro",
      explanation: "Após fechamento fora da banda superior, o preço voltou para dentro das Bandas de Bollinger com candle vendedor, configurando reversão tática.",
      reference: "PALEX: Fechou Fora — Fechou Dentro em Bandas de Bollinger.",
    }));
  }

  if (bbWidth < prevBbWidth * 0.85 && expansionBar && signal.close > bbUpper && volumeExpansion) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Estreitamento de Bollinger com rompimento",
      score: 76,
      entry: signal.high + tick,
      stop: Math.min(signal.low, bbMid),
      context: "Volatilidade comprimida e expansão compradora",
      explanation: "As bandas estreitaram e o candle rompeu para cima com expansão de range e volume, sugerindo início de movimento direcional.",
      reference: "PALEX: Estreitamento das Bandas, Walking Up the Bands e rompimentos consistentes.",
    }));
  }

  if (bbWidth < prevBbWidth * 0.85 && expansionBar && signal.close < bbLower && volumeExpansion) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Estreitamento de Bollinger com perda",
      score: 76,
      entry: signal.low - tick,
      stop: Math.max(signal.high, bbMid),
      context: "Volatilidade comprimida e expansão vendedora",
      explanation: "As bandas estreitaram e o candle rompeu para baixo com expansão de range e volume, sugerindo início de movimento direcional vendedor.",
      reference: "PALEX: Estreitamento das Bandas, Barras em Tobogã e rompimentos consistentes.",
    }));
  }

  // 3) IFR: IFR14 reversão, pivôs no IFR, virada do IFR, IFR2, filtro MME50 e divergências.
  if (lastRsi14 < 35 && lastRsi14 > priorRsi14 && isBullishReversalCandle(signal)) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — IFR14 + candle de reversão",
      score: 71,
      entry: signal.high + tick,
      stop: signal.low,
      context: "Sobrevenda com reação compradora",
      explanation: "IFR14 em região deprimida virou para cima junto com candle diário de reversão, sugerindo repique técnico ou fim de correção.",
      reference: "PALEX: IFR14 + candle de reversão, Pivot no IFR e Virada do IFR.",
    }));
  }

  if (lastRsi14 > 65 && lastRsi14 < priorRsi14 && isBearishReversalCandle(signal)) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — IFR14 + candle de reversão vendedor",
      score: 71,
      entry: signal.low - tick,
      stop: signal.high,
      context: "Sobrecompra com reação vendedora",
      explanation: "IFR14 em região elevada virou para baixo junto com candle diário vendedor, sugerindo realização ou reversão tática.",
      reference: "PALEX: IFR14 + candle de reversão, Pivot no IFR e Virada do IFR.",
    }));
  }

  if (lastRsi2 < 10 && signal.close > ma50Now && isBullBar(signal)) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — IFR2 sobrevendido com filtro MME50",
      score: 69,
      entry: signal.high + tick,
      stop: Math.min(signal.low, low5Prev),
      context: "Pullback curto em tendência positiva",
      explanation: "IFR2 extremamente sobrevendido acima da MME50 indica correção curta em ativo tecnicamente positivo, com gatilho na superação da máxima.",
      reference: "PALEX: IFR2 sobrevendido, IFR2 + MME50, média móvel do IFR2 e divergência do IFR2.",
    }));
  }

  if (lastRsi2 > 90 && signal.close < ma50Now && isBearBar(signal)) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — IFR2 sobrecomprado com filtro MME50",
      score: 69,
      entry: signal.low - tick,
      stop: Math.max(signal.high, high5Prev),
      context: "Repique curto em tendência negativa",
      explanation: "IFR2 extremamente sobrecomprado abaixo da MME50 indica repique dentro de estrutura negativa, com gatilho na perda da mínima.",
      reference: "PALEX: IFR2 com filtro de tendência pela MME50.",
    }));
  }

  if (signal.low < low20Prev && lastRsi6 > priorRsi6 && signal.close > prior.close) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Divergência positiva no IFR6",
      score: 72,
      entry: signal.high + tick,
      stop: signal.low,
      context: "Divergência positiva em fundo",
      explanation: "O preço renovou mínima, mas o IFR curto reagiu, indicando perda de força vendedora e possível reversão diária.",
      reference: "PALEX: divergências no IFR6 e IFR2.",
    }));
  }

  if (signal.high > high20Prev && lastRsi6 < priorRsi6 && signal.close < prior.close) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Divergência negativa no IFR6",
      score: 72,
      entry: signal.low - tick,
      stop: signal.high,
      context: "Divergência negativa em topo",
      explanation: "O preço renovou máxima, mas o IFR curto perdeu força, sugerindo exaustão compradora e risco de realização.",
      reference: "PALEX: divergências no IFR6 e IFR2.",
    }));
  }

  // 4) Price action clássico do livro: rompimentos, falso rompimento, triângulo/congestão, topo histórico, Inside Day, Shark, Turtle Soup, 1-2-3, retração de 50%.
  if (signal.close > high20Prev && bullCloseStrength && (volumeExpansion || expansionBar)) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Rompimento consistente de topo/congestão",
      score: 78,
      entry: signal.high + tick,
      stop: Math.min(signal.low, low10Prev),
      context: "Breakout diário validado",
      explanation: "Rompimento de máxima relevante com fechamento forte, range expandido e/ou volume acima da média, atendendo critérios de consistência operacional.",
      reference: "PALEX: trades de rompimento, rompimento de congestões, rompimento de topos/fundos anteriores e rompimento de topo histórico.",
    }));
  }

  if (signal.close < low20Prev && bearCloseStrength && (volumeExpansion || expansionBar)) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Perda consistente de fundo/congestão",
      score: 78,
      entry: signal.low - tick,
      stop: Math.max(signal.high, high10Prev),
      context: "Breakdown diário validado",
      explanation: "Perda de mínima relevante com fechamento fraco, range expandido e/ou volume acima da média, favorecendo continuidade vendedora.",
      reference: "PALEX: trades de rompimento, perda de fundos anteriores e venda no decorrer da tendência de baixa.",
    }));
  }

  if (signal.low < low20Prev && signal.close > low20Prev && bullCloseStrength) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Rompimento falso / Turtle Soup comprador",
      score: 75,
      entry: signal.high + tick,
      stop: signal.low,
      context: "Armadilha vendedora",
      explanation: "O ativo perdeu mínima relevante, mas voltou para dentro da faixa e fechou forte, sugerindo falha vendedora e stop de vendidos.",
      reference: "PALEX: operação de rompimento falso, Turtle Soup, The Bear Trap e Realização Frustrada.",
    }));
  }

  if (signal.high > high20Prev && signal.close < high20Prev && bearCloseStrength) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Rompimento falso / Turtle Soup vendedor",
      score: 75,
      entry: signal.low - tick,
      stop: signal.high,
      context: "Armadilha compradora",
      explanation: "O ativo rompeu máxima relevante, mas voltou para dentro da faixa e fechou fraco, sugerindo falha compradora e realização.",
      reference: "PALEX: operação de rompimento falso, Turtle Soup, The Bull Trap e Realização Frustrada.",
    }));
  }

  if (insideDay && palexTrend === "BULL") {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Inside Day comprador",
      score: 66,
      entry: signal.high + tick,
      stop: signal.low,
      context: "Contração dentro de tendência de alta",
      explanation: "Inside Day representa compressão de volatilidade; em tendência de alta, o gatilho fica acima da máxima do candle interno.",
      reference: "PALEX: Inside Day, Narrow Range Day e setups de rompimento após contração.",
      multiplier: 1.8,
    }));
  }

  if (insideDay && palexTrend === "BEAR") {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Inside Day vendedor",
      score: 66,
      entry: signal.low - tick,
      stop: signal.high,
      context: "Contração dentro de tendência de baixa",
      explanation: "Inside Day representa compressão de volatilidade; em tendência de baixa, o gatilho fica abaixo da mínima do candle interno.",
      reference: "PALEX: Inside Day, Narrow Range Day e setups de rompimento após contração.",
      multiplier: 1.8,
    }));
  }

  if (narrowRange && signal.high >= high5Prev * 0.995 && palexTrend === "BULL") {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Narrow Range / 1-2-3-4 comprador",
      score: 65,
      entry: signal.high + tick,
      stop: signal.low,
      context: "Compressão antes de expansão",
      explanation: "Range estreito próximo de máxima em contexto positivo; gatilho operacional acima da máxima para capturar expansão.",
      reference: "PALEX: Narrow Range Day, Setup 1-2-3-4 e Setup 1-2-3.",
      multiplier: 1.8,
    }));
  }

  if (narrowRange && signal.low <= low5Prev * 1.005 && palexTrend === "BEAR") {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Narrow Range / 1-2-3-4 vendedor",
      score: 65,
      entry: signal.low - tick,
      stop: signal.high,
      context: "Compressão antes de expansão vendedora",
      explanation: "Range estreito próximo de mínima em contexto negativo; gatilho operacional abaixo da mínima para capturar expansão.",
      reference: "PALEX: Narrow Range Day, Setup 1-2-3-4 e Setup 1-2-3.",
      multiplier: 1.8,
    }));
  }

  // 5) Gaps e táticas de guerrilha adaptadas ao diário.
  if (isGapUp(signal, prior) && signal.close > signal.open && bullCloseStrength) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Bullish Gap Surprise / Gap-n-Snap",
      score: 70,
      entry: signal.high + tick,
      stop: Math.min(signal.low, prior.high),
      context: "Gap de força comprador",
      explanation: "Gap de alta sustentado por fechamento comprador indica surpresa positiva e pressão compradora persistente.",
      reference: "PALEX: Gap-n-Snap Play, Bullish Gap Surprise e Bullish 20/20 Play.",
    }));
  }

  if (isGapDown(signal, prior) && signal.close < signal.open && bearCloseStrength) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Bearish Gap Surprise / Gap-n-Crap",
      score: 70,
      entry: signal.low - tick,
      stop: Math.max(signal.high, prior.low),
      context: "Gap de força vendedor",
      explanation: "Gap de baixa sustentado por fechamento vendedor indica surpresa negativa e pressão vendedora persistente.",
      reference: "PALEX: Gap-n-Crap Play, Bearish Gap Surprise e Bearish 20/20 Play.",
    }));
  }

  if (isGapDown(signal, prior) && signal.close > prior.close && bullCloseStrength) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Gap de baixa frustrado / Key Buy",
      score: 73,
      entry: signal.high + tick,
      stop: signal.low,
      context: "Reversão forte após gap de baixa",
      explanation: "O mercado abriu em gap de baixa, rejeitou a pressão vendedora e fechou forte, caracterizando reversão de fluxo.",
      reference: "PALEX: Key Buy, Gap-n-Snap, Realização Frustrada e Bull Trap/Bear Trap.",
    }));
  }

  if (isGapUp(signal, prior) && signal.close < prior.close && bearCloseStrength) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Gap de alta frustrado",
      score: 73,
      entry: signal.low - tick,
      stop: signal.high,
      context: "Reversão forte após gap de alta",
      explanation: "O mercado abriu em gap de alta, rejeitou a pressão compradora e fechou fraco, caracterizando armadilha compradora.",
      reference: "PALEX: Gap-n-Crap, Bull Trap e Realização Frustrada.",
    }));
  }

  // 6) Padrões de candle de força e sombras.
  if (expansionBar && isBullBar(signal) && bullCloseStrength && signal.close > ma21Now) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Barra Elefante / Power Breakout comprador",
      score: 74 + (volumeExpansion ? 4 : 0),
      entry: signal.high + tick,
      stop: Math.min(signal.low, ma21Now),
      context: "Candle comprador de amplo range",
      explanation: "Barra diária ampla com fechamento no terço superior acima das médias indica domínio comprador e possível continuidade.",
      reference: "PALEX: Barra Elefante, Power Breakout, Breakout e Power Move.",
    }));
  }

  if (expansionBar && isBearBar(signal) && bearCloseStrength && signal.close < ma21Now) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Barra Elefante / Power Breakout vendedor",
      score: 74 + (volumeExpansion ? 4 : 0),
      entry: signal.low - tick,
      stop: Math.max(signal.high, ma21Now),
      context: "Candle vendedor de amplo range",
      explanation: "Barra diária ampla com fechamento no terço inferior abaixo das médias indica domínio vendedor e possível continuidade.",
      reference: "PALEX: Barra Elefante, Power Breakout, Breakout e Power Move.",
    }));
  }

  if (lowerShadow(signal) > barBody(signal) * 1.5 && signal.close > ma10Now && bullCloseStrength) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Tática da Sombra Inferior",
      score: 68,
      entry: signal.high + tick,
      stop: signal.low,
      context: "Rejeição de preços baixos",
      explanation: "Sombra inferior relevante mostra rejeição da mínima diária e retomada acima da média curta, favorecendo compra tática.",
      reference: "PALEX: Tática da Sombra Inferior e Linha da Sombra MME10.",
      multiplier: 1.8,
    }));
  }

  if (upperShadow(signal) > barBody(signal) * 1.5 && signal.close < ma10Now && bearCloseStrength) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Tática da Sombra Superior",
      score: 68,
      entry: signal.low - tick,
      stop: signal.high,
      context: "Rejeição de preços altos",
      explanation: "Sombra superior relevante mostra rejeição da máxima diária e perda da média curta, favorecendo venda tática.",
      reference: "PALEX: adaptação vendida da lógica de sombra e operações contra excesso.",
      multiplier: 1.8,
    }));
  }

  // 7) Retração aproximada de 50%, Shark/Peg Leg como leitura de correção profunda e retomada.
  const high60 = Math.max(...highs.slice(-60));
  const low60 = Math.min(...lows.slice(-60));
  const mid60 = low60 + (high60 - low60) * 0.5;
  const nearHalfRetrace = Math.abs(signal.close - mid60) / Math.max(signal.close, 1) < 0.025;

  if (nearHalfRetrace && palexTrend === "BULL" && isBullishReversalCandle(signal)) {
    push(buildCandidate({
      action: "COMPRA",
      setup: "PALEX — Retração de 50% com reversão",
      score: 67,
      entry: signal.high + tick,
      stop: signal.low,
      context: "Correção profunda com reação",
      explanation: "O preço reagiu próximo da retração de 50% do movimento recente, com candle de reversão comprador.",
      reference: "PALEX: Retração de 50%, Padrão Shark, Peg Leg e trades de correção.",
      multiplier: 1.8,
    }));
  }

  if (nearHalfRetrace && palexTrend === "BEAR" && isBearishReversalCandle(signal)) {
    push(buildCandidate({
      action: "VENDA",
      setup: "PALEX — Retração de 50% vendida",
      score: 67,
      entry: signal.low - tick,
      stop: signal.high,
      context: "Repique corretivo com rejeição",
      explanation: "O preço rejeitou a região de 50% do movimento recente em contexto de baixa, favorecendo retomada vendedora.",
      reference: "PALEX: Retração de 50%, Padrão Shark, Peg Leg e trades de correção.",
      multiplier: 1.8,
    }));
  }

  const best = candidates.sort((a, b) => b.score - a.score)[0];

  if (!best) {
    const context =
      palexTrend === "BULL"
        ? `PALEX Bull: ${bullCriteria}/5 critérios de tendência positivos`
        : palexTrend === "BEAR"
        ? `PALEX Bear: ${bearCriteria}/5 critérios de tendência negativos`
        : `PALEX Range: sem 3 critérios convergentes`;

    return {
      action: "AGUARDAR",
      setup: "PALEX — Aguardar confirmação",
      context,
      signalQuality: quality,
      entry: null,
      stop: null,
      target: null,
      rr: null,
      explanation:
        "Nenhum setup PALEX diário alcançou confluência profissional suficiente. Aguardar gatilho claro: rompimento consistente, falha em região relevante, retorno qualificado às médias, sinal de Bollinger/IFR ou gap confirmado.",
      brooksReason:
        "Leitura PALEX independente da leitura Al Brooks, aplicada somente ao gráfico diário.",
      brooksReference:
        "PALEX — filtros combinados: cinco critérios de tendência, MME9/MM21/MM200, Bandas de Bollinger, IFR, gaps, rompimentos, falso rompimento, padrões de candle, seleção de força e controle de risco.",
      probability: 45,
      grade: "Neutro",
    };
  }

  const rr = Math.abs(best.target - best.entry) / Math.abs(best.entry - best.stop);
  let probability = Math.round(best.score);
  if (quality === "FORTE") probability += 4;
  if (volumeExpansion) probability += 3;
  if (rr >= 2) probability += 3;
  if (best.action === "COMPRA" && palexTrend === "BULL") probability += 3;
  if (best.action === "VENDA" && palexTrend === "BEAR") probability += 3;
  if (palexTrend === "RANGE" && !best.setup.includes("Falha") && !best.setup.includes("Turtle")) probability -= 4;
  probability = Math.min(88, Math.max(35, probability));

  return {
    action: best.action,
    setup: best.setup,
    context: best.context,
    signalQuality: quality,
    entry: best.entry,
    stop: best.stop,
    target: best.target,
    rr,
    explanation: best.explanation,
    brooksReason:
      "Leitura PALEX independente da leitura Al Brooks, aplicada exclusivamente ao gráfico diário e consolidada pelo setup de maior confluência.",
    brooksReference: best.reference,
    probability,
    grade: probabilityToGrade(probability),
  };
}

function calculateAlignment(daily: TradePlan, palexDaily: TradePlan) {
  if (!daily || !palexDaily) return false;
  if (daily.action === "AGUARDAR" || palexDaily.action === "AGUARDAR") return false;
  return daily.action === palexDaily.action;
}

function transformYahooData(data: any): Candle[] {
  const result = data?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp;

  if (!result || !quote || !timestamps) return [];

  const candles: Candle[] = [];

  for (let i = 0; i < timestamps.length; i++) {
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

async function fetchCandles(symbol: string, interval: string, range: string) {
  const res = await fetch(
    `/api/history?symbol=${encodeURIComponent(symbol)}&interval=${interval}&range=${range}`,
    { cache: "no-store" }
  );

  const data = await res.json();

  if (data?.error) {
    console.error("Erro ao buscar candles:", data);
    return [];
  }

  return transformYahooData(data);
}

function aggregateTo4H(candles60m: Candle[]) {
  const valid = candles60m.filter(
    (c) =>
      c.open != null &&
      c.high != null &&
      c.low != null &&
      c.close != null &&
      !Number.isNaN(c.open) &&
      !Number.isNaN(c.high) &&
      !Number.isNaN(c.low) &&
      !Number.isNaN(c.close)
  );

  const out: Candle[] = [];

  for (let i = 0; i < valid.length; i += 4) {
    const chunk = valid.slice(i, i + 4);
    if (chunk.length < 2) continue;

    out.push({
      open: chunk[0].open,
      high: Math.max(...chunk.map((c) => c.high)),
      low: Math.min(...chunk.map((c) => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + (c.volume || 0), 0),
    });
  }

  return out;
}

function getCombinedScore(weekly: TradePlan, daily: TradePlan, h4: TradePlan) {
  const wp = weekly.probability ?? 0;
  const dp = daily.probability ?? 0;
  const hp = h4.probability ?? 0;

  let bonus = 0;

  const allBuy =
    weekly.action === "COMPRA" &&
    daily.action === "COMPRA" &&
    h4.action === "COMPRA";

  const allSell =
    weekly.action === "VENDA" &&
    daily.action === "VENDA" &&
    h4.action === "VENDA";

  if (allBuy || allSell) bonus += 12;
  else {
    const nonNeutral = [weekly.action, daily.action, h4.action].filter(
      (a) => a !== "AGUARDAR"
    );

    if (nonNeutral.length >= 2 && new Set(nonNeutral).size === 1) bonus += 6;
  }

  if (weekly.grade === "A+" || daily.grade === "A+" || h4.grade === "A+") bonus += 4;

  return wp + dp + hp + bonus;
}

function TradingViewChart({
  symbol,
  title,
}: {
  symbol: string;
  title: string;
}) {
  const tvSymbol = symbol.replace(".SA", "");

  const src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_main_${tvSymbol}&symbol=BMFBOVESPA:${tvSymbol}&interval=W&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=F1F3F6&studies=[]&theme=dark&style=1&timezone=America%2FSao_Paulo&withdateranges=1&hideideas=1`;

  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #2a2a2a",
        borderRadius: 16,
        padding: 16,
        marginBottom: 18,
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>

      <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 0 }}>
        Você pode alterar manualmente o timeframe dentro do próprio gráfico.
      </p>

      <iframe
        title={title}
        src={src}
        style={{
          width: "100%",
          height: 520,
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
  reasonLabel = "Justificativa",
  referenceLabel = "Base Teórica",
}: {
  title: string;
  plan: TradePlan | null;
  reasonLabel?: string;
  referenceLabel?: string;
}) {
  return (
    <div
      style={{
        background: "#171717",
        color: "#fff",
        padding: 18,
        borderRadius: 16,
        border: "1px solid #2a2a2a",
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: 20 }}>{title}</h2>

      {!plan ? (
        <p>Carregando...</p>
      ) : (
        <>
          <div
            style={{
              display: "inline-block",
              padding: "6px 12px",
              borderRadius: 999,
              background: getGradeColor(plan.grade),
              color: "#fff",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            {plan.grade} • {plan.probability != null ? `${plan.probability}%` : "--"}
          </div>

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
          <p>
            <strong>{reasonLabel}:</strong> {plan.brooksReason}
          </p>
          <p>
            <strong>{referenceLabel}:</strong> {plan.brooksReference}
          </p>
        </>
      )}
    </div>
  );
}

function ConfluenceBox({
  weeklyPlan,
  dailyPlan,
  h4Plan,
}: {
  weeklyPlan: TradePlan | null;
  dailyPlan: TradePlan | null;
  h4Plan: TradePlan | null;
}) {
  if (!weeklyPlan || !dailyPlan || !h4Plan) return null;

  const actions = [weeklyPlan.action, dailyPlan.action, h4Plan.action];
  const allBuy = actions.every((a) => a === "COMPRA");
  const allSell = actions.every((a) => a === "VENDA");

  const message =
    allBuy || allSell
      ? `Confluência máxima: semanal, diário e 4h estão alinhados em ${weeklyPlan.action}.`
      : "Sem alinhamento total entre os 3 timeframes. A operação exige mais seletividade.";

  const strong = allBuy || allSell;

  return (
    <div
      style={{
        background: strong ? "#052e16" : "#3f2a04",
        color: "#fff",
        padding: 18,
        borderRadius: 16,
        border: strong ? "1px solid #166534" : "1px solid #a16207",
        marginBottom: 20,
      }}
    >
      <h2 style={{ marginTop: 0 }}>Confluência Multi-Timeframe</h2>

      <p>
        <strong>Semanal:</strong> {weeklyPlan.action} • {weeklyPlan.grade} •{" "}
        {weeklyPlan.probability != null ? `${weeklyPlan.probability}%` : "--"}
      </p>

      <p>
        <strong>Diário:</strong> {dailyPlan.action} • {dailyPlan.grade} •{" "}
        {dailyPlan.probability != null ? `${dailyPlan.probability}%` : "--"}
      </p>

      <p>
        <strong>4h:</strong> {h4Plan.action} • {h4Plan.grade} •{" "}
        {h4Plan.probability != null ? `${h4Plan.probability}%` : "--"}
      </p>

      <p style={{ marginBottom: 0 }}>
        <strong>Leitura combinada:</strong> {message}
      </p>
    </div>
  );
}

function PalexConfluenceBox({
  dailyPlan,
  palexDailyPlan,
}: {
  dailyPlan: TradePlan | null;
  palexDailyPlan: TradePlan | null;
}) {
  if (!dailyPlan || !palexDailyPlan) return null;

  const aligned = calculateAlignment(dailyPlan, palexDailyPlan);

  return (
    <div
      style={{
        background: aligned ? "#052e16" : "#111827",
        color: "#fff",
        padding: 18,
        borderRadius: 16,
        border: aligned ? "1px solid #22c55e" : "1px solid #374151",
        marginBottom: 20,
      }}
    >
      <h2 style={{ marginTop: 0 }}>Confluência Diário x PALEX</h2>

      <p>
        <strong>Al Brooks Diário:</strong> {dailyPlan.action} • {dailyPlan.grade} •{" "}
        {dailyPlan.probability != null ? `${dailyPlan.probability}%` : "--"}
      </p>

      <p>
        <strong>PALEX Diário:</strong> {palexDailyPlan.action} • {palexDailyPlan.grade} •{" "}
        {palexDailyPlan.probability != null ? `${palexDailyPlan.probability}%` : "--"}
      </p>

      <p style={{ marginBottom: 0 }}>
        <strong>Leitura:</strong>{" "}
        {aligned
          ? "Há alinhamento entre a leitura diária Al Brooks e a leitura PALEX. O ativo recebe bônus no ranking."
          : "As leituras diária Al Brooks e PALEX não estão totalmente alinhadas. A operação exige mais confirmação."}
      </p>
    </div>
  );
}

export default function Page() {
  const [selectedSector, setSelectedSector] = useState("Todos");
  const [scanner, setScanner] = useState<ScannerItem[]>([]);
  const [loadingScanner, setLoadingScanner] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScannerItem | null>(null);

  const sectors = useMemo(
    () => ["Todos", ...Array.from(new Set(STOCK_CATALOG.map((s) => s.sector)))],
    []
  );

  async function runScanner() {
    setLoadingScanner(true);

    const catalog =
      selectedSector === "Todos"
        ? STOCK_CATALOG
        : STOCK_CATALOG.filter((item) => item.sector === selectedSector);

    const results = await Promise.all(
      catalog.map(async (item) => {
        const symbol = normalizeSymbol(item.ticker);

        const [weeklyCandles, dailyCandles, hourlyCandles] = await Promise.all([
          fetchCandles(symbol, "1wk", "2y"),
          fetchCandles(symbol, "1d", "1y"),
          fetchCandles(symbol, "60m", "3mo"),
        ]);

        const h4Candles = aggregateTo4H(hourlyCandles);

        const weekly = buildTradePlan(weeklyCandles, "WEEKLY");
        const daily = buildTradePlan(dailyCandles, "DAILY");
        const h4 = buildTradePlan(h4Candles, "H4");
        const palexDaily = buildPalexPlanDaily(dailyCandles);

        const aligned = calculateAlignment(daily, palexDaily);
        const score = getCombinedScore(weekly, daily, h4);

        return {
          ticker: item.ticker,
          name: item.name,
          sector: item.sector,
          weekly,
          daily,
          h4,
          palexDaily,
          score: aligned ? score + 25 : score,
        } as ScannerItem;
      })
    );

    const sorted = results.sort((a, b) => b.score - a.score);

    setScanner(sorted);

    if (sorted.length > 0 && !selectedItem) setSelectedItem(sorted[0]);

    if (sorted.length > 0 && selectedItem) {
      const found = sorted.find((s) => s.ticker === selectedItem.ticker);
      setSelectedItem(found || sorted[0]);
    }

    setLoadingScanner(false);
  }

  useEffect(() => {
    runScanner();
  }, [selectedSector]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b0b",
        color: "#fff",
        padding: 20,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>
        <h1 style={{ marginTop: 0 }}>Brooks Brazil — Scanner Weekly + Daily + 4H + PALEX</h1>

        <p style={{ color: "#bbb" }}>
          Ranking com confluência de 3 timeframes Al Brooks, probabilidade, nota, entrada,
          stop, alvo e uma leitura PALEX exclusiva para o gráfico diário.
        </p>

        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid #333",
              background: "#151515",
              color: "#fff",
              minWidth: 260,
            }}
          >
            {sectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>

          <button
            onClick={runScanner}
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
            Atualizar Scanner
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "390px 1fr",
            gap: 18,
            alignItems: "start",
          }}
        >
          <div
            style={{
              background: "#111",
              border: "1px solid #2a2a2a",
              borderRadius: 16,
              padding: 16,
              maxHeight: "88vh",
              overflowY: "auto",
              position: "sticky",
              top: 12,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Ranking</h2>

            {loadingScanner && <p>Atualizando scanner...</p>}

            {!loadingScanner &&
              scanner.map((item, index) => {
                const palexAligned = calculateAlignment(item.daily, item.palexDaily);

                return (
                  <button
                    key={item.ticker}
                    onClick={() => setSelectedItem(item)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background:
                        selectedItem?.ticker === item.ticker ? "#1f2937" : "#171717",
                      color: "#fff",
                      border: palexAligned ? "1px solid #22c55e" : "1px solid #2a2a2a",
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 10,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          #{index + 1} • {item.ticker}
                        </div>

                        <div style={{ fontSize: 13, color: "#bbb" }}>{item.name}</div>

                        <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                          {item.sector}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: getGradeColor(item.weekly.grade),
                            fontWeight: 700,
                            marginBottom: 4,
                          }}
                        >
                          W {item.weekly.grade}
                        </div>

                        <div
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: getGradeColor(item.daily.grade),
                            fontWeight: 700,
                            marginBottom: 4,
                          }}
                        >
                          D {item.daily.grade}
                        </div>

                        <div
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: getGradeColor(item.h4.grade),
                            fontWeight: 700,
                            marginBottom: 4,
                          }}
                        >
                          4H {item.h4.grade}
                        </div>

                        <div
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: getGradeColor(item.palexDaily.grade),
                            fontWeight: 700,
                          }}
                        >
                          P {item.palexDaily.grade}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, fontSize: 13 }}>
                      <strong>Score:</strong> {item.score.toFixed(0)}
                    </div>

                    <div style={{ marginTop: 6, fontSize: 12, color: "#bbb" }}>
                      W: {item.weekly.action} • D: {item.daily.action} • 4H:{" "}
                      {item.h4.action} • PALEX: {item.palexDaily.action}
                    </div>

                    {palexAligned && (
                      <div style={{ marginTop: 6, fontSize: 12, color: "#86efac" }}>
                        Diário Brooks alinhado com PALEX
                      </div>
                    )}
                  </button>
                );
              })}
          </div>

          <div>
            {selectedItem ? (
              <>
                <TradingViewChart
                  symbol={normalizeSymbol(selectedItem.ticker)}
                  title={`Gráfico principal — ${selectedItem.ticker}`}
                />

                <ConfluenceBox
                  weeklyPlan={selectedItem.weekly}
                  dailyPlan={selectedItem.daily}
                  h4Plan={selectedItem.h4}
                />

                <PalexConfluenceBox
                  dailyPlan={selectedItem.daily}
                  palexDailyPlan={selectedItem.palexDaily}
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 14,
                    alignItems: "start",
                  }}
                >
                  <AnalysisCard
                    title={`Semanal — ${selectedItem.ticker}`}
                    plan={selectedItem.weekly}
                    reasonLabel="Justificativa Brooks"
                    referenceLabel="Base Teórica Brooks"
                  />

                  <AnalysisCard
                    title={`Diário — ${selectedItem.ticker}`}
                    plan={selectedItem.daily}
                    reasonLabel="Justificativa Brooks"
                    referenceLabel="Base Teórica Brooks"
                  />

                  <AnalysisCard
                    title={`4H — ${selectedItem.ticker}`}
                    plan={selectedItem.h4}
                    reasonLabel="Justificativa Brooks"
                    referenceLabel="Base Teórica Brooks"
                  />

                  <AnalysisCard
                    title={`Sugestão PALEX — ${selectedItem.ticker}`}
                    plan={selectedItem.palexDaily}
                    reasonLabel="Justificativa PALEX"
                    referenceLabel="Base Teórica PALEX"
                  />
                </div>
              </>
            ) : (
              <p>Selecione um ativo no ranking.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}