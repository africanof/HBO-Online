import {useEffect,useState} from "react";
import {Link} from "expo-router";
import {View,Text,Pressable,StyleSheet} from "react-native";
import {createSupabaseClient} from "@huambo-online/supabase";
import {listSavedItemsV2,removeSavedItem} from "@huambo-online/core";
const url=process.env.EXPO_PUBLIC_SUPABASE_URL??"";const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY??"";
export default function Guardados(){const[items,setItems]=useState<any[]>([]);const[error,setError]=useState("");
async function load(){const c=createSupabaseClient(url,key);const u=await c.auth.getUser();if(!u.data.user){setError("Inicie sessão para ver os seus itens guardados.");return}const r=await listSavedItemsV2(c);if(r.error)setError(r.error.message);else setItems((r.data??[]).filter((x:any)=>x.classified_listing_id));}
useEffect(()=>{void load()},[]);
async function remove(id:string){const c=createSupabaseClient(url,key);const r=await removeSavedItem(c,id);if(r.error)setError(r.error.message);else setItems(a=>a.filter(x=>x.id!==id));}
return <View style={s.c}><Text style={s.h}>Guardados</Text><Text>Os seus anúncios guardados.</Text>{error&&<Text>{error}</Text>}{items.length===0&&!error&&<Text>Ainda não tem anúncios guardados.</Text>}{items.map((x:any)=>{const l=x.classified_listings;return <View key={x.id} style={s.card}><Text style={s.t}>{l?.title??"Anúncio"}</Text><Text>{l?.description??""}</Text><Text style={s.price}>{l?.price??"Preço sob consulta"} {l?.currency??""}</Text><View style={s.row}>{l&&<Link href={"/classificados/"+l.id as any}>Ver anúncio →</Link>}<Pressable onPress={()=>void remove(x.id)}><Text>Remover</Text></Pressable></View></View>})}</View>}
const s=StyleSheet.create({c:{padding:24,gap:12},h:{fontSize:28,fontWeight:"800"},card:{borderWidth:1,borderColor:"#ddd",borderRadius:14,padding:16,gap:8},t:{fontSize:19,fontWeight:"800"},price:{fontWeight:"800"},row:{flexDirection:"row",justifyContent:"space-between",marginTop:6}});