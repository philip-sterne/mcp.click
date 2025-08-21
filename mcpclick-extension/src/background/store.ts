import { openDB, IDBPDatabase, DBSchema } from 'idb';

export interface Trace {
  _id?: number;
  kind: 'request' | 'response' | 'dom:click' | 'dom:submit';
  ts: number;
  // Network fields
  requestId?: string;
  url?: string;
  method?: string;
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
  // DOM fields
  label?: string;
  locator?: string;
  fields?: Record<string, string>;
}

interface MCPDBSchema extends DBSchema {
  traces: {
    key: number;
    value: Trace;
  };
  actions: {
    key: string;
    value: object;
  };
}

export class Store {
  private dbp: Promise<IDBPDatabase<MCPDBSchema>>;

  constructor() {
    this.dbp = openDB<MCPDBSchema>('mcpclick', 1, {
      upgrade(db) {
        db.createObjectStore('traces', { keyPath: '_id', autoIncrement: true });
        db.createObjectStore('actions', { keyPath: 'name' });
      },
    });
  }

  async addTrace(t: Trace) {
    const { logTraces } = await chrome.storage.sync.get({ logTraces: false });
    if (logTraces) {
      console.log('Trace added:', t);
    }
    const db = await this.dbp;
    await db.add('traces', t);
  }

  async getAllTraces(): Promise<Trace[]> {
    const db = await this.dbp;
    return await db.getAll('traces');
  }

  async clearTraces() {
    const db = await this.dbp;
    await db.clear('traces');
  }

  async saveActionsDraft(actions: object[]) {
    const db = await this.dbp;
    const tx = db.transaction('actions', 'readwrite');
    for (const a of actions) await tx.store.put(a);
    await tx.done;
  }
}
