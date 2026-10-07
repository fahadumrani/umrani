export function initAdsterraCloseButton() {
  // These IDs belong to the display-ad shell and its visible × button
  // in index.html. If either element is missing, there is nothing to set up.
  const shell = document.getElementById("adsterraAdShell");
  const closeButton = document.getElementById("adsterraCloseButton");
  if (!shell || !closeButton) return;
  const homeParent = shell.parentNode;
  const homeNextSibling = shell.nextSibling;

  // CLOSE OPTION:
  // A real user click on × hides only the surrounding display-ad shell.
  // This handler does not simulate an ad click, open a link, or grant access.
  closeButton.addEventListener("click", () => {
    shell.hidden = true;
    shell.classList.remove("inline-ad-mode", "adsterra-ad-highlight");
    // Move the reusable shell out of the message feed before future renders.
    if (homeParent && shell.parentNode !== homeParent) {
      homeParent.insertBefore(shell, homeNextSibling);
    }
    // Keep the cached creative; a later completed reply may reveal it again.
    document.dispatchEvent(new CustomEvent("umrani:display-ad-closed"));
  });
}