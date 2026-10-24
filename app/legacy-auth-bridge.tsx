'use client';
import { useEffect } from 'react';

/** Preserve previously emailed root auth/invitation links after separating the landing. */
export function LegacyAuthBridge() {
 useEffect(()=>{
  const query=new URLSearchParams(window.location.search), hash=new URLSearchParams(window.location.hash.slice(1));
  if (query.has('invite')||query.has('recovery')||query.has('code')||query.has('token_hash')||hash.has('access_token')||hash.get('type')==='recovery') {
   window.location.replace('/proyectos'+window.location.search+window.location.hash);
  }
 },[]);
 return null;
}
