/* global chrome, ga */

chrome.runtime.onInstalled.addListener(function(details) {
	if (details.reason === 'install') {
        ga('send', 'event', 'Install');
		chrome.tabs.create({url: 'install.html', active: true}, function(tab) {});
	} else if (details.reason === 'update') {
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

/*
// maytbe hide for yahoo?
chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
    chrome.pageAction.hide(tabId);
});
*/

jQuery.noConflict();

function cleanHTML(data) {
    let dirty = domParse.parseFromString(data, 'text/html');
    let tagList = dirty.querySelectorAll('head, img, svg, link, style');
    tagList.forEach(function(tag) {
        tag.remove();
    });
    return dirty.documentElement.innerHTML;
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    var query = request.query;
    var settings = request.data;

    var req = request.request;
    var val = request.value;

    if (req === 'valid_site') {
        ga('send', 'pageview', sender.url);
        chrome.pageAction.show(sender.tab.id);
    }
    else if (req === 'fetch_fail') {
        ga('send', 'event', 'Fetch fail', val);
    }

    else if (query === "pos") {
        var url = settings.url;
        //var pos = settings.custom_data.pos;
        var cust_source_site = settings.custom_data.source_site;

        // jQuery.ajax(
        //     settings
        // ).done(function(data) {
        //     var cb = this.custom_data.cb;
        //     var cust_position = this.custom_data.pos;
        //
        //     data = cleanHTML(data);
        //     cb(cust_position, data.trim());
        // }).fail(function() {
        //     var cb = this.custom_data.cb;
        //     var cust_position = this.custom_data.pos;
        //     var cust_source_site = this.custom_data.source_site;
        //
        //     idp_fetch_fail = true;
        //     chrome.runtime.sendMessage({ request: 'fetch_fail', value: cust_source_site });
        //     cb(cust_position, 'error');
        // });

        jQuery.ajax(
            settings
        ).done(function(data) {
            sendResponse(data);
            return true;
        }).fail(function() {
            chrome.runtime.sendMessage({ request: 'fetch_fail', value: cust_source_site });
            sendResponse('error');
            return false;
        });

        // fetch(url, {mode: 'cors'})
        //     .then(response => {
        //         debugger;
        //         response.text();
        //     })
        //     .then(text => {
        //         debugger;
        //         text = cleanHTML(text).trim();
        //         debugger;
        //         sendResponse(text);
        //     })
        //     .catch(error => {
        //         ga('send', 'event', 'Fetch fail', cust_source_site);
        //         sendResponse(error);
        //     });

        return true;
    }

    else if (query === 'depth') {
        jQuery.ajax(
            settings
        ).done(function(data) {
            sendResponse(data);
            //sendResponse({data: data});
            //return true;
        }).fail(function() {
            chrome.runtime.sendMessage({ request: 'fetch_fail', value: settings.url });
            sendResponse('error');
            //return false;
        });

        return true;
    }
});
