export function initAdsterraCloseButton() {
  // These IDs belong to the display-ad shell and its visible × button
  // in index.html. If either element is missing, there is nothing to set up.
  const shell = document.getElementById("adsterraAdShell");
  const closeButton = document.getElementById("adsterraCloseButton");
  if (!shell || !closeButton) return;

  // CLOSE OPTION:
  // A real user click on × hides only the surrounding display-ad shell.
  // This handler does not simulate an ad click, open a link, or grant access.
  closeButton.addEventListener("click", () => {
    shell.hidden = true;
    shell.classList.remove("ad-break-mode", "adsterra-ad-highlight");
    // Finish this ad break and allow the next two-message cycle to begin.
    document.dispatchEvent(new CustomEvent("umrani:display-ad-closed"));
  });
}