import { NextResponse } from "next/server";
import { handleApiError, readYear } from "@/lib/api";
import { getSavedYearlySummary } from "@/lib/summary";

type RouteContext = {
  params: Promise<{ year: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { year } = await context.params;
    return NextResponse.json(await getSavedYearlySummary(readYear(year)));
  } catch (error) {
    return handleApiError(error);
  }
}
