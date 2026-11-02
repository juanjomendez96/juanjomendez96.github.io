# juanjomendez96.github.io

Personal website for Juan José Méndez, served statically through GitHub Pages.

## Quick Links
- Live site: https://juanjomendez96.github.io
- Make targets overview: `make help`

## Prerequisites
- Python 3.12 (automatically pinned during setup)
- [uv](https://github.com/astral-sh/uv) for Python environment management
- GNU Make
- Git (required for deployment)

## Install the Environment
```bash
make install
```
The install target removes any outdated `uv.lock` file, pins Python 3.12 via `uv`, recreates the virtual environment, and installs the project dependencies plus the `pre-commit` hooks.

## Serve Locally
```bash
make serve
```
The site is served with Python’s built-in HTTP server on `http://localhost:4000` by default. Override the port when needed, for example: `PORT=8080 make serve`.

## Deploy the Site
```bash
make deploy
```
Deploying pushes the `master` branch to `origin`, which triggers the GitHub Pages pipeline. Deployment only continues if you are on `master` and working tree changes are committed or stashed.

## Releases and Versioning
Releases are automatic and follow [Semantic Versioning](https://semver.org). Every push to `master` runs `.github/workflows/release.yml`, which uses [commitizen](https://commitizen-tools.github.io/commitizen/) to read the [Conventional Commits](https://www.conventionalcommits.org) since the last tag and decide the next version:

| Commit type | Version bump | Example |
|---|---|---|
| `fix:` | patch (`1.1.0` → `1.1.1`) | `fix(nav): keep menu open on resize` |
| `feat:` | minor (`1.1.0` → `1.2.0`) | `feat(theme): add high-contrast mode` |
| `feat!:` or a `BREAKING CHANGE:` footer | major (`1.1.0` → `2.0.0`) | `feat!: drop the ?lang= parameter` |
| `docs:`, `chore:`, `ci:`, `style:`, `test:`, `refactor:` | no release | |

When a release is due the workflow bumps the version in `pyproject.toml`, updates `CHANGELOG.md`, pushes a `bump:` commit and an annotated `vX.Y.Z` tag, and publishes a GitHub Release with the notes for that version. Preview what the next release would be with `make release-dry-run`.

Commit messages are checked locally by the commitizen pre-commit hook (installed by `make install`) and must follow the Conventional Commits format.

## Theming
- The page follows the visitor's OS light/dark preference until they use the sun/moon button in the header; that choice is stored in `localStorage` (`preferred-theme`).
- All colors are CSS variables defined at the top of `assets/css/main.css`: dark values in `:root`, light values in `:root[data-theme="light"]`. Use the variables instead of hardcoded colors so both themes keep working.
- A small inline script in `index.html` sets `data-theme` before first paint to avoid a flash of the wrong theme.

## Architecture Decision Records
- ADRs live under `docs/adr/` and follow the `NNNN-title.md` naming convention.
- Start new records from `docs/adr/0000-template.md`, copy it to the next sequential number, then fill in the details.
- Keep ADRs in the same pull request as the work when possible so the decision and implementation stay linked.

## Localization
- Switch between English and Spanish from the header toggle; the choice persists in `localStorage` and can be forced with `?lang=en` or `?lang=es`.
- Locale-specific partials live under `partials/<locale>/` (for example `partials/es/`) and mirror the base HTML structure.
- Shared strings (document title, meta description, navigation, etc.) are in `i18n/<locale>.json`. Add new keys in both the English file and the target locale.
- When adding another language, copy the English partials, translate them, create a JSON dictionary, and register the locale code in `assets/js/main.js`.

## Contributing
1. Fork the repository and create a feature branch.
2. Run `make install` to set up the local environment and install pre-commit hooks.
3. Develop your changes and preview them locally with `make serve`.
4. Run `make test` and make sure it passes before opening a pull request. The checks (standard-library `unittest`, in `tests/`) keep the English and Spanish content in sync, make sure both themes define every color token, and validate the release configuration.
5. Describe the motivation and approach clearly when you submit the PR.
