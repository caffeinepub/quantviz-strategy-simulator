import { calcAllIndicators } from "./indicators";
import type { DayData } from "./playback";
import { generateTradingData } from "./sampleData";

export function generateSampleDayData(): DayData[] {
  const bars = generateTradingData(300);
  const ind = calcAllIndicators(bars);
  return bars
    .slice(26)
    .map((b, i) => {
      const idx = i + 26;
      return {
        price: b.close,
        roc21: ind.roc21[idx] ?? 0,
        rsi: ind.rsi[idx] ?? 50,
        macd: ind.macd[idx] ?? 0,
        mfi: ind.mfi[idx] ?? 50,
        momentum: ind.momentum[idx] ?? 0,
        date: b.date,
      };
    })
    .filter((d) => d.roc21 !== 0 && d.rsi !== 50);
}
