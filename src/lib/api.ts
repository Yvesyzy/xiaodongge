import { NextResponse } from "next/server";
import { InputError } from "./entry";

export function handleApiError(error: unknown) {
  if (error instanceof InputError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ error: "服务器处理失败" }, { status: 500 });
}

export function readYear(value: string | undefined) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new InputError("年份范围必须是 1-9999");
  }
  return year;
}
