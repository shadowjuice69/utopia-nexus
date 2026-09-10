create or replace function public.capture_intel_page_ingest_to_vault()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_hash text;
  v_fields text[];
  v_payload jsonb;
  v_raw text;
  v_source text;
  v_data_type text;
begin
  if coalesce(new.source, '') = 'universal-capture'
     or (coalesce(new.source, '') = 'kd-stats-generic'
         and coalesce(new.parsed->>'category', '') = 'universal-capture') then
    v_raw := coalesce(new.raw_text, new.parsed->>'raw', new.parsed->>'html');
    v_payload := coalesce(new.parsed, '{}'::jsonb) - 'raw' - 'html';
    v_source := 'universal-capture';
    v_data_type := 'universal-capture';
  else
    v_raw := new.raw_text;
    v_payload := coalesce(new.parsed, '{}'::jsonb);
    v_source := new.source;
    v_data_type := new.data_type;
  end if;

  v_hash := md5(
    coalesce(new.kd_code,'') || '|' ||
    coalesce(new.province,'') || '|' ||
    coalesce(v_source,'') || '|' ||
    coalesce(new.tab,'') || '|' ||
    coalesce(v_data_type,'') || '|' ||
    coalesce(v_raw,'') || '|' ||
    coalesce(v_payload::text,'')
  );

  select coalesce(array_agg(key order by key), '{}') into v_fields
  from jsonb_object_keys(v_payload) as key;

  update public.intel_complete_vault
     set is_current = false
   where coalesce(kd_code,'') = coalesce(new.kd_code,'')
     and coalesce(province,'') = coalesce(new.province,'')
     and coalesce(source,'') = coalesce(v_source,'')
     and coalesce(tab,'') = coalesce(new.tab,'')
     and coalesce(data_type,'') = coalesce(v_data_type,'')
     and is_current = true;

  insert into public.intel_complete_vault
    (received_at,kd_code,province,source,tab,url,data_type,raw_text,payload,field_names,payload_hash,is_current)
  values
    (new.received_at,new.kd_code,new.province,v_source,new.tab,new.url,v_data_type,v_raw,v_payload,v_fields,v_hash,true);

  return new;
end;
$function$;
