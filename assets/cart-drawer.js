class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();
  }

  async fetch()
  {
    let sectionIds = this.getSectionsToRender().map(function (section)
      {
        return section.id;
      }).join(',');

    let url = window.Shopify.routes.root + '?sections=' + sectionIds;

    try
    {
      let response = await fetch(url);
      let parsedSections = await response.json();
      this.renderContents({ sections: parsedSections });
    }
    catch (error) {}
  }
  
  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    if (!cartLink) return;

    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(cartLink);
    });
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        this.open(cartLink);
      }
    });
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);

    let note = this.querySelector('[id^="Details-"] summary');
    if (note && !note.hasAttribute('role')) this.setSummaryAccessibility(note);

    this.classList.add('animate', 'active');

    this.addEventListener(
      'transitionend',
      () => {
        let container = this.classList.contains('is-empty')
          ? this.querySelector('.drawer__inner-empty')
          : document.getElementById('CartDrawer');
        let focusTarget = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
        trapFocus(container, focusTarget);
      },
      { once: true }
    );

    document.body.classList.add('overflow-hidden');
  }

  close() {
    this.classList.remove('active');
    removeTrapFocus(this.activeElement);
    document.body.classList.remove('overflow-hidden');
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if (cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  renderContents(parsedState) 
  {
    this.savedCrossSell = document.getElementById('cross-sell-container');

    this.getSectionsToRender().forEach(function (section) 
    {
      let sectionElement = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id);
      if (!sectionElement) return;

      let html = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);

      if (this.savedCrossSell && section.id === 'cart-drawer')
         {
        let tmp = document.createElement('div');
        tmp.innerHTML = html;

        let freshBlock = tmp.querySelector('#cross-sell-container');
        if (freshBlock) freshBlock.replaceWith(this.savedCrossSell);

        sectionElement.innerHTML = tmp.innerHTML;
      } else {
        sectionElement.innerHTML = html;
      }

      if (!window.shouldShowSpinner) 
        {
        let freshSpinner  = sectionElement.querySelector('#cross-sell-spinner');
        let crossSellWrap = sectionElement.querySelector('#cross-sell-wrapper');
        if (freshSpinner)   freshSpinner.style.display = 'none';
        if (crossSellWrap)  crossSellWrap.classList.remove('cross-sell-loading');
      }
    }.bind(this));

    setTimeout(() => {
      this.querySelector('#CartDrawer-Overlay')
          .addEventListener('click', this.close.bind(this));
      this.open();

      fetch('/cart.js')
        .then(res => res.json())
        .then(cartData => {
          document.dispatchEvent(
            new CustomEvent('cart-ready', { detail: { cart: cartData } })
          );
        })
        .catch(() => {});
    });
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
    ];
  }

  getSectionInnerHTML(html, selector) {
    let parser = new DOMParser();
    let doc = parser.parseFromString(html, 'text/html');

    let savedCrossSell = document.getElementById('cross-sell-container');
    let incomingContainer = doc.querySelector('#cross-sell-container');

    if (savedCrossSell && incomingContainer) {
      incomingContainer.replaceWith(savedCrossSell);
    }

    return doc.querySelector(selector).innerHTML;
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);
