// src/App.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

// Mock the global fetch function
global.fetch = vi.fn((url) =>
  Promise.resolve({
    json: () => {
      if (url === '/api/health') {
        return Promise.resolve({ status: 'ok' });
      }
      if (url === '/api/items') {
        return Promise.resolve([{ id: 1, name: 'Test Item' }]);
      }
      return Promise.resolve({});
    },
  })
) as vi.Mock;

describe('App', () => {
  it('renders the main heading and fetches data', async () => {
    render(<App />);

    // The heading is there immediately
    const heading = screen.getByRole('heading', { name: /MCP.click/i });
    expect(heading).toBeInTheDocument();

    // Now, wait for the async data to appear
    const healthStatus = await screen.findByText(/Backend Health: ok/i);
    expect(healthStatus).toBeInTheDocument();

    const item = await screen.findByText(/Test Item/i);
    expect(item).toBeInTheDocument();
  });
});
