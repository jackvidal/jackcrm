import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { analyzeWebsite } from "@/lib/ai/analyze-website";
import { PageFetchError } from "@/lib/ai/fetch-page";

const bodySchema = z.object({
  url: z.string().trim().url().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  let body: { url?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const url = parsed.data.url ?? lead.websiteUrl;
  if (!url) {
    return NextResponse.json(
      { error: "יש לציין כתובת אתר" },
      { status: 400 },
    );
  }

  try {
    const result = await analyzeWebsite(url);

    const analysis = await prisma.websiteAnalysis.create({
      data: {
        leadId: lead.id,
        url,
        summary: result.summary,
        issues: result.issues,
        opportunities: result.opportunities,
        recommendedServices: result.recommendedServices,
        recommendedNextSteps: result.recommendedNextSteps,
        modelUsed: result.modelUsed,
        rawResponse: result.raw as object,
      },
    });

    // If the lead didn't have a website URL but caller passed one, save it.
    if (!lead.websiteUrl && parsed.data.url) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { websiteUrl: parsed.data.url },
      });
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("Analysis failed", err);
    if (err instanceof PageFetchError) {
      return NextResponse.json(
        {
          error: `לא ניתן היה לטעון את האתר: ${err.message}`,
          reason: err.message,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: `ניתוח האתר נכשל: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}`,
      },
      { status: 500 },
    );
  }
}
