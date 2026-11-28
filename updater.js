'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');

const REPO_OWNER = 'dev-raman05';
const REPO_NAME = 'audio-video-engine';
const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
const ALLOWED_HOSTS = new Set([
  'api.github.com',
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github-releases.githubusercontent.com',
]);

function isAllowedUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_HOSTS.has(host) || host.endsWith('.githubusercontent.com');
  } catch (_err) {
    return false;
  }
}

function parseSemver(ver) {
  const clean = String(ver || '0.0.0').replace(/^v/i, '').split('-')[0];
  const parts = clean.split('.').map((n) => parseInt(n, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function pickAssetForPlatform(assets, platform, arch, env) {
  const list = Array.isArray(assets) ? assets : [];
  const findByName = (name) => list.find((a) => a && a.name === name);
  const findByMatch = (fn) => list.find((a) => a && a.name && fn(a.name));

  if (platform === 'win32') {
    return (
      findByName('KaleidoSync-Windows-Setup.exe') ||
      findByMatch((n) => n.toLowerCase().endsWith('.exe'))
    );
  }

  if (platform === 'darwin') {
    if (arch === 'arm64') {
      return (
        findByName('KaleidoSync-macOS-arm64.dmg') ||
        findByMatch((n) => n.includes('arm64') && n.endsWith('.dmg'))
      );
    }
    return (
      findByName('KaleidoSync-macOS-x64.dmg') ||
      findByMatch((n) => n.includes('x64') && n.endsWith('.dmg'))
    );
  }

  if (platform === 'linux') {
    if (env && env.APPIMAGE) {
      return (
        findByName('KaleidoSync-Linux-x64.AppImage') ||
        findByMatch((n) => n.endsWith('.AppImage'))
      );
    }
    return (
      findByName('KaleidoSync-Linux-x64.deb') ||
      findByMatch((n) => n.endsWith('.deb')) ||
      findByMatch((n) => n.endsWith('.AppImage'))
    );
  }

  return null;
}

function requestWithRedirects(url, headers, redirectsLeft = 6) {
  return new Promise((resolve, reject) => {
    if (!isAllowedUrl(url)) {
      reject(new Error(`Blocked update URL: ${url}`));
      return;
    }

    const req = https.get(url, { headers }, (res) => {
      const code = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(code) && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) {
          reject(new Error('Too many redirects while fetching update'));
          return;
        }
        const nextUrl = new URL(res.headers.location, url).toString();
        requestWithRedirects(nextUrl, headers, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      resolve(res);
    });

    req.on('error', reject);
    req.setTimeout(25000, () => {
      req.destroy(new Error('Update request timed out'));
    });
  });
}

async function fetchText(url, accept = 'text/plain') {
  const res = await requestWithRedirects(url, {
    'User-Agent': 'KaleidoSync-Updater',
    Accept: accept,
  });
  return new Promise((resolve, reject) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      if ((res.statusCode || 0) >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      resolve(body);
    });
    res.on('error', reject);
  });
}

async function fetchJson(url) {
  const body = await fetchText(url, 'application/vnd.github+json');
  return JSON.parse(body);
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
    stream.on('error', reject);
  });
}

function parseSha256Sums(text, fileName) {
  if (!text || !fileName) return null;
  const target = path.basename(fileName).toLowerCase();
  const lines = String(text).split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([a-fA-F0-9]{64})\s+[* ]?(.+)$/);
    if (!match) continue;
    const digest = match[1].toLowerCase();
    const entryName = path.basename(match[2].trim().replace(/^\.\//, '')).toLowerCase();
    if (entryName === target) {
      return digest;
    }
  }
  return null;
}

