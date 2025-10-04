FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy server package files
COPY server/package*.json server/pnpm-lock.yaml server/.npmrc* ./

# Install dependencies with npm (for better native module support)
RUN npm install

# Copy server source code
COPY server/ .

# Build TypeScript first
RUN npm run build

# Copy CLI script from root (after build to avoid overwriting package.json)
COPY cli.js ./cli.js

# Remove dev dependencies
RUN npm prune --production

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "index.js"]
