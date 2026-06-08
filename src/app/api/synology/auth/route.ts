import { NextRequest, NextResponse } from "next/server";
import { SynologyClient } from "@/lib/synology";

export async function POST(request: NextRequest) {
  const { url, account, password, otpCode } = await request.json();

  if (!url || !account || !password) {
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  const client = new SynologyClient(url);

  try {
    const sid = await client.login(account, password, otpCode);
    return NextResponse.json({ success: true, sid, url });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 401 }
    );
  }
}
