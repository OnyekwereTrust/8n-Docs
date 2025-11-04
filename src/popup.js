document.addEventListener("DOMContentLoaded", () => {
  const openButton = document.getElementById("open-panel");

  if (!openButton) {
    return;
  }

  openButton.addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("src/panel.html"),
    });
  });
});
