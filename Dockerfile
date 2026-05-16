FROM node:20-alpine AS base

# Install FFmpeg with subtitle support (libass for ASS rendering)
# and font dependencies for text overlay
RUN apk add --no-cache ffmpeg fontconfig freetype harfbuzz libass libfdk-aac

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install 2>&1

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (use local binary to avoid npx pulling wrong version)
RUN ./node_modules/.bin/prisma generate

# Build Next.js directly (skip prisma generate since we already did it)
ENV NEXT_TELEMETRY_DISABLED=1
RUN ./node_modules/.bin/next build

# Production stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

# Install FFmpeg with subtitle support and fonts
RUN apk add --no-cache ffmpeg fontconfig freetype harfbuzz libass libfdk-aac

# Copy Poppins Bold font and register it
COPY --from=builder /app/public/fonts/Poppins-Bold.ttf /usr/share/fonts/truetype/custom/Poppins-Bold.ttf
RUN fc-cache -f

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
