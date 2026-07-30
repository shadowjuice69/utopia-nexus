function parseNewsLine(line) {
  const dateMatch = line.match(/^([A-Za-z]+ \d+ of YR\d+)[\t ]+(.+)$/);
  if (!dateMatch) return null;
  const date = dateMatch[1];
  const text = dateMatch[2].trim();

  let m;

  // Outgoing attack - traditional march (captured acres)
  m = text.match(/Your forces arrive at (.+?) \((\d+:\d+)\).+?taken (\d+) acres/);
  if (m) {
    const ev = { date, event_type: "outgoing_attack", defender_name: m[1], defender_kd: m[2], acres: parseInt(m[3]) };
    const cm = text.match(/gained (\d[\d,]*) specialist training credits/);
    if (cm) ev.credits_gained = parseInt(cm[1].replace(/,/g,""));
    const pm = text.match(/(\d[\d,]*) peasants settled/);
    if (pm) ev.peasants_settled = parseInt(pm[1].replace(/,/g,""));
    const bm = text.match(/(\d[\d,]*) acres of buildings survived/);
    if (bm) ev.buildings_survived = parseInt(bm[1].replace(/,/g,""));
    return ev;
  }

  // Outgoing attack - recapture/ambush (recaptured acres)
  m = text.match(/Your forces arrive at (.+?) \((\d+:\d+)\).+?recaptured (\d+) acres/);
  if (m) return { date, event_type: "outgoing_ambush", defender_name: m[1], defender_kd: m[2], acres: parseInt(m[3]) };

  // Outgoing attack - failed
  m = text.match(/Your forces arrive at (.+?) \((\d+:\d+)\).+?repelled/);
  if (m) return { date, event_type: "outgoing_failed", defender_name: m[1], defender_kd: m[2], acres: 0 };

  // KD News - invasion captured acres
  m = text.match(/^(\d+) - (.+?) \((\d+:\d+)\) invaded (\d+) - (.+?) \((\d+:\d+)\) and captured (\d+) acres/);
  if (m) return { date, event_type: "kd_invasion", attacker_name: m[2], attacker_kd: m[3], defender_name: m[5], defender_kd: m[6], acres: parseInt(m[7]) };

  m = text.match(/^(\d+) - (.+?) \((\d+:\d+)\) captured (\d+) acres of land from (\d+) - (.+?) \((\d+:\d+)\)/);
  if (m) return { date, event_type: "kd_invasion", attacker_name: m[2], attacker_kd: m[3], defender_name: m[6], defender_kd: m[7], acres: parseInt(m[4]) };

  m = text.match(/^(\d+) - (.+?) \((\d+:\d+)\) ambushed armies from (\d+) - (.+?) \((\d+:\d+)\) and took (\d+) acres/);
  if (m) return { date, event_type: "kd_ambush", attacker_name: m[2], attacker_kd: m[3], defender_name: m[5], defender_kd: m[6], acres: parseInt(m[7]) };

  m = text.match(/^(\d+) - (.+?) \((\d+:\d+)\) invaded and pillaged (\d+) - (.+?) \((\d+:\d+)\)/);
  if (m) return { date, event_type: "kd_pillage", attacker_name: m[2], attacker_kd: m[3], defender_name: m[5], defender_kd: m[6], acres: 0 };

  m = text.match(/^(\d+) - (.+?) \((\d+:\d+)\) attacked and pillaged the lands of (\d+) - (.+?) \((\d+:\d+)\)/);
  if (m) return { date, event_type: "kd_pillage", attacker_name: m[2], attacker_kd: m[3], defender_name: m[5], defender_kd: m[6], acres: 0 };

  m = text.match(/^(\d+) - (.+?) \((\d+:\d+)\) attempted an? invasion of (\d+) - (.+?) \((\d+:\d+)\)/);
  if (m) return { date, event_type: "kd_failed", attacker_name: m[2], attacker_kd: m[3], defender_name: m[5], defender_kd: m[6], acres: 0 };

  m = text.match(/^(\d+) - (.+?) \((\d+:\d+)\) invaded and looted ([\d,]+) books from (\d+) - (.+?) \((\d+:\d+)\)/);
  if (m) return { date, event_type: "kd_loot", attacker_name: m[2], attacker_kd: m[3], defender_name: m[6], defender_kd: m[7], acres: 0 };

  // Province News - incoming
  m = text.match(/Forces from (\d+) - (.+?) \((\d+:\d+)\) came through and ravaged our lands! They captured (\d+) acres/);
  if (m) return { date, event_type: "incoming_attack", attacker_name: m[2], attacker_kd: m[3], acres: parseInt(m[4]) };

  m = text.match(/Forces from (\d+) - (.+?) \((\d+:\d+)\) ambushed one of our armies. They recaptured (\d+) acres/);
  if (m) return { date, event_type: "incoming_ambush", attacker_name: m[2], attacker_kd: m[3], acres: parseInt(m[4]) };

  m = text.match(/We have found thieves from (.+?) \((\d+:\d+)\) causing trouble/);
  if (m) return { date, event_type: "incoming_thief", attacker_name: m[1], attacker_kd: m[2], acres: 0 };

  m = text.match(/([\d,]+) bushels were stolen from our granaries/);
  if (m) return { date, event_type: "stolen_food", food_stolen: parseInt(m[1].replace(/,/g,"")), acres: 0, raw: text };

  m = text.match(/([\d,]+) gold coins? were stolen from our coffers/);
  if (m) return { date, event_type: "stolen_gold", gold_stolen: parseInt(m[1].replace(/,/g,"")), acres: 0, raw: text };

  // Province Logs - science
  m = text.match(/([\d,]+) books allocated to ([A-Z]+)/);
  if (m) return { date, event_type: "science_allocation", acres: 0, raw: text };

  // Province Logs - self spells
  m = text.match(/Your wizards gather.+spell succeeds\. (.+)$/);
  if (m) return { date, event_type: "self_spell", acres: 0, raw: text };

  m = text.match(/Your wizards gather.+spell fails/);
  if (m) return { date, event_type: "self_spell_fail", acres: 0, raw: text };

  // Generic log line
  return { date, event_type: "log", acres: 0, raw: text };
}

