# Agent core: Claude Agent SDK in a TypeScript backend, two LLM lanes, tiered permissions

Siegmund's brain is an autonomous, tool-using agent built on the **Claude Agent
SDK**, running **in-process in a TypeScript/Node backend**. TypeScript was chosen
over Java/Spring because the Agent SDK only exists for TS/Python, and an
in-process agent unifies the stack with the RN/Expo client. The Vault is a
filesystem the agent's file tools operate on directly (commit/push via Git).

**Tiered permissions** satisfy "autonomous but never act critically without my
consent": Vault read/write, research and summarization are auto-allowed; any
outward side-effect (sending email, writing to Calendar/Tasks, deletions)
requires explicit user approval, implemented via the SDK's permission
mode / `canUseTool` callback / hooks. The agent is sandboxed to the Vault
working directory with a tool allowlist.

**Two LLM lanes** behind a provider abstraction:
- **Agent lane** — Claude via the Agent SDK, authenticated with the user's
  Anthropic subscription (near-zero marginal cost, reliable agentic tool-use);
  Anthropic API key as fallback if subscription usage limits are hit.
- **Utility lane** — a thin `LLMClient` interface for narrow, non-agentic tasks
  (transcript cleanup, pre-classification, summarization, embeddings),
  configurable per task to OpenRouter (incl. free models), OpenAI, or local.

## Considered Options

- **Spring + Node agent sidecar**: rejected — adds a process boundary
  (streaming, session resume, approval round-trips across two services) for
  little benefit once the agent is the core.
- **Pure Java, no Agent SDK**: rejected — would mean rebuilding the agent loop,
  permission gate, and Skill/MCP mechanics by hand.
- **Free models in the agent loop via proxy**: rejected — weak agentic
  tool-use and no prompt caching; the subscription already covers the loop at
  ~zero marginal cost.

## Consequences

- Capabilities are added as Skills / MCP servers without changing the app.
- Subscription auth is intended for personal interactive use and has rolling
  usage limits; acceptable for single-user volume, monitored as a risk.
- Non-Claude utility calls need their own API keys (e.g. OpenRouter).
