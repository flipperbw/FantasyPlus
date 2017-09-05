/*-- TODO
- somehow adjust OPRK for opp teams, snap %
- median
- nfl / myfantasyleague / cbs
- return yardage
- firefox/safari
- sortable? doubt it
- timeout for loading gif
- start doing things before the document is ready. https://gist.github.com/raw/2625891/waitForKeyElements.js, waitForKeyElements ("a.Inline", delinkChangeStat); -- this probably doesnt apply since its an extension
- use window temporary data instead of recalculating when changes are made
- starting on different tab doesnt enable anything (players tab, espn)
- insider tab
- use this "prebuilt" thing inside, intercept it and reput it in? http://games.espn.com/ffl/playertable/prebuilt/manageroster?leagueId=1496143&teamId=4&seasonId=2014&scoringPeriodId=12&view=overview&context=clubhouse&ajaxPath=playertable/prebuilt/manageroster&managingIr=false&droppingPlayers=false&asLM=false
- clicking too fast disables it until the next click...
- store historical projections
- add projected to Yahoo roster page
- add bye week for espn
- highlight players with higher ROS/rank than on roster
- weather/dome information
- injury info for relevant players
- replicate fantasy finder
- trade values / calculator
- stdev of points
- add weekly projections second header to projs for fleaflicker
- fall back to ros if ppr-ros doesnt work
- add a db of confirmed player names and positions
- waiver wire
- hide IR on free agency (intercept)
- snap pcts http://www.footballoutsiders.com/stats/snapcounts
- how to use com.espn.games...?
*/

/*
var tag = document.createElement("script");
tag.type="text/javascript";
tag.src = "https://code.jquery.com/jquery-latest.min.js";
document.body.appendChild(tag);
*/

chrome.runtime.sendMessage({ request: 'valid_site' });

var debug_mode = 0;
//var debug_mode = -1;

function dlog(o, level) {
    level = typeof level === "undefined" ? 0 : level;
    if (debug_mode >= level ) {
        console.log(o);
    }
}

jQuery.noConflict();

function isObj(o) {
    return jQuery.isPlainObject(o) && !jQuery.isEmptyObject(o);
}

function goodVal(o, v, t) {
    if (o.hasOwnProperty(v) && jQuery.type(o[v]) === t) {
        return true;
    }
    else {
        return false;
    }
}

var storageUserSettingsKey = 'fp_user_settings';

function clearStoredData() {
    chrome.storage.local.get(null, function(d) { 
        jQuery.each(d, function(k,v) {
            if (k != storageUserSettingsKey) {
                chrome.storage.local.remove(k);
            }
        });
    });
}

//clearStoredData();
//chrome.storage.local.get('fp_player_activity_data', function(d) { console.info(d); });

// GLOBALS
var alldata,
	league_settings,
	custom_cols,
    observer,
    observer_disconned,
    league_id,
    league_settings_url,
    storage_translation_data,
	activity_data,
	activity_data_current_season_site,
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
    hasProjTotals,
    hasPlayerTable,
    hasProjectionTable,
    depth_data,
    depth_data_current_week;


var fetch_fail = false;
var idp_fetch_fail = false;
var depth_fail = false;

var total_players = 0;
var total_players_depth = 0;

var user_settings = {};

var updated_times = {};
var updated_types = {};
var updated_league = 0;
var updated_depth = 0;

var ajax_timeout = 5000;

var show_proj = true;
var show_rank = true;
var show_ros = true;
var show_depth = true;
var show_spark = true;
var show_avg = true;
var show_current = true;

var check_minutes = 30;
var check_minutes_avg = 60 * 24;
var check_minutes_avg_done = 20;
var check_minutes_avg_live = 1;
var check_minutes_depth = 120;

var experts = {
    'proj': {
        'selection': ['all']
    },
    'rank': {
        'selection': ['all'],
        'num': {
            'top': 10,
            'updated': 1
        }
    },
    'ros': {
        'selection': ['all'],
        'num': {
            'top': 5,
            'updated': 7
        }
    }
};

var expert_map = {
    'cbs': '11',
    'espn': '71',
    'numberfire': '73',
    'stats': '120',
    'fftoday': '152'
};

var remove_ads = true;
var fix_css = true;

var season_start_map = {
	'2014': [8, 2],
	'2015': [8, 8],
	'2016': [8, 6],
    '2017': [8, 5]
};

// from 2014-2015 season data
var expected_player = {
    'QB': {
        'pass_yds': 254.30,
        'pass_tds': 1.60,
        'pass_ints': 0.83,
        'pass_att': 35.25,
        'pass_cmp': 22.18,
        'rush_yds': 13.82,
        'rush_tds': 0.12,
        'rush_att': 3.35,
        'fumbles': 0.18
    },
    'RB': {
        'rush_yds': 45.53,
        'rush_tds': 0.28,
        'rush_att': 10.95,
        'rec_yds': 16.07,
        'rec_att': 1.97,
        'rec_tds': 0.07,
        'fumbles': 0.07
    },
    'WR': {
        'rec_yds': 49.83,
        'rec_att': 3.78,
        'rec_tds': 0.31,
        'fumbles': 0.03
    },
    'TE': {
        'rec_yds': 31.61,
        'rec_att': 2.87,
        'rec_tds': 0.26,
        'fumbles': 0.02
    },
    'D/ST': {
        'def_sack': 2.33,
        'def_ff': 0.86,
        'def_int': 0.86,
        'def_td': 0.21,
        'def_fr': 0.60,
        'def_pa': 22.82,
        'def_tyda': 352.67,
        'def_safety': 0.02
    },
    'K': {
        'xpt': 2.16,
        'fg': 1.65,
        'fga': 1.95
    },
    'LB': {
        'Scks': 0.26,
        'FumFrc': 0.08,
        'Tack': 4.11,
        'Asst': 1.78,
        'PassDef': 0.22,
        'Int': 0.04,
        'DefTD': 0.01,
        'Fum': 0.04
    },
    'DL': {
        'Scks': 0.32,
        'FumFrc': 0.06,
        'Tack': 2.14,
        'Asst': 0.95,
        'PassDef': 0.10,
        'Int': 0.01,
        'DefTD': 0,
        'Fum': 0.03
    },
    'DB': {
        'Scks': 0.03,
        'FumFrc': 0.05,
        'Tack': 3.84,
        'Asst': 0.92,
        'PassDef': 0.58,
        'Int': 0.12,
        'DefTD': 0.02,
        'Fum': 0.03
    }
};

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
    'Los Angeles Rams': 'LAR',
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
    'Los Angeles Chargers': 'LAC',
    'Indianapolis Colts': 'IND',
    'New Orleans Saints': 'NO',
    'Dallas Cowboys': 'DAL'
};

var player_name_fix = {
    'Stevie Johnson': 'Steve Johnson',
	'Ha Ha Clinton-Dix': 'Hasean Clinton-Dix',
	'Corey Brown': 'Philly Brown',
	'Boobie Dixon': 'Anthony Dixon',
	'Wil Lutz': 'Will Lutz',
	'MarQuies Gray': 'MarQueis Gray',
	'Jerry Attaochu': 'Jeremiah Attaochu',
    'Kahlil Mack': 'Khalil Mack',
    'Justin March-Lillard': 'Justin March',
	'Odell Beckham': 'Odell Beckham Jr.',
    'A.J. McCarron': 'AJ McCarron',
    'A.J. Derby': 'AJ Derby',
    'E.J. Manuel': 'EJ Manuel',
    'Jurell Casey': 'Jurrell Casey',
    'Johnathan Hankins': 'Jonathan Hankins',
    'Malcolm Brown': 'Malcom Brown',
    'Dante Fowler': 'Dante Fowler Jr.',
    'Vic Beasley Jr.': 'Vic Beasley',
    'Nickell Robey': 'Nickell Robey-Coleman',
    'Terrod Ward': 'Terron Ward',
    'Steven Hauschka': 'Stephen Hauschka'
};

var player_name_translations = {
    'Christopher': 'Chris',
    'Chris': 'Christopher',
    'Benjamin': 'Benny',
    'Benny': 'Benjamin',
    'Tim': 'Timothy',
    'Timothy': 'Tim',
    'Rob': 'Robert',
    'Robert': 'Rob',
    'Mike': 'Michael',
    'Michael': 'Mike',
    'John': 'Johnathan',
    'Johnathan': 'John',
    'Jon': 'Jonathan',
    'Jonathan': 'Jon',
    'Matt': 'Matthew',
    'Matthew': 'Matt',
    'Zach': 'Zachary',
    'Zachary': 'Zach'
};

var player_position_fix = {
    'Ty Montgomery': 'RB',
    
    'Julius Peppers': 'LB',
    'Jadeveon Clowney': 'LB',
    'Derrick Morgan': 'LB',
    'Chandler Jones': 'LB',
    'Vic Beasley': 'LB',
    'Shea McClellin': 'LB',
    'Trent Murphy': 'LB',
    'Jerry Hughes': 'LB',
    'Kevin Dodd': 'LB',
    
    'Su\'a Cravens': 'DB',
    
    'Jabaal Sheard': 'DL',
    'Frank Clark': 'DL',
    'Khalil Mack': 'DL'
};

var player_position_fix_depth = {
    'Julius Peppers': 'LB',
    'Jadeveon Clowney': 'LB',
    'Derrick Morgan': 'LB',
    'Chandler Jones': 'LB',
    'Vic Beasley': 'LB',
    'Shea McClellin': 'LB',
    'Trent Murphy': 'LB',
    'Jerry Hughes': 'LB',
    'Kevin Dodd': 'LB',
    'Su\'a Cravens': 'LB',
    
    'Tyrann Mathieu': 'S',
    'Lamarcus Joyner': 'S',
    
    'Jabaal Sheard': 'DE',
    'Frank Clark': 'DE',
    'Emmanuel Ogbah': 'DE',
    'Dwight Freeney': 'DE',
    'Jurrell Casey': 'DE',
    'Timmy Jernigan': 'DE',
    'Jaye Howard': 'DE',
    'Chris Baker': 'DE',
    'Kendall Langford': 'DE',
    'Adolphus Washington': 'DE',
    'Robert Nkemdiche': 'DE',
    'DaQuan Jones': 'DE',
    'Yannick Ngakoue': 'DE'
};

var player_position_fix_sharks = {
    'Su\'a Cravens': 'DB'
};

var off_positions_proj = ['qb', 'rb', 'wr', 'te', 'k', 'dst'];
var def_positions_proj = ['8', '9', '10'];
var all_positions_proj = off_positions_proj.concat(def_positions_proj);
var all_positions_rank = ['qb', 'rb', 'wr', 'te', 'k', 'dst', 'dl', 'lb', 'db'];

var idp_positions = ['DL', 'LB', 'DB'];
var idp_conversion = {'8': 'DL', '9': 'LB', '10': 'DB'};

var team_name_conversion = {'ARZ': 'ARI', 'GBP': 'GB', 'KCC': 'KC', 'NEP': 'NE', 'NOR': 'NO', 'RAM': 'LA', 'SDC': 'SD', 'SFO': 'SF', 'TBB': 'TB'};

var fpros_proj_headers = {
    'QB':  ['Player', 'Team', 'pass_att', 'pass_cmp', 'pass_yds', 'pass_tds', 'pass_ints', 'rush_att', 'rush_yds', 'rush_tds', 'fumbles', 'fpts'],
    'RB':  ['Player', 'Team', 'rush_att', 'rush_yds', 'rush_tds', 'rec_att', 'rec_yds', 'rec_tds', 'fumbles', 'fpts'],
    'WR':  ['Player', 'Team', 'rush_att', 'rush_yds', 'rush_tds', 'rec_att', 'rec_yds', 'rec_tds', 'fumbles', 'fpts'],
    'TE':  ['Player', 'Team', 'rec_att', 'rec_yds', 'rec_tds','fumbles', 'fpts'],
    'K':   ['Player', 'Team', 'fg', 'fga', 'xpt', 'fpts'],
    'DST': ['Player', 'Team', 'def_sack', 'def_int', 'def_fr', 'def_ff', 'def_td', 'def_assist', 'def_safety', 'def_pa', 'def_tyda', 'fpts'] 
};

var fpros_rank_headers = ['Rank', 'Player', 'Team', 'Matchup', 'Best Rank', 'Worst Rank', 'Avg Rank', 'Std Dev'];
var fpros_rank_idp_headers = ['Rank', 'Player', 'Team', 'Pos', 'Matchup', 'Best Rank', 'Worst Rank', 'Avg Rank', 'Std Dev'];

var fpros_ros_headers = ['Rank', 'Player', 'Team', 'Bye', 'Best Rank', 'Worst Rank', 'Avg Rank', 'Std Dev', 'ADP', 'vs. ADP'];
var fpros_ros_idp_headers = ['Rank', 'Player', 'Team', 'Pos', 'Bye', 'Best Rank', 'Worst Rank', 'Avg Rank', 'Std Dev'];

var depth_type_map = {
    'blue': 'Starter',
    'green': 'Situational',
    'red': 'Fill-in',
    'brown': 'Fill-in',
    'black': 'Reserve'
};

var depth_url = '//subscribers.footballguys.com/apps/depthchart.php?type=all&lite=no&exclude_coaches=yes';

var loadingDiv = '<div class="fp-spinner-cell"><div class="fp-spinner-container"><div class="fp-spinner fp-spinner-1"></div><div class="fp-spinner fp-spinner-2"></div><div class="fp-spinner fp-spinner-3"></div></div></div>';

var projDone = jQuery.Deferred();
var rankDone = jQuery.Deferred();
var rosDone = jQuery.Deferred();
var activityDone = jQuery.Deferred();
var depthDone = jQuery.Deferred();
var totalsDone = jQuery.Deferred();

var storageActivityKey = 'fp_player_activity_data';
var storageDepthKey = 'fp_depth_data';
var storageDepthUpdateKey = 'fp_last_updated_depth';

var storageKeys = [storageActivityKey, storageDepthKey, storageDepthUpdateKey];

if (document.URL.match(/games.espn.com/)) {
    siteType = 'espn';
    
	var onMatchupPreviewPage = document.URL.match(/ffl\/matchuppreview/);
    var onClubhousePage = document.URL.match(/ffl\/(clubhouse|dropplayers|rosterfix)/);
    var onFreeAgencyPage = document.URL.match(/ffl\/(freeagency|watchlist)/);
    var onGeneralProjPage = document.URL.match(/ffl\/tradereview/);
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
    
    if (onLeagueSettingsPage) {
        addLeagueSettings();
    }
    
    league_id = document.URL.match(/leagueId=(\d+)/)[1];
    league_settings_url = '//games.espn.com/ffl/leaguesetup/sections/scoring?leagueId=' + league_id;
    
    var storageLeagueKey = 'fp_espn_league_data_' + league_id;
    var storageLeagueUpdateKey = 'fp_espn_last_updated_league_' + league_id;
    var storagePlayerKey = 'fp_espn_player_data_' + league_id;
    var storageUpdateKey = 'fp_espn_last_updated_' + league_id;
    var storageUpdateTypeKey = 'fp_espn_last_updated_type_' + league_id;
    
    storageKeys.push(storageLeagueKey, storageLeagueUpdateKey, storagePlayerKey, storageUpdateKey, storageUpdateTypeKey);
	
	getUserSettings();	
}

else if (document.URL.match(/football.fantasysports.yahoo.com/)) {
    siteType = 'yahoo';
    
    var yahooIdsDone = jQuery.Deferred();
    var updated_translation = 0;
    var yahoo_list_url = 'https://sports.yahoo.com/nfl/players?type=lastname';
	jQuery.getJSON(chrome.extension.getURL('yahoo_ids.json'), function(settings) {
		console.log('asdasdasdasad');
		console.log(settings);
	});
    
    var is_FA_current = false;
	
	var onMatchupPreviewPage = document.URL.match(/f1\/\d+\/matchup/);
    var onClubhousePage = document.URL.match(/f1\/\d+\/\d+/);
    var onFreeAgencyPage = document.URL.match(/f1\/\d+\/players/);
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

    var storageLeagueKey = 'fp_yahoo_league_data_' + league_id;
    var storageLeagueUpdateKey = 'fp_yahoo_last_updated_league_' + league_id;
    var storagePlayerKey = 'fp_yahoo_player_data_' + league_id;
    var storageUpdateKey = 'fp_yahoo_last_updated_' + league_id;
    var storageUpdateTypeKey = 'fp_yahoo_last_updated_type_' + league_id;
    var storageTranslationKey = 'fp_yahoo_translation';
    var storageTranslationUpdateKey = 'fp_yahoo_translation_updated';
    
    storageKeys.push(storageLeagueKey, storageLeagueUpdateKey, storagePlayerKey, storageUpdateKey, storageUpdateTypeKey, storageTranslationKey, storageTranslationUpdateKey);

    show_avg = false; //TODO remove
    show_current = false;
    show_spark = false; //TODO remove
    show_ros = false; //TODO remove
    show_depth = false; //TODO remove
    
    getUserSettings();
}

