// Assistant NUMERA COMMERCIAL AI : répond aux questions du commerçant à partir du résumé
// chiffré de sa boutique. La clé de l'API reste côté serveur (secret ANTHROPIC_API_KEY).
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `Tu es l'assistant de NUMERA COMMERCIAL AI, un logiciel de gestion pour petits commerces en Afrique francophone.
Tu réponds au commerçant en français simple et direct, comme un conseiller de confiance qui connaît ses chiffres.
Tu disposes d'un résumé chiffré de sa boutique au format JSON. Appuie-toi uniquement sur ces données : si une
information n'y figure pas, dis-le plutôt que de l'inventer. Les marges et bénéfices sont des estimations
calculées à partir des prix d'achat saisis. Donne les montants avec la devise de la boutique.
Réponds en quelques phrases, ou une courte liste quand il y a plusieurs éléments, sans mise en forme Markdown.
Quand c'est utile, termine par une action concrète à faire.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "L'assistant en ligne n'est pas configuré.", code: "not_configured" }, 503);

  let body: { shopId?: string; question?: string; context?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Requête invalide." }, 400); }
  const question = String(body.question ?? "").trim().slice(0, 1000);
  if (!question || !body.shopId || !body.context) return json({ error: "Requête incomplète." }, 400);
  const context = JSON.stringify(body.context);
  if (context.length > 200_000) return json({ error: "Données trop volumineuses." }, 413);

  // Seuls les patrons de la boutique peuvent interroger l'assistant.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: role, error: roleError } = await supabase.rpc("my_role", { shop: body.shopId });
  if (roleError || role !== "owner") return json({ error: "Accès refusé." }, 403);

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `Données de la boutique :\n${context}\n\nQuestion du commerçant : ${question}`,
      }],
    });
    if (response.stop_reason === "refusal") return json({ error: "Je ne peux pas répondre à cette question." }, 422);
    const answer = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    if (!answer) return json({ error: "Réponse vide." }, 502);
    return json({ answer });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json({ error: "Clé de l'assistant invalide.", code: "not_configured" }, 503);
    if (error instanceof Anthropic.RateLimitError) return json({ error: "L'assistant est très sollicité, réessayez dans un instant." }, 429);
    if (error instanceof Anthropic.APIError) return json({ error: "L'assistant est momentanément indisponible." }, 502);
    return json({ error: "Erreur inattendue." }, 500);
  }
});
