"use client";
import {useEffect,useState} from "react";
import {createSupabaseClient} from "@huambo-online/supabase";
import {listSavedItemsV2,removeSavedItem} from "@huambo-online/core";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL??"";const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??"";
export default function Guardados(){const[items,setItems]=useState<any[]>([]);const[error,setError]=useState("");
async function load(){const c=createSupabaseClient(url,key);const u=await c.auth.getUser();if(!u.data.user){setError("Inicie sessão para ver os seus itens guardados.");return}const r=await listSavedItemsV2(c);if(r.error)setError(r.error.message);else setItems((r.data??[]).filter((x:any)=>x.classified_listing_id));}
useEffect(()=>{void load()},[]);
async function remove(id:string){const c=createSupabaseClient(url,key);const r=await removeSavedItem(c,id);if(r.error)setError(r.error.message);else setItems(a=>a.filter(x=>x.id!==id));}
return <main style={{maxWidth:900,margin:"0 auto",padding:32}}><a href="/explorar">← Explorar</a><h1>Guardados</h1><p>Os seus anúncios guardados.</p>{error&&<p>{error}</p>}{items.length===0&&!error&&<p>Ainda não tem anúncios guardados.</p>}{items.map((x:any)=>{const l=x.classified_listings;return <article key={x.id} style={{border:"1px solid #ddd",borderRadius:14,padding:18,marginTop:12}}><h2>{l?.title??"Anúncio"}</h2><p>{l?.description??""}</p><strong>{l?.price??"Preço sob consulta"} {l?.currency??""}</strong><div style={{display:"flex",gap:12,marginTop:12}}><a href={l?"/classificados/"+l.id:"#"}>Ver anúncio →</a><button onClick={()=>void remove(x.id)}>Remover</button></div></article>})}</main>}