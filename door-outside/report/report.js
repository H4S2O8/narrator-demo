const escapeHtml=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
async function buildReport(){
  const manifest=await fetch('../data/art-manifest-v3.json').then(r=>r.json());
  document.querySelector('#art-grid').innerHTML=manifest.sheets.map(sheet=>`<figure><img src="../assets/${escapeHtml(sheet.file)}" alt="${escapeHtml(sheet.id)} 三帧状态图"><figcaption><b>${escapeHtml(sheet.id)}</b>｜${escapeHtml(sheet.mechanism)}｜用于第 ${sheet.stages.map(v=>v+1).join('、')} 段</figcaption></figure>`).join('');
  let evidence={tests:[]};try{evidence=await fetch('evidence/report-evidence-v3.json',{cache:'no-store'}).then(r=>r.json())}catch{}
  document.querySelector('#test-results').innerHTML=(evidence.tests||[]).map(test=>`<article class="test-row ${test.ok?'pass':'fail'}"><b>${test.ok?'通过':'失败'}｜${escapeHtml(test.name)}</b><span>${escapeHtml(test.detail)}</span></article>`).join('')||'<p>本地报告记录尚未随构建发布。</p>';
  for(const image of document.querySelectorAll('.evidence img'))image.addEventListener('error',()=>image.closest('figure').classList.add('missing'));
}
buildReport();
