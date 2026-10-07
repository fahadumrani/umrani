(() => {
  // GitHub Pages cannot send CSP sandbox headers. Only execute mutable ad code
  // when this document has the iframe's opaque security origin, never top-level.
  if (window.top === window.self || window.origin !== 'null') {
    document.body.textContent = 'Advertisements only run in the isolated app frame.';
    return;
  }
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://bauval.org/21/63ea484e1a293480518c8d527b5e81e3';
  document.body.appendChild(script);
})();
