chrome.runtime.onInstalled.addListener(function(details) {
	if (details.reason == 'install') {
        ga('send', 'event', 'Install');
		chrome.tabs.create({url: 'install.html', active: true}, function(tab) {});
	} else if (details.reason == 'update') {
        var thisVersion = chrome.runtime.getManifest().version;
        var thisVersion_split = thisVersion.split('.');
        var thisVersion_1 = thisVersion_split[0];
        var thisVersion_2 = thisVersion_split[1];
        
        var prevVersion = details.previousVersion;
        var prevVersion_split = prevVersion.split('.');
        var prevVersion_1 = prevVersion_split[0];
        var prevVersion_2 = prevVersion_split[1];

        if (thisVersion_1 > prevVersion_1 || thisVersion_2 > prevVersion_2) {
            ga('send', 'event', 'Update', 'from: ' + prevVersion + ' to: ' + thisVersion);
            chrome.tabs.create({url: 'settings.html', active: true}, function(tab) {});
        }
	}
});

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    var req = msg.request;
    var val = msg.value;
    
    if (req == 'valid_site') {
        ga('send', 'pageview', sender.url);
        chrome.pageAction.show(sender.tab.id);
    }
});

/*
// maytbe hide for yahoo?
chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
    chrome.pageAction.hide(tabId);
});
*/
