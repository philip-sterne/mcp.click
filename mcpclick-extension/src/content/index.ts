import { post } from '../common/bus';
import { getLocator } from './locator';

let lastClickTs = 0;

function capturePageIdentity() {
  const title = document.title || '';
  const h1 = document.querySelector('h1')?.textContent?.trim() || '';
  post('dom:identity', { title, h1, url: location.href, ts: Date.now() });
}

window.addEventListener(
  'click',
  (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;
    lastClickTs = Date.now();
    const label =
      target.innerText?.trim() ||
      target.getAttribute('aria-label') ||
      target.getAttribute('title') ||
      '';
    const locator = getLocator(target);
    post('dom:click', { ts: lastClickTs, label, locator });
  },
  true
);

window.addEventListener(
  'submit',
  (e) => {
    const form = e.target as HTMLFormElement;
    if (!form) return;
    const pairs: Record<string, string> = {};
    const labels = new Map<string, string>();
    form
      .querySelectorAll('label[for]')
      .forEach((l) =>
        labels.set(l.getAttribute('for')!, l.textContent?.trim() || '')
      );
    new FormData(form).forEach((v, k) => {
      const id =
        (form.querySelector(`[name="${CSS.escape(k)}"]`) as HTMLElement)?.id ||
        '';
      const friendly = labels.get(id) || k;
      pairs[friendly] = String(v);
    });
    post('dom:submit', { ts: Date.now(), fields: pairs });
  },
  true
);

capturePageIdentity();
const obs = new MutationObserver(() => capturePageIdentity());
obs.observe(document.documentElement, { subtree: true, childList: true });
