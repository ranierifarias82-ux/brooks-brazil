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
      explanation:
        "Não há candles diários suficientes para aplicar a leitura PALEX com Quality Engine. Use pelo menos 60 candles; com 200 candles a leitura da MM200 fica mais robusta.",
      brooksReason: "Leitura PALEX indisponível por insuficiência de dados.",
      brooksReference:
        "PALEX — fundamentos de análise técnica: tendência, suporte/resistência, volume, OBV, médias, IFR, Bollinger, ADX/DI, Fibonacci, estopes e plano de trade.",
      probability: null,
      grade: "Neutro",
    };
  }

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume || 0);
  const avg = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const smaLocal = (period: number) =>
    candles.length >= period ? avg(closes.slice(-period)) : null;

  const emaFromValues = (values: number[], period: number) => {
    if (values.length < period) return null;
    const k = 2 / (period + 1);
    let v = avg(values.slice(0, period));
    for (let i = period; i < values.length; i++) v = values[i] * k + v * (1 - k);
    return v;
  };

  const rsiLocal = (period: number) => {
    if (candles.length < period + 1) return null;
    const slice = closes.slice(-(period + 1));
    let gains = 0;
    let losses = 0;

    for (let i = 1; i < slice.length; i++) {
      const ch = slice[i] - slice[i - 1];
      if (ch >= 0) gains += ch;
      else losses += Math.abs(ch);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  };

  const slope = (values: number[]) => {
    if (values.length < 2) return 0;
    const n = values.length;
    const ax = (n + 1) / 2;
    const ay = avg(values);
    let num = 0;
    let den = 0;

    for (let i = 0; i < n; i++) {
      const x = i + 1;
      num += (x - ax) * (values[i] - ay);
      den += (x - ax) ** 2;
    }

    return den === 0 ? 0 : num / den;
  };

  const obvLocal = () => {
    const values = [0];

    for (let i = 1; i < candles.length; i++) {
      const last = values[values.length - 1];
      if (candles[i].close > candles[i - 1].close) values.push(last + candles[i].volume);
      else if (candles[i].close < candles[i - 1].close) values.push(last - candles[i].volume);
      else values.push(last);
    }

    return values;
  };

  const bbLocal = () => {
    const period = 20;
    if (closes.length < period) return null;

    const recent = closes.slice(-period);
    const middle = avg(recent);
    const dev = Math.sqrt(avg(recent.map((v) => (v - middle) ** 2)));

    return {
      upper: middle + 2 * dev,
      middle,
      lower: middle - 2 * dev,
      bandwidth: middle > 0 ? ((4 * dev) / middle) * 100 : 0,
    };
  };

  const adxLocal = () => {
    const period = 14;

    if (candles.length < period + 2) {
      return {
        adx: null as number | null,
        plusDI: null as number | null,
        minusDI: null as number | null,
      };
    }

    const tr: number[] = [];
    const plus: number[] = [];
    const minus: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const p = candles[i - 1];
      const up = c.high - p.high;
      const down = p.low - c.low;

      plus.push(up > down && up > 0 ? up : 0);
      minus.push(down > up && down > 0 ? down : 0);
      tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    }

    const trSum = tr.slice(-period).reduce((a, b) => a + b, 0);
    if (trSum <= 0) return { adx: null, plusDI: null, minusDI: null };

    const plusDI = (plus.slice(-period).reduce((a, b) => a + b, 0) / trSum) * 100;
    const minusDI = (minus.slice(-period).reduce((a, b) => a + b, 0) / trSum) * 100;
    const adx = (Math.abs(plusDI - minusDI) / Math.max(plusDI + minusDI, 1)) * 100;

    return { adx, plusDI, minusDI };
  };

  const near = (price: number, level: number, tol = 2) =>
    price > 0 && level > 0 ? Math.abs(price - level) / price <= tol / 100 : false;

  const trend = detectTrendState(candles);
  const signal = candles[candles.length - 1];
  const prior = candles[candles.length - 2];
  const quality = signalBarQuality(signal);
  const vola = atr(candles, 14);
  const tick = Math.max(0.01, vola * 0.03);

  const last10 = getLast(candles, 10);
  const last20 = getLast(candles, 20);
  const last60 = getLast(candles, 60);

  const recentHigh10 = Math.max(...last10.map((c) => c.high));
  const recentLow10 = Math.min(...last10.map((c) => c.low));
  const recentHigh20 = Math.max(...last20.map((c) => c.high));
  const recentLow20 = Math.min(...last20.map((c) => c.low));
  const support60 = Math.min(...last60.map((c) => c.low));
  const resistance60 = Math.max(...last60.map((c) => c.high));
  const avgRange20 = avg(last20.map(barRange));
  const avgVolume20 = avg(volumes.slice(-20));
  const currentRange = barRange(signal);

  const expansionBar = avgRange20 > 0 && currentRange >= avgRange20 * 1.15;
  const bullCloseStrength = currentRange > 0 && signal.close >= signal.low + currentRange * 0.65;
  const bearCloseStrength = currentRange > 0 && signal.close <= signal.low + currentRange * 0.35;
  const volumeExpansion = avgVolume20 > 0 && signal.volume >= avgVolume20 * 1.2;
  const volumeDryUp = avgVolume20 > 0 && signal.volume <= avgVolume20 * 0.75;

  const mm21 = smaLocal(21);
  const mm50 = emaFromValues(closes, 50);
  const mm200 = smaLocal(200);
  const ema9 = emaFromValues(closes, 9);
  const ema9Prev = emaFromValues(closes.slice(0, -1), 9);
  const rsi14 = rsiLocal(14);
  const rsi2 = rsiLocal(2);
  const bb = bbLocal();
  const dm = adxLocal();
  const obvSlope = slope(obvLocal().slice(-10));
  const priceSlope = slope(closes.slice(-10));

  const priceAboveMM21 = mm21 != null && signal.close > mm21;
  const priceBelowMM21 = mm21 != null && signal.close < mm21;
  const priceAboveMM50 = mm50 != null && signal.close > mm50;
  const priceBelowMM50 = mm50 != null && signal.close < mm50;
  const priceAboveMM200 = mm200 != null && signal.close > mm200;
  const priceBelowMM200 = mm200 != null && signal.close < mm200;
  const ema9Up = ema9 != null && ema9Prev != null && ema9 > ema9Prev;
  const ema9Down = ema9 != null && ema9Prev != null && ema9 < ema9Prev;

  const nearSupport = near(signal.close, support60, 3);
  const nearResistance = near(signal.close, resistance60, 3);

  const upperShadow = signal.high - Math.max(signal.open, signal.close);
  const lowerShadow = Math.min(signal.open, signal.close) - signal.low;
  const rejectionBuy = currentRange > 0 && lowerShadow / currentRange >= 0.45 && isBullBar(signal);
  const rejectionSell = currentRange > 0 && upperShadow / currentRange >= 0.45 && isBearBar(signal);

  const adxTrending = dm.adx != null && dm.adx >= 25;
  const adxDormant = dm.adx != null && dm.adx < 20;
  const diBull = dm.plusDI != null && dm.minusDI != null && dm.plusDI > dm.minusDI;
  const diBear = dm.plusDI != null && dm.minusDI != null && dm.minusDI > dm.plusDI;

  const falseBreakDown =
    signal.low < recentLow10 &&
    signal.close > recentLow10 &&
    signal.close > prior.close &&
    bullCloseStrength &&
    isBullBar(signal);

  const falseBreakUp =
    signal.high > recentHigh10 &&
    signal.close < recentHigh10 &&
    signal.close < prior.close &&
    bearCloseStrength &&
    isBearBar(signal);

  const bullBreakout =
    signal.close > recentHigh20 * 0.998 && isBullBar(signal) && bullCloseStrength && expansionBar;

  const bearBreakout =
    signal.close < recentLow20 * 1.002 && isBearBar(signal) && bearCloseStrength && expansionBar;

  const pointContinuoBuy =
    mm21 != null &&
    priceAboveMM21 &&
    near(signal.low, mm21, 2.5) &&
    signal.high > prior.high &&
    isBullBar(signal);

  const pointContinuoSell =
    mm21 != null &&
    priceBelowMM21 &&
    near(signal.high, mm21, 2.5) &&
    signal.low < prior.low &&
    isBearBar(signal);

  const setup91Buy = ema9Up && isBullBar(signal) && signal.high > prior.high;
  const setup91Sell = ema9Down && isBearBar(signal) && signal.low < prior.low;

  const ifr2Buy = rsi2 != null && rsi2 <= 15 && priceAboveMM50 && isBullBar(signal);
  const ifr2Sell = rsi2 != null && rsi2 >= 85 && priceBelowMM50 && isBearBar(signal);

  const bollBuy = bb != null && signal.low < bb.lower && signal.close > bb.lower && rejectionBuy;
  const bollSell = bb != null && signal.high > bb.upper && signal.close < bb.upper && rejectionSell;

  const bullContinuation =
    trend === "BULL" &&
    isBullBar(signal) &&
    bullCloseStrength &&
    signal.high > prior.high &&
    priceAboveMM21 &&
    ema9Up;

  const bearContinuation =
    trend === "BEAR" &&
    isBearBar(signal) &&
    bearCloseStrength &&
    signal.low < prior.low &&
    priceBelowMM21 &&
    ema9Down;

  let action: Action = "AGUARDAR";
  let setup = "PALEX — Aguardar";
  let entry: number | null = null;
  let stop: number | null = null;
  let target: number | null = null;
  let explanation =
    "A leitura PALEX diária não encontrou assimetria suficiente após aplicar o Quality Engine. Melhor aguardar nova barra de força, rompimento confirmado ou falha em região relevante.";

  const context =
    trend === "BULL" ? "PALEX Bull" : trend === "BEAR" ? "PALEX Bear" : "PALEX Range";

  if (falseBreakDown || bollBuy) {
    action = "COMPRA";
    setup = falseBreakDown ? "PALEX — Falha Vendedora" : "PALEX — Bollinger FFFD/Reversão";
    entry = signal.high + tick;
    stop = Math.min(signal.low, recentLow10);
    target = getMeasuredMoveTarget(entry, stop, "LONG", 2);
    explanation =
      "Compra PALEX por rejeição/falha em região inferior: houve perda de mínima ou extrapolação de volatilidade, mas o candle fechou com recuperação. Entrada acima da máxima do candle de sinal e stop abaixo da região rejeitada.";
  } else if (falseBreakUp || bollSell) {
    action = "VENDA";
    setup = falseBreakUp ? "PALEX — Falha Compradora" : "PALEX — Bollinger FFFD/Reversão";
    entry = signal.low - tick;
    stop = Math.max(signal.high, recentHigh10);
    target = getMeasuredMoveTarget(entry, stop, "SHORT", 2);
    explanation =
      "Venda PALEX por rejeição/falha em região superior: houve rompimento de máxima ou extrapolação de volatilidade, mas o candle fechou com pressão vendedora. Entrada abaixo da mínima do candle de sinal e stop acima da região rejeitada.";
  } else if (pointContinuoBuy) {
    action = "COMPRA";
    setup = "PALEX — Ponto Contínuo MM21";
    entry = signal.high + tick;
    stop = Math.min(signal.low, getRecentSwingLow(candles, 8));
    target = getMeasuredMoveTarget(entry, stop, "LONG", 2);
    explanation =
      "Compra PALEX por Ponto Contínuo: preço corrigiu até a MM21 diária e voltou a acionar compra acima da máxima do candle, mantendo leitura de continuidade.";
  } else if (pointContinuoSell) {
    action = "VENDA";
    setup = "PALEX — Ponto Contínuo MM21";
    entry = signal.low - tick;
    stop = Math.max(signal.high, getRecentSwingHigh(candles, 8));
    target = getMeasuredMoveTarget(entry, stop, "SHORT", 2);
    explanation =
      "Venda PALEX por Ponto Contínuo: preço corrigiu até a MM21 diária e voltou a acionar venda abaixo da mínima do candle, mantendo leitura de continuidade baixista.";
  } else if (bullBreakout) {
    action = "COMPRA";
    setup = "PALEX — Rompimento Comprador";
    entry = signal.high + tick;
    stop = Math.min(recentLow10, signal.low);
    target = getMeasuredMoveTarget(entry, stop, "LONG", 2);
    explanation =
      "Compra PALEX por rompimento comprador diário com expansão de range. O Quality Engine valida volume, OBV, médias, ADX/DI e distância de resistência.";
  } else if (bearBreakout) {
    action = "VENDA";
    setup = "PALEX — Rompimento Vendedor";
    entry = signal.low - tick;
    stop = Math.max(recentHigh10, signal.high);
    target = getMeasuredMoveTarget(entry, stop, "SHORT", 2);
    explanation =
      "Venda PALEX por rompimento vendedor diário com expansão de range. O Quality Engine valida volume, OBV, médias, ADX/DI e distância de suporte.";
  } else if (bullContinuation || setup91Buy || ifr2Buy) {
    action = "COMPRA";
    setup = setup91Buy
      ? "PALEX — Setup MME9 / 9.1"
      : ifr2Buy
      ? "PALEX — IFR2 com filtro de tendência"
      : "PALEX — Continuação Compradora";
    entry = signal.high + tick;
    stop = Math.min(signal.low, getRecentSwingLow(candles, 10));
    target = getMeasuredMoveTarget(entry, stop, "LONG", 2);
    explanation =
      "Compra PALEX por continuidade no diário: tendência, média móvel e/ou IFR2 sugerem correção com chance de retomada. Entrada acima da máxima do candle de sinal.";
  } else if (bearContinuation || setup91Sell || ifr2Sell) {
    action = "VENDA";
    setup = setup91Sell
      ? "PALEX — Setup MME9 / 9.1"
      : ifr2Sell
      ? "PALEX — IFR2 com filtro de tendência"
      : "PALEX — Continuação Vendedora";
    entry = signal.low - tick;
    stop = Math.max(signal.high, getRecentSwingHigh(candles, 10));
    target = getMeasuredMoveTarget(entry, stop, "SHORT", 2);
    explanation =
      "Venda PALEX por continuidade no diário: tendência, média móvel e/ou IFR2 sugerem correção com chance de retomada da baixa. Entrada abaixo da mínima do candle de sinal.";
  }

  const rr =
    entry != null && stop != null && target != null && Math.abs(entry - stop) > 0
      ? Math.abs(target - entry) / Math.abs(entry - stop)
      : null;

  let probability = 50;
  const positives: string[] = [];
  const warnings: string[] = [];

  const plus = (ok: boolean, pts: number, msg: string) => {
    if (ok) {
      probability += pts;
      positives.push(msg);
    }
  };

  const minus = (ok: boolean, pts: number, msg: string) => {
    if (ok) {
      probability -= pts;
      warnings.push(msg);
    }
  };

  if (action === "COMPRA") {
    plus(trend === "BULL", 8, "tendência diária favorece compra");
    plus(priceAboveMM21, 6, "preço acima da MM21");
    plus(ema9Up, 5, "MME9 virada para cima");
    plus(priceAboveMM50, 5, "preço acima da MME50");
    plus(priceAboveMM200, 4, "preço acima da MM200");
    plus(volumeExpansion, 7, "volume acima da média");
    plus(obvSlope > 0, 7, "OBV em acumulação");
    plus(adxTrending && diBull, 7, "ADX/DI confirma força compradora");
    plus(nearSupport || rejectionBuy, 5, "rejeição/proximidade de suporte");
    plus(rsi14 != null && rsi14 > 50 && rsi14 < 75, 4, "IFR14 saudável");
    plus(rsi2 != null && rsi2 < 15 && priceAboveMM50, 4, "IFR2 sobrevendido com filtro de tendência");

    minus(trend === "BEAR", 10, "tendência diária ainda baixista");
    minus(priceBelowMM21, 6, "preço abaixo da MM21");
    minus(priceBelowMM50, 5, "preço abaixo da MME50");
    minus(priceBelowMM200, 4, "preço abaixo da MM200");
    minus(nearResistance, 5, "entrada próxima de resistência");
    minus(volumeDryUp && setup.includes("Rompimento"), 8, "rompimento sem volume");
    minus(obvSlope < 0 && priceSlope > 0, 7, "divergência baixista entre preço e OBV");
    minus(adxDormant && setup.includes("Continuação"), 5, "ADX baixo para continuação");
    minus(rsi14 != null && rsi14 > 78, 4, "IFR14 esticado");
  } else if (action === "VENDA") {
    plus(trend === "BEAR", 8, "tendência diária favorece venda");
    plus(priceBelowMM21, 6, "preço abaixo da MM21");
    plus(ema9Down, 5, "MME9 virada para baixo");
    plus(priceBelowMM50, 5, "preço abaixo da MME50");
    plus(priceBelowMM200, 4, "preço abaixo da MM200");
    plus(volumeExpansion, 7, "volume acima da média");
    plus(obvSlope < 0, 7, "OBV em distribuição");
    plus(adxTrending && diBear, 7, "ADX/DI confirma força vendedora");
    plus(nearResistance || rejectionSell, 5, "rejeição/proximidade de resistência");
    plus(rsi14 != null && rsi14 < 50 && rsi14 > 25, 4, "IFR14 confirma momentum vendedor");

    minus(trend === "BULL", 10, "tendência diária ainda altista");
    minus(priceAboveMM21, 6, "preço acima da MM21");
    minus(priceAboveMM50, 5, "preço acima da MME50");
    minus(priceAboveMM200, 4, "preço acima da MM200");
    minus(nearSupport, 5, "entrada próxima de suporte");
    minus(volumeDryUp && setup.includes("Rompimento"), 8, "rompimento sem volume");
    minus(obvSlope > 0 && priceSlope < 0, 7, "divergência altista entre preço e OBV");
    minus(adxDormant && setup.includes("Continuação"), 5, "ADX baixo para continuação");
    minus(rsi14 != null && rsi14 < 22, 4, "IFR14 muito vendido");
  } else {
    probability = 45;
    warnings.push("sem gatilho PALEX com confluência suficiente");
    if (adxDormant) positives.push("ADX baixo pode indicar base de acumulação/distribuição para rompimento futuro");
    if (bb != null && bb.bandwidth < 8) positives.push("Bandas estreitas indicam possível expansão futura");
  }

  if (rr != null) {
    plus(rr >= 2, 8, "risco/retorno igual ou superior a 1:2");
    plus(rr >= 1.5 && rr < 2, 4, "risco/retorno aceitável");
    minus(rr < 1.3, 10, "risco/retorno insuficiente");
  }

  probability = Math.min(90, Math.max(30, Math.round(probability)));

  const confluences = positives.length
    ? `Confluências: ${positives.slice(0, 7).join("; ")}.`
    : "Confluências: poucas confirmações objetivas.";

  const alerts = warnings.length
    ? `Alertas: ${warnings.slice(0, 6).join("; ")}.`
    : "Alertas: sem divergências críticas detectadas.";

  const metrics = `Métricas: MM21 ${formatBRL(mm21)}, MME50 ${formatBRL(mm50)}, MM200 ${formatBRL(
    mm200
  )}, IFR14 ${rsi14 != null ? rsi14.toFixed(1) : "--"}, IFR2 ${
    rsi2 != null ? rsi2.toFixed(1) : "--"
  }, ADX ${dm.adx != null ? dm.adx.toFixed(1) : "--"}, suporte ${formatBRL(
    support60
  )}, resistência ${formatBRL(resistance60)}.`;

  return {
    action,
    setup,
    context: `${context} • Quality Engine ${probability}/100`,
    signalQuality: quality,
    entry,
    stop,
    target,
    rr,
    explanation: `${explanation} ${confluences} ${alerts} ${metrics}`,
    brooksReason:
      "Leitura PALEX independente da leitura Al Brooks, aplicada exclusivamente ao gráfico diário. O Quality Engine qualifica o setup por tendência, suporte/resistência, volume, OBV, médias, IFR, Bollinger, ADX/DI e risco/retorno.",
    brooksReference:
      "PALEX — Fundamentos + Estratégias: tendência por topos/fundos, suportes/resistências, volume/OBV, estopes, pivots, candlesticks, MME9/MM21/MM200, IFR/IFR2, Bandas de Bollinger, ADX/DI, Fibonacci, rompimentos, falhas e plano de trade.",
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