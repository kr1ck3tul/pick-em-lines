create table if not exists seasons (
  id serial primary key,
  year int not null unique,
  week_count int not null default 13,
  current_week int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists pool_settings (
  id int primary key default 1,
  name text not null default 'Pick ''em Lines',
  season int not null default 2026,
  current_week int not null default 1,
  odds_api_key text,
  current_season_id int references seasons(id),
  updated_at timestamptz not null default now()
);

create table if not exists players (
  id serial primary key,
  season_id int not null references seasons(id) on delete cascade,
  slot int not null,
  name text not null,
  unique (season_id, slot)
);

create table if not exists weeks (
  id serial primary key,
  season_id int not null references seasons(id) on delete cascade,
  week_number int not null,
  status text not null default 'upcoming',
  label text not null,
  updated_at timestamptz not null default now(),
  unique (season_id, week_number)
);

create table if not exists games (
  id serial primary key,
  week_id int not null references weeks(id) on delete cascade,
  game_number int not null,
  home_team text not null,
  away_team text not null,
  home_spread numeric not null default 0,
  commence_time timestamptz,
  odds_event_id text,
  ats_result text
);

create table if not exists picks (
  player_id int not null references players(id) on delete cascade,
  week_id int not null references weeks(id) on delete cascade,
  game_id int not null references games(id) on delete cascade,
  selection text not null,
  primary key (player_id, week_id, game_id)
);

create index if not exists games_week_id_idx on games (week_id);
create index if not exists picks_week_id_idx on picks (week_id);
create index if not exists players_season_id_idx on players (season_id);
