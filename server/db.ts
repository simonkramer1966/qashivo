import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Use a WebSocket wrapper that catches ErrorEvent issues from Neon's driver.
// The Neon serverless driver can emit WebSocket ErrorEvents with read-only
// `message` properties that crash Node when serialized.
class SafeWebSocket extends ws {
  constructor(...args: ConstructorParameters<typeof ws>) {
    super(...args);
    this.on('error', (err) => {
      // Catch and log WebSocket errors so they don't propagate as
      // uncaughtExceptions with unserializable ErrorEvent objects
      const msg = (() => {
        try { return err?.message || String(err); } catch { return 'WebSocket error'; }
      })();
      console.error(`[DB] WebSocket error (handled): ${msg}`);
    });
  }
}

neonConfig.webSocketConstructor = SafeWebSocket as any;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '10'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
  maxUses: 7500,
});

// Pool-level error handling — prevents unhandled errors from crashing the process
pool.on('error', (err) => {
  const msg = (() => {
    try { return err?.message || String(err); } catch { return 'unknown pool error'; }
  })();
  console.error(`[DB] Pool error (non-fatal, will reconnect): ${msg}`);
});

pool.on('connect', () => {
  console.log('[DB] New database connection established');
});

export const db = drizzle({ client: pool, schema });