else if (document.URL.match(/fleaflicker.com/)) {
    siteType = 'fleaflicker';
    
    var fetchFleaflickerIds = jQuery.Deferred();
    var total_player_ids = 0;
    var is_current_week = true;

	var onMatchupPreviewPage = document.URL.match(/nfl\/leagues\/(\d+)\/scores\/(\d+)/);
    var onClubhousePage = document.URL.match(/nfl\/leagues\/(\d+)\/teams\/(\d+)(\?|$)/);
    var onFreeAgencyPage = document.URL.match(/nfl\/leagues\/(\d+)\/players($|[^/])/);
    var onGeneralProjPage = document.URL.match(/nfl\/leagues\/(\d+)\/teams\/(\d+)\/(watched)/); //add more
	
    hasProjTotals = onMatchupPreviewPage || onClubhousePage;
	hasPlayerTable = onFreeAgencyPage || onMatchupPreviewPage;
    hasProjectionTable = onMatchupPreviewPage || onClubhousePage || onFreeAgencyPage || onGeneralProjPage;
    
    base_table_selector = '#body-center-main';
    player_table_selector = '[id^=table_]';
    player_table_body_selector = 'tbody';
    player_table_header_selector = 'thead tr';
    player_table_row_selector = 'tr[id^=row], tr.repeated';
    player_name_selector = 'div.player';
    
    league_id = document.URL.match(/nfl\/leagues\/(\d+)/)[1];
    league_settings_url = '//www.fleaflicker.com/nfl/leagues/' + league_id + '/scoring';
    
    var storageLeagueKey = 'fp_fleaflicker_league_data_' + league_id;
    var storageLeagueUpdateKey = 'fp_fleaflicker_last_updated_league_' + league_id;
    var storagePlayerKey = 'fp_fleaflicker_player_data_' + league_id;
    var storageUpdateKey = 'fp_fleaflicker_last_updated_' + league_id;
    var storageUpdateTypeKey = 'fp_fleaflicker_last_updated_type_' + league_id;
    var storageTranslationKey = 'fp_fleaflicker_translation';
    
    storageKeys.push(storageLeagueKey, storageLeagueUpdateKey, storagePlayerKey, storageUpdateKey, storageUpdateTypeKey, storageTranslationKey);
	
    show_avg = false;
    show_current = false;

	getUserSettings();
}


