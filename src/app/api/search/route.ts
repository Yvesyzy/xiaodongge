import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { searchEntries } from "@/lib/stats";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    return NextResponse.json(await searchEntries(query));
  } catch (error) {
    return handleApiError(error);
  }
}
