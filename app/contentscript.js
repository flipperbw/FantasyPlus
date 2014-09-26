/*-- TODO
- can do pts, avg, last for total rows
- Add standard deviation, ranking, injury adjusted average points, somehow adjust OPRK for shitty teams, snap %
- Fix bottom column on matchuppreview
- Somehow do all 9 requests at once
- debug/verbose mode
- cache the data for a few hours
- yahoo support / nfl / fleaflicker / myfantasyleague
- return yardage
- firefox/safari
- sortable? doubt it
- option to disable/add
- option for experts
*/

/*
var tag = document.createElement("script");
tag.type="text/javascript";
tag.src = "http://code.$uery.com/$uery-latest.min.js";
document.body.appendChild(tag);
*/

var league_id = document.URL.match(/leagueId=(\d+)/)[1];
var onMatchupPreviewPage = document.URL.match(/ffl\/matchuppreview/);
var hasPlayerTable = document.URL.match(/ffl\/(freeagency|clubhouse|dropplayers|rosterfix)/);
var onClubhousePage = document.URL.match(/ffl\/(clubhouse|dropplayers)/);


$(document).ready(function () {
	// GLOBALS
	window.alldata = {};
	
	window.positions = ['qb', 'rb', 'wr', 'te', 'k'];
	window.idp_positions = ['6','8','9','10'];
	window.all_positions = window.positions.concat(window.idp_positions);
	
	window.idp_conversion = {'6': 'D/ST', '8': 'DL', '9': 'LB', '10': 'DB'};
	window.team_name_conversion = {'ARZ': 'ARI', 'GBP': 'GB', 'KCC': 'KC', 'NEP': 'NE', 'NOR': 'NO', 'SDC': 'SD', 'SFO': 'SF', 'TBB': 'TB', 'WAS': 'WSH'};
	
	//Get League Settings
    var playerTable = $('[id^=playertable_] tbody');
	$.get('http://games.espn.go.com/ffl/leaguesetup/sections/scoring', {"leagueId": league_id}, function(d) {

        var hasProjectionTable = playerTable.find('tr.playerTableBgRowSubhead td:contains(PROJ)').length > 0;

        if(hasProjectionTable) {
            addColumn();
            parse_data(d);
        }
	});
	
	function parse_data(league_data) {
        var $ld = $(league_data);
        function getValue(setting_name) {
            return parseFloat($ld.find("td:contains('" + setting_name + "')").next().first().text());
        }

        window.league_settings = {};

        window.league_settings['pass_yds'] =
            getValue('Passing Yards (PY)') ||
            getValue('(PY5)') / 5.0 ||
            getValue('(PY10)') / 10.0 ||
            getValue('(PY20)') / 20.0 ||
            getValue('(PY25)') / 25.0 ||
            getValue('(PY50)') / 50.0 ||
            getValue('(PY100)') / 100.0 || 0;

        window.league_settings['pass_tds'] = getValue('TD Pass (PTD)') || 0;
        window.league_settings['pass_ints'] = getValue('Interceptions Thrown (INT)') || 0;
        window.league_settings['pass_cmp'] = getValue('Each Pass Completed (PC)') ||
            getValue('(PC5)') / 5.0 ||
            getValue('(PC10)') / 10.0 || 0;
        window.league_settings['pass_icmp'] =
             getValue('Each Incomplete Pass (INC)') ||
            getValue('(IP5)') / 5.0 ||
            getValue('(IP10)') / 10.0 || 0;
        window.league_settings['pass_att'] = getValue('Each Pass Attempted (PA)') || 0;
        window.league_settings['pass_300_bonus'] = getValue('300-399 yard passing game (P300)') || 0;
        window.league_settings['pass_400_bonus'] = getValue('400+ yard passing game (P400)') || 0;

        window.league_settings['rush_yds'] = getValue('Rushing Yards (RY)') ||

            getValue('(RY5)') / 5.0 ||
            getValue('Every 10 rushing yards (RY10)') / 10.0 ||
            getValue('(RY20)') / 20.0 ||
            getValue('(RY25)') / 25.0 ||
            getValue('(RY50)') / 50.0 ||
            getValue('(RY100)') / 100.0 || 0;
        window.league_settings['rush_att'] = getValue('Rushing Attempts (RA)') ||
            getValue('(RA5)') / 5.0 ||
            getValue('(RA10)') / 10.0 || 0;
        window.league_settings['rush_tds'] = getValue('TD Rush (RTD)') || 0;
        window.league_settings['rush_100_bonus'] = getValue('100-199 yard rushing game (RY100)') || 0;
        window.league_settings['rush_200_bonus'] = getValue('200+ yard rushing game (RY200)') || 0;

        window.league_settings['rec_yds'] =
            getValue('Receiving Yards (REY)') ||
            getValue('Every 5 receiving yards (REY5)') / 5.0 ||
            getValue('(REY10)') / 10.0 ||
            getValue('(REY20)') / 20.0 ||
            getValue('(REY25)') / 25.0 ||
            getValue('(REY50)') / 50.0 ||
            getValue('(REY50)') / 100.0 || 0;
        window.league_settings['rec_att'] =
            getValue('Each reception (REC)') ||
            getValue('(REC5)') / 5.0 ||
            getValue('(REC10)') / 10.0 || 0;
        window.league_settings['rec_tds'] = getValue('TD Reception (RETD)') || 0;
        window.league_settings['rec_100_bonus'] = getValue('100-199 yard receiving game (REY100)') || 0;
        window.league_settings['rec_200_bonus'] = getValue('200+ yard receiving game (REY200)') || 0;
        //Receiving Target (RET)

        window.league_settings['xpt'] = getValue('Each PAT Made (PAT)') || 0;
        window.league_settings['fgm'] = getValue('Total FG Missed (FGM)') || 0;
        window.league_settings['fga'] = getValue('Total FG Attempted (FGA)') || 0;
        window.league_settings['fg'] = getValue('Total FG Made (FG)') || 0;
        window.league_settings['fg_0'] = getValue('FG Made (0-39 yards) (FG0)') || 0;
        window.league_settings['fg_40'] = getValue('FG Made (40-49 yards) (FG40)') || 0;
        window.league_settings['fg_50'] = getValue('FG Made (50+ yards) (FG50)') || 0;
        //Each PAT Attempted (PATA)

        window.league_settings['fumbles'] = getValue('Total Fumbles Lost (FUML)') || 0;

        window.league_settings['ff'] = getValue('Each Fumble Forced (FF)') || 0;
        window.league_settings['tka'] = getValue('Assisted Tackles (TKA)') || 0;
        window.league_settings['tks'] = getValue('Solo Tackles (TKS)') || 0;
        window.league_settings['pd'] = getValue('Passes Defensed (PD)') || 0;

        window.league_settings['int'] = getValue('Each Interception (INT)') || 0;
        window.league_settings['deftd'] = getValue('Interception Return TD (INTTD)') || 0;
        window.league_settings['fr'] = getValue('Each Fumble Recovered (FR)') || 0;
        window.league_settings['sk'] =
            getValue('Each Sack (SK)') ||
            getValue('1/2 Sack (HALFSK)') * 2 || 0;

        window.league_settings['pa'] = getValue('Points Allowed (PA)') || 0;
        window.league_settings['pa0'] = getValue('0 points allowed (PA0)') || 0;
        window.league_settings['pa1'] = getValue('1-6 points allowed (PA1)') || 0;
        window.league_settings['pa7'] = getValue('7-13 points allowed (PA7)') || 0;
        window.league_settings['pa14'] = getValue('14-17 points allowed (PA14)') || 0;
        window.league_settings['pa18'] = getValue('18-21 points allowed (PA18)') || 0;
        window.league_settings['pa22'] = getValue('22-27 points allowed (PA22)') || 0;
        window.league_settings['pa28'] = getValue('28-34 points allowed (PA28)') || 0;
        window.league_settings['pa35'] = getValue('35-45 points allowed (PA35)') || 0;
        window.league_settings['pa46'] = getValue('46+ points allowed (PA46)') || 0;

        window.league_settings['ya'] = getValue('Yards Allowed (YA)') || 0;
        window.league_settings['ya100'] = getValue('Less than 100 total yards allowed (YA100)') || 0;
        window.league_settings['ya199'] = getValue('100-199 total yards allowed (YA199)') || 0;
        window.league_settings['ya299'] = getValue('200-299 total yards allowed (YA299)') || 0;
        window.league_settings['ya349'] = getValue('300-349 total yards allowed (YA349)') || 0;
        window.league_settings['ya399'] = getValue('350-399 total yards allowed (YA399)') || 0;
        window.league_settings['ya449'] = getValue('400-449 total yards allowed (YA449)') || 0;
        window.league_settings['ya499'] = getValue('450-499 total yards allowed (YA499)') || 0;
        window.league_settings['ya549'] = getValue('500-549 total yards allowed (YA549)') || 0;
        window.league_settings['ya550'] = getValue('550+ total yards allowed (YA550)') || 0;


		getPosProjections();
	}
	
	//Get the data from external sites
	function fetchPositionProjections(position, cb) {
		var source_site = '';
		if (window.positions.indexOf(position) > -1) {
			source_site = 'http://www.fantasypros.com/nfl/projections/' + position + '.php?filters=44:45:73:152:469&export=xls';
		}
		else {
			source_site = 'http://www.fantasysharks.com/apps/bert/forecasts/projections.php?csv=1&Position=' + position;
		}
		
		$.get(source_site, function(data) {
			cb(position, data.trim());
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
	
	function getPosProjections() {
		var ready = window.all_positions.length;
		
		for (var p=0; p < window.all_positions.length; p++) {
			var p_name = window.all_positions[p];
			fetchPositionProjections(p_name, function(p_name, raw_data) {
				var pos_name;
				var parsed_proj;
				
				if (window.positions.indexOf(p_name) > -1) {
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
				
				for (var i=1; i < parsed_proj.length; i++) {
					var playerdata = {};
					var currentline = parsed_proj[i];
					
					team_name = currentline[team_header].trim();
					if (window.team_name_conversion.hasOwnProperty(team_name)) {
						team_name = window.team_name_conversion[team_name];
					}
					
					player_name = currentline[player_name_header].trim();
					
					if (window.idp_positions.indexOf(p_name) > -1) {
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
					
					for (var j = player_name_header + 1; j < headers.length - 1; j++) {
						playerdata[headers[j].trim()] = currentline[j].trim();
					}
					
					window.alldata[full_name] = playerdata;
				}
				
				ready = ready - 1;
				if (ready == 0) {
					prepareAddProjections();
				}
			});
		}
	}

	function calculateProjections(player_name, pos_name, team_name) {
		// get their projected data from window.alldata
		// multiply it by the league settings
		full_name = player_name + "|" + pos_name + "|" + team_name;
		
		player_data = window.alldata[full_name]

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
				return("??");
			}

			full_name = player_name + "|" + pos_name + "|" + team_name;
			player_data = window.alldata[full_name];
			if (typeof(player_data) === "undefined") {
				return("??");
			}
		}

		//console.log(player_data);

		player_score =
			window.league_settings['pass_yds'] * (player_data['pass_yds'] || 0) +
			window.league_settings['pass_tds'] * (player_data['pass_tds'] || 0) +
			window.league_settings['pass_ints'] * (player_data['pass_ints'] || 0) +
			window.league_settings['pass_att'] * (player_data['pass_att'] || 0) +
			window.league_settings['pass_cmp'] * (player_data['pass_cmp'] || 0) +
			window.league_settings['pass_icmp'] * ((player_data['pass_att'] || 0) - (player_data['pass_cmp'] || 0)) +
			window.league_settings['pass_300_bonus'] * (300 <= player_data['pass_yds'] && player_data['pass_yds'] < 400) +
			window.league_settings['pass_400_bonus'] * ((player_data['pass_yds'] || 0) >= 400) +

			window.league_settings['rush_yds'] * (player_data['rush_yds'] || 0) +
			window.league_settings['rush_tds'] * (player_data['rush_tds'] || 0) +
			window.league_settings['rush_att'] * (player_data['rush_att'] || 0) +
			window.league_settings['rush_100_bonus'] * (100 <= player_data['rush_yds'] && player_data['rush_yds'] < 200) +
			window.league_settings['rush_200_bonus'] * ((player_data['rush_yds'] || 0) >= 200) +

			window.league_settings['rec_yds'] * (player_data['rec_yds'] || 0) +
			window.league_settings['rec_att'] * (player_data['rec_att'] || 0) +
			window.league_settings['rec_tds'] * (player_data['rec_tds'] || 0) +
			window.league_settings['rec_100_bonus'] * (100 <= player_data['rec_yds'] && player_data['rec_yds'] < 200) +
			window.league_settings['rec_200_bonus'] * ((player_data['rec_yds'] || 0) >= 200) +

			window.league_settings['xpt'] * (player_data['xpt'] || 0) +
			window.league_settings['fg'] * (player_data['fg'] || 0) +
			((0.6 * (window.league_settings['fg_0'] || 3)) + (0.3 * (window.league_settings['fg_40'] || 3)) + (0.1 * (window.league_settings['fg_50'] || 3))) * (player_data['fg'] || 0) +
			window.league_settings['fga'] * (player_data['fga'] || 0) +
			window.league_settings['fgm'] * ((player_data['fga'] || 0) - (player_data['fg'] || 0)) +

			window.league_settings['fumbles'] * (player_data['fumbles'] || 0) +

			window.league_settings['sk'] * (player_data['Scks'] || 0) +
			window.league_settings['ff'] * (player_data['FumFrc'] || 0) +
			window.league_settings['tka'] * (player_data['Tack'] || 0) +
			window.league_settings['tks'] * (player_data['Asst'] || 0) +
			window.league_settings['pd'] * (player_data['PassDef'] || 0) +
			window.league_settings['int'] * (player_data['Int'] || 0) +
			window.league_settings['deftd'] * (player_data['DefTD'] || 0) +
			window.league_settings['fr'] * (player_data['Fum'] || 0) +

			window.league_settings['pa'] * (player_data['Pts Agn'] || 0) +
			window.league_settings['pa0'] * (player_data['Pts Agn'] == 0) +
			window.league_settings['pa1'] * (0 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 6) +
			window.league_settings['pa7'] * (6 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 13) +
			window.league_settings['pa14'] * (13 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 17) +
			window.league_settings['pa18'] * (17 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 21) +
			window.league_settings['pa22'] * (21 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 27) +
			window.league_settings['pa28'] * (27 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 34) +
			window.league_settings['pa35'] * (34 < player_data['Pts Agn'] && player_data['Pts Agn'] <= 45) +
			window.league_settings['pa46'] * (45 < player_data['Pts Agn']) +

			window.league_settings['ya'] * (player_data['Yds Allowed'] || 0) +
			window.league_settings['ya100'] * (0 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 100) +
			window.league_settings['ya199'] * (100 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 200) +
			window.league_settings['ya299'] * (200 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 300) +
			window.league_settings['ya349'] * (300 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 350) +
			window.league_settings['ya399'] * (350 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 400) +
			window.league_settings['ya449'] * (400 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 450) +
			window.league_settings['ya499'] * (450 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 500) +
			window.league_settings['ya549'] * (500 <= player_data['Yds Allowed'] && player_data['Yds Allowed'] < 550) +
			window.league_settings['ya550'] * (550 <= player_data['Yds Allowed']);

		//console.log(player_score);
		return(Math.round(player_score * 100) / 100);
	}
	
	function prepareAddProjections() {
		addProjections();
		
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
                    $('.ExtraProjectionsFantasypros').remove();
                    addColumn();
					addProjections();
				}
				observerESPN.observe(target_observe, observerConfig);
			});
			observerESPN.observe(target_observe, observerConfig);
		}
	}

    function addColumn() {
        var proj_head = $('tr.playerTableBgRowSubhead td:contains(PROJ)');
        var header_index = proj_head.first().index();

        proj_head.after('<td class="playertableStat ExtraProjectionsFantasypros ExtraProjectionsFantasyprosHeader">FPros</td>');

        $('.playerTableBgRowHead.tableHead.playertableSectionHeader').find('th:last').attr('colspan', 6);

        playerTable.find('tr.pncPlayerRow:not(.emptyRow)').each(function () {
            var currRow = $(this);
            var byeweek = playerTable.find('tr.playerTableBgRowSubhead td:contains(OPP)').first().index();
            var byeweek_text = currRow.find('td').eq(byeweek).text();
            var adj_header_index = (byeweek_text == "** BYE **" ? header_index - 1 : header_index);

            currRow.find('td').eq(adj_header_index).after('<td class="playertableStat ExtraProjectionsFantasypros ExtraProjectionsFantasyprosData">...</td>');
        });
    }

    function getProjectedPoints(currRow) {
        var player_cell = currRow.find('td.playertablePlayerName');
        var player_cell_text = player_cell.text();

        if (player_cell_text.match(/(O|IR)$/)) { // player is Out
            return "0";
        }

        if (player_cell_text.match(/(TQB|HC)$/)) { // can't project head coaches or TQB's
            return "--";
        }

        if (player_cell_text.indexOf('D/ST') > -1) {
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

        return calculateProjections(player_name, pos_name, team_name);
    }

    function addProjections() {
        playerTable.find('.ExtraProjectionsFantasyprosData').each(function() {
            var cell = $(this);
            var currRow = cell.parent();

            var byeweek_text = currRow.find('td.sectionLeadingSpacer ~ td:first').text();
            var isByeWeek = !byeweek_text || byeweek_text == "** BYE **";

            var projectedPoints = isByeWeek ? "--" : getProjectedPoints(currRow);
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
                            proj_cell = currHeaderRow.find('.ExtraProjectionsFantasyprosData');
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
                    // I should fix this to make it more automatic...
                    if (td_length == 18) {
                      extra_td = '<td></td>';
                    }
                    else {
                      extra_td = '';
                    }
                    currHeaderRow.before('<tr class="pncPlayerRow playerTableBgRow0 ExtraProjectionsFantasypros"><td class="playerSlot" style="font-weight: bold;">Total</td><td></td>' + extra_td + '<td class="sectionLeadingSpacer"></td><td></td><td></td><td class="sectionLeadingSpacer"></td><td></td><td></td><td></td><td></td><td class="sectionLeadingSpacer"></td><td class="playertableStat">' + Math.round(sumTotalESPN * 100) / 100 + '</td><td class="playertableStat">' + Math.round(sumTotal * 100) / 100 + '</td><td></td><td></td><td></td><td></td></tr>');
                }
            });
        }
        else if (onMatchupPreviewPage) {
            var matchup_tables = $('.playerTableTable');
            var datapoints;
            var matchup_total;

            matchup_tables.each(function() {
                var currTable = $(this);
                datapoints = currTable.find('.ExtraProjectionsFantasyprosData');

                matchup_total = 0;
                datapoints.each(function() {
                    var value = parseFloat($(this).text());
                    if (value) {
                        matchup_total = parseFloat(matchup_total + value);
                    }
                });

                currTable.next().prepend('<div class="danglerBox totalScore">' + Math.round(matchup_total) + '</div>');
            });
        }
	}
});
