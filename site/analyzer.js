(function(){
var $=function(i){return document.getElementById(i)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var n=function(v,d){d=d==null?2:d;return v==null||v===''?'-':Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})};
var usd=function(v,d){return v==null?'-':'$'+n(v,d)};
var day=function(s){return s?String(s).slice(0,10):'-'};
var kpi=function(t,v){return '<div class="kpi"><b>'+v+'</b><span>'+t+'</span></div>'};
var chip=function(t,v){return '<span class="chip">'+t+'<b>'+v+'</b></span>'};
var note=function(t,c){return '<div class="card '+(c||'')+'"><p>'+esc(t)+'</p></div>'};
function api(url,opt){return fetch(url,opt).then(function(r){return r.json().catch(function(){return {}}).then(function(j){if(!r.ok)throw new Error(j.error||'Request failed ('+r.status+')');return j})})}

/* modes and service status */
var seg=[].slice.call(document.querySelectorAll('.seg button'));
function mode(m){seg.forEach(function(b){b.setAttribute('aria-selected',b.dataset.mode===m)});[].forEach.call(document.querySelectorAll('.mode'),function(s){s.hidden=s.id!=='m-'+m})}
seg.forEach(function(b){b.onclick=function(){mode(b.dataset.mode)}});
var live=false;
api('/api/health').then(function(){live=true;$('apistatus').textContent='Live data connected'}).catch(function(){$('apistatus').textContent='Live data not running';$('nolive').hidden=false;$('sGo').disabled=true;$('pGo').disabled=true});

/* one holding: derived price, contracts, dividend scope and the call strikes */
var risk=function(r){return (r['Dividend Risk']?1:0)+(r['Earnings Risk']?1:0)};
var KEY='<div class="key"><span><i class="r0"></i>No event risk</span><span><i class="r1"></i>One risk</span><span><i class="r2"></i>Dividend and earnings risk</span></div>';
function holdingCard(h){
 var q=h.Quantity,c=h.calls||[],dv=h.Dividend,short=q<100?100-q:0;
 var s='<div class="card holding"><div class="hh"><div><h3>'+esc(h.Ticker)+' <small>'+esc(h.Name)+'</small></h3>'+(h.Institution&&h.Institution!=='Unknown'?'<span class="pill">'+esc(h.Institution)+'</span>':'')+'</div><div class="chips">'+chip('Live price',usd(h.Price))+chip('Shares',n(q,0))+chip('Contracts',h.Contracts+' ('+n(q,0)+' / 100)')+chip('Leftover shares',h['Leftover Shares'])+'</div></div>';
 s+='<p><b>Dividend:</b> '+(dv?n(dv['Dividend Yield %'])+'% yield, '+usd(dv['Quarterly Dividend / Share'],4)+' per share per quarter, <b>'+usd(dv['Quarterly Dividend Income'])+'</b> per quarter and <b>'+usd(dv['Annual Dividend Income'])+'</b> per year on '+n(q,0)+' shares. Ex-dividend '+day(dv['Ex-Dividend Date'])+', paid '+day(dv['Dividend Date'])+'.':'none paid.')+'</p>';
 if(short)s+='<p><b>Covered calls:</b> '+(h.Contracts===0&&c.length?'you need '+short+' more shares to sell a contract. The strikes below illustrate 1 contract.':'you need '+short+' more shares to sell a contract.')+'</p>';
 else if(!c.length)s+='<p><b>Covered calls:</b> '+h.Contracts+' contract'+(h.Contracts>1?'s':'')+' possible, but no liquid out-of-the-money calls were found (volume above 10 and open interest above 50 required).</p>';
 else s+='<p><b>Covered calls:</b> sell <b>'+(h.Contracts||1)+'</b> contract'+((h.Contracts||1)>1?'s':'')+' expiring <b>'+esc(c[0].Expiration)+'</b> ('+c[0].Days+' days). '+(c[0].Comments?'<b>Caution:</b> '+esc(c[0].Comments)+' before expiry.':'No ex-dividend or earnings date before expiry.')+'</p>';
 if(c.length){s+='<div class="tw"><table><tr><th>#</th><th class="n">Strike</th><th class="n">OTM</th><th class="n">Premium/share</th><th class="n">Total premium</th><th class="n">Return</th><th class="n">Annualized</th><th class="n">Breakeven</th><th class="n">Max gain if called</th><th>Flags</th></tr>';
  c.forEach(function(r){s+='<tr class="r'+risk(r)+'"><td>'+r.Group+'</td><td class="n"><b>'+usd(r.Strike)+'</b></td><td class="n">'+n(r['OTM %'],1)+'%</td><td class="n">'+usd(r['Premium / Share'])+'</td><td class="n">'+usd(r['Total Premium'],0)+'</td><td class="n">'+n(r['Return %'])+'%</td><td class="n">'+n(r['Annualized %'],1)+'%</td><td class="n">'+usd(r.Breakeven)+'</td><td class="n">'+usd(r['Max Gain If Called'],0)+'</td><td>'+esc(r.Comments||'None')+'</td></tr>'});
  s+='</table></div>'+KEY}
 return s+'</div>'}

/* single stock */
function single(){
 var t=$('sTicker').value.trim().toUpperCase();
 $('sOut').innerHTML=note('Processing '+t+': fetching live price, dividends and option chain...');$('sGo').disabled=true;
 api('/api/stock?ticker='+encodeURIComponent(t)+'&shares='+encodeURIComponent($('sShares').value)+'&horizon='+$('sHz').value)
  .then(function(d){$('sOut').innerHTML=holdingCard(d)}).catch(function(e){$('sOut').innerHTML=note(e.message,'err')}).then(function(){$('sGo').disabled=!live})}
$('sGo').onclick=single;$('sTicker').onkeydown=function(e){if(e.key==='Enter')single()};

/* portfolio: choose file, preview, then Process */
$('pFile').onchange=function(){var f=this.files[0];$('pXls').disabled=true;$('pGo').disabled=!(f&&live);if(!f){$('pPrev').innerHTML='';return}
 if(!/\.csv$/i.test(f.name)){$('pPrev').innerHTML='<p class="pill">'+esc(f.name)+' selected. Prices and contracts are calculated when you press Process.</p>';return}
 var r=new FileReader();r.onload=function(){var L=String(r.result).split(/\r?\n/).filter(function(x){return x.trim()}),sp=function(l){return l.split(',').map(function(c){return c.replace(/["$\s]/g,'')})},hd=sp(L[0]).map(function(x){return x.toLowerCase()});
  var hasH=hd.some(function(x){return /ticker|symbol|quantity|shares|qty/.test(x)}),f1=function(re,d){var i=hd.findIndex(function(x){return re.test(x)});return hasH&&i>=0?i:d};
  var it=f1(/ticker|symbol/,0),iq=f1(/quantity|shares|qty/,1),rows=L.slice(hasH?1:0).map(sp).filter(function(c){return c[it]&&parseFloat(c[iq])>0});
  var h='<div class="tw"><table><tr><th>Ticker</th><th class="n">Shares</th><th class="n">Contracts</th><th class="n">Leftover</th></tr>';
  rows.slice(0,12).forEach(function(c){var q=Math.floor(parseFloat(c[iq]));h+='<tr><td>'+esc(c[it].toUpperCase())+'</td><td class="n">'+n(q,0)+'</td><td class="n">'+Math.floor(q/100)+'</td><td class="n">'+q%100+'</td></tr>'});
  $('pPrev').innerHTML='<p><small>'+rows.length+' holdings found. Price is fetched when you press Process.</small></p>'+h+'</table></div>'};r.readAsText(f)};
function send(url,btn){var f=$('pFile').files[0];if(!f)return null;var fd=new FormData();fd.append('file',f);fd.append('horizon',$('pHz').value);btn.disabled=true;return fetch(url,{method:'POST',body:fd})}
$('pGo').onclick=function(){var p=send('/api/portfolio',$('pGo'));if(!p)return;$('pXls').disabled=true;$('pOut').innerHTML=note('Processing holdings: fetching live prices, dividends and option chains. This can take up to a minute...');
 p.then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'Request failed');return j})}).then(function(d){draw(d);$('pXls').disabled=false}).catch(function(e){$('pOut').innerHTML=note(e.message,'err')}).then(function(){$('pGo').disabled=!live})};
$('pXls').onclick=function(){var p=send('/api/export',$('pXls'));if(!p)return;
 p.then(function(r){if(!r.ok)return r.json().then(function(j){throw new Error(j.error)});return r.blob()}).then(function(b){var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='stocks_output.xlsx';a.click()}).catch(function(e){$('pOut').innerHTML=note(e.message,'err')}).then(function(){$('pXls').disabled=false})};
$('csvT').onclick=function(e){e.preventDefault();var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['Institution,Ticker,Quantity\nFidelity,KO,200\nSchwab,JNJ,100\n'],{type:'text/csv'}));a.download='stocks_input_template.csv';a.click()};
function draw(d){var s=d.summary,h='<div class="kpis">'+kpi('Holdings analyzed',d.holdings.length)+kpi('Quarterly dividend income',usd(s.quarterly_dividend_income,0))+kpi('Holdings with call ideas',s.tickers_with_calls)+kpi('Premium if top pick sold ('+esc(d.horizon)+')',usd(s.top_pick_premium,0))+'</div>';
 h+=d.holdings.map(holdingCard).join('');
 if(d.skipped.length)h+='<div class="warn small"><b>Skipped:</b> '+d.skipped.map(esc).join('; ')+'</div>';
 $('pOut').innerHTML=h}
})();
