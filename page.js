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



// ====================== CONTACT FORM (nouveau) ======================
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) return;   // ← sécurité : seulement sur contact.html

    // ====================== POPUP ERREUR (nouveau) ======================
function showErrorPopup(msg) {
    // Option 1 : utiliser le toast que tu as déjà (recommandé)
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = msg;
        toast.style.background = '#e74c3c';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 6000);
        return;
    }

  
}

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(contactForm);
        const data = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            subject: formData.get('subject'),
            message: formData.get('message')
        };

        const submitBtn = contactForm.querySelector('button');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Sending...";
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
                popup.classList.add('show');

                // Auto-fermeture après 8 secondes
                setTimeout(() => popup.classList.remove('show'), 8000);

                // Bouton Close manuel
                document.getElementById('contact-popup-close').onclick = () => {
                    popup.classList.remove('show');
                };

                contactForm.reset();
            } else {
                showErrorPopup("Error: " + (result.error || "Unknown"));
            }
        } catch (err) {
            showErrorPopup("Network error. Please try again.");
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
});