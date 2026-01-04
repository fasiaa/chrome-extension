// content.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getPageContent") {
    const pageData = {
      title: document.title,
      url: window.location.href,
      html: document.documentElement.innerHTML
    };
    sendResponse(pageData);
  }
});
