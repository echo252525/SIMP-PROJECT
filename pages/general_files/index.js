/* ============================================================================
   Global Sidebar Controller (final, with aesthetic peek + animated close)
   - Mobile (≤1024px): top-left toggle button (hamburger ↔ close) slides <aside> in/out
   - Desktop  (>1024px): <aside> is sticky; uses your built-in #close-btn normally
   - Prevents "double X": on mobile, the in-sidebar #close-btn is hidden; desktop shows it
   - Idempotent: re-running this file won't duplicate UI
   - Enhancements you asked for:
       • When OPEN on mobile and not hovered, the sidebar “peeks” (slides mostly off-screen)
         leaving a slim, animated handle you can hover/click to reveal it again.
       • The burger button gets a subtle transparency/shift animation (only the button, not the sidebar).
       • Aesthetic “X” (close) styling/animation for desktop #close-btn, without breaking behavior.
   ========================================================================== */

(function () {
  'use strict';

  // Avoid double-boot
  if (window.__SIMP_SIDEBAR_BOOTED__) return;
  window.__SIMP_SIDEBAR_BOOTED__ = true;

  const MOBILE_BREAKPOINT = 1024;
  const DRAWER_WIDTH_PX   = 280;

  // Peek config (mobile, when OPEN but not hovered)
  const PEEK_OVERLAP_PX   = 22;   // visible part when peeking
  const PEEK_IDLE_DELAY   = 550;  // ms after leaving before peeking

  // BURGER BUTTON transparency/shift (button only)
  const BTN_UNHOVER_OPACITY = 0.55;
  const BTN_HOVER_OPACITY   = 1.0;
  const BTN_UNHOVER_SHIFT   = -6;  // small nudge left when idle
  const BTN_HOVER_SHIFT     = 0;   // normal position on hover/focus/touch
  const TOUCH_HOLD_MS       = 1600;

  // ✨ New: keep-open-until-explicit-close behavior
  // When true, the mobile drawer stays fully open until toggle is pressed again.
  // No auto-close on outside click or Escape, and no auto-peek while open.
  const EXPLICIT_CLOSE_ONLY = true;

  const sideMenu  = document.querySelector('aside');
  const closeBtn  = document.getElementById('close-btn');
  const darkMode  = document.querySelector('.dark-mode');
  const container = document.querySelector('.container'); // optional

  if (!sideMenu) return;

  let isMobile = false;
  let backdrop = null;
  let toggleBtn = null;
  let handle    = null;  // peek handle
  let touchTimer = null;
  let peekTimer  = null;

  /* ------------------------ helpers ------------------------ */
  const debounce = (fn, ms=120) => {
    let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
  };

  const css = (el, obj) => { if (!el) return; for (const k in obj) el.style[k] = obj[k]; };

  const isOpen = () => document.body.classList.contains('sidebar-open');

  function clearTimers() { if (peekTimer) { clearTimeout(peekTimer); peekTimer = null; } if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; } }

  function ensureBackdrop() {
    if (backdrop && document.body.contains(backdrop)) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = 'simp-sidebar-backdrop';
    css(backdrop, {
      position: 'fixed', inset: '0', background: 'rgba(17,24,39,.45)',
      zIndex: '10000', display: 'none', opacity: '0', transition: 'opacity .2s ease'
    });
    // default close-on-click
    backdrop.addEventListener('click', closeSidebar);
    // ✨ New: intercept backdrop clicks when explicit-close-only is on
    if (EXPLICIT_CLOSE_ONLY) {
      backdrop.addEventListener('click', (e) => {
        if (isMobile && isOpen()) { e.stopPropagation(); e.preventDefault(); }
      }, true); // capture to block before default
    }
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
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      background: '#fff',
      boxShadow: '0 4px 16px rgba(17,24,39,.10)',
      zIndex: '10002',
      cursor: 'pointer',
      transition: 'opacity .18s ease, transform .18s ease, box-shadow .18s ease, background .18s ease'
    });
    toggleBtn.addEventListener('click', () => {
      if (!isMobile) return;
      isOpen() ? closeSidebar(true /*explicit*/) : openSidebar();
    });
    document.body.appendChild(toggleBtn);

    // ——— Burger transparency/shift only on the button (mobile) ———
    const btnHoverLook = () => {
      if (!isMobile) return;
      css(toggleBtn, {
        opacity: String(BTN_HOVER_OPACITY),
        transform: `translateX(${BTN_HOVER_SHIFT}px)`,
        boxShadow: '0 8px 24px rgba(17,24,39,.18)'
      });
    };
    const btnUnhoverLook = () => {
      if (!isMobile) return;
      css(toggleBtn, {
        opacity: String(BTN_UNHOVER_OPACITY),
        transform: `translateX(${BTN_UNHOVER_SHIFT}px)`,
        boxShadow: '0 4px 16px rgba(17,24,39,.10)'
      });
    };
    toggleBtn.__hoverLook = btnHoverLook;
    toggleBtn.__unhoverLook = btnUnhoverLook;

    // pointer/focus/touch handlers
    toggleBtn.addEventListener('mouseenter', btnHoverLook);
    toggleBtn.addEventListener('mouseleave', btnUnhoverLook);
    toggleBtn.addEventListener('focusin',  btnHoverLook);
    toggleBtn.addEventListener('focusout', btnUnhoverLook);
    toggleBtn.addEventListener('touchstart', () => {
      if (!isMobile) return;
      clearTimers();
      btnHoverLook();
      touchTimer = setTimeout(btnUnhoverLook, TOUCH_HOLD_MS);
    }, { passive: true });

    return toggleBtn;
  }
  function setToggleIcon(open) {
    if (!toggleBtn) return;
    const icon = toggleBtn.querySelector('.material-icons-sharp');
    if (icon) {
      icon.style.transition = 'transform .24s ease';
      icon.textContent = open ? 'close' : 'menu';
      icon.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
    }
    // Subtle accent when opened
    if (open) {
      toggleBtn.style.background = 'linear-gradient(180deg,#ffffff,#f7fafc)';
      toggleBtn.style.borderColor = '#dbe2ea';
    } else {
      toggleBtn.style.background = '#fff';
      toggleBtn.style.borderColor = '#e5e7eb';
    }
  }
  function showToggleBtn(){ ensureToggleBtn().style.display = 'inline-flex'; }
  function hideToggleBtn(){ if (toggleBtn) toggleBtn.style.display = 'none'; }

  /* ------------------------ Aesthetic desktop close (your #close-btn) ------------------------ */
  function styleDesktopClose() {
    if (!closeBtn) return;
    // Soften the button
    css(closeBtn, {
      borderRadius: '10px',
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'saturate(140%) blur(2px)',
      boxShadow: '0 6px 18px rgba(17,24,39,.08)',
      transition: 'transform .18s ease, box-shadow .18s ease, background .18s ease'
    });
    const ico = closeBtn.querySelector('.material-icons-sharp');
    if (ico) ico.style.transition = 'transform .24s ease';

    const hoverIn = () => {
      css(closeBtn, { background: '#ffffff', boxShadow: '0 10px 26px rgba(17,24,39,.12)', transform: 'translateY(-1px)' });
      if (ico) ico.style.transform = 'rotate(90deg)';
    };
    const hoverOut = () => {
      css(closeBtn, { background: 'rgba(255,255,255,0.85)', boxShadow: '0 6px 18px rgba(17,24,39,.08)', transform: 'none' });
      if (ico) ico.style.transform = 'rotate(0deg)';
    };
    closeBtn.addEventListener('mouseenter', hoverIn);
    closeBtn.addEventListener('mouseleave', hoverOut);
    closeBtn.addEventListener('focusin', hoverIn);
    closeBtn.addEventListener('focusout', hoverOut);
  }

  /* ------------------------ Peek handle (mobile, visible when sidebar is peeking) ------------------------ */
  function ensureHandle() {
    if (handle && document.body.contains(handle)) return handle;
    handle = document.createElement('button');
    handle.id = 'simp-sidebar-handle';
    handle.type = 'button';
    handle.setAttribute('aria-label','Reveal menu');
    handle.innerHTML = `<span class="material-icons-sharp" aria-hidden="true">chevron_right</span>`;
    css(handle, {
      position: 'fixed',
      left: '0px',
      top: '50%',
      transform: 'translate(-50%, -50%)', // half outside screen for a soft "tab" look
      width: '34px',
      height: '86px',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid #d8dee6',
      borderRadius: '999px',
      background: 'linear-gradient(180deg,#ffffff 0%, #f3f6f9 100%)',
      boxShadow: '0 10px 26px rgba(17,24,39,.15)',
      zIndex: '10001',
      cursor: 'pointer',
      transition: 'transform .2s ease, box-shadow .2s ease, opacity .2s ease'
    });
    handle.addEventListener('mouseenter', () => {
      if (!isMobile || !isOpen() || EXPLICIT_CLOSE_ONLY) return;
      css(handle, { transform: 'translate(-40%, -50%)', boxShadow: '0 14px 32px rgba(17,24,39,.22)' });
      revealFull(); // reveal on hover
    });
    handle.addEventListener('mouseleave', () => {
      if (!isMobile || !isOpen() || EXPLICIT_CLOSE_ONLY) return;
      css(handle, { transform: 'translate(-50%, -50%)', boxShadow: '0 10px 26px rgba(17,24,39,.15)' });
    });
    handle.addEventListener('click', () => { if (isMobile && isOpen() && !EXPLICIT_CLOSE_ONLY) revealFull(); });
    document.body.appendChild(handle);
    return handle;
  }
  function showHandle() { if (!EXPLICIT_CLOSE_ONLY) ensureHandle().style.display = 'inline-flex'; }
  function hideHandle() { if (handle) handle.style.display = 'none'; }

  /* ------------------------ Peek / reveal ------------------------ */
  function revealFull() {
    if (!isMobile || !isOpen()) return;
    clearTimers();
    css(sideMenu, { transform: 'translateX(0)' });
    hideHandle();
  }
  function peekSidebar() {
    if (!isMobile || !isOpen() || EXPLICIT_CLOSE_ONLY) return;
    const rect = sideMenu.getBoundingClientRect();
    const width = Math.min(rect.width || DRAWER_WIDTH_PX, window.innerWidth * 0.86);
    const offset = Math.max(0, width - PEEK_OVERLAP_PX);
    css(sideMenu, { transform: `translateX(-${offset}px)` });
    showHandle();
  }

  /* ------------------------ mobile open/close ------------------------ */
  function openSidebar() {
    if (!isMobile) return;
    css(sideMenu, {
      transform: 'translateX(0)',
      visibility: 'visible',
      boxShadow: '0 16px 48px rgba(17,24,39,.22)'
    });
    document.body.classList.add('sidebar-open');
    showBackdrop();
    setToggleIcon(true);
    if (closeBtn) closeBtn.style.display = 'none'; // prevent double X (mobile)
    toggleBtn?.__hoverLook?.();

    // When EXPLICIT_CLOSE_ONLY is true, do NOT auto-peek
    clearTimers();
    if (!EXPLICIT_CLOSE_ONLY) {
      peekTimer = setTimeout(peekSidebar, PEEK_IDLE_DELAY + 250); // initial idle peek
    }
  }

  // `explicit` param is only used to make intent clear; behavior is the same either way.
  function closeSidebar(/*explicit*/ _explicit) {
    if (!isMobile) return;
    clearTimers();
    css(sideMenu, { transform: 'translateX(-110%)', visibility: 'hidden', boxShadow: 'none' });
    document.body.classList.remove('sidebar-open');
    hideBackdrop();
    setToggleIcon(false);
    hideHandle();
    if (closeBtn) closeBtn.style.display = ''; // restore desktop default later
    toggleBtn?.__unhoverLook?.();
  }

  function onKeydown(e){
    // ✨ New: ignore Esc auto-close when explicit-close-only is on
    if (EXPLICIT_CLOSE_ONLY && isMobile && isOpen() && e.key === 'Escape') {
      e.preventDefault();
      return;
    }
    if (isMobile && e.key === 'Escape') closeSidebar();
  }
  function onOutsideClick(e){
    if (!isMobile || !isOpen()) return;
    // ✨ New: ignore outside clicks when explicit-close-only is on
    if (EXPLICIT_CLOSE_ONLY) return;

    const insideAside = e.target === sideMenu || sideMenu.contains(e.target);
    const onBtn = toggleBtn && (e.target === toggleBtn || toggleBtn.contains(e.target));
    const onBd  = backdrop && e.target === backdrop;
    const onHandle = handle && (e.target === handle || handle.contains(e.target));
    if (!insideAside && !onBtn && !onBd && !onHandle) closeSidebar();
  }

  /* ------------------------ desktop sticky ------------------------ */
  function applyDesktop() {
    // clear mobile inline styles
    css(sideMenu, {
      position:'', left:'', top:'', width:'', maxWidth:'', height:'',
      transform:'', transition:'', zIndex:'', visibility:'', boxShadow:'',
      overflowY:'', overflowX:''
    });
    hideBackdrop(); hideToggleBtn(); hideHandle();
    if (closeBtn) closeBtn.style.display = ''; // X visible on desktop
    styleDesktopClose(); // make the X look nicer

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
      background:'#fff',
      transform:'translateX(-110%)',
      transition:'transform .32s ease, box-shadow .28s ease, visibility .28s ease',
      zIndex:'10001', visibility:'hidden', overflowY:'auto', overflowX:'hidden'
    });
    ensureBackdrop();
    ensureHandle();
    showToggleBtn();
    setToggleIcon(false);
    if (closeBtn) closeBtn.style.display = 'none'; // prevent double X
    requestAnimationFrame(()=> toggleBtn?.__unhoverLook?.());
  }

  /* ------------------------ responsive switch ------------------------ */
  function syncMode() {
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const nextMobile = vw <= MOBILE_BREAKPOINT;
    if (nextMobile === isMobile) return;

    isMobile = nextMobile;
    document.body.classList.remove('sidebar-open'); // reset state
    clearTimers();

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
    // ✨ New: don't auto-close on link click when explicit-close-only is on
    if (EXPLICIT_CLOSE_ONLY) return;
    if (a && a.getAttribute('href')) closeSidebar();
  });

  // Sidebar hover logic to peek/reveal (mobile only)
  sideMenu.addEventListener('mouseenter', () => {
    if (!isMobile || !isOpen()) return;
    clearTimers();
    // If explicit-close-only, keep it fully open already; still call revealFull to ensure full state
    revealFull();
  });
  sideMenu.addEventListener('mouseleave', () => {
    if (!isMobile || !isOpen()) return;
    clearTimers();
    if (!EXPLICIT_CLOSE_ONLY) {
      peekTimer = setTimeout(peekSidebar, PEEK_IDLE_DELAY);
    }
  });
  sideMenu.addEventListener('focusin', () => {
    if (!isMobile || !isOpen()) return;
    clearTimers();
    revealFull();
  });
  sideMenu.addEventListener('focusout', (e) => {
    if (!isMobile || !isOpen()) return;
    if (!sideMenu.contains(e.relatedTarget)) {
      clearTimers();
      if (!EXPLICIT_CLOSE_ONLY) {
        peekTimer = setTimeout(peekSidebar, PEEK_IDLE_DELAY);
      }
    }
  });
  sideMenu.addEventListener('touchstart', () => {
    if (!isMobile || !isOpen()) return;
    clearTimers();
    revealFull();
    // auto-peek again after some idle time (disabled when explicit-close-only)
    if (!EXPLICIT_CLOSE_ONLY) {
      peekTimer = setTimeout(peekSidebar, PEEK_IDLE_DELAY + 400);
    }
  }, { passive: true });

  // Boot
  syncMode();
  if (!isMobile) applyDesktop();
  // Ensure aside is not display:none from page CSS; drawer hides via transform
  sideMenu.style.display = 'block';
})();

