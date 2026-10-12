#!/usr/bin/env node
/** Windows lifecycle shim only: one wrapper, no queue decisions or retries. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const values = process.argv.slice(2), options = {};
for (let index = 0; index < values.length; index += 2) options[values[index]] = values[index + 1];
for (const key of ['--task', '--attempt', '--powershell', '--wrapper', '--cwd']) if (!options[key] || !path.isAbsolute(options[key])) throw new Error('Absolute broker argument required: ' + key);
const taskFile = options['--task'], attemptFile = options['--attempt'];
const read = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const spec = await read(attemptFile), task = await read(taskFile);
if (spec.taskId !== task.id || spec.runId !== task.attempt?.runId || spec.activationId !== task.activationId || task.status !== 'running') throw new Error('Broker attempt is not the current activated running card');
if (path.resolve(spec.taskFile).toLowerCase() !== path.resolve(taskFile).toLowerCase()) throw new Error('Broker task path mismatch');
const directory = path.dirname(attemptFile), receiptPath = path.join(directory, 'wrapper-launch.json');
const stdoutPath = path.join(directory, 'wrapper.stdout.txt'), stderrPath = path.join(directory, 'wrapper.stderr.txt');
const lock = await fs.open(path.join(directory, 'broker.lock'), 'wx');
const receipt = { version: 1, taskId: task.id, activationId: task.activationId, runId: spec.runId,
  brokerPid: process.pid, brokerStartedAt: new Date().toISOString(), status: 'starting',
  executable: options['--powershell'], args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', options['--wrapper'], '-TaskFile', taskFile, '-AttemptFile', attemptFile],
  cwd: options['--cwd'], wrapperPid: null, exitCode: null, signal: null, error: null, stdoutPath, stderrPath };
async function save() {
  const temporary = `${receiptPath}.${process.pid}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' }); await fs.rename(temporary, receiptPath); }
  finally { await fs.rm(temporary, { force: true }); }
}
let stdout, stderr, child;
try {
  await save();
  stdout = await fs.open(stdoutPath, 'wx'); stderr = await fs.open(stderrPath, 'wx');
  // PowerShell 5.1 can silently skip its command under DETACHED_PROCESS.
  // This detached Node broker stays alive to own its non-detached child job.
  child = spawn(receipt.executable, receipt.args, { cwd: receipt.cwd, shell: false, detached: false, windowsHide: true,
    stdio: ['ignore', stdout.fd, stderr.fd] });
  const ended = new Promise(resolve => {
    child.once('error', error => { receipt.error = error.message; receipt.spawnErrorCode = error.code ?? null; resolve(); });
    child.once('exit', (code, signal) => { receipt.exitCode = code; receipt.signal = signal; receipt.exitedAt = new Date().toISOString(); });
    child.once('close', (code, signal) => { receipt.exitCode ??= code; receipt.signal ??= signal; resolve(); });
  });
  await new Promise(resolve => { child.once('spawn', resolve); child.once('error', resolve); });
  receipt.wrapperPid = child.pid ?? null; receipt.status = child.pid ? 'running' : 'spawn_error';
  await save();
  await stdout.close(); stdout = null; await stderr.close(); stderr = null;
  await ended; // Keep this process alive; it never retries or starts another worker.
  receipt.status = receipt.error ? 'spawn_error' : 'exited'; receipt.finishedAt = new Date().toISOString();
  await save(); process.exitCode = receipt.exitCode === 0 && !receipt.error ? 0 : 1;
} catch (error) {
  receipt.error = error.message; receipt.status = 'broker_error'; receipt.finishedAt = new Date().toISOString();
  try { await save(); } catch (saveError) { process.stderr.write(saveError.stack + '\n'); }
  process.stderr.write(error.stack + '\n'); process.exitCode = 1;
  // A failure after spawning must not orphan an unobserved wrapper. The saved
  // receipt still identifies it; closing this broker's job ends that child.
  if (child && child.exitCode === null) child.kill();
} finally { await stdout?.close(); await stderr?.close(); await lock.close(); }
