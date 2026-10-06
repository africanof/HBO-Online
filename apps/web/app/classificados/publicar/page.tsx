"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@huambo-online/supabase";
import { createClassifiedListing, uploadClassifiedMedia } from "@huambo-online/core";

export default function PublicarClassificado() {
  const router = useRouter();
  const [media, setMedia] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreview, setMediaPreview] = useState<string[]>([]);
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

  useEffect(() => {
    const c = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "");
    void Promise.all([
      c.from("categories").select("id,name").eq("active", true).order("name").then(({data}) => setCategories(data ?? [])),
      c.from("provinces").select("id,name").eq("active", true).order("name").then(({data}) => setProvinces(data ?? []))
    ]);
  }, []);

  function onMediaChange(files: FileList | null) { const next=Array.from(files ?? []).filter(f=>f.type.startsWith("image/")).slice(0,10); setMediaFiles(next); setMediaPreview(next.map(f=>URL.createObjectURL(f))); setMedia(""); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError("Indique um título."); return; }
    setBusy(true);
    try {
      const client = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "");
      const user = await client.auth.getUser();
      if (!user.data.user) { setError("Inicie sessão para publicar."); return; }
      const uploaded:string[]=[];
      for (const file of mediaFiles) { const up=await uploadClassifiedMedia(client,file,user.data.user.id); if(up.error) throw up.error; if(up.data) uploaded.push(up.data); }
      const result = await createClassifiedListing(client, {
        ownerId: user.data.user.id,
        listingType: listingType as any,
        purpose: purpose as any,
        title,
        description,
        price: price ? Number(price) : undefined,
        categoryId: categoryId || undefined,
        addressId: addressId || undefined,
        media: [...uploaded, ...media.split("\n").map(v => v.trim()).filter(Boolean)]
      });
      if (result.error) { setError(result.error.message); return; }
      router.push("/classificados/" + (result.data as any).id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível publicar o anúncio.");
    } finally {
      setBusy(false);
    }
  }

  return <main style={{maxWidth:760,margin:"0 auto",padding:32}}>
    <a href="/explorar">← Voltar</a>
    <h1>Publicar classificado</h1>
    <form onSubmit={submit} style={{display:"grid",gap:14}}>
      <label>Tipo<select value={listingType} onChange={e=>setListingType(e.target.value)}>
        <option value="classified">Classificado</option><option value="product">Produto</option><option value="vehicle">Veículo</option><option value="real_estate">Imóvel</option><option value="service">Serviço</option>
      </select></label>
      <label>Finalidade<select value={purpose} onChange={e=>setPurpose(e.target.value)}>
        <option value="sale">Venda</option><option value="rent">Arrendamento</option><option value="lease">Aluguer</option><option value="wanted">Procuro</option><option value="service">Serviço</option>
      </select></label>
      <input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Título"/>
      <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Descrição" rows={7}/>
      <select value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">Categoria (opcional)</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select value={provinceId} onChange={async e=>{const id=e.target.value;setProvinceId(id);setMunicipalityId("");if(!id){setMunicipalities([]);return;}const c=createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "");const {data}=await c.from("municipalities").select("id,name").eq("province_id",id).order("name");setMunicipalities(data ?? []);}}><option value="">Província</option>{provinces.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={municipalityId} onChange={e=>setMunicipalityId(e.target.value)} disabled={!provinceId}><option value="">Município</option>{municipalities.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <input type="file" accept="image/*" multiple onChange={e=>onMediaChange(e.target.files)}/><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{mediaPreview.map((src,i)=><div key={src}><img src={src} alt="" style={{width:90,height:90,objectFit:"cover"}}/><button type="button" onClick={()=>{setMediaFiles(x=>x.filter((_,j)=>j!==i));setMediaPreview(x=>x.filter((_,j)=>j!==i));}}>Remover</button></div>)}</div><textarea value={media} onChange={e=>setMedia(e.target.value)} placeholder="URLs externas (opcional), uma por linha" rows={3}/>
      <input type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Preço em AOA"/>
      {error && <p>{error}</p>}
      <button type="submit" disabled={busy}>{busy ? "A publicar…" : "Publicar anúncio"}</button>
    </form>
  </main>;
}