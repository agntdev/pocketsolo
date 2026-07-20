export interface PocketOptionConfig {
  token: string;
  accountId: string;
}

export interface AccountBalance {
  balance: number;
  equity: number;
  currency: string;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  direction: "call" | "put";
  amount: number;
  duration: number;
  status: "pending" | "open" | "closed";
  openTime: string;
  closeTime?: string;
  outcome?: "win" | "loss" | "draw";
  pnl?: number;
  platformTradeId?: string;
}

export interface OpenPosition {
  id: string;
  symbol: string;
  direction: "call" | "put";
  amount: number;
  openTime: string;
  expectedCloseTime: string;
  currentPrice: number;
  entryPrice: number;
}

export interface TradeRequest {
  symbol: string;
  direction: "call" | "put";
  amount: number;
  duration: number;
}

export interface TradePlacementResult {
  success: boolean;
  platformTradeId?: string;
  message: string;
}

export class PocketOptionClient {
  private token: string;
  private accountId: string;
  private baseUrl = "https://pocketoption.com/api";

  constructor(config: PocketOptionConfig) {
    this.token = config.token;
    this.accountId = config.accountId;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      "X-Account-Id": this.accountId,
    };
  }

  async getBalance(): Promise<AccountBalance> {
    const res = await fetch(`${this.baseUrl}/v1/account/balance`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Balance request failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    const b = data.balance as Record<string, unknown>;
    return {
      balance: Number(b.balance),
      equity: Number(b.equity),
      currency: String(b.currency ?? "USD"),
    };
  }

  async placeTrade(req: TradeRequest): Promise<TradePlacementResult> {
    const res = await fetch(`${this.baseUrl}/v1/trade/place`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        symbol: req.symbol,
        direction: req.direction,
        amount: req.amount,
        duration: req.duration,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { success: false, message: `Trade failed (${res.status}): ${body}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return {
      success: true,
      platformTradeId: String(data.trade_id ?? data.id ?? ""),
      message: String(data.message ?? "Trade placed"),
    };
  }

  async getOpenPositions(): Promise<OpenPosition[]> {
    const res = await fetch(`${this.baseUrl}/v1/trade/open`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Open positions request failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    const positions = (data.positions ?? []) as Record<string, unknown>[];
    return positions.map((p) => ({
      id: String(p.id ?? ""),
      symbol: String(p.symbol ?? ""),
      direction: (p.direction as "call" | "put") ?? "call",
      amount: Number(p.amount ?? 0),
      openTime: String(p.open_time ?? ""),
      expectedCloseTime: String(p.expected_close_time ?? ""),
      currentPrice: Number(p.current_price ?? 0),
      entryPrice: Number(p.entry_price ?? 0),
    }));
  }

  async getTradeHistory(count = 20): Promise<TradeRecord[]> {
    const res = await fetch(`${this.baseUrl}/v1/trade/history?count=${count}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Trade history request failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    const trades = (data.trades ?? []) as Record<string, unknown>[];
    return trades.map((t) => ({
      id: String(t.id ?? ""),
      symbol: String(t.symbol ?? ""),
      direction: (t.direction as "call" | "put") ?? "call",
      amount: Number(t.amount ?? 0),
      duration: Number(t.duration ?? 0),
      status: (t.status as "pending" | "open" | "closed") ?? "closed",
      openTime: String(t.open_time ?? ""),
      closeTime: t.close_time ? String(t.close_time) : undefined,
      outcome: t.outcome ? (t.outcome as "win" | "loss" | "draw") : undefined,
      pnl: t.pnl ? Number(t.pnl) : undefined,
      platformTradeId: t.platform_trade_id ? String(t.platform_trade_id) : undefined,
    }));
  }

  async cancelTrade(tradeId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${this.baseUrl}/v1/trade/cancel`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ trade_id: tradeId }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { success: false, message: `Cancel failed (${res.status}): ${body}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return {
      success: Boolean(data.success ?? true),
      message: String(data.message ?? "Trade cancelled"),
    };
  }
}

let sharedClient: PocketOptionClient | null = null;

export function getSharedClient(): PocketOptionClient | null {
  if (sharedClient) return sharedClient;
  const token = process.env.POCKET_OPTION_TOKEN;
  const accountId = process.env.POCKET_OPTION_ACCOUNT_ID;
  if (token && accountId) {
    sharedClient = new PocketOptionClient({ token, accountId });
    return sharedClient;
  }
  return null;
}

export function resetSharedClient(): void {
  sharedClient = null;
}
