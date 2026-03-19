-- KV table used by Edge Function server
create table if not exists kv_store_aac1ff1a (
  key text primary key,
  value jsonb not null
);
