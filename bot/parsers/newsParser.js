function cleanNum(value) {
  return Number(String(value).replace(/,/g, ""));
}

function parseNewsLog(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const results = { spyMilitary: [], attacks: [] };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Spy on Military
    if (line.includes("Military Elders of") && line.includes("net Offensive Points")) {
      const coordsMatch = line.match(/(\w[\w\s]+?)\s*\(([^)]+)\),\s*sent/i);

      const spy = {
        coordinates: coordsMatch ? coordsMatch[2] : null,
        province_name: coordsMatch ? coordsMatch[1].trim() : null
      };

      const nameMatch = line.match(/Military Elders of (.+?):/i);
      if (nameMatch) spy.ruler = nameMatch[1].trim();

      const genMatch = line.match(/(\d+) generals? are available/i);
      if (genMatch) spy.generals = cleanNum(genMatch[1]);

      const wagesMatch = line.match(/wages are at ([\d.]+)% of normal/i);
      if (wagesMatch) spy.wages = wagesMatch[1];

      const omeMatch = line.match(/Offense: ([\d.]+)% effectiveness with ([\d,]+) net Offensive Points/i);
      if (omeMatch) {
        spy.ome = omeMatch[1];
        spy.off = cleanNum(omeMatch[2]);
      }

      const dmeMatch = line.match(/Defense: ([\d.]+)% effectiveness with ([\d,]+) net Defensive Points/i);
      if (dmeMatch) {
        spy.dme = dmeMatch[1];
        spy.def = cleanNum(dmeMatch[2]);
      }

      if (spy.off) results.spyMilitary.push(spy);

      continue;
    }


    // Multi-line attack reports
    if (line.includes("Your forces arrive at")) {

      const attackLines = [line];

      while (
        i + 1 < lines.length &&
        !lines[i + 1].includes("Your forces arrive at")
      ) {
        i++;
        attackLines.push(lines[i]);

        if (lines[i].includes("Our forces will be available again")) {
          break;
        }
      }

      const report = attackLines.join(" ");

      const coordsMatch = report.match(/arrive at (.+?)\s*\(([^)]+)\)/i);

      const atk = {
        target_province: coordsMatch ? coordsMatch[1].trim() : null,
        target_kingdom: coordsMatch ? coordsMatch[2] : null
      };

      const acresMatch = report.match(/taken ([\d,]+) acres/i);
      if (acresMatch) atk.acres_captured = cleanNum(acresMatch[1]);

      const buildingsMatch = report.match(/([\d,]+) acres of buildings survived/i);
      if (buildingsMatch) atk.buildings_survived = cleanNum(buildingsMatch[1]);

      const creditsMatch = report.match(/gained ([\d,]+) specialist training credits/i);
      if (creditsMatch) atk.training_credits = cleanNum(creditsMatch[1]);

      const peasantsMatch = report.match(/([\d,]+) peasants settled/i);
      if (peasantsMatch) atk.peasants_gained = cleanNum(peasantsMatch[1]);

      const killsMatch = report.match(/killed about ([\d,]+) enemy troops/i);
      if (killsMatch) atk.kills = cleanNum(killsMatch[1]);

      const lossesMatch = report.match(/lost ([\d,]+) (\w+) and ([\d,]+) (\w+)/i);
      if (lossesMatch) {
        atk.losses = [
          { amount: cleanNum(lossesMatch[1]), unit: lossesMatch[2] },
          { amount: cleanNum(lossesMatch[3]), unit: lossesMatch[4] }
        ];
      }

      const returnMatch = report.match(/available again.*?\(on (.*?)\)/i);
      if (returnMatch) atk.return_time = returnMatch[1];

      const sentMatch = report.match(/sent ([\d,]+)/i);
      if (sentMatch) atk.sent = cleanNum(sentMatch[1]);

      results.attacks.push(atk);

      continue;
    }
  }

  // Parse kingdom news attack format
  // "February 1 of YR0	4 - Daddy Long Legs (3:2) captured 50 acres of land from 5 - Chillas (5:2)."
  // "February 1 of YR0	8 - The Raspberry Rod Stewart (1:2) invaded 23 - Target (3:2) and captured 80 acres"
  for (const line of lines) {
    const kdMatch = line.match(
      /\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)\s*(?:captured \d+ acres of land from \d+\s*-\s*(.+?)\s*\((\d+:\d+)\)|invaded \d+\s*-\s*(.+?)\s*\((\d+:\d+)\) and captured)\s*(\d+)?\s*acres?/i
    );
    if (!kdMatch) {
      // Try: "X (kd) captured N acres from Y (kd)"
      // Clean line — strip date prefix "February X of YRX\t"
      const cleanLine = line.replace(/^.+?YR\d+\s*\t/, '').trim();
      const m2 = cleanLine.match(/^\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)\s*captured\s*(\d+)\s*acres.*?from\s*\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)/i);
      if (m2) {
        results.attacks.push({
          attacker_province: m2[1].trim(),
          attacker_kingdom: m2[2],
          acres_captured: parseInt(m2[3]),
          target_province: m2[4].trim(),
          target_kingdom: m2[5],
          attack_type: 'outgoing',
          source: 'news_log',
        });
      }
      // invaded/ambushed format: "Attacker (kd) invaded/ambushed N - Target (kd) and captured/took N acres"
      const m3 = cleanLine.match(/^(?:\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s*(?:invaded|ambushed armies from)\s*(?:\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s*and (?:captured|took)\s*(\d+)/i);
      if (m3 && !m2) {
        results.attacks.push({
          attacker_province: m3[1].trim(),
          attacker_kingdom: m3[2],
          target_province: m3[3].trim(),
          target_kingdom: m3[4],
          acres_captured: parseInt(m3[5]),
          attack_type: 'incoming',
          source: 'news_log',
        });
      }
      continue;
    }
    results.attacks.push({
      attacker_province: kdMatch[1].trim(),
      attacker_kingdom: kdMatch[2],
      target_province: (kdMatch[3] || kdMatch[5] || '').trim(),
      target_kingdom: kdMatch[4] || kdMatch[6],
      acres_captured: kdMatch[7] ? parseInt(kdMatch[7]) : null,
      attack_type: 'outgoing',
      source: 'news_log',
    });
  }

  return results;
}

