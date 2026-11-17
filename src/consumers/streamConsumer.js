const { createRedisClient } = require('../config/redis');
const { RIDE_EVENTS_STREAM } = require('../events/constants');
const { startHeartbeat } = require('../services/processHeartbeat');

const BATCH_SIZE = 10;
const BLOCK_MS = 5000;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sanitizeLogValue(value) {
  return String(value ?? '')
    .replace(/\b(?:rediss?|https?):\/\/[^\s"'`<>]+/gi, '[REDACTED_URL]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(["']?(?:password|passwd|token|secret|authorization|credential|api[_-]?key)["']?\s*[:=]\s*["']?)[^"',\s;}]+["']?/gi, '$1[REDACTED]')
    .slice(0, 300);
}

function readErrorDetails(error) {
  return {
    code: sanitizeLogValue(error?.code || 'unavailable'),
    name: sanitizeLogValue(error?.name || 'Error'),
    message: sanitizeLogValue(error?.message || 'No error message'),
  };
}

async function ensureConsumerGroup(client, groupName) {
  try {
    await client.xGroupCreate(RIDE_EVENTS_STREAM, groupName, '0', { MKSTREAM: true });
  } catch (error) {
    if (!String(error.message).includes('BUSYGROUP')) throw error;
    console.log(`${groupName}: consumer group already exists`);
  }
}

function getMessages(streams) {
  return (streams || []).flatMap((stream) => stream.messages || []);
}

async function processMessages(client, groupName, messages) {
  const processedKey = `${RIDE_EVENTS_STREAM}:processed:${groupName}`;

  for (const message of messages) {
    const event = message.message;
    if (!event.eventId) {
      throw new Error(`Stream entry ${message.id} has no eventId`);
    }

    const alreadyProcessed = await client.sIsMember(processedKey, event.eventId);
    if (!alreadyProcessed) {
      console.log(`[${groupName}] received ${JSON.stringify(event)}`);
      await client.sAdd(processedKey, event.eventId);
    }

    await client.xAck(RIDE_EVENTS_STREAM, groupName, message.id);
  }
}

async function startStreamConsumer(groupName) {
  const consumerName = `${groupName}-consumer`;
  const client = createRedisClient(groupName);
  let stopping = false;
  let stopHeartbeat;
  const shutdown = (signal) => {
    console.log(`${groupName}: ${signal} received; stopping subscriber`);
    stopping = true;
  };

  const handleSigint = () => shutdown('SIGINT');
  const handleSigterm = () => shutdown('SIGTERM');
  process.once('SIGINT', handleSigint);
  process.once('SIGTERM', handleSigterm);

  try {
    await client.connect();
    await ensureConsumerGroup(client, groupName);
    stopHeartbeat = startHeartbeat(client, groupName === 'billing-service'
      ? 'billing-subscriber'
      : 'operations-subscriber');
    console.log(`${groupName}: listening on ${RIDE_EVENTS_STREAM}`);

    while (!stopping) {
      let phase = 'pending read';
      try {
        const pending = await client.xReadGroup(
          groupName,
          consumerName,
          [{ key: RIDE_EVENTS_STREAM, id: '0' }],
          { COUNT: BATCH_SIZE },
        );
        const pendingMessages = getMessages(pending);
        console.log(`${groupName}: pending XREADGROUP succeeded; messages=${pendingMessages.length}`);
        if (pendingMessages.length) {
          phase = 'pending message processing';
          await processMessages(client, groupName, pendingMessages);
          continue;
        }

        phase = 'new-message read';
        const incoming = await client.xReadGroup(
          groupName,
          consumerName,
          [{ key: RIDE_EVENTS_STREAM, id: '>' }],
          { COUNT: BATCH_SIZE, BLOCK: BLOCK_MS },
        );
        const incomingMessages = getMessages(incoming);
        console.log(`${groupName}: new-message XREADGROUP succeeded; messages=${incomingMessages.length}`);
        if (incomingMessages.length) {
          phase = 'new-message processing';
          await processMessages(client, groupName, incomingMessages);
        }
      } catch (error) {
        const details = readErrorDetails(error);
        console.error(`${groupName}: ${phase} failed; code=${details.code}; name=${details.name}; message=${details.message}`);
        console.error(
          `${groupName}: Redis readiness after error; isOpen=${Boolean(client.isOpen)}; isReady=${Boolean(client.isReady)}; retrying in 1000ms`,
        );
        await delay(1000);
      }
    }
  } finally {
    if (stopHeartbeat) {
      try {
        await stopHeartbeat();
      } catch (error) {
        console.error(`${groupName}: heartbeat cleanup failed (${error.code || error.name || 'error'})`);
      }
    }
    process.removeListener('SIGINT', handleSigint);
    process.removeListener('SIGTERM', handleSigterm);
    if (client.isOpen) {
      try {
        await client.quit();
      } catch (error) {
        console.error(`${groupName}: Redis shutdown failed (${error.code || error.name || 'error'})`);
      }
    }
  }
}

module.exports = { startStreamConsumer };
