/*
 * lab-sandbox health page logic (Issue #1).
 *
 * Classic script with no dependencies and no build step. In the browser it
 * fills in the Lisbon date/time and the app version on health.html. In Node it
 * only exports its functions, so tests/health.test.js can exercise them.
 * The static health marker lives in health.html and is never written here.
 */
'use strict';

var LISBON_TIME_ZONE = 'Europe/Lisbon';

var lisbonFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LISBON_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

// Returns "YYYY-MM-DD HH:mm:ss Europe/Lisbon (UTC+HH:MM)" for the given instant,
// independent of the device time zone.
function formatLisbon(date) {
  var parts = {};
  lisbonFormatter.formatToParts(date).forEach(function (part) {
    parts[part.type] = part.value;
  });

  var y = Number(parts.year);
  var mo = Number(parts.month);
  var d = Number(parts.day);
  var h = Number(parts.hour);
  var mi = Number(parts.minute);
  var s = Number(parts.second);

  // Offset = Lisbon wall-clock time read as if it were UTC, minus the real
  // instant (truncated to whole seconds, as the wall-clock parts are).
  var wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  var instant = Math.floor(date.getTime() / 1000) * 1000;
  var offsetMinutes = Math.round((wallAsUtc - instant) / 60000);
  var sign = offsetMinutes < 0 ? '-' : '+';
  var abs = Math.abs(offsetMinutes);

  return parts.year + '-' + parts.month + '-' + parts.day + ' ' +
    parts.hour + ':' + parts.minute + ':' + parts.second + ' ' +
    LISBON_TIME_ZONE + ' (UTC' + sign + pad2(Math.floor(abs / 60)) + ':' + pad2(abs % 60) + ')';
}

// Trims the VERSION file content; empty or missing content becomes "unknown".
function parseVersion(text) {
  if (text === null || text === undefined) {
    return 'unknown';
  }
  var trimmed = String(text).trim();
  return trimmed === '' ? 'unknown' : trimmed;
}

// Loads the same-origin VERSION file. Never rejects: any failure gives "unknown".
async function loadVersion(fetchFn) {
  try {
    var res = await fetchFn('VERSION', { cache: 'no-store' });
    if (!res || !res.ok) {
      return 'unknown';
    }
    return parseVersion(await res.text());
  } catch (err) {
    return 'unknown';
  }
}

function setText(doc, id, value) {
  var el = doc.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

// Fills in #lisbon-time and #version. Never throws.
async function init(doc, now, fetchFn) {
  try {
    var timeText;
    try {
      timeText = formatLisbon(now);
    } catch (err) {
      timeText = 'unavailable';
    }
    setText(doc, 'lisbon-time', timeText);
    setText(doc, 'version', await loadVersion(fetchFn));
  } catch (err) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('health page: could not render all fields');
    }
  }
}

if (typeof module === 'object' && module.exports) {
  module.exports = { formatLisbon, parseVersion, loadVersion, init };
} else if (typeof document !== 'undefined') {
  init(document, new Date(), window.fetch.bind(window));
}
