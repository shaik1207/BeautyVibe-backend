let ioInstance;

const initSockets = (io) => {
  ioInstance = io;
  io.on('connection', (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);

    socket.on('joinRoom', (room) => {
      socket.join(room);
      console.log(`Client joined room: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
};

const getIo = () => {
  if (!ioInstance) throw new Error('Socket.io not initialized!');
  return ioInstance;
};

module.exports = { initSockets, getIo };