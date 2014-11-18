/*-- TODO
- Add injury adjusted average points, somehow adjust OPRK for shitty teams, snap %
- Somehow do all 9 requests at once
- debug/verbose mode
- yahoo support / nfl / fleaflicker / myfantasyleague
- return yardage
- firefox/safari
- sortable? doubt it
- option to disable/add
- option for experts
- WR1/2 from depth chart, http://www.footballoutsiders.com/stats/teamdef
- timeout for loading gif
- start doing things before the document is ready. https://gist.github.com/raw/2625891/waitForKeyElements.js, waitForKeyElements ("a.Inline", delinkChangeStat);
*/

/*
var tag = document.createElement("script");
tag.type="text/javascript";
tag.src = "http://code.jquery.com/jquery-latest.min.js";
document.body.appendChild(tag);
*/

// GLOBALS
var check_minutes = 30;
var updated_time;
var storage_league_data;
var current_time = new Date().getTime();

window.off_positions_proj = ['qb', 'rb', 'wr', 'te', 'k'];
window.def_positions_proj = ['6','8','9','10'];
window.all_positions_proj = window.off_positions_proj.concat(window.def_positions_proj);
window.all_positions_rank = ['qb', 'rb', 'wr', 'te', 'k', 'dst', 'dl', 'lb', 'db'];

window.idp_conversion = {'6': 'D/ST', '8': 'DL', '9': 'LB', '10': 'DB'};
window.team_name_conversion = {'ARZ': 'ARI', 'GBP': 'GB', 'KCC': 'KC', 'NEP': 'NE', 'NOR': 'NO', 'SDC': 'SD', 'SFO': 'SF', 'TBB': 'TB', 'WAS': 'WSH'};

var loadingUrl = chrome.extension.getURL('loading.gif');

var projDone = $.Deferred();
var rankDone = $.Deferred();
var rosDone = $.Deferred();

