import {
  StickyNote,
  Phone,
  Mail,
  Users,
  Share2,
  MessageCircle,
  ListTodo,
  ArrowRightLeft,
  Info,
  Pin,
  PinOff,
  Trash2,
  CheckCircle2,
  CalendarClock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { cn } from "@/lib/utils";
import { CRM_NOTE_TYPES, CRM_SENTIMENTS, labelFor, colorFor, type BadgeColor } from "@/lib/domain";

export type TimelineNote = {
  id: string;
  type: string;
  body: string;
  sentiment: string | null;
  pinned: boolean;
  followUpAt: Date | string | null;
  followUpDone: boolean;
  createdAt: Date | string;
  authorName: string | null;
};

const ICONS: Record<string, typeof StickyNote> = {
  NOTE: StickyNote,
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Users,
  LINKEDIN: Share2,
  WHATSAPP: MessageCircle,
  TASK: ListTodo,
  STAGE_CHANGE: ArrowRightLeft,
  SYSTEM: Info,
};

const ICON_BG: Record<BadgeColor, string> = {
  slate: "bg-slate-100 text-slate-500",
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  violet: "bg-violet-50 text-violet-600",
  cyan: "bg-cyan-50 text-cyan-600",
};

const dtFmt = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatStamp(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return dtFmt.format(d);
}

/**
 * De CRM-notitieblok als tijdlijn (chat). Toont elke vastgelegde interactie,
 * met vastpinnen/verwijderen en (voor contact/kandidaat-notities) het afronden
 * van een opvolging. Generiek via de doorgegeven server-acties + parent-id.
 */
export function CrmNotesTimeline({
  notes,
  parentIdName,
  parentId,
  togglePinAction,
  deleteAction,
  completeNoteAction,
}: {
  notes: TimelineNote[];
  parentIdName: string;
  parentId: string;
  togglePinAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  completeNoteAction?: (formData: FormData) => void | Promise<void>;
}) {
  if (notes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
        Nog niets vastgelegd. Log je eerste contactmoment hierboven — alles wordt bewaard.
      </p>
    );
  }

  // Pinned first, then newest-first.
  const ordered = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <ol className="space-y-3">
      {ordered.map((n) => {
        const Icon = ICONS[n.type] ?? StickyNote;
        const color = colorFor(CRM_NOTE_TYPES, n.type);
        const openFollowUp = n.followUpAt && !n.followUpDone;
        return (
          <li
            key={n.id}
            className={cn(
              "flex gap-3 rounded-lg border p-3",
              n.pinned ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white",
            )}
          >
            <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", ICON_BG[color])}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="font-medium text-slate-600">{labelFor(CRM_NOTE_TYPES, n.type)}</span>
                <span>·</span>
                <span>{formatStamp(n.createdAt)}</span>
                {n.authorName && (
                  <>
                    <span>·</span>
                    <span>{n.authorName}</span>
                  </>
                )}
                {n.sentiment && (
                  <Badge color={colorFor(CRM_SENTIMENTS, n.sentiment)}>
                    {labelFor(CRM_SENTIMENTS, n.sentiment)}
                  </Badge>
                )}
                {n.pinned && <Pin className="h-3 w-3 text-amber-500" />}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{n.body}</p>

              {n.followUpAt && (
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      n.followUpDone
                        ? "bg-slate-100 text-slate-400 line-through"
                        : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
                    )}
                  >
                    <CalendarClock className="h-3 w-3" />
                    Opvolgen: {formatStamp(n.followUpAt)}
                  </span>
                  {openFollowUp && completeNoteAction && (
                    <form action={completeNoteAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name={parentIdName} value={parentId} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Afronden
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-start gap-1">
              <form action={togglePinAction}>
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name={parentIdName} value={parentId} />
                <button
                  type="submit"
                  title={n.pinned ? "Losmaken" : "Vastpinnen"}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  {n.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
              </form>
              <ConfirmSubmit
                action={deleteAction}
                id={n.id}
                hidden={{ [parentIdName]: parentId }}
                message="Notitie verwijderen?"
                variant="ghost"
                size="icon"
              >
                <Trash2 className="h-4 w-4" />
              </ConfirmSubmit>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
