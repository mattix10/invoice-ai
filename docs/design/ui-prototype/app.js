/* Static design reference, deliberately framework- and backend-free.
   All three routes consume ONE canonical data object. Do not copy this
   code as Angular application architecture; use docs/design/UI-CONTRACT.md. */
const DEMO = Object.freeze({
  id: 'INV-2026-1042', vendor: 'Northline Office Sp. z o.o.', po: 'PO-2026-0871',
  issued: '22 Oct 2026', due: '21 Nov 2026', currency: 'PLN', status: 'Needs review',
  items: [
    { name: '27-inch monitor', quantity: 10, invoiceUnit: 820, poUnit: 770 },
    { name: 'Keyboard', quantity: 10, invoiceUnit: 110, poUnit: 110 },
    { name: 'USB-C docking station', quantity: 5, invoiceUnit: 240, poUnit: 240 }
  ], vatRate: 0.23,
  invoices: [
    {id:'INV-2026-1042',vendor:'Northline Office Sp. z o.o.',date:'21 Nov 2026',amount:12915,status:'review'},
    {id:'INV-2026-1041',vendor:'Riverton Cloud Ltd.',date:'19 Nov 2026',amount:3444,status:'approved'},
    {id:'INV-2026-1040',vendor:'Baltic Logistics Sp. z o.o.',date:'18 Nov 2026',amount:1845,status:'processing'},
    {id:'INV-2026-1039',vendor:'Fieldstone Services',date:'16 Nov 2026',amount:5166,status:'review'}
  ]
});
const sum = fn => DEMO.items.reduce((acc, item) => acc + fn(item), 0);
const invoiceNet = sum(i=>i.quantity*i.invoiceUnit);
const poNet = sum(i=>i.quantity*i.poUnit);
const tax = Math.round(invoiceNet*DEMO.vatRate*100)/100;
const poTax = Math.round(poNet*DEMO.vatRate*100)/100;
const total = invoiceNet+tax;
const poTotal = poNet+poTax;
const variance = total-poTotal;
const variancePct = (variance/poTotal*100).toFixed(1);
const money = amount => new Intl.NumberFormat('en-GB', {style:'currency',currency:'PLN',minimumFractionDigits:2}).format(amount);
const icons = {
  dashboard:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  invoice:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  ai:'<path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3Z"/><path d="M19 18v4M17 20h4"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back:'<path d="M19 12H5m6 6-6-6 6-6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.5"/>',
  alert:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'
};
const icon = (name, cls='tiny-icon') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]||icons.info}</svg>`;
const nav = [
  {id:'dashboard',label:'Overview',icon:'dashboard'},
  {id:'invoices',label:'Invoice workspace',icon:'invoice'},
  {id:'investigation',label:'AI investigation',icon:'ai'}
];
const stat = (label,value,footer,emphasis=false) => `<div class="card stat-card ${emphasis?'stat-emphasis':''}"><p class="stat-label">${label}</p><p class="stat-number">${value}</p><div class="stat-foot">${footer}</div></div>`;
const status = (type,label) => `<span class="status ${type}">${label}</span>`;
const button = (label, route, variant='') => `<a class="btn ${variant}" href="#${route}">${label}</a>`;
const demoButton = label => `<button class="btn" type="button" data-demo-action="${label}">${label}</button>`;
const cardTitle = (title,desc,link='') => `<div class="card-header"><div><h2>${title}</h2>${desc?`<p class="card-kicker">${desc}</p>`:''}</div>${link?`<a class="link" href="#${link}">View details →</a>`:''}</div>`;
function dashboard(){
  const rows=DEMO.invoices.map((inv,index)=>`<tr><td class="primary-col">${inv.id}</td><td>${inv.vendor}</td><td class="muted">${inv.date}</td><td class="money">${money(inv.amount)}</td><td>${status(inv.status,inv.status==='review'?'Needs review':inv.status==='approved'?'Approved':'Processing')}</td><td>${index===0?'<a class="link" href="#invoices" aria-label="Review example invoice">Review →</a>':'<button class="link" type="button" data-demo-action="Open another invoice">Preview →</button>'}</td></tr>`).join('');
  const months=['May','Jun','Jul','Aug','Sep','Oct'];const values=[67,76,80,91,107,124];
  return `<div class="page-title-row"><div><p class="eyebrow">FINANCE OPERATIONS</p><h1>Good afternoon, Jordan</h1><p class="subtitle">Your priority today: resolve the exceptions that need human review.</p></div><div class="actions">${button('Review next invoice '+icon('arrow'),'invoices','btn-primary')}</div></div>
  <div class="stat-grid">${stat('Awaiting review','8','<span class="delta neutral">3 require action today</span>',true)}${stat('Approved this month','96','<span class="delta">+12% vs. last month</span>')}${stat('Processed this month','124','<span class="delta">+8% vs. last month</span>')}${stat('Invoice value · Oct',money(318740),'<span class="muted">All demo invoices this month</span>')}</div>
  <div class="focus-strip"><div class="focus-ic">!</div><div><strong>One price discrepancy deserves attention</strong><p>${DEMO.id}: invoice value exceeds purchase order by ${money(variance)} (${variancePct}%). No payment decision has been made.</p></div><a class="link" href="#investigation">Investigate →</a></div>
  <div class="dash-grid"><section class="card card-pad">${cardTitle('Review queue','Invoices needing review, ordered by urgency','invoices')}<div class="table-scroll"><table class="data-table"><thead><tr><th>Invoice</th><th>Vendor</th><th>Due</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>
  <div class="split-stack"><section class="card card-pad">${cardTitle('Processing volume','Invoices processed by month')}<div class="chart" role="img" aria-label="Invoice processing volume increased from 67 in May to 124 in October">${values.map((v,i)=>`<div class="chartbar ${i===5?'focus':''}" style="height:${Math.round(v/124*100)}%" title="${months[i]}: ${v} invoices"></div>`).join('')}</div><div class="chart-labels">${months.map(m=>`<span>${m}</span>`).join('')}</div><div class="chart-note">Oct 2026 · <strong>124 invoices</strong> · Demo dataset</div></section>
  <section class="card card-pad">${cardTitle('Attention required','Clear, actionable next steps')}<div class="priority-list"><div class="priority-item"><div class="priority-dot">!</div><div><strong>Price variance · ${DEMO.id}</strong><small>Northline Office · ${money(variance)} above PO</small></div><a href="#investigation" class="link">Open →</a></div><div class="priority-item"><div class="priority-dot neutral">i</div><div><strong>7 more invoices await review</strong><small>Review data is synthetic in this prototype</small></div></div></div></section></div></div>`;
}
function paper(){return `<div class="invoice-paper" aria-label="Simulated invoice document"><div class="paper-head"><div><div class="paper-name">NORTHLINE OFFICE</div><div class="paper-block">Sp. z o.o.<br>Fictional supplier · demo invoice</div></div><div><div class="paper-tag">INVOICE</div><div class="paper-block"><strong>${DEMO.id}</strong></div></div></div><div class="paper-detail"><div class="paper-block"><strong>Bill to</strong><br>Example Finance Operations<br>Warsaw, Poland</div><div class="paper-block"><strong>Issued</strong> ${DEMO.issued}<br><strong>Due</strong> ${DEMO.due}<br><strong>Order</strong> ${DEMO.po}</div></div><table class="paper-table"><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Unit</th><th class="right">Net</th></tr></thead><tbody>${DEMO.items.map(i=>`<tr><td>${i.name}</td><td class="right">${i.quantity}</td><td class="right">${money(i.invoiceUnit)}</td><td class="right">${money(i.quantity*i.invoiceUnit)}</td></tr>`).join('')}</tbody></table><div class="paper-total"><span>Net</span><span>${money(invoiceNet)}</span><span>VAT 23%</span><span>${money(tax)}</span><strong>Total due</strong><strong>${money(total)}</strong></div><p class="paper-footer">Sample document generated for the UI concept. No financial or personal data is real.</p></div>`;}
function field(label,value,help='',warning=false){return `<div class="field"><span class="field-label">${label}</span><div class="field-value ${warning?'warning':''}">${value}</div>${help?`<div class="field-help">${help}</div>`:''}</div>`;}
function invoices(){
  return `<a class="back-link" href="#dashboard">${icon('back')} Overview</a><div class="page-title-row"><div><p class="eyebrow">INVOICE WORKSPACE</p><div class="detail-hero"><h1 style="margin:0">${DEMO.id}</h1>${status('review','Needs review')}</div><div class="detail-meta"><span>${DEMO.vendor}</span><span>Issued ${DEMO.issued}</span><span>${money(total)}</span></div></div><div class="actions">${demoButton('Save draft')}${button('Investigate with AI '+icon('arrow'),'investigation','btn-primary')}</div></div>
  <div class="workspace"><section class="card"><div class="preview-header"><h2>Source document</h2><span class="muted" style="font-size:11px">Page 1 of 1 · Sample</span></div><div class="document-preview">${paper()}</div></section>
  <section class="card card-pad">${cardTitle('Extracted information','Read-only fields in the design prototype · editable in the target product')}<div class="field-grid">${field('Supplier',DEMO.vendor,'Example supplier')}${field('Invoice number',DEMO.id)}${field('Issue date',DEMO.issued)}${field('Due date',DEMO.due)}${field('Purchase order',DEMO.po)}${field('Currency',DEMO.currency)}</div><div class="section-sep"></div><div class="detail-section-title">Line items and purchase-order comparison</div>
  <div class="table-scroll"><table class="small-table"><thead><tr><th>Item</th><th>Qty</th><th>Invoice unit</th><th>PO unit</th><th>Variance (net)</th></tr></thead><tbody>${DEMO.items.map(i=>`<tr><td>${i.name}</td><td>${i.quantity}</td><td>${money(i.invoiceUnit)}</td><td>${money(i.poUnit)}</td><td class="${i.invoiceUnit!==i.poUnit?'danger-text':''}">${money((i.invoiceUnit-i.poUnit)*i.quantity)}</td></tr>`).join('')}</tbody></table></div>
  <div class="section-sep"></div><div class="detail-section-title">Reconciliation result</div><div class="amount-diff"><div><strong>Price mismatch detected</strong><p>10 monitors are invoiced at ${money(820)} vs. ${money(770)} in the PO. Quantities match the delivery.</p></div><span class="diff-number">+${money(variance)}</span></div>
  <div class="side-metric"><label>Invoice total incl. VAT</label><strong>${money(total)}</strong></div><div class="side-metric"><label>Purchase order incl. VAT</label><strong>${money(poTotal)}</strong></div><div class="side-metric"><label>Difference incl. VAT</label><strong class="danger-text">+${money(variance)} (${variancePct}%)</strong></div>
  <p class="inline-hint" style="margin:15px 0 0">The mismatch is calculated deterministically; AI does not approve invoices or determine monetary totals.</p><div class="right-actions">${demoButton('Request clarification')}${button('View investigation '+icon('arrow'),'investigation','btn-primary')}</div></section></div>`;
}
function evidence(title,desc,label){return `<div class="evidence-item"><span class="evidence-icon">${label}</span><div><strong>${title}</strong><p>${desc}</p></div></div>`;}
function investigation(){
  return `<a class="back-link" href="#invoices">${icon('back')} Invoice workspace</a><div class="page-title-row"><div><p class="eyebrow">EXCEPTION INVESTIGATION</p><h1>Understand the discrepancy</h1><p class="subtitle">Evidence-backed explanation for ${DEMO.id}. The final decision belongs to the finance reviewer.</p></div><div class="actions">${demoButton('Export report')}${button('Back to invoice','invoices','btn-primary')}</div></div>
  <div class="focus-strip"><div class="focus-ic">!</div><div><strong>${DEMO.id} · price mismatch</strong><p>${DEMO.vendor} · ${money(total)} invoice · ${money(poTotal)} purchase order · +${money(variance)} difference.</p></div>${status('review','Needs review')}</div>
  <div class="investigation-grid"><section class="card ai-overview"><div class="ai-heading"><div class="ai-glyph">✳</div><div><h2>Investigation summary</h2><p class="card-kicker">Demonstration narrative — not a real LLM response</p></div></div><div class="ai-summary"><h2>The invoice exceeds the purchase order by ${money(variance)} (${variancePct}%).</h2><p>The difference is explained by a higher unit price for 10 monitors: ${money(820)} on the invoice compared with ${money(770)} on the purchase order. That creates a net difference of ${money(500)}, plus ${money(115)} VAT at 23%. Quantities match the purchase order and delivery record. The price change requires human verification.</p></div>
  <div class="detail-section-title">Verified evidence</div><div class="evidence-list">${evidence('Invoice '+DEMO.id,`10 monitors × ${money(820)} = ${money(8200)} net.`,'01')}${evidence('Purchase order '+DEMO.po,`10 monitors × ${money(770)} = ${money(7700)} net.`,'02')}${evidence('Delivery receipt · demo data','10 monitors, 10 keyboards and 5 docks received; quantities match the invoice.','03')}</div><div class="section-sep"></div><div class="detail-section-title">Suggested next step</div><div class="callout"><strong>Request supplier confirmation.</strong> Before approval, verify whether the monitor price increase was agreed and attach supporting evidence. No automatic approval or payment will be initiated.</div><div class="right-actions">${demoButton('Request supplier confirmation')}</div></section>
  <div class="split-stack"><section class="card card-pad">${cardTitle('Discrepancy breakdown','Computed from source records')}<div class="side-metric"><label>Invoice total</label><strong>${money(total)}</strong></div><div class="side-metric"><label>PO total</label><strong>${money(poTotal)}</strong></div><div class="side-metric"><label>Net difference</label><strong>${money(invoiceNet-poNet)}</strong></div><div class="side-metric"><label>VAT difference</label><strong>${money(tax-poTax)}</strong></div><div class="side-metric"><label>Total variance</label><strong class="danger-text">+${money(variance)}</strong></div><div class="side-metric"><label>Variance</label><strong>${variancePct}%</strong></div></section><section class="card card-pad">${cardTitle('Investigation trail','Auditable sequence, not chain-of-thought')}<div class="steps"><div class="step"><div class="step-num">1</div><div><strong>Invoice parsed</strong>Validated line items and totals</div></div><div class="step"><div class="step-num">2</div><div><strong>PO matched</strong>Matched purchase-order reference</div></div><div class="step"><div class="step-num">3</div><div><strong>Differences calculated</strong>Monitors have a +${money(50)} unit price</div></div><div class="step"><div class="step-num">4</div><div><strong>Human review required</strong>No financial action taken</div></div></div></section></div></div>`;
}
const screens = {dashboard, invoices, investigation};
let lastToastId;
function render(){
  let current=location.hash.replace('#','')||'dashboard';
  if(!screens[current]) current='dashboard';
  document.getElementById('side-nav').innerHTML=nav.map(n=>`<a class="nav-link ${n.id===current?'active':''}" ${n.id===current?'aria-current="page"':''} href="#${n.id}" title="${n.label}"><span class="nav-icon">${icon(n.icon,'')}</span><span class="nav-label">${n.label}</span></a>`).join('');
  document.getElementById('topbar-current').textContent=nav.find(n=>n.id===current).label;
  document.getElementById('screen').innerHTML=screens[current]();
  document.title=`${nav.find(n=>n.id===current).label} — InvoiceAI design preview`;
  window.scrollTo({top:0,behavior:'instant'});
}
function showToast(message){const el=document.getElementById('toast');el.textContent=message;el.hidden=false;clearTimeout(lastToastId);lastToastId=setTimeout(()=>{el.hidden=true},3600)}
window.addEventListener('hashchange',render);
document.addEventListener('click',ev=>{const el=ev.target.closest('[data-demo-action]');if(el) showToast(`“${el.getAttribute('data-demo-action')}” is a design-only action; no data was saved or sent.`)});
render();
