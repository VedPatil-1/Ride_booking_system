const { startStreamConsumer } = require('./streamConsumer');

startStreamConsumer('operations-service').catch((error) => {
  console.error(`Operations subscriber stopped (${error.code || error.name || 'error'})`);
  process.exitCode = 1;
});
