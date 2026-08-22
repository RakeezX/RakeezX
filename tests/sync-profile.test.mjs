import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
global.document = { documentElement: { setAttribute: () => {}, removeAttribute: () => {}, classList: { add: () => {}, remove: () => {} } }, querySelector: () => ({ setAttribute: () => {} }) };
global.matchMedia = () => ({ matches: false });

import * as sync from "../src/lib/sync.js";
import * as store from "../src/store.js";
import * as db from "../src/lib/db.js";
import { setMockBackend, setMockAuth } from "../src/lib/cloud.js";

/**
 * MockCloudBackend for syncProfile tests.
 * syncProfile calls: fetchProfile(), insertProfile(payload), updateProfile(payload)
 * The remote record is expected to have snake_case field names (school_name, teacher_name, etc.)
 * matching how syncProfile reads them in sync.js lines 110-115.
 *
 * updateProfile in production patches by owner_id (not record id). The payload has no 'id' field.
 * The mock simply updates the first (and only) profile record to match Supabase behavior.
 */
class MockCloudBackend {
  constructor() {
    this.records = {};
  }
  async fetchProfile() {
    return this.records["profile"]?.[0] || null;
  }
  async insertProfile(profileData) {
    if (!this.records["profile"]) this.records["profile"] = [];
    this.records["profile"].push(profileData);
    return profileData;
  }
  async updateProfile(profileData) {
    // Production: PATCH /profile?owner_id=eq.{user.id} — patches the owner's single profile row.
    // The payload does NOT include an 'id' field. We always update the first record.
    if (!this.records["profile"]) this.records["profile"] = [];
    if (this.records["profile"].length === 0) {
      this.records["profile"].push(profileData);
    } else {
      this.records["profile"][0] = { ...this.records["profile"][0], ...profileData };
    }
    return this.records["profile"][0];
  }
}

let backend;

test("Sync Profile Suite", async (t) => {
  t.beforeEach(async () => {
    // Full isolation per test: fresh backend, fresh auth, fresh DB.
    backend = new MockCloudBackend();
    setMockBackend(backend);
    setMockAuth({ id: "user1" }, {});
    // Close current DB connection so openDB() will reopen fresh
    db.closeDB();
    await db.clearAll();
    await store.patchDevice({ lastSyncAt: 0, activeTimeProfileId: null });
    await store.init();
    sync.state.status = "idle";
    sync.state.results = { profile: null, structural: null, students: null, timetable: null };
  });

  await t.test("Local initial push", async () => {
    const now = Date.now();
    // Patch profile with meaningful data (non-empty schoolName triggers hasMeaningfulProfile)
    await store.patchProfile({ schoolName: "School 1", updatedAt: now });
    await store.init(); // Reload so store.state.profile reflects the patched data

    await sync.syncProfile();

    // syncProfile calls insertProfile with snake_case payload
    assert.ok(backend.records["profile"], "Profile should be inserted into mock backend");
    assert.equal(backend.records["profile"].length, 1);
    assert.equal(backend.records["profile"][0].school_name, "School 1");
    // Result should be success
    assert.equal(sync.state.results.profile?.status, "success");
  });

  await t.test("Cloud pull (fresh device)", async () => {
    // Remote profile uses snake_case as syncProfile reads: remote.school_name
    backend.records["profile"] = [
      { id: "remote1", school_name: "Cloud School", teacher_name: "Teacher A", client_updated_at: Date.now() }
    ];

    await sync.syncProfile();

    const localProfile = await db.getAll("profile");
    assert.equal(localProfile.length, 1);
    // syncProfile calls store.patchProfile({ schoolName: remote.school_name, ... })
    assert.equal(localProfile[0].schoolName, "Cloud School");
    assert.equal(sync.state.results.profile?.status, "success");
  });

  await t.test("Sync converges to stable state", async () => {
    // Behavior note: store.patchProfile() always sets updatedAt = now() (current wall clock).
    // After a remote pull, local updatedAt may be slightly newer than remote client_updated_at.
    // That triggers a push-back on the next sync, which updates the remote's client_updated_at.
    // After that round-trip, both sides are equal → no-op on the next sync.
    // This test verifies the sync stabilizes (no more changes) within 3 rounds.
    const now = Date.now();
    backend.records["profile"] = [
      { id: "remote1", school_name: "Cloud School", client_updated_at: now }
    ];

    // Round 1: pull from remote
    await sync.syncProfile();
    assert.equal(sync.state.results.profile?.status, "success");
    const countAfterRound1 = JSON.stringify(backend.records["profile"]);

    // Round 2: may push back (due to local updatedAt = now() > remote's now)
    await sync.syncProfile();
    assert.equal(sync.state.results.profile?.status, "success");

    // Round 3: must be a no-op (timestamps now equal)
    const countAfterRound2 = JSON.stringify(backend.records["profile"]);
    await sync.syncProfile();
    assert.equal(sync.state.results.profile?.status, "success");
    const countAfterRound3 = JSON.stringify(backend.records["profile"]);

    // After round 3, no further changes should occur — the state is stable
    assert.equal(countAfterRound3, countAfterRound2, "Profile state should stabilize after 2 sync rounds");
  });

  await t.test("Local newer wins", async () => {
    const now = Date.now();
    // store.patchProfile() always sets updatedAt = now() (by design in patch()).
    // To test timestamp comparison, we must write directly to DB with an explicit future timestamp.
    await db.put("profile", {
      id: "profile",
      teacherName: "",
      schoolName: "Local School",
      phone: "",
      updatedAt: now + 5000,  // Future timestamp — should beat the remote's `now`
    });
    await store.init(); // Reload so store.state.profile.updatedAt = now + 5000
    backend.records["profile"] = [
      { id: "profile", school_name: "Remote School", client_updated_at: now }
    ];

    // localUpdatedAt (now + 5000) > remoteClientUpdatedAt (now) → Local wins → push
    await sync.syncProfile();

    // After sync, remote should have the local school name
    assert.equal(backend.records["profile"][0].school_name, "Local School");
    assert.equal(sync.state.results.profile?.status, "success");
  });

  await t.test("Remote newer wins", async () => {
    const now = Date.now();
    await store.patchProfile({ schoolName: "Local School", updatedAt: now });
    await store.init();
    // Remote is newer
    backend.records["profile"] = [
      { id: "profile", school_name: "Remote School", client_updated_at: now + 5000 }
    ];

    await sync.syncProfile();

    const localProfile = await db.getAll("profile");
    assert.equal(localProfile[0].schoolName, "Remote School");
    assert.equal(sync.state.results.profile?.status, "success");
  });

  // Cleanup: close open handles so Node test runner exits cleanly.
  // Without this, BroadcastChannel and IndexedDB keep the event loop alive.
  t.after(async () => {
    store.closeChannel();
    db.closeDB();
  });
});
