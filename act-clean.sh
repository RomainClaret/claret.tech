#!/bin/bash

# ACT Cleanup Script
# Cleans Docker resources and runs ACT with optimized settings

echo "=== ACT Cleanup and Run Script ==="
echo "Cleaning Docker resources before ACT run..."

# Stop all running containers
docker stop $(docker ps -aq) 2>/dev/null || true

# Remove all containers
docker rm -f $(docker ps -aq) 2>/dev/null || true

# Prune Docker system aggressively
echo "Pruning Docker system..."
docker system prune -af --volumes

# Prune builder cache
echo "Pruning Docker builder cache..."
docker builder prune -af

# Show disk usage after cleanup
echo "Docker disk usage after cleanup:"
docker system df

# Clean local build artifacts
echo "Cleaning local build artifacts..."
rm -rf .next test-results playwright-report coverage .turbo 2>/dev/null || true

# Run ACT with resource limits
echo "Running ACT with resource limits..."
act push \
  --container-architecture linux/amd64 \
  --container-options "--memory=4g --memory-swap=4g" \
  --rm \
  --artifact-server-path /tmp/artifacts \
  -v

echo "=== ACT run complete ==="