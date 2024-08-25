init:
	poetry install --no-root && ln -s hooks/commit-msg .git/hooks/commit-msg

changelog:
	git-cliff -o CHANGELOG.md