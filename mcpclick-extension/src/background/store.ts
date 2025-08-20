import { openDB, IDBPDatabase, DBSchema } from 'idb';

interface MCPDBSchema extends DBSchema {
  traces: {
    key: number;
    value: object;
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

  async addTrace(t: object) {
    const { logTraces } = await chrome.storage.sync.get({ logTraces: false });
    if (logTraces) {
      console.log('Trace added:', t);
    }
    const db = await this.dbp;
    await db.add('traces', t);
  }

  async getAllTraces(): Promise<object[]> {
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