async function downloadFile(url, destPath, onProgress) {
  const res = await requestWithRedirects(url, {
    'User-Agent': 'KaleidoSync-Updater',
    Accept: 'application/octet-stream',
  });

  if ((res.statusCode || 0) >= 400) {
    res.resume();
    throw new Error(`Download failed with HTTP ${res.statusCode}`);
  }

  const total = parseInt(res.headers['content-length'] || '0', 10) || 0;
  let received = 0;
  let lastEmit = 0;

  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destPath);
    const cleanup = (err) => {
      res.destroy();
      out.destroy();
      fs.unlink(destPath, () => reject(err));
    };

    res.on('data', (chunk) => {
      received += chunk.length;
      const now = Date.now();
      if (typeof onProgress === 'function' && (now - lastEmit >= 120 || (total > 0 && received >= total))) {
        lastEmit = now;
        const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
        onProgress({ phase: 'downloading', percent, received, total });
      }
    });

    res.on('error', cleanup);
    out.on('error', cleanup);
    out.on('finish', () => {
      out.close(() => resolve(destPath));
    });
    res.pipe(out);
  });
}

async function checkForUpdates(currentVersion) {
  try {
    const release = await fetchJson(LATEST_RELEASE_URL);
    const latestVersion = String(release.tag_name || '').replace(/^v/i, '');
    if (!latestVersion) {
      return { ok: false, error: 'No release version found' };
    }

    const updateAvailable = compareSemver(latestVersion, currentVersion) > 0;
    const asset = pickAssetForPlatform(release.assets, process.platform, process.arch, process.env);
    const checksumAsset = Array.isArray(release.assets)
      ? release.assets.find((a) => a && a.name === 'SHA256SUMS.txt')
      : null;

    return {
      ok: true,
      currentVersion: String(currentVersion || '0.0.0').replace(/^v/i, ''),
      latestVersion,
      updateAvailable,
      assetName: asset ? asset.name : null,
      assetSize: asset ? asset.size : 0,
      downloadUrl: asset ? asset.browser_download_url : null,
      checksumUrl: checksumAsset ? checksumAsset.browser_download_url : null,
      releaseUrl: release.html_url || `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
    };
  } catch (err) {
    return {
      ok: false,
      currentVersion: String(currentVersion || '0.0.0').replace(/^v/i, ''),
      error: err && err.message ? err.message : 'Update check failed',
      releaseUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
    };
  }
}

function shQuote(str) {
  return "'" + String(str).replace(/'/g, "'\\''") + "'";
}

function spawnDetachedUpdater({ platform, downloadedPath, exePath, appImagePath }) {
  const stamp = Date.now();

  if (platform === 'win32') {
    const appDir = path.dirname(exePath);
    const hasUninstaller = fs.existsSync(path.join(appDir, 'Uninstall KaleidoSync.exe'));
    const scriptPath = path.join(os.tmpdir(), `kaleidosync-update-${stamp}.cmd`);
    const installArgs = hasUninstaller ? '/S' : `/S /D=${appDir}`;
    const lines = [
      '@echo off',
      'ping -n 3 127.0.0.1 >nul',
      `start /wait "" "${downloadedPath}" ${installArgs}`,
      `del /q "${downloadedPath}" 2>nul`,
      `if exist "${exePath}" start "" "${exePath}"`,
      'del "%~f0"',
    ];
    fs.writeFileSync(scriptPath, lines.join('\r\n'), 'utf8');
    const child = spawn('cmd.exe', ['/c', scriptPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    return;
  }

  if (platform === 'darwin') {
    let appBundle = path.resolve(exePath, '../../..');
    if (!appBundle.endsWith('.app')) {
      appBundle = '/Applications/KaleidoSync.app';
    }
    const scriptPath = path.join(os.tmpdir(), `kaleidosync-update-${stamp}.sh`);
    const lines = [
      '#!/bin/sh',
      'sleep 2',
      'MNT=$(mktemp -d /tmp/kaleidosync-mnt.XXXXXX)',
      `if hdiutil attach ${shQuote(downloadedPath)} -mountpoint "$MNT" -nobrowse -quiet; then`,
      '  SRC=$(find "$MNT" -maxdepth 2 -name "*.app" | head -n 1)',
      '  if [ -n "$SRC" ]; then',
      `    rm -rf ${shQuote(appBundle)}`,
      `    ditto "$SRC" ${shQuote(appBundle)}`,
      `    xattr -cr ${shQuote(appBundle)} 2>/dev/null || true`,
      '  fi',
      '  hdiutil detach "$MNT" -quiet || true',
      'fi',
      'rmdir "$MNT" 2>/dev/null || true',
      `rm -f ${shQuote(downloadedPath)}`,
      `open -n ${shQuote(appBundle)}`,
      `rm -f ${shQuote(scriptPath)}`,
    ];
    fs.writeFileSync(scriptPath, lines.join('\n'), { mode: 0o755 });
    const child = spawn('/bin/sh', [scriptPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return;
  }

  if (platform === 'linux') {
    const scriptPath = path.join(os.tmpdir(), `kaleidosync-update-${stamp}.sh`);
    let lines;
    if (appImagePath) {
      lines = [
        '#!/bin/sh',
        'sleep 2',
        `chmod +x ${shQuote(downloadedPath)}`,
        `mv -f ${shQuote(downloadedPath)} ${shQuote(appImagePath)} 2>/dev/null || (cp -f ${shQuote(downloadedPath)} ${shQuote(appImagePath)} && rm -f ${shQuote(downloadedPath)})`,
        `chmod +x ${shQuote(appImagePath)}`,
        `nohup ${shQuote(appImagePath)} >/dev/null 2>&1 &`,
        `rm -f ${shQuote(scriptPath)}`,
      ];
    } else {
      lines = [
        '#!/bin/sh',
        'sleep 2',
        `if command -v pkexec >/dev/null 2>&1; then`,
        `  pkexec apt-get install -y ${shQuote(downloadedPath)} || pkexec dpkg -i ${shQuote(downloadedPath)}`,
        `elif command -v xdg-open >/dev/null 2>&1; then`,
        `  xdg-open ${shQuote(downloadedPath)}`,
        'fi',
        `rm -f ${shQuote(downloadedPath)}`,
        'nohup kaleidosync >/dev/null 2>&1 &',
        `rm -f ${shQuote(scriptPath)}`,
      ];
    }
    fs.writeFileSync(scriptPath, lines.join('\n'), { mode: 0o755 });
    const child = spawn('/bin/sh', [scriptPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  }
}

async function downloadAndInstallUpdate({ currentVersion, isPackaged, exePath, onProgress, onQuit }) {
  const info = await checkForUpdates(currentVersion);
  if (!info.ok) return info;
  if (!info.updateAvailable) {
    return { ok: true, alreadyLatest: true, currentVersion: info.currentVersion, latestVersion: info.latestVersion };
  }
  if (!info.downloadUrl || !info.assetName) {
    return { ok: false, error: 'No matching installer asset found for this OS', releaseUrl: info.releaseUrl };
  }
  if (!isPackaged) {
    return {
      ok: false,
      devMode: true,
      latestVersion: info.latestVersion,
      releaseUrl: info.releaseUrl,
      error: 'Running from source code — use update-from-github.bat or download the installer from GitHub.',
    };
  }

  const destPath = path.join(os.tmpdir(), `KaleidoSync-Update-${info.latestVersion}-${info.assetName}`);
  await downloadFile(info.downloadUrl, destPath, onProgress);

  if (info.checksumUrl) {
    if (typeof onProgress === 'function') {
      onProgress({ phase: 'verifying', percent: 100, received: info.assetSize, total: info.assetSize });
    }
    const sumsText = await fetchText(info.checksumUrl, 'text/plain');
    const expectedHash = parseSha256Sums(sumsText, info.assetName);
    if (expectedHash) {
      const actualHash = await sha256File(destPath);
      if (actualHash !== expectedHash) {
        try {
          fs.unlinkSync(destPath);
        } catch (_err) {
          // Ignore cleanup errors after mismatch.
        }
        throw new Error('Update checksum verification failed (SHA-256 mismatch)');
      }
    }
  }

  if (typeof onProgress === 'function') {
    onProgress({ phase: 'installing', percent: 100, received: info.assetSize, total: info.assetSize });
  }

  spawnDetachedUpdater({
    platform: process.platform,
    downloadedPath: destPath,
    exePath,
    appImagePath: process.env.APPIMAGE || '',
  });

  if (typeof onQuit === 'function') {
    setTimeout(onQuit, 250);
  }

  return { ok: true, installing: true, latestVersion: info.latestVersion };
}

module.exports = {
  compareSemver,
  pickAssetForPlatform,
  sha256File,
  parseSha256Sums,
  checkForUpdates,
  downloadFile,
  downloadAndInstallUpdate,
};
