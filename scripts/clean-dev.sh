#!/bin/bash

# Clean development environment script
# This helps resolve chunk loading errors and stale cache issues

echo "🧹 Cleaning development environment..."

# Remove Next.js build cache
echo "Removing .next directory..."
rm -rf .next

# Remove node_modules cache
echo "Removing node_modules cache..."
rm -rf node_modules/.cache

# Remove Playwright cache if exists
echo "Removing Playwright cache..."
rm -rf test-results
rm -rf playwright-report

# Remove any TypeScript build info
echo "Removing TypeScript build info..."
rm -f tsconfig.tsbuildinfo

# Clear npm cache (optional, uncomment if needed)
# echo "Clearing npm cache..."
# npm cache clean --force

echo "✅ Clean complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npm install' to ensure all dependencies are installed"
echo "2. Run 'npm run dev' to start the development server"
echo ""
echo "If you're still experiencing issues:"
echo "- Try removing node_modules and package-lock.json, then run 'npm install'"
echo "- Check for any running processes on port 3000"