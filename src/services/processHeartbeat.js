const HEARTBEAT_PREFIX = 'ride-booking:health:';
const HEARTBEAT_TTL_SECONDS = 30;
const HEARTBEAT_INTERVAL_MS = 10_000;

function heartbeatKey(processName) {
  return `${HEARTBEAT_PREFIX}${processName}`;
}

async function writeHeartbeat(client, processName) {
  await client.set(heartbeatKey(processName), Date.now().toString(), { EX: HEARTBEAT_TTL_SECONDS });
}

async function clearHeartbeat(client, processName) {
  await client.del(heartbeatKey(processName));
}

function startHeartbeat(client, processName) {
  let stopped = false;
  let writing = false;
  const tick = async () => {
    if (stopped || writing) return;
    writing = true;
    try {
      await writeHeartbeat(client, processName);
    } catch (error) {
      console.error(`${processName} heartbeat update failed (${error.code || error.name || 'error'})`);
    } finally {
      writing = false;
    }
  };

  void tick();
  const timer = setInterval(tick, HEARTBEAT_INTERVAL_MS);
  timer.unref();
  return async () => {
    stopped = true;
    clearInterval(timer);
    try {
      await clearHeartbeat(client, processName);
    } catch (error) {
      console.error(`${processName} heartbeat cleanup failed (${error.code || error.name || 'error'})`);
    }
  };
}

module.exports = {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TTL_SECONDS,
  HEARTBEAT_PREFIX,
  startHeartbeat,
};
