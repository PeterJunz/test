// Opens the analyzer in a tab. When clicked on an AliExpress product page, the product id
// is passed along so the app starts analysing it right away. `activeTab` grants access to
// the clicked tab's URL only at the moment of the click.
const PRODUCT = /aliexpress\.[a-z.]+\/(?:item|i)\/(?:[^/]*?)(\d{6,20})\.html/i;

chrome.action.onClicked.addListener((tab) => {
  const match = tab && tab.url ? tab.url.match(PRODUCT) : null;
  const url = chrome.runtime.getURL(match ? `index.html?product=${match[1]}#/overview` : 'index.html');
  chrome.tabs.create({ url });
});
