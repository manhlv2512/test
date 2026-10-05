'use strict';

const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { EventStore } = require('./eventStore');

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.EVENTS_FILE || path.join(__dirname, '..', 'data', 'events.json');

// --- Khởi tạo & khôi phục danh sách event từ file JSON ---
const store = new EventStore(DATA_FILE);
store.load();
console.log(`[server] Đã khôi phục ${store.list().length} event từ ${DATA_FILE}`);

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

/**
 * Gắn listener cho một event đã đăng ký lên một socket cụ thể.
 * Khi client emit đúng tên event này, server broadcast lại cho tất cả client
 * cùng đăng ký (namespace mặc định, room = tên event).
 * @param {import('socket.io').Socket} socket
 * @param {object} event
 */
function bindEvent(socket, event) {
  const { name } = event;
  // Tránh gắn trùng listener cho cùng một event trên cùng socket.
  if (socket.__boundEvents && socket.__boundEvents.has(name)) {
    return;
  }
  socket.__boundEvents = socket.__boundEvents || new Set();
  socket.__boundEvents.add(name);

  socket.on(name, (payload) => {
    console.log(`[event:${name}] từ ${socket.id}:`, payload);
    // Phát lại cho mọi client đã join room theo tên event.
    io.to(name).emit(name, {
      from: socket.id,
      payload,
      at: new Date().toISOString(),
    });
  });
}

/**
 * Gắn tất cả event đang có trong store lên một socket và cho socket join
 * room tương ứng để nhận broadcast.
 * @param {import('socket.io').Socket} socket
 */
function bindAllEvents(socket) {
  for (const event of store.list()) {
    socket.join(event.name);
    bindEvent(socket, event);
  }
}

io.on('connection', (socket) => {
  console.log(`[server] client kết nối: ${socket.id}`);

  // Ngay khi kết nối, gắn toàn bộ event đã khôi phục để client dùng được luôn.
  bindAllEvents(socket);

  // Trả về danh sách event hiện có cho client.
  socket.emit('events:list', store.list());

  /**
   * Đăng ký event mới (động). Client gửi { name, meta }.
   * Server lưu vào store (ghi file JSON), gắn listener và thông báo cho mọi client.
   */
  socket.on('events:register', (data, ack) => {
    try {
      const name = data && data.name;
      const meta = (data && data.meta) || {};
      const { created, event } = store.register(name, meta);

      // Gắn listener + join room trên MỌI socket đang kết nối để dùng ngay.
      for (const [, s] of io.of('/').sockets) {
        s.join(event.name);
        bindEvent(s, event);
      }

      // Thông báo danh sách mới cho tất cả client.
      io.emit('events:list', store.list());

      if (typeof ack === 'function') {
        ack({ ok: true, created, event });
      }
    } catch (err) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: err.message });
      }
    }
  });

  /**
   * Hủy đăng ký event. Client gửi { name }.
   */
  socket.on('events:unregister', (data, ack) => {
    const name = data && data.name;
    const removed = store.unregister(name);
    if (removed) {
      io.emit('events:list', store.list());
    }
    if (typeof ack === 'function') {
      ack({ ok: removed });
    }
  });

  /**
   * Lấy danh sách event hiện tại theo yêu cầu.
   */
  socket.on('events:list', (_data, ack) => {
    if (typeof ack === 'function') {
      ack(store.list());
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[server] client ngắt kết nối: ${socket.id} (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] Socket.IO đang lắng nghe tại http://localhost:${PORT}`);
});

// Ghi lại danh sách event trước khi thoát để đảm bảo bền vững.
function shutdown() {
  try {
    store.persist();
  } catch (_) {
    /* ignore */
  }
  io.close();
  httpServer.close(() => process.exit(0));
  // Ép thoát nếu treo.
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
