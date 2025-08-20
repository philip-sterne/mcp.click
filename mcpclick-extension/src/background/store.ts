import { openDB, IDBPDatabase } from "idb";

type Trace = any;

type DBSchema = {
  traces: Trace;
  actions: any;
};

export class Store {
  private dbp: Promise<IDBPDatabase<any>>;

  constructor() {
    this.dbp = openDB("mcpclick", 1, {
      upgrade(db) {
        db.createObjectStore("traces", { keyPath: "_id", autoIncrement: true });
        db.createObjectStore("actions", { keyPath: "name" });
      }
    });
  }

  async addTrace(t: Trace) {
    const db = await this.dbp; await db.add("traces", t);
  }

  async getAllTraces(): Promise<Trace[]> {
    const db = await this.dbp; return await db.getAll("traces");
  }

  async clearTraces() { const db = await this.dbp; await db.clear("traces"); }

  async saveActionsDraft(actions: any[]) {
    const db = await this.dbp;
    const tx = db.transaction("actions", "readwrite");
    for (const a of actions) await tx.store.put(a);
    await tx.done;
  }
}


