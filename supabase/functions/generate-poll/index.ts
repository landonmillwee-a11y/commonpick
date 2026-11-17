// CommonPick AI poll generator. The OpenAI key is stored only as a Supabase secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://commonpick.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }
  if (request.headers.get("origin") !== "https://commonpick.vercel.app") {
    return jsonResponse({ error: "This request origin is not allowed." }, 403);
  }

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token || token === authorization) {
    return jsonResponse({ error: "Sign in as the CommonPick administrator first." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !supabaseKey || !openAiKey) {
    return jsonResponse({ error: "The generator is not fully configured. Check its Supabase secrets." }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || user?.email?.toLowerCase() !== "landonmillwee@gmail.com") {
    return jsonResponse({ error: "Only the CommonPick administrator can generate polls." }, 403);
  }

  let body: { topic?: unknown; category?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Send a valid topic and category." }, 400);
  }
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim().slice(0, 40) : "COMMUNITY";
  if (topic.length < 3 || topic.length > 120) {
    return jsonResponse({ error: "Topic must be between 3 and 120 characters." }, 400);
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      category: { type: "string" },
      choices: { type: "array", items: { type: "string" } }
    },
    required: ["title", "description", "category", "choices"]
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-6-luna",
        store: false,
        max_output_tokens: 1200,
        input: [
          {
            role: "system",
            content: "You create high-quality CommonPick community polls. Write neutral, clear, engaging questions that ordinary people can answer. Do not create leading or loaded questions. Provide 6 to 10 distinct, mutually exclusive answer choices that cover the most likely answers without needless overlap. Keep each choice concise (90 characters max). The title must be 140 characters max, description 300 characters max, and category 40 characters max. Return only the requested structured data."
          },
          {
            role: "user",
            content: `Create one ready-to-review community poll about this topic: ${topic}\nSuggested category: ${category}.\nUse the suggested category unless a clearer short category is needed. Avoid duplicate or near-duplicate choices. Make the poll understandable without extra context.`
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "commonpick_poll",
            strict: true,
            schema
          }
        }
      })
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("OpenAI Responses API error:", result);
      return jsonResponse({ error: "The AI service could not generate the poll. Check the API key and billing, then try again." }, 502);
    }

    const outputText = result.output_text || (result.output || [])
      .flatMap((item: any) => item.content || [])
      .find((item: any) => item.type === "output_text")?.text;
    if (!outputText) {
      return jsonResponse({ error: "The AI service returned an empty response. Please try again." }, 502);
    }

    const poll = JSON.parse(outputText);
    const choices = Array.isArray(poll.choices)
      ? poll.choices.map((choice: unknown) => String(choice).trim()).filter(Boolean)
      : [];
    const uniqueChoices = [...new Map(choices.map((choice: string) => [choice.toLowerCase(), choice])).values()];
    if (
      typeof poll.title !== "string" || !poll.title.trim() || poll.title.length > 140 ||
      typeof poll.description !== "string" || poll.description.length > 300 ||
      uniqueChoices.length < 2 || uniqueChoices.length > 40 ||
      uniqueChoices.some((choice: string) => choice.length > 90)
    ) {
      return jsonResponse({ error: "The AI response did not meet CommonPick's poll requirements. Please generate again." }, 502);
    }

    return jsonResponse({
      title: poll.title.trim(),
      description: poll.description.trim(),
      category: (typeof poll.category === "string" && poll.category.trim() ? poll.category : category).trim().slice(0, 40).toUpperCase(),
      choices: uniqueChoices
    });
  } catch (error) {
    console.error("Poll generation failed:", error);
    return jsonResponse({ error: "Poll generation failed. Please try again." }, 500);
  }
});
