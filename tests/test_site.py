"""Static checks for the portfolio (standard library only).

Run with `make test` or `python3 -m unittest discover -s tests -v`.
They guard the things that are easy to break silently in a no-build site:
locale parity, theme tokens, the nav anchors and the release configuration.
"""

from __future__ import annotations

import json
import re
import tomllib
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ("en", "es")


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def flatten(data: dict, prefix: str = "") -> set[str]:
    keys: set[str] = set()
    for key, value in data.items():
        path = f"{prefix}{key}"
        if isinstance(value, dict):
            keys |= flatten(value, f"{path}.")
        else:
            keys.add(path)
    return keys


class StructureParser(HTMLParser):
    """Collects the shape of a document (tags, ids, classes) and ignores text."""

    def __init__(self) -> None:
        super().__init__()
        self.shape: list[tuple[str, str, tuple[str, ...]]] = []
        self.ids: list[str] = []
        self.i18n_keys: set[str] = set()
        self.hrefs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {name: value or "" for name, value in attrs}
        classes = tuple(sorted(attributes.get("class", "").split()))
        self.shape.append((tag, attributes.get("id", ""), classes))
        if "id" in attributes:
            self.ids.append(attributes["id"])
        if "href" in attributes:
            self.hrefs.append(attributes["href"])
        if "data-i18n-key" in attributes:
            self.i18n_keys.add(attributes["data-i18n-key"])
        for mapping in attributes.get("data-i18n-attr", "").split(";"):
            if ":" in mapping:
                self.i18n_keys.add(mapping.split(":", 1)[1].strip())


def parse(html: str) -> StructureParser:
    parser = StructureParser()
    parser.feed(html)
    return parser


def partial_names() -> list[str]:
    return re.findall(r'data-partial="([^"]+)"', read("index.html"))


def css_block(css: str, selector: str) -> str:
    """Returns the body of the first top-level rule that starts with `selector {`."""
    start = css.index(f"{selector} {{")
    end = css.index("\n}", start)
    return css[start:end]


class LocaleTests(unittest.TestCase):
    def test_i18n_files_define_the_same_keys(self) -> None:
        keys = {loc: flatten(json.loads(read(f"i18n/{loc}.json"))) for loc in LOCALES}
        self.assertEqual(keys["en"], keys["es"])

    def test_every_i18n_key_used_in_html_is_defined(self) -> None:
        used = parse(read("index.html")).i18n_keys
        self.assertTrue(used, "expected index.html to use i18n keys")
        for loc in LOCALES:
            defined = flatten(json.loads(read(f"i18n/{loc}.json")))
            self.assertEqual(used - defined, set(), f"missing i18n keys in {loc}")

    def test_every_partial_exists_in_every_locale(self) -> None:
        names = partial_names()
        self.assertGreaterEqual(len(names), 8)
        for loc in LOCALES:
            for name in names:
                self.assertTrue((ROOT / f"partials/{loc}/{name}.html").is_file(), f"{loc}/{name}")

    def test_locale_partials_share_the_same_structure(self) -> None:
        for name in partial_names():
            shapes = {loc: parse(read(f"partials/{loc}/{name}.html")).shape for loc in LOCALES}
            self.assertEqual(shapes["en"], shapes["es"], f"partial '{name}' differs between locales")

    def test_nav_links_point_to_existing_sections(self) -> None:
        index = parse(read("index.html"))
        anchors = [href for href in index.hrefs if href.startswith("#") and href != "#top"]
        self.assertGreaterEqual(len(anchors), 6)
        for loc in LOCALES:
            ids = set(index.ids)
            for name in partial_names():
                ids |= set(parse(read(f"partials/{loc}/{name}.html")).ids)
            for anchor in anchors:
                self.assertIn(anchor[1:], ids, f"{anchor} has no target in {loc}")


class ContentTests(unittest.TestCase):
    def test_ai_masters_degree_is_marked_as_completed(self) -> None:
        for loc, title in (("en", "M.S. in AI Applied to Software Development"),
                           ("es", "Máster en IA Aplicada al Desarrollo de Software")):
            html = read(f"partials/{loc}/education.html")
            self.assertIn(title, html)
            self.assertNotRegex(html.lower(), r"in progress|en curso")


