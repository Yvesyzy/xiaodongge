import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getAlbumAggregates } from "@/lib/stats";

export async function GET() {
  try {
    return NextResponse.json(await getAlbumAggregates());
  } catch (error) {
    return handleApiError(error);
  }
}
