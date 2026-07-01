import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { parseEntryInput, serializeEntry } from "@/lib/entry";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 0);
    const year = searchParams.get("year");
    const albumName = searchParams.get("albumName");
    const songName = searchParams.get("songName");
    const artistName = searchParams.get("artistName");

    const entries = await prisma.reviewEntry.findMany({
      where: {
        ...(year ? { year: Number(year) } : {}),
        ...(albumName ? { albumName } : {}),
        ...(songName ? { songName } : {}),
        ...(artistName ? { artistName } : {}),
      },
      orderBy: { createdAt: "desc" },
      ...(Number.isInteger(limit) && limit > 0 ? { take: limit } : {}),
    });

    return NextResponse.json(entries.map(serializeEntry));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = parseEntryInput(await request.json());
    const entry = await prisma.reviewEntry.create({ data: input });
    return NextResponse.json(serializeEntry(entry), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
