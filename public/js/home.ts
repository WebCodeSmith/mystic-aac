// Animações e interações da página inicial

class HomePageInteractions {
    private statNumbers: NodeListOf<HTMLElement>;

    constructor() {
        this.statNumbers = document.querySelectorAll('.stat-number');
        this.initializeEventListeners();
    }

    private initializeEventListeners(): void {
        document.addEventListener('DOMContentLoaded', () => {
            this.animateStatNumbers();
            this.setupNewsModals();
            this.setupShareFunctions();
        });
    }

    private animateStatNumbers(): void {
        this.statNumbers.forEach(statNumber => {
            const target = parseInt(statNumber.getAttribute('data-target') || '0');
            let current = 0;
            const increment = target / 100;

            const updateNumber = () => {
                current += increment;
                statNumber.textContent = Math.round(current).toString();
                if (current < target) {
                    requestAnimationFrame(updateNumber);
                } else {
                    statNumber.textContent = target.toString();
                }
            };

            updateNumber();
        });
    }

    private setupNewsModals(): void {
        const modalTriggers = document.querySelectorAll('[data-modal^="newsModal"]');
        
        modalTriggers.forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                const modalId = (trigger as HTMLElement).getAttribute('data-modal');
                if (!modalId) return;

                const modal = document.getElementById(modalId);
                if (!modal) return;

                modal.classList.add('show');
                modal.style.display = 'block';

                const closeButton = modal.querySelector('.modal-close');
                if (closeButton) {
                    closeButton.addEventListener('click', () => {
                        modal.classList.remove('show');
                        setTimeout(() => {
                            modal.style.display = 'none';
                        }, 300);
                    });
                }
            });
        });
    }

    private setupShareFunctions(): void {
        const shareButtons = document.querySelectorAll('.modal-share-icons a');
        
        shareButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                
                const modalContent = button.closest('.modal-content');
                if (!modalContent) return;

                const newsTitleElement = modalContent.querySelector('.modal-header h2');
                const newsTitle = newsTitleElement?.textContent || '';
                const currentUrl = window.location.href;

                const facebookIcon = button.querySelector('.fa-facebook');
                const twitterIcon = button.querySelector('.fa-twitter');
                const linkIcon = button.querySelector('.fa-link');

                if (facebookIcon) {
                    this.shareOnFacebook(currentUrl, newsTitle);
                } else if (twitterIcon) {
                    this.shareOnTwitter(newsTitle);
                } else if (linkIcon) {
                    this.copyNewsLink(currentUrl);
                }
            });
        });
    }

    private shareOnFacebook(url: string, title: string): void {
        const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title)}`;
        window.open(shareUrl, '_blank');
    }

    private shareOnTwitter(title: string): void {
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}`;
        window.open(shareUrl, '_blank');
    }

    private copyNewsLink(url: string): void {
        navigator.clipboard.writeText(url).then(() => {
            alert('Link copiado com sucesso!');
        }).catch(err => {
            console.error('Erro ao copiar link:', err);
        });
    }
}

// Funções globais para uso no HTML
function shareOnFacebook(title: string, newsUrl?: string): void {
    // Se não for fornecida uma URL específica, usa a URL atual
    const url = newsUrl || window.location.href;
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title)}`;
    window.open(shareUrl, '_blank');
}

function shareOnTwitter(title: string, newsUrl?: string): void {
    // Se não for fornecida uma URL específica, usa a URL atual
    const url = newsUrl || window.location.href;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank');
}

function copyNewsLink(index: string): void {
    const modal = document.getElementById(`newsModal${index}`);
    if (!modal) return;

    const newsTitle = modal.querySelector('.modal-header h2')?.textContent || '';
    const newsLink = modal.querySelector('.btn-read-more.modal-action') as HTMLAnchorElement;
    const newsUrl = newsLink ? newsLink.href : window.location.href;

    navigator.clipboard.writeText(newsUrl).then(() => {
        alert(`Link da notícia "${newsTitle}" copiado com sucesso!`);
    }).catch(err => {
        console.error('Erro ao copiar link:', err);
    });
}

// Inicializar as interações da página
new HomePageInteractions();
