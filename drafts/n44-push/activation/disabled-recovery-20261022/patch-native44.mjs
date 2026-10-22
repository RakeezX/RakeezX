/** AI-authored INACTIVE source transform. No IO, import, deployment or runtime switch.
 * Apply only to the exact retained native44 bytes; never rebuild an older graph.
 */
import {createHash} from 'node:crypto';
export const sourcePath = 'drafts/n44-push/activation/register503-composition/edge.mjs';
export const sourceSha256 = '0e1a86d8e64fbfdeb294044a9809cd9f33a7ee44ffc2a48b14687716e1141fe7';
export const before = 'admitRegistration = (tx, _auth, request2) => !tx.rows("registrations").some((r) => r.workspaceId === a.workspaceId && r.deviceId === a.deviceId && r.registrationId !== request2.registrationId);';
export const after = `admitRegistration = (tx, _auth, request2) => deviceApproval(a, tx.time(now())) !== null && tx.rows("registrations").every((r) =>
              r.workspaceId === a.workspaceId && r.deviceId === a.deviceId &&
              (r.registrationId === request2.registrationId ||
                r.state === "revoked" && r.sealed === null && r.fingerprint === null && r.bindingFingerprint === null));`;
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function patchNative44(source) {
  if (sha256(source) !== sourceSha256 || source.split(before).length !== 2)
    throw Error('n44_disabled_recovery_source_mismatch');
  return source.replace(before, after);
}
