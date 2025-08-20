export function inferJsonSchema(samples: any[]): any {
  const merged: any = {};
  for (const s of samples.slice(0, 10)) mergeShape(merged, s, 0);
  return toSchema(merged);
}

function mergeShape(dst: any, v: any, depth: number) {
  if (depth > 4) return;
  if (v == null) return;
  const t = Array.isArray(v) ? "array" : typeof v;
  dst.__t = dst.__t || new Set<string>();
  dst.__t.add(t);
  if (t === "object") {
    dst.__props = dst.__props || {};
    for (const [k, val] of Object.entries(v)) {
      dst.__props[k] = dst.__props[k] || {};
      mergeShape(dst.__props[k], val, depth + 1);
    }
  } else if (t === "array") {
    dst.__items = dst.__items || {};
    for (const item of (v as any[]).slice(0, 5)) mergeShape(dst.__items, item, depth + 1);
  }
}

function toSchema(n: any): any {
  const types = Array.from(n.__t || ["null"]);
  if (types.includes("object")) {
    const props: any = {};
    for (const [k, child] of Object.entries(n.__props || {})) props[k] = toSchema(child);
    return { type: "object", properties: props, additionalProperties: true };
  }
  if (types.includes("array")) return { type: "array", items: toSchema(n.__items || {}) };
  if (types.includes("number")) return { type: "number" };
  if (types.includes("boolean")) return { type: "boolean" };
  return { type: "string" };
}


