import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
const exec = promisify(execFile);
const fail = code => Object.assign(new Error(code), { safeCode: code });
const normalized = p => process.platform === 'win32' ? p.toLowerCase() : p;
const inPath = (root, file) => normalized(file).startsWith(normalized(root) + path.sep);
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
async function git(repo, args) {
  try { return (await exec('git', ['-C', repo, ...args], { windowsHide: true, maxBuffer: 1024 * 1024 })).stdout.trim(); }
  catch { throw fail('PRIVATE_PATH_GIT_CHECK_FAILED'); }
}

/** No gitignore/global/allowed-directory changes. Refuse any path not already ignored. */
export async function assertPrivatePath(repoInput, dirInput) {
  const repo = await fs.realpath(repoInput), dir = path.resolve(dirInput);
  const top = await git(repo, ['rev-parse', '--show-toplevel']);
  if (normalized(await fs.realpath(top)) !== normalized(repo)) throw fail('REPO_ROOT_REQUIRED');
  const allowed = path.join(repo, 'artifacts', 'ops-supervisor-v4', 'capabilities', 'd087');
  if (!inPath(allowed, dir) || path.basename(dir) !== 'private') throw fail('PRIVATE_PATH_OUTSIDE_SCOPE');
  let ancestor = dir;
  for (;;) {
    try {
      const stat = await fs.lstat(ancestor);
      if (stat.isSymbolicLink()) throw fail('PRIVATE_PATH_LINK_REJECTED');
      const real = await fs.realpath(ancestor);
      if (normalized(real) !== normalized(path.resolve(ancestor)) ||
          (normalized(real) !== normalized(repo) && !inPath(repo, real))) throw fail('PRIVATE_PATH_LINK_REJECTED');
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      ancestor = path.dirname(ancestor);
    }
  }
  const relative = path.relative(repo, path.join(dir, 'state.json'));
  if (await git(repo, ['ls-files', '--', relative])) throw fail('PRIVATE_PATH_TRACKED');
  await git(repo, ['check-ignore', '--quiet', '--', relative]);
  return { repo, dir };
}
async function windowsAcl(dir, create) {
  const script = "$ErrorActionPreference='Stop'; $d087Path=" + q(dir) + "; " +
    "$d087Sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; " +
    (create ? "& icacls $d087Path /inheritance:r /grant:r ('*'+$d087Sid+':(OI)(CI)F') '*S-1-5-18:(OI)(CI)F' | Out-Null; if($LASTEXITCODE -ne 0){throw 'ACL'}; " : '') +
    "$d087Acl=Get-Acl -LiteralPath $d087Path; $d087Bad=@($d087Acl.Access | Where-Object { $_.AccessControlType -eq 'Allow' -and $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($d087Sid,'S-1-5-18') }); " +
    "if(-not $d087Acl.AreAccessRulesProtected -or $d087Bad.Count -ne 0){throw 'ACL'}; Write-Output 'PRIVATE_ACL_OK'";
  try {
    const r = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
    if (r.stdout.trim() !== 'PRIVATE_ACL_OK') throw fail('PRIVATE_ACL_REQUIRED');
  } catch { throw fail('PRIVATE_ACL_REQUIRED'); }
}
export async function securePrivateDirectory(repoInput, dirInput, { create = false } = {}) {
  const { repo, dir } = await assertPrivatePath(repoInput, dirInput);
  if (create) {
    try { await fs.lstat(dir); throw fail('PRIVATE_RUN_ALREADY_EXISTS'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  }
  const stat = await fs.lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw fail('PRIVATE_PATH_LINK_REJECTED');
  if (process.platform === 'win32') await windowsAcl(dir, create);
  else if ((stat.mode & 0o077) !== 0) throw fail('PRIVATE_PERMISSIONS_REQUIRED');
  return { repo, dir };
}
export async function writePrivateState(dir, state) {
  const target = path.join(dir, 'state.json'), temporary = target + '.tmp-' + randomUUID();
  const handle = await fs.open(temporary, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(state)); await handle.sync(); }
  finally { await handle.close(); }
  await fs.rename(temporary, target);
  try { const parent = await fs.open(dir, 'r'); try { await parent.sync(); } finally { await parent.close(); } }
  catch (e) { if (!['EPERM', 'EISDIR', 'EINVAL', 'ENOTSUP'].includes(e.code)) throw e; }
}
export async function readPrivateState(repo, dir) {
  await securePrivateDirectory(repo, dir);
  const file = path.join(dir, 'state.json'), stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 256 * 1024 ||
      (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)) throw fail('PRIVATE_STATE_INVALID');
  const state = JSON.parse(await fs.readFile(file, 'utf8'));
  if (state?.version !== 1 || state?.kind !== 'd087-private-run' || !state.runId) throw fail('PRIVATE_STATE_INVALID');
  return state;
}
export async function withPrivateRun(repo, dir, callback) {
  await securePrivateDirectory(repo, dir);
  let lock;
  try { lock = await fs.open(path.join(dir, 'RUNNING.lock'), 'wx', 0o600); }
  catch { throw fail('D087_RUN_ALREADY_LOCKED'); }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    await lock.sync();
    return await callback(await readPrivateState(repo, dir));
  } finally { await lock.close(); await fs.unlink(path.join(dir, 'RUNNING.lock')); }
}

// A crash lock is evidence. No automatic takeover or process termination is implemented.
// Root can remove only this scoped lock after proving the previous bounded runner exited.
