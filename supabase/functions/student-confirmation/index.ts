// Sends a booking confirmation email directly to the student via Resend, so
// they get their own copy separate from the coach notification (which still
// goes out via Web3Forms). Called client-side right after a successful booking
// (one day), and from the Coach View Resend button (which can cover every day
// that person is booked, all in one email).
//
// It only sends to an email address that currently has a booking, so it cannot
// be used to send mail to arbitrary people. The check uses the public
// find_my_bookings() database function.
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

// True only if this email currently has at least one upcoming booking.
async function hasBooking(email: string): Promise<boolean> {
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/find_my_bookings", {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_email: email }),
    });
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch (_) {
    return false;
  }
}

interface DayGroup { day?: string; slots?: string[]; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  if (!RESEND_API_KEY) {
    return json({ success: false, message: "Email service is not configured" }, 500);
  }

  let body: { name?: string; email?: string; days?: DayGroup[] };
  try {
    body = await req.json();
  } catch (_) {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const name = (body.name || "").slice(0, 100).trim();
  const email = (body.email || "").slice(0, 200).trim();
  const days = (Array.isArray(body.days) ? body.days : [])
    .filter((d) => d && typeof d.day === "string" && Array.isArray(d.slots) && d.slots.length > 0)
    .slice(0, 20)
    .map((d) => ({
      day: String(d.day).slice(0, 60).trim(),
      slots: d.slots!.slice(0, 20).map((s) => String(s).slice(0, 40)),
    }));

  if (!email || !name || days.length === 0) {
    return json({ success: false, message: "Missing required fields" }, 400);
  }
  if (!(await hasBooking(email))) {
    return json({ success: false, message: "No booking found for that email" }, 403);
  }

  const dayBlocksHtml = days
    .map((d) => "<p style=\"margin: 4px 0;\"><strong>" + escapeHtml(d.day) + ":</strong> " + d.slots.map(escapeHtml).join(", ") + "</p>")
    .join("");
  const dayBlocksText = days.map((d) => d.day + ": " + d.slots.join(", ")).join("\n");

  const subject = days.length === 1
    ? "Goat Practice Confirmation - " + days[0].day
    : "Goat Practice Confirmation - " + days.length + " Days";

  const html =
    '<div style="font-family: Georgia, serif; color: #2c1a0e; max-width: 480px; margin: 0 auto;">' +
    '<h2 style="color: #3B2008;">You\'re booked for Goat Practice 🐐</h2>' +
    "<p>Hi " + escapeHtml(name) + ",</p>" +
    "<p>This confirms your goat practice booking" + (days.length > 1 ? "s" : "") + ":</p>" +
    '<div style="background: #F5EFE0; border-radius: 8px; padding: 12px 16px; margin: 12px 0;">' + dayBlocksHtml + "</div>" +
    "<p>Each slot is 10 minutes — please arrive ready to go.</p>" +
    '<p style="color: #888; font-size: 13px;">Questions? Contact stockdogcoursedirector2026@gmail.com</p>' +
    "</div>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [email],
        subject,
        html,
        text: "You're booked for Goat Practice:\n\n" + dayBlocksText + "\n\nEach slot is 10 minutes.",
      }),
    });
    const data = await res.json();
    return json({ success: res.ok, data }, res.ok ? 200 : 502);
  } catch (err) {
    return json({ success: false, message: String(err) }, 500);
  }
});
