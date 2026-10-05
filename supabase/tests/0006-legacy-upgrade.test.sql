-- Exercise the incident patch on the pre-Partner release without retaining it.
begin;
\ir 0006-before-upgrade.sql
\ir ../migrations/20261005151545_room_version_conflict.sql
\ir 0006-upgrade.test.sql
rollback;
select 'pre-Partner conflict migration passed' as result;
