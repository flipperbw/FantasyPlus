/*-- TODO
- somehow adjust OPRK for opp teams, snap %
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
- fix CURR for seasons start
- fix when blocking certain sites loading
- make optimize work with classic clubhouse in espn
- https://developer.yahoo.com/fantasysports/guide/player-resource.html#player-resource-desc
- navving back and forth negates player_name_fix
- some history is straight up wrong, like nyj kicker
- find a solution for the data being >5mb
- fix the profiler cards
*/

/*
var tag = document.createElement("script");
tag.type="text/javascript";
tag.src = "https://code.jquery.com/jquery-latest.min.js";
document.body.appendChild(tag);
*/

//replace all the jquery + find so that it searches parents? test if html gets stripped out
//could do: j.wrap('div').parent().find('div')
//or extend with a findAll function: $.fn.find2 = function(selector) {return this.filter(selector).add(this.find(selector));};
//but with a catch for div > div
//https://gist.github.com/duzun/187785d63ccb95da8883

/* global chrome, console */

chrome.runtime.sendMessage({ request: 'valid_site' });

var dlog = {
    ERROR: 1, WARN: 2, LOG: 3, INFO: 4, DEBUG: 5, VERBOSE: 6,
    empty: function() {},
    set level(level) {
        this.error = (level >= this.ERROR) ? console.error.bind(window.console) : this.empty;
        this.warn = (level >= this.WARN) ? console.warn.bind(window.console) : this.empty;
        this.log = (level >= this.LOG) ? console.log.bind(window.console) : this.empty;
        this.info = (level >= this.INFO) ? console.log.bind(window.console) : this.empty;
        this.debug = (level >= this.DEBUG) ? console.log.bind(window.console) : this.empty;
        this.verbose = (level >= this.VERBOSE) ? console.log.bind(window.console) : this.empty;
        this.loggingLevel = level;
    },
    get level() { return this.loggingLevel; }
};

//dlog.level = dlog.WARN;
dlog.level = dlog.LOG;
//dlog.level = dlog.INFO;

jQuery.noConflict();

function isObj(o) {
    return jQuery.isPlainObject(o) && !jQuery.isEmptyObject(o);
}

function goodVal(o, v, t) {
    // noinspection JSDeprecatedSymbols
    return o.hasOwnProperty(v) && jQuery.type(o[v]) === t;
}

function override(object, methodName, callback) {
    object[methodName] = callback(object[methodName])
}

function applyAfter(extraBehavior) {
    return function(original) {
        return function() {
            var returnValue = original.apply(this, arguments);
            extraBehavior.apply(this, arguments);
            return returnValue;
        }
    }
}

function applyBefore(extraBehavior) {
    return function(original) {
        return function() {
            extraBehavior.apply(this, arguments);
            return original.apply(this, arguments);
        }
    }
}

function applyCompose(extraBehavior) {
    return function(original) {
        return function() {
            return extraBehavior.call(this, original.apply(this, arguments))
        }
    }
}

function getLocalStorage(k, fnc) {
    return new Promise((resolve, reject) => {
        //could move resolve to the end of this?
        chrome.storage.local.get(k, (r) => { fnc(r, resolve, reject); });
    });
}

function setLocalStorage(obj) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(obj, () => { resolve(); });
    });
}

var domParse = new DOMParser();
function cleanHTML(data) {
    let dirty = domParse.parseFromString(data, 'text/html');
    let tagList = dirty.querySelectorAll('head, img, svg, link, style');
    tagList.forEach(function(tag) {
        tag.remove();
    });
    return dirty.documentElement.innerHTML;
}

var storageUserSettingsKey = 'fp_user_settings';

function clearStoredData() {
    return getLocalStorage(null, (r, resolve, reject) => {
        /* jshint unused: vars */
        jQuery.each(r, function(k, v) {
            if (k !== storageUserSettingsKey) {
                chrome.storage.local.remove(k);
            }
        });
        /* jshint unused: true */
        resolve();
    });
}

//clearStoredData();
//chrome.storage.local.get('fp_player_activity_data', function(d) { console.info(d); });

var storageDataResetKey = 'fp_data_reset';
var res_num = 2;

function resetOldData() {
    return getLocalStorage(storageDataResetKey, (r, resolve, reject) => {
        var res_data = r[storageDataResetKey];
        if (!res_data || res_data < res_num) {
        //if (!res_data || res_data < res_num || res_num < 3) {
            dlog.log('Clearing stored data');
            clearStoredData().then(function() {
                setLocalStorage({'fp_data_reset': res_num}).then(() => {
                    resolve();
                });
            });
        }
        else {
            resolve();
        }
    });
}

// GLOBALS
var alldata,
    custom_cols,
    observer,
    observer_disconned,
    league_id,
    league_settings_url,
    storage_translation_data,
    activity_data,
    activity_data_current_season_site,
    siteType,
    onMatchupPreviewPage,
    onClubhousePage,
    onFreeAgencyPage,
    onGeneralProjPage,
    storageLeagueKey,
    storageLeagueUpdateKey,
    storagePlayerKey,
    storageUpdateKey,
    storageUpdateTypeKey,
    storageTranslationKey,
    storageTranslationUpdateKey,
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

var fp = 'FantasyPlus';

var num_rgx = '\\d+';

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

var ajax_timeout = 6000;

var show_proj = true;
var show_rank = true;
var show_ros = true;
var show_std = true; // adjust
var show_depth = true;
var show_spark = true;
var show_avg = true;
var show_med = true;
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

/*
var expert_map = {
    'cbs': '11',
    'espn': '71',
    'numberfire': '73',
    'stats': '120',
    'fftoday': '152'
};
*/

var remove_ads = true;
var fix_css = true;

