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



// ====================== CONTACT FORM (CORRIGÉ) ======================
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) {
        console.warn("⚠️ Contact form non trouvé (id='contact-form'). Vérifie que tu es bien sur contact.html");
        return;
    }

    console.log("✅ Contact form détecté – listener attaché");

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("🚀 Submit déclenché !");

        const formData = new FormData(contactForm);
        const data = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            subject: formData.get('subject'),
            message: formData.get('message')
        };

        const submitBtn = contactForm.querySelector('button[type="submit"]') || contactForm.querySelector('button');
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
            console.log("Réponse serveur :", result);

            if (result.success) {
                const popup = document.getElementById('contact-success-popup');
                if (popup) {
                    popup.classList.add('show');
                    setTimeout(() => popup.classList.remove('show'), 8000);
                }
                document.getElementById('contact-popup-close').onclick = () => {
                    popup.classList.remove('show');
                };
                contactForm.reset();
                console.log("✅ Message enregistré avec succès !");
            } else {
                showErrorPopup("Error: " + (result.error || "Unknown"));
            }
        } catch (err) {
            console.error("❌ Erreur fetch :", err);
            showErrorPopup("Network error. Please try again.");
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
});



/* ================================================================
   FAQ SMART SEARCH — à ajouter dans page.js
================================================================ */

