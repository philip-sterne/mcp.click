import { bus } from "../common/bus";

document.getElementById("start")!.addEventListener("click", async () => {
  const { domains } = await chrome.storage.sync.get({ domains: [] as string[] });
  bus.emit("observe:start", { domains });
});

document.getElementById("stop")!.addEventListener("click", () => bus.emit("observe:stop"));

document.getElementById("prepare")!.addEventListener("click", () => bus.emit("prepare:run"));

document.getElementById("connect")!.addEventListener("click", async () => {
  const { relayUrl, deviceToken } = await chrome.storage.sync.get({ relayUrl: "wss://relay.mcpclick.dev/ws", deviceToken: "dev-device" });
  bus.emit("relay:connect", { url: relayUrl, deviceToken });
});


