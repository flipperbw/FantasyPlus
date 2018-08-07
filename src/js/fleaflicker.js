var fetchFleaflickerIds = jQuery.Deferred();
var total_player_ids = 0;
var is_current_week = true;

onMatchupPreviewPage = document.URL.match(/nfl\/leagues\/(\d+)\/scores\/(\d+)/);
onClubhousePage = document.URL.match(/nfl\/leagues\/(\d+)\/teams\/(\d+)(\?|$)/);
onFreeAgencyPage = document.URL.match(/nfl\/leagues\/(\d+)\/players($|[^/])/);
onGeneralProjPage = document.URL.match(/nfl\/leagues\/(\d+)\/teams\/(\d+)\/(watched)/); //add more

hasProjTotals = onMatchupPreviewPage || onClubhousePage;
hasPlayerTable = onFreeAgencyPage || onMatchupPreviewPage;
hasProjectionTable = onMatchupPreviewPage || onClubhousePage || onFreeAgencyPage || onGeneralProjPage;

base_table_selector = '#body-center-main';
player_table_selector = 'table';
player_table_body_selector = 'tbody';
player_table_header_selector = 'thead tr';
player_table_row_selector = 'tr:not(:has(td.vertical-spacer))';
player_name_selector = 'div.player';

league_id = document.URL.match(/nfl\/leagues\/(\d+)/)[1];
league_settings_url = '//www.fleaflicker.com/nfl/leagues/' + league_id + '/scoring';

storageLeagueKey = 'fp_fleaflicker_league_data_' + league_id;
storageLeagueUpdateKey = 'fp_fleaflicker_last_updated_league_' + league_id;
storagePlayerKey = 'fp_fleaflicker_player_data_' + league_id;
storageUpdateKey = 'fp_fleaflicker_last_updated_' + league_id;
storageUpdateTypeKey = 'fp_fleaflicker_last_updated_type_' + league_id;
storageTranslationKey = 'fp_fleaflicker_translation';

storageKeys.push(storageLeagueKey, storageLeagueUpdateKey, storagePlayerKey, storageUpdateKey, storageUpdateTypeKey, storageTranslationKey);

show_avg = false;
show_med = false;
show_current = false;

function fixPage() {
    if (remove_ads) {
        jQuery('a[href^="/nfl/upgrade"]').remove();
        jQuery('i.icon-edge-E').remove();
        jQuery('.alert-banner-edge').remove();
    }
    if (fix_css) {
        if (onFreeAgencyPage || onGeneralProjPage) {
            var $a_tags = jQuery('a');
            var trade_btns = $a_tags.filter(function() { return jQuery(this).text() === 'Trade'; });
            trade_btns.css({
                'background-image': 'linear-gradient(to bottom,#a070ec 0%,#6c4186 100%)',
                'border-color': '#51427d'
            });
            trade_btns.hover(function() {
                jQuery(this).css("background-color", "rgb(108, 65, 134)");
            });

            var claim_btns = $a_tags.filter(function() { return jQuery(this).text() === 'Claim'; });
            claim_btns.css({
                'background-image': 'linear-gradient(to bottom,#fbbc4a 0%,#d68306 100%)',
                'border-color': '#9c6315'
            });
            claim_btns.hover(function() {
                jQuery(this).css("background-color", "#d68306");
            });
        }
    }
}

function setSelectors() {
    base_table = jQuery(base_table_selector);

    playerTable = base_table.find(player_table_selector);

    player_table_body = playerTable.find(player_table_body_selector);
    player_table_header = playerTable.find(player_table_header_selector);
    player_table_rows = player_table_body.find(player_table_row_selector);

    show_proj = typeof user_settings.columns.proj !== 'undefined' ? user_settings.columns.proj : true;
    show_rank = typeof user_settings.columns.rank !== 'undefined' ? user_settings.columns.rank : true;
    show_ros = typeof user_settings.columns.ros !== 'undefined' ? user_settings.columns.ros : true;
    show_spark = typeof user_settings.columns.spark !== 'undefined' ? user_settings.columns.spark : true;

    player_table_header_proj_selector = 'Proj';
    var this_url = window.location.search;
    let url_dict = getParams(this_url);
    var uri_name = 'statRange';
    if (onClubhousePage) {
        uri_name = 'week';
    }
    var week_no = url_dict.hasOwnProperty(uri_name) ? url_dict[uri_name][0] : '';
    if (week_no && week_no !== current_week) {
        is_current_week = false;
    }
    var season_no = url_dict.hasOwnProperty('season') ? url_dict['season'][0] : '';
    if (season_no && season_no !== current_season) {
        is_current_week = false;
    }

    var stat_no = url_dict.hasOwnProperty('statType') ? url_dict['statType'][0] : '';
    var sort_no = url_dict.hasOwnProperty('sortMode') ? url_dict['sortMode'][0] : '';
    if (onFreeAgencyPage) {
        if (stat_no && stat_no === '7') {
            player_table_header_proj_selector = 'FPts';
            show_spark = false;
        }
        else if (sort_no && sort_no !== '0') {
            player_table_header_proj_selector = 'FPts';
        }
    }

    if (!is_current_week) {
        hasProjectionTable = false;
    }

    proj_head = player_table_header.find('th').filter(function() {
        return jQuery(this).text() === player_table_header_proj_selector;
    });

    if (player_table_header_proj_selector === 'FPts') {
        if (stat_no && stat_no === '7') {
            proj_head = proj_head.last();
        }
        else {
            proj_head = proj_head.first();
        }
    }

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

override(assignDataFromStorage, '_resolve', applyBefore(function() {
    storage_translation_data = this.r[storageTranslationKey];
    if (!(isObj(storage_translation_data))) {
        storage_translation_data = {};
    }
}));