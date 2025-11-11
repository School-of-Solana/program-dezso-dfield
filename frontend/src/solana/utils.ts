import { BN } from "@coral-xyz/anchor";

export const utf8 = (s: string): Uint8Array => {
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
};

export const bnToLe8 = (bn: BN): Uint8Array =>
  new Uint8Array(bn.toArray("le", 8));