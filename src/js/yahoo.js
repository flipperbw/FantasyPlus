var yahooIdsDone = jQuery.Deferred();
var updated_translation = 0;

var is_FA_current = false;

onMatchupPreviewPage = document.URL.match(/f1\/\d+\/matchup/);
onClubhousePage = document.URL.match(/f1\/\d+\/\d+/);
onFreeAgencyPage = document.URL.match(/f1\/\d+\/players/);
//var onLeaguePage = document.URL.match(/f1\/\d+$/);

//TODO: add /addPlayer, viewwaiver, etc.?
//TODO: also enable ranks for /players various searches
hasProjTotals = onMatchupPreviewPage || onClubhousePage;
hasPlayerTable = onClubhousePage || onFreeAgencyPage;
hasProjectionTable = onMatchupPreviewPage || onClubhousePage || onFreeAgencyPage;

base_table_selector = '#team-roster';
player_table_selector = 'table[id^=statTable]';
player_table_body_selector = 'tbody';
player_table_header_selector = 'thead tr';
player_table_row_selector = 'tr:not(.empty-bench, empty-position)';
player_name_selector = 'td.player';
page_menu_selector = 'header div#full_stat_nav';
pts_total_selector = 'span.proj-pts-week';

if (onMatchupPreviewPage) {
    base_table_selector = '#yspmaincontent';
    page_menu_selector = 'header span';
    pts_total_selector = 'section#matchup-header table tr:nth(1) td';
}
else if (onFreeAgencyPage) {
    base_table_selector = '#players-table-wrapper';
    player_table_selector = 'table';
    page_menu_selector = '';
    pts_total_selector = '';
}

league_id = document.URL.match(/football.fantasysports.yahoo.com\/f1\/(\d+)/)[1];
league_settings_url = '//football.fantasysports.yahoo.com/f1/' + league_id + '/settings';

storageLeagueKey = 'fp_yahoo_league_data_' + league_id;
storageLeagueUpdateKey = 'fp_yahoo_last_updated_league_' + league_id;
storagePlayerKey = 'fp_yahoo_player_data_' + league_id;
storageUpdateKey = 'fp_yahoo_last_updated_' + league_id;
storageUpdateTypeKey = 'fp_yahoo_last_updated_type_' + league_id;
storageTranslationKey = 'fp_yahoo_translation';
storageTranslationUpdateKey = 'fp_yahoo_translation_updated';

storageKeys.push(storageLeagueKey, storageLeagueUpdateKey, storagePlayerKey, storageUpdateKey, storageUpdateTypeKey, storageTranslationKey, storageTranslationUpdateKey);

show_avg = false; //TODO remove
show_med = false; //TODO remove
show_current = false;
show_spark = false; //TODO remove
show_ros = false; //TODO remove
show_depth = false; //TODO remove

function fixPage() {
    if (remove_ads) {
        jQuery('.df-ad').remove();
        jQuery('#fantasyhero').remove();
        jQuery('#gamepromo').remove();
        jQuery('#survival-oneclick-promo').remove();
        jQuery('#fantasytrophypromo, #fantasyshoppromo').remove();
        jQuery('.Ad').parent().remove();
    }
}

function setSelectors() {
    base_table = jQuery(base_table_selector);
    if (page_menu_selector) {
        page_menu = base_table.find(page_menu_selector);
    }
    if (pts_total_selector) {
        pts_total = base_table.find(pts_total_selector);
    }

    playerTable = base_table.find(player_table_selector);

    player_table_body = playerTable.find(player_table_body_selector);
    player_table_header = playerTable.find(player_table_header_selector);
    player_table_rows = player_table_body.find(player_table_row_selector);

    show_proj = typeof user_settings.columns.proj !== 'undefined' ? user_settings.columns.proj : true;
    show_rank = typeof user_settings.columns.rank !== 'undefined' ? user_settings.columns.rank : true;

    if (onMatchupPreviewPage) {
        player_table_header_proj_selector = 'th:contains(Proj)';
    }
    else if (onFreeAgencyPage) {
        //todo: add gdd and ranks here
        is_FA_current = false;
        var fa_url = window.location.search;
        let url_dict = getParams(fa_url);
        var fa_page = url_dict.hasOwnProperty('stat1') ? url_dict['stat1'][0] : '';
        if (/^S_P/.test(fa_page)) {
            player_table_header_proj_selector = 'th:contains(Fan Pts)';
            if (/^S_PW_/.test(fa_page)) {
                var statweek = parseInt(fa_page.split('_').reverse()[0]);
                if (!isNaN(statweek) && (statweek === current_week)) {
                    is_FA_current = true;
                }
            }
        }
        else {
            player_table_header_proj_selector = 'th:contains(Nothing to see here)';
            show_proj = false;
            show_rank = false;
        }
    }
    else {
        player_table_header_proj_selector = 'th:contains(Proj Pts)';
        var selected_nav = page_menu.find('div.navlist:first li.Selected:first a').attr('id');
        if (selected_nav === 'P' || selected_nav === 'GDD') {
            var subid = 'subnav_' + selected_nav;
            var selected_subnav = page_menu.find('div#statsubnav ul#' + subid + ' li.Selected:first a').attr('href');
            var subnav_dict = getParams(selected_subnav);
            var subnav_href = subnav_dict.hasOwnProperty('stat2') ? subnav_dict['stat2'][0] : '';
            if (selected_nav === 'P' && subnav_href === 'PW') {
                player_table_header_proj_selector = 'th:contains(Fan Pts)';
            }
            else if (selected_nav === 'GDD' && subnav_href === 'D') {
                player_table_header_proj_selector = 'th:contains(Rank)';
            }
        }
        else if (selected_nav === 'K') {
            show_proj = false;
            player_table_header_proj_selector = 'th:contains(This Week)';
        }
    }

    proj_head = player_table_header.find(player_table_header_proj_selector);

    if (onMatchupPreviewPage) {
        show_rank = false;
        show_ros = false;
        show_depth = false;
        show_spark = false;
        show_avg = false;
        show_med = false;
        show_current = false;
    }

    var proj_first = proj_head.first();
    header_index = proj_first.index();
    proj_first.prevAll("th, td").each(function() {
        header_index += this.colSpan - 1;
    });
}

// Translation data
override(assignDataFromStorage, '_resolve', applyBefore(function() {
    if (onMatchupPreviewPage || onFreeAgencyPage) {
        storage_translation_data = r[storageTranslationKey];
        if (!(isObj(storage_translation_data))) {
            dlog.log('Could not find yahoo ID data');
            storage_translation_data = {};
            updated_translation = 0;
            getYahooIds();
        }
        else {
            updated_translation = r[storageTranslationUpdateKey];
            if (isDataCurrent('translation')) {
                dlog.log('Using cache for yahoo ID data');
                dlog.log('yahoo IDs done');
                yahooIdsDone.resolve();
            }
            else {
                dlog.log('Yahoo ID data too old, Updated time: ' + updated_translation + ', Current Time: ' + current_time);
                getYahooIds();
            }
        }
    }
    else {
        dlog.log('yahoo IDs done');
        yahooIdsDone.resolve();
    }
}));
