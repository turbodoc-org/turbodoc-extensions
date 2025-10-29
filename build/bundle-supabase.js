#!/usr/bin/env node

/**
 * Bundle Supabase client for browser extension
 * Creates a standalone version that doesn't violate CSP
 */

const { build } = require('esbuild');
const path = require('path');
const fs = require('fs');

// Entry point content - imports and exports Supabase client
const entryContent = `
// Define process for environments that don't have it
if (typeof process === 'undefined') {
  globalThis.process = { env: {} };
}

import { createClient } from '@supabase/supabase-js';
window.createSupabaseClient = createClient;
`;

async function bundleSupabase() {
  const rootDir = path.resolve(__dirname, '..');
  const tempEntry = path.join(rootDir, 'temp-supabase-entry.js');
  const outputDir = path.join(rootDir, 'shared', 'lib');
  const outputFile = path.join(outputDir, 'supabase-bundle.js');

  try {
    console.log('📦 Bundling Supabase client...');

    // Create temporary entry file
    fs.writeFileSync(tempEntry, entryContent);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Bundle with esbuild
    await build({
      entryPoints: [tempEntry],
      bundle: true,
      minify: true,
      format: 'iife',
      globalName: 'SupabaseBundle',
      outfile: outputFile,
      platform: 'browser',
      target: 'es2020',
      define: {
        global: 'globalThis',
        'process.env.NODE_ENV': '"production"',
      },
      external: [],
      footer: {
        js: `
// Make createClient available globally
if (typeof window !== 'undefined' && window.createSupabaseClient) {
  window.createClient = window.createSupabaseClient;
  window.supabase = { createClient: window.createSupabaseClient };
}
        `.trim(),
      },
    });

    // Clean up temp file
    if (fs.existsSync(tempEntry)) {
      fs.unlinkSync(tempEntry);
    }

    const stats = fs.statSync(outputFile);
    const sizeKB = Math.round(stats.size / 1024);

    console.log(`✅ Supabase bundle created: ${sizeKB} KB`);
    console.log(`📍 Output: ${path.relative(rootDir, outputFile)}`);
  } catch (error) {
    console.error('❌ Failed to bundle Supabase:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  bundleSupabase().catch(process.exit);
}

module.exports = { bundleSupabase };
