import { useEffect, useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';

type Item = { id: number; name: string };

function App() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [health, setHealth] = useState<string>('...');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth(d.status))
      .catch(() => setHealth('error'));
    fetch('/api/items')
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>MCP.click</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <div className="card">
        <h2>Backend Health: {health}</h2>
        <h3>Items</h3>
        <ul>
          {items.map((i) => (
            <li key={i.id}>
              {i.id}: {i.name}
            </li>
          ))}
        </ul>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
