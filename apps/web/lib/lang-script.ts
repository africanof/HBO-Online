import { LANG_COOKIE, LANG_STORAGE_KEY, LANG_TAGS } from "@huambo-online/core";

// Fica fora de lib/i18n.ts («use client») para o layout do servidor o poder usar como texto.
/**
 * Script para o <head>: põe <html lang> certo antes de a página aparecer (as páginas são estáticas,
 * por isso o servidor não sabe a língua). Lê o cookie, depois o localStorage, depois o navegador.
 */
export const LANG_SCRIPT = `(function(){try{var T=${JSON.stringify(LANG_TAGS)};var m=document.cookie.match(/(?:^|;\\s*)${LANG_COOKIE}=([^;]*)/);var l=m&&m[1];if(!T[l]){try{l=localStorage.getItem(${JSON.stringify(LANG_STORAGE_KEY)})}catch(e){}}if(!T[l]){l="pt";var n=navigator.languages||[navigator.language];for(var i=0;i<n.length;i++){var c=String(n[i]).toLowerCase();if(c.indexOf("pt")===0){l="pt";break}if(c.indexOf("en")===0){l="en";break}if(c.indexOf("zh")===0){l="zh";break}}}document.documentElement.lang=T[l];}catch(e){}})();`;
