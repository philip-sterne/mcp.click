# MCP.click Implementation Plan

This document outlines a detailed, phased plan to implement the missing functionality in the MCP.click project. The plan is designed to be executed sequentially, with each phase building a complete, testable piece of the application.

## Phase 1: Core Data Pipeline - From Capture to Display

**Goal:** Implement the end-to-end flow of data. Capture UI and network events in the extension, correlate them, send them to the backend for storage, and display the raw, unprocessed traces in the frontend.

### Task 1.1: Correlate UI and Network Traces

**Objective:** Link DOM interactions (clicks, submits) with the network requests they trigger.

1.  **Modify `mcpclick-extension/src/background/store.ts`:**
    -   Update the `Trace` type definition to be more specific and include fields for DOM events. Create a new `Trace` interface:
        ```typescript
        interface Trace {
          _id?: number;
          kind: 'request' | 'response' | 'dom:click' | 'dom:submit';
          ts: number;
          // Network fields
          requestId?: string;
          url?: string;
          method?: string;
          status?: number;
          headers?: Record<string, string>;
          body?: unknown;
          // DOM fields
          label?: string;
          locator?: string;
          fields?: Record<string, string>;
        }
        ```
    -   Ensure all methods (`addTrace`, `getAllTraces`) use this new `Trace` type.

2.  **Modify `mcpclick-extension/src/background/index.ts`:**
    -   Add new bus listeners to handle the `dom:click` and `dom:submit` events coming from the content script.
    -   These listeners should create a `Trace` object and save it to the store.
        ```typescript
        bus.on('dom:click', async (payload) => {
          await store.addTrace({ kind: 'dom:click', ...payload });
        });

        bus.on('dom:submit', async (payload) => {
          await store.addTrace({ kind: 'dom:submit', ...payload });
        });
        ```

### Task 1.2: Backend - Database and Trace Ingestion

**Objective:** Set up a persistent database and create an endpoint to receive and store traces from the extension.

1.  **Modify `backend/requirements.txt`:**
    -   Add `sqlalchemy` and `psycopg2-binary` for PostgreSQL support.

2.  **Create `backend/database.py`:**
    -   Define the SQLAlchemy engine, `SessionLocal` factory, and `Base` declarative class for database models.

3.  **Create `backend/models.py`:**
    -   Define a `Trace` model using SQLAlchemy that mirrors the `Trace` interface in the extension (columns for `id`, `kind`, `ts`, `url`, `method`, `status`, etc.). Use `JSON` types for headers and bodies.

4.  **Modify `backend/main.py`:**
    -   Remove the `FAKE_ITEMS` and the `/items` endpoints.
    -   Create a new Pydantic model `TraceCreate` that matches the `Trace` structure.
    -   Create a new endpoint `POST /api/traces` that accepts a list of `TraceCreate` objects, creates `Trace` model instances, and saves them to the database.
    -   Create a new endpoint `GET /api/traces` that retrieves all traces from the database and returns them.

### Task 1.3: Frontend - Displaying Traces

**Objective:** Create a simple UI to display the traces stored in the backend.

1.  **Modify `frontend/src/App.tsx`:**
    -   Remove the existing state for `items` and `count`.
    -   Create a new state variable `const [traces, setTraces] = useState<Trace[]>([]);`. Define the `Trace` type to match the backend model.
    -   Modify the `useEffect` hook to fetch data from the new `GET /api/traces` endpoint and update the `traces` state.
    -   Render the traces in a simple table or list, displaying key information like `kind`, `method`, and `url`.

### Task 1.4: Connecting the Extension to the Backend

**Objective:** Add functionality to the extension to send its captured traces to the backend.

1.  **Modify `mcpclick-extension/src/ui/popup.html`:**
    -   Add a new "Upload Traces" button with `id="upload"`.

2.  **Modify `mcpclick-extension/src/ui/popup.ts`:**
    -   Add a click listener for the "upload" button.
    -   When clicked, it should emit a `traces:upload` event on the bus.

