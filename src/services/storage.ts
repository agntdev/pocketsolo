import type { TradeRecord } from "./pocket-option.js";

export interface TradeStore {
  saveTrade(trade: TradeRecord): Promise<void>;
  getTrade(id: string): Promise<TradeRecord | undefined>;
  listTrades(userId: string, count?: number): Promise<TradeRecord[]>;
  deleteTrade(id: string): Promise<void>;
}

export interface ConfigStore {
  getSummaryEnabled(userId: string): Promise<boolean>;
  setSummaryEnabled(userId: string, enabled: boolean): Promise<void>;
}

interface StorageBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

class RedisTradeStore implements TradeStore {
  constructor(private backend: StorageBackend) {}

  async saveTrade(trade: TradeRecord): Promise<void> {
    const key = `trade:${trade.id}`;
    await this.backend.set(key, JSON.stringify(trade));
    const indexKey = `trades:index`;
    const existing = await this.backend.get(indexKey);
    const ids: string[] = existing ? JSON.parse(existing) : [];
    if (!ids.includes(trade.id)) {
      ids.push(trade.id);
      await this.backend.set(indexKey, JSON.stringify(ids));
    }
  }

  async getTrade(id: string): Promise<TradeRecord | undefined> {
    const raw = await this.backend.get(`trade:${id}`);
    if (!raw) return undefined;
    return JSON.parse(raw) as TradeRecord;
  }

  async listTrades(_userId: string, count = 10): Promise<TradeRecord[]> {
    const indexRaw = await this.backend.get(`trades:index`);
    if (!indexRaw) return [];
    const ids: string[] = JSON.parse(indexRaw);
    const trades: TradeRecord[] = [];
    for (const id of ids.slice(-count).reverse()) {
      const t = await this.getTrade(id);
      if (t) trades.push(t);
    }
    return trades;
  }

  async deleteTrade(id: string): Promise<void> {
    await this.backend.del(`trade:${id}`);
    const indexRaw = await this.backend.get(`trades:index`);
    if (!indexRaw) return;
    const ids: string[] = JSON.parse(indexRaw);
    const filtered = ids.filter((i) => i !== id);
    await this.backend.set(`trades:index`, JSON.stringify(filtered));
  }
}

class RedisConfigStore implements ConfigStore {
  constructor(private backend: StorageBackend) {}

  async getSummaryEnabled(userId: string): Promise<boolean> {
    const raw = await this.backend.get(`config:${userId}:summary`);
    return raw === "true";
  }

  async setSummaryEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.backend.set(`config:${userId}:summary`, String(enabled));
  }
}

function createInMemoryBackend(): StorageBackend {
  const store = new Map<string, string>();
  return {
    async get(key) { return store.get(key) ?? null; },
    async set(key, value) { store.set(key, value); },
    async del(key) { store.delete(key); },
    async keys(pattern) {
      const prefix = pattern.replace("*", "");
      return [...store.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}

let tradeStoreInstance: TradeStore | null = null;
let configStoreInstance: ConfigStore | null = null;

export async function getTradeStore(): Promise<TradeStore> {
  if (tradeStoreInstance) return tradeStoreInstance;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const ioredis = req("ioredis");
    const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
    const client = new Redis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });
    const backend: StorageBackend = {
      async get(key) { return client.get(key); },
      async set(key, value) { await client.set(key, value); },
      async del(key) { await client.del(key); },
      async keys(pattern) { return client.keys(pattern); },
    };
    tradeStoreInstance = new RedisTradeStore(backend);
  } else {
    tradeStoreInstance = new RedisTradeStore(createInMemoryBackend());
  }
  return tradeStoreInstance;
}

export async function getConfigStore(): Promise<ConfigStore> {
  if (configStoreInstance) return configStoreInstance;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const ioredis = req("ioredis");
    const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
    const client = new Redis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });
    const backend: StorageBackend = {
      async get(key) { return client.get(key); },
      async set(key, value) { await client.set(key, value); },
      async del(key) { await client.del(key); },
      async keys(pattern) { return client.keys(pattern); },
    };
    configStoreInstance = new RedisConfigStore(backend);
  } else {
    configStoreInstance = new RedisConfigStore(createInMemoryBackend());
  }
  return configStoreInstance;
}

export function resetStores(): void {
  tradeStoreInstance = null;
  configStoreInstance = null;
}
