siteType = 'fleaflicker';

var url_base = '//www.fleaflicker.com';
var url_nfl = 'nfl/leagues';

league_id = document.URL.match(new RegExp(`/${url_nfl}/(${num_rgx})`))[1];
league_settings_url = `${url_base}/${url_nfl}/${league_id}/scoring`;

onMatchupPreviewPage = new RegExp(`/${url_nfl}/${num_rgx}/scores/${num_rgx}`).test(document.URL);
onClubhousePage = new RegExp(`/${url_nfl}/${num_rgx}/teams/${num_rgx}(\\?|$)`).test(document.URL);
onFreeAgencyPage = new RegExp(`/${url_nfl}/${num_rgx}/players([^/]|$)`).test(document.URL);
onGeneralProjPage = new RegExp(`/${url_nfl}/${num_rgx}/teams/${num_rgx}/watched`).test(document.URL);

hasProjTotals = onMatchupPreviewPage || onClubhousePage;
hasPlayerTable = onFreeAgencyPage || onMatchupPreviewPage;
hasProjectionTable = onMatchupPreviewPage || onClubhousePage || onFreeAgencyPage || onGeneralProjPage;

base_table_selector = '#body-center-main';
player_table_selector = 'table';
player_table_body_selector = 'tbody';
player_table_header_selector = 'thead tr';
player_table_row_selector = 'tr:not(:has(td.vertical-spacer))';
player_name_selector = 'div.player';

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

