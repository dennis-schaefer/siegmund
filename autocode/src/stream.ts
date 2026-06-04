// Renders Claude Code `--output-format stream-json` events into a readable,
// live activity log on the container console. Dependency-free and tolerant of
// CLI format drift: unknown event shapes are ignored, unparseable lines are
// echoed raw rather than crashing the run.

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const dim = (s: string): string =>
  process.stdout.isTTY ? `${DIM}${s}${RESET}` : s;

/** Collapse internal whitespace so a command reads on one line — no length cap. */
function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Indent every line by two spaces, for multi-line error detail. */
function indent(value: string): string {
  return value
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");
}

/** Pick the single most identifying argument for a tool call. */
function keyArg(tool: string, input: Record<string, unknown>): string {
  const byTool: Record<string, string> = {
    Edit: "file_path",
    Write: "file_path",
    Read: "file_path",
    NotebookEdit: "notebook_path",
    Bash: "command",
    Grep: "pattern",
    Glob: "pattern",
  };
  const field = byTool[tool];
  const pick = (k: string): string | undefined =>
    typeof input[k] === "string" ? (input[k] as string) : undefined;

  const candidate =
    (field && pick(field)) ??
    pick("file_path") ??
    pick("command") ??
    pick("pattern") ??
    Object.values(input).find((v): v is string => typeof v === "string");

  return candidate ? clean(candidate) : "";
}

interface AssistantBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface ToolResultBlock {
  type: string;
  tool_use_id?: string;
  is_error?: boolean;
  content?: unknown;
}

/** Extract the full text of a tool_result payload (string or content blocks). */
function resultText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter(
        (b): b is { text: string } =>
          typeof b === "object" && b !== null && typeof (b as { text?: unknown }).text === "string",
      )
      .map((b) => b.text)
      .join("\n")
      .trim();
  }
  return "";
}

export interface StreamRenderer {
  /** Feed a raw chunk of stdout; handles partial-line buffering internally. */
  write(chunk: string): void;
  /** Flush the buffer and print the final summary + result block. */
  finish(): void;
}

export function createStreamRenderer(): StreamRenderer {
  let buffer = "";
  const toolNames = new Map<string, string>();
  let finalText = "";
  let numTurns: number | undefined;
  let totalTokens: number | undefined;

  function handle(event: Record<string, unknown>): void {
    switch (event.type) {
      case "assistant": {
        const message = event.message as { content?: AssistantBlock[] } | undefined;
        for (const block of message?.content ?? []) {
          if (block.type === "text" && block.text?.trim()) {
            process.stdout.write(`${dim(`  ${block.text.trim()}`)}\n`);
          } else if (block.type === "tool_use" && block.name) {
            if (block.id) toolNames.set(block.id, block.name);
            const arg = keyArg(block.name, block.input ?? {});
            process.stdout.write(`→ ${block.name}${arg ? `  ${arg}` : ""}\n`);
          }
        }
        break;
      }
      case "user": {
        const message = event.message as { content?: ToolResultBlock[] } | undefined;
        for (const block of message?.content ?? []) {
          if (block.type !== "tool_result") continue;
          const name = (block.tool_use_id && toolNames.get(block.tool_use_id)) || "tool";
          if (block.is_error) {
            const detail = resultText(block.content);
            process.stdout.write(`✗ ${name}\n`);
            if (detail) process.stdout.write(`${dim(indent(detail))}\n`);
          } else {
            process.stdout.write(`✓ ${name}\n`);
          }
        }
        break;
      }
      case "result": {
        if (typeof event.result === "string") finalText = event.result;
        if (typeof event.num_turns === "number") numTurns = event.num_turns;
        const usage = event.usage as
          | { input_tokens?: number; output_tokens?: number }
          | undefined;
        if (usage) {
          totalTokens = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
        }
        break;
      }
      default:
        // system/init and any unknown event types: ignore.
        break;
    }
  }

  function consume(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      process.stdout.write(`${trimmed}\n`);
      return;
    }
    handle(event);
  }

  return {
    write(chunk: string): void {
      buffer += chunk;
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        consume(line);
      }
    },
    finish(): void {
      if (buffer.length > 0) {
        consume(buffer);
        buffer = "";
      }
      const parts: string[] = [];
      if (numTurns !== undefined) parts.push(`${numTurns} turns`);
      if (totalTokens !== undefined) parts.push(`~${(totalTokens / 1000).toFixed(1)}k tokens`);
      process.stdout.write(`${dim(`done${parts.length ? ` · ${parts.join(" · ")}` : ""}`)}\n`);
      if (finalText.trim()) {
        process.stdout.write(`\n${finalText.trim()}\n`);
      }
    },
  };
}
