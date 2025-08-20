const domainsEl = document.getElementById('domains') as HTMLInputElement;
const relayUrlEl = document.getElementById('relayUrl') as HTMLInputElement;
const deviceEl = document.getElementById('deviceToken') as HTMLInputElement;

document.getElementById('save')!.addEventListener('click', async () => {
  const domains = domainsEl.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  await chrome.storage.sync.set({
    domains,
    relayUrl: relayUrlEl.value,
    deviceToken: deviceEl.value,
  });
  alert('Saved');
});

(async () => {
  const cfg = await chrome.storage.sync.get({
    domains: [],
    relayUrl: '',
    deviceToken: '',
  });
  domainsEl.value = cfg.domains.join(',');
  relayUrlEl.value = cfg.relayUrl;
  deviceEl.value = cfg.deviceToken;
})();
