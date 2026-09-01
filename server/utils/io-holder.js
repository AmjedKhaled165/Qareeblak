/**
 * Shared Socket.io holder — allows background workers (BullMQ) to access
 * the Socket.io instance without requiring a reference to the Express app.
 *
 * Usage:
 *   // In index.js (after creating io):
 *   require('./utils/io-holder').set(io);
 *
 *   // In any worker/utility:
 *   const io = require('./utils/io-holder').get();
 */

let _io = null;

module.exports = {
    set(io) { _io = io; },
    get() { return _io; }
};
