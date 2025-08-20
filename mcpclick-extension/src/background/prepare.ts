import { inferJsonSchema } from "./schema";

export async function prepareActions(traces: any[]) {
  // 1) Group request/response by requestId
  const byId = new Map<string, { req?: any; res?: any }>();
  for (const t of traces) {
    const x = byId.get(t.requestId) || {};
    if (t.kind === "request") x.req = t;
    if (t.kind === "response") x.res = t;
    byId.set(t.requestId, x);
  }

  // 2) Canonicalize URLs → templates
  function template(url: string) {
    return url.replace(/\b[0-9a-f]{8,}\b/gi, "{id}")
              .replace(/\b\d{2,}\b/g, "{num}");
  }

  // 3) Cluster by (method, template)
  const clusters = new Map<string, any[]>();
  for (const { req, res } of byId.values()) {
    if (!req || !res) continue;
    const key = `${req.method} ${template(req.url)}`;
    (clusters.get(key) || clusters.set(key, []).get(key)).push({ req, res });
  }

  // 4) Draft actions for mutating endpoints
  const actions: any[] = [];
  for (const [key, samples] of clusters) {
    const [method, path] = key.split(" ");
    if (!/POST|PUT|PATCH|DELETE/i.test(method)) continue;
    const inputs = samples.map(s => s.req?.body).filter(Boolean);
    const outputs = samples.map(s => s.res?.body).filter(Boolean);
    const input_schema = inferJsonSchema(inputs);
    const output_schema = inferJsonSchema(outputs);
    const name = actionNameFromPath(path);
    actions.push({ name, description: `${method} ${path}`, method, path, input_schema, output_schema });
  }
  return actions;
}

function actionNameFromPath(p: string): string {
  const parts = p.split("/").filter(Boolean).slice(-3);
  return parts.join("_").replace(/\W+/g, "_");
}


