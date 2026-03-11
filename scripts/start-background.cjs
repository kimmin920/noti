const { spawn } = require('node:child_process');

const processes = [
  ['worker', ['run', 'start', '-w', '@publ/worker']],
  ['poller', ['run', 'start', '-w', '@publ/poller']]
];

const children = processes.map(([name, args]) => {
  const child = spawn('npm', args, {
    stdio: 'inherit',
    env: process.env
  });

  child.on('error', (error) => {
    console.error(`[background] failed to start ${name}:`, error);
    shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const detail = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[background] ${name} exited with ${detail}`);
    shutdown(code ?? 1);
  });

  return child;
});

let shuttingDown = false;

function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => process.exit(exitCode), 250);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
