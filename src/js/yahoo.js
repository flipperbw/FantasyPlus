siteType = 'yahoo';

var url_base = '//football.fantasysports.yahoo.com';
var url_nfl = 'f1';

league_id = document.URL.match(new RegExp(`/${url_nfl}/(${num_rgx})`))[1];
league_settings_url = `${url_base}/${url_nfl}/${league_id}/settings`;

onMatchupPreviewPage = new RegExp(`/${url_nfl}/${num_rgx}/matchup`).test(document.URL);
onClubhousePage = new RegExp(`/${url_nfl}/${num_rgx}/${num_rgx}`).test(document.URL);
onFreeAgencyPage = new RegExp(`/${url_nfl}/${num_rgx}/players`).test(document.URL);
//var onLeaguePage = new RegExp(`/${url_nfl}/${league_rgx}$`).test(document.URL);

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

var player_head;
var player_table_header_player_selector = 'th.player';

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
//show_depth = false; //TODO remove
show_std = false;

var yahooIdsDone = jQuery.Deferred();
var updated_translation = 0;

var is_FA_current = false;

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
    show_depth = typeof user_settings.columns.depth !== 'undefined' ? user_settings.columns.depth : true;

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
    player_head = player_table_header.find(player_table_header_player_selector);

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


function getYahooIds() {
    storage_translation_data = {};

    // go to https://sports.yahoo.com/site/api/resource/sports.league.playerssearch;count=2;league=nfl;name=;pos=;start=?bkt=%5B%22spdmtest%22%2C%22mlb-gamechannel%22%2C%22sp-football-reg-options-expanded%22%2C%22sp-footballl-signup-primary-join%22%2C%22sp-survival-promo-ctl%22%5D&device=desktop&feature=canvassOffnet%2CnewContentAttribution%2Clivecoverage%2Ccanvass&intl=us&lang=en-US&partner=none&prid=as7g78lcqbjvm&region=US&site=sports&tz=America%2FNew_York&ver=1.0.1932&returnMeta=true'
    // copy as curl, change count
    // that | jq -r '.data.players | to_entries[] | "\(.key)\": \"\(.value.display_name)\","' | sed -e 's/nfl.p./"ID_/' | sed -e 's/^[\s \t]//'
    jQuery.getJSON(chrome.extension.getURL('data/yahoo_ids.json')
    ).done(function(yahoo_json) {
        storage_translation_data = yahoo_json;

        dlog.log('yahoo IDs done');
        yahooIdsDone.resolve();

        updated_translation = current_time;

        var new_id_data = {};
        new_id_data[storageTranslationKey] = storage_translation_data;
        new_id_data[storageTranslationUpdateKey] = updated_translation;
        chrome.storage.local.set(new_id_data);
    }).fail(function(jqxhr, textStatus, error) {
        var err = textStatus + ", " + error;
        dlog.log('Could not fetch yahoo ID data');
        dlog.log(err);
        chrome.runtime.sendMessage({ request: 'fetch_fail', value: err });
    });
}

