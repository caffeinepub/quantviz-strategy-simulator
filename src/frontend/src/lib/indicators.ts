export interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorData {
  rsi: (number | null)[];
  roc21: (number | null)[];
  mfi: (number | null)[];
  macd: (number | null)[];
  macdSignal: (number | null)[];
  macdHist: (number | null)[];
  momentum: (number | null)[];
}

function calcEMA(values: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(values.length).fill(null);
  let ema = 0;
  let started = false;

  for (let i = 0; i < values.length; i++) {
    if (!started) {
      if (i === period - 1) {
        // seed with SMA
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += values[j];
        ema = sum / period;
        result[i] = ema;
        started = true;
      }
    } else {
      ema = values[i] * k + ema * (1 - k);
      result[i] = ema;
    }
  }
  return result;
}

export function calcRSI(bars: Bar[], period = 14): (number | null)[] {
  const closes = bars.map((b) => b.close);
  const result: (number | null)[] = new Array(closes.length).fill(null);

  if (closes.length < period + 1) return result;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = 100 - 100 / (1 + rs);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsVal = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i] = 100 - 100 / (1 + rsVal);
  }

  return result;
}

export function calcROC21(bars: Bar[]): (number | null)[] {
  const closes = bars.map((b) => b.close);
  return closes.map((c, i) => (i < 21 ? null : (c / closes[i - 21] - 1) * 100));
}

export function calcMFI(bars: Bar[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(bars.length).fill(null);
  const tp = bars.map((b) => (b.high + b.low + b.close) / 3);
  const mf = tp.map((t, i) => t * bars[i].volume);

  for (let i = period; i < bars.length; i++) {
    let posFlow = 0;
    let negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (tp[j] > tp[j - 1]) posFlow += mf[j];
      else negFlow += mf[j];
    }
    const mfr = negFlow === 0 ? 100 : posFlow / negFlow;
    result[i] = 100 - 100 / (1 + mfr);
  }
  return result;
}

export function calcMACD(bars: Bar[]): {
  macd: (number | null)[];
  signal: (number | null)[];
  hist: (number | null)[];
} {
  const closes = bars.map((b) => b.close);
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = closes.map((_, i) => {
    if (ema12[i] === null || ema26[i] === null) return null;
    return (ema12[i] as number) - (ema26[i] as number);
  });

  const validMacd = macdLine.filter((v) => v !== null) as number[];
  const signalRaw = calcEMA(validMacd, 9);
  const signal: (number | null)[] = new Array(bars.length).fill(null);
  let sigIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null) {
      signal[i] = signalRaw[sigIdx];
      sigIdx++;
    }
  }

  const hist = macdLine.map((m, i) => {
    if (m === null || signal[i] === null) return null;
    return (m as number) - (signal[i] as number);
  });

  return { macd: macdLine, signal, hist };
}

export function calcMomentum(bars: Bar[], period = 10): (number | null)[] {
  const closes = bars.map((b) => b.close);
  return closes.map((c, i) => (i < period ? null : c - closes[i - period]));
}

export function calcAllIndicators(bars: Bar[]): IndicatorData {
  const { macd, signal, hist } = calcMACD(bars);
  return {
    rsi: calcRSI(bars),
    roc21: calcROC21(bars),
    mfi: calcMFI(bars),
    macd,
    macdSignal: signal,
    macdHist: hist,
    momentum: calcMomentum(bars),
  };
}
