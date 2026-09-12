import { NextResponse } from "next/server";
import ical from "node-ical";

export const dynamic = "force-dynamic";

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").trim()
    : "";
}

export async function GET() {
  const url = process.env.OUTLOOK_ICS_URL;

  if (!url) {
    return NextResponse.json(
      { configured: false, events: [], message: "OUTLOOK_ICS_URL is not configured." },
      { status: 200 }
    );
  }

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "GM-Dashboard/1.0" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { configured: true, events: [], message: `Outlook calendar returned HTTP ${response.status}.` },
        { status: 502 }
      );
    }

    const raw = await response.text();
    const parsed = ical.sync.parseICS(raw);
    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setDate(rangeStart.getDate() - 7);
    const rangeEnd = new Date(now);
    rangeEnd.setDate(rangeEnd.getDate() + 45);

    const events = Object.values(parsed)
      .filter((item: any) => item && item.type === "VEVENT")
      .flatMap((event: any) => {
        const rows: any[] = [];

        if (event.rrule) {
          const dates = event.rrule.between(rangeStart, rangeEnd, true);
          for (const start of dates) {
            const duration =
              event.start && event.end
                ? new Date(event.end).getTime() - new Date(event.start).getTime()
                : 0;
            const end = new Date(start.getTime() + duration);
            rows.push({
              eventKey: `${event.uid || "event"}:${start.toISOString()}`,
              uid: event.uid || null,
              subject: cleanText(event.summary),
              description: cleanText(event.description),
              location: cleanText(event.location),
              start: start.toISOString(),
              end: end.toISOString(),
              allDay: Boolean(event.datetype === "date"),
              status: cleanText(event.status).toLowerCase() || "active",
            });
          }
        } else if (event.start) {
          const start = new Date(event.start);
          if (start >= rangeStart && start <= rangeEnd) {
            rows.push({
              eventKey: `${event.uid || "event"}:${start.toISOString()}`,
              uid: event.uid || null,
              subject: cleanText(event.summary),
              description: cleanText(event.description),
              location: cleanText(event.location),
              start: start.toISOString(),
              end: event.end ? new Date(event.end).toISOString() : null,
              allDay: Boolean(event.datetype === "date"),
              status: cleanText(event.status).toLowerCase() || "active",
            });
          }
        }

        return rows;
      })
      .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return NextResponse.json({
      configured: true,
      fetchedAt: new Date().toISOString(),
      events,
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        events: [],
        message: error instanceof Error ? error.message : "Failed to read Outlook calendar.",
      },
      { status: 500 }
    );
  }
}
