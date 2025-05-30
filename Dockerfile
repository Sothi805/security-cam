# Use Node.js LTS as base image
FROM node:18-bullseye-slim

# Install FFmpeg and other dependencies
RUN apt-get update && apt-get install -y \
   ffmpeg \
   && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY . .

# Create necessary directories
RUN mkdir -p /var/log/cctv-streaming \
   && mkdir -p /var/lib/cctv-streaming/hls \
   && chown -R node:node /var/log/cctv-streaming \
   && chown -R node:node /var/lib/cctv-streaming

# Switch to non-root user
USER node

# Set environment variables
ENV NODE_ENV=production \
   PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
   CMD curl -f http://localhost:3000/health || exit 1

# Start the app
CMD ["node", "app.js"] 