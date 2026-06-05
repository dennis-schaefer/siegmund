FROM node:24-alpine

RUN apk add --no-cache \
        bash \
        git \
        github-cli \
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
