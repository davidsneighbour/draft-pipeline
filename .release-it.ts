import type { Config } from 'release-it';

const config = {
  npm: false,
  git: {
    requireCleanWorkingDir: true,
    commit: true,
    commitMessage: 'chore(release): v${version}',
    tag: true,
    tagName: 'v${version}',
    push: true,
    pushArgs: ['--follow-tags'],
  },
  github: {
    release: true,
    releaseName: 'v${version}',
    skipChecks: true,
    tokenRef: 'GITHUB_TOKEN_DEV',
  },
  plugins: {
    '@release-it/conventional-changelog': {
      infile: 'CHANGELOG.md',
      preset: {
        name: 'conventionalcommits',
        types: [
          { type: 'content', section: 'Content' },
          { type: 'feat', section: 'Features' },
          { type: 'fix', section: 'Bug Fixes' },
          { type: 'build', section: 'Other Changes' },
          { type: 'chore', section: 'Other Changes' },
          { type: 'ci', section: 'Other Changes' },
          { type: 'docs', section: 'Other Changes' },
          { type: 'perf', section: 'Other Changes' },
          { type: 'refactor', section: 'Other Changes' },
          { type: 'revert', section: 'Other Changes' },
          { type: 'style', section: 'Other Changes' },
          { type: 'test', section: 'Other Changes' },
        ],
      },
      whatBump(commits: Array<{ type?: string; notes?: unknown[] }>) {
        let level: 2 | 1 | 0 | null = null;

        for (const commit of commits) {
          const notes = Array.isArray(commit.notes) ? commit.notes : [];
          const type = typeof commit.type === 'string' ? commit.type : '';

          if (notes.length > 0) {
            return {
              level: 0,
              reason: 'There are BREAKING CHANGES.',
            };
          }

          if (type === 'feat' || type === 'content') {
            level = 1;
            continue;
          }

          if (
            level === null &&
            ['fix', 'build', 'chore', 'ci', 'docs', 'perf', 'refactor', 'revert', 'style', 'test'].includes(type)
          ) {
            level = 2;
          }
        }

        if (level === null) {
          return false;
        }

        return {
          level,
          reason:
            level === 1
              ? 'There are feat/content commits.'
              : 'There are patch-level changes.',
        };
      }
    },
  },
} satisfies Config;

export default config;
