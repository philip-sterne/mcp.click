.PHONY: install test test-extension test-frontend test-backend test-relay

install:
	@echo "Installing dependencies for all packages..."
	@cd mcpclick-extension && npm install
	@cd mcpclick-relay && npm install
	@cd frontend && npm install
	@cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

test: test-extension test-frontend test-backend
	@echo "All tests passed!"

test-extension:
	@echo "Running extension tests..."
	@cd mcpclick-extension && npm run test

test-frontend:
	@echo "Running frontend tests..."
	@cd frontend && npm run test

test-backend:
	@echo "Running backend tests..."
	@cd backend && . .venv/bin/activate && pytest

test-relay:
	@echo "No tests configured for relay server."
