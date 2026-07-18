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

  // Extract raw design-token data (colors, typography, spacing, radius, shadows, components)
  // for building a DESIGN.md file per the google-labs-code/design.md spec.
  const extractDesignSystemData = () => {
    const colorCounts = new Map();
    const fontFamilies = new Set();
    const fontSizes = new Set();
    const fontWeights = new Set();
    const radii = new Set();
    const shadows = new Set();
    const spacingValues = new Set();

    const trackColor = (value) => {
      if (!value || value === 'rgba(0, 0, 0, 0)' || value === 'transparent') return;
      colorCounts.set(value, (colorCounts.get(value) || 0) + 1);
    };

    const elements = document.querySelectorAll('*');
    const sampleSize = Math.min(elements.length, 400);

    for (let i = 0; i < sampleSize; i++) {
      const element = elements[i];
      const styles = window.getComputedStyle(element);

      trackColor(styles.backgroundColor);
      trackColor(styles.color);
      if (styles.borderTopWidth !== '0px') trackColor(styles.borderTopColor);

      if (styles.fontFamily) fontFamilies.add(styles.fontFamily);
      if (styles.fontSize) fontSizes.add(styles.fontSize);
      if (styles.fontWeight) fontWeights.add(styles.fontWeight);

      if (styles.borderRadius && styles.borderRadius !== '0px') radii.add(styles.borderRadius);
      if (styles.boxShadow && styles.boxShadow !== 'none') shadows.add(styles.boxShadow);

      ['paddingTop', 'paddingRight', 'marginTop', 'marginRight'].forEach((prop) => {
        const val = styles[prop];
        if (val && val !== '0px') spacingValues.add(val);
      });
    }

    // Rank colors by frequency so the most dominant ones surface first
    const rankedColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([color, count]) => ({ color, count }));

    // Sample specific component types for concrete token extraction
    const sampleComponent = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const styles = window.getComputedStyle(el);
      return {
        selector,
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        padding: styles.padding,
        borderRadius: styles.borderRadius,
        boxShadow: styles.boxShadow,
        border: styles.border
      };
    };

    const components = {
      button: sampleComponent('button, .btn, [class*="button"], [type="submit"]'),
      card: sampleComponent('.card, [class*="card"]'),
      input: sampleComponent('input, textarea'),
      link: sampleComponent('a'),
      heading: sampleComponent('h1'),
      body: sampleComponent('body')
    };

    return {
      url: window.location.href,
      title: document.title,
      colors: rankedColors,
      fontFamilies: Array.from(fontFamilies),
      fontSizes: Array.from(fontSizes).sort(),
      fontWeights: Array.from(fontWeights).sort(),
      radii: Array.from(radii),
      shadows: Array.from(shadows).slice(0, 10),
      spacingValues: Array.from(spacingValues).sort((a, b) => parseFloat(a) - parseFloat(b)),
      components
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

  if (msg.action === "extractDesignSystem") {
    const designData = extractDesignSystemData();
    console.log("Extracted design system data:", designData);

    // Send to background for processing
    chrome.runtime.sendMessage({
      action: "processDesignMd",
      data: designData
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending to background:", chrome.runtime.lastError);
      } else {
        console.log("Background response:", response);
      }
    });

    sendResponse({ success: true, message: "Design system data extracted and sent for processing" });
    return true;
  }
    });
  }

}
