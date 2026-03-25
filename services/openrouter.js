async function listModels(settings) {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: buildHeaders(settings)
  });

  if (!response.ok) {
    throw new Error(`Model request failed with ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data.data) ? data.data : [];
}

async function chatCompletion(payload) {
  try {
    return await sendCompletion(payload.model, payload.messages, payload.temperature, payload.settings);
  } catch (error) {
    if (!shouldRetryWithoutSystem(error)) {
      throw error;
    }
    return sendCompletion(
      payload.model,
      adaptMessagesForSystemLimitedModel(payload.messages),
      payload.temperature,
      payload.settings
    );
  }
}

async function sendCompletion(model, messages, temperature, settings) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: buildHeaders(settings),
    body: JSON.stringify({
      model,
      messages,
      temperature: temperature ?? 0.8
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "No response returned.";
}

function buildHeaders(settings = {}) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${settings.apiKey || ""}`,
    "HTTP-Referer": settings.referer || "app://story-forge",
    "X-OpenRouter-Title": settings.appTitle || "Story Forge"
  };
}

function shouldRetryWithoutSystem(error) {
  const message = String(error?.message || "");
  return message.includes("Developer instruction is not enabled") ||
    message.includes("system message") ||
    message.includes("system instruction");
}

function adaptMessagesForSystemLimitedModel(messages) {
  const systemMessages = messages.filter((message) => message.role === "system").map((message) => message.content.trim());
  const nonSystemMessages = messages.filter((message) => message.role !== "system").map((message) => ({ ...message }));
  if (!systemMessages.length) {
    return nonSystemMessages;
  }

  const merged = `Follow these instructions for the whole conversation:\n${systemMessages.join("\n")}`.trim();
  const firstUserIndex = nonSystemMessages.findIndex((message) => message.role === "user");
  if (firstUserIndex === -1) {
    return [{ role: "user", content: merged }, ...nonSystemMessages];
  }

  nonSystemMessages[firstUserIndex] = {
    ...nonSystemMessages[firstUserIndex],
    content: `${merged}\n\n${nonSystemMessages[firstUserIndex].content}`.trim()
  };
  return nonSystemMessages;
}

module.exports = {
  listModels,
  chatCompletion
};
