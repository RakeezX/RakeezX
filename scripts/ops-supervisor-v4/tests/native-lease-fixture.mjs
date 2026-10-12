import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const [runtime, leaseScript] = process.argv.slice(2);
if (process.platform !== 'win32' || !path.isAbsolute(runtime ?? '') || !path.isAbsolute(leaseScript ?? '')) throw new Error('Absolute native fixture paths required');
await fs.mkdir(runtime);
const activation = 'lease-date-fixture-' + randomUUID();
const ps5 = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const ps7 = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'pwsh.exe');
const output = { fixtureOnly: true, noCodex: true, noProduct: true, startedAt: new Date().toISOString(), engines: [] };
const save = () => fs.writeFile(path.join(runtime, 'NATIVE_LEASE_DATE_RESULT.json'), JSON.stringify(output, null, 2) + '\n');
const json = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
function assert(condition, message) { if (!condition) throw new Error(message); }
function child(command, args) {
  const process = spawn(command, args, { cwd: runtime, shell: false, detached: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  process.stdout.on('data', data => stdout += data); process.stderr.on('data', data => stderr += data);
  const done = new Promise((resolve, reject) => {
    process.once('error', reject);
    process.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  return { process, done };
}
const script = `param([string]$TaskFile,[string]$AttemptFile)
$ErrorActionPreference='Stop'
$task=[IO.File]::ReadAllText($TaskFile)|ConvertFrom-Json
$spec=[IO.File]::ReadAllText($AttemptFile)|ConvertFrom-Json
$p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID) -ErrorAction Stop
$record=@{taskId=$task.id;runId=$spec.runId;runnerPid=$PID;runnerCreatedAt=$p.CreationDate.ToUniversalTime().ToString('o');engine=$PSVersionTable.PSVersion.ToString();commandLine=$p.CommandLine}
[IO.File]::WriteAllText($spec.checkpointPath,($record|ConvertTo-Json -Depth 5))
$until=[DateTime]::UtcNow.AddSeconds(40)
while ([DateTime]::UtcNow -lt $until -and !(Test-Path -LiteralPath $spec.stopPath)) { Start-Sleep -Milliseconds 100 }
exit 0
`;
try {
  for (const [engineName, engine] of [['ps5', ps5], ['ps7', ps7]]) {
    const directory = path.join(runtime, engineName), queue = path.join(directory, 'queue'), attempts = path.join(directory, 'attempts');
    await fs.mkdir(queue, { recursive: true }); await fs.mkdir(attempts);
    const taskFile = path.join(queue, 'fixture.json'), attemptFile = path.join(attempts, 'attempt.json'), checkpointPath = path.join(attempts, 'checkpoint.json'), stopPath = path.join(attempts, 'owner.stop');
    const wrapper = path.join(directory, 'run-task.ps1'), runId = randomUUID();
    await fs.writeFile(wrapper, script);
    await fs.writeFile(path.join(directory, 'workflow-v5.json'), JSON.stringify({ controller: { activationId: activation } }));
    await fs.writeFile(taskFile, JSON.stringify({ id: 'lease-date-' + engineName, workflowVersion: 5, activationId: activation, status: 'running', attempt: { runId, specPath: attemptFile, checkpointPath } }));
    await fs.writeFile(attemptFile, JSON.stringify({ runId, checkpointPath, stopPath }));
    const owner = child(engine, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', wrapper, '-TaskFile', taskFile, '-AttemptFile', attemptFile]);
    const record = { engineName, engine, ownerPid: owner.process.pid, checks: [] }; output.engines.push(record);
    try {
      let checkpoint;
      for (let attempt = 0; attempt < 70; attempt++) {
        try { checkpoint = await json(checkpointPath); break; } catch (error) { if (error.code !== 'ENOENT') throw error; }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert(checkpoint?.runnerPid === owner.process.pid, 'Real owner checkpoint missing');
      record.owner = checkpoint;
      const invoke = action => child(engine, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', leaseScript,
        '-Name', 'browser', '-Action', action, '-TaskFile', taskFile, '-RuntimeRoot', directory, '-WaitSeconds', '0']).done;
      const leasePath = path.join(directory, 'leases', 'browser.json');
      for (const [name, action, expected] of [['acquire', 'acquire', /^ACQUIRED browser/], ['repeat-acquire', 'acquire', /^ALREADY OWNED browser/], ['release', 'release', /^RELEASED browser/]]) {
        const result = await invoke(action); record.checks.push({ name, ...result }); await save();
        assert(result.code === 0 && expected.test(result.stdout.trim()), name + ' failed: ' + JSON.stringify(result));
      }
      await assertAbsent(leasePath);
      const original = await fs.readFile(checkpointPath, 'utf8');
      const wrongBirth = checkpoint.runnerCreatedAt.replace(/\.(\d{7})Z$/, (_all, digits) => '.' + String(BigInt(digits) + 1n).padStart(7, '0') + 'Z');
      assert(wrongBirth !== checkpoint.runnerCreatedAt, 'Could not change one exact birth tick');
      await fs.writeFile(checkpointPath, JSON.stringify({ ...checkpoint, runnerCreatedAt: wrongBirth }));
      const rejected = await invoke('acquire'); record.checks.push({ name: 'wrong-birth-one-tick-refused', expectedBirth: checkpoint.runnerCreatedAt, presentedBirth: wrongBirth, ...rejected });
      assert(rejected.code !== 0 && rejected.stderr.includes('Exact worker process not verified'), 'Wrong birth was not rejected');
      await assertAbsent(leasePath); await fs.writeFile(checkpointPath, original); record.passed = true;
    } finally {
      await fs.writeFile(stopPath, 'Fixture complete'); const ended = await owner.done; record.ownerExit = ended;
      assert(ended.code === 0, 'Fixture owner failed to finish naturally'); await save();
    }
  }
  output.status = 'PASS';
} catch (error) { output.status = 'FAIL'; output.error = error.stack; process.exitCode = 1; }
finally { output.finishedAt = new Date().toISOString(); await save(); }
console.log(JSON.stringify({ status: output.status, fixtureOnly: true, noCodex: true, engines: output.engines.map(item => ({ engine: item.owner?.engine, ownerPid: item.ownerPid, passed: item.passed, checks: item.checks.map(test => ({name:test.name,code:test.code})), ownerExitCode: item.ownerExit?.code })), error: output.error }));
async function assertAbsent(file) { try { await fs.access(file); throw new Error('Lease file unexpectedly present'); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
