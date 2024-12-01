DROP TABLE IF EXISTS settings;

CREATE TABLE settings (
  id bigint primary key generated always as identity,
  high_price_threshold decimal not null,
  low_price_threshold decimal not null,
  renewable_threshold integer not null,
  notification_email text not null UNIQUE,
  user_first_name text not null,
  amber_api_token text not null,
  amber_site_id text,
  notifications_enabled boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:00',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  active boolean default true
);

ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
GRANT ALL ON settings TO service_role;
GRANT USAGE, SELECT ON SEQUENCE settings_id_seq TO service_role;