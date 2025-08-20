## MCP.click – Observer Extension + Relay

### What is this?
MCP.click turns real user interactions into safe, portable tools. A Chrome MV3 extension observes network and UI events, infers candidate actions (with JSON Schemas), and can execute tool calls securely by relaying requests from a server to the user’s browser session.

This repo contains multiple dev projects:

- `mcpclick-extension/`: Chrome MV3 extension (TypeScript + Vite) supporting Observe, Prepare, and Relay modes
- `mcpclick-relay/`: Minimal Node WebSocket server to send tool calls to the extension during development
- `backend/`: FastAPI backend used by the UI (dev CORS enabled for the frontend)
- `frontend/`: React + Vite TypeScript app acting as a simple UI to interact with the backend

⸻

### Observation mode: what to capture (and how)

2.1 Network capture (for specific domains)
	•	MV3 does not directly expose response bodies via webRequest for all cases; use one or more of:
	•	chrome.debugger (DevTools Protocol) → Network.requestWillBeSent, Network.responseReceived, Network.getResponseBody.
	•	Instrument fetch/XMLHttpRequest via content script to capture initiator stack + body (works for same‑origin; cross‑origin depends on page context).
	•	Optional: local loopback HTTPS proxy for power users (PAC file). Good for thick clients, GraphQL, and service workers.
	•	Store:
	•	URL, method, status, request/response JSON bodies (bounded size, e.g., 256 KB with truncation), headers (with secret header/param allowlist).
	•	Timing (start/end), correlation IDs, service worker involvement, initiator (stack/URL).
	•	Anti‑CSRF fields (names/locations), Set‑Cookie metadata without values.

2.2 DOM & interaction capture
	•	Page identity: document.title, canonical URL, <h1>, breadcrumb text, visible app shell labels (side‑nav items).
	•	Element interactions:
	•	On click/submit: text (innerText, aria-label), role, form label/field pairs, and DOM path (stable CSS/XPath or best‑effort semantic locator).
	•	Associate interaction → subsequent network calls within Δt = 200 ms (configurable) using a per‑tab event clock.
	•	State snapshots (lightweight, optional):
	•	Before/after semantic state: selected tab, counts (“12 pending”), totals on page.
	•	Accessibility tree nodes for focused elements (names are often business‑semantic).
	•	Error/Toast capture:
	•	Listen for snackbar/toast DOM mutations; capture message text (“Timecard 123 approved”).

2.3 Redaction & summarization at the edge
	•	PII/secret detectors run in the extension:
	•	Rules: header keys (authorization, cookie, x-api-key), param names (password, otp, ssn), JWT patterns, IBAN/CC regex, email/phone patterns.
	•	Format‑preserving tokenization (FPE) so the shape is preserved but values are anonymized (same input → same token).
	•	Payload slimming:
	•	Keep JSON Schema skeleton + example(s) with placeholders.
	•	Sample & deduplicate near‑identical requests (hash over URL template + field set).
	•	Strip binary; limit arrays/objects depth with ellipses policy.

2.4 Opt‑in/consent
	•	Per‑domain toggles, pause button, and an inspect‑before‑upload screen (diff & redact).

⸻

### From raw traces to stable “actions”

Goal: turn noisy, low‑level sequences into portable, idempotent, testable tools.

3.1 Canonicalization
	•	URL templating: /api/timecards/123/approve → /api/timecards/{timecard_id}/approve.
	•	Parameter factoring: detect IDs, dates, enums; split inputs vs. constants; capture CSRF dance as pre‑step.
	•	Response typing: infer JSON Schema with examples; identify success shape vs. error shape.

3.2 Sequence mining
	•	Build sessions keyed by tab + time; segment into episodes using inactivity gaps or navigation boundaries.
	•	Mine frequent patterns with time constraints:
	•	Example: GET /timecards?status=pending → user click “Approve” → POST /timecards/{id}/approve → toast “Approved”.
	•	Use sequence clustering (e.g., k‑gram / n‑gram + Jaccard over URL templates & roles) to surface candidate workflows.

3.3 Intent labeling & action synthesis
	•	For each cluster, draft an Action Spec:
	•	name: approve_timecard
	•	preconditions: GET /csrf, GET /timecards/{id}
	•	request: POST /timecards/{id}/approve with body {note?: string}
	•	auth: bearer cookie + X‑CSRF header
	•	idempotency: re‑check status=="approved" in response; no‑op if already approved
	•	success criteria: HTTP 200 & toast contains “Approved”
	•	side effects: optional follow‑on payrun.schedule
	•	input schema & output schema (JSON Schema Draft 2020‑12)
	•	error taxonomy: validation vs. auth vs. conflict
	•	Use an LLM with the DOM cues (button label: “Approve”, title: “Pending Timecards”) to name actions and produce docs, but keep a deterministic fallback (rule‑based names) for stability.

3.4 Safety gates
	•	Replay tests (dry‑run if app supports): run action with shadow mode (header X‑MCP-Simulate: true) if available; else target a sandbox tenant or flagged entity.
	•	Validate that inputs restricted to inferred schema actually produce consistent responses across samples.

⸻

### MCP server generation (what gets published)

Each Action Spec becomes a tool in the MCP server. Example:

{
  "name": "approve_timecard",
  "description": "Approve a pending timecard by ID.",
  "input_schema": {
    "type": "object",
    "required": ["timecard_id"],
    "properties": {
      "timecard_id": { "type": "string", "pattern": "^[A-Za-z0-9\\-]+$" },
      "note": { "type": "string", "maxLength": 500 }
    },
    "additionalProperties": false
  },
  "output_schema": {
    "type": "object",
    "required": ["timecard_id", "status"],
    "properties": {
      "timecard_id": { "type": "string" },
      "status": { "type": "string", "enum": ["approved","pending","rejected"] },
      "approved_at": { "type": "string", "format": "date-time" }
    }
  },
  "auth": { "strategy": "extension_relay" },
  "pre_flight": [
    { "type": "fetch_csrf", "endpoint": "/csrf", "map_to": "headers.X-CSRF-Token" }
  ],
  "request": {
    "method": "POST",
    "path_template": "/api/timecards/{timecard_id}/approve",
    "body_template": { "note": "{{note}}" }
  },
  "post_checks": [
    { "type": "jsonpath", "path": "$.status", "equals": "approved" }
  ],
  "idempotency": {
    "check": { "method": "GET", "path_template": "/api/timecards/{timecard_id}" },
    "path": "$.status", "approved_value": "approved"
  }
}

The generator emits:
	•	MCP manifest (tools, schemas, descriptions).
	•	Execution adapters: reusable primitives (csrf_fetch, graphQL mutation, pagination).
	•	Playbooks for common patterns (login flow, list→detail→mutate).

⸻

### Authentication & transport: relay design + alternatives

5.1 Your proposal (Extension Relay via MCP.click)

Flow (summarized)
	1.	LLM → MCP.click (authenticated).
	2.	MCP.click finds the user’s online extension WS.
	3.	MCP.click forwards the tool call to the extension.
	4.	Extension injects site auth (cookies / headers / DPoP), strips MCP.click auth.
	5.	Extension performs the request to the intranet app.
	6.	Response bubbles back → MCP.click → LLM.

Pros
	•	MCP server can be hosted in the cloud (reliable, addressable).
	•	Credentials never leave the browser; extension is the authority.
	•	Works with cookie‑bound sessions and anti‑CSRF.

Cons
	•	Requires persistent WS; laptop must be awake.
	•	Adds one hop (latency).
	•	Needs robust reconnection & backpressure.

Hardening
	•	Mutual TLS between extension and MCP.click WS.
	•	Device‑bound tokens (WebAuthn/Passkeys) to bind the extension installation.
	•	DPoP or Signed HTTP Exchanges to prove the requestor (mitigate token replay).
	•	Allow policy guards in MCP.click (allowlist paths, rate limits, time windows).

