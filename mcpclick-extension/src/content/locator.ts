export function getLocator(el: Element): string {
  const path: string[] = [];
  let node: Element | null = el;
  while (node && path.length < 6) {
    const tag = node.tagName.toLowerCase();
    const id = node.id ? `#${CSS.escape(node.id)}` : "";
    const cls = node.className && typeof node.className === "string"
      ? "." + node.className.split(/\s+/).slice(0, 2).map(c => CSS.escape(c)).join(".")
      : "";
    path.unshift(`${tag}${id}${cls}`);
    node = node.parentElement;
  }
  return path.join(" > ");
}


