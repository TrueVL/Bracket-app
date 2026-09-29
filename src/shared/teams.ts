import type { LeagueId, Slot, Team, Template } from './types';

export interface LeagueTeam extends Team {
  key: string;
  conf: string;
  div?: string;
}

type Row = [abbr: string, name: string, short: string, color: string, div?: string];

function league(conf: string, rows: Row[]): LeagueTeam[] {
  return rows.map(([abbr, name, short, color, div]) => ({ key: abbr, abbr, name, short, color, conf, div }));
}

const NFL: LeagueTeam[] = [
  ...league('AFC', [
    ['BUF', 'Buffalo Bills', 'Bills', '#00338D', 'East'],
    ['MIA', 'Miami Dolphins', 'Dolphins', '#008E97', 'East'],
    ['NE', 'New England Patriots', 'Patriots', '#002244', 'East'],
    ['NYJ', 'New York Jets', 'Jets', '#125740', 'East'],
    ['BAL', 'Baltimore Ravens', 'Ravens', '#241773', 'North'],
    ['CIN', 'Cincinnati Bengals', 'Bengals', '#FB4F14', 'North'],
    ['CLE', 'Cleveland Browns', 'Browns', '#311D00', 'North'],
    ['PIT', 'Pittsburgh Steelers', 'Steelers', '#FFB612', 'North'],
    ['HOU', 'Houston Texans', 'Texans', '#03202F', 'South'],
    ['IND', 'Indianapolis Colts', 'Colts', '#002C5F', 'South'],
    ['JAX', 'Jacksonville Jaguars', 'Jaguars', '#006778', 'South'],
    ['TEN', 'Tennessee Titans', 'Titans', '#0C2340', 'South'],
    ['DEN', 'Denver Broncos', 'Broncos', '#FB4F14', 'West'],
    ['KC', 'Kansas City Chiefs', 'Chiefs', '#E31837', 'West'],
    ['LV', 'Las Vegas Raiders', 'Raiders', '#000000', 'West'],
    ['LAC', 'Los Angeles Chargers', 'Chargers', '#0080C6', 'West'],
  ]),
  ...league('NFC', [
    ['DAL', 'Dallas Cowboys', 'Cowboys', '#003594', 'East'],
    ['NYG', 'New York Giants', 'Giants', '#0B2265', 'East'],
    ['PHI', 'Philadelphia Eagles', 'Eagles', '#004C54', 'East'],
    ['WAS', 'Washington Commanders', 'Commanders', '#5A1414', 'East'],
    ['CHI', 'Chicago Bears', 'Bears', '#0B162A', 'North'],
    ['DET', 'Detroit Lions', 'Lions', '#0076B6', 'North'],
    ['GB', 'Green Bay Packers', 'Packers', '#203731', 'North'],
    ['MIN', 'Minnesota Vikings', 'Vikings', '#4F2683', 'North'],
    ['ATL', 'Atlanta Falcons', 'Falcons', '#A71930', 'South'],
    ['CAR', 'Carolina Panthers', 'Panthers', '#0085CA', 'South'],
    ['NO', 'New Orleans Saints', 'Saints', '#D3BC8D', 'South'],
    ['TB', 'Tampa Bay Buccaneers', 'Buccaneers', '#D50A0A', 'South'],
    ['ARI', 'Arizona Cardinals', 'Cardinals', '#97233F', 'West'],
    ['LAR', 'Los Angeles Rams', 'Rams', '#003594', 'West'],
    ['SF', 'San Francisco 49ers', '49ers', '#AA0000', 'West'],
    ['SEA', 'Seattle Seahawks', 'Seahawks', '#002244', 'West'],
  ]),
];

