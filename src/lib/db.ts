import mongoose from "mongoose";
import { env } from "./env";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const globalCache = globalThis as unknown as { __mongo?: Cache };
const cache: Cache = (globalCache.__mongo ??= { conn: null, promise: null });

export async function connectDb() {
  if (cache.conn) return cache.conn;
  cache.promise ??= mongoose.connect(env.mongoUri(), { bufferCommands: false, maxPoolSize: 10 });
  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}
