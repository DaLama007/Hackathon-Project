// Minimal end-to-end smoke test against the running API.
// Usage: node scripts/smoke-test.mjs  (API must be running, defaults to PORT 3001)

const base = `http://localhost:${process.env.PORT ?? 3001}`;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`ok: ${message}`);
}

const health = await fetch(`${base}/api/health`).then((r) => r.json());
assert(health.status === "ok", "health endpoint returns ok");

const marker = `smoke-${Date.now()}`;
const created = await fetch(`${base}/api/notes`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: marker }),
}).then((r) => r.json());
assert(created.id > 0 && created.text === marker, "POST /api/notes creates a note");

const list = await fetch(`${base}/api/notes`).then((r) => r.json());
assert(
  list.some((note) => note.id === created.id && note.text === marker),
  "GET /api/notes returns the created note",
);

const del = await fetch(`${base}/api/notes/${created.id}`, { method: "DELETE" });
assert(del.status === 204, "DELETE /api/notes/:id removes the note");

console.log("\nAll smoke checks passed.");
