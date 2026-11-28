import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 30;
const MAX_MESSAGE_LENGTH = 2_000;

function value(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = value(body.name, MAX_NAME_LENGTH);
    const email = value(body.email, MAX_EMAIL_LENGTH).toLowerCase();
    const phone = value(body.phone, MAX_PHONE_LENGTH);
    const message = value(body.message, MAX_MESSAGE_LENGTH);
    const website = value(body.website, 200);

    // Quietly accept obvious bot submissions without storing them.
    if (website) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (!name || !email || !phone || !message || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid name, email, phone number, and message." },
        { status: 400 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const result = await env.DB
      .prepare(
        `INSERT INTO consultation_leads (name, email, phone, message)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(name, email, phone, message)
      .run();

    if (!result.success) {
      throw new Error("D1 did not confirm the lead insertion");
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Contact form submission failed", error);
    return NextResponse.json(
      { error: "Unable to submit your request right now." },
      { status: 500 },
    );
  }
}
