#!/usr/bin/env bash
# exit on error
set -o errexit

# Remove pnpm lockfile to avoid interference with npm
rm -f pnpm-lock.yaml

# Install dependencies using npm
npm install --legacy-peer-deps

# Build the project (runs 'tsc' as defined in package.json)
npm run build

# Generate Prisma client and deploy migrations
npx prisma generate
npx prisma migrate deploy