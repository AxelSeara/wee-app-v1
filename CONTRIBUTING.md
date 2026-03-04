# Contributing to Wee

Thanks for helping improve Wee.

## Ground rules

- Be respectful and follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
- Keep changes focused and easy to review.
- Prefer small PRs over large refactors.
- Do not commit secrets or environment keys.

## Local setup

1. Clone the repo.
2. Install dependencies:

```bash
npm install
```

3. Run in dev mode:

```bash
npm run dev
```

## Before opening a PR

Run the project checks:

```bash
npm run typecheck
npm run test -- --run
npm run build
```

If you changed UI/copy/i18n, also verify:

- Spanish (`es`) still reads naturally.
- English (`en`) and Galician (`gl`) equivalents are complete.
- No new hardcoded strings outside i18n helpers.

## Branches and commits

- Branch naming: `feat/...`, `fix/...`, `docs/...`, `chore/...`.
- Commit messages: imperative style, concise.

Examples:

- `feat: add invite preview screen`
- `fix: allow voting after source open`
- `docs: update supabase setup steps`

## PR checklist

- [ ] Scope is clear and limited.
- [ ] Tests pass locally.
- [ ] Build passes locally.
- [ ] No secrets in code or screenshots.
- [ ] Migration/SQL changes are documented (if any).
- [ ] UX text is consistent across `es/en/gl`.

## Reporting bugs

Please include:

- What happened
- Expected behavior
- Steps to reproduce
- Environment (browser/device)
- Screenshots/logs when useful

## Security

For sensitive vulnerabilities, do not open a public issue first. See
[SECURITY.md](./SECURITY.md).
