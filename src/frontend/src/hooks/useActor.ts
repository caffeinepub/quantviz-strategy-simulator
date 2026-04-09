import { useActor as useCaffeineActor } from "@caffeineai/core-infrastructure";
import { createActor } from "../backend";

export interface StockDataResult {
  ok: string;
  err?: never;
}

export interface StockDataError {
  err: string;
  ok?: never;
}

export type StockDataResponse = StockDataResult | StockDataError;

export interface AppActor {
  fetchStockData: (
    symbol: string,
    fromTs: bigint,
    toTs: bigint,
  ) => Promise<StockDataResponse>;
}

export function useActor(): { actor: AppActor | null; isFetching: boolean } {
  // createActor from backend.ts wraps the generated canister bindings.
  // We cast to AppActor because the backendInterface types are auto-generated
  // and may lag behind the actual canister implementation.
  const { actor, isFetching } = useCaffeineActor(createActor);
  return { actor: actor as unknown as AppActor | null, isFetching };
}
