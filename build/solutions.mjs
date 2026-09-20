import { findItems, extractOpens } from "../src/qs.mjs";

/**
 * For lessons without a workbook, the reference solution of a task is the `<Name>_Reference` operation
 * in ReferenceImplementation.qs. Returns the code renamed to `<Name>`, or null.
 */
export function referenceFromProject(project, names) {
  const ref = project.find((f) => f.role === "reference");
  if (!ref) return null;
  const items = findItems(ref.text, 1);
  const parts = [];
  for (const name of names) {
    const it = items.find((x) => x.name === `${name}_Reference`);
    if (!it) return null;
    let text = ref.text.slice(it.start, it.end);
    text = text.replace(new RegExp(`\\b${name}_Reference\\b`), name);
    parts.push(text);
  }
  const opens = extractOpens(ref.text);
  return (opens.length ? opens.join("\n") + "\n\n" : "") + parts.join("\n\n");
}
