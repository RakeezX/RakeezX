/** AI: immutable local counterpart to the hosted committed one-target permit. */
import {open} from 'node:fs/promises';
export async function writeEncryptedAttemptJournal(file, encryptedBytes) {
  // Only already-encrypted bytes enter this writer. EEXIST is never recovered
  // by overwrite/delete: timeout, interruption and unknown outcome consume it.
  const handle = await open(file, 'wx');
  try { await handle.writeFile(encryptedBytes); await handle.sync(); }
  finally { await handle.close(); }
}
