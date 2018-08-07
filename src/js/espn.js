onMatchupPreviewPage = document.URL.match(/ffl\/matchuppreview/);
onClubhousePage = document.URL.match(/ffl\/(clubhouse|dropplayers|rosterfix)/);
onFreeAgencyPage = document.URL.match(/ffl\/(freeagency|watchlist)/);
onGeneralProjPage = document.URL.match(/ffl\/tradereview/);
var onLeaguePage = document.URL.match(/ffl\/leagueoffice/);
var onLeagueSettingsPage = document.URL.match(/ffl\/leaguesetup\/settings/);

hasProjTotals = onMatchupPreviewPage || onClubhousePage;
hasPlayerTable = onClubhousePage || onFreeAgencyPage || onGeneralProjPage;
hasProjectionTable = false;

base_table_selector = '.playerTableContainerDiv';
player_table_selector = '[id^=playertable_]';
player_table_body_selector = 'tbody';
player_table_header_selector = 'tr.playerTableBgRowSubhead';
player_table_row_selector = 'tr.pncPlayerRow:not(.emptyRow)';
player_table_header_proj_selector = 'td:contains(PROJ), td:contains(ESPN)';
player_name_selector = 'td.playertablePlayerName';
ld_selector = 'div.games-fullcol';

var player_cell_pos_selector = 'td[id^="pncSlot_"]';

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
            jQuery.get('//games.espn.com/ffl/leaguesetup/sections/roster', roster_fetch, function(po) {
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

league_id = document.URL.match(/leagueId=(\d+)/)[1];
league_settings_url = '//games.espn.com/ffl/leaguesetup/sections/scoring?leagueId=' + league_id;

storageLeagueKey = 'fp_espn_league_data_' + league_id;
storageLeagueUpdateKey = 'fp_espn_last_updated_league_' + league_id;
storagePlayerKey = 'fp_espn_player_data_' + league_id;
storageUpdateKey = 'fp_espn_last_updated_' + league_id;
storageUpdateTypeKey = 'fp_espn_last_updated_type_' + league_id;

storageKeys.push(storageLeagueKey, storageLeagueUpdateKey, storagePlayerKey, storageUpdateKey, storageUpdateTypeKey);

function fixPage() {
    dlog.log('fix page start');
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
    dlog.log('fix page done');
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
