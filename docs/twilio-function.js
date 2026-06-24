/**
 * TWILIO FUNCTION — Goat Practice Scheduler
 * 
 * Paste this entire file into a new Twilio Function.
 * See the setup guide (SETUP-GUIDE.md) for step-by-step instructions.
 * 
 * This function handles:
 *   1. new_booking  → SMS to student + SMS to coaches
 *   2. cancellation → SMS to student confirming cancellation
 *   3. reminder     → Called by Twilio Scheduler 24hr and 1hr before each slot
 */

exports.handler = async function (context, event, callback) {
  const client = context.getTwilioClient();
  const FROM = context.TWILIO_PHONE_NUMBER; // set in Twilio Function environment vars
  const COACH_MIMI = context.COACH_MIMI_PHONE;   // 7609125441
  const COACH_DAWNA = context.COACH_DAWNA_PHONE;  // fill in when known

  const { event: eventType, name, phone, day, date, slot } = event;

  try {
    if (eventType === "new_booking") {
      // Text the student
      await client.messages.create({
        from: FROM,
        to: `+1${phone}`,
        body: `Hi ${name}! ✅ You're booked for goat practice on ${day} at ${slot}. Reply CANCEL to this number or visit bookgoatpractice.com to cancel. See you there! 🐐`,
      });

      // Text Mimi
      await client.messages.create({
        from: FROM,
        to: `+1${COACH_MIMI}`,
        body: `📋 New booking: ${name} (${phone}) booked ${slot} on ${day}.`,
      });

      // Text Dawna if her number is set
      if (COACH_DAWNA && COACH_DAWNA.length === 10) {
        await client.messages.create({
          from: FROM,
          to: `+1${COACH_DAWNA}`,
          body: `📋 New booking: ${name} (${phone}) booked ${slot} on ${day}.`,
        });
      }

      return callback(null, { success: true, sent: "new_booking notifications" });
    }

    if (eventType === "cancellation") {
      // Text the student
      await client.messages.create({
        from: FROM,
        to: `+1${phone}`,
        body: `Hi ${name}, your goat practice slot (${slot} on ${day}) has been cancelled. That spot is now open for others. Visit bookgoatpractice.com to rebook. 🐐`,
      });

      // Notify coaches
      await client.messages.create({
        from: FROM,
        to: `+1${COACH_MIMI}`,
        body: `❌ Cancellation: ${name} cancelled their ${slot} slot on ${day}. Spot is open.`,
      });

      if (COACH_DAWNA && COACH_DAWNA.length === 10) {
        await client.messages.create({
          from: FROM,
          to: `+1${COACH_DAWNA}`,
          body: `❌ Cancellation: ${name} cancelled their ${slot} slot on ${day}. Spot is open.`,
        });
      }

      return callback(null, { success: true, sent: "cancellation notifications" });
    }

    if (eventType === "reminder_day_before") {
      await client.messages.create({
        from: FROM,
        to: `+1${phone}`,
        body: `👋 Reminder: ${name}, you have goat practice TOMORROW (${day}) at ${slot}. Make sure your dog is ready! Visit bookgoatpractice.com to cancel if needed. 🐐`,
      });
      return callback(null, { success: true, sent: "day-before reminder" });
    }

    if (eventType === "reminder_one_hour") {
      await client.messages.create({
        from: FROM,
        to: `+1${phone}`,
        body: `⏰ 1-hour reminder: ${name}, your goat practice slot is at ${slot} today. See you soon! 🐐`,
      });
      return callback(null, { success: true, sent: "1-hour reminder" });
    }

    return callback(null, { error: "Unknown event type" });

  } catch (err) {
    console.error("Twilio Function error:", err);
    return callback(err);
  }
};
