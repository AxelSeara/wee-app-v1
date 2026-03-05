-- Wee v6.1: enforce unique community names (case/space-insensitive)
alter table public.communities
  add column if not exists name_norm text;

update public.communities
set name_norm = regexp_replace(
  lower(
    translate(
      name,
      'ÁÀÂÄÃáàâäãÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑñÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc'
    )
  ),
  '\s+',
  ' ',
  'g'
)
where name_norm is null;

alter table public.communities
  alter column name_norm set not null;

create unique index if not exists communities_name_norm_unique
  on public.communities(name_norm);

