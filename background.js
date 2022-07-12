import "./vendor/webextension-polyfill/browser-polyfill.min.js";


async function getActiveTab() {
    return (await browser.tabs.query({active: true, currentWindow: true}))[0];
}

function getDomain(tab) {
    const url = new URL(tab.url);
    if (url.protocol === "file:")
        return url.pathname;
    return url.hostname;
}

async function getExcludedDomains() {
    const objects = await browser.storage.local.get("excludedDomains");
    const excludedDomains = objects["excludedDomains"];
    if (!Array.isArray(excludedDomains)) return [];
    return excludedDomains;
}
async function setExcludedDomains(excludedDomains) {
    await browser.storage.local.set({"excludedDomains": excludedDomains});
}

async function excludeDomain(domain) {
    const excludedDomains = await getExcludedDomains();
    excludedDomains.push(domain);
    await setExcludedDomains(excludedDomains);
}
async function includeDomain(domain) {
    let excludedDomains = await getExcludedDomains();
    if (excludedDomains.includes(domain)) {
        excludedDomains = excludedDomains.filter(d => d !== domain);
        await setExcludedDomains(excludedDomains);
    }
}
async function isDomainExcluded(domain) {
    const excludedDomains = (await getExcludedDomains());
    const isExcluded = excludedDomains.includes(domain);
    return isExcluded;
}

async function getTabProperties(tabId) {
    const tabs = (await browser.storage.local.get("tabs"))["tabs"];
    if (!tabs) return {};
    return tabs[tabId] || {};
}
async function setTabProperties(tabId, properties) {
    const tabs = (await browser.storage.local.get("tabs"))["tabs"];
    if (properties == null) {
        delete tabs[tabId];
    } else {
        tabs[tabId] = properties;
    }
    await browser.storage.local.set({"tabs": tabs});
}

function setBadgeText(tabId, text) {
    browser.action.setBadgeBackgroundColor({color: "#666"});
    browser.action.setBadgeText({text, tabId});
}

browser.tabs.onRemoved.addListener(tabId => setTabProperties(tabId, null));
browser.tabs.onReplaced.addListener((_added, removed) => setTabProperties(tabId, removed));

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case "cs-count":
            setBadgeText(sender.tab.id, message.count.toString());
            getTabProperties(sender.tab.id).then(props => {
                props.counter = message.count.toString();
                setTabProperties(sender.tab.id, props);
            });
            break;
        case "cs-injected":
            isDomainExcluded(getDomain(sender.tab)).then(isExcluded => {
                if (!isExcluded) {
                    browser.tabs.sendMessage(sender.tab.id, {type: "bg-enable-cs"});
                }
            });
            break;
        case "popup-opened":
            return getActiveTab().then(async tab => {
                const domain = getDomain(tab);
                const isExcluded = (await isDomainExcluded(domain));
                return {isEnabled: !isExcluded, domain};
            });
        case "popup-enable":
            getActiveTab().then(activeTab => {
                browser.tabs.query({}).then(tabs => {
                    const activeDomain = getDomain(activeTab);
                    includeDomain(activeDomain);
                    for (let tab of tabs) {
                        if (getDomain(tab) === activeDomain) {
                            browser.tabs.sendMessage(tab.id, {type: "bg-enable-cs"});
                            getTabProperties(tab.id).then(props => {
                                if ("counter" in props) {
                                    setBadgeText(tab.id, props.counter);
                                }
                            });
                        }
                    }
                });
            });
            break;
        case "popup-disable":
            getActiveTab().then(activeTab => {
                browser.tabs.query({}).then(tabs => {
                    const activeDomain = getDomain(activeTab);
                    excludeDomain(activeDomain);
                    for (let tab of tabs) {
                        if (getDomain(tab) === activeDomain) {
                            browser.tabs.sendMessage(tab.id, {type: "bg-disable-cs"});
                            setBadgeText(tab.id, "");
                        }
                    }
                });
            });
            break;
    }
});