$(document).ready(function () {
	if (document.URL.match(/games.espn.go.com/)) {
		$('.games-alert-tilt').remove();
		
		var siteType = 'espn';
		
		var playerTable = $('[id^=playertable_] tbody');
		var hasProjectionTable = playerTable.find('tr.playerTableBgRowSubhead td:contains(PROJ)').length > 0;
		
		var league_id = document.URL.match(/leagueId=(\d+)/)[1];
		var onMatchupPreviewPage = document.URL.match(/ffl\/matchuppreview/);
		var hasPlayerTable = document.URL.match(/ffl\/(freeagency|clubhouse|dropplayers|tradereview|rosterfix)/);
		var onClubhousePage = document.URL.match(/ffl\/(clubhouse|dropplayers)/);
		
		var storageLeagueKey = 'fp_espn_league_data_' + league_id;
		var storagePlayerKey = 'fp_espn_player_data_' + league_id;
		var storageUpdateKey = 'fp_espn_last_updated_' + league_id;
		
		if (hasProjectionTable) {
			addColumns();
			chrome.storage.local.get([storageLeagueKey, storagePlayerKey, storageUpdateKey], function(r) {
				storage_league_data = r[storageLeagueKey];
				updated_time = r[storageUpdateKey];
				window.alldata = r[storagePlayerKey];
				
				if ((storage_league_data) && ((current_time - updated_time) < (1000 * 60 * check_minutes))) {
					var settings = storage_league_data;
					doESPNthings(settings);
				}
				else {
					$.get('http://games.espn.go.com/ffl/leaguesetup/sections/scoring', {"leagueId": league_id}, function(d) {
						var settings = parseLeagueSettings(d, siteType);
						var setLeagueData = {};
						setLeagueData[storageLeagueKey] = settings;
						chrome.storage.local.set(setLeagueData, function() {
							doESPNthings(settings);
						});
					});
				}
			});
		}
	}
	else if (document.URL.match(/football.fantasysports.yahoo.com/)) {
		var siteType = 'yahoo';
		
		//var playerTable = $('[id^=playertable_] tbody');
		//var hasProjectionTable = playerTable.find('tr.playerTableBgRowSubhead td:contains(PROJ)').length > 0;
		
		var league_id = document.URL.match(/football.fantasysports.yahoo.com\/f1\/(\d+)/)[1];
		//var onMatchupPreviewPage = document.URL.match(/ffl\/matchuppreview/);
		//var hasPlayerTable = document.URL.match(/ffl\/(freeagency|clubhouse|dropplayers|tradereview|rosterfix)/);
		//var onClubhousePage = document.URL.match(/ffl\/(clubhouse|dropplayers)/);
		
		//if (hasProjectionTable) {
			//addColumns();
			$.get('http://football.fantasysports.yahoo.com/f1/' + league_id + '/settings', function(d) {
				var settings = parseLeagueSettings(d, siteType);
				/*
				if (onMatchupPreviewPage) {
					getPosProjections(settings);
				}
				else {
					getData(settings);
					$.when(projDone, rankDone, rosDone).done(function () {
						watchForChanges(settings);
					});
				}*/
			});
		//}
	}

	function doESPNthings(settings) {
		if (onMatchupPreviewPage) {
			if ((window.alldata) && ((current_time - updated_time) < (1000 * 60 * check_minutes))) {
				addAllData(settings);
			}
			else {
				window.alldata = {};
				//chrome.storage.local.clear(function() {
				getPosProjections(settings);
				//});
				$.when(projDone).done(function () {
					var setPlayerData = {};
					setPlayerData[storagePlayerKey] = window.alldata;
					setPlayerData[storageUpdateKey] = current_time;
					chrome.storage.local.set(setPlayerData);
				});
			}
		}
		else {
			// if we don't have injury_data, or we need to update it for last week...
			$.get('http://www.nfl.com/inactives', {'week': '1'}, function(w) {
				var inactive = $(w);
				
				scr = inactive.find('script[type="text/javascript"]:not([async],[src],[charset])');
				console.log(scr);
				/*
				activity_players = inactive.find('tbody.yui3-datatable-data tr[id^="yui"]');
				console.log(activity_players.length);

				activity_players.each(function() {
					var act_player_row = $(this);
					act_player_status = act_player_row.find('td.yui3-datatable-col-status').text();
					console.log(act_player_status);
					
					if (act_player_status == 'Inactive') {
						act_player_name = act_player_row.find('td.yui3-datatable-col-player').text();
						act_player_pos = act_player_row.find('td.yui3-datatable-col-position').text();
						act_player_team = act_player_row.closest('div.data-injuries').attr('class').split(' ')[0].split('-')[2];
						
						act_player_full_name = act_player_name + "|" + act_player_pos + "|" + act_player_team;
					
						console.log(act_player_full_name);
					}
				});
				*/
			});
			
			if ((window.alldata) && ((current_time - updated_time) < (1000 * 60 * check_minutes))) {
				addAllData(settings);
				$.when(projDone, rankDone, rosDone).done(function () {
					watchForChanges(settings);
				});
			}
			else {
				window.alldata = {};
				getData(settings);
				$.when(projDone, rankDone, rosDone).done(function () {
					var setPlayerData = {};
					setPlayerData[storagePlayerKey] = window.alldata;
					setPlayerData[storageUpdateKey] = current_time;
					chrome.storage.local.set(setPlayerData, function() {
						watchForChanges(settings);
					});
				});
			}
		}
	}
	
	function addColumns() {
        var proj_head = $('[id^=playertable_] tbody tr.playerTableBgRowSubhead').find('td:contains(PROJ), td:contains(ESPN)');
        var header_index = proj_head.first().index();

		if (header_index > -1) {
			var playerTable = $('[id^=playertable_] tbody');

			if (onMatchupPreviewPage) {
				projection_header = '<td class="playertableStat FantasyPlus FantasyPlusProjections FantasyPlusProjectionsHeader" title="Consensus point projections from FantasyPros (via FantasyPlus)">FPROS</td>';
				proj_head.after(projection_header);
				proj_head.text('ESPN');
								
				last_header_col = playerTable.find('.playertableSectionHeader th:contains(STATS)');
				last_header_col.each(function() {
					curr_span = $(this).attr("colspan");
					$(this).attr("colspan", curr_span + 1);
					
					parent_table = $(this).closest('table');
					
					var firstrow = true;
					parent_table.find('tr.pncPlayerRow:not(.emptyRow)').each(function () {
						var currRow = $(this);
						if (firstrow) {
							celldata = '<img src="' + loadingUrl + '"/>';
							firstrow = false;
						}
						else {
							celldata = '';
						}
						
						//make this look at the array instead of this garbage hardcoding bullshitigans
						currRow.find('td').last().after('<td class="playertableStat FantasyPlus FantasyPlusProjections FantasyPlusProjectionsData">' + celldata + '</td>');
					});
				});
			}
			else {
				//make these options that are set above, add to a custom_cols array when each is enabled)
				projection_header = '<td class="playertableStat FantasyPlus FantasyPlusProjections FantasyPlusProjectionsHeader" title="Consensus point projections from FantasyPros (via FantasyPlus)">FPROS</td>';
				rank_header = '<td colspan="2" style="text-align: center" class="playertableStat FantasyPlus FantasyPlusRankings FantasyPlusRankingsHeader" title="Projected position rank (lower is better) for *this week* from FantasyPros (via FantasyPlus)">THIS WEEK</td>'; //say wk 9 or this week
				//stdev_header = '<td class="playertableStat FantasyPlus FantasyPlusStdevs FantasyPlusStdevsHeader">StDev</td>';
				ros_header = '<td colspan="2" style="text-align: center" class="playertableStat FantasyPlus FantasyPlusRos FantasyPlusRosHeader" title="Projected position rank (lower is better) for *the rest of the season* from FantasyPros (via FantasyPlus)">REMAINING</td>';
				
				//temp hack
				window.custom_cols = 5;
				
				all_header_cells = projection_header + '<td class="FantasyPlus sectionLeadingSpacer"></td>' + rank_header + ros_header + '<td class="FantasyPlus sectionLeadingSpacer"></td>';
				
				last_header_col = $('.playerTableBgRowHead.tableHead.playertableSectionHeader').find('th:last');
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

				var firstrow = true;
				var byeweek = playerTable.find('tr.playerTableBgRowSubhead td:contains(OPP)').first().index();
				playerTable.find('tr.pncPlayerRow:not(.emptyRow)').each(function () {
					var currRow = $(this);
					var byeweek_text = currRow.find('td').eq(byeweek).text();
					var adj_header_index = (byeweek_text == "** BYE **" ? header_index - 1 : header_index);
					
					if (firstrow) {
						celldata = '<img src="' + loadingUrl + '"/>';
						firstrow = false;
					}
					else {
						celldata = '';
					}
					
					//make this look at the array instead of this garbage hardcoding bullshitigans
					currRow.find('td').eq(adj_header_index).after('<td class="playertableStat FantasyPlus FantasyPlusProjections FantasyPlusProjectionsData">' + celldata + '</td><td class="FantasyPlus sectionLeadingSpacer"></td><td class="playertableStat FantasyPlus FantasyPlusRankings FantasyPlusRankingsData">' + celldata + '</td><td class="playertableStat FantasyPlus FantasyPlusRankings FantasyPlusRankingsStdevData"></td><td class="playertableStat FantasyPlus FantasyPlusRos FantasyPlusRosData">' + celldata + '</td><td class="playertableStat FantasyPlus FantasyPlusRos FantasyPlusRosStdevData"></td><td class="FantasyPlus sectionLeadingSpacer"></td>');
				});
			}
		}
    }
	
	function parseLeagueSettings(league_data, siteType) {
        var $ld = $(league_data);
		var settings = {};
		settings['siteType'] = siteType;
		
		if (siteType == 'espn') {
			var getValue = function(setting_name) {
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
			var league_table = $('#settings-stat-mod-table tbody td', $ld);

			var getValue = function(setting_name) {
				settingVals = [];
				settingText = league_table.filter(function(){ return $(this).text() === setting_name; }).next().first().text();
				if (settingText) {
					settingList = settingText.split(';');
					bonusDict = {};
					
					$.each(settingList, function( sindex, svalue ) {
						svalue = svalue.trim();
						if (svalue.indexOf('yards per point') > -1) {
							settingStat = 1.0 / parseFloat(svalue.split(' ')[0]);
							settingVals.push(settingStat);
						}
						else if (svalue.indexOf('points at ') > -1) {
							bonusSettingList = svalue.split(' ');
							bonusPts = parseFloat(bonusSettingList[0]);
							bonusYds = parseFloat(bonusSettingList[3]);
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
			
			var recSettings = getValue('Reception Yards');
				settings['rec_yds'] = recSettings[0] || 0;
				settings['rec_bonus'] = {};
				var recSettingsDict = recSettings[1];
					for (var k in recSettingsDict) {
						if (recSettingsDict.hasOwnProperty(k)) {
							settings['rec_bonus'][k] = recSettingsDict[k];
						}
					}
				settings['rec_att'] = getValue('Receptions')[0] || 0;
				settings['rec_tds'] = getValue('Reception Touchdowns')[0] || 0;
			
			settings['xpt'] = getValue('Point After Attempt Made')[0] || 0;
			settings['fga'] = 0;
			settings['fg'] =
				(0.6 * ((getValue('Field Goals 0-19 Yards')[0] || 0) + (getValue('Field Goals 20-29 Yards')[0] || 0) + (getValue('Field Goals 30-39 Yards')[0] || 0)) / 3.0) +
				(0.3 * (getValue('Field Goals 40-49 Yards')[0] || 0)) +
				(0.1 * (getValue('Field Goals 50+ Yards')[0] || 0));
			settings['fgm'] = 
				(0.6 * ((getValue('Field Goals Missed 0-19 Yards')[0] || 0) + (getValue('Field Goals Missed 20-29 Yards')[0] || 0) + (getValue('Field Goals Missed 30-39 Yards')[0] || 0)) / 3.0) +
				(0.3 * (getValue('Field Goals Missed 40-49 Yards')[0] || 0)) +
				(0.1 * (getValue('Field Goals Missed 50+ Yards')[0] || 0));
			
			settings['fumbles'] = getValue('Fumbles Lost')[0] || getValue('Fumbles')[0] || 0;
			
			settings['ff'] = getValue('Fumble Force')[0] || 0;
			settings['tka'] = getValue('Tackle Assist')[0] || 0;
			settings['tks'] = getValue('Tackle Solo')[0] || 0;
			settings['pd'] = getValue('Pass Defended')[0] || 0;
			
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
			
			console.log(settings);
		}
		
		return settings;
	}
	
	//Get the data from external sites
	function fetchPositionData(position, type, settings, cb) {
		var source_site = '';
		var rank_ppr = '';
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
			else {
				ros_url = '';
			}
			source_site = 'http://www.fantasypros.com/nfl/rankings/' + ros_url + rank_ppr + position + '.php?export=xls';
		}
		else if (window.off_positions_proj.indexOf(position) > -1) {
			source_site = 'http://www.fantasypros.com/nfl/projections/' + position + '.php?filters=44:45:73:152:469&export=xls';
		}
		else {
			source_site = 'http://www.fantasysharks.com/apps/bert/forecasts/projections.php?csv=1&Position=' + position;
		}
		
		$.ajax({
			url: source_site
		}).done(function(data) {
			cb(position, data.trim());
		}).fail(function() {
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
	
	function getPosProjections(settings) {
		var ready_proj = window.all_positions_proj.length;
		var type = 'proj';
		
		for (var p=0; p < window.all_positions_proj.length; p++) {
			var p_name = window.all_positions_proj[p];
			fetchPositionData(p_name, type, settings, function(p_name, raw_data) {
				var pos_name;
				var parsed_proj;
				
				if (!(raw_data == 'error')) {
					if (window.off_positions_proj.indexOf(p_name) > -1) {
						player_heading = 'Player Name';
						pos_name = p_name.toUpperCase();
						retrieved_proj = raw_data.split('\n').splice(4);
						parsed_proj = [];
						for (var t=0; t < retrieved_proj.length; t++) {
							parsed_proj[t] = retrieved_proj[t].split("\t");
						}
					}
					else {
						player_heading = 'Player';
						pos_name = window.idp_conversion[p_name];
						parsed_proj = parsesiteCSV(raw_data);
					}
					
					var headers = parsed_proj[0];
					for (var h=0; h < headers.length; h++) {
						headers[h] = headers[h].trim();
					}
					
					team_header = headers.indexOf('Team');
					player_name_header = headers.indexOf(player_heading);
					
					if ((team_header > -1) && (player_name_header > -1)) {
						for (var i=1; i < parsed_proj.length; i++) {
							var currentline = parsed_proj[i];
							
							team_name = currentline[team_header].trim();
							if (window.team_name_conversion.hasOwnProperty(team_name)) {
								team_name = window.team_name_conversion[team_name];
							}
							
							player_name = currentline[player_name_header].trim();
							
							if (window.def_positions_proj.indexOf(p_name) > -1) {
								//DST
								if (p_name == '6') {
									player_name = player_name.split(',')[0] + ' D/ST';
									team_name = "-";
								}
								//Other IDPs, reversing names
								else {
									player_name = player_name.split(',')[1] + " " + player_name.split(',')[0]
								}
								
								player_name = player_name.trim();
							}
							
							// Add team and position to player_name for differentiating duplicate names
							full_name = player_name + "|" + pos_name + "|" + team_name;
							
							if (!window.alldata.hasOwnProperty(full_name)) {
								window.alldata[full_name] = {};
							}
							
							for (var j = player_name_header + 1; j < headers.length - 1; j++) {
								window.alldata[full_name][headers[j].trim()] = currentline[j].trim();
							}
						}
					}
				}
				
				ready_proj = ready_proj - 1;
				if (ready_proj == 0) {
					addProjections(settings);
				}
			});
		}
	}
	
	function getPosRankings(settings) {
		var ready_rank = window.all_positions_rank.length;
		var type = 'rank';
		
		for (var p=0; p < window.all_positions_rank.length; p++) {
			var p_name = window.all_positions_rank[p];
			fetchPositionData(p_name, type, settings, function(p_name, raw_data) {
				var pos_name;
				var parsed_rank;
				
				if (!(raw_data == 'error')) {
					player_heading = 'Player Name';
					pos_name = p_name.toUpperCase();
					retrieved_rank = raw_data.split('\n').splice(4);
					parsed_rank = [];
					for (var t=0; t < retrieved_rank.length; t++) {
						parsed_rank[t] = retrieved_rank[t].split("\t");
					}
					
					var headers = parsed_rank[0];
					for (var h=0; h < headers.length; h++) {
						headers[h] = headers[h].trim();
					}
					
					team_header = headers.indexOf('Team');
					player_name_header = headers.indexOf(player_heading);
					
					if ((team_header > -1) && (player_name_header > -1)) {
						for (var i=1; i < parsed_rank.length; i++) {
							var currentline = parsed_rank[i];
							
							team_name = currentline[team_header].trim();
							if (window.team_name_conversion.hasOwnProperty(team_name)) {
								team_name = window.team_name_conversion[team_name];
							}
							
							player_name = currentline[player_name_header].trim();
							
							if (p_name == 'dst') {
								player_name = player_name.split(' ').pop() + ' D/ST';
								pos_name = 'D/ST';
								team_name = "-";
							}
							
							player_name = player_name.trim();
							
							// Add team and position to player_name for differentiating duplicate names
							full_name = player_name + "|" + pos_name + "|" + team_name;
							
							if (!window.alldata.hasOwnProperty(full_name)) {
								window.alldata[full_name] = {};
							}
							
							for (var j = player_name_header + 3; j < headers.length - 1; j++) {
								window.alldata[full_name][headers[j].trim()] = currentline[j].trim();
							}
						}
					}
				}
				
				ready_rank = ready_rank - 1;
				if (ready_rank == 0) {
					addRankings(settings);
				}
			});
		}
	}
	
	function getRosRankings(settings) {
		var ready_ros = window.all_positions_rank.length;
		var type = 'ros';
		
		for (var p=0; p < window.all_positions_rank.length; p++) {
			var p_name = window.all_positions_rank[p];
			fetchPositionData(p_name, type, settings, function(p_name, raw_data) {
				var pos_name;
				var parsed_rank;
				
				if (!(raw_data == 'error')) {
					player_heading = 'Player Name';
					pos_name = p_name.toUpperCase();
					retrieved_rank = raw_data.split('\n').splice(4);
					parsed_rank = [];
					for (var t=0; t < retrieved_rank.length; t++) {
						parsed_rank[t] = retrieved_rank[t].split("\t");
					}
					
					var headers = parsed_rank[0];
					for (var h=0; h < headers.length; h++) {
						headers[h] = headers[h].trim();
					}
					
					team_header = headers.indexOf('Team');
					player_name_header = headers.indexOf(player_heading);
					
					if ((team_header > -1) && (player_name_header > -1)) {
						for (var i=1; i < parsed_rank.length; i++) {
							var currentline = parsed_rank[i];
							
							team_name = currentline[team_header].trim();
							if (window.team_name_conversion.hasOwnProperty(team_name)) {
								team_name = window.team_name_conversion[team_name];
							}
							
							player_name = currentline[player_name_header].trim();
							
							if (p_name == 'dst') {
								player_name = player_name.split(' ').pop() + ' D/ST';
								pos_name = 'D/ST';
								team_name = "-";
							}
							
							player_name = player_name.trim();
							
							// Add team and position to player_name for differentiating duplicate names
							full_name = player_name + "|" + pos_name + "|" + team_name;
							
							if (!window.alldata.hasOwnProperty(full_name)) {
								window.alldata[full_name] = {};
							}
							
							for (var j = player_name_header + 3; j < headers.length - 1; j++) {
								window.alldata[full_name][headers[j].trim() + ' Ros'] = currentline[j].trim();
							}
						}
					}
				}
				
				ready_ros = ready_ros - 1;
				if (ready_ros == 0) {
					addRos(settings);
				}
			});
		}
	}
	
	function getData(settings) {
		getPosProjections(settings);
		getPosRankings(settings);
		getRosRankings(settings);
	}

	function calcBonus(settings, bonus_type) {
		var b_list = [];
		var adj = 0;
		for (var k in settings[bonus_type + '_bonus']) {
			if (passSettingsDict.hasOwnProperty(k)) {
				b_list.push(k);
			}
		}
		b_list = b_list.sort().reverse();
		for (var b=0; b < b_list.length; b++) {
			if (parseFloat(b_list[b+1])) {
				adj += (settings[bonus_type + '_bonus'][b_list[b]] * (b_list[b] <= player_data[bonus_type + '_yds'] && player_data[bonus_type + '_yds'] < b_list[b+1]));
			}
			else {
				adj += (settings[bonus_type + '_bonus'][b_list[b]] * (player_data[bonus_type + '_yds'] >= b_list[b]));
			}
		}
		return adj;
	}
	
	function calculateProjections(settings, datatype, player_name, pos_name, team_name) {
		// get their projected data from window.alldata
		// multiply it by the league settings
		full_name = player_name + "|" + pos_name + "|" + team_name;
		player_data = window.alldata[full_name];

		if (typeof(player_data) === "undefined") {
			if (player_name == 'Steve Smith Sr.') {
				player_name = 'Steve Smith';
			}
			else if (player_name == 'EJ Manuel') {
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
			else if (player_name == 'Cecil Shorts III') {
				player_name = 'Cecil Shorts';
			}
			else if (player_name == 'D\'Qwell Jackson') {
				player_name = 'D\'qwell Jackson';
			}
			else if (player_name == 'DeMarcus Ware') {
				player_name = 'Demarcus Ware';
			}
			else if (player_name == 'Robert Griffin') {
				player_name = 'Robert Griffin III';
			}
			else if (player_name.split(' ')[0] == 'Chris') {
				player_name = 'Christopher ' + player_name.split(' ').slice(1).join(' ');
			}
			else if (player_name.split(' ')[0] == 'Christopher') {
				player_name = 'Chris ' + player_name.split(' ').slice(1).join(' ');
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
			else {
				return("?");
			}

			full_name = player_name + "|" + pos_name + "|" + team_name;

			// For multi-position players
			if (player_name == 'Dexter McCluster') {
				full_name = 'Dexter McCluster|RB|TEN';
			}

			player_data = window.alldata[full_name];
			if (typeof(player_data) === "undefined") {
				return("?");
			}
		}

		//console.log(player_data);
		if (datatype == 'proj') {
			var player_score =
				settings['pass_yds'] * (player_data['pass_yds'] || 0) +
				settings['pass_tds'] * (player_data['pass_tds'] || 0) +
				settings['pass_ints'] * (player_data['pass_ints'] || 0) +
				settings['pass_att'] * (player_data['pass_att'] || 0) +
				settings['pass_cmp'] * (player_data['pass_cmp'] || 0) +
				settings['pass_icmp'] * ((player_data['pass_att'] || 0) - (player_data['pass_cmp'] || 0)) +

				settings['rush_yds'] * (player_data['rush_yds'] || 0) +
				settings['rush_tds'] * (player_data['rush_tds'] || 0) +
				settings['rush_att'] * (player_data['rush_att'] || 0) +
				
				settings['rec_yds'] * (player_data['rec_yds'] || 0) +
				settings['rec_att'] * (player_data['rec_att'] || 0) +
				settings['rec_tds'] * (player_data['rec_tds'] || 0) +
				
				settings['xpt'] * (player_data['xpt'] || 0) +
				settings['fg'] * (player_data['fg'] || 0) +
				settings['fga'] * (player_data['fga'] || 0) +
				settings['fgm'] * ((player_data['fga'] || 0) - (player_data['fg'] || 0)) +

				settings['fumbles'] * (player_data['fumbles'] || 0) +

				settings['sk'] * (player_data['Scks'] || 0) +
				settings['ff'] * (player_data['FumFrc'] || 0) +
				settings['tka'] * (player_data['Tack'] || 0) +
				settings['tks'] * (player_data['Asst'] || 0) +
				settings['pd'] * (player_data['PassDef'] || 0) +
				settings['int'] * (player_data['Int'] || 0) +
				settings['deftd'] * (player_data['DefTD'] || 0) +
				settings['fr'] * (player_data['Fum'] || 0) +

				settings['pa'] * (player_data['Pts Agn'] || 0) +
				settings['pa0'] * (player_data['Pts Agn'] == 0) +
				settings['pa1'] * (0 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 6) +
				settings['pa7'] * (6 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 13) +
				settings['pa28'] * (27 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 34) +
				
				settings['ya'] * (player_data['Yds Allowed'] || 0) +
				settings['ya100'] * (0 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 100) +
				settings['ya199'] * (100 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 200) +
				settings['ya299'] * (200 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 300);
			
			if (settings['siteType'] == 'espn') {
				var player_adjustment =
					settings['pass_300_bonus'] * (300 <= player_data['pass_yds'] && player_data['pass_yds'] < 400) +
					settings['pass_400_bonus'] * ((player_data['pass_yds'] || 0) >= 400) +
					settings['rush_100_bonus'] * (100 <= player_data['rush_yds'] && player_data['rush_yds'] < 200) +
					settings['rush_200_bonus'] * ((player_data['rush_yds'] || 0) >= 200) +
					settings['rec_100_bonus'] * (100 <= player_data['rec_yds'] && player_data['rec_yds'] < 200) +
					settings['rec_200_bonus'] * ((player_data['rec_yds'] || 0) >= 200) +
					
					settings['pa14'] * (13 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 17) +
					settings['pa18'] * (17 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 21) +
					settings['pa22'] * (21 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 27) +
					settings['pa35'] * (34 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 45) +
					settings['pa46'] * (45 < player_data['Pts Agn']) +
					
					settings['ya349'] * (300 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 350) +
					settings['ya399'] * (350 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 400) +
					settings['ya449'] * (400 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 450) +
					settings['ya499'] * (450 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 500) +
					settings['ya549'] * (500 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 550) +
					settings['ya550'] * (550 <= player_data['Yds Allowed']);
			}
			else if (settings['siteType'] == 'yahoo') {
				var player_adjustment =
					calcBonus(settings, 'pass') +
					calcBonus(settings, 'rush') +
					calcBonus(settings, 'rec') +
					
					settings['pa14'] * (13 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 20) +
					settings['pa21'] * (20 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 27) +
					settings['pa35'] * (34 < player_data['Pts Agn']) +
					
					settings['ya399'] * (300 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 400) +
					settings['ya499'] * (400 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 500) +
					settings['ya500'] * (500 <= player_data['Yds Allowed']);
			}
				
			//console.log(player_score);
			player_score += player_adjustment;
			//console.log(player_score);
			return (Math.round(player_score * 10) / 10).toFixed(1);
		}
		else if (datatype == 'rank') {
			if (parseFloat(player_data['Avg Rank'])) {
				player_rank = (Math.round(player_data['Avg Rank'] * 10) / 10).toFixed(1);
				player_stdev = (Math.round(player_data['Std Dev'] * 10 * 1.96) / 10).toFixed(1);
				return [player_rank, player_stdev];
			}
			else {
				return ['?', '?'];
			}
		}
		else if (datatype == 'ros') {
			if (parseFloat(player_data['Avg Rank Ros'])) {
				player_ros = (Math.round(player_data['Avg Rank Ros'] * 10) / 10).toFixed(1);
				player_ros_stdev = (Math.round(player_data['Std Dev Ros'] * 10 * 1.96) / 10).toFixed(1);
				return [player_ros, player_ros_stdev];
			}
			else {
				return ['?', '?'];
			}
		}
	}
	
    function getProjectionData(settings, datatype, currRow) {
        var player_cell = currRow.find('td.playertablePlayerName');
		var player_cell_text = '';
		
		//This is stupid, but.......whatever.
		if (player_cell.find('.fantasy-finder')) {
			player_cell = player_cell.clone();
			player_cell.find('#inline-availability-marker').remove();
			player_cell_text = player_cell.text().replace(/(\r|\n)/g, '');
		}
		else {
			player_cell_text = player_cell.text();
		}
		
		if (!player_cell_text) {
			return "--";
		}
		
        else if (player_cell_text.match(/(TQB|HC)$/)) { // can't project head coaches or TQB's
            return "--";
        }

        else if (player_cell_text.indexOf('D/ST') > -1) {
            var player_name = player_cell.find('a').text().trim();
            var team_name = "-";
            var pos_name = 'D/ST';
        }

        else {
            var player_name = player_cell_text.split(",")[0];
            var team_pos = player_cell_text.split(",")[1].split(/\s|\xa0/);
            var team_name = team_pos[1].toUpperCase();
            var pos_name = team_pos[2];
            if ((pos_name == 'DT') || (pos_name == 'DE')) {
                pos_name = 'DL';
            }
            else if ((pos_name == 'CB') || (pos_name == 'S')) {
                pos_name = 'DB';
            }
        }
        player_name = player_name.replace('*', '');

		return calculateProjections(settings, datatype, player_name, pos_name, team_name);
    }

	function addAllData(settings) {
		var proj_head = $('[id^=playertable_] tbody tr.playerTableBgRowSubhead').find('td:contains(PROJ), td:contains(ESPN)');
        var header_index = proj_head.first().index();
		
		if (header_index > -1) {
			addProjections(settings);
			addRankings(settings);
			addRos(settings);
		}
	}
	
    function addProjections(settings) {
		var datatype = 'proj';
		
		var playerTable = $('[id^=playertable_] tbody');
        playerTable.find('.FantasyPlusProjectionsData').each(function() {
            var cell = $(this);
            var currRow = cell.parent();

            var byeweek_text = currRow.find('td:contains("** BYE **")');
			var isByeWeek = (byeweek_text.length > 0);
			if (onMatchupPreviewPage) {
				byeweek_text.html('<span style="color:#999999">BYE</span>');
			}
            
            var projectedPoints = isByeWeek ? "--" : getProjectionData(settings, datatype, currRow);
            cell.text(projectedPoints);
        });

        if (onClubhousePage) {
            var header_rows = playerTable.find('tr.playerTableBgRowHead');
            var sumTotal;
            var sumTotalESPN;
            var keepAdding;
            var currHeaderRow;
            var headerType;
            var sumpts = 0;
            var sumptsESPN = 0;

            header_rows.each(function() {
                currHeaderRow = $(this);
                headerType = currHeaderRow.find('th.playertableSectionHeaderFirst').text();
                keepAdding = true;
                sumTotal = 0;
                sumTotalESPN = 0;

                if (headerType == 'STARTERS' || headerType == 'BENCH') {
                    while (keepAdding) {
                        currHeaderRow = currHeaderRow.next();
                        if (currHeaderRow.hasClass('playerTableBgRowSubhead')) {
            				td_length = currHeaderRow.find('td').length;
                        }
                        else if (currHeaderRow.hasClass('pncPlayerRow') && !currHeaderRow.hasClass('emptyRow')) {
                            proj_cell = currHeaderRow.find('.FantasyPlusProjectionsData');
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
                    if (td_length == (17 + custom_cols)) {
                      extra_td = '<td></td>';
                    }
                    else {
                      extra_td = '';
                    }
					
					//gonna have to edit this too when its automatic
                    currHeaderRow.before('<tr class="pncPlayerRow playerTableBgRow0 FantasyPlus FantasyPlusProjections"><td class="playerSlot" style="font-weight: bold;">Total</td><td></td>' + extra_td + '<td class="sectionLeadingSpacer"></td><td></td><td></td><td class="sectionLeadingSpacer"></td><td></td><td></td><td></td><td></td><td class="sectionLeadingSpacer"></td><td class="playertableStat">' + Math.round(sumTotalESPN * 100) / 100 + '</td><td class="playertableStat">' + Math.round(sumTotal * 100) / 100 + '</td><td class="sectionLeadingSpacer"></td><td></td><td></td><td></td><td></td><td class="sectionLeadingSpacer"></td><td></td><td></td><td></td><td></td></tr>');
                }
            });
        }
        else if (onMatchupPreviewPage) {
            var matchup_tables = $('.playerTableTable');
            var datapoints;
            var matchup_total;

            matchup_tables.each(function() {
                var currTable = $(this);
                datapoints = currTable.find('.FantasyPlusProjectionsData');
				
				if (datapoints.length > 0) {
					matchup_total = 0;
					datapoints.each(function() {
						var value = parseFloat($(this).text());
						if (value) {
							matchup_total = parseFloat(matchup_total + value);
						}
					});
					
					currTable.next().prepend('<div class="danglerBox totalScore">' + Math.round(matchup_total) + '</div>');
				}
            });
        }
		
		projDone.resolve();
	}
	
	function addRankings(settings) {
		var datatype = 'rank';
		
		var playerTable = $('[id^=playertable_] tbody');
        playerTable.find('.FantasyPlusRankingsData').each(function() {
            var cell = $(this);
            var currRow = cell.parent();

            var byeweek_text = currRow.find('td:contains("** BYE **")');
            var isByeWeek = (byeweek_text.length > 0);
			
			var projectedRanking = "--";
            if (isByeWeek) {
				cell.text(projectedRanking);
				cell.next().text(projectedRanking);
			}
			else {
				projectedRanking = getProjectionData(settings, datatype, currRow);
				if (projectedRanking[0] == "?") {
					cell.text("?");
					cell.next().text("?");
				}
				else if (projectedRanking == "--") {
					cell.text("--");
					cell.next().html("--");
				}
				else {
					cell.text(projectedRanking[0]);
					cell.next().html('<span style="font-size: 80%;">±</span>' + projectedRanking[1]);
				}
			}
        });

		rankDone.resolve();
	}
	
	function addRos(settings) {
		var datatype = 'ros';
		
		var playerTable = $('[id^=playertable_] tbody');
        playerTable.find('.FantasyPlusRosData').each(function() {
            var cell = $(this);
            var currRow = cell.parent();
			
            var projectedRos = getProjectionData(settings, datatype, currRow);
            if (projectedRos[0] == "?") {
				cell.text("?");
				cell.next().text("?");
			}
			else {
				projectedRos = getProjectionData(settings, datatype, currRow);
				if (projectedRos[0] == "?") {
					cell.text("?");
					cell.next().text("?");
				}
				else if (projectedRos == "--") {
					cell.text("--");
					cell.next().html("--");
				}
				else {
					cell.text(projectedRos[0]);
					cell.next().html('<span style="font-size: 80%;">±</span>' + projectedRos[1]);
				}
			}
        });
		
		rosDone.resolve();
	}
	
	function watchForChanges(settings) {
		if (hasPlayerTable) {
			var observerConfig = {
				childList: true,
				characterData: true,
				subtree: true
			};
			var target_observe = document.querySelector('.playerTableContainerDiv');
			var observerESPN = new MutationObserver(function (mutations) {
				observerESPN.disconnect();
				if (mutations.length > 0) {
                    $('.FantasyPlus').remove();
					addColumns();
					addAllData(settings);
				}
				observerESPN.observe(target_observe, observerConfig);
			});
			observerESPN.observe(target_observe, observerConfig);
		}
	}
});
