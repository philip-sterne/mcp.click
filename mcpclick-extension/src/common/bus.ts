// Tiny pub/sub across contexts via runtime messaging

type Payload = object | undefined;

type Handler = (payload: Payload) => void | Promise<void>;

const key = (k: string) => `mcpclick:${k}`;

export const bus = {
  on: (topic: string, fn: Handler) => {
    chrome.runtime.onMessage.addListener((msg, _s, send) => {
      if (msg?.topic !== key(topic)) return;
      Promise.resolve(fn(msg.payload)).then(() => send(true));
      return true;
    });
  },
  emit: (topic: string, payload?: Payload) => {
    chrome.runtime.sendMessage({ topic: key(topic), payload });
  },
};

export function post(topic: string, payload?: Payload) {
  bus.emit(topic, payload);
}
