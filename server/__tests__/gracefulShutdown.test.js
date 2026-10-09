// Railway stops the old container with SIGTERM on every deploy; the API must
// then exit 0 (a non-zero exit is reported as "Deploy Crashed"). Railway's
// start command runs `node server/server.js` directly, so nothing in between
// can swallow the signal. Windows can't deliver SIGTERM, so this runs on Linux
// (CI) only.
const { spawn } = require('child_process');
const path = require('path');

const linuxOnly = process.platform === 'win32' ? test.skip : test;

linuxOnly('the API exits cleanly on SIGTERM', async () => {
  const child = spawn(process.execPath, ['server/server.js'], {
    cwd: path.join(__dirname, '../..'),
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));

  const started = await Promise.race([
    new Promise((resolve) => child.stdout.on('data', () => /listening/.test(output) && resolve(true))),
    exited.then(() => false),
    new Promise((resolve) => setTimeout(() => resolve(false), 20000)),
  ]);
  if (started) child.kill('SIGTERM');
  const result = started ? await exited : { started: false };

  if (!started || result.code !== 0) {
    // A GitHub annotation, readable on the run page without opening the log.
    process.stdout.write(`\n::error title=gracefulShutdown::${JSON.stringify({ result, output: output.slice(-1500) })}\n`);
    child.kill('SIGKILL');
  }
  expect(result).toEqual({ code: 0, signal: null });
}, 30000);
