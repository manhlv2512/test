'use strict';

const { io } = require('socket.io-client');

/**
 * Bọc socket.io-client với các helper tiện dụng để làm việc với
 * dynamic events server (đăng ký / hủy / liệt kê event).
 */
class EventsClient {
  /**
   * @param {string} [url] - URL của server (mặc định http://localhost:3000).
   * @param {import('socket.io-client').ManagerOptions & import('socket.io-client').SocketOptions} [opts]
   */
  constructor(url = process.env.URL || 'http://localhost:3000', opts = {}) {
    this.url = url;
    this.socket = io(url, opts);
  }

  /** Chờ tới khi kết nối thành công. */
  connect() {
    return new Promise((resolve, reject) => {
      this.socket.once('connect', () => resolve(this.socket.id));
      this.socket.once('connect_error', (err) => reject(err));
    });
  }

  /**
   * Đăng ký một event mới (động) trên server.
   * @param {string} name
   * @param {object} [meta]
   * @returns {Promise<object>} kết quả { ok, created, event }
   */
  register(name, meta = {}) {
    return this._emitWithAck('events:register', { name, meta });
  }

  /**
   * Hủy đăng ký một event.
   * @param {string} name
   * @returns {Promise<object>} { ok }
   */
  unregister(name) {
    return this._emitWithAck('events:unregister', { name });
  }

  /**
   * Lấy danh sách event hiện tại.
   * @returns {Promise<object[]>}
   */
  list() {
    return this._emitWithAck('events:list', null);
  }

  /**
   * Lắng nghe một event bất kỳ (kể cả event động đã đăng ký).
   * @param {string} name
   * @param {(payload: any) => void} handler
   */
  on(name, handler) {
    this.socket.on(name, handler);
    return this;
  }

  /**
   * Gửi (emit) một event tới server.
   * @param {string} name
   * @param {any} payload
   */
  emit(name, payload) {
    this.socket.emit(name, payload);
    return this;
  }

  close() {
    this.socket.close();
  }

  /**
   * @private
   */
  _emitWithAck(event, data) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`ack timeout: ${event}`)), 8000);
      this.socket.emit(event, data, (res) => {
        clearTimeout(timer);
        resolve(res);
      });
    });
  }
}

module.exports = { EventsClient };
