// Cancels a student's own booking and emails them a cancellation notice.
//
// The email is sent ONLY when a booking was really cancelled, and only to the
// address that owned it. The booking must match date, slot and email, exactly as
// the cancel_my_booking() database function requires. So this cannot be used to
// send mail to arbitrary people.
//
// The Resend API key is read from the RESEND_API_KEY secret. It is never stored
// in this file. Set it in Supabase: Edge Functions -> Secrets.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const FROM_ADDRESS = "Goat Practice <notifications@bookgoatpractice.com>";

function escapeHtml(s: string): string {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c] || c);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function rpc(name: string, args: Record<string, unknown>): Promise<{ ok: boolean; data: unknown }> {
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) return { ok: false, data: null };
    return { ok: true, data: await res.json() };
  } catch (_) {
    return { ok: false, data: null };
  }
}

function prettyDate(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return key;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

interface Row { date: string; slot_time: number; slot_label: string; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  let body: { date?: string; slotTime?: number; email?: string };
  try {
    body = await req.json();
  } catch (_) {
    return json({ ok: false, message: "Invalid JSON" }, 400);
  }

  const date = String(body.date || "").slice(0, 10);
  const slotTime = Number(body.slotTime);
  const email = String(body.email || "").slice(0, 200).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(slotTime) || !email.includes("@")) {
    return json({ ok: false, message: "Missing or invalid fields" }, 400);
  }

  // Find the booking first so the email can name the real time slot.
  const found = await rpc("find_my_bookings", { p_email: email });
  const rows = found.ok && Array.isArray(found.data) ? (found.data as Row[]) : [];
  const match = rows.find((r) => r.date === date && r.slot_time === slotTime);
  if (!match) return json({ ok: false, message: "No matching booking" }, 404);

  const cancelled = await rpc("cancel_my_booking", { p_date: date, p_slot_time: slotTime, p_email: email });
  if (!cancelled.ok || cancelled.data !== true) {
    return json({ ok: false, message: "Could not cancel" }, 409);
  }

  // The booking is cancelled. Now send the notice; a failure here must not undo it.
  let emailed = false;
  if (RESEND_API_KEY) {
    const when = prettyDate(date) + " at " + match.slot_label;
    const html =
      '<div style="font-family: Georgia, serif; color: #2c1a0e; max-width: 480px; margin: 0 auto;">' +
      '<h2 style="color: #3B2008;">Your goat practice booking was cancelled</h2>' +
      "<p>This confirms that your booking for:</p>" +
      '<div style="background: #F5EFE0; border-radius: 8px; padding: 12px 16px; margin: 12px 0;"><strong>' + escapeHtml(when) + "</strong></div>" +
      "<p>has been cancelled and the slot is open for others. If this wasn't you, or you'd like to book again, visit bookgoatpractice.com.</p>" +
      '<p style="color: #888; font-size: 13px;">Questions? Contact stockdogcoursedirector2026@gmail.com</p>' +
      "</div>";
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: [email],
          subject: "Goat Practice Cancellation - " + prettyDate(date),
          html,
          text: "Your goat practice booking for " + when + " was cancelled and the slot is open for others.\n\nTo book again, visit bookgoatpractice.com.",
        }),
      });
      emailed = res.ok;
    } catch (_) {
      emailed = false;
    }
  }
  return json({ ok: true, emailed }, 200);
});
