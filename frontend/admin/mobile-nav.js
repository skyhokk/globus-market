document.addEventListener('DOMContentLoaded', () => {
    const burgerBtn = document.getElementById('burger-btn');
    const burgerMenu = document.getElementById('burger-menu');
    const burgerOverlay = document.getElementById('burger-overlay');

    function openBurger() {
        if (burgerMenu && burgerOverlay) {
            burgerMenu.classList.add('open');
            burgerOverlay.classList.add('show');
        }
    }

    function closeBurger() {
        if (burgerMenu && burgerOverlay) {
            burgerMenu.classList.remove('open');
            burgerOverlay.classList.remove('show');
        }
    }
    
    if (burgerBtn) {
        burgerBtn.addEventListener('click', openBurger);
    }
    if (burgerOverlay) {
        burgerOverlay.addEventListener('click', closeBurger);
    }
});