module.exports = { parseNewsLog };

async function saveNewsIntel(parsed, submittedBy) {
  const supabaseService = require("../services/supabase");
  const supabase = supabaseService.getClient();

  if (!supabase) {
    return { saved: 0, errors: 0, spyCount: 0, attackCount: 0 };
  }

  let saved = 0;
  let errors = 0;

  for (const atk of parsed.attacks) {
    try {
      const { error } = await supabase.from("attacks").insert({
        timestamp: new Date().toISOString(),
        attacker_province: atk.attacker_province || null,
        target_province: atk.target_province,
        target_kingdom: atk.target_kingdom,
        acres_captured: atk.acres_captured || 0,
        kills: atk.kills || 0,
        buildings_survived: atk.buildings_survived || 0,
        training_credits: atk.training_credits || 0,
        peasants_gained: atk.peasants_gained || 0,
        return_time: atk.return_time || null,
        losses: atk.losses || [],
        sent: atk.sent || 0,
        submitted_by: submittedBy,
        message_id: `news_${Date.now()}_${Math.random().toString(36).slice(2)}`
      });

      if (error) throw error;

      saved++;

    } catch (e) {
      console.error("[NEWS ATTACK SAVE ERROR]", e.message);
      errors++;
    }
  }

  return {
    saved,
    errors,
    spyCount: parsed.spyMilitary.length,
    attackCount: parsed.attacks.length
  };
}

module.exports = { parseNewsLog, saveNewsIntel };
