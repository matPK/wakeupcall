function nowIso() {
  return new Date().toISOString();
}

function info(message, extra) {
  if (extra === undefined) {
    console.log(`${nowIso()} INFO ${message}`);
    return;
  }
  console.log(`${nowIso()} INFO ${message}`, extra);
}

function warn(message, extra) {
  if (extra === undefined) {
    console.warn(`${nowIso()} WARN ${message}`);
    return;
  }
  console.warn(`${nowIso()} WARN ${message}`, extra);
}

function error(message, extra) {
  if (extra === undefined) {
    console.error(`${nowIso()} ERROR ${message}`);
    return;
  }
  console.error(`${nowIso()} ERROR ${message}`, extra);
}

module.exports = { info, warn, error };
