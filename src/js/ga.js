/* global chrome, ga */

(function (i, s, o, g, r, a, m) {
	i['GoogleAnalyticsObject'] = r;
	i[r] = i[r] || function () {
		(i[r].q = i[r].q || []).push(arguments);
	};
	i[r].l = 1 * new Date();
	a = s.createElement(o);
	m = s.getElementsByTagName(o)[0];
	a.async = 1;
	a.src = g;
	m.parentNode.insertBefore(a, m);
})(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');

var extensionId = chrome.i18n.getMessage("@@extension_id");
if (extensionId === 'gojndgicjncbiobejfpjpcahadininga') {
	ga('create', 'UA-84810100-1', 'auto');
}

ga('require', 'displayfeatures');
ga('set', 'checkProtocolTask', null);
ga('set', 'page', document.location.pathname);
ga('send', 'pageview');