import { clone } from './domain.js';

const COLLECTIONS = ['dreams', 'sessions', 'understanding', 'personalUnderstanding', 'users', 'audit'];

function emptyState() {
  return { dreams: {}, sessions: {}, understanding: {}, personalUnderstanding: {}, users: {}, audit: [] };
}

export class MemoryStore {
  constructor(seed = {}) {
    seed = seed && typeof seed === 'object' ? seed : {};
    this.state = {
      ...emptyState(),
      ...clone(seed),
      dreams: { ...(seed.dreams || {}) },
      sessions: { ...(seed.sessions || {}) },
      understanding: { ...(seed.understanding || {}) },
      personalUnderstanding: { ...(seed.personalUnderstanding || {}) },
      users: { ...(seed.users || {}) },
      audit: [...(seed.audit || [])]
    };
  }

  async get(collection, id) {
    this.assertCollection(collection);
    const value = collection === 'audit' ? this.state.audit.find(event => event.id === id) : this.state[collection][id];
    return clone(value) ?? null;
  }

  async put(collection, id, value) {
    this.assertCollection(collection);
    if (collection === 'audit') this.state.audit.push(clone(value));
    else this.state[collection][id] = clone(value);
    return clone(value);
  }

  async delete(collection, id) {
    this.assertCollection(collection);
    if (collection === 'audit') this.state.audit = this.state.audit.filter(event => event.id !== id);
    else delete this.state[collection][id];
  }

  async list(collection, predicate = () => true) {
    this.assertCollection(collection);
    const values = collection === 'audit' ? this.state.audit : Object.values(this.state[collection]);
    return clone(values.filter(predicate));
  }

  async transaction(work) {
    const before = clone(this.state);
    try {
      return await work(this);
    } catch (error) {
      this.state = before;
      throw error;
    }
  }

  snapshot() {
    return clone(this.state);
  }

  async clear() {
    this.state = emptyState();
  }

  assertCollection(collection) {
    if (!COLLECTIONS.includes(collection)) throw new Error(`UNKNOWN_COLLECTION:${collection}`);
  }
}

export class LocalStorageStore extends MemoryStore {
  constructor(storage, key = 'dream-os-mvp-state-v1') {
    if (!storage?.getItem || !storage?.setItem) throw new Error('LOCAL_STORAGE_REQUIRED');
    let seed = emptyState();
    try {
      seed = JSON.parse(storage.getItem(key) || JSON.stringify(seed));
    } catch {
      seed = emptyState();
    }
    super(seed);
    this.storage = storage;
    this.key = key;
  }

  persist() {
    this.storage.setItem(this.key, JSON.stringify(this.state));
  }

  async put(collection, id, value) {
    const result = await super.put(collection, id, value);
    this.persist();
    return result;
  }

  async delete(collection, id) {
    await super.delete(collection, id);
    this.persist();
  }

  async clear() {
    await super.clear();
    this.persist();
  }

  async transaction(work) {
    try {
      const result = await super.transaction(work);
      this.persist();
      return result;
    } catch (error) {
      this.persist();
      throw error;
    }
  }
}
