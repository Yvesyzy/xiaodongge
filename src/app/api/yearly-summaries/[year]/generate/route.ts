import { NextResponse } from "next/server";
import { handleApiError, readYear } from "@/lib/api";
import { generateAndSaveYearlySummary } from "@/lib/summary";

type RouteContext = {
  params: Promise<{ year: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { year } = await context.params;
    return NextResponse.json(await generateAndSaveYearlySummary(readYear(year)));
  } catch (error) {
    return handleApiError(error);
  }
}
