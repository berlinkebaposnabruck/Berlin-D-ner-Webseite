
const { getStore } = require("@netlify/blobs");

const STAFF_PASSWORD = "0021";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const store = getStore("berlin-doener-menu");

  if (event.httpMethod === "GET") {
    try {
      const data = await store.get("current", { type: "json" });
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
      if (payload.password !== STAFF_PASSWORD) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: "Falsches Passwort." }),
        };
      }
      if (!Array.isArray(payload.items)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Ungültige Daten." }),
        };
      }
      await store.setJSON("current", {
        items: payload.items,
        updatedAt: new Date().toISOString(),
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Serverfehler: " + err.message }),
      };
    }
  }

  return { statusCode: 405, headers, body: "Method Not Allowed" };
};
