#!/bin/bash

# Script to test GitHub Actions workflows locally using ACT

set -e

echo "🚀 Testing GitHub Actions Workflows Locally"
echo "=========================================="

# Check if act is installed
if ! command -v act &> /dev/null; then
    echo "❌ ACT is not installed. Please install it first:"
    echo ""
    echo "  macOS:    brew install act"
    echo "  Linux:    curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash"
    echo "  Windows:  choco install act-cli"
    echo ""
    echo "For more info: https://github.com/nektos/act"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Check if .env.act.local exists
if [ ! -f ".env.act.local" ]; then
    echo "⚠️  .env.act.local not found. Creating from template..."
    cp .env.act.local.example .env.act.local
    echo "📝 Please edit .env.act.local with your values before running tests."
    exit 1
fi

# Function to run a specific job
run_job() {
    local workflow=$1
    local job=$2
    echo ""
    echo "🧪 Testing: $job"
    echo "----------------------------------------"
    act push -W ".github/workflows/$workflow" -j "$job" --secret-file .env.act.local
}

# Parse command line arguments
case "${1:-all}" in
    "lint")
        run_job "ci.yml" "lint"
        ;;
    "type-check")
        run_job "ci.yml" "type-check"
        ;;
    "format")
        run_job "ci.yml" "format"
        ;;
    "test")
        run_job "ci.yml" "test"
        ;;
    "build")
        run_job "ci.yml" "build"
        ;;
    "ci")
        echo "🔄 Running all CI checks..."
        act push -W .github/workflows/ci.yml --secret-file .env.act.local
        ;;
    "deploy")
        echo "🚀 Testing deployment workflow (dry run)..."
        act push -W .github/workflows/deploy.yml --secret-file .env.act.local --dryrun
        ;;
    "all")
        echo "🔄 Running all workflows..."
        echo ""
        echo "1️⃣ CI Workflow"
        act push -W .github/workflows/ci.yml --secret-file .env.act.local
        echo ""
        echo "2️⃣ Deploy Workflow (dry run)"
        act push -W .github/workflows/deploy.yml --secret-file .env.act.local --dryrun
        ;;
    "help"|"--help"|"-h")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  lint        Run ESLint checks"
        echo "  type-check  Run TypeScript type checking"
        echo "  format      Check code formatting"
        echo "  test        Run unit tests"
        echo "  build       Test Next.js build"
        echo "  ci          Run all CI checks"
        echo "  deploy      Test deployment (dry run)"
        echo "  all         Run all workflows (default)"
        echo "  help        Show this help message"
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "Run '$0 help' for usage information."
        exit 1
        ;;
esac

echo ""
echo "✅ Workflow testing complete!"