let apiKey = "";
let _configLoaded = false;

async function loadConfig () {
    try {
        const url = chrome.runtime.getURL('config.json');
        
        const response = await fetch(url);

        if (!response.ok) {
            console.warn("Unable to load config.json");
            return;
        }

        const config = await response.json();

        if (config && config.api_key){
            apiKey = config.api_key;
            _configLoaded = true;
        }
    } catch (error) {
        console.warn("Error loading config.json:", error);
    }
}

loadConfig(); //loading the gemini api key from the config file

const getResponseFromTheModel = async (prompt) => {
    try {
        if (!_configLoaded) {
            await loadConfig();
        }

        if (!apiKey) {
            console.error('No API key available for model request');
            return null;
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            console.error("Error from the model API:", response.status, response.statusText, text);
            return null;
        }

        const data = await response.json().catch((err) => {
            console.error('Failed to parse JSON from model response:', err);
            return null;
        });

        if (!data) return null;

        // Robustly locate textual output in known Gemini response shapes
        console.log('Model response data shape:', JSON.stringify(data).substring(0, 200), '...');

        // Try to extract text from candidates[0].content.parts[0].text
        if (Array.isArray(data.candidates) && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            if (candidate && candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts) && candidate.content.parts.length > 0) {
                const text = candidate.content.parts[0].text;
                if (text && typeof text === 'string') {
                    console.log('✓ Extracted text from candidates[0].content.parts[0].text');
                    return text;
                }
            }
        }

        // Fallback: try without content wrapper (older API format)
        if (Array.isArray(data.candidates) && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            if (candidate && candidate.parts && Array.isArray(candidate.parts) && candidate.parts.length > 0) {
                const text = candidate.parts[0].text;
                if (text && typeof text === 'string') {
                    console.log('✓ Extracted text from candidates[0].parts[0].text');
                    return text;
                }
            }
        }

        // Fallbacks for other possible response shapes
        if (data.output && typeof data.output === 'string') {
            console.log('✓ Extracted text from data.output');
            return data.output;
        }
        if (data.text && typeof data.text === 'string') {
            console.log('✓ Extracted text from data.text');
            return data.text;
        }

        // Last resort: try to find any string content
        console.warn('⚠️ Could not extract text using standard paths. Data structure:', Object.keys(data || {}));
        console.warn('Returning entire response as JSON');
        return JSON.stringify(data);
    } catch (err) {
        console.error('Error while calling model API:', err);
        return null;
    }
}

