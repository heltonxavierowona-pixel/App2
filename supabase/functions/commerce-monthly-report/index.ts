// Envoi automatique des rapports mensuels de NUMERA COMMERCIAL AI.
// Appelée par une tâche planifiée au début de chaque mois : rejoue le journal de chaque boutique,
// puis envoie le rapport de la boutique à ses gérants et un rapport général à chaque patron.
// Sans danger à appeler plusieurs fois : chaque destinataire ne reçoit qu'un rapport par mois.
//
// La logique métier est la même que celle de l'application : elle est chargée depuis le dépôt,
// à une version figée (identifiant de commit). Après une modification de src/lib/logic.js,
// overview.js ou monthly-email.js, mettre à jour cet identifiant et redéployer la fonction.
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";
import { applyOp, emptyState } from "https://raw.githubusercontent.com/heltonxavierowona-pixel/App2/5e2b378d1722a3ede200bcf080eb78d8dec6633a/src/lib/logic.js";
import { previousMonthKey } from "https://raw.githubusercontent.com/heltonxavierowona-pixel/App2/5e2b378d1722a3ede200bcf080eb78d8dec6633a/src/lib/overview.js";
import { buildEmails } from "https://raw.githubusercontent.com/heltonxavierowona-pixel/App2/5e2b378d1722a3ede200bcf080eb78d8dec6633a/src/lib/monthly-email.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async () => {
  // Envoi par Gmail : adresse Google et mot de passe d'application (jamais le mot de passe du compte).
  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s+/g, "");
  if (!user || !pass) return json({ skipped: "not_configured", logic_loaded: typeof applyOp === "function" && typeof buildEmails === "function" });

  // Fuseau des boutiques par rapport à UTC (1 = Afrique de l'Ouest et centrale).
  const offset = Number(Deno.env.get("REPORT_UTC_OFFSET_HOURS") ?? "1");
  const month = previousMonthKey(new Date(), offset);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const [shopsRes, membersRes, logRes] = await Promise.all([
    db.from("commerce_shops").select("id, name, currency"),
    db.from("commerce_members").select("shop_id, email, role"),
    db.from("commerce_report_log").select("recipient, scope").eq("month", month),
  ]);
  if (shopsRes.error || membersRes.error || logRes.error) return json({ error: "Lecture impossible." }, 500);

  const done = new Set(logRes.data.map((l) => `${l.recipient}|${l.scope}`));
  const members = membersRes.data;
  const expected = [
    ...members.filter((m) => m.role === "manager").map((m) => `${m.email}|${m.shop_id}`),
    ...new Set(members.filter((m) => m.role === "owner").map((m) => `${m.email}|general`)),
  ];
  if (expected.every((k) => done.has(k))) return json({ month, sent: 0, already_done: true });

  const shops = [];
  for (const shop of shopsRes.data) {
    let state = emptyState(shop.name, shop.currency);
    let after = 0;
    for (;;) {
      const { data, error } = await db.from("commerce_ops")
        .select("seq, id, user_name, register, action, payload, ts")
        .eq("shop_id", shop.id).gt("seq", after).order("seq").limit(1000);
      if (error) return json({ error: "Lecture du journal impossible." }, 500);
      for (const op of data) {
        try {
          state = applyOp(state, { id: op.id, ts: op.ts, user: op.user_name, register: op.register ?? "", action: op.action, payload: op.payload }, { lenient: true });
        } catch { /* opération ignorée, comme dans l'application */ }
      }
      if (data.length < 1000) break;
      after = data[data.length - 1].seq;
    }
    const of = (role: string) => members.filter((m) => m.shop_id === shop.id && m.role === role).map((m) => m.email);
    shops.push({ ...shop, state, owners: of("owner"), managers: of("manager") });
  }

  // Port 465 (connexion chiffrée) : les ports 25 et 587 sont fermés pour les fonctions Supabase.
  const mailer = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  let sent = 0;
  const failed: string[] = [];
  for (const email of buildEmails(shops, month, offset)) {
    if (done.has(`${email.to}|${email.scope}`)) continue;
    // On réserve l'envoi avant d'envoyer : deux appels simultanés ne produisent qu'un e-mail.
    const claim = await db.from("commerce_report_log").insert({ month, recipient: email.to, scope: email.scope });
    if (claim.error) continue;
    try {
      await mailer.sendMail({
        from: { name: "NUMERA COMMERCIAL AI", address: user },
        to: email.to,
        subject: email.subject,
        html: email.html,
      });
      sent += 1;
    } catch (error) {
      failed.push(String((error as { responseCode?: number; code?: string }).responseCode ?? (error as { code?: string }).code ?? "erreur"));
      await db.from("commerce_report_log").delete().match({ month, recipient: email.to, scope: email.scope });
    }
  }
  return json({ month, sent, failed: failed.length, statuses: [...new Set(failed)] });
});
