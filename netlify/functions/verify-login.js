document.addEventListener('DOMContentLoaded', () => {
  const trigger = document.getElementById('paulTrigger');
  const overlay = document.getElementById('paulPopup');
  const closeBtn = document.querySelector('.paul-close');

  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  const goToSignup = document.getElementById('goToSignup');
  const goToLogin = document.getElementById('goToLogin');

  const isAccountPage = window.location.pathname.includes('account.html') || window.location.pathname.endsWith('account.html');

  // Ouvrir popup
  function openPopup() {
    overlay.classList.add('active');
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
  }

  // Fermeture (bloquée uniquement sur account.html)
  function closePopup() {
    if (isAccountPage) return; // impossible de fermer sur account.html
    overlay.classList.remove('active');
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    if (localStorage.getItem('isLoggedIn') === 'true') {
      window.location.href = 'account.html';
    } else {
      openPopup();
    }
  });

  closeBtn.addEventListener('click', closePopup);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && !isAccountPage) closePopup();
  });

  goToSignup.addEventListener('click', () => {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
  });

  goToLogin.addEventListener('click', () => {
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
  });

  // === INSCRIPTION (ajoute un champ password dans le HTML signupForm !) ===
  document.querySelector('.paul-btn-register').addEventListener('click', async () => {
    const lastName = signupForm.querySelector('input[placeholder="Last Name"]').value.trim();
    const firstName = signupForm.querySelector('input[placeholder="First Name"]').value.trim();
    const email = signupForm.querySelector('input[placeholder="Email"]').value.trim();
    const phone = signupForm.querySelector('input[placeholder="Phone (optional)"]').value.trim();
    const passwordInput = signupForm.querySelector('input[type="password"]'); // ← tu vas l'ajouter
    const password = passwordInput ? passwordInput.value.trim() : '';
    const newsletter = signupForm.querySelector('input[type="checkbox"]').checked ? "Yes" : "No";

    if (!password) return alert("Mot de passe requis");

    const res = await fetch('/.netlify/functions/save-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastName, firstName, email, phone, password, newsletter })
    });

    const data = await res.json();
    if (data.success) {
      alert("Compte créé avec succès !");
      goToLogin.click();
    } else {
      alert("Erreur : " + data.error);
    }
  });

  // === CONNEXION ===
  document.querySelector('.paul-btn-login').addEventListener('click', async () => {
    const email = loginForm.querySelector('input[type="email"]').value.trim();
    const password = loginForm.querySelector('input[type="password"]').value.trim();

    const res = await fetch('/.netlify/functions/verify-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userEmail', email);
      localStorage.setItem('userFirstName', data.user.firstName);
      localStorage.setItem('userLastName', data.user.lastName);

      alert(`Bienvenue ${data.user.firstName} !`);
      overlay.classList.remove('active');

      if (isAccountPage) location.reload();
      else window.location.href = 'account.html';
    } else {
      alert("Erreur : " + data.error);
    }
  });

  // === Protection stricte de account.html ===
  if (isAccountPage) {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
      setTimeout(() => {
        openPopup();
        closeBtn.style.pointerEvents = 'none';
        closeBtn.style.opacity = '0.3';
        closeBtn.title = "Vous devez vous inscrire ou vous connecter pour voir cette page";
      }, 500);
    }
  }
});