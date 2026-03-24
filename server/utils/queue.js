// queue.js — legacy file kept for compatibility, delegates to queues.js
// No ioredis connection is created here to avoid ECONNREFUSED noise at startup.
const { addNotificationJob, notificationQueue } = require('./queues');
module.exports = { addNotificationJob, notificationQueue };