//two days before sos
var season_start_map = {
    '2014': [8, 2],
    '2015': [8, 8],
    '2016': [8, 6],
    '2017': [8, 5],
    '2018': [8, 4],
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

var projDefs = {
    settingNames: [
        'pass_yds', 'pass_tds', 'pass_ints', 'pass_att', 'pass_cmp', 'pass_icmp', 'pass_firstdown',
        'rush_yds', 'rush_tds', 'rush_att', 'rush_firstdown',
        'rec_yds', 'rec_att', 'rec_tds', 'rec_firstdown',
        'xpt', 'fg', 'fga', 'fgm',
        'fumbles'
    ],
    defDict: {
        'sk': 'def_sack',
        'ff': 'def_ff',
        'int': 'def_int',
        'deftd': 'def_td',
        'fr': 'def_fr',
        'pa': 'def_pa',
        'ya': 'def_tyda',
        'sf': 'def_safety'
    },
    idpDict: {
        'sk': 'Scks',
        'ff': 'FumFrc',
        'tka': 'Tack',
        'tks': 'Asst',
        'pd': 'PassDef',
        'int': 'Int',
        'deftd': 'DefTD',
        'fr': 'Fum',
    },

    // this is from 2014-2015 data. does not incorporate players specifically (todo, do that somehow)
    first_down_pct: {
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

var seasonstart;
try {
    seasonstart = new Date(current_season, season_start_map[current_season][0], season_start_map[current_season][1], 4);
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
    'Steven Hauschka': 'Stephen Hauschka',
    'Stephen Hauschka': 'Steven Hauschka',
    'Adoree\' Jackson': 'Adoree Jackson',
    'Daniel Sorensen': 'Daniel Sorenson',
    'Johnathan Cyprien': 'Jonathan Cyprien'
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
    'Mitchell': 'Mitch',
    'Mitch': 'Mitchell',
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

    'Jadeveon Clowney': 'LB',
    'Derrick Morgan': 'LB',
    'Vic Beasley': 'LB',
    'Shea McClellin': 'LB',
    'Trent Murphy': 'LB',
    'Kevin Dodd': 'LB',
    'Lorenzo Alexander': 'LB',
    'Ryan Kerrigan': 'LB',
    'Preston Smith': 'LB',

    'Su\'a Cravens': 'DB',

    'Jabaal Sheard': 'DL',
    'Frank Clark': 'DL',
    'Khalil Mack': 'LB', //DE
    'Melvin Ingram': 'DE',
};

var player_position_fix_depth = {
    'Derrick Morgan': 'LB',
    'Vic Beasley': 'LB',
    'Shea McClellin': 'LB',
    'Trent Murphy': 'LB',
    'Kevin Dodd': 'LB',
    'Su\'a Cravens': 'LB',
    'Bruce Irvin': 'LB',
    'Ryan Kerrigan': 'LB',
    'Preston Smith': 'LB',

    'Tyrann Mathieu': 'S',
    'Lamarcus Joyner': 'S',

    'Jadeveon Clowney': 'DE',
    'Jabaal Sheard': 'DE',
    'Frank Clark': 'DE',
    'Emmanuel Ogbah': 'DE',
    'Dwight Freeney': 'DE',
    'Timmy Jernigan': 'DE',
    'Jaye Howard': 'DE',
    'Chris Baker': 'DE',
    'Kendall Langford': 'DE',
    'Adolphus Washington': 'DE',
    'Robert Nkemdiche': 'DE',
    'DaQuan Jones': 'DE',
    'Yannick Ngakoue': 'DE',
    'Melvin Ingram': 'DE',
    'Cameron Heyward': 'DE',
    'Aaron Donald': 'DE',
    'Akiem Hicks': 'DE',
};

var player_position_fix_sharks = {
    'Su\'a Cravens': 'DB',
    'Khalil Mack': 'LB',
    'Bruce Irvin': 'DL',
};

var team_abbrev_fix_fleaflicker = {
    'LA': 'LAR'
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
    'DST': ['Player', 'Team', 'def_sack', 'def_int', 'def_fr', 'def_ff', 'def_td', 'def_safety', 'def_pa', 'def_tyda', 'fpts']
};

var fpros_rank_headers = ['Rank', 'WSIS', 'Player', 'Team', 'Matchup', 'Best Rank', 'Worst Rank', 'Avg Rank', 'Std Dev'];
var fpros_rank_idp_headers = ['Rank', 'WSIS', 'Player', 'Team', 'Pos', 'Matchup', 'Best Rank', 'Worst Rank', 'Avg Rank', 'Std Dev'];

var fpros_ros_headers = ['Rank', 'WSIS', 'Player', 'Team', 'Bye', 'Best Rank', 'Worst Rank', 'Avg Rank', 'Std Dev', 'ADP', 'vs. ADP'];
var fpros_ros_idp_headers = ['Rank', 'WSIS', 'Player', 'Team', 'Pos', 'Bye', 'Best Rank', 'Worst Rank', 'Avg Rank', 'Std Dev'];

var depth_type_map = {
    'blue': 'Starter',
    'green': 'Situational',
    'red': 'Fill-in',
    'brown': 'Fill-in',
    'black': 'Reserve'
};

var depth_url = '//subscribers.footballguys.com/apps/depthchart.php?type=all&lite=no&exclude_coaches=yes';
var url_fpros = 'https://www.fantasypros.com/nfl';
var url_sharks = 'https://www.fantasysharks.com';
var url_sharks_proj = `${url_sharks}/apps/bert/forecasts/projections.php`;

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

var siteType = '';

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

function getUserSettings() {
    return getLocalStorage(storageUserSettingsKey, (r, resolve, reject) => {
        var stored_user_settings = r[storageUserSettingsKey];
        dlog.log('user settings:');
        dlog.log(stored_user_settings);

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

        show_proj  = col_settings.hasOwnProperty('proj') && show_proj ? col_settings['proj'] : show_proj;
        show_rank  = col_settings.hasOwnProperty('rank') && show_rank ? col_settings['rank'] : show_rank;
        show_ros   = col_settings.hasOwnProperty('ros') && show_ros ? col_settings['ros'] : show_ros;
        show_depth = col_settings.hasOwnProperty('depth') && show_depth ? col_settings['depth'] : show_depth;
        show_spark = col_settings.hasOwnProperty('spark') && show_spark ? col_settings['spark'] : show_spark;
        show_avg   = col_settings.hasOwnProperty('avg') && show_avg ? col_settings['avg'] : show_avg;
        show_med   = col_settings.hasOwnProperty('med') && show_med ? col_settings['med'] : show_med;
        show_current = col_settings.hasOwnProperty('current') && show_current ? col_settings['current'] : show_current;

        var update_settings = {};
        if (isObj(user_settings.update_freq)) {
            update_settings = user_settings.update_freq;
        }
        else {
            user_settings.update_freq = {};
        }

        jQuery.each(update_settings, function(k, v) {
            if (!isObj(v)) {
                v = {};
            }
            var update_settings_time = v.time;
            var update_settings_typ  = v.typ;

            if (update_settings_time && update_settings_typ) {
                var new_mins = update_settings_time;
                if (update_settings_typ === 'h') {
                    new_mins *= 60;
                }

                // noinspection JSValidateTypes
                if (k === 'player') {
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

        resolve();
    });
}

function isDataCurrent(l) {
    function subtr(s) {
        var mins = check_minutes;
        var v = 0;

        if (s === 'league') {
            v = updated_league;
        }
        else if (s === 'translation') {
            v = updated_translation;
        }
        else if (s === 'depth') {
            if (!show_depth) {
                return true;
            }
            else {
                mins = check_minutes_depth;
                v = updated_depth;
            }
        }
        else if (s === 'proj' && !show_proj) {
            return true;
        }
        else if (s === 'rank' && !show_rank) {
            return true;
        }
        else if (s === 'ros' && !show_ros) {
            return true;
        }
        else if (isObj(updated_times)) {
            v = updated_times[s];

            var s_type = s;

            var exp_type_dict = experts[s_type] || {};
            var exp_val = exp_type_dict.selection || 'none';
            var exp_val_str = exp_val.toString();
            if (s_type === 'rank' || s_type === 'ros') {
                var exp_num_dict = exp_type_dict.num || {};
                var exp_top = exp_num_dict['top'] || 10;
                var exp_updated = exp_num_dict['updated'] || 7;

                exp_val_str += '-' + exp_top + '-' + exp_updated;
            }

            dlog.log(exp_val_str);

            if (updated_types[s_type] !== exp_val_str) {
                dlog.log('Different update type for: ' + s_type + ', stored is: ' + updated_types[s_type] + ', want: ' + exp_val_str);
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
            dlog.log(s + ' is out of date: ' + v);
        }

        return r;
    }

    if (!l || (!(Array.isArray(l) || typeof l === "string")) || l.length <= 0) {
        return false;
    }
    else if (Array.isArray(l)) {
        var is_c = true;
        for (let e=0; e<l.length; e++) {
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
    if (typ === 'league') {
        if (live === 'live') {
            dlog.info('using live');
            chk_mins = check_minutes_avg_live;
        }
        else if (live === 'done') {
            dlog.info('using done');
            chk_mins = check_minutes_avg_done;
        }
        else {
            dlog.info('using day');
            chk_mins = check_minutes_avg;
        }

        r = (current_time - upd) < (1000 * 60 * chk_mins);
    }
    else if (typ === 'games') {
        //todo timezones? maybe add a check to make sure length is expected somehow
        var update_week = Math.max(Math.ceil(((upd - seasonstart_avg_week) / 86400000) / 7), 1);
        dlog.info('update week for player: ' + pid + ': ' + update_week);
        if (update_week !== current_week_avg) {
            r = false;
        }
    }

    if (r === false) {
        dlog.info('Activity data out of date for player: ' + pid + ', type is: ' + typ + ', by: ' + ((current_time - upd) / 1000));
    }

    return r;
}

var AssignDataFromStorage = function() {
    var self = this;

    this.resolver = null;
    // noinspection JSUnusedGlobalSymbols
    this.r = null;

    this._resolve = () => {
        self.resolver();
    };

    this._cb = (r, resolve, reject) => {
        self.resolver = resolve;
        self.r = r;

        // Projection data
        alldata = r[storagePlayerKey];
        if (isObj(alldata)) {
            updated_times = r[storageUpdateKey];
            if (!isObj(updated_times)) {
                updated_times = {};
            }
        }
        else {
            dlog.log('Could not find alldata');
            alldata = {};
            updated_times = {};
        }
        dlog.info(updated_times);

        updated_types = r[storageUpdateTypeKey];
        dlog.log(updated_types);
        if (!isObj(updated_types)) {
            updated_types = {};
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
        dlog.info('depth data:');
        dlog.info(depth_data);
        dlog.info(updated_depth);

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
        var stored_league_settings = r[storageLeagueKey];
        updated_league = r[storageLeagueUpdateKey];
        if (isObj(stored_league_settings) && isDataCurrent('league')) {
            dlog.log('Using cache for league');
            parseLeagueSettings.league_settings = stored_league_settings;
            self._resolve();
        }
        else {
            parseLeagueSettings.league_settings = {};
            dlog.log('Fetching league data, Updated time: ' + updated_league + ', Current Time: ' + current_time);
            jQuery.get(league_settings_url, function(d) {
                d = cleanHTML(d);
                var setSettings = parseLeagueSettings.run(d);
                var setLeagueData = {};
                setLeagueData[storageLeagueKey] = setSettings;
                setLeagueData[storageLeagueUpdateKey] = updated_league;
                setLocalStorage(setLeagueData).then(() => {
                    self._resolve();
                });
            });
        }
    };

    this.run = () => { return getLocalStorage(storageKeys, self._cb); }
};

var assignDataFromStorage = new AssignDataFromStorage();

function resetLeagueYear() {} //TODO: fix this to only reset once

var UpdateStorage = function() {
    var self = this;

    this._wait = (typ, promiseList, cb) => {
        dlog.log(`Attempting to set new ${typ} data`);
        jQuery.when(...promiseList).done(function() {
            var data = cb();

            if (isObj(data)) {
                dlog.log(`Setting new ${typ} data`);
                chrome.storage.local.set(data, function() {
                    resetLeagueYear();
                });
            }
            else {
                dlog.log(`Not setting ${typ} data due to error`);
            }
        });
    };

    this.player = () => {
        var typ = 'player';
        var promiseList = [projDone, rankDone, rosDone];
        var cb = function() {
            dlog.log('fetch fail: ' + fetch_fail);
            dlog.log('idp fetch fail: ' + idp_fetch_fail);
            if (!fetch_fail && !idp_fetch_fail) {
                var setData = {};
                setData[storagePlayerKey] = alldata;
                setData[storageUpdateKey] = updated_times;
                setData[storageUpdateTypeKey] = updated_types;
                return setData;
            }
            return null;
        };

        self._wait(typ, promiseList, cb);
    };

    this.depth = () => {
        var typ = 'depth';
        var promiseList = [depthDone];
        var cb = function() {
            dlog.log('depth fail: ' + depth_fail);
            if (!depth_fail) {
                var setData = {};
                setData[storageDepthKey] = depth_data;
                setData[storageDepthUpdateKey] = updated_depth;
                return setData;
            }
            return null;
        };

        self._wait(typ, promiseList, cb);
    };

    this.activity = () => {
        var typ = 'activity';
        var promiseList = [activityDone];
        var cb = function() {
            // no fail here?
            var setData = {};
            setData[storageActivityKey] = activity_data;
            return setData;
        };

        self._wait(typ, promiseList, cb);
    };
};

var updateStorage = new UpdateStorage();

var SetWatch = function() {
    var self = this;

    this._getPromiseList = () => {
        return onMatchupPreviewPage ? [projDone, totalsDone] : [projDone, rankDone, rosDone, activityDone, depthDone, totalsDone];
    };

    this._watch = () => {
        if (!onMatchupPreviewPage) {
            watchForChanges.run();
        }
    };

    this.run = () => {
        jQuery.when(...self._getPromiseList()).done(function() {
            dlog.log('all done');
            self._watch();
        });
    };
};

var setWatch = new SetWatch();

var RunGetAllData = function() {
    this.run = () => {
        dlog.log('getting all data');
        if (onMatchupPreviewPage) {
            getAllData('proj');
        }
        else {
            getAllData();
        }
    };
};

var runGetAllData = new RunGetAllData();

var ParseLeagueSettings = function() {
    var self = this;

    this.league_settings = {};
    this.league_data = null;

    this.run = function(data) {
        self.league_settings = {};
        self.league_data = jQuery(data);
        updated_league = current_time;
        return self.league_settings;
    };
};

var parseLeagueSettings = new ParseLeagueSettings();

function ajaxCbPos(settings) {
    jQuery.ajax(
        settings
    ).done(function(data) {
        var cb = this.custom_data.cb;
        var cust_position = this.custom_data.pos;

        data = cleanHTML(data);
        cb(cust_position, data.trim());
    }).fail(function() {
        var cb = this.custom_data.cb;
        var cust_position = this.custom_data.pos;
        var cust_source_site = this.custom_data.source_site;

        idp_fetch_fail = true;
        chrome.runtime.sendMessage({ request: 'fetch_fail', value: cust_source_site });
        cb(cust_position, 'error');
    });
}

//Get the data from external sites
function fetchPositionData(position, type, cb) {
    var source_site = '';
    var source_type = 'offense';
    var rank_ppr;

    if ((type === 'rank') || (type === 'ros')) {
        rank_ppr = '';
        if (position === 'rb' || position === 'wr' || position === 'te') {
            if (parseLeagueSettings.league_settings['rec_att'] === 0.5) {
                rank_ppr = 'half-point-ppr-';
            }
            else if (parseLeagueSettings.league_settings['rec_att'] === 1.0) {
                rank_ppr = 'ppr-';
            }
        }

        var ros_url = '';
        if (type === 'ros') {
            ros_url = 'ros-';
        }

        source_site = url_fpros + '/rankings/' + ros_url + rank_ppr + position + '.php';
    }
    else if (off_positions_proj.indexOf(position) > -1) {
        //todo dunno if i need week anymore
        source_site = url_fpros + '/projections/' + position + '.php?week=' + current_week;
    }
    else {
        source_type = 'idp';
        source_site = url_sharks_proj + '?csv=1&Position=' + position + '&Segment=' + (627 + current_week);
        //source_site = url_sharks_proj + '?csv=1&Position=' + position;
    }

    var ajax_settings = {
        url: source_site,
        timeout: ajax_timeout,
        custom_data: {
            'cb': cb,
            'source_site': source_site,
            'pos': position
        }
    };

    // noinspection JSValidateTypes
    if (source_type === 'idp') {
        ajaxCbPos(ajax_settings);
    }
    else {
        var expert_type = experts[type] || {};
        var expert_selection = expert_type.selection || [];

        if (type === 'proj' && expert_selection.length === 1) {
            ajaxCbPos(ajax_settings);
        }
        else if (type === 'proj') {
            var send_data = {
                'scoring': 'STD',
                //'expert[]': []
            };

            /*
            for (let e=0; e<expert_selection.length; e++) {
                let e_val = expert_selection[e];
                let e_conv = expert_map[e_val];
                if (e_conv) {
                    send_data['expert[]'].push(e_conv);
                }
            }
            */

            ajax_settings['method'] = 'get';
            ajax_settings['data'] = send_data;
            ajax_settings['traditional'] = true;

            ajaxCbPos(ajax_settings);
        }
        else {
            jQuery.ajax(
                ajax_settings
            ).done(function(data) {
                var cb = this.custom_data.cb;
                var cust_position = this.custom_data.pos;
                var cust_source_site = this.custom_data.source_site;

                data = cleanHTML(data);

                var send_data = {
                    'expert[]': []
                };

                var expert_list = send_data['expert[]'];

                if (rank_ppr === 'half-point-ppr-') {
                    send_data['scoring'] = 'HALF';
                }
                else if (rank_ppr === 'ppr-') {
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

                    if (expert_selection.indexOf('all') === -1) {
                        var staff_id = ex_rows.find('td').filter(function() {
                            return jQuery(this).text() === 'FantasyPros Staff';
                        }).parents('tr').find('td:eq(' + id_idx +') input').val();

                        // noinspection JSDeprecatedSymbols
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

                delete send_data['expert[]'];

                var new_ajax_settings = {
                    url: cust_source_site,
                    method: 'get',
                    data: send_data,
                    timeout: ajax_timeout,
                    custom_data: {
                        'cb': cb,
                        'source_site': cust_source_site,
                        'pos': cust_position
                    }
                };

                ajaxCbPos(new_ajax_settings);
            }).fail(function() {
                var cb = this.custom_data.cb;
                var cust_source_site = this.custom_data.source_site;
                fetch_fail = true;
                chrome.runtime.sendMessage({ request: 'fetch_fail', value: cust_source_site });
                cb(position, 'error');
            });
        }
    }
}

function parsesiteCSV(str) {
    var arr = [];
    var quote = false;

    /*jshint -W120 */
    var row, col, c;
    for (row = col = c = 0; c < str.length; c++) {
        var cc = str[c];
        var nc = str[c+1];
        arr[row] = arr[row] || [];
        arr[row][col] = arr[row][col] || '';
        if (cc === ',' && typeof nc === "undefined") { col++; arr[row][col] = ''; }

        if (cc === '"' && quote && nc === '"') { arr[row][col] += cc; ++c; continue; }
        if (cc === '"') { quote = !quote; continue; }
        if (cc === ',' && !quote) { ++col; continue; }
        if (cc === '\n' && !quote) { ++row; col = 0; continue; }

        arr[row][col] += cc;
    }
    /*jshint +W120 */

    return arr;
}

function convertFProsToCSV(raw_data, type, pos_name) {
    var new_raw_data = jQuery(raw_data);
    new_raw_data.find('thead tr:has(td)').remove();
    new_raw_data.find('tbody tr:not([class^="mpb-player"])').remove();
    var new_data = jQuery('table#data, table#rank-data', new_raw_data).first();
    var header_cell = new_data.find('thead th:contains("Player")');

    var new_header_cell = header_cell.clone();
    new_header_cell.text('Team');
    new_header_cell.insertAfter(header_cell);

    var data_rows = new_data.find('tbody tr');
    data_rows.each(function(i, v) {
        var jv = jQuery(v);
        var player_cell = jv.find('td.player-label');

        var new_player_name = player_cell.find('a[fp-player-name]').first().attr('fp-player-name');
        if (!new_player_name) {
            new_player_name = player_cell.find('a[href^="/nfl"]').first().find('span.full-name').text();
        }
        new_player_name = new_player_name.trim();

        var team_text = '';
        if (type === 'proj') {
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
    if (type === 'rank') {
        if (idp_positions.indexOf(pos_name) > -1) {
            new_headers = fpros_rank_idp_headers;
        }
        else {
            //TODO: fix this to be automatic
            new_headers = fpros_rank_headers;
        }
    }
    else if (type === 'ros') {
        if (idp_positions.indexOf(pos_name) > -1) {
            new_headers = fpros_ros_idp_headers;
        }
        else {
            new_headers = fpros_ros_headers;
        }
    }
    else if (type === 'proj') {
        new_headers = fpros_proj_headers[pos_name];
    }

    return new_data.table2CSV({
        delivery: 'value',
        header: new_headers
    });
}

function parsePos(typ, raw_data, p_name) {
    if (raw_data === 'error') return;

    var pos_name;

    if (typ === 'proj' && off_positions_proj.indexOf(p_name) === -1) {
        raw_data = raw_data.replace(/<\/?(html|body)>/g, '');
        pos_name = idp_conversion[p_name];
    }
    else {
        pos_name = p_name.toUpperCase();
        raw_data = convertFProsToCSV(raw_data, typ, pos_name);
    }

    var parsed_data = parsesiteCSV(raw_data);

    var headers = parsed_data[0];
    for (let h=0; h < headers.length; h++) {
        headers[h] = headers[h].trim();
    }

    var team_header = headers.indexOf('Team');
    var player_name_header = headers.indexOf('Player');

    if (team_header === -1 || player_name_header === -1) return;

    for (let i=1; i < parsed_data.length; i++) {
        var currentline = parsed_data[i];

        var new_pos_name = pos_name;

        if (currentline.length < team_header + 1) {
            dlog.log('Error fetching ' + typ);
            dlog.log(currentline);
            dlog.log(pos_name);
            continue;
        }

        var team_name = currentline[team_header].trim();
        if (team_name_conversion.hasOwnProperty(team_name)) {
            team_name = team_name_conversion[team_name];
        }

        var player_name = currentline[player_name_header].trim();

        if (p_name === 'dst') {
            player_name = setDSTname(player_name);

            new_pos_name = 'D/ST';
            team_name = "-";
        }
        else if (typ === 'proj' && def_positions_proj.indexOf(p_name) > -1) {
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
        }

        player_name = player_name.trim().toUpperCase();

        // Add team and position to player_name for differentiating duplicate names
        var full_name = player_name + "|" + new_pos_name + "|" + team_name;

        if (!alldata.hasOwnProperty(full_name)) {
            alldata[full_name] = {};
        }

        for (let j = player_name_header + 1; j < headers.length; j++) {
            if (typeof currentline[j] === "undefined") {
                dlog.log('Error fetching ' + typ);
                dlog.log(currentline);
                dlog.log(pos_name);
                continue;
            }

            var currentline_text = currentline[j].trim();
            var key_name = headers[j].trim();
            if (typ === 'ros') {
                key_name += ' Ros';
            }
            alldata[full_name][key_name] = currentline_text.replace(',', '');
        }
    }
}

//todo: combine these
function getPosProjections() {
    var ready_proj = all_positions_proj.length;

    function fetchCb(p_name, raw_data) {
        var typ = 'proj';

        parsePos(typ, raw_data, p_name);

        ready_proj--;
        if (ready_proj === 0) {
            updated_times[typ] = current_time;
            updated_types[typ] = ((experts[typ] || {}).selection || 'none').toString();
            addData.run(typ);
        }
    }

    //TODO add a catch here if this array is empty at the end or something
    for (let p=0; p < all_positions_proj.length; p++) {
        var p_name = all_positions_proj[p];
        fetchPositionData(p_name, 'proj', fetchCb);
    }
}

function getPosRankings() {
    var ready_rank = all_positions_rank.length;

    function fetchCb(p_name, raw_data) {
        var typ = 'rank';

        parsePos(typ, raw_data, p_name);

        ready_rank--;
        if (ready_rank === 0) {
            updated_times[typ] = current_time;
            var exp_rank = experts[typ] || {};
            var exp_rank_num = exp_rank.num || {};
            updated_types[typ] = (exp_rank.selection || 'none').toString() + '-' + (exp_rank_num['top'] || 0) + '-' + (exp_rank_num['updated'] || 0);
            addData.run(typ);
        }
    }

    for (let p=0; p < all_positions_rank.length; p++) {
        var p_name = all_positions_rank[p];
        fetchPositionData(p_name, 'rank', fetchCb);
    }
}

function getRosRankings() {
    var ready_ros = all_positions_rank.length;

    function fetchCb(p_name, raw_data) {
        var typ = 'ros';

        parsePos(typ, raw_data, p_name);

        ready_ros--;
        if (ready_ros === 0) {
            updated_times[typ] = current_time;
            var exp_ros = experts[typ] || {};
            var exp_ros_num = exp_ros.num || {};
            updated_types[typ] = (exp_ros.selection || 'none').toString() + '-' + (exp_ros_num['top'] || 0) + '-' + (exp_ros_num['updated'] || 0);
            addData.run(typ);
        }
    }

    for (let p=0; p < all_positions_rank.length; p++) {
        var p_name = all_positions_rank[p];
        fetchPositionData(p_name, 'ros', fetchCb);
    }
}

function getPlayerCheckName(n, p, t, typ) {
    var ret = null;

    if (typ === 'proj') {
        ret = n.toUpperCase() + '|' + p + '|' + t;
    }
    else if (typ === 'depth') {
        ret = n.toUpperCase();
    }

    return ret;
}

function fixPlayerPosition(pname, ppos, f_type) {
    var position_fix_dict = {};
    if (f_type === 'proj') {
        position_fix_dict = player_position_fix;
    }
    else if (f_type === 'depth') {
        position_fix_dict = player_position_fix_depth;
    }

    if (player_name_fix.hasOwnProperty(pname)) {
        pname = player_name_fix[pname];
    }

    if (position_fix_dict.hasOwnProperty(pname)) {
        ppos = position_fix_dict[pname];
    }

    if (typeof ppos === "string" && ppos.indexOf(',EDR')) {
        ppos = ppos.replace(',EDR', '');
    }
    else if (ppos.constructor === Array) {
        ppos = ppos.filter(item => item !== 'EDR');
    }

    return ppos;
}

function fixPlayerName(pname, ppos, pteam, f_type, p_dict) {
    p_dict = typeof p_dict === "undefined" ? alldata : p_dict;

    var ppos_list = ppos;
    if (ppos.constructor !== Array) {
        ppos_list = [ppos];
    }
    for (let pp=0; pp<ppos_list.length; pp++) {
        ppos = ppos_list[pp];
        if (f_type === 'proj') {
            if ((ppos === 'DT') || (ppos === 'DE')) {
                ppos = 'DL';
            }
            else if ((ppos === 'CB') || (ppos === 'S')) {
                ppos = 'DB';
            }
        }

        if (p_dict.hasOwnProperty(getPlayerCheckName(pname, ppos, pteam, f_type))) {
            return [pname, ppos];
        }
        else if (player_name_fix.hasOwnProperty(pname)) {
            var new_pname = player_name_fix[pname];
            if (p_dict.hasOwnProperty(getPlayerCheckName(new_pname, ppos, pteam, f_type))) {
                dlog.log('fixed name: ' + pname + '; is now: ' + new_pname);
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
                    dlog.log('fixed name: ' + pname + '; is now: ' + new_pname_abbrev);
                    return [new_pname_abbrev, ppos];
                }
                name_list.push(new_pname_abbrev);
            }

            var player_name_addons_rgx = /( V| IV| III| II| Jr\.| Sr\.)$/;
            name_list_len = name_list.length;
            for (let n=0; n<name_list_len; n++) {
                this_name = name_list[n];
                var pname_addon_match = this_name.match(player_name_addons_rgx);
                if (pname_addon_match) {
                    var name_match = pname_addon_match[1];
                    new_pname_addon = this_name.slice(0, this_name.indexOf(name_match));
                    if (p_dict.hasOwnProperty(getPlayerCheckName(new_pname_addon, ppos, pteam, f_type))) {
                        dlog.log('fixed name: ' + pname + '; is now: ' + new_pname_addon);
                        return [new_pname_addon, ppos];
                    }
                    name_list.push(new_pname_addon);
                }
            }

            name_list_len = name_list.length;
            for (let n=0; n<name_list_len; n++) {
                this_name = name_list[n];
                var this_name_split = this_name.split(' ');
                var this_first_name = this_name_split[0];
                var this_rest_name = this_name_split.slice(1).join(' ');

                if (player_name_translations.hasOwnProperty(this_first_name)) {
                    new_pname_trans = player_name_translations[this_first_name] + ' ' + this_rest_name;
                    if (p_dict.hasOwnProperty(getPlayerCheckName(new_pname_trans, ppos, pteam, f_type))) {
                        dlog.log('fixed name: ' + pname + '; is now: ' + new_pname_trans);
                        return [new_pname_trans, ppos];
                    }
                    name_list.push(new_pname_trans);
                }
            }

            var player_name_addons = [' V', ' IV', ' III', ' II', ' Jr.', ' Sr.'];
            name_list_len = name_list.length;
            for (let n=0; n<name_list_len; n++) {
                this_name = name_list[n];

                for (let a=0; a < player_name_addons.length; a++) {
                    new_pname_add = this_name + player_name_addons[a];
                    if (p_dict.hasOwnProperty(getPlayerCheckName(new_pname_add, ppos, pteam, f_type))) {
                        dlog.log('fixed name: ' + pname + '; is now: ' + new_pname_add);
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
            j_vb.each(function(j, x) {
                var j_x = jQuery(x);
                var depth_pos = j_x.text().replace(':', '');
                if (depth_pos === 'NT') {
                    depth_pos = 'DT';
                }
                else if (depth_pos === 'OLB' || depth_pos === 'ILB' || depth_pos === 'MLB') {
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
                            for (let n=0; n<stat_match.length; n++) {
                                depth_player_status.push(stat_match[n].replace(/[()]/g, '').toUpperCase());
                            }
                        }
                        depth_player_name = depth_player_text.slice(0, depth_player_text.indexOf(' ('));
                    }

                    /* jshint -W100 */
                    depth_player_name = depth_player_name.replace(/[�′]+/g, "'");
                    /* jshint +W100 */

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

    addData.run('depth');
}

function getDepth() {
    jQuery.ajax({
        url: depth_url,
        timeout: ajax_timeout
    }).done(function(data) {
        data = cleanHTML(data);
        parseDepth(data);
    }).fail(function() {
        depth_fail = true;
        chrome.runtime.sendMessage({ request: 'fetch_fail', value: depth_url });
        addData.run('depth');
    });
}

function getPlayerData() {
    if (show_proj) {
        getPosProjections();
    }
    else {
        projDone.resolve();
        if (hasProjTotals) {
            addData.projTotals();
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

            updateStorage.player();
            getPlayerData();
        }
        else {
            dlog.log('Using cache for player data');
            addPlayerData();
        }
    }
    else {
        projDone.resolve();
        if (hasProjTotals) {
            addData.projTotals();
        }
        else {
            totalsDone.resolve();
        }

        rankDone.resolve();
        rosDone.resolve();
    }

    if (show_avg || show_med || show_spark || show_current) {
        updateStorage.activity(); //always, could have a "changed" flag for all the players
        addData.run('adjavg');
    }
    else {
        activityDone.resolve();
    }

    if (show_depth) {
        if (!isDataCurrent('depth')) {
            dlog.log('resetting depth');
            depth_data[current_season]['W' + current_week] = {};
            depth_data_current_week = depth_data[current_season]['W' + current_week];
            updated_depth = 0;

            updateStorage.depth();
            getDepth();
        }
        else {
            dlog.log('Using cache for depth data');
            addData.run('depth');
        }
    }
    else {
        depthDone.resolve();
    }
}

/*
function validPosition(player_pos, slot_pos) {
    var valid_pos = [slot_pos];

    if (slot_pos.indexOf('/') > -1 && slot_pos !== 'D/ST') {
        valid_pos = slot_pos.split('/');
    }
    else if (slot_pos === 'FLEX') {
        valid_pos = ['RB', 'WR', 'TE'];
    }
    else if (slot_pos === 'OP') {
        valid_pos = ['QB', 'RB', 'WR', 'TE'];
    }
    else if (slot_pos === 'DL') {
        valid_pos = ['DE', 'EDR', 'DT'];
    }
    else if (slot_pos === 'DB') {
        valid_pos = ['CB', 'S'];
    }
    else if (slot_pos === 'DP') {
        valid_pos = ['DE', 'EDR', 'DT', 'LB', 'CB', 'S'];
    }

    return valid_pos.indexOf(player_pos) > -1;
}
*/
/*
function optimizeLineup() {
    observer_disconned = true;
    if (observer) {
        observer.disconnect();
    }

    setSelectors(false);

    var p_proj_vals = [];

    var p_proj_cell = jQuery('.FantasyPlusProjectionsData');
    p_proj_cell.each(function() {
        var v = jQuery(this);
        var p_proj_val = parseFloat(v.text());

        var p_name_row = v.parent('tr');
        var p_row_id = p_name_row.find(player_name_selector).attr('id');

        if (typeof p_row_id !== "undefined") {
            var [p_cell, p_cell_text] = getPlayerCellText(p_name_row, v);
            var player_cell_data = getPlayerDataFromCell(p_cell, p_cell_text);
            var pos_name = player_cell_data[1];

            p_proj_vals.push([p_row_id, pos_name, p_proj_val]);
        }
    });

    p_proj_vals.sort(function(first, second) {
        var result = second[2] - first[2];
        if (!isFinite(result)) {
            return !isFinite(first[2]) ? 1 : -1;
        }
        else {
            return result;
        }
    });

    var table_headers = player_table_body.find(player_table_header_selector);
    var starter_rows = table_headers.first().nextUntil(table_headers.last()).not('.playerTableBgRowHead, .FantasyPlus');
    var wait_timer = 0;
    var wait_increase = 100;
    var move_list = [];
    starter_rows.each(function(){
        var this_row = jQuery(this);
        var row_pos_text = this_row.find(player_cell_pos_selector).text().trim();
        var row_move_cell = this_row.find('.pncButtonLocked');
        if (row_move_cell.length === 0) {
            var valid_players = p_proj_vals.filter(function(item) {
                var vp_pos = item[1];
                if (Array.isArray(vp_pos)) {
                    var pos_match = false;
                    vp_pos.forEach(function(vp) {
                        if (validPosition(vp, row_pos_text) === true) {
                            pos_match = true;
                        }
                    });
                    return pos_match;
                }
                else {
                    return validPosition(vp_pos, row_pos_text);
                }
            });

            if (valid_players.length > 0) {
                var valid_player = valid_players[0];

                var player_idx = p_proj_vals.findIndex(i => i[0] === valid_player[0]);
                p_proj_vals[player_idx] = [null, null, null];

                var this_player_row = player_table_body.find('#' + valid_player[0]).parent('tr');
                var this_row_pos_text = this_player_row.find(player_cell_pos_selector).text().trim();
                if (this_row_pos_text !== row_pos_text) {
                    var p_move_cell = this_player_row.find('.pncButtonMove');
                    if (p_move_cell.length) {
                        move_list.push([p_move_cell, this_row]);

                        var dest_move_cell = this_row.find('.pncButtonMove');
                        if (dest_move_cell.length) {
                            move_list.push([dest_move_cell, null]);
                        }
                    }
                }
            }
        }
    });

    var new_move_list = [];
    var bench_area = player_table_body.find('tr.playerTableBgRowHead:last');
    move_list.forEach(function(mov) {
        var p_move_cell = mov[0];
        var this_row = mov[1];

        var mov_type = p_move_cell.parents('tr').first().find(player_cell_pos_selector).text().trim();
        if (mov_type !== 'Bench') {
            setTimeout(function() {
                p_move_cell.trigger('click');
                var bench_move = bench_area.nextAll(player_table_row_selector).not('.irRow').find('.pncButtonHere:visible').first();
                var bench_parent_id = bench_move.parent('td').attr('id');
                if (this_row) {
                    new_move_list.push([bench_parent_id, this_row]);
                }

                bench_move.trigger('click');
            }, wait_timer);

            wait_timer += wait_increase;
        }
    });

    if (wait_timer !== 0) {
        setTimeout(function() {
            var new_wait_timer = 0;
            new_move_list.forEach(function(mov) {
                var p_move_parent = mov[0];
                //debugger;
                var p_move_cell = p_move_parent.find('.pncButtonMove:visible').first();
                var this_row = mov[1];

                setTimeout(function() {
                    p_move_cell.trigger('click');
                    var new_this_row = player_table_body.find(this_row);
                    var move_here_cell = new_this_row.find('.pncButtonHere:visible').first();
                    move_here_cell.trigger('click');
                }, new_wait_timer);

                new_wait_timer += wait_increase;
            });

            setTimeout(function(){
                refreshData();
            }, new_wait_timer + wait_increase);

        }, wait_timer + wait_increase);
    }
}
*/

var expected_player_pts = {};

function calculateProjections(datatype, player_name, pos_name, team_name) {
    if (datatype === 'depth') {
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

    if (datatype === 'proj-default') {
        //fix
        // noinspection JSDeprecatedSymbols
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
                //check if empty?
            }
            else {
                dlog.log('Could not find player: ' + full_name);
                if (datatype === 'proj') {
                    return("--");
                }
                else {
                    return ['--', '--'];
                }
            }
        }
    }

    dlog.info('player data: ');
    dlog.info(player_data);

    if (datatype === 'proj-default' && expected_player_pts.hasOwnProperty(pos_name)) {
        return expected_player_pts[pos_name];
    }

    if (datatype === 'proj' || datatype === 'proj-default') {
        var player_score = 0;

        var settingNames = projDefs.settingNames;
        var defDict = projDefs.defDict;
        var idpDict = projDefs.idpDict;
        var first_down_pct = projDefs.first_down_pct;

        for (let n=0; n < settingNames.length; n++) {
            var sn = settingNames[n];
            dlog.info(sn);

            if (!parseLeagueSettings.league_settings.hasOwnProperty(sn)) continue;

            var setting_score = parseLeagueSettings.league_settings[sn];
            dlog.info(setting_score);
            var p_data = 0;

            if (sn === 'pass_icmp') {
                p_data = Math.max((player_data['pass_att'] || 0) - (player_data['pass_cmp'] || 0), 0);
            }
            else if (sn === 'fgm') {
                p_data = Math.max((player_data['fga'] || 0) - (player_data['fg'] || 0), 0);
            }
            else if (sn === 'pass_firstdown') {
                if (first_down_pct['pass'].hasOwnProperty(pos_name)) {
                    p_data = first_down_pct['pass'][pos_name] * player_data['pass_att'];
                }
            }
            else if (sn === 'rush_firstdown') {
                if (first_down_pct['rush'].hasOwnProperty(pos_name)) {
                    p_data = first_down_pct['rush'][pos_name] * player_data['rush_att'];
                }
            }
            else if (sn === 'rec_firstdown') {
                if (first_down_pct['rec'].hasOwnProperty(pos_name)) {
                    p_data = first_down_pct['rec'][pos_name] * player_data['rec_att'];
                }
            }
            else {
                p_data = (player_data[sn] || 0);
            }

            dlog.info(p_data);
            var p_plus = setting_score * p_data;
            dlog.info(p_plus);
            player_score += p_plus;

            //should be ok to call this on yahoo
            var p_plus_bonus = calcBonus(sn, p_data);
            dlog.info(p_plus_bonus);
            player_score += p_plus_bonus;
        }

        var thisDefDict = {};
        if (pos_name === 'D/ST') {
            thisDefDict = defDict;
        }
        else if (idp_positions.indexOf(pos_name) > -1) {
            thisDefDict = idpDict;
        }

        for (let k in thisDefDict) {
            if (thisDefDict.hasOwnProperty(k) && parseLeagueSettings.league_settings.hasOwnProperty(k)) {
                //todo fix this to apply on a per position basis
                var k_val = thisDefDict[k];
                dlog.info(k + ', ' + k_val);
                var settings_k = parseLeagueSettings.league_settings[k];
                dlog.info(settings_k);
                var p_data_val = (player_data[k_val] || 0);
                dlog.info(p_data_val);

                var p_plus_d = settings_k * p_data_val;
                dlog.info(p_plus_d);

                player_score += p_plus_d;

                //should be ok to call this on yahoo
                var p_plus_bonus_d = calcBonus(k, p_data_val);
                dlog.info(p_plus_bonus_d);
                player_score += p_plus_bonus_d;
            }
        }

        dlog.info(player_score);

        player_score += calcAdjProjections(player_data);

        dlog.info('returning score: ');
        dlog.info(player_name +','+ player_score);

        if (isNaN(player_score)) {
            dlog.log('bad player score');
            player_score = '--';
        }
        else {
            player_score = (Math.round(player_score * 10) / 10).toFixed(1);
        }

        if (datatype === 'proj-default') {
            expected_player_pts[pos_name] = player_score;
        }

        return player_score
    }
    else if (datatype === 'rank') {
        if (parseFloat(player_data['Avg Rank'])) {
            var player_rank = (Math.round(player_data['Avg Rank'] * 10) / 10).toFixed(1);
            var player_stdev = (Math.round(player_data['Std Dev'] * 10 * 1.96) / 10).toFixed(1);
            return [player_rank, player_stdev];
        }
        else {
            return ['--', '--'];
        }
    }
    else if (datatype === 'ros') {
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

function RowData(currRow, cell) {
    this.currRow = currRow;
    this.cell = cell;

    this.player_cell = null;
    this.player_cell_text = null;

    this.player_name = null;
    this.pos_name = null;
    this.team_name = null;

    this.player_id = null;
    this.player_href = null;
    this.translation_id = null;
    this.translation_name = null;
    this.translation_pos = null;

    this.live_game = false;

    this._init();
}

RowData.prototype._init = function() {
    this.player_cell = this._getPlayerCell();
    this.player_cell_text = this._getPlayerCellText();

    if (this._isBlank()) return {};
    //player_name, pos_name, team_name, (live_game, player_id, player_href)
    Object.assign(this, this._getPlayerInfo());
};

RowData.prototype._getPlayerCell = function() {
    return this.currRow.find(player_name_selector);
};

RowData.prototype._getPlayerCellText = function() {
    return this.player_cell.text().trim();

    /*
    //This is stupid, but.......whatever.
    if (player_cell.find('.fantasy-finder')) {
        player_cell = player_cell.clone();
        player_cell.find('#inline-availability-marker').remove();
        player_cell_text = player_cell.text().trim().replace(/([\r\n])/g, '');
    }
    */
};

RowData.prototype._getPlayerInfo = function() {};

RowData.prototype.getTranslationId = function() {
    return this.translation_id !== null ? this.translation_id : this.player_id;
};
RowData.prototype.getPlayerName = function() {
    return this.translation_name !== null ? this.translation_name : this.player_name;
};
RowData.prototype.getPosName = function() {
    return this.translation_pos !== null ? this.translation_pos : this.pos_name;
};

RowData.prototype._isBlank = function() {
    return !this.player_cell_text || this.player_cell_text === "(Empty)";
};

RowData.prototype._isUnpredictable = function() {
    return /(TQB|HC|P)$/.test(this.player_cell_text);
};

RowData.prototype._isNA = function() {
    return this._isBlank() || this._isUnpredictable();
};

RowData.prototype._isImmortal = function() {
    return /(D\/ST|TQB|HC)$/.test(this.player_cell_text);
};

var GetProjectionData = function() {
    var self = this;

    this.run = function(datatype, currRow, cell) {
        //put this creation where run is invoked
        var rowData = new RowData(currRow, cell);

        if (datatype === 'adjavg') {
            return self.adjavg(rowData);
        }
        else {
            return self.other(rowData, datatype);
        }
    };

    this._fetchActivityData = function(rowData) {};

    this.adjavg = function(rowData) {
        var currRow = rowData.currRow;
        var player_cell_text = rowData.player_cell_text;
        var normavg;

        if (show_avg) {
            normavg = currRow.find('FantasyPlusAvgData').prev().text();
        }
        else if (show_med) {
            normavg = currRow.find('FantasyPlusMedianData').prev().text();
        }

        if ((!player_cell_text) || (normavg === "--")) { //check for (empty)?
            return insertAdjAvg(currRow, null, null, [], []);
        }

        var player_id = rowData.player_id;

        if (!player_id) {
            return insertAdjAvg(currRow, null, null, [], []);
        }

        if (!goodVal(activity_data_current_season_site, player_id, 'object')) {
            activity_data_current_season_site[player_id] = {};
        }
        var player_stored_activity = activity_data_current_season_site[player_id];

        if (player_stored_activity.hasOwnProperty('translation')) {
            var new_player_id = player_stored_activity['translation'];
            dlog.log('found translation ID for: ' + player_id + ', is: ' + new_player_id);
            rowData.translation_id = new_player_id;
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

        if (!player_stored_activity_league.hasOwnProperty('pts_med')) {
            player_stored_activity_league['pts_med'] = null;
        }
        var player_stored_activity_league_med = player_stored_activity_league['pts_med'];

        if (!player_stored_activity_league.hasOwnProperty('last_updated')) {
            player_stored_activity_league['last_updated'] = 0;
        }
        var player_stored_activity_league_updated = player_stored_activity_league['last_updated'];

        // Fetch points during gametime constantly for CURR, otherwise daily for stat corrections

        if (isActivityDataCurrent(player_id, player_stored_activity_league_updated, 'league', rowData.live_game) && isActivityDataCurrent(player_id, player_stored_activity_games_updated, 'games')) {
            dlog.info('Using cache for player activity: ' + player_id);
            return insertAdjAvg(currRow, player_stored_activity_league_avg, player_stored_activity_league_med, player_stored_activity_games, player_stored_activity_league_pts);
        }

        self._fetchActivityData(rowData);
    };

    this._popNA = function(cell, datatype) {
        if (datatype === 'rank' || datatype === 'ros') {
            return popCell(cell, ['--', '--'], datatype);
        }
        else {
            return popCell(cell, '--', datatype);
        }
    };

    this._calcAndPop  = function(rowData, datatype) {
        var calcVal = calculateProjections(datatype, rowData.getPlayerName(), rowData.getPosName(), rowData.team_name);
        return popCell(rowData.cell, calcVal, datatype);
    };

    this.other = function(rowData, datatype) {
        if (rowData._isNA()) {
            return self._popNA(rowData.cell, datatype);
        }

        return self._calcAndPop(rowData, datatype);
    };
};

var getProjectionData = new GetProjectionData();

function insertAdjAvg(thisrow, p_avg, p_med, games_played, weekly_points) {
    var old_avg, thiscell;

    if (show_avg) {
        thiscell = thisrow.find('.FantasyPlusAvgData');

        old_avg = parseFloat(thiscell.prev().text());

        // noinspection JSDeprecatedSymbols
        if (!jQuery.isNumeric(p_avg)) {
            thiscell.text('--');
        }
        else if (p_avg > old_avg) {
            thiscell.html('<span style="color:green">' + p_avg + '</span>');
        }
        else {
            thiscell.text(p_avg);
        }
    }

    if (show_med) {
        thiscell = thisrow.find('.FantasyPlusMedianData');
        if (parseFloat(old_avg)) {
            old_avg = parseFloat(p_avg);
        }

        // noinspection JSDeprecatedSymbols
        if (!jQuery.isNumeric(p_med)) {
            thiscell.text('--');
        }
        else if (p_med > old_avg) {
            thiscell.html('<span style="color:green">' + p_med + '</span>');
        }
        else if (p_med < old_avg) {
            thiscell.html('<span style="color:red">' + p_med + '</span>');
        }
        else {
            thiscell.text(p_med);
        }
    }

    if (show_current) {
        var thisCurrent = thisrow.find('.FantasyPlusCurrentData');
        var curr_score = "--";
        if (weekly_points && weekly_points.length > 0) {
            // noinspection JSDeprecatedSymbols
            if (current_season === current_season_avg_week && jQuery.isNumeric(weekly_points[current_week - 1])) {
                curr_score = weekly_points[current_week - 1];
            }

            //TODO: add a green or red if above/below projection when game is done, or pct based
            //if (parseFloat(curr_score) || curr_score === 0) {

            thisCurrent.text(curr_score);
        }
        else {
            thisCurrent.text(curr_score);
        }
    }

    if (show_spark) {
        var thisSpark = thisrow.find('.FantasyPlusSparkData');

        if (!(weekly_points && weekly_points.length > 0)) {
            thisSpark.text('--');
        }
        else {
            var rowData = new RowData(thisrow, thisSpark);

            //is this necessary?
            /*
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
            */

            var expected_projection = calculateProjections('proj-default', rowData.player_name, rowData.pos_name, rowData.team_name);
            dlog.info('we expect for pos: ' + rowData.pos_name + ', to get: ' + expected_projection);
            // noinspection JSDeprecatedSymbols
            if (jQuery.isNumeric(expected_projection)) {
                expected_projection = Number(expected_projection);
            }

            var pts_high = expected_projection * (4 / 3);
            var pts_low = expected_projection * (2 / 3);

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
                    tooltipFormatter: function(a, b, c) {
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

                if (siteType === 'fleaflicker') {
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
    }

    total_players--;
    if (total_players === 0) {
        dlog.log('avg done');
        activityDone.resolve();
    }
}

function canAddColumns() {
    return header_index > -1;
}

var ReDefer = function () {
    this.run = function() {
        if (!canAddColumns()) {
            dlog.log('cant add columns');
            return;
        }

        projDone = jQuery.Deferred();
        rankDone = jQuery.Deferred();
        rosDone = jQuery.Deferred();
        activityDone = jQuery.Deferred();
        depthDone = jQuery.Deferred();
        totalsDone = jQuery.Deferred();
    };
};
var reDefer = new ReDefer();

function addPlayerData() {
    if (canAddColumns()) {
        if (show_proj) {
            addData.run('proj');
        }
        else {
            projDone.resolve();
            if (hasProjTotals) {
                addData.projTotals();
            }
            else {
                totalsDone.resolve();
            }
        }

        if (show_rank) {
            addData.run('rank');
        }
        else {
            rankDone.resolve();
        }

        if (show_ros) {
            addData.run('ros');
        }
        else {
            rosDone.resolve();
        }
    }
    else {
        dlog.log('no header');
        projDone.resolve();
        rankDone.resolve();
        rosDone.resolve();
        totalsDone.resolve();
        //resolve ff and yahoo?
    }
}

function addAllData() {
    if (canAddColumns()) {
        addPlayerData();

        if (show_avg || show_med || show_spark || show_current) {
            addData.run('adjavg');
        }
        else {
            activityDone.resolve();
        }

        if (show_depth) {
            addData.run('depth');
        }
        else {
            depthDone.resolve();
        }
    }
    else {
        dlog.log('no header');
        projDone.resolve();
        rankDone.resolve();
        rosDone.resolve();
        activityDone.resolve();
        depthDone.resolve();
        totalsDone.resolve();
    }
}

var isCurrentWeek = function() { return true; };

jQuery.fn.nearest = function(selector) {
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
    if (dtype === 'depth') {
        return insertDepth(c, v);
    }
    else if (dtype === 'rank' || dtype === 'ros') {
        var rnk = v[0];
        var std = v[1];

        c.text(rnk);

        if (show_std) {
            if (rnk === "--") {
                c.next().text(std); //change this in the future for "is stdev enabled column"
            }
            else {
                c.next().html('<span style="font-size: 80%;">±</span>' + std);
            }
        }

        return null;
    }
    else {
        return c.text(v);
    }
}

var AddData = function() {
    var self = this;

    this.blank = '-';
    this.byeweek_overwrite = null;
    this.isCurr = false;

    this.selectors = {
        proj: () => { return player_table_body.find('.FantasyPlusProjectionsData'); },
        rank: () => { return player_table_body.find('.FantasyPlusRankingsData'); },
        ros: () => { return player_table_body.find('.FantasyPlusRosData'); },
        depth: () => { return player_table_body.find('.FantasyPlusDepthData'); },
        adjavg: () => { return player_table_rows; }
    };

    this.run = function(datatype) {
        self.isCurr = isCurrentWeek();

        var data = self.selectors[datatype]();

        if (datatype === 'proj') {
            return self._proj(data);
        }
        else if (datatype === 'rank') {
            return self._rank(data);
        }
        else if (datatype === 'ros') {
            return self._ros(data);
        }
        else if (datatype === 'depth') {
            return self._depth(data);
        }
        else if (datatype === 'adjavg') {
            return self._adjavg(data);
        }
    };

    this._iterData = function(datatype, data) {
        data.each(function() {
            var cell = jQuery(this);
            self._insert(datatype, cell);
        });
    };

    this._insert = function(typ, cell) {
        if (!self.isCurr && ['proj', 'rank', 'ros'].indexOf(typ) > -1) {
            return cell.text(self.blank);
        }
        else {
            var currRow = cell.parent();

            if (typ === 'proj' || typ === 'rank') {
                var byeweek_text = currRow.find('td:contains("** BYE **")'); //todo could add for yahoo and flea
                var isByeWeek = (byeweek_text.length > 0);

                if (typ === 'proj' && self.byeweek_overwrite && onMatchupPreviewPage) {
                    byeweek_text.html(self.byeweek_overwrite);
                }

                if (isByeWeek) {
                    var blank_data = '--';
                    if (typ === 'rank') {
                        blank_data = ['--', '--'];
                    }
                    return popCell(cell, blank_data, typ);
                }
            }

            return getProjectionData.run(typ, currRow, cell);
        }
    };

    this.projTotals = function() {};

    this._proj = function(data) {
        self._iterData('proj', data);

        dlog.log('proj done');
        projDone.resolve();

        if (self.isCurr && hasProjTotals) {
            self.projTotals();
        }
        else {
            dlog.log('totals done');
            totalsDone.resolve();
        }
    };

    this._rank = function(data) {
        self._iterData('rank', data);

        dlog.log('rank done');
        rankDone.resolve();
    };

    this._ros = function(data) {
        self._iterData('ros', data);

        dlog.log('ros done');
        rosDone.resolve();
    };

    this._depth = function(data) {
        if (!isObj(depth_data_current_week)) {
            dlog.log('Current week depth not set');
            depth_fail = true;
            //TODO revert back to older weeks
            //depth_data[current_season]['W' + (current_week - 1)]
            depth_data_current_week = {};
        }

        total_players_depth = data.length;
        if (total_players_depth === 0) {
            depthDone.resolve();
        }

        self._iterData('depth', data);

        resetLeagueYear();
    };

    this._adjavg = function(data) {
        total_players = player_table_rows.length;

        data.each(function() {
            var currRow = jQuery(this);
            getProjectionData.run('adjavg', currRow, '');
        });

        resetLeagueYear();
    };
};
var addData = new AddData();

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

        if (posname === 'D/ST') {
            cell.text('--');
        }
        else if (teamname === 'FA') {
            cell.text('--');
        }
        else {
            teamname = Object.keys(team_abbrevs).filter(function(key) { return team_abbrevs[key] === teamname; })[0];

            var team_data = {};
            if (depth_data_current_week.hasOwnProperty(teamname)) {
                team_data = depth_data_current_week[teamname];
            }

            var team_pos_data = {};
            var pdata, new_fix;

            if (posname.constructor === Array) {
                for (let p=0; p < posname.length; p++) {
                    var pn = posname[p];
                    var new_pos_data = {};
                    if (team_data.hasOwnProperty(pn)) {
                        new_pos_data = team_data[pn];

                        if (new_pos_data.hasOwnProperty(plname_cap)) {
                            team_pos_data = new_pos_data;
                            posname = pn;
                            pdata = team_pos_data[plname_cap];
                            p_depth = posname + pdata['num'];
                            break;
                        }
                        else {
                            new_fix = fixPlayerName(plname, pn, teamname, 'depth', new_pos_data);
                            if (new_fix) {
                                plname = new_fix[0];
                                posname = new_fix[1];
                                plname_cap = plname.toUpperCase();
                                team_pos_data = new_pos_data;
                                pdata = team_pos_data[plname_cap];
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
                        pdata = team_pos_data[plname_cap];
                        p_depth = posname + pdata['num'];
                    }
                    else {
                        new_fix = fixPlayerName(plname, posname, teamname, 'depth', team_pos_data);
                        if (new_fix) {
                            plname = new_fix[0];
                            posname = new_fix[1];
                            plname_cap = plname.toUpperCase();
                            pdata = team_pos_data[plname_cap];
                            pdata['true_name'] = plname;
                            p_depth = posname + pdata['num'];
                        }
                        else if (posname === 'RB') {
                            //todo make above a function
                            var newposname = 'FB';
                            var new_team_pos_data = {};
                            if (team_data.hasOwnProperty(newposname)) {
                                new_team_pos_data = team_data[newposname];
                                if (new_team_pos_data.hasOwnProperty(plname_cap)) {
                                    posname = newposname;
                                    team_pos_data = new_team_pos_data;
                                    pdata = team_pos_data[plname_cap];
                                    p_depth = posname + pdata['num'];
                                }
                                else {
                                    new_fix = fixPlayerName(plname, newposname, teamname, 'depth', new_team_pos_data);
                                    if (new_fix) {
                                        plname = new_fix[0];
                                        posname = new_fix[1];
                                        plname_cap = plname.toUpperCase();
                                        team_pos_data = new_team_pos_data;
                                        pdata = team_pos_data[plname_cap];
                                        pdata['true_name'] = plname;
                                        p_depth = posname + pdata['num'];
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (p_depth === '--') {
                dlog.log('Could not get depth for player: ' + depthData[0]);
            }
            cell.text(p_depth);

            var players_sorted = Object.keys(team_pos_data).sort(function(a,b){ return team_pos_data[a].num - team_pos_data[b].num; });

            if (players_sorted.length) {
                var p_trs = '';
                for (let p=0; p < players_sorted.length; p++) {
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
                    if (pname_check.toUpperCase() === plname.toUpperCase()) {
                        trstring = '<tr style="background-color: lightblue">';
                    }
                    p_trs += trstring + '<td style="width: 40px;">' + posname + pnum + ':' + '</td><td style="width: 140px;">' + pname_print + '</td><td style="width: 90px;">' + ptype + '</td><td style="width: 80px;">' + p_status + '</td></tr>';
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
            else {
                dlog.log('No team data for pos: ' + posname);
                dlog.log(team_data);
            }
        }
    }

    total_players_depth--;
    if (total_players_depth === 0) {
        dlog.log('depth done');
        depthDone.resolve();
        //todo add into alldata
    }
}

function _resetTranslation() {}

function refreshData(fetch) {
    dlog.log('rerunning');

    observer_disconned = true;
    if (observer) {
        observer.disconnect();
    }

    jQuery('.FantasyPlus').remove();
    setSelectors();
    reDefer.run();
    addColumns();

    if (fetch !== true) {
        addAllData();
    }
    else {
        updated_times = {};
        updated_types = {};
        updated_depth = 0;

        if (!isObj(activity_data)) {
            activity_data = {};
        }
        if (!activity_data.hasOwnProperty(current_season)) {
            activity_data[current_season] = {};
        }

        activity_data[current_season][siteType] = {};
        activity_data_current_season_site = activity_data[current_season][siteType];

        _resetTranslation();

        dlog.log('Refreshing data, Current Time: ' + current_time);
        //reset parseLeagueSettings.league_settings?
        jQuery.get(league_settings_url, function(d) {
            d = cleanHTML(d);
            var setSettings = parseLeagueSettings.run(d);
            var setLeagueData = {};
            setLeagueData[storageLeagueKey] = setSettings;
            setLeagueData[storageLeagueUpdateKey] = updated_league;
            chrome.storage.local.set(setLeagueData, function() {
                setWatch.run();
                runGetAllData.run();
            });
        });
    }
}

var WatchForChanges = function() {
    var self = this;

    this.target_selector = null;
    this.observerConfig = {
        childList: true,
        characterData: true,
        subtree: true
    };

    this._getAcceptedChange = function(mutations) {
        return true;
    };

    this._handleMutations = function(acceptedChange) { //todo fix when grabbing player ids
        if (acceptedChange) {
            refreshData();
        }
        else {
            dlog.log('rejected mutation');
        }
    };

    this.run = function() {
        if (!hasPlayerTable) return;

        dlog.log('init watch');

        var target_observe = document.querySelector(self.target_selector);
        if (target_observe === null) {
            dlog.log('Not attaching observer');
            return;
        }

        observer = new MutationObserver(function(mutations) {
            observer_disconned = false;

            if (mutations.length > 0) {
                var acceptedChange = self._getAcceptedChange(mutations);
                self._handleMutations(acceptedChange);
            }

            if (observer_disconned) {
                dlog.log('disconned, reattaching');
                jQuery.when(projDone, rankDone, rosDone, activityDone, depthDone, totalsDone).done(function () {
                    dlog.log('all done');
                    dlog.log('watching for changes after finishing');
                    target_observe = document.querySelector(self.target_selector);
                    observer.observe(target_observe, self.observerConfig);
                });
            }
        });
        dlog.log('watching for changes');
        observer.observe(target_observe, self.observerConfig);
    };
};
var watchForChanges = new WatchForChanges();

//TODO: make sure this waits until everything is done
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    var req = msg.request;
    //var val = msg.value;

    if (req === 'refresh_data') {
        refreshData(true);
        sendResponse('ok');
    }
});