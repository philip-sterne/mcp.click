import { DebuggerCapture } from "./debugger";
import { Relay } from "./relay";
import { Store } from "./store";
import { prepareActions } from "./prepare";
import { bus } from "../common/bus";

const capture = new DebuggerCapture();
const store = new Store();
let relay: Relay | null = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log("MCP.click extension installed");
});

bus.on("observe:start", async ({ domains }) => {
  await capture.start(domains);
  chrome.notifications.create({
    type: "basic",
    title: "MCP.click",
    message: `Observation started for: ${domains.join(", ")}`,
    iconUrl: "public/icon-48.png"
  });
});

bus.on("observe:stop", async () => {
  await capture.stop();
});

bus.on("prepare:run", async () => {
  const traces = await store.getAllTraces();
  const actions = await prepareActions(traces);
  await store.saveActionsDraft(actions);
  bus.emit("prepare:done", { count: actions.length });
});

bus.on("relay:connect", async ({ url, deviceToken }) => {
  relay = new Relay(url, deviceToken, capture, store);
  await relay.connect();
});

bus.on("relay:disconnect", async () => {
  await relay?.disconnect();
  relay = null;
});


