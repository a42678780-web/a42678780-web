FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (only production)
RUN npm ci --only=production

# Copy source code
COPY . .

# Create data directories (needed for file-based persistence if volume not mounted)
RUN mkdir -p data/logs data/backup

# Expose port
EXPOSE 3000

# Environment variables (Defaults, should be overridden)
ENV PORT=3000
ENV NODE_ENV=production

# Start the application
CMD ["node", "src/server.js"]