// ========================================
// UNIFIED MESSAGE HANDLER
// ========================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Handle API key updates from popup
  if (msg.action === "setApiKey") {
    apiKey = msg.apiKey;
    _configLoaded = true;
    sendResponse({ success: true });
    return false;
  }

  // Handle style processing
  if (msg.action === "processStyles") {
    (async () => {
      try {
        console.log("Processing extracted styles:", msg.data);

        const stylesData = msg.data || {};

        const processedData = {
          url: stylesData.pageUrl,
          title: stylesData.pageTitle,
          cssRuleCount: stylesData.cssRules ? stylesData.cssRules.split('}').length : 0,
          inlineStyleCount: Array.isArray(stylesData.inlineStyles) ? stylesData.inlineStyles.length : 0,
          // Truncate long CSS to avoid hitting API limits
          cssContent: stylesData.cssRules ? stylesData.cssRules.slice(0, 15000) : "",
          inlineStyles: stylesData.inlineStyles || []
        };

        // Build a clear instruction prompt for the LLM to produce a structured UI theme
        const prompt = `You are an assistant that converts raw website CSS and inline styles into a structured UI theme prompt that another AI agent can consume to reproduce the exact visual style of the page.

Input metadata:
- URL: ${processedData.url}
- Title: ${processedData.title}
- CSS rule count (approx): ${processedData.cssRuleCount}
- Inline style count: ${processedData.inlineStyleCount}

CSS (truncated to 15k chars):
${processedData.cssContent}

Inline styles (examples):
${JSON.stringify(processedData.inlineStyles.slice(0, 50), null, 2)}

Task:
1) Extract primary color palette (primary, secondary, background, surface, text colors).
2) List fonts used and recommended font-family stack.
3) Describe spacing scale (small/medium/large) based on CSS values.
4) Provide tokens for border-radius, shadows, and typical component dimensions.
5) Provide a short set of CSS rules or variables that reproduce the theme.
6) Create a ready-to-send prompt (plain text) that another AI can consume to recreate the UI theme. The prompt should be self-contained and include any sample CSS and explicit instructions.

Output Format:
Return a single, comprehensive, plain-text prompt that another AI can use to recreate the UI theme. Do not use JSON or any other structured format. The output should be a single block of text.`;

        console.log("Sending prompt to model (length):", prompt.length);

        const modelText = await getResponseFromTheModel(prompt);

        if (!modelText) {
          sendResponse({ success: false, error: 'Model returned no response', processedData });
          return;
        }

        // Send raw text output from the model (no JSON parsing)
        const result = { success: true, llmOutput: modelText };
        console.log("LLM result:", result);
        sendResponse(result);
        
        // Also send to popup
        chrome.runtime.sendMessage({
          action: 'themeProcessed',
          data: result
        }).catch(() => {
          // Popup may not be open, that's okay
          console.log("Could not send to popup (may not be open)");
        });
      } catch (err) {
        console.error("Error processing styles:", err);
        sendResponse({ success: false, error: err.message || String(err) });
      }
    })();
    return true;
  }

  // Handle full page extraction
  if (msg.action === "processFullPage") {
    (async () => {
      try {
        console.log("Processing full page data:", msg.data);
        
        const pageData = msg.data || {};
        
        const prompt = `You are an AI assistant that converts complete website HTML and CSS into a comprehensive recreation prompt.

Input Data:
- URL: ${pageData.url}
- Title: ${pageData.title}
- HTML Structure Length: ${pageData.html ? pageData.html.length : 0} characters
- CSS Rules Count: ${pageData.cssRuleCount || 0}

HTML (truncated to 30k chars):
${pageData.html ? pageData.html.slice(0, 30000) : ''}

CSS (truncated to 15k chars):
${pageData.css ? pageData.css.slice(0, 15000) : ''}

Computed Styles Summary:
${JSON.stringify(pageData.computedStyles || {}, null, 2)}

Task:
Create a comprehensive AI prompt that another AI agent can use to recreate this website. The prompt should include:

1. **Page Structure**: Describe the layout, sections, and component hierarchy
2. **Styling Details**: Colors, typography, spacing, borders, shadows
3. **Interactive Elements**: Buttons, forms, navigation, hover states
4. **Responsive Behavior**: Breakpoints and mobile adaptations (if detectable)
5. **Component Breakdown**: List key UI components (header, nav, cards, footer, etc.)
6. **Recreation Instructions**: Step-by-step guide for rebuilding

Output Format:
Return a single, comprehensive, plain-text prompt that another AI can use to recreate the website. Do not use JSON or any other structured format. The output should be a single block of text.`;

        const modelText = await getResponseFromTheModel(prompt);
        
        if (!modelText) {
          sendResponse({ success: false, error: 'Model returned no response' });
          return;
        }
        
        const result = { success: true, llmOutput: modelText };
        
        // Send to popup
        chrome.runtime.sendMessage({
          action: 'fullPageProcessed',
          data: result
        }).catch(() => {
          console.log("Could not send to popup (may not be open)");
        });
        
        sendResponse(result);
      } catch (err) {
        console.error("Error processing full page:", err);
        sendResponse({ success: false, error: err.message || String(err) });
      }
    })();
    return true;
  }

  // Handle inspiration extraction
  if (msg.action === "processInspiration") {
    (async () => {
      try {
        console.log("Processing inspiration data:", msg.data);
        
        const inspoData = msg.data || {};
        
        const prompt = `You are a UI/UX design analyst. Analyze this website and extract design inspiration and patterns.

Input Data:
- URL: ${inspoData.url}
- Title: ${inspoData.title}
- Key Components: ${JSON.stringify(inspoData.components || [], null, 2)}
- Color Palette: ${JSON.stringify(inspoData.colors || [], null, 2)}
- Typography: ${JSON.stringify(inspoData.fonts || [], null, 2)}
- Layout Patterns: ${JSON.stringify(inspoData.layoutPatterns || {}, null, 2)}

Task:
Create a design inspiration prompt that captures the essence and key patterns of this website. Focus on:

1. **Design Philosophy**: Overall aesthetic and approach
2. **Color Strategy**: How colors are used (primary, accents, neutrals)
3. **Typography Choices**: Font pairings and hierarchy
4. **Layout Patterns**: Grid systems, spacing rhythm, alignment
5. **Component Patterns**: Card styles, button designs, navigation patterns
6. **Unique Elements**: Distinctive features worth replicating
7. **Mood & Feel**: The emotional impact and user experience

Output Format:
Return a single, comprehensive, plain-text prompt that another AI can use for design inspiration. Do not use JSON or any other structured format. The output should be a single block of text.`;

        const modelText = await getResponseFromTheModel(prompt);
        
        if (!modelText) {
          sendResponse({ success: false, error: 'Model returned no response' });
          return;
        }
        
        const result = { success: true, llmOutput: modelText };
        
        // Send to popup
        chrome.runtime.sendMessage({
          action: 'inspirationProcessed',
          data: result
        }).catch(() => {
          console.log("Could not send to popup (may not be open)");
        });
        
        sendResponse(result);
      } catch (err) {
        console.error("Error processing inspiration:", err);
        sendResponse({ success: false, error: err.message || String(err) });
      }
    })();
    return true;
  }

  return false;
});
