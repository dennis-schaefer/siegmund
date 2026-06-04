FROM maven:3.9-eclipse-temurin-25-alpine

# System packages: node.js 24, git, github CLI, bash (for shebang lines used by claude)
# Alpine ships current Node in the community repo; pin to v24.
RUN apk add --no-cache \
        bash \
        git \
        github-cli \
        nodejs \
        npm \
        ca-certificates

# Claude Code CLI — the agent engine.
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /autocode

# Install JS deps first to leverage Docker layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install

# Build the TypeScript CLI.
COPY tsconfig.json ./
COPY src ./src
RUN npm install --include=dev && npx tsc

# Bundle the prompt templates next to the compiled CLI.
COPY prompts ./prompts

# Container runs under /workspace (the worktree); /repo holds the bare clone.
WORKDIR /workspace

ENTRYPOINT ["node", "/autocode/dist/index.js"]
