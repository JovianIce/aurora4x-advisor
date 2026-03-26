#!/usr/bin/env bash
# Build all projects and deploy DLLs to AuroraPatch Patches folder.
# Usage: ./build-deploy.sh [Debug|Release]

set -e

CONFIG="${1:-Debug}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
MSBUILD="/c/Program Files/Microsoft Visual Studio/2022/Community/MSBuild/Current/Bin/MSBuild.exe"
PATCHES="$ROOT/AuroraPatch/bin/$CONFIG/Patches"

echo "=== Building AuroraPatch.sln ($CONFIG) ==="
"$MSBUILD" "$ROOT/AuroraPatch.sln" -t:Build -p:Configuration="$CONFIG" -verbosity:minimal

echo ""
echo "=== Deploying to Patches ==="

# Lib
mkdir -p "$PATCHES/Lib"
cp "$ROOT/Lib/bin/$CONFIG/Lib.dll"  "$PATCHES/Lib/"
cp "$ROOT/Lib/bin/$CONFIG/Lib.pdb"  "$PATCHES/Lib/"
echo "  Lib.dll -> Patches/Lib/"

# AdvisorBridge
mkdir -p "$PATCHES/AdvisorBridge"
cp "$ROOT/AdvisorBridge/bin/$CONFIG/AdvisorBridge.dll"  "$PATCHES/AdvisorBridge/"
cp "$ROOT/AdvisorBridge/bin/$CONFIG/AdvisorBridge.pdb"  "$PATCHES/AdvisorBridge/"
echo "  AdvisorBridge.dll -> Patches/AdvisorBridge/"

echo ""
echo "=== Done ==="
