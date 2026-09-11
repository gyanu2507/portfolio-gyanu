# portfolio-gyanu

Personal site: [portfolio-gyanu.vercel.app](https://portfolio-gyanu.vercel.app)

Agentic AI: a tool-loop writes the open-source list from GitHub.

```
python3 agent/maintainer.py
```

That searches merged PRs, ranks agent/MCP/RAG/inference first, patches `index.html`, and writes `agent/last-run.json`. The page renders the last run under Open source.

Static HTML / CSS / JS otherwise. Open `index.html` or any static host.
