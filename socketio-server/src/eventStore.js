'use strict';

const fs = require('fs');
const path = require('path');

/**
 * EventStore quản lý danh sách event đã đăng ký và lưu bền vững ra file JSON.
 * Nhờ vậy khi restart ứng dụng, danh sách event được khôi phục lại.
 */
class EventStore {
  /**
   * @param {string} filePath - Đường dẫn tới file JSON lưu danh sách event.
   */
  constructor(filePath) {
    this.filePath = filePath;
    /** @type {Map<string, object>} name -> event definition */
    this.events = new Map();
  }

  /**
   * Đọc danh sách event từ file JSON (nếu có). Gọi khi khởi động app.
   */
  load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return;
      }
      const raw = fs.readFileSync(this.filePath, 'utf8').trim();
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const evt of parsed) {
          if (evt && typeof evt.name === 'string') {
            this.events.set(evt.name, evt);
          }
        }
      }
    } catch (err) {
      // File hỏng không nên làm chết app; log và bắt đầu với danh sách rỗng.
      console.error(`[EventStore] Không đọc được file ${this.filePath}:`, err.message);
    }
  }

  /**
   * Ghi danh sách event hiện tại ra file JSON (atomic write).
   */
  persist() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });

    const data = JSON.stringify(this.list(), null, 2);
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, data, 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }

  /**
   * Đăng ký (hoặc cập nhật) một event.
   * @param {string} name - Tên event.
   * @param {object} [meta] - Metadata tùy ý kèm theo event.
   * @returns {{ created: boolean, event: object }}
   */
  register(name, meta = {}) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('Tên event phải là chuỗi không rỗng');
    }
    const key = name.trim();
    const existed = this.events.has(key);
    const event = {
      name: key,
      meta,
      createdAt: existed ? this.events.get(key).createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.events.set(key, event);
    this.persist();
    return { created: !existed, event };
  }

  /**
   * Xóa một event đã đăng ký.
   * @param {string} name
   * @returns {boolean} true nếu tồn tại và đã xóa.
   */
  unregister(name) {
    const key = String(name || '').trim();
    const removed = this.events.delete(key);
    if (removed) {
      this.persist();
    }
    return removed;
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this.events.has(String(name || '').trim());
  }

  /**
   * @returns {object[]} Danh sách event.
   */
  list() {
    return Array.from(this.events.values());
  }
}

module.exports = { EventStore };
