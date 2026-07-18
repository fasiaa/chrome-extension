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

        // Fetch has no built-in timeout - without this, a stalled connection
        // hangs forever and the popup's own timeout fires with no real error to show.
        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), 45000);

        let response;
        try {
            response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                }),
                signal: controller.signal
            });
        } catch (fetchErr) {
            if (fetchErr.name === 'AbortError') {
                console.error("Model request timed out after 45s");
                return "Error: The request to Gemini timed out. This can happen with very large pages - try again, or use a lighter analysis mode.";
            }
            console.error("Network error calling model API:", fetchErr);
            return `Error: Network error while contacting Gemini - ${fetchErr.message}`;
        } finally {
            clearTimeout(abortTimer);
        }

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            console.error("Error from the model API:", response.status, response.statusText, text);
            
            // Handle specific API key errors with user-friendly messages
            if (response.status === 400 && text.includes('API_KEY_INVALID')) {
                return "Error: Invalid API key. Please check your Gemini API key and ensure it's valid and not being used in other projects simultaneously.";
            } else if (response.status === 401) {
                return "Error: Authentication failed. Please verify your API key is correct.";
            } else if (response.status === 429) {
                return "Error: API rate limit exceeded. Please wait a moment and try again.";
            } else if (response.status === 500) {
                return "Error: Server temporarily unavailable. Please try again in a few moments.";
            }
            
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
        console.warn('Attempting to extract text from response in a different way...');
        
        // Try to find text in any nested structure
        const findTextInObject = (obj) => {
            if (typeof obj === 'string') {
                return obj;
            }
            if (typeof obj === 'object' && obj !== null) {
                for (const key in obj) {
                    const result = findTextInObject(obj[key]);
                    if (result) return result;
                }
            }
            return null;
        };
        
        const extractedText = findTextInObject(data);
        if (extractedText) {
            console.log('✓ Extracted text using recursive search');
            return extractedText;
        }
        
        // If all else fails, return a plain text error message instead of JSON
        console.error('❌ Could not extract any text from model response');
        return "Error: The AI model did not return a valid response. Please try again.";
    } catch (err) {
        console.error('Error while calling model API:', err);
        return null;
    }
}

// Format text to render markdown-like formatting as plain text with emphasis
function formatResponseText(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }
    
    // Replace **bold** with BOLD (uppercase) for emphasis
    text = text.replace(/\*\*(.*?)\*\*/g, (match, content) => {
        return content.toUpperCase();
    });
    
    // Replace *italic* with *italic* (keep asterisks for emphasis)
    text = text.replace(/\*(.*?)\*/g, (match, content) => {
        return `*${content}*`;
    });
    
    // Replace `code` with [code] for emphasis
    text = text.replace(/`(.*?)`/g, (match, content) => {
        return `[${content}]`;
    });
    
    // Replace ## Headers with uppercase headers
    text = text.replace(/^##\s+(.*$)/gm, (match, content) => {
        return content.toUpperCase() + '\n' + '='.repeat(content.length);
    });
    
    // Replace # Headers with uppercase headers
    text = text.replace(/^#\s+(.*$)/gm, (match, content) => {
        return content.toUpperCase() + '\n' + '='.repeat(content.length);
    });
    
    // Replace numbered lists (1., 2., etc.) with clean formatting
    text = text.replace(/^\s*(\d+)\.\s+(.*$)/gm, (match, number, content) => {
        return `${number}. ${content}`;
    });
    
    // Replace bullet points (- or *) with clean formatting
    text = text.replace(/^\s*[-*]\s+(.*$)/gm, (match, content) => {
        return `• ${content}`;
    });
    
    // Clean up extra spacing
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return text;
}