const NBA: LeagueTeam[] = [
  ...league('East', [
    ['BOS', 'Boston Celtics', 'Celtics', '#007A33', 'Atlantic'],
    ['BKN', 'Brooklyn Nets', 'Nets', '#000000', 'Atlantic'],
    ['NYK', 'New York Knicks', 'Knicks', '#006BB6', 'Atlantic'],
    ['PHI', 'Philadelphia 76ers', '76ers', '#006BB6', 'Atlantic'],
    ['TOR', 'Toronto Raptors', 'Raptors', '#CE1141', 'Atlantic'],
    ['CHI', 'Chicago Bulls', 'Bulls', '#CE1141', 'Central'],
    ['CLE', 'Cleveland Cavaliers', 'Cavaliers', '#860038', 'Central'],
    ['DET', 'Detroit Pistons', 'Pistons', '#C8102E', 'Central'],
    ['IND', 'Indiana Pacers', 'Pacers', '#002D62', 'Central'],
    ['MIL', 'Milwaukee Bucks', 'Bucks', '#00471B', 'Central'],
    ['ATL', 'Atlanta Hawks', 'Hawks', '#E03A3E', 'Southeast'],
    ['CHA', 'Charlotte Hornets', 'Hornets', '#1D1160', 'Southeast'],
    ['MIA', 'Miami Heat', 'Heat', '#98002E', 'Southeast'],
    ['ORL', 'Orlando Magic', 'Magic', '#0077C0', 'Southeast'],
    ['WAS', 'Washington Wizards', 'Wizards', '#002B5C', 'Southeast'],
  ]),
  ...league('West', [
    ['DEN', 'Denver Nuggets', 'Nuggets', '#0E2240', 'Northwest'],
    ['MIN', 'Minnesota Timberwolves', 'Timberwolves', '#0C2340', 'Northwest'],
    ['OKC', 'Oklahoma City Thunder', 'Thunder', '#007AC1', 'Northwest'],
    ['POR', 'Portland Trail Blazers', 'Trail Blazers', '#E03A3E', 'Northwest'],
    ['UTA', 'Utah Jazz', 'Jazz', '#002B5C', 'Northwest'],
    ['GSW', 'Golden State Warriors', 'Warriors', '#1D428A', 'Pacific'],
    ['LAC', 'LA Clippers', 'Clippers', '#C8102E', 'Pacific'],
    ['LAL', 'Los Angeles Lakers', 'Lakers', '#552583', 'Pacific'],
    ['PHX', 'Phoenix Suns', 'Suns', '#1D1160', 'Pacific'],
    ['SAC', 'Sacramento Kings', 'Kings', '#5A2D81', 'Pacific'],
    ['DAL', 'Dallas Mavericks', 'Mavericks', '#00538C', 'Southwest'],
    ['HOU', 'Houston Rockets', 'Rockets', '#CE1141', 'Southwest'],
    ['MEM', 'Memphis Grizzlies', 'Grizzlies', '#5D76A9', 'Southwest'],
    ['NOP', 'New Orleans Pelicans', 'Pelicans', '#0C2340', 'Southwest'],
    ['SAS', 'San Antonio Spurs', 'Spurs', '#000000', 'Southwest'],
  ]),
];

const NHL: LeagueTeam[] = [
  ...league('East', [
    ['BOS', 'Boston Bruins', 'Bruins', '#FFB81C', 'Atlantic'],
    ['BUF', 'Buffalo Sabres', 'Sabres', '#003087', 'Atlantic'],
    ['DET', 'Detroit Red Wings', 'Red Wings', '#CE1126', 'Atlantic'],
    ['FLA', 'Florida Panthers', 'Panthers', '#041E42', 'Atlantic'],
    ['MTL', 'Montréal Canadiens', 'Canadiens', '#AF1E2D', 'Atlantic'],
    ['OTT', 'Ottawa Senators', 'Senators', '#C52032', 'Atlantic'],
    ['TBL', 'Tampa Bay Lightning', 'Lightning', '#002868', 'Atlantic'],
    ['TOR', 'Toronto Maple Leafs', 'Maple Leafs', '#00205B', 'Atlantic'],
    ['CAR', 'Carolina Hurricanes', 'Hurricanes', '#CE1126', 'Metropolitan'],
    ['CBJ', 'Columbus Blue Jackets', 'Blue Jackets', '#002654', 'Metropolitan'],
    ['NJD', 'New Jersey Devils', 'Devils', '#CE1126', 'Metropolitan'],
    ['NYI', 'New York Islanders', 'Islanders', '#00539B', 'Metropolitan'],
    ['NYR', 'New York Rangers', 'Rangers', '#0038A8', 'Metropolitan'],
    ['PHI', 'Philadelphia Flyers', 'Flyers', '#F74902', 'Metropolitan'],
    ['PIT', 'Pittsburgh Penguins', 'Penguins', '#FCB514', 'Metropolitan'],
    ['WSH', 'Washington Capitals', 'Capitals', '#041E42', 'Metropolitan'],
  ]),
  ...league('West', [
    ['CHI', 'Chicago Blackhawks', 'Blackhawks', '#CF0A2C', 'Central'],
    ['COL', 'Colorado Avalanche', 'Avalanche', '#6F263D', 'Central'],
    ['DAL', 'Dallas Stars', 'Stars', '#006847', 'Central'],
    ['MIN', 'Minnesota Wild', 'Wild', '#154734', 'Central'],
    ['NSH', 'Nashville Predators', 'Predators', '#FFB81C', 'Central'],
    ['STL', 'St. Louis Blues', 'Blues', '#002F87', 'Central'],
    ['UTA', 'Utah Mammoth', 'Mammoth', '#6CACE4', 'Central'],
    ['WPG', 'Winnipeg Jets', 'Jets', '#041E42', 'Central'],
    ['ANA', 'Anaheim Ducks', 'Ducks', '#F47A38', 'Pacific'],
    ['CGY', 'Calgary Flames', 'Flames', '#C8102E', 'Pacific'],
    ['EDM', 'Edmonton Oilers', 'Oilers', '#041E42', 'Pacific'],
    ['LAK', 'Los Angeles Kings', 'Kings', '#111111', 'Pacific'],
    ['SJS', 'San Jose Sharks', 'Sharks', '#006D75', 'Pacific'],
    ['SEA', 'Seattle Kraken', 'Kraken', '#001628', 'Pacific'],
    ['VAN', 'Vancouver Canucks', 'Canucks', '#00205B', 'Pacific'],
    ['VGK', 'Vegas Golden Knights', 'Golden Knights', '#B4975A', 'Pacific'],
  ]),
];

