import type { EvidenceAtom, TimelineEvent, Transaction } from "../core/types.js";
import { shortCode } from "../core/crypto.js";
import { sha512 } from "../core/crypto.js";
import { extractDates } from "./text.js";

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** Parse a date string (as emitted by extractDates) to an ISO date, or null. */
export function parseIsoDate(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  // 2025-03-09
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // 9 march 2025  |  march 9 2025
  m = /^(\d{1,2})\s+([a-z]+)\s+(\d{2,4})$/.exec(s);
  if (m && MONTHS[m[2]]) return iso(m[3], MONTHS[m[2]], m[1]);
  m = /^([a-z]+)\s+(\d{1,2})\s+(\d{2,4})$/.exec(s);
  if (m && MONTHS[m[1]]) return iso(m[3], MONTHS[m[1]], m[2]);
  // dd/mm/yyyy
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (m) return iso(m[3], Number(m[2]), m[1]);
  return null;
}

function iso(year: string, month: number, day: string): string {
  const y = year.length === 2 ? `20${year}` : year.padStart(4, "0");
  return `${y}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Deterministic timeline reconstruction (spec §4.4): one event per (atom, date),
 * anchored to the source evidence, ordered chronologically.
 */
export function buildTimelineFromAtoms(atoms: EvidenceAtom[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const seen = new Set<string>();
  for (const atom of atoms) {
    for (const date of extractDates(atom.content)) {
      const iso_date = parseIsoDate(date) ?? undefined;
      const key = `${iso_date ?? date}|${atom.evidence_id}|${atom.line_range}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        event_id: `EV-${shortCode(sha512(key), 10)}`,
        date,
        iso_date,
        description: atom.content,
        evidence_id: atom.evidence_id,
        page: atom.page_number,
        line: Number(atom.line_range.split("-")[0]) || 0,
        sha512: atom.sha512,
      });
    }
  }
  return sortEvents(events);
}

/** Timeline from transaction records (fraud pipeline). */
export function buildTimelineFromTransactions(txns: Transaction[]): TimelineEvent[] {
  const events: TimelineEvent[] = txns.map((t) => {
    const iso_date = Number.isNaN(Date.parse(t.timestamp))
      ? undefined
      : new Date(t.timestamp).toISOString();
    return {
      event_id: `EV-${shortCode(sha512(t.txn_id), 10)}`,
      date: t.timestamp,
      iso_date,
      description: `Transaction ${t.txn_id}: ${t.currency} ${t.amount} on account ${t.account_id}${t.country ? ` (${t.country})` : ""}`,
      evidence_id: t.txn_id,
      page: 0,
      line: 0,
      sha512: sha512(`${t.txn_id}|${t.amount}|${t.timestamp}`),
    };
  });
  return sortEvents(events);
}

function sortEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    const ai = a.iso_date ?? "9999-12-31";
    const bi = b.iso_date ?? "9999-12-31";
    if (ai !== bi) return ai < bi ? -1 : 1;
    return a.event_id.localeCompare(b.event_id);
  });
}
