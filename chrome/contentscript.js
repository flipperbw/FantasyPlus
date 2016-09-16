/*-- TODO
- somehow adjust OPRK for shitty teams, snap %
- median
- debug/verbose mode
- nfl / fleaflicker / myfantasyleague
- return yardage
- firefox/safari
- sortable? doubt it
- option to disable/add
- option for experts
- WR1/2 from depth chart, http://www.footballoutsiders.com/stats/teamdef
- timeout for loading gif
- start doing things before the document is ready. https://gist.github.com/raw/2625891/waitForKeyElements.js, waitForKeyElements ("a.Inline", delinkChangeStat);
- use window temporary data instead of recalculating when changes are made
- starting on different tab doesnt enable anything
- insider tab
- use this "prebuilt" thing inside, intercept it and reput it in? http://games.espn.com/ffl/playertable/prebuilt/manageroster?leagueId=1496143&teamId=4&seasonId=2014&scoringPeriodId=12&view=overview&context=clubhouse&ajaxPath=playertable/prebuilt/manageroster&managingIr=false&droppingPlayers=false&asLM=false
- clicking too fast disables it until the next click...
- store historical projections
*/

/*
var tag = document.createElement("script");
tag.type="text/javascript";
tag.src = "https://code.jquery.com/jquery-latest.min.js";
document.body.appendChild(tag);
*/

var debug_mode = false;
var debug_mode = true;

chrome.storage.local.clear();

//chrome.storage.local.remove('fp_player_activity_data');
//chrome.storage.local.get('fp_player_activity_data', function(d) { console.info(d); });

jQuery.noConflict();

// GLOBALS
var alldata,
	settings,
	custom_cols,
	updated_time,
	updated_time_proj,
    league_id,
    league_settings_url,
	storage_league_data,
    storage_translation_data,
	activity_data,
	activity_data_current_season_site,
	total_players,
    siteType,
    playerTable,
    player_table_selector,
    player_table_body,
    player_table_body_selector,
    player_table_header,
    player_table_header_selector,
    player_table_rows,
    player_table_row_selector,
    proj_head,
    player_table_header_proj_selector,
    header_index,
    player_name_selector,
    base_table_selector,
    base_table,
	page_menu_selector,
	page_menu,
	pts_total_selector,
	pts_total,
    ld_selector,
    depth_data,
    depth_data_season,
    depth_data_current_week;


function dlog(o) {
    if (debug_mode) {
        console.log(o);
    }
}

var check_minutes = 30;
var check_minutes_avg = 10; //todo: fix this to only look if they have a game today
var ajax_timeout = 2000;

var fetch_fail = false;
var idp_fetch_fail = false;

var show_avg = true;
var show_proj = true;
var show_rank = true;
var show_ros = true;
var show_depth = true;
var show_spark = true;
var show_current = true;

season_start_map = {
	'2014': [8, 2],
	'2015': [8, 8],
	'2016': [8, 6]
}

var current_date = new Date();
var current_time = current_date.getTime();
var current_month = current_date.getMonth();
var current_year = current_date.getFullYear();

var current_season = current_year;
var current_season_avg = current_year;
var current_season_avg_week = current_year;

if (current_month < 5 || (!season_start_map[current_year] && season_start_map[current_year - 1])) {
    current_season -= 1;
}

try {
    var seasonstart = new Date(current_season, season_start_map[current_season][0], season_start_map[current_season][1], 4);
}
catch(e) {
    throw('FantasyPlus: Season ' + current_season + ' does not exist in records');
}

//maybe espn has some variable I can access for what it thinks the current season is, since it doesn't really make much sense right now. it switched over one week before the season starts this time.
var seasonstart_avg = seasonstart;
var seasonstart_avg_week = seasonstart;
var oneweekbefore = new Date(seasonstart.getTime());
oneweekbefore.setDate(oneweekbefore.getDate() - 7);

if (current_date < oneweekbefore) {
    current_season_avg -= 1;
    seasonstart_avg = new Date(current_season_avg, season_start_map[current_season_avg][0], season_start_map[current_season_avg][1], 4);
}
if (current_date < seasonstart) {
    current_season_avg_week -= 1;
    seasonstart_avg_week = new Date(current_season_avg_week, season_start_map[current_season_avg_week][0], season_start_map[current_season_avg_week][1], 4);
}

var current_week = Math.max(Math.ceil(((current_date - seasonstart) / 86400000) / 7), 1);
var current_week_avg = Math.max(Math.ceil(((current_date - seasonstart_avg_week) / 86400000) / 7), 1);

var team_abbrevs = {
    'Seattle Seahawks': 'SEA',
    'Carolina Panthers': 'CAR',
    'Arizona Cardinals': 'ARI',
    'Denver Broncos': 'DEN',
    'Los Angeles Rams': 'LA',
    'Houston Texans': 'HOU',
    'Kansas City Chiefs': 'KC',
    'Cincinnati Bengals': 'CIN',
    'New England Patriots': 'NE',
    'Minnesota Vikings': 'MIN',
    'New York Jets': 'NYJ',
    'Philadelphia Eagles': 'PHI',
    'Green Bay Packers': 'GB',
    'Buffalo Bills': 'BUF',
    'Pittsburgh Steelers': 'PIT',
    'Baltimore Ravens': 'BAL',
    'Oakland Raiders': 'OAK',
    'Jacksonville Jaguars': 'JAC',
    'Miami Dolphins': 'MIA',
    'Detroit Lions': 'DET',
    'Tennessee Titans': 'TEN',
    'Cleveland Browns': 'CLE',
    'San Francisco 49ers': 'SF',
    'New York Giants': 'NYG',
    'Chicago Bears': 'CHI',
    'Tampa Bay Buccaneers': 'TB',
    'Washington Redskins': 'WAS',
    'Atlanta Falcons': 'ATL',
    'San Diego Chargers': 'SD',
    'Indianapolis Colts': 'IND',
    'New Orleans Saints': 'NO',
    'Dallas Cowboys': 'DAL'
};

var off_positions_proj = ['qb', 'rb', 'wr', 'te', 'k'];
var def_positions_proj = ['6','8','9','10'];
var all_positions_proj = off_positions_proj.concat(def_positions_proj);
var all_positions_rank = ['qb', 'rb', 'wr', 'te', 'k', 'dst', 'dl', 'lb', 'db'];

var idp_positions = ['DL', 'DE', 'LB', 'DB', 'CB', 'S'];
var idp_conversion = {'6': 'D/ST', '8': 'DL', '9': 'LB', '10': 'DB'};
var team_name_conversion = {'ARZ': 'ARI', 'GBP': 'GB', 'KCC': 'KC', 'NEP': 'NE', 'NOR': 'NO', 'RAM': 'LA', 'SDC': 'SD', 'SFO': 'SF', 'TBB': 'TB'};

var loadingUrl = chrome.extension.getURL('loading.gif');

var projDone = jQuery.Deferred();
var rankDone = jQuery.Deferred();
var rosDone = jQuery.Deferred();
var avgDone = jQuery.Deferred();
var depthDone = jQuery.Deferred();

// Temporary clearing of cache, not sure if this is needed every season or not.
chrome.storage.local.get('fp_reset_2016', function(d) { 
    if (!d.hasOwnProperty('fp_reset_2016') || (d['fp_reset_2016'] !== true)) {
        chrome.storage.local.clear();
        chrome.storage.local.set({'fp_reset_2016': true});
    }
});

var storageDepthKey = 'fp_depth_data';

if (document.URL.match(/games.espn.com/)) {
    siteType = 'espn';
    
	var onMatchupPreviewPage = document.URL.match(/ffl\/matchuppreview/);
    var onClubhousePage = document.URL.match(/ffl\/(clubhouse|dropplayers)/);
    var onFreeAgencyPage = document.URL.match(/ffl\/(freeagency|watchlist)/);
    var onLeaguePage = document.URL.match(/ffl\/leagueoffice/);
    var onLeagueSettingsPage = document.URL.match(/ffl\/leaguesetup\/settings/);
	
    base_table_selector = '.playerTableContainerDiv';
    player_table_selector = '[id^=playertable_]';
    player_table_body_selector = 'tbody';
    player_table_header_selector = 'tr.playerTableBgRowSubhead';
    player_table_row_selector = 'tr.pncPlayerRow:not(.emptyRow)';
    player_table_header_proj_selector = 'td:contains(PROJ), td:contains(ESPN)';
    player_name_selector = 'td.playertablePlayerName';
    ld_selector = 'div.games-fullcol';
    	
	var hasProjTotals = document.URL.match(/ffl\/matchuppreview/);
	var hasPlayerTable = document.URL.match(/ffl\/(freeagency|clubhouse|dropplayers|tradereview|rosterfix|watchlist)/);	
    
    jQuery('.games-footercol').remove();
    jQuery('.transitional-elements').remove();
    if (onClubhousePage) {
        jQuery('.games-alert-tilt').remove();
        jQuery('.games-alert-mod.alert-mod2.games-blue-alert').remove();
        jQuery('div.draftKings').remove();
        jQuery('iframe[src*="streak.espn.com"]').parent().remove();
        jQuery('.games-bottomcol').css('margin', 0)
        if (jQuery('.games-dates-mod').css('margin-left') == '7px') {
            jQuery('.games-dates-mod').css('margin-left', '6px');
        }
    }
    else if (onLeaguePage) {
        jQuery('.games-rightcol-spacer').remove();
        jQuery('img[usemap*="pizza-hut"]').parent().remove();
        //jQuery('a[href*="fantasyfootballtoolkit"]').parent().remove();
    }
    else if (onFreeAgencyPage) {
        jQuery('#backgroundContainer').css('width', 'auto');
        if (jQuery('.addButton').css('background-position-x') == '-38px') {
            jQuery('.addButton').css('background-position-x', '-39px');
        }
        if (jQuery('.dropButton').css('width') == '14px') {
            jQuery('.dropButton').css('width', '15px');
        }
    }
    else if (onLeagueSettingsPage) {
        addLeagueSettings();
    }
    
    league_id = document.URL.match(/leagueId=(\d+)/)[1];
    league_settings_url = '//games.espn.com/ffl/leaguesetup/sections/scoring?leagueId=' + league_id;
    
    var storageLeagueKey = 'fp_espn_league_data_' + league_id;
    var storagePlayerKey = 'fp_espn_player_data_' + league_id;
    var storageUpdateKey = 'fp_espn_last_updated_' + league_id;
    var storageProjUpdateKey = 'fp_espn_last_updated_proj_' + league_id;
    
    var storageKeys = [storageLeagueKey, storagePlayerKey, storageUpdateKey, storageProjUpdateKey, storageDepthKey];
	
	setSelectors();
	
	var hasProjectionTable = proj_head.length > 0;	
}
else if (document.URL.match(/football.fantasysports.yahoo.com/)) {
    siteType = 'yahoo';
    
    var fetchYahooIds = jQuery.Deferred();
    var total_player_ids = 0;
    var is_FA_current = false;
	
	var onMatchupPreviewPage = document.URL.match(/f1\/\d+\/matchup/);
    var onClubhousePage = document.URL.match(/f1\/\d+\/\d+/);
    var onFreeAgencyPage = document.URL.match(/f1\/\d+\/players/);
	var onLeaguePage = document.URL.match(/f1\/\d+$/);
    
    //TODO: add /addPlayer, viewwaiver, etc.?
    //TODO: also enable ranks for /players various searches
	var hasProjTotals = document.URL.match(/f1\/\d+\/(\d+|matchup)/);
	var hasPlayerTable = document.URL.match(/f1\/\d+\/(\d+|players)/);
    var hasProjectionTable = document.URL.match(/f1\/\d+\/(\d+|players|matchup)/);
    
    jQuery('.df-ad').remove();
    jQuery('#fantasyhero').remove();
    jQuery('#gamepromo').remove();
    
    league_id = document.URL.match(/football.fantasysports.yahoo.com\/f1\/(\d+)/)[1];
    league_settings_url = '//football.fantasysports.yahoo.com/f1/' + league_id + '/settings';
	
    var storageLeagueKey = 'fp_yahoo_league_data_' + league_id;
    var storagePlayerKey = 'fp_yahoo_player_data_' + league_id;
    var storageUpdateKey = 'fp_yahoo_last_updated_' + league_id;
    var storageProjUpdateKey = 'fp_yahoo_last_updated_proj_' + league_id;
    var storageTranslationKey = 'fp_yahoo_translation';
    
    var storageKeys = [storageLeagueKey, storagePlayerKey, storageUpdateKey, storageProjUpdateKey, storageTranslationKey, storageDepthKey];
	
    base_table_selector = '#team-roster';
    player_table_selector = 'table[id^=statTable]';
    player_table_body_selector = 'tbody';
    player_table_header_selector = 'thead tr';
    player_table_row_selector = 'tr:not(.empty-bench, empty-position)';
    player_name_selector = 'td.player';
	page_menu_selector = 'header div#full_stat_nav';
	pts_total_selector = 'header span.proj-pts';
	
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

    setSelectors();
    
    show_avg = false;
    show_current = false;
    show_spark = false;
    show_ros = false;
    show_depth = false; //TODO remove
}

else if (document.URL.match(/fleaflicker.com/)) {
    siteType = 'fleaflicker';
    
	var onMatchupPreviewPage = document.URL.match(/nfl\/leagues\/(\d+)\/scores\/(\d+)/);
    var onClubhousePage = document.URL.match(/nfl\/leagues\/(\d+)\/teams\/(\d+)(\?|$)/);
    var onFreeAgencyPage = document.URL.match(/nfl\/leagues\/(\d+)\/players/);
    var onGeneralProjPage = document.URL.match(/nfl\/leagues\/(\d+)\/teams\/(\d+)\/(watched)/); //add more
	
    var is_current_week = true;
    
    base_table_selector = '#main-container';
    player_table_selector = '[id^=table_]';
    player_table_body_selector = 'tbody';
    player_table_header_selector = 'thead tr';
    player_table_row_selector = 'tr[id^=row], tr.repeated';
    player_name_selector = 'div.player';
    	
	var hasProjTotals = onMatchupPreviewPage || onClubhousePage;
	var hasPlayerTable = onMatchupPreviewPage || onClubhousePage || onFreeAgencyPage || onGeneralProjPage;
    var hasProjectionTable = hasPlayerTable;
    
    jQuery('a[href^="/nfl/upgrade"]').remove();
    jQuery('i.icon-edge-E').remove();
    if (onFreeAgencyPage || onGeneralProjPage) {
        var trade_btns = jQuery('a').filter(function(i) { return jQuery(this).text() === 'Trade'});
        trade_btns.css({
            'background-image': 'linear-gradient(to bottom,#a070ec 0%,#6c4186 100%)',
            'border-color': '#51427d'
        });
        trade_btns.hover(function() {
            jQuery(this).css("background-color", "rgb(108, 65, 134)");
        });
        
        var claim_btns = jQuery('a').filter(function(i) { return jQuery(this).text() === 'Claim'});
        claim_btns.css({
            'background-image': 'linear-gradient(to bottom,#fbbc4a 0%,#d68306 100%)',
            'border-color': '#9c6315'
        });
        claim_btns.hover(function() {
            jQuery(this).css("background-color", "#d68306");
        });
    }
       
    league_id = document.URL.match(/nfl\/leagues\/(\d+)/)[1];
    league_settings_url = '//www.fleaflicker.com/nfl/leagues/' + league_id + '/scoring';
    
    var storageLeagueKey = 'fp_fleaflicker_league_data_' + league_id;
    var storagePlayerKey = 'fp_fleaflicker_player_data_' + league_id;
    var storageUpdateKey = 'fp_fleaflicker_last_updated_' + league_id;
    var storageProjUpdateKey = 'fp_fleaflicker_last_updated_proj_' + league_id;
    
    var storageKeys = [storageLeagueKey, storagePlayerKey, storageUpdateKey, storageProjUpdateKey, storageDepthKey];
	
    show_avg = false; // maybe remove next week
    show_current = false;
    
	setSelectors();
}


