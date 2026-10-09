// Railway stops the old container with SIGTERM on every deploy. The API must
// exit 0 through `npm run server` (the start command); a non-zero exit is
// reported as "Deploy Crashed". Windows can't deliver SIGTERM, so this runs on
// Linux (CI) only.
const { spawn } = require('child_process');
const path = require('path');

const linuxOnly = process.platform === 'win32' ? test.skip : test;

linuxOnly('the API exits cleanly on SIGTERM', async () => {
  const child = spawn('npm', ['run', 'server'], {
    cwd: path.join(__dirname, '../..'),
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the API did not start')), 20000);
    child.stdout.on('data', (chunk) => {
      if (/listening/.test(String(chunk))) {
        clearTimeout(timer);
        resolve();
      }
    });
    exited.then(({ code }) => reject(new Error(`the API exited before listening (code ${code})`)));
  });

  child.kill('SIGTERM');
  expect(await exited).toEqual({ code: 0, signal: null });
}, 30000);
