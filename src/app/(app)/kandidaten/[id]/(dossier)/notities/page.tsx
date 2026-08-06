import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmNotesTimeline, type TimelineNote } from "@/components/crm-notes-timeline";
import { CrmNoteComposer } from "@/components/crm-note-composer";
import { NotesEditor } from "../../../NotesEditor";
import {
  addCandidateNote,
  togglePinCandidateNote,
  deleteCandidateNote,
  completeCandidateNoteFollowUp,
} from "../../../crm-actions";
import { getCandidate } from "../data";

export default async function NotitiesTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) notFound();

  const crmNotes: TimelineNote[] = candidate.crmNotes.map((n) => ({
    id: n.id,
    type: n.type,
    body: n.body,
    sentiment: n.sentiment,
    pinned: n.pinned,
    followUpAt: n.followUpAt,
    followUpDone: n.followUpDone,
    createdAt: n.createdAt,
    authorName: n.author?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-ink-400" /> Notitieblok
            <span className="text-xs font-normal text-ink-400">({crmNotes.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-sm border border-ink-200 bg-ink-50/60 p-4">
            <CrmNoteComposer
              key={crmNotes.length}
              action={addCandidateNote}
              parentIdName="candidateId"
              parentId={candidate.id}
              placeholder={`Wat besprak je met ${candidate.firstName}? Bijv. 'Gebeld — beschikbaar per 1 mei, wil min. €X, open voor offshore.'`}
            />
          </div>
          <CrmNotesTimeline
            notes={crmNotes}
            parentIdName="candidateId"
            parentId={candidate.id}
            togglePinAction={togglePinCandidateNote}
            deleteAction={deleteCandidateNote}
            completeNoteAction={completeCandidateNoteFollowUp}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vrije aantekeningen</CardTitle>
          <span className="text-sm text-ink-400">
            Losse notities over deze kandidaat — alleen intern zichtbaar.
          </span>
        </CardHeader>
        <CardContent>
          <NotesEditor id={candidate.id} notes={candidate.notes} />
        </CardContent>
      </Card>
    </div>
  );
}
