/* Defensive, self-contained JS for the site.
   - wrapped in DOMContentLoaded to avoid null references
   - feature-detects before using features
   - graceful fallback: saves booking to localStorage if network fails
*/

document.addEventListener('DOMContentLoaded', function () {
  // Safe helper
  const $ = (sel, ctx = document) => ctx.querySelector(sel);

  // Year in footer
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // NAV toggle for small screens
  const navToggle = $('#nav-toggle');
  const navLinks = $('#nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      navLinks.style.display = expanded ? '' : 'flex';
    });
  }

  // Smooth scroll for internal links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // close mobile nav if open
        if (navLinks && window.innerWidth < 720) navLinks.style.display = '';
      }
    });
  });

  // IntersectionObserver for reveal animations (if supported)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) en.target.classList.add('reveal');
      });
    }, {threshold: 0.12});
    document.querySelectorAll('.section, .card, .post, .service-card').forEach(el => io.observe(el));
  } else {
    // fallback: reveal all
    document.querySelectorAll('.section, .card, .post, .service-card').forEach(el => el.classList.add('reveal'));
  }

  // Quick booking form handler (local demo)
  const quickForm = $('#quick-book');
  if (quickForm) {
    quickForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#qname')?.value?.trim();
      const email = $('#qemail')?.value?.trim();
      const dob = $('#qdob')?.value;
      if (!name || !email || !dob) { alert('Please fill all quick booking fields.'); return; }
      const data = {name,email,dob,created: new Date().toISOString()};
      const arr = JSON.parse(localStorage.getItem('jyotir_bookings')||'[]');
      arr.push(data); localStorage.setItem('jyotir_bookings', JSON.stringify(arr));
      alert('Quick request received. We will contact you soon.');
      quickForm.reset();
    });
  }

  // Booking form: validation + network submit with fallback
  const bookingForm = $('#booking-form');
  const bookingStatus = $('#booking-status');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Simple HTML5 validity check
      if (!bookingForm.checkValidity()) {
        bookingForm.reportValidity();
        return;
      }

      // Honeypot check
      if (bookingForm.querySelector('.hp') && bookingForm.querySelector('.hp').value) {
        // likely bot - silently ignore
        return;
      }

      // Collect data
      const fd = new FormData(bookingForm);
      const obj = {};
      fd.forEach((v,k) => obj[k]=v);

      // UI feedback
      if (bookingStatus) bookingStatus.textContent = 'Submitting...';

      // Try network POST first (endpoint defined in data-endpoint)
      const endpoint = bookingForm.getAttribute('data-endpoint') || null;
      if (endpoint && endpoint.startsWith('http')) {
        try {
          const controller = new AbortController();
          const id = setTimeout(()=>controller.abort(), 15000); // 15s timeout
          const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(obj),
            signal: controller.signal
          });
          clearTimeout(id);
          if (!resp.ok) throw new Error('Server error: ' + resp.status);
          const json = await resp.json().catch(()=>null);
          if (bookingStatus) bookingStatus.textContent = 'Booking confirmed. We will email you shortly.';
          // reset if success
          bookingForm.reset();
          // Optionally store server response locally
          const arr = JSON.parse(localStorage.getItem('jyotir_bookings')||'[]'); arr.push({...obj, serverResponse: json, submittedAt: new Date().toISOString()}); localStorage.setItem('jyotir_bookings', JSON.stringify(arr));
          return;
        } catch (err) {
          console.warn('Network booking failed, saving locally:', err);
          if (bookingStatus) bookingStatus.textContent = 'Network issue — booking saved locally. We will retry later.';
          // fallthrough to local save
        }
      } else {
        if (bookingStatus) bookingStatus.textContent = 'No server endpoint configured — saving locally.';
      }

      // Fallback: save to localStorage
      try {
        const arr = JSON.parse(localStorage.getItem('jyotir_bookings')||'[]'); arr.push({...obj, fallbackSavedAt: new Date().toISOString()}); localStorage.setItem('jyotir_bookings', JSON.stringify(arr));
        if (bookingStatus) bookingStatus.textContent = 'Saved locally. You will receive confirmation after manual review.';
        bookingForm.reset();
      } catch (err) {
        console.error('Failed saving booking locally', err);
        if (bookingStatus) bookingStatus.textContent = 'Failed to save booking. Please try again later or contact via WhatsApp.';
      }
    });
  }

  // Blog read buttons open modal
  document.querySelectorAll('button[data-article]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-article');
      const content = {
        'birth-chart': '<h3>What is a Birth Chart?</h3><p>A birth chart maps planetary positions at your birth. Book a consultation for full report.</p>',
        'compatibility': '<h3>Marriage Compatibility</h3><p>Kundli matching compares moon sign, guna milan and planetary positions.</p>'
      }[key] || '<p>Article not found.</p>';
      showModal(content);
    });
  });

  // Modal helper with focus trap basics
  function showModal(html) {
    // remove existing modal if any
    const existing = document.querySelector('.site-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'site-modal';
    modal.innerHTML = `<div class="site-modal__backdrop" role="dialog" aria-modal="true">
      <div class="site-modal__panel card">
        <button class="site-modal__close" aria-label="Close">✕</button>
        <div class="site-modal__content">${html}</div>
      </div>
    </div>`;

    document.body.appendChild(modal);
    const closeBtn = modal.querySelector('.site-modal__close');
    closeBtn?.focus();

    // close on click/outside/escape
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target === closeBtn) modal.remove();
    });
    document.addEventListener('keydown', function esc(e){ if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', esc); } });
  }

  // Interactive kundli SVG generation (12 slices) — defensive
  const svg = $('#kundli');
  if (svg) {
    (function buildKundli() {
      try {
        const ns = 'http://www.w3.org/2000/svg';
        const cx = 180, cy = 180, r = 140;
        const slicesGroup = document.createElementNS(ns, 'g');
        slicesGroup.setAttribute('id','slices');
        for (let i=0;i<12;i++){
          const startAngle = (i * 30 - 90) * Math.PI/180;
          const endAngle = ((i+1)*30 - 90) * Math.PI/180;
          const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
          const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
          const path = document.createElementNS(ns,'path');
          path.setAttribute('d', d);
          path.setAttribute('fill', (i%2===0)? '#121227' : '#0f1020');
          path.setAttribute('stroke','rgba(255,255,255,0.02)');
          path.setAttribute('data-house', String(i+1));
          path.style.cursor = 'pointer';
          path.addEventListener('click', (ev) => {
            const house = ev.target.getAttribute('data-house') || 'N/A';
            // read last saved booking to provide context (if any)
            const bookings = JSON.parse(localStorage.getItem('jyotir_bookings')||'[]');
            const last = bookings.length ? bookings[bookings.length-1] : null;
            const owner = last?.name ? `<p><strong>For:</strong> ${last.name}</p>` : '';
            showModal(`<h3>House ${house} - Short interpretation</h3>${owner}<p>Short generic interpretation for house ${house}. Book for full analysis.</p>`);
          });
          slicesGroup.appendChild(path);

          // label
          const midAngle = (startAngle + endAngle) / 2;
          const lx = cx + (r-40) * Math.cos(midAngle);
          const ly = cy + (r-40) * Math.sin(midAngle);
          const text = document.createElementNS(ns,'text');
          text.setAttribute('x', String(lx));
          text.setAttribute('y', String(ly));
          text.setAttribute('fill','#d3d3e6');
          text.setAttribute('font-size','12');
          text.setAttribute('text-anchor','middle');
          text.textContent = String(i+1);
          slicesGroup.appendChild(text);
        }
        svg.appendChild(slicesGroup);
      } catch (err) {
        console.error('Failed to build kundli SVG', err);
      }
    })();
  }

}); // DOMContentLoaded end
