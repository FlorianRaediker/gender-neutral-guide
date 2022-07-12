const toggleButton = document.getElementById("toggle-button");
const toggleLabel = document.getElementById("toggle-label");
const toggleDomain = document.getElementById("toggle-domain");

function setEnabled(enabled) {
    if (enabled) {
        toggleLabel.classList.add("btn-success");
        toggleLabel.classList.remove("btn-danger");
    } else {
        toggleLabel.classList.add("btn-danger");
        toggleLabel.classList.remove("btn-success");
    }
}

toggleButton.addEventListener("change", event => {
    if (toggleButton.checked) {
        browser.runtime.sendMessage({type: "popup-enable"});
    } else {
        browser.runtime.sendMessage({type: "popup-disable"});
    }
    setEnabled(toggleButton.checked);
});


browser.runtime.sendMessage({type: "popup-opened"}).then(tabInfo => {
    toggleButton.checked = tabInfo.isEnabled;
    setEnabled(tabInfo.isEnabled);
    toggleDomain.textContent = tabInfo.domain;
});
