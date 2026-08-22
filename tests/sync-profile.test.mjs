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

  await t.test("Strict convergence and no-op preservation", async () => {
    const t1 = Date.now();
    const t2 = t1 + 5000;

    // 1. Initial State: Local at T1, Remote at T2 (T2 > T1)
    await db.put("profile", {
      id: "profile",
      teacherName: "Local Teacher",
      schoolName: "Local School",
      phone: "",
      updatedAt: t1,
    });
    await store.init();
    
    backend.records["profile"] = [
      { id: "profile", school_name: "Cloud School", teacher_name: "Cloud Teacher", client_updated_at: t2 }
    ];

    let updateCalls = 0;
    const originalUpdate = backend.updateProfile.bind(backend);
    backend.updateProfile = async (payload) => {
      updateCalls++;
      return originalUpdate(payload);
    };

    // 2. First Sync: Remote wins. Local receives remote values & preserves T2. No cloud write.
    await sync.syncProfile();
    assert.equal(sync.state.results.profile?.status, "success");
    
    let localProfile = (await db.getAll("profile"))[0];
    assert.equal(localProfile.schoolName, "Cloud School", "Local should receive remote values");
    assert.equal(localProfile.updatedAt, t2, "Local updatedAt MUST semantically match remote authoritative timestamp");
    assert.equal(updateCalls, 0, "No unnecessary cloud write should occur on remote pull");

    // 3. Second immediate sync: Must be a true no-op
    const remoteStateBefore = JSON.stringify(backend.records["profile"]);
    await sync.syncProfile();
    assert.equal(sync.state.results.profile?.status, "success");
    
    const remoteStateAfter = JSON.stringify(backend.records["profile"]);
    assert.equal(remoteStateAfter, remoteStateBefore, "Zero remote update/insert operations");
    assert.equal(updateCalls, 0, "Zero remote update operations");
    
    localProfile = (await db.getAll("profile"))[0];
    assert.equal(localProfile.schoolName, "Cloud School", "Profile values unchanged");
    assert.equal(localProfile.updatedAt, t2, "Local timestamp should not have churned");

    // 4. Make a REAL local user profile edit
    // Note: patchProfile will use the wall-clock Date.now(), which will be > t2
    // We mock Date.now so it's strictly > t2 to avoid flaky fast-execution equal-timestamp issues.
    const realEditTime = t2 + 5000;
    const originalNow = Date.now;
    global.Date.now = () => realEditTime;
    
    await store.patchProfile({ schoolName: "Edited Local School" });
    await store.init();
    
    global.Date.now = originalNow;

    // 5. Next sync: Local is newer. Exactly one cloud update occurs.
    await sync.syncProfile();
    assert.equal(sync.state.results.profile?.status, "success");
    assert.equal(updateCalls, 1, "Exactly one cloud update should occur");
    assert.equal(backend.records["profile"][0].school_name, "Edited Local School", "Cloud should receive local edit");
    assert.equal(backend.records["profile"][0].client_updated_at, realEditTime, "Cloud should receive new local timestamp");

    // 6. Next immediate sync: true no-op
    await sync.syncProfile();
    assert.equal(sync.state.results.profile?.status, "success");
    assert.equal(updateCalls, 1, "No additional cloud updates should occur");
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
