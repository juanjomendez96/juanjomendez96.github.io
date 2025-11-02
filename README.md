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

## Architecture Decision Records
- ADRs live under `docs/adr/` and follow the `NNNN-title.md` naming convention.
- Start new records from `docs/adr/0000-template.md`, copy it to the next sequential number, then fill in the details.
- Keep ADRs in the same pull request as the work when possible so the decision and implementation stay linked.

## Contributing
1. Fork the repository and create a feature branch.
2. Run `make install` to set up the local environment and install pre-commit hooks.
3. Develop your changes and preview them locally with `make serve`.
4. Ensure formatting and tests (if any) pass before opening a pull request.
5. Describe the motivation and approach clearly when you submit the PR.