function getParams(u) {
	var qd = {};
	var q_loc = u.indexOf('?');
	if (q_loc > -1) {
		u.substr(q_loc + 1).split("&").forEach(function(item) {
			var s = item.split("="), k = s[0], v = s[1] && decodeURIComponent(s[1]);
			(k in qd) ? qd[k].push(v) : qd[k] = [v];
		});
	}
	return qd;
}

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
        if (td_num != def_val) {
            if (td_num < def_val) {
                $td_cell.css({'background-color': 'pink'});
            }
            else if ((td_num > def_val) || td_num == 'No Limit') {
                $td_cell.css({'background-color': 'lightgreen'});
            }
            if (td_num != 'N/A') {
                $td_cell.attr('title', 'Default: ' + def_val);
            }
        }
    }

    // - ROSTER SETTINGS -
    var missing_positions = [];
    
    function doRosterSettings($roster) {
        var $roster_body = $roster.find('tbody').find('tbody');
        var $roster_tds = $roster_body.find('tr[class^=row]').find('td:first');

        for (var j in default_roster) {
            if (default_roster.hasOwnProperty(j)) {
                var second_obj = default_roster[j];
                var matching_td = $roster_body.find("td:contains('" + j + "')");
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
        
        $roster_tds.each(function(i) {
            var $thistd = jQuery(this);
            var $td_row = $thistd.parent();
            $td_row.css({'background-color': 'lightblue'});
        });

        if (missing_positions.length > 0) {
            var $last_section = $roster.find('tbody').first().children('tr').last();
            var trclassname = 'Even';
            if ($last_section.attr("class").indexOf('Even') != -1) {
                trclassname = 'Odd';
            }
            var $last_td = $last_section.find('tr:nth(1)').find('td:first');
            var td_width = $last_td.width() || 250;
            var $missing_section = jQuery('<tr class="row' + trclassname + '"><td class="dataSummary settingLabel">Missing Positions</td><td><table border="0" cellpadding="2" cellspacing="1" class="leagueSettingsTable tableBody"><tbody></tbody></table></td></tr>');
            var $missing_section_body = $missing_section.find('tbody');
            
            var missing_length = missing_positions.length;
            for (var i=0; i < missing_length; i++) {
                var td_val = missing_positions[i];

                var new_row = '<tr style="background-color: pink;"><td style="width: ' + td_width + 'px">' + td_val + '</td><td><strong>' + default_roster[td_val]['num'] + '</strong></td><td><strong>' + default_roster[td_val]['max'] + '</strong></td></tr>';
                $missing_section_body.append(new_row);
            }
            
            $missing_section.insertAfter($last_section);
        }
        
        rosterDone.resolve();
    }
        
    // - SCORING SETTINGS -
    function doScoringSettings($scoring) {
        var $scoring_body = $scoring.find('table.viewable').find('tbody').find('tbody');
        var $scoring_tds = $scoring_body.find('td.statName');

        var missing_tds = [];
        for (var j in default_settings) {
            if (default_settings.hasOwnProperty(j)) {
                var second_obj = default_settings[j];
                for (var k in second_obj) {
                    if (second_obj.hasOwnProperty(k)) {
                        var matching_td = $scoring_body.find("td:contains('" + k + "')").filter(function () {
                            return jQuery(this).parents('td').eq(0).prev().text() == j;
                        });
                        if (matching_td.length) {
                            var $td_cell = matching_td.next();
                            var td_num = getCellVal($td_cell);
                            
                            var def_val = second_obj[k];
                            colorizeCell(td_num, def_val, $td_cell);
                             
                            $scoring_tds.splice($scoring_tds.index(matching_td), 1);
                        }
                        else {
                            var missing_tuple = {'typ': j, 'val': k};
                            missing_tds.push(missing_tuple);
                        }
                    }
                }
            }
        }

        var missing_stand_tds = [];
        var is_standard = false;
        for (var j in default_standard_settings) {
            if (default_standard_settings.hasOwnProperty(j)) {
                var second_obj = default_standard_settings[j];
                for (var k in second_obj) {
                    if (second_obj.hasOwnProperty(k)) {
                        var matching_td = $scoring_body.find("td:contains('" + k + "')").filter(function () {
                            return jQuery(this).parents('td').eq(0).prev().text() == j;
                        });
                        if (matching_td.length) {
                            is_standard = true;
                            var $td_cell = matching_td.next();
                            var td_num = getCellVal($td_cell);

                            var def_val = second_obj[k];
                            colorizeCell(td_num, def_val, $td_cell);
                            
                            $scoring_tds.splice($scoring_tds.index(matching_td), 1);
                        }
                        else {
                            var missing_tuple = {'typ': j, 'val': k};
                            missing_stand_tds.push(missing_tuple);
                        }
                    }
                }
            }
        }

        var missing_frac_tds = [];
        var is_frac = false;
        for (var j in default_fractional_settings) {
            if (default_fractional_settings.hasOwnProperty(j)) {
                var second_obj = default_fractional_settings[j];
                for (var k in second_obj) {
                    if (second_obj.hasOwnProperty(k)) {
                        var matching_td = $scoring_body.find("td:contains('" + k + "')").filter(function () {
                            return jQuery(this).parents('td').eq(0).prev().text() == j;
                        });
                        if (matching_td.length) {
                            is_frac = true;
                            var $td_cell = matching_td.next();
                            var td_num = getCellVal($td_cell);

                            var def_val = second_obj[k];
                            colorizeCell(td_num, def_val, $td_cell);
                            
                            $scoring_tds.splice($scoring_tds.index(matching_td), 1);
                        }
                        else {
                            var missing_tuple = {'typ': j, 'val': k};
                            missing_frac_tds.push(missing_tuple);
                        }
                    }
                }
            }
        }
        
        //To identify nonstandard yard scoring
        for (var c=0; c < $scoring_tds.length; c++) {
            var s_text = jQuery($scoring_tds[c]).text();
            var nonstand = false;
            if ((s_text.search(/ards\s+\(PY\d+/) > -1) && (s_text.indexOf('ards (PY25)') == -1)) {
                var nonmissing_tuple = {'typ': 'Passing', 'val': 'Passing Yards (PY)'};
                nonstand = true;
            }
            else if ((s_text.search(/ards\s+\(RY\d+/) > -1) && (s_text.indexOf('ards (RY10)') == -1)) {
                var nonmissing_tuple = {'typ': 'Rushing', 'val': 'Rushing Yards (PY)'};
                nonstand = true;
            }
            else if ((s_text.search(/ards\s+\(REY\d+/) > -1) && (s_text.indexOf('ards (REY10)') == -1)) {
                var nonmissing_tuple = {'typ': 'Receiving', 'val': 'Receiving Yards (REY)'};
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
            if (denom_str.length > 0) {
                    var denom = parseFloat(denom_str);
                }
                else {
                    var denom = 1.0;
                }
                var converted_val = expected_val * denom;
                colorizeCell(td_num, converted_val, $td_cell);
                if (td_num == converted_val) {
                    return true;
                }
                else {
                    return false;
                }
        }
        
        $scoring_tds.each(function(i) {
            var $thistd = jQuery(this);

            var $td_cell = $thistd.next().first();
            var td_num = getCellVal($td_cell);
            
            var thistd_text = $thistd.text();
            
            var frac_cell = false;
            //again, espn adds a dumb extra space
            var cell_indexof = thistd_text.search(/ards\s+\(PY/);
            if (cell_indexof !== -1) {
                frac_cell = true;
                var expected_val = default_fractional_settings['Passing']['Passing Yards (PY)'];
                var denom_str = '';
                var denom_reg = thistd_text.match(/\([A-Z]+(\d+)\)/);
                if (denom_reg.length) {
                    var denom_str = denom_reg[1];
                }
                var same_val = check_denom(td_num, denom_str, expected_val, $td_cell);
                if (same_val) {
                    missing_frac_tds.splice(missing_frac_tds.indexOf(' (PY'), 1);
                    missing_stand_tds.splice(missing_stand_tds.indexOf(' (PY'), 1);
                }
            }
            var cell_indexof = thistd_text.indexOf('ards (RY');
            if (cell_indexof !== -1) {
                frac_cell = true;
                var expected_val = default_fractional_settings['Rushing']['Rushing Yards (RY)'];
                var denom_str = '';
                var denom_reg = thistd_text.match(/\([A-Z]+(\d+)\)/);
                if (denom_reg.length) {
                    var denom_str = denom_reg[1];
                }            var same_val = check_denom(td_num, denom_str, expected_val, $td_cell);
                if (same_val) {
                    missing_frac_tds.splice(missing_frac_tds.indexOf(' (RY'), 1);
                    missing_stand_tds.splice(missing_stand_tds.indexOf(' (RY'), 1);
                }

            }
            var cell_indexof = thistd_text.indexOf('ards (REY');
            if (cell_indexof !== -1) {
                frac_cell = true;
                var expected_val = default_fractional_settings['Receiving']['Receiving Yards (REY)'];
                var denom_str = '';
                var denom_reg = thistd_text.match(/\([A-Z]+(\d+)\)/);
                if (denom_reg.length) {
                    var denom_str = denom_reg[1];
                }
                var same_val = check_denom(td_num, denom_str, expected_val, $td_cell);
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
        for (var p=0; p < all_missing_tds.length; p++) {
            var miss_pos = all_missing_tds[p];
            var miss_pos_typ = miss_pos['typ'];
            var miss_pos_trans = [];
            if (miss_pos_typ == 'Team Defense / Special Teams') {
                miss_pos_trans = ['Team Defense/Special Teams (D/ST)'];
            }
            else if (miss_pos_typ == 'Passing') {
                miss_pos_trans = ['Quarterback (QB)', 'Team Quarterback (TQB)'];
            }
            else if (miss_pos_typ == 'Kicking') {
                miss_pos_trans = ['Place Kicker (K)'];
            }
            
            if (miss_pos_trans.length > 0) {
                var found_pos = 0;
                for (var f=0; f < miss_pos_trans.length; f++) {
                    if (missing_positions.indexOf(miss_pos_trans[f]) > -1) {
                        found_pos += 1;
                    }
                }
                if (found_pos == miss_pos_trans.length) {
                    new_missing_tds.splice(new_missing_tds.indexOf(miss_pos), 1);
                }
            }
        }
        
        if (new_missing_tds.length > 0) {
            var $last_section = $scoring.find('table.viewable').find('tbody').first().children('tr').last();
            var trclassname = 'Even';
            if ($last_section.attr("class").indexOf('Even') != -1) {
                trclassname = 'Odd';
            }
            var $missing_section = jQuery('<tr class="row' + trclassname + '"><td class="categoryName settingLabel">Missing Entries</td><td><table width="100%" cellspacing="0" cellpadding="0" border="0"><tbody></tbody></table></td></tr>');
            var $missing_section_body = $missing_section.find('tbody');
            
            var missing_length = new_missing_tds.length;
            for (var i=0; i < missing_length; i++) {
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
    
    if ($roster.length == 0) {
        if ($scoring.length > 0) {
            var roster_fetch = {'xhr': 1, 'edit': 'false', 'leagueId': league_id};
            jQuery.get('//games.espn.com/ffl/leaguesetup/sections/roster', roster_fetch, function(po) {
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
    
    if ($scoring.length > 0) {
        jQuery.when(rosterDone).done(function() {
            doScoringSettings($scoring);
        });
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
				if (submit_btn.length == 0) {
                    leagueObserver.disconnect();
                    addLeagueSettings();
                }
            }
        });

        leagueObserver.observe(target_observe, observerConfig);
    }
    
    jQuery.when(rosterDone).done(function() {
        watchLeagueForChanges();
    });
}

function setSelectors() {
    base_table = jQuery(base_table_selector);
	if (page_menu_selector) {
		page_menu = base_table.find(page_menu_selector);
	}
	if (pts_total_selector) {
		pts_total = base_table.find(pts_total_selector);
	}	
	
	if (siteType == 'espn' && onMatchupPreviewPage) {
		playerTable = jQuery(player_table_selector);
	}
	else {
		playerTable = base_table.find(player_table_selector);
	}
    player_table_body = playerTable.find(player_table_body_selector);
    if (siteType == "espn") {
        playerTable = player_table_body;
    }
    player_table_header = playerTable.find(player_table_header_selector);
    player_table_rows = player_table_body.find(player_table_row_selector);
	
    if (siteType == 'espn') {
        proj_head = player_table_header.find(player_table_header_proj_selector);
    }
    else if (siteType == "yahoo") {
		show_proj = true;
		show_rank = true;
		if (onMatchupPreviewPage) {
			player_table_header_proj_selector = 'th:contains(Proj)';
		}
        else if (onFreeAgencyPage) {
            is_FA_current = false;
            var fa_url = window.location.search;
            var url_dict = getParams(fa_url);
            var fa_page = url_dict.hasOwnProperty('stat1') ? url_dict['stat1'][0] : '';
            if (/^S_P/.test(fa_page)) {
                player_table_header_proj_selector = 'th:contains(Fan Pts)';
                if (/^S_PW_/.test(fa_page)) {
                    var statweek = parseInt(fa_page.split('_').reverse()[0]);
                    if (!isNaN(statweek) && (statweek == current_week)) {
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
			if (selected_nav == 'P' || selected_nav == 'GDD') {
				var subid = 'subnav_' + selected_nav;
				var selected_subnav = page_menu.find('div#statsubnav ul#' + subid + ' li.Selected:first a').attr('href');
				var subnav_dict = getParams(selected_subnav);
				var subnav_href = subnav_dict.hasOwnProperty('stat2') ? subnav_dict['stat2'][0] : '';
				if (selected_nav == 'P' && subnav_href == 'PW') {
					player_table_header_proj_selector = 'th:contains(Fan Pts)';
				}
				else if (selected_nav == 'GDD' && subnav_href == 'D') {
					player_table_header_proj_selector = 'th:contains(Rank)';
				}
			}
			else if (selected_nav == 'K') {
				show_proj = false;
				player_table_header_proj_selector = 'th:contains(This Week)';
			}
		}
        
        proj_head = player_table_header.find(player_table_header_proj_selector);
	}
    else if (siteType == "fleaflicker") {
        show_proj = true;
		show_rank = true;
		show_ros = true;

        player_table_header_proj_selector = 'Proj';
        var this_url = window.location.search;
        var url_dict = getParams(this_url);
        var uri_name = 'statRange';
        if (onClubhousePage) {
            uri_name = 'week';
        }
        var week_no = url_dict.hasOwnProperty(uri_name) ? url_dict[uri_name][0] : '';
        if (week_no && week_no != current_week) {
            is_current_week = false;
        } 
        var season_no = url_dict.hasOwnProperty('season') ? url_dict['season'][0] : '';
        if (season_no && season_no != current_season) {
            is_current_week = false;
        } 

        if (onFreeAgencyPage) {
            var stat_no = url_dict.hasOwnProperty('statType') ? url_dict['statType'][0] : '';
            if (stat_no && stat_no == '7') {
                player_table_header_proj_selector = 'FPts';
                show_avg = false; //could remove
                show_spark = false;
            } 
        }
        
        if (!is_current_week) {
            hasProjectionTable = false;
        }

        proj_head = player_table_header.find('th').filter(function(i) {
            return jQuery(this).text() === player_table_header_proj_selector;
        });
        
        if (player_table_header_proj_selector == 'FPts') {
            proj_head = proj_head.last();
        }
    }
    
	var proj_first = proj_head.first();
    header_index = proj_first.index();
	proj_first.prevAll("th, td").each(function() {
		header_index += this.colSpan - 1;
	});
}

//MAIN
if (hasProjectionTable) {
    addColumns();
    chrome.storage.local.get(storageKeys, function(r) {
        alldata = r[storagePlayerKey];
        if (!alldata || Object.keys(alldata).length <= 0) {
            alldata = {};
        }
        else {
            updated_time = r[storageUpdateKey];
            updated_time_proj = r[storageProjUpdateKey];
        }
        
        if (siteType == 'yahoo') {
            storage_translation_data = r[storageTranslationKey];
            if (!storage_translation_data) {
                storage_translation_data = {};
            }
        }
        
        depth_data = r[storageDepthKey];
        if (!depth_data || Object.keys(depth_data).length <= 0) {
            depth_data = {};
        }

        storage_league_data = r[storageLeagueKey];
        if ((storage_league_data) && ((current_time - updated_time) < (1000 * 60 * check_minutes))) {
            dlog('Using cache for league');
            settings = storage_league_data;
            doLeagueThings();
        }
        else {
            dlog('Fetching data, Updated time: ' + updated_time + ', Current Time: ' + current_time);
            jQuery.get(league_settings_url, function(d) {
                var setSettings = parseLeagueSettings(d, siteType);
                var setLeagueData = {};
                setLeagueData[storageLeagueKey] = setSettings;
                chrome.storage.local.set(setLeagueData, function() {
                    doLeagueThings();
                });
            });
        }
    });
}

function doLeagueThings() {
    if (onMatchupPreviewPage) {
        if ((current_time - updated_time_proj) < (1000 * 60 * check_minutes)) {
            dlog('Using cache for data');
            addProjections();
        }
        else {
			rankDone.resolve();
			rosDone.resolve();
			avgDone.resolve();
			depthDone.resolve();
			
			alldata = {};
            getPosProjections();
            jQuery.when(projDone).done(function () {
                dlog('fetch fail: ' + fetch_fail);
                dlog('idp fetch fail: ' + idp_fetch_fail);
                if ((!fetch_fail && !idp_fetch_fail) || (siteType == 'yahoo' && !fetch_fail)) {
                    var setPlayerData = {};
                    setPlayerData[storagePlayerKey] = alldata;
                    setPlayerData[storageProjUpdateKey] = current_time;
                    chrome.storage.local.set(setPlayerData);
                }
            });
        }
    }
    else {
        if ((current_time - updated_time) < (1000 * 60 * check_minutes)) {
            dlog('Using cache for data');
            addAllData(true);
            jQuery.when(projDone, rankDone, rosDone, avgDone, depthDone).done(function () {
                watchForChanges();
            });
        }
        else {
			//TODO: dont clear the iavg. in fact, store that somewhere else.
			alldata = {};
            getData();
            jQuery.when(projDone, rankDone, rosDone, avgDone, depthDone).done(function () {
                dlog('fetch fail: ' + fetch_fail);
                dlog('idp fetch fail: ' + idp_fetch_fail);
                if ((!fetch_fail && !idp_fetch_fail) || (siteType == 'yahoo' && !fetch_fail)) {
                    dlog('setting player data');
                    var setPlayerData = {};
                    setPlayerData[storagePlayerKey] = alldata;
                    setPlayerData[storageUpdateKey] = current_time;
                    setPlayerData[storageProjUpdateKey] = current_time;
                    chrome.storage.local.set(setPlayerData, function() {
                        watchForChanges();
                    });
                }
                else {
                    watchForChanges();
                }
            });
        }
    }
}

function addColumns() {
    if (header_index == -1 && !((siteType == 'fleaflicker') && hasProjectionTable)) {
        return;
    }
    
    if (siteType == "espn") {
        var celldata = '<img src="' + loadingUrl + '"/>';
        var projection_header = '<td class="playertableStat FantasyPlus FantasyPlusProjections FantasyPlusProjectionsHeader" title="Consensus point projections from FantasyPros (via FantasyPlus)">FPROS</td>';
        
        if (onMatchupPreviewPage) {
            proj_head.after(projection_header);
            proj_head.text('ESPN');
                            
            var last_header_col = player_table_body.find('.playertableSectionHeader th:contains(STATS)');
            last_header_col.each(function() {
                var curr_span = jQuery(this).attr("colspan");
                jQuery(this).attr("colspan", curr_span + 1);
                
                var parent_table = jQuery(this).closest('table');
                
                parent_table.find('tr.pncPlayerRow:not(.emptyRow)').each(function () {
                    var currRow = jQuery(this);
                    
                    //make this look at the array instead of this garbage hardcoding bullshitigans
                    currRow.find('td').last().after('<td class="playertableStat FantasyPlus FantasyPlusProjections FantasyPlusProjectionsData">' + celldata + '</td>');
                });
            });
        }
        else {
            //make these options that are set above, add to a custom_cols array when each is enabled)
            var adjavg_header = '<td class="playertableStat FantasyPlus FantasyPlusAvg FantasyPlusAvgHeader" title="Injury/Suspension-adjusted average points for the season (via FantasyPlus)">iAVG</td>';
            var current_header = '<td class="playertableStat FantasyPlus FantasyPlusCurrent FantasyPlusCurrentHeader" title="Points scored this week (via FantasyPlus)">CURR</td>';
            var spark_header = '<td class="playertableStat FantasyPlus FantasyPlusSpark FantasyPlusSparkHeader" title="Graph of fantasy points over previous weeks (via FantasyPlus)">TREND</td>';
            var rank_header = '<td colspan="2" style="text-align: center" class="playertableStat FantasyPlus FantasyPlusRankings FantasyPlusRankingsHeader" title="Projected position rank (lower is better) for *this week* from FantasyPros (via FantasyPlus)">THIS WEEK</td>'; //say wk 9 or this week
            //stdev_header = '<td class="playertableStat FantasyPlus FantasyPlusStdevs FantasyPlusStdevsHeader">StDev</td>';
            var ros_header = '<td colspan="2" style="text-align: center" class="playertableStat FantasyPlus FantasyPlusRos FantasyPlusRosHeader" title="Projected position rank (lower is better) for *the rest of the season* from FantasyPros (via FantasyPlus)">REMAINING</td>';
            var depth_header = '<td class="playertableStat FantasyPlus FantasyPlusDepth FantasyPlusDepthHeader" title="Depth chart information (via FantasyPlus)">DEPTH</td>';
            
            //temp hack
            custom_cols = 8;
            
            var all_header_cells = projection_header + '<td class="FantasyPlus sectionLeadingSpacer"></td>' + rank_header + ros_header + '<td class="FantasyPlus sectionLeadingSpacer"></td>';
            
            var section_header = jQuery('.playerTableBgRowHead.tableHead.playertableSectionHeader');
            
            var last_header_col = section_header.find('th:last');
            last_header_col.attr({'colspan': 2, 'title': 'Projected points for this week'}).text('PROJ PTS');
            last_header_col.after('<th class="FantasyPlus" colspan="3">OWNERSHIP</th>');
            last_header_col.after('<th class="FantasyPlus" colspan="1">OPRK</th>'); //change to 2, OPRK to ESPN, and include the DVOA adjusted version
            last_header_col.after('<td class="FantasyPlus sectionLeadingSpacer"></td>');
            last_header_col.after('<th class="FantasyPlus" colspan="4" title="Projected position rank (lower is better) with 95% confidence interval from FantasyPros (via FantasyPlus)">PROJ POS RANK (±RANGE)</th>');
            last_header_col.after('<td class="FantasyPlus sectionLeadingSpacer"></td>');

            proj_head.after(all_header_cells);
            if (proj_head.find('a').length > 0) { //we're on a filterable page
                proj_head.find('a').text('ESPN');
            }
            else {
                proj_head.text('ESPN');
            }
            
            var players_col_span = section_header.next('tr').find('td.sectionLeadingSpacer:first').index();
            var players_col = section_header.find('th.playertableSectionHeaderFirst');
            players_col.attr({'colspan': players_col_span + 1, 'title': 'Player information'});
            
            var avg_header_col = section_header.find('th:contains(SEASON)');
            avg_header_col.attr({'colspan': 7, 'title': 'Season statistics'});
            
            var player_head = player_table_header.find('td:contains(TEAM POS)');
            var player_header_index = player_head.first().index();
            player_head.after(depth_header);
            
            var avg_head = player_table_header.find('td:contains(AVG)');
            var avg_header_index = avg_head.first().index() - 1;
            avg_head.after(adjavg_header);
            
            var last_head = player_table_header.find('td:contains(LAST)');
            var last_header_index = last_head.first().index() - 1;
            last_head.after(spark_header);
            last_head.after(current_header);

            var byeweek = player_table_body.find('tr.playerTableBgRowSubhead td:contains(OPP)').first().index() - 1;
            player_table_rows.each(function () {
                var currRow = jQuery(this);
                
                var byeweek_text = currRow.find('td').eq(byeweek).text();
                var adj_header_index = (byeweek_text == "** BYE **" ? header_index - 1 : header_index);
                var adj_avg_header_index = (byeweek_text == "** BYE **" ? avg_header_index - 1 : avg_header_index);
                var adj_last_header_index = (byeweek_text == "** BYE **" ? last_header_index - 1 : last_header_index);
            
                currRow.find('td').eq(adj_avg_header_index).after('<td class="playertableStat FantasyPlus FantasyPlusAvg FantasyPlusAvgData">' + celldata + '</td>');
                currRow.find('td').eq(adj_last_header_index).after('<td class="playertableStat FantasyPlus FantasyPlusCurrent FantasyPlusCurrentData">' + celldata + '</td>');
                currRow.find('td').eq(adj_last_header_index + 1).after('<td class="playertableStat FantasyPlus FantasyPlusSpark FantasyPlusSparkData">' + celldata + '</td>');
                //make this look at the array instead of this garbage hardcoding bullshitigans
                currRow.find('td').eq(adj_header_index + 3).after('<td class="playertableStat FantasyPlus FantasyPlusProjections FantasyPlusProjectionsData">' + celldata + '</td><td class="FantasyPlus sectionLeadingSpacer"></td><td class="playertableStat FantasyPlus FantasyPlusRankings FantasyPlusRankingsData">' + celldata + '</td><td class="playertableStat FantasyPlus FantasyPlusRankings FantasyPlusRankingsStdevData"></td><td class="playertableStat FantasyPlus FantasyPlusRos FantasyPlusRosData">' + celldata + '</td><td class="playertableStat FantasyPlus FantasyPlusRos FantasyPlusRosStdevData"></td><td class="FantasyPlus sectionLeadingSpacer"></td>');
                currRow.find('td').eq(player_header_index).after('<td class="playertableStat FantasyPlus FantasyPlusDepth FantasyPlusDepthData">' + celldata + '</td>');
            });
        }
    }
    else if (siteType == "yahoo") {
        var celldata = '<center><img src="' + loadingUrl + '"/></center>';			
        if (onMatchupPreviewPage) {
            var projection_header = '<th style="width: 38px;" class="Ta-end Va-top FantasyPlus FantasyPlusProjections FantasyPlusProjectionsHeader" title="Consensus point projections from FantasyPros (via FantasyPlus)"><div style="width: 40px;">Proj (FP)</div></td>';
            var projection_cell = '<td style="width: 38px;" class="Alt Ta-end F-shade Va-top FantasyPlus FantasyPlusProjections FantasyPlusProjectionsData">' + celldata + '</td>';
            var newprojcell = '<td style="width: 38px;" class="Alt Ta-end F-shade Va-top FantasyPlus FantasyPlusProjections FantasyPlusProjectionsTotal">-</td>';
            
            playerTable.each(function() {
                var total_cell = projection_cell;
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
                
                first_proj_header.after(projection_header);
                second_proj_header.before(projection_header);
                
                var currRows = currTab.find('tbody tr');
                var currRowsLen = currRows.length;
                currRows.each(function(l) {
                    var currRow = jQuery(this);
                    
                    if ((l + 1) == currRowsLen) {
                        total_cell = newprojcell;
                    }
                    
                    var currRowTds = currRow.find('td');
                    var header_diff = matchup_heads_len - currRowTds.length;
                    currRowTds.eq(first_proj_header_idx).after(total_cell);
                    currRowTds.eq(second_proj_header_idx - header_diff).before(total_cell);
                });
            });
        }
        else {
            var projection_header = '<th style="width: 40px; text-align: center;" class="FantasyPlus FantasyPlusProjections FantasyPlusProjectionsHeader" title="Consensus point projections from FantasyPros (via FantasyPlus)">Proj (FP)</th>';				
            var rank_header = '<th style="width: 40px; text-align: center;" class="FantasyPlus FantasyPlusRankings FantasyPlusRankingsHeader" title="Projected position rank (lower is better) for *this week* from FantasyPros (via FantasyPlus)">Rank (FP)</th>';
            //stdev_header = '<td class="playertableStat FantasyPlus FantasyPlusStdevs FantasyPlusStdevsHeader">StDev</td>';
            //var ros_header = '<td colspan="2" style="text-align: center" class="playertableStat FantasyPlus FantasyPlusRos FantasyPlusRosHeader" title="Projected position rank (lower is better) for *the rest of the season* from FantasyPros (via FantasyPlus)">REMAINING</td>';
            var depth_header = '<th style="width: 50px; text-align: center;" class="playertableStat FantasyPlus FantasyPlusDepth FantasyPlusDepthHeader" title="Depth chart information (via FantasyPlus)">DEPTH</th>';
            
            var projection_cell = '<td class="Nowrap Ta-end FantasyPlus FantasyPlusProjections FantasyPlusProjectionsData">' + celldata + '</td>';				
            var rank_cell = '<td class="Nowrap Ta-end FantasyPlus FantasyPlusRankings FantasyPlusRankingsData">' + celldata + '</td>';
            var depth_cell = '<td class="Nowrap Ta-end FantasyPlus FantasyPlusDepth FantasyPlusDepthData">' + celldata + '</td>';
            
            //temp hack
            custom_cols = 0;
            var all_header_cells = '';
            var all_cells = '';
            
            if (show_proj) {
                custom_cols++;
                all_header_cells += projection_header;
                all_cells += projection_cell;
            }
            if (show_rank) {
                custom_cols++;
                all_header_cells += rank_header;
                all_cells += rank_cell;
            }
            //if (show_depth) {
            //	custom_cols++;
            //	all_header_cells += rank_header;
            //	all_cells += rank_cell;
            //}
            
            if (custom_cols > 0) {
                var first_header_col = player_table_header.first().find('th').filter(function(i) {
                    return jQuery(this).text().match(/^\w/);
                }).first();
                var fhc_curr_cols = parseInt(first_header_col.attr('colspan'));
                if (!isNaN(fhc_curr_cols) && !first_header_col.data('modified')) {
                    first_header_col.attr({'colspan': fhc_curr_cols + custom_cols, 'data-modified': true});
                }
                
                proj_head.after(all_header_cells);
                
                player_table_rows.each(function() {
                    var currRow = jQuery(this);
                    currRow.find('td').eq(header_index).after(all_cells);
                    if (currRow.find('td:first').hasClass('Selected')) {
                        currRow.find('td.FantasyPlus').addClass('Selected');
                    }
                });
            }
        }
    }
    else if (siteType == 'fleaflicker') {
        var celldata = '<img src="' + loadingUrl + '"/>';
        var projection_header = '<th style="width: 2%;" class="leaf FantasyPlus FantasyPlusProjections FantasyPlusProjectionsHeader" title="Consensus point projections from FantasyPros (via FantasyPlus)">FPros</th>';
        var space_header = '<th class="FantasyPlus horizontal-spacer"></th>';
        var space_cell = '<td class="FantasyPlus horizontal-spacer"></td>';
        var space_v_cell = '<th class="FantasyPlus vertical-spacer bottom">&nbsp;</th>';
        var blank_cell = '<td class="FantasyPlus">&nbsp;</td>';
        
        var addHeader = function(cells, data, spacing) {
            spacing = typeof spacing === "undefined" ? "3%" : spacing;
            cells.each(function() {
                var cell = jQuery(this);
                var this_header = jQuery(data);
                
                if (cell.hasClass('bottom')) {
                    this_header.addClass('bottom');
                }
                if (cell.hasClass('right')) {
                    cell.removeClass('right')
                    this_header.addClass('right');
                }
            
                var next_header = cell.next();
                if (next_header.length && !next_header.hasClass('horizontal-spacer')) {
                    next_header.css('width', spacing);
                }
            
                cell.after(this_header);
            });
        };
        
        var getIdxSpan = function(c) {
            if (c && c.length) {
                var index = 0;
                jQuery(c[0]).prevAll("td, th").each(function() {
                    index += this.colSpan;
                });
                return index;
            }
            else {
                return false;
            }
        };
        
        var findIdxSpan = function(i, c) {
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
        
        var findHeader = function(hname, pname, is_parent) {
            pname = (typeof pname == 'undefined') ? false : pname;
            is_parent = (typeof is_parent == 'undefined') ? false : is_parent;
            
            var reg_test = new RegExp(hname);
            if (pname) {
                var reg_p_test = new RegExp(pname);
            }
            var seek_headers = player_table_header.find('th').filter(function(i) {
                var h_j = jQuery(this);
                if (reg_test.test(h_j.text())) {
                    if (is_parent || !pname) {
                        return true;
                    }
                    else {
                        var h_index = getIdxSpan(h_j);
                        var p_head = findIdxSpan(h_index, h_j);
                        if (reg_p_test.test(p_head.text())) {
                            return true;
                        }
                        else {
                            return false;
                        }
                    }
                }
                else {
                    return false;
                }
            });
            return seek_headers;
        };
        
        var addColspan = function(cell, num) {
            if (cell && cell.length && Number.isInteger(num)) {
                var this_span = parseInt(cell[0].colSpan);
                cell.attr('colspan', this_span + num);
            }
        };

        if (onMatchupPreviewPage) {
            var projection_cell = '<td class="text-right FantasyPlus FantasyPlusProjections FantasyPlusProjectionsData">' + celldata + '</td>';
            var newprojcell = '<td class="text-right FantasyPlus FantasyPlusProjections FantasyPlusProjectionsTotal">--</td>';

            proj_head.each(function() {
                var this_proj_head = jQuery(this);
                var proj_index = getIdxSpan(this_proj_head);
                var parent_head = findIdxSpan(proj_index, this_proj_head);
                addColspan(parent_head, 1);
            });
            
            var matchup_proj_heads = player_table_header.find('th').filter(function() {
                return (jQuery(this).text() === 'Proj' || jQuery(this).text() === 'Projected');
            });
            addHeader(matchup_proj_heads, projection_header, '6%');
            
            var this_scoreboard = playerTable.find('tr.scoreboard').closest('table');
            var this_scoreboard_projected = this_scoreboard.find('thead tr th').filter(function() {
                return jQuery(this).text() === 'Projected';
            });
            if (this_scoreboard_projected.length) {
                var scoreboard_last = this_scoreboard.find('tbody tr:last td:last');
                addColspan(scoreboard_last, 1);
            }
            
            playerTable.each(function(idx) {
                var currTab = jQuery(this);
                
                var this_proj_header = currTab.find('th').filter(function() {
                    return (jQuery(this).text() === 'Proj' || jQuery(this).text() === 'Projected');
                });
                var this_proj_header_idx = this_proj_header.index();

                if (this_proj_header_idx > -1) {
                    var starter_found = false;
                    var currRows = currTab.find('tbody').find(player_table_row_selector);
                    currRows.each(function(l) {
                        var currRow = jQuery(this);
                        var currRowTds = currRow.find('td, th');
                        var this_proj_cell = currRowTds.eq(this_proj_header_idx);

                        var total_cell = projection_cell;
                        if (currRow.is('.divider, .scoreboard')) {
                            if (!starter_found) {
                                total_cell = newprojcell;
                                this_proj_cell.html('--');
                                starter_found = true;
                            }
                            else {
                                total_cell = blank_cell;
                            }
                        }
                        else if (currRow.hasClass('repeated')) {
                            total_cell = space_v_cell;
                        }
                        else if (currRowTds.first().text() == 'Optimum') {
                            total_cell = blank_cell;
                        }
                        
                        total_cell = jQuery(total_cell);

                        if (this_proj_cell.hasClass('bottom')) {
                            total_cell.addClass('bottom');
                        }
                        if (this_proj_cell.hasClass('right')) {
                            this_proj_cell.removeClass('right')
                            total_cell.addClass('right');
                        }

                        this_proj_cell.after(total_cell);
                    });
                }
            });
        }
        else {
            var spark_header = '<th style="width: 4%;" class="leaf FantasyPlus FantasyPlusSpark FantasyPlusSparkHeader" title="Graph of fantasy points over previous weeks (via FantasyPlus)">Trend</th>';
            var top_rank_header = '<th colspan="2" class="top left right FantasyPlus FantasyPlusRankingsTop FantasyPlusRankingsTopHeader" title="Projected position rank (lower is better) with 95% confidence interval from FantasyPros (via FantasyPlus)">Proj Rank (±Range)</th>';
            var rank_header = '<th colspan="2" style="text-align: center;" class="leaf left FantasyPlus FantasyPlusRankings FantasyPlusRankingsHeader" title="Projected position rank (lower is better) for *this week* from FantasyPros (via FantasyPlus)">This Week</th>';
            var ros_header = '<th colspan="2" style="text-align: center;" class="leaf right FantasyPlus FantasyPlusRos FantasyPlusRosHeader" title="Projected position rank (lower is better) for *the rest of the season* from FantasyPros (via FantasyPlus)">Remaining</th>';
            var depth_header = '<th style="width: 4%;" class="leaf FantasyPlus FantasyPlusDepth FantasyPlusDepthHeader" title="Depth chart information (via FantasyPlus)">Depth</th>';
            
            var projection_cell = '<td class="FantasyPlus FantasyPlusProjections FantasyPlusProjectionsData">' + celldata + '</td>';

            var spark_cell = '<td class="FantasyPlus FantasyPlusSpark FantasyPlusSparkData">' + celldata + '</td>'
            var rank_cell = '<td style="width: 2%;" class="left FantasyPlus FantasyPlusRankings FantasyPlusRankingsData">' + celldata + '</td>';
            var rank_std_cell = '<td style="width: 2%;" class="right FantasyPlus FantasyPlusRankings FantasyPlusRankingsStdevData"></td>';
            var ros_cell = '<td style="width: 2%;" class="FantasyPlus FantasyPlusRos FantasyPlusRosData">' + celldata + '</td>';
            var ros_std_cell = '<td style="width: 2%;" class="right FantasyPlus FantasyPlusRos FantasyPlusRosStdevData"></td>';
            var depth_cell = '<td class="FantasyPlus FantasyPlusDepth FantasyPlusDepthData">' + celldata + '</td>';
            
            //proj_head = proj_head.first();
                                    
            var addCells = function(idx, data, add_empty) {
                if (Number.isInteger(idx) && idx >= 0) {
                    add_empty = (typeof add_empty == 'undefined') ? false : add_empty;
                    
                    player_table_rows.each(function() {
                        var currRow = jQuery(this);
                        var currRowTds = currRow.find('td, th');
                        
                        var target_cell = currRowTds.eq(idx);
                        var cell_data = jQuery(data);

                        if (target_cell.hasClass('right') && !target_cell.hasClass('FantasyPlus')) {
                            target_cell.removeClass('right')
                            cell_data.addClass('right');
                        }
                        if (target_cell.hasClass('bottom') || currRow.hasClass('last')) {
                            cell_data.addClass('bottom');
                        }
                        
                        if (add_empty) {
                            cell_data = cell_data.add(jQuery(space_cell));
                        }
                        
                        if (currRow.hasClass('repeated')) {
                            if (target_cell.hasClass('leaf')) {
                                cell_data = null;
                            }
                            else {
                                cell_data = space_v_cell;
                            }
                        }

                        target_cell.after(cell_data);
                    });
                }
            };
            
            var rnk_header_default = findHeader('^Rank$', false, true);
            rnk_header_default.css('width', '3%');
            
            var fant_header_default = findHeader('^Last 1$|^Total$|^Avg$', '^Fantasy$');
            fant_header_default.css('width', '4%');
            
            var seas_header_default = findHeader('^Season$');
            seas_header_default.css('width', '5%');

            var proj_index = getIdxSpan(proj_head);
            var parent_head = findIdxSpan(proj_index, proj_head);

            if (!parent_head || !parent_head.length) {
                show_proj = false;
                show_rank = false;
                show_ros = false;
            }
            
            if (show_proj) {
                addColspan(parent_head, 1);
                addHeader(proj_head, projection_header);
                addCells(proj_index, projection_cell);
            }
            
            if (show_rank || show_ros) {
                var top_rank_header_j = jQuery(top_rank_header);
                var top_rank_combine = jQuery(space_header).add(top_rank_header_j);
                parent_head.after(top_rank_combine);
                
                if (show_rank && show_ros) {
                    addColspan(top_rank_header_j, 2);
                }
                
                var trh_idx = getIdxSpan(top_rank_header_j) - 1;
                
                if (show_rank) {
                    var rank_header_j = jQuery(rank_header);
                    var add_spacer = false;
                    if (!show_ros) {
                        rank_header_j.addClass('right');
                        rank_header_j = rank_header_j.add(jQuery(space_header));
                        add_spacer = true;
                    }
                    var trh_subcell = top_rank_header_j.parent().next().find('th');
                    trh_subcell.eq(trh_idx).after(rank_header_j);
                    
                    addCells(trh_idx, rank_cell);
                    addCells(trh_idx + 1, rank_std_cell, add_spacer);
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
                    var trh_subcell = top_rank_header_j.parent().next().find('th');
                    trh_subcell.eq(trh_idx).after(ros_header_j);
                    
                    if (show_rank) {
                        trh_idx += 1;
                    }
                    
                    addCells(trh_idx, ros_cell_j.prop("outerHTML"));
                    addCells(trh_idx + 1, ros_std_cell, true);
                }
            }
            
            if (show_depth) {
                var name_head = player_table_header.find('th').filter(function(i) {
                    return jQuery(this).text() === 'Name';
                });
                var name_index = getIdxSpan(name_head);
                var parent_name_head = findIdxSpan(name_index, name_head);

                addColspan(parent_name_head, 1);
                addHeader(name_head, depth_header);
                addCells(name_index, depth_cell);
            }
            
            if (show_spark) {
                var last_fantasy_head = playerTable.find('tr th').filter(function(i) {
                    return jQuery(this).text().match(/Season|Avg/);
                });
                var fantasy_index = getIdxSpan(last_fantasy_head);
                var fantasy_head = findIdxSpan(fantasy_index, last_fantasy_head);

                addColspan(fantasy_head, 1);
                addHeader(last_fantasy_head, spark_header);
                addCells(fantasy_index, spark_cell);
            }
            
            //if (show_avg) {
                //check if ff already does this
            //}

            if (onClubhousePage && show_proj) {
                var last_row = player_table_body.find('tr[id^=row].last:first');
                
                var total_row = last_row.clone();
                //last_row.removeClass('last');
                last_row.find('td').removeClass('bottom');
                
                total_row.removeAttr('id');
                total_row.addClass('divider strong FantasyPlus');
                
                total_row_tds = total_row.find('td');
                total_row_tds.each(function(i) {
                    var t_j = jQuery(this);
                    t_j.addClass('bottom');
                    
                    if (i == 0) {
                        t_j.addClass('FantasyPlus');
                        t_j.html('<span class="player">Total</span>');
                    }
                    else {
                        t_j.empty();
                        t_j.removeClass(function (index, css) {
                            return (css.match(/(^|\s)FantasyPlus\S+/g) || []).join('');
                        });
                        t_j.addClass('FantasyPlus');
                        
                        if (!t_j.hasClass('horizontal-spacer')) {
                            t_j.html('&nbsp;');
                        }
                    }
                });
                
                var new_proj_index = getIdxSpan(proj_head);
                var tot_proj_cell = total_row_tds.eq(new_proj_index);
                tot_proj_cell.html('—');
                tot_proj_cell.next().html('—');
                tot_proj_cell.next().addClass('FantasyPlusProjections FantasyPlusProjectionsTotal');
                tot_proj_cell.next().next().html('—');
                
                last_row.after(total_row);
            }
        }
    }
}

function parseLeagueSettings(league_data, siteType) {
    var $ld = jQuery(league_data);
    settings = {};
    settings['siteType'] = siteType;
    
    if (siteType == 'espn') {
        var getValue = function(setting_name) {
            //TODO fix this for the right section
            return parseFloat($ld.find("td:contains('" + setting_name + "')").next().first().text());
        }

        settings['pass_yds'] =
            getValue('Passing Yards (PY)') ||
            getValue('(PY5)') / 5.0 ||
            getValue('(PY10)') / 10.0 ||
            getValue('(PY20)') / 20.0 ||
            getValue('(PY25)') / 25.0 ||
            getValue('(PY50)') / 50.0 ||
            getValue('(PY100)') / 100.0 || 0;

        settings['pass_tds'] = getValue('TD Pass (PTD)') || 0;
        settings['pass_ints'] = getValue('Interceptions Thrown (INT)') || 0;
        settings['pass_cmp'] = getValue('Each Pass Completed (PC)') ||
            getValue('(PC5)') / 5.0 ||
            getValue('(PC10)') / 10.0 || 0;
        settings['pass_icmp'] =
             getValue('Each Incomplete Pass (INC)') ||
            getValue('(IP5)') / 5.0 ||
            getValue('(IP10)') / 10.0 || 0;
        settings['pass_att'] = getValue('Each Pass Attempted (PA)') || 0;
        settings['pass_300_bonus'] = getValue('300-399 yard passing game (P300)') || 0;
        settings['pass_400_bonus'] = getValue('400+ yard passing game (P400)') || 0;

        settings['rush_yds'] = getValue('Rushing Yards (RY)') ||
            getValue('(RY5)') / 5.0 ||
            getValue('Every 10 rushing yards (RY10)') / 10.0 ||
            getValue('(RY20)') / 20.0 ||
            getValue('(RY25)') / 25.0 ||
            getValue('(RY50)') / 50.0 ||
            getValue('(RY100)') / 100.0 || 0;
        settings['rush_att'] = getValue('Rushing Attempts (RA)') ||
            getValue('(RA5)') / 5.0 ||
            getValue('(RA10)') / 10.0 || 0;
        settings['rush_tds'] = getValue('TD Rush (RTD)') || 0;
        settings['rush_100_bonus'] = getValue('100-199 yard rushing game (RY100)') || 0;
        settings['rush_200_bonus'] = getValue('200+ yard rushing game (RY200)') || 0;

        settings['rec_yds'] =
            getValue('Receiving Yards (REY)') ||
            getValue('Every 5 receiving yards (REY5)') / 5.0 ||
            getValue('(REY10)') / 10.0 ||
            getValue('(REY20)') / 20.0 ||
            getValue('(REY25)') / 25.0 ||
            getValue('(REY50)') / 50.0 ||
            getValue('(REY50)') / 100.0 || 0;
        settings['rec_att'] =
            getValue('Each reception (REC)') ||
            getValue('(REC5)') / 5.0 ||
            getValue('(REC10)') / 10.0 || 0;
        settings['rec_tds'] = getValue('TD Reception (RETD)') || 0;
        settings['rec_100_bonus'] = getValue('100-199 yard receiving game (REY100)') || 0;
        settings['rec_200_bonus'] = getValue('200+ yard receiving game (REY200)') || 0;
        //Receiving Target (RET)

        settings['xpt'] = getValue('Each PAT Made (PAT)') || 0;
        settings['fga'] =
            (getValue('Total FG Attempted (FGA)') || 0) +
            (0.6 * (getValue('FG Attempted (0-39 yards) (FGA9)') || 0)) +
            (0.3 * (getValue('FG Attempted (40-49 yards) (FGA40)') || 0)) +
            (0.1 * (getValue('FG Attempted (50+ yards) (FGA50)') || 0));
        settings['fg'] =
            (getValue('Total FG Made (FG)') || 0) +
            (0.6 * (getValue('FG Made (0-39 yards) (FG0)') || 0)) +
            (0.3 * (getValue('FG Made (40-49 yards) (FG40)') || 0)) +
            (0.1 * (getValue('FG Made (50+ yards) (FG50)') || 0));
        settings['fgm'] = 
            (getValue('Total FG Missed (FGM)') || 0) +
            (0.6 * (getValue('FG Missed (0-39 yards) (FGM0)') || 0)) +
            (0.3 * (getValue('FG Missed (40-49 yards) (FGM40)') || 0)) +
            (0.1 * (getValue('FG Missed (50+ yards) (FGM50)') || 0));
        //Each PAT Attempted (PATA)
        
        settings['fumbles'] = getValue('Total Fumbles Lost (FUML)') || 0;

        settings['ff'] = getValue('Each Fumble Forced (FF)') || 0;
        settings['tka'] = getValue('Assisted Tackles (TKA)') || 0;
        settings['tks'] = getValue('Solo Tackles (TKS)') || 0;
        settings['pd'] = getValue('Passes Defensed (PD)') || 0;

        settings['int'] = getValue('Each Interception (INT)') || 0;
        settings['deftd'] = getValue('Interception Return TD (INTTD)') || 0;
        settings['fr'] = getValue('Each Fumble Recovered (FR)') || 0;
        settings['sk'] =
            getValue('Each Sack (SK)') ||
            getValue('1/2 Sack (HALFSK)') * 2 || 0;

        settings['pa'] = getValue('Points Allowed (PA)') || 0;
        settings['pa0'] = getValue('0 points allowed (PA0)') || 0;
        settings['pa1'] = getValue('1-6 points allowed (PA1)') || 0;
        settings['pa7'] = getValue('7-13 points allowed (PA7)') || 0;
        settings['pa14'] = getValue('14-17 points allowed (PA14)') || 0;
        settings['pa18'] = getValue('18-21 points allowed (PA18)') || 0;
        settings['pa22'] = getValue('22-27 points allowed (PA22)') || 0;
        settings['pa28'] = getValue('28-34 points allowed (PA28)') || 0;
        settings['pa35'] = getValue('35-45 points allowed (PA35)') || 0;
        settings['pa46'] = getValue('46+ points allowed (PA46)') || 0;

        settings['ya'] = getValue('Yards Allowed (YA)') || 0;
        settings['ya100'] = getValue('Less than 100 total yards allowed (YA100)') || 0;
        settings['ya199'] = getValue('100-199 total yards allowed (YA199)') || 0;
        settings['ya299'] = getValue('200-299 total yards allowed (YA299)') || 0;
        settings['ya349'] = getValue('300-349 total yards allowed (YA349)') || 0;
        settings['ya399'] = getValue('350-399 total yards allowed (YA399)') || 0;
        settings['ya449'] = getValue('400-449 total yards allowed (YA449)') || 0;
        settings['ya499'] = getValue('450-499 total yards allowed (YA499)') || 0;
        settings['ya549'] = getValue('500-549 total yards allowed (YA549)') || 0;
        settings['ya550'] = getValue('550+ total yards allowed (YA550)') || 0;
    }
    else if (siteType == 'yahoo') {
        var league_table = jQuery('#settings-stat-mod-table tbody td', $ld);
        var getValue = function(setting_name) {
            var settingVals = [];
            //TODO fix this for multiple same values
            var settingText = league_table.filter(function(){ return this.childNodes[0].nodeValue === setting_name; });
            if (settingText && settingText.length > 0) {
                var pointText = settingText.next().first().text();
                var settingList = pointText.split(';');
                var bonusDict = {};
                
                jQuery.each(settingList, function( sindex, svalue ) {
                    svalue = svalue.trim();
                    if (svalue.indexOf('yards per point') > -1) {
                        var settingStat = 1.0 / parseFloat(svalue.split(' ')[0]);
                        settingVals.push(settingStat);
                    }
                    else if (svalue.indexOf('points at ') > -1) {
                        var bonusSettingList = svalue.split(' ');
                        bonusPts = parseFloat(bonusSettingList[0]);
                        bonusYds = parseFloat(bonusSettingList[3]);
                        bonusDict[bonusYds] = bonusPts;
                    }
                    else {
                        var settingStat = parseFloat(svalue);
                        settingVals.push(settingStat);
                    }
                });
                
                settingVals.push(bonusDict);
            }
            return settingVals;
        }
        
        var passSettings = getValue('Passing Yards');
            settings['pass_yds'] = passSettings[0] || 0;
            settings['pass_bonus'] = {};
                var passSettingsDict = passSettings[1];
                for (var k in passSettingsDict) {
                    if (passSettingsDict.hasOwnProperty(k)) {
                        settings['pass_bonus'][k] = passSettingsDict[k];
                    }
                }
            settings['pass_tds'] = getValue('Passing Touchdowns')[0] || 0;
            settings['pass_ints'] = getValue('Interceptions')[0] || 0;
            settings['pass_cmp'] = getValue('Completions')[0] || 0;
            settings['pass_icmp'] =	getValue('Incomplete Passes')[0] || 0;
            settings['pass_att'] = getValue('Passing Attempts')[0] || 0;
        
        var rushSettings = getValue('Rushing Yards');
            settings['rush_yds'] = rushSettings[0] || 0;
            settings['rush_bonus'] = {};
                var rushSettingsDict = rushSettings[1];
                for (var k in rushSettingsDict) {
                    if (rushSettingsDict.hasOwnProperty(k)) {
                        settings['rush_bonus'][k] = rushSettingsDict[k];
                    }
                }
            settings['rush_att'] = getValue('Rushing Attempts')[0] || 0;
            settings['rush_tds'] = getValue('Rushing Touchdowns')[0] || 0;
        
        var recSettings = getValue('Receiving Yards');
            settings['rec_yds'] = recSettings[0] || 0;
            settings['rec_bonus'] = {};
                var recSettingsDict = recSettings[1];
                for (var k in recSettingsDict) {
                    if (recSettingsDict.hasOwnProperty(k)) {
                        settings['rec_bonus'][k] = recSettingsDict[k];
                    }
                }
            settings['rec_att'] = getValue('Receptions')[0] || 0;
            settings['rec_tds'] = getValue('Receiving Touchdowns')[0] || 0;
        
        //Kicking
        settings['xpt'] = getValue('Point After Attempt Made')[0] || 0;
        settings['fga'] = 0;
        settings['fg'] =
            (0.6 * ((getValue('Field Goals 0-19 Yards')[0] || 0) +
                (getValue('Field Goals 20-29 Yards')[0] || 0) +
                (getValue('Field Goals 30-39 Yards')[0] || 0)) / 3.0
            ) +
            (0.3 * (getValue('Field Goals 40-49 Yards')[0] || 0)) +
            (0.1 * (getValue('Field Goals 50+ Yards')[0] || 0));
        settings['fgm'] = 
            (0.6 * ((getValue('Field Goals Missed 0-19 Yards')[0] || 0) +
                (getValue('Field Goals Missed 20-29 Yards')[0] || 0) +
                (getValue('Field Goals Missed 30-39 Yards')[0] || 0)) / 3.0
            ) +
            (0.3 * (getValue('Field Goals Missed 40-49 Yards')[0] || 0)) +
            (0.1 * (getValue('Field Goals Missed 50+ Yards')[0] || 0));

        //Misc
        settings['fumbles'] = getValue('Fumbles Lost')[0] || getValue('Fumbles')[0] || 0;
        
        //IDP
        settings['ff'] = getValue('Fumble Force')[0] || 0;
        settings['tka'] = getValue('Tackle Assist')[0] || 0;
        settings['tks'] = getValue('Tackle Solo')[0] || 0;
        settings['pd'] = getValue('Pass Defended')[0] || 0;
        
        //Def
        settings['int'] = getValue('Interception')[0] || 0;
        settings['deftd'] = getValue('Touchdown')[0] || getValue('Defensive Touchdown')[0] || 0;
        settings['fr'] = getValue('Fumble Recovery')[0] || 0;
        settings['sk'] = getValue('Sack')[0] || 0;
        
        settings['pa'] = 0;
        settings['pa0'] = getValue('Points Allowed 0 points')[0] || 0;
        settings['pa1'] = getValue('Points Allowed 1-6 points')[0] || 0;
        settings['pa7'] = getValue('Points Allowed 7-13 points')[0] || 0;
        settings['pa14'] = getValue('Points Allowed 14-20 points')[0] || 0;
        settings['pa21'] = getValue('Points Allowed 21-27 points')[0] || 0;
        settings['pa28'] = getValue('Points Allowed 28-34 points')[0] || 0;
        settings['pa35'] = getValue('Points Allowed 35+ points')[0] || 0;
        
        settings['ya'] = 0;
        settings['ya100'] = getValue('Defensive Yards Allowed 0-99')[0] || 0;
        settings['ya199'] = getValue('Defensive Yards Allowed 100-199')[0] || 0;
        settings['ya299'] = getValue('Defensive Yards Allowed 200-299')[0] || 0;
        settings['ya399'] = getValue('Defensive Yards Allowed 300-399')[0] || 0;
        settings['ya499'] = getValue('Defensive Yards Allowed 400-499')[0] || 0;
        settings['ya500'] = getValue('Defensive Yards Allowed 500+')[0] || 0;
    }
    else if (siteType == 'fleaflicker') {
        var league_table = jQuery('#body-center-main > table', $ld);
        var league_headers = league_table.find('tr td.table-heading').closest('tr');
        //todo separate these by who it applies to, in td.right
        //todo calculate bonuses based on some averages maybe? like first downs, yards per catch, etc.
        
        //well, this got really complicated really fast.
        var kick_dist = [17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65];
        var kick_counts = [0,5,27,68,62,77,78,62,69,57,94,65,71,84,81,71,94,60,93,77,76,89,65,78,56,71,76,80,70,63,63,75,67,57,54,55,58,30,19,6,6,5,1,0,2,0,0,1,0];
        
        var kick_tot = 0;
        for (c=0; c<kick_counts.length; c++) {
            kick_tot += kick_counts[c];
        }
        var min_dist = kick_dist[0];
        var max_dist = kick_dist[kick_dist.length - 1];
        
        var getValue = function(setting_name, bonus) {
            bonus = (typeof bonus == 'undefined') ? false : bonus;
            var settingVals = [];
            
            var this_header = league_headers.find("td.table-heading:contains('" + point_type + "')").closest('tr');
            if (this_header.parent('thead').length > 0) {
                var league_tds = league_table.find('tbody tr:first').nextUntil(league_headers, 'tr[id^=row]').addBack();
            }
            else {
                var league_tds = this_header.nextUntil(league_headers, 'tr[id^=row]');
            }
            var search_regex = new RegExp('^' + setting_name + '(?:(s|es))?(?: [(]Quantity[)])?$');
            var settingTds = league_tds.find("td.left strong").filter(function() { return search_regex.test(jQuery(this).text()) }).closest('td.left');
            
            if (settingTds && settingTds.length > 0) {
                jQuery.each(settingTds, function( sindex, svalue ) {
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
                    
                        s_val = parseFloat((s_val * 1.0) / for_every_num);
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
                    
                    if (point_type != 'Kicking' && every_yards) {
                        is_bonus = true;
                        skip = true;
                    }
                    
                    if (bonus_details.length) {
                        bonus_type = bonus_details[0].textContent.trim();
                        if (point_type == 'Kicking' && (/Field Goals\? (Made|Missed)/.test(setting_name))) {
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
                    
                    var expected_yards = 36.36 // from historical data, last 3 years
                    var expected_pct = 1;
                    
                    if (is_bonus == bonus) {
                        if (is_bonus === false) {
                            if (point_type != 'Kicking') {
                                settingVals.push(s_val);
                            }
                            else {
                                if (!every_yards && (!bonus_details.length || /^\(/.test(bonus_type))) {
                                    settingVals.push(s_val);
                                }
                                else {
                                    var bonus_low = bonus_details.filter('span.text-muted.low').text().trim();
                                    var bonus_low_adj = min_dist;
                                    if (bonus_low) {
                                        bonus_low = parseFloat(bonus_low);
                                        bonus_low_adj = Math.min(Math.max(bonus_low, min_dist), max_dist);
                                    }
                                    var bonus_high = bonus_details.filter('span.text-muted.high').text().trim();
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
                                            for (k=0; k<kick_extra_counts.length; k++) {
                                                kick_counts_cut[kick_counts_cut.length - 1] += kick_extra_counts[k];
                                            }
                                            
                                            var sumkick = 0;
                                            for (var i=0; i< kick_dist_cut.length; i++) {
                                                sumkick += kick_dist_cut[i] * kick_counts_cut[i];
                                            }
                                            var sumkick_count = 0;
                                            for (var j=0; j< kick_counts_cut.length; j++) {
                                                sumkick_count += kick_counts_cut[j];
                                            }

                                            expected_yards = sumkick * 1.0 / sumkick_count;
                                            
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
                                        for (e=0; e < kick_counts_cut.length; e++) {
                                            expected_pct += (kick_counts_cut[e] * 1.0 / kick_tot);
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
                                bonusDict['is_per'] = for_every ? true : false;
                                
                                var bonus_low = bonus_details.filter('span.text-muted.low').text().trim();
                                if (bonus_low) {
                                    bonus_low = parseFloat(bonus_low);
                                }
                                var bonus_high = bonus_details.filter('span.text-muted.high').text().trim();
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
                 for (f=0; f<settingVals.length; f++) {
                     new_pts += settingVals[f];
                 }
                 settingVals = new_pts;
            }
            else if (settingVals.length == 0) {
                settingVals = null;
            }

            return settingVals;
        }
        
        var point_type = 'Passing';
            settings['pass_yds'] = getValue('Passing Yard') || 0;
            settings['pass_yds_bonus'] = getValue('Passing Yard', true);
            settings['pass_tds'] = getValue('Passing TD') || 0;
            settings['pass_tds_bonus'] = getValue('Passing TD', true);
            settings['pass_ints'] = getValue('Interception') || 0;
            settings['pass_ints_bonus'] = getValue('Interception', true);
            settings['pass_cmp'] = getValue('Passing Completion') || 0;
            settings['pass_cmp_bonus'] = getValue('Passing Completion', true);
            settings['pass_icmp'] = getValue('Incomplete Pass') || 0;
            settings['pass_icmp_bonus'] = getValue('Incomplete Pass', true);
            settings['pass_att'] = getValue('Passing Attempt') || 0;
            settings['pass_att_bonus'] = getValue('Passing Attempt', true);
        
        var point_type = 'Rushing';
            settings['rush_yds'] = getValue('Rushing Yard') || 0;
            settings['rush_yds_bonus'] = getValue('Rushing Yard', true);
            settings['rush_tds'] = getValue('Rushing TD') || 0;
            settings['rush_tds_bonus'] = getValue('Rushing TD', true);
            settings['rush_att'] = getValue('Rushing Attempt') || 0;
            settings['rush_att_bonus'] = getValue('Rushing Attempt', true);
        
        var point_type = 'Receiving';
            settings['rec_yds'] = getValue('Receiving Yard') || 0;
            settings['rec_yds_bonus'] = getValue('Receiving Yard', true);
            settings['rec_tds'] = getValue('Receiving TD') || 0;
            settings['rec_tds_bonus'] = getValue('Receiving TD', true);
            settings['rec_att'] = getValue('Catch') || 0;
            settings['rec_att_bonus'] = getValue('Catch', true);

        var point_type = 'Kicking';
            settings['xpt'] = getValue('XP') || 0;
            settings['xpt_bonus'] = getValue('XP', true);
            settings['fga'] = getValue('Field Goal Attempt') || 0;
            settings['fga_bonus'] = getValue('Field Goal Attempt', true);
            settings['fg'] = getValue('Field Goals? Made') || 0;
            settings['fg_bonus'] = getValue('Field Goals? Made', true);
            settings['fgm'] = getValue('Field Goals? Missed') || 0;
            settings['fgm_bonus'] = getValue('Field Goals? Missed', true);

        var point_type = 'Misc';
            settings['fumbles'] = getValue('Fumbles? Lost') || getValue('Fumble') || 0;
            settings['fumbles_bonus'] = getValue('Fumbles? Lost', true) || getValue('Fumble', true);
        
        var point_type = 'Defense';
            settings['tka'] = getValue('Assisted Tackle') || getValue('Total Tackle') || 0;
            settings['tka_bonus'] = getValue('Assisted Tackle', true) || getValue('Total Tackle', true);
            settings['tks'] = getValue('Solo Tackle') || getValue('Total Tackle') || 0;
            settings['tks_bonus'] = getValue('Solo Tackle', true) || getValue('Total Tackle', true);
            settings['pd'] = getValue('Pass(?:es)? Defended') || 0;
            settings['pd_bonus'] = getValue('Pass(?:es)? Defended', true);
            
            settings['ff'] = getValue('Fumbles? Forced') || 0;
            settings['ff_bonus'] = getValue('Fumbles? Forced', true);
            settings['fr'] = getValue('Fumbles? Recovered') || 0;
            settings['fr_bonus'] = getValue('Fumbles? Recovered', true);

            settings['sk'] = getValue('Sack') || 0;
            settings['sk_bonus'] = getValue('Sack', true);
            settings['int'] = getValue('Interception') || 0;
            settings['int_bonus'] = getValue('Interception', true);
            settings['deftd'] = getValue('Defensive TD') || getValue('INT Return TD') || getValue('Fumble Return TD') || 0;
            settings['deftd_bonus'] = getValue('Defensive TD', true) || getValue('INT Return TD', true) || getValue('Fumble Return TD', true);

            settings['ya'] = getValue('Net Yards? Allowed') || 0;
            settings['ya_bonus'] = getValue('Net Yards? Allowed', true);
            
            settings['pa'] = getValue('Points? Allowed') || getValue('Offensive . Special Teams Points? Allowed') || getValue('Offensive Points? Allowed [(]FG, Pass TD, Rush TD[)]') || 0;
            settings['pa_bonus'] = getValue('Points? Allowed', true) || getValue('Offensive . Special Teams Points? Allowed', true) || getValue('Offensive Points? Allowed [(]FG, Pass TD, Rush TD[)]', true);
    }

    dlog(settings);
    return settings;
}

//Get the data from external sites
function fetchPositionData(position, type, cb) {
    var source_site = '';
    var source_type = 'offense';
    var rank_ppr = '';
    var ros_url = '';
    //var experts = [11, 44, 45, 71, 73, 120, 152, 469, 859];
    
    if ((type == 'rank') || (type == 'ros')) {
        if (position == 'rb' || position == 'wr' || position == 'te') {
            if (settings['rec_att'] == 0.5) {
                rank_ppr = 'half-point-ppr-';
            }
            else if (settings['rec_att'] == 1.0) {
                rank_ppr = 'ppr-';
            }
        }
        if (type == 'ros') {
            ros_url = 'ros-';
        }
        //TODO: filters here?
        source_site = 'https://www.fantasypros.com/nfl/rankings/' + ros_url + rank_ppr + position + '.php';
    }
    else if (off_positions_proj.indexOf(position) > -1 || position == '6') {
        //TODO: add back the filters as form data:
        if (position == '6') {
            //todo dunno if i need week anymore
            source_site = 'https://www.fantasypros.com/nfl/projections/dst.php?week=' + current_week;
        } else {
            source_site = 'https://www.fantasypros.com/nfl/projections/' + position + '.php?week=' + current_week;
        }
        /*
        if (siteType == "espn") {		
            experts.splice(experts.indexOf(71), 1);
        }		
        else if (siteType == "yahoo") {		
            experts.splice(experts.indexOf(73), 1);
        }
        source_site += '&expert%5B%5D=' + experts.join('&expert%5B%5D=');
        */
    }
    else {
        //TODO delay fantasy sharks, maybe find some way to only loop over each position when the relevant calls are done
        source_type = 'idp';
        //source_site = 'http://www.fantasysharks.com/apps/bert/forecasts/projections.php?csv=1&Position=' + position + '&Segment=' + (563 + current_week);
        source_site = 'http://www.fantasysharks.com/apps/bert/forecasts/projections.php?csv=1&Position=' + position;
    }
    
    jQuery.ajax({
        url: source_site,
        timeout: ajax_timeout
    }).done(function(data) {
        cb(position, data.trim());
    }).fail(function() {
        if (source_type == 'offense') {
            fetch_fail = true;
        }
        else {
            idp_fetch_fail = true;
        }
        cb(position, 'error');
    });
}

// credit to stackoverflow
function parsesiteCSV(str) {
    var arr = [];
    var quote = false;
    
    for (var row = col = c = 0; c < str.length; c++) {
        var cc = str[c], nc = str[c+1];
        arr[row] = arr[row] || [];
        arr[row][col] = arr[row][col] || '';
        
        if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }  
        if (cc == '"') { quote = !quote; continue; }
        if (cc == ',' && !quote) { ++col; continue; }
        if (cc == '\n' && !quote) { ++row; col = 0; continue; }

        arr[row][col] += cc;
    }

    return arr;
}

var fpros_proj_headers = {
    'QB':  ['Player', 'Team', 'pass_att', 'pass_cmp', 'pass_yds', 'pass_tds', 'pass_ints', 'rush_att', 'rush_yds', 'rush_tds', 'fumbles', 'fpts'],
    'RB':  ['Player', 'Team', 'rush_att', 'rush_yds', 'rush_tds', 'rec_att', 'rec_yds', 'rec_tds', 'fumbles', 'fpts'],
    'WR':  ['Player', 'Team', 'rush_att', 'rush_yds', 'rush_tds', 'rec_att', 'rec_yds', 'rec_tds', 'fumbles', 'fpts'],
    'TE':  ['Player', 'Team', 'rec_att', 'rec_yds', 'rec_tds','fumbles', 'fpts'],
    'K':   ['Player', 'Team', 'fg', 'fga', 'xpt', 'fpts'],
    'DST': ['Player', 'Team', 'def_sack', 'def_int', 'def_fr', 'def_ff', 'def_td', 'def_assist', 'def_safety', 'def_pa', 'def_tyda', 'fpts'] 
};

var fpros_rank_headers = ['Rank', 'Player', 'Team', 'Matchup', 'Best Rank', 'Worst Rank', 'Avg Rank', 'Std Dev'];

function convertFProsToCSV(raw_data, type, pos_name) {
    var new_raw_data = jQuery(raw_data);
    new_raw_data.find('thead tr:has(td)').remove();
    new_raw_data.find('tbody tr:not([class^="mpb-player"])').remove();
    var new_data = jQuery('table#data', new_raw_data);
    
    var header_cell = new_data.find('thead th:contains("Player")')
    var new_header_cell = header_cell.clone();
    new_header_cell.text('Team');
    new_header_cell.insertAfter(header_cell);
    
    var data_rows = new_data.find('tbody tr');
    data_rows.each(function(i, v) {
        var jv = jQuery(v);
        var player_cell = jv.find('td.player-label');
        var new_player_name = player_cell.find('a[href^="/nfl"]').first().text().trim();
        
        var team_text = '';
        if (type == 'proj') {
            team_text = player_cell.contents().filter(function() { return this.nodeType === 3; }).text().trim();
        }
        else {
            team_text = player_cell.find('small:first').text().trim();
        }
        if (!team_text) {
            team_text = 'FA';
        }
        var new_team_cell = jQuery('<td>' + team_text + '</td>');
        
        player_cell.text(new_player_name);
        new_team_cell.insertAfter(player_cell);
    });
    
    var new_headers = fpros_rank_headers;
    if (type == 'proj') {
        new_headers = fpros_proj_headers[pos_name];
    }
    
    var new_csv = new_data.table2CSV({
        delivery: 'value',
        header: new_headers
    });

    return new_csv;
}

function getPosProjections() {
    var ready_proj = all_positions_proj.length;
    var type = 'proj';
    //TODO add a catch here if this array is empty at the end or something
    for (var p=0; p < all_positions_proj.length; p++) {
        var p_name = all_positions_proj[p];
        fetchPositionData(p_name, type, function(p_name, raw_data) {
            var pos_name, retrieved_proj, parsed_proj;
            
            if (!(raw_data == 'error')) {
                if (off_positions_proj.indexOf(p_name) > -1 || p_name == '6') {
                    if (p_name == '6') {
                        pos_name = 'DST';
                    }
                    else {
                        pos_name = p_name.toUpperCase();
                    }
                    raw_data = convertFProsToCSV(raw_data, type, pos_name);
                }
                else {
                    pos_name = idp_conversion[p_name];
                }
                
                parsed_proj = parsesiteCSV(raw_data);
                
                var headers = parsed_proj[0];
                for (var h=0; h < headers.length; h++) {
                    headers[h] = headers[h].trim();
                }
                
                var team_header = headers.indexOf('Team');
                var player_name_header = headers.indexOf('Player');
                
                if ((team_header > -1) && (player_name_header > -1)) {
                    for (var i=1; i < parsed_proj.length; i++) {
                        var currentline = parsed_proj[i];
                        
                        var team_name = currentline[team_header].trim();
                        if (team_name_conversion.hasOwnProperty(team_name)) {
                            team_name = team_name_conversion[team_name];
                        }
                        
                        var player_name = currentline[player_name_header].trim();

                        if (def_positions_proj.indexOf(p_name) > -1) {
                            //DST
                            if (p_name == '6') {
                                if (siteType == "espn") {
                                    player_name = player_name.split(' ').reverse()[0] + ' D/ST';
                                }
                                else if (siteType == "yahoo") {
                                    player_name = team_name;
                                }
                                else if (siteType == "fleaflicker") {
                                    player_name = player_name.split(' ').reverse()[0];
                                }
                                pos_name = 'D/ST';
                                team_name = "-";
                            }
                            //Other IDPs, reversing names
                            else {
                                player_name = player_name.split(',')[1] + " " + player_name.split(',')[0]
                            }
                            
                            player_name = player_name.trim();
                            
                            if (player_name == 'D\'qwell Jackson') {
                                player_name = 'D\'Qwell Jackson';
                            }
                        }
                        
                        // Add team and position to player_name for differentiating duplicate names
                        var full_name = player_name + "|" + pos_name + "|" + team_name;
                        
						if (!alldata.hasOwnProperty(full_name)) {
							alldata[full_name] = {};
						}
                        
                        for (var j = player_name_header + 1; j < headers.length; j++) {
                            alldata[full_name][headers[j].trim()] = currentline[j].trim().replace(',', '');
                        }
                    }
                }
            }
            
            ready_proj = ready_proj - 1;
            if (ready_proj == 0) {
                addProjections();
            }
        });
    }
}

function getPosRankings() {
    var ready_rank = all_positions_rank.length;
    var type = 'rank';
    
    for (var p=0; p < all_positions_rank.length; p++) {
        var p_name = all_positions_rank[p];
        fetchPositionData(p_name, type, function(p_name, raw_data) {
            var pos_name, retrieved_rank, parsed_rank;
            
            if (!(raw_data == 'error')) {
                pos_name = p_name.toUpperCase();
                raw_data = convertFProsToCSV(raw_data, type, pos_name);
                
                parsed_rank = parsesiteCSV(raw_data);
                
                var headers = parsed_rank[0];
                for (var h=0; h < headers.length; h++) {
                    headers[h] = headers[h].trim();
                }
                
                var team_header = headers.indexOf('Team');
                var player_name_header = headers.indexOf('Player');
                
                if ((team_header > -1) && (player_name_header > -1)) {
                    for (var i=1; i < parsed_rank.length; i++) {
                        var currentline = parsed_rank[i];
                        
                        var team_name = currentline[team_header].trim();
                        if (team_name_conversion.hasOwnProperty(team_name)) {
                            team_name = team_name_conversion[team_name];
                        }
                        
                        var player_name = currentline[player_name_header].trim();
                        
                        if (p_name == 'dst') {
                            if (siteType == "espn") {
                                player_name = player_name.split(' ').pop() + ' D/ST';
                            }
                            else if (siteType == "yahoo") {
                                player_name = team_abbrevs[player_name];
                            }
                            else if (siteType == "fleaflicker") {
                                player_name = player_name.split(' ').pop();
                            }

                            pos_name = 'D/ST';
                            team_name = "-";
                        }
                        
                        player_name = player_name.trim();
                        
                        // Add team and position to player_name for differentiating duplicate names
                        var full_name = player_name + "|" + pos_name + "|" + team_name;
                        
                        if (!alldata.hasOwnProperty(full_name)) {
                            alldata[full_name] = {};
                        }
                        
                        for (var j = player_name_header + 2; j < headers.length; j++) {
                            alldata[full_name][headers[j].trim()] = currentline[j].trim();
                        }
                    }
                }
            }
            
            ready_rank = ready_rank - 1;
            if (ready_rank == 0) {
                addRankings();
            }
        });
    }
}

//this function can be combined with above probably
function getRosRankings() {
    var ready_ros = all_positions_rank.length;
    var type = 'ros';
    
    for (var p=0; p < all_positions_rank.length; p++) {
        var p_name = all_positions_rank[p];
        fetchPositionData(p_name, type, function(p_name, raw_data) {
            var pos_name, retrieved_rank, parsed_rank;
            
            if (!(raw_data == 'error')) {
                pos_name = p_name.toUpperCase();
                raw_data = convertFProsToCSV(raw_data, type, pos_name);
                
                parsed_rank = parsesiteCSV(raw_data);
                
                var headers = parsed_rank[0];
                for (var h=0; h < headers.length; h++) {
                    headers[h] = headers[h].trim();
                }
                
                var team_header = headers.indexOf('Team');
                var player_name_header = headers.indexOf('Player');
                
                if ((team_header > -1) && (player_name_header > -1)) {
                    for (var i=1; i < parsed_rank.length; i++) {
                        var currentline = parsed_rank[i];
                        
                        var team_name = currentline[team_header].trim();
                        if (team_name_conversion.hasOwnProperty(team_name)) {
                            team_name = team_name_conversion[team_name];
                        }
                        
                        var player_name = currentline[player_name_header].trim();
                        
                        if (p_name == 'dst') {
                            if (siteType == "espn") {
                                player_name = player_name.split(' ').pop() + ' D/ST';
                            }
                            else if (siteType == "yahoo") {
                                player_name = team_abbrevs[player_name];
                            }
                           else if (siteType == "fleaflicker") {
                                player_name = player_name.split(' ').pop();
                            }

                            pos_name = 'D/ST';
                            team_name = "-";
                        }
                        
                        player_name = player_name.trim();
                        
                        // Add team and position to player_name for differentiating duplicate names
                        var full_name = player_name + "|" + pos_name + "|" + team_name;
                        
                        if (!alldata.hasOwnProperty(full_name)) {
                            alldata[full_name] = {};
                        }
                        
                        for (var j = player_name_header + 2; j < headers.length; j++) {
                            alldata[full_name][headers[j].trim() + ' Ros'] = currentline[j].trim();
                        }
                    }
                }
            }
            
            ready_ros = ready_ros - 1;
            if (ready_ros == 0) {
                addRos();
            }
        });
    }
}

function getAvg() {
    chrome.storage.local.get('fp_player_activity_data', function (ad) {
        if (ad['fp_player_activity_data']) {
            activity_data = ad['fp_player_activity_data'];
        }
        else {
            activity_data = {};
            activity_data[current_season_avg] = {};
        }
        
        var activity_data_current_season;
        if (activity_data.hasOwnProperty(current_season_avg)) {
            activity_data_current_season = activity_data[current_season_avg];
        }
        else {
            activity_data[current_season_avg] = {};
            activity_data_current_season = activity_data[current_season_avg];
        }
        
        if (activity_data_current_season.hasOwnProperty(siteType)) {
            activity_data_current_season_site = activity_data_current_season[siteType];
        }
        else {
            activity_data_current_season[siteType] = {};
            activity_data_current_season_site = activity_data_current_season[siteType];
        }
        
        addAvg();
    });
}

function parseDepth(data) {
    var weekly_depth_data = {};
    var team_name = '';
        
    var depth_rows = jQuery('div.article-content > table > tbody> tr > td.la > table tbody tr', data);
    depth_rows.each(function(i, v) {
        var j_v = jQuery(v);
        var j_vb = j_v.find('b');
        if (i % 2 == 0) {
            team_name = j_vb.text();
            weekly_depth_data[team_name] = {};
        }
        else {
            var depth_poses = j_vb;
            depth_poses.each(function(j, x) {
                var j_x = jQuery(x);
                var depth_pos = j_x.text().replace(':', '');
                //TODO maybe add FB
                if (depth_pos == 'NT') {
                    depth_pos = 'DT';
                }
                else if (depth_pos == 'OLB' || depth_pos == 'ILB' || depth_pos == 'MLB') {
                    depth_pos = 'LB';
                }
                if (!weekly_depth_data[team_name].hasOwnProperty(depth_pos)) {
                    weekly_depth_data[team_name][depth_pos] = {};
                }
                
                var depth_players = j_x.nextUntil('br');
                depth_players.each(function(k, y) {
                    var j_y = jQuery(y);
                    var depth_player_num = k + 1;
                    var depth_player_text = j_y.text();
                    var depth_player_name = depth_player_text;
                    var depth_player_status = [];
                    if (depth_player_text.indexOf('(') > -1) {
                        var stat_match = depth_player_text.match(/\([\w/]+\)/g);
                        if (stat_match && stat_match.length) {
                            for (n=0; n<stat_match.length; n++) {
                                depth_player_status.push(stat_match[n].replace(/[()]/g, '').toUpperCase());
                            }
                        }
                        depth_player_name = depth_player_text.slice(0, depth_player_text.indexOf(' ('));
                    }
                    
                    //TODO fix wrong positions, like mathieu
                    depth_player_name = depth_player_name.replace(/[�′]+/g, "'");
                    if (depth_player_name == 'Robert Griffin III') {
                        depth_player_name = 'Robert Griffin';
                    }
                    else if (depth_player_name == 'Ted Ginn') {
                        depth_player_name = 'Ted Ginn Jr.';
                    }
                    else if (depth_player_name == 'A.J. McCarron') {
                        depth_player_name = 'AJ McCarron';
                    }
                    else if (depth_player_name == 'Duke Johnson') {
                        depth_player_name = 'Duke Johnson Jr.';
                    }
                    else if (depth_player_name == 'Deandre Washington') {
                        depth_player_name = 'DeAndre Washington';
                    }
                    else if (depth_player_name == 'Benny Cunningham') {
                        depth_player_name = 'Benjamin Cunningham';
                    }
                    else if (depth_player_name == 'Rob Kelley') {
                        depth_player_name = 'Robert Kelley';
                    }
                    else if (depth_player_name == 'George Atkinson') {
                        depth_player_name = 'George Atkinson III';
                    }
                    else if (depth_player_name == 'Steve Smith') {
                        depth_player_name = 'Steve Smith Sr.';
                    }
                    else if (depth_player_name == 'Seth Devalve') {
                        depth_player_name = 'Seth DeValve';
                    }
                    else if (depth_player_name == 'A.J. Derby') {
                        depth_player_name = 'AJ Derby';
                    }
                    else if (depth_player_name == 'MarQuies Gray') {
                        depth_player_name = 'MarQueis Gray';
                    }
                    else if (depth_player_name == 'Navorro Bowman') {
                        depth_player_name = 'NaVorro Bowman';
                    }
                    else if (depth_player_name == 'Jeremiah Attaochu') {
                        depth_player_name = 'Jerry Attaochu';
                    }
                    else if (depth_player_name == 'John Cyprien') {
                        depth_player_name = 'Johnathan Cyprien';
                    }
                    else if (depth_player_name == 'Kahlil Mack') {
                        depth_player_name = 'Khalil Mack';
                    }
                    else if (depth_player_name == 'Michael Mitchell') {
                        depth_player_name = 'Mike Mitchell';
                    }
                    else if (depth_player_name == 'David Bruton') {
                        depth_player_name = 'David Bruton Jr.';
                    }
                    else if (depth_player_name == 'PJ Williams') {
                        depth_player_name = 'P.J. Williams';
                    }
                   
                    var depth_player_type = j_y.find('font').addBack('font').attr('color');
                    
                    if (depth_player_name.length) {
                        weekly_depth_data[team_name][depth_pos][depth_player_name] = {
                            'num': depth_player_num,
                            'status': depth_player_status,
                            'type': depth_player_type
                        };
                    }
                });
            });
        }
    });
    
    depth_data_current_week = weekly_depth_data;
    depth_data[current_season]['W' + current_week] = depth_data_current_week;
    
    var new_depth_data = {};
    new_depth_data[storageDepthKey] = depth_data;
    chrome.storage.local.set(new_depth_data, function() {
        addDepth();
    });
}

function getDepth() {
    chrome.storage.local.get(storageDepthKey, function (de) {
        if (de[storageDepthKey]) {
            depth_data = de[storageDepthKey];
        }
        else {
            depth_data = {};
            depth_data[current_season] = {};
        }
        
        if (depth_data.hasOwnProperty(current_season)) {
            depth_data_season = depth_data[current_season];
        }
        else {
            depth_data_season[current_season] = {};
            depth_data_season = depth_data_season[current_season];
        }
        
        if (depth_data_season.hasOwnProperty('W' + current_week)) {
            depth_data_current_week = depth_data_season['W' + current_week];
        }
        else {
            depth_data_season['W' + current_week] = {};
            depth_data_current_week = depth_data_season['W' + current_week];
        }
        
        jQuery.ajax({
            url: '//subscribers.footballguys.com/apps/depthchart.php?type=all&lite=no&exclude_coaches=yes',
            timeout: ajax_timeout
        }).done(function(data) {
            parseDepth(data);
        }).fail(function() {
            depth_fail = true;
            addDepth();
        });
    });
}

function getData() {
    if (show_avg || show_spark || show_current) {
        getAvg();
    }
    else {
        avgDone.resolve();
    }
    
    if (show_proj) {
        getPosProjections();
    }
    else {
        projDone.resolve();
    }

    if (show_rank) {
        getPosRankings();
    }
    else {
        rankDone.resolve();
    }

    if (show_ros) {
        getRosRankings();
    }
    else {
        rosDone.resolve();
    }
    
    if (show_depth) {
        getDepth();
    }
    else {
        depthDone.resolve();
    }
}

function calcBonus(bonus_type, pd) {
    var adj = 0;
    
    if (siteType == 'yahoo') {
        var b_list = [];
        var this_settings_dict = settings[bonus_type + '_bonus'];
        for (var k in this_settings_dict) {
            if (this_settings_dict.hasOwnProperty(k)) {
                b_list.push(k);
            }
        }
        b_list = b_list.sort().reverse();
        for (var b=0; b < b_list.length; b++) {
            if (parseFloat(b_list[b+1])) {
                adj += (this_settings_dict[b_list[b]] * (b_list[b] <= pd[bonus_type + '_yds'] && pd[bonus_type + '_yds'] < b_list[b+1]));
            }
            else {
                adj += (this_settings_dict[b_list[b]] * (pd[bonus_type + '_yds'] >= b_list[b]));
            }
        }
    }
    else if (siteType == 'fleaflicker') {
        var b_list = settings[bonus_type + '_bonus'];
        if (b_list && b_list.length) {
            dlog(pd);
            
            for (l=0; l < b_list.length; l++) {
                var bonus_obj = b_list[l];
                var b_pts = bonus_obj['pts'];
                var b_low = bonus_obj['low'];
                var b_high = bonus_obj['high'];
                var b_per = bonus_obj['is_per'];
                
                var is_b_low = (typeof b_low === "number") ? true : false;
                var is_b_high = (typeof b_high === "number") ? true : false;
                
                var b_match = false;
                
                if (b_per) {
                    b_match = true;
                }
                else {
                    if (is_b_low && is_b_high) {
                        b_match = (b_low <= pd && b_high >= pd) ? true : false;
                    }
                    else if (is_b_low) {
                        b_match = (b_low <= pd) ? true : false;
                    }
                    else if (is_b_high) {
                        b_match = (b_high >= pd) ? true : false;
                    }
                }

                if (b_match) {
                    var adj_val = 0;
                    if (b_per) {
                        var pd_apply = pd;
                        if (is_b_low && is_b_high) {
                            pd_apply = Math.max(Math.min(pd - b_low, b_high - b_low), 0);
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
        }
    }
    
    return adj;
}

function calculateProjections(datatype, player_name, pos_name, team_name) {
    if (datatype == 'depth') {
        return [player_name, pos_name, team_name];
    }
    
    // get their projected data, multiply it by the league settings
    var full_name = player_name + "|" + pos_name + "|" + team_name;
    var player_data = alldata[full_name];

    if (typeof(player_data) === "undefined") {
        if (player_name == 'EJ Manuel') {
            player_name = 'E.J. Manuel';
        }
        else if (player_name == 'T.Y. Hilton') {
            player_name = 'Ty Hilton';
        }
        else if (player_name == 'Stevie Johnson') {
            player_name = 'Steve Johnson';
        }
        else if (player_name == 'Ha Ha Clinton-Dix') {
            player_name = 'Hasean Clinton-Dix';
        }
        else if (player_name == 'Corey Brown') {
            player_name = 'Philly Brown';
        }
        else if (player_name == 'NaVorro Bowman') {
            player_name = 'Navorro Bowman';
        }
		else if (player_name == 'DeVante Parker') {
            player_name = 'Devante Parker';
        }
        else if (player_name == 'Boobie Dixon') {
            player_name = 'Anthony Dixon';
        }
        else if (player_name.indexOf(' III') > -1) {
            player_name = player_name.slice(0, player_name.indexOf(' III'));
        }
        else if (player_name.indexOf(' Jr.') > -1) {
            player_name = player_name.slice(0, player_name.indexOf(' Jr.'));
        }
        else if (player_name.indexOf(' Sr.') > -1) {
            player_name = player_name.slice(0, player_name.indexOf(' Sr.'));
        }
        else if (player_name.split(' ')[0] == 'Christopher') {
            player_name = 'Chris ' + player_name.split(' ').slice(1).join(' ');
        }
        else if (player_name.split(' ')[0] == 'Chris') {
            player_name = 'Christopher ' + player_name.split(' ').slice(1).join(' ');
        }
        else if (player_name.split(' ')[0] == 'Benjamin') {
            player_name = 'Benny ' + player_name.split(' ').slice(1).join(' ');
        }
        else if (player_name.split(' ')[0] == 'Benny') {
            player_name = 'Benjamin ' + player_name.split(' ').slice(1).join(' ');
        }
        else if (player_name.split(' ')[0] == 'Tim') {
            player_name = 'Timothy ' + player_name.split(' ').slice(1).join(' ');
        }
        else if (player_name.split(' ')[0] == 'Timothy') {
            player_name = 'Tim ' + player_name.split(' ').slice(1).join(' ');
        }
        else if (player_name.split(' ')[0] == 'Rob') {
            player_name = 'Robert ' + player_name.split(' ').slice(1).join(' ');
        }
        else if (player_name.split(' ')[0] == 'Robert') {
            player_name = 'Rob ' + player_name.split(' ').slice(1).join(' ');
        }
        else if (player_name.split(' ')[0] == 'Mike') {
            player_name = 'Michael ' + player_name.split(' ').slice(1).join(' ');
        }
        else if (player_name.split(' ')[0] == 'Michael') {
            player_name = 'Mike ' + player_name.split(' ').slice(1).join(' ');
        }
        
        full_name = player_name + "|" + pos_name + "|" + team_name;
        
        // For multi-position players
        if (player_name == 'Dexter McCluster') {
            full_name = 'Dexter McCluster|RB|TEN';
        }
        else if (player_name == 'Julius Peppers') {
            full_name = 'Julius Peppers|LB|GB';
        }
        else if (player_name == 'DeMarcus Ware') {
            full_name = 'Demarcus Ware|LB|DEN';
        }
        else if (player_name == 'Jared Allen') {
            full_name = 'Jared Allen|DE|CAR';
        }
        else if (player_name == 'Jadeveon Clowney') {
            full_name = 'Jadeveon Clowney|LB|HOU';
        }
        else if (player_name == 'Derrick Morgan') {
            full_name = 'Derrick Morgan|LB|TEN';
        }
		else if (player_name == 'Khalil Mack') {
            full_name = 'Khalil Mack|DE|OAK';
        }
        else if (player_name == 'Chandler Jones') {
            full_name = 'Chandler Jones|LB|ARI';
        }	
        else if (player_name == 'Jabaal Sheard') {
            full_name = 'Jabaal Sheard|DE|NE';
        }	

        player_data = alldata[full_name];
        
        //last ditch efforts
        if (typeof(player_data) === "undefined") {
            var player_name_addons = [' III', ' Jr.', ' Sr.'];
            for (a=0; a < player_name_addons.length; a++) {
                var new_full_name = player_name + player_name_addons[a] + "|" + pos_name + "|" + team_name;
                if (typeof(alldata[new_full_name]) !== "undefined") {
                    player_data = alldata[new_full_name];
                    break;
                }
            }
        }

        if (typeof(player_data) === "undefined") {
            return("--");
        }
    }
    
    dlog('player data: ');
    dlog(player_data);

    if (datatype == 'proj') {
        //until fantasysharks is https
        if ((document.location.protocol == 'https:') && (idp_positions.indexOf(pos_name) > -1)) {
            return('--');
        }
        
        var player_score = 0;
        
        var settingNames = [
            'pass_yds', 'pass_tds', 'pass_ints', 'pass_att', 'pass_cmp', 'pass_icmp',
            'rush_yds', 'rush_tds', 'rush_att',
            'rec_yds', 'rec_att', 'rec_tds',
            'xpt', 'fg', 'fga', 'fgm',
            'fumbles'
        ];
        var settingDict = {
            'sk': 'Scks',
            'ff': 'FumFrc',
            'tka': 'Tack',
            'tks': 'Asst',
            'pd': 'PassDef',
            'int': 'Int',
            'deftd': 'DefTD',
            'fr': 'Fum',

            'sk': 'def_sack',
            'ff': 'def_ff',
            'int': 'def_int',
            'deftd': 'def_td',
            'fr': 'def_fr',

            'pa': 'def_pa',
            'ya': 'def_tyda'
        };
        
        
        for (n=0; n < settingNames.length; n++) {
            var sn = settingNames[n];
            var setting_score = settings[sn];
            dlog(sn);
            dlog(setting_score);
            var p_data = 0;
            
            if (sn == 'pass_icmp') {
                p_data = (player_data['pass_att'] || 0) - (player_data['pass_cmp'] || 0);
            }
            else if (sn == 'fgm') {
                p_data = (player_data['fga'] || 0) - (player_data['fg'] || 0);
            }
            else {
                p_data = (player_data[sn] || 0);
            }
            dlog(p_data);
            var p_plus = setting_score * p_data;
            dlog(p_plus);
            player_score += p_plus;
            
            if (siteType == 'fleaflicker') {
                var p_plus_bonus = calcBonus(sn, p_data);
                dlog(p_plus_bonus);
                player_score += p_plus_bonus;
            }
        }
        
        for (var k in settingDict) {
            if (settingDict.hasOwnProperty(k)) {
                //todo fix this to apply on a per position basis
                if ((k == 'pa' || k == 'ya') && off_positions_proj.indexOf(pos_name.toLowerCase()) > -1) {
                    dlog('skipping dst scoring for pos: ' + pos_name);
                    continue;
                }
                var k_val = settingDict[k];
                dlog(k, k_val);
                var settings_k = settings[k];
                dlog(settings_k);
                var p_data_val = (player_data[k_val] || 0);
                dlog(p_data_val);
                
                var p_plus_d = settings_k * p_data_val;
                dlog(p_plus_d);
                
                player_score += p_plus_d;
                
                if (siteType == 'fleaflicker') {
                    var p_plus_bonus_d = calcBonus(k, p_data_val);
                    dlog(p_plus_bonus_d);
                    player_score += p_plus_bonus_d;
                }
            }
        }


        var player_adjustment = 0;
        if (settings['siteType'] == 'espn') {
            player_adjustment =
                settings['pass_300_bonus'] * (300 <= player_data['pass_yds'] && player_data['pass_yds'] < 400) +
                settings['pass_400_bonus'] * ((player_data['pass_yds'] || 0) >= 400) +
                settings['rush_100_bonus'] * (100 <= player_data['rush_yds'] && player_data['rush_yds'] < 200) +
                settings['rush_200_bonus'] * ((player_data['rush_yds'] || 0) >= 200) +
                settings['rec_100_bonus'] * (100 <= player_data['rec_yds'] && player_data['rec_yds'] < 200) +
                settings['rec_200_bonus'] * ((player_data['rec_yds'] || 0) >= 200) +
                
                settings['pa0'] * (player_data['def_pa'] == 0) +
                settings['pa1'] * (0 < player_data['def_pa'] && player_data['def_pa'] <= 6) +
                settings['pa7'] * (6 < player_data['def_pa'] && player_data['def_pa'] <= 13) +
                settings['pa14'] * (13 < player_data['def_pa'] && player_data['def_pa'] <= 17) +
                settings['pa18'] * (17 < player_data['def_pa'] && player_data['def_pa'] <= 21) +
                settings['pa22'] * (21 < player_data['def_pa'] && player_data['def_pa'] <= 27) +
                settings['pa28'] * (27 < player_data['def_pa'] && player_data['def_pa'] <= 34) +
                settings['pa35'] * (34 < player_data['def_pa'] && player_data['def_pa'] <= 45) +
                settings['pa46'] * (45 < player_data['def_pa']) +
                
                settings['ya100'] * (0 <= player_data['def_tyda'] && player_data['def_tyda'] < 100) +
                settings['ya199'] * (100 <= player_data['def_tyda'] && player_data['def_tyda'] < 200) +
                settings['ya299'] * (200 <= player_data['def_tyda'] && player_data['def_tyda'] < 300) +
                settings['ya349'] * (300 <= player_data['def_tyda'] && player_data['def_tyda'] < 350) +
                settings['ya399'] * (350 <= player_data['def_tyda'] && player_data['def_tyda'] < 400) +
                settings['ya449'] * (400 <= player_data['def_tyda'] && player_data['def_tyda'] < 450) +
                settings['ya499'] * (450 <= player_data['def_tyda'] && player_data['def_tyda'] < 500) +
                settings['ya549'] * (500 <= player_data['def_tyda'] && player_data['def_tyda'] < 550) +
                settings['ya550'] * (550 <= player_data['def_tyda']);
        }
        else if (settings['siteType'] == 'yahoo') {
            player_adjustment =
                calcBonus('pass', player_data) +
                calcBonus('rush', player_data) +
                calcBonus('rec', player_data) +
                
                settings['pa0'] * (player_data['def_pa'] == 0) +
                settings['pa1'] * (0 < player_data['def_pa'] && player_data['def_pa'] <= 6) +
                settings['pa7'] * (6 < player_data['def_pa'] && player_data['def_pa'] <= 13) +
                settings['pa14'] * (13 < player_data['def_pa'] && player_data['def_pa'] <= 20) +
                settings['pa21'] * (20 < player_data['def_pa'] && player_data['def_pa'] <= 27) +
                settings['pa28'] * (27 < player_data['def_pa'] && player_data['def_pa'] <= 34) +
                settings['pa35'] * (34 < player_data['def_pa']) +
                
                settings['ya100'] * (0 <= player_data['def_tyda'] && player_data['def_tyda'] < 100) +
                settings['ya199'] * (100 <= player_data['def_tyda'] && player_data['def_tyda'] < 200) +
                settings['ya299'] * (200 <= player_data['def_tyda'] && player_data['def_tyda'] < 300) +
                settings['ya399'] * (300 <= player_data['def_tyda'] && player_data['def_tyda'] < 400) +
                settings['ya499'] * (400 <= player_data['def_tyda'] && player_data['def_tyda'] < 500) +
                settings['ya500'] * (500 <= player_data['def_tyda']);
        }
        
            
        player_score += player_adjustment;
        
        dlog('returning score: ');
        dlog(player_name +','+ player_score);
        
        return (Math.round(player_score * 10) / 10).toFixed(1);
    }
    else if (datatype == 'rank') {
        if (parseFloat(player_data['Avg Rank'])) {
            var player_rank = (Math.round(player_data['Avg Rank'] * 10) / 10).toFixed(1);
            var player_stdev = (Math.round(player_data['Std Dev'] * 10 * 1.96) / 10).toFixed(1);
            return [player_rank, player_stdev];
        }
        else {
            return ['--', '--'];
        }
    }
    else if (datatype == 'ros') {
        if (parseFloat(player_data['Avg Rank Ros'])) {
            var player_ros = (Math.round(player_data['Avg Rank Ros'] * 10) / 10).toFixed(1);
            var player_ros_stdev = (Math.round(player_data['Std Dev Ros'] * 10 * 1.96) / 10).toFixed(1);
            return [player_ros, player_ros_stdev];
        }
        else {
            return ['--', '--'];
        }
    }
}

function getProjectionData(datatype, currRow, cell) {
    var player_cell = currRow.find(player_name_selector);
    if (siteType == 'yahoo' && onMatchupPreviewPage) {
        player_cell = cell.nearest('td.player');
    }

    var player_cell_text = player_cell.text().trim();
    //This is stupid, but.......whatever.
    if (player_cell.find('.fantasy-finder')) {
        player_cell = player_cell.clone();
        player_cell.find('#inline-availability-marker').remove();
        player_cell_text = player_cell.text().trim().replace(/(\r|\n)/g, '');
    }
    
    if (datatype == 'adjavg') {
        var normavg;
        if (show_avg) {
            var avg_cell = currRow.find('FantasyPlusAvgData');
            normavg = avg_cell.prev().text();
        }
        
        if ((!player_cell_text) || (normavg == "--")) {
            insertAdjAvg(currRow, '--', []);
        }
        else {
            var player_id;
            if (siteType == 'espn') {
                //ESPN sometimes assigns completely wrong playerIds in the cell. I'm serious. I'm sitting here trying to debug why Alfred Blue has completely wrong fucking numbers, and it turns out ESPN thinks he's a defensive tackle bro named Euclid Cummings. I can't make this shit up. I'm pretty sure it happens with a bunch of newer players though. God damnit ESPN.
                player_id = player_cell.find('a').attr('playerid');
            }
            else if (siteType == 'fleaflicker') {
                var player_href = player_cell.find('div.player-name a.player-text').attr('href');
                player_id = player_href.split('-').pop();
            }
            
            if (!player_id) {
                insertAdjAvg(currRow, '--', []);
            }
            else if (siteType == 'espn') {
                var player_stored_activity = activity_data_current_season_site[player_id] || {};
                var player_stored_activity_updated_week = player_stored_activity['last_updated_week'] || 0;
                var player_stored_activity_games = player_stored_activity['games_played'] || [];
                
                var player_stored_activity_league = player_stored_activity[league_id] || {};
                var player_stored_activity_updated = player_stored_activity_league['last_updated'] || 0;
                var player_stored_activity_pts = player_stored_activity_league['weekly_points'] || [];
                var player_stored_activity_league_avg = player_stored_activity_league['pts_avg'] || null;

                if ((player_stored_activity) && ((current_time - player_stored_activity_updated) < (1000 * 60 * check_minutes_avg)) && ((parseFloat(player_stored_activity_league_avg)) || (player_stored_activity_league_avg == '--')) && player_stored_activity_pts) {
                    insertAdjAvg(currRow, player_stored_activity_league_avg, player_stored_activity_pts);
                }
                else {
                    //TODO: change this bs in the future i guess, espn sucks super hard. if you request 2014 data (which is correct), it sets your season to 2014. COME ON (gob bluth voice). I don't know when to make this switch though since it was working before.
                    var espn_points_data = {'leagueId': league_id, 'playerId': player_id, 'playerIdType': 'playerId', 'seasonId': current_season_avg, 'xhr': '1'};
                    jQuery.get('//games.espn.com/ffl/format/playerpop/overview', espn_points_data, function(po) {
                        if (!po) {
                            calcAdjAvg(currRow, player_id, [], []);
                        }
                        else {
                            var podata = jQuery(po);
                            
                            var points_table = jQuery('div#tabView0 div#moreStatsView0 div#pcBorder table tbody', podata);
                            var points_table_header = points_table.find('tr.pcStatHead');
                            var ptsindex = points_table_header.find('td:contains("PTS")').first().index() + 1;
                            var points_table_rows = points_table.find('tr:not(.pcStatHead) td:nth-child(' + ptsindex + ')');
                            
                            var weeklyPointsData = jQuery.map(points_table_rows, function(ptval) { return ptval.innerText; });
                            weeklyPointsData = weeklyPointsData.splice(0, current_week_avg);
                            for (var i=0; i < weeklyPointsData.length; i++) {
                                if (weeklyPointsData[i] == '-') {
                                    weeklyPointsData[i] = null;
                                }
                                else {
                                    weeklyPointsData[i] = parseFloat(weeklyPointsData[i]);
                                }
                            }

                            if (player_cell_text.match(/(D\/ST|TQB|HC)$/)) {
                                calcAdjAvg(currRow, player_id, null, weeklyPointsData);
                            }
                            else if ((player_stored_activity_games.length > 0) && (current_week_avg == player_stored_activity_updated_week)) {
                                calcAdjAvg(currRow, player_id, player_stored_activity_games, weeklyPointsData);
                            }
                            else {
                                var playercard = jQuery('div#tabView0 div#moreStatsView0 div.pc:not(#pcBorder)', podata);
                                var pop_player_id = playercard.find('a[href*="playerId"], a[href*="proId"]').attr('href').match(/(playerId=|proId\/)(\d+)/)[2];
                                
                                var espn_player_link = "//espn.com/nfl/player/gamelog/_/id/" + pop_player_id + "/year/" + current_season_avg_week;
                                jQuery.get(espn_player_link, function(p) {
                                    if (!p) {
                                        calcAdjAvg(currRow, player_id, [], weeklyPointsData);
                                    }
                                    else {
                                        var adata = jQuery(p);
                                        var base_games_played = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

                                        //:first for non post season
                                        var gamedateindex = jQuery('div.mod-player-stats div.mod-content table:first tbody tr.colhead td:contains("DATE")', adata).first().index();
                                        if (gamedateindex > -1) {
                                            var gamedates = jQuery('div.mod-player-stats div.mod-content table:first tbody tr[class*="team"]', adata);
                                            jQuery.each(gamedates, function(gp_i, gp_v) {
                                                var gp_v_parse = jQuery(gp_v);
                                                var gamedate = gp_v_parse.find('td').eq(gamedateindex).text().trim();
                                                var rowDate = rowDate = new Date(gamedate.split(' ')[1] + ' ' + current_season_avg_week);
                                                if (rowDate.getMonth() < 5) {
                                                    rowDate = new Date(gamedate.split(' ')[1] + ' ' + (current_season_avg_week + 1));
                                                }
                                                var rowWeek = Math.ceil(((rowDate - seasonstart_avg_week) / 86400000) / 7);
                                                base_games_played[rowWeek - 1] = 1;
                                            });
                                        }
                                        
                                        var games_played = base_games_played;
                                        
                                        calcAdjAvg(currRow, player_id, games_played, weeklyPointsData);
                                    }
                                });
                            }
                        }
                    });
                }
            }
            else if (siteType == 'fleaflicker') {
                var player_stored_activity = activity_data_current_season_site[player_id] || {};
                var player_stored_activity_league = player_stored_activity[league_id] || {};
                var player_stored_activity_updated = player_stored_activity_league['last_updated'] || 0;
                var player_stored_activity_pts = player_stored_activity_league['weekly_points'] || [];
                var player_stored_activity_league_avg = player_stored_activity_league['pts_avg'] || null;

                if ((player_stored_activity) && ((current_time - player_stored_activity_updated) < (1000 * 60 * check_minutes)) && ((parseFloat(player_stored_activity_league_avg)) || (player_stored_activity_league_avg == '--')) && player_stored_activity_pts) {
                    insertAdjAvg(currRow, player_stored_activity_league_avg, player_stored_activity_pts);
                }
                else {
                    jQuery.get(player_href, function(po) {
                        if (!po) {
                            calcAdjAvg(currRow, player_id, [], []);
                        }
                        else {
                            var podata = jQuery(po);
                            
                            var points_table = jQuery('table#table_0', podata);
                            var points_table_rows = points_table.find('tbody').find(player_table_row_selector).not('.divider');
                            
                            var weeklyPointsData = jQuery.map(points_table_rows, function(ptval) { return jQuery(ptval).find('td:last').text(); });
                            weeklyPointsData = weeklyPointsData.splice(0, current_week_avg);
                            for (var i=0; i < weeklyPointsData.length; i++) {
                                if (weeklyPointsData[i] == '' || weeklyPointsData[i] == "—") {
                                    weeklyPointsData[i] = null;
                                }
                                else {
                                    weeklyPointsData[i] = parseFloat(weeklyPointsData[i]);
                                }
                            }

                            calcAdjAvg(currRow, player_id, null, weeklyPointsData);
                        }
                    });
                }
            }
        }
    }
    
    else {
        if (!player_cell_text || player_cell_text == "(Empty)") {
            if (siteType == "yahoo" && onMatchupPreviewPage) {
                cell.text('--');
                total_player_ids--;
                if (total_player_ids <= 0) {
                    //TODO check if there is some db of yahoo ids
                    fetchYahooIds.resolve();
                }
                return;
            }
            else {
                return "--";
            }
        }
        
        else if (player_cell_text.match(/(TQB|HC)$/)) { // can't project head coaches or TQB's
            return "--";
        }
        
        var player_name = '';
        var pos_name = '';
        var team_name = '';
        if (siteType == "espn") {
            if (player_cell_text.indexOf('D/ST') > -1) {
                player_name = player_cell.find('a').text().trim();
                team_name = "-";
                pos_name = 'D/ST';
            }
            else {
                player_name = player_cell_text.split(",")[0];
                var team_pos = player_cell_text.split(",")[1].split(/\s|\xa0/);
                team_name = team_pos[1].toUpperCase();
                if (team_name == 'JAX') {
                    team_name = 'JAC';
                }
                else if (team_name == 'WSH') {
                    team_name = 'WAS';
                }

                pos_name = team_pos[2];
                
                if (datatype != 'depth') {
                    if ((pos_name == 'DT') || (pos_name == 'DE')) {
                        pos_name = 'DL';
                    }
                    else if ((pos_name == 'CB') || (pos_name == 'S')) {
                        pos_name = 'DB';
                    }
                }
            }
            player_name = player_name.replace('*', '');
            
            return calculateProjections(datatype, player_name, pos_name, team_name);
        }
        else if (siteType == "yahoo") {
            var player_name_cell = player_cell.find('.ysf-player-name');
            // I might have to fix this more
            var pos_name_cell = player_name_cell.find('span').first().text().trim().split(' - ');
            team_name = pos_name_cell[0].toUpperCase();
            if (team_name == 'JAX') {
                team_name = 'JAC';
            }
            
            pos_name = pos_name_cell[1];
            if (pos_name == "DEF") {
                pos_name = "D/ST";
            }
            if (datatype != 'depth') {
                if ((pos_name == 'DT') || (pos_name == 'DE')) {
                    pos_name = 'DL';
                }
                else if ((pos_name == 'CB') || (pos_name == 'S')) {
                    pos_name = 'DB';
                }
            }
            
            player_name = player_name_cell.find('a').text().trim();
            
            if (pos_name == 'D/ST') {
                player_name = team_name;
                team_name = '-';
            }
            
            if (onMatchupPreviewPage || onFreeAgencyPage) {
                var player_href = player_name_cell.find('a').attr('href');
                var player_id = player_href.split('/').reverse()[0];
                var seenId = storage_translation_data.hasOwnProperty('ID_' + player_id);
                
                if (pos_name == "D/ST" || seenId) {
                    if (seenId) {
                        player_name = storage_translation_data['ID_' + player_id];
                    }
                    
                    var calcVal = calculateProjections(datatype, player_name, pos_name, team_name);
                    if (onMatchupPreviewPage) {
                        cell.text(calcVal);
                        total_player_ids--;
                        if (total_player_ids <= 0) {
                            fetchYahooIds.resolve();
                        }
                    }
                    else {
                        if (datatype == 'proj') {
                            cell.text(calcVal);
                        }
                        else if (datatype == 'rank') {
                            if (calcVal.constructor === Array) {
                                cell.text(calcVal[0]);
                            }
                            else {
                                cell.text(calcVal);
                            }
                        }
                        else if (datatype == 'depth') {
                            return calcVal;
                        }
                    }
                }
                else {
                    jQuery.ajax({
                        url: player_href
                    }).done(function(pl) {
                        var pldata = jQuery(pl);
                        var n = pldata.find('#mediasportsplayerheader .player-info h1').text();
                        var pid = this.url.split('/').reverse()[0];
                        
                        var calcVal = calculateProjections(datatype, n, pos_name, team_name);
                        if (onMatchupPreviewPage) {
                            cell.text(calcVal);
                        }
                        else {
                            if (datatype == 'proj') {
                                cell.text(calcVal);
                            }
                            else if (datatype == 'rank') {
                                cell.text(calcVal[0]);
                            }
                        }
                        
                        var new_id_data = {};
                        storage_translation_data['ID_' + pid] = n;
                        new_id_data['fp_yahoo_translation'] = storage_translation_data;
                        chrome.storage.local.set(new_id_data);
                        
                        if (datatype == 'depth') {
                            return calcVal;
                        }
                    }).fail(function() {
                        cell.text('--');
                    }).always(function() {
                        if (onMatchupPreviewPage) {
                            total_player_ids--;
                            if (total_player_ids <= 0) {
                                fetchYahooIds.resolve();
                            }
                        }
                    });
                }
            }
            else {
                return calculateProjections(datatype, player_name, pos_name, team_name);
            }
        }
        else if (siteType == "fleaflicker") {
            player_name = player_cell.find('div.player-name a').text().trim();
            team_name = player_cell.find('div.player-info span.player-team').text().trim();
            pos_name = player_cell.find('div.player-info span.position').text().trim();
            
            if (pos_name == 'D/ST') {
                var psplit = player_name.split(/\s|\xa0/);
                player_name = psplit[psplit.length - 1];
                team_name = "-";
            }
            else {
                if (datatype == 'depth') {
                    if (pos_name == 'DL') {
                        pos_name = ['DE', 'DT'];
                    }
                    else if (pos_name == 'DB') {
                        pos_name = ['CB', 'S'];
                    }
                }
            }
            player_name = player_name.replace('*', '');
            
            return calculateProjections(datatype, player_name, pos_name, team_name);
        }
        else {
            return '--';
        }
    }
}

function calcAdjAvg(thisrow, player_id, games_played, weekly_points_data) {
    var playertotpts = 0;
    var totalplayergames = 0;
    var player_adjavg_rnd = '--';
    
    var past_weekly_points_data = weekly_points_data;
    if (weekly_points_data.length == current_week_avg) {
        past_weekly_points_data = weekly_points_data.slice(0, weekly_points_data.length - 1);
    }
    
    for (var g=0; g < past_weekly_points_data.length; g++){
        var addPts = false;
        if (games_played === null) {
            if (past_weekly_points_data[g] !== null) {
                addPts = true;
            }
        }
        else if (games_played.length) {
            if (games_played[g] == 1) {
                addPts = true;
            }
        }
        
        if (addPts) {
            var weekpt = parseFloat(past_weekly_points_data[g]) || 0;
            playertotpts += weekpt;
            totalplayergames++;
        }
    }
    
    if (totalplayergames > 0) {
        var player_adjavg = (parseFloat(playertotpts) / parseFloat(totalplayergames));
        player_adjavg_rnd = (Math.round(player_adjavg * 10) / 10).toFixed(1);
    }
    
    if (!activity_data_current_season_site.hasOwnProperty(player_id)) {
        activity_data_current_season_site[player_id] = {};
    }
    if (!activity_data_current_season_site[player_id].hasOwnProperty(league_id)) {
        activity_data_current_season_site[player_id][league_id] = {};
    }

    if (games_played === null || games_played.length) {
        activity_data_current_season_site[player_id]['games_played'] = games_played;
        activity_data_current_season_site[player_id]['last_updated_week'] = current_week;
    }
    activity_data_current_season_site[player_id][league_id] = {};
    activity_data_current_season_site[player_id][league_id]['pts_avg'] = player_adjavg_rnd;
    activity_data_current_season_site[player_id][league_id]['weekly_points'] = weekly_points_data;
    activity_data_current_season_site[player_id][league_id]['last_updated'] = current_time;

    insertAdjAvg(thisrow, player_adjavg_rnd, weekly_points_data);
}

function insertAdjAvg(thisrow, p_avg, weekly_points_data) {
    if (show_avg) {
        var thiscell = thisrow.find('.FantasyPlusAvgData');
        //TODO fix for other sites
        if (p_avg > parseFloat(thiscell.prev().text())) {
            thiscell.html('<span style="color:green">' + p_avg + '</span>');
        }
        else {
            thiscell.text(p_avg);
        }
    }
	
    if (show_current) {
        var thisCurrent = thisrow.find('.FantasyPlusCurrentData');
        var curr_score = "--";
        if (weekly_points_data && weekly_points_data.length > 0) {
            if (current_season == current_season_avg_week && weekly_points_data[current_week - 1]) {
                curr_score = weekly_points_data[current_week - 1];
            }
            
            //TODO: add a green or red if above/below projection
            if (parseFloat(curr_score) || curr_score == 0) {
                thisCurrent.text(curr_score);
            }
            else {
                thisCurrent.text(curr_score);
            }
        }
        else {
            thisCurrent.text(curr_score);
        }
    }
    
    if (show_spark) {
        var thisSpark = thisrow.find('.FantasyPlusSparkData');
        if (weekly_points_data && weekly_points_data.length > 0) {
            var week_modifier = Math.max(0, Math.min(17, current_week_avg) - 7);
            var weekly_points_data_cut = weekly_points_data.slice(week_modifier, Math.min(Math.max(0, current_week_avg - 1), 17));
            
            if (weekly_points_data_cut && weekly_points_data_cut.length > 1) {
                thisSpark.sparkline(weekly_points_data_cut, {
                    type: 'line',
                    disableHiddenCheck: true,
                    width: '35px',
                    height: '20px',
                    fillColor: false,
                    lineColor: 'gray',
                    valueSpots: {'10:': '#336600', '2:10': '#FF6600', ':2': '#CC0000'},
                    minSpotColor: false,
                    maxSpotColor: false,
                    spotColor: false,
                    tooltipFormatter: function(a,b,c) { return 'W' + (c.x + week_modifier + 1) + ': ' + c.y; }
                } );
            }
            else {
                thisSpark.text('--');
            }
        }
        else {
            thisSpark.text('--');
        }
    }
    
    total_players--;
    if (total_players == 0) {
        var new_activity_data = {};
        new_activity_data['fp_player_activity_data'] = activity_data;
        chrome.storage.local.set(new_activity_data, function() {
            if ((current_season != current_season_avg) || (current_season != current_season_avg_week)) {
                //doing this to reset back to current season
                var espn_points_data = {'leagueId': league_id, 'seasonId': current_season, 'xhr': '1'};
                jQuery.get('//games.espn.com/ffl/freeagency', espn_points_data);
            }
            avgDone.resolve();
        });
    }
}

function reDefer() {
    if (header_index > -1) {
        projDone = jQuery.Deferred();
        rankDone = jQuery.Deferred();
        rosDone = jQuery.Deferred();
        avgDone = jQuery.Deferred();
        depthDone = jQuery.Deferred();
    }
}

function addAllData(firstrun) {
    if (header_index > -1) {
        if (firstrun && (show_avg || show_spark || show_current)) {
            getAvg();
        }
        else if (show_avg || show_spark || show_current) {
            addAvg();
        }
        else {
            avgDone.resolve();
        }
        
        if (show_proj) {
            addProjections();
        }
        else {
            projDone.resolve();
        }
        
        if (show_rank) {
            addRankings();
        }
        else {
            rankDone.resolve();
        }
        
        if (show_ros) {
            addRos();
        }
        else {
            rosDone.resolve();
        }
        
        if (show_depth) {
            addDepth();
        }
        else {
            depthDone.resolve();
        }
    }
	else {
		avgDone.resolve();
		projDone.resolve();
		rankDone.resolve();
		rosDone.resolve();
		depthDone.resolve();
	}
}

function isCurrentWeek() {
	if (siteType == 'espn') {
		return true;
	}
    else if (siteType == 'fleaflicker') {
        return is_current_week;
    }
	else if (siteType == 'yahoo') {
		if (page_menu) {
			if (onMatchupPreviewPage) {
				var proj_txt = page_menu.contents().filter(function() { return this.nodeType === 3; }).text();
				var proj_idx = proj_txt.indexOf(':');
				var proj_week = proj_txt.substr(0, proj_idx).split(' ').reverse()[0];
			}
			else {
				var proj_week = page_menu.find('#selectlist_nav span').text().replace(/\D/g, '');
			}
			
			if (!isNaN(proj_week) && (proj_week == current_week)) {
				return true;
			}
			else {
				return false;
			}
		}
		else {
			return true;
		}
	}
    else {
        return false;
    }
}

jQuery.fn.nearest = function (selector) {
    var c = jQuery(this[0]);
    var cIdx = c.index();
    var allMatches = c.parent().find(selector);
    var closest = false;
    var bestMatch;
    allMatches.each(function() {
        var sib = jQuery(this);
        var sIdx = sib.index();
        var sibDiff = Math.abs(cIdx - sIdx);
        if (!closest || (sibDiff < closest)) {
            closest = sibDiff;
            bestMatch = sib;
        }
    });
    return bestMatch;
};

function addProjections() {
    var datatype = 'proj';
	var isCurrWeek;
    if (siteType == 'yahoo' && onFreeAgencyPage) {
        isCurrWeek = is_FA_current;
    }
    else {
        isCurrWeek = isCurrentWeek();
    }

	if (isCurrWeek) {
        var projCells = player_table_body.find('.FantasyPlusProjectionsData');
        if (siteType == 'yahoo') {
            total_player_ids = projCells.length;
        }
		projCells.each(function() {
			var cell = jQuery(this);
			var currRow = cell.parent();

			var byeweek_text = currRow.find('td:contains("** BYE **")');
			var isByeWeek = (byeweek_text.length > 0);
			if (siteType == 'espn' && onMatchupPreviewPage) {
				byeweek_text.html('<span style="color:#999999">BYE</span>');
			}
            
            if (siteType == 'yahoo' && onMatchupPreviewPage) {
                getProjectionData(datatype, currRow, cell);
			}
            else {
                var projectedPoints = isByeWeek ? "--" : getProjectionData(datatype, currRow, cell);
                cell.text(projectedPoints);
            }
		});
	}
	else {
        dlog('not current week');
		player_table_body.find('.FantasyPlusProjectionsData').each(function() {
			var cell = jQuery(this);
            var ctext = '-';
            if (siteType == 'fleaflicker') {
                ctext = '—';
            }
			cell.text(ctext);
		});
	}

    if (onClubhousePage) {
		if (siteType == 'espn') {
			var header_rows = player_table_header;
			var sumpts = 0;
			var sumptsESPN = 0;
			var sumTotal, sumTotalESPN, keepAdding, currHeaderRow, headerType;

			header_rows.each(function() {
				currHeaderRow = jQuery(this).prev();
				headerType = currHeaderRow.find('th.playertableSectionHeaderFirst').text();
				keepAdding = true;
				sumTotal = 0;
				sumTotalESPN = 0;

				if (headerType == 'STARTERS') {
					while (keepAdding) {
						currHeaderRow = currHeaderRow.next();
						if (currHeaderRow.hasClass('playerTableBgRowSubhead')) {
							var td_length = currHeaderRow.find('td').length;
						}
						else if (currHeaderRow.hasClass('pncPlayerRow') && !currHeaderRow.hasClass('emptyRow')) {
							var proj_cell = currHeaderRow.find('.FantasyPlusProjectionsData');
							sumpts = proj_cell.text();
							sumptsESPN = proj_cell.prev().text();

							if (parseFloat(sumpts)) {
								sumTotal = parseFloat(sumTotal + parseFloat(sumpts));
							}
							if (parseFloat(sumptsESPN)) {
								sumTotalESPN = parseFloat(sumTotalESPN + parseFloat(sumptsESPN));
							}
						}
						else {
							keepAdding = false;
						}
					}
					// I should fix this to make it more automatic for the bye week stupid nonsense
					if (td_length == (18 + custom_cols)) {
                        var extra_td = '<td></td>';
					}
					else {
                        var extra_td = '';
					}
                    
                    if (td_length == 22) {
                        var week_tds = '';
                    }
                    else {
                        var week_tds = '<td></td><td></td><td class="sectionLeadingSpacer">';
                    }
					
					//gonna have to edit this too when its automatic
					currHeaderRow.before('<tr class="pncPlayerRow playerTableBgRow0 FantasyPlus FantasyPlusProjections"><td class="playerSlot" style="font-weight: bold;">Total</td><td></td><td></td>' + extra_td + '<td class="sectionLeadingSpacer"></td>' + week_tds + '</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="sectionLeadingSpacer"></td><td class="playertableStat">' + Math.round(sumTotalESPN * 100) / 100 + '</td><td class="playertableStat">' + Math.round(sumTotal * 100) / 100 + '</td><td class="sectionLeadingSpacer"></td><td></td><td></td><td></td><td></td><td class="sectionLeadingSpacer"></td><td></td><td></td><td></td><td></td></tr>');
				}
			});
		}
        else if (siteType == 'fleaflicker') {
            
        }
    }
    if (hasProjTotals) {
		var datapoints;		
		if (siteType == 'espn') {			
			var matchup_tables = jQuery('.playerTableTable');
			var matchup_total;

			matchup_tables.each(function() {
				var currTable = jQuery(this);
				datapoints = currTable.find('.FantasyPlusProjectionsData');
				
				if (datapoints.length > 0) {
					matchup_total = 0;
					datapoints.each(function() {
						var value = parseFloat(jQuery(this).text());
						if (value) {
							matchup_total = parseFloat(matchup_total + value);
						}
					});
					currTable.next().prepend('<div title="Total projected points (via FantasyPlus)" class="danglerBox totalScore">' + Math.round(matchup_total) + '</div>');
				}
			});
		}
		else if (siteType == 'yahoo' && isCurrWeek) {
			var matchup_total = 0;
			if (onMatchupPreviewPage) {
                jQuery.when(fetchYahooIds).done(function() {
                    var new_pts_total = pts_total.parent().clone();
                    new_pts_total.children().text('');
                    new_pts_total.find('th').text('FP Proj');
                    var new_pts_total_tds = new_pts_total.find('td');
                    
                    var currTab = jQuery(playerTable.first());
                    var currTotals = jQuery('.FantasyPlusProjectionsTotal');
                    var currHeader = currTab.find(player_table_header_selector);
                    var currHs = currHeader.find('th.FantasyPlusProjectionsHeader');
                    currHs.each(function(i){
                        matchup_total = 0;						
                        var currH = jQuery(this);
                        var currIdx = currH.index();
                        var currBody = currTab.find('tbody tr');
                        var this_pts_total = jQuery(new_pts_total_tds[i]);
                        
                        datapoints = currBody.find('td:nth-child(' + (currIdx + 1) + ')');
                        if (datapoints.length > 0) {
                            datapoints.each(function() {
                                var value = parseFloat(jQuery(this).text());
                                if (value) {
                                    matchup_total = parseFloat(matchup_total + value);
                                }
                            });
                            
                            var thisTotal = jQuery(pts_total[i]);
                            var currTotal = parseFloat(thisTotal.text());
                            var roundTotal = Math.round(matchup_total * 100) / 100;
                            
                            if (!isNaN(roundTotal)) {
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
                });
			}
			else {
				datapoints = player_table_body.find('tr:not(".bench") .FantasyPlusProjectionsData');
				
				if (datapoints.length > 0) {
					datapoints.each(function() {
						var value = parseFloat(jQuery(this).text());
						if (value) {
							matchup_total = parseFloat(matchup_total + value);
						}
					});
					
					var currTotal = parseFloat(pts_total.text());
					var roundTotal = Math.round(matchup_total * 100) / 100;
					
					if (!isNaN(roundTotal)) {
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
			}
		}
        else if (siteType == 'fleaflicker') {
            
        }
    }

    projDone.resolve();
}

function addRankings() {
    var datatype = 'rank';
	
    var isCurrWeek;
    if (siteType == 'yahoo' && onFreeAgencyPage) {
        isCurrWeek = is_FA_current;
    }
    else {
        isCurrWeek = isCurrentWeek();
    }
	if (isCurrWeek) {
		player_table_body.find('.FantasyPlusRankingsData').each(function() {
			var cell = jQuery(this);
			var currRow = cell.parent();

			var byeweek_text = currRow.find('td:contains("** BYE **")');
			var isByeWeek = (byeweek_text.length > 0);
            
            if (siteType == 'yahoo' && onFreeAgencyPage) {
                getProjectionData(datatype, currRow, cell);
			}
            else {
                var projectedRanking = "--";
                if (isByeWeek) {
                    dlog('bye week');
                    cell.text(projectedRanking);
                    if (siteType == 'espn') {
                        cell.next().text(projectedRanking);
                    }
                }
                else {
                    projectedRanking = getProjectionData(datatype, currRow, cell);
                    if (projectedRanking[0] == "--" || projectedRanking == "--") {
                        cell.text("--");
                        if (siteType == "espn" || siteType == "fleaflicker") { //change this in the future for "is enabled column"
                            cell.next().text("--");
                        }
                    }
                    else {
                        cell.text(projectedRanking[0]);
                        if (siteType == "espn" || siteType == "fleaflicker") {
                            cell.next().html('<span style="font-size: 80%;">±</span>' + projectedRanking[1]);
                        }
                    }
                }
            }
		});
	}
	else {
		player_table_body.find('.FantasyPlusRankingsData').each(function() {
			var cell = jQuery(this);
            var ctext = '-';
            if (siteType == 'fleaflicker') {
                ctext = '—';
            }
			cell.text(ctext);
		});
	}	

    rankDone.resolve();
}

function addRos() {
    var datatype = 'ros';
    
    var isCurrWeek;
    if (siteType == 'yahoo' && onFreeAgencyPage) {
        isCurrWeek = is_FA_current;
    }
    else {
        isCurrWeek = isCurrentWeek();
    }
	if (isCurrWeek) {
        player_table_body.find('.FantasyPlusRosData').each(function() {
            var cell = jQuery(this);
            var currRow = cell.parent();
            
            var projectedRos = getProjectionData(datatype, currRow, cell);
            if (projectedRos[0] == "--" || projectedRos == "--") {
                cell.text("--");
                cell.next().text("--");
            }
            else {
                cell.text(projectedRos[0]);
                cell.next().html('<span style="font-size: 80%;">±</span>' + projectedRos[1]);
            }
        });
    }
    else {
		player_table_body.find('.FantasyPlusRosData').each(function() {
			var cell = jQuery(this);
            var ctext = '-';
            if (siteType == 'fleaflicker') {
                ctext = '—';
            }
			cell.text(ctext);
		});
	}	

    rosDone.resolve();
}

function addAvg() {
    var datatype = 'adjavg';
    
    player_table_rows.each(function() {
        var currRow = jQuery(this);
        
        getProjectionData(datatype, currRow, '');
    });
}

function addDepth() {
    var datatype = 'depth';
    var type_map = {
        'blue': 'Starter',
        'green': 'Situational',
        'red': 'Fill-in',
        'black': 'Reserve'
    };
    var popup_settings = {
        type: 'tooltip',
        
    };
    
    var fix_name = function(pname, tpd) {
        var player_name_addons = [' III', ' Jr.', ' Sr.'];
        for (a=0; a < player_name_addons.length; a++) {
            var new_name = pname + player_name_addons[a];
            if (tpd.hasOwnProperty(new_name)) {
                return new_name;
            }
        }
        
        return false;
    };
    
    if (!depth_data_current_week || Object.keys(depth_data_current_week).length <= 0) {
        if (depth_data.hasOwnProperty(current_season) && depth_data[current_season].hasOwnProperty('W' + current_week)) {
            depth_data_current_week = depth_data[current_season]['W' + current_week];
        }
        else {
            depth_data_current_week = {};
        }
    }

    //if (jQuery.isEmptyObject(depth_data_current_week)) {
        //TODO revert back to older weeks
        //depth_data[current_season]['W' + (current_week - 1)]
    //}
    
    var all_depth_cells = player_table_body.find('.FantasyPlusDepthData');
    
    all_depth_cells.each(function() {
        var cell = jQuery(this);
        var currRow = cell.parent();
        
        var depthData = getProjectionData(datatype, currRow, cell);
        
        if (!depthData.constructor === Array || depthData.length < 3) {
            cell.text('--');
        }
        else {
            var plname = depthData[0];
            var posname = depthData[1];
            var teamname = depthData[2];
            
            var p_depth = '--';
            
            if (posname == 'D/ST') {
                cell.text('--');
            }
            else if (teamname == 'FA') {
                cell.text('--');
            }
            else {
                teamname = Object.keys(team_abbrevs).filter(function(key) {return team_abbrevs[key] === teamname})[0];
                
                var team_data = {};
                if (depth_data_current_week.hasOwnProperty(teamname)) {
                    team_data = depth_data_current_week[teamname];
                }
                
                var team_pos_data = {};
                if (posname.constructor === Array) {
                    for (p=0; p < posname.length; p++) {
                        var pn = posname[p];
                        var new_pos_data = {};
                        if (team_data.hasOwnProperty(pn)) {
                            var new_pos_data = team_data[pn];
                        }
                        if (new_pos_data.hasOwnProperty(plname)) {
                            team_pos_data = new_pos_data;
                            posname = pn;
                            var pdata = team_pos_data[plname];
                            p_depth = posname + pdata['num'];                    
                        }
                        else {
                            var new_name = fix_name(plname, new_pos_data);
                            if (new_name) {
                                plname = new_name;
                                team_pos_data = new_pos_data;
                                posname = pn;
                                var pdata = team_pos_data[plname];
                                p_depth = posname + pdata['num'];                    
                            }
                        }
                    }
                }
                else {
                    if (team_data.hasOwnProperty(posname)) {
                        team_pos_data = team_data[posname];
                    }
                    
                    if (team_pos_data.hasOwnProperty(plname)) {
                        var pdata = team_pos_data[plname];
                        p_depth = posname + pdata['num'];                    
                    }
                    else {
                        var new_name = fix_name(plname, team_pos_data);
                        if (new_name) {
                            plname = new_name;
                            var pdata = team_pos_data[plname];
                            p_depth = posname + pdata['num'];                    
                        }
                    }
                }

                cell.text(p_depth);

                var players_sorted = Object.keys(team_pos_data).sort(function(a,b){ return team_pos_data[a].num - team_pos_data[b].num });
                
                var p_trs = '';
                for (p=0; p < players_sorted.length; p++) {
                    var pname = players_sorted[p];
                    var pd = team_pos_data[pname];
                    var ptype = type_map[pd['type']];
                    var pnum = pd['num']; 
                    var p_status_arr = pd['status'];
                    var p_status = p_status_arr.join('|');
                    
                    var trstring = '<tr>';
                    if (pname == plname) {
                        trstring = '<tr style="background-color: lightblue">';
                    }
                    var pstring = trstring + '<td style="width: 40px;">' + posname + pnum + ':' + '</td><td style="width: 140px;">' + pname + '</td><td style="width: 90px;">' + ptype + '</td><td style="width: 80px;">' + p_status + '</td></tr>';
                    p_trs += pstring;
                }
                var tooltip_content = jQuery('<div><table><tbody></tbody></table></div>');
                tooltip_content.find('tbody').append(p_trs);
                
                cell.css({'cursor': 'pointer'});
                cell.tooltipster({
                    content: tooltip_content,
                    contentCloning: false,
                    delay: 100,
                    debug: true,
                    interactive: true,
                    theme: 'tooltipster-light',
                    side: 'right'
                });
            }
        }
    });
    
    depthDone.resolve();
}

function watchForChanges() {
    if (hasPlayerTable) {
        var observerConfig = {
            childList: true,
            characterData: true,
            subtree: true
        };
        /*
        //if things are still waiting to be resolved...
        // so also watchFOrChanges before all resolved i guess.
        projDone.resolve();
        rankDone.resolve();
        rosDone.resolve();
        avgDone.resolve();      
*/
        var target_observe = document.querySelector(base_table_selector);
        var observerESPN = new MutationObserver(function (mutations) {
            observerESPN.disconnect();
            if (mutations.length > 0) {
				var acceptedChange = true;
				if (siteType == 'yahoo') {
					m = mutations[0];
					var thisMutTgt = m['target'];
					if (thisMutTgt) {
						var thisMutTgtId = thisMutTgt['id'];
						var thisMutTgtClass = thisMutTgt['className'];
						if (thisMutTgtId == 'selectlist_nav' || thisMutTgtClass == 'flyout-title') {
							acceptedChange = false;
						}
					}
				}
                //todo fix
                else if (siteType == 'fleaflicker') {
                    m = mutations[0];
					var thisMutNodes = m['addedNodes'];
                    if (!thisMutNodes || !thisMutNodes.length) {
                        thisMutNodes = m['removedNodes'];
                    }
					if (thisMutNodes && thisMutNodes.length) {
						var thisMutNode = thisMutNodes[0];
						var thisMutTgtClass = thisMutNode['className'];
						if (thisMutTgtClass && thisMutTgtClass.indexOf('tooltip') > -1) {
							acceptedChange = false;
						}
					}

                }
				if (acceptedChange) {
                    dlog('rerunning');
					jQuery('.FantasyPlus').remove();
					setSelectors();
					reDefer();
					addColumns();
					addAllData(false);
				}
            }
            jQuery.when(projDone, rankDone, rosDone, avgDone, depthDone).done(function () {
                dlog('watching for changes after finishing');
                observerESPN.observe(target_observe, observerConfig);
            });
        });
        dlog('watching for changes');
        observerESPN.observe(target_observe, observerConfig);
    }
}
