import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getAbstractMusicMapFromParams } from "@/lib/visualizations";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json(await getAbstractMusicMapFromParams(searchParams));
  } catch (error) {
    return handleApiError(error);
  }
}
