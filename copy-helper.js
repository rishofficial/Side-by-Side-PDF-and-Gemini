(async function() {
  const spinner = document.getElementById('spinner');
  const messageEl = document.getElementById('message');
  let originalTabId = null;
  
  try {
    const result = await chrome.storage.local.get(['pendingScreenshot', 'originalTabId']);
    
    if (!result.pendingScreenshot) {
      throw new Error('No screenshot data found');
    }
    
    originalTabId = result.originalTabId;

    const response = await fetch(result.pendingScreenshot);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);

    spinner.style.display = 'none';
    messageEl.textContent = '✓ Screenshot copied! Returning...';
    messageEl.className = 'message success';

    // Only remove originalTabId, keep pendingScreenshot for background to use
    await chrome.storage.local.remove('originalTabId');

    // Send a success message back to the background script
    chrome.runtime.sendMessage({
      type: 'copy-complete',
      originalTabId: originalTabId
    });

  } catch (error) {
    console.error('Failed to copy:', error);
    spinner.style.display = 'none';
    messageEl.textContent = '✗ Failed to copy: ' + error.message;
    messageEl.className = 'message error';

    // Send a failure message back
    chrome.runtime.sendMessage({
      type: 'copy-failed',
      originalTabId: originalTabId,
      error: error.message
    });
  }
})();