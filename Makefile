# Default options
SHELL := /bin/sh
PORT ?= 4000

.PHONY: help serve deploy release

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "%-12s %s\n", $$1, $$2}'


install: ## Install development environment
	@echo "Installing development environment..."
	@rm -rf uv.lock && uv python pin 3.12 && uv sync && source .venv/bin/activate && pre-commit install

serve: ## Serve the site locally for preview
	@echo "Starting local server on http://localhost:$(PORT)"
	@python3 -m http.server $(PORT)

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

release: ## Publish a semantic release (requires GH_TOKEN or GITHUB_TOKEN)
	@[ -n "$${GH_TOKEN:-$${GITHUB_TOKEN:-}}" ] || { echo "🚫 Set GH_TOKEN or GITHUB_TOKEN with repo write access before releasing."; exit 1; }
	@echo "Publishing semantic release..."
	@uv run semantic-release publish
