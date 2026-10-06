import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createSupabaseClient } from "@huambo-online/supabase";
import { createClassifiedListing, uploadClassifiedMedia } from "@huambo-online/core";
import * as ImagePicker from "expo-image-picker";

export default function Publicar() {
  const router = useRouter();
  const [media, setMedia] = useState("");
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [listingType, setListingType] = useState("classified");
  const [purpose, setPurpose] = useState("sale");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<{id:string;name:string}[]>([]);
  const [provinces, setProvinces] = useState<{id:string;name:string}[]>([]);
  const [municipalities, setMunicipalities] = useState<{id:string;name:string}[]>([]);
  const [provinceId, setProvinceId] = useState("");
  const [municipalityId, setMunicipalityId] = useState("");

  useEffect(() => { const c=createSupabaseClient(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""); void Promise.all([c.from("categories").select("id,name").eq("active",true).order("name").then(({data})=>setCategories(data??[])),c.from("provinces").select("id,name").eq("active",true).order("name").then(({data})=>setProvinces(data??[]))]); }, []);
  async function pickMedia() { const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsMultipleSelection:true,selectionLimit:10,quality:0.85}); if(!result.canceled) setMediaUris(result.assets.map(a=>a.uri)); }
  async function submit() {
    setError("");
    if (!title.trim()) { setError("Indique um título."); return; }
    setBusy(true);
    try {
      const client = createSupabaseClient(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "", process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "");
      const user = await client.auth.getUser();
      if (!user.data.user) { setError("Inicie sessão para publicar."); return; }
      const uploaded:string[]=[];
      for (let i=0;i<mediaUris.length;i++){ const uri=mediaUris[i]; const response=await fetch(uri); const blob=await response.blob(); const ext=(blob.type.split("/")[1]||"jpg"); const up=await uploadClassifiedMedia(client,blob,user.data.user.id,"classified-"+i+"."+ext,blob.type||"image/jpeg"); if(up.error) throw up.error; if(up.data) uploaded.push(up.data); }
      const result = await createClassifiedListing(client, {
        ownerId: user.data.user.id, listingType: listingType as any, purpose: purpose as any,
        title, description, price: price ? Number(price) : undefined,
        categoryId: categoryId || undefined, addressId: addressId || undefined, attributes: { provinceId, municipalityId },
        media: [...uploaded, ...media.split("\n").map(v => v.trim()).filter(Boolean)]
      });
      if (result.error) { setError(result.error.message); return; }
      router.push(("/classificados/" + (result.data as any).id) as any);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível publicar o anúncio.");
    } finally { setBusy(false); }
  }

  return <ScrollView contentContainerStyle={s.container}>
    <Text style={s.title}>Publicar classificado</Text>
    <Text>Tipo</Text><View style={s.row}>{["classified","product","vehicle","real_estate","service"].map(x=><Pressable key={x} style={s.option} onPress={()=>setListingType(x)}><Text>{listingType===x?"✓ ":""}{x}</Text></Pressable>)}</View>
    <Text>Finalidade</Text><View style={s.row}>{["sale","rent","lease","wanted","service"].map(x=><Pressable key={x} style={s.option} onPress={()=>setPurpose(x)}><Text>{purpose===x?"✓ ":""}{x}</Text></Pressable>)}</View>
    <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Título"/>
    <TextInput style={[s.input,s.area]} multiline value={description} onChangeText={setDescription} placeholder="Descrição"/>
    <View style={s.row}>{categories.map(x=><Pressable key={x.id} style={s.option} onPress={()=>setCategoryId(x.id)}><Text>{categoryId===x.id?"✓ ":""}{x.name}</Text></Pressable>)}</View>
    <View style={s.row}>{provinces.map(x=><Pressable key={x.id} style={s.option} onPress={async()=>{setProvinceId(x.id);setMunicipalityId("");const c=createSupabaseClient(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "");const {data}=await c.from("municipalities").select("id,name").eq("province_id",x.id).order("name");setMunicipalities(data??[])}}><Text>{provinceId===x.id?"✓ ":""}{x.name}</Text></Pressable>)}</View><View style={s.row}>{municipalities.map(x=><Pressable key={x.id} style={s.option} onPress={()=>setMunicipalityId(x.id)}><Text>{municipalityId===x.id?"✓ ":""}{x.name}</Text></Pressable>)}</View>
    <Pressable style={s.button} onPress={()=>void pickMedia()}><Text>Selecionar fotografias</Text></Pressable><View style={s.row}>{mediaUris.map((uri,i)=><View key={uri}><Text>📷 {i+1}</Text><Pressable onPress={()=>setMediaUris(x=>x.filter((_,j)=>j!==i))}><Text>Remover</Text></Pressable></View>)}</View><TextInput style={[s.input,s.area]} multiline value={media} onChangeText={setMedia} placeholder="URLs externas (opcional), uma por linha"/>
    <TextInput style={s.input} keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="Preço em AOA"/>
    {error && <Text>{error}</Text>}
    <Pressable style={s.button} disabled={busy} onPress={()=>void submit()}><Text>{busy?"A publicar…":"Publicar anúncio"}</Text></Pressable>
  </ScrollView>;
}
const s=StyleSheet.create({container:{padding:24,gap:14},title:{fontSize:30,fontWeight:"800"},row:{flexDirection:"row",flexWrap:"wrap",gap:8},option:{borderWidth:1,borderRadius:10,padding:10},input:{borderWidth:1,borderColor:"#ccc",borderRadius:10,padding:12},area:{minHeight:100},button:{borderWidth:1,borderRadius:10,padding:14,alignItems:"center"}});