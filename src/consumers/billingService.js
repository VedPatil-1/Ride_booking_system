const { startStreamConsumer } = require('./streamConsumer');

startStreamConsumer('billing-service').catch((error) => {
  console.error(`Billing subscriber stopped (${error.code || error.name || 'error'})`);
  process.exitCode = 1;
});
