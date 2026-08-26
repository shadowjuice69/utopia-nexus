const { parseChannelMessage } = require('../parsers/intelChannelParser');

function clean(text) {
  return String(text || '').replace(/[\u0000-\u001F\uFFFD]/g, ' ').replace(/\s+/g, ' ').trim();
}

function number(value) {
  if (value == null) return null;
  const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

// Intel 7 operations intentionally has no dependency on the legacy opsParser.
// It preserves the complete message and extracts the common Utopia province/kingdom/result fields.
function parseThieves(text) {
  const raw = clean(text);
  if (!raw) return null;

  const actor = raw.match(/^#?\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)/i);
  const target = raw.match(/(?:from|on|against|at)\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)/i);
  const operation = raw.match(/\b(performed|attempted|used|executed|conducted)\s+(.+?)(?=\s+(?:on|against|at|from)\b|\.|$)/i);
  const result = raw.match(/(?:stole|looted|captured|destroyed|killed|lost|gained|stole)\s+([\d,]+)\s+([A-Za-z][A-Za-z ]*?)(?=\s+(?:from|on|and|\.|$))/i);
  const success = !/failed|fails|unsuccessful|thwarted|caught|nothing was stolen/i.test(raw);

  return {
    type: 'thieves_operation',
    attackerProvince: actor?.[1]?.trim() || null,
    attackerKingdom: actor?.[2] || null,
    targetProvince: target?.[1]?.trim() || null,
    targetKingdom: target?.[2] || null,
    operation: operation?.[2]?.trim() || null,
    resultValue: number(result?.[1]),
    resultType: result?.[2]?.trim().toLowerCase() || null,
    success,
    raw
  };
}

function parse(channelType, id, content, timestamp) {
  if (channelType === 'ops') {
    const events = [];
    for (const chunk of String(content || '').split(/\n(?=#?\d+\s*-)/)) {
      const event = parseThieves(chunk);
      if (event) events.push({ ...event, messageId: id, timestamp });
    }
    return events;
  }
  return parseChannelMessage({ channelType, id, content, timestamp });
}

module.exports = { parse };