(function () {

    const searchInput = document.getElementById('faq-search-input');
    if (!searchInput) return;

    // Désactiver l'autocomplete du browser
    searchInput.setAttribute('autocomplete', 'off');

    let faqData = [];
    let selectedIndex = -1;
    let dropdown = null;

    // ── Créer le dropdown (attaché au body pour position:fixed) ──
    function createDropdown() {
        // Supprimer s'il existe déjà pour éviter le double
        var existing = document.getElementById('faq-suggestions-dropdown');
        if (existing) existing.remove();

        dropdown = document.createElement('div');
        dropdown.id = 'faq-suggestions-dropdown';
        dropdown.setAttribute('role', 'listbox');
        document.body.appendChild(dropdown);
    }

    // ── Repositionner le dropdown sous la barre de recherche ──
    function repositionDropdown() {
        if (!dropdown) return;
        var rect = searchInput.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + 8) + 'px';
    }

    // ── Charger faq-data.json ──
    fetch('faq-data.json')
        .then(function (res) { return res.json(); })
        .then(function (data) {
            faqData = data;
            createDropdown();
            bindEvents();
        })
        .catch(function () {
            console.warn('CurvaFit FAQ: faq-data.json introuvable, smart search désactivé.');
        });

    // ── Filtrer ──
    function filterData(query) {
        if (!query || query.length < 2) return [];
        var q = query.toLowerCase();
        return faqData.filter(function (item) {
            return item.question.toLowerCase().includes(q) ||
                   item.category.toLowerCase().includes(q);
        }).slice(0, 7);
    }

    // ── Highlight du mot cherché ──
    function highlight(text, query) {
        if (!query) return text;
        var regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // ── Afficher les suggestions ──
    function showSuggestions(results, query) {
        dropdown.innerHTML = '';
        selectedIndex = -1;

        if (results.length === 0) {
            dropdown.classList.remove('faq-dd--open');
            return;
        }

        results.forEach(function (item, index) {
            var li = document.createElement('div');
            li.className = 'faq-dd-item';
            li.setAttribute('role', 'option');
            li.setAttribute('data-index', index);
            li.setAttribute('data-section', item.section);
            li.setAttribute('data-id', item.id);

            li.innerHTML =
                '<span class="faq-dd-cat">' + item.category + '</span>' +
                '<span class="faq-dd-text">' + highlight(item.question, query) + '</span>' +
                '<span class="faq-dd-arrow">↓</span>';

            li.addEventListener('mousedown', function (e) {
                e.preventDefault();
                goToQuestion(item);
            });

            dropdown.appendChild(li);
        });

        repositionDropdown();
        dropdown.classList.add('faq-dd--open');
    }

    // ── Fermer le dropdown ──
    function closeDropdown() {
        if (dropdown) {
            dropdown.classList.remove('faq-dd--open');
            selectedIndex = -1;
        }
    }

    // ── Aller vers la question ──
    function goToQuestion(item) {
        closeDropdown();
        searchInput.value = item.question;

        var section = document.getElementById(item.section);
        if (!section) return;

        var accordionItems = section.querySelectorAll('.accordion-item');
        var targetItem = null;

        // Trouver l'item exact par texte
        accordionItems.forEach(function (acc) {
            var btn = acc.querySelector('.accordion-header');
            if (btn && btn.textContent.trim().toLowerCase().includes(
                item.question.toLowerCase().substring(0, 35)
            )) {
                targetItem = acc;
            }
        });

        // Fallback : trouver par position dans le JSON
        if (!targetItem && accordionItems.length > 0) {
            var sectionItems = faqData.filter(function (d) { return d.section === item.section; });
            var idx = sectionItems.findIndex(function (d) { return d.id === item.id; });
            targetItem = accordionItems[idx] || accordionItems[0];
        }

        if (targetItem) {
            // Fermer les autres accordions ouverts dans la section
            section.querySelectorAll('.accordion-item.active').forEach(function (a) {
                a.classList.remove('active');
                var content = a.querySelector('.accordion-content');
                if (content) content.style.display = 'none';
            });

            // Ouvrir la cible
            targetItem.classList.add('active');
            var content = targetItem.querySelector('.accordion-content');
            if (content) content.style.display = 'block';

            // Scroll avec offset header sticky
            setTimeout(function () {
                var offset = 130;
                var top = targetItem.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top: top, behavior: 'smooth' });

                // Effet visuel de highlight
                targetItem.classList.add('faq-item--highlight');
                setTimeout(function () {
                    targetItem.classList.remove('faq-item--highlight');
                }, 2000);
            }, 100);
        }
    }

    // ── Navigation clavier ──
    function navigateDropdown(direction) {
        var items = dropdown.querySelectorAll('.faq-dd-item');
        if (!items.length) return;

        if (selectedIndex >= 0) {
            items[selectedIndex].classList.remove('faq-dd-item--active');
        }

        selectedIndex += direction;
        if (selectedIndex < 0) selectedIndex = items.length - 1;
        if (selectedIndex >= items.length) selectedIndex = 0;

        items[selectedIndex].classList.add('faq-dd-item--active');
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }

    // ── Lier les events ──
    function bindEvents() {

        // Frappe dans la barre
        searchInput.addEventListener('input', function () {
            var query = this.value.trim();
            var results = filterData(query);
            showSuggestions(results, query);

            var clearBtn = document.getElementById('faq-search-clear');
            if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';
        });

        // Recalculer la position si scroll ou resize
        window.addEventListener('scroll', function () {
            if (dropdown && dropdown.classList.contains('faq-dd--open')) {
                repositionDropdown();
            }
        }, { passive: true });

        window.addEventListener('resize', function () {
            if (dropdown && dropdown.classList.contains('faq-dd--open')) {
                repositionDropdown();
            }
        });

        // Clavier
        searchInput.addEventListener('keydown', function (e) {
            if (!dropdown.classList.contains('faq-dd--open')) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateDropdown(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateDropdown(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0) {
                    var items = dropdown.querySelectorAll('.faq-dd-item');
                    if (items[selectedIndex]) {
                        var id = items[selectedIndex].getAttribute('data-id');
                        var item = faqData.find(function (d) { return d.id === id; });
                        if (item) goToQuestion(item);
                    }
                }
            } else if (e.key === 'Escape') {
                closeDropdown();
            }
        });

        // Fermer au clic ailleurs
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#faq-search-input') &&
                !e.target.closest('#faq-suggestions-dropdown')) {
                closeDropdown();
            }
        });

        // Bouton clear
        var clearBtn = document.getElementById('faq-search-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                searchInput.value = '';
                this.style.display = 'none';
                closeDropdown();
                var countEl = document.getElementById('faq-search-count');
                if (countEl) countEl.style.display = 'none';
                document.querySelectorAll('.accordion-item').forEach(function (i) {
                    i.style.display = '';
                });
                document.querySelectorAll('.faq-category').forEach(function (c) {
                    c.style.display = '';
                });
            });
        }
    }

})();