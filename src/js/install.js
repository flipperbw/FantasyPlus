/* global chrome */
$(function () {
    jQuery("#set-settings").click(function(event) {
		window.open(chrome.extension.getURL("settings.html"), "_blank");
	});
});