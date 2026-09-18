import { runTests } from '@vscode/test-electron';
import { resolve } from 'node:path';
const deadline = setTimeout(() => {
  console.error('Extension test timeout. Check the official VS Code runtime download or set NOTE_WORKBENCH_VSCODE to a working local executable.');
  process.exit(1);
}, Number(process.env.NOTE_WORKBENCH_TEST_TIMEOUT_MS || 180000));
deadline.unref();
try {
await runTests({
  version: process.env.NOTE_WORKBENCH_VSCODE_VERSION || '1.100.3',
  vscodeExecutablePath: process.env.NOTE_WORKBENCH_VSCODE,
  extensionDevelopmentPath: resolve('.'),
  extensionTestsPath: resolve('dist/test/suite.cjs'),
  launchArgs: [resolve('test/fixtures/vault'), '--user-data-dir=' + resolve('.vscode-test/user-data'), '--extensions-dir=' + resolve('.vscode-test/extensions'), '--disable-extensions', '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust'],
});
} finally { clearTimeout(deadline); }