class ThemeTests(unittest.TestCase):
    COLOR_TOKENS = (
        "--bg", "--surface", "--surface-raised", "--surface-inset", "--text", "--text-2", "--muted",
        "--violet", "--violet-rgb", "--violet-text", "--on-violet", "--ok", "--ok-rgb", "--on-ok",
        "--line", "--line-strong", "--hover-bg", "--header-bg", "--menu-bg", "--glow", "--shadow",
        "--icon-filter",
    )

    def setUp(self) -> None:
        self.css = read("assets/css/main.css")
        self.dark = css_block(self.css, ":root")
        self.light = css_block(self.css, ':root[data-theme="light"]')

    def test_light_theme_overrides_every_color_token(self) -> None:
        for token in self.COLOR_TOKENS:
            self.assertRegex(self.dark, rf"{re.escape(token)}:", f"{token} missing in dark theme")
            self.assertRegex(self.light, rf"{re.escape(token)}:", f"{token} missing in light theme")

    def test_each_theme_declares_its_color_scheme(self) -> None:
        self.assertIn("color-scheme: dark", self.dark)
        self.assertIn("color-scheme: light", self.light)

    def test_no_hardcoded_colors_outside_the_token_blocks(self) -> None:
        rest = self.css.replace(self.dark, "").replace(self.light, "")
        rest = re.sub(r"/\*.*?\*/", "", rest, flags=re.S)
        literal = re.findall(r"#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d", rest)
        self.assertEqual(literal, [], "use the CSS variables so both themes keep working")

    def test_theme_storage_key_matches_between_head_script_and_main_js(self) -> None:
        match = re.search(r'THEME_STORAGE_KEY = "([^"]+)"', read("assets/js/main.js"))
        self.assertIsNotNone(match)
        self.assertIn(f'getItem("{match.group(1)}")', read("index.html"))

    def test_theme_toggle_exists_and_is_translated(self) -> None:
        html = read("index.html")
        self.assertIn('class="theme-toggle"', html)
        for loc in LOCALES:
            self.assertIn("toggle", json.loads(read(f"i18n/{loc}.json"))["theme"])


class MotionTests(unittest.TestCase):
    def test_reduced_motion_is_respected_in_css_and_js(self) -> None:
        self.assertIn("@media (prefers-reduced-motion: reduce)", read("assets/css/main.css"))
        self.assertIn("(prefers-reduced-motion: reduce)", read("assets/js/main.js"))

    def test_spring_easing_tokens_are_defined(self) -> None:
        css = read("assets/css/main.css")
        for token in ("--spring", "--spring-soft"):
            self.assertRegex(css, rf"{token}: linear\(0,")

    def test_split_headings_exist_in_every_locale(self) -> None:
        for loc in LOCALES:
            html = "".join(read(f"partials/{loc}/{name}.html") for name in partial_names())
            self.assertIn("data-split", html)


class ReleaseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = tomllib.loads(read("pyproject.toml"))

    def test_project_version_is_semver(self) -> None:
        self.assertRegex(self.config["project"]["version"], r"^\d+\.\d+\.\d+$")

    def test_commitizen_is_configured_for_semantic_releases(self) -> None:
        cz = self.config["tool"]["commitizen"]
        self.assertEqual(cz["tag_format"], "v$version")
        self.assertEqual(cz["version_provider"], "uv")
        self.assertFalse(cz["major_version_zero"])
        self.assertTrue(cz["annotated_tag"])
        self.assertTrue(cz["update_changelog_on_bump"])

    def test_release_workflow_replaces_the_old_changelog_job(self) -> None:
        workflow = read(".github/workflows/release.yml")
        self.assertIn("cz bump", workflow)
        self.assertIn("gh release create", workflow)
        self.assertIn("unittest discover", workflow)  # tests gate every release
        self.assertIn("startsWith(github.event.head_commit.message, 'bump:')", workflow)
        self.assertFalse((ROOT / ".github/workflows/deploy.yml").exists())
        self.assertFalse((ROOT / "scripts/update_changelog.py").exists())

    def test_commit_message_hook_uses_commitizen(self) -> None:
        hooks = read(".pre-commit-config.yaml")
        self.assertIn("commitizen-tools/commitizen", hooks)
        self.assertNotIn("commit_message_lint.py", hooks)

    def test_changelog_uses_the_commitizen_format(self) -> None:
        self.assertRegex(read("CHANGELOG.md"), r"^## v\d+\.\d+\.\d+ \(\d{4}-\d{2}-\d{2}\)")


if __name__ == "__main__":
    unittest.main()
