import { bus } from '../common/bus';

const domainInput = document.getElementById('domain') as HTMLInputElement;
const logTracesCheckbox = document.getElementById(
  'log-traces'
) as HTMLInputElement;

// Load saved settings when the popup opens
chrome.storage.sync.get(
  { domains: [] as string[], logTraces: false },
  ({ domains, logTraces }) => {
    if (domains.length > 0) {
      domainInput.value = domains[0];
    }
    logTracesCheckbox.checked = logTraces;
  }
);

// Save the logging preference when the checkbox is changed
logTracesCheckbox.addEventListener('change', () => {
  chrome.storage.sync.set({ logTraces: logTracesCheckbox.checked });
});

document.getElementById('start')!.addEventListener('click', async () => {
  const domain = domainInput.value;
  if (!domain) {
    // Optional: Show an error to the user
    console.error('Domain is required');
    return;
  }
  const domains = [domain];
  await chrome.storage.sync.set({ domains });
  bus.emit('observe:start', { domains });
});

document
  .getElementById('stop')!
  .addEventListener('click', () => bus.emit('observe:stop'));

document
  .getElementById('prepare')!
  .addEventListener('click', () => bus.emit('prepare:run'));

document
  .getElementById('upload')!
  .addEventListener('click', () => bus.emit('traces:upload'));

document.getElementById('connect')!.addEventListener('click', async () => {
  const { relayUrl, deviceToken } = await chrome.storage.sync.get({
    relayUrl: 'wss://relay.mcpclick.dev/ws',
    deviceToken: 'dev-device',
  });
  bus.emit('relay:connect', { url: relayUrl, deviceToken });
});
