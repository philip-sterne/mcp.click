# GEMINI Code Companion Guide for MCP.click

This document provides a guide for developers working on the MCP.click project. It includes an overview of the project, setup instructions, and best practices for development.

## 1. Project Overview

MCP.click is a tool that turns real user interactions into safe, portable tools. It consists of a Chrome extension that observes network and UI events, infers candidate actions, and can execute tool calls securely by relaying requests from a server to the user’s browser session.

The project is divided into four main components:

-   **`mcpclick-extension/`**: A Chrome MV3 extension built with TypeScript and Vite. It has three modes: Observe, Prepare, and Relay.
-   **`mcpclick-relay/`**: A minimal Node.js WebSocket server that sends tool calls to the extension during development.
-   **`backend/`**: A FastAPI backend used by the UI.
-   **`frontend/`**: A React and Vite TypeScript application that provides a user interface to interact with the backend.

## 2. Getting Started

To get started with the project, you need to have Node.js (v18+), Chrome (v121+), and Python (v3.11+) installed.

### Setup and Running

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd mcp.click
    ```

2.  **Install dependencies for all packages:**
    ```bash
    make install
    ```

3.  **Run each component in a separate terminal:**
    ```bash
    # Run the extension in development mode
    cd mcpclick-extension && npm run dev

    # Run the relay server
    cd mcpclick-relay && npm run dev

    # Run the backend server
    cd backend && ./uvicorn.sh

    # Run the frontend application
    cd frontend && npm run dev
    ```

4.  **Load the extension in Chrome:**
    -   Open Chrome and navigate to `chrome://extensions`.
    -   Enable "Developer mode".
    -   Click "Load unpacked" and select the `mcpclick-extension/dist` directory.

## 3. Testing

The project includes a comprehensive test suite. To run all tests for the frontend, backend, and extension, use the following command from the root directory:

```bash
make test
```

## 4. Development Best Practices

### General

-   **Branching and Committing**: A consistent Git workflow is important for collaboration. Consider using the following workflow:
    -   **`main` branch**: This branch should always be stable and deployable.
    -   **Feature branches**: Create a new branch for each new feature or bug fix. For example, `feature/add-new-feature` or `fix/fix-a-bug`.
    -   **Pull requests**: When a feature is complete, create a pull request to merge the feature branch into the `main` branch. This allows for code review and discussion before merging.
    -   **Commit messages**: Write clear and concise commit messages. A good commit message should explain what the commit does and why.

### `mcpclick-extension`

-   **Linting**: ESLint is configured to enforce a consistent code style. Run `npm run lint` to check for issues.
-   **Testing**: Jest is set up for testing the background scripts. Run `npm run test` to execute the test suite. This helps ensure that the extension is working as expected and prevents regressions.
-   **Modularity**: The `background/index.ts` file is becoming a central hub for all events. Consider breaking it down into smaller, more focused modules to improve maintainability.

### `mcpclick-relay`

-   **Linting**: ESLint is configured to enforce a consistent code style. Run `npm run lint` to check for issues.
-   **Testing**: Add a testing framework to test the WebSocket server. This will help ensure that the relay is working as expected and prevent regressions.
-   **Authentication**: The current device token verification is a good start, but it could be made more robust. Consider using a more secure method for authentication, such as JWTs or OAuth.
-   **Message Routing**: The current implementation broadcasts tool results to all connected peers. In a real-world scenario, you would want to route messages back to the originator using a correlation ID.

### `frontend`

-   **State Management**: As the application grows, consider using a state management library like [Redux](https://redux.js.org/) or [Zustand](https://github.com/pmndrs/zustand) to manage the application state.
-   **Testing**: The application is tested with [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/). Run `npm run test` to execute the tests.

### `backend`

-   **Database**: The current implementation uses an in-memory list to store data. This is fine for development, but for a production application, you should use a database like [SQLite](https://www.sqlite.org/index.html) or [PostgreSQL](https://www.postgresql.org/) to persist data.
-   **Authentication**: The API is currently unauthenticated. For a production application, you should add authentication to the API endpoints to protect them from unauthorized access.

## 5. Project Structure

```
mcp.click/
├── Makefile
├── README.md
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── uvicorn.sh
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       └── main.tsx
├── mcpclick-extension/
│   ├── jest.config.js
│   ├── jest.setup.js
│   ├── package.json
│   ├── manifest.json
│   └── src/
│       ├── background/
│       ├── content/
│       └── ui/
└── mcpclick-relay/
    ├── package.json
    └── src/
        └── server.ts
```
