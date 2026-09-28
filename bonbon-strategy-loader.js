const timestamp = new Date().getTime();
const scriptUrl = `/local/bonbon-strategy.js?hacstag=${timestamp}`;

import(scriptUrl)
  .then(() => {
    console.log(
      `Bonbon Strategy Script geladen am: ${new Date().toLocaleTimeString()} (hacstag=${timestamp})`,
    );
  })
  .catch((err) => {
    console.error('Fehler beim Laden von Bonbon Strategy Script:', err);
  });