function fixPage() {
    if (siteType == 'espn') {
        if (remove_ads) {
            jQuery('.games-footercol, .transitional-elements').remove();
            jQuery('.games-innercol2').children('br').remove();
            if (onClubhousePage) {
                //('.games-alert-tilt', '.games-alert-mod.alert-mod2.games-blue-alert', 'div.draftKings');
                jQuery('iframe[src*="streak.espn.com"]').parent().remove();
            }
            else if (onLeaguePage) {
                jQuery('.games-rightcol-spacer, a[href*="pizzahut"], div.promotional-info').remove();
            }
        }
        if (fix_css) {
            jQuery('.gamesmain.container').css('margin-bottom', '10px');
            if (onClubhousePage) {
                jQuery('.games-bottomcol').css('margin', 0);
                if (jQuery('.games-dates-mod').css('margin-top') == '19px') {
                    jQuery('.games-dates-mod').css('margin-top', '20px');
                }
            }
            else if (onFreeAgencyPage) {
                jQuery('#backgroundContainer').css('width', 'auto');
                /*
                if (jQuery('.addButton').css('background-position-x') == '-38px') {
                    jQuery('.addButton').css('background-position-x', '-39px');
                }
                if (jQuery('.dropButton').css('width') == '14px') {
                    jQuery('.dropButton').css('width', '15px');
                }
                */
            }
        }
    }
    else if (siteType == 'yahoo') {
        if (remove_ads) {
            jQuery('.df-ad').remove();
            jQuery('#fantasyhero').remove();
            jQuery('#gamepromo').remove();
        }
    }
    else if (siteType == 'fleaflicker') {
        if (remove_ads) {
            jQuery('a[href^="/nfl/upgrade"]').remove();
            jQuery('i.icon-edge-E').remove();
        }
        if (fix_css) {
            if (onFreeAgencyPage || onGeneralProjPage) {
                var trade_btns = jQuery('a').filter(function(i) { return jQuery(this).text() === 'Trade'; });
                trade_btns.css({
                    'background-image': 'linear-gradient(to bottom,#a070ec 0%,#6c4186 100%)',
                    'border-color': '#51427d'
                });
                trade_btns.hover(function() {
                    jQuery(this).css("background-color", "rgb(108, 65, 134)");
                });
                
                var claim_btns = jQuery('a').filter(function(i) { return jQuery(this).text() === 'Claim'; });
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
}

function getParams(u) {
	var qd = {};
	var q_loc = u.indexOf('?');
	if (q_loc > -1) {
		u.substr(q_loc + 1).split("&").forEach(function(item) {
			var s = item.split("="), k = s[0], v = s[1] && decodeURIComponent(s[1]);
			if (k in qd) {
                qd[k].push(v);
            }
            else {
                qd[k] = [v];
            }
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

        //todo combine these
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
            var denom = 1.0;
            if (denom_str.length > 0) {
                denom = parseFloat(denom_str);
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
            //todo combine these
            var cell_indexof = thistd_text.search(/ards\s+\(PY/);
            if (cell_indexof !== -1) {
                frac_cell = true;
                var expected_val = default_fractional_settings['Passing']['Passing Yards (PY)'];
                var denom_str = '';
                var denom_reg = thistd_text.match(/\([A-Z]+(\d+)\)/);
                if (denom_reg.length) {
                    denom_str = denom_reg[1];
                }
                var same_val = check_denom(td_num, denom_str, expected_val, $td_cell);
                if (same_val) {
                    missing_frac_tds.splice(missing_frac_tds.indexOf(' (PY'), 1);
                    missing_stand_tds.splice(missing_stand_tds.indexOf(' (PY'), 1);
                }
            }
            cell_indexof = thistd_text.indexOf('ards (RY');
            if (cell_indexof !== -1) {
                frac_cell = true;
                var expected_val = default_fractional_settings['Rushing']['Rushing Yards (RY)'];
                var denom_str = '';
                var denom_reg = thistd_text.match(/\([A-Z]+(\d+)\)/);
                if (denom_reg.length) {
                    var denom_str = denom_reg[1];
                }
                var same_val = check_denom(td_num, denom_str, expected_val, $td_cell);
                if (same_val) {
                    missing_frac_tds.splice(missing_frac_tds.indexOf(' (RY'), 1);
                    missing_stand_tds.splice(missing_stand_tds.indexOf(' (RY'), 1);
                }

            }
            cell_indexof = thistd_text.indexOf('ards (REY');
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
				po = po.replace(/(<(\b(img|style|head|link)\b)(([^>]*\/>)|([^\7]*(<\/\2[^>]*>)))|(<\bimg\b)[^>]*>|(\b(background|style)\b=\s*"[^"]*"))/g,"");
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

function getUserSettings() {
    chrome.storage.local.get(storageUserSettingsKey, function(r) {
        var stored_user_settings = r[storageUserSettingsKey];
        dlog('user settings:');
        dlog(stored_user_settings);
        
        if (isObj(stored_user_settings)) {
            user_settings = jQuery.extend(true, {}, stored_user_settings);
        }
        
        var col_settings = {};
        if (isObj(user_settings.columns)) {
            col_settings = user_settings.columns;
        }
        else {
            user_settings.columns = {};
        }
        
        jQuery.each(col_settings, function (k, v) {
            if (k == 'proj' && show_proj) {
                show_proj = v;
            }
            else if (k == 'rank' && show_rank) {
                show_rank = v;
            }
            else if (k == 'ros' && show_ros) {
                show_ros = v;
            }
            else if (k == 'depth' && show_depth) {
                show_depth = v;
            }
            else if (k == 'spark' && show_spark) {
                show_spark = v;
            }
            else if (k == 'avg' && show_avg) {
                show_avg = v;
            }
            else if (k == 'current' && show_current) {
                show_current = v;
            }
        });
        
        var update_settings = {};
        if (isObj(user_settings.update_freq)) {
            update_settings = user_settings.update_freq;
        }
        else {
            user_settings.update_freq = {};
        }
        
        jQuery.each(update_settings, function (k,v) {
            if (!isObj(v)) {
                v = {};
            }
            var update_settings_time = v.time;
            var update_settings_typ  = v.typ;
            
            if (update_settings_time && update_settings_typ) {
                var new_mins = update_settings_time;
                if (update_settings_typ == 'h') {
                    new_mins *= 60;
                }
                
                if (k == 'player') {
                    check_minutes = Math.max(new_mins, 1);
                }
            }
        });
        
        if (isObj(user_settings.experts)) {
            experts = user_settings.experts;
        }
        else {
            user_settings.experts = {};
        }
        
        var misc_settings = {};
        if (isObj(user_settings.misc)) {
            misc_settings = user_settings.misc;
        }
        else {
            user_settings.misc = {};
        }
        
        var misc_remove_ads = misc_settings.remove_ads;
        var misc_fix_css  = misc_settings.fix_css;
        
        if (typeof misc_remove_ads !== "undefined") {
            remove_ads = misc_remove_ads;
        }
        if (typeof misc_fix_css !== "undefined") {
            fix_css = misc_fix_css;
        }
        
        fixPage();
        
        setSelectors();
    });
}

function setSelectors(firstrun) {
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
        hasProjectionTable = proj_head.length > 0;
    }
    else if (siteType == "yahoo") {
		show_proj = typeof user_settings.columns.proj !== 'undefined' ? user_settings.columns.proj : true;
		show_rank = typeof user_settings.columns.rank !== 'undefined' ? user_settings.columns.rank : true;
        
		if (onMatchupPreviewPage) {
			player_table_header_proj_selector = 'th:contains(Proj)';
		}
        else if (onFreeAgencyPage) {
            //todo: add gdd and ranks here
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
        show_proj = typeof user_settings.columns.proj !== 'undefined' ? user_settings.columns.proj : true;
		show_rank = typeof user_settings.columns.rank !== 'undefined' ? user_settings.columns.rank : true;
		show_ros = typeof user_settings.columns.ros !== 'undefined' ? user_settings.columns.ros : true;
		show_spark = typeof user_settings.columns.spark !== 'undefined' ? user_settings.columns.spark : true;

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

        var stat_no = url_dict.hasOwnProperty('statType') ? url_dict['statType'][0] : '';
        var sort_no = url_dict.hasOwnProperty('sortMode') ? url_dict['sortMode'][0] : '';
        if (onFreeAgencyPage) {
            if (stat_no && stat_no == '7') {
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

        proj_head = player_table_header.find('th').filter(function(i) {
            return jQuery(this).text() === player_table_header_proj_selector;
        });
        
        if (player_table_header_proj_selector == 'FPts') {
            if (stat_no && stat_no == '7') {
                proj_head = proj_head.last();
            }
            else {
                proj_head = proj_head.first();
            }
        }
    }
    
    if (onMatchupPreviewPage) {
        show_rank = false;
        show_ros = false;
        show_depth = false;
        show_spark = false;
        show_avg = false;
        show_current = false;
    }
    
	var proj_first = proj_head.first();
    header_index = proj_first.index();
	proj_first.prevAll("th, td").each(function() {
		header_index += this.colSpan - 1;
	});
    
    if (firstrun !== false) {
        runMain();
    }
}

function isDataCurrent(l) {
    function subtr(s) {
        var mins = check_minutes;
        var v = 0;
        
        if (s == 'league') {
            v = updated_league;
        }
        else if (s == 'translation') {
            v = updated_translation;
        }
        else if (s == 'depth') {
            if (!show_depth) {
                return true;
            }
            else {
                mins = check_minutes_depth;
                v = updated_depth;
            }
        }
        else if (s == 'proj' && !show_proj) {
            return true;
        }
        else if (s == 'rank' && !show_rank) {
            return true;
        }
        else if (s == 'ros' && !show_ros) {
            return true;
        }
        else if (isObj(updated_times)) {
            v = updated_times[s];

            var s_type = s;
            
            var exp_type_dict = experts[s_type] || {};
            var exp_val = exp_type_dict.selection || 'none';
            var exp_val_str = exp_val.toString();
            if (s_type == 'rank' || s_type == 'ros') {
                var exp_num_dict = exp_type_dict.num || {};
                var exp_top = exp_num_dict['top'] || 10;
                var exp_updated = exp_num_dict['updated'] || 7;
                
                exp_val_str += '-' + exp_top + '-' + exp_updated;
            }
            
            dlog(exp_val_str);
            
            if (updated_types[s_type] !== exp_val_str) {
                dlog('Different update type for: ' + s_type + ', stored is: ' + updated_types[s_type] + ', want: ' + exp_val_str);
                v = 0;
            }
        }
        
        var r = false;
        if (!parseFloat(v)) {
            r = false;
        }
        else {
            r = (current_time - v) < (1000 * 60 * mins);
        }
        
        if (r === false) {
            dlog(s + ' is out of date: ' + v);
        }
        
        return r;
    }
    
    if (!l || (!(Array.isArray(l) || typeof l === "string")) || l.length <= 0) {
        return false;
    }
    else if (Array.isArray(l)) {
        var is_c = true;
        for (var e=0; e<l.length; e++) {
            if (subtr(l[e]) === false) {
                is_c = false;
            }
        }
        return is_c;
    }
    else {
        return subtr(l);
    }
}

function isActivityDataCurrent(pid, upd, typ, live) {
    var chk_mins;
    var r = true;
    if (typ == 'league') {
        if (live === 'live') {
            dlog('using live');
            chk_mins = check_minutes_avg_live;
        }
        else if (live === 'done') {
            dlog('using done');
            chk_mins = check_minutes_avg_done;
        }
        else {
            dlog('using day');
            chk_mins = check_minutes_avg;
        }
        
        r = (current_time - upd) < (1000 * 60 * chk_mins);
    }
    else if (typ == 'games') {
        //todo timezones? maybe add a check to make sure length is expected somehow
        var update_week = Math.max(Math.ceil(((upd - seasonstart_avg_week) / 86400000) / 7), 1);
        dlog('update week for player: ' + pid + ': ' + update_week);
        if (update_week != current_week_avg) {
            r = false;
        }
    }
    
    if (r === false) {
        dlog('Activity data out of date for player: ' + pid + ', type is: ' + typ + ', by: ' + ((current_time - upd) / 1000));
    }
    
    return r;
}

function runMain() {
    if (hasProjectionTable) {
        addColumns();
        chrome.storage.local.get(storageKeys, function(r) {
            // Projection data
            alldata = r[storagePlayerKey];
            if (isObj(alldata)) {
                updated_times = r[storageUpdateKey];
                if (!isObj(updated_times)) {
                    updated_times = {};
                }
            }
            else {
                dlog('Could not find alldata');
                alldata = {};
                updated_times = {};
            }
            dlog(updated_times, 1);
            
            updated_types = r[storageUpdateTypeKey];
            dlog(updated_types);
            if (!isObj(updated_types)) {
                updated_types = {};
            }
            
            // Translation data
            if (siteType == 'yahoo') {
                if (onMatchupPreviewPage || onFreeAgencyPage) {
                    storage_translation_data = r[storageTranslationKey];
                    if (!(isObj(storage_translation_data))) {
                        dlog('Could not find yahoo ID data');
                        storage_translation_data = {};
                        updated_translation = 0;
                        getYahooIds();
                    }
                    else {
                        updated_translation = r[storageTranslationUpdateKey];
                        if (isDataCurrent('translation')) {
                            dlog('Using cache for yahoo ID data');
                            dlog('yahoo IDs done');
                            yahooIdsDone.resolve();
                        }
                        else {
                            dlog('Yahoo ID data too old, Updated time: ' + updated_translation + ', Current Time: ' + current_time);
                            getYahooIds();
                        }
                    }
                }
                else {
                    dlog('yahoo IDs done');
                    yahooIdsDone.resolve();
                }
            }
            else if (siteType == 'fleaflicker' && onMatchupPreviewPage) {
                storage_translation_data = r[storageTranslationKey];
                if (!(isObj(storage_translation_data))) {
                    storage_translation_data = {};
                }
            }
            
            // Depth data
            depth_data = r[storageDepthKey];
            if (!(isObj(depth_data))) {
                depth_data = {};
            }
            if (!depth_data.hasOwnProperty(current_season)) {
                depth_data[current_season] = {};
            }
            if (!depth_data[current_season].hasOwnProperty('W' + current_week)) {
                depth_data[current_season]['W' + current_week] = {};
            }
            
            depth_data_current_week = depth_data[current_season]['W' + current_week];
            if (isObj(depth_data_current_week)) {
                updated_depth = r[storageDepthUpdateKey];
            }
            else {
                updated_depth = 0;
            }
            dlog('depth data:', 1);
            dlog(depth_data, 1);
            dlog(updated_depth, 1);

            // Activity data
            activity_data = r[storageActivityKey];
            if (!(isObj(activity_data))) {
                activity_data = {};
            }
            
            if (!activity_data.hasOwnProperty(current_season)) {
                activity_data[current_season] = {};
            }
            var activity_data_current_season = activity_data[current_season];
            
            if (!activity_data_current_season.hasOwnProperty(siteType)) {
                activity_data_current_season[siteType] = {};
            }
            activity_data_current_season_site = activity_data_current_season[siteType];
            
            // League data
            league_settings = r[storageLeagueKey];
            updated_league = r[storageLeagueUpdateKey];
            if (isObj(league_settings) && isDataCurrent('league')) {
                dlog('Using cache for league');
                doLeagueThings();
            }
            else {
                league_settings = {};
                dlog('Fetching league data, Updated time: ' + updated_league + ', Current Time: ' + current_time);
                jQuery.get(league_settings_url, function(d) {
					d = d.replace(/(<(\b(img|style|head|link)\b)(([^>]*\/>)|([^\7]*(<\/\2[^>]*>)))|(<\bimg\b)[^>]*>|(\b(background|style)\b=\s*"[^"]*"))/g,"");
                    var setSettings = parseLeagueSettings(d, siteType);
                    var setLeagueData = {};
                    setLeagueData[storageLeagueKey] = setSettings;
                    setLeagueData[storageLeagueUpdateKey] = updated_league;
                    chrome.storage.local.set(setLeagueData, function() {
                        doLeagueThings();
                    });
                });
            }
        });
    }
}

function resetLeagueYear() {
	if (siteType == 'espn' && ((current_season != current_season_avg) || (current_season != current_season_avg_week))) {
		//doing this to reset back to current season
		var espn_points_data = {'leagueId': league_id, 'seasonId': current_season, 'xhr': '1'};
		jQuery.get('//games.espn.com/ffl/freeagency', espn_points_data);
	}
}

function updatePlayerStorage() {
    jQuery.when(projDone, rankDone, rosDone).done(function() {
        dlog('Attempting to set new player data');
        dlog('fetch fail: ' + fetch_fail);
        dlog('idp fetch fail: ' + idp_fetch_fail);
        if (!fetch_fail && !idp_fetch_fail) {
            dlog('Setting new player data');
            var setPlayerData = {};
            setPlayerData[storagePlayerKey] = alldata;
            setPlayerData[storageUpdateKey] = updated_times;
            setPlayerData[storageUpdateTypeKey] = updated_types;
            chrome.storage.local.set(setPlayerData, function() {
				resetLeagueYear();
			});
        }
    });
}

function updateDepthStorage() {
    jQuery.when(depthDone).done(function() {
        dlog('Attempting to set new depth data');
        dlog('depth fail: ' + depth_fail);
        if (!depth_fail) {
            dlog('Setting new depth data');
            var setDepthData = {};
            setDepthData[storageDepthKey] = depth_data;
            setDepthData[storageDepthUpdateKey] = updated_depth;
            chrome.storage.local.set(setDepthData, function() {
				resetLeagueYear();
			});
        }
    });
}

function updateActivityStorage() {
    jQuery.when(activityDone).done(function() {
        dlog('Setting new activity data');
        var setActivityData = {};
        setActivityData[storageActivityKey] = activity_data;
        chrome.storage.local.set(setActivityData, function() {
			resetLeagueYear();
        });
    });
}

function doLeagueThings() {
    if (onMatchupPreviewPage) {
         jQuery.when(projDone, totalsDone).done(function() {
            dlog('all done');
            if (siteType == 'fleaflicker') { //maybe add yahoo?
                watchForChanges();
            }
        });

        if (siteType == 'yahoo') {
            jQuery.when(yahooIdsDone).done(function() {
                getAllData('proj');
            });
        }
        else {
            getAllData('proj');
        }
    }
    else {
        jQuery.when(projDone, rankDone, rosDone, activityDone, depthDone, totalsDone).done(function() {
            dlog('all done');
            watchForChanges();
        });
        
        if (siteType == 'yahoo') {
            jQuery.when(yahooIdsDone).done(function() {
                getAllData();
            });
        }
        else {
            getAllData();
        }
    }
}

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

function addColumns() {
    if (header_index == -1 && !((siteType == 'fleaflicker') && hasProjectionTable)) {
        return;
    }
    
    if (siteType == "espn") {
        var projection_header = '<td class="playertableStat FantasyPlus FantasyPlusProjections FantasyPlusProjectionsHeader" title="Consensus point projections from FantasyPros (via FantasyPlus)">FPROS</td>';
        var projection_cell = '<td class="playertableStat FantasyPlus FantasyPlusProjections FantasyPlusProjectionsData">' + loadingDiv + '</td>';
        
        if (onMatchupPreviewPage) {
            if (show_proj) {
                proj_head.after(projection_header);
                proj_head.text('ESPN');
                                
                var last_header_col = player_table_body.find('.playertableSectionHeader th:contains(STATS)');
                last_header_col.each(function() {
                    var curr_span = jQuery(this).attr("colspan");
                    jQuery(this).attr("colspan", curr_span + 1);
                    
                    var parent_table = jQuery(this).closest('table');
                    
                    parent_table.find('tr.pncPlayerRow:not(.emptyRow)').each(function () {
                        var currRow = jQuery(this);
                        
                        currRow.find('td').last().after(projection_cell);
                    });
                });
            }
        }
        else {
            var adjavg_header = '<td class="playertableStat FantasyPlus FantasyPlusAvg FantasyPlusAvgHeader" title="Injury/Suspension-adjusted average points for the season (via FantasyPlus)">iAVG</td>';
            var current_header = '<td class="playertableStat FantasyPlus FantasyPlusCurrent FantasyPlusCurrentHeader" title="Points scored this week (via FantasyPlus)">CURR</td>';
            var spark_header = '<td class="playertableStat FantasyPlus FantasyPlusSpark FantasyPlusSparkHeader" title="Graph of fantasy points over previous weeks (via FantasyPlus)">TREND</td>';
            var top_rank_header = '<th class="FantasyPlus" colspan="2" title="Projected position rank (lower is better) with 95% confidence interval from FantasyPros (via FantasyPlus)">PROJ RANK (±RANGE)</th>';
            var rank_header = '<td colspan="2" style="text-align: center" class="playertableStat FantasyPlus FantasyPlusRankings FantasyPlusRankingsHeader" title="Projected position rank (lower is better) for *this week* from FantasyPros (via FantasyPlus)">THIS WEEK</td>'; //say wk 9 or this week
            var ros_header = '<td colspan="2" style="text-align: center" class="playertableStat FantasyPlus FantasyPlusRos FantasyPlusRosHeader" title="Projected position rank (lower is better) for *the rest of the season* from FantasyPros (via FantasyPlus)">REMAINING</td>';
            var depth_header = '<td class="playertableStat FantasyPlus FantasyPlusDepth FantasyPlusDepthHeader" title="Depth chart information (via FantasyPlus)">DEPTH</td>';
            
            var adjavg_cell = '<td class="playertableStat FantasyPlus FantasyPlusAvg FantasyPlusAvgData">' + loadingDiv + '</td>';
            var current_cell = '<td class="playertableStat FantasyPlus FantasyPlusCurrent FantasyPlusCurrentData">' + loadingDiv + '</td>';
            var spark_cell = '<td class="playertableStat FantasyPlus FantasyPlusSpark FantasyPlusSparkData">' + loadingDiv + '</td>';
            var rank_cell = '<td class="playertableStat FantasyPlus FantasyPlusRankings FantasyPlusRankingsData">' + loadingDiv + '</td>';
            var rank_std_cell = '<td class="playertableStat FantasyPlus FantasyPlusRankings FantasyPlusRankingsStdevData"></td>';
            var ros_cell = '<td class="playertableStat FantasyPlus FantasyPlusRos FantasyPlusRosData">' + loadingDiv + '</td>';
            var ros_std_cell = '<td class="playertableStat FantasyPlus FantasyPlusRos FantasyPlusRosStdevData"></td>';
            var depth_cell = '<td class="playertableStat FantasyPlus FantasyPlusDepth FantasyPlusDepthData">' + loadingDiv + '</td>';
            var space_cell = '<td class="FantasyPlus sectionLeadingSpacer"></td>';
            
            var all_header_cells = '';
            var all_row_cells = '';
            
            var section_header = jQuery('.playerTableBgRowHead.tableHead.playertableSectionHeader');
            var last_header_col = section_header.find('th:last');
            
            if (show_proj) {
                last_header_col.attr({'colspan': 2, 'title': 'Projected points for this week'}).text('PROJ PTS');
                last_header_col.after('<th class="FantasyPlus" colspan="3">OWNERSHIP</th>');
                last_header_col.after('<th class="FantasyPlus" colspan="1">OPRK</th>'); //todo change to 2, OPRK to ESPN, and include the DVOA adjusted version
                last_header_col.after(space_cell);
                
                if (proj_head.find('a').length > 0) { //we're on a filterable page
                    proj_head.find('a').text('ESPN');
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
                var top_rank_combine;
                if (show_proj) {
                    top_rank_combine = jQuery(space_cell).add(top_rank_header_j);
                    last_header_col.after(top_rank_combine);
                }
                else {
                    top_rank_combine = top_rank_header_j.add(jQuery(space_cell));
                    last_header_col.before(top_rank_combine);
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
            }
            
            var season_num = 0;
            var season_adds = [show_avg, show_current, show_spark];
            for (var s=0; s<season_adds.length; s++) {
                if (season_adds[s] === true) {
                    season_num += 1;
                }
            }
            if (show_avg || show_current || show_spark) {
                var avg_header_col = section_header.find('th:contains(SEASON)');
                avg_header_col.attr({'colspan': 4 + season_num, 'title': 'Season statistics'});
            }
            
            var avg_head = player_table_header.find('td:contains(AVG)');
            var avg_header_index = avg_head.first().index();
            if (show_depth) {
                avg_header_index -= 1;
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

            player_table_rows.each(function () {
                var currRow = jQuery(this);
                
                var byeweek_text = currRow.find('td').eq(byeweek).text();
                var adj_header_index = (byeweek_text == "** BYE **" ? header_index - 1 : header_index);
                var adj_avg_header_index = (byeweek_text == "** BYE **" ? avg_header_index - 1 : avg_header_index);
                var adj_last_header_index = (byeweek_text == "** BYE **" ? last_header_index - 1 : last_header_index);
                var index_adj = 0;
                
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
                }
            });
            
            if ((show_proj || show_current) && onClubhousePage) {
                var bench_header = player_table_body.find('tr.playerTableBgRowHead:last');
                var bench_before = bench_header.prevAll('.playerTableBgRowSubhead:first');
                var total_row = bench_before.clone();
                
                var bench_prev = bench_header.prev();
                var bench_prev_match = bench_prev.attr('class').match(/playerTableBgRow(\d)/);
                var bench_num = '0';
                if (bench_prev_match && bench_prev_match.length ==2) {
                    bench_num = Math.abs(parseInt(bench_prev_match[1]) - 1);
                }
                var new_row_class = 'playerTableBgRow' + bench_num;
                
                total_row.removeClass();
                
                total_row.addClass('FantasyPlus FantasyPlusTotals pncPlayerRow ' + new_row_class);
                total_row.find('td').empty();
                total_row.find('td:first').html('<b>TOTAL</b>');
                
                var total_proj_cell = total_row.find('.FantasyPlusProjectionsHeader');
                var total_curr_cell = total_row.find('.FantasyPlusCurrentHeader');
                
                total_row.find('td').removeClass(function (i, v) {
                    return (v.match(/(^|\s)FantasyPlus\S+Header/g) || []).join(' ');
                });
                
                total_proj_cell.addClass('FantasyPlusProjectionsTotal');
                total_curr_cell.addClass('FantasyPlusCurrentTotal');
                
                bench_header.before(total_row);
            }
        }
    }
    else if (siteType == "yahoo") {		
        if (onMatchupPreviewPage) {
            if (show_proj) {
                var projection_header = '<th style="width: 38px;" class="Ta-end Va-top FantasyPlus FantasyPlusProjections FantasyPlusProjectionsHeader" title="Consensus point projections from FantasyPros (via FantasyPlus)"><div style="width: 40px;">Proj (FP)</div></td>';
                var projection_cell = '<td style="width: 38px;" class="Alt Ta-end F-shade Va-top FantasyPlus FantasyPlusProjections FantasyPlusProjectionsData">' + loadingDiv + '</td>';
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
        }
        else {
            var projection_header = '<th style="width: 40px; text-align: center;" class="FantasyPlus FantasyPlusProjections FantasyPlusProjectionsHeader" title="Consensus point projections from FantasyPros (via FantasyPlus)">Proj (FP)</th>';				
            var rank_header = '<th style="width: 40px; text-align: center;" class="FantasyPlus FantasyPlusRankings FantasyPlusRankingsHeader" title="Projected position rank (lower is better) for *this week* from FantasyPros (via FantasyPlus)">Rank (FP)</th>';
            //var depth_header = '<th style="width: 50px; text-align: center;" class="playertableStat FantasyPlus FantasyPlusDepth FantasyPlusDepthHeader" title="Depth chart information (via FantasyPlus)">DEPTH</th>';
            
            var projection_cell = '<td class="Nowrap Ta-end FantasyPlus FantasyPlusProjections FantasyPlusProjectionsData">' + loadingDiv + '</td>';				
            var rank_cell = '<td class="Nowrap Ta-end FantasyPlus FantasyPlusRankings FantasyPlusRankingsData">' + loadingDiv + '</td>';
            //var depth_cell = '<td class="Nowrap Ta-end FantasyPlus FantasyPlusDepth FantasyPlusDepthData">' + loadingDiv + '</td>';
            
            custom_cols = 0;
            var all_header_cells = '';
            
            if (show_proj) {
                custom_cols++;
                all_header_cells += projection_header;
            }
            if (show_rank) {
                custom_cols++;
                all_header_cells += rank_header;
            }
            //if (show_depth) {
            //	custom_cols++;
            //	all_header_cells += depth_header;
            //}
            
            if (custom_cols > 0) {
                player_table_header.each(function() {
                    var first_header_col = jQuery(this).find('th').filter(function(i) {
                        return jQuery(this).text().match(/^\w/);
                    }).first();
                    
                    var fhc_curr_cols = parseInt(first_header_col.attr('colspan'));
                    if (!isNaN(fhc_curr_cols) && !first_header_col.data('modified')) {
                        first_header_col.attr({'colspan': fhc_curr_cols + custom_cols, 'data-modified': true});
                    }
                });
                
                proj_head.after(all_header_cells);
                
                var proj_cell_text = proj_head.first().text();
                player_table_rows.each(function() {
                    var currRow = jQuery(this);
                    var points_cell = currRow.find('td').eq(header_index - 1);
                    var proj_cell = currRow.find('td').eq(header_index);
                    
                    var search_cell = proj_cell;
                    var search_type = '';
                    if (proj_cell_text == 'Proj Pts') {
                        search_cell = points_cell;
                        search_type = 'stats';
                    }
                    else if (proj_cell_text == 'Fan Pts') {
                        search_cell = proj_cell;
                        search_type = 'proj';
                    }
                    else if (proj_cell_text == 'Rank') {
                        search_cell = points_cell;
                        search_type = 'gdd';
                    }
                    else if (proj_cell_text == 'This Week') {
                        search_cell = proj_cell;
                        search_type = 'rank';
                    }
                    
                    var isBye = search_cell.text() == 'Bye'
                    var isBlank = search_cell.text() === '';
                    
                    var all_cells = '';
                    if (isBye) {
                        //todo fix like FF to make more auto
                        var addCols = (search_type == 'stats') ? 3 : 2;
                        search_cell.attr('colspan', addCols + custom_cols);
                    }
                    else {
                        if (show_proj) {
                            all_cells += projection_cell;
                        }
                        if (show_rank) {
                            all_cells += rank_cell;
                        }

                        if (isBlank) {
                            search_cell.attr('colspan', 1);
                            if (search_cell.next().hasClass('Bdrstart')) {
                                all_cells += '<td class="Ta-end Nowrap"></td>';
                                if (search_type == 'stats') {
                                    search_cell.after('<td class="Ta-end Nowrap"></td>');
                                }
                                else if (search_type == 'rank') {
                                    search_cell.after('<td class="Ta-end Nowrap"></td><td class="Ta-end Nowrap"></td>');
                                }
                            }
                        }

                        proj_cell = currRow.find('td').eq(header_index);
                        proj_cell.after(all_cells);
                    }
                    
                    if (currRow.find('td:first').hasClass('Selected')) {
                        currRow.find('td.FantasyPlus').addClass('Selected');
                    }
                });
            }
        }
    }
    else if (siteType == 'fleaflicker') {
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
        
        var findSubChildren = function(cell) {
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
        
        var addColspan = function(cell, num) {
            num = typeof num === "undefined" ? false : parseInt(num);
            
            if (cell && cell.length) {
                if (typeof num !== "number") {
                    var child_list = findSubChildren(cell);
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

        if (onMatchupPreviewPage) {
            var projection_cell = '<td class="text-right FantasyPlus FantasyPlusProjections FantasyPlusProjectionsData">' + loadingDiv + '</td>';
            var newprojcell = '<td class="text-right FantasyPlus FantasyPlusProjections FantasyPlusProjectionsTotal">--</td>';

            if (show_proj) {
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
                        if (currRow.hasClass('divider')) {
                            if (!starter_found) {
                                total_cell = newprojcell;
                                this_proj_cell.html('--');
                                this_proj_cell.addClass('FantasyPlusFleaTotal');
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
                        else if (currRowTds.first().text() == 'Optimum') {
                            total_cell = blank_cell;
                        }
                        
                        total_cell = jQuery(total_cell);

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
                }
            });
        }
        else {
            var spark_header = '<th style="width: 4%;" class="leaf FantasyPlus FantasyPlusSpark FantasyPlusSparkHeader" title="Graph of fantasy points over previous weeks (via FantasyPlus)">Trend</th>';
            var top_rank_header = '<th colspan="2" class="top left right FantasyPlus FantasyPlusRankingsTop FantasyPlusRankingsTopHeader" title="Projected position rank (lower is better) with 95% confidence interval from FantasyPros (via FantasyPlus)">Proj Rank (±Range)</th>';
            var rank_header = '<th colspan="2" style="text-align: center;" class="leaf left FantasyPlus FantasyPlusRankings FantasyPlusRankingsHeader" title="Projected position rank (lower is better) for *this week* from FantasyPros (via FantasyPlus)">This Week</th>';
            var ros_header = '<th colspan="2" style="text-align: center;" class="leaf right FantasyPlus FantasyPlusRos FantasyPlusRosHeader" title="Projected position rank (lower is better) for *the rest of the season* from FantasyPros (via FantasyPlus)">Remaining</th>';
            var depth_header = '<th style="width: 4%;" class="leaf FantasyPlus FantasyPlusDepth FantasyPlusDepthHeader" title="Depth chart information (via FantasyPlus)">Depth</th>';
            
            var projection_cell = '<td class="FantasyPlus FantasyPlusProjections FantasyPlusProjectionsData">' + loadingDiv + '</td>';

            var spark_cell = '<td class="FantasyPlus FantasyPlusSpark FantasyPlusSparkData">' + loadingDiv + '</td>';
            var rank_cell = '<td style="width: 2%;" class="left FantasyPlus FantasyPlusRankings FantasyPlusRankingsData">' + loadingDiv + '</td>';
            var rank_std_cell = '<td style="width: 2%;" class="right FantasyPlus FantasyPlusRankings FantasyPlusRankingsStdevData"></td>';
            var ros_cell = '<td style="width: 2%;" class="FantasyPlus FantasyPlusRos FantasyPlusRosData">' + loadingDiv + '</td>';
            var ros_std_cell = '<td style="width: 2%;" class="right FantasyPlus FantasyPlusRos FantasyPlusRosStdevData"></td>';
            var depth_cell = '<td class="FantasyPlus FantasyPlusDepth FantasyPlusDepthData">' + loadingDiv + '</td>';
            
            var addCells = function(idx, data, add_empty) {
                if (Number.isInteger(idx) && idx >= 0) {
                    add_empty = (typeof add_empty == 'undefined') ? false : add_empty;
                    
                    player_table_rows.each(function() {
                        var currRow = jQuery(this);
                        var currRowTds = currRow.find('td, th');
                        
                        var target_cell = currRowTds.eq(idx);
                        var cell_data = jQuery(data);

                        if (target_cell.hasClass('right') && !target_cell.hasClass('FantasyPlus')) {
                            target_cell.removeClass('right');
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
            
            var fant_header_default = findHeader('^Last [0-9]+$|^Total$|^Avg$', '^Fantasy$');
            fant_header_default.css('width', '4%');
            
            var seas_header_default = findHeader('^Season$');
            seas_header_default.css('width', '5%');
            
            if (show_depth) {
                var name_head = player_table_header.find('th').filter(function(i) {
                    return jQuery(this).text() === 'Name';
                });
                var name_index = getIdxSpan(name_head);
                var parent_name_head = findIdxSpan(name_index, name_head);

                addHeader(name_head, depth_header);
                addColspan(parent_name_head);
                addCells(name_index, depth_cell);
            }
            
            var proj_index = getIdxSpan(proj_head);
            var parent_head = findIdxSpan(proj_index, proj_head);
            
            if (!parent_head || !parent_head.length) {
                show_proj = false;
                show_rank = false;
                show_ros = false;
            }
            
            if (show_proj) {
                addHeader(proj_head, projection_header);
                addColspan(parent_head);
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

            if (show_spark) {
                var last_fantasy_head = playerTable.find('tr th').filter(function(i) {
                    return jQuery(this).text().match(/Season|Avg/);
                });
                var fantasy_index = getIdxSpan(last_fantasy_head);
                var fantasy_head = findIdxSpan(fantasy_index, last_fantasy_head);

                addHeader(last_fantasy_head, spark_header);
                addColspan(fantasy_head);
                addCells(fantasy_index, spark_cell);
            }

            if (onClubhousePage) {
                var last_row = player_table_body.find('tr[id^=row].last:first');
                
                var total_row = last_row.clone();
                last_row.find('td').removeClass('bottom');
                
                total_row.removeAttr('id');
                total_row.addClass('divider strong FantasyPlus');
                
                total_row_tds = total_row.find('td');
                total_row_tds.each(function(i) {
                    var t_j = jQuery(this);
                    t_j.addClass('bottom');
                    
                    if (i === 0) {
                        t_j.addClass('FantasyPlus');
                        t_j.html('<span class="player">Total</span>');
                    }
                    else {
                        t_j.empty();
                        t_j.removeClass(function(index, css) {
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
                tot_proj_cell.addClass('FantasyPlusFleaTotal');
                if (show_proj) {
                    tot_proj_cell = tot_proj_cell.next();
                    tot_proj_cell.html('—');
                    tot_proj_cell.addClass('FantasyPlusProjections FantasyPlusProjectionsTotal');
                }
                tot_proj_cell.next().html('—');
                tot_proj_cell.next().addClass('FantasyPlusActualTotal');
                
                last_row.after(total_row);
            }
        }
    }
}

function parseLeagueSettings(league_data, siteType) {
    var $ld = jQuery(league_data);
    league_settings = {};
    league_settings['siteType'] = siteType;
    
    if (siteType == 'espn') {
        var getValue = function(setting_name) {
            //TODO fix this for the right section
            return parseFloat($ld.find("td:contains('" + setting_name + "')").next().first().text());
        };

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
        };
        
        var passSettings = getValue('Passing Yards');
            league_settings['pass_yds'] = passSettings[0] || 0;
            league_settings['pass_bonus'] = {};
                var passSettingsDict = passSettings[1];
                for (var k in passSettingsDict) {
                    if (passSettingsDict.hasOwnProperty(k)) {
                        league_settings['pass_bonus'][k] = passSettingsDict[k];
                    }
                }
            league_settings['pass_tds'] = getValue('Passing Touchdowns')[0] || 0;
            league_settings['pass_ints'] = getValue('Interceptions')[0] || 0;
            league_settings['pass_cmp'] = getValue('Completions')[0] || 0;
            league_settings['pass_icmp'] =	getValue('Incomplete Passes')[0] || 0;
            league_settings['pass_att'] = getValue('Passing Attempts')[0] || 0;
            league_settings['pass_firstdown'] = getValue('Passing 1st Downs')[0] || 0;
        
        var rushSettings = getValue('Rushing Yards');
            league_settings['rush_yds'] = rushSettings[0] || 0;
            league_settings['rush_bonus'] = {};
                var rushSettingsDict = rushSettings[1];
                for (var k in rushSettingsDict) {
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
                for (var k in recSettingsDict) {
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
    }
    else if (siteType == 'fleaflicker') {
        var league_table = jQuery('#body-center-main > table', $ld);
        var league_headers = league_table.find('tr td.table-heading').closest('tr');
        //todo separate these by who it applies to, in td.right
        //todo calculate bonuses based on some averages maybe? like yards per catch, etc.
        
        var point_type;
        
        //well, this got really complicated really fast.
        var kick_dist = [17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65];
        var kick_counts = [0,5,27,68,62,77,78,62,69,57,94,65,71,84,81,71,94,60,93,77,76,89,65,78,56,71,76,80,70,63,63,75,67,57,54,55,58,30,19,6,6,5,1,0,2,0,0,1,0];
        
        var kick_tot = 0;
        for (var c=0; c<kick_counts.length; c++) {
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
            var settingTds = league_tds.find("td.left strong").filter(function() { return search_regex.test(jQuery(this).text()); }).closest('td.left');
            
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
                    
                    var expected_yards = 36.36; // from historical data, last 3 years
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
                                            for (var k=0; k<kick_extra_counts.length; k++) {
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
                                        for (var e=0; e < kick_counts_cut.length; e++) {
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
                 for (var f=0; f<settingVals.length; f++) {
                     new_pts += settingVals[f];
                 }
                 settingVals = new_pts;
            }
            else if (settingVals.length === 0) {
                settingVals = null;
            }

            return settingVals;
        };
        
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
    }

    updated_league = current_time;
    
    dlog(league_settings);
    return league_settings;
}

//Get the data from external sites
function fetchPositionData(position, type, cb) {
    var source_site = '';
    var source_type = 'offense';
    var rank_ppr;
    
    if ((type == 'rank') || (type == 'ros')) {
        rank_ppr = '';
        if (position == 'rb' || position == 'wr' || position == 'te') {
            if (league_settings['rec_att'] == 0.5) {
                rank_ppr = 'half-point-ppr-';
            }
            else if (league_settings['rec_att'] == 1.0) {
                rank_ppr = 'ppr-';
            }
        }
        
        var ros_url = '';
        if (type == 'ros') {
            ros_url = 'ros-';
        }

        source_site = 'https://www.fantasypros.com/nfl/rankings/' + ros_url + rank_ppr + position + '.php';
    }
    else if (off_positions_proj.indexOf(position) > -1) {
        //todo dunno if i need week anymore
        source_site = 'https://www.fantasypros.com/nfl/projections/' + position + '.php?week=' + current_week;
    }
    else {
        source_type = 'idp';
        //source_site = 'http://www.fantasysharks.com/apps/bert/forecasts/projections.php?csv=1&Position=' + position + '&Segment=' + (563 + current_week);
        source_site = 'http://www.fantasysharks.com/apps/bert/forecasts/projections.php?csv=1&Position=' + position;
    }
    
    if (source_type == 'idp') {
        if (document.location.protocol == 'https:') {
            cb(position, 'error');
        }
        else {
            jQuery.ajax({
                url: source_site,
                custom_data: {'cb': cb},
                timeout: ajax_timeout
            }).done(function(data) {
                var cb = this.custom_data.cb;
				data = data.replace(/(<(\b(img|style|head|link)\b)(([^>]*\/>)|([^\7]*(<\/\2[^>]*>)))|(<\bimg\b)[^>]*>|(\b(background|style)\b=\s*"[^"]*"))/g,"");				
                cb(position, data.trim());
            }).fail(function() {
                var cb = this.custom_data.cb;
                idp_fetch_fail = true;
                chrome.runtime.sendMessage({ request: 'fetch_fail', value: source_site });
                cb(position, 'error');
            });
        }
    }
    else {
        var expert_type = experts[type] || {};
        var expert_selection = expert_type.selection || [];
        
        if (type == 'proj' && expert_selection.length === 1) {
            jQuery.ajax({
                url: source_site,
                custom_data: {'cb': cb},
                timeout: ajax_timeout
            }).done(function(data) {
                var cb = this.custom_data.cb;
				data = data.replace(/(<(\b(img|style|head|link)\b)(([^>]*\/>)|([^\7]*(<\/\2[^>]*>)))|(<\bimg\b)[^>]*>|(\b(background|style)\b=\s*"[^"]*"))/g,"");
                cb(position, data.trim());
            }).fail(function() {
                var cb = this.custom_data.cb;
                fetch_fail = true;
                chrome.runtime.sendMessage({ request: 'fetch_fail', value: source_site });
                cb(position, 'error');
            });
        }
        else if (type == 'proj') {
            var send_data = {
                'scoring': 'STD',
                'expert[]': []
            };
            
            for (var e=0; e<expert_selection.length; e++) {
                var e_val = expert_selection[e];
                var e_conv = expert_map[e_val];
                if (e_conv) {
                    send_data['expert[]'].push(e_conv);
                }
            }
            
            jQuery.ajax({
                url: source_site,
                method: 'get',
                data: send_data,
                traditional: true,
                custom_data: {'cb': cb},
                timeout: ajax_timeout
            }).done(function(data) {
                var cb = this.custom_data.cb;
				data = data.replace(/(<(\b(img|style|head|link)\b)(([^>]*\/>)|([^\7]*(<\/\2[^>]*>)))|(<\bimg\b)[^>]*>|(\b(background|style)\b=\s*"[^"]*"))/g,"");
                cb(position, data.trim());
            }).fail(function() {
                var cb = this.custom_data.cb;
                fetch_fail = true;
                chrome.runtime.sendMessage({ request: 'fetch_fail', value: source_site });
                cb(position, 'error');
            });
        }
        else {
            jQuery.ajax({
                url: source_site,
                custom_data: {'cb': cb},
                timeout: ajax_timeout
            }).done(function(data) {
                var cb = this.custom_data.cb;
				data = data.replace(/(<(\b(img|style|head|link)\b)(([^>]*\/>)|([^\7]*(<\/\2[^>]*>)))|(<\bimg\b)[^>]*>|(\b(background|style)\b=\s*"[^"]*"))/g,"");
                
                var send_data = {
                    'expert[]': []
                };
                
                var expert_list = send_data['expert[]'];
                            
                if (rank_ppr == 'half-point-ppr-') {
                    send_data['scoring'] = 'HALF';
                }
                else if (rank_ppr == 'ppr-') {
                    send_data['scoring'] = 'PPR';
                }
                else {
                    send_data['scoring'] = 'STD';
                }
                
                var expert_type = experts[type] || {};
                var expert_selection = expert_type.selection || [];
                var expert_num = expert_type.num || {};
                var ex_num_top = expert_num['top'] || 10;
                var ex_num_upd = expert_num['updated'] || 7;
                
                var expert_data = jQuery(data).find('#edit-experts #experts');
                if (expert_data.length) {
                    var ex_rows = expert_data.find('tbody tr');
                    
                    var ex_headers = expert_data.find('thead tr');
                    var id_idx = ex_headers.find('th:first').index();
                    var acc_ovr_idx = ex_headers.find('th.accuracy.overall:contains(In-Season)').index();
                    var acc_pos_idx = ex_headers.find('th.accuracy.position:contains(In-Season)').index();
                    var date_idx = ex_headers.find('th:contains(Date)').index();
                    
                    if (expert_selection.indexOf('all') == -1) {
                        var staff_id = ex_rows.find('td').filter(function() {
                            return jQuery(this).text() == 'FantasyPros Staff';
                        }).parents('tr').find('td:eq(' + id_idx +') input').val();
                        
                        if (jQuery.isNumeric(staff_id)) {
                            expert_list.push(staff_id);
                        }
                        
                        var want_updated = expert_selection.indexOf('updated') > -1;
                        var want_overall = expert_selection.indexOf('overall') > -1;
                        var want_position = expert_selection.indexOf('position') > -1;
                        
                        if ((want_overall || want_position) && ex_num_top && ex_rows.length > ex_num_top) {
                            var want_idx = -1;
                            if (want_overall) {
                                want_idx = acc_ovr_idx;
                            }
                            else if (want_position) {
                                want_idx = acc_pos_idx;
                            }
                            
                            ex_rows.sort(function(a,b) {
                                var n_b = jQuery(b).find('td:eq(' + want_idx + ')').text().replace('#', '') || Infinity;
                                var n_a = jQuery(a).find('td:eq(' + want_idx + ')').text().replace('#', '') || Infinity;
                                return n_a - n_b;
                            });
                            
                            ex_rows = ex_rows.slice(0, ex_num_top);
                        }
                        
                        if (want_updated && ex_num_upd) {
                            var this_month = current_month + 1;
                            
                            var ex_rows_updated = ex_rows.filter(function() {
                                var this_date_txt = jQuery(this).find('td:eq(' + date_idx + ')').text();
                                var this_date_year = current_year;
                                if (this_month < this_date_txt.split('/')[0]) {
                                    this_date_year -= 1;
                                }
                                var this_date = new Date(this_date_txt + ' ' + this_date_year);
                                if (((current_date - this_date) / 1000 / 60 / 60 / 24) < (ex_num_upd + 1)) {
                                    return this;
                                }
                            });
                            
                            if (ex_rows_updated.length > 1) {
                                ex_rows = ex_rows_updated;
                            }
                            else {
                                ex_rows.sort(function(a,b) {
                                    var n_b_txt = jQuery(b).find('td:eq(' + date_idx + ')').text();
                                    var n_a_txt = jQuery(a).find('td:eq(' + date_idx + ')').text();
                                    
                                    var n_b_year = current_year;
                                    if (this_month < n_b_txt.split('/')[0]) {
                                        n_b_year -= 1;
                                    }
                                    var n_b = new Date(n_b_txt + ' ' + n_b_year);
                                    
                                    var n_a_year = current_year;
                                    if (this_month < n_a_txt.split('/')[0]) {
                                        n_a_year -= 1;
                                    }
                                    var n_a = new Date(n_a_txt + ' ' + n_a_year);
                                    
                                    return n_b - n_a;
                                });
                                
                                ex_rows = ex_rows.slice(0, 2);
                            }
                        }
                    }
                    
                    ex_rows.each(function() {
                        var ex_row = jQuery(this);
                        var ex_id = ex_row.find('td').eq(id_idx).find('input').val();
                        expert_list.push(ex_id);
                    });
                }
                
                dlog(expert_list);
                
                jQuery.ajax({
                    url: source_site,
                    method: 'get',
                    data: send_data,
                    custom_data: {'cb': cb},
                    timeout: ajax_timeout
                }).done(function(data) {
                    var cb = this.custom_data.cb;
					data = data.replace(/(<(\b(img|style|head|link)\b)(([^>]*\/>)|([^\7]*(<\/\2[^>]*>)))|(<\bimg\b)[^>]*>|(\b(background|style)\b=\s*"[^"]*"))/g,"");
                    cb(position, data.trim());
                }).fail(function() {
                    var cb = this.custom_data.cb;
                    fetch_fail = true;
                    chrome.runtime.sendMessage({ request: 'fetch_fail', value: source_site });
                    cb(position, 'error');
                });
            }).fail(function() {
                var cb = this.custom_data.cb;
                fetch_fail = true;
                chrome.runtime.sendMessage({ request: 'fetch_fail', value: source_site });
                cb(position, 'error');
            });
        }
    }
}

function parsesiteCSV(str) {
    var arr = [];
    var quote = false;
    
    for (var row = col = c = 0; c < str.length; c++) {
        var cc = str[c];
        var nc = str[c+1];
        arr[row] = arr[row] || [];
        arr[row][col] = arr[row][col] || '';
        if (cc == ',' && typeof nc === "undefined") { col++; arr[row][col] = ''; }
        
        if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }  
        if (cc == '"') { quote = !quote; continue; }
        if (cc == ',' && !quote) { ++col; continue; }
        if (cc == '\n' && !quote) { ++row; col = 0; continue; }

        arr[row][col] += cc;
    }

    return arr;
}

function convertFProsToCSV(raw_data, type, pos_name) {
    var new_raw_data = jQuery(raw_data);
    new_raw_data.find('thead tr:has(td)').remove();
    new_raw_data.find('tbody tr:not([class^="mpb-player"])').remove();
    var new_data = jQuery('table#data', new_raw_data);
    
    var header_cell = new_data.find('thead th:contains("Player")');
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
    
    var new_headers;
    if (type == 'rank') {
        if (idp_positions.indexOf(pos_name) > -1) {
            new_headers = fpros_rank_idp_headers;
        }
        else {
            new_headers = fpros_rank_headers;
        }
    }
    else if (type == 'ros') {
        if (idp_positions.indexOf(pos_name) > -1) {
            new_headers = fpros_ros_idp_headers;
        }
        else {
            new_headers = fpros_ros_headers;
        }
    }
    else if (type == 'proj') {
        new_headers = fpros_proj_headers[pos_name];
    }
    
    var new_csv = new_data.table2CSV({
        delivery: 'value',
        header: new_headers
    });

    return new_csv;
}

function getYahooIds() {
    storage_translation_data = {};

	//https://sports.yahoo.com/site/api/resource/sports.league.playerssearch;count=10;league=nfl;name=;pos=nfl.pos.9;start=?bkt=%5B%22spdmtest%22%2C%22mlb-gamechannel%22%2C%22sp-football-reg-options-expanded%22%2C%22sp-footballl-signup-primary-join%22%2C%22sp-survival-promo-ctl%22%5D&device=desktop&feature=canvassOffnet%2CnewContentAttribution%2Clivecoverage%2Ccanvass&intl=us&lang=en-US&partner=none&prid=as7g78lcqbjvm&region=US&site=sports&tz=America%2FNew_York&ver=1.0.1932&returnMeta=true
    
    jQuery.ajax({
        url: yahoo_list_url,
        timeout: ajax_timeout
    }).done(function(pl) {
		pl = pl.replace(/(<(\b(img|style|head|link)\b)(([^>]*\/>)|([^\7]*(<\/\2[^>]*>)))|(<\bimg\b)[^>]*>|(\b(background|style)\b=\s*"[^"]*"))/g,"");
        var pldata = jQuery(pl);
        var player_rows = pldata.find('tr[class^=ysprow]');

        player_rows.each(function() {
            var player_row = jQuery(this);
            // maybe grab the position and team data for the future
            var player_td = player_row.find('td:first a:first');
            
            if (player_td.length === 1) {
                var p_name = player_td.text().trim();
                var p_href = player_td.attr('href');
                var p_href_id = p_href.split('/').pop();
                
                if (p_name && parseFloat(p_href_id)) {
                    storage_translation_data['ID_' + p_href_id] = p_name;
                }
            }
        });
        
        updated_translation = current_time;
        
        var new_id_data = {};
        new_id_data[storageTranslationKey] = storage_translation_data;
        new_id_data[storageTranslationUpdateKey] = updated_translation;
        chrome.storage.local.set(new_id_data);
    }).fail(function() {
        dlog('Could not fetch yahoo ID table');
        chrome.runtime.sendMessage({ request: 'fetch_fail', value: yahoo_list_url });
    }).always(function() {
        dlog('yahoo IDs done');
        yahooIdsDone.resolve();
    });
}

function getPosProjections() {
    var ready_proj = all_positions_proj.length;
    var type = 'proj';
    //TODO add a catch here if this array is empty at the end or something
    for (var p=0; p < all_positions_proj.length; p++) {
        var p_name = all_positions_proj[p];
        fetchPositionData(p_name, type, function(p_name, raw_data) {
            var pos_name, parsed_proj;
            
            if (raw_data !== 'error') {
                if (off_positions_proj.indexOf(p_name) > -1) {
                    pos_name = p_name.toUpperCase();
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
                        
                        var new_pos_name = pos_name;
                        
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
                            player_name = player_name.trim();
                            
                            new_pos_name = 'D/ST';
                            team_name = "-";
                        }
                        else if (def_positions_proj.indexOf(p_name) > -1) {
                            //Other IDPs, reversing names
                            player_name = player_name.split(',')[1] + " " + player_name.split(',')[0];
                            player_name = player_name.trim();

                            var player_check = fixPlayerName(player_name, new_pos_name, team_name, 'proj');
                            if (!player_check) {
                                if (player_name_fix.hasOwnProperty(player_name)) {
                                    player_name = player_name_fix[player_name];
                                }
                            }
                            else {
                                player_name = player_check[0];
                            }
                            
                            if (player_position_fix_sharks.hasOwnProperty(player_name)) {
                                new_pos_name = player_position_fix_sharks[player_name];
                            }
                            
                            player_name = player_name.trim();
                        }
                        
                        player_name = player_name.toUpperCase();

                        // Add team and position to player_name for differentiating duplicate names
                        var full_name = player_name + "|" + new_pos_name + "|" + team_name;
                        
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
            if (ready_proj === 0) {
                updated_times.proj = current_time;
                updated_types.proj = ((experts.proj || {}).selection || 'none').toString();
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
            var pos_name, parsed_rank;
            
            if (raw_data !== 'error') {
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
                        
                        var new_pos_name = pos_name;
                        
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

                            new_pos_name = 'D/ST';
                            team_name = "-";
                        }
                        
                        player_name = player_name.trim().toUpperCase();
                        
                        // Add team and position to player_name for differentiating duplicate names
                        var full_name = player_name + "|" + new_pos_name + "|" + team_name;
                        
                        if (!alldata.hasOwnProperty(full_name)) {
                            alldata[full_name] = {};
                        }
                        
                        for (var j = player_name_header + 1; j < headers.length; j++) {
                            alldata[full_name][headers[j].trim()] = currentline[j].trim();
                        }
                    }
                }
            }
            
            ready_rank = ready_rank - 1;
            if (ready_rank === 0) {
                updated_times.rank = current_time;
                var exp_rank = experts.rank || {};
                var exp_rank_num = exp_rank.num || {};
                updated_types.rank = (exp_rank.selection || 'none').toString() + '-' + (exp_rank_num['top'] || 0) + '-' + (exp_rank_num['updated'] || 0);
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
            var pos_name, parsed_rank;
            
            if (raw_data !== 'error') {
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
                        
                        var new_pos_name = pos_name;
                        
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

                            new_pos_name = 'D/ST';
                            team_name = "-";
                        }
                        
                        player_name = player_name.trim().toUpperCase();
                        
                        // Add team and position to player_name for differentiating duplicate names
                        var full_name = player_name + "|" + new_pos_name + "|" + team_name;
                        
                        if (!alldata.hasOwnProperty(full_name)) {
                            alldata[full_name] = {};
                        }
                        
                        for (var j = player_name_header + 1; j < headers.length; j++) {
                            if (currentline[j]) {
                                alldata[full_name][headers[j].trim() + ' Ros'] = currentline[j].trim();
                            }
                            else {
                                alldata[full_name][headers[j].trim() + ' Ros'] = '';
                            }
                        }
                    }
                }
            }
            
            ready_ros = ready_ros - 1;
            if (ready_ros === 0) {
                updated_times.ros = current_time;
                var exp_ros = experts.ros || {};
                var exp_ros_num = exp_ros.num || {};
                updated_types.ros = (exp_ros.selection || 'none').toString() + '-' + (exp_ros_num['top'] || 0) + '-' + (exp_ros_num['updated'] || 0);
                addRos();
            }
        });
    }
}

function getPlayerCheckName(n, p, t, typ) {
    if (typ == 'proj') {
        return n.toUpperCase() + '|' + p + '|' + t;
    }
    else if (typ == 'depth') {
        return n.toUpperCase();
    }
    else {
        return;
    }
}

function fixPlayerPosition(pname, ppos, f_type) {
    var position_fix_dict = {};
    if (f_type == 'proj') {
        position_fix_dict = player_position_fix;
    }
    else if (f_type == 'depth') {
        position_fix_dict = player_position_fix_depth;
    }
    
    if (player_name_fix.hasOwnProperty(pname)) {
        pname = player_name_fix[pname];
    }
    
    if (position_fix_dict.hasOwnProperty(pname)) {
        ppos = position_fix_dict[pname];
    }
    
    return ppos;
}

function fixPlayerName(pname, ppos, pteam, f_type, p_dict) {
    p_dict = typeof p_dict === "undefined" ? alldata : p_dict;
    
    var ppos_list = ppos;
    if (ppos.constructor !== Array) {
        ppos_list = [ppos];
    }
    for (var pp=0; pp<ppos_list.length; pp++) {
        ppos = ppos_list[pp];
        if (f_type == 'proj') {
            if ((ppos == 'DT') || (ppos == 'DE')) {
                ppos = 'DL';
            }
            else if ((ppos == 'CB') || (ppos == 'S')) {
                ppos = 'DB';
            }
        }
        
        if (p_dict.hasOwnProperty(getPlayerCheckName(pname, ppos, pteam, f_type))) {
            return [pname, ppos];
        }
        else if (player_name_fix.hasOwnProperty(pname)) {
            var new_pname = player_name_fix[pname];
            if (p_dict.hasOwnProperty(getPlayerCheckName(new_pname, ppos, pteam, f_type))) {
                dlog('fixed name: ' + pname + '; is now: ' + new_pname);
                return [new_pname, ppos];
            }
        }
        else {
            var name_list_len, this_name, new_pname_abbrev, new_pname_addon, new_pname_trans, new_pname_add;
            var name_list = [pname];
        
            var name_split = pname.split(' ');
            var first_name = name_split[0];
            var rest_name = name_split.slice(1).join(' ');
            if (first_name === first_name.toUpperCase()) {
                new_pname_abbrev = first_name.split('').join('.') + '. ' + rest_name;
                if (p_dict.hasOwnProperty(getPlayerCheckName(new_pname_abbrev, ppos, pteam, f_type))) {
                    dlog('fixed name: ' + pname + '; is now: ' + new_pname_abbrev);
                    return [new_pname_abbrev, ppos];
                }
                name_list.push(new_pname_abbrev);
            }

            var player_name_addons_rgx = /( V| IV| III| II| Jr\.| Sr\.)$/;
            name_list_len = name_list.length;
            for (var n=0; n<name_list_len; n++) {
                this_name = name_list[n];
                var pname_addon_match = this_name.match(player_name_addons_rgx);
                if (pname_addon_match) {
                    var name_match = pname_addon_match[1];
                    new_pname_addon = this_name.slice(0, this_name.indexOf(name_match));
                    if (p_dict.hasOwnProperty(getPlayerCheckName(new_pname_addon, ppos, pteam, f_type))) {
                        dlog('fixed name: ' + pname + '; is now: ' + new_pname_addon);
                        return [new_pname_addon, ppos];
                    }
                    name_list.push(new_pname_addon);
                }
            }
            
            name_list_len = name_list.length;
            for (var n=0; n<name_list_len; n++) {
                this_name = name_list[n];
                var this_name_split = this_name.split(' ');
                var this_first_name = this_name_split[0];
                var this_rest_name = this_name_split.slice(1).join(' ');

                if (player_name_translations.hasOwnProperty(this_first_name)) {
                    new_pname_trans = player_name_translations[this_first_name] + ' ' + this_rest_name;
                    if (p_dict.hasOwnProperty(getPlayerCheckName(new_pname_trans, ppos, pteam, f_type))) {
                        dlog('fixed name: ' + pname + '; is now: ' + new_pname_trans);
                        return [new_pname_trans, ppos];
                    }
                    name_list.push(new_pname_trans);
                }
            }

            var player_name_addons = [' V', ' IV', ' III', ' II', ' Jr.', ' Sr.'];
            name_list_len = name_list.length;
            for (var n=0; n<name_list_len; n++) {
                this_name = name_list[n];
                
                for (var a=0; a < player_name_addons.length; a++) {
                    new_pname_add = this_name + player_name_addons[a];
                    if (p_dict.hasOwnProperty(getPlayerCheckName(new_pname_add, ppos, pteam, f_type))) {
                        dlog('fixed name: ' + pname + '; is now: ' + new_pname_add);
                        return [new_pname_add, ppos];
                    }
                    name_list.push(new_pname_add); //unncessary, but whatevs
                }
            }
        }
    }
    
    return false;
}

function parseDepth(data) {
    var weekly_depth_data = {};
    var team_name = '';
        
    var depth_rows = jQuery('div.article-content > table > tbody> tr > td.la > table tbody tr', data);
    depth_rows.each(function(i, v) {
        var j_v = jQuery(v);
        var j_vb = j_v.find('b');
        if (i % 2 === 0) {
            team_name = j_vb.text();
            weekly_depth_data[team_name] = {};
        }
        else {
            var depth_poses = j_vb;
            depth_poses.each(function(j, x) {
                var j_x = jQuery(x);
                var depth_pos = j_x.text().replace(':', '');
                if (depth_pos == 'NT') {
                    depth_pos = 'DT';
                }
                else if (depth_pos == 'OLB' || depth_pos == 'ILB' || depth_pos == 'MLB') {
                    depth_pos = 'LB';
                }
                if (!weekly_depth_data[team_name].hasOwnProperty(depth_pos)) {
                    weekly_depth_data[team_name][depth_pos] = {};
                }
                
                var skip_next = false;
                var d_num = 1;
                var depth_players = j_x.nextUntil('br');
                depth_players.each(function(k, y) {
                    if (skip_next) {
                        skip_next = false;
                        return;
                    }
                    skip_next = false;

                    var j_y = jQuery(y);
                    var depth_player_text = j_y.text().trim();
                    var depth_player_name = depth_player_text;
                    var dpt_next = jQuery(depth_players[k+1]).text().trim();
                    if (dpt_next && /^\(/.test(dpt_next)) {
                        skip_next = true;
                        depth_player_text += ' ' + dpt_next;
                    }
                    var depth_player_status = [];
                    if (depth_player_text.indexOf('(') > -1) {
                        var stat_match = depth_player_text.match(/\([\w/]+\)/g);
                        if (stat_match && stat_match.length) {
                            for (var n=0; n<stat_match.length; n++) {
                                depth_player_status.push(stat_match[n].replace(/[()]/g, '').toUpperCase());
                            }
                        }
                        depth_player_name = depth_player_text.slice(0, depth_player_text.indexOf(' ('));
                    }
                    
                    depth_player_name = depth_player_name.replace(/[�′]+/g, "'");
                    if (player_name_fix.hasOwnProperty(depth_player_name)) {
                        depth_player_name = player_name_fix[depth_player_name];
                    }
                    
                    var depth_player_name_cap = depth_player_name.toUpperCase();
                    var depth_player_type = j_y.find('font').addBack('font').attr('color');
                    
                    //todo maybe add into alldata, but need to fix names first
                    if (depth_player_name.length) {
                        if (weekly_depth_data[team_name][depth_pos].hasOwnProperty(depth_player_name_cap)) {
                            return;
                        }
                        weekly_depth_data[team_name][depth_pos][depth_player_name_cap] = {
                            'name': depth_player_name,
                            'num': d_num,
                            'status': depth_player_status,
                            'type': depth_player_type
                        };
                    }
                    
                    d_num += 1;
                });
            });
        }
    });
    
    depth_data[current_season]['W' + current_week] = weekly_depth_data;
    depth_data_current_week = depth_data[current_season]['W' + current_week];
    updated_depth = current_time;
    
    addDepth();
}

function getDepth() {
    jQuery.ajax({
        url: depth_url,
        timeout: ajax_timeout
    }).done(function(data) {
		data = data.replace(/(<(\b(img|style|head|link)\b)(([^>]*\/>)|([^\7]*(<\/\2[^>]*>)))|(<\bimg\b)[^>]*>|(\b(background|style)\b=\s*"[^"]*"))/g,"");
        parseDepth(data);
    }).fail(function() {
        depth_fail = true;
        chrome.runtime.sendMessage({ request: 'fetch_fail', value: depth_url });
        addDepth();
    });
}

function getPlayerData() {
    if (show_proj) {
        getPosProjections();
    }
    else {
        projDone.resolve();
        if (hasProjTotals) {
            addProjTotals();
        }
        else {
            totalsDone.resolve();
        }
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
}

function getAllData(c_type) {
    c_type = typeof c_type === "undefined" ? ['proj', 'rank', 'ros'] : c_type;
    
    if (show_proj || show_rank || show_ros) {
        if (!isDataCurrent(c_type)) {
            alldata = {};
            updated_times = {}; //todo just clear the out of date one
            updated_types = {}; //todo just clear the out of date one
            
            updatePlayerStorage();
            getPlayerData();
        }
        else {
            dlog('Using cache for player data');
            addPlayerData();
        }
    }
    else {
        projDone.resolve();
        if (hasProjTotals) {
            addProjTotals();
        }
        else {
            totalsDone.resolve();
        }

        rankDone.resolve();
        rosDone.resolve();
    }
    
    if (show_avg || show_spark || show_current) {
        updateActivityStorage(); //always, could have a "changed" flag for all the players
        addAvg();
    }
    else {
        activityDone.resolve();
    }
        
    if (show_depth) {
        if (!isDataCurrent('depth')) {
            dlog('resetting depth');
            depth_data[current_season]['W' + current_week] = {};
            depth_data_current_week = depth_data[current_season]['W' + current_week];
            updated_depth = 0;
            
            updateDepthStorage();
            getDepth();
        }
        else {
            dlog('Using cache for depth data');
            addDepth();
        }
    }
    else {
        depthDone.resolve();
    }
}

function calcBonus(bonus_type, pd) {
    var adj = 0;
    
    if (siteType == 'yahoo') {
        var b_list = [];
        var this_settings_dict = league_settings[bonus_type + '_bonus'];
        for (var k in this_settings_dict) {
            if (this_settings_dict.hasOwnProperty(k)) {
                b_list.push(parseFloat(k));
            }
        }
        b_list = b_list.sort().reverse();
        for (var b=0; b < b_list.length; b++) {
            if (parseFloat(b_list[b+1]) && parseFloat(b_list[b])) {
                adj += (this_settings_dict[b_list[b]] * (b_list[b] <= pd[bonus_type + '_yds'] && pd[bonus_type + '_yds'] < b_list[b+1]));
            }
            else {
                if (parseFloat(b_list[b])) {
                    adj += (this_settings_dict[b_list[b]] * (pd[bonus_type + '_yds'] >= b_list[b]));
                }
            }
        }
    }
    else if (siteType == 'fleaflicker') {
        var b_list = league_settings[bonus_type + '_bonus'];
        if (b_list && b_list.length) {
            dlog(pd, 1);
            
            for (var l=0; l < b_list.length; l++) {
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
        }
    }
    
    return adj;
}

function calculateProjections(datatype, player_name, pos_name, team_name) {
    if (datatype == 'depth') {
        return [player_name, pos_name, team_name];
    }
    
    var player_name_data = player_name.toUpperCase();
    
    if ((pos_name === 'DT') || (pos_name === 'DE')) {
        pos_name = 'DL';
    }
    else if ((pos_name === 'CB') || (pos_name === 'S')) {
        pos_name = 'DB';
    }
    
    pos_name = fixPlayerPosition(player_name, pos_name, 'proj');
    
    var player_data;
    
    if (datatype == 'proj-default') {
        //fix
        if (jQuery.isArray(pos_name)) {
            pos_name = pos_name[0];
        }
        
        if ((pos_name === 'DT') || (pos_name === 'DE')) {
            pos_name = 'DL';
        }
        else if ((pos_name === 'CB') || (pos_name === 'S')) {
            pos_name = 'DB';
        }
        
        player_data = expected_player[pos_name];
        if (!isObj(player_data)) {
            player_data = {};
        }
    }
    else {
        var full_name = player_name_data + "|" + pos_name + "|" + team_name;
        player_data = alldata[full_name];

        if (typeof(player_data) === "undefined") {
            var player_fix = fixPlayerName(player_name, pos_name, team_name, 'proj');
            if (player_fix) {
                player_name = player_fix[0];
                pos_name = player_fix[1];
                player_name_data = player_name.toUpperCase();
                full_name = player_name_data + "|" + pos_name + "|" + team_name;
                player_data = alldata[full_name];
            }
            else {
                dlog('Could not find player: ' + full_name);
                if (datatype == 'proj') {
                    return("--");
                }
                else {
                    return ['--', '--'];
                }
            }
        }
    }

    dlog('player data: ', 1);
    dlog(player_data, 1);

    if (datatype == 'proj' || datatype == 'proj-default') {
        //until fantasysharks is https
        if ((document.location.protocol == 'https:') && (idp_positions.indexOf(pos_name) > -1)) {
            return('--');
        }
        
        var player_score = 0;
        
        var settingNames = [
            'pass_yds', 'pass_tds', 'pass_ints', 'pass_att', 'pass_cmp', 'pass_icmp', 'pass_firstdown',
            'rush_yds', 'rush_tds', 'rush_att', 'rush_firstdown',
            'rec_yds', 'rec_att', 'rec_tds', 'rec_firstdown',
            'xpt', 'fg', 'fga', 'fgm',
            'fumbles'
        ];
        var defDict = {
            'sk': 'def_sack',
            'ff': 'def_ff',
            'int': 'def_int',
            'deftd': 'def_td',
            'fr': 'def_fr',
            'pa': 'def_pa',
            'ya': 'def_tyda',
            'sf': 'def_safety'
        };
        var idpDict = {
            'sk': 'Scks',
            'ff': 'FumFrc',
            'tka': 'Tack',
            'tks': 'Asst',
            'pd': 'PassDef',
            'int': 'Int',
            'deftd': 'DefTD',
            'fr': 'Fum',
        };
        
        // this is from 2014-2015 data. does not incorporate players specifically (todo, do that somehow)
        var first_down_pct = {
            'pass': {
                'QB': 0.349
            },
            'rush': {
                'QB': 0.304,
                'RB': 0.205,
                'WR': 0.317
            },
            'rec': {
                'RB': 0.353,
                'WR': 0.627,
                'TE': 0.567
            }
        };
        
        for (var n=0; n < settingNames.length; n++) {
            var sn = settingNames[n];
            dlog(sn, 1);
            if (league_settings.hasOwnProperty(sn)) {
                var setting_score = league_settings[sn];
                dlog(setting_score, 1);
                var p_data = 0;
                
                if (sn == 'pass_icmp') {
                    p_data = Math.max((player_data['pass_att'] || 0) - (player_data['pass_cmp'] || 0), 0);
                }
                else if (sn == 'fgm') {
                    p_data = Math.max((player_data['fga'] || 0) - (player_data['fg'] || 0), 0);
                }
                else if (sn == 'pass_firstdown') {
                    if (first_down_pct['pass'].hasOwnProperty(pos_name)) {
                        p_data = first_down_pct['pass'][pos_name] * player_data['pass_att'];
                    }
                }
                else if (sn == 'rush_firstdown') {
                    if (first_down_pct['rush'].hasOwnProperty(pos_name)) {
                        p_data = first_down_pct['rush'][pos_name] * player_data['rush_att'];
                    }
                }
                else if (sn == 'rec_firstdown') {
                    if (first_down_pct['rec'].hasOwnProperty(pos_name)) {
                        p_data = first_down_pct['rec'][pos_name] * player_data['rec_att'];
                    }
                }
                else {
                    p_data = (player_data[sn] || 0);
                }
                dlog(p_data, 1);
                var p_plus = setting_score * p_data;
                dlog(p_plus, 1);
                player_score += p_plus;
                
                if (siteType == 'fleaflicker') {
                    var p_plus_bonus = calcBonus(sn, p_data);
                    dlog(p_plus_bonus, 1);
                    player_score += p_plus_bonus;
                }
            }
        }
        
        var thisDefDict = {};
        if (pos_name == 'D/ST') {
            thisDefDict = defDict;
        }
        else if (idp_positions.indexOf(pos_name) > -1) {
            thisDefDict = idpDict;
        }
        
        for (var k in thisDefDict) {
            if (thisDefDict.hasOwnProperty(k) && league_settings.hasOwnProperty(k)) {
                //todo fix this to apply on a per position basis
                var k_val = thisDefDict[k];
                dlog(k + ', ' + k_val, 1);
                var settings_k = league_settings[k];
                dlog(settings_k, 1);
                var p_data_val = (player_data[k_val] || 0);
                dlog(p_data_val, 1);
                
                var p_plus_d = settings_k * p_data_val;
                dlog(p_plus_d, 1);
                
                player_score += p_plus_d;
                
                if (siteType == 'fleaflicker') {
                    var p_plus_bonus_d = calcBonus(k, p_data_val);
                    dlog(p_plus_bonus_d, 1);
                    player_score += p_plus_bonus_d;
                }
            }
        }


        var player_adjustment = 0;
        if (league_settings['siteType'] == 'espn') {
            player_adjustment =
                league_settings['pass_300_bonus'] * (300 <= player_data['pass_yds'] && player_data['pass_yds'] < 400) +
                league_settings['pass_400_bonus'] * ((player_data['pass_yds'] || 0) >= 400) +
                league_settings['rush_100_bonus'] * (100 <= player_data['rush_yds'] && player_data['rush_yds'] < 200) +
                league_settings['rush_200_bonus'] * ((player_data['rush_yds'] || 0) >= 200) +
                league_settings['rec_100_bonus'] * (100 <= player_data['rec_yds'] && player_data['rec_yds'] < 200) +
                league_settings['rec_200_bonus'] * ((player_data['rec_yds'] || 0) >= 200) +
                
                league_settings['pa0'] * (player_data['def_pa'] === 0) +
                league_settings['pa1'] * (0 < player_data['def_pa'] && player_data['def_pa'] <= 6) +
                league_settings['pa7'] * (6 < player_data['def_pa'] && player_data['def_pa'] <= 13) +
                league_settings['pa14'] * (13 < player_data['def_pa'] && player_data['def_pa'] <= 17) +
                league_settings['pa18'] * (17 < player_data['def_pa'] && player_data['def_pa'] <= 21) +
                league_settings['pa22'] * (21 < player_data['def_pa'] && player_data['def_pa'] <= 27) +
                league_settings['pa28'] * (27 < player_data['def_pa'] && player_data['def_pa'] <= 34) +
                league_settings['pa35'] * (34 < player_data['def_pa'] && player_data['def_pa'] <= 45) +
                league_settings['pa46'] * (45 < player_data['def_pa']) +
                
                league_settings['ya100'] * (0 <= player_data['def_tyda'] && player_data['def_tyda'] < 100) +
                league_settings['ya199'] * (100 <= player_data['def_tyda'] && player_data['def_tyda'] < 200) +
                league_settings['ya299'] * (200 <= player_data['def_tyda'] && player_data['def_tyda'] < 300) +
                league_settings['ya349'] * (300 <= player_data['def_tyda'] && player_data['def_tyda'] < 350) +
                league_settings['ya399'] * (350 <= player_data['def_tyda'] && player_data['def_tyda'] < 400) +
                league_settings['ya449'] * (400 <= player_data['def_tyda'] && player_data['def_tyda'] < 450) +
                league_settings['ya499'] * (450 <= player_data['def_tyda'] && player_data['def_tyda'] < 500) +
                league_settings['ya549'] * (500 <= player_data['def_tyda'] && player_data['def_tyda'] < 550) +
                league_settings['ya550'] * (550 <= player_data['def_tyda']);
        }
        else if (league_settings['siteType'] == 'yahoo') {
            player_adjustment =
                calcBonus('pass', player_data) +
                calcBonus('rush', player_data) +
                calcBonus('rec', player_data) +
                
                league_settings['pa0'] * (player_data['def_pa'] === 0) +
                league_settings['pa1'] * (0 < player_data['def_pa'] && player_data['def_pa'] <= 6) +
                league_settings['pa7'] * (6 < player_data['def_pa'] && player_data['def_pa'] <= 13) +
                league_settings['pa14'] * (13 < player_data['def_pa'] && player_data['def_pa'] <= 20) +
                league_settings['pa21'] * (20 < player_data['def_pa'] && player_data['def_pa'] <= 27) +
                league_settings['pa28'] * (27 < player_data['def_pa'] && player_data['def_pa'] <= 34) +
                league_settings['pa35'] * (34 < player_data['def_pa']) +
                
                league_settings['ya100'] * (0 <= player_data['def_tyda'] && player_data['def_tyda'] < 100) +
                league_settings['ya199'] * (100 <= player_data['def_tyda'] && player_data['def_tyda'] < 200) +
                league_settings['ya299'] * (200 <= player_data['def_tyda'] && player_data['def_tyda'] < 300) +
                league_settings['ya399'] * (300 <= player_data['def_tyda'] && player_data['def_tyda'] < 400) +
                league_settings['ya499'] * (400 <= player_data['def_tyda'] && player_data['def_tyda'] < 500) +
                league_settings['ya500'] * (500 <= player_data['def_tyda']);
        }
        
            
        player_score += player_adjustment;
        
        dlog('returning score: ', 1);
        dlog(player_name +','+ player_score, 1);
        
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

function getPlayerDataFromCell(player_cell, player_cell_text) {
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
            var player_split = player_cell_text.split(",");
            for (var ps=0; ps<player_split.length; ps++) {
                player_split[ps] = player_split[ps].trim();
            }
            player_name = player_split[0];
            var team_pos = player_split[1].split(/\s|\xa0/);
            team_name = team_pos[0].toUpperCase();
            if (team_name == 'JAX') {
                team_name = 'JAC';
            }
            else if (team_name == 'WSH') {
                team_name = 'WAS';
            }

            pos_name = team_pos[1];
            if (player_split.length > 2) {
                pos_name = [pos_name];
                var new_posses = player_split.slice(2);
                for (var np=0; np<new_posses.length; np++) {
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
        if (pos_name.indexOf(',') > -1) {
            var new_posses = pos_name.split(',');
            pos_name = [];
            new_posses.forEach(function(np) {
                pos_name.push(np.trim());
            });
        }
        else if (pos_name == "DEF") {
            pos_name = "D/ST";
        }
        
        player_name = player_name_cell.find('a').text().trim();
        
        if (pos_name == 'D/ST') {
            player_name = team_name;
            team_name = '-';
        }
    }
    else if (siteType == "fleaflicker") {
        player_name = player_cell.find('div.player-name .player-text').text().trim();
        team_name = player_cell.find('div.player-info span.player-team').text().trim();
        pos_name = player_cell.find('div.player-info span.position').text().trim();
        
        if (pos_name == 'D/ST') {
            var psplit = player_name.split(/\s|\xa0/);
            player_name = psplit[psplit.length - 1];
            team_name = "-";
        }
        else if (pos_name.indexOf('/') > -1) {
            var new_posses = pos_name.split('/');
            pos_name = [];
            new_posses.forEach(function(np) {
                pos_name.push(np.trim());
            });
        }

        player_name = player_name.replace('*', '');
    }
    
    return [player_name, pos_name, team_name];
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
            insertAdjAvg(currRow, null, [], []);
        }
        else {
            var player_id;
            var live_game = false;
            if (siteType == 'espn') {
                //ESPN assigns completely wrong playerIds in the cell for rookies. God damnit ESPN.
                player_id = player_cell.find('a').attr('playerid');
                
                if (show_current) {
                    var game_time_text = currRow.find('.gameStatusDiv').text().trim();
                    if (game_time_text && game_time_text.indexOf('-') > -1) {
                        if (game_time_text[1] !== ' ') {
                            dlog('found live game: ' + game_time_text);
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
            }
            else if (siteType == 'fleaflicker') {
                var player_href = player_cell.find('div.player-name a.player-text').attr('href');
                if (player_href) {
                    player_id = player_href.split('-').pop();
                }
            }
            
            if (!player_id) {
                insertAdjAvg(currRow, null, [], []);
            }
            else {
                if (!goodVal(activity_data_current_season_site, player_id, 'object')) {
                    activity_data_current_season_site[player_id] = {};
                }
                var player_stored_activity = activity_data_current_season_site[player_id];
                
                var new_player_id = player_id;
                if (player_stored_activity.hasOwnProperty('translation')) {
                    new_player_id = player_stored_activity['translation'];
                    dlog('found translation data for: ' + player_id + ', is: ' + new_player_id);
                    
                    delete player_stored_activity['games_played'];
                    delete player_stored_activity['games_played_updated'];
                    delete player_stored_activity[league_id];
                    
                    if (!goodVal(activity_data_current_season_site, new_player_id, 'object')) {
                        dlog('did not find rookie player data from translation');
                        activity_data_current_season_site[new_player_id] = {};
                    }
                    player_stored_activity = activity_data_current_season_site[new_player_id];
                }
                
                if (!goodVal(player_stored_activity, 'games_played', 'array')) {
                    player_stored_activity['games_played'] = [];
                }
                var player_stored_activity_games = player_stored_activity['games_played'];
                
                if (!goodVal(player_stored_activity, 'games_played_updated', 'number')) {
                    player_stored_activity['games_played_updated'] = 0;
                }
                var player_stored_activity_games_updated = player_stored_activity['games_played_updated'];
                
                
                if (!goodVal(player_stored_activity, league_id, 'object')) {
                    player_stored_activity[league_id] = {};
                } 
                var player_stored_activity_league = player_stored_activity[league_id];
                
                
                if (!goodVal(player_stored_activity_league, 'weekly_points', 'array')) {
                    player_stored_activity_league['weekly_points'] = [];
                }
                var player_stored_activity_league_pts = player_stored_activity_league['weekly_points'];
                
                if (!player_stored_activity_league.hasOwnProperty('pts_avg')) {
                    player_stored_activity_league['pts_avg'] = null;
                }
                var player_stored_activity_league_avg = player_stored_activity_league['pts_avg'];
                
                if (!player_stored_activity_league.hasOwnProperty('last_updated')) {
                    player_stored_activity_league['last_updated'] = 0;
                }
                var player_stored_activity_league_updated = player_stored_activity_league['last_updated'];
                
                // Fetch points during gametime constantly for CURR, otherwise daily for stat corrections
                
                if (isActivityDataCurrent(new_player_id, player_stored_activity_league_updated, 'league', live_game) && isActivityDataCurrent(new_player_id, player_stored_activity_games_updated, 'games')) {
                    dlog('Using cache for player activity: ' + new_player_id);
                    insertAdjAvg(currRow, player_stored_activity_league_avg, player_stored_activity_games, player_stored_activity_league_pts);
                }
                else if (siteType == 'espn') {
                    var espn_points_data = {
                        'leagueId': league_id,
                        'playerId': player_id,
                        'playerIdType': 'playerId',
                        'seasonId': current_season_avg,
                        'xhr': '1'
                    };
                    
                    jQuery.ajax({
                        url: '//games.espn.com/ffl/format/playerpop/overview',
                        timeout: ajax_timeout,
                        method: 'get',
                        data: espn_points_data,
                        custom_data: {
                            curr_row: currRow,
                            norm_avg: normavg,
                            id: new_player_id,
                            old_id: player_id
                        }
                    }).fail(function() {
                        var old_pid = this.custom_data.old_id;
                        var currRow = this.custom_data.curr_row;
                        dlog('failed to get player pop: ' + old_pid);
                        insertAdjAvg(currRow, null, [], []);
                    }).done(function(po) {
                        var cust_data = this.custom_data;
                        var pid = cust_data.id;
                        var old_pid = cust_data.old_id;
                        var currRow = cust_data.curr_row;
                        var normavg = cust_data.norm_avg;
                            
                        if (!po) {
                            dlog('No data in pop: ' + old_pid);
                            insertAdjAvg(currRow, null, [], []);
                        }
                        else {
							po = po.replace(/(<(\b(img|style|head|link)\b)(([^>]*\/>)|([^\7]*(<\/\2[^>]*>)))|(<\bimg\b)[^>]*>|(\b(background|style)\b=\s*"[^"]*"))/g,"");
                            var podata = jQuery(po);
                            
                            var p_data = activity_data_current_season_site[pid];
                            var p_data_league = p_data[league_id];
                            
                            var player_card = jQuery('div#tabView0 div#moreStatsView0', podata);
                            
                            var playerlink = player_card.find('div.pc:not(#pcBorder)');
                            var pop_player_href = playerlink.find('a[href*="playerId"], a[href*="proId"]');
                            var pop_player_id = null;
                            if (pop_player_href.length) {
                                pop_player_id = pop_player_href.attr('href').match(/(playerId=|proId\/)(\d+)/)[2];
                            }
                            
                            if (pop_player_id !== null && pop_player_id !== pid) {
                                dlog('found rookie: ' + pop_player_id + ', ' + pid);
                                p_data['translation'] = pop_player_id;
                                pid = pop_player_id;
                                
                                activity_data_current_season_site[pid] = {};
                                p_data = activity_data_current_season_site[pid];
                                
                                p_data['games_played'] = [];
                                p_data['games_played_updated'] = 0;
                                
                                p_data[league_id] = {};
                                p_data_league = p_data[league_id];
                                
                                p_data_league['weekly_points'] = [];
                                p_data_league['pts_avg'] = null;
                                p_data_league['last_updated'] = 0;
                            }
                            
                            var points_table =  player_card.find('div#pcBorder table tbody');
                            var points_table_header = points_table.find('tr.pcStatHead');
                            var byeindex = points_table_header.find('td:contains("OPP")').first().index() + 1;
                            var ptsindex = points_table_header.find('td:contains("PTS")').first().index() + 1;
                            
                            var points_table_rows = points_table.find('tr:not(.pcStatHead)');
                            var points_table_td_bye = points_table_rows.find('td:nth-child(' + byeindex + ')');
                            var points_table_td_pts = points_table_rows.find('td:nth-child(' + ptsindex + ')');

                            var player_bye_cell = points_table_td_bye.filter(function() {
                                return jQuery(this).text().match(/BYE/);
                            });
                            var player_bye_week = null;
                            if (player_bye_cell.length == 1) {
                                player_bye_week = parseFloat(player_bye_cell.prev().text().trim());
                            }
                            
                            var player_activity_pts = jQuery.map(points_table_td_pts, function(ptval) { return ptval.innerText; });
                            
                            for (var i=0; i < player_activity_pts.length; i++) {
                                var is_bye_week = jQuery.isNumeric(player_bye_week) && i === (player_bye_week - 1);
                                if (is_bye_week) {
                                    p_data['games_played'][i] = 'BYE';
                                }
                                else if (typeof p_data['games_played'][i] === "undefined") {
                                    p_data['games_played'][i] = null;
                                }
                                else if (p_data['games_played'][i] === 'BYE') {
                                    p_data['games_played'][i] = null;
                                }
                                
                                if (player_activity_pts[i] == '-') {
                                    player_activity_pts[i] = null;
                                }
                                else {
                                    player_activity_pts[i] = parseFloat(player_activity_pts[i]);
                                }
                            }
                            
                            dlog(player_activity_pts);
                            
                            p_data_league['last_updated'] = current_time;
                            p_data_league['weekly_points'] = player_activity_pts;

                            if (player_cell_text.match(/(D\/ST|TQB|HC)$/)) {
                                dlog('inserting avg for dsts, etc. for: ' + pid);
                                p_data['games_played_updated'] = current_time;
                                insertAdjAvg(currRow, normavg, p_data['games_played'], p_data_league['weekly_points']);
                            }
                            // Only fetch on tuesday
                            else if (isActivityDataCurrent(pid, p_data['games_played_updated'], 'games')) {
                                dlog('using cache for games played for: ' + pid);
                                calcAdjAvg(currRow, pid, p_data['games_played'], p_data_league['weekly_points']);
                            }
                            else {
                                var espn_player_link = "//m.espn.com/nfl/playergamelog";
                                var espn_data = {
                                    playerId: pid,
                                    season: current_season_avg_week,
                                    xhr: 1
                                };
                                
                                jQuery.ajax({
                                    url: espn_player_link,
                                    timeout: ajax_timeout,
                                    data: espn_data,
                                    method: 'get',
                                    custom_data: {
                                        curr_row: currRow,
                                        id: pid
                                    }
                                }).fail(function() {
                                    var cust_data = this.custom_data;
                                    var pid = cust_data.id;
                                    var currRow = cust_data.curr_row;
                                    
                                    var p_data_league_pts = activity_data_current_season_site[pid][league_id]['weekly_points'];
                                    
                                    dlog('failed to get player card: ' + pid);
                                    insertAdjAvg(currRow, null, [], p_data_league_pts);
                                }).done(function(p) {
                                    var cust_data = this.custom_data;
                                    var pid = cust_data.id;
                                    var currRow = cust_data.curr_row;
                                    
                                    var p_data = activity_data_current_season_site[pid];
                                    var p_data_league = p_data[league_id];
                        
                                    if (!p) {
                                        dlog('No data in player card: ' + pid);
                                        insertAdjAvg(currRow, null, [], p_data_league['weekly_points']);
                                    }
                                    else {
										p = p.replace(/(<(\b(img|style|head|link)\b)(([^>]*\/>)|([^\7]*(<\/\2[^>]*>)))|(<\bimg\b)[^>]*>|(\b(background|style)\b=\s*"[^"]*"))/g,"");
                                        var adata = jQuery(p);
                                        
                                        var postseason_row = jQuery('tr td:contains("POSTSEASON")', adata).parents('tr');
                                        var week_rows = jQuery('tr td:contains("REGULAR SEASON")', adata).parents('tr').nextUntil(postseason_row);
                                        week_rows.each(function(i, v) {
                                            var week_row = jQuery(v);
                                            
                                            var week_row_text = week_row.text();
                                            if (week_row_text.indexOf('DID NOT PLAY') > -1) {
                                                p_data['games_played'][i] = 0;
                                            }
                                            else if (week_row_text.indexOf('BYE') == -1) {
                                                p_data['games_played'][i] = 1;
                                            }
                                        });
                                        
                                        for (var g=0; g<p_data['games_played'].length; g++) {
                                            if (p_data['games_played'][g] === null && g < (current_week_avg - 1)) {
                                                p_data['games_played'][g] = 0;
                                            }
                                            if (p_data['games_played'][g] !== 1) {
                                                p_data_league['weekly_points'][g] = null;
                                            }
                                        }
                                        
                                        dlog(p_data['games_played']);
                                        p_data['games_played_updated'] = current_time;
                                        
                                        calcAdjAvg(currRow, pid, p_data['games_played'], p_data_league['weekly_points']);
                                    }
                                });
                            }
                        }
                    });
                }
                else if (siteType == 'fleaflicker') {
                    jQuery.ajax({
                        url: player_href,
                        method: 'get',
                        timeout: ajax_timeout,
                        custom_data: {
                            curr_row: currRow,
                            p_href: player_href,
                            pid: player_id
                        }
                    }).fail(function() {
                        var cust_data = this.custom_data;
                        var player_href = cust_data.p_href;
                        var currRow = cust_data.curr_row;
                        
                        dlog('Could not get player info: ' + player_href);
                        insertAdjAvg(currRow, null, [], []);
                    }).done(function(po) {
                        var cust_data = this.custom_data;
                        var player_href = cust_data.p_href;
                        var currRow = cust_data.curr_row;
                        var pid = cust_data.pid;
                        
                        if (!po) {
                            dlog('No data in player info: ' + player_href);
                            insertAdjAvg(currRow, null, [], []);
                        }
                        else {
							po = po.replace(/(<(\b(img|style|head|link)\b)(([^>]*\/>)|([^\7]*(<\/\2[^>]*>)))|(<\bimg\b)[^>]*>|(\b(background|style)\b=\s*"[^"]*"))/g,"");
                            var podata = jQuery(po);
                            
                            var p_data = activity_data_current_season_site[pid];
                            var p_data_league = p_data[league_id];
                            
                            var points_table = jQuery('table#table_0', podata);
                            var points_table_rows = points_table.find('tbody').find(player_table_row_selector).not('.divider');
                            
                            var player_bye_cell = points_table_rows.find('div.pro-opp-matchup').filter(function() {
                                return jQuery(this).text().trim() === 'BYE';
                            });
                            var player_bye_week = player_bye_cell.parents('tr').index();
                            
                            var player_activity_pts = jQuery.map(points_table_rows, function(ptval) { return jQuery(ptval).find('td:last').text(); });
                            
                            for (var i=0; i < player_activity_pts.length; i++) {
                                if (i === player_bye_week) {
                                    player_activity_pts[i] = null;
                                    p_data['games_played'][i] = 'BYE';
                                }
                                else if (player_activity_pts[i] == "—") {
                                    player_activity_pts[i] = null;
                                    p_data['games_played'][i] = 0;
                                }
                                else if (player_activity_pts[i] == "") {
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

                            insertAdjAvg(currRow, null, p_data['games_played'], p_data_league['weekly_points']);
                        }
                    });
                }
            }
        }
    }
    
    else {
        if (!player_cell_text || player_cell_text == "(Empty)") {
            if (siteType == "fleaflicker" && onMatchupPreviewPage) {
                total_player_ids--;
                if (total_player_ids <= 0) {
                    fetchFleaflickerIds.resolve();
                }
                return popCell(cell, '', datatype);
            }
            else {
                if (datatype == 'rank' || datatype == 'ros') {
                    return popCell(cell, ['--', '--'], datatype);
                }
                else {
                    return popCell(cell, '--', datatype);
                }
            }
        }
        else if (player_cell_text.match(/(TQB|HC|P)$/)) { // can't project head coaches or TQB's
            if (datatype == 'rank' || datatype == 'ros') {
                return popCell(cell, ['--', '--'], datatype);
            }
            else {
                return popCell(cell, '--', datatype);
            }
        }
        
        var player_cell_data = getPlayerDataFromCell(player_cell, player_cell_text);
        var player_name = player_cell_data[0];
        var pos_name = player_cell_data[1];
        var team_name = player_cell_data[2];
        
        if (siteType == "espn") {
            var calcVal = calculateProjections(datatype, player_name, pos_name, team_name);
            return popCell(cell, calcVal, datatype);
        }
        else if (siteType == "yahoo") {
            if (onMatchupPreviewPage || onFreeAgencyPage) {
                var player_href = player_cell.find('.ysf-player-name').find('a').attr('href');
                var player_id = player_href.split('/').pop();
                var seenId = storage_translation_data.hasOwnProperty('ID_' + player_id);
                dlog('id is ' + player_id + ', seen is ' + seenId, 1);
                
                var hasAllData = alldata.hasOwnProperty(player_name.toUpperCase() + '|' + pos_name + '|' + team_name);
                
                if (pos_name == "D/ST" || seenId || hasAllData) {
                    if (seenId) {
                        player_name = storage_translation_data['ID_' + player_id];
                    }
                    
                    var calcVal = calculateProjections(datatype, player_name, pos_name, team_name);
                    return popCell(cell, calcVal, datatype);
                }
                else {
                    dlog('Could not find player in yahoo database: ' + player_href + ', ' + player_name);
                }
            }
            else {
                var calcVal = calculateProjections(datatype, player_name, pos_name, team_name);
                return popCell(cell, calcVal, datatype);
            }
        }
        else if (siteType == "fleaflicker") {
            if (datatype == 'depth') {
                if (pos_name.constructor === Array) {
                    var new_pos_list = [];
                    pos_name.forEach(function(pn) {
                        if (pn == 'DL') {
                           new_pos_list.push('DE', 'DT');
                        }
                        else if (pn == 'DB') {
                           new_pos_list.push('CB', 'S');
                        }
                        else {
                            new_pos_list.push(pn);
                        }
                    });
                    pos_name = new_pos_list;
                }
                else {
                    if (pos_name == 'DL') {
                       pos_name = ['DE', 'DT'];
                    }
                    else if (pos_name == 'DB') {
                       pos_name = ['CB', 'S'];
                    }
                }
            }

            if (onMatchupPreviewPage) {
                var player_href = player_cell.find('div.player-name a.player-text').attr('href');
                var player_last = player_href.split('/').pop();
                var player_name_split = player_last.split('-');
                var player_id = player_name_split.pop();
                
                var player_split_cap = [];
                for (var i=0; i<player_name_split.length; i++) {
                    player_split_cap.push(player_name_split[i].toUpperCase());
                }
                var player_href_name = player_split_cap.join(' ');

                var seenId = storage_translation_data.hasOwnProperty('ID_' + player_id);
                var hasAllData = alldata.hasOwnProperty(player_href_name + '|' + pos_name + '|' + team_name);
                
                if (pos_name == "D/ST" || seenId || hasAllData) {
                    if (hasAllData) {
                        player_name = player_href_name;
                    }
                    else if (seenId) {
                        player_name = storage_translation_data['ID_' + player_id];
                    }
                    
                    total_player_ids--;
                    if (total_player_ids <= 0) {
                        fetchFleaflickerIds.resolve();
                    }
                    
                    var calcVal = calculateProjections(datatype, player_name, pos_name, team_name);
                    return popCell(cell, calcVal, datatype);
                }
                else {
                    jQuery.ajax({
                        url: player_href,
                        timeout: ajax_timeout
                    }).done(function(pl) {
						pl = pl.replace(/(<(\b(img|style|head|link)\b)(([^>]*\/>)|([^\7]*(<\/\2[^>]*>)))|(<\bimg\b)[^>]*>|(\b(background|style)\b=\s*"[^"]*"))/g,"");
                        var pldata = jQuery(pl);
                        var n = pldata.find('#left-container > div.panel > div.panel-heading').text();
                        
                        var calcVal = calculateProjections(datatype, n, pos_name, team_name);
                        popCell(cell, calcVal, datatype);
                        
                        var new_id_data = {};
                        storage_translation_data['ID_' + player_id] = n;
                        new_id_data[storageTranslationKey] = storage_translation_data;
                        chrome.storage.local.set(new_id_data);
                    }).fail(function() {
                        popCell(cell, '--', datatype);
                        chrome.runtime.sendMessage({ request: 'fetch_fail', value: player_href });
                    }).always(function() {
                        total_player_ids--;
                        if (total_player_ids <= 0) {
                            fetchFleaflickerIds.resolve();
                        }
                    });
                }
            }
            else {
                var calcVal = calculateProjections(datatype, player_name, pos_name, team_name);
                return popCell(cell, calcVal, datatype);
            }
        }
        else {
            return;
        }
    }
}

function calcAdjAvg(thisrow, player_id, games_played, weekly_points) {
    var playertotpts = 0;
    var totalplayergames = 0;
    var player_adjavg_rnd = null;
    
    var past_weekly_points_data = weekly_points.slice(0, current_week_avg - 1);
    
    for (var g=0; g < past_weekly_points_data.length; g++) {
        if (games_played[g] === 1) {
            var weekpt = parseFloat(past_weekly_points_data[g]) || 0;
            playertotpts += weekpt;
            totalplayergames++;
        }
    }
    
    if (totalplayergames > 0) {
        var player_adjavg = (parseFloat(playertotpts) / parseFloat(totalplayergames));
        player_adjavg_rnd = (Math.round(player_adjavg * 10) / 10).toFixed(1);
    }
    
    activity_data_current_season_site[player_id][league_id]['pts_avg'] = player_adjavg_rnd;
    
    insertAdjAvg(thisrow, player_adjavg_rnd, games_played, weekly_points);
}

function insertAdjAvg(thisrow, p_avg, games_played, weekly_points) {
    if (show_avg) {
        var thiscell = thisrow.find('.FantasyPlusAvgData');
        if (!jQuery.isNumeric(p_avg)) {
            thiscell.text('--');
        }
        else if (p_avg > parseFloat(thiscell.prev().text())) {
            thiscell.html('<span style="color:green">' + p_avg + '</span>');
        }
        else {
            thiscell.text(p_avg);
        }
    }
	
    if (show_current) {
        var thisCurrent = thisrow.find('.FantasyPlusCurrentData');
        var curr_score = "--";
        if (weekly_points && weekly_points.length > 0) {
            if (current_season == current_season_avg_week && jQuery.isNumeric(weekly_points[current_week - 1])) {
                curr_score = weekly_points[current_week - 1];
            }
            
            //TODO: add a green or red if above/below projection when game is done, or pct based
            if (parseFloat(curr_score) || curr_score === 0) {
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
        if (weekly_points && weekly_points.length > 0) {
            var player_cell = thisrow.find(player_name_selector);
            var player_cell_text = player_cell.text().trim();
            
            var player_cell_data = [];
            if (player_cell_text.match(/TQB$/)) {
                player_cell_data = ['-', 'QB', '-'];
            }
            else if (player_cell_text.match(/HC$/)) {
                player_cell_data = ['-', 'HC', '-'];
            }
            else if (player_cell_text.match(/P$/)) {
                player_cell_data = ['-', 'P', '-'];
            }
            else {
                player_cell_data = getPlayerDataFromCell(player_cell, player_cell_text);
            }
            
            var player_name = player_cell_data[0];
            var pos_name = player_cell_data[1];
            var team_name = player_cell_data[2];
            
            var expected_projection = calculateProjections('proj-default', player_name, pos_name, team_name);
            dlog('we expect for pos: ' + pos_name + ', to get: ' + expected_projection);
            if (jQuery.isNumeric(expected_projection)) {
                expected_projection = Number(expected_projection);
            }
            
            var pts_high = expected_projection * (4/3);
            var pts_low = expected_projection * (2/3);
            
            var pts_high_str = String(pts_high) + ':';
            var pts_med_str = String(pts_low) + ':' + String(pts_high);
            var pts_low_str = ':' + String(pts_low);
            
            var spotPts = {'null': '#999'};
            if (expected_projection === 0) {
                spotPts[pts_high_str] = '#5C5D5E';
                spotPts[pts_med_str] = '#5C5D5E';
                spotPts[pts_low_str] = '#5C5D5E';
            }
            else {
                spotPts[pts_high_str] = '#336600';
                spotPts[pts_med_str] = '#FF6600';
                spotPts[pts_low_str] = '#CC0000';
            }
            
            var week_modifier = Math.max(0, Math.min(17, current_week_avg) - 6);
            var weekly_points_data_cut = weekly_points.slice(week_modifier, Math.min(Math.max(0, current_week_avg - 1), 17));
            
            if (weekly_points_data_cut && weekly_points_data_cut.length > 1) {
                var spark_options = {
                    disableHiddenCheck: true,
                    width: '35px',
                    height: '20px',
                    chartRangeMin: 0,
                    tooltipSkipNull: false,
                    tooltipFormatter: function(a,b,c) {
                        var wk = c.x;
                        var sc = c.y;
                        var sc_type = games_played[wk + week_modifier];
                        var v_rnd;
                        if (sc_type === 'BYE') {
                            v_rnd = 'Bye';
                        }
                        else if (sc_type === 0) {
                            v_rnd = 'Out';
                        }
                        else {
                            v_rnd = Math.round(sc * 10) / 10;
                        }
                        return 'W' + (wk + week_modifier + 1) + ': ' + v_rnd;
                    },                    
                    type: 'line',
                    fillColor: false,
                    lineColor: 'gray',
                    valueSpots: spotPts,
                    minSpotColor: false,
                    maxSpotColor: false,
                    spotColor: false,
                    spotRadius: 2
                };
                
                if (siteType == 'fleaflicker') {
                    spark_options['height'] = '25px';
                    spark_options['width'] = '40px';
                    spark_options['tooltipClassname'] = 'fp-jqstooltip';
                }
                
                thisSpark.sparkline(weekly_points_data_cut, spark_options);
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
    if (total_players === 0) {
        dlog('avg done');
        activityDone.resolve();
    }
}

function reDefer() {
    if ((header_index > -1) || ((siteType == 'fleaflicker') && hasProjectionTable)) {
        projDone = jQuery.Deferred();
        rankDone = jQuery.Deferred();
        rosDone = jQuery.Deferred();
        activityDone = jQuery.Deferred();
        depthDone = jQuery.Deferred();
        totalsDone = jQuery.Deferred();
        
        if (siteType == 'yahoo' && (onMatchupPreviewPage || onFreeAgencyPage)) {
            yahooIdsDone = jQuery.Deferred();
        }
        else if (siteType == 'fleaflicker' && onMatchupPreviewPage) {
            fetchFleaflickerIds = jQuery.Deferred();
        }
    }
}

function addPlayerData() {
    if (header_index > -1 || ((siteType == 'fleaflicker') && hasProjectionTable)) {
        if (show_proj) {
            addProjections();
        }
        else {
            projDone.resolve();
            if (hasProjTotals) {
                addProjTotals();
            }
            else {
                totalsDone.resolve();
            }
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
    }
    else {
        dlog('no header');
		projDone.resolve();
		rankDone.resolve();
		rosDone.resolve();
        totalsDone.resolve();
    }
}

function addAllData() {
    if (header_index > -1 || ((siteType == 'fleaflicker') && hasProjectionTable)) {
        addPlayerData();
        
        if (show_avg || show_spark || show_current) {
            addAvg();
        }
        else {
            activityDone.resolve();
        }
        
        if (show_depth) {
            addDepth();
        }
        else {
            depthDone.resolve();
        }
    }
	else {
        dlog('no header');
		projDone.resolve();
		rankDone.resolve();
		rosDone.resolve();
        activityDone.resolve();
		depthDone.resolve();
		totalsDone.resolve();
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

function popCell(c, v, dtype) {
    if (dtype == 'depth') {
        return insertDepth(c, v);
    }
    else if (dtype == 'rank' || dtype == 'ros') {
        var rnk = v[0];
        var std = v[1];
        
        c.text(rnk);
        
        if (siteType == "espn" || siteType == "fleaflicker") {
            if (rnk == "--") {
                c.next().text(std); //change this in the future for "is stdev enabled column"
            }
            else {
                c.next().html('<span style="font-size: 80%;">±</span>' + std);
            }
        }
        
        return;
    }
    else {
        return c.text(v);
    }
}

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
        
        if (siteType == 'fleaflicker') { //todo wont work if disabled
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
            
            if (isByeWeek) {
                popCell(cell, '--');
            }
            else {
                getProjectionData(datatype, currRow, cell);
            }
		});
        
        dlog('proj done');
        projDone.resolve();
        
        if (hasProjTotals) {
            addProjTotals();
        }
        else {
            dlog('totals done');
            totalsDone.resolve();
        }
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
        
        dlog('proj done');
        projDone.resolve();
        
        dlog('totals done');
        totalsDone.resolve();
	}
}

function addProjTotals() {
    if (siteType == 'espn') {
        if (!(show_proj || show_current)) {
            dlog('totals done');
            totalsDone.resolve();
        }
        else {
            if (onClubhousePage) {
                var totalsProjDone = jQuery.Deferred();
                var totalsCurrDone = jQuery.Deferred();
                jQuery.when(totalsProjDone, totalsCurrDone).done(function() {
                    dlog('totals done');
                    totalsDone.resolve();
                });
                
                var addESPNTotals = function(typ) {
                    var isProj = typ == 'proj';
                    var isCurr = typ == 'curr';
                    if (!(isProj || isCurr)) {
                        return;
                    }
                    
                    var header_rows = player_table_header;
                    var starter_row = header_rows.filter(function() { 
                        return jQuery(this).prev().find('th.playertableSectionHeaderFirst').text() == 'STARTERS';
                    });
                    
                    var cell_class;
                    if (isProj) {
                        cell_class = '.FantasyPlusProjections';
                        var sumTotal, sumTotalESPN;
                        sumTotal = sumTotalESPN = 0;
                    }
                    else if (isCurr) {
                        cell_class = '.FantasyPlusCurrent';
                        var sumTotalCurr = 0;
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
                if (!show_proj) {
                    dlog('totals done');
                    totalsDone.resolve();
                }
                else {
                    var matchup_tables = jQuery('.playerTableTable');
                    
                    matchup_tables.each(function() {
                        var currTable = jQuery(this);
                        var datapoints = currTable.find('.FantasyPlusProjectionsData');
                        
                        if (datapoints.length > 0) {
                            var matchup_total = 0;
                            datapoints.each(function() {
                                var value = parseFloat(jQuery(this).text());
                                if (value) {
                                    matchup_total = matchup_total + value;
                                }
                            });
                            
                            var matchup_total_rnd = Math.round(parseFloat(matchup_total));
                            currTable.next().prepend('<div title="Total projected points (via FantasyPlus)" class="danglerBox totalScore">' + matchup_total_rnd + '</div>');
                        }
                    });
                    
                    dlog('totals done');
                    totalsDone.resolve();
                }
            }
        }
    }
    else if (siteType == 'yahoo') {
        if (!show_proj) {
            dlog('totals done');
            totalsDone.resolve();
        }
        else {
            var matchup_total = 0;
            
            if (onClubhousePage) {
                var datapoints = player_table_body.find('tr:not(".bench") .FantasyPlusProjectionsData');
                
                if (datapoints.length > 0) {
                    datapoints.each(function() {
                        var value = parseFloat(jQuery(this).text());
                        if (value) {
                            matchup_total += value;
                        }
                    });
                    
                    var roundTotal = Math.round(parseFloat(matchup_total) * 100) / 100;
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
                
                dlog('totals done');
                totalsDone.resolve();
            }
            else if (onMatchupPreviewPage) {
                jQuery.when(yahooIdsDone).done(function() {
                    var new_pts_total = pts_total.parent().clone();
                    new_pts_total.addClass('FantasyPlus');
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
                                    matchup_total += value;
                                }
                            });
                            
                            var roundTotal = Math.round(parseFloat(matchup_total) * 100) / 100;
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
                    
                    dlog('totals done');
                    totalsDone.resolve();
                });
            }
        }
    }
    else if (siteType == 'fleaflicker') {
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
                    var proj_cell = this_row.find('td').eq(proj_tot_cell_idx);
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
                var sumTotal_rnd = Math.round(parseFloat(sumTotal) * 10) / 10;
                proj_tot_cell.html(sumTotal_rnd);
            }
            
            var sumTotalFlea_rnd = Math.round(parseFloat(sumTotalFlea) * 10) / 10;
            flea_tot_cell.html(sumTotalFlea_rnd);
            
            var sumTotalActual_rnd = Math.round(parseFloat(sumTotalActual) * 10) / 10;
            act_tot_cell.html(sumTotalActual_rnd);
            
            dlog('totals done');
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
                        var matchup_total_rnd = Math.round(parseFloat(matchup_total) * 10) / 10;
                        proj_tot_cell.html(matchup_total_rnd);
                    }
                    
                    var matchup_flea_total_rnd = Math.round(parseFloat(matchup_flea_total) * 10) / 10;
                    flea_tot_cell.html(matchup_flea_total_rnd);
                    
                    if (show_proj) {
                        var this_scoreboard_cell = scoreboard_table.find('.FantasyPlusProjectionsTotal').eq(t);
                        if (this_scoreboard_cell.length) {
                            var matchup_total_scor_rnd = Math.round(parseFloat(matchup_total) * 100) / 100;
                            this_scoreboard_cell.html(matchup_total_scor_rnd);
                        }
                    }
                });
                
                dlog('totals done');
                totalsDone.resolve();
            });
        }
    }
    else {
        dlog('totals done');
        totalsDone.resolve();
    }
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
    
    player_table_body.find('.FantasyPlusRankingsData').each(function() {
        var cell = jQuery(this);
        
        if (isCurrWeek) {
			var currRow = cell.parent();

			var byeweek_text = currRow.find('td:contains("** BYE **")'); //todo could add for yahoo and flea
			var isByeWeek = (byeweek_text.length > 0);
            
            var projectedRanking = "--";
            if (isByeWeek) {
                dlog('bye week');
                cell.text(projectedRanking);
                if (siteType == 'espn') {
                    cell.next().text(projectedRanking); //todo change this in the future for "is stdev enabled column"
                }
            }
            else {
                getProjectionData(datatype, currRow, cell);
            }
        }
        else {
            var ctext = '-';
            if (siteType == 'fleaflicker') { //todo maybe fix to show columns anyway, or at least ros
                ctext = '—';
            }
            cell.text(ctext);
        }
    });

    dlog('rank done');
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
    
    player_table_body.find('.FantasyPlusRosData').each(function() {
        var cell = jQuery(this);
        
        if (isCurrWeek) {
            var currRow = cell.parent();
            
            getProjectionData(datatype, currRow, cell);
        }
        else {
            var ctext = '-';
            if (siteType == 'fleaflicker') {
                ctext = '—';
            }
            cell.text(ctext);
        }
    });

    dlog('ros done');
    rosDone.resolve();
}

function addAvg() {
    var datatype = 'adjavg';
    
    total_players = player_table_rows.length;
    player_table_rows.each(function() {
        var currRow = jQuery(this);
        
        getProjectionData(datatype, currRow, '');
    });
	
	resetLeagueYear();
}

function addDepth() {
    var datatype = 'depth';
    
    if (!isObj(depth_data_current_week)) {
        dlog('Current week depth not set');
        depth_fail = true;
        //TODO revert back to older weeks
        //depth_data[current_season]['W' + (current_week - 1)]
        depth_data_current_week = {};
    }

    var all_depth_cells = player_table_body.find('.FantasyPlusDepthData');
    total_players_depth = all_depth_cells.length;
    
    all_depth_cells.each(function() {
        var cell = jQuery(this);
        var currRow = cell.parent();
        
        getProjectionData(datatype, currRow, cell);
    });
	
	resetLeagueYear();
}

function insertDepth(cell, depthData) {
    if (depthData.constructor !== Array || depthData.length < 3) {
        cell.text('--');
    }
    else {
        var plname = depthData[0];
        var posname = depthData[1];
        var teamname = depthData[2];

        var plname_cap = plname.toUpperCase();
        posname = fixPlayerPosition(plname, posname, 'depth');
        
        var p_depth = '--';
        
        if (posname == 'D/ST') {
            cell.text('--');
        }
        else if (teamname == 'FA') {
            cell.text('--');
        }
        else {
            teamname = Object.keys(team_abbrevs).filter(function(key) { return team_abbrevs[key] === teamname; })[0];
            
            var team_data = {};
            if (depth_data_current_week.hasOwnProperty(teamname)) {
                team_data = depth_data_current_week[teamname];
            }
            
            var team_pos_data = {};
            if (posname.constructor === Array) {
                for (var p=0; p < posname.length; p++) {
                    var pn = posname[p];
                    var new_pos_data = {};
                    if (team_data.hasOwnProperty(pn)) {
                        new_pos_data = team_data[pn];
                    
                        if (new_pos_data.hasOwnProperty(plname_cap)) {
                            team_pos_data = new_pos_data;
                            posname = pn;
                            var pdata = team_pos_data[plname_cap];
                            p_depth = posname + pdata['num'];
                            break;
                        }
                        else {
                            var new_fix = fixPlayerName(plname, pn, teamname, 'depth', new_pos_data);
                            if (new_fix) {
                                plname = new_fix[0];
                                posname = new_fix[1];
                                plname_cap = plname.toUpperCase();
                                team_pos_data = new_pos_data;
                                var pdata = team_pos_data[plname_cap];
                                pdata['true_name'] = plname;
                                p_depth = posname + pdata['num'];
                                break;
                            }
                            //could put a position fix here, applying to someone who is a DEF but should not be (from flea)
                        }
                    }
                }
            }
            else {
                if (team_data.hasOwnProperty(posname)) {
                    team_pos_data = team_data[posname];
                    if (team_pos_data.hasOwnProperty(plname_cap)) {
                        var pdata = team_pos_data[plname_cap];
                        p_depth = posname + pdata['num'];                    
                    }
                    else {
                        var new_fix = fixPlayerName(plname, posname, teamname, 'depth', team_pos_data);
                        if (new_fix) {
                            plname = new_fix[0];
                            posname = new_fix[1];
                            plname_cap = plname.toUpperCase();
                            var pdata = team_pos_data[plname_cap];
                            pdata['true_name'] = plname;
                            p_depth = posname + pdata['num'];                    
                        }
                        else if (posname == 'RB') {
                            //todo make above a function
                            var newposname = 'FB';
                            var new_team_pos_data = {};
                            if (team_data.hasOwnProperty(newposname)) {
                                new_team_pos_data = team_data[newposname];
                                if (new_team_pos_data.hasOwnProperty(plname_cap)) {
                                    posname = newposname;
                                    team_pos_data = new_team_pos_data;
                                    var pdata = team_pos_data[plname_cap];
                                    p_depth = posname + pdata['num'];                    
                                }
                                else {
                                    var new_fix = fixPlayerName(plname, newposname, teamname, 'depth', new_team_pos_data);
                                    if (new_fix) {
                                        plname = new_fix[0];
                                        posname = new_fix[1];
                                        plname_cap = plname.toUpperCase();
                                        team_pos_data = new_team_pos_data;
                                        var pdata = team_pos_data[plname_cap];
                                        pdata['true_name'] = plname;
                                        p_depth = posname + pdata['num'];                    
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (p_depth == '--') { dlog('Could not get depth for player: ' + depthData[0]); }
            cell.text(p_depth);

            var players_sorted = Object.keys(team_pos_data).sort(function(a,b){ return team_pos_data[a].num - team_pos_data[b].num; });
            
            if (players_sorted.length) {
                var p_trs = '';
                for (var p=0; p < players_sorted.length; p++) {
                    var pname = players_sorted[p];
                    var pd = team_pos_data[pname];
                    var ptype = depth_type_map[pd['type']];
                    var pnum = pd['num']; 
                    var p_status_arr = pd['status'];
                    var p_status = p_status_arr.join('|');
                    var pname_print = pd['name'];
                    var pname_check = pname_print;
                    if (pd.hasOwnProperty('true_name')) {
                        pname_check = pd['true_name'];
                    }
                    
                    var trstring = '<tr>';
                    if (pname_check.toUpperCase() == plname.toUpperCase()) {
                        trstring = '<tr style="background-color: lightblue">';
                    }
                    var pstring = trstring + '<td style="width: 40px;">' + posname + pnum + ':' + '</td><td style="width: 140px;">' + pname_print + '</td><td style="width: 90px;">' + ptype + '</td><td style="width: 80px;">' + p_status + '</td></tr>';
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
            else { dlog('No team data for pos: ' + posname); dlog(team_data); }
        }
    }
    
    total_players_depth--;
    if (total_players_depth === 0) {
        dlog('depth done');
        depthDone.resolve();
        //todo add into alldata
    }
}

function refreshData(fetch) {
    dlog('rerunning');
    
    observer_disconned = true;
    if (observer) {
        observer.disconnect();
    }

    jQuery('.FantasyPlus').remove();
    setSelectors(false);
    reDefer();
    addColumns();
    
    if (fetch === true) {
        updated_times = {};
        updated_types = {};
        updated_depth = 0;
        
        activity_data[current_season][siteType] = {};
        activity_data_current_season_site = activity_data[current_season][siteType];
        
        if ((siteType == 'yahoo' && (onMatchupPreviewPage || onFreeAgencyPage)) || (siteType == 'fleaflicker' && onMatchupPreviewPage)) {
            storage_translation_data = {};
            if (siteType == 'yahoo') {
                updated_translation = 0;
                getYahooIds();
            }
        }

        dlog('Refreshing data, Current Time: ' + current_time);
        jQuery.get(league_settings_url, function(d) {
			d = d.replace(/(<(\b(img|style|head|link)\b)(([^>]*\/>)|([^\7]*(<\/\2[^>]*>)))|(<\bimg\b)[^>]*>|(\b(background|style)\b=\s*"[^"]*"))/g,"");
            var setSettings = parseLeagueSettings(d, siteType);
            var setLeagueData = {};
            setLeagueData[storageLeagueKey] = setSettings;
            setLeagueData[storageLeagueUpdateKey] = updated_league;
            chrome.storage.local.set(setLeagueData, function() {
                doLeagueThings();
            });
        });
    }
    else {
        addAllData();
    }
}

function watchForChanges() {
    if (hasPlayerTable) {
        dlog('init watch');
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
        activityDone.resolve();      
        */
        var target_selector = base_table_selector;
        if (siteType == 'fleaflicker') {
            target_selector = 'div#body';
            if (onFreeAgencyPage) {
                observerConfig['characterData'] = false;
                observerConfig['subtree'] = false;
            }
        }
        var target_observe = document.querySelector(target_selector);
        observer = new MutationObserver(function (mutations) {
            var acceptedChange = true;
            observer_disconned = false;
            if (mutations.length > 0) {
                //todo fix when grabbing player ids
				if (siteType == 'yahoo') {
                    var m = mutations[0];
					var thisMutTgt = m['target'];
					if (thisMutTgt) {
						var thisMutTgtId = thisMutTgt['id'];
						var thisMutTgtClass = thisMutTgt['className'];
						if (thisMutTgtId == 'selectlist_nav' || thisMutTgtClass == 'flyout-title') {
							acceptedChange = false;
						}
					}
				}
                else if (siteType == 'fleaflicker') {
                    acceptedChange = false;
                    if (onMatchupPreviewPage) {
                        acceptedChange = true;
                    }
                    else {
                        for (var m=0; m < mutations.length; m++) {
                            var md = mutations[m];
                            var thisMutNodes = md['addedNodes'];
                            if (thisMutNodes && thisMutNodes.length) {
                                for (ma=0; ma < thisMutNodes.length; ma++) {
                                    var thisMutNode = thisMutNodes[ma];
                                    var thisMutTgtParent = thisMutNode['parentElement'];
                                    if (thisMutTgtParent) {
                                        if (thisMutTgtParent.localName == 'div' && thisMutTgtParent.id == 'body') {
                                            dlog('accepted');
                                            acceptedChange = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
				if (acceptedChange) {
                    refreshData();
				}
                else { dlog('rejected'); }
            }
            
            if (observer_disconned) {
                dlog('disconned, reattaching');
                jQuery.when(projDone, rankDone, rosDone, activityDone, depthDone, totalsDone).done(function() {
                    dlog('all done');
                    dlog('watching for changes after finishing');
                    target_observe = document.querySelector(target_selector);
                    observer.observe(target_observe, observerConfig);
                });
            }
        });
        
        dlog('watching for changes');
        observer.observe(target_observe, observerConfig);
    }
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    var req = msg.request;
    var val = msg.value;
    
    if (req == 'refresh_data') {
        refreshData(true);
        sendResponse('ok');
    }
});