const MLB: LeagueTeam[] = [
  ...league('AL', [
    ['BAL', 'Baltimore Orioles', 'Orioles', '#DF4601', 'East'],
    ['BOS', 'Boston Red Sox', 'Red Sox', '#BD3039', 'East'],
    ['NYY', 'New York Yankees', 'Yankees', '#0C2340', 'East'],
    ['TB', 'Tampa Bay Rays', 'Rays', '#092C5C', 'East'],
    ['TOR', 'Toronto Blue Jays', 'Blue Jays', '#134A8E', 'East'],
    ['CWS', 'Chicago White Sox', 'White Sox', '#27251F', 'Central'],
    ['CLE', 'Cleveland Guardians', 'Guardians', '#00385D', 'Central'],
    ['DET', 'Detroit Tigers', 'Tigers', '#0C2340', 'Central'],
    ['KC', 'Kansas City Royals', 'Royals', '#004687', 'Central'],
    ['MIN', 'Minnesota Twins', 'Twins', '#002B5C', 'Central'],
    ['ATH', 'Athletics', 'Athletics', '#003831', 'West'],
    ['HOU', 'Houston Astros', 'Astros', '#002D62', 'West'],
    ['LAA', 'Los Angeles Angels', 'Angels', '#BA0021', 'West'],
    ['SEA', 'Seattle Mariners', 'Mariners', '#0C2C56', 'West'],
    ['TEX', 'Texas Rangers', 'Rangers', '#003278', 'West'],
  ]),
  ...league('NL', [
    ['ATL', 'Atlanta Braves', 'Braves', '#CE1141', 'East'],
    ['MIA', 'Miami Marlins', 'Marlins', '#00A3E0', 'East'],
    ['NYM', 'New York Mets', 'Mets', '#002D72', 'East'],
    ['PHI', 'Philadelphia Phillies', 'Phillies', '#E81828', 'East'],
    ['WSH', 'Washington Nationals', 'Nationals', '#AB0003', 'East'],
    ['CHC', 'Chicago Cubs', 'Cubs', '#0E3386', 'Central'],
    ['CIN', 'Cincinnati Reds', 'Reds', '#C6011F', 'Central'],
    ['MIL', 'Milwaukee Brewers', 'Brewers', '#12284B', 'Central'],
    ['PIT', 'Pittsburgh Pirates', 'Pirates', '#FDB827', 'Central'],
    ['STL', 'St. Louis Cardinals', 'Cardinals', '#C41E3A', 'Central'],
    ['ARI', 'Arizona Diamondbacks', 'D-backs', '#A71930', 'West'],
    ['COL', 'Colorado Rockies', 'Rockies', '#333366', 'West'],
    ['LAD', 'Los Angeles Dodgers', 'Dodgers', '#005A9C', 'West'],
    ['SD', 'San Diego Padres', 'Padres', '#2F241D', 'West'],
    ['SF', 'San Francisco Giants', 'Giants', '#FD5A1E', 'West'],
  ]),
];

