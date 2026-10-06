import { useState } from "react";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { createSupabaseClient, signUp } from "@huambo-online/supabase";

export default function CriarConta() {
  const [f,setF]=useState({fullName:"",email:"",phone:"",municipality:"",password:""}); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  const set=(k:keyof typeof f)=>(v:string)=>setF(x=>({...x,[k]:v}));
  async function submit(){setBusy(true);try{const url=(process.env.EXPO_PUBLIC_SUPABASE_URL??"").trim();const key=(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY??"").trim();if(!url||!key)throw new Error("Serviço de autenticação não configurado.");const c=createSupabaseClient(url,key);const {data,error}=await signUp(c,f);if(error)throw error;setMessage(data.session?"Conta criada com sucesso.":"Conta criada. Verifique o email para confirmar.");}catch(e){const raw=e instanceof Error?e.message:String(e);setMessage(/failed to fetch|network|fetch/i.test(raw)?"Não foi possível contactar o serviço de autenticação. Verifique a internet e tente novamente.":raw);}finally{setBusy(false);}}
  return <View style={s.container}><Link href="/" style={s.back}>← Huambo Online</Link><Text style={s.title}>Criar conta</Text>
    <TextInput placeholder="Nome completo" value={f.fullName} onChangeText={set("fullName")} style={s.input}/><TextInput placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={set("email")} style={s.input}/><TextInput placeholder="Telefone" value={f.phone} onChangeText={set("phone")} style={s.input}/><TextInput placeholder="Município" value={f.municipality} onChangeText={set("municipality")} style={s.input}/><TextInput placeholder="Palavra-passe" secureTextEntry value={f.password} onChangeText={set("password")} style={s.input}/>
    <Pressable disabled={busy} onPress={submit} style={s.button}><Text style={s.buttonText}>{busy?"A criar conta...":"Criar conta"}</Text></Pressable>{!!message&&<Text>{message}</Text>}<Link href="/login">Já tenho conta</Link></View>
}
const s=StyleSheet.create({container:{flex:1,padding:28,paddingTop:56,gap:12},back:{fontWeight:"700"},title:{fontSize:34,fontWeight:"800"},input:{borderWidth:1,borderColor:"#ccc",borderRadius:12,padding:14,fontSize:16},button:{padding:15,borderRadius:12,alignItems:"center",backgroundColor:"#111"},buttonText:{color:"#fff",fontWeight:"800"}});