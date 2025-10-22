let iframeVisible = false;
let container = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggle") {
    if (iframeVisible) {
      container.remove();
      container = null;
    } else {
      container = document.createElement("div");
      container.id = "gemini-pdf-container";
      container.style.position = "fixed";
      container.style.top = "0";
      container.style.left = "0";
      container.style.width = "100%";
      container.style.height = "100%";
      container.style.zIndex = "9999";
      container.style.display = "flex";

      const pdfFrame = document.createElement("iframe");
      pdfFrame.style.width = "67%";
      pdfFrame.style.height = "100%";
      pdfFrame.style.border = "none";
      pdfFrame.src = request.pdfUrl;

      const geminiFrame = document.createElement("iframe");
      geminiFrame.style.width = "33%";
      geminiFrame.style.height = "100%";
      geminiFrame.style.border = "none";
      geminiFrame.src = "https://gemini.google.com";

      container.appendChild(pdfFrame);
      container.appendChild(geminiFrame);
      document.body.appendChild(container);
    }
    iframeVisible = !iframeVisible;
  }
});
