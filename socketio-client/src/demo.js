'use strict';

// Demo: đăng ký event động, dùng thử và in danh sách event.
const { EventsClient } = require('./client');

async function main() {
  const client = new EventsClient();
  const id = await client.connect();
  console.log('[client] connected', id);

  // Nghe danh sách event thay đổi từ server
  client.on('events:list', (list) => {
    console.log('[client] events:list (push) ->', list.map((e) => e.name));
  });

  // Đăng ký event động
  const reg = await client.register('chat', { desc: 'phong chat' });
  console.log('[client] register chat ->', JSON.stringify(reg));
  if (!reg || !reg.ok) {
    client.close();
    process.exit(1);
  }

  // Nghe event vừa đăng ký
  client.on('chat', async (msg) => {
    console.log('[client] nhan chat ->', JSON.stringify(msg));
    const list = await client.list();
    console.log('[client] events:list (ack) ->', list.map((e) => e.name));
    const ok = Array.isArray(list) && list.some((e) => e.name === 'chat');
    client.close();
    process.exit(ok ? 0 : 1);
  });

  // Emit thử event vừa đăng ký
  client.emit('chat', { text: 'xin chao' });
}

main().catch((err) => {
  console.error('[client] error', err.message);
  process.exit(1);
});
