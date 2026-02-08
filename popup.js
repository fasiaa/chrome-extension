// popup.js - Phase 2 Implementation

// DOM Elements
const urlInput = document.getElementById('urlInput');
const modeSelect = document.getElementById('modeSelect');
const apiKeyInput = document.getElementById('apiKey');
const analyzeBtn = document.getElementById('analyzeBtn');
const outputPre = document.getElementById('output');

// State
let isProcessing = false;

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  await loadSavedApiKey();
  await loadSavedOutput();
  setupEventListeners();
});

// Load API key from chrome.storage
async function loadSavedApiKey() {
  try {
    const result = await chrome.storage.local.get(['gemini_api_key']);
    if (result.gemini_api_key) {
      apiKeyInput.value = result.gemini_api_key;
      updateOutput('✓ API key loaded from storage', 'success');
    }
  } catch (error) {
    console.error('Error loading API key:', error);
  }
}

// Load previously generated output from chrome.storage
async function loadSavedOutput() {
  try {
    const result = await chrome.storage.local.get(['lastPromptOutput']);
    if (result.lastPromptOutput) {
      const { promptText, mode, url } = result.lastPromptOutput;
      
      // Check if we're on the same website
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.url === url) {
        // Display the saved output
        displaySavedPrompt(promptText, mode);
      }
    }
  } catch (error) {
    console.error('Error loading saved output:', error);
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
  analyzeBtn.addEventListener('click', handleAnalyze);
  
  // Save API key on change
  apiKeyInput.addEventListener('change', () => {
    if (apiKeyInput.value.trim()) {
      saveApiKey(apiKeyInput.value.trim());
    }
  });
}

// Main analyze handler
async function handleAnalyze() {
  if (isProcessing) return;
  
  const apiKey = apiKeyInput.value.trim();
  const mode = modeSelect.value;
  const customUrl = urlInput.value.trim();
  
  // Validation
  if (!apiKey) {
    updateOutput('❌ Please enter a Gemini API key', 'error');
    return;
  }
  
  isProcessing = true;
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Processing...';
  updateOutput('⏳ Extracting page data...', 'info');
  
  try {
    // Save API key for future use
    await saveApiKey(apiKey);
    
    // Send API key to background script
    await chrome.runtime.sendMessage({
      action: 'setApiKey',
      apiKey: apiKey
    });
    
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }
    
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
      default:
        throw new Error('Invalid mode selected');
    }
    
    displayResult(result, mode);
    
  } catch (error) {
    console.error('Analysis error:', error);
    updateOutput(`❌ Error: ${error.message}`, 'error');
  } finally {
    isProcessing = false;
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze';
  }
}

// Extract theme (existing functionality)
async function extractTheme(tabId) {
  updateOutput('📊 Analyzing UI theme...', 'info');
  
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
    
    // Wait for background processing
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Theme extraction timeout'));
      }, 30000); // 30 second timeout
      
      // Listen for background response
      const listener = (message) => {
        if (message.action === 'themeProcessed') {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(listener);
          resolve(message.data);
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
  updateOutput('🌐 Extracting full page structure...', 'info');
  
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
        reject(new Error('Full site extraction timeout'));
      }, 90000);
      
      const listener = (message) => {
        if (message.action === 'fullPageProcessed') {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(listener);
          resolve(message.data);
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
  updateOutput('✨ Analyzing design patterns...', 'info');
  
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
        reject(new Error('Inspiration extraction timeout'));
      }, 30000);
      
      const listener = (message) => {
        if (message.action === 'inspirationProcessed') {
          clearTimeout(timeout);
          chrome.runtime.onMessage.removeListener(listener);
          resolve(message.data);
        }
      };
      
      chrome.runtime.onMessage.addListener(listener);
    });
  } catch (error) {
    throw new Error(`Failed to extract inspiration: ${error.message}`);
  }
}

// Display result based on mode
function displayResult(result, mode) {
  if (!result || !result.success) {
    updateOutput(`❌ ${result?.error || 'Unknown error'}`, 'error');
    return;
  }
  
  const promptText = result.llmOutput;
  
  // Save output to storage for later retrieval
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      chrome.storage.local.set({
        lastPromptOutput: {
          promptText: promptText,
          mode: mode,
          url: tabs[0].url,
          timestamp: new Date().getTime()
        }
      });
    }
  });
  
  displayPromptWithCopyButton(promptText);
}

// Display prompt with copy button
function displayPromptWithCopyButton(promptText) {
  // Create output with copy button
  const outputHtml = `
<div style="position: relative;">
  <button id="copyBtn" style="position: absolute; top: 5px; right: 5px; padding: 5px 10px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 3px;">
    Copy Prompt
  </button>
  <div style="margin-top: 35px; white-space: pre-wrap; word-wrap: break-word;">
${escapeHtml(promptText)}
  </div>
</div>
  `.trim();
  
  outputPre.innerHTML = outputHtml;
  
  // Add copy functionality
  document.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(promptText).then(() => {
      const btn = document.getElementById('copyBtn');
      btn.textContent = '✓ Copied!';
      btn.style.background = '#2196F3';
      setTimeout(() => {
        btn.textContent = 'Copy Prompt';
        btn.style.background = '#4CAF50';
      }, 2000);
    });
  });
}

// Display previously saved prompt
function displaySavedPrompt(promptText, mode) {
  const outputHtml = `
<div style="position: relative;">
  <div style="position: absolute; top: 5px; right: 5px; padding: 5px 10px; background: #1976D2; color: white; border-radius: 3px; font-size: 12px;">
    Cached (${mode})
  </div>
  <button id="copyBtn" style="position: absolute; top: 5px; right: 140px; padding: 5px 10px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 3px;">
    Copy Prompt
  </button>
  <div style="margin-top: 35px; white-space: pre-wrap; word-wrap: break-word;">
${escapeHtml(promptText)}
  </div>
</div>
  `.trim();
  
  outputPre.innerHTML = outputHtml;
  
  // Add copy functionality
  document.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(promptText).then(() => {
      const btn = document.getElementById('copyBtn');
      btn.textContent = '✓ Copied!';
      btn.style.background = '#2196F3';
      setTimeout(() => {
        btn.textContent = 'Copy Prompt';
        btn.style.background = '#4CAF50';
      }, 2000);
    });
  });
}

// Update output display
function updateOutput(message, type = 'info') {
  const colors = {
    success: '#4CAF50',
    error: '#f44336',
    info: '#2196F3',
    warning: '#ff9800'
  };
  
  outputPre.innerHTML = `<span style="color: ${colors[type]}">${escapeHtml(message)}</span>`;
}

// Escape HTML for safe display
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
