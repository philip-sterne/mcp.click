// Lightweight cross-context message bus for MV3 (bg <-> content <-> extension UIs)
// - Uses chrome.runtime messaging under the hood
// - Provides local pub/sub with automatic cross-context relay

type EventHandler<T = any> = (payload: T) => void | Promise<void>;

class Emitter {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as EventHandler);
    return () => this.off(event, handler);
  }

  off<T = any>(event: string, handler: EventHandler<T>): void {
    this.handlers.get(event)?.delete(handler as EventHandler);
  }

  async emit<T = any>(event: string, payload: T): Promise<void> {
    const list = Array.from(this.handlers.get(event) || []);
    for (const handler of list) {
      try {
        await handler(payload);
      } catch (err) {
        // Swallow to avoid breaking other handlers
      }
    }
  }
}

// Unique origin id to suppress echo loops
const originId = (() => {
  try {
    // @ts-ignore - randomUUID is widely available in MV3 contexts
    return (globalThis.crypto?.randomUUID?.() as string) || `o_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  } catch {
    return `o_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }
})();

type WireMessage = {
  __mcpclick: true;
  event: string;
  payload: any;
  originId: string;
};

function isWireMessage(msg: any): msg is WireMessage {
  return !!msg && msg.__mcpclick === true && typeof msg.event === "string" && "originId" in msg;
}

const emitter = new Emitter();

// Relay incoming runtime messages to local listeners
try {
  chrome.runtime.onMessage.addListener((message: any, _sender, _sendResponse) => {
    if (!isWireMessage(message)) return; // not ours
    if (message.originId === originId) return; // ignore self echo
    // Fire locally; no rebroadcast to prevent loops
    void emitter.emit(message.event, message.payload);
  });
} catch {
  // Not in a Chrome MV3 context (e.g., unit tests)
}

async function runtimeBroadcast<T = any>(event: string, payload: T): Promise<void> {
  const wire: WireMessage = { __mcpclick: true, event, payload, originId };
  try {
    // Broadcast to extension pages and background
    await chrome.runtime.sendMessage(wire).catch(() => {});
  } catch {}

  // Best-effort broadcast to all tabs (content scripts). Only works in bg/extension pages.
  try {
    if (chrome.tabs?.query && chrome.tabs?.sendMessage) {
      const tabs = await chrome.tabs.query({});
      await Promise.all(
        tabs.map((t) =>
          t.id != null
            ? chrome.tabs.sendMessage(t.id, wire).catch(() => {})
            : Promise.resolve()
        )
      );
    }
  } catch {}
}

// Public bus API
export const bus = {
  on: <T = any>(event: string, handler: EventHandler<T>) => emitter.on(event, handler),
  off: <T = any>(event: string, handler: EventHandler<T>) => emitter.off(event, handler),
  // Emit locally and across contexts
  emit: async <T = any>(event: string, payload: T): Promise<void> => {
    // Emit locally first to guarantee delivery even if runtime messaging doesn't loop back
    await emitter.emit(event, payload);
    await runtimeBroadcast(event, payload);
  }
};

// Convenience: post is the cross-context send used by content/UI
export async function post<T = any>(event: string, payload: T): Promise<void> {
  await runtimeBroadcast(event, payload);
}

// Background-only helpers (no-ops elsewhere)
export async function sendToTab<T = any>(tabId: number, event: string, payload: T): Promise<void> {
  const wire: WireMessage = { __mcpclick: true, event, payload, originId };
  try {
    if (chrome.tabs?.sendMessage) {
      await chrome.tabs.sendMessage(tabId, wire);
    }
  } catch {}
}

export async function broadcastToTabs<T = any>(event: string, payload: T): Promise<void> {
  try {
    if (chrome.tabs?.query && chrome.tabs?.sendMessage) {
      const wire: WireMessage = { __mcpclick: true, event, payload, originId };
      const tabs = await chrome.tabs.query({});
      await Promise.all(
        tabs.map((t) => (t.id != null ? chrome.tabs.sendMessage(t.id, wire).catch(() => {}) : Promise.resolve()))
      );
    }
  } catch {}
}

// Type helper for consumers to strongly type events if desired
export type TypedBus<TEvents extends Record<string, any>> = {
  on<TKey extends keyof TEvents & string>(event: TKey, handler: EventHandler<TEvents[TKey]>): () => void;
  off<TKey extends keyof TEvents & string>(event: TKey, handler: EventHandler<TEvents[TKey]>): void;
  emit<TKey extends keyof TEvents & string>(event: TKey, payload: TEvents[TKey]): Promise<void>;
};


