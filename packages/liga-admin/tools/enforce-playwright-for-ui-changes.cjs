#!/usr/bin/env node

const { execSync } = require('child_process');

const uiPatterns = [
  /^src\/components\/.+\.(jsx?|tsx?)$/,
  /^src\/pages\/.+\.(jsx?|tsx?)$/,
  /^src\/App\.jsx$/,
  /^src\/main\.jsx$/,
];

const playwrightPatterns = [
  /^tests\/e2e\/.+\.spec\.js$/,
  /^tests\/e2e\/helpers\.js$/,
  /^playwright\.config\.js$/,
  /^playwright\.preview\.config\.js$/,
];

function run(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    staged: args.includes('--staged'),
    baseRef: null,
  };

  const baseArg = args.find((arg) => arg.startsWith('--base='));
  if (baseArg) {
    opts.baseRef = baseArg.slice('--base='.length);
  }

  return opts;
}

function getChangedFiles({ staged, baseRef }) {
  if (staged) {
    return run('git diff --cached --name-only')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const candidateRanges = [];

  if (baseRef) {
    candidateRanges.push(`${baseRef}...HEAD`);
  }

  candidateRanges.push('origin/main...HEAD', 'HEAD~1...HEAD');

  for (const range of candidateRanges) {
    const output = run(`git diff --name-only ${range}`);
    if (output) {
      return output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function matchesAny(patterns, filePath) {
  return patterns.some((pattern) => pattern.test(filePath));
}

function main() {
  const options = parseArgs();
  const changedFiles = getChangedFiles(options);

  if (changedFiles.length === 0) {
    console.log('check:ui-e2e: no changed files detected, skipping.');
    process.exit(0);
  }

  const uiChanges = changedFiles.filter((filePath) => matchesAny(uiPatterns, filePath));
  if (uiChanges.length === 0) {
    console.log('check:ui-e2e: no UI component/page changes detected.');
    process.exit(0);
  }

  const playwrightChanges = changedFiles.filter((filePath) => matchesAny(playwrightPatterns, filePath));
  if (playwrightChanges.length > 0) {
    console.log('check:ui-e2e: UI changes include Playwright updates ✅');
    process.exit(0);
  }

  console.error('\n❌ check:ui-e2e failed');
  console.error('UI files were changed but no Playwright tests were updated.');
  console.error('\nChanged UI files:');
  uiChanges.forEach((filePath) => console.error(`  - ${filePath}`));

  console.error('\nRequired action:');
  console.error('  1) Add or update a Playwright spec in tests/e2e/*.spec.js');
  console.error('  2) Include at least one impacted flow + one adjacent regression flow');
  console.error('  3) Re-run: npm run check:ui-e2e');

  process.exit(1);
}

main();
