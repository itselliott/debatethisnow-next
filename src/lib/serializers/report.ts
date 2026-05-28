/**
 * Report → JSON. Mirrors [app/models/report.py:to_dict].
 */
import type { Report, User } from "@prisma/client";

export interface ReportDict {
  id: number;
  reporter: string;
  target: string;
  debate_id: number | null;
  message_id: number | null;
  reason: string | null;
  note: string | null;
  status: string;
  created_at: string | null;
}

export function toReportDict(
  r: Report & { reporter: User | null; target: User | null },
): ReportDict {
  return {
    id: r.id,
    reporter: r.reporter?.username ?? "deleted",
    target: r.target?.username ?? "deleted",
    debate_id: r.debate_id,
    message_id: r.message_id,
    reason: r.reason,
    note: r.note,
    status: r.status,
    created_at: r.created_at ? r.created_at.toISOString() : null,
  };
}
