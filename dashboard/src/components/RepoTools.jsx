import { useMemo, useState } from "react";

const DEFAULT_REPO = "shadowjuice69/utopia-nexus";

const TOOLS = [
  { id: "gitingest", name: "GitIngest", category: "AI CONTEXT", description: "Create an LLM-friendly digest of a repository, including its tree, statistics, and source content.", buildUrl: repo => `https://gitingest.com/${repo}`, note: "Best for feeding repository context into an AI." },
  { id: "gitmcp", name: "GitMCP", category: "MCP", description: "Expose a public GitHub repository through a remote MCP documentation server.", buildUrl: repo => `https://gitmcp.io/${repo}`, note: "Useful for MCP-compatible coding assistants." },
  { id: "gitdiagram", name: "GitDiagram", category: "ARCHITECTURE", description: "Generate an interactive architecture diagram from the repository.", buildUrl: repo => `https://gitdiagram.com/${repo}`, note: "Useful for understanding system structure quickly." },
  { id: "deepwiki", name: "DeepWiki", category: "DOCUMENTATION", description: "Open an AI-generated wiki and ask questions about a public repository.", buildUrl: repo => `https://deepwiki.com/${repo}`, note: "Useful for repository documentation and exploration." },
  { id: "githubgg", name: "GitHub.gg", category: "REPO HEALTH", description: "Open the repository in GitHub.gg for repository exploration and quality tooling.", buildUrl: repo => `https://github.gg/${repo}`, note: "Useful as a secondary repository-quality view." },
  { id: "stackblitz", name: "StackBlitz", category: "LIVE DEV", description: "Open a public GitHub repository as an editable browser development environment.", buildUrl: repo => `https://stackblitz.com/github/${repo}`, note: "Requires the repository to be compatible with StackBlitz." },
  { id: "starhistory", name: "Star History", category: "ADOPTION", description: "Inspect GitHub star growth over time and compare repositories.", buildUrl: repo => `https://www.star-history.com/${repo}`, note: "Useful for project adoption and activity trends." },
];

function normalizeRepo(value) {
  return value.trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\.git\/?$/i, "")
    .replace(/^\/+|\/+$/g, "");
}

export default function RepoTools() {
  const [input, setInput] = useState(DEFAULT_REPO);
  const [repo, setRepo] = useState(DEFAULT_REPO);
  const [error, setError] = useState("");

  const links = useMemo(() => TOOLS.map(tool => ({ ...tool, url: tool.buildUrl(repo) })), [repo]);

  function submit(e) {
    e.preventDefault();
    const normalized = normalizeRepo(input);
    if (!/^[^/\s]+\/[^/\s]+$/.test(normalized)) {
      setError("Enter a GitHub repository as owner/repository or paste its GitHub URL.");
      return;
    }
    setError("");
    setRepo(normalized);
  }

  function resetToNexus() {
    setInput(DEFAULT_REPO);
    setRepo(DEFAULT_REPO);
    setError("");
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-title">REPOSITORY TOOLKIT</div>
        <div style={{ color: "var(--muted)", marginBottom: 12 }}>
          Nexus is preloaded with its own repository. You can switch to another public GitHub repository whenever needed.
        </div>
        <form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="login-input"
            style={{ flex: "1 1 320px", minWidth: 220, boxSizing: "border-box" }}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="owner/repository"
            aria-label="GitHub repository"
          />
          <button className="btn btn-gold" type="submit">Load Repository</button>
          {repo !== DEFAULT_REPO && <button className="btn" type="button" onClick={resetToNexus}>Nexus Repo</button>}
        </form>
        {error && <div className="login-error" style={{ marginTop: 8 }}>{error}</div>}
        <div style={{ marginTop: 10, fontFamily: "monospace", color: "var(--gold)" }}>{repo}</div>
      </div>

      <div className="card-grid">
        {links.map(tool => (
          <div className="panel" key={tool.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <div className="panel-title">{tool.name}</div>
              <span style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)" }}>{tool.category}</span>
            </div>
            <div style={{ color: "var(--muted)", lineHeight: 1.5, minHeight: 66 }}>{tool.description}</div>
            <div style={{ fontSize: 12, margin: "10px 0 14px", opacity: 0.8 }}>{tool.note}</div>
            <a className="btn btn-gold" href={tool.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", textDecoration: "none" }}>
              Open {tool.name}
            </a>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
        <strong>Security:</strong> these links target external services. Use them with public repositories unless you have verified the service's private-repository handling. Never paste GitHub tokens, Supabase keys, or other secrets into external tools.
      </div>
    </div>
  );
}
