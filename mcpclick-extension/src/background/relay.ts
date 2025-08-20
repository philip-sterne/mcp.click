import { Store } from './store';

import { Store } from './store';
import { DebuggerCapture } from './debugger';

export class Relay {
  private ws: WebSocket | null = null;
  private backoff = 1000;
  private timer: number | undefined;
  constructor(
    private url: string,
    private deviceToken: string,
    private capture: DebuggerCapture,
    private store: Store
  ) {}

  async connect() {
    this.ws = new WebSocket(
      `${this.url}?device=${encodeURIComponent(this.deviceToken)}`
    );
    this.ws.onopen = () => {
      this.backoff = 1000;
      this.send({ type: 'hello', device: this.deviceToken, version: '0.1' });
    };
    this.ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'tool.call') {
        const result = await this.executeTool(msg);
        this.send({ type: 'tool.result', callId: msg.callId, result });
      }
    };
    this.ws.onclose = () => this.reconnect();
    this.ws.onerror = () => this.reconnect();
    this.timer = setInterval(
      () => this.send({ type: 'ping', ts: Date.now() }),
      15000
    );
  }

  async disconnect() {
    clearInterval(this.timer);
    this.ws?.close();
    this.ws = null;
  }

  private reconnect() {
    if (this.ws) return;
    setTimeout(() => this.connect(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, 30000);
  }

  private send(obj: object) {
    this.ws?.send(JSON.stringify(obj));
  }

  private async executeTool(msg: {
    request: {
      method: string;
      url: string;
      headers: Record<string, string>;
      body: object;
    };
  }) {
    const { method, url, headers, body } = msg.request;
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // ignore
    }
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body: parsed,
    };
  }
}
