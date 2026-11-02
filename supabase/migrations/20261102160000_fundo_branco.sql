-- Fundo branco nas fotos (função Python /api/fundo do Site, modelo «silueta» do rembg, sem custo por foto):
-- cada pessoa pode tratar até 40 fotos por dia, contadas em ai_usage pela função consume_ai('bg_remove').
create or replace function public.ai_feature_limit(p_feature text)
 returns integer
 language sql
 immutable
as $function$
  select case p_feature
    when 'photo_fill' then 15
    when 'smart_search' then 30
    when 'help' then 30
    when 'staff_reply' then 300
    when 'dispute_summary' then 100
    when 'bg_remove' then 40
  end
$function$;
