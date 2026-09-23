/* BIG BROTHER — Batch V2 Live / Closed Report */
(function(){
'use strict';
const SB_URL='https://sjfhlaclgmkwwofzstok.supabase.co';
const SB_KEY='sb_publishable_w762jR65CWwlO30fKQsYOw_6L9grx8S';
const SESSION_KEY='BB_SUPABASE_DEV_SESSION_V1';
const MODE=String(window.BB_BATCH_PAGE_MODE||'live').toLowerCase();
let session=null,lastRevision='',rows=[],selected='',timer=null;
let editData=null,editRows=[];
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const qty=v=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:3});
function readSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch(_){return null}}
function saveSession(s){session=s||null;try{if(!s)localStorage.removeItem(SESSION_KEY);else{if(!s.expires_at&&s.expires_in)s.expires_at=Math.floor(Date.now()/1000)+Number(s.expires_in);localStorage.setItem(SESSION_KEY,JSON.stringify(s))}}catch(_){}}
async function parse(r){const t=await r.text();let d={};try{d=t?JSON.parse(t):{}}catch(_){d={message:t}}if(!r.ok)throw new Error(d.message||d.error_description||d.error||('Request failed '+r.status));return d}
async function refreshSession(){const s=readSession();if(!s?.refresh_token)throw new Error('Please sign in from the BIG BROTHER Dashboard.');const r=await fetch(SB_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token}),cache:'no-store'});saveSession(await parse(r));return session}
async function ensure(){session=readSession();if(!session?.access_token)throw new Error('Please sign in from the BIG BROTHER Dashboard.');if(session.expires_at&&Number(session.expires_at)<Math.floor(Date.now()/1000)+45)await refreshSession();return session}
async function rpc(fn,args={}){await ensure();let r=await fetch(SB_URL+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:SB_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store'});if(r.status===401){await refreshSession();r=await fetch(SB_URL+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:SB_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store'})}return parse(r)}
function badge(s){const x=String(s||'').toUpperCase();const c=x==='OPEN'?'open':x==='CLEARED'?'cleared':x==='CLOSED'?'closed':'muted';return `<span class="badge ${c}">${esc(x||'—')}</span>`}
function shell(){document.body.innerHTML=`<div class="page"><div class="top"><div><h1>${MODE==='closed'?'✅ Closed Batch':'🧾 Batch Report'}</h1><div class="sub">${MODE==='closed'?'Permanent completed Batch history':'Real-time salesman Batch stock · Sent / Sold / Back / Damage / Remaining'}</div></div><div class="top-actions"><span class="secure">🔐 SUPABASE LIVE</span><button id="refresh" class="btn ghost">↻ Refresh</button></div></div><div class="kpis" id="kpis"></div><div class="card"><div class="toolbar"><input id="search" placeholder="Search Batch / salesman / location"><select id="statusFilter">${MODE==='closed'?'<option value="CLOSED">Closed</option>':'<option value="">Open + Cleared</option><option value="OPEN">Open</option><option value="CLEARED">Cleared</option>'}</select><span id="sync" class="sync">Loading…</span></div><div class="tablewrap"><table><thead><tr><th>Batch</th><th>Date</th><th>Salesman</th><th>Location</th><th class="num">Sent</th><th class="num">Sold</th><th class="num">Back</th><th class="num">Damage</th><th class="num">Remaining</th><th>Status</th></tr></thead><tbody id="body"></tbody></table></div></div></div><div class="overlay" id="overlay"><div class="modal"><div class="modal-head"><div><h2 id="detailTitle">Batch</h2><div id="detailSub" class="sub"></div></div><button class="x" id="closeModal">×</button></div><div id="detailBody"></div></div></div>`;
$('refresh').onclick=()=>load(true);$('search').oninput=render;$('statusFilter').onchange=render;$('closeModal').onclick=()=>$('overlay').classList.remove('show');$('overlay').onclick=e=>{if(e.target===$('overlay'))$('overlay').classList.remove('show')};}
function render(){const q=$('search').value.trim().toLowerCase(),st=$('statusFilter').value;let list=rows.filter(x=>MODE==='closed'?String(x.status).toUpperCase()==='CLOSED':String(x.status).toUpperCase()!=='CLOSED');if(st)list=list.filter(x=>String(x.status).toUpperCase()===st);if(q)list=list.filter(x=>[x.batchId,x.salesmanName,x.locationCode,x.locationName].join(' ').toLowerCase().includes(q));$('body').innerHTML=list.length?list.map(x=>`<tr data-id="${esc(x.batchId)}"><td><strong>${esc(x.batchId)}</strong><div class="tiny">${x.invoiceCount||0} invoice(s) · ${x.lineCount||0} item(s)</div></td><td>${esc(x.batchDate)}</td><td>${esc(x.salesmanName||'—')}</td><td><strong>${esc(x.locationCode)}</strong><div class="tiny">${esc(x.locationName||'')}</div></td><td class="num">${qty(x.issuedQty)}</td><td class="num">${qty(x.soldQty)}</td><td class="num">${qty(x.backSaleQty)}</td><td class="num">${qty(x.damagedQty)}</td><td class="num remain">${qty(x.remainingQty)}</td><td>${badge(x.status)}</td></tr>`).join(''):`<tr><td colspan="10" class="empty">${MODE==='closed'?'No closed batches yet.':'No live batches yet.'}</td></tr>`;document.querySelectorAll('tr[data-id]').forEach(r=>r.onclick=()=>openDetail(r.dataset.id));const live=rows.filter(x=>String(x.status).toUpperCase()==='OPEN'),cleared=rows.filter(x=>String(x.status).toUpperCase()==='CLEARED'),closed=rows.filter(x=>String(x.status).toUpperCase()==='CLOSED');$('kpis').innerHTML=MODE==='closed'?`<div class="kpi"><span>Closed Batches</span><strong>${closed.length}</strong></div><div class="kpi"><span>Total Sold</span><strong>${qty(closed.reduce((a,x)=>a+Number(x.soldQty||0),0))}</strong></div><div class="kpi"><span>Total Back</span><strong>${qty(closed.reduce((a,x)=>a+Number(x.backSaleQty||0),0))}</strong></div><div class="kpi"><span>Total Damage</span><strong>${qty(closed.reduce((a,x)=>a+Number(x.damagedQty||0),0))}</strong></div>`:`<div class="kpi"><span>Open Batches</span><strong>${live.length}</strong></div><div class="kpi"><span>Cleared / Ready Close</span><strong>${cleared.length}</strong></div><div class="kpi"><span>Live Remaining</span><strong>${qty(live.reduce((a,x)=>a+Number(x.remainingQty||0),0))}</strong></div><div class="kpi"><span>Live Sold</span><strong>${qty(live.reduce((a,x)=>a+Number(x.soldQty||0),0))}</strong></div>`;}

