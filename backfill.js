// backfill.js — re-parses raw attack messages and updates intel7_events
const { createClient } = require("@supabase/supabase-js");
const { parseIntel7 } = require("./bot/intel7/parsers");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function backfill() {
  console.log("Fetching attack events...");
  const { data: events, error } = await supabase
    .from("intel7_events")
    .select("id, message_id, raw, raw_content, channel_type")
    .eq("channel_type", "attacks")
    .order("id");

  if (error) { console.error("Fetch error:", error.message); process.exit(1); }
  console.log(`Found ${events.length} attack events to backfill`);

  let updated = 0, skipped = 0;

  for (const event of events) {
    const raw = event.raw || event.raw_content;
    if (!raw) { skipped++; continue; }

    const parsed = parseIntel7("attacks", raw);
    if (!parsed.length) { skipped++; continue; }

    const p = parsed[0];

    const { error: updateError } = await supabase
      .from("intel7_events")
      .update({
        attacker_province: p.attackerProvince || null,
        attacker_kingdom: p.attackerKingdom || null,
        target_province: p.targetProvince || null,
        target_kingdom: p.targetKingdom || null,
        amount: p.acresCaptured ?? null,
        success: p.success ?? null,
        data: {
          ...p,
          acres_captured: p.acresCaptured ?? null,
          credits: p.credits ?? null,
          peasants: p.peasants ?? null,
          kills: p.kills ?? null,
          imprisoned: p.imprisoned ?? null,
          troops_lost: p.troopsLost ?? null,
          return_days: p.returnDays ?? null,
          enemy_defense: p.enemyDefense ?? null,
        },
      })
      .eq("id", event.id);

    if (updateError) {
      console.error(`Error updating ${event.id}:`, updateError.message);
    } else {
      updated++;
      if (p.attackerProvince) {
        console.log(`✓ ${p.attackerProvince} (${p.attackerKingdom}) → ${p.targetProvince} (${p.targetKingdom}) | ${p.acresCaptured ?? "?"} acres`);
      }
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
}

backfill();