5.2 Alternative A — Local MCP server inside the extension
	•	The extension exposes the MCP server locally (e.g., chrome:// or localhost bridge) and your LLM client connects directly.
	•	Pros: no relay, lowest latency, credentials never cross machine boundary.
	•	Cons: remote/cloud LLMs can’t reach your local endpoint; works best with desktop LLMs or LLMs that support local tools.

5.3 Alternative B — Reverse tunnel to user’s device
	•	The extension (or a tiny tray app) opens a zero‑trust reverse tunnel (Tailscale/Cloudflare Tunnel/Ngrok‑like) to expose the MCP server to the internet securely.
	•	Pros: remote LLMs can call the user’s private MCP.
	•	Cons: extra dependency; still requires online device.

5.4 Alternative C — Credential‑free API keys via OAuth/Token Exchange
	•	If timesheet.app supports OAuth or PATs:
	•	MCP.click stores no secrets; instead, it requests short‑lived access tokens from the extension on each call (DPoP‑bound).
	•	MCP.click then calls timesheet.app directly with that token (no WS hop).
	•	Pros: lowest latency, high reliability.
	•	Cons: only possible if the target apps support OAuth/PATs and CORS/server‑side calling.

5.5 Alternative D — Headless automation fallback
	•	When the app has no stable API (only DOM), MCP.click triggers a Playwright worker on the user’s machine (via the extension) to execute the action with UI automation.
	•	Pros: maximal compatibility.
	•	Cons: slower, brittle; use as last resort and still emit tool contracts.

⸻

### Robustness in modern SPAs
	•	CSRF & cookies: capture and replay per‑origin CSRF tokens; pre‑flight step types: “get csrf endpoint”, “parse meta tag”, “read cookie name”.
	•	GraphQL:
	•	Infer operationName, variables schema, and fields used; re‑use persisted queries when possible.
	•	Pagination & filtering:
	•	Emit reusable paginator blocks (cursor/offset); tool can iterate until a predicate is met (“find timecard by employee & week”).
	•	Idempotency:
	•	Where no server idempotency exists, implement read‑before‑write checks and retry with jitter.
	•	Versioning:
	•	Version tool contracts; keep multiple compatible paths when the app A/B tests endpoints.

⸻

### Privacy, security, and compliance
	•	On‑device redaction first; raw secrets never leave the browser.
	•	Allowlist capture (default deny), per‑domain toggles, kill switch, and “private tabs” mode.
	•	Encryption:
	•	Extension ↔ MCP.click WS: mTLS + pinned cert + rotating session keys.
	•	At rest: envelope encryption with per‑user DEKs (KMS).
	•	User review gates:
	•	Before “Publish”, the user sees: actions, URLs, sample payload shapes with tokens, not raw data.
	•	Org controls:
	•	Admin‑managed domain allowlist, policy on tool exposure (internal only), audit logs of every MCP call.
	•	Legal/ToS:
	•	Many apps disallow automation. Provide a policy scanner:
	•	Detect robots/terms endpoints, rate limits, “automation prohibited” text.
	•	Surface a risk indicator and require explicit user acknowledgement.
	•	DP/PIA:
	•	Maintain a DPIA template; expose data categories & storage durations.
	•	Offer data‑retention slider (e.g., keep last 30 days of traces).

⸻

### Brainstorm: more intent signals to capture (ethically)
	•	Accessibility tree roles & names (often human‑meaningful).
	•	Breadcrumbs & tabs text (“Payroll › Pending approvals”).
	•	URL semantics (query params like status=pending&week=2025‑W33).
	•	Microdata/Schema.org/ARIA attributes.
	•	Client‑side events (Redux/NgRx action names in dev builds; some apps leak action types into window.__INITIAL_STATE__).
	•	Toast/snackbar text, dialog titles, validation error strings.
	•	Download filenames (“timecards_2025‑08‑07.csv”).
	•	Feature flags in headers or JS (X‑Env: prod), which explain variant behavior.
	•	Timing signatures (e.g., approve → toast within 300–700 ms vs. schedule payrun 2–4 s).
	•	Diffs of small JSON state blobs exposed on the page (some apps keep a model in data-* attributes).
	•	User annotations: let the user mark a flow as “This is Approve Timecard” once; it seeds the cluster label.

⸻

### Developer ergonomics & review loop
	•	Action Review UI:
	•	For each candidate action: show minimal sequence diagram, before/after DOM cues, request templates, input/output schemas, and test results.
	•	One‑click rename, tweak schemas, and add guards (“must have status=pending”).
	•	Action Unit Tests:
	•	Generated test harness that the extension can run against a draft MCP server in “dry mode”.
	•	Observability:
	•	Every tool call gets a short provenance trail (which template, which pre‑steps, sanitized samples used).
	•	Safety rails for LLMs:
	•	Require dry‑run first for mutating actions unless the tool call provides an explicit confirm: true.
	•	Cost budget and rate limits per tool.

⸻

### Staged build plan (practical)

Milestone 0 – Spike (~1–2 weeks)
	•	MV3 extension prototype:
	•	Domain allowlist; hook DevTools Protocol to grab JSON bodies.
	•	Capture button click text + map network calls within 200 ms.
	•	Local redaction (header strip + FPE).
	•	CLI script to canonicalize URL templates and emit naive schemas.

Milestone 1 – Minimal action inference (~2–3 weeks)
	•	Sequence grouping per tab → episode → n‑gram clustering.
	•	Generate 2–3 actions on a demo app (e.g., timecard list → approve).
	•	Generate a local MCP server (Alternative A) for proof‑of‑concept.

Milestone 2 – Relay + hosted MCP (~3–4 weeks)
	•	WS relay with device binding + resume.
	•	Hosted MCP facade that forwards to extension.
	•	Add csrf pre‑flight adapters; implement idempotency checks.

Milestone 3 – Review UI & test harness (~3 weeks)
	•	Web UI to approve/rename actions; shadow‑run tests via extension.
	•	Policy scanner (ToS hints), admin org controls.

Milestone 4 – Robustness & breadth (~ongoing)
	•	GraphQL adapter, pagination helpers, error taxonomy, retries.
	•	Optional Playwright fallback for purely DOM‑driven flows.

⸻

### Example: inferred tools for your timesheet/payrun story
	1.	list_pending_timecards({ employee?: string, week?: string }) -> { items: [...] }
	2.	approve_timecard({ timecard_id, note? }) -> { timecard_id, status: "approved" }
	3.	schedule_payrun({ run_date, include_approved_since? }) -> { run_id, status }
	4.	get_timecard({ timecard_id })
	5.	find_timecard({ employee, week }) -> { timecard_id }

Each tool includes:
	•	Auth strategy: extension_relay
	•	Pre‑flights: fetch CSRF, or refresh session when 401.
	•	Guards: verify status=="pending" before approve; else return “Already approved”.

⸻

### Trade‑offs & when to pick which auth topology
	•	If the LLM runs locally (dev assistants, offline): Local MCP in extension is cleanest.
	•	If you need cloud LLMs and the app is cookie‑only: your WS relay is the most universal.
	•	If the target supports OAuth/PATs: token exchange lets MCP.click call the app directly (fast & reliable).
	•	If there is no API or it’s obfuscated: gate the action behind manual confirmation and use Playwright fallback.

⸻

### Known pitfalls and mitigations

---

### Repo layout

```
mcp.click/
    README.md
    backend/
        main.py
        requirements.txt
        uvicorn.sh
    frontend/
        package.json
        vite.config.ts
        src/
            App.tsx
            main.tsx
    mcpclick-extension/
        package.json
        tsconfig.json
        vite.config.ts
        manifest.json
        public/
            icon-*.png
        src/
            background/
                index.ts
                debugger.ts
                relay.ts
                prepare.ts
                redact.ts
                store.ts
                schema.ts
            content/
                index.ts
                locator.ts
            ui/
                popup.html
                popup.ts
                options.html
                options.ts
            common/
                bus.ts
                util.ts
    mcpclick-relay/
        package.json
        tsconfig.json
        src/
            auth.ts
            server.ts
```

---

### Quick start

- Prereqs: Node 18+, Chrome 121+, Python 3.11+
- Extension:
    1. `cd mcpclick-extension`
    2. `npm i`
    3. `npx vite`
    4. Chrome → `chrome://extensions` → Developer Mode → Load Unpacked → select `mcpclick-extension/dist/`
- Relay:
    1. `cd mcpclick-relay`
    2. `npm i`
    3. `npx tsx src/server.ts` (listens on :8787)
- Backend (FastAPI):
    1. `cd backend`
    2. `python3 -m venv .venv && source .venv/bin/activate`
    3. `pip install -r requirements.txt`
    4. `./uvicorn.sh` (listens on :8000)
- Frontend (React + Vite):
    1. `cd frontend`
    2. `npm i`
    3. `npm run dev` (opens on :5173)
    - Dev proxy is configured so `/api/*` → `http://localhost:8000/*`

End-to-end test:
1. Options: set `Domains`=`httpbin.org`, `Relay URL`=`ws://localhost:8787/ws`, `Device token`=`dev-device`.
2. Popup → Connect Relay.
3. Inject a call from another shell:
    ```bash
    curl -X POST http://localhost:8787/call \
      -H 'content-type: application/json' \
      -d '{
        "device": "dev-device",
        "request": { "method": "GET", "url": "https://httpbin.org/json", "headers": {}, "body": null }
      }'
    ```
4. Observe `tool.result` logs in the relay.

---

### Frontend ↔ Backend sanity check

- With backend on :8000 and frontend on :5173, visit `http://localhost:5173`.
- The home page shows:
  - Backend health from `GET /api/health` → { "status": "ok" }
  - List of items from `GET /api/items`.

You can also test the API directly:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/items
curl -X POST http://localhost:8000/items -H 'content-type: application/json' -d '{"id":3,"name":"Baz"}'
```

---

### Detailed next steps plan

#### Milestone A — MVP hardening (capture + prepare)
- [ ] Stabilize per-tab attach/detach in `src/background/debugger.ts`.
  - [ ] Re-attach on navigation; detach on tab close; handle errors/idempotency.
  - [ ] Consider `Target.setAutoAttach` for sub-targets (service workers) when available.
- [ ] Correlate UI events with network within a 200ms window.
  - [ ] Buffer `dom:click`/`dom:submit` and tag nearby `requestWillBeSent`.
  - [ ] Include `tabId` and `frameId` on traces.
- [ ] Storage hygiene & quotas.
  - [ ] Cap body size and trace count; purge on Stop.
  - [ ] IDB schema v2 plan for action review data.
- [ ] Redaction polish.
  - [ ] Header/value allowlists per domain (Options UI).
  - [ ] Unit tests to assert no emails/tokens persist in stored traces.

Exit criteria:
- Prepare yields ≥1 action with non-empty I/O schema on a demo site; no secrets in IDB spot checks.

#### Milestone B — Action inference v1
- [ ] URL templating improvements (UUID/ULID/slug → `{id}`, timestamp → `{ts}`).
- [ ] Schema inference: merge arrays by union, mark required fields consistently present, cap depth/examples.
- [ ] Sequence clustering: episodes by tab/time; n-gram clustering across (method, template).

Exit criteria:
- 2–3 stable actions inferred on a CRUD demo with consistent schemas.

#### Milestone C — Relay robustness & CSRF
- [ ] Heartbeats/backoff: add jitter and capped exponential backoff; support resumable session metadata.
- [ ] CSRF preflights in `src/background/relay.ts`.
  - [ ] Meta tag extraction, well-known `/csrf` endpoint fetch.
  - [ ] Per-domain strategy in Options; fallbacks disabled by default.
- [ ] Path allowlist/rate limits for safety.

Exit criteria:
- `POST` actions succeed on a CSRF-protected site with configured preflights.

#### Milestone D — Action Review UI
- [ ] New review page listing draft actions from IDB.
  - [ ] Rename action, tweak schemas, save.
  - [ ] Shadow-run with `confirm=false`; display result and guard checks.

Exit criteria:
- Reviewer can rename and successfully shadow-run an action.

#### Milestone E — Safety & policy
- [ ] Policy scanner (robots/terms endpoints + keywords) and consent UX.
- [ ] Org policy defaults: body size caps, array caps, domain allowlist.

Exit criteria:
- Publishing blocked without consent when risks detected; caps enforced.

#### Milestone F — Publishing & MCP manifest
- [ ] Export MCP manifest from `prepare.ts` (tools, schemas, preflights).
- [ ] Optional: generate unit tests for tools and a sample MCP server stub.

Exit criteria:
- Manifest imports into an MCP server and is executable via the relay.

---

### Troubleshooting
- No network traces: ensure domain allowlist is set and page reloaded; some tabs cannot be attached.
- No `tool.call`: verify `hello:ack`/`pong` in relay logs; check device token and WS URL.
- CORS/CSRF: final fetch runs in the extension (credentials included); add CSRF preflights as needed.

---

### Architecture (condensed)
- Extension captures network/DOM, redacts locally, stores to IDB, and synthesizes draft actions.
- Relay brokers tool calls to the browser, where requests run with real site credentials.
- Future MCP server consumes exported manifests; alternative auth topologies are possible.
	•	MV3 capture limits: DevTools Protocol requires a tab attach; ensure per‑tab lifecycle management; ask user to keep the extension’s “Observe” panel open (or run a service worker that attaches on focus).
	•	Service worker fetches: some apps fetch in workers; capture via DevTools Target.attachToTarget.
	•	CORS when cloud‑calling: with relay design (extension performs the final call), you bypass CORS.
	•	Schema drift: emit validators that fail fast; version actions; ship per‑action re‑learn button that re‑observes and patches the contract.
	•	Sensitive data leakage: use unit tests that assert redaction (no emails, no tokens) and block publishing if leaks detected.