function productRank(code){
  const order=['KIR3-2L','KIRB-2L','KIR0-830','KIR3-830','FF-2L','AF-2L','VP-2L','OM-2L','GF-190','GF-1L','GFJ-1L','KIRP-Y135','KIRS-Y135','KIRV-Y135','CH-O220','CHM-220','CHP-220','CHS-220','CHT-220'];
  const i=order.indexOf(String(code||'').toUpperCase());
  return i<0?9999:i;
}
function sortProducts(list){
  return (Array.isArray(list)?list:[]).slice().sort((a,b)=>{
    const ar=productRank(a.productCode),br=productRank(b.productCode);
    if(ar!==br)return ar-br;
    return String(a.productName||a.productCode||'').localeCompare(String(b.productName||b.productCode||''));
  });
}
function ensureEditOverlay(){
  let overlay=$('batchEditOverlay');
  if(overlay)return overlay;
  overlay=document.createElement('div');
  overlay.id='batchEditOverlay';
  overlay.className='overlay batch-edit-overlay';
  overlay.innerHTML=
    '<div class="modal batch-edit-modal">'+
      '<div class="modal-head"><div><h2 id="batchEditTitle">Edit Batch Items</h2><div id="batchEditSub" class="sub"></div></div><button class="x" id="batchEditClose">×</button></div>'+
      '<div class="batch-edit-body">'+
        '<div class="batch-edit-warning">Corrections return wrong pending stock to Warehouse and issue corrected stock into the same Batch. Sold / Back / Damage history is protected.</div>'+
        '<div class="batch-edit-reason"><label>Correction Reason *</label><textarea id="batchEditReason" placeholder="Example: Wrong product issued by staff"></textarea></div>'+
        '<div class="batch-edit-toolbar"><select id="batchEditAddProduct"><option value="">Add another Product…</option></select><button type="button" id="batchEditAddBtn" class="btn ghost">＋ Add Product</button></div>'+
        '<div class="tablewrap batch-edit-tablewrap"><table class="batch-edit-table"><thead><tr><th>Product</th><th class="num">Purchased QTY</th><th class="num">Zero-Cost QTY</th><th class="num">Already Used</th><th></th></tr></thead><tbody id="batchEditRows"></tbody></table></div>'+
        '<div id="batchEditStatus" class="batch-edit-status"></div>'+
      '</div>'+
      '<div class="batch-edit-actions"><button type="button" id="batchEditCancel" class="btn ghost">Cancel</button><button type="button" id="batchEditSave" class="btn primary">Save Batch Correction</button></div>'+
    '</div>';
  document.body.appendChild(overlay);
  $('batchEditClose').onclick=closeBatchEditor;
  $('batchEditCancel').onclick=closeBatchEditor;
  overlay.onclick=e=>{if(e.target===overlay)closeBatchEditor()};
  $('batchEditAddBtn').onclick=addBatchEditProduct;
  $('batchEditSave').onclick=saveBatchEdit;
  $('batchEditRows').addEventListener('input',event=>{
    const input=event.target.closest('[data-edit-code]');
    if(!input)return;
    const row=editRows.find(x=>x.productCode===input.dataset.editCode);
    if(!row)return;
    if(input.dataset.editField==='purchased')row.purchasedQty=Math.max(0,Number(input.value||0));
    if(input.dataset.editField==='zero')row.zeroCostQty=Math.max(0,Number(input.value||0));
  });
  $('batchEditRows').addEventListener('click',event=>{
    const btn=event.target.closest('[data-edit-remove]');
    if(!btn)return;
    const row=editRows.find(x=>x.productCode===btn.dataset.editRemove);
    if(!row)return;
    if(!row.canRemove){
      $('batchEditStatus').textContent='This product already has Sold / Back / Damage activity, so it cannot be removed.';
      $('batchEditStatus').className='batch-edit-status error';
      return;
    }
    editRows=editRows.filter(x=>x.productCode!==row.productCode);
    renderBatchEditor();
  });
  return overlay;
}
function closeBatchEditor(){
  const overlay=$('batchEditOverlay');
  if(overlay)overlay.classList.remove('show');
}
function rowProduct(code){
  return (editData&&Array.isArray(editData.products)?editData.products:[]).find(x=>String(x.productCode)===String(code))||null;
}
function renderBatchEditor(){
  const body=$('batchEditRows');
  if(!body||!editData)return;
  editRows.sort((a,b)=>{
    const ar=productRank(a.productCode),br=productRank(b.productCode);
    if(ar!==br)return ar-br;
    return String(a.productName||a.productCode).localeCompare(String(b.productName||b.productCode));
  });
  body.innerHTML=editRows.length?editRows.map(row=>{
    const p=rowProduct(row.productCode)||{};
    const minP=Number(row.minimumPurchasedQty||0),minZ=Number(row.minimumZeroCostQty||0);
    return '<tr>'+
      '<td><strong>'+esc(row.productName||row.productCode)+'</strong><div class="tiny">'+esc(row.productCode)+' · '+esc(row.unit||'')+'</div><div class="tiny">Warehouse: Purchased '+qty(p.warehousePurchasedQty)+' · Zero-Cost '+qty(p.warehouseZeroCostQty)+'</div></td>'+
      '<td class="num"><input class="batch-edit-qty" type="number" min="'+minP+'" step="0.01" data-edit-code="'+esc(row.productCode)+'" data-edit-field="purchased" value="'+Number(row.purchasedQty||0)+'"><div class="tiny">Min '+qty(minP)+'</div></td>'+
      '<td class="num"><input class="batch-edit-qty" type="number" min="'+minZ+'" step="0.01" data-edit-code="'+esc(row.productCode)+'" data-edit-field="zero" value="'+Number(row.zeroCostQty||0)+'"><div class="tiny">Min '+qty(minZ)+'</div></td>'+
      '<td class="num">'+qty(row.consumedQty)+'</td>'+
      '<td><button type="button" class="batch-edit-remove" data-edit-remove="'+esc(row.productCode)+'" '+(row.canRemove?'':'disabled')+'>×</button></td>'+
    '</tr>';
  }).join(''):'<tr><td colspan="5" class="empty">Add at least one Product.</td></tr>';
  const existing=new Set(editRows.map(x=>x.productCode));
  const choices=sortProducts(editData.products).filter(x=>!existing.has(x.productCode));
  $('batchEditAddProduct').innerHTML='<option value="">Add another Product…</option>'+
    choices.map(p=>'<option value="'+esc(p.productCode)+'">'+esc(p.productName)+' · '+esc(p.productCode)+'</option>').join('');
}
function addBatchEditProduct(){
  const select=$('batchEditAddProduct');
  const code=String(select&&select.value||'').trim();
  if(!code)return;
  const p=rowProduct(code);
  if(!p)return;
  editRows.push({productCode:p.productCode,productName:p.productName,unit:p.unit||'',purchasedQty:0,zeroCostQty:0,minimumPurchasedQty:0,minimumZeroCostQty:0,consumedQty:0,canRemove:true});
  select.value='';
  renderBatchEditor();
  const target=document.querySelector('[data-edit-code="'+code.replace(/"/g,'\\"')+'"]');
  if(target){try{target.focus();target.select()}catch(_){}}
}
async function openBatchEditor(id){
  const overlay=ensureEditOverlay();
  $('batchEditStatus').textContent='Loading Batch…';
  $('batchEditStatus').className='batch-edit-status';
  $('batchEditSave').disabled=true;
  overlay.classList.add('show');
  try{
    const data=await rpc('bb_stock_batch_edit_options',{p_batch_id:id});
    editData=data;
    editRows=(data.items||[]).map(x=>({productCode:x.productCode,productName:x.productName,unit:x.unit||'',purchasedQty:Number(x.purchasedIssuedQty||0),zeroCostQty:Number(x.zeroCostIssuedQty||0),minimumPurchasedQty:Number(x.minimumPurchasedQty||0),minimumZeroCostQty:Number(x.minimumZeroCostQty||0),consumedQty:Number(x.consumedQty||0),canRemove:x.canRemove===true}));
    $('batchEditTitle').textContent='Edit '+(data.batch&&data.batch.batchId||id);
    $('batchEditSub').textContent=[data.batch&&data.batch.salesmanName,data.batch&&(data.batch.locationName||data.batch.locationCode),data.batch&&data.batch.status].filter(Boolean).join(' · ');
    $('batchEditReason').value='';
    $('batchEditStatus').textContent='';
    $('batchEditSave').disabled=false;
    renderBatchEditor();
  }catch(e){
    $('batchEditStatus').textContent=e.message||String(e);
    $('batchEditStatus').className='batch-edit-status error';
  }
}
async function saveBatchEdit(){
  if(!editData)return;
  const reason=String($('batchEditReason')&&$('batchEditReason').value||'').trim();
  if(reason.length<3){
    $('batchEditStatus').textContent='Correction Reason is required.';
    $('batchEditStatus').className='batch-edit-status error';
    if($('batchEditReason'))$('batchEditReason').focus();
    return;
  }
  const invalid=editRows.find(row=>Number(row.purchasedQty||0)+0.000001<Number(row.minimumPurchasedQty||0)||Number(row.zeroCostQty||0)+0.000001<Number(row.minimumZeroCostQty||0));
  if(invalid){
    $('batchEditStatus').textContent=invalid.productName+': Qty cannot be lower than stock already used from this Batch.';
    $('batchEditStatus').className='batch-edit-status error';
    return;
  }
  const items=editRows.map(row=>({productCode:row.productCode,purchasedQty:Math.max(0,Number(row.purchasedQty||0)),zeroCostQty:Math.max(0,Number(row.zeroCostQty||0))})).filter(row=>row.purchasedQty+row.zeroCostQty>0.000001);
  if(!items.length){
    $('batchEditStatus').textContent='A Batch must keep at least one Product.';
    $('batchEditStatus').className='batch-edit-status error';
    return;
  }
  if(!confirm('Save correction to '+editData.batch.batchId+'? Wrong pending stock will be returned to Warehouse and corrected stock will be issued to this Batch.'))return;
  const btn=$('batchEditSave');
  btn.disabled=true;btn.textContent='Saving Correction…';$('batchEditStatus').textContent='';
  try{
    const result=await rpc('bb_stock_edit_batch_items',{p_payload:{batchId:editData.batch.batchId,requestId:'WEB-BATCH-EDIT-'+editData.batch.batchId+'-'+Date.now(),reason,items}});
    $('batchEditStatus').textContent='✅ Batch corrected · Audit #'+(result.editId||'');
    $('batchEditStatus').className='batch-edit-status ok';
    const id=editData.batch.batchId;
    setTimeout(async()=>{closeBatchEditor();await load(true);await openDetail(id)},450);
  }catch(e){
    $('batchEditStatus').textContent='❌ '+(e.message||String(e));
    $('batchEditStatus').className='batch-edit-status error';
  }finally{
    btn.disabled=false;btn.textContent='Save Batch Correction';
  }
}
async function openDetail(id){
  selected=id;
  try{
    const d=await rpc('bb_stock_batch_report',{p_batch_id:id,p_include_closed:true}),b=d.batch||{};
    $('detailTitle').textContent=b.batchId||id;
    $('detailSub').textContent=[b.batchDate,b.salesmanName,b.locationCode,b.locationName].filter(Boolean).join(' · ');
    const canEdit=MODE!=='closed'&&b.canClose===true&&String(b.status||'').toUpperCase()!=='CLOSED';
    const canFinalize=b.closeEligible&&b.canClose&&MODE!=='closed';
    $('detailBody').innerHTML=
      '<div class="detail-kpis"><div><span>Sent</span><strong>'+qty(b.issuedQty)+'</strong></div><div><span>Sold</span><strong>'+qty(b.soldQty)+'</strong></div><div><span>Back</span><strong>'+qty(b.backSaleQty)+'</strong></div><div><span>Damage</span><strong>'+qty(b.damagedQty)+'</strong></div><div><span>Remaining</span><strong>'+qty(b.remainingQty)+'</strong></div><div><span>Status</span><strong>'+badge(b.status)+'</strong></div></div>'+
      '<div class="section"><h3>Batch Items</h3><div class="tablewrap"><table><thead><tr><th>Product</th><th class="num">Sent</th><th class="num">Sold</th><th class="num">Back</th><th class="num">Damage</th><th class="num">Other</th><th class="num">Remaining</th><th>Status</th></tr></thead><tbody>'+
      (b.lines||[]).map(x=>'<tr><td><strong>'+esc(x.productName)+'</strong><div class="tiny">'+esc(x.productCode)+' · '+esc(x.unit)+'</div></td><td class="num">'+qty(x.issuedQty)+'</td><td class="num">'+qty(x.soldQty)+'</td><td class="num">'+qty(x.backSaleQty)+'</td><td class="num">'+qty(x.damagedQty)+'</td><td class="num">'+qty(x.otherOutQty)+'</td><td class="num remain">'+qty(x.remainingQty)+'</td><td>'+badge(x.itemStatus)+'</td></tr>').join('')+
      '</tbody></table></div></div>'+
      '<div class="section"><h3>Related Invoices</h3><div class="tablewrap"><table><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th class="num">Qty</th><th class="num">Grand Total</th></tr></thead><tbody>'+
      ((b.invoices||[]).map(i=>'<tr><td><strong>'+esc(i.invoiceNo)+'</strong></td><td>'+esc(i.invoiceDate)+'</td><td>'+esc(i.customer||'—')+'</td><td class="num">'+qty(i.qty)+'</td><td class="num">'+esc(i.currency||'USD')+' '+Number(i.grandTotal||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+'</td></tr>').join('')||'<tr><td colspan="5" class="empty">No invoices yet.</td></tr>')+
      '</tbody></table></div></div>'+
      (b.status==='Closed'?'<div class="closed-note">Closed '+esc(b.closedAt||'')+' · '+esc(b.closedByName||'')+'</div>':'')+
      (canEdit||canFinalize?'<div class="finalize batch-detail-actions">'+(canEdit?'<button id="editBatchBtn" class="btn ghost">✏ Edit Batch Items</button>':'')+(canFinalize?'<button id="finalizeBtn" class="btn primary">✅ Finalize & Move to Closed Batch</button>':'')+'</div>':'');
    $('overlay').classList.add('show');
    if($('editBatchBtn'))$('editBatchBtn').onclick=()=>openBatchEditor(id);
    if($('finalizeBtn'))$('finalizeBtn').onclick=()=>closeBatch(id);
  }catch(e){alert(e.message||e)}
}

async function closeBatch(id){if(!confirm('Finalize '+id+'? It will move to Closed Batch history.'))return;const btn=$('finalizeBtn');if(btn){btn.disabled=true;btn.textContent='Closing…'}try{await rpc('bb_stock_close_batch',{p_payload:{batchId:id,requestId:'WEB-CLOSE-'+id+'-'+Date.now()}});$('overlay').classList.remove('show');await load(true)}catch(e){alert(e.message||e);if(btn){btn.disabled=false;btn.textContent='✅ Finalize & Move to Closed Batch'}}}
async function load(force=false){try{$('sync').textContent='Refreshing…';const d=await rpc('bb_stock_batch_report',{p_batch_id:null,p_include_closed:MODE==='closed'});lastRevision=String(d.revision||'');rows=Array.isArray(d.batches)?d.batches:[];render();$('sync').textContent='Live · '+new Date().toLocaleTimeString()}catch(e){$('body').innerHTML=`<tr><td colspan="10" class="empty error">${esc(e.message||e)}</td></tr>`;$('sync').textContent='Disconnected'}}
async function poll(){try{const r=await rpc('bb_stock_revision');const v=String(r?.revision??(r||''));if(v&&v!==lastRevision)await load(false)}catch(_){}}
async function start(){shell();try{await ensure();await load(true);timer=setInterval(poll,5000)}catch(e){$('body').innerHTML=`<tr><td colspan="10" class="empty error">${esc(e.message||e)}</td></tr>`;$('sync').textContent='Sign in required'}}
start();
})();