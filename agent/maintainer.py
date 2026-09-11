#!/usr/bin/env python3
"""Tool-loop that writes the open-source list on this site from GitHub.

Plan: search merged PRs, keep one row per repo with agent/MCP/RAG/inference
first, patch index.html, leave a JSON trace the page can render.
Stdlib only. No LLM in the loop.
"""

from __future__ import annotations

import html
import json
import os
import re
import subprocess
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
TRACE = Path(__file__).resolve().parent / "last-run.json"
AUTHOR = "gyanu2507"
OSS_START = "<!-- maintainer:oss -->"
OSS_END = "<!-- /maintainer:oss -->"

DISPLAY = {
    "ag-ui-protocol/ag-ui": "AG-UI",
    "github/spec-kit": "Spec Kit",
    "punkpeye/fastmcp": "FastMCP",
    "ml-explore/mlx-lm": "mlx-lm",
    "deepset-ai/haystack": "Haystack",
    "benoitc/gunicorn": "Gunicorn",
    "pydantic/logfire": "Logfire",
    "Python-Markdown/markdown": "Python-Markdown",
    "Chainlit/chainlit": "Chainlit",
    "celery/kombu": "Kombu",
    "pydantic/pydantic-settings": "pydantic-settings",
    "markedjs/marked": "marked",
    "superlinked/sie": "SIE",
}

ALLOW_OWNERS = {
    "ag-ui-protocol",
    "github",
    "punkpeye",
    "deepset-ai",
    "ml-explore",
    "Chainlit",
    "benoitc",
    "pydantic",
    "Python-Markdown",
    "celery",
    "markedjs",
    "superlinked",
    "stanfordnlp",
    "getsentry",
    "zauberzeug",
    "microsoft",
    "Pylons",
    "sloria",
    "django-extensions",
}
WEIGHT = {
    "ag-ui": 100,
    "spec-kit": 96,
    "fastmcp": 92,
    "haystack": 88,
    "mlx-lm": 84,
    "mlx": 84,
    "chainlit": 80,
    "dspy": 76,
    "mastra": 74,
    "mcp": 70,
    "agent": 68,
    "interrupt": 66,
    "hitl": 66,
    "rag": 64,
    "llm": 60,
    "logfire": 40,
    "gunicorn": 36,
    "markdown": 20,
}


def github_token() -> str:
    env = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if env:
        return env
    raw = subprocess.check_output(
        ["git", "credential", "fill"],
        input=b"protocol=https\nhost=github.com\n\n",
    ).decode()
    for line in raw.splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1]
    raise SystemExit("no GitHub token")


def gh_get(url: str, token: str) -> dict | list:
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": AUTHOR,
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def search_merged_prs(token: str) -> tuple[list[dict], dict]:
    q = urllib.parse.quote(f"is:pr author:{AUTHOR} is:merged")
    data = gh_get(
        f"https://api.github.com/search/issues?q={q}&sort=updated&order=desc&per_page=40",
        token,
    )
    items = []
    for issue in data.get("items", []):
        repo_url = issue.get("repository_url") or ""
        repo = "/".join(repo_url.split("/")[-2:])
        html_url = issue.get("html_url") or ""
        items.append(
            {
                "repo": repo,
                "number": issue.get("number"),
                "title": (issue.get("title") or "").strip(),
                "url": html_url,
            }
        )
    trace = {
        "tool": "search_merged_prs",
        "ok": True,
        "detail": f"{len(items)} merged PRs",
    }
    return items, trace


def score(pr: dict) -> int:
    blob = f"{pr['repo']} {pr['title']}".lower()
    best = 0
    for token, weight in WEIGHT.items():
        if token in blob:
            best = max(best, weight)
    return best


def rank_agentic(prs: list[dict]) -> tuple[list[dict], dict]:
    best_by_repo: dict[str, dict] = {}
    for pr in prs:
        pr = {**pr, "score": score(pr)}
        if pr["score"] < 36:
            continue
        owner = pr["repo"].split("/")[0]
        if owner not in ALLOW_OWNERS:
            continue
        current = best_by_repo.get(pr["repo"])
        if current is None or pr["score"] > current["score"]:
            best_by_repo[pr["repo"]] = pr
    ranked = sorted(best_by_repo.values(), key=lambda p: (-p["score"], p["repo"]))[:7]
    trace = {
        "tool": "rank_agentic",
        "ok": True,
        "detail": f"kept {len(ranked)} of {len(best_by_repo)} repos",
    }
    return ranked, trace


def one_line(title: str) -> str:
    line = re.sub(r"^(fix|feat|docs|chore|refactor)(\([^)]+\))?:\s*", "", title, flags=re.I)
    line = line[0].upper() + line[1:] if line else title
    if line and line[-1] not in ".!?":
        line += "."
    return line


def wrap_code(text: str) -> str:
    escaped = html.escape(text, quote=True)
    for token in (
        "TOOL_CALL",
        "RESULT",
        "WWW-Authenticate",
        "authenticate()",
        "BatchKVCache",
        "pnpm.overrides",
    ):
        escaped = escaped.replace(html.escape(token), f"<code>{html.escape(token)}</code>")
    return re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)


def render_list(picks: list[dict]) -> str:
    rows = []
    for pr in picks:
        name = DISPLAY.get(pr["repo"], pr["repo"].split("/")[-1])
        blurb = wrap_code(one_line(pr["title"]))
        rows.append(
            "          <li>\n"
            f'            <a href="{html.escape(pr["url"], quote=True)}" target="_blank" rel="noopener noreferrer">{html.escape(name)}</a>\n'
            f"            <span>{blurb}</span>\n"
            "          </li>"
        )
    return "        <ul class=\"oss-list\">\n" + "\n".join(rows) + "\n        </ul>"


def patch_index(picks: list[dict]) -> dict:
    source = INDEX.read_text()
    if OSS_START not in source or OSS_END not in source:
        raise SystemExit("index.html is missing maintainer markers")
    before, rest = source.split(OSS_START, 1)
    _, after = rest.split(OSS_END, 1)
    block = render_list(picks)
    INDEX.write_text(before + OSS_START + "\n" + block + "\n        " + OSS_END + after)
    return {"tool": "patch_index", "ok": True, "detail": f"wrote {len(picks)} rows"}


def main() -> None:
    steps = [
        {
            "tool": "plan",
            "ok": True,
            "detail": "search merged PRs, rank agent/MCP/RAG/inference first, patch the OSS list",
        }
    ]
    token = github_token()
    prs, search_trace = search_merged_prs(token)
    steps.append(search_trace)
    picks, rank_trace = rank_agentic(prs)
    steps.append(rank_trace)
    if not picks:
        raise SystemExit("rank_agentic returned nothing")
    steps.append(patch_index(picks))
    payload = {
        "ran_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "author": AUTHOR,
        "steps": steps,
        "picks": picks,
    }
    TRACE.write_text(json.dumps(payload, indent=2) + "\n")
    print(json.dumps({"ok": True, "rows": len(picks), "trace": str(TRACE)}, indent=2))


if __name__ == "__main__":
    main()
