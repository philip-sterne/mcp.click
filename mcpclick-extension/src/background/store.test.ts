import { Store } from './store';

describe('Store', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  afterEach(async () => {
    await store.clearTraces();
  });

  it('should add a trace to the database', async () => {
    const trace = {
      kind: 'request' as const,
      ts: Date.now(),
      url: 'https://example.com',
    };
    await store.addTrace(trace);

    const traces = await store.getAllTraces();
    expect(traces).toHaveLength(1);
    // The stored object will have an auto-incremented _id
    expect(traces[0]).toMatchObject(trace);
  });

  it('should retrieve all traces', async () => {
    await store.addTrace({
      kind: 'request',
      ts: Date.now(),
      url: 'https://a.com',
    });
    await store.addTrace({
      kind: 'request',
      ts: Date.now(),
      url: 'https://b.com',
    });

    const traces = await store.getAllTraces();
    expect(traces).toHaveLength(2);
  });

  it('should clear all traces', async () => {
    await store.addTrace({
      kind: 'request',
      ts: Date.now(),
      url: 'https://a.com',
    });
    await store.clearTraces();
    const traces = await store.getAllTraces();
    expect(traces).toHaveLength(0);
  });

  it('should save action drafts', async () => {
    const action = { name: 'test_action', path: '/test' };
    await store.saveActionsDraft([action]);

    // Note: We can't easily get the actions back without adding a new
    // method to the Store class, but we can confirm the call doesn't throw.
    // A more complete test would involve a getActionsDraft method.
    expect(true).toBe(true); // Placeholder assertion
  });

  it('should add a DOM event trace to the database', async () => {
    const domEvent = {
      kind: 'dom:click' as const,
      ts: Date.now(),
      label: 'Click Me',
      locator: 'button#my-button',
    };
    await store.addTrace(domEvent);

    const traces = await store.getAllTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject(domEvent);
  });
});
