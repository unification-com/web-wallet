/* eslint-disable */
chrome.action.onClicked.addListener(function(tab) {
  chrome.tabs.create(
    {
      url: chrome.runtime.getURL("standalone.html"),
    },
    function(tab) {},
  );
});
