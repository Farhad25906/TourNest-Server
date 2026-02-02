#!/usr/bin/env bash
# exit on error
set -o errexit

# Optional: Ensure we are using the latest npm version
npm install -g npm@latest

# Install dependencies using npm (now uses your new package-lock.json)
npm install

# Build the project (runs 'tsc')
npm run build

# Generate Prisma client and deploy migrations
npx prisma generate
npx prisma migrate deploy