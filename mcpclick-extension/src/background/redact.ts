import { subtleDigest } from "../common/util";

const SECRET_KEY_STORAGE = "tokenization_salt";
let salt: string | null = null;

async function getSalt(): Promise<string> {
  if (salt) return salt;
  const { [SECRET_KEY_STORAGE]: v } = await chrome.storage.local.get(SECRET_KEY_STORAGE);
  if (v) { salt = v; return v; }
  const rand = crypto.getRandomValues(new Uint8Array(16));
  const s = Array.from(rand).map(b => b.toString(16).padStart(2, "0")).join("");
  await chrome.storage.local.set({ [SECRET_KEY_STORAGE]: s });
  salt = s; return s;
}

function isSensitiveKey(k: string): boolean {
  return /authorization|cookie|token|secret|password|apikey|session|bearer/i.test(k);
}

function isLikelyPII(k: string): boolean {
  return /email|phone|name|ssn|iban|card|address/i.test(k);
}

export const redact = {
  headers(h: Record<string, any>) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(h || {})) {
      out[k] = isSensitiveKey(k) ? "__REDACTED__" : v;
    }
    return out;
  },
  async token(v: string): Promise<string> {
    const s = await getSalt();
    const digest = await subtleDigest("SHA-256", new TextEncoder().encode(s + ":" + v));
    const hex = Array.from(new Uint8Array(digest)).slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
    return `__TKN_${hex}__`;
  },
  body(raw: string | undefined, mime: string | undefined) {
    if (!raw) return undefined;
    if (mime && !/json|text|graphql/.test(mime)) return "__BINARY__";
    try {
      const j = JSON.parse(raw);
      return redactJson(j);
    } catch {
      return raw.length > 65536 ? raw.slice(0, 65536) + "…" : raw;
    }
  }
};

function redactJson(x: any): any {
  if (x == null) return x;
  if (typeof x === "string") {
    if (/\S+@\S+/.test(x) || /\d{3,}/.test(x)) return "__REDACTED__"; // coarse
    return x.length > 256 ? x.slice(0, 256) + "…" : x;
  }
  if (Array.isArray(x)) return x.slice(0, 50).map(redactJson);
  if (typeof x === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(x)) {
      out[k] = isLikelyPII(k) ? "__REDACTED__" : redactJson(v);
    }
    return out;
  }
  return x;
}


