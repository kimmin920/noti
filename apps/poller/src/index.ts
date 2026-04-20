const intervalSeconds = Number(process.env.RESULT_POLLER_INTERVAL_SECONDS || 120);

function logDirectLookupMode() {
  console.log('[poller] delivery result persistence is disabled; v2 reads NHN results directly');
}

setInterval(logDirectLookupMode, intervalSeconds * 1000);
logDirectLookupMode();

