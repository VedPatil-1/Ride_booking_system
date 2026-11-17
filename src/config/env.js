const path = require('node:path');
const dotenv = require('dotenv');

const processEnvBeforeDotenv = {
  nodeEnv: process.env.NODE_ENV,
  testRejections: process.env.ENABLE_TEST_DRIVER_REJECTIONS,
  testAssignmentFailures: process.env.ENABLE_TEST_ASSIGNMENT_FAILURES,
};
const envFilePath = path.resolve(__dirname, '..', '..', '.env');
const dotenvResult = dotenv.config({ path: envFilePath });
const envFileValues = dotenvResult.parsed || {};

if (processEnvBeforeDotenv.nodeEnv !== undefined
  && envFileValues.NODE_ENV
  && processEnvBeforeDotenv.nodeEnv !== envFileValues.NODE_ENV) {
  console.warn('Process NODE_ENV overrides NODE_ENV in the project .env file');
}
if (processEnvBeforeDotenv.testRejections !== undefined
  && envFileValues.ENABLE_TEST_DRIVER_REJECTIONS
  && processEnvBeforeDotenv.testRejections !== envFileValues.ENABLE_TEST_DRIVER_REJECTIONS) {
  console.warn('Process ENABLE_TEST_DRIVER_REJECTIONS overrides the project .env value');
}
if (processEnvBeforeDotenv.testAssignmentFailures !== undefined
  && envFileValues.ENABLE_TEST_ASSIGNMENT_FAILURES
  && processEnvBeforeDotenv.testAssignmentFailures !== envFileValues.ENABLE_TEST_ASSIGNMENT_FAILURES) {
  console.warn('Process ENABLE_TEST_ASSIGNMENT_FAILURES overrides the project .env value');
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const testDriverRejectionsEnabled = process.env.NODE_ENV === 'development'
  && process.env.ENABLE_TEST_DRIVER_REJECTIONS === 'true';
const testAssignmentFailuresEnabled = process.env.NODE_ENV === 'development'
  && process.env.ENABLE_TEST_ASSIGNMENT_FAILURES === 'true';
const processName = path.basename(process.argv[1] || 'node');
console.log(
  `[${processName}] Test driver rejection mode: ${testDriverRejectionsEnabled ? 'enabled' : 'disabled'}`,
);
console.log(
  `[${processName}] Test assignment failure mode: ${testAssignmentFailuresEnabled ? 'enabled' : 'disabled'}`,
);

module.exports = {
  port,
  mongoUri: getRequiredEnv('MONGODB_URI'),
  redisUrl: getRequiredEnv('REDIS_URL'),
  adminApiKey: process.env.ADMIN_API_KEY || '',
  testDriverRejectionsEnabled,
  testAssignmentFailuresEnabled,
};
