// content.js

// Extract all styles (CSS) from the page
const extractPageStyles = () => {
  const styles = [];
  
  // Get all stylesheets
  const stylesheets = document.styleSheets;
  
  for (let i = 0; i < stylesheets.length; i++) {
    try {
      const stylesheet = stylesheets[i];
      // Skip external stylesheets from different origins for security
      if (stylesheet.href && !stylesheet.href.includes(window.location.origin)) {
        continue;
      }
      
      const cssRules = stylesheet.cssRules;
      for (let j = 0; j < cssRules.length; j++) {
        styles.push(cssRules[j].cssText);
      }
    } catch (error) {
      // Can't access cross-origin stylesheets
      console.log("Could not access stylesheet:", error);
    }
  }
  
  // Get inline styles from all elements
  const allElements = document.querySelectorAll('*[style]');
  const inlineStyles = [];
  allElements.forEach((element) => {
    if (element.getAttribute('style')) {
      inlineStyles.push({
        selector: element.tagName.toLowerCase() + (element.id ? '#' + element.id : ''),
        style: element.getAttribute('style')
      });
    }
  });
  
  return {
    cssRules: styles.join('\n'),
    inlineStyles: inlineStyles,
    pageUrl: window.location.href,
    pageTitle: document.title
  };
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getPageContent") {
    const pageData = {
      title: document.title,
      url: window.location.href,
      html: document.documentElement.innerHTML
    };
    sendResponse(pageData);
  }
  
  if (msg.action === "extractStyles") {
    const stylesData = extractPageStyles();
    console.log("Extracted styles from page:", stylesData);
    
    // Send extracted styles to background.js for processing
    chrome.runtime.sendMessage({
      action: "processStyles",
      data: stylesData
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending to background:", chrome.runtime.lastError);
      } else {
        console.log("Background response:", response);
      }
    });
    
    // Respond to popup immediately
    sendResponse({ success: true, message: "Styles extracted and sent for processing" });
    return true;
  }
});
