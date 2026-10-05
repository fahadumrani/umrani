// sessionStorage key used to remember that the user closed the display ad.
// sessionStorage is cleared when the browser session ends, so the ad may
// appear again in a future session.
const CLOSED_KEY = "umrani-adsterra-closed";

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
    // Let the lock screen return if this display ad was opened from it.
    document.dispatchEvent(new CustomEvent("umrani:display-ad-closed"));
    try {
      // Remember the close action so page navigation/refresh in the same
      // browser session does not immediately show the shell again.
      sessionStorage.setItem(CLOSED_KEY, "1");
    } catch {
      // Storage may be disabled; the ad is still hidden for this page.
    }
  });

  // Restore the user's close choice when this page is loaded again during
  // the same browser session.
  try {
    if (sessionStorage.getItem(CLOSED_KEY) === "1") {
      shell.hidden = true;
    }
  } catch {
    // Ignore storage restrictions.
  }
}