var fetchFleaflickerIds = jQuery.Deferred();
var total_player_ids = 0;
var is_current_week = true;

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
    if (week_no && (parseInt(week_no) !== current_week)) {
        is_current_week = false;
    }
    var season_no = url_dict.hasOwnProperty('season') ? url_dict['season'][0] : '';
    if (season_no && (parseInt(season_no) !== current_season)) {
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

override(setWatch, '_watch', function(original) {
    return function() {
        watchForChanges.run();
    }
});

function makeJquery(data) {
    return (data instanceof jQuery) ? data.clone() : jQuery(data);
}

// move to fleaflicker tableutils
function getIdxSpan(c, add_this) {
    add_this = typeof add_this === "undefined" ? false : add_this;
    if (c && c.length) {
        var index = 0;
        jQuery(c[0]).prevAll("td, th").each(function() {
            index += this.colSpan;
        });
        if (add_this) {
            index += c[0].colSpan;
        }
        return index;
    }
    else {
        return false;
    }
}

var TableUtils = function() {
    var self = this;
    
    this.addHeader = function(cells, data, spacing) {
        spacing = typeof spacing === "undefined" ? "3%" : spacing;
        cells.each(function() {
            var cell = jQuery(this);
            var this_header = jQuery(data);

            if (cell.hasClass('bottom')) {
                this_header.addClass('bottom');
            }
            if (cell.hasClass('right')) {
                cell.removeClass('right');
                this_header.addClass('right');
            }

            var next_header = cell.next();
            if (next_header.length && !next_header.hasClass('horizontal-spacer')) {
                next_header.css('width', spacing);
            }

            cell.after(this_header);
        });
    };

    this.findIdxSpan = function(i, c) {
        if (c && c.length && Number.isInteger(i) && i >= 0) {
            var parent_tr = jQuery(c[0]).closest('table').find('thead tr.first');
            var new_index = 0;
            var new_cell;
            parent_tr.find('td, th').each(function() {
                if (new_index <= i) {
                    new_cell = jQuery(this);
                    i = i - this.colSpan + 1;
                    new_index++;
                }
            });
            return new_cell;
        }
        else {
            return false;
        }
    };

    this.findHeader = function(hname, pname, is_parent) {
        pname = (typeof pname === 'undefined') ? false : pname;
        is_parent = (typeof is_parent === 'undefined') ? false : is_parent;

        var reg_test = new RegExp(hname);
        var reg_p_test;
        if (pname !== false) {
            reg_p_test = new RegExp(pname);
        }
        return player_table_header.find('th').filter(function() {
            var h_j = jQuery(this);
            if (reg_test.test(h_j.text())) {
                if (is_parent || !pname) {
                    return true;
                }
                else {
                    var h_index = getIdxSpan(h_j);
                    var p_head = self.findIdxSpan(h_index, h_j);
                    return reg_p_test.test(p_head.text());
                }
            }
            else {
                return false;
            }
        });
    };

    this._findSubChildren = function(cell) {
        var child_list = [];
        var child_idx = -1;
        var par_idx_start = getIdxSpan(cell);

        var start_found = false;
        var sub_headers = cell.parent('tr').next('tr').find('td, th');
        sub_headers.each(function() {
            var sub_header = jQuery(this);
            if (start_found) {
                if (sub_header.hasClass('horizontal-spacer')) {
                    return false;
                }
                else {
                    child_list.push(sub_header);
                }
            }
            else {
                child_idx += this.colSpan;
                if (child_idx >= par_idx_start) {
                    child_list.push(sub_header);
                    start_found = true;
                }
            }
        });

        return child_list;
    };

    this.addColspan = function(cell, num) {
        num = typeof num === "undefined" ? false : parseInt(num);

        if (cell && cell.length) {
            if (typeof num !== "number") {
                var child_list = self._findSubChildren(cell);
                var child_len = child_list.length;
                if (child_len > 0) {
                    cell.attr('colspan', child_len);
                }
            }
            else {
                var thisSpan = cell[0].colSpan;
                cell.attr('colspan', thisSpan + num);
            }
        }
    };

    this.space_cell = `<td class="${fp} horizontal-spacer"></td>`;
    this.space_v_cell = `<th class="${fp} vertical-spacer bottom">&nbsp;</th>`;

    this.addCells = function(idx, data, add_empty) {
        if (!(Number.isInteger(idx) && idx >= 0)) return;

        add_empty = (typeof add_empty === 'undefined') ? false : add_empty;

        player_table_rows.each(function() {
            var currRow = jQuery(this);
            var currRowTds = currRow.find('td, th');

            var target_cell = currRowTds.eq(idx);
            var cell_data = makeJquery(data);

            if (target_cell.hasClass('right') && !target_cell.hasClass(fp)) {
                target_cell.removeClass('right');
                cell_data.addClass('right');
            }
            if (target_cell.hasClass('bottom') || currRow.hasClass('last')) {
                cell_data.addClass('bottom');
            }

            if (add_empty) {
                cell_data = cell_data.add(jQuery(self.space_cell));
            }

            if (currRow.hasClass('repeated')) {
                if (target_cell.hasClass('leaf')) {
                    cell_data = null;
                }
                else {
                    cell_data = self.space_v_cell;
                }
            }

            target_cell.after(cell_data);
        });
    };
};

var tableUtils = new TableUtils();

function canAddColumns() {
    return header_index > -1 || hasProjectionTable;
}

function addColumns() {
    if (!canAddColumns()) return;

    var projection_header = `<th style="width: 2%;" class="leaf ${fp} ${fp}Projections ${fp}ProjectionsHeader" title="Consensus point projections from FantasyPros (via ${fp})">FPros</th>`;
    var projection_cell = jQuery(`<td class="${fp} ${fp}Projections ${fp}ProjectionsData">${loadingDiv}</td>'`);

    if (onMatchupPreviewPage) {
        projection_cell.addClass('text-right');
        var newprojcell = `<td class="text-right ${fp} ${fp}Projections ${fp}ProjectionsTotal">--</td>`;
        var blank_cell = `<td class="${fp}">&nbsp;</td>`;
        var space_v_cell = tableUtils.space_v_cell;

        if (show_proj) {
            proj_head.each(function() {
                var this_proj_head = jQuery(this);
                var proj_index = getIdxSpan(this_proj_head);
                var parent_head = tableUtils.findIdxSpan(proj_index, this_proj_head);
                tableUtils.addColspan(parent_head, 1);
            });

            var matchup_proj_heads = player_table_header.find('th').filter(function() {
                return (jQuery(this).text() === 'Proj' || jQuery(this).text() === 'Projected');
            });
            tableUtils.addHeader(matchup_proj_heads, projection_header, '6%');

            var this_scoreboard = playerTable.find('tr.scoreboard').closest('table');
            var this_scoreboard_projected = this_scoreboard.find('thead tr th').filter(function() {
                return jQuery(this).text() === 'Projected';
            });
            if (this_scoreboard_projected.length) {
                var scoreboard_last = this_scoreboard.find('tbody tr:last td:last');
                tableUtils.addColspan(scoreboard_last, 1);
            }
        }

        playerTable.each(function() {
            var currTab = jQuery(this);

            var this_proj_header = currTab.find('th').filter(function() {
                return (jQuery(this).text() === 'Proj' || jQuery(this).text() === 'Projected');
            }).first();
            var this_proj_header_idx = this_proj_header.index();

            if (this_proj_header_idx === -1) return;

            var starter_found = false;
            var currRows = currTab.find('tbody').find(player_table_row_selector);
            currRows.each(function() {
                var currRow = jQuery(this);
                var currRowTds = currRow.find('td, th');
                var this_proj_cell = currRowTds.eq(this_proj_header_idx);

                var total_cell = projection_cell;
                if (currRow.hasClass('divider')) {
                    if (!starter_found) {
                        total_cell = newprojcell;
                        this_proj_cell.html('--');
                        this_proj_cell.addClass(`${fp}FleaTotal`);
                        starter_found = true;
                    }
                    else {
                        total_cell = blank_cell;
                    }
                }
                else if (currRow.hasClass('scoreboard')) {
                    total_cell = newprojcell;
                }
                else if (currRow.hasClass('repeated')) {
                    total_cell = space_v_cell;
                }
                else if (currRowTds.first().text() === 'Optimum') {
                    total_cell = blank_cell;
                }

                total_cell = makeJquery(total_cell);

                if (this_proj_cell.hasClass('bottom')) {
                    total_cell.addClass('bottom');
                }
                if (this_proj_cell.hasClass('right')) {
                    this_proj_cell.removeClass('right');
                    total_cell.addClass('right');
                }

                if (show_proj) {
                    this_proj_cell.after(total_cell);
                }
            });
        });
    }
    else {
        var space_header = `<th class="${fp} horizontal-spacer"></th>`;

        var spark_header = `<th style="width: 4%;" class="leaf ${fp} ${fp}Spark ${fp}SparkHeader" title="Graph of fantasy points over previous weeks (via ${fp})">Trend</th>`;
        var top_rank_header = `<th colspan="2" class="top left right ${fp} ${fp}RankingsTop ${fp}RankingsTopHeader" title="Projected position rank (lower is better) with 95% confidence interval from FantasyPros (via ${fp})">Proj Rank (±Range)</th>`;
        var rank_header = `<th colspan="2" style="text-align: center;" class="leaf left ${fp} ${fp}Rankings ${fp}RankingsHeader" title="Projected position rank (lower is better) for *this week* from FantasyPros (via ${fp})">This Week</th>`;
        var ros_header = `<th colspan="2" style="text-align: center;" class="leaf right ${fp} ${fp}Ros ${fp}RosHeader" title="Projected position rank (lower is better) for *the rest of the season* from FantasyPros (via ${fp})">Remaining</th>`;
        var depth_header = `<th style="width: 4%;" class="leaf ${fp} ${fp}Depth ${fp}DepthHeader" title="Depth chart information (via ${fp})">Depth</th>`;

        var spark_cell = `<td class="${fp} ${fp}Spark ${fp}SparkData">${loadingDiv}</td>`;
        var rank_cell = `<td style="width: 2%;" class="left ${fp} ${fp}Rankings ${fp}RankingsData">${loadingDiv}</td>`;
        var rank_std_cell = `<td style="width: 2%;" class="right ${fp} ${fp}Rankings ${fp}RankingsStdevData"></td>`;
        var ros_cell = `<td style="width: 2%;" class="${fp} ${fp}Ros ${fp}RosData">${loadingDiv}</td>`;
        var ros_std_cell = `<td style="width: 2%;" class="right ${fp} ${fp}Ros ${fp}RosStdevData"></td>`;
        var depth_cell = `<td class="${fp} ${fp}Depth ${fp}DepthData">${loadingDiv}</td>`;

        var rnk_header_default = tableUtils.findHeader('^Rank$', false, true);
        rnk_header_default.css('width', '3%');

        var fant_header_default = tableUtils.findHeader('^Last [0-9]+$|^Total$|^Avg$', '^Fantasy$');
        fant_header_default.css('width', '4%');

        var seas_header_default = tableUtils.findHeader('^Season$');
        seas_header_default.css('width', '5%');

        if (show_depth) {
            var name_head = player_table_header.find('th').filter(function() {
                return jQuery(this).text() === 'Name';
            });
            var name_index = getIdxSpan(name_head);
            var parent_name_head = tableUtils.findIdxSpan(name_index, name_head);

            tableUtils.addHeader(name_head, depth_header);
            tableUtils.addColspan(parent_name_head);
            tableUtils.addCells(name_index, depth_cell);
        }

        var proj_index = getIdxSpan(proj_head);
        var parent_head = tableUtils.findIdxSpan(proj_index, proj_head);

        if (!parent_head || !parent_head.length) {
            show_proj = false;
            show_rank = false;
            show_ros = false;
        }

        if (show_proj) {
            tableUtils.addHeader(proj_head, projection_header);
            tableUtils.addColspan(parent_head);
            tableUtils.addCells(proj_index, projection_cell);
        }

        if (show_rank || show_ros) {
            var top_rank_header_j = jQuery(top_rank_header);
            var top_rank_combine = jQuery(space_header).add(top_rank_header_j);
            parent_head.after(top_rank_combine);

            if (show_rank && show_ros) {
                tableUtils.addColspan(top_rank_header_j, 2);
            }

            var trh_idx = getIdxSpan(top_rank_header_j) - 1;
            var trh_subcell;

            if (show_rank) {
                var rank_header_j = jQuery(rank_header);
                var add_spacer = false;
                if (!show_ros) {
                    rank_header_j.addClass('right');
                    rank_header_j = rank_header_j.add(jQuery(space_header));
                    add_spacer = true;
                }
                trh_subcell = top_rank_header_j.parent().next().find('th');
                trh_subcell.eq(trh_idx).after(rank_header_j);

                tableUtils.addCells(trh_idx, rank_cell);
                tableUtils.addCells(trh_idx + 1, rank_std_cell, add_spacer);
            }
            if (show_ros) {
                var ros_header_j = jQuery(ros_header);
                var ros_cell_j = jQuery(ros_cell);
                if (!show_rank) {
                    ros_header_j.addClass('left');
                    ros_cell_j.addClass('left');
                }
                else {
                    trh_idx += 1;
                }
                ros_header_j = ros_header_j.add(jQuery(space_header));
                trh_subcell = top_rank_header_j.parent().next().find('th');
                trh_subcell.eq(trh_idx).after(ros_header_j);

                if (show_rank) {
                    trh_idx += 1;
                }

                tableUtils.addCells(trh_idx, ros_cell_j);
                tableUtils.addCells(trh_idx + 1, ros_std_cell, true);
            }
        }

        if (show_spark) {
            var last_fantasy_head = playerTable.find('tr th').filter(function() {
                return /Season|Avg/.test(jQuery(this).text());
            });
            var fantasy_index = getIdxSpan(last_fantasy_head);
            var fantasy_head = tableUtils.findIdxSpan(fantasy_index, last_fantasy_head);

            tableUtils.addHeader(last_fantasy_head, spark_header);
            tableUtils.addColspan(fantasy_head);
            tableUtils.addCells(fantasy_index, spark_cell);
        }

        if (onClubhousePage) {
            var last_row = player_table_body.find('tr[id^=row].last:first');

            var total_row = last_row.clone();
            last_row.find('td').removeClass('bottom');

            total_row.removeAttr('id');
            total_row.addClass(`divider strong ${fp}`);

            var total_row_tds = total_row.find('td');
            total_row_tds.each(function(i) {
                var t_j = jQuery(this);
                t_j.addClass('bottom');

                if (i === 0) {
                    t_j.addClass(fp);
                    t_j.html('<span class="player">Total</span>');
                }
                else {
                    t_j.empty();
                    t_j.removeClass(function(index, css) {
                        return (css.match(/(^|\s)FantasyPlus\S+/g) || []).join('');
                    });
                    t_j.addClass(fp);

                    if (!t_j.hasClass('horizontal-spacer')) {
                        t_j.html('&nbsp;');
                    }
                }
            });

            var new_proj_index = getIdxSpan(proj_head);
            var tot_proj_cell = total_row_tds.eq(new_proj_index);
            tot_proj_cell.html('—');
            tot_proj_cell.addClass(`${fp}FleaTotal`);
            if (show_proj) {
                tot_proj_cell = tot_proj_cell.next();
                tot_proj_cell.html('—');
                tot_proj_cell.addClass(`${fp}Projections ${fp}ProjectionsTotal`);
            }
            tot_proj_cell.next().html('—');
            tot_proj_cell.next().addClass(`${fp}ActualTotal`);

            last_row.after(total_row);
        }
    }
}

override(parseLeagueSettings, 'run', applyCompose(function(ret) {
    var league_settings = ret;

    league_settings['siteType'] = 'fleaflicker';

    var league_table = jQuery('#body-center-main > table', this.league_data);

    var league_headers = league_table.find('tr td.table-heading').closest('tr');
    //todo separate these by who it applies to, in td.right
    //todo calculate bonuses based on some averages maybe? like yards per catch, etc.

    var point_type;

    //well, this got really complicated really fast.
    var kick_dist = [17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65];
    var kick_counts = [0,5,27,68,62,77,78,62,69,57,94,65,71,84,81,71,94,60,93,77,76,89,65,78,56,71,76,80,70,63,63,75,67,57,54,55,58,30,19,6,6,5,1,0,2,0,0,1,0];

    var kick_tot = 0;
    for (let c=0; c<kick_counts.length; c++) {
        kick_tot += kick_counts[c];
    }
    var min_dist = kick_dist[0];
    var max_dist = kick_dist[kick_dist.length - 1];

    function getValue(setting_name, bonus) {
        bonus = (typeof bonus === 'undefined') ? false : bonus;
        var settingVals = [];

        var this_header = league_headers.find("td.table-heading:contains('" + point_type + "')").closest('tr');
        var league_tds;
        if (this_header.parent('thead').length > 0) {
            league_tds = league_table.find('tbody tr:first').nextUntil(league_headers, 'tr').addBack();
        }
        else {
            league_tds = this_header.nextUntil(league_headers, 'tr');
        }
        var search_regex = new RegExp('^' + setting_name + '(?:(s|es))?(?: [(]Quantity[)])?$');
        var settingTds = league_tds.find("td.left strong").filter(function() { return search_regex.test(jQuery(this).text()); }).closest('td.left');

        if (settingTds && settingTds.length > 0) {
            jQuery.each(settingTds, function(sindex, svalue) {
                var scell = jQuery(svalue);
                var s_contents = scell.contents();

                var s_val = parseFloat(s_contents[0].textContent);

                var for_every = false;
                var for_every_text = s_contents[1].textContent.trim();
                if (for_every_text.indexOf(' for every') > -1) {
                    for_every = true;

                    var for_every_num = 1;
                    var for_every_cell = scell.find('span.for-every');
                    if (for_every_cell.length > 0) {
                        for_every_num = parseFloat(for_every_cell.text().trim());
                    }

                    s_val = parseFloat(s_val / for_every_num);
                }

                var quant = scell.find("strong:contains('(Quantity)')");
                var s_name = s_contents.filter('strong:first');
                var bonus_index = s_contents.index(s_name);
                var bonus_details = s_contents.slice(bonus_index + 1);
                var bonus_type = '';
                var is_bonus = false;
                var skip = false;
                var every_alt = s_contents.get(bonus_index - 1).textContent.trim();
                var every_yards = for_every && (/yards? covered/.test(for_every_text) || /yards? covered/.test(every_alt));

                if (point_type !== 'Kicking' && every_yards) {
                    is_bonus = true;
                    skip = true;
                }

                if (bonus_details.length) {
                    bonus_type = bonus_details[0].textContent.trim();
                    if (point_type === 'Kicking' && (/Field Goals\? (Made|Missed)/.test(setting_name))) {
                        if (!/^\(/.test(bonus_type) && quant.length) {
                            is_bonus = true;
                        }
                    }
                    else if (!/^\(/.test(bonus_type)) {
                        is_bonus = true;
                    }
                    else if (every_yards) {
                        is_bonus = true;
                        skip = true;
                    }
                }

                var expected_yards = 36.36; // from historical data, last 3 years
                var expected_pct = 1;

                if (is_bonus === bonus) {
                    var bonus_low, bonus_high;
                    if (is_bonus === false) {
                        if (point_type !== 'Kicking') {
                            settingVals.push(s_val);
                        }
                        else {
                            if (!every_yards && (!bonus_details.length || /^\(/.test(bonus_type))) {
                                settingVals.push(s_val);
                            }
                            else {
                                bonus_low = bonus_details.filter('span.text-muted.low').text().trim();
                                var bonus_low_adj = min_dist;
                                if (bonus_low) {
                                    bonus_low = parseFloat(bonus_low);
                                    bonus_low_adj = Math.min(Math.max(bonus_low, min_dist), max_dist);
                                }
                                bonus_high = bonus_details.filter('span.text-muted.high').text().trim();
                                var bonus_high_adj = max_dist;
                                if (bonus_high) {
                                    bonus_high = parseFloat(bonus_high);
                                    bonus_high_adj = Math.max(Math.min(bonus_high, max_dist), min_dist);
                                }

                                if (bonus_low || bonus_high) {
                                    var kick_index_low = kick_dist.indexOf(bonus_low_adj);
                                    var kick_index_high = kick_dist.indexOf(bonus_high_adj);
                                    var kick_dist_cut = kick_dist.slice(kick_index_low, kick_index_high + 1);
                                    var kick_counts_cut = kick_counts.slice(kick_index_low, kick_index_high + 1);

                                    if (every_yards) {
                                        var kick_extra_counts = kick_counts.slice(kick_index_high + 1);
                                        for (let k=0; k<kick_extra_counts.length; k++) {
                                            kick_counts_cut[kick_counts_cut.length - 1] += kick_extra_counts[k];
                                        }

                                        var sumkick = 0;
                                        for (let i=0; i< kick_dist_cut.length; i++) {
                                            sumkick += kick_dist_cut[i] * kick_counts_cut[i];
                                        }
                                        var sumkick_count = 0;
                                        for (let j=0; j< kick_counts_cut.length; j++) {
                                            sumkick_count += kick_counts_cut[j];
                                        }

                                        expected_yards = parseFloat(sumkick / sumkick_count);

                                        if (bonus_high) {
                                            expected_yards = Math.min(expected_yards, bonus_high);
                                        }
                                        if (bonus_low) {
                                            expected_yards -= bonus_low;
                                        }
                                    }
                                    else {
                                        expected_yards = 1;
                                    }

                                    expected_pct = 0;
                                    for (let e=0; e < kick_counts_cut.length; e++) {
                                        expected_pct += parseFloat(kick_counts_cut[e] / kick_tot);
                                    }
                                }

                                s_val *= expected_yards * expected_pct;

                                settingVals.push(s_val);
                            }
                        }
                    }
                    else {
                        //todo do what i did with kickers here, to estimate things like "4 extra points for every Rushing TD of 80 or more yards"
                        if (!skip && !(setting_name.indexOf(' TD') > -1 && !quant.length)) {
                            var bonusDict = {};
                            bonusDict['pts'] = s_val;
                            bonusDict['is_per'] = for_every;

                            bonus_low = bonus_details.filter('span.text-muted.low').text().trim();
                            if (bonus_low) {
                                bonus_low = parseFloat(bonus_low);
                            }
                            bonus_high = bonus_details.filter('span.text-muted.high').text().trim();
                            if (bonus_high) {
                                bonus_high = parseFloat(bonus_high);
                            }

                            if (bonus_low !== '' && bonus_high === '' && bonus_type && /is exactly/.test(bonus_type)) {
                                bonus_high = bonus_low;
                            }

                            bonusDict['low'] = bonus_low;
                            bonusDict['high'] = bonus_high;

                            settingVals.push(bonusDict);
                        }
                    }
                }
            });
        }

        if (bonus === false) {
            var new_pts = 0;
            for (let f=0; f<settingVals.length; f++) {
                new_pts += settingVals[f];
            }
            settingVals = new_pts;
        }
        else if (settingVals.length === 0) {
            settingVals = null;
        }

        return settingVals;
    }

    point_type = 'Passing';
    league_settings['pass_yds'] = getValue('Passing Yard') || 0;
    league_settings['pass_yds_bonus'] = getValue('Passing Yard', true);
    league_settings['pass_tds'] = getValue('Passing TD') || 0;
    league_settings['pass_tds_bonus'] = getValue('Passing TD', true);
    league_settings['pass_ints'] = getValue('Interception') || 0;
    league_settings['pass_ints_bonus'] = getValue('Interception', true);
    league_settings['pass_cmp'] = getValue('Passing Completion') || 0;
    league_settings['pass_cmp_bonus'] = getValue('Passing Completion', true);
    league_settings['pass_icmp'] = getValue('Incomplete Pass') || 0;
    league_settings['pass_icmp_bonus'] = getValue('Incomplete Pass', true);
    league_settings['pass_att'] = getValue('Passing Attempt') || 0;
    league_settings['pass_att_bonus'] = getValue('Passing Attempt', true);

    point_type = 'Rushing';
    league_settings['rush_yds'] = getValue('Rushing Yard') || 0;
    league_settings['rush_yds_bonus'] = getValue('Rushing Yard', true);
    league_settings['rush_tds'] = getValue('Rushing TD') || 0;
    league_settings['rush_tds_bonus'] = getValue('Rushing TD', true);
    league_settings['rush_att'] = getValue('Rushing Attempt') || 0;
    league_settings['rush_att_bonus'] = getValue('Rushing Attempt', true);

    point_type = 'Receiving';
    league_settings['rec_yds'] = getValue('Receiving Yard') || 0;
    league_settings['rec_yds_bonus'] = getValue('Receiving Yard', true);
    league_settings['rec_tds'] = getValue('Receiving TD') || 0;
    league_settings['rec_tds_bonus'] = getValue('Receiving TD', true);
    league_settings['rec_att'] = getValue('Catch') || 0;
    league_settings['rec_att_bonus'] = getValue('Catch', true);

    point_type = 'Kicking';
    league_settings['xpt'] = getValue('XP') || 0;
    league_settings['xpt_bonus'] = getValue('XP', true);
    league_settings['fga'] = getValue('Field Goal Attempt') || 0;
    league_settings['fga_bonus'] = getValue('Field Goal Attempt', true);
    league_settings['fg'] = getValue('Field Goals? Made') || 0;
    league_settings['fg_bonus'] = getValue('Field Goals? Made', true);
    league_settings['fgm'] = getValue('Field Goals? Missed') || 0;
    league_settings['fgm_bonus'] = getValue('Field Goals? Missed', true);

    point_type = 'Misc';
    league_settings['fumbles'] = getValue('Fumbles? Lost') || getValue('Fumble') || 0;
    league_settings['fumbles_bonus'] = getValue('Fumbles? Lost', true) || getValue('Fumble', true);

    point_type = 'Defense';
    league_settings['tka'] = getValue('Assisted Tackle') || getValue('Total Tackle') || 0;
    league_settings['tka_bonus'] = getValue('Assisted Tackle', true) || getValue('Total Tackle', true);
    league_settings['tks'] = getValue('Solo Tackle') || getValue('Total Tackle') || 0;
    league_settings['tks_bonus'] = getValue('Solo Tackle', true) || getValue('Total Tackle', true);
    league_settings['pd'] = getValue('Pass(?:es)? Defended') || 0;
    league_settings['pd_bonus'] = getValue('Pass(?:es)? Defended', true);

    league_settings['ff'] = getValue('Fumbles? Forced') || 0;
    league_settings['ff_bonus'] = getValue('Fumbles? Forced', true);
    league_settings['fr'] = getValue('Fumbles? Recovered') || 0;
    league_settings['fr_bonus'] = getValue('Fumbles? Recovered', true);

    league_settings['sk'] = getValue('Sack') || 0;
    league_settings['sk_bonus'] = getValue('Sack', true);
    league_settings['sf'] = getValue('Safety') || 0;
    league_settings['sf_bonus'] = getValue('Safety', true);
    league_settings['int'] = getValue('Interception') || 0;
    league_settings['int_bonus'] = getValue('Interception', true);
    league_settings['deftd'] = getValue('Defensive TD') || getValue('INT Return TD') || getValue('Fumble Return TD') || 0;
    league_settings['deftd_bonus'] = getValue('Defensive TD', true) || getValue('INT Return TD', true) || getValue('Fumble Return TD', true);

    league_settings['ya'] = getValue('Net Yards? Allowed') || 0;
    league_settings['ya_bonus'] = getValue('Net Yards? Allowed', true);

    league_settings['pa'] = getValue('Points? Allowed') || getValue('Offensive . Special Teams Points? Allowed') || getValue('Offensive Points? Allowed [(]FG, Pass TD, Rush TD[)]') || 0;
    league_settings['pa_bonus'] = getValue('Points? Allowed', true) || getValue('Offensive . Special Teams Points? Allowed', true) || getValue('Offensive Points? Allowed [(]FG, Pass TD, Rush TD[)]', true);

    this.league_settings = league_settings;
    dlog.log(league_settings);
    return league_settings;
}));

function setDSTname(player_name) {
    return player_name.split(' ').pop();
}

function calcBonus(bonus_type, pd) {
    var adj = 0;
    var b_list = parseLeagueSettings.league_settings[bonus_type + '_bonus'];

    if (!(b_list && b_list.length)) return adj;

    dlog.info(pd);

    for (let l=0; l < b_list.length; l++) {
        var bonus_obj = b_list[l];
        var b_pts = bonus_obj['pts'];
        var b_low = bonus_obj['low'];
        var b_high = bonus_obj['high'];
        var b_per = bonus_obj['is_per'];

        var is_b_low = (typeof b_low === "number");
        var is_b_high = (typeof b_high === "number");

        var b_match = false;

        if (b_per) {
            b_match = true;
        }
        else {
            if (is_b_low && is_b_high) {
                b_match = (b_low <= pd && b_high >= pd);
            }
            else if (is_b_low) {
                b_match = (b_low <= pd);
            }
            else if (is_b_high) {
                b_match = (b_high >= pd);
            }
        }

        if (b_match) {
            var adj_val = 0;
            if (b_per) {
                var pd_apply = pd;
                //this math will be wonky if you have negative numbers, but that's just bad league settings
                if (is_b_low && is_b_high) {
                    if (b_low <= 0) {
                        b_low += 1;
                    }
                    pd_apply = Math.max(Math.min(pd - b_low + 1, b_high - b_low + 1), 0);
                }
                else if (is_b_low) {
                    pd_apply = Math.max(pd - b_low, 0);
                }
                else if (is_b_high) {
                    pd_apply = Math.max(Math.min(pd, b_high), 0);
                }

                adj_val = b_pts * pd_apply;
            }
            else {
                adj_val = b_pts;
            }

            adj += adj_val;
        }
    }

    return adj;
}

function calcAdjProjections(player_data) { return 0; }

RowData.prototype._getPlayerInfo = function() {
    var player_name_div = this.player_cell.find('div.player-name .player-text');
    var player_info_div = this.player_cell.find('div.player-info');

    var player_name = player_name_div.text().trim();
    var team_name =  player_info_div.find('span.player-team').text().trim();
    var pos_name = player_info_div.find('span.position').text().trim();
    var new_posses;

    if (pos_name === 'D/ST') {
        var psplit = player_name.split(/\s|\xa0/);
        player_name = psplit[psplit.length - 1];
        team_name = "-";
    }
    else if (pos_name.indexOf('/') > -1) {
        new_posses = pos_name.split('/');
        pos_name = [];
        new_posses.forEach(function(np) {
            pos_name.push(np.trim());
        });
    }

    if (team_name in team_abbrev_fix_fleaflicker) {
        team_name = team_abbrev_fix_fleaflicker[team_name];
    }

    player_name = player_name.replace('*', '');

    var player_href = player_name_div.attr('href');
    var player_id = null;
    if (player_href) {
        player_id = player_href.split('-').pop();
    }

    return {
        'player_name': player_name,
        'pos_name': pos_name,
        'team_name': team_name,
        'player_id': player_id,
        'player_href': player_href
    };
};

function decrementPids() {
    total_player_ids--;
    if (total_player_ids <= 0) {
        fetchFleaflickerIds.resolve();
    }
}

override(getProjectionData, '_fetchActivityData', function(original) {
    return function(rowData) {
        var currRow = rowData.currRow;
        var player_href = rowData.player_href;
        var player_id = rowData.player_id;

        jQuery.ajax({
            url: player_href,
            method: 'get',
            timeout: ajax_timeout,
            context: {
                curr_row: currRow,
                p_href: player_href,
                pid: player_id
            }
        }).fail(function() {
            dlog.log('Could not get player info: ' + this.p_href);
            insertAdjAvg(this.curr_row, null, null, [], []);
        }).done(function (po) {
            if (!po) {
                dlog.log('No data in player info: ' + this.p_href);
                insertAdjAvg(this.curr_row, null, null, [], []);
            }
            else {
                po = cleanHTML(po);
                var podata = jQuery(po);

                var p_data = activity_data_current_season_site[this.pid];
                var p_data_league = p_data[league_id];

                var points_table = jQuery('table#table_0', podata);
                var points_table_rows = points_table.find('tbody').find(player_table_row_selector).not('.divider');

                var player_bye_cell = points_table_rows.find('div.pro-opp-matchup').filter(function () {
                    return jQuery(this).text().trim() === 'BYE';
                });
                var player_bye_week = player_bye_cell.parents('tr').index();

                //TODO: is this wrong?
                var player_activity_pts = jQuery.map(points_table_rows, function (ptval, i) {
                    //dlog.log(ptval);
                    //dlog.log(typeof ptval);
                    return jQuery(ptval).find('td:last').text();
                });

                for (let i = 0; i < player_activity_pts.length; i++) {
                    if (i === player_bye_week) {
                        player_activity_pts[i] = null;
                        p_data['games_played'][i] = 'BYE';
                    }
                    else if (player_activity_pts[i] === "—") {
                        player_activity_pts[i] = null;
                        p_data['games_played'][i] = 0;
                    }
                    else if (player_activity_pts[i] === "") {
                        player_activity_pts[i] = null;
                        p_data['games_played'][i] = null;
                    }
                    else {
                        player_activity_pts[i] = parseFloat(player_activity_pts[i]);
                        p_data['games_played'][i] = 1;
                    }
                }

                p_data['games_played_updated'] = current_time;
                p_data_league['last_updated'] = current_time;
                p_data_league['weekly_points'] = player_activity_pts;

                insertAdjAvg(this.curr_row, null, null, p_data['games_played'], p_data_league['weekly_points']);
            }
        });
    }
});

override(getProjectionData, '_popNA', applyBefore(function(cell, datatype) {
    if (onMatchupPreviewPage) {
        decrementPids();
        //return popCell(cell, '', datatype);
    }
}));

override(getProjectionData, '_calcAndPop', applyBefore(function(rowData, datatype) {
    if (datatype === 'depth' && rowData.translation_pos === null) {
        var pos_name = rowData.pos_name;
        if (pos_name.constructor === Array) {
            var new_pos_list = [];
            pos_name.forEach(function (pn) {
                if (pn === 'DL') {
                    new_pos_list.push('DE', 'DT');
                }
                else if (pn === 'DB') {
                    new_pos_list.push('CB', 'S');
                }
                else {
                    new_pos_list.push(pn);
                }
            });
            pos_name = new_pos_list;
        }
        else {
            if (pos_name === 'DL') {
                pos_name = ['DE', 'DT'];
            }
            else if (pos_name === 'DB') {
                pos_name = ['CB', 'S'];
            }
        }
        rowData.translation_pos = pos_name;
    }

    if (onMatchupPreviewPage) {
        var player_last = rowData.player_href.split('/').pop();
        var player_name_split = player_last.split('-');

        var player_split_cap = [];
        for (let i = 0; i < player_name_split.length; i++) {
            player_split_cap.push(player_name_split[i].toUpperCase());
        }
        var player_href_name = player_split_cap.join(' ');

        var seenId = storage_translation_data.hasOwnProperty('ID_' + rowData.player_id);
        //TODO i think this is wrong for idps
        var hasAllData = alldata.hasOwnProperty(player_href_name + '|' + rowData.getPosName() + '|' + rowData.team_name);

        if (pos_name === "D/ST" || seenId || hasAllData) {
            if (hasAllData) {
                rowData.translation_name = player_href_name;
            }
            else if (seenId) {
                rowData.translation_name = storage_translation_data['ID_' + rowData.player_id];
            }

            decrementPids();
        }
        else {
            //this is going to return the wrong value, but it doesnt really matter
            return jQuery.ajax({
                url: rowData.player_href,
                method: 'get',
                timeout: ajax_timeout,
                context:{
                    'datatype': datatype,
                    'rowData': rowData,
                    'self': this
                }
            }).done(function(pl) {
                var clean_pl = cleanHTML(pl);
                var pldata = jQuery(clean_pl);

                this.rowData.translation_name = pldata.find('#left-container > div.panel > div.panel-heading').text();

                var new_id_data = {};
                storage_translation_data['ID_' + this.rowData.player_id] = this.rowData.translation_name;
                new_id_data[storageTranslationKey] = storage_translation_data;
                chrome.storage.local.set(new_id_data);

                return this.self._calcAndPop(this.rowData, this.datatype);
            }).fail(function() {
                chrome.runtime.sendMessage({request: 'fetch_fail', value: this.rowData.player_href});
                return popCell(this.rowData.cell, '--', this.datatype);
            }).always(function() {
                decrementPids();
            });
        }
    }
}));

override(reDefer, 'run', applyAfter(function() {
    if (onMatchupPreviewPage) {
        fetchFleaflickerIds = jQuery.Deferred();
    }
}));

isCurrentWeek = function() { return is_current_week; };

addData.blank = '—'; //todo maybe fix to show columns anyway, or at least ros

override(addData, '_proj', applyBefore(function(data) {
    if (isCurrentWeek()) {
        total_player_ids = data.length;
    }
}));

addData.projTotals = function() {
    if (onClubhousePage) {
        var sumTotal, sumTotalFlea, sumTotalActual;
        sumTotal = sumTotalFlea = sumTotalActual = 0;

        var proj_tot_cell = player_table_body.find('tr td.FantasyPlusProjectionsTotal');
        var proj_tot_cell_idx = getIdxSpan(proj_tot_cell);

        var flea_tot_cell = player_table_body.find('tr td.FantasyPlusFleaTotal');
        var flea_tot_cell_idx = getIdxSpan(flea_tot_cell);

        var act_tot_cell = player_table_body.find('tr td.FantasyPlusActualTotal');
        var act_tot_cell_idx = getIdxSpan(act_tot_cell);

        var start_rows = player_table_rows.first().nextUntil('.divider').addBack();
        start_rows.each(function() {
            var this_row = jQuery(this);

            var sumpts = 0;
            if (show_proj) {
                let proj_cell = this_row.find('td').eq(proj_tot_cell_idx);
                sumpts = parseFloat(proj_cell.text());
                if (sumpts) {
                    sumTotal += sumpts;
                }
            }

            var flea_cell = this_row.find('td').eq(flea_tot_cell_idx);
            var sumptsFlea = parseFloat(flea_cell.text());
            if (sumptsFlea) {
                sumTotalFlea += sumptsFlea;
            }

            var act_cell = this_row.find('td').eq(act_tot_cell_idx);
            var sumptsActual = parseFloat(act_cell.text());
            if (sumptsActual) {
                sumTotalActual += sumptsActual;
            }
        });

        if (show_proj) {
            var sumTotal_rnd = Math.round(sumTotal * 10) / 10;
            proj_tot_cell.html(sumTotal_rnd);
        }

        var sumTotalFlea_rnd = Math.round(sumTotalFlea * 10) / 10;
        flea_tot_cell.html(sumTotalFlea_rnd);

        var sumTotalActual_rnd = Math.round(sumTotalActual * 10) / 10;
        act_tot_cell.html(sumTotalActual_rnd);

        dlog.log('totals done');
        totalsDone.resolve();
    }
    else if (onMatchupPreviewPage) {
        if (!show_proj) {
            fetchFleaflickerIds.resolve();
        }
        jQuery.when(fetchFleaflickerIds).done(function() {
            var scoreboard_table = base_table.find('table tr.scoreboard').closest('table');
            var matchupTables = playerTable.not(scoreboard_table);

            matchupTables.each(function(t) {
                var currTable = jQuery(this);
                var currTableBody = currTable.find('tbody');

                var matchup_total = 0;
                var matchup_flea_total = 0;

                var proj_tot_cell = currTableBody.find('tr td.FantasyPlusProjectionsTotal');
                var proj_tot_cell_idx = getIdxSpan(proj_tot_cell);

                var flea_tot_cell = currTableBody.find('tr td.FantasyPlusFleaTotal');
                var flea_tot_cell_idx = getIdxSpan(flea_tot_cell);

                var start_rows = currTableBody.find(player_table_row_selector).first().nextUntil('.divider').addBack();

                start_rows.each(function() {
                    var this_row = jQuery(this);

                    var proj_value = 0;
                    if (show_proj) {
                        var proj_cell = this_row.find('td').eq(proj_tot_cell_idx);
                        proj_value = parseFloat(proj_cell.text());
                        if (proj_value) {
                            matchup_total += proj_value;
                        }
                    }

                    var flea_cell = this_row.find('td').eq(flea_tot_cell_idx);
                    var flea_value = parseFloat(flea_cell.text());
                    if (flea_value) {
                        matchup_flea_total += flea_value;
                    }
                });

                if (show_proj) {
                    var matchup_total_rnd = Math.round(matchup_total * 10) / 10;
                    proj_tot_cell.html(matchup_total_rnd);
                }

                var matchup_flea_total_rnd = Math.round(matchup_flea_total * 10) / 10;
                flea_tot_cell.html(matchup_flea_total_rnd);

                if (show_proj) {
                    var this_scoreboard_cell = scoreboard_table.find('.FantasyPlusProjectionsTotal').eq(t);
                    if (this_scoreboard_cell.length) {
                        var matchup_total_scor_rnd = Math.round(matchup_total * 100) / 100;
                        this_scoreboard_cell.html(matchup_total_scor_rnd);
                    }
                }
            });

            dlog.log('totals done');
            totalsDone.resolve();
        });
    }
};

function _resetTranslation() {
    if (onMatchupPreviewPage) {
        storage_translation_data = {};
    }
}

watchForChanges.target_selector = 'div#body';

if (onFreeAgencyPage) {
    watchForChanges.observerConfig.characterData = false;
    watchForChanges.observerConfig.subtree = false;
}

watchForChanges._getAcceptedChange = function(mutations) {
    var accepted = false;
    if (onMatchupPreviewPage) {
        accepted = true;
    }
    else {
        for (let m=0; m < mutations.length; m++) {
            var md = mutations[m];
            var thisMutNodes = md['addedNodes'];
            if (thisMutNodes && thisMutNodes.length) {
                for (let ma = 0; ma < thisMutNodes.length; ma++) {
                    var thisMutNode = thisMutNodes[ma];
                    var thisMutTgtParent = thisMutNode['parentElement'];
                    if (thisMutTgtParent) {
                        if (thisMutTgtParent.localName === 'div' && thisMutTgtParent.id === 'body') {
                            dlog.log('accepted');
                            accepted = true;
                            //break
                        }
                    }
                }
            }
        }
    }
    return accepted;
};