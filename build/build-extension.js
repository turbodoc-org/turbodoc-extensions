#!/usr/bin/env node

/**
 * Build Script for Turbodoc Browser Extension
 * Generates Chrome and Firefox versions from shared codebase
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ExtensionBuilder {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.sharedDir = path.join(this.rootDir, 'shared');
    this.manifestsDir = path.join(this.rootDir, 'manifests');
    this.distDir = path.join(this.rootDir, 'dist');
    
    this.platforms = {
      chrome: {
        distDir: path.join(this.distDir, 'chrome'),
        manifest: path.join(this.manifestsDir, 'chrome-manifest.json')
      },
      firefox: {
        distDir: path.join(this.distDir, 'firefox'),
        manifest: path.join(this.manifestsDir, 'firefox-manifest.json')
      }
    };
  }

  /**
   * Main build process
   */
  async build(platform = 'all') {
    console.log('🚀 Building Turbodoc Browser Extension...');
    
    try {
      // Clean dist directory
      this.cleanDist();
      
      // Bundle Supabase client first
      await this.bundleSupabase();
      
      // Build specific platform or all platforms
      if (platform === 'all') {
        await this.buildChrome();
        await this.buildFirefox();
      } else if (platform === 'chrome') {
        await this.buildChrome();
      } else if (platform === 'firefox') {
        await this.buildFirefox();
      } else {
        throw new Error(`Unknown platform: ${platform}`);
      }
      
      console.log('✅ Build completed successfully!');
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Build Chrome version
   */
  async buildChrome() {
    console.log('📦 Building Chrome version...');
    
    const { distDir, manifest } = this.platforms.chrome;
    
    // Create dist directory
    this.ensureDir(distDir);
    
    // Copy shared files
    this.copyDir(this.sharedDir, distDir);
    
    // Copy Chrome manifest
    this.copyFile(manifest, path.join(distDir, 'manifest.json'));
    
    // Process Chrome-specific modifications
    await this.processChromeSpecific(distDir);
    
    console.log('✅ Chrome version built');
  }

  /**
   * Build Firefox version
   */
  async buildFirefox() {
    console.log('🦊 Building Firefox version...');
    
    const { distDir, manifest } = this.platforms.firefox;
    
    // Create dist directory
    this.ensureDir(distDir);
    
    // Copy shared files
    this.copyDir(this.sharedDir, distDir);
    
    // Copy Firefox manifest
    this.copyFile(manifest, path.join(distDir, 'manifest.json'));
    
    // Process Firefox-specific modifications
    await this.processFirefoxSpecific(distDir);
    
    console.log('✅ Firefox version built');
  }

  /**
   * Bundle Supabase client
   */
  async bundleSupabase() {
    const { bundleSupabase } = require('./bundle-supabase');
    await bundleSupabase();
  }

  /**
   * Process Chrome-specific modifications
   */
  async processChromeSpecific(distDir) {
    // No specific modifications needed for Chrome at this time
    // Future modifications can be added here
  }

  /**
   * Process Firefox-specific modifications
   */
  async processFirefoxSpecific(distDir) {
    // Modify background script for Firefox compatibility
    const backgroundScript = path.join(distDir, 'background', 'background.js');
    
    if (fs.existsSync(backgroundScript)) {
      let content = fs.readFileSync(backgroundScript, 'utf8');
      
      // Replace importScripts with inline script loading for Firefox
      const importScriptsRegex = /importScripts\(\s*([^)]+)\s*\);?/;
      const match = content.match(importScriptsRegex);
      
      if (match) {
        // Extract script paths from importScripts call
        const scriptPaths = match[1]
          .split(',')
          .map(path => path.trim().replace(/['"`]/g, ''));
        
        // Generate inline script tags
        let inlineScripts = '// Firefox compatibility: inline scripts instead of importScripts\n';
        for (const scriptPath of scriptPaths) {
          const fullPath = path.join(distDir, scriptPath.replace('../', ''));
          if (fs.existsSync(fullPath)) {
            const scriptContent = fs.readFileSync(fullPath, 'utf8');
            inlineScripts += `\n// === ${scriptPath} ===\n`;
            inlineScripts += scriptContent + '\n';
          }
        }
        
        // Replace importScripts with inline scripts
        content = content.replace(importScriptsRegex, inlineScripts);
      }
      
      fs.writeFileSync(backgroundScript, content);
    }
  }

  /**
   * Create zip packages for store submission
   */
  async package() {
    console.log('📦 Creating distribution packages...');
    
    for (const [platform, config] of Object.entries(this.platforms)) {
      if (!fs.existsSync(config.distDir)) {
        console.warn(`⚠️  ${platform} build not found. Run build first.`);
        continue;
      }
      
      const zipName = `turbodoc-extension-${platform}.zip`;
      const zipPath = path.join(this.distDir, zipName);
      
      try {
        // Remove existing zip
        if (fs.existsSync(zipPath)) {
          fs.unlinkSync(zipPath);
        }
        
        // Create zip using system command
        const command = `cd "${config.distDir}" && zip -r "../${zipName}" . -x "*.DS_Store" "*.git*"`;
        execSync(command, { stdio: 'inherit' });
        
        const stats = fs.statSync(zipPath);
        const sizeKB = Math.round(stats.size / 1024);
        
        console.log(`✅ Created ${zipName} (${sizeKB} KB)`);
      } catch (error) {
        console.error(`❌ Failed to create ${zipName}:`, error.message);
      }
    }
  }

  /**
   * Development mode with file watching
   */
  async dev() {
    console.log('🔧 Starting development mode...');
    
    // Initial build
    await this.build();
    
    // Watch for changes
    const chokidar = this.requireOptional('chokidar');
    
    if (chokidar) {
      const watcher = chokidar.watch(this.sharedDir, {
        ignored: /node_modules/,
        persistent: true,
        ignoreInitial: true
      });
      
      watcher.on('change', async (filePath) => {
        console.log(`📝 File changed: ${path.relative(this.rootDir, filePath)}`);
        await this.build();
        console.log('🔄 Rebuild complete');
      });
      
      console.log('👀 Watching for changes... Press Ctrl+C to stop.');
    } else {
      console.warn('⚠️  chokidar not installed. Install with: npm install --save-dev chokidar');
      console.log('📦 Initial build complete. Manually rebuild when files change.');
    }
  }

  /**
   * Clean distribution directory
   */
  cleanDist() {
    console.log('🧹 Cleaning dist directory...');
    
    if (fs.existsSync(this.distDir)) {
      this.removeDir(this.distDir);
    }
    
    this.ensureDir(this.distDir);
  }

  /**
   * Recursively copy directory
   */
  copyDir(src, dest) {
    this.ensureDir(dest);
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        this.copyDir(srcPath, destPath);
      } else {
        this.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Copy single file
   */
  copyFile(src, dest) {
    const destDir = path.dirname(dest);
    this.ensureDir(destDir);
    
    fs.copyFileSync(src, dest);
  }

  /**
   * Ensure directory exists
   */
  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Recursively remove directory
   */
  removeDir(dir) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  /**
   * Require optional dependency
   */
  requireOptional(module) {
    try {
      return require(module);
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate build environment
   */
  validateEnvironment() {
    const requiredFiles = [
      this.sharedDir,
      this.manifestsDir,
      path.join(this.manifestsDir, 'chrome-manifest.json'),
      path.join(this.manifestsDir, 'firefox-manifest.json')
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file/directory not found: ${file}`);
      }
    }
  }

  /**
   * Show build info
   */
  showInfo() {
    console.log('📋 Turbodoc Extension Builder');
    console.log('');
    console.log('Available commands:');
    console.log('  build [platform]  - Build extension (chrome, firefox, or all)');
    console.log('  package           - Create zip packages for store submission');
    console.log('  dev               - Development mode with file watching');
    console.log('  clean             - Clean build directory');
    console.log('  info              - Show this information');
    console.log('');
    console.log('Examples:');
    console.log('  npm run build              # Build all platforms');
    console.log('  npm run build:chrome       # Build Chrome only');
    console.log('  npm run build:firefox      # Build Firefox only');
    console.log('  npm run package            # Create zip packages');
    console.log('  npm run dev                # Development mode');
  }
}

// CLI interface
async function main() {
  const builder = new ExtensionBuilder();
  const command = process.argv[2] || 'build';
  const platform = process.argv[3] || 'all';

  try {
    builder.validateEnvironment();

    switch (command) {
    case 'build':
      await builder.build(platform);
      break;
      
    case 'package':
      await builder.package();
      break;
      
    case 'dev':
      await builder.dev();
      break;
      
    case 'clean':
      builder.cleanDist();
      console.log('✅ Clean complete');
      break;
      
    case 'info':
      builder.showInfo();
      break;
      
    default:
      console.error(`❌ Unknown command: ${command}`);
      builder.showInfo();
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ExtensionBuilder;