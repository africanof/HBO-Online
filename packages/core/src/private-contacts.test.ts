import { describe, expect, it } from "vitest";
import { updateClassifiedListing, getClassifiedListing } from "./classified-listings";
import { getProvider, saveMyProviderProfile } from "./directory";

/** Cliente falso: guarda as escritas e responde às funções do Supabase. */
function fake(rpcData: Record<string, unknown> = {}) {
  const writes: any[] = []; const rpcs: { f: string; a: any }[] = [];
  const q: any = { select: () => q, eq: () => q, single: () => Promise.resolve({ data: { id: "l" }, error: null }),
    maybeSingle: () => Promise.resolve({ data: { id: "l", user_id: "u", phone: null, whatsapp: null, directions: null, geo_lat: null, geo_lng: null }, error: null }) };
  const client: any = {
    from: () => ({ select: () => q, update: (r: any) => { writes.push(r); return q; }, upsert: (r: any) => { writes.push(r); return q; } }),
    rpc: (f: string, a: any) => { rpcs.push({ f, a }); return Promise.resolve({ data: rpcData[f] ?? [], error: null }); }
  };
  return { client, writes, rpcs };
}

describe("Contactos e localização privados", () => {
  it("o anúncio não grava a localização na tabela pública", async () => {
    const { client, writes, rpcs } = fake();
    await updateClassifiedListing(client, "l", { listingType: "product", purpose: "sale", title: "Teste", directions: "Atrás do mercado", point: { lat: -12.77, lng: 15.73 } });
    expect(writes[0]).not.toHaveProperty("directions");
    expect(writes[0]).not.toHaveProperty("geo_lat");
    expect(rpcs[0]).toMatchObject({ f: "set_listing_private_place", a: { p_listing_id: "l", p_directions: "Atrás do mercado" } });
  });
  it("só o dono e a equipa recebem a localização do anúncio", async () => {
    const outro = fake({ listing_private_place: [] });
    expect((await getClassifiedListing(outro.client, "l")).data).toMatchObject({ directions: null, geo_lat: null });
    const dono = fake({ listing_private_place: [{ directions: "Atrás do mercado", geo_lat: "-12.771", geo_lng: "15.735" }] });
    expect((await getClassifiedListing(dono.client, "l")).data).toMatchObject({ directions: "Atrás do mercado", geo_lat: -12.771 });
  });
  it("o perfil de profissional guarda telefone e WhatsApp em privado", async () => {
    const { client, writes, rpcs } = fake();
    await saveMyProviderProfile(client, "u", { displayName: "Ana", categoryId: "c", municipalityId: "m", phone: "923000000", whatsapp: "923000001" });
    expect(writes[0]).not.toHaveProperty("phone");
    expect(writes[0]).not.toHaveProperty("whatsapp");
    expect(rpcs.at(-1)).toMatchObject({ f: "set_my_provider_contact", a: { p_phone: "923000000", p_whatsapp: "923000001" } });
  });
  it("só o próprio e a equipa recebem os contactos do profissional", async () => {
    const outro = fake({ provider_private_contact: [] });
    expect((await getProvider(outro.client, "u")).data).toMatchObject({ phone: null, whatsapp: null });
    const equipa = fake({ provider_private_contact: [{ phone: "923000000", whatsapp: "923000001", directions: null, geo_lat: null, geo_lng: null }] });
    expect((await getProvider(equipa.client, "u")).data).toMatchObject({ phone: "923000000", whatsapp: "923000001" });
  });
});
