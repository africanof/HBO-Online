import { useState } from "react";
import { Link, router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { createSupabaseClient, signIn } from "@huambo-online/supabase";

export default function Login() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [message,setMessage]=useState("");
  async function submit() {
    try {
      const client=createSupabaseClient(process.env.EXPO_PUBLIC_SUPABASE_URL??"",process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY??"");
      const {error}=await signIn(client,email,password); if(error) throw error; router.replace("/");
    } catch(e) { setMessage(e instanceof Error?e.message:"Não foi possível entrar."); }
  }
  return <View style={s.container}><Link href="/" style={s.back}>← Huambo Online</Link><Text style={s.title}>Entrar</Text>
    <TextInput placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={s.input}/>
    <TextInput placeholder="Palavra-passe" secureTextEntry value={password} onChangeText={setPassword} style={s.input}/>
    <Pressable onPress={submit} style={s.button}><Text style={s.buttonText}>Entrar</Text></Pressable>
    {!!message&&<Text>{message}</Text>}<Link href="/criar-conta">Criar uma conta</Link></View>
}
const s=StyleSheet.create({container:{flex:1,padding:28,paddingTop:56,gap:14},back:{fontWeight:"700"},title:{fontSize:34,fontWeight:"800"},input:{borderWidth:1,borderColor:"#ccc",borderRadius:12,padding:14,fontSize:16},button:{padding:15,borderRadius:12,alignItems:"center",backgroundColor:"#111"},buttonText:{color:"#fff",fontWeight:"800"}});