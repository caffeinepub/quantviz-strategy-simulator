export interface DayData {
  price: number;
  roc21: number;
  rsi: number;
  macd: number;
  mfi: number;
  momentum: number;
  date?: string;
}

export interface TradeRecord {
  entryDay: number;
  entryPrice: number;
  exitDay?: number;
  exitPrice?: number;
  exitReason?: string;
  pnlPct?: number;
}

export interface LogEntry {
  day: number;
  type: "entry" | "exit" | "hold" | "info";
  message: string;
  module?: string;
}

export interface AlertEntry {
  day: number;
  message: string;
  level: "info" | "warning" | "critical";
}
