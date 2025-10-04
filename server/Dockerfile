FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json pnpm-lock.yaml .npmrc* ./

# Install dependencies with npm (for better native module support)
RUN npm install

# Copy source code and build
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "index.js"]
