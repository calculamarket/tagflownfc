-- Allow renaming a tag's public id.
-- tags.id is the primary key and is referenced by reads, landing_pages and
-- tag_rules. Those FKs only had ON DELETE CASCADE, so updating tags.id failed
-- with a foreign key violation. Adding ON UPDATE CASCADE makes the new id
-- propagate to the child rows, preserving analytics history and rules.
ALTER TABLE public.reads DROP CONSTRAINT IF EXISTS reads_tag_id_fkey;
ALTER TABLE public.reads ADD CONSTRAINT reads_tag_id_fkey
  FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.landing_pages DROP CONSTRAINT IF EXISTS landing_pages_tag_id_fkey;
ALTER TABLE public.landing_pages ADD CONSTRAINT landing_pages_tag_id_fkey
  FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.tag_rules DROP CONSTRAINT IF EXISTS tag_rules_tag_id_fkey;
ALTER TABLE public.tag_rules ADD CONSTRAINT tag_rules_tag_id_fkey
  FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE ON UPDATE CASCADE;
