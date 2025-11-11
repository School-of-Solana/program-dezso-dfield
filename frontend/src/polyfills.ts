// src/polyfills.ts
import { Buffer } from "buffer";

// Make Buffer available globally (for anchor, web3.js, bn.js, bs58, etc.)
if (typeof (window as any).Buffer === "undefined") {
  (window as any).Buffer = Buffer;
}

if (typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}