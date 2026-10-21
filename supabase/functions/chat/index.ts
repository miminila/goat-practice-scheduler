import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// The Anthropic API key is read from the ANTHROPIC_API_KEY secret. It is never
// stored in this file. Set it in Supabase: Edge Functions -> Secrets.
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

// Keep each request small so this public endpoint cannot be used as a free,
// general-purpose AI service.
const MAX_MESSAGES = 12;
const MAX_CHARS = 600;

const SYSTEM_PROMPT = `You are a friendly assistant for the ASCA Goat Practice Scheduler at bookgoatpractice.com. You help students book and manage their goat practice slots.

ABOUT THE SCHEDULE:
- Practice slots run 8:00 AM to 4:00 PM daily
- Each slot is 15 minutes (10 min practice + 5 min gap)
- Lunch is blocked 12:00 PM to 1:00 PM
- 28 slots available per day
- Book up to 10 days in advance

HOW TO BOOK:
- Go to bookgoatpractice.com and click Book a Slot
- Choose a day and available time
- Enter your name, email, and phone
- Submit to confirm

HOW TO CANCEL:
- Go to bookgoatpractice.com and click Cancel My Slot
- Enter your email to find your booking
- Click cancel to remove it

CONTACT:
- Call or text the coach: (760) 912-5441

Keep answers friendly, short, and helpful. For real-time availability, direct them to the website. For urgent help, give them the phone number.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      }
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    if (!ANTHROPIC_API_KEY) throw new Error("not configured");

    const { messages } = await req.json();
    if (!Array.isArray(messages)) throw new Error("bad request");

    const filtered = messages
      .filter((m: { role?: string; content?: unknown }) =>
        m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_MESSAGES)
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    const startIdx = filtered.findIndex((m: { role: string }) => m.role === "user");
    const apiMessages = startIdx >= 0 ? filtered.slice(startIdx) : filtered;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "Sorry, I could not get a response. Please call (760) 912-5441 for help.";

    return new Response(JSON.stringify({ message: text }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ message: "Sorry, something went wrong. Please call (760) 912-5441 for help." }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
});
