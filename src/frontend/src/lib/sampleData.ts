import type { Bar } from "./indicators";

export function generateSampleData(): Bar[] {
  const bars: Bar[] = [];
  let price = 450;
  const startDate = new Date("2022-01-03");

  for (let i = 0; i < 500; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    // skip weekends
    if (d.getDay() === 0 || d.getDay() === 6) {
      // still add a day but mark as weekend - we'll filter
      continue;
    }

    const dailyReturn = (Math.random() - 0.488) * 0.02; // slight upward drift
    const open = price * (1 + (Math.random() - 0.5) * 0.005);
    price = price * (1 + dailyReturn);
    const close = price;
    const high = Math.max(open, close) * (1 + Math.random() * 0.008);
    const low = Math.min(open, close) * (1 - Math.random() * 0.008);
    const volume = Math.floor(50_000_000 + Math.random() * 100_000_000);

    bars.push({
      date: d.toISOString().slice(0, 10),
      open: Number.parseFloat(open.toFixed(2)),
      high: Number.parseFloat(high.toFixed(2)),
      low: Number.parseFloat(low.toFixed(2)),
      close: Number.parseFloat(close.toFixed(2)),
      volume,
    });

    if (bars.length >= 500) break;
  }

  return bars;
}

// Generate more bars to ensure 500 trading days
export function generateTradingData(count = 500): Bar[] {
  const bars: Bar[] = [];
  let price = 450;
  const startDate = new Date("2022-01-03");
  let dayOffset = 0;

  while (bars.length < count) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + dayOffset);
    dayOffset++;

    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const dailyReturn = (Math.random() - 0.488) * 0.02;
    const open = price * (1 + (Math.random() - 0.5) * 0.005);
    price = price * (1 + dailyReturn);
    const close = price;
    const high = Math.max(open, close) * (1 + Math.random() * 0.008);
    const low = Math.min(open, close) * (1 - Math.random() * 0.008);
    const volume = Math.floor(50_000_000 + Math.random() * 100_000_000);

    bars.push({
      date: d.toISOString().slice(0, 10),
      open: Number.parseFloat(open.toFixed(2)),
      high: Number.parseFloat(high.toFixed(2)),
      low: Number.parseFloat(low.toFixed(2)),
      close: Number.parseFloat(close.toFixed(2)),
      volume,
    });
  }

  return bars;
}
