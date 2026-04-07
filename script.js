/* ============================================================
   L'Oréal Beauty Advisor – script.js
   Features:
     • System prompt focused on L'Oréal topics
     • Conversation history (multi-turn memory)
     • Chat bubble UI (user right, AI left)
     • Typing indicator
     • Sends to Cloudflare Worker endpoint (or falls back to direct OpenAI)
   ============================================================ */

/* ── DOM elements ── */
const chatForm   = document.getElementById("chatForm");
const userInput  = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn    = document.getElementById("sendBtn");
const currentQuestion     = document.getElementById("currentQuestion");
const currentQuestionText = document.getElementById("currentQuestionText");

/* ── Configuration ── */

// 🔁 Replace this URL with your deployed Cloudflare Worker URL
// e.g. "https://loreal-bot.YOUR-SUBDOMAIN.workers.dev"
const CLOUDFLARE_WORKER_URL = "YOUR_CLOUDFLARE_WORKER_URL_HERE";

// Fallback: direct OpenAI (only for local dev via secrets.js)
// secrets.js should contain: const OPENAI_API_KEY = "sk-...";
const OPENAI_DIRECT_URL = "https://api.openai.com/v1/chat/completions";

/* ── System Prompt ── */
const SYSTEM_PROMPT = `You are a knowledgeable and friendly L'Oréal Paris Beauty Advisor. 
Your role is to help customers discover and understand L'Oréal's extensive range of products — 
including makeup, skincare, haircare, and fragrances — and to provide personalized beauty routines 
and recommendations.

Guidelines:
- Only answer questions related to L'Oréal products, beauty routines, skincare, makeup, 
  haircare, fragrance, and general beauty/wellness topics.
- Recommend specific L'Oréal product lines when relevant (e.g., Revitalift, Elvive, True Match, 
  Infallible, Excellence, Lash Paradise, Hyaluron Expert, etc.).
- Offer personalized advice based on skin type, hair type, or beauty goals when the user shares them.
- Be warm, encouraging, and professional — embodying L'Oréal's spirit: "Because You're Worth It."
- If asked about topics unrelated to beauty, L'Oréal, or personal care, politely decline and 
  redirect the conversation. For example: "That's a bit outside my beauty expertise! 
  I'm best suited to help you with L'Oréal products, skincare routines, or beauty tips. 
  What beauty question can I help you with today? ✨"
- Keep responses concise but informative — aim for 3–5 sentences unless a detailed routine is requested.
- Use occasional beauty-related emojis (✨💄🌹🧴💅) to keep the tone friendly and engaging.`;

/* ── Conversation History ── */
// Maintains the full message history for multi-turn context
const conversationHistory = [];

/* ── Helpers ── */

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function appendMessage(role, text) {
  const msgEl = document.createElement("div");
  msgEl.classList.add("msg", role);

  const bubble = document.createElement("div");
  bubble.classList.add("bubble");

  if (role === "ai") {
    const label = document.createElement("span");
    label.classList.add("ai-label");
    label.textContent = "Beauty Advisor";
    bubble.appendChild(label);
  }

  const textNode = document.createTextNode(text);
  bubble.appendChild(textNode);
  msgEl.appendChild(bubble);

  const time = document.createElement("div");
  time.classList.add("msg-time");
  time.textContent = getTime();
  msgEl.appendChild(time);

  chatWindow.appendChild(msgEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showTypingIndicator() {
  const el = document.createElement("div");
  el.classList.add("msg", "ai", "typing-indicator");
  el.id = "typingIndicator";

  const bubble = document.createElement("div");
  bubble.classList.add("bubble");
  [1, 2, 3].forEach(() => {
    const dot = document.createElement("div");
    dot.classList.add("dot");
    bubble.appendChild(dot);
  });

  el.appendChild(bubble);
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

/* ── API Call ── */

async function sendToAI(userMessage) {
  // Add user message to history
  conversationHistory.push({ role: "user", content: userMessage });

  const body = {
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversationHistory
    ],
    max_tokens: 400,
  };

  // Use Cloudflare Worker if URL is set, else fall back to direct OpenAI
  const usingWorker = CLOUDFLARE_WORKER_URL && CLOUDFLARE_WORKER_URL !== "YOUR_CLOUDFLARE_WORKER_URL_HERE";

  const url     = usingWorker ? CLOUDFLARE_WORKER_URL : OPENAI_DIRECT_URL;
  const headers = { "Content-Type": "application/json" };

  if (!usingWorker) {
    // Direct OpenAI call — requires secrets.js with OPENAI_API_KEY defined
    if (typeof OPENAI_API_KEY === "undefined") {
      throw new Error("No API key found. Add your key to secrets.js or set your Cloudflare Worker URL.");
    }
    headers["Authorization"] = `Bearer ${OPENAI_API_KEY}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(usingWorker ? { messages: [{ role: "system", content: SYSTEM_PROMPT }, ...conversationHistory] } : body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const reply = data.choices[0].message.content.trim();

  // Add assistant reply to history for context
  conversationHistory.push({ role: "assistant", content: reply });

  return reply;
}

/* ── Form Submit ── */

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;

  // Clear input and disable button
  userInput.value = "";
  sendBtn.disabled = true;

  // Show current question banner
  currentQuestionText.textContent = message;
  currentQuestion.hidden = false;

  // Show user message
  appendMessage("user", message);

  // Show typing indicator
  showTypingIndicator();

  try {
    const reply = await sendToAI(message);
    removeTypingIndicator();
    appendMessage("ai", reply);
    currentQuestion.hidden = true;
  } catch (error) {
    removeTypingIndicator();
    appendMessage("ai", `⚠️ Sorry, I encountered an issue: ${error.message}. Please try again.`);
    console.error("Chat error:", error);
  } finally {
    sendBtn.disabled = false;
    userInput.focus();
  }
});
