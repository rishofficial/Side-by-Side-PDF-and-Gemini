// Helper function for delays (check if already declared)
if (typeof sleep === 'undefined') {
  var sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to find an element with retries and observer
async function findElement(selector, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    // Check immediately, in case it's already there
    const element = document.querySelector(selector);
    if (element) {
      console.log(`✓ Found element immediately: ${selector}`);
      resolve(element);
      return;
    }

    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element '${selector}' not found after ${timeoutMs}ms`));
    }, timeoutMs);

    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        clearTimeout(timeout);
        obs.disconnect();
        console.log(`✓ Found element via MutationObserver: ${selector}`);
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

// Function to automate button clicks, paste, and type
async function autoClickAndPaste(imageData) {
  console.log("🚀 Starting smart automation...");
  console.log("Is iframe:", window !== window.top);
  console.log("Image data received:", imageData ? "YES (length: " + imageData.length + ")" : "NO");

  try {
    // --- 1. Check if Guided Learning is already active ---
    const deselectButton = document.querySelector('button[aria-label="Deselect Guided Learning"]');
    
    if (deselectButton) {
      console.log("Guided Learning is already active, skipping click.");
    } else {
      console.log("Guided Learning not active, running click sequence...");
      // --- 1a. Click the 'Tools' button ---
      const toolsButton = document.querySelector('button[aria-label="Tools"]');
      if (!toolsButton) {
        console.log('Tools button not found in this frame, skipping...');
        return false; // Return false to indicate failure
      }
      console.log("✓ Clicking Tools button...");
      toolsButton.click();

      // --- 1b. Wait for the 'Guided Learning' button and click it ---
      console.log("Waiting for 'Guided Learning' button to appear...");
      const guidedLearningSelector = 'button[jslog="272446;track:generic_click"]';
      const guidedLearningButton = await findElement(guidedLearningSelector);
      
      console.log("✓ Clicking Guided Learning button...");
      guidedLearningButton.click();
    }

    // --- 3. Find textbox ---
    await sleep(200);
    console.log("Waiting for textbox to be ready...");
    const textboxSelector = 'div.ql-editor[contenteditable="true"]';
    const textbox = await findElement(textboxSelector);
    textbox.focus();

    // --- 4. Insert Image (if not already present) ---
    const imagePreview = document.querySelector('div.text-input-field.with-file-preview');
    if (imagePreview) {
      console.log("Image already present, skipping insertion.");
    } else if (imageData) {
      console.log("✓ Pasting image via ClipboardEvent...");
      
      // Convert data URL to Blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      // Create a File object from the blob
      const file = new File([blob], "screenshot.png", { type: "image/png" });
      
      // Create DataTransfer with the file
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      // Create and dispatch paste event
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
      });
      
      textbox.dispatchEvent(pasteEvent);
      
      console.log("✓ Paste event dispatched");
      await sleep(2000); // Wait for Gemini to process the image
    } else {
      console.warn("No image data received, skipping paste.");
    }

    // --- 5. Type Text (if not already present) ---
    if (textbox.textContent.includes("explain all in one go")) {
      console.log("Prompt text already present, skipping type.");
    } else {
      console.log("Typing text after paste...");
      
      // Append the prompt text in a new paragraph *after* the image
      const p = document.createElement('p');
      p.textContent = 'explain all in one go.';
      textbox.appendChild(p);
      
      // Move cursor to the end
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(p, p.childNodes.length > 0 ? 1 : 0); // Handle text node
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      
      // Trigger events to make Gemini recognize the new content
      textbox.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      textbox.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    }

    console.log("🎉 Button automation completed successfully!");
    return true;

  } catch (error) {
    console.error("Button automation error:", error.message);
    return false;
  }
}

// --- Listeners ---
if (!window.geminiContentScriptListener) {
  console.log("Adding Gemini content script listener.", window.location.href);

  window.geminiContentScriptListener = (request, sender, sendResponse) => {
    console.log("Message received in content script:", request);
    console.log("Request action:", request.action);
    console.log("Request has imageData:", !!request.imageData);

    if (request.action === 'auto_click_buttons_and_paste') {
      console.log("Executing auto_click_buttons_and_paste action");
      console.log("Image data type:", typeof request.imageData);
      // Pass the image data to the function
      autoClickAndPaste(request.imageData).then((success) => {
        if (success) {
          console.log("autoClickAndPaste completed");
          sendResponse({ success: true });
        } else {
          console.log("autoClickAndPaste failed or was skipped in this frame.");
          sendResponse({ success: false, error: "Automation failed in this frame" });
        }
      }).catch(error => {
        console.error("autoClickAndPaste failed:", error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep message port open for async response
    }
    return false;
  };

  chrome.runtime.onMessage.addListener(window.geminiContentScriptListener);

} else {
  console.log("Gemini content script listener ALREADY PRESENT.", window.location.href);
}