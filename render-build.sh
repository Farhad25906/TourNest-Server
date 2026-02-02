#!/usr/bin/env bash
set -o errexit

# Install ALL dependencies including dev dependencies
npm ci --include=dev

# Build TypeScript (this will also install types)
npm run build

# Setup Prisma
npx prisma generate
npx prisma migrate deploy