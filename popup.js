// popup.js - Phase 2 Implementation

// DOM Elements
const urlInput = document.getElementById('urlInput');
const modeGrid = document.getElementById('modeGrid');
const apiKeyInput = document.getElementById('apiKey');
const analyzeBtn = document.getElementById('analyzeBtn');
const analyzeBtnLabel = document.getElementById('analyzeBtnLabel');
const outputPre = document.getElementById('output');
const settingsToggle = document.getElementById('settingsToggle');
const settingsPanel = document.getElementById('settingsPanel');

// State
let isProcessing = false;
let currentMode = 'fullCopy';

// Update the active mode pill and the tracked mode
function setActiveMode(mode) {
  currentMode = mode;
  modeGrid.querySelectorAll('.mode-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

function openSettings() {
  settingsToggle.classList.add('open');
  settingsPanel.classList.add('open');
}

// Per-site result cache: avoids re-sending a site to the model when we
// already have a result for that exact URL + mode combination.
const CACHE_STORAGE_KEY = 'uig_site_cache';
const MAX_CACHE_ENTRIES = 50;

function cacheKey(mode, url) {
  return `${mode}::${url}`;
}

async function getCache() {
  const result = await chrome.storage.local.get([CACHE_STORAGE_KEY]);
  return result[CACHE_STORAGE_KEY] || {};
}

async function getCachedEntry(mode, url) {
  const cache = await getCache();
  return cache[cacheKey(mode, url)] || null;
}

async function setCachedEntry(mode, url, promptText) {
  const cache = await getCache();
  cache[cacheKey(mode, url)] = { promptText, mode, url, timestamp: Date.now() };

  // Evict oldest entries once the cache grows past the cap
  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHE_ENTRIES) {
    keys
      .sort((a, b) => cache[a].timestamp - cache[b].timestamp)
      .slice(0, keys.length - MAX_CACHE_ENTRIES)
      .forEach((k) => delete cache[k]);
  }

  await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: cache });
}

// On popup open, show the most recent cached result for the active tab (any mode)
async function loadCachedResultForCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    const cache = await getCache();
    const matches = Object.values(cache).filter((entry) => entry.url === tab.url);
    if (matches.length === 0) return;

    const latest = matches.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
    setActiveMode(latest.mode);
    renderOutputActions(latest.promptText, latest.mode, { cached: true });
  } catch (error) {
    console.error('Error loading cached result:', error);
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  await loadSavedApiKey();
  await loadCachedResultForCurrentTab();
  setupEventListeners();
});

// Load API key from chrome.storage
async function loadSavedApiKey() {
  try {
    const result = await chrome.storage.local.get(['gemini_api_key']);
    if (result.gemini_api_key) {
      apiKeyInput.value = result.gemini_api_key;
    } else {
      // No key yet - open settings so first-time users see where to add one
      openSettings();
    }
  } catch (error) {
    console.error('Error loading API key:', error);
  }
}

// Save API key to chrome.storage
async function saveApiKey(key) {
  try {
    await chrome.storage.local.set({ gemini_api_key: key });
    console.log('API key saved');
  } catch (error) {
    console.error('Error saving API key:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  analyzeBtn.addEventListener('click', () => handleAnalyze());

  // Save API key on change
  apiKeyInput.addEventListener('change', () => {
    if (apiKeyInput.value.trim()) {
      saveApiKey(apiKeyInput.value.trim());
    }
  });

  // Mode picker
  modeGrid.querySelectorAll('.mode-pill').forEach((btn) => {
    btn.addEventListener('click', () => setActiveMode(btn.dataset.mode));
  });

  // Collapsible settings (API key + URL)
  settingsToggle.addEventListener('click', () => {
    settingsToggle.classList.toggle('open');
    settingsPanel.classList.toggle('open');
  });
}

// Main analyze handler. Pass force=true to bypass the cache (e.g. "Re-analyze").
async function handleAnalyze(force = false) {
  if (isProcessing) return;

  const apiKey = apiKeyInput.value.trim();
  const mode = currentMode;
  const customUrl = urlInput.value.trim();

  // Validation
  if (!apiKey) {
    openSettings();
    updateOutput('Please enter a Gemini API key', 'error');
    return;
  }

  isProcessing = true;
  analyzeBtn.disabled = true;
  analyzeBtn.classList.add('loading');
  analyzeBtnLabel.textContent = 'Processing...';

  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }

    // Skip the model entirely if we already analyzed this exact site + mode
    if (!force) {
      const cached = await getCachedEntry(mode, tab.url);
      if (cached) {
        renderOutputActions(cached.promptText, mode, { cached: true });
        return;
      }
    }

    updateOutput('Extracting page data...', 'info');

    // Save API key for future use
    await saveApiKey(apiKey);

    // Send API key to background script
    await chrome.runtime.sendMessage({
      action: 'setApiKey',
      apiKey: apiKey
    });

    // Route to appropriate handler based on mode
    let result;
    switch (mode) {
      case 'themeExtract':
        result = await extractTheme(tab.id);
        break;
      case 'fullCopy':
        result = await extractFullSite(tab.id);
        break;
      case 'inspire':
        result = await extractInspiration(tab.id);
        break;
      case 'designMd':
        result = await extractDesignMd(tab.id);
        break;
      default:
        throw new Error('Invalid mode selected');
    }
    
    displayResult(result, mode);
    
  } catch (error) {
    console.error('Analysis error:', error);
    updateOutput(`Error: ${error.message}`, 'error');
  } finally {
    isProcessing = false;
    analyzeBtn.disabled = false;
    analyzeBtn.classList.remove('loading');
    analyzeBtnLabel.textContent = 'Analyze';
  }
}

// Extract theme (existing functionality)
async function extractTheme(tabId) {
  updateOutput('Analyzing UI theme...', 'info');
  
  try {
    // Ensure content script is injected first
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    
    // Inject and execute extraction
    const response = await chrome.tabs.sendMessage(tabId, { 
      action: 'extractStyles' 
    });
    
    // Wait for background processing with improved timeout handling
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Theme extraction timeout - API may be slow or network issues detected'));
      }, 60000); // Increased to 60 seconds for better reliability
      
      // Listen for background response
      const listener = (message) => {
        if (message.action === 'themeProcessed') {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(listener);
          
          // Check if response contains error
          if (message.data && message.data.error) {
            reject(new Error(message.data.error));
          } else {
            resolve(message.data);
          }
        }
      };
      
      chrome.runtime.onMessage.addListener(listener);
    });
  } catch (error) {
    throw new Error(`Failed to extract theme: ${error.message}`);
  }
}

// Extract full site
async function extractFullSite(tabId) {
  updateOutput('Extracting full page structure...', 'info');
  
  try {
    // Ensure content script is injected first
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    
    const response = await chrome.tabs.sendMessage(tabId, { 
      action: 'extractFullPage' 
    });
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Full site extraction timeout - API may be slow or network issues detected'));
      }, 120000); // Increased to 120 seconds for full page processing
      
      const listener = (message) => {
        if (message.action === 'fullPageProcessed') {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(listener);
          
          // Check if response contains error
          if (message.data && message.data.error) {
            reject(new Error(message.data.error));
          } else {
            resolve(message.data);
          }
        }
      };
      
      chrome.runtime.onMessage.addListener(listener);
    });
  } catch (error) {
    throw new Error(`Failed to extract full page: ${error.message}`);
  }
}

// Extract inspiration
async function extractInspiration(tabId) {
  updateOutput('Analyzing design patterns...', 'info');
  
  try {
    // Ensure content script is injected first
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    
    const response = await chrome.tabs.sendMessage(tabId, { 
      action: 'extractInspiration' 
    });
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Inspiration extraction timeout - API may be slow or network issues detected'));
      }, 60000); // Increased to 60 seconds for better reliability
      
      const listener = (message) => {
        if (message.action === 'inspirationProcessed') {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(listener);
          
          // Check if response contains error
          if (message.data && message.data.error) {
            reject(new Error(message.data.error));
          } else {
            resolve(message.data);
          }
        }
      };
      
      chrome.runtime.onMessage.addListener(listener);
    });
  } catch (error) {
    throw new Error(`Failed to extract inspiration: ${error.message}`);
  }
}

// Extract DESIGN.md
async function extractDesignMd(tabId) {
  updateOutput('Building DESIGN.md...', 'info');

  try {
    // Ensure content script is injected first
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });

    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'extractDesignSystem'
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('DESIGN.md generation timeout - API may be slow or network issues detected'));
      }, 90000);

      const listener = (message) => {
        if (message.action === 'designMdProcessed') {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(listener);

          if (message.data && message.data.error) {
            reject(new Error(message.data.error));
          } else {
            resolve(message.data);
          }
        }
      };

      chrome.runtime.onMessage.addListener(listener);
    });
  } catch (error) {
    throw new Error(`Failed to generate DESIGN.md: ${error.message}`);
  }
}

// Display result based on mode
function displayResult(result, mode) {
  if (!result || !result.success) {
    updateOutput(result?.error || 'Unknown error', 'error');
    return;
  }

  const promptText = result.llmOutput;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      setCachedEntry(mode, tabs[0].url, promptText);
    }
  });

  renderOutputActions(promptText, mode);
}

// Shared button styling for the output panel, kept in sync with popup.html's palette
const BTN_BASE = 'padding: 6px 10px; cursor: pointer; border: none; border-radius: 8px; font-size: 11px; font-weight: 600; font-family: inherit;';
const BTN_ACCENT = `${BTN_BASE} background: #6C5CE7; color: #fff;`;
const BTN_SECONDARY = `${BTN_BASE} background: rgba(108, 92, 231, 0.12); color: #6C5CE7;`;
const BTN_COPIED = `${BTN_BASE} background: #2ecc71; color: #fff;`;
const BADGE = 'padding: 4px 9px; background: rgba(108, 92, 231, 0.12); color: #6C5CE7; border-radius: 8px; font-size: 10px; font-weight: 600; align-self: center;';

// Build the copy (+ optional download/re-analyze) button row and wire up handlers
function renderOutputActions(promptText, mode, { cached = false } = {}) {
  const isDesignMd = mode === 'designMd';
  const copyLabel = isDesignMd ? 'Copy DESIGN.md' : 'Copy Prompt';
  const downloadBtnHtml = isDesignMd
    ? `<button id="downloadBtn" style="${BTN_SECONDARY}">Download</button>`
    : '';
  const badgeHtml = cached ? `<div style="${BADGE}">Cached</div>` : '';
  const reanalyzeBtnHtml = cached
    ? `<button id="reanalyzeBtn" style="${BTN_SECONDARY}">Re-analyze</button>`
    : '';

  const outputHtml = `
<div style="position: relative; padding-right: 2px;">
  <div style="display: flex; justify-content: flex-end; gap: 6px; flex-wrap: wrap;">
    ${badgeHtml}
    ${reanalyzeBtnHtml}
    ${downloadBtnHtml}
    <button id="copyBtn" style="${BTN_ACCENT}">${copyLabel}</button>
  </div>
  <div style="margin-top: 10px; white-space: pre-wrap; word-wrap: break-word;">
${escapeHtml(promptText)}
  </div>
</div>
  `.trim();

  outputPre.innerHTML = outputHtml;

  document.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(promptText).then(() => {
      const btn = document.getElementById('copyBtn');
      btn.textContent = 'Copied';
      btn.style.cssText = BTN_COPIED;
      setTimeout(() => {
        btn.textContent = copyLabel;
        btn.style.cssText = BTN_ACCENT;
      }, 2000);
    });
  });

  if (isDesignMd) {
    document.getElementById('downloadBtn').addEventListener('click', () => {
      const blob = new Blob([promptText], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url: url,
        filename: 'DESIGN.md',
        saveAs: true
      });
    });
  }

  if (cached) {
    document.getElementById('reanalyzeBtn').addEventListener('click', () => {
      handleAnalyze(true);
    });
  }
}

// Update output display
function updateOutput(message, type = 'info') {
  const colors = {
    success: '#2ecc71',
    error: '#e74c3c',
    info: '#6C5CE7',
    warning: '#f39c12'
  };

  outputPre.innerHTML = `<span style="color: ${colors[type]}">${escapeHtml(message)}</span>`;
}

// Escape HTML for safe display
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
