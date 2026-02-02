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
    if (!_configLoaded) {
        loadConfig();
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch (url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    })

    if (!response.ok) {
        console.error("Error from the model API:", response.statusText);
        return null;
    }

    const data = await response.json();

    return data.candidates[0].parts[0].text;
}

// Listen for messages from content.js with extracted styles
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "processStyles") {
    console.log("Processing extracted styles:", msg.data);
    
    // Process the extracted styles data
    const stylesData = msg.data;
    
    // You can further process the styles here
    // For example: send to Gemini API, analyze colors, fonts, etc.
    const processedData = {
      url: stylesData.pageUrl,
      title: stylesData.pageTitle,
      cssRuleCount: stylesData.cssRules.split('}').length,
      inlineStyleCount: stylesData.inlineStyles.length,
      cssContent: stylesData.cssRules,
      inlineStyles: stylesData.inlineStyles
    };
    
    console.log("Processed styles data:", processedData);
    
    // Respond back to content.js
    sendResponse({ success: true, processedData: processedData });
  }
});

