import "dotenv/config";
import cors from "cors";
import express from "express";
import { createNote, deleteNote, listNotes } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/api/notes", (_req, res) => {
  res.json(listNotes());
});

app.post("/api/notes", (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }
  res.status(201).json(createNote(text));
});

app.delete("/api/notes/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "invalid id" });
  }
  if (!deleteNote(id)) {
    return res.status(404).json({ error: "not found" });
  }
  res.status(204).end();
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
