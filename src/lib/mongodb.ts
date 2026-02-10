// lib/mongodb.ts
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "";

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

let cached = (global as any).__mongoose;

if (!cached) {
  cached = (global as any).__mongoose = { conn: null, promise: null };
}

export async function connectToDB() {
  if (cached.conn) {
    return cached.conn;
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // Timeout after 10s instead of 30s
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    }).catch((err) => {
      cached.promise = null; // Reset promise on error so next attempt can retry
      throw err;
    });
  }
  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error: any) {
    cached.promise = null; // Reset for next attempt
    if (error.code === 'ETIMEOUT' || error.syscall === 'querySrv') {
      throw new Error('Unable to connect to MongoDB Atlas. Please check your internet connection and MongoDB Atlas IP whitelist settings.');
    }
    throw error;
  }
}
