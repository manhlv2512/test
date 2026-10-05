# Socket.IO Dynamic Events Server

Socket.IO server cho phép đăng ký event **động** tại runtime và lưu danh sách event ra file JSON, nhờ đó khi restart ứng dụng vẫn khôi phục lại được danh sách event.

## Chạy

```bash
cd socketio-server
npm install
npm start
```

Biến môi trường:

- `PORT` – cổng lắng nghe (mặc định `3000`)
- `EVENTS_FILE` – đường dẫn file JSON lưu event (mặc định `./data/events.json`)

## Các event điều khiển (từ client)

| Event | Payload | Mô tả |
|-------|---------|-------|
| `events:register` | `{ name, meta? }` | Đăng ký event mới, lưu vào file JSON và gắn listener ngay lập tức |
| `events:unregister` | `{ name }` | Hủy đăng ký một event |
| `events:list` | – | Lấy danh sách event hiện tại (dùng ack callback) |

Server sẽ broadcast `events:list` cho mọi client mỗi khi danh sách thay đổi.

Sau khi một event (ví dụ `chat`) đã được đăng ký, mọi client có thể `emit('chat', payload)` và server sẽ phát lại cho tất cả client đang join room `chat`.

## Ví dụ client

```js
const { io } = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  // Đăng ký event động
  socket.emit('events:register', { name: 'chat', meta: { desc: 'phòng chat' } }, (res) => {
    console.log('register:', res);

    // Sau khi đăng ký, dùng được ngay
    socket.emit('chat', { text: 'xin chào' });
  });
});

socket.on('chat', (msg) => console.log('nhận chat:', msg));
socket.on('events:list', (list) => console.log('danh sách event:', list));
```

Khi restart server, danh sách event trong `data/events.json` được nạp lại tự động.
