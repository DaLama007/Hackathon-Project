import { useEffect, useState } from "react";

interface Note {
  id: number;
  text: string;
  created_at: string;
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadNotes() {
    try {
      const res = await fetch("/api/notes");
      if (!res.ok) throw new Error(`GET /api/notes failed: ${res.status}`);
      setNotes(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotes();
  }, []);

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) throw new Error(`POST /api/notes failed: ${res.status}`);
      setText("");
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    }
  }

  async function removeNote(id: number) {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`DELETE failed: ${res.status}`);
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  return (
    <main className="app">
      <h1>Hackathon Notes</h1>
      <p className="subtitle">Vite + React &middot; Express API &middot; SQLite</p>

      <form className="composer" onSubmit={addNote}>
        <input
          type="text"
          value={text}
          placeholder="Write a note and hit Add…"
          onChange={(event) => setText(event.target.value)}
          aria-label="Note text"
        />
        <button type="submit">Add</button>
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="empty">No notes yet. Add your first one above.</p>
      ) : (
        <ul className="notes">
          {notes.map((note) => (
            <li key={note.id}>
              <span>{note.text}</span>
              <button
                className="delete"
                onClick={() => removeNote(note.id)}
                aria-label={`Delete note ${note.id}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
