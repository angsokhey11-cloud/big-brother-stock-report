/* BIG BROTHER — Live Stock Report Supabase Adapter V1 */
(function(){
  'use strict';

  const URL='https://sjfhlaclgmkwwofzstok.supabase.co';
  const KEY='sb_publishable_w762jR65CWwlO30fKQsYOw_6L9grx8S';
  const SESSION_KEY='BB_SUPABASE_DEV_SESSION_V1';
  let session=null;

  function readSession(){
    try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}
    catch(_){return null}
  }

  function saveSession(s){
    session=s||null;
    try{
      if(!s){localStorage.removeItem(SESSION_KEY);return;}
      if(!s.expires_at&&s.expires_in){
        s.expires_at=Math.floor(Date.now()/1000)+Number(s.expires_in);
      }
      localStorage.setItem(SESSION_KEY,JSON.stringify(s));
    }catch(_){}
  }

  async function parse(response){
    const text=await response.text();
    let data={};
    try{data=text?JSON.parse(text):{}}
    catch(_){data={message:text}}
    if(!response.ok){
      throw new Error(
        data.message||data.error_description||data.error||
        ('Supabase request failed ('+response.status+')')
      );
    }
    return data;
  }

  async function refreshSession(){
    const current=readSession();
    if(!current?.refresh_token)throw new Error('Please sign in to BIG BROTHER first.');
    const response=await fetch(URL+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:current.refresh_token})
    });
    const next=await parse(response);
    saveSession(next);
    return next;
  }

  async function ensureSession(){
    session=readSession();
    if(!session?.access_token)throw new Error('Please sign in to BIG BROTHER first.');
    const now=Math.floor(Date.now()/1000);
    if(session.expires_at&&Number(session.expires_at)<now+30)await refreshSession();
    return session;
  }

  async function rpc(fn,args={}){
    await ensureSession();
    const response=await fetch(URL+'/rest/v1/rpc/'+fn,{
      method:'POST',
      headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
      body:JSON.stringify(args||{}),cache:'no-store'
    });
    return parse(response);
  }

  async function jsonpRequest(action){
    switch(String(action||'')){
      case 'stockReportFast': return rpc('bb_stock_report_fast');
      case 'revision': return rpc('bb_stock_revision');
      default: throw new Error('Unsupported Stock Report action: '+action);
    }
  }

  try{localStorage.removeItem('bb_stock_report_desktop_v30')}catch(_){}
  window.BBStockReportAdapter={rpc,jsonpRequest};
})();