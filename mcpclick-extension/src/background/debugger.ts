import { redact } from "./redact";
import { Store } from "./store";

export class DebuggerCapture {
  private attachedTabs = new Set<number>();
  private domains: string[] = [];
  private store = new Store();

  async start(domains: string[]) {
    this.domains = domains;
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) this.attachToTab(tab.id);
    }
    chrome.tabs.onUpdated.addListener((tabId, info) => {
      if (info.status === "loading") this.attachToTab(tabId);
    });
  }

  async stop() {
    for (const tabId of this.attachedTabs) {
      try { await chrome.debugger.detach({ tabId }); } catch {}
    }
    this.attachedTabs.clear();
  }

  private async attachToTab(tabId: number) {
    if (this.attachedTabs.has(tabId)) return;
    try {
      await chrome.debugger.attach({ tabId }, "1.3");
      this.attachedTabs.add(tabId);
      await chrome.debugger.sendCommand({ tabId }, "Network.enable", { includeTextSearchMetadata: true });

      chrome.debugger.onEvent.addListener(async (source, method, params) => {
        if (source.tabId !== tabId) return;
        if (method === "Network.requestWillBeSent") {
          const url = (params as any).request?.url || "";
          if (!this.domains.some(d => url.includes(d))) return;
          const entry: any = {
            kind: "request",
            requestId: (params as any).requestId,
            ts: Date.now(),
            url,
            method: (params as any).request?.method,
            headers: redact.headers((params as any).request?.headers || {}),
          };
          this.store.addTrace(entry);
        }
        if (method === "Network.responseReceived") {
          const p = params as any;
          const url = p.response?.url || "";
          if (!this.domains.some(d => url.includes(d))) return;
          try {
            const body = await chrome.debugger.sendCommand({ tabId }, "Network.getResponseBody", { requestId: p.requestId });
            const entry: any = {
              kind: "response",
              requestId: p.requestId,
              ts: Date.now(),
              url,
              status: p.response?.status,
              headers: redact.headers(p.response?.headers || {}),
              body: redact.body(body?.body, p.response?.mimeType)
            };
            this.store.addTrace(entry);
          } catch (e) {
            // Some bodies (e.g., large/binary) may not be retrievable
          }
        }
      });
    } catch (e) {
      // Tab might be restricted or already detached
    }
  }
}


