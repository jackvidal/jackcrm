"use client";

import { useId, useOptimistic, useRef, useState, useTransition } from "react";
import type { Lead } from "@prisma/client";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { LEAD_STATUSES, type PipelineStatus } from "@/lib/leads";
import { quickUpdateStatusAction } from "@/app/(dashboard)/leads/actions";
import { useToast } from "@/hooks/use-toast";
import { LeadCard } from "./lead-card";
import { t } from "@/i18n/he";
import { cn } from "@/lib/utils";

const keyboardCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.code)) return;
  event.preventDefault();
  const currentId = context.over?.id ?? context.active?.data.current?.status;
  const columns = context.droppableContainers.getEnabled().map((container) => ({ id: container.id, rect: context.droppableRects.get(container.id) })).filter((item) => item.rect).sort((a, b) => a.rect!.left - b.rect!.left);
  const index = columns.findIndex((column) => column.id === currentId);
  const current = columns[index]?.rect;
  const next = columns[index + (event.code === "ArrowLeft" ? -1 : 1)]?.rect;
  if (current && next) return { x: currentCoordinates.x + next.left - current.left, y: currentCoordinates.y };
};

export function LeadBoard({ leads }: { leads: Lead[] }) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const [active, setActive] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimistic, move] = useOptimistic(leads, (rows, change: { id: string; status: PipelineStatus }) => rows.map((lead) => lead.id === change.id ? { ...lead, status: change.status } : lead));
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates, scrollBehavior: "auto" }));
  function onDrop({ active: dragged, over }: DragEndEvent) {
    setActive(null);
    const next = over?.id as PipelineStatus;
    const lead = leads.find((item) => item.id === dragged.id);
    if (!lead || !LEAD_STATUSES.includes(next) || next === lead.status || busy.current) return;
    busy.current = true;
    setError(null);
    startTransition(async () => {
      move({ id: lead.id, status: next });
      try {
        const result = await quickUpdateStatusAction(lead.id, next);
        if (result.error) throw new Error(result.error);
        toast({ title: `${lead.fullName} הועבר ל${t.leads.status[next]}`, variant: "success" });
      } catch {
        setError("העברת הליד לא נשמרה. רעננו את התצוגה ובדקו את הסטטוס לפני ניסיון נוסף.");
      } finally { busy.current = false; }
    });
  }
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">גררו בעזרת ידית הכרטיס לשינוי שלב, או השתמשו בתפריט הסטטוס. במקלדת: רווח להתחלה, חצים למעבר ורווח לשמירה.</p>
    {error && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
    <p role="status" className="sr-only">{pending ? "שומר את שלב המכירה" : ""}</p>
    <DndContext id={id} sensors={sensors} collisionDetection={closestCorners} onDragStart={({ active: item }) => setActive(leads.find((lead) => lead.id === item.id) ?? null)} onDragCancel={() => setActive(null)} onDragEnd={onDrop} accessibility={{
      screenReaderInstructions: { draggable: "לחצו רווח או אנטר כדי להתחיל לגרור. השתמשו בחצים ימינה ושמאלה לבחירת שלב. לחצו רווח לשמירה או Escape לביטול." },
      announcements: {
        onDragStart: ({ active: item }) => `נבחר ${item.data.current?.name ?? "ליד"}`,
        onDragOver: ({ over }) => over ? `יעד: ${t.leads.status[over.id as PipelineStatus]}` : "אין יעד",
        onDragEnd: ({ over }) => over ? `שומר מעבר לשלב ${t.leads.status[over.id as PipelineStatus]}` : "ההעברה בוטלה",
        onDragCancel: () => "ההעברה בוטלה",
      },
    }}>
      <div className="flex items-stretch gap-4 overflow-x-auto pb-4" aria-label="לוח קנבאן לפי שלב מכירה">
        {LEAD_STATUSES.map((status) => <BoardColumn key={status} status={status} leads={optimistic.filter((lead) => lead.status === status)} disabled={pending} />)}
      </div>
      <DragOverlay dropAnimation={null}>{active ? <div className="w-64 rounded-lg border-2 border-dashed border-primary bg-card p-4 shadow-lg"><span className="font-semibold">{active.fullName}</span><p className="mt-1 text-xs text-muted-foreground">{active.company}</p></div> : null}</DragOverlay>
    </DndContext>
  </div>;
}

function BoardColumn({ status, leads, disabled }: { status: PipelineStatus; leads: Lead[]; disabled: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled });
  return <section ref={setNodeRef} aria-label={`${t.leads.status[status]} — ${leads.length} לידים`} className={cn("flex min-h-80 w-72 max-w-[calc(100vw-5rem)] shrink-0 flex-col rounded-xl border border-border bg-muted/50", isOver && "border-primary bg-primary/5")}>
    <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-3"><h2 className="text-sm font-semibold">{t.leads.status[status]}</h2><span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">{leads.length}</span></header>
    <div className="flex-1 space-y-3 p-2">
      {leads.length ? leads.map((lead) => <DraggableLead key={lead.id} lead={lead} disabled={disabled} />) : <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">אין לידים בשלב הזה</p>}
    </div>
  </section>;
}

function DraggableLead({ lead, disabled }: { lead: Lead; disabled: boolean }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({ id: lead.id, data: { name: lead.fullName, status: lead.status }, disabled });
  return <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}><LeadCard lead={lead} disabled={disabled} handle={<button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} disabled={disabled} aria-label={`העברת ${lead.fullName} בין שלבים`} className="-me-1 -mt-1 flex h-8 w-8 shrink-0 touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:cursor-default enabled:cursor-grab active:cursor-grabbing"><GripVertical className="h-4 w-4" /></button>} /></div>;
}
