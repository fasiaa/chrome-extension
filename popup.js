// popup.js
document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const mode = document.getElementById("modeSelect").value;
  const apiKey = document.getElementById("apiKey").value;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: "getPageContent" }, (pageData) => {
    if (!pageData) {
      document.getElementById("output").textContent = "Could not get page content!";
      return;
    }

    // Phase 1: just prepare prompt (no API call yet)
    const prompt = `
      Analyze this website for mode: ${mode}
      URL: ${pageData.url}
      HTML length: ${pageData.html.length}
    `;

    document.getElementById("output").textContent = prompt;

    // Phase 2: integrate Gemini API here
    // fetch("https://api.gemini.com/analyze", {method: "POST", headers: {Authorization: apiKey}, body: JSON.stringify({prompt})})
  });
});
