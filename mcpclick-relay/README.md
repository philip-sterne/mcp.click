# MCP.click Relay (dev)

## Run

pnpm i
pnpm dev # listens on :8787

## Test loop

1. In the extension Options, set relay URL to `ws://localhost:8787/ws` and device token to `dev-device`.
2. Click **Connect Relay** in the popup.
3. From another shell, send a test call:

   curl -X POST http://localhost:8787/call \
    -H 'content-type: application/json' \
    -d '{
   "device": "dev-device",
   "request": {
   "method": "GET",
   "url": "https://httpbin.org/json",
   "headers": {},
   "body": null
   }
   }'

4. Observe `tool.result` in relay logs.
