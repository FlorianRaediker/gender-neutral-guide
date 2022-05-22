
browser.runtime.onInstalled.addListener(details => {
    browser.browserAction.setBadgeBackgroundColor({ color: "#666" });
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if ("setBadge" in message)
        browser.browserAction.setBadgeText({text: message.setBadge.toString(), tabId: sender.tab.id});
});
