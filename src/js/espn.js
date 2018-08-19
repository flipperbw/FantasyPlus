var url_base = '//games.espn.com';
var url_nfl = 'ffl';

league_id = document.URL.match(new RegExp(`leagueId=(${num_rgx})`))[1];

var url_league_sections = `${url_base}/${url_nfl}/leaguesetup/sections`;
var url_league_roster = `${url_league_sections}/roster`;

league_settings_url = `${url_league_sections}/scoring?leagueId=${league_id}`;

onMatchupPreviewPage = new RegExp(`/${url_nfl}/matchuppreview`).test(document.URL);
onClubhousePage = new RegExp(`/${url_nfl}/(clubhouse|dropplayers|rosterfix)`).test(document.URL);
onFreeAgencyPage = new RegExp(`/${url_nfl}/(freeagency|watchlist)`).test(document.URL);
onGeneralProjPage = new RegExp(`/${url_nfl}/tradereview`).test(document.URL);
var onLeaguePage = new RegExp(`/${url_nfl}/leagueoffice`).test(document.URL);
var onLeagueSettingsPage = new RegExp(`/${url_nfl}/leaguesetup/settings`).test(document.URL);

hasProjTotals = onMatchupPreviewPage || onClubhousePage;
hasPlayerTable = onClubhousePage || onFreeAgencyPage || onGeneralProjPage;
hasProjectionTable = false;

var url_freeagency = `${url_base}/${url_nfl}/freeagency`;
var url_player_pop = `${url_base}/${url_nfl}/format/playerpop/overview`;
var url_player_log = '//m.espn.com/nfl/playergamelog';

base_table_selector = '.playerTableContainerDiv';
player_table_selector = '[id^=playertable_]';
player_table_body_selector = 'tbody';
player_table_header_selector = 'tr.playerTableBgRowSubhead';
player_table_row_selector = 'tr.pncPlayerRow:not(.emptyRow)';
player_table_header_proj_selector = 'td:contains(PROJ), td:contains(ESPN)';
player_name_selector = 'td.playertablePlayerName';
ld_selector = 'div.games-fullcol';

//var player_cell_pos_selector = 'td[id^="pncSlot_"]';

function addLeagueSettings() {
    var $ld = jQuery(ld_selector);
    var $allsettings = jQuery('#settings-content', $ld);

    var default_settings = {
        'Passing': {
            'TD Pass (PTD)' : 4,
            '2pt Passing Conversion (2PC)' : 2,
            'Interceptions Thrown (INT)' : -2
        },
        'Rushing': {
            'TD Rush (RTD)' : 6,
            '2pt Rushing Conversion (2PR)' : 2
        },
        'Receiving': {
            'TD Reception (RETD)' : 6,
            '2pt Receiving Conversion (2PRE)' : 2
        },
        'Miscellaneous': {
            'Kickoff Return TD (KRTD)' : 6,
            'Punt Return TD (PRTD)' : 6,
            'Fumble Recovered for TD (FTD)' : 6,
            'Total Fumbles Lost (FUML)' : -2,
            'Interception Return TD (INTTD)' : 6,
            'Fumble Return TD (FRTD)' : 6,
            'Blocked Punt or FG return for TD (BLKKRTD)' : 6,
            '2pt Return (2PTRET)' : 2,
            '1pt Safety (1PSF)' : 1
        },
        'Kicking': {
            'Each PAT Made (PAT)' : 1,
            'Total FG Missed (FGM)' : -1,
            'FG Made (0-39 yards) (FG0)' : 3,
            'FG Made (40-49 yards) (FG40)' : 4,
            'FG Made (50+ yards) (FG50)' : 5
        },
        'Team Defense / Special Teams' : {
            'Each Sack (SK)' : 1,
            'Interception Return TD (INTTD)' : 6,
            'Fumble Return TD (FRTD)' : 6,
            'Kickoff Return TD (KRTD)' : 6,
            'Punt Return TD (PRTD)' : 6,
            'Blocked Punt or FG return for TD (BLKKRTD)' : 6,
            'Blocked Punt, PAT or FG (BLKK)' : 2,
            'Each Interception (INT)' : 2,
            'Each Fumble Recovered (FR)' : 2,
            'Each Safety (SF)' : 2,
            '0 points allowed (PA0)' : 5,
            '1-6 points allowed (PA1)' : 4,
            '7-13 points allowed (PA7)' : 3,
            '14-17 points allowed (PA14)' : 1,
            '28-34 points allowed (PA28)' : -1,
            '35-45 points allowed (PA35)' : -3,
            '46+ points allowed (PA46)' : -5,
            'Less than 100 total yards allowed (YA100)' : 5,
            '100-199 total yards allowed (YA199)' : 3,
            '200-299 total yards allowed (YA299)' : 2,
            '350-399 total yards allowed (YA399)' : -1,
            '400-449 total yards allowed (YA449)' : -3,
            '450-499 total yards allowed (YA499)' : -5,
            '500-549 total yards allowed (YA549)' : -6,
            '550+ total yards allowed (YA550)' : -7,
            '2pt Return (2PTRET)' : 2,
            '1pt Safety (1PSF)' : 1
        }
    };

    //dumb double space here
    var default_standard_settings = {
        'Passing': {
            'Every 25 passing yards  (PY25)' : 1
        },
        'Rushing': {
            'Every 10 rushing yards (RY10)' : 1
        },
        'Receiving': {
            'Every 10 receiving yards (REY10)' : 1
        }
    };

    var default_fractional_settings = {
        'Passing': {
            'Passing Yards (PY)' : 0.04
        },
        'Rushing': {
            'Rushing Yards (RY)' : 0.1
        },
        'Receiving': {
            'Receiving Yards (REY)' : 0.1
        }
    };

    var default_all_settings = jQuery.extend(true, {}, default_settings, default_standard_settings, default_fractional_settings);

    var default_roster = {
        'Quarterback (QB)': {
            'num': 1,
            'max': 4
        },
        'Running Back (RB)': {
            'num': 2,
            'max': 8
        },
        'Wide Receiver (WR)': {
            'num': 2,
            'max': 8
        },
        'Tight End (TE)': {
            'num': 1,
            'max': 3
        },
        'Flex (RB/WR/TE)': {
            'num': 1,
            'max': null
        },
        'Team Defense/Special Teams (D/ST)': {
            'num': 1,
            'max': 3
        },
        'Place Kicker (K)': {
            'num': 1,
            'max': 3
        },
        'Bench (BE)': {
            'num': 7,
            'max': null
        },
    };

    //TODO: finish other headings

    function getCellVal(cell) {
        var td_val = cell.text();
        var td_num = parseFloat(td_val);
        if (isNaN(td_num)) {
            td_num = td_val;
        }
        return td_num;
    }

    function colorizeCell(td_num, def_val, $td_cell) {
        if (td_num !== def_val) {
            if (td_num < def_val) {
                $td_cell.css({'background-color': 'pink'});
            }
            else if ((td_num > def_val) || td_num === 'No Limit') {
                $td_cell.css({'background-color': 'lightgreen'});
            }
            if (td_num !== 'N/A') {
                $td_cell.attr('title', 'Default: ' + def_val);
            }
        }
    }

    // - ROSTER SETTINGS -
    var missing_positions = [];

    function doRosterSettings($roster) {
        var $roster_body = $roster.find('tbody').find('tbody');
        var $roster_tds = $roster_body.find('tr[class^=row]').find('td:first');

        for (let j in default_roster) {
            if (default_roster.hasOwnProperty(j)) {
                let second_obj = default_roster[j];
                let matching_td = $roster_body.find("td:contains('" + j + "')");
                if (matching_td.length) {
                    var $td_start = matching_td.next();
                    var $td_max = $td_start.next();
                    var td_start_num = getCellVal($td_start);
                    var td_max_num = getCellVal($td_max);

                    var def_start_val = second_obj['num'];
                    colorizeCell(td_start_num, def_start_val, $td_start);
                    var def_max_val = second_obj['max'];
                    colorizeCell(td_max_num, def_max_val, $td_max);

                    $roster_tds.splice($roster_tds.index(matching_td), 1);
                }
                else {
                    missing_positions.push(j);
                }
            }
        }

        $roster_tds.each(function() {
            var $thistd = jQuery(this);
            var $td_row = $thistd.parent();
            $td_row.css({'background-color': 'lightblue'});
        });

        if (missing_positions.length > 0) {
            var $last_section = $roster.find('tbody').first().children('tr').last();
            var trclassname = 'Even';
            if ($last_section.attr("class").indexOf('Even') !== -1) {
                trclassname = 'Odd';
            }
            var $last_td = $last_section.find('tr:nth(1)').find('td:first');
            var td_width = $last_td.width() || 250;
            var $missing_section = jQuery('<tr class="row' + trclassname + '"><td class="dataSummary settingLabel">Missing Positions</td><td><table border="0" cellpadding="2" cellspacing="1" class="leagueSettingsTable tableBody"><tbody></tbody></table></td></tr>');
            var $missing_section_body = $missing_section.find('tbody');

            var missing_length = missing_positions.length;
            for (let i=0; i < missing_length; i++) {
                var td_val = missing_positions[i];

                var new_row = '<tr style="background-color: pink;"><td style="width: ' + td_width + 'px">' + td_val + '</td><td><strong>' + default_roster[td_val]['num'] + '</strong></td><td><strong>' + default_roster[td_val]['max'] + '</strong></td></tr>';
                $missing_section_body.append(new_row);
            }

            $missing_section.insertAfter($last_section);
        }

        rosterDone.resolve();
    }

    function jq_filter_parent_td_text(node, j) {
        return jQuery(node).parents('td').eq(0).prev().text() === j;
    }

    // - SCORING SETTINGS -
    function doScoringSettings($scoring) {
        var $scoring_body = $scoring.find('table.viewable').find('tbody').find('tbody');
        var $scoring_tds = $scoring_body.find('td.statName');

        //todo combine these
        var missing_tds = [];
        for (let j in default_settings) {
            if (default_settings.hasOwnProperty(j)) {
                let second_obj = default_settings[j];
                for (let k in second_obj) {
                    if (second_obj.hasOwnProperty(k)) {
                        let matching_td = $scoring_body.find("td:contains('" + k + "')").filter((index, node) => { return jq_filter_parent_td_text(node, j); });
                        if (matching_td.length) {
                            let $td_cell = matching_td.next();
                            let td_num = getCellVal($td_cell);

                            let def_val = second_obj[k];
                            colorizeCell(td_num, def_val, $td_cell);

                            $scoring_tds.splice($scoring_tds.index(matching_td), 1);
                        }
                        else {
                            let missing_tuple = {'typ': j, 'val': k};
                            missing_tds.push(missing_tuple);
                        }
                    }
                }
            }
        }

        var missing_stand_tds = [];
        var is_standard = false;
        for (let j in default_standard_settings) {
            if (default_standard_settings.hasOwnProperty(j)) {
                let second_obj = default_standard_settings[j];
                for (let k in second_obj) {
                    if (second_obj.hasOwnProperty(k)) {
                        let matching_td = $scoring_body.find("td:contains('" + k + "')").filter((index, node) => { return jq_filter_parent_td_text(node, j); });
                        if (matching_td.length) {
                            is_standard = true;
                            let $td_cell = matching_td.next();
                            let td_num = getCellVal($td_cell);

                            let def_val = second_obj[k];
                            colorizeCell(td_num, def_val, $td_cell);

                            $scoring_tds.splice($scoring_tds.index(matching_td), 1);
                        }
                        else {
                            let missing_tuple = {'typ': j, 'val': k};
                            missing_stand_tds.push(missing_tuple);
                        }
                    }
                }
            }
        }

        var missing_frac_tds = [];
        var is_frac = false;
        for (let j in default_fractional_settings) {
            if (default_fractional_settings.hasOwnProperty(j)) {
                let second_obj = default_fractional_settings[j];
                for (let k in second_obj) {
                    if (second_obj.hasOwnProperty(k)) {
                        let matching_td = $scoring_body.find("td:contains('" + k + "')").filter((index, node) => { return jq_filter_parent_td_text(node, j); });
                        if (matching_td.length) {
                            is_frac = true;
                            let $td_cell = matching_td.next();
                            let td_num = getCellVal($td_cell);

                            let def_val = second_obj[k];
                            colorizeCell(td_num, def_val, $td_cell);

                            $scoring_tds.splice($scoring_tds.index(matching_td), 1);
                        }
                        else {
                            let missing_tuple = {'typ': j, 'val': k};
                            missing_frac_tds.push(missing_tuple);
                        }
                    }
                }
            }
        }

        //To identify nonstandard yard scoring
        for (let c=0; c < $scoring_tds.length; c++) {
            var s_text = jQuery($scoring_tds[c]).text();
            var nonstand = false;
            var nonmissing_tuple;

            if ((s_text.search(/ards\s+\(PY\d+/) > -1) && (s_text.indexOf('ards (PY25)') === -1)) {
                nonmissing_tuple = {'typ': 'Passing', 'val': 'Passing Yards (PY)'};
                nonstand = true;
            }
            else if ((s_text.search(/ards\s+\(RY\d+/) > -1) && (s_text.indexOf('ards (RY10)') === -1)) {
                nonmissing_tuple = {'typ': 'Rushing', 'val': 'Rushing Yards (PY)'};
                nonstand = true;
            }
            else if ((s_text.search(/ards\s+\(REY\d+/) > -1) && (s_text.indexOf('ards (REY10)') === -1)) {
                nonmissing_tuple = {'typ': 'Receiving', 'val': 'Receiving Yards (REY)'};
                nonstand = true;
            }

            if (nonstand) {
                is_standard = true;
                missing_frac_tds.splice(nonmissing_tuple, 1);
            }
        }

        //TODO: put RY5 for example in a small diff color
        var $scoring_header = $scoring.find('tr').first().find('td').first();
        if (is_standard && is_frac) {
            $scoring_header.append(' (Mixture)');
            //slightly inaccurate, but this is an edge case
            missing_frac_tds.splice(0, missing_frac_tds.length);
            missing_stand_tds.splice(0, missing_stand_tds.length);
        }
        else if (is_standard) {
            $scoring_header.append(' (Standard)');
            missing_frac_tds.splice(0, missing_frac_tds.length);
        }
        else if (is_frac) {
            $scoring_header.append(' (Fractional)');
            missing_stand_tds.splice(0, missing_stand_tds.length);
        }
        else {
            $scoring_header.append(' (None)');
        }

        function check_denom(td_num, denom_str, expected_val, $td_cell) {
            var denom = 1.0;
            if (denom_str.length > 0) {
                denom = parseFloat(denom_str);
            }

            var converted_val = expected_val * denom;
            colorizeCell(td_num, converted_val, $td_cell);
            return td_num === converted_val;
        }

        $scoring_tds.each(function() {
            let $thistd = jQuery(this);

            let $td_cell = $thistd.next().first();
            let td_num = getCellVal($td_cell);

            let thistd_text = $thistd.text();

            let frac_cell = false;

            //again, espn adds a dumb extra space
            //todo combine these
            let cell_indexof = thistd_text.search(/ards\s+\(PY/);
            if (cell_indexof !== -1) {
                frac_cell = true;
                let expected_val = default_fractional_settings['Passing']['Passing Yards (PY)'];
                let denom_str = '';
                let denom_reg = thistd_text.match(/\([A-Z]+(\d+)\)/);
                if (denom_reg.length) {
                    denom_str = denom_reg[1];
                }
                let same_val = check_denom(td_num, denom_str, expected_val, $td_cell);
                if (same_val) {
                    missing_frac_tds.splice(missing_frac_tds.indexOf(' (PY'), 1);
                    missing_stand_tds.splice(missing_stand_tds.indexOf(' (PY'), 1);
                }
            }
            cell_indexof = thistd_text.indexOf('ards (RY');
            if (cell_indexof !== -1) {
                frac_cell = true;
                let expected_val = default_fractional_settings['Rushing']['Rushing Yards (RY)'];
                let denom_str = '';
                let denom_reg = thistd_text.match(/\([A-Z]+(\d+)\)/);
                if (denom_reg.length) {
                    denom_str = denom_reg[1];
                }
                let same_val = check_denom(td_num, denom_str, expected_val, $td_cell);
                if (same_val) {
                    missing_frac_tds.splice(missing_frac_tds.indexOf(' (RY'), 1);
                    missing_stand_tds.splice(missing_stand_tds.indexOf(' (RY'), 1);
                }

            }
            cell_indexof = thistd_text.indexOf('ards (REY');
            if (cell_indexof !== -1) {
                frac_cell = true;
                let expected_val = default_fractional_settings['Receiving']['Receiving Yards (REY)'];
                let denom_str = '';
                let denom_reg = thistd_text.match(/\([A-Z]+(\d+)\)/);
                if (denom_reg.length) {
                    denom_str = denom_reg[1];
                }
                let same_val = check_denom(td_num, denom_str, expected_val, $td_cell);
                if (same_val) {
                    missing_frac_tds.splice(missing_frac_tds.indexOf(' (REY'), 1);
                    missing_stand_tds.splice(missing_stand_tds.indexOf(' (REY'), 1);
                }
            }

            if (!frac_cell) {
                $thistd.css({'background-color': 'lightblue'});
                $td_cell.css({'background-color': 'lightblue'});
            }
        });

        //TODO: these should really go in their respective setting areas
        var all_missing_tds = missing_tds.concat(missing_stand_tds).concat(missing_frac_tds);
        var new_missing_tds = all_missing_tds.slice();
        for (let p=0; p < all_missing_tds.length; p++) {
            var miss_pos = all_missing_tds[p];
            let miss_pos_typ = miss_pos['typ'];
            let miss_pos_trans = [];
            if (miss_pos_typ === 'Team Defense / Special Teams') {
                miss_pos_trans = ['Team Defense/Special Teams (D/ST)'];
            }
            else if (miss_pos_typ === 'Passing') {
                miss_pos_trans = ['Quarterback (QB)', 'Team Quarterback (TQB)'];
            }
            else if (miss_pos_typ === 'Kicking') {
                miss_pos_trans = ['Place Kicker (K)'];
            }

            if (miss_pos_trans.length > 0) {
                let found_pos = 0;
                for (let f=0; f < miss_pos_trans.length; f++) {
                    if (missing_positions.indexOf(miss_pos_trans[f]) > -1) {
                        found_pos += 1;
                    }
                }
                if (found_pos === miss_pos_trans.length) {
                    new_missing_tds.splice(new_missing_tds.indexOf(miss_pos), 1);
                }
            }
        }

        if (new_missing_tds.length > 0) {
            var $last_section = $scoring.find('table.viewable').find('tbody').first().children('tr').last();
            var trclassname = 'Even';
            if ($last_section.attr("class").indexOf('Even') !== -1) {
                trclassname = 'Odd';
            }
            var $missing_section = jQuery('<tr class="row' + trclassname + '"><td class="categoryName settingLabel">Missing Entries</td><td><table width="100%" cellspacing="0" cellpadding="0" border="0"><tbody></tbody></table></td></tr>');
            var $missing_section_body = $missing_section.find('tbody');

            var missing_length = new_missing_tds.length;
            for (let i=0; i < missing_length; i++) {
                var td_val = new_missing_tds[i];
                var td_val_typ = td_val['typ'];
                var td_val_str = td_val['val'];

                //instead of this, put in the correct section
                var new_row = '<tr><td class="statName" style="background-color: pink;">' + td_val_str + ' [' + td_val_typ + '] ' + '</td><td class="statPoints" style="background-color: pink;">' + default_all_settings[td_val_typ][td_val_str] + '</td></tr>';

                $missing_section_body.append(new_row);
            }

            $missing_section.insertAfter($last_section);
        }
    }

    var rosterDone = jQuery.Deferred();

    var $roster = $allsettings.find("div[name='roster']");
    var $scoring = $allsettings.find("div[name='scoring']");

    jQuery.when(rosterDone).done(function() {
        if ($scoring.length > 0) {
            doScoringSettings($scoring);
        }
        watchLeagueForChanges();
    });

    if ($roster.length === 0) {
        if ($scoring.length > 0) {
            var roster_fetch = {'xhr': 1, 'edit': 'false', 'leagueId': league_id};
            jQuery.get(url_league_roster, roster_fetch, function(po) {
                po = cleanHTML(po);
                $roster = jQuery(po);
                doRosterSettings($roster);
            });
        }
        else {
            rosterDone.resolve();
        }
    }
    else {
        doRosterSettings($roster);
    }

    // Watch for changes
    function watchLeagueForChanges() {
        var observerConfig = {
            childList: true,
            characterData: true,
            subtree: true
        };

        var target_observe = document.querySelector(ld_selector);
        var leagueObserver = new MutationObserver(function (mutations) {
            if (mutations.length > 0) {
                var new_target_observe = jQuery(ld_selector);
                var submit_btn = new_target_observe.find('input.submitSettings:visible');
                if (submit_btn.length === 0) {
                    leagueObserver.disconnect();
                    addLeagueSettings();
                }
            }
        });

        leagueObserver.observe(target_observe, observerConfig);
    }
}

if (onLeagueSettingsPage) {
    addLeagueSettings();
}

/*
//https://www.playerprofiler.com/wp-admin/admin-ajax.php?action=playerprofiler_api&endpoint=%2Fplayer%2FME-0600
//https://www.playerprofiler.com/api/v1/embed/game-log/ME-0600
//https://www.playerprofiler.com/nfl/mike-evans/#/game-log

// - need to fix the dumb old prototypeJS bug for playerprofiler to work
var elt = document.createElement("script");
elt.type = 'text/javascript';
elt.innerHTML = 'Element.prototype = Node.prototype;';
document.head.appendChild(elt);

jQuery('body').append("<script>window._pp = window._pp || {}; window._pp['linker'] = 'modal';</script>"); // linker
jQuery('body').append('<script src="https://d998027e2znu1.cloudfront.net/widgets/embed.js"></script>');
jQuery('body').append('<div data-pp-linker-content>Mike Evans</div>');
*/

storageLeagueKey = 'fp_espn_league_data_' + league_id;
storageLeagueUpdateKey = 'fp_espn_last_updated_league_' + league_id;
storagePlayerKey = 'fp_espn_player_data_' + league_id;
storageUpdateKey = 'fp_espn_last_updated_' + league_id;
storageUpdateTypeKey = 'fp_espn_last_updated_type_' + league_id;

storageKeys.push(storageLeagueKey, storageLeagueUpdateKey, storagePlayerKey, storageUpdateKey, storageUpdateTypeKey);

function fixPage() {
    if (remove_ads) {
        jQuery('.games-footercol, .transitional-elements').remove();
        jQuery('.games-innercol2').children('br').remove();
        if (onClubhousePage) {
            //('.games-alert-tilt', '.games-alert-mod.alert-mod2.games-blue-alert', 'div.draftKings');
            jQuery('iframe[src*="streak.espn.com"]').parent().remove();
        }
        else if (onLeaguePage) {
            jQuery('.games-rightcol-spacer, a[href*="pizzahut"], div.promotional-info, div.header-ad, div[class^="games-ad"]').remove();
        }
    }
    if (fix_css) {
        jQuery('.gamesmain.container').css('margin-bottom', '10px');
        if (onClubhousePage) {
            jQuery('.games-bottomcol').css('margin', 0);
            var $games_dates_mod = jQuery('.games-dates-mod');
            if ($games_dates_mod.css('margin-top') === '19px') {
                $games_dates_mod.css('margin-top', '20px');
            }
        }
        else if (onFreeAgencyPage) {
            jQuery('#backgroundContainer').css('width', 'auto');
            /*
            if (jQuery('.addButton').css('background-position-x') === '-38px') {
                jQuery('.addButton').css('background-position-x', '-39px');
            }
            if (jQuery('.dropButton').css('width') === '14px') {
                jQuery('.dropButton').css('width', '15px');
            }
            */
        }
    }
}

function setSelectors() {
    base_table = jQuery(base_table_selector);

    if (onMatchupPreviewPage) {
        playerTable = jQuery(player_table_selector);
    }
    else {
        playerTable = base_table.find(player_table_selector);
    }

    player_table_body = playerTable.find(player_table_body_selector);
    playerTable = player_table_body;

    player_table_header = playerTable.find(player_table_header_selector);
    player_table_rows = player_table_body.find(player_table_row_selector);

    proj_head = player_table_header.find(player_table_header_proj_selector);
    hasProjectionTable = proj_head.length > 0;

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

function resetLeagueYear() {
    if ((current_season !== current_season_avg) || (current_season !== current_season_avg_week)) {
        //doing this to reset back to current season
        dlog.log('Resetting current year');
        var espn_points_data = {'leagueId': league_id, 'seasonId': current_season, 'xhr': '1'};
        jQuery.get(url_freeagency, espn_points_data);
    }
}

function addColumns() {
    if (!canAddColumns()) return;

    var cellClass = `playertableStat ${fp}`;
    
    var projection_header = `<td class="${cellClass} ${fp}Projections ${fp}ProjectionsHeader" title="Consensus point projections from FantasyPros (via ${fp})">FPROS</td>`;
    var projection_cell = `<td class="${cellClass} ${fp}Projections ${fp}ProjectionsData">${loadingDiv}</td>`;

    if (onMatchupPreviewPage) {
        if (!show_proj) return;

        proj_head.after(projection_header);
        proj_head.text('ESPN');

        player_table_body.find('.playertableSectionHeader th:contains(STATS)').each(function() {
            var $this = jQuery(this);
            var curr_span = $this.attr("colspan");
            $this.attr("colspan", curr_span + 1);

            $this.closest('table').find(player_table_row_selector).each(function() {
                jQuery(this).find('td').last().after(projection_cell);
            });
        });
    }
    else {
        var adjavg_header = `<td class="${cellClass} ${fp}Avg ${fp}AvgHeader" title="Injury/Suspension-adjusted average points for the season (via ${fp})">iAVG</td>`;
        var median_header = `<td class="${cellClass} ${fp}Median ${fp}MedianHeader" title="Injury/Suspension-adjusted median points for the season (via ${fp})">MED</td>`;
        var current_header = `<td class="${cellClass} ${fp}Current ${fp}CurrentHeader" title="Points scored this week (via ${fp})">CURR</td>`;
        var spark_header = `<td class="${cellClass} ${fp}Spark ${fp}SparkHeader" title="Graph of fantasy points over previous weeks (via ${fp})">TREND</td>`;
        var top_rank_header = `<th class="${fp}" colspan="2" title="Projected position rank (lower is better) with 95% confidence interval from FantasyPros (via ${fp})">PROJ RANK (±RANGE)</th>`;
        var rank_header = `<td colspan="2" style="text-align: center" class="${cellClass} ${fp}Rankings ${fp}RankingsHeader" title="Projected position rank (lower is better) for *this week* from FantasyPros (via ${fp})">THIS WEEK</td>`; //say wk 9 or this week
        var ros_header = `<td colspan="2" style="text-align: center" class="${cellClass} ${fp}Ros ${fp}RosHeader" title="Projected position rank (lower is better) for *the rest of the season* from FantasyPros (via ${fp})">REMAINING</td>`;
        var depth_header = `<td class="${cellClass} ${fp}Depth ${fp}DepthHeader" title="Depth chart information (via ${fp})">DEPTH</td>`;
        //var profiler_header = `<td class="${cellClass} ${fp}Profiler ${fp}ProfilerHeader" title="Depth chart information (via ${fp})">PROFILE</td>`;

        var adjavg_cell = `<td class="${cellClass} ${fp}Avg ${fp}AvgData">${loadingDiv}</td>`;
        var median_cell = `<td class="${cellClass} ${fp}Median ${fp}MedianData">${loadingDiv}</td>`;
        var current_cell = `<td class="${cellClass} ${fp}Current ${fp}CurrentData">${loadingDiv}</td>`;
        var spark_cell = `<td class="${cellClass} ${fp}Spark ${fp}SparkData">${loadingDiv}</td>`;
        var rank_cell = `<td class="${cellClass} ${fp}Rankings ${fp}RankingsData">${loadingDiv}</td>`;
        var rank_std_cell = `<td class="${cellClass} ${fp}Rankings ${fp}RankingsStdevData"></td>`;
        var ros_cell = `<td class="${cellClass} ${fp}Ros ${fp}RosData">${loadingDiv}</td>`;
        var ros_std_cell = `<td class="${cellClass} ${fp}Ros ${fp}RosStdevData"></td>`;
        var depth_cell = `<td class="${cellClass} ${fp}Depth ${fp}DepthData">${loadingDiv}</td>`;
        //var profiler_cell = `<td class="${cellClass} ${fp}Profiler ${fp}ProfilerData">${loadingDiv}</td>`;

        var space_cell = `<td class="${fp} sectionLeadingSpacer"></td>`;

        var all_header_cells = '';
        var all_row_cells = '';

        var section_header = jQuery('.playerTableBgRowHead.tableHead.playertableSectionHeader');

        var last_header_col = section_header.find('th:last');

        /*
        jQuery('#playertableFrameOuterShell').css({'width': '95%'});
        jQuery('#playertableFrameOuterShell').find('td:last').after(`<td align="right" valign="top" class="FantasyPlus" style="width: 120px;"><div style="float:right;" class="pncTopArea"><div id="FantasyPlusOptimize" class="pncTopButton pncTopButtonText" style="margin-left: 6px; color: darkgreen;">Optimize</div></div></td>');
        jQuery('#FantasyPlusOptimize').click(function(){
            optimizeLineup();
        });
        */

        if (show_proj) {
            last_header_col.attr({'colspan': 2, 'title': 'Projected points for this week'}).text('PROJ PTS');
            last_header_col.after(`<th class="${fp}" colspan="3">OWNERSHIP</th>`);
            last_header_col.after(`<th class="${fp}" colspan="1">OPRK</th>`); //todo change to 2, OPRK to ESPN, and include the DVOA adjusted version
            last_header_col.after(space_cell);

            var proj_a = proj_head.find('a');
            if (proj_a.length > 0) { //we're on a filterable page
                proj_a.text('ESPN');
            }
            else {
                proj_head.text('ESPN');
            }

            all_header_cells += projection_header + space_cell;
            all_row_cells += projection_cell + space_cell;
        }

        if (show_rank || show_ros) {
            var top_rank_header_j = jQuery(top_rank_header);
            if (show_rank && show_ros) {
                top_rank_header_j.attr('colspan', 4);
            }

            if (show_proj) {
                last_header_col.after(jQuery(space_cell).add(top_rank_header_j));
            }
            else {
                last_header_col.before(top_rank_header_j.add(jQuery(space_cell)));
            }

            if (show_rank) {
                all_header_cells += rank_header;
                all_row_cells += rank_cell + rank_std_cell;
            }
            if (show_ros) {
                all_header_cells += ros_header;
                all_row_cells += ros_cell + ros_std_cell;
            }

            all_header_cells += space_cell;
            all_row_cells += space_cell;
        }

        if (show_proj) {
            proj_head.after(all_header_cells);
        }
        else if (show_rank || show_ros) {
            proj_head.before(all_header_cells);
        }

        if (show_depth) {
            var players_col_span = section_header.next('tr').find('td.sectionLeadingSpacer:first').index();
            var players_col = section_header.find('th.playertableSectionHeaderFirst');
            players_col.attr({'colspan': players_col_span + 1, 'title': 'Player information'});

            var player_head = player_table_header.find('td:contains(TEAM POS)');
            var player_header_index = player_head.first().index();
            player_head.after(depth_header);
            //player_head.after(profiler_header);
        }

        var season_num = 0;
        var season_adds = [show_avg, show_med, show_current, show_spark];
        for (let s = 0; s < season_adds.length; s++) {
            if (season_adds[s] === true) {
                season_num += 1;
            }
        }
        if (show_avg || show_med || show_current || show_spark) {
            var avg_header_col = section_header.find('th:contains(SEASON)');
            avg_header_col.attr({'colspan': 4 + season_num, 'title': 'Season statistics'});
        }

        var avg_head = player_table_header.find('td:contains(AVG)');
        var avg_header_index = avg_head.first().index();
        if (show_depth) {
            avg_header_index -= 1;
        }
        if (show_med) {
            avg_head.after(median_header);
        }
        if (show_avg) {
            avg_head.after(adjavg_header);
        }

        var last_head = player_table_header.find('td:contains(LAST)');
        var last_header_index = last_head.first().index();
        if (show_depth) {
            last_header_index -= 1;
        }
        if (show_spark) {
            last_head.after(spark_header);
        }
        if (show_current) {
            last_head.after(current_header);
        }

        var byeweek = player_table_body.find('tr.playerTableBgRowSubhead td:contains(OPP)').first().index();
        if (show_depth) {
            byeweek -= 1;
        }

        player_table_rows.each(function() {
            var currRow = jQuery(this);

            var byeweek_text = currRow.find('td').eq(byeweek).text();
            var is_byeweek_text = byeweek_text === "** BYE **";

            var adj_header_index = (is_byeweek_text ? header_index - 1 : header_index);
            var adj_avg_header_index = (is_byeweek_text ? avg_header_index - 1 : avg_header_index);
            var adj_last_header_index = (is_byeweek_text ? last_header_index - 1 : last_header_index);
            var index_adj = 0;

            if (show_med) {
                currRow.find('td').eq(adj_avg_header_index).after(median_cell);
                index_adj += 1;
            }
            if (show_avg) {
                currRow.find('td').eq(adj_avg_header_index).after(adjavg_cell);
                index_adj += 1;
            }
            if (show_current) {
                currRow.find('td').eq(adj_last_header_index).after(current_cell);
                adj_last_header_index += 1;
                index_adj += 1;
            }
            if (show_spark) {
                currRow.find('td').eq(adj_last_header_index).after(spark_cell);
                index_adj += 1;
            }

            if (show_proj) {
                currRow.find('td').eq(adj_header_index + index_adj).after(all_row_cells);
            }
            else if (show_rank || show_ros) {
                currRow.find('td').eq(adj_header_index + index_adj).before(all_row_cells);
            }

            if (show_depth) {
                currRow.find('td').eq(player_header_index).after(depth_cell);
                //currRow.find('td').eq(player_header_index).after(profiler_cell);
            }
        });

        if ((show_proj || show_current) && onClubhousePage) {
            var bench_header = player_table_body.find('tr.playerTableBgRowHead:last');
            var bench_before = bench_header.prevAll('.playerTableBgRowSubhead:first');
            var total_row = bench_before.clone();

            var bench_prev = bench_header.prev();
            var bench_prev_match = bench_prev.attr('class').match(/playerTableBgRow(\d)/);
            var bench_num = '0';
            if (bench_prev_match && bench_prev_match.length === 2) {
                bench_num = Math.abs(parseInt(bench_prev_match[1]) - 1);
            }
            var new_row_class = 'playerTableBgRow' + bench_num;

            total_row.removeClass();

            total_row.addClass(`${fp} ${fp}Totals pncPlayerRow ${new_row_class}`);
            total_row.find('td').empty();
            total_row.find('td:first').html('<b>TOTAL</b>');

            var total_proj_cell = total_row.find(`.${fp}ProjectionsHeader`);
            var total_curr_cell = total_row.find(`.${fp}CurrentHeader`);

            total_row.find('td').removeClass(function(i, v) {
                return (v.match(/(^|\s)FantasyPlus\S+Header/g) || []).join(' ');
            });

            total_proj_cell.addClass(`${fp}ProjectionsTotal`);
            total_curr_cell.addClass(`${fp}CurrentTotal`);

            bench_header.before(total_row);
        }

        //well, this doesnt work. just doesnt assign the cards
        /*
        var all_profiler_cells = player_table_body.find('.FantasyPlusProfilerData');
        all_profiler_cells.each(function() {
            var cell = jQuery(this);
            var currRow = cell.parent();

            var player_cell, player_cell_text;
            [player_cell, player_cell_text] = getPlayerCellText(currRow, cell);
            var player_cell_data = getPlayerDataFromCell(player_cell, player_cell_text);
            var player_name = player_cell_data[0];
            cell.html(`<div data-pp-linker-content>${player_name}</div>`);
        });
        */
    }
}

override(parseLeagueSettings, 'run', applyCompose(function(ret) {
    var self = this;
    var league_settings = ret;

    league_settings['siteType'] = 'espn'; //necessary?

    function getValue (setting_name) {
        //TODO fix this for the right section
        return parseFloat(self.league_data.find("td:contains('" + setting_name + "')").next().first().text());
    }

    league_settings['pass_yds'] =
        getValue('Passing Yards (PY)') ||
        getValue('(PY5)') / 5.0 ||
        getValue('(PY10)') / 10.0 ||
        getValue('(PY20)') / 20.0 ||
        getValue('(PY25)') / 25.0 ||
        getValue('(PY50)') / 50.0 ||
        getValue('(PY100)') / 100.0 || 0;

    league_settings['pass_tds'] = getValue('TD Pass (PTD)') || 0;
    league_settings['pass_ints'] = getValue('Interceptions Thrown (INT)') || 0;
    league_settings['pass_cmp'] = getValue('Each Pass Completed (PC)') ||
        getValue('(PC5)') / 5.0 ||
        getValue('(PC10)') / 10.0 || 0;
    league_settings['pass_icmp'] =
        getValue('Each Incomplete Pass (INC)') ||
        getValue('(IP5)') / 5.0 ||
        getValue('(IP10)') / 10.0 || 0;
    league_settings['pass_att'] = getValue('Each Pass Attempted (PA)') || 0;
    league_settings['pass_300_bonus'] = getValue('300-399 yard passing game (P300)') || 0;
    league_settings['pass_400_bonus'] = getValue('400+ yard passing game (P400)') || 0;

    league_settings['rush_yds'] = getValue('Rushing Yards (RY)') ||
        getValue('(RY5)') / 5.0 ||
        getValue('Every 10 rushing yards (RY10)') / 10.0 ||
        getValue('(RY20)') / 20.0 ||
        getValue('(RY25)') / 25.0 ||
        getValue('(RY50)') / 50.0 ||
        getValue('(RY100)') / 100.0 || 0;
    league_settings['rush_att'] = getValue('Rushing Attempts (RA)') ||
        getValue('(RA5)') / 5.0 ||
        getValue('(RA10)') / 10.0 || 0;
    league_settings['rush_tds'] = getValue('TD Rush (RTD)') || 0;
    league_settings['rush_100_bonus'] = getValue('100-199 yard rushing game (RY100)') || 0;
    league_settings['rush_200_bonus'] = getValue('200+ yard rushing game (RY200)') || 0;

    league_settings['rec_yds'] =
        getValue('Receiving Yards (REY)') ||
        getValue('Every 5 receiving yards (REY5)') / 5.0 ||
        getValue('(REY10)') / 10.0 ||
        getValue('(REY20)') / 20.0 ||
        getValue('(REY25)') / 25.0 ||
        getValue('(REY50)') / 50.0 ||
        getValue('(REY50)') / 100.0 || 0;
    league_settings['rec_att'] =
        getValue('Each reception (REC)') ||
        getValue('(REC5)') / 5.0 ||
        getValue('(REC10)') / 10.0 || 0;
    league_settings['rec_tds'] = getValue('TD Reception (RETD)') || 0;
    league_settings['rec_100_bonus'] = getValue('100-199 yard receiving game (REY100)') || 0;
    league_settings['rec_200_bonus'] = getValue('200+ yard receiving game (REY200)') || 0;
    //Receiving Target (RET)

    league_settings['xpt'] = getValue('Each PAT Made (PAT)') || 0;
    league_settings['fga'] =
        (getValue('Total FG Attempted (FGA)') || 0) +
        (0.6 * (getValue('FG Attempted (0-39 yards) (FGA9)') || 0)) +
        (0.3 * (getValue('FG Attempted (40-49 yards) (FGA40)') || 0)) +
        (0.1 * (getValue('FG Attempted (50+ yards) (FGA50)') || 0));
    league_settings['fg'] =
        (getValue('Total FG Made (FG)') || 0) +
        (0.6 * (getValue('FG Made (0-39 yards) (FG0)') || 0)) +
        (0.3 * (getValue('FG Made (40-49 yards) (FG40)') || 0)) +
        (0.1 * (getValue('FG Made (50+ yards) (FG50)') || 0));
    league_settings['fgm'] =
        (getValue('Total FG Missed (FGM)') || 0) +
        (0.6 * (getValue('FG Missed (0-39 yards) (FGM0)') || 0)) +
        (0.3 * (getValue('FG Missed (40-49 yards) (FGM40)') || 0)) +
        (0.1 * (getValue('FG Missed (50+ yards) (FGM50)') || 0));
    //Each PAT Attempted (PATA)

    league_settings['fumbles'] = getValue('Total Fumbles Lost (FUML)') || 0;

    //TODO Total tackle here.
    // http://games.espn.com/ffl/leaguesetup/settings?leagueId=609328
    league_settings['ff'] = getValue('Each Fumble Forced (FF)') || 0;
    league_settings['tka'] = getValue('Assisted Tackles (TKA)') || 0;
    league_settings['tks'] = getValue('Solo Tackles (TKS)') || 0;
    league_settings['pd'] = getValue('Passes Defensed (PD)') || 0;

    league_settings['int'] = getValue('Each Interception (INT)') || 0;
    league_settings['deftd'] = getValue('Interception Return TD (INTTD)') || 0;
    league_settings['fr'] = getValue('Each Fumble Recovered (FR)') || 0;
    league_settings['sf'] = getValue('Each Safety (SF)') || 0;
    league_settings['sk'] =
        getValue('Each Sack (SK)') ||
        getValue('1/2 Sack (HALFSK)') * 2 || 0;

    league_settings['pa'] = getValue('Points Allowed (PA)') || 0;
    league_settings['pa0'] = getValue('0 points allowed (PA0)') || 0;
    league_settings['pa1'] = getValue('1-6 points allowed (PA1)') || 0;
    league_settings['pa7'] = getValue('7-13 points allowed (PA7)') || 0;
    league_settings['pa14'] = getValue('14-17 points allowed (PA14)') || 0;
    league_settings['pa18'] = getValue('18-21 points allowed (PA18)') || 0;
    league_settings['pa22'] = getValue('22-27 points allowed (PA22)') || 0;
    league_settings['pa28'] = getValue('28-34 points allowed (PA28)') || 0;
    league_settings['pa35'] = getValue('35-45 points allowed (PA35)') || 0;
    league_settings['pa46'] = getValue('46+ points allowed (PA46)') || 0;

    league_settings['ya'] = getValue('Yards Allowed (YA)') || 0;
    league_settings['ya100'] = getValue('Less than 100 total yards allowed (YA100)') || 0;
    league_settings['ya199'] = getValue('100-199 total yards allowed (YA199)') || 0;
    league_settings['ya299'] = getValue('200-299 total yards allowed (YA299)') || 0;
    league_settings['ya349'] = getValue('300-349 total yards allowed (YA349)') || 0;
    league_settings['ya399'] = getValue('350-399 total yards allowed (YA399)') || 0;
    league_settings['ya449'] = getValue('400-449 total yards allowed (YA449)') || 0;
    league_settings['ya499'] = getValue('450-499 total yards allowed (YA499)') || 0;
    league_settings['ya549'] = getValue('500-549 total yards allowed (YA549)') || 0;
    league_settings['ya550'] = getValue('550+ total yards allowed (YA550)') || 0;

    this.league_settings = league_settings;
    dlog.log(league_settings);
    return league_settings;
}));

function setDSTname(player_name) {
    return player_name.split(' ').pop() + ' D/ST';
}

function calcBonus(bonus_type, pd) { return 0; }

function calcAdjProjections(player_data) {
    return parseLeagueSettings.league_settings['pass_300_bonus'] * (300 <= player_data['pass_yds'] && player_data['pass_yds'] < 400) +
        parseLeagueSettings.league_settings['pass_400_bonus'] * ((player_data['pass_yds'] || 0) >= 400) +
        parseLeagueSettings.league_settings['rush_100_bonus'] * (100 <= player_data['rush_yds'] && player_data['rush_yds'] < 200) +
        parseLeagueSettings.league_settings['rush_200_bonus'] * ((player_data['rush_yds'] || 0) >= 200) +
        parseLeagueSettings.league_settings['rec_100_bonus'] * (100 <= player_data['rec_yds'] && player_data['rec_yds'] < 200) +
        parseLeagueSettings.league_settings['rec_200_bonus'] * ((player_data['rec_yds'] || 0) >= 200) +

        parseLeagueSettings.league_settings['pa0'] * (player_data['def_pa'] === 0) +
        parseLeagueSettings.league_settings['pa1'] * (0 < player_data['def_pa'] && player_data['def_pa'] <= 6) +
        parseLeagueSettings.league_settings['pa7'] * (6 < player_data['def_pa'] && player_data['def_pa'] <= 13) +
        parseLeagueSettings.league_settings['pa14'] * (13 < player_data['def_pa'] && player_data['def_pa'] <= 17) +
        parseLeagueSettings.league_settings['pa18'] * (17 < player_data['def_pa'] && player_data['def_pa'] <= 21) +
        parseLeagueSettings.league_settings['pa22'] * (21 < player_data['def_pa'] && player_data['def_pa'] <= 27) +
        parseLeagueSettings.league_settings['pa28'] * (27 < player_data['def_pa'] && player_data['def_pa'] <= 34) +
        parseLeagueSettings.league_settings['pa35'] * (34 < player_data['def_pa'] && player_data['def_pa'] <= 45) +
        parseLeagueSettings.league_settings['pa46'] * (45 < player_data['def_pa']) +

        parseLeagueSettings.league_settings['ya100'] * (0 <= player_data['def_tyda'] && player_data['def_tyda'] < 100) +
        parseLeagueSettings.league_settings['ya199'] * (100 <= player_data['def_tyda'] && player_data['def_tyda'] < 200) +
        parseLeagueSettings.league_settings['ya299'] * (200 <= player_data['def_tyda'] && player_data['def_tyda'] < 300) +
        parseLeagueSettings.league_settings['ya349'] * (300 <= player_data['def_tyda'] && player_data['def_tyda'] < 350) +
        parseLeagueSettings.league_settings['ya399'] * (350 <= player_data['def_tyda'] && player_data['def_tyda'] < 400) +
        parseLeagueSettings.league_settings['ya449'] * (400 <= player_data['def_tyda'] && player_data['def_tyda'] < 450) +
        parseLeagueSettings.league_settings['ya499'] * (450 <= player_data['def_tyda'] && player_data['def_tyda'] < 500) +
        parseLeagueSettings.league_settings['ya549'] * (500 <= player_data['def_tyda'] && player_data['def_tyda'] < 550) +
        parseLeagueSettings.league_settings['ya550'] * (550 <= player_data['def_tyda']);
}

RowData.prototype._getPlayerInfo = function() {
    if (this._isBlank()) return {};

    var player_name = '';
    var pos_name = '';
    var team_name = '';

    if (this._isImmortal()) {
        player_name = this.player_cell.find('a').text().trim();
        team_name = "-";
        if (this.player_cell_text.indexOf('D/ST') > -1) {
            pos_name = 'D/ST';
        }
        else if (this.player_cell_text.indexOf('TQB') > -1) {
            pos_name = 'TQB';
        }
        else if (this.player_cell_text.indexOf('HC') > -1) {
            pos_name = 'HC';
        }
    }
    else {
        var new_posses;
        var player_split = this.player_cell_text.split(",");
        for (let ps=0; ps<player_split.length; ps++) {
            player_split[ps] = player_split[ps].trim();
        }
        player_name = player_split[0];
        var team_pos = player_split[1].split(/\s|\xa0/);
        team_name = team_pos[0].toUpperCase();
        if (team_name === 'JAX') {
            team_name = 'JAC';
        }
        else if (team_name === 'WSH') {
            team_name = 'WAS';
        }

        pos_name = team_pos[1];
        if (player_split.length > 2) {
            pos_name = [pos_name];
            new_posses = player_split.slice(2);
            for (let np=0; np<new_posses.length; np++) {
                var np_text = new_posses[np];
                if (!np_text) {
                    break;
                }
                var np_split = np_text.split(/\s|\xa0/);
                pos_name.push(np_split[0]);
            }
        }
    }

    player_name = player_name.replace('*', '');

    //ESPN assigns completely wrong playerIds in the cell for rookies. God damnit ESPN.
    var player_id = this.player_cell.find('a').attr('playerid');

    var live_game = false;
    if (show_current) {
        var game_time_text = this.currRow.find('.gameStatusDiv').text().trim();
        if (game_time_text && game_time_text.indexOf('-') > -1) {
            if (game_time_text[1] !== ' ') {
                dlog.log('found live game: ' + game_time_text);
                live_game = 'live';
            }
            else {
                live_game = 'done';
            }
            //var dow = game_time_text.split(' ')[0];
            //game_time = new Date();
            //game_time.setDate(game_time.getDate() + (dow + (7 - game_time.getDay())) % 7);
        }
    }

    return {
        'player_name': player_name,
        'pos_name': pos_name,
        'team_name': team_name,
        'live_game': live_game,
        'player_id': player_id
    };
};

function calcAdjAvg(thisrow, player_id, games_played, weekly_points) {
    var playertotpts = 0;
    var totalplayergames = 0;
    var player_adjavg_rnd = null;
    var player_median_rnd = null;

    var past_weekly_points_data = weekly_points.slice(0, current_week_avg - 1);
    var past_points_played = [];

    dlog.info('Past points data');
    dlog.info(past_weekly_points_data);
    dlog.info(games_played);

    for (let g=0; g < past_weekly_points_data.length; g++) {
        if (games_played[g] === 1) {
            let weekpt = parseFloat(past_weekly_points_data[g]) || 0;
            past_points_played.push(weekpt);
            playertotpts += weekpt;
            totalplayergames++;
        }
    }

    if (totalplayergames > 0) {
        var player_adjavg = parseFloat(playertotpts / totalplayergames);
        player_adjavg_rnd = (Math.round(player_adjavg * 10) / 10).toFixed(1);

        var sorted_pts = past_points_played.sort(function(a, b){ return a - b; });
        var half_pts_len = sorted_pts.length / 2;
        var player_median = half_pts_len % 1 === 0 ? (sorted_pts[half_pts_len - 1] + sorted_pts[half_pts_len]) / 2 : sorted_pts[Math.floor(half_pts_len)];
        player_median_rnd = (Math.round(player_median * 10) / 10).toFixed(1);
    }

    if (typeof activity_data_current_season_site[player_id][league_id] === "undefined") {
        activity_data_current_season_site[player_id][league_id] = {};
    }
    activity_data_current_season_site[player_id][league_id]['pts_avg'] = player_adjavg_rnd;
    activity_data_current_season_site[player_id][league_id]['pts_med'] = player_median_rnd;

    insertAdjAvg(thisrow, player_adjavg_rnd, player_median_rnd, games_played, weekly_points);
}

override(getProjectionData, '_fetchActivityData', function(original) {
    return function(rowData) {
        var espn_points_data = {
            'leagueId': league_id,
            'playerId': rowData.player_id,
            'playerIdType': 'playerId',
            'seasonId': current_season_avg,
            'xhr': '1'
        };

        jQuery.ajax({
            url: url_player_pop,
            timeout: ajax_timeout,
            method: 'get',
            data: espn_points_data,
            context: {
                'rowData': rowData
            }
        }).fail(function() {
            dlog.log('failed to get player pop: ' + this.rowData.player_id);
            insertAdjAvg(this.rowData.currRow, null, null, [], []);
        }).done(function(po) {
            var rowData = this.rowData;
            var currRow = rowData.currRow;
            var player_id = rowData.player_id;
            var translation_id = rowData.getTranslationId();

            if (!po) {
                dlog.log('No data in pop: ' + player_id);
                return insertAdjAvg(currRow, null, null, [], []);
            }

            po = cleanHTML(po);
            var podata = jQuery(po);

            var p_data = activity_data_current_season_site[player_id];

            var p_data_league = p_data[league_id];
            if (typeof p_data_league === "undefined") {
                p_data_league = {};
            }

            if (typeof p_data['games_played'] === "undefined") {
                p_data['games_played'] = [];
            }

            var player_card = jQuery('div#tabView0 div#moreStatsView0', podata);

            var playerlink = player_card.find('div.pc:not(#pcBorder)');
            var pop_player_href = playerlink.find('a[href*="playerId"], a[href*="proId"]');
            var pop_player_id = null;
            if (pop_player_href.length) {
                pop_player_id = pop_player_href.attr('href').match(/(playerId=|proId\/)(\d+)/)[2];
            }

            if (pop_player_id !== null && pop_player_id !== translation_id) {
                dlog.log('found rookie: ' + player_id + ', is ' + pop_player_id);
                p_data['translation'] = pop_player_id;
                translation_id = pop_player_id;
            }

            var points_table = player_card.find('div#pcBorder table tbody');
            var points_table_header = points_table.find('tr.pcStatHead');
            var byeindex = points_table_header.find('td:contains("OPP")').first().index() + 1;
            var ptsindex = points_table_header.find('td:contains("PTS")').first().index() + 1;

            var points_table_rows = points_table.find('tr:not(.pcStatHead)');
            var points_table_td_bye = points_table_rows.find('td:nth-child(' + byeindex + ')');
            var points_table_td_pts = points_table_rows.find('td:nth-child(' + ptsindex + ')');

            var player_bye_cell = points_table_td_bye.filter(function() {
                return /BYE/.test(jQuery(this).text());
            });
            var player_bye_week = null;
            if (player_bye_cell.length === 1) {
                player_bye_week = parseFloat(player_bye_cell.prev().text().trim());
            }

            var isImmortal = rowData._isImmortal();

            var player_activity_pts = points_table_td_pts.map(function() {
                return this.innerText;
            });

            var parsed_player_activity_pts = [];

            player_activity_pts.each(function(i) {
                var v = this;
                // noinspection JSDeprecatedSymbols
                var is_bye_week = jQuery.isNumeric(player_bye_week) && i === (player_bye_week - 1);

                if (is_bye_week) {
                    p_data['games_played'][i] = 'BYE';
                }
                else { // noinspection JSDeprecatedSymbols
                    if (isImmortal && jQuery.isNumeric(v)) {
                        p_data['games_played'][i] = 1;
                    }
                    else if (typeof p_data['games_played'][i] === "undefined") {
                        p_data['games_played'][i] = null;
                    }
                    else if (p_data['games_played'][i] === 'BYE') {
                        p_data['games_played'][i] = null;
                    }
                }

                var parsed_v = parseFloat(v);
                if (isNaN(parsed_v)) {
                    parsed_v = null;
                }

                parsed_player_activity_pts.push(parsed_v);
            });

            dlog.info('Player Activity pts:');
            dlog.info(parsed_player_activity_pts);

            p_data_league['last_updated'] = current_time;
            p_data_league['weekly_points'] = parsed_player_activity_pts;

            if (isImmortal) {
                dlog.log('inserting avg for dsts, etc. for: ' + player_id);
                p_data['games_played_updated'] = current_time;
                return calcAdjAvg(currRow, player_id, p_data['games_played'], p_data_league['weekly_points']);
            }

            // Only fetch on tuesday
            if (isActivityDataCurrent(player_id, p_data['games_played_updated'], 'games')) {
                dlog.info('using cache for games played for: ' + player_id);
                return calcAdjAvg(currRow, player_id, p_data['games_played'], p_data_league['weekly_points']);
            }

            var espn_data = {
                playerId: translation_id,
                season: current_season_avg_week,
                xhr: 1
            };

            jQuery.ajax({
                url: url_player_log,
                timeout: ajax_timeout,
                data: espn_data,
                method: 'get',
                context: {
                    'rowData': rowData
                }
            }).fail(function() {
                var currRow = this.rowData.currRow;
                var pid = this.rowData.player_id;

                var p_data_league_pts = activity_data_current_season_site[pid][league_id]['weekly_points'];

                dlog.log('failed to get player card: ' + pid);
                return insertAdjAvg(currRow, null, null, [], p_data_league_pts);
            }).done(function(p) {
                var currRow = this.rowData.currRow;
                var pid = this.rowData.player_id;

                var p_data = activity_data_current_season_site[pid];
                var p_data_league = p_data[league_id];
                if (typeof p_data_league === "undefined") {
                    p_data_league = {};
                }
                if (typeof p_data_league['weekly_points'] === "undefined") {
                    p_data_league['weekly_points'] = [];
                }

                if (!p) {
                    dlog.log('No data in player card: ' + pid);
                    return insertAdjAvg(currRow, null, null, [], p_data_league['weekly_points']);
                }

                p = cleanHTML(p);
                var adata = jQuery(p);

                var postseason_row = jQuery('tr td:contains("POSTSEASON")', adata).parents('tr');
                var week_rows = jQuery('tr td:contains("REGULAR SEASON")', adata).parents('tr').nextUntil(postseason_row).filter(function() {
                    return jQuery(this).find('td').length > 1;
                });
                week_rows.each(function(i, v) {
                    if (p_data['games_played'][i] !== 'BYE') {
                        var week_row = jQuery(v);
                        var week_row_text = week_row.text();

                        if (week_row_text.indexOf('DID NOT PLAY') > -1) {
                            p_data['games_played'][i] = 0;
                        }
                        else if (week_row_text.indexOf('BYE') === -1) {
                            p_data['games_played'][i] = 1;
                        }
                    }
                });

                for (let g=0; g < p_data['games_played'].length; g++) {
                    if (p_data['games_played'][g] === null && g < (current_week_avg - 1)) {
                        p_data['games_played'][g] = 0;
                    }
                    if (p_data['games_played'][g] !== 1) {
                        p_data_league['weekly_points'][g] = null;
                    }
                }

                p_data['games_played_updated'] = current_time;

                calcAdjAvg(currRow, pid, p_data['games_played'], p_data_league['weekly_points']);
            });
        });
    }
});

addData.byeweek_overwrite = '<span style="color:#999999">BYE</span>';

addData.projTotals = function() {
    if ((!(show_proj || show_current) && onClubhousePage) || (!show_proj && onMatchupPreviewPage)) {
        dlog.log('totals done');
        totalsDone.resolve();
        return;
    }

    if (onClubhousePage) {
        var sumTotal, sumTotalESPN, sumTotalCurr;

        var totalsProjDone = jQuery.Deferred();
        var totalsCurrDone = jQuery.Deferred();
        jQuery.when(totalsProjDone, totalsCurrDone).done(function() {
            dlog.log('totals done');
            totalsDone.resolve();
        });

        var addESPNTotals = function(typ) {
            var isProj = typ === 'proj';
            var isCurr = typ === 'curr';
            if (!(isProj || isCurr)) {
                return;
            }

            var starter_row = player_table_header.filter(function() {
                return jQuery(this).prev().find('th.playertableSectionHeaderFirst').text() === 'STARTERS';
            });

            var cell_class;
            if (isProj) {
                cell_class = '.FantasyPlusProjections';
                sumTotal = sumTotalESPN = 0;
            }
            else if (isCurr) {
                cell_class = '.FantasyPlusCurrent';
                sumTotalCurr = 0;
            }

            var keepAdding = true;
            while (keepAdding) {
                starter_row = starter_row.next();
                if (starter_row.hasClass('pncPlayerRow') && !starter_row.hasClass('emptyRow') && !starter_row.hasClass('FantasyPlusTotals')) {
                    var seek_cell = starter_row.find(cell_class + 'Data');

                    if (isProj) {
                        var sumptsESPN = parseFloat(seek_cell.text());
                        var sumpts = parseFloat(seek_cell.prev().text());

                        if (sumpts) {
                            sumTotal += sumpts;
                        }
                        if (sumptsESPN) {
                            sumTotalESPN += sumptsESPN;
                        }
                    }
                    else if (isCurr) {
                        var sumcurr = parseFloat(seek_cell.text());

                        if (sumcurr) {
                            sumTotalCurr += sumcurr;
                        }
                    }
                }
                else {
                    keepAdding = false;
                }
            }

            var tot_cell = playerTable.find(cell_class + 'Total');
            if (isProj) {
                var sumTotalESPN_rnd = Math.round(parseFloat(sumTotalESPN) * 100) / 100;
                if (sumTotalESPN_rnd === 0) {
                    sumTotalESPN_rnd = '--';
                }
                tot_cell.html(sumTotalESPN_rnd);

                var sumTotal_rnd = Math.round(parseFloat(sumTotal) * 100) / 100;
                if (sumTotal_rnd === 0) {
                    sumTotal_rnd = '--';
                }
                tot_cell.prev().html(sumTotal_rnd);

                totalsProjDone.resolve();
            }
            else if (isCurr) {
                var sumTotalCurr_rnd = Math.round(parseFloat(sumTotalCurr) * 100) / 100;
                if (sumTotalCurr_rnd === 0) {
                    sumTotalCurr_rnd = '--';
                }
                tot_cell.html(sumTotalCurr_rnd);

                totalsCurrDone.resolve();
            }
        };

        if (show_proj) {
            addESPNTotals('proj');
        }
        else {
            totalsProjDone.resolve();
        }

        if (show_current) {
            jQuery.when(activityDone).done(function() {
                addESPNTotals('curr');
            });
        }
        else {
            totalsCurrDone.resolve();
        }
    }
    else if (onMatchupPreviewPage) {
        jQuery('.playerTableTable').each(function() {
            var currTable = jQuery(this);
            var datapoints = currTable.find('.FantasyPlusProjectionsData');

            if (datapoints.length > 0) {
                var matchup_total = 0;
                datapoints.each(function() {
                    let value = parseFloat(jQuery(this).text());
                    if (value) {
                        matchup_total = matchup_total + value;
                    }
                });

                var matchup_total_rnd = Math.round(matchup_total);
                currTable.next().prepend('<div title="Total projected points (via FantasyPlus)" class="danglerBox totalScore">' + matchup_total_rnd + '</div>');
            }
        });

        dlog.log('totals done');
        totalsDone.resolve();
    }
};

watchForChanges.target_selector = base_table_selector;