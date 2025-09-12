/* ============================================================================
   Global Sidebar Controller (final)
   - Mobile (≤1024px): top-left toggle button (hamburger ↔ close) slides <aside> in/out
   - Desktop  (>1024px): <aside> is sticky; uses your built-in #close-btn normally
   - Prevents "double X": on mobile, the in-sidebar #close-btn is hidden; desktop shows it
   - Idempotent: re-running this file won't duplicate UI
   ========================================================================== */

(function () {
  'use strict';

  // Avoid double-boot
  if (window.__SIMP_SIDEBAR_BOOTED__) return;
  window.__SIMP_SIDEBAR_BOOTED__ = true;

  const MOBILE_BREAKPOINT = 1024;
  const DRAWER_WIDTH_PX   = 280;

  const sideMenu  = document.querySelector('aside');
  const closeBtn  = document.getElementById('close-btn');
  const darkMode  = document.querySelector('.dark-mode');
  const container = document.querySelector('.container'); // optional

  if (!sideMenu) return;

  let isMobile = false;
  let backdrop = null;
  let toggleBtn = null;

  /* ------------------------ helpers ------------------------ */
  const debounce = (fn, ms=120) => {
    let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
  };

  const css = (el, obj) => { if (!el) return; for (const k in obj) el.style[k] = obj[k]; };

  function ensureBackdrop() {
    if (backdrop && document.body.contains(backdrop)) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = 'simp-sidebar-backdrop';
    css(backdrop, {
      position: 'fixed', inset: '0', background: 'rgba(17,24,39,.45)',
      zIndex: '10000', display: 'none', opacity: '0', transition: 'opacity .2s ease'
    });
    backdrop.addEventListener('click', closeSidebar);
    document.body.appendChild(backdrop);
    return backdrop;
  }
  function showBackdrop() { ensureBackdrop(); backdrop.style.display='block'; requestAnimationFrame(()=>backdrop.style.opacity='1'); }
  function hideBackdrop() { if (!backdrop) return; backdrop.style.opacity='0'; setTimeout(()=>{ if (backdrop) backdrop.style.display='none'; }, 200); }

  function ensureToggleBtn() {
    if (toggleBtn && document.body.contains(toggleBtn)) return toggleBtn;
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'simp-sidebar-toggle';
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-label','Toggle menu');
    toggleBtn.innerHTML = `<span class="material-icons-sharp" aria-hidden="true">menu</span>`;
    css(toggleBtn, {
      position: 'fixed', top: '12px', left: '12px', width: '42px', height: '42px',
      display: 'none', alignItems: 'center', justifyContent: 'center',
      borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff',
      boxShadow: '0 4px 16px rgba(17,24,39,.10)', zIndex: '10002', cursor: 'pointer'
    });
    toggleBtn.addEventListener('click', () => {
      if (!isMobile) return;
      document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
    });
    document.body.appendChild(toggleBtn);
    return toggleBtn;
  }
  function setToggleIcon(open) {
    if (!toggleBtn) return;
    const icon = toggleBtn.querySelector('.material-icons-sharp');
    if (icon) icon.textContent = open ? 'close' : 'menu';
  }
  function showToggleBtn(){ ensureToggleBtn().style.display = 'inline-flex'; }
  function hideToggleBtn(){ if (toggleBtn) toggleBtn.style.display = 'none'; }

  /* ------------------------ mobile open/close ------------------------ */
  function openSidebar() {
    if (!isMobile) return;
    css(sideMenu, { transform: 'translateX(0)', visibility: 'visible', boxShadow: '0 16px 48px rgba(17,24,39,.22)' });
    document.body.classList.add('sidebar-open');
    showBackdrop();
    setToggleIcon(true);
    if (closeBtn) closeBtn.style.display = 'none'; // prevent double X
  }

  function closeSidebar() {
    if (!isMobile) return;
    css(sideMenu, { transform: 'translateX(-110%)', visibility: 'hidden', boxShadow: 'none' });
    document.body.classList.remove('sidebar-open');
    hideBackdrop();
    setToggleIcon(false);
    if (closeBtn) closeBtn.style.display = ''; // restore default on next desktop switch
  }

  function onKeydown(e){ if (isMobile && e.key === 'Escape') closeSidebar(); }
  function onOutsideClick(e){
    if (!isMobile || !document.body.classList.contains('sidebar-open')) return;
    const insideAside = e.target === sideMenu || sideMenu.contains(e.target);
    const onBtn = toggleBtn && (e.target === toggleBtn || toggleBtn.contains(e.target));
    const onBd  = backdrop && e.target === backdrop;
    if (!insideAside && !onBtn && !onBd) closeSidebar();
  }

  /* ------------------------ desktop sticky ------------------------ */
  function applyDesktop() {
    // clear mobile inline styles
    css(sideMenu, {
      position:'', left:'', top:'', width:'', maxWidth:'', height:'',
      transform:'', transition:'', zIndex:'', visibility:'', boxShadow:'',
      overflowY:'', overflowX:''
    });
    hideBackdrop(); hideToggleBtn();
    if (closeBtn) closeBtn.style.display = ''; // X visible on desktop

    // sticky (with light fallback)
    const supportsSticky = !!(window.CSS && CSS.supports && CSS.supports('position','sticky'));
    if (container && getComputedStyle(container).alignItems !== 'start') container.style.alignItems = 'start';

    if (supportsSticky) {
      css(sideMenu, { position:'sticky', top:'0', zIndex:'5', height:'100vh', overflowY:'auto' });
    } else {
      // fixed fallback
      const rect = sideMenu.getBoundingClientRect();
      const left = (rect.left + window.scrollX) + 'px';
      const width = rect.width + 'px';
      css(sideMenu, { position:'fixed', top:'0', left, width, height:'100vh', overflow:'auto', zIndex:'5' });
      if (container) {
        const cols = width + ' 1fr';
        container.style.gridTemplateColumns = cols;
        container.style.alignItems = 'start';
      }
    }
  }

  /* ------------------------ mobile setup ------------------------ */
  function applyMobile() {
    // baseline off-canvas styles
    css(sideMenu, {
      position:'fixed', left:'0', top:'0', height:'100dvh',
      width: DRAWER_WIDTH_PX+'px', maxWidth:'86vw',
      background:'#fff', transform:'translateX(-110%)',
      transition:'transform .28s ease, box-shadow .28s ease, visibility .28s ease',
      zIndex:'10001', visibility:'hidden', overflowY:'auto', overflowX:'hidden'
    });
    ensureBackdrop();
    showToggleBtn();
    setToggleIcon(false);
    if (closeBtn) closeBtn.style.display = 'none'; // prevent double X
  }

  /* ------------------------ responsive switch ------------------------ */
  function syncMode() {
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const nextMobile = vw <= MOBILE_BREAKPOINT;
    if (nextMobile === isMobile) return;

    isMobile = nextMobile;
    document.body.classList.remove('sidebar-open'); // reset state

    if (isMobile) {
      applyMobile();
      hideBackdrop();
    } else {
      applyDesktop();
    }
  }

  /* ------------------------ events ------------------------ */
  window.addEventListener('resize', debounce(syncMode, 120));
  window.addEventListener('orientationchange', debounce(syncMode, 120));
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('click', onOutsideClick);

  // Keep your dark-mode hook (if present)
  if (darkMode) {
    darkMode.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode-variables');
      const s1 = darkMode.querySelector('span:nth-child(1)');
      const s2 = darkMode.querySelector('span:nth-child(2)');
      s1 && s1.classList.toggle('active');
      s2 && s2.classList.toggle('active');
    });
  }

  // Also close when a sidebar link is clicked (mobile)
  sideMenu.addEventListener('click', (e) => {
    if (!isMobile) return;
    const a = e.target.closest('a');
    if (a && a.getAttribute('href')) closeSidebar();
  });

  // Boot
  syncMode();
  if (!isMobile) applyDesktop();
  // Ensure aside is not display:none from page CSS; drawer hides via transform
  sideMenu.style.display = 'block';
})();
