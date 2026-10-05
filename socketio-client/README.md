# Socket.IO Dynamic Events Client

Client mẫu cho [socketio-server](../socketio-server), tách riêng thành project độc lập.

## Cài đặt & chạy

```bash
cd socketio-client
npm install

# Server phải đang chạy trước (mặc định http://localhost:3000)

# CLI tương tác: gõ lệnh và nhập message để emit
npm start        # hoặc: npm run cli

# Demo tự động (không tương tác)
npm run demo
```

## CLI tương tác

Sau khi `npm start`, dùng các lệnh sau tại prompt `>`:

| Lệnh | Mô tả |
|------|-------|
| `/register <event> [meta-json]` | Đăng ký event động |
| `/unregister <event>` | Hủy đăng ký event |
| `/list` | Liệt kê event hiện có |
| `/use <event>` | Chọn event mặc định để gửi message |
| `/send <event> <message>` | Gửi message tới một event cụ thể |
| `/help` | Hiện trợ giúp |
| `/quit` | Thoát |

Sau khi `/use <event>`, chỉ cần gõ nội dung rồi Enter là gửi tới event đó. Message nhận được từ server sẽ tự in ra màn hình.

Ví dụ phiên làm việc:

```
> /register chat {"desc":"phong chat"}
> /use chat
> xin chao moi nguoi
[chat] <- <id>: {"text":"xin chao moi nguoi"}
```

Biến môi trường:

- `URL` – URL của server (mặc định `http://localhost:3000`)

## Dùng như một thư viện

```js
const { EventsClient } = require('./src/client');

const client = new EventsClient('http://localhost:3000');
await client.connect();

// Đăng ký event động
await client.register('chat', { desc: 'phong chat' });

// Nghe & gửi event
client.on('chat', (msg) => console.log('nhan:', msg));
client.emit('chat', { text: 'xin chao' });

// Liệt kê / hủy đăng ký
const list = await client.list();
await client.unregister('chat');
```
