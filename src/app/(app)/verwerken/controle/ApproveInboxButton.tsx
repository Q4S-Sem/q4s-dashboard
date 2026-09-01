import { CheckCircle2 } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import type { GateReviewRow } from "@/lib/timesheet-gate-review";
import { confirmInbox } from "../../inbox/actions";

/**
 * Goedkeurknop: zet ÉÉN uitgelezen weekstaat om in een echte urenstaat.
 *
 * Bewust geen eigen logica — hij vult precies de velden die de bestaande
 * confirmInbox-actie (src/app/(app)/inbox/actions.ts) verwacht, zodat bevestigen
 * hier exact hetzelfde doet als in de inbox (inclusief de leer-lus per afzender).
 * Er wordt hier nooit iets gefactureerd of verstuurd; dat is een aparte stap.
 */

function toDateInput(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** De velden die confirmInbox uit de FormData leest, als platte strings. */
function confirmFields(row: GateReviewRow): Record<string, string> {
  const fields: Record<string, string> = {
    placementId: row.placementId ?? "",
    weekStart: row.weekStart ? toDateInput(row.weekStart) : "",
    kilometers: row.kilometers != null ? String(row.kilometers) : "",
    overtimeHours: row.overtimeHours != null ? String(row.overtimeHours) : "",
  };
  for (let i = 0; i < 7; i++) {
    const hours = row.dayHours[i];
    fields[`hours_${i}`] = typeof hours === "number" ? String(hours) : "";
  }
  return fields;
}

export function ApproveInboxButton({
  row,
  confirmFirst = false,
  size = "sm",
}: {
  row: GateReviewRow;
  /** Bij een nagekeken twijfelgeval eerst nog even bevestigen. */
  confirmFirst?: boolean;
  size?: "sm" | "md";
}) {
  const fields = confirmFields(row);

  if (confirmFirst) {
    return (
      <ConfirmSubmit
        action={confirmInbox}
        id={row.id}
        hidden={fields}
        variant="success"
        size={size}
        trigger="button"
        message={`Weekstaat van ${row.name} goedkeuren?`}
        description="Er wordt een urenstaat aangemaakt. Er gaat niets de deur uit en er wordt geen factuur gemaakt — dat blijft een aparte stap bij Verwerken."
        confirmLabel="Goedkeuren"
        confirmVariant="success"
      >
        <CheckCircle2 className="h-4 w-4" /> Goedkeuren
      </ConfirmSubmit>
    );
  }

  return (
    <form action={confirmInbox}>
      <input type="hidden" name="id" value={row.id} />
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant="success" size={size} pendingLabel="Goedkeuren…">
        <CheckCircle2 className="h-4 w-4" /> Goedkeuren
      </SubmitButton>
    </form>
  );
}
