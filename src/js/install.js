/* global chrome */
$(function () {
    jQuery("#set-settings").on('click', function(event) {
		window.open(chrome.extension.getURL("settings.html"), "_blank");
	});
});