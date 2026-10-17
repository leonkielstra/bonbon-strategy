const timestamp = new Date().getTime();
const scriptUrl = `/local/bonbon-strategy.js?hacstag=${timestamp}`;

import(scriptUrl)
  .then(() => {
    console.log(
      `Bonbon Strategy script loaded at: ${new Date().toLocaleTimeString()} (hacstag=${timestamp})`,
    );
  })
  .catch((err) => {
    console.error('Failed to load the Bonbon Strategy script:', err);
  });
