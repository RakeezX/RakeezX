/** AI: fabricated repository only. Global mutex serializes transactions in ONE process.
 * Tests exercise genuine service contention here, NOT Postgres locks/isolation/RLS. */
export function createMemoryRepository(seed) {
  let state = structuredClone(seed), tail = Promise.resolve();
  return {
    async transaction(action) {
      const previous = tail;
      let release; tail = new Promise(resolve => { release = resolve; });
      await previous;
      try {
        const draft = structuredClone(state);
        const result = await action(draft);
        state = draft;
        return result;
      } finally { release(); }
    },
    snapshot: () => structuredClone(state),
  };
}