const MLS: LeagueTeam[] = [
  ...league('East', [
    ['ATL', 'Atlanta United', 'Atlanta', '#80000A'],
    ['CLT', 'Charlotte FC', 'Charlotte', '#1A85C8'],
    ['CHI', 'Chicago Fire FC', 'Chicago', '#AF2626'],
    ['CIN', 'FC Cincinnati', 'Cincinnati', '#F05323'],
    ['CLB', 'Columbus Crew', 'Columbus', '#FEDD00'],
    ['DC', 'D.C. United', 'D.C. United', '#231F20'],
    ['MIA', 'Inter Miami CF', 'Inter Miami', '#F7B5CD'],
    ['MTL', 'CF Montréal', 'Montréal', '#0033A1'],
    ['NSH', 'Nashville SC', 'Nashville', '#ECE83A'],
    ['NE', 'New England Revolution', 'New England', '#0A2240'],
    ['NYC', 'New York City FC', 'NYCFC', '#6CACE4'],
    ['RBNY', 'New York Red Bulls', 'Red Bulls', '#ED1E36'],
    ['ORL', 'Orlando City SC', 'Orlando', '#633492'],
    ['PHI', 'Philadelphia Union', 'Philadelphia', '#071B2C'],
    ['TOR', 'Toronto FC', 'Toronto', '#B81137'],
  ]),
  ...league('West', [
    ['ATX', 'Austin FC', 'Austin', '#00B140'],
    ['COL', 'Colorado Rapids', 'Colorado', '#960A2C'],
    ['DAL', 'FC Dallas', 'Dallas', '#BF0D3E'],
    ['HOU', 'Houston Dynamo FC', 'Houston', '#FF6B00'],
    ['LA', 'LA Galaxy', 'LA Galaxy', '#00245D'],
    ['LAFC', 'Los Angeles FC', 'LAFC', '#000000'],
    ['MIN', 'Minnesota United FC', 'Minnesota', '#8CD2F4'],
    ['POR', 'Portland Timbers', 'Portland', '#004812'],
    ['RSL', 'Real Salt Lake', 'Real Salt Lake', '#B30838'],
    ['SD', 'San Diego FC', 'San Diego', '#0B1F3A'],
    ['SJ', 'San Jose Earthquakes', 'San Jose', '#0067B1'],
    ['SEA', 'Seattle Sounders FC', 'Seattle', '#5D9741'],
    ['SKC', 'Sporting Kansas City', 'Sporting KC', '#93B1D7'],
    ['STL', 'St. Louis CITY SC', 'St. Louis', '#DD004A'],
    ['VAN', 'Vancouver Whitecaps FC', 'Vancouver', '#00245E'],
  ]),
];

const WNBA: LeagueTeam[] = league('WNBA', [
  ['ATL', 'Atlanta Dream', 'Dream', '#E31837'],
  ['CHI', 'Chicago Sky', 'Sky', '#418FDE'],
  ['CON', 'Connecticut Sun', 'Sun', '#F05023'],
  ['DAL', 'Dallas Wings', 'Wings', '#002B5C'],
  ['GSV', 'Golden State Valkyries', 'Valkyries', '#563D7C'],
  ['IND', 'Indiana Fever', 'Fever', '#002D62'],
  ['LVA', 'Las Vegas Aces', 'Aces', '#000000'],
  ['LAS', 'Los Angeles Sparks', 'Sparks', '#552583'],
  ['MIN', 'Minnesota Lynx', 'Lynx', '#236192'],
  ['NYL', 'New York Liberty', 'Liberty', '#6ECEB2'],
  ['PHX', 'Phoenix Mercury', 'Mercury', '#201747'],
  ['POR', 'Portland Fire', 'Fire', '#C8102E'],
  ['SEA', 'Seattle Storm', 'Storm', '#2C5234'],
  ['TOR', 'Toronto Tempo', 'Tempo', '#6F263D'],
  ['WAS', 'Washington Mystics', 'Mystics', '#0C2340'],
]);

export const LEAGUE_TEAMS: Record<LeagueId, LeagueTeam[]> = {
  nfl: NFL,
  nba: NBA,
  nhl: NHL,
  mlb: MLB,
  mls: MLS,
  wnba: WNBA,
};

/**
 * League teams that can fill a slot: only the slot's conference (AL seeds
 * get AL teams, and so on), and only its division when the slot is tied to one.
 */
export function eligibleTeams(t: Template, slot: Slot): LeagueTeam[] {
  if (!t.teamList) return [];
  const conf = t.groups.find((g) => g.id === slot.group)?.conf;
  return LEAGUE_TEAMS[t.teamList].filter((x) => (!conf || x.conf === conf) && (!slot.division || x.div === slot.division));
}

/** Pick a readable text colour (dark or white) for a team colour. */
export function textOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return lum > 0.4 ? '#111111' : '#ffffff';
}

const PALETTE = ['#1d4ed8', '#b91c1c', '#047857', '#7c3aed', '#c2410c', '#0e7490', '#be185d', '#4d7c0f', '#334155', '#a16207'];

/** Build a team from free text (used for college / custom brackets). */
export function customTeam(name: string, abbr?: string, color?: string): Team {
  const clean = name.trim();
  const auto =
    clean
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4) || '?';
  const code = (abbr?.trim() || (clean.length <= 4 ? clean.toUpperCase() : auto)).slice(0, 5);
  let hash = 0;
  for (const ch of clean) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { name: clean, short: clean, abbr: code, color: color || PALETTE[hash % PALETTE.length] };
}
