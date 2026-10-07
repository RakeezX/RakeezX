import { IDBFactory } from 'fake-indexeddb';
import { STORES } from '../../src/lib/db.js';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('transaction aborted'));
  });
}

export class IsolatedIndexedDb {
  constructor(name) {
    this.name = name;
    this.factory = new IDBFactory();
    this.connection = null;
    this.failNextStore = null;
  }

  async open() {
    if (this.connection) return this.connection;
    const request = this.factory.open(this.name, 1);
    request.onupgradeneeded = () => {
      for (const store of STORES) request.result.createObjectStore(store, { keyPath: 'id' });
    };
    this.connection = await requestResult(request);
    return this.connection;
  }

  async getAll(store) {
    const connection = await this.open();
    return requestResult(connection.transaction(store, 'readonly').objectStore(store).getAll());
  }

  async get(store, id) {
    const connection = await this.open();
    return requestResult(connection.transaction(store, 'readonly').objectStore(store).get(id));
  }

  async applyBatch(batch, { prepare } = {}) {
    const names = Object.keys(batch);
    const connection = await this.open();
    const transaction = connection.transaction(names, 'readwrite');
    let failure;
    const completion = transactionDone(transaction);
    try {
      const current = {};
      for (const name of names) current[name] = await requestResult(transaction.objectStore(name).getAll());
      const writes = prepare ? prepare(current) : batch;
      if (!writes || typeof writes.then === 'function') throw new TypeError('prepare must be synchronous');
      for (const [name, operations] of Object.entries(writes)) {
        if (this.failNextStore === name) {
          this.failNextStore = null;
          throw new Error(`injected ${name} write failure`);
        }
        const store = transaction.objectStore(name);
        for (const id of operations.remove ?? []) store.delete(id);
        for (const record of operations.put ?? []) store.put(record);
      }
    } catch (error) {
      failure = error;
      transaction.abort();
    }
    try {
      await completion;
    } catch (error) {
      throw failure ?? error;
    }
  }

  close() {
    this.connection?.close();
    this.connection = null;
  }
}
