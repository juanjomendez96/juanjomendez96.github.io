# Default options
SHELL := /bin/sh
PORT ?= 4000

.PHONY: help serve test deploy release-dry-run skills-sync

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "%-12s %s\n", $$1, $$2}'


install: ## Install development environment
	@echo "Installing development environment..."
	@rm -rf uv.lock && uv python pin 3.12 && uv sync && source .venv/bin/activate && pre-commit install

serve: ## Serve the site locally for preview
	@echo "Starting local server on http://localhost:$(PORT)"
	@python3 -m http.server $(PORT)

test: ## Run the static checks (locales, theme tokens, release config)
	@PYTHONDONTWRITEBYTECODE=1 uv run --no-project --python 3.12 python -m unittest discover -s tests -v

deploy: ## Push master branch to trigger GitHub Pages deployment
	@if [ "$$(git rev-parse --abbrev-ref HEAD)" != "master" ]; then \
		echo "🚫 Deploy from master only. Current branch: $$(git rev-parse --abbrev-ref HEAD)"; \
		exit 1; \
	fi
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "🚫 Working tree has uncommitted changes. Commit or stash before deploying."; \
		git status --short; \
		exit 1; \
	fi
	@echo "✅ Pushing master to origin to trigger GitHub Pages deployment..."
	@git push origin master

release-dry-run: ## Preview the next version and changelog without changing anything
	@uvx --from "commitizen==4.19.3" cz bump --dry-run --yes

# Select skills from the skills repository and install them into .agents/skills
# (visible to Claude Code via the .claude/skills symlink).
#   make skills-sync                      interactive selection
#   make skills-sync SKILLS=pr-description   or SKILLS=all (non-interactive)
#   make skills-sync SKILLS_REPO=<url|path>  use a different source repo
skills-sync:
	@SKILLS="$(SKILLS)" SKILLS_REPO="$(SKILLS_REPO)" ./scripts/skills-sync.sh
