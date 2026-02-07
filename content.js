// content.js

// Prevent double-initialization when the script is injected multiple times
if (!window.__uig_content_initialized__) {
  window.__uig_content_initialized__ = true;

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

  // Extract full page HTML and structure
  const extractFullPage = () => {
    // Get clean HTML
    const html = document.documentElement.outerHTML;
    
    // Extract CSS
    const stylesData = extractPageStyles();
    
    // Get computed styles of key elements
    const computedStyles = {};
    const keySelectors = ['body', 'main', 'header', 'footer', 'nav', '.container', '#root', '#app'];
    
    keySelectors.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        const styles = window.getComputedStyle(element);
        computedStyles[selector] = {
          display: styles.display,
          width: styles.width,
          maxWidth: styles.maxWidth,
          padding: styles.padding,
          margin: styles.margin,
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          fontSize: styles.fontSize,
          fontFamily: styles.fontFamily
        };
      }
    });
    
    return {
      url: window.location.href,
      title: document.title,
      html: html,
      css: stylesData.cssRules,
      cssRuleCount: stylesData.cssRules ? stylesData.cssRules.split('}').length : 0,
      computedStyles: computedStyles,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  };

  // Extract design inspiration data
  const extractInspiration = () => {
    // Extract color palette from computed styles
    const colors = new Set();
    const fonts = new Set();
    
    // Sample elements across the page
    const elements = document.querySelectorAll('*');
    const sampleSize = Math.min(elements.length, 200); // Sample first 200 elements
    
    for (let i = 0; i < sampleSize; i++) {
      const element = elements[i];
      const styles = window.getComputedStyle(element);
      
      // Collect colors
      if (styles.backgroundColor && styles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        colors.add(styles.backgroundColor);
      }
      if (styles.color) {
        colors.add(styles.color);
      }
      if (styles.borderColor && styles.borderColor !== 'rgb(0, 0, 0)') {
        colors.add(styles.borderColor);
      }
      
      // Collect fonts
      if (styles.fontFamily) {
        fonts.add(styles.fontFamily);
      }
    }
    
    // Detect layout patterns
    const layoutPatterns = {
      hasGrid: !!document.querySelector('[style*="grid"]'),
      hasFlex: !!document.querySelector('[style*="flex"]'),
      hasContainer: !!document.querySelector('.container, .wrapper, [class*="container"]'),
      hasSidebar: !!document.querySelector('aside, .sidebar, [class*="sidebar"]'),
    };
    
    // Identify key components
    const components = [];
    
    // Headers
    const headers = document.querySelectorAll('header, [role="banner"]');
    if (headers.length) {
      components.push({ type: 'header', count: headers.length });
    }
    
    // Navigation
    const navs = document.querySelectorAll('nav, [role="navigation"]');
    if (navs.length) {
      components.push({ type: 'navigation', count: navs.length });
    }
    
    // Cards
    const cards = document.querySelectorAll('.card, [class*="card"]');
    if (cards.length) {
      components.push({ type: 'card', count: cards.length });
    }
    
    // Buttons
    const buttons = document.querySelectorAll('button, .btn, [class*="button"]');
    if (buttons.length) {
      components.push({ type: 'button', count: buttons.length });
    }
    
    // Forms
    const forms = document.querySelectorAll('form');
    if (forms.length) {
      components.push({ type: 'form', count: forms.length });
    }
    
    return {
      url: window.location.href,
      title: document.title,
      colors: Array.from(colors).slice(0, 20), // Top 20 colors
      fonts: Array.from(fonts),
      layoutPatterns: layoutPatterns,
      components: components
    };
  };

  if (!window.__uig_message_listener_added__) {
    window.__uig_message_listener_added__ = true;
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

  if (msg.action === "extractFullPage") {
    const fullPageData = extractFullPage();
    console.log("Extracted full page data:", fullPageData);
    
    // Send to background for processing
    chrome.runtime.sendMessage({
      action: "processFullPage",
      data: fullPageData
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending to background:", chrome.runtime.lastError);
      } else {
        console.log("Background response:", response);
      }
    });
    
    sendResponse({ success: true, message: "Full page extracted and sent for processing" });
    return true;
  }
  
  if (msg.action === "extractInspiration") {
    const inspoData = extractInspiration();
    console.log("Extracted inspiration data:", inspoData);
    
    // Send to background for processing
    chrome.runtime.sendMessage({
      action: "processInspiration",
      data: inspoData
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending to background:", chrome.runtime.lastError);
      } else {
        console.log("Background response:", response);
      }
    });
    
    sendResponse({ success: true, message: "Inspiration data extracted and sent for processing" });
    return true;
  }
    });
  }

}