function parseContinuationLine(line, event) {
  if (!event) return false;
  let m;

  // "We lost 89 Warriors and 89 horses in this battle."
  m = line.match(/^We lost (.+?) in this battle/);
  if (m) {
    event.troops_lost = event.troops_lost || {};
    m[1].split(/ and |, /).forEach(part => {
      const lm = part.trim().match(/([\d,]+) ([A-Za-z ]+)/);
      if (lm) event.troops_lost[lm[2].trim().toLowerCase().replace(/\s+/g,"_")] = parseInt(lm[1].replace(/,/g,""));
    });
    return true;
  }

  // "We killed about 116 enemy troops."
  m = line.match(/^We killed about ([\d,]+)/);
  if (m) { event.troops_killed = parseInt(m[1].replace(/,/g,"")); return true; }

  // "We gained 122 specialist training credits."
  m = line.match(/gained ([\d,]+) specialist training credits/);
  if (m) { event.credits_gained = parseInt(m[1].replace(/,/g,"")); return true; }

  // "43 acres of buildings survived"
  m = line.match(/([\d,]+) acres of buildings survived/);
  if (m) { event.buildings_survived = parseInt(m[1].replace(/,/g,"")); return true; }

  // "481 peasants settled on your new lands."
  m = line.match(/([\d,]+) peasants settled/);
  if (m) { event.peasants_settled = parseInt(m[1].replace(/,/g,"")); return true; }

  // "Our forces will be available again in 13.72 days (on April 13 of YR0). (Target (kd), sent 35828)"
  m = line.match(/available again in ([\d.]+) days \(on (.+?)\)\.\s*\((.+?),\s*sent ([\d,]+)\)/);
  if (m) {
    event.return_days = parseFloat(m[1]);
    event.return_date = m[2].trim();
    event.troops_sent = parseInt(m[4].replace(/,/g,""));
    return true;
  }

  return false;
}

function parseNews(text, sourceProvince) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const events = [];
  let lastEvent = null;

  for (const line of lines) {
    // Try continuation first
    if (lastEvent && parseContinuationLine(line, lastEvent)) continue;

    const parsed = parseNewsLine(line);
    if (parsed) {
      lastEvent = {
        ...parsed,
        source_province: sourceProvince || null,
        created_at: new Date().toISOString(),
      };
      events.push(lastEvent);
    } else {
      lastEvent = null;
    }
  }

  return events;
}

module.exports = { parseNews };
