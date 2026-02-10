
// Session + UI helpers
function setSession(obj){ localStorage.setItem('btms_session', JSON.stringify({ ...(getSession()||{}), ...obj })); }
function getSession(){ try { return JSON.parse(localStorage.getItem('btms_session')); } catch { return null; } }
function clearSession(){ localStorage.removeItem('btms_session'); }
function setMsg(id, text, ok=true, opts={autoHide: ok}){
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  el.textContent = text || '';
  el.setAttribute('role', ok ? 'status' : 'alert');
  el.style.display = text ? 'block' : 'none';
  if (text) {
    try{ el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }catch(e){}
  }
  if (opts.autoHide && ok){
    clearTimeout(el._autohide);
    el._autohide = setTimeout(()=>{ el.style.display = 'none'; }, opts.autoHide === true ? 3000 : opts.autoHide);
  }
}
function fillValue(id, v){ const el = document.getElementById(id); if (el) el.value = v ?? ''; }

// Phone input helpers: attach to inputs with `data-phone` attribute
function _formatPhoneDigits(digits){
  if (!digits) return '';
  digits = digits.replace(/\D/g,'').slice(0,10);
  if (digits.length <=3) return digits;
  if (digits.length <=6) return digits.slice(0,3) + '-' + digits.slice(3);
  return digits.slice(0,3) + '-' + digits.slice(3,6) + '-' + digits.slice(6);
}
function attachPhoneMasks(){
  document.querySelectorAll('input[data-phone]').forEach(inp => {
    inp.setAttribute('inputmode','numeric');
    inp.setAttribute('maxlength','12'); // account for dashes
    inp.addEventListener('input', (e)=>{
      const raw = inp.value.replace(/\D/g,'').slice(0,10);
      const formatted = _formatPhoneDigits(raw);
      const pos = inp.selectionStart;
      inp.value = formatted;
      // keep cursor at end for simplicity
    });
    inp.addEventListener('paste', (e)=>{
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text')||'';
      const digits = text.replace(/\D/g,'').slice(0,10);
      inp.value = _formatPhoneDigits(digits);
    });
  });
}

function rawPhoneValue(id){ const el = document.getElementById(id); if (!el) return ''; return (el.value||'').replace(/\D/g,''); }

function renderNav(){
  const nav = document.getElementById('nav');
  if (!nav) return;
  const s = getSession();
  const who = s?.customerName ? ` (Logged in: ${s.customerName})` : '';
  let html = '';
  // logo at start
  html += `<a class="logo" href="./index.html"><img src="./assets/logo.svg" alt="COCSIT Bank logo" height="44"/></a>`;
  html += `<a href="./index.html">Home</a>`;
  if (!s?.customerId) {
    // Not logged in: only show register/login
    html += `<a href="./register.html">Register / Login</a>`;
  } else {
    // Logged in: show actions and logout
    html += `<a href="./create-account.html">Create Account</a>`;
    html += `<a href="./deposit.html">Deposit</a>`;
    html += `<a href="./withdraw.html">Withdraw</a>`;
    html += `<a href="./transfer.html">Fund Transfer</a>`;
    html += `<a href="./mini-statement.html">Mini Statement</a>`;
    html += `<a id="logout" href="javascript:void(0)">Logout</a>`;
  }
  html += `<span class="badge">IndexedDB${who}</span>`;
  nav.innerHTML = html;

  const lo = document.getElementById('logout');
  if (lo) lo.onclick = () => { clearSession(); location.href = './index.html'; };
}

document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  const s = getSession();
  ['accNo','fromAccNo'].forEach(id => { if (s?.accNo && document.getElementById(id)) fillValue(id, s.accNo); });
  attachPhoneMasks();
});

// Debug
window.btmsDebug = () => window.BTMS;
