export class GenericV2Backend {
  constructor() {
    this.records = {};
  }

  table(entity) {
    return this.records[entity] ??= [];
  }

  async fetchRecords(entity) {
    return structuredClone(this.table(entity));
  }

  async applySyncV2Mutation(envelope) {
    const table = this.table(envelope.entity);
    const index = table.findIndex((record) => record.id === envelope.recordId);
    const prior = index >= 0 ? table[index] : null;
    const revision = Number(prior?.revision ?? 0) + 1;
    const canonical = {
      ...(prior ?? {}),
      id: envelope.recordId,
      ...structuredClone(envelope.patch ?? {}),
      revision,
      field_revisions: Object.fromEntries(
        Object.keys(envelope.patch ?? {}).map((field) => [field, revision]),
      ),
      deleted_at: envelope.operation === 'delete'
        ? new Date(envelope.clientUpdatedAt ?? Date.now()).toISOString()
        : null,
      client_updated_at: envelope.clientUpdatedAt ?? Date.now(),
    };
    if (index >= 0) table[index] = canonical;
    else table.push(canonical);
    return structuredClone({
      mutationId: envelope.mutationId,
      entity: envelope.entity,
      recordId: envelope.recordId,
      canonicalId: canonical.id,
      outcome: 'applied',
      appliedGroups: Object.keys(envelope.patch ?? {}),
      conflictedGroups: [],
      resultRevision: revision,
      canonical,
    });
  }
}
