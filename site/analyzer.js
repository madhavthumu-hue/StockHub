(function(){
var $=function(i){return document.getElementById(i)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var n=function(v,d){d=d==null?2:d;return v==null||v===''?'-':Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})};
var usd=function(v,d){return v==null?'-':'$'+n(v,d)};
var day=function(s){return s?String(s).slice(0,10):'-'};
var kpi=function(t,v){return '<div class="kpi"><b>'+v+'</b><span>'+t+'</span></div>'};
function api(url,opt){return fetch(url,opt).then(function(r){return r.json().catch(function(){return {}}).then(function(j){if(!r.ok)throw new Error(j.error||'Request failed ('+r.status+')');return j})})}
function note(t,cls){return '<div class="card '+(cls||'')+'"><p>'+esc(t)+'</p></div>'}

/* mode switch */
var seg=[].slice.call(document.querySelectorAll('.seg button'));
function mode(m){seg.forEach(function(b){b.setAttribute('aria-selected',b.dataset.mode===m)});[].forEach.call(document.querySelectorAll('.mode'),function(s){s.hidden=s.id!=='m-'+m})}
seg.forEach(function(b){b.onclick=function(){mode(b.dataset.mode)}});
api('/api/health').then(function(){$('apistatus').textContent='Live data connected'}).catch(function(){$('apistatus').textContent='Live data unavailable: using offline mode';mode('offline')});

/* shared: risk-colored call table */
var risk=function(r){return (r['Dividend Risk']?1:0)+(r['Earnings Risk']?1:0)};
var KEY='<div class="key"><span><i class="r0"></i>No event risk</span><span><i class="r1"></i>One risk</span><span><i class="r2"></i>Dividend and earnings risk</span></div>';
function callsTable(rows,withTicker){
 if(!rows.length)return '<p>No liquid out-of-the-money calls found (needs volume above 10 and open interest above 50).</p>';
 var h='<div class="tw"><table><tr>'+(withTicker?'<th>Ticker</th>':'')+'<th>Expiry</th><th class="n">Strike</th><th class="n">OTM</th><th class="n">Premium/sh</th><th class="n">Contracts</th><th class="n">Total premium</th><th class="n">Return</th><th class="n">Annualized</th><th class="n">Breakeven</th><th>Flags</th></tr>';
 rows.forEach(function(r){h+='<tr class="r'+risk(r)+'">'+(withTicker?'<td><b>'+esc(r.Ticker)+'</b>'+(r.Institution?' <span class="pill">'+esc(r.Institution)+'</span>':'')+'</td>':'')+'<td>'+esc(r.Expiration)+' ('+r.Days+'d)</td><td class="n">'+usd(r.Strike)+'</td><td class="n">'+n(r['OTM %'],1)+'%</td><td class="n">'+usd(r['Premium / Share'])+'</td><td class="n">'+r.Contracts+'</td><td class="n">'+usd(r['Total Premium'],0)+'</td><td class="n">'+n(r['Return %'])+'%</td><td class="n">'+n(r['Annualized %'],1)+'%</td><td class="n">'+usd(r.Breakeven)+'</td><td>'+esc(r.Comments||'None')+'</td></tr>'});
 return h+'</table></div>'+KEY}

/* single stock */
function single(){
 var t=$('sTicker').value.trim().toUpperCase(),q=$('sShares').value,hz=$('sHz').value;
 $('sOut').innerHTML=note('Fetching live data for '+t+'...');$('sGo').disabled=true;
 api('/api/stock?ticker='+encodeURIComponent(t)+'&shares='+encodeURIComponent(q)+'&horizon='+hz).then(function(d){
  var dv=d.dividend,c=d.calls,best=c[0],h='<div class="kpis">'+kpi(esc(d.name),usd(d.price))+kpi('Shares',n(d.shares,0))+kpi('Dividend yield',dv?n(dv['Dividend Yield %'])+'%':'None')+kpi('Quarterly dividends',dv?usd(dv['Quarterly Dividend Income']):'-')+kpi('Covered call contracts',d.contracts)+'</div><div class="two-col">';
  h+='<div class="card green"><h3>Dividend scope</h3>'+(dv?'<ul><li>Annual dividend: '+usd(dv['Annual Dividend / Share'])+' per share ('+usd(dv['Quarterly Dividend / Share'],4)+' per quarter)</li><li>Expected income on '+n(d.shares,0)+' shares: <b>'+usd(dv['Quarterly Dividend Income'])+'</b> per quarter, <b>'+usd(dv['Annual Dividend Income'])+'</b> per year</li><li>Next ex-dividend date: '+day(dv['Ex-Dividend Date'])+'</li><li>Next payment date: '+day(dv['Dividend Date'])+'</li></ul><p>You must own the shares before the ex-dividend date to receive it.</p>':'<p>'+esc(d.name)+' does not currently pay a dividend, so covered call premium is the main income source.</p>')+'</div>';
  h+='<div class="card amber"><h3>Covered call scope ('+esc(d.horizon)+')</h3>';
  if(d.shares_short)h+='<p><b>You need '+d.shares_short+' more shares</b> to sell one contract (100 shares). Figures below show one contract for illustration.</p>';
  if(best){var tp=c.map(function(r){return r['Total Premium']});h+='<ul><li>Expiration: '+esc(d.expiry)+' ('+d.days+' days)</li><li>Contracts you can sell: <b>'+Math.max(d.contracts,d.shares_short?1:0)+'</b></li><li>Premium range: <b>'+usd(Math.min.apply(null,tp),0)+' to '+usd(Math.max.apply(null,tp),0)+'</b></li><li>Best return: '+n(best['Return %'])+'% for the period ('+n(best['Annualized %'],1)+'% annualized)</li></ul>'+(best.Comments?'<p><b>Caution:</b> '+esc(best.Comments)+' before expiry. Consider a different expiration or strike.</p>':'<p>No ex-dividend or earnings date falls before this expiration.</p>')}else h+='<p>No liquid out-of-the-money calls found for this expiration.</p>';
  h+='</div></div>'+(best?'<h3>Top call candidates</h3>'+callsTable(c,false):'');
  $('sOut').innerHTML=h}).catch(function(e){$('sOut').innerHTML=note(e.message,'err')}).then(function(){$('sGo').disabled=false})}
$('sGo').onclick=single;$('sTicker').onkeydown=function(e){if(e.key==='Enter')single()};

/* portfolio */
function sendFile(url,btn){var f=$('pFile').files[0];if(!f){$('pOut').innerHTML=note('Choose a .xlsx or .csv file first.','err');return null}
 var fd=new FormData();fd.append('file',f);fd.append('horizon',$('pHz').value);btn.disabled=true;return fetch(url,{method:'POST',body:fd})}
$('pGo').onclick=function(){var p=sendFile('/api/portfolio',$('pGo'));if(!p)return;$('pOut').innerHTML=note('Analyzing holdings. This can take up to a minute...');
 p.then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'Request failed');return j})}).then(drawPortfolio).catch(function(e){$('pOut').innerHTML=note(e.message,'err')}).then(function(){$('pGo').disabled=false})};
$('pXls').onclick=function(){var p=sendFile('/api/export',$('pXls'));if(!p)return;
 p.then(function(r){if(!r.ok)return r.json().then(function(j){throw new Error(j.error)});return r.blob()}).then(function(b){var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='stocks_output.xlsx';a.click()}).catch(function(e){$('pOut').innerHTML=note(e.message,'err')}).then(function(){$('pXls').disabled=false})};
$('csvT').onclick=function(e){e.preventDefault();var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['Institution,Ticker,Quantity\nFidelity,KO,200\nSchwab,JNJ,100\n'],{type:'text/csv'}));a.download='stocks_input_template.csv';a.click()};
function drawPortfolio(d){var s=d.summary,h='<div class="kpis">'+kpi('Holdings paying dividends',s.holdings_with_dividends)+kpi('Quarterly dividend income',usd(s.quarterly_dividend_income,0))+kpi('Tickers with call ideas',s.tickers_with_calls)+kpi('Premium if top pick sold ('+esc(d.horizon)+')',usd(s.top_pick_premium,0))+'</div>';
 h+='<div class="sub-tabs"><button data-t="pc" aria-selected="true">Covered calls</button><button data-t="pd" aria-selected="false">Dividends</button><button data-t="pm" aria-selected="false">Dividends by month</button></div>';
 h+='<div id="pc">'+callsTable(d.calls,true)+'</div>';
 var dv='<div class="tw"><table><tr><th>Ticker</th><th>Institution</th><th class="n">Qty</th><th class="n">Price</th><th class="n">Yield</th><th class="n">Per quarter</th><th class="n">Annual income</th><th>Ex-dividend</th><th>Pay date</th></tr>';
 d.dividends.forEach(function(r){dv+='<tr><td><b>'+esc(r.Ticker)+'</b></td><td>'+esc(r.Institution)+'</td><td class="n">'+r.Quantity+'</td><td class="n">'+usd(r.Price)+'</td><td class="n">'+n(r['Dividend Yield %'])+'%</td><td class="n">'+usd(r['Quarterly Dividend Income'])+'</td><td class="n">'+usd(r['Annual Dividend Income'])+'</td><td>'+day(r['Ex-Dividend Date'])+'</td><td>'+day(r['Dividend Date'])+'</td></tr>'});
 h+='<div id="pd" hidden>'+(d.dividends.length?dv+'</table></div>':'<p>No dividend-paying holdings found.</p>')+'</div>';
 var m='<div class="tw"><table><tr><th>Institution</th><th>Ticker</th><th>Month</th><th class="n">Dividend income</th><th class="n">Institution total</th></tr>';
 d.monthly.forEach(function(r){m+='<tr><td>'+esc(r.Institution)+'</td><td>'+esc(r.Ticker)+'</td><td>'+esc(r.Month)+'</td><td class="n">'+usd(r['Total Dividend Income'])+'</td><td class="n">'+usd(r['Institution Total'])+'</td></tr>'});
 h+='<div id="pm" hidden>'+(d.monthly.length?m+'</table></div>':'<p>No dividend data.</p>')+'</div>';
 if(d.skipped.length)h+='<div class="warn small"><b>Skipped:</b> '+d.skipped.map(esc).join('; ')+'</div>';
 $('pOut').innerHTML=h;
 [].forEach.call($('pOut').querySelectorAll('.sub-tabs button'),function(b,i,all){b.onclick=function(){all.forEach(function(x){x.setAttribute('aria-selected',x===b);$(x.dataset.t).hidden=x!==b})}})}
})();
