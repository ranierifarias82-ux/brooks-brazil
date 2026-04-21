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
  weeklyCandles: Candle[];
  dailyCandles: Candle[];
  h4Candles: Candle[];
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

function CandlesChart({
  candles,
  title,
}: {
  candles: Candle[];
  title: string;
}) {
  const data = candles.slice(-70);

  if (!data.length) {
    return (
      <div
        style={{
          background: "#111",
          border: "1px solid #2a2a2a",
          borderRadius: 16,
          padding: 16,
          marginTop: 16,
        }}
      >
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <div
          style={{
            height: 420,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#888",
            background: "#0b0b0b",
            borderRadius: 12,
          }}
        >
          Sem candles disponíveis para este gráfico.
        </div>
      </div>
    );
  }

  const maxHigh = Math.max(...data.map((c) => c.high));
  const minLow = Math.min(...data.map((c) => c.low));
  const priceRange = Math.max(maxHigh - minLow, 0.0001);

  const width = 1000;
  const height = 420;
  const paddingTop = 20;
  const paddingRight = 60;
  const paddingBottom = 28;
  const paddingLeft = 18;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const candleStep = plotWidth / data.length;
  const bodyWidth = Math.max(3, candleStep * 0.58);

  const y = (price: number) =>
    paddingTop + ((maxHigh - price) / priceRange) * plotHeight;

  const priceTicks = 5;
  const gridPrices = Array.from({ length: priceTicks }, (_, i) => {
    const ratio = i / (priceTicks - 1);
    return maxHigh - ratio * priceRange;
  });

  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #2a2a2a",
        borderRadius: 16,
        padding: 16,
        marginTop: 16,
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 10 }}>{title}</h3>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: "100%",
          height: 420,
          display: "block",
          background: "#0b0b0b",
          borderRadius: 12,
        }}
      >
        {gridPrices.map((p, i) => {
          const gy = y(p);
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={gy}
                x2={width - paddingRight}
                y2={gy}
                stroke="#1f2937"
                strokeWidth="1"
              />
              <text
                x={width - paddingRight + 8}
                y={gy + 4}
                fill="#9ca3af"
                fontSize="12"
              >
                {p.toFixed(2)}
              </text>
            </g>
          );
        })}

        {data.map((c, i) => {
          const x = paddingLeft + i * candleStep + candleStep / 2;
          const highY = y(c.high);
          const lowY = y(c.low);
          const openY = y(c.open);
          const closeY = y(c.close);
          const top = Math.min(openY, closeY);
          const bottom = Math.max(openY, closeY);
          const color = c.close >= c.open ? "#22c55e" : "#ef4444";

          return (
            <g key={i}>
              <line
                x1={x}
                y1={highY}
                x2={x}
                y2={lowY}
                stroke={color}
                strokeWidth="1.4"
              />
              <rect
                x={x - bodyWidth / 2}
                y={top}
                width={bodyWidth}
                height={Math.max(2, bottom - top)}
                rx={1}
                fill={color}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AnalysisCard({ title, plan }: { title: string; plan: TradePlan | null }) {
  return (
    <div
      style={{
        background: "#171717",
        color: "#fff",
        padding: 18,
        borderRadius: 16,
        border: "1px solid #2a2a2a",
        marginBottom: 14,
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

          <p><strong>Sugestão:</strong> {plan.action}</p>
          <p><strong>Setup:</strong> {plan.setup}</p>
          <p><strong>Contexto:</strong> {plan.context}</p>
          <p><strong>Qualidade da barra:</strong> {plan.signalQuality}</p>
          <p><strong>Ponto de entrada:</strong> {formatBRL(plan.entry)}</p>
          <p><strong>Stop Loss:</strong> {formatBRL(plan.stop)}</p>
          <p><strong>Take Profit:</strong> {formatBRL(plan.target)}</p>
          <p><strong>Risco/Retorno:</strong> {plan.rr != null ? `1:${plan.rr.toFixed(2)}` : "--"}</p>
          <p><strong>Leitura:</strong> {plan.explanation}</p>
          <p><strong>Justificativa (Brooks):</strong> {plan.brooksReason}</p>
          <p><strong>Base Teórica:</strong> {plan.brooksReference}</p>
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
      <p><strong>Semanal:</strong> {weeklyPlan.action} • {weeklyPlan.grade} • {weeklyPlan.probability != null ? `${weeklyPlan.probability}%` : "--"}</p>
      <p><strong>Diário:</strong> {dailyPlan.action} • {dailyPlan.grade} • {dailyPlan.probability != null ? `${dailyPlan.probability}%` : "--"}</p>
      <p><strong>4h:</strong> {h4Plan.action} • {h4Plan.grade} • {h4Plan.probability != null ? `${h4Plan.probability}%` : "--"}</p>
      <p style={{ marginBottom: 0 }}><strong>Leitura combinada:</strong> {message}</p>
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

        const score = getCombinedScore(weekly, daily, h4);

        return {
          ticker: item.ticker,
          name: item.name,
          sector: item.sector,
          weekly,
          daily,
          h4,
          weeklyCandles,
          dailyCandles,
          h4Candles,
          score,
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
        <h1 style={{ marginTop: 0 }}>Brooks Brazil — Scanner Weekly + Daily + 4H</h1>
        <p style={{ color: "#bbb" }}>
          Ranking com confluência de 3 timeframes, probabilidade, nota, entrada, stop, alvo e justificativa Brooks.
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
              scanner.map((item, index) => (
                <button
                  key={item.ticker}
                  onClick={() => setSelectedItem(item)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background:
                      selectedItem?.ticker === item.ticker ? "#1f2937" : "#171717",
                    color: "#fff",
                    border: "1px solid #2a2a2a",
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
                        }}
                      >
                        4H {item.h4.grade}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 13 }}>
                    <strong>Score:</strong> {item.score.toFixed(0)}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#bbb" }}>
                    W: {item.weekly.action} • D: {item.daily.action} • 4H: {item.h4.action}
                  </div>
                </button>
              ))}
          </div>

          <div>
            {selectedItem ? (
              <>
                <ConfluenceBox
                  weeklyPlan={selectedItem.weekly}
                  dailyPlan={selectedItem.daily}
                  h4Plan={selectedItem.h4}
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 14,
                    alignItems: "start",
                  }}
                >
                  <div>
                    <AnalysisCard title={`Semanal — ${selectedItem.ticker}`} plan={selectedItem.weekly} />
                    <CandlesChart
                      candles={selectedItem.weeklyCandles}
                      title={`Gráfico Semanal — ${selectedItem.ticker}`}
                    />
                  </div>

                  <div>
                    <AnalysisCard title={`Diário — ${selectedItem.ticker}`} plan={selectedItem.daily} />
                    <CandlesChart
                      candles={selectedItem.dailyCandles}
                      title={`Gráfico Diário — ${selectedItem.ticker}`}
                    />
                  </div>

                  <div>
                    <AnalysisCard title={`4H — ${selectedItem.ticker}`} plan={selectedItem.h4} />
                    <CandlesChart
                      candles={selectedItem.h4Candles}
                      title={`Gráfico 4H — ${selectedItem.ticker}`}
                    />
                  </div>
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