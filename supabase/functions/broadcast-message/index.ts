// Sends a personalized announcement email to a list of students in one batch
// call via Resend's /emails/batch endpoint (up to 100 recipients per call).
//
// COACH ONLY: the caller must send a signed-in coach's session token
// (Authorization: Bearer <token>). The token is checked against the coach
// allowlist in the database (public.is_admin()), so the public key alone,
// or any random visitor, is rejected with 401.
//
// The Resend API key is read from the RESEND_API_KEY secret. It is never
// stored in this file. Set it in Supabase: Edge Functions -> Secrets.
//
// Each student only ever sees their own email (no CC/BCC exposure).
// Each recipient can optionally carry a bookingSummary (their real day/time
// bookings), which gets appended so every announcement also doubles as a
// personal confirmation.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const FROM_ADDRESS = "Goat Practice <notifications@bookgoatpractice.com>";
const MAX_RECIPIENTS = 100; // Resend's batch endpoint limit

function escapeHtml(s: string): string {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c] || c);
}

function nl2br(s: string): string {
  return escapeHtml(s).replace(/\n/g, "<br>");
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

// True only if the bearer token belongs to a signed-in coach on the allowlist.
async function isCoach(authHeader: string | null): Promise<boolean> {
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) return false;
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/is_admin", {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) return false;
    return (await res.json()) === true;
  } catch (_) {
    return false;
  }
}

interface Recipient { name?: string; email?: string; bookingSummary?: string; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!(await isCoach(req.headers.get("Authorization")))) {
    return json({ success: false, message: "Coach sign-in required" }, 401);
  }
  if (!RESEND_API_KEY) {
    return json({ success: false, message: "Email service is not configured" }, 500);
  }

  let body: { subject?: string; message?: string; recipients?: Recipient[] };
  try {
    body = await req.json();
  } catch (_) {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const subject = (body.subject || "").slice(0, 200).trim();
  const message = (body.message || "").slice(0, 5000).trim();
  const recipients = (Array.isArray(body.recipients) ? body.recipients : [])
    .filter((r) => r && typeof r.email === "string" && r.email.includes("@"))
    .slice(0, MAX_RECIPIENTS);

  if (!subject || !message || recipients.length === 0) {
    return json({ success: false, message: "Missing subject, message, or recipients" }, 400);
  }

  const batch = recipients.map((r) => {
    const name = (r.name || "there").slice(0, 100).trim() || "there";
    const email = r.email!.slice(0, 200).trim();
    const bookingSummary = (r.bookingSummary || "").slice(0, 1000).trim();

    const bookingHtml = bookingSummary
      ? '<div style="background: #F5EFE0; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">' +
        "<strong>Your booking(s):</strong><br>" + nl2br(bookingSummary) +
        "</div>"
      : "";
    const bookingText = bookingSummary ? "\n\nYour booking(s):\n" + bookingSummary : "";

    const html =
      '<div style="font-family: Georgia, serif; color: #2c1a0e; max-width: 480px; margin: 0 auto;">' +
      "<p>Hi " + escapeHtml(name) + ",</p>" +
      '<div style="line-height: 1.6;">' + nl2br(message) + "</div>" +
      bookingHtml +
      '<p style="color: #888; font-size: 13px; margin-top: 24px;">— Goat Practice • stockdogcoursedirector2026@gmail.com</p>' +
      "</div>";
    return {
      from: FROM_ADDRESS,
      to: [email],
      subject,
      html,
      text: "Hi " + name + ",\n\n" + message + bookingText + "\n\n— Goat Practice • stockdogcoursedirector2026@gmail.com",
    };
  });

  try {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });
    const data = await res.json();
    return json({ success: res.ok, count: recipients.length, data }, res.ok ? 200 : 502);
  } catch (err) {
    return json({ success: false, message: String(err) }, 500);
  }
});
