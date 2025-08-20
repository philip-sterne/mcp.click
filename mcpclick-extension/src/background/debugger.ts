import { redact } from './redact';
import { Store } from './store';

export class DebuggerCapture {
  private attachedTabs = new Set<number>();
  private domains: string[] = [];
  private store = new Store();

  // Single, shared event listener
  private onDebuggerEvent = async (
    source: chrome.debugger.Debuggee,
    method: string,
    params?: object
  ) => {
    const tabId = source.tabId;
    if (!tabId || !this.attachedTabs.has(tabId)) {
      return;
    }

    if (method === 'Network.requestWillBeSent') {
      const url = (params as { request: { url: string } }).request?.url || '';
      if (!this.domains.some((d) => url.includes(d))) return;
      const entry = {
        kind: 'request',
        requestId: (params as { requestId: string }).requestId,
        ts: Date.now(),
        url,
        method: (params as { request: { method: string } }).request?.method,
        headers: redact.headers(
          (params as { request: { headers: object } }).request?.headers || {}
        ),
      };
      this.store.addTrace(entry);
    }
    if (method === 'Network.responseReceived') {
      const p = params as {
        response: { url: string; status: number; headers: object };
        requestId: string;
      };
      const url = p.response?.url || '';
      if (!this.domains.some((d) => url.includes(d))) return;
      try {
        const body = await chrome.debugger.sendCommand(
          { tabId },
          'Network.getResponseBody',
          { requestId: p.requestId }
        );
        const entry = {
          kind: 'response',
          requestId: p.requestId,
          ts: Date.now(),
          url,
          status: p.response?.status,
          headers: redact.headers(p.response?.headers || {}),
          body: redact.body(
            (body as { body: string })?.body,
            (p.response as { mimeType: string })?.mimeType
          ),
        };
        this.store.addTrace(entry);
      } catch {
        // Some bodies (e.g., large/binary) may not be retrievable
      }
    }
  };

  // Named listener function so it can be added and removed
  private onTabUpdated = (
    tabId: number,
    info: chrome.tabs.UpdateChangeInfo
  ) => {
    if (info.status === 'loading') this.attachToTab(tabId);
  };

  async start(domains: string[]) {
    await this.stop(); // Ensure everything is clean before starting

    this.domains = domains;
    chrome.debugger.onEvent.addListener(this.onDebuggerEvent);
    chrome.tabs.onUpdated.addListener(this.onTabUpdated);

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) this.attachToTab(tab.id);
    }
  }

  async stop() {
    chrome.debugger.onEvent.removeListener(this.onDebuggerEvent);
    chrome.tabs.onUpdated.removeListener(this.onTabUpdated);

    const detachPromises = Array.from(this.attachedTabs).map((tabId) =>
      chrome.debugger.detach({ tabId }).catch(() => {})
    );
    await Promise.all(detachPromises);

    this.attachedTabs.clear();
  }

  private async attachToTab(tabId: number) {
    if (this.attachedTabs.has(tabId)) return;

    const tab = await chrome.tabs.get(tabId);
    if (!tab.url?.startsWith('http')) {
      return;
    }

    try {
      await chrome.debugger.attach({ tabId }, '1.3');
      this.attachedTabs.add(tabId);
      await chrome.debugger.sendCommand({ tabId }, 'Network.enable', {});
    } catch (e) {
      console.error(`Failed to attach debugger to tab ${tabId}:`, e);
    }
  }
}