// Broadcast a result to the popup. Used for both success and failure so the
// popup's pending listener always resolves instead of hitting its timeout.
function broadcastToPopup(action, data) {
    chrome.runtime.sendMessage({ action, data }).catch(() => {
        // Popup may not be open, that's okay
        console.log("Could not send to popup (may not be open)");
    });
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
          const failure = { success: false, error: 'Model returned no response' };
          sendResponse({ ...failure, processedData });
          broadcastToPopup('themeProcessed', failure);
          return;
        }

        // Format the response text to render markdown-like formatting properly
        const formattedText = formatResponseText(modelText);

        // Send formatted text output from the model
        const result = { success: true, llmOutput: formattedText };
        console.log("LLM result:", result);
        sendResponse(result);
        broadcastToPopup('themeProcessed', result);
      } catch (err) {
        console.error("Error processing styles:", err);
        const failure = { success: false, error: err.message || String(err) };
        sendResponse(failure);
        broadcastToPopup('themeProcessed', failure);
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
          const failure = { success: false, error: 'Model returned no response' };
          sendResponse(failure);
          broadcastToPopup('fullPageProcessed', failure);
          return;
        }

        // Format the response text to render markdown-like formatting properly
        const formattedText = formatResponseText(modelText);

        const result = { success: true, llmOutput: formattedText };
        sendResponse(result);
        broadcastToPopup('fullPageProcessed', result);
      } catch (err) {
        console.error("Error processing full page:", err);
        const failure = { success: false, error: err.message || String(err) };
        sendResponse(failure);
        broadcastToPopup('fullPageProcessed', failure);
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
          const failure = { success: false, error: 'Model returned no response' };
          sendResponse(failure);
          broadcastToPopup('inspirationProcessed', failure);
          return;
        }

        // Format the response text to render markdown-like formatting properly
        const formattedText = formatResponseText(modelText);

        const result = { success: true, llmOutput: formattedText };
        sendResponse(result);
        broadcastToPopup('inspirationProcessed', result);
      } catch (err) {
        console.error("Error processing inspiration:", err);
        const failure = { success: false, error: err.message || String(err) };
        sendResponse(failure);
        broadcastToPopup('inspirationProcessed', failure);
      }
    })();
    return true;
  }

  // Handle DESIGN.md generation (google-labs-code/design.md format)
  if (msg.action === "processDesignMd") {
    (async () => {
      try {
        console.log("Processing design system data:", msg.data);

        const d = msg.data || {};

        const prompt = `You are an assistant that converts raw, extracted website design data into a valid DESIGN.md file, following the DESIGN.md format specification (https://github.com/google-labs-code/design.md).

DESIGN.md is a self-contained, plain-text representation of a design system. It has exactly two parts:

1. YAML front matter, delimited by "---" fences, containing machine-readable design tokens.
2. A markdown body made of "##" sections containing human-readable design rationale.

FRONTMATTER SCHEMA (use only real values extracted from the data below, do not invent unrelated values):
- name: string (required) - a short name for this design system, inferred from the site title/brand
- description: string (optional) - one sentence describing the visual identity
- colors: map of token-name -> CSS color value (e.g. primary, secondary, tertiary, neutral, background, surface, text, on-primary, etc.)
- typography: map of token-name -> typography object with any of: fontFamily, fontSize, fontWeight, lineHeight, letterSpacing (e.g. h1, h2, body-md, label-caps)
- rounded: map of scale-level -> Dimension (e.g. sm, md, lg matched to observed border-radius values)
- spacing: map of scale-level -> Dimension or number (e.g. xs, sm, md, lg matched to observed padding/margin values)
- components: map of component-name -> token map (e.g. button-primary, card, input) using properties from: backgroundColor, textColor, typography, rounded, padding, size, height, width. Prefer token references using {path.to.token} syntax where a component value matches a color/typography/rounded/spacing token exactly (e.g. backgroundColor: "{colors.primary}").

Example of valid frontmatter shape (values are illustrative only, do NOT copy them - use the real extracted data below):
---
name: Heritage
description: Architectural minimalism with a single accent color.
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
typography:
  h1:
    fontFamily: Public Sans
    fontSize: 3rem
rounded:
  sm: 4px
spacing:
  sm: 8px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.sm}"
---

MARKDOWN BODY SECTION ORDER (include every section, in exactly this order, using "## " headings):
1. Overview - the design philosophy/aesthetic in 1-3 sentences
2. Colors - explain the palette and how each color token is used, referencing the color tokens by name and hex value
3. Typography - explain font choices, pairings, and hierarchy, referencing the typography tokens
4. Layout - spacing rhythm, grid/container behavior, alignment principles, referencing the spacing tokens
5. Elevation & Depth - how shadows/z-layers are used (base this on the observed box-shadow values; if none were observed, state that the design is flat with no elevation)
6. Shapes - corner radius language, referencing the rounded tokens
7. Components - describe the sampled components (button, card, input, link, heading) and how their tokens were derived
8. Do's and Don'ts - a short bullet list of 3-5 concrete guidelines for an agent reproducing this UI

RULES:
- Output ONLY the DESIGN.md file contents: the "---" delimited YAML frontmatter followed immediately by the markdown body. No commentary before or after, no surrounding \`\`\` code fences.
- Use real values from the extracted data below wherever possible. Do not fabricate colors, fonts, or dimensions that aren't supported by the data.
- Keep the YAML valid (proper indentation, quote hex colors).

EXTRACTED DESIGN DATA
URL: ${d.url}
Title: ${d.title}

Dominant colors (by frequency, most used first):
${JSON.stringify(d.colors || [], null, 2)}

Font families observed:
${JSON.stringify(d.fontFamilies || [], null, 2)}

Font sizes observed:
${JSON.stringify(d.fontSizes || [], null, 2)}

Font weights observed:
${JSON.stringify(d.fontWeights || [], null, 2)}

Border-radius values observed:
${JSON.stringify(d.radii || [], null, 2)}

Box-shadow values observed:
${JSON.stringify(d.shadows || [], null, 2)}

Spacing (padding/margin) values observed:
${JSON.stringify(d.spacingValues || [], null, 2)}

Sampled components (computed styles):
${JSON.stringify(d.components || {}, null, 2)}`;

        console.log("Sending DESIGN.md prompt to model (length):", prompt.length);

        const modelText = await getResponseFromTheModel(prompt);

        if (!modelText) {
          const failure = { success: false, error: 'Model returned no response' };
          sendResponse(failure);
          broadcastToPopup('designMdProcessed', failure);
          return;
        }

        // Do NOT run formatResponseText here - it mangles markdown/YAML syntax
        // (strips **, #, etc.) which would corrupt the DESIGN.md file contents.
        let designMdText = modelText.trim();
        // Strip accidental code fences if the model wrapped the output anyway
        designMdText = designMdText.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');

        const result = { success: true, llmOutput: designMdText };
        console.log("DESIGN.md result:", result);
        sendResponse(result);
        broadcastToPopup('designMdProcessed', result);
      } catch (err) {
        console.error("Error processing design.md:", err);
        const failure = { success: false, error: err.message || String(err) };
        sendResponse(failure);
        broadcastToPopup('designMdProcessed', failure);
      }
    })();
    return true;
  }

  return false;
});
