// FAQ Category Filtering
document.addEventListener('DOMContentLoaded', () => {
    const filterButtons = document.querySelectorAll('.filters button');
    const faqCategories = document.querySelectorAll('.faq-category');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.getAttribute('data-category');

            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active to clicked button
            button.classList.add('active');

            // Show/hide categories
            faqCategories.forEach(section => {
                if (category === 'all' || section.getAttribute('data-category') === category) {
                    section.classList.add('visible');
                } else {
                    section.classList.remove('visible');
                }
            });
        });
    });

    // Optional: Initialize all visible or trigger default
    document.querySelector('.filters button.active')?.click();
});


// Blog Category Filtering
document.addEventListener('DOMContentLoaded', () => {
    const filterButtons = document.querySelectorAll('.category-filters button');
    const blogCards = document.querySelectorAll('.blog-card');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.getAttribute('data-category');

            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active to clicked button
            button.classList.add('active');

            // Show/hide blog cards
            blogCards.forEach(card => {
                if (category === 'all' || card.getAttribute('data-category') === category) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // Initialize with 'All' active
    document.querySelector('.category-filters button.active')?.click();
});



// ====================== CONTACT FORM (VERSION FIXÉE - CLIQUE SÛR) ======================
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) {
        console.warn("⚠️ Formulaire #contact-form non trouvé sur cette page");
        return;
    }

    const submitBtn = contactForm.querySelector('button[type="submit"]') || 
                      contactForm.querySelector('button');

    if (!submitBtn) {
        console.error("❌ Bouton d'envoi non trouvé dans le formulaire !");
        return;
    }

    // ✅ Fonction d'erreur (utilise ton toast déjà présent)
    function showError(msg) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = msg;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 6000);
        } else {
            alert(msg);
        }
    }

    // ====================== CLIQUE DIRECT SUR LE BOUTON ======================
    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();   // empêche le rechargement de page

        console.log("✅ Clique détecté sur le bouton !"); // ← tu verras ça dans la console

        const formData = new FormData(contactForm);
        const data = {
            firstName: formData.get('firstName') || "",
            lastName:  formData.get('lastName') || "",
            email:     formData.get('email') || "",
            subject:   formData.get('subject') || "",
            message:   formData.get('message') || ""
        };

        // Vérification rapide
        if (!data.email || !data.message) {
            showError("Email et message sont obligatoires");
            return;
        }

        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Envoi en cours...";
        submitBtn.disabled = true;

        try {
            const res = await fetch('/.netlify/functions/save-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (result.success) {
                const popup = document.getElementById('contact-success-popup');
                if (popup) {
                    popup.classList.add('show');
                    setTimeout(() => popup.classList.remove('show'), 8000);
                }
                contactForm.reset();
            } else {
                showError("Erreur : " + (result.error || "Inconnue"));
            }
        } catch (err) {
            console.error(err);
            showError("Erreur réseau – réessaie dans 5 secondes");
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Bonus : fermeture du popup
    const closeBtn = document.getElementById('contact-popup-close');
    const popup = document.getElementById('contact-success-popup');
    if (closeBtn && popup) {
        closeBtn.onclick = () => popup.classList.remove('show');
    }
});