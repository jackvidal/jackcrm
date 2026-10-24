"use client";

import { useState } from "react";
import Link from "next/link";
import { Mic, ArrowUpLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RecordingShortcut({
  leads,
}: {
  leads: { id: string; fullName: string; company: string | null }[];
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = leads.filter((lead) =>
    `${lead.fullName} ${lead.company ?? ""}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mic />
          תיעוד שיחה
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>לאיזה ליד שייכת השיחה?</DialogTitle>
          <DialogDescription>
            בכרטיס הליד אפשר לתעד שיחה, להעלות הקלטה ולקבל ניתוח AI.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="חיפוש ליד לתיעוד שיחה"
          placeholder="חיפוש לפי שם או חברה"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="max-h-72 overflow-y-auto">
          {filtered.slice(0, 30).map((lead) => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}#calls`}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-3 rounded-lg p-3 hover:bg-muted"
            >
              <div>
                <div className="text-sm font-medium">{lead.fullName}</div>
                <div className="text-xs text-muted-foreground">
                  {lead.company}
                </div>
              </div>
              <ArrowUpLeft className="h-4 w-4" />
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              לא נמצאו לידים.{" "}
              <Link href="/leads/new" className="text-primary hover:underline">
                הוספת ליד
              </Link>
            </p>
          )}
          {filtered.length > 30 && (
            <p className="p-3 text-xs text-muted-foreground">
              מוצגים 30 לידים. חפשו לפי שם כדי לצמצם את הרשימה.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
