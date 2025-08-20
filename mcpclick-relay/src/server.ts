import http from 'node:http';
import { WebSocketServer } from 'ws';
import { v4 as uuid } from 'uuid';
import { verifyDeviceToken } from './auth.js';

// Basic HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

// Online devices by token
const devices = new Map<string, Set<WebSocket>>();

function send(ws: WebSocket, msg: any) {
  ws.send(JSON.stringify(msg));
}

wss.on('connection', (ws, request) => {
  const url = new URL(request.url || 'http://x');
  const token = url.searchParams.get('device') || undefined;
  if (!verifyDeviceToken(token)) {
    send(ws as any, { type: 'error', error: 'unauthorized' });
    ws.close();
    return;
  }

  const peers = devices.get(token!) || new Set<WebSocket>();
  peers.add(ws as any);
  devices.set(token!, peers);

  ws.on('message', (data) => {
    let msg: any;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    if (msg.type === 'hello') {
      send(ws as any, { type: 'hello:ack', serverTime: Date.now() });
    } else if (msg.type === 'ping') {
      send(ws as any, { type: 'pong', ts: msg.ts });
    } else if (msg.type === 'tool.result') {
      // In a real deployment, route back to the originator via correlation ID.
      // For the dev loop we just log.
      console.log('tool.result', msg.callId, msg.result?.status);
    }
  });

  ws.on('close', () => {
    peers.delete(ws as any);
    if (peers.size === 0) devices.delete(token!);
  });
});

server.on('upgrade', (req, socket, head) => {
  if (!req.url?.startsWith('/ws')) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

const PORT = Number(process.env.PORT || 8787);
server.listen(PORT, () => console.log(`relay listening on :${PORT}`));

// Simple HTTP endpoint to inject a test tool call to a device
server.on('request', (req, res) => {
  if (req.method === 'POST' && req.url?.startsWith('/call')) {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const json = JSON.parse(body || '{}');
      const { device, request } = json;
      const callId = uuid();
      const msg = { type: 'tool.call', callId, request };
      const peers = devices.get(device);
      if (!peers || peers.size === 0) {
        res.writeHead(404);
        res.end('device offline');
        return;
      }
      for (const ws of peers) send(ws as any, msg);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ callId }));
    });
  }
});
