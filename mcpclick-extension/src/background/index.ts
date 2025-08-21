import { DebuggerCapture } from './debugger';
import { Relay } from './relay';
import { Store } from './store';
import { prepareActions } from './prepare';
import { bus } from '../common/bus';

const capture = new DebuggerCapture();
const store = new Store();
let relay: Relay | null = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('MCP.click extension installed');
});

bus.on('observe:start', async ({ domains }) => {
  await capture.start(domains);
  chrome.notifications.create({
    type: 'basic',
    title: 'MCP.click',
    message: `Observation started for: ${domains.join(', ')}`,
    iconUrl: 'icon-48.png',
  });
});

bus.on('observe:stop', async () => {
  await capture.stop();
});

bus.on('dom:click', async (payload) => {
  await store.addTrace({ kind: 'dom:click', ...(payload as object) });
});

bus.on('dom:submit', async (payload) => {
  await store.addTrace({ kind: 'dom:submit', ...(payload as object) });
});

bus.on('prepare:run', async () => {
  const traces = await store.getAllTraces();
  const actions = await prepareActions(traces);
  await store.saveActionsDraft(actions);
  bus.emit('prepare:done', { count: actions.length });
});

bus.on('traces:upload', async () => {
  const traces = await store.getAllTraces();
  if (traces.length === 0) {
    return;
  }
  try {
    const res = await fetch('http://localhost:8000/api/traces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(traces),
    });
    if (res.ok) {
      await store.clearTraces();
      console.log('Traces uploaded and cleared');
    } else {
      console.error('Failed to upload traces:', res.statusText);
    }
  } catch (e) {
    console.error('Error uploading traces:', e);
  }
});

bus.on('relay:connect', async ({ url, deviceToken }) => {
  relay = new Relay(url, deviceToken, capture, store);
  await relay.connect();
});

bus.on('relay:disconnect', async () => {
  await relay?.disconnect();
  relay = null;
});
