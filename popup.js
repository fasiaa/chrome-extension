// popup.js

document.addEventListener("DOMContentLoaded", async () => {
  // Auto-fill URL with current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  document.getElementById("urlInput").value = tab.url;
});

document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const mode = document.getElementById("modeSelect").value;
  const apiKey = document.getElementById("apiKey").value;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Send message to content.js to get page content
  chrome.tabs.sendMessage(tab.id, { action: "getPageContent" }, async (pageData) => {
    if (!pageData) {
      document.getElementById("output").textContent = "Could not get page content!";
      return;
    }

    // Prepare prompt for LLM
    const prompt = `
      Analyze this website for mode: ${mode}
      URL: ${pageData.url}
      HTML length: ${pageData.html.length}
      API_KEY : ${pageData.apiKey}
    `;

    document.getElementById("output").textContent = "Processing...\n" + prompt;

    // --- Phase 2: Gemini API call ---
    try {
      const response = await fetch("https://api.gemini.com/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": apiKey
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      // Display LLM response in popup
      document.getElementById("output").textContent = JSON.stringify(data, null, 2);

    } catch (err) {
      document.getElementById("output").textContent = "Error fetching LLM response:\n" + err.message;
    }
  });
});
