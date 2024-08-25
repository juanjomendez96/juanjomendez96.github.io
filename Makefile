init:
	poetry install --no-root && ln -s hooks/commit-msg .git/hooks/commit-msg

run:
	python run.py

changelog:
	git-cliff -o CHANGELOG.md