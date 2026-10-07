(function(){
var $=function(i){return document.getElementById(i)};
var money=function(v){return '$'+Math.round(v).toLocaleString()};
var money2=function(v){return '$'+v.toFixed(2)};
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function k(t,v){return '<div class="kpi"><b>'+v+'</b><span>'+t+'</span></div>'}

/* ---- Income planner ---- */
var B=[{n:'Broad index ETFs',a:40,y:1.3,eq:1,c:'#2456d6'},{n:'Dividend growth stocks',a:25,y:3,eq:1,c:'#0b8f6a'},{n:'Higher-yield income ETFs',a:15,y:5,eq:1,c:'#d97706'},{n:'T-bills / cash',a:20,y:4.3,eq:0,c:'#8b5cf6'}];
function drawAlloc(){var h='<tr><th>Bucket</th><th>Allocation %</th><th>Yield %</th><th class="n">Amount</th><th class="n">Annual income</th></tr>';
B.forEach(function(b,i){h+='<tr><td>'+b.n+'</td><td><input type="number" data-i="'+i+'" data-k="a" value="'+b.a+'"></td><td><input type="number" step="0.1" data-i="'+i+'" data-k="y" value="'+b.y+'"></td><td class="n" id="am'+i+'"></td><td class="n" id="dv'+i+'"></td></tr>'});
$('alloc').innerHTML=h;
$('alloc').querySelectorAll('input').forEach(function(e){e.oninput=function(){B[+e.dataset.i][e.dataset.k]=+e.value||0;calc()}});}
function calc(){var cap=+$('cap').value||0,cov=(+$('cov').value||0)/100,pm=(+$('prem').value||0)/100,tot=0,div=0,eqv=0;
B.forEach(function(b,i){var amt=cap*b.a/100,d=amt*b.y/100;tot+=b.a;div+=d;if(b.eq)eqv+=amt;$('am'+i).textContent=money(amt);$('dv'+i).textContent=money(d)});
var cc=eqv*cov*pm*12,all=div+cc;
$('plankpi').innerHTML=k('Dividends and interest / yr',money(div))+k('Covered call premium / yr (est.)',money(cc))+k('Total income / yr',money(all))+k('Per month',money(all/12))+k('Income yield on capital',(cap?all/cap*100:0).toFixed(2)+'%')+(Math.round(tot)!==100?k('Allocation total',tot+'% (should be 100%)'):'');
var bar=$('allocbar');bar.innerHTML='';var lg='';
B.forEach(function(b){var s=document.createElement('div');s.style.width=Math.max(0,b.a)+'%';s.style.background=b.c;s.title=b.n+' '+b.a+'%';bar.appendChild(s);lg+='<span><i style="background:'+b.c+'"></i>'+b.n+' '+b.a+'%</span>'});
$('alloclegend').innerHTML=lg.replace(/style="background:([^"]+)"/g,'data-c="$1"');
$('alloclegend').querySelectorAll('i').forEach(function(i){i.style.background=i.dataset.c})}
['cap','cov','prem'].forEach(function(i){$(i).oninput=calc});drawAlloc();calc();

})();
