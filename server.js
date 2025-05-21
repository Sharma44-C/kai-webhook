const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Your Gemini API key and endpoint
const API_KEY = "AIzaSyBIwMPbZLff8ZfcYGJedr_bFl0i9MzMXKk";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// Facebook credentials
const VERIFY_TOKEN = "14112010"; // Set this and match it in your Facebook app
const PAGE_ACCESS_TOKEN = "EAARhCo9ZBSN0BOzZCr5RF3fKW4iAC6ADOsa08RevxYH82D2P5EryC9JZBmSzGWxkufYrCwZArFNgiEKM82YUpqr7oL2UtqFMUts7Wc3XXE8fBbciDWVIh09eDs0ZAIXRjwIVAMN8VsmoSc7zU2aCKKBbDDz4oNH8hVgAIybfehgJMh4PmAeirV1VV0V3jzQZDZD"; // Get this from Facebook page settings

// In-memory session store
const sessions = {};

const kaiIntro = "Yo! I'm Kai — your spicy chat bro, crafted by the Free Fire pro and coding genius Sharma Zambara who was taught coding by Frank Kaumba. Let’s get chatting!";

// Gemini chat endpoint
app.post("/chat", async (req, res) => {
  const { prompt, sessionId } = req.body;

  if (!prompt || !sessionId) {
    return res.status(400).json({ message: "Missing 'prompt' or 'sessionId'" });
  }

  if (!sessions[sessionId]) {
    sessions[sessionId] = [
      {
        role: "model",
        parts: [{ text: kaiIntro }],
      }
    ];
  }

  sessions[sessionId].push({
    role: "user",
    parts: [{ text: prompt }],
  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: sessions[sessionId] }),
    });

    const data = await response.json();

    if (!data.candidates || !data.candidates.length) {
      throw new Error("No response from Gemini API");
    }

    const botReply = data.candidates[0].content.parts[0].text;

    sessions[sessionId].push({
      role: "model",
      parts: [{ text: botReply }],
    });

    res.json({ message: botReply });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Oops! Kai's having a brain freeze. Try again!" });
  }
});

// Facebook Webhook Verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WEBHOOK_VERIFIED");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Facebook Message Handling
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    for (const entry of body.entry) {
      const webhookEvent = entry.messaging[0];
      const senderId = webhookEvent.sender.id;

      if (webhookEvent.message && webhookEvent.message.text) {
        const userMessage = webhookEvent.message.text.trim();
        const lowerMessage = userMessage.toLowerCase();

        try {
          // Detect if the message contains photo/image/picture
          if (
            lowerMessage.includes("image") ||
            lowerMessage.includes("photo") ||
            lowerMessage.includes("picture")
          ) {
            const imagePrompt = userMessage;
            const imageUrl = `https://www.smfahim.xyz/creartai?prompt=${encodeURIComponent(imagePrompt)}`;

            // First send confirmation message
            await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipient: { id: senderId },
                message: { text: "Here is your image 👌" },
              }),
            });

            // Then send the image
            await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipient: { id: senderId },
                message: {
                  attachment: {
                    type: "image",
                    payload: {
                      url: imageUrl,
                      is_reusable: true,
                    },
                  },
                },
              }),
            });
          } else {
            // Default Gemini AI response
            const aiRes = await fetch(`http://localhost:${PORT}/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: userMessage, sessionId: senderId }),
            });

            const aiData = await aiRes.json();
            const reply = aiData.message;

            await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipient: { id: senderId },
                message: { text: reply },
              }),
            });
          }
        } catch (err) {
          console.error("Messenger error:", err);
        }
      }
    }

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});