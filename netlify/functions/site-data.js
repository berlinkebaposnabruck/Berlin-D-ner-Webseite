const { getStore } = require("@netlify/blobs");

// Same password as the staff area / menu editor.
const STAFF_PASSWORD = "0021";

// Which "keys" (stores) this function is allowed to touch, and whether writing
// to them requires the staff password. "messages" is special: customers can
// APPEND to it without a password (that's how the contact form works), but
// nobody can overwrite the whole list without the password.
const KEYS = {
  hours: { needsPasswordToWrite: true },
  announcement: { needsPasswordToWrite: true },
  messages: { needsPasswordToWrite: false, isAppendOnlyList: true },
};

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const store = getStore("berlin-doener-site-data");

  if (event.httpMethod === "GET") {
    const key = (event.queryStringParameters || {}).key;
    if (!KEYS[key]) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Unbekannter Schlüssel." }) };
    }
    try {
      const data = await store.get(key, { type: "json" });
      return {
        statusCode: 200,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(data || null),
      };
    } catch (err) {
      return {
        statusCode: 200,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(null),
      };
    }
  }

  if (event.httpMethod === "POST") {
    try {
      const payload = JSON.parse(event.body || "{}");
      const key = payload.key;
      const config = KEYS[key];
      if (!config) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Unbekannter Schlüssel." }) };
      }

      if (config.isAppendOnlyList) {
        // Customer contact form: anyone can append, nobody can overwrite via this path.
        const existing = (await store.get(key, { type: "json" })) || { items: [] };
        const items = Array.isArray(existing.items) ? existing.items : [];
        items.unshift({
          ...payload.value,
          id: "msg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
          receivedAt: new Date().toISOString(),
        });
        // Keep at most the latest 200 messages so storage stays small.
        const trimmed = items.slice(0, 200);
        await store.setJSON(key, { items: trimmed, updatedAt: new Date().toISOString() });

        // Optional: also send a real email notification if the site owner has
        // configured a free Resend.com API key as the RESEND_API_KEY
        // environment variable in Netlify. If it's not set, this is silently
        // skipped and the message is still saved above for the staff panel.
        if (process.env.RESEND_API_KEY) {
          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: "Bearer " + process.env.RESEND_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "Berlin Döner Website <onboarding@resend.dev>",
                to: ["berlinkebaposnabruck@gmail.com"],
                subject: "Neue Nachricht von der Website",
                text:
                  "Name: " + (payload.value.name || "-") +
                  "\nE-Mail: " + (payload.value.email || "-") +
                  "\n\nNachricht:\n" + (payload.value.message || "-"),
              }),
            });
          } catch (mailErr) {
            // Never fail the request just because the email attempt failed.
          }
        }

        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }

      if (config.needsPasswordToWrite && payload.password !== STAFF_PASSWORD) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: "Falsches Passwort." }) };
      }

      await store.setJSON(key, { value: payload.value, updatedAt: new Date().toISOString() });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Serverfehler: " + err.message }) };
    }
  }

  return { statusCode: 405, headers, body: "Method Not Allowed" };
};