3.  **Modify `mcpclick-extension/src/background/index.ts`:**
    -   Add a bus listener for `traces:upload`.
    -   This listener should:
        1.  Get all traces from the `store` using `store.getAllTraces()`.
        2.  Make a `fetch` `POST` request to `http://localhost:8000/api/traces` with the traces as the JSON body.
        3.  Upon a successful response, clear the local traces from IndexedDB using `store.clearTraces()`.

---

## Phase 2: Action Preparation and UI

**Goal:** Move the "prepare" logic to the backend and create a UI for viewing the generated actions.

### Task 2.1: Backend - Action Preparation Logic

**Objective:** Move the logic from `prepare.ts` into the backend and create an endpoint to trigger it.

1.  **Create `backend/prepare.py`:**
    -   Translate the TypeScript logic from `mcpclick-extension/src/background/prepare.ts` and `schema.ts` into Python. This will involve grouping requests/responses, canonicalizing URLs, clustering, and inferring JSON schemas.
    -   Define a SQLAlchemy model for `Action` in `backend/models.py` to store the results.

2.  **Modify `backend/main.py`:**
    -   Create a new endpoint `POST /api/prepare` that:
        1.  Reads all traces from the database.
        2.  Runs the preparation logic from `prepare.py`.
        3.  Saves the resulting actions to the new `Action` table in the database.
    -   Create a new endpoint `GET /api/actions` to retrieve all prepared actions.

### Task 2.2: Frontend - Action Display

**Objective:** Add a new section to the UI to display the prepared actions.

1.  **Modify `frontend/src/App.tsx`:**
    -   Add state for `actions`.
    -   Add a "Prepare Actions" button that makes a `POST` request to `/api/prepare`.
    -   After the prepare request is successful, fetch the actions from `GET /api/actions` and display them in a user-friendly format, showing the action name, description, and method/path.

### Task 2.3: Extension Cleanup

**Objective:** Remove the now-redundant preparation logic from the extension.

1.  **Delete `mcpclick-extension/src/background/prepare.ts` and `schema.ts`**.
2.  **Modify `mcpclick-extension/src/background/index.ts`:**
    -   Remove the `prepare:run` bus listener and all related code.
3.  **Modify `mcpclick-extension/src/ui/popup.html` and `popup.ts`:**
    -   Remove the "Prepare" button and its corresponding event listener.

---

## Phase 3: Relay Integration and Hardening

**Goal:** Make the relay functional and secure, and integrate it with the frontend for executing actions.

### Task 3.1: Relay Server Enhancements

**Objective:** Improve the security and reliability of the relay server.

1.  **Modify `mcpclick-relay/src/server.ts`:**
    -   Implement a correlation ID system. When the server receives an HTTP request to `/call`, it should generate a unique `callId`. When it sends the `tool.call` to the extension, it should include this `callId`.
    -   When the extension sends back a `tool.result`, it must include the same `callId`.
    -   The `/call` endpoint should hold the HTTP request open and only send the response back to the original caller when the corresponding `tool.result` is received.
2.  **Modify `mcpclick-relay/src/auth.ts`:**
    -   Replace the hardcoded `DEV_TOKENS` with a more robust authentication mechanism, such as JWTs.

### Task 3.2: Frontend - Action Execution

**Objective:** Allow users to execute actions from the frontend UI.

1.  **Modify `frontend/src/App.tsx`:**
    -   For each displayed action, add an "Execute" button.
    -   When clicked, this button should open a simple form based on the action's `input_schema`.
    -   When the form is submitted, the frontend should make a `POST` request to the relay server's `/call` endpoint, sending the device token and the request details (method, URL, body) constructed from the action and the user's input.
    -   Display the result of the tool call to the user.

### Task 3.3: Add Tests for Relay

**Objective:** Add a testing framework to the relay server.

1.  **Modify `mcpclick-relay/package.json`:**
    -   Add `jest` and `ts-jest` as dev dependencies.
    -   Add a `test` script.
2.  **Create `mcpclick-relay/jest.config.js` and `tsconfig.json`** similar to the extension's setup.
3.  **Create `mcpclick-relay/src/server.test.ts`:**
    -   Write tests for the WebSocket connection logic and the `/call` endpoint, mocking the WebSocket interactions.
