# Windows Development Guide

This guide covers how to set up and run **Buildpad UI Packages** on Windows.

## Prerequisites

- **Node.js** >= 18.0.0 (LTS recommended)
- **pnpm** >= 9.0.0
- **Git for Windows** (includes Git Bash)

## Quick Setup

```powershell
# Install pnpm globally if not already installed
npm install -g pnpm

# Clone and install
git clone https://github.com/buildpad-ai/ui.git
cd buildpad-ui
pnpm install

# Build all packages
pnpm build
```

## Cross-Platform Scripts

All npm scripts use cross-platform tools:

| Command | Description |
|---------|-------------|
| `pnpm clean` | Cleans build artifacts (uses `rimraf`) |
| `pnpm build` | Builds all packages |
| `pnpm dev` | Runs dev mode |

## pnpm & Symlinks on Windows

pnpm uses symlinks for workspace packages. On Windows, symlinks require one of:

### Option 1: Developer Mode (Recommended)

1. Open **Settings** > **Update & Security** > **For Developers**
2. Enable **Developer Mode**
3. Restart your terminal

### Option 2: Run Terminal as Administrator

Run your terminal (PowerShell, CMD, or Git Bash) as Administrator when using pnpm.

### Option 3: Use WSL 2

For the best compatibility, use Windows Subsystem for Linux:

```powershell
# Install WSL 2
wsl --install

# In WSL, follow the standard Linux setup
git clone https://github.com/buildpad-ai/ui.git
cd buildpad-ui
pnpm install
```

## Terminal Options

### PowerShell (Native)

Works well with pnpm. Use the built-in Windows Terminal for best experience.

```powershell
# Check Node and pnpm versions
node --version
pnpm --version

# Run commands
pnpm build
pnpm storybook
```

### Git Bash (Included with Git for Windows)

Provides a Unix-like environment on Windows.

```bash
# All standard commands work
pnpm install
pnpm build
```

### WSL 2 (Recommended for Development)

Full Linux environment, best compatibility with Node.js tooling.

## Common Issues & Solutions

### Issue: "EPERM: operation not permitted, symlink"

**Cause**: pnpm can't create symlinks without proper permissions.

**Fix**: Enable Developer Mode or run as Administrator (see above).

### Issue: Long Path Names

Windows has a 260-character path limit by default.

**Fix**: Enable long paths in Windows 10/11:

1. Open **Group Policy Editor** (`gpedit.msc`)
2. Navigate to: Computer Configuration > Administrative Templates > System > Filesystem
3. Enable **"Enable Win32 long paths"**

Or via PowerShell (as Administrator):

```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

### Issue: Line Ending Warnings

**Cause**: Git converts line endings on Windows.

**Fix**: Configure Git to use LF:

```bash
git config --global core.autocrlf input
git config --global core.eol lf
```

Or for this repository only:

```bash
git config core.autocrlf input
```

### Issue: File Watcher Limit

When running dev servers or Storybook, you may hit file watcher limits.

**Fix**: Use polling mode in Vite/webpack or increase limits via WSL.

## VS Code Configuration

Add these settings for consistent development:

```json
{
  "files.eol": "\n",
  "terminal.integrated.defaultProfile.windows": "Git Bash",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## CI/CD Notes

For GitHub Actions or other CI running on Windows:

```yaml
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
```

## Summary

| Approach | Compatibility | Setup Effort |
|----------|--------------|--------------|
| Developer Mode + PowerShell | ✅ Good | Low |
| Git Bash | ✅ Good | Low |
| WSL 2 | ✅ Excellent | Medium |
| Admin Terminal | ⚠️ Works | Low |

For the smoothest experience, we recommend **WSL 2** or **Developer Mode + Git Bash**.
