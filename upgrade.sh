#!/bin/bash
# Upgrade Node.js and fix dependencies
# Run with: bash upgrade.sh

echo "🔧 Dynasty Cube Upgrade Script"
echo "=============================="
echo ""

# Check if nvm is installed
if command -v nvm &> /dev/null; then
    echo "✓ NVM detected"

    # Install Node.js 20
    echo "📦 Installing Node.js 20..."
    nvm install 20
    nvm use 20
    nvm alias default 20
else
    echo "⚠️  NVM not found. Please install Node.js 20 manually from:"
    echo "   https://nodejs.org/"
    echo ""
    read -p "Press Enter after installing Node.js 20 to continue..."
fi

# Verify Node version
NODE_VERSION=$(node -v)
echo "📌 Current Node.js version: $NODE_VERSION"

# Check if Node.js 20+
NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1 | tr -d 'v')
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "❌ Node.js version must be 20 or higher"
    echo "   Current version: $NODE_VERSION"
    exit 1
fi

echo "✓ Node.js version is compatible"
echo ""

# Clean install dependencies
echo "🧹 Cleaning old dependencies..."
rm -rf node_modules package-lock.json

echo "📦 Installing dependencies with Node.js $NODE_VERSION..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Upgrade complete!"
    echo ""
    echo "Next steps:"
    echo "1. Run the database migrations in Supabase SQL Editor:"
    echo "   - database/migrations/fix_users_rls_policy.sql"
    echo "   - database/migrations/update_team_members_view_display_name.sql"
    echo ""
    echo "2. Start the development server:"
    echo "   npm run dev"
    echo ""
    echo "See UPGRADE_NODE.md for detailed instructions."
else
    echo ""
    echo "❌ npm install failed"
    echo "   Please check the error messages above"
    exit 1
fi
