import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface HttpResponsePayload {
    status: bigint;
    body: Uint8Array;
    headers: Array<{
        value: string;
        name: string;
    }>;
}
export interface backendInterface {
    fetchStockData(symbol: string, startTs: bigint, endTs: bigint): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    transformResponse(args: {
        context: Uint8Array;
        response: HttpResponsePayload;
    }): Promise<HttpResponsePayload>;
}