// Translation data
override(assignDataFromStorage, '_resolve', applyBefore(function() {
    if (onMatchupPreviewPage || onFreeAgencyPage) {
        storage_translation_data = this.r[storageTranslationKey];
        if (!(isObj(storage_translation_data))) {
            dlog.log('Could not find yahoo ID data');
            storage_translation_data = {};
            updated_translation = 0;
            getYahooIds();
        }
        else {
            updated_translation = this.r[storageTranslationUpdateKey];
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

override(runGetAllData, 'run', function(original) {
    return function() {
        jQuery.when(yahooIdsDone).done(function() {
            original.apply(this, arguments);
        });
    }
});

function addColumns() {
    if (!canAddColumns()) return;

    var projection_header = jQuery(`<th class="${fp} ${fp}Projections ${fp}ProjectionsHeader" title="Consensus point projections from FantasyPros (via ${fp})"></th>`);
    var projection_cell = jQuery(`<td class="Ta-end ${fp} ${fp}Projections ${fp}ProjectionsData">${loadingDiv}</td>`);

    if (onMatchupPreviewPage) {
        if (!show_proj) return;

        let cell_width = "38px";
        projection_header.css({ width: cell_width });
        projection_header.addClass('Ta-end Va-top');
        projection_header.append('<div style="width: 40px;">Proj (FP)</div>'); //40? not 38?

        projection_cell.css({ width: cell_width });
        projection_cell.addClass('Alt F-shade Va-top');

        var newprojcell = jQuery(`<td style="width: ${cell_width};" class="Alt Ta-end F-shade Va-top ${fp} ${fp}Projections ${fp}ProjectionsTotal">-</td>`);

        playerTable.each(function() {
            var currTab = jQuery(this);

            var matchup_heads = currTab.find('thead th');
            var matchup_heads_len = matchup_heads.length;
            var matchup_proj_heads = matchup_heads.filter(function() {
                return jQuery(this).text() === 'Proj';
            });

            var first_proj_header = jQuery(matchup_proj_heads[0]);
            var second_proj_header = jQuery(matchup_proj_heads[1]);

            var first_proj_header_idx = first_proj_header.index();
            var second_proj_header_idx = second_proj_header.index();

            first_proj_header.after(projection_header.clone());
            second_proj_header.before(projection_header.clone());

            var total_cell = projection_cell;

            var currRows = currTab.find('tbody tr');
            var currRowsLen = currRows.length;
            currRows.each(function(l) {
                var currRow = jQuery(this);

                var currRowTds = currRow.find('td');
                var header_diff = matchup_heads_len - currRowTds.length;

                if ((l + 1) === currRowsLen) {
                    total_cell = newprojcell;
                }

                currRowTds.eq(first_proj_header_idx).after(total_cell.clone());
                currRowTds.eq(second_proj_header_idx - header_diff).before(total_cell.clone());
            });
        });
    }
    else {
        //this is technically inefficient since we need to check for custom cols first
        let cell_width = "40px";

        projection_header.css({ width: cell_width, 'text-align': "center" });
        projection_header.text('Proj (FP)');

        var rank_header = jQuery(`<th style="width: ${cell_width}; text-align: center;" class="${fp} ${fp}Rankings ${fp}RankingsHeader" title="Projected position rank (lower is better) for *this week* from FantasyPros (via ${fp})">Rank (FP)</th>`);
        var depth_header = jQuery(`<th style="width: 50px;" class="Ta-c Bdrend ${fp} ${fp}Depth ${fp}DepthHeader" title="Depth chart information (via ${fp})">Depth</th>`);

        projection_cell.addClass('Nowrap');

        var rank_cell = jQuery(`<td class="Nowrap Ta-end ${fp} ${fp}Rankings ${fp}RankingsData">${loadingDiv}</td>`);
        var depth_cell = jQuery(`<td class="Nowrap Ta-c Bdrend ${fp} ${fp}Depth ${fp}DepthData">${loadingDiv}</td>`);

        custom_cols = 0;
        var all_header_cells = jQuery();

        if (show_proj) {
            custom_cols++;
            all_header_cells = all_header_cells.add(projection_header);
        }
        if (show_rank) {
            custom_cols++;
            all_header_cells = all_header_cells.add(rank_header);
        }

        if (custom_cols === 0 && !show_depth) return;

        var forecast_adj = false;
        player_table_header.each(function() {
            if (jQuery(this).find('th:contains("Forecast")').length) {
                forecast_adj = true;
            }

            if (show_proj || show_rank) {
                let first_header_col = jQuery(this).find('th').filter(function () {
                    return /^\w/.test(jQuery(this).text());
                }).first();

                let fhc_curr_cols = parseInt(first_header_col.attr('colspan'));
                if (!isNaN(fhc_curr_cols) && !first_header_col.data('modified')) {
                    first_header_col.attr({'colspan': fhc_curr_cols + custom_cols, 'data-modified': true});
                }
            }

            if (show_depth) {
                let depth_header_col = jQuery(this).find('th').first();

                let dh_curr_cols = parseInt(depth_header_col.attr('colspan'));
                if (!isNaN(dh_curr_cols) && !depth_header_col.data('modified')) {
                    depth_header_col.attr({'colspan': dh_curr_cols + 1, 'data-modified': true});
                }
            }
        });

        if (custom_cols > 0) {
            proj_head.after(all_header_cells);
        }

        if (show_depth) {
            player_head.after(depth_header);
        }

        var blankCell = jQuery('<td class="Ta-end Nowrap"></td>'); //need fantasyplus class?

        var proj_cell_text = proj_head.first().text();
        player_table_rows.each(function() {
            var currRow = jQuery(this);

            let adj_header_idx = header_index;
            if (forecast_adj && currRow.parents('table').find('thead tr th:contains("Forecast")').length === 0) {
                adj_header_idx -= 1;
            }
            var currRowTds = currRow.find('td');
            var points_cell = currRowTds.eq(adj_header_idx - 1);
            var proj_cell = currRowTds.eq(adj_header_idx);

            var search_cell = proj_cell;
            var search_type = null;
            if (proj_cell_text === 'Proj Pts') {
                search_cell = points_cell;
                search_type = 'stats';
            }
            else if (proj_cell_text === 'Fan Pts') {
                search_cell = proj_cell;
                search_type = 'proj';
            }
            else if (proj_cell_text === 'Rank') {
                search_cell = points_cell;
                search_type = 'gdd';
            }
            else if (proj_cell_text === 'This Week') {
                search_cell = proj_cell;
                search_type = 'rank';
            }

            var isBye = search_cell.text() === 'Bye';
            var isBlank = search_cell.text() === '';

            if (isBye) {
                //todo fix like FF to make more auto
                var addCols = (search_type === 'stats') ? 3 : 2;
                search_cell.attr('colspan', addCols + custom_cols);
            }
            else {
                var all_cells = jQuery();

                if (show_proj) {
                    all_cells = all_cells.add(projection_cell.clone());
                }
                if (show_rank) {
                    all_cells = all_cells.add(rank_cell.clone());
                }

                if (isBlank) {
                    search_cell.attr('colspan', 1);
                    if (search_cell.next().hasClass('Bdrstart')) {
                        all_cells = all_cells.add(blankCell.clone());
                        if (search_type === 'stats') {
                            search_cell.after(blankCell.clone());
                        }
                        else if (search_type === 'rank') {
                            search_cell.after(blankCell.clone(), blankCell.clone());
                        }
                    }
                }

                proj_cell.after(all_cells);
            }

            if (show_depth) {
                var player_cell = currRow.find(player_name_selector).first();
                player_cell.after(depth_cell.clone());
            }

            if (currRow.find('td:first').hasClass('Selected')) {
                currRow.find(`td.${fp}`).addClass('Selected');
            }
        });
    }
}

override(parseLeagueSettings, 'run', applyCompose(function(ret) {
    var league_settings = ret;

    league_settings['siteType'] = 'yahoo';

    var league_table = jQuery('#settings-stat-mod-table tbody td', this.league_data);

    function getValue(setting_name) {
        var settingVals = [];
        //TODO fix this for multiple same values
        var settingText = league_table.filter(function(){ return this.childNodes[0].nodeValue === setting_name; });
        if (settingText && settingText.length > 0) {
            var pointText = settingText.next().first().text();
            var settingList = pointText.split(';');
            var bonusDict = {};

            jQuery.each(settingList, function(sindex, svalue) {
                svalue = svalue.trim();
                var settingStat;
                if (svalue.indexOf('yards per point') > -1) {
                    settingStat = 1.0 / parseFloat(svalue.split(' ')[0]);
                    settingVals.push(settingStat);
                }
                else if (svalue.indexOf('points at ') > -1) {
                    var bonusSettingList = svalue.split(' ');
                    let bonusPts = parseFloat(bonusSettingList[0]);
                    let bonusYds = parseFloat(bonusSettingList[3]);
                    bonusDict[bonusYds] = bonusPts;
                }
                else {
                    settingStat = parseFloat(svalue);
                    settingVals.push(settingStat);
                }
            });

            settingVals.push(bonusDict);
        }
        return settingVals;
    }

    var passSettings = getValue('Passing Yards');
    league_settings['pass_yds'] = passSettings[0] || 0;
    league_settings['pass_bonus'] = {};
    var passSettingsDict = passSettings[1];
    for (let k in passSettingsDict) {
        if (passSettingsDict.hasOwnProperty(k)) {
            league_settings['pass_bonus'][k] = passSettingsDict[k];
        }
    }
    league_settings['pass_tds'] = getValue('Passing Touchdowns')[0] || 0;
    league_settings['pass_ints'] = getValue('Interceptions')[0] || 0;
    league_settings['pass_cmp'] = getValue('Completions')[0] || 0;
    league_settings['pass_icmp'] =  getValue('Incomplete Passes')[0] || 0;
    league_settings['pass_att'] = getValue('Passing Attempts')[0] || 0;
    league_settings['pass_firstdown'] = getValue('Passing 1st Downs')[0] || 0;

    var rushSettings = getValue('Rushing Yards');
    league_settings['rush_yds'] = rushSettings[0] || 0;
    league_settings['rush_bonus'] = {};
    var rushSettingsDict = rushSettings[1];
    for (let k in rushSettingsDict) {
        if (rushSettingsDict.hasOwnProperty(k)) {
            league_settings['rush_bonus'][k] = rushSettingsDict[k];
        }
    }
    league_settings['rush_att'] = getValue('Rushing Attempts')[0] || 0;
    league_settings['rush_tds'] = getValue('Rushing Touchdowns')[0] || 0;
    league_settings['rush_firstdown'] = getValue('Rushing 1st Downs')[0] || 0;

    var recSettings = getValue('Receiving Yards');
    league_settings['rec_yds'] = recSettings[0] || 0;
    league_settings['rec_bonus'] = {};
    var recSettingsDict = recSettings[1];
    for (let k in recSettingsDict) {
        if (recSettingsDict.hasOwnProperty(k)) {
            league_settings['rec_bonus'][k] = recSettingsDict[k];
        }
    }
    league_settings['rec_att'] = getValue('Receptions')[0] || 0;
    league_settings['rec_tds'] = getValue('Receiving Touchdowns')[0] || 0;
    league_settings['rec_firstdown'] = getValue('Receiving 1st Downs')[0] || 0;

    //Kicking
    league_settings['xpt'] = getValue('Point After Attempt Made')[0] || 0;
    league_settings['fga'] = 0;
    league_settings['fg'] =
        (0.6 * ((getValue('Field Goals 0-19 Yards')[0] || 0) +
                (getValue('Field Goals 20-29 Yards')[0] || 0) +
                (getValue('Field Goals 30-39 Yards')[0] || 0)) / 3.0
        ) +
        (0.3 * (getValue('Field Goals 40-49 Yards')[0] || 0)) +
        (0.1 * (getValue('Field Goals 50+ Yards')[0] || 0));
    league_settings['fgm'] =
        (0.6 * ((getValue('Field Goals Missed 0-19 Yards')[0] || 0) +
                (getValue('Field Goals Missed 20-29 Yards')[0] || 0) +
                (getValue('Field Goals Missed 30-39 Yards')[0] || 0)) / 3.0
        ) +
        (0.3 * (getValue('Field Goals Missed 40-49 Yards')[0] || 0)) +
        (0.1 * (getValue('Field Goals Missed 50+ Yards')[0] || 0));

    //Misc
    league_settings['fumbles'] = getValue('Fumbles Lost')[0] || getValue('Fumbles')[0] || 0;

    //IDP
    league_settings['ff'] = getValue('Fumble Force')[0] || 0;
    league_settings['tka'] = getValue('Tackle Assist')[0] || 0;
    league_settings['tks'] = getValue('Tackle Solo')[0] || 0;
    league_settings['pd'] = getValue('Pass Defended')[0] || 0;

    //Def
    league_settings['int'] = getValue('Interception')[0] || 0;
    league_settings['deftd'] = getValue('Touchdown')[0] || getValue('Defensive Touchdown')[0] || 0;
    league_settings['fr'] = getValue('Fumble Recovery')[0] || 0;
    league_settings['sk'] = getValue('Sack')[0] || 0;
    league_settings['sf'] = getValue('Safety')[0] || 0;

    league_settings['pa'] = 0;
    league_settings['pa0'] = getValue('Points Allowed 0 points')[0] || 0;
    league_settings['pa1'] = getValue('Points Allowed 1-6 points')[0] || 0;
    league_settings['pa7'] = getValue('Points Allowed 7-13 points')[0] || 0;
    league_settings['pa14'] = getValue('Points Allowed 14-20 points')[0] || 0;
    league_settings['pa21'] = getValue('Points Allowed 21-27 points')[0] || 0;
    league_settings['pa28'] = getValue('Points Allowed 28-34 points')[0] || 0;
    league_settings['pa35'] = getValue('Points Allowed 35+ points')[0] || 0;

    league_settings['ya'] = 0;
    league_settings['ya100'] = getValue('Defensive Yards Allowed 0-99')[0] || 0;
    league_settings['ya199'] = getValue('Defensive Yards Allowed 100-199')[0] || 0;
    league_settings['ya299'] = getValue('Defensive Yards Allowed 200-299')[0] || 0;
    league_settings['ya399'] = getValue('Defensive Yards Allowed 300-399')[0] || 0;
    league_settings['ya499'] = getValue('Defensive Yards Allowed 400-499')[0] || 0;
    league_settings['ya500'] = getValue('Defensive Yards Allowed 500+')[0] || 0;

    this.league_settings = league_settings;
    dlog.log(league_settings);
    return league_settings;
}));

function setDSTname(player_name) {
    return team_abbrevs[player_name];
}

function calcBonus(bonus_type, pd) {
    var adj = 0;
    var b_list = [];

    var this_settings_dict = parseLeagueSettings.league_settings[bonus_type + '_bonus'];
    for (let k in this_settings_dict) {
        if (this_settings_dict.hasOwnProperty(k)) {
            b_list.push(parseFloat(k));
        }
    }

    b_list = b_list.sort().reverse();
    for (let b=0; b < b_list.length; b++) {
        if (parseFloat(b_list[b+1]) && parseFloat(b_list[b])) {
            adj += (this_settings_dict[b_list[b]] * (b_list[b] <= pd[bonus_type + '_yds'] && pd[bonus_type + '_yds'] < b_list[b+1]));
        }
        else {
            if (parseFloat(b_list[b])) {
                adj += (this_settings_dict[b_list[b]] * (pd[bonus_type + '_yds'] >= b_list[b]));
            }
        }
    }

    return adj;
}

function calcAdjProjections(player_data) {
    return calcBonus('pass', player_data) +
        calcBonus('rush', player_data) +
        calcBonus('rec', player_data) +

        parseLeagueSettings.league_settings['pa0'] * (player_data['def_pa'] === 0) +
        parseLeagueSettings.league_settings['pa1'] * (0 < player_data['def_pa'] && player_data['def_pa'] <= 6) +
        parseLeagueSettings.league_settings['pa7'] * (6 < player_data['def_pa'] && player_data['def_pa'] <= 13) +
        parseLeagueSettings.league_settings['pa14'] * (13 < player_data['def_pa'] && player_data['def_pa'] <= 20) +
        parseLeagueSettings.league_settings['pa21'] * (20 < player_data['def_pa'] && player_data['def_pa'] <= 27) +
        parseLeagueSettings.league_settings['pa28'] * (27 < player_data['def_pa'] && player_data['def_pa'] <= 34) +
        parseLeagueSettings.league_settings['pa35'] * (34 < player_data['def_pa']) +

        parseLeagueSettings.league_settings['ya100'] * (0 <= player_data['def_tyda'] && player_data['def_tyda'] < 100) +
        parseLeagueSettings.league_settings['ya199'] * (100 <= player_data['def_tyda'] && player_data['def_tyda'] < 200) +
        parseLeagueSettings.league_settings['ya299'] * (200 <= player_data['def_tyda'] && player_data['def_tyda'] < 300) +
        parseLeagueSettings.league_settings['ya399'] * (300 <= player_data['def_tyda'] && player_data['def_tyda'] < 400) +
        parseLeagueSettings.league_settings['ya499'] * (400 <= player_data['def_tyda'] && player_data['def_tyda'] < 500) +
        parseLeagueSettings.league_settings['ya500'] * (500 <= player_data['def_tyda']);
}

/*
var orig = RowData.prototype._getPlayerCell;
RowData.prototype._getPlayerCell = function() {
    if (onMatchupPreviewPage) {
        return this.cell.nearest('td.player');
    }
    return orig.apply(this, arguments);
};
*/

//make new applybefore func out of this
RowData.prototype._getPlayerCell = (function(orig) {
    return function() { //put args defs here
        if (onMatchupPreviewPage) {
            return this.cell.nearest('td.player');
        }
        return orig.apply(this, arguments);
    }
})(RowData.prototype._getPlayerCell);

RowData.prototype._getPlayerInfo = function() {
    var player_name_cell = this.player_cell.find('.ysf-player-name');
    // I might have to fix this more
    var pos_name_cell = player_name_cell.find('span').first().text().trim().split(' - ');

    var team_name = pos_name_cell[0].toUpperCase();
    if (team_name === 'JAX') {
        team_name = 'JAC';
    }

    var new_posses;
    var pos_name = pos_name_cell[1];
    if (pos_name.indexOf(',') > -1) {
        new_posses = pos_name.split(',');
        pos_name = [];
        new_posses.forEach(function(np) {
            pos_name.push(np.trim());
        });
    }
    else if (pos_name === "DEF") {
        pos_name = "D/ST";
    }

    var player_name = player_name_cell.find('a').text().trim();

    if (pos_name === 'D/ST') {
        player_name = team_name;
        team_name = '-';
    }

    var player_href = null;
    var player_id = null;
    if (onMatchupPreviewPage || onFreeAgencyPage) {
        player_href = this.player_cell.find('.ysf-player-name').find('a').attr('href');
        player_id = player_href.split('/').pop();
    }

    return {
        'player_name': player_name,
        'pos_name': pos_name,
        'team_name': team_name,
        'player_href': player_href,
        'player_id': player_id
    };
};

override(getProjectionData, '_calcAndPop', applyBefore(function(rowData, datatype) {
    if (onMatchupPreviewPage || onFreeAgencyPage) {
        var seenId = storage_translation_data.hasOwnProperty('ID_' + rowData.player_id);
        dlog.info('id is ' + rowData.player_id + ', seen is ' + seenId);

        var hasAllData = alldata.hasOwnProperty(rowData.player_name.toUpperCase() + '|' + rowData.pos_name + '|' + rowData.team_name);

        if (rowData.pos_name === "D/ST" || seenId || hasAllData) {
            if (seenId) {
                rowData.translation_name = storage_translation_data['ID_' + rowData.player_id];
            }
        }
        else {
            dlog.log('Could not find player in yahoo database: ' + rowData.player_href + ', ' + rowData.getPlayerName());
        }
    }
}));

override(reDefer, 'run', applyAfter(function() {
    if (onMatchupPreviewPage || onFreeAgencyPage) {
        yahooIdsDone = jQuery.Deferred();
    }
}));

isCurrentWeek = function() {
    if (onFreeAgencyPage) return is_FA_current;

    if (!page_menu || page_menu.length === 0) return true;

    var proj_week;
    if (onMatchupPreviewPage) {
        var proj_txt = page_menu.contents().filter(function() {
            return this.nodeType === 3;
        }).text();
        var proj_idx = proj_txt.indexOf(':');
        proj_week = proj_txt.substr(0, proj_idx).split(' ').reverse()[0];
    }
    else {
        proj_week = page_menu.find('#selectlist_nav span').text().replace(/\D/g, '');
    }

    return !isNaN(proj_week) && (parseInt(proj_week) === current_week);
};

addData.projTotals = function() {
    if (!show_proj) {
        dlog.log('totals done');
        totalsDone.resolve();
        return;
    }

    var matchup_total = 0;

    if (onClubhousePage) {
        var datapoints = player_table_body.find('tr:not(".bench") .FantasyPlusProjectionsData');

        if (datapoints.length > 0) {
            datapoints.each(function () {
                let value = parseFloat(jQuery(this).text());
                if (value) {
                    matchup_total += value;
                }
            });

            var roundTotal = Math.round(matchup_total * 100) / 100;
            var currTotal = parseFloat(pts_total.first().text());

            if (!isNaN(currTotal)) {
                var cellColor;
                if (currTotal < roundTotal) {
                    cellColor = 'green';
                }
                else if (currTotal > roundTotal) {
                    cellColor = 'red';
                }

                if (cellColor) {
                    cellColor = ' style="color: ' + cellColor + '"';
                }
                pts_total.append('<span title="Total projected points (via FantasyPlus)" class="FantasyPlus"' + cellColor + '> [' + roundTotal + ']</span>');
            }
        }

        dlog.log('totals done');
        totalsDone.resolve();
    }
    else if (onMatchupPreviewPage) {
        jQuery.when(yahooIdsDone).done(function () {
            var new_pts_total = pts_total.parent().clone();
            new_pts_total.addClass('FantasyPlus');
            new_pts_total.children().text('');
            new_pts_total.find('th').text('FP Proj');
            var new_pts_total_tds = new_pts_total.find('td');

            var currTab = jQuery(playerTable.first());
            var currTotals = jQuery('.FantasyPlusProjectionsTotal');
            var currHeader = currTab.find(player_table_header_selector);
            var currHs = currHeader.find('th.FantasyPlusProjectionsHeader');
            currHs.each(function (i) {
                matchup_total = 0;
                var currH = jQuery(this);
                var currIdx = currH.index();
                var currBody = currTab.find('tbody tr');
                var this_pts_total = jQuery(new_pts_total_tds[i]);

                datapoints = currBody.find('td:nth-child(' + (currIdx + 1) + ')');
                if (datapoints.length > 0) {
                    datapoints.each(function () {
                        let value = parseFloat(jQuery(this).text());
                        if (value) {
                            matchup_total += value;
                        }
                    });

                    var roundTotal = Math.round(matchup_total * 100) / 100;
                    var currTotal = parseFloat(jQuery(pts_total[i]).text());

                    if (!isNaN(currTotal)) {
                        var cellColor;
                        if (currTotal < roundTotal) {
                            cellColor = 'green';
                            this_pts_total.addClass('F-positive');
                        }
                        else if (currTotal > roundTotal) {
                            cellColor = 'red';
                            this_pts_total.addClass('F-negative');
                        }

                        if (cellColor) {
                            cellColor = ' style="color: ' + cellColor + '"';
                        }

                        var origTot = jQuery(currTotals[i]);
                        origTot.html('<div title="Total projected points (via FantasyPlus)" class="FantasyPlus"' + cellColor + '> [' + roundTotal + ']</div>');

                        this_pts_total.text(roundTotal);
                    }
                    else {
                        this_pts_total.text('-');
                    }
                }
                else {
                    this_pts_total.text('-');
                }
            });

            pts_total.parent().after(new_pts_total);

            dlog.log('totals done');
            totalsDone.resolve();
        });
    }
};

function _resetTranslation() {
    if (onMatchupPreviewPage || onFreeAgencyPage) {
        storage_translation_data = {};
        updated_translation = 0;
        getYahooIds();
    }
}

watchForChanges._getAcceptedChange = function(mutations) {
    var accepted = true;

    let m = mutations[0]; //ignoring the rest?
    let thisMutTgt = m['target'];
    if (thisMutTgt) {
        var thisMutTgtId = thisMutTgt['id'];
        var thisMutTgtClass = thisMutTgt['className'];
        if (thisMutTgtId === 'selectlist_nav' || thisMutTgtClass === 'flyout-title') {
            accepted = false;
        }
    }

    return accepted;
};

watchForChanges.target_selector = base_table_selector;
