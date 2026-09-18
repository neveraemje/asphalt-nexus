-- Run only when intentionally resetting all Nexus screen data.
delete from storage.objects where bucket_id = 'nexus-screen-previews';
truncate table public.nexus_screens;
