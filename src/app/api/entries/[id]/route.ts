import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { InputError, parseEntryInput, serializeEntry } from "@/lib/entry";
import { prisma } from "@/lib/prisma";
import { invalidateYearlySummaries } from "@/lib/summary";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const entry = await prisma.reviewEntry.findUnique({ where: { id } });
    if (!entry) throw new InputError("记录不存在");
    return NextResponse.json(serializeEntry(entry));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const input = parseEntryInput(await request.json());
    const entry = await prisma.$transaction(async (tx) => {
      const existing = await tx.reviewEntry.findUniqueOrThrow({ where: { id } });
      const updated = await tx.reviewEntry.update({ where: { id }, data: input });
      await invalidateYearlySummaries(tx, [existing.year, updated.year]);
      return updated;
    });
    return NextResponse.json(serializeEntry(entry));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.reviewEntry.delete({ where: { id } });
      await invalidateYearlySummaries(tx, [deleted.year]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
