
// Session + UI helpers
function setSession(obj){ localStorage.setItem('btms_session', JSON.stringify({ ...(getSession()||{}), ...obj })); }
function getSession(){ try { return JSON.parse(localStorage.getItem('btms_session')); } catch { return null; } }
function clearSession(){ localStorage.removeItem('btms_session'); }

function setMsg(id, text, ok=true){
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  el.textContent = text || '';
  el.style.display = text ? 'block' : 'none';
}
function fillValue(id, v){ const el = document.getElementById(id); if (el) el.value = v ?? ''; }

function renderNav(){
  const nav = document.getElementById('nav');
  if (!nav) return;
  const s = getSession();
  const who = s?.customerName ? ` (Logged in: ${s.customerName})` : '';
  nav.innerHTML = `
    <a href="./index.html">Home</a>
    <a href="./register.html">Register / Login</a>
    <a href="./create-account.html">Create Account</a>
    <a href="./deposit.html">Deposit</a>
    <a href="./withdraw.html">Withdraw</a>
    <a href="./transfer.html">Fund Transfer</a>
    <a href="./mini-statement.html">Mini Statement</a>
    <a id="logout" href="javascript:void(0)">Logout</a>
    <span class="badge">IndexedDB${who}</span>
  `;
  const lo = document.getElementById('logout');
  if (lo) lo.onclick = () => { clearSession(); location.href = './index.html'; };
}

document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  const s = getSession();
  ['accNo','fromAccNo'].forEach(id => { if (s?.accNo && document.getElementById(id)) fillValue(id, s.accNo); });
});

// Debug
window.btmsDebug = () => window.BTMS;
