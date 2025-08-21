import { useEffect, useState } from 'react';
import './App.css';

interface Trace {
  id: number;
  kind: string;
  ts: number;
  url?: string;
  method?: string;
  status?: number;
  label?: string;
}

function App() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [health, setHealth] = useState<string>('...');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth(d.status))
      .catch(() => setHealth('error'));
    fetch('/api/traces')
      .then((r) => r.json())
      .then(setTraces)
      .catch(() => setTraces([]));
  }, []);

  return (
    <>
      <h1>MCP.click</h1>
      <div className="card">
        <h2>Backend Health: {health}</h2>
        <h3>Traces</h3>
        <table>
          <thead>
            <tr>
              <th>Kind</th>
              <th>Timestamp</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {traces.map((t) => (
              <tr key={t.id}>
                <td>{t.kind}</td>
                <td>{new Date(t.ts).toLocaleTimeString()}</td>
                <td>
                  {t.method} {t.url} {t.status} {t.label}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default App;
