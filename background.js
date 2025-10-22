// Function to convert a blob to a data URL
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Listen for messages from copy-helper
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'copy-complete') {
    console.log("Copy complete. Focusing window and reading clipboard.");
    
    // Switch back to the original tab
    chrome.tabs.update(message.originalTabId, { active: true }, (tab) => {
      // Explicitly focus the window *after* the tab is active
      chrome.windows.update(tab.windowId, { focused: true }, async () => {
        // Close the helper tab
        if (sender.tab && sender.tab.id) {
          chrome.tabs.remove(sender.tab.id);
        }
        
        // Wait for focus to settle
        await new Promise(resolve => setTimeout(resolve, 300)); 
        
        // Get the screenshot data URL from storage (we saved it earlier)
        const { pendingScreenshot } = await chrome.storage.local.get('pendingScreenshot');
        
        if (!pendingScreenshot) {
          console.error("No pending screenshot found in storage");
          return;
        }
        
        console.log("Retrieved screenshot from storage, triggering automation");
        
        // Clean up storage
        chrome.storage.local.remove('pendingScreenshot');
        
        // Trigger the Gemini automation with the screenshot data
        triggerGeminiAutomation(message.originalTabId, pendingScreenshot);
      });
    });
    return true; // Indicate async response

  } else if (message.type === 'copy-failed') {
    console.error("Failed to copy screenshot:", message.error);
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id);
    }
  }
  // The 'execute-paste-in-main-world' listener is no longer needed
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-iframes") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: toggleIframes
        }).catch(err => {
          console.error("Script injection failed:", err);
          alert("Extension error: " + err.message);
        });
      }
    });
  } else if (command === "auto-click-buttons") {
    // This command now starts the screenshot-then-automate sequence
    console.log("Alt+Shift+G: Starting screenshot-then-automate sequence...");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error("No active tab found.");
      }

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      
      console.log("Using helper tab to copy screenshot.");
      await chrome.storage.local.set({ 
        pendingScreenshot: dataUrl,
        originalTabId: tab.id
      });

      await chrome.tabs.create({
        url: chrome.runtime.getURL('copy-helper.html'),
        active: true
      });
      // Now we wait for the 'copy-complete' message
      
    } catch (error) {
      console.error("An error occurred during the screenshot process:", error);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        title: 'Screenshot Failed',
        message: error.message || 'An unknown error occurred.'
      });
    }
  }
});

// This function now INJECTS the script, then MESSAGES it
function triggerGeminiAutomation(tabId, imageDataUrl) {
  console.log("Triggering Gemini automation on tab:", tabId);
  
  chrome.webNavigation.getAllFrames({ tabId: tabId }, (frames) => {
    if (!frames) {
      console.error("Could not get frames for tab");
      return;
    }

    const geminiFrames = frames.filter(frame => frame.url.startsWith("https://gemini.google.com"));

    if (geminiFrames.length > 0) {
      geminiFrames.forEach(frame => {
        // Step 1: Inject the script into the frame
        chrome.scripting.executeScript({
          target: { tabId: tabId, frameIds: [frame.frameId] },
          files: ['gemini_content.js']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error(`Injection failed for frame ${frame.frameId}:`, chrome.runtime.lastError.message);
            return;
          }
          // Step 2: Send the message (with the image data) to the script
          console.log(`Script injected, sending 'run' command to frame ${frame.frameId}`);
          chrome.tabs.sendMessage(tabId, { 
            action: 'auto_click_buttons_and_paste',
            imageData: imageDataUrl // <-- Pass the image data
          }, { frameId: frame.frameId });
        });
      });
    } else {
      console.log("No Gemini iframe found in the active tab.");
    }
  });
}

function toggleIframes() {
  try {
    console.log("Toggle iframes function called");
    const containerId = "gemini-pdf-container";
    let container = document.getElementById(containerId);

    if (container) {
      console.log("Removing existing container");
      container.remove();
    } else {
      console.log("Creating new container");
      container = document.createElement("div");
      container.id = containerId;
      container.style.position = "fixed";
      container.style.top = "0";
      container.style.left = "0";
      container.style.width = "100%";
      container.style.height = "100%";
      container.style.zIndex = "9999";
      container.style.display = "flex";
      container.style.backgroundColor = "white";

      const geminiFrame = document.createElement("iframe");
      geminiFrame.style.width = "33%";
      geminiFrame.style.height = "100%";
      geminiFrame.style.border = "none";
      geminiFrame.src = "https://gemini.google.com";

      const rightPanel = document.createElement("div");
      rightPanel.style.width = "67%";
      rightPanel.style.height = "100%";
      rightPanel.style.position = "relative";
      rightPanel.style.backgroundColor = "#f5f5f5";

      const inputContainer = document.createElement("div");
      inputContainer.style.position = "absolute";
      inputContainer.style.top = "0";
      inputContainer.style.left = "0";
      inputContainer.style.width = "100%";
      inputContainer.style.height = "100%";
      inputContainer.style.display = "flex";
      inputContainer.style.flexDirection = "column";
      inputContainer.style.alignItems = "center";
      inputContainer.style.justifyContent = "center";
      inputContainer.style.backgroundColor = "#f5f5f5";
      inputContainer.style.padding = "20px";
      inputContainer.style.boxSizing = "border-box";
      inputContainer.style.zIndex = "1";

      const label = document.createElement("label");
      label.textContent = "Select your local PDF file:";
      label.style.fontSize = "18px";
      label.style.marginBottom = "15px";
      label.style.fontFamily = "Arial, sans-serif";
      label.style.color = "#333";
      label.style.fontWeight = "bold";

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "application/pdf";
      fileInput.style.marginBottom = "15px";
      fileInput.style.fontSize = "14px";
      fileInput.style.padding = "10px";
      fileInput.style.border = "2px solid #ccc";
      fileInput.style.borderRadius = "4px";
      fileInput.style.backgroundColor = "white";
      fileInput.style.cursor = "pointer";

      const pdfFrame = document.createElement("iframe");
      pdfFrame.style.position = "absolute";
      pdfFrame.style.top = "0";
      pdfFrame.style.left = "0";
      pdfFrame.style.width = "100%";
      pdfFrame.style.height = "100%";
      pdfFrame.style.border = "none";
      pdfFrame.style.display = "none";
      pdfFrame.style.zIndex = "2";

      fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
          const fileURL = URL.createObjectURL(file);
          inputContainer.style.display = "none";
          pdfFrame.style.display = "block";
          pdfFrame.src = fileURL;
          console.log("PDF loaded successfully");
        } else if (file) {
          alert("Please select a valid PDF file");
        }
      });

      inputContainer.appendChild(label);
      inputContainer.appendChild(fileInput);

      rightPanel.appendChild(inputContainer);
      rightPanel.appendChild(pdfFrame);

      container.appendChild(geminiFrame);
      container.appendChild(rightPanel);
      document.body.appendChild(container);
      console.log("Container added to page successfully");
    }
  } catch (error) {
    console.error("Error in toggleIframes:", error);
    alert("Error creating overlay: " + error.message);
  }
}