'use strict';

// CLI tương tác: gõ lệnh để đăng ký event, emit message, liệt kê / hủy event.
const readline = require('readline');
const { EventsClient } = require('./client');

const HELP = `
Các lệnh:
  /register <event> [meta]   Đăng ký event động (meta là JSON tùy chọn)
  /unregister <event>        Hủy đăng ký event
  /list                      Liệt kê event hiện có
  /use <event>               Chọn event mặc định để gửi message
  /send <event> <message>    Gửi message tới một event cụ thể
  /help                      Hiện trợ giúp
  /quit                      Thoát

Mẹo: sau khi /use <event>, chỉ cần gõ nội dung rồi Enter là gửi tới event đó.
`;

async function main() {
  const client = new EventsClient();
  const id = await client.connect();
  console.log(`[client] Đã kết nối: ${id}`);
  console.log(HELP);

  let currentEvent = null;
  const listened = new Set();

  // Lắng nghe danh sách event server đẩy về, tự động subscribe để in message.
  client.on('events:list', (list) => {
    for (const evt of list) {
      if (!listened.has(evt.name)) {
        listened.add(evt.name);
        client.on(evt.name, (msg) => {
          const from = msg && msg.from ? msg.from : '?';
          const payload = msg && 'payload' in msg ? msg.payload : msg;
          console.log(`\n[${evt.name}] <- ${from}: ${JSON.stringify(payload)}`);
          rl.prompt();
        });
      }
    }
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });
  rl.prompt();

  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) {
      rl.prompt();
      return;
    }

    try {
      if (text.startsWith('/')) {
        await handleCommand(text);
      } else if (currentEvent) {
        // Không phải lệnh -> gửi tới event đang chọn.
        client.emit(currentEvent, { text });
        console.log(`[client] đã gửi tới "${currentEvent}": ${text}`);
      } else {
        console.log('[client] Chưa chọn event. Dùng /use <event> hoặc /send <event> <message>.');
      }
    } catch (err) {
      console.error('[client] lỗi:', err.message);
    }
    rl.prompt();
  });

  rl.on('close', () => {
    client.close();
    process.exit(0);
  });

  async function handleCommand(text) {
    const [cmd, ...rest] = text.split(/\s+/);
    switch (cmd) {
      case '/register': {
        const name = rest[0];
        if (!name) return console.log('Cú pháp: /register <event> [meta-json]');
        let meta = {};
        if (rest.length > 1) {
          const metaStr = rest.slice(1).join(' ');
          try {
            meta = JSON.parse(metaStr);
          } catch {
            return console.log('meta không phải JSON hợp lệ');
          }
        }
        const res = await client.register(name, meta);
        console.log('[client] register ->', JSON.stringify(res));
        break;
      }
      case '/unregister': {
        const name = rest[0];
        if (!name) return console.log('Cú pháp: /unregister <event>');
        const res = await client.unregister(name);
        console.log('[client] unregister ->', JSON.stringify(res));
        if (currentEvent === name) currentEvent = null;
        break;
      }
      case '/list': {
        const list = await client.list();
        console.log('[client] events ->', list.map((e) => e.name));
        break;
      }
      case '/use': {
        const name = rest[0];
        if (!name) return console.log('Cú pháp: /use <event>');
        currentEvent = name;
        console.log(`[client] event mặc định: "${name}"`);
        break;
      }
      case '/send': {
        const name = rest[0];
        const message = rest.slice(1).join(' ');
        if (!name || !message) return console.log('Cú pháp: /send <event> <message>');
        client.emit(name, { text: message });
        console.log(`[client] đã gửi tới "${name}": ${message}`);
        break;
      }
      case '/help':
        console.log(HELP);
        break;
      case '/quit':
      case '/exit':
        rl.close();
        break;
      default:
        console.log(`Lệnh không rõ: ${cmd}. Gõ /help để xem trợ giúp.`);
    }
  }
}

main().catch((err) => {
  console.error('[client] error', err.message);
  process.exit(1);
});
