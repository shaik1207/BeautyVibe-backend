/**
 * Return a filter restricted to the authenticated user's salon.
 */
function salonFilter(req) {
  const salonId = req.user?.salonId;

  if (!salonId) {
    throw new Error('Authenticated user has no salon assignment.');
  }

  return {
    salonId: String(salonId)
  };
}

/**
 * Emit an event to the authenticated user's salon room.
 *
 * The server must initialize Socket.IO and store it using:
 * app.set('io', io)
 */
function emitSalon(req, event, payload) {
  const salonId = req.user?.salonId;
  const io = req.app?.get('io');

  if (!salonId || !io) {
    return;
  }

  io.to(`salon:${String(salonId)}`).emit(event, payload);
}

module.exports = {
  salonFilter,
  emitSalon
};