/**
 * Note creation service.
 *
 * Thin wrapper around the notes table — all note creation (user, charlie,
 * system) flows through this so SSE events are emitted consistently.
 */

import { db } from "../db";
import { notes, type InsertNote } from "@shared/schema";
import { emitTenantEvent } from "./realtimeEvents";

export async function createNote(params: InsertNote) {
  const [note] = await db.insert(notes).values(params).returning();
  emitTenantEvent(params.tenantId, "note_created", {
    noteId: note.id,
    contactId: params.contactId ?? null,
    source: params.source,
  });
  return note;
}
