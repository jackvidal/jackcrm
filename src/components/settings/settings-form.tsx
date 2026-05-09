"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  updateSettingsAction,
  type FormState,
} from "@/app/(dashboard)/settings/actions";
import { t } from "@/i18n/he";

const initial: FormState = {};

export function SettingsForm({
  defaultFullName,
  defaultCalOrganizerEmail,
  email,
}: {
  defaultFullName: string;
  defaultCalOrganizerEmail: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateSettingsAction,
    initial,
  );
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok) {
      toast({ title: t.settings.saved, variant: "success" });
    }
  }, [state.ok, toast]);

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.profile}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t.auth.email}</Label>
            <Input
              defaultValue={email}
              dir="ltr"
              className="text-start"
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">{t.auth.fullName}</Label>
            <Input
              id="fullName"
              name="fullName"
              defaultValue={defaultFullName}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.integrations}</CardTitle>
          <CardDescription>{t.settings.calHelp}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="calOrganizerEmail">
              {t.settings.calOrganizerEmail}
            </Label>
            <Input
              id="calOrganizerEmail"
              name="calOrganizerEmail"
              type="email"
              dir="ltr"
              className="text-start"
              defaultValue={defaultCalOrganizerEmail}
              placeholder="organizer@example.com"
            />
          </div>
        </CardContent>
      </Card>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t.common.saving : t.settings.save}
        </Button>
      </div>
    </form>
  );
}
