import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getSongAggregates } from "@/lib/stats";

export async function GET() {
  try {
    return NextResponse.json(await getSongAggregates());
  } catch (error) {
    return handleApiError(error);
  }
}
