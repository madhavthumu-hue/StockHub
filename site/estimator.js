(function(){
var $=function(i){return document.getElementById(i)};
var money=function(v){return '$'+Math.round(v).toLocaleString()};
var money2=function(v){return '$'+v.toFixed(2)};
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function k(t,v){return '<div class="kpi"><b>'+v+'</b><span>'+t+'</span></div>'}

/* ---- Option math (Black-Scholes) ---- */
function N(x){var t=1/(1+0.2316419*Math.abs(x)),d=0.3989423*Math.exp(-x*x/2),p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return x>0?1-p:p}
var R=0.045;
function d1(S,K,T,s){return (Math.log(S/K)+(R+s*s/2)*T)/(s*Math.sqrt(T))}
function call(S,K,T,s){var a=d1(S,K,T,s);return S*N(a)-K*Math.exp(-R*T)*N(a-s*Math.sqrt(T))}
function strikeFor(S,T,s,dl){var lo=S*0.8,hi=S*2;for(var i=0;i<50;i++){var m=(lo+hi)/2;if(N(d1(S,m,T,s))>dl)lo=m;else hi=m}return (lo+hi)/2}
function snap(K,S){var st=S<25?0.5:S<200?1:2.5;return Math.max(st,Math.round(K/st)*st)}

/* ---- Holdings analyzer ---- */
var H=[];
function parse(txt){var L=txt.split(/\r?\n/).filter(function(x){return x.trim()});if(!L.length)return [];
var sp=function(l){return l.split(',').map(function(c){return c.replace(/["$\s]/g,'')})},hd=sp(L[0]).map(function(x){return x.toLowerCase()});
var f=function(re){return hd.findIndex(function(h){return re.test(h)})},hasH=hd.some(function(h){return /symbol|ticker|shares|quantity|qty/.test(h)});
var is=hasH?f(/symbol|ticker/):0,iq=hasH?f(/shares|quantity|qty/):1,ip=hasH?f(/price|last/):2;if(is<0)is=0;if(iq<0)iq=1;
return L.slice(hasH?1:0).map(function(l){var c=sp(l),sh=parseFloat((c[iq]||'').replace(/,/g,'')),pr=ip>=0?parseFloat(c[ip]):NaN;return {sym:(c[is]||'').toUpperCase(),sh:sh,px:isNaN(pr)?0:pr}}).filter(function(r){return r.sym&&r.sh>0})}
function run(){var T=+$('exp').value/365,dl=+$('sty').value,iv0=(+$('iv').value||30)/100,days=+$('exp').value;
var h='<tr><th>Symbol</th><th class="n">Shares</th><th class="n">Price ($)</th><th class="n">Contracts</th><th class="n">Suggested strike</th><th class="n">Est. premium/share</th><th class="n">Total premium</th><th class="n">Return, period</th><th class="n">Annualized</th><th class="n">Chance called away</th><th class="n">Max gain if called</th><th class="n">Breakeven</th></tr>',tp=0,tv=0,tc=0;
H.forEach(function(r,i){var ct=Math.floor(r.sh/100);h+='<tr><td><b>'+esc(r.sym)+'</b></td><td class="n">'+r.sh+'</td><td class="n"><input type="number" step="0.01" value="'+(r.px||'')+'" data-i="'+i+'" placeholder="enter"></td>';
if(!r.px){h+='<td colspan="9">Enter a price to analyze.</td></tr>';return}
if(!ct){h+='<td colspan="9">Needs 100 shares to cover one contract ('+(100-r.sh)+' more).</td></tr>';return}
var K=snap(strikeFor(r.px,T,iv0,dl),r.px);if(K<=r.px)K=snap(r.px*1.01,r.px);
var p=call(r.px,K,T,iv0),tot=p*100*ct,ret=p/r.px,pc=N(d1(r.px,K,T,iv0)-iv0*Math.sqrt(T)),mg=((K-r.px)+p)*100*ct;
tp+=tot;tv+=r.px*100*ct;tc+=ct;
h+='<td class="n">'+ct+'</td><td class="n">'+money2(K)+' <span class="pill">'+((K/r.px-1)*100).toFixed(1)+'% OTM</span></td><td class="n">'+money2(p)+'</td><td class="n">'+money(tot)+'</td><td class="n">'+(ret*100).toFixed(2)+'%</td><td class="n">'+(ret*365/days*100).toFixed(1)+'%</td><td class="n">'+(pc*100).toFixed(0)+'%</td><td class="n">'+money(mg)+'</td><td class="n">'+money2(r.px-p)+'</td></tr>'});
$('res').innerHTML=h;
$('res').querySelectorAll('input').forEach(function(e){e.onchange=function(){H[+e.dataset.i].px=+e.value||0;run()}});
$('resk').innerHTML=tc?k('Contracts to sell',tc)+k('Est. premium this period',money(tp))+k('Stock value covered',money(tv))+k('Return on covered value',(tp/tv*100).toFixed(2)+'%')+k('Annualized if repeated',(tp/tv*365/days*100).toFixed(1)+'%'):''}
$('file').onchange=function(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){H=parse(String(r.result));if(!H.length){$('res').innerHTML='<tr><td>No holdings found. Use columns: symbol, shares, price.</td></tr>';return}run()};r.readAsText(f)};
$('sample').onclick=function(){H=parse('symbol,shares,price\nAAPL,200,225\nMSFT,150,430\nKO,500,68\nPLTR,60,40\nT,1000,22');run()};
['exp','sty','iv'].forEach(function(i){$(i).onchange=function(){if(H.length)run()}});
})();
