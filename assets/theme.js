const appendFileToHead = function (i, s, o, g, r, a, m) {
  a = s.createElement(o), m = s.getElementsByTagName(o)[0];
  a.type = g.blob.type.split(';')[0].trim();
  a.appendChild(s.createTextNode(g.text));
  a.onload = r(g);
  m ? m.parentNode.insertBefore(a, m) : s.head.appendChild(a);
};
function fetchInject(inputs, promise) {
  if (!(inputs && Array.isArray(inputs))) return Promise.reject(new Error('`inputs` must be an array'));
  if (promise && !(promise instanceof Promise)) return Promise.reject(new Error('`promise` must be a promise'));
  const resources = [];
  const deferreds = promise ? [].concat(promise) : [];
  const thenables = [];
  inputs.forEach(input => deferreds.push(window.fetch(input).then(res => {
    return [res.clone().text(), res.blob()];
  }).then(promises => {
    return Promise.all(promises).then(resolved => {
      resources.push({
        text: resolved[0],
        blob: resolved[1]
      });
    });
  })));
  return Promise.all(deferreds).then(() => {
    resources.forEach(resource => {
      thenables.push({
        then: resolve => {
          resource.blob.type.split(';')[0].trim() === 'text/css' ? appendFileToHead(window, document, 'style', resource, resolve) : appendFileToHead(window, document, 'script', resource, resolve);
        }
      });
    });
    return Promise.all(thenables);
  });
}
function loadScript(url) {
  return new Promise((resolve, reject) => {
    let script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    script.addEventListener('load', () => resolve(script), false);
    script.addEventListener('error', () => reject(script), false);
    document.body.appendChild(script);
  });
}

window.customElements.define('loess-3d-model', class extends HTMLElement {
  async connectedCallback() {
    await fetchInject([window.LoessTheme.styles.modelViewerUiStyles]);
    Shopify.loadFeatures([{
      name: 'shopify-xr',
      version: '1.0',
      onLoad: this.setupShopifyXR.bind(this)
    }, {
      name: 'model-viewer-ui',
      version: '1.0',
      onLoad: () => {
        this.modelViewerUI = new Shopify.ModelViewerUI(this.querySelector('model-viewer'));
      }
    }]);
  }
  disconnectedCallback() {
    var _this$modelViewerUI;
    (_this$modelViewerUI = this.modelViewerUI) === null || _this$modelViewerUI === void 0 ? void 0 : _this$modelViewerUI.destroy();
  }
  setupShopifyXR(errors) {
    if (errors) return;
    if (!window.ShopifyXR) {
      document.addEventListener('shopify_xr_initialized', () => this.setupShopifyXR());
      return;
    }
    document.querySelectorAll('[id^="ProductJSON-"]').forEach(modelJSON => {
      window.ShopifyXR.addModels(JSON.parse(modelJSON.textContent));
      modelJSON.remove();
    });
    window.ShopifyXR.setupXRElements();
  }
  play() {
    var _this$modelViewerUI2;
    (_this$modelViewerUI2 = this.modelViewerUI) === null || _this$modelViewerUI2 === void 0 ? void 0 : _this$modelViewerUI2.play();
  }
  pause() {
    var _this$modelViewerUI3;
    (_this$modelViewerUI3 = this.modelViewerUI) === null || _this$modelViewerUI3 === void 0 ? void 0 : _this$modelViewerUI3.pause();
  }
});

class Button extends HTMLButtonElement {
  constructor() {
    super();
    this.addEventListener('click', this._onClick.bind(this));
  }
  static get observedAttributes() {
    return ['aria-expanded'];
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === 'false' && newValue === 'true') {
      this.target.open = true;
    } else if (oldValue === 'true' && newValue === 'false') {
      this.target.open = false;
    }
  }
  connectedCallback() {
    this.handleState = this._handleState.bind(this);
    document.addEventListener('expandable-html-element:open', this.handleState);
    document.addEventListener('expandable-html-element:close', this.handleState);
  }
  disconnectedCallback() {
    document.removeEventListener('expandable-html-element:open', this.handleState);
    document.removeEventListener('expandable-html-element:close', this.handleState);
  }
  _handleState(event) {
    if (this.target !== event.target) return;
    event.stopPropagation();
    if (event.type == 'expandable-html-element:open') {
      this.expanded = true;
      if (this.targetFocus) this.targetFocus.focus();
    } else {
      this.expanded = false;
    }
  }
  get expanded() {
    return this.getAttribute('aria-expanded') === 'true';
  }
  set expanded(value) {
    this.setAttribute('aria-expanded', String(value));
  }
  get target() {
    return document.getElementById(this.getAttribute('aria-controls'));
  }
  get targetFocus() {
    return document.getElementById(this.getAttribute('target-focus'));
  }
  _onClick() {
    this.expanded = !this.expanded;
  }
}
window.customElements.define('loess-button', Button, {
  extends: 'button'
});

function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

function fetchConfig(type = 'json') {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': `application/${type}`
    }
  };
}

customElements.define('loess-cart-notes', class extends HTMLTextAreaElement {
  constructor() {
    super();
    this.addEventListener('input', debounce(event => {
      const body = JSON.stringify({
        note: event.target.value
      });
      fetch(`${window.LoessTheme.routes.cart_update_url}`, {
        ...fetchConfig(),
        ...{
          body
        }
      });
    }));
  }
}, {
  extends: 'textarea'
});
customElements.define('loess-cart-remove-button', class extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', event => {
      event.preventDefault();
      const cartItems = this.closest('loess-cart-items') || this.closest('loess-cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0);
    }, {
      once: true
    });
  }
});
const CartItems = class extends HTMLElement {
  constructor() {
    super();
    this.currentItemCount = Array.from(this.querySelectorAll('[name="updates[]"]')).reduce((total, quantityInput) => total + parseInt(quantityInput.value), 0);
    this.debouncedOnChange = debounce(event => {
      if (event.target.name === 'note') return;
      this.onChange(event);
    });
    this.addEventListener('change', this.debouncedOnChange.bind(this));
  }
  onChange(event) {
    this.updateQuantity(event.target.dataset.index, event.target.value, document.activeElement.getAttribute('name'));
  }
  getSectionsToRender() {
    return [{
      id: 'MainCartItems',
      section: document.getElementById('MainCartItems').dataset.id,
      selector: '.cart-items'
    }, {
      id: 'MainCartItems',
      section: document.getElementById('MainCartItems').dataset.id,
      selector: '.cart-payment-terms'
    }, {
      id: 'CartTotalPrice',
      section: 'cart-total-price',
      selector: '.shopify-section'
    }, {
      id: 'HeaderCartIcon',
      section: 'header-cart-icon',
      selector: '.shopify-section'
    }, {
      id: 'FreeShippingTextMobile',
      section: 'free-shipping-text',
      selector: '.shopify-section'
    }, {
      id: 'FreeShippingTextLarge',
      section: 'free-shipping-text',
      selector: '.shopify-section'
    }];
  }
  updateQuantity(line, quantity, name) {
    var _document$querySelect;
    this.enableLoading(line);
    (_document$querySelect = document.querySelector('.cart-errors')) === null || _document$querySelect === void 0 ? void 0 : _document$querySelect.classList.remove('cart-errors--visible');
    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map(section => section.section),
      sections_url: window.location.pathname
    });
    fetch(`${window.LoessTheme.routes.cart_change_url}`, {
      ...fetchConfig(),
      ...{
        body
      }
    }).then(response => {
      return response.json();
    }).then(state => {
      this.renderCartItems(state);
      this.disableLoading();
    }).catch(() => {
      this.querySelectorAll('.loading-overlay').forEach(overlay => overlay.classList.add('hidden'));
      document.querySelector('.cart-errors').classList.add('cart-errors--visible');
      document.querySelector('.cart-errors > span').textContent = window.LoessTheme.cartStrings.error;
      this.disableLoading();
    });
  }
  renderCartItems(state) {
    var _this$parentElement$n;
    const parsedState = state;
    this.classList.toggle('is-empty', parsedState.item_count === 0);
    (_this$parentElement$n = this.parentElement.nextElementSibling) === null || _this$parentElement$n === void 0 ? void 0 : _this$parentElement$n.classList.toggle('hide', parsedState.item_count === 0);
    this.renderHTML(parsedState);
    this.dispatchCartUpdatedEvent(parsedState);
  }
  renderHTML(parsedState) {
    this.getSectionsToRender().forEach(section => {
      var _document$getElementB;
      const elementToReplace = ((_document$getElementB = document.getElementById(section.id)) === null || _document$getElementB === void 0 ? void 0 : _document$getElementB.querySelector(section.selector)) || document.getElementById(section.id);
      if (!elementToReplace) return;
      const parsedHTML = new DOMParser().parseFromString(parsedState.sections[section.section], 'text/html').querySelector(section.selector);
      if (!parsedHTML) return;
      elementToReplace.innerHTML = parsedHTML.innerHTML;
    });
  }
  dispatchCartUpdatedEvent(parsedState) {
    document.documentElement.dispatchEvent(new CustomEvent('cart:updated', {
      bubbles: true,
      detail: {
        cart: parsedState
      }
    }));
  }
  updateLiveRegions(line, itemCount) {
    if (this.currentItemCount === itemCount) {
      document.getElementById(`Line-item-error-${line}`).querySelector('.cart-item__error-text').innerHTML = window.LoessTheme.cartStrings.quantityError.replace('[quantity]', document.getElementById(`Quantity-${line}`).value);
    }
    this.currentItemCount = itemCount;
    const cartStatus = document.getElementById('cart-live-region-text');
    cartStatus.setAttribute('aria-hidden', false);
    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }
  enableLoading(line) {
    document.getElementById('MainCartItems').classList.add('cart__items--disabled');
    this.querySelectorAll(`#CartItem-${line} .loading-overlay`).forEach(overlay => overlay.classList.remove('hidden'));
    document.activeElement.blur();
  }
  disableLoading() {
    document.getElementById('MainCartItems').classList.remove('cart__items--disabled');
  }
};
customElements.define('loess-cart-items', CartItems);
const CartDrawerItems = class extends CartItems {
  getSectionsToRender() {
    return [{
      id: 'MainCartItems',
      section: 'cart-drawer-items',
      selector: '.cart-items'
    }, {
      id: 'HeaderCartIcon',
      section: 'header-cart-icon',
      selector: '.shopify-section'
    }, {
      id: 'FreeShippingText',
      section: 'free-shipping-text',
      selector: '.shopify-section'
    }, {
      id: 'CartDrawerTotalPrice',
      section: 'cart-total-price',
      selector: '.shopify-section'
    }];
  }
};
customElements.define('loess-cart-drawer-items', CartDrawerItems);
const CartNotification = class extends CartItems {
  renderCartItems(state) {
    this.cartItemKey = state.key;
    this.renderHTML(state);
    this.dispatchCartUpdatedEvent(state);
  }
  getSectionsToRender() {
    return [{
      id: 'HeaderCartIcon',
      section: 'header-cart-icon',
      selector: '.shopify-section'
    }, {
      id: 'CartNotificationButton',
      section: 'cart-notification-button',
      selector: '.shopify-section'
    }, {
      id: 'CartNotificationProduct',
      section: 'cart-notification-product',
      selector: `[id="CartNotificationProduct-${this.cartItemKey}"]`
    }, {
      id: 'FreeShippingText',
      section: 'free-shipping-text',
      selector: '.shopify-section'
    }];
  }
};
customElements.define('loess-cart-notification', CartNotification);
window.customElements.define('loess-cart-drawer-checkout', class extends HTMLElement {
  constructor() {
    super();
    this.parentElement.addEventListener('click', this.redirect.bind(this));
  }
  redirect() {
    this.parentElement.nextElementSibling.classList.remove('hide');
    this.parentElement.remove();
  }
});
window.customElements.define('loess-cart-recommendations', class extends HTMLElement {
  constructor() {
    super();
    if (!this.productId) return;
    this.initProductRecommendations();
  }
  connectedCallback() {
    document.documentElement.addEventListener('cart:updated', event => {
      this.updateProductId(event);
      this.initProductRecommendations();
    });
  }
  async initProductRecommendations() {
    const response = await fetch(this.buildQueryString());
    const text = await response.text();
    this.injectHTMLResponse(text);
  }
  updateProductId(event) {
    var _event$detail$cart$it;
    this.setAttribute('product-id', event.detail.cart.product_id || ((_event$detail$cart$it = event.detail.cart.items[0]) === null || _event$detail$cart$it === void 0 ? void 0 : _event$detail$cart$it.product_id) || this.productId);
  }
  buildQueryString() {
    return `${window.LoessTheme.routes.product_recommendations_url}?section_id=cart-drawer-recommendations&product_id=${this.productId}&limit=${this.limit}`;
  }
  injectHTMLResponse(text) {
    const div = document.createElement('div');
    div.innerHTML = text;
    const productRecommendations = div.querySelector('.shopify-section');
    if (productRecommendations && productRecommendations.innerHTML.trim().length) {
      var _this$querySelector;
      (_this$querySelector = this.querySelector('ul')) === null || _this$querySelector === void 0 ? void 0 : _this$querySelector.remove();
      this.insertAdjacentHTML('beforeend', productRecommendations.innerHTML);
    }
  }
  get productId() {
    return this.getAttribute('product-id');
  }
  get limit() {
    return this.getAttribute('limit');
  }
});

const StickyScrollMixin = {
  setupStickyScroll(element) {
    this.getInitialValues(element);
    this.checkPosition = this.checkPosition.bind(this);
    window.addEventListener('scroll', this.checkPosition);
  },
  destroyStickyScroll() {
    window.removeEventListener('scroll', this.checkPosition);
  },
  getInitialValues(element) {
    this.element = element;
    this.lastKnownY = window.scrollY;
    this.currentTop = 0;
    this.pendingRaf = false;
    this.stickyHeaderOffset = this.getStickyHeaderOffset();
  },
  checkPosition() {
    if (this.pendingRaf) return;
    this.pendingRaf = true;
    requestAnimationFrame(() => {
      const {
        top
      } = this.element.getBoundingClientRect();
      const maxTop = top + window.scrollY - this.element.offsetTop + this.getTopOffset();
      const minTop = this.element.clientHeight - window.innerHeight + 30;
      if (window.scrollY < this.lastKnownY) {
        this.currentTop -= window.scrollY - this.lastKnownY;
      } else {
        this.currentTop += this.lastKnownY - window.scrollY;
      }
      this.lastKnownY = window.scrollY;
      this.currentTop = Math.min(Math.max(this.currentTop, -minTop), maxTop, this.getTopOffset());
      this.element.style.top = `${this.currentTop}px`;
      this.pendingRaf = false;
    });
  },
  getTopOffset() {
    return this.stickyHeaderOffset + 30;
  },
  getStickyHeaderOffset() {
    const documentStyles = getComputedStyle(document.documentElement);
    return parseInt(documentStyles.getPropertyValue('--header-height') || 0) * parseInt(documentStyles.getPropertyValue('--enable-sticky-header') || 0);
  }
};

const LoessCartBlocks = class extends HTMLElement {
  constructor() {
    super();
    this.setupStickyScroll(this);
  }
};
Object.assign(LoessCartBlocks.prototype, StickyScrollMixin);
window.customElements.define('loess-cart-blocks', LoessCartBlocks);

/*!
* tabbable 5.3.3
* @license MIT, https://github.com/focus-trap/tabbable/blob/master/LICENSE
*/
var candidateSelectors = ['input', 'select', 'textarea', 'a[href]', 'button', '[tabindex]:not(slot)', 'audio[controls]', 'video[controls]', '[contenteditable]:not([contenteditable="false"])', 'details>summary:first-of-type', 'details'];
var candidateSelector = /* #__PURE__ */candidateSelectors.join(',');
var NoElement = typeof Element === 'undefined';
var matches = NoElement ? function () {} : Element.prototype.matches || Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
var getRootNode = !NoElement && Element.prototype.getRootNode ? function (element) {
  return element.getRootNode();
} : function (element) {
  return element.ownerDocument;
};
/**
 * @param {Element} el container to check in
 * @param {boolean} includeContainer add container to check
 * @param {(node: Element) => boolean} filter filter candidates
 * @returns {Element[]}
 */

var getCandidates = function getCandidates(el, includeContainer, filter) {
  var candidates = Array.prototype.slice.apply(el.querySelectorAll(candidateSelector));

  if (includeContainer && matches.call(el, candidateSelector)) {
    candidates.unshift(el);
  }

  candidates = candidates.filter(filter);
  return candidates;
};
/**
 * @callback GetShadowRoot
 * @param {Element} element to check for shadow root
 * @returns {ShadowRoot|boolean} ShadowRoot if available or boolean indicating if a shadowRoot is attached but not available.
 */

/**
 * @callback ShadowRootFilter
 * @param {Element} shadowHostNode the element which contains shadow content
 * @returns {boolean} true if a shadow root could potentially contain valid candidates.
 */

/**
 * @typedef {Object} CandidatesScope
 * @property {Element} scope contains inner candidates
 * @property {Element[]} candidates
 */

/**
 * @typedef {Object} IterativeOptions
 * @property {GetShadowRoot|boolean} getShadowRoot true if shadow support is enabled; falsy if not;
 *  if a function, implies shadow support is enabled and either returns the shadow root of an element
 *  or a boolean stating if it has an undisclosed shadow root
 * @property {(node: Element) => boolean} filter filter candidates
 * @property {boolean} flatten if true then result will flatten any CandidatesScope into the returned list
 * @property {ShadowRootFilter} shadowRootFilter filter shadow roots;
 */

/**
 * @param {Element[]} elements list of element containers to match candidates from
 * @param {boolean} includeContainer add container list to check
 * @param {IterativeOptions} options
 * @returns {Array.<Element|CandidatesScope>}
 */


var getCandidatesIteratively = function getCandidatesIteratively(elements, includeContainer, options) {
  var candidates = [];
  var elementsToCheck = Array.from(elements);

  while (elementsToCheck.length) {
    var element = elementsToCheck.shift();

    if (element.tagName === 'SLOT') {
      // add shadow dom slot scope (slot itself cannot be focusable)
      var assigned = element.assignedElements();
      var content = assigned.length ? assigned : element.children;
      var nestedCandidates = getCandidatesIteratively(content, true, options);

      if (options.flatten) {
        candidates.push.apply(candidates, nestedCandidates);
      } else {
        candidates.push({
          scope: element,
          candidates: nestedCandidates
        });
      }
    } else {
      // check candidate element
      var validCandidate = matches.call(element, candidateSelector);

      if (validCandidate && options.filter(element) && (includeContainer || !elements.includes(element))) {
        candidates.push(element);
      } // iterate over shadow content if possible


      var shadowRoot = element.shadowRoot || // check for an undisclosed shadow
      typeof options.getShadowRoot === 'function' && options.getShadowRoot(element);
      var validShadowRoot = !options.shadowRootFilter || options.shadowRootFilter(element);

      if (shadowRoot && validShadowRoot) {
        // add shadow dom scope IIF a shadow root node was given; otherwise, an undisclosed
        //  shadow exists, so look at light dom children as fallback BUT create a scope for any
        //  child candidates found because they're likely slotted elements (elements that are
        //  children of the web component element (which has the shadow), in the light dom, but
        //  slotted somewhere _inside_ the undisclosed shadow) -- the scope is created below,
        //  _after_ we return from this recursive call
        var _nestedCandidates = getCandidatesIteratively(shadowRoot === true ? element.children : shadowRoot.children, true, options);

        if (options.flatten) {
          candidates.push.apply(candidates, _nestedCandidates);
        } else {
          candidates.push({
            scope: element,
            candidates: _nestedCandidates
          });
        }
      } else {
        // there's not shadow so just dig into the element's (light dom) children
        //  __without__ giving the element special scope treatment
        elementsToCheck.unshift.apply(elementsToCheck, element.children);
      }
    }
  }

  return candidates;
};

var getTabindex = function getTabindex(node, isScope) {
  if (node.tabIndex < 0) {
    // in Chrome, <details/>, <audio controls/> and <video controls/> elements get a default
    // `tabIndex` of -1 when the 'tabindex' attribute isn't specified in the DOM,
    // yet they are still part of the regular tab order; in FF, they get a default
    // `tabIndex` of 0; since Chrome still puts those elements in the regular tab
    // order, consider their tab index to be 0.
    // Also browsers do not return `tabIndex` correctly for contentEditable nodes;
    // so if they don't have a tabindex attribute specifically set, assume it's 0.
    //
    // isScope is positive for custom element with shadow root or slot that by default
    // have tabIndex -1, but need to be sorted by document order in order for their
    // content to be inserted in the correct position
    if ((isScope || /^(AUDIO|VIDEO|DETAILS)$/.test(node.tagName) || node.isContentEditable) && isNaN(parseInt(node.getAttribute('tabindex'), 10))) {
      return 0;
    }
  }

  return node.tabIndex;
};

var sortOrderedTabbables = function sortOrderedTabbables(a, b) {
  return a.tabIndex === b.tabIndex ? a.documentOrder - b.documentOrder : a.tabIndex - b.tabIndex;
};

var isInput = function isInput(node) {
  return node.tagName === 'INPUT';
};

var isHiddenInput = function isHiddenInput(node) {
  return isInput(node) && node.type === 'hidden';
};

var isDetailsWithSummary = function isDetailsWithSummary(node) {
  var r = node.tagName === 'DETAILS' && Array.prototype.slice.apply(node.children).some(function (child) {
    return child.tagName === 'SUMMARY';
  });
  return r;
};

var getCheckedRadio = function getCheckedRadio(nodes, form) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].checked && nodes[i].form === form) {
      return nodes[i];
    }
  }
};

var isTabbableRadio = function isTabbableRadio(node) {
  if (!node.name) {
    return true;
  }

  var radioScope = node.form || getRootNode(node);

  var queryRadios = function queryRadios(name) {
    return radioScope.querySelectorAll('input[type="radio"][name="' + name + '"]');
  };

  var radioSet;

  if (typeof window !== 'undefined' && typeof window.CSS !== 'undefined' && typeof window.CSS.escape === 'function') {
    radioSet = queryRadios(window.CSS.escape(node.name));
  } else {
    try {
      radioSet = queryRadios(node.name);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Looks like you have a radio button with a name attribute containing invalid CSS selector characters and need the CSS.escape polyfill: %s', err.message);
      return false;
    }
  }

  var checked = getCheckedRadio(radioSet, node.form);
  return !checked || checked === node;
};

var isRadio = function isRadio(node) {
  return isInput(node) && node.type === 'radio';
};

var isNonTabbableRadio = function isNonTabbableRadio(node) {
  return isRadio(node) && !isTabbableRadio(node);
};

var isZeroArea = function isZeroArea(node) {
  var _node$getBoundingClie = node.getBoundingClientRect(),
      width = _node$getBoundingClie.width,
      height = _node$getBoundingClie.height;

  return width === 0 && height === 0;
};

var isHidden = function isHidden(node, _ref) {
  var displayCheck = _ref.displayCheck,
      getShadowRoot = _ref.getShadowRoot;

  // NOTE: visibility will be `undefined` if node is detached from the document
  //  (see notes about this further down), which means we will consider it visible
  //  (this is legacy behavior from a very long way back)
  // NOTE: we check this regardless of `displayCheck="none"` because this is a
  //  _visibility_ check, not a _display_ check
  if (getComputedStyle(node).visibility === 'hidden') {
    return true;
  }

  var isDirectSummary = matches.call(node, 'details>summary:first-of-type');
  var nodeUnderDetails = isDirectSummary ? node.parentElement : node;

  if (matches.call(nodeUnderDetails, 'details:not([open]) *')) {
    return true;
  } // The root node is the shadow root if the node is in a shadow DOM; some document otherwise
  //  (but NOT _the_ document; see second 'If' comment below for more).
  // If rootNode is shadow root, it'll have a host, which is the element to which the shadow
  //  is attached, and the one we need to check if it's in the document or not (because the
  //  shadow, and all nodes it contains, is never considered in the document since shadows
  //  behave like self-contained DOMs; but if the shadow's HOST, which is part of the document,
  //  is hidden, or is not in the document itself but is detached, it will affect the shadow's
  //  visibility, including all the nodes it contains). The host could be any normal node,
  //  or a custom element (i.e. web component). Either way, that's the one that is considered
  //  part of the document, not the shadow root, nor any of its children (i.e. the node being
  //  tested).
  // If rootNode is not a shadow root, it won't have a host, and so rootNode should be the
  //  document (per the docs) and while it's a Document-type object, that document does not
  //  appear to be the same as the node's `ownerDocument` for some reason, so it's safer
  //  to ignore the rootNode at this point, and use `node.ownerDocument`. Otherwise,
  //  using `rootNode.contains(node)` will _always_ be true we'll get false-positives when
  //  node is actually detached.


  var nodeRootHost = getRootNode(node).host;
  var nodeIsAttached = (nodeRootHost === null || nodeRootHost === void 0 ? void 0 : nodeRootHost.ownerDocument.contains(nodeRootHost)) || node.ownerDocument.contains(node);

  if (!displayCheck || displayCheck === 'full') {
    if (typeof getShadowRoot === 'function') {
      // figure out if we should consider the node to be in an undisclosed shadow and use the
      //  'non-zero-area' fallback
      var originalNode = node;

      while (node) {
        var parentElement = node.parentElement;
        var rootNode = getRootNode(node);

        if (parentElement && !parentElement.shadowRoot && getShadowRoot(parentElement) === true // check if there's an undisclosed shadow
        ) {
          // node has an undisclosed shadow which means we can only treat it as a black box, so we
          //  fall back to a non-zero-area test
          return isZeroArea(node);
        } else if (node.assignedSlot) {
          // iterate up slot
          node = node.assignedSlot;
        } else if (!parentElement && rootNode !== node.ownerDocument) {
          // cross shadow boundary
          node = rootNode.host;
        } else {
          // iterate up normal dom
          node = parentElement;
        }
      }

      node = originalNode;
    } // else, `getShadowRoot` might be true, but all that does is enable shadow DOM support
    //  (i.e. it does not also presume that all nodes might have undisclosed shadows); or
    //  it might be a falsy value, which means shadow DOM support is disabled
    // Since we didn't find it sitting in an undisclosed shadow (or shadows are disabled)
    //  now we can just test to see if it would normally be visible or not, provided it's
    //  attached to the main document.
    // NOTE: We must consider case where node is inside a shadow DOM and given directly to
    //  `isTabbable()` or `isFocusable()` -- regardless of `getShadowRoot` option setting.


    if (nodeIsAttached) {
      // this works wherever the node is: if there's at least one client rect, it's
      //  somehow displayed; it also covers the CSS 'display: contents' case where the
      //  node itself is hidden in place of its contents; and there's no need to search
      //  up the hierarchy either
      return !node.getClientRects().length;
    } // Else, the node isn't attached to the document, which means the `getClientRects()`
    //  API will __always__ return zero rects (this can happen, for example, if React
    //  is used to render nodes onto a detached tree, as confirmed in this thread:
    //  https://github.com/facebook/react/issues/9117#issuecomment-284228870)
    //
    // It also means that even window.getComputedStyle(node).display will return `undefined`
    //  because styles are only computed for nodes that are in the document.
    //
    // NOTE: THIS HAS BEEN THE CASE FOR YEARS. It is not new, nor is it caused by tabbable
    //  somehow. Though it was never stated officially, anyone who has ever used tabbable
    //  APIs on nodes in detached containers has actually implicitly used tabbable in what
    //  was later (as of v5.2.0 on Apr 9, 2021) called `displayCheck="none"` mode -- essentially
    //  considering __everything__ to be visible because of the innability to determine styles.

  } else if (displayCheck === 'non-zero-area') {
    // NOTE: Even though this tests that the node's client rect is non-zero to determine
    //  whether it's displayed, and that a detached node will __always__ have a zero-area
    //  client rect, we don't special-case for whether the node is attached or not. In
    //  this mode, we do want to consider nodes that have a zero area to be hidden at all
    //  times, and that includes attached or not.
    return isZeroArea(node);
  } // visible, as far as we can tell, or per current `displayCheck` mode


  return false;
}; // form fields (nested) inside a disabled fieldset are not focusable/tabbable
//  unless they are in the _first_ <legend> element of the top-most disabled
//  fieldset


var isDisabledFromFieldset = function isDisabledFromFieldset(node) {
  if (/^(INPUT|BUTTON|SELECT|TEXTAREA)$/.test(node.tagName)) {
    var parentNode = node.parentElement; // check if `node` is contained in a disabled <fieldset>

    while (parentNode) {
      if (parentNode.tagName === 'FIELDSET' && parentNode.disabled) {
        // look for the first <legend> among the children of the disabled <fieldset>
        for (var i = 0; i < parentNode.children.length; i++) {
          var child = parentNode.children.item(i); // when the first <legend> (in document order) is found

          if (child.tagName === 'LEGEND') {
            // if its parent <fieldset> is not nested in another disabled <fieldset>,
            // return whether `node` is a descendant of its first <legend>
            return matches.call(parentNode, 'fieldset[disabled] *') ? true : !child.contains(node);
          }
        } // the disabled <fieldset> containing `node` has no <legend>


        return true;
      }

      parentNode = parentNode.parentElement;
    }
  } // else, node's tabbable/focusable state should not be affected by a fieldset's
  //  enabled/disabled state


  return false;
};

var isNodeMatchingSelectorFocusable = function isNodeMatchingSelectorFocusable(options, node) {
  if (node.disabled || isHiddenInput(node) || isHidden(node, options) || // For a details element with a summary, the summary element gets the focus
  isDetailsWithSummary(node) || isDisabledFromFieldset(node)) {
    return false;
  }

  return true;
};

var isNodeMatchingSelectorTabbable = function isNodeMatchingSelectorTabbable(options, node) {
  if (isNonTabbableRadio(node) || getTabindex(node) < 0 || !isNodeMatchingSelectorFocusable(options, node)) {
    return false;
  }

  return true;
};

var isValidShadowRootTabbable = function isValidShadowRootTabbable(shadowHostNode) {
  var tabIndex = parseInt(shadowHostNode.getAttribute('tabindex'), 10);

  if (isNaN(tabIndex) || tabIndex >= 0) {
    return true;
  } // If a custom element has an explicit negative tabindex,
  // browsers will not allow tab targeting said element's children.


  return false;
};
/**
 * @param {Array.<Element|CandidatesScope>} candidates
 * @returns Element[]
 */


var sortByOrder = function sortByOrder(candidates) {
  var regularTabbables = [];
  var orderedTabbables = [];
  candidates.forEach(function (item, i) {
    var isScope = !!item.scope;
    var element = isScope ? item.scope : item;
    var candidateTabindex = getTabindex(element, isScope);
    var elements = isScope ? sortByOrder(item.candidates) : element;

    if (candidateTabindex === 0) {
      isScope ? regularTabbables.push.apply(regularTabbables, elements) : regularTabbables.push(element);
    } else {
      orderedTabbables.push({
        documentOrder: i,
        tabIndex: candidateTabindex,
        item: item,
        isScope: isScope,
        content: elements
      });
    }
  });
  return orderedTabbables.sort(sortOrderedTabbables).reduce(function (acc, sortable) {
    sortable.isScope ? acc.push.apply(acc, sortable.content) : acc.push(sortable.content);
    return acc;
  }, []).concat(regularTabbables);
};

var tabbable = function tabbable(el, options) {
  options = options || {};
  var candidates;

  if (options.getShadowRoot) {
    candidates = getCandidatesIteratively([el], options.includeContainer, {
      filter: isNodeMatchingSelectorTabbable.bind(null, options),
      flatten: false,
      getShadowRoot: options.getShadowRoot,
      shadowRootFilter: isValidShadowRootTabbable
    });
  } else {
    candidates = getCandidates(el, options.includeContainer, isNodeMatchingSelectorTabbable.bind(null, options));
  }

  return sortByOrder(candidates);
};

var focusable = function focusable(el, options) {
  options = options || {};
  var candidates;

  if (options.getShadowRoot) {
    candidates = getCandidatesIteratively([el], options.includeContainer, {
      filter: isNodeMatchingSelectorFocusable.bind(null, options),
      flatten: true,
      getShadowRoot: options.getShadowRoot
    });
  } else {
    candidates = getCandidates(el, options.includeContainer, isNodeMatchingSelectorFocusable.bind(null, options));
  }

  return candidates;
};

var isTabbable = function isTabbable(node, options) {
  options = options || {};

  if (!node) {
    throw new Error('No node provided');
  }

  if (matches.call(node, candidateSelector) === false) {
    return false;
  }

  return isNodeMatchingSelectorTabbable(options, node);
};

var focusableCandidateSelector = /* #__PURE__ */candidateSelectors.concat('iframe').join(',');

var isFocusable = function isFocusable(node, options) {
  options = options || {};

  if (!node) {
    throw new Error('No node provided');
  }

  if (matches.call(node, focusableCandidateSelector) === false) {
    return false;
  }

  return isNodeMatchingSelectorFocusable(options, node);
};

/*!
* focus-trap 6.9.4
* @license MIT, https://github.com/focus-trap/focus-trap/blob/master/LICENSE
*/

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    enumerableOnly && (symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    })), keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = null != arguments[i] ? arguments[i] : {};
    i % 2 ? ownKeys(Object(source), !0).forEach(function (key) {
      _defineProperty(target, key, source[key]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    });
  }

  return target;
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

var activeFocusTraps = function () {
  var trapQueue = [];
  return {
    activateTrap: function activateTrap(trap) {
      if (trapQueue.length > 0) {
        var activeTrap = trapQueue[trapQueue.length - 1];

        if (activeTrap !== trap) {
          activeTrap.pause();
        }
      }

      var trapIndex = trapQueue.indexOf(trap);

      if (trapIndex === -1) {
        trapQueue.push(trap);
      } else {
        // move this existing trap to the front of the queue
        trapQueue.splice(trapIndex, 1);
        trapQueue.push(trap);
      }
    },
    deactivateTrap: function deactivateTrap(trap) {
      var trapIndex = trapQueue.indexOf(trap);

      if (trapIndex !== -1) {
        trapQueue.splice(trapIndex, 1);
      }

      if (trapQueue.length > 0) {
        trapQueue[trapQueue.length - 1].unpause();
      }
    }
  };
}();

var isSelectableInput = function isSelectableInput(node) {
  return node.tagName && node.tagName.toLowerCase() === 'input' && typeof node.select === 'function';
};

var isEscapeEvent = function isEscapeEvent(e) {
  return e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27;
};

var isTabEvent = function isTabEvent(e) {
  return e.key === 'Tab' || e.keyCode === 9;
};

var delay = function delay(fn) {
  return setTimeout(fn, 0);
}; // Array.find/findIndex() are not supported on IE; this replicates enough
//  of Array.findIndex() for our needs


var findIndex = function findIndex(arr, fn) {
  var idx = -1;
  arr.every(function (value, i) {
    if (fn(value)) {
      idx = i;
      return false; // break
    }

    return true; // next
  });
  return idx;
};
/**
 * Get an option's value when it could be a plain value, or a handler that provides
 *  the value.
 * @param {*} value Option's value to check.
 * @param {...*} [params] Any parameters to pass to the handler, if `value` is a function.
 * @returns {*} The `value`, or the handler's returned value.
 */


var valueOrHandler = function valueOrHandler(value) {
  for (var _len = arguments.length, params = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    params[_key - 1] = arguments[_key];
  }

  return typeof value === 'function' ? value.apply(void 0, params) : value;
};

var getActualTarget = function getActualTarget(event) {
  // NOTE: If the trap is _inside_ a shadow DOM, event.target will always be the
  //  shadow host. However, event.target.composedPath() will be an array of
  //  nodes "clicked" from inner-most (the actual element inside the shadow) to
  //  outer-most (the host HTML document). If we have access to composedPath(),
  //  then use its first element; otherwise, fall back to event.target (and
  //  this only works for an _open_ shadow DOM; otherwise,
  //  composedPath()[0] === event.target always).
  return event.target.shadowRoot && typeof event.composedPath === 'function' ? event.composedPath()[0] : event.target;
};

var createFocusTrap = function createFocusTrap(elements, userOptions) {
  // SSR: a live trap shouldn't be created in this type of environment so this
  //  should be safe code to execute if the `document` option isn't specified
  var doc = (userOptions === null || userOptions === void 0 ? void 0 : userOptions.document) || document;

  var config = _objectSpread2({
    returnFocusOnDeactivate: true,
    escapeDeactivates: true,
    delayInitialFocus: true
  }, userOptions);

  var state = {
    // containers given to createFocusTrap()
    // @type {Array<HTMLElement>}
    containers: [],
    // list of objects identifying tabbable nodes in `containers` in the trap
    // NOTE: it's possible that a group has no tabbable nodes if nodes get removed while the trap
    //  is active, but the trap should never get to a state where there isn't at least one group
    //  with at least one tabbable node in it (that would lead to an error condition that would
    //  result in an error being thrown)
    // @type {Array<{
    //   container: HTMLElement,
    //   tabbableNodes: Array<HTMLElement>, // empty if none
    //   focusableNodes: Array<HTMLElement>, // empty if none
    //   firstTabbableNode: HTMLElement|null,
    //   lastTabbableNode: HTMLElement|null,
    //   nextTabbableNode: (node: HTMLElement, forward: boolean) => HTMLElement|undefined
    // }>}
    containerGroups: [],
    // same order/length as `containers` list
    // references to objects in `containerGroups`, but only those that actually have
    //  tabbable nodes in them
    // NOTE: same order as `containers` and `containerGroups`, but __not necessarily__
    //  the same length
    tabbableGroups: [],
    nodeFocusedBeforeActivation: null,
    mostRecentlyFocusedNode: null,
    active: false,
    paused: false,
    // timer ID for when delayInitialFocus is true and initial focus in this trap
    //  has been delayed during activation
    delayInitialFocusTimer: undefined
  };
  var trap; // eslint-disable-line prefer-const -- some private functions reference it, and its methods reference private functions, so we must declare here and define later

  /**
   * Gets a configuration option value.
   * @param {Object|undefined} configOverrideOptions If true, and option is defined in this set,
   *  value will be taken from this object. Otherwise, value will be taken from base configuration.
   * @param {string} optionName Name of the option whose value is sought.
   * @param {string|undefined} [configOptionName] Name of option to use __instead of__ `optionName`
   *  IIF `configOverrideOptions` is not defined. Otherwise, `optionName` is used.
   */

  var getOption = function getOption(configOverrideOptions, optionName, configOptionName) {
    return configOverrideOptions && configOverrideOptions[optionName] !== undefined ? configOverrideOptions[optionName] : config[configOptionName || optionName];
  };
  /**
   * Finds the index of the container that contains the element.
   * @param {HTMLElement} element
   * @returns {number} Index of the container in either `state.containers` or
   *  `state.containerGroups` (the order/length of these lists are the same); -1
   *  if the element isn't found.
   */


  var findContainerIndex = function findContainerIndex(element) {
    // NOTE: search `containerGroups` because it's possible a group contains no tabbable
    //  nodes, but still contains focusable nodes (e.g. if they all have `tabindex=-1`)
    //  and we still need to find the element in there
    return state.containerGroups.findIndex(function (_ref) {
      var container = _ref.container,
          tabbableNodes = _ref.tabbableNodes;
      return container.contains(element) || // fall back to explicit tabbable search which will take into consideration any
      //  web components if the `tabbableOptions.getShadowRoot` option was used for
      //  the trap, enabling shadow DOM support in tabbable (`Node.contains()` doesn't
      //  look inside web components even if open)
      tabbableNodes.find(function (node) {
        return node === element;
      });
    });
  };
  /**
   * Gets the node for the given option, which is expected to be an option that
   *  can be either a DOM node, a string that is a selector to get a node, `false`
   *  (if a node is explicitly NOT given), or a function that returns any of these
   *  values.
   * @param {string} optionName
   * @returns {undefined | false | HTMLElement | SVGElement} Returns
   *  `undefined` if the option is not specified; `false` if the option
   *  resolved to `false` (node explicitly not given); otherwise, the resolved
   *  DOM node.
   * @throws {Error} If the option is set, not `false`, and is not, or does not
   *  resolve to a node.
   */


  var getNodeForOption = function getNodeForOption(optionName) {
    var optionValue = config[optionName];

    if (typeof optionValue === 'function') {
      for (var _len2 = arguments.length, params = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        params[_key2 - 1] = arguments[_key2];
      }

      optionValue = optionValue.apply(void 0, params);
    }

    if (optionValue === true) {
      optionValue = undefined; // use default value
    }

    if (!optionValue) {
      if (optionValue === undefined || optionValue === false) {
        return optionValue;
      } // else, empty string (invalid), null (invalid), 0 (invalid)


      throw new Error("`".concat(optionName, "` was specified but was not a node, or did not return a node"));
    }

    var node = optionValue; // could be HTMLElement, SVGElement, or non-empty string at this point

    if (typeof optionValue === 'string') {
      node = doc.querySelector(optionValue); // resolve to node, or null if fails

      if (!node) {
        throw new Error("`".concat(optionName, "` as selector refers to no known node"));
      }
    }

    return node;
  };

  var getInitialFocusNode = function getInitialFocusNode() {
    var node = getNodeForOption('initialFocus'); // false explicitly indicates we want no initialFocus at all

    if (node === false) {
      return false;
    }

    if (node === undefined) {
      // option not specified: use fallback options
      if (findContainerIndex(doc.activeElement) >= 0) {
        node = doc.activeElement;
      } else {
        var firstTabbableGroup = state.tabbableGroups[0];
        var firstTabbableNode = firstTabbableGroup && firstTabbableGroup.firstTabbableNode; // NOTE: `fallbackFocus` option function cannot return `false` (not supported)

        node = firstTabbableNode || getNodeForOption('fallbackFocus');
      }
    }

    if (!node) {
      throw new Error('Your focus-trap needs to have at least one focusable element');
    }

    return node;
  };

  var updateTabbableNodes = function updateTabbableNodes() {
    state.containerGroups = state.containers.map(function (container) {
      var tabbableNodes = tabbable(container, config.tabbableOptions); // NOTE: if we have tabbable nodes, we must have focusable nodes; focusable nodes
      //  are a superset of tabbable nodes

      var focusableNodes = focusable(container, config.tabbableOptions);
      return {
        container: container,
        tabbableNodes: tabbableNodes,
        focusableNodes: focusableNodes,
        firstTabbableNode: tabbableNodes.length > 0 ? tabbableNodes[0] : null,
        lastTabbableNode: tabbableNodes.length > 0 ? tabbableNodes[tabbableNodes.length - 1] : null,

        /**
         * Finds the __tabbable__ node that follows the given node in the specified direction,
         *  in this container, if any.
         * @param {HTMLElement} node
         * @param {boolean} [forward] True if going in forward tab order; false if going
         *  in reverse.
         * @returns {HTMLElement|undefined} The next tabbable node, if any.
         */
        nextTabbableNode: function nextTabbableNode(node) {
          var forward = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
          // NOTE: If tabindex is positive (in order to manipulate the tab order separate
          //  from the DOM order), this __will not work__ because the list of focusableNodes,
          //  while it contains tabbable nodes, does not sort its nodes in any order other
          //  than DOM order, because it can't: Where would you place focusable (but not
          //  tabbable) nodes in that order? They have no order, because they aren't tabbale...
          // Support for positive tabindex is already broken and hard to manage (possibly
          //  not supportable, TBD), so this isn't going to make things worse than they
          //  already are, and at least makes things better for the majority of cases where
          //  tabindex is either 0/unset or negative.
          // FYI, positive tabindex issue: https://github.com/focus-trap/focus-trap/issues/375
          var nodeIdx = focusableNodes.findIndex(function (n) {
            return n === node;
          });

          if (nodeIdx < 0) {
            return undefined;
          }

          if (forward) {
            return focusableNodes.slice(nodeIdx + 1).find(function (n) {
              return isTabbable(n, config.tabbableOptions);
            });
          }

          return focusableNodes.slice(0, nodeIdx).reverse().find(function (n) {
            return isTabbable(n, config.tabbableOptions);
          });
        }
      };
    });
    state.tabbableGroups = state.containerGroups.filter(function (group) {
      return group.tabbableNodes.length > 0;
    }); // throw if no groups have tabbable nodes and we don't have a fallback focus node either

    if (state.tabbableGroups.length <= 0 && !getNodeForOption('fallbackFocus') // returning false not supported for this option
    ) {
      throw new Error('Your focus-trap must have at least one container with at least one tabbable node in it at all times');
    }
  };

  var tryFocus = function tryFocus(node) {
    if (node === false) {
      return;
    }

    if (node === doc.activeElement) {
      return;
    }

    if (!node || !node.focus) {
      tryFocus(getInitialFocusNode());
      return;
    }

    node.focus({
      preventScroll: !!config.preventScroll
    });
    state.mostRecentlyFocusedNode = node;

    if (isSelectableInput(node)) {
      node.select();
    }
  };

  var getReturnFocusNode = function getReturnFocusNode(previousActiveElement) {
    var node = getNodeForOption('setReturnFocus', previousActiveElement);
    return node ? node : node === false ? false : previousActiveElement;
  }; // This needs to be done on mousedown and touchstart instead of click
  // so that it precedes the focus event.


  var checkPointerDown = function checkPointerDown(e) {
    var target = getActualTarget(e);

    if (findContainerIndex(target) >= 0) {
      // allow the click since it ocurred inside the trap
      return;
    }

    if (valueOrHandler(config.clickOutsideDeactivates, e)) {
      // immediately deactivate the trap
      trap.deactivate({
        // if, on deactivation, we should return focus to the node originally-focused
        //  when the trap was activated (or the configured `setReturnFocus` node),
        //  then assume it's also OK to return focus to the outside node that was
        //  just clicked, causing deactivation, as long as that node is focusable;
        //  if it isn't focusable, then return focus to the original node focused
        //  on activation (or the configured `setReturnFocus` node)
        // NOTE: by setting `returnFocus: false`, deactivate() will do nothing,
        //  which will result in the outside click setting focus to the node
        //  that was clicked, whether it's focusable or not; by setting
        //  `returnFocus: true`, we'll attempt to re-focus the node originally-focused
        //  on activation (or the configured `setReturnFocus` node)
        returnFocus: config.returnFocusOnDeactivate && !isFocusable(target, config.tabbableOptions)
      });
      return;
    } // This is needed for mobile devices.
    // (If we'll only let `click` events through,
    // then on mobile they will be blocked anyways if `touchstart` is blocked.)


    if (valueOrHandler(config.allowOutsideClick, e)) {
      // allow the click outside the trap to take place
      return;
    } // otherwise, prevent the click


    e.preventDefault();
  }; // In case focus escapes the trap for some strange reason, pull it back in.


  var checkFocusIn = function checkFocusIn(e) {
    var target = getActualTarget(e);
    var targetContained = findContainerIndex(target) >= 0; // In Firefox when you Tab out of an iframe the Document is briefly focused.

    if (targetContained || target instanceof Document) {
      if (targetContained) {
        state.mostRecentlyFocusedNode = target;
      }
    } else {
      // escaped! pull it back in to where it just left
      e.stopImmediatePropagation();
      tryFocus(state.mostRecentlyFocusedNode || getInitialFocusNode());
    }
  }; // Hijack Tab events on the first and last focusable nodes of the trap,
  // in order to prevent focus from escaping. If it escapes for even a
  // moment it can end up scrolling the page and causing confusion so we
  // kind of need to capture the action at the keydown phase.


  var checkTab = function checkTab(e) {
    var target = getActualTarget(e);
    updateTabbableNodes();
    var destinationNode = null;

    if (state.tabbableGroups.length > 0) {
      // make sure the target is actually contained in a group
      // NOTE: the target may also be the container itself if it's focusable
      //  with tabIndex='-1' and was given initial focus
      var containerIndex = findContainerIndex(target);
      var containerGroup = containerIndex >= 0 ? state.containerGroups[containerIndex] : undefined;

      if (containerIndex < 0) {
        // target not found in any group: quite possible focus has escaped the trap,
        //  so bring it back in to...
        if (e.shiftKey) {
          // ...the last node in the last group
          destinationNode = state.tabbableGroups[state.tabbableGroups.length - 1].lastTabbableNode;
        } else {
          // ...the first node in the first group
          destinationNode = state.tabbableGroups[0].firstTabbableNode;
        }
      } else if (e.shiftKey) {
        // REVERSE
        // is the target the first tabbable node in a group?
        var startOfGroupIndex = findIndex(state.tabbableGroups, function (_ref2) {
          var firstTabbableNode = _ref2.firstTabbableNode;
          return target === firstTabbableNode;
        });

        if (startOfGroupIndex < 0 && (containerGroup.container === target || isFocusable(target, config.tabbableOptions) && !isTabbable(target, config.tabbableOptions) && !containerGroup.nextTabbableNode(target, false))) {
          // an exception case where the target is either the container itself, or
          //  a non-tabbable node that was given focus (i.e. tabindex is negative
          //  and user clicked on it or node was programmatically given focus)
          //  and is not followed by any other tabbable node, in which
          //  case, we should handle shift+tab as if focus were on the container's
          //  first tabbable node, and go to the last tabbable node of the LAST group
          startOfGroupIndex = containerIndex;
        }

        if (startOfGroupIndex >= 0) {
          // YES: then shift+tab should go to the last tabbable node in the
          //  previous group (and wrap around to the last tabbable node of
          //  the LAST group if it's the first tabbable node of the FIRST group)
          var destinationGroupIndex = startOfGroupIndex === 0 ? state.tabbableGroups.length - 1 : startOfGroupIndex - 1;
          var destinationGroup = state.tabbableGroups[destinationGroupIndex];
          destinationNode = destinationGroup.lastTabbableNode;
        }
      } else {
        // FORWARD
        // is the target the last tabbable node in a group?
        var lastOfGroupIndex = findIndex(state.tabbableGroups, function (_ref3) {
          var lastTabbableNode = _ref3.lastTabbableNode;
          return target === lastTabbableNode;
        });

        if (lastOfGroupIndex < 0 && (containerGroup.container === target || isFocusable(target, config.tabbableOptions) && !isTabbable(target, config.tabbableOptions) && !containerGroup.nextTabbableNode(target))) {
          // an exception case where the target is the container itself, or
          //  a non-tabbable node that was given focus (i.e. tabindex is negative
          //  and user clicked on it or node was programmatically given focus)
          //  and is not followed by any other tabbable node, in which
          //  case, we should handle tab as if focus were on the container's
          //  last tabbable node, and go to the first tabbable node of the FIRST group
          lastOfGroupIndex = containerIndex;
        }

        if (lastOfGroupIndex >= 0) {
          // YES: then tab should go to the first tabbable node in the next
          //  group (and wrap around to the first tabbable node of the FIRST
          //  group if it's the last tabbable node of the LAST group)
          var _destinationGroupIndex = lastOfGroupIndex === state.tabbableGroups.length - 1 ? 0 : lastOfGroupIndex + 1;

          var _destinationGroup = state.tabbableGroups[_destinationGroupIndex];
          destinationNode = _destinationGroup.firstTabbableNode;
        }
      }
    } else {
      // NOTE: the fallbackFocus option does not support returning false to opt-out
      destinationNode = getNodeForOption('fallbackFocus');
    }

    if (destinationNode) {
      e.preventDefault();
      tryFocus(destinationNode);
    } // else, let the browser take care of [shift+]tab and move the focus

  };

  var checkKey = function checkKey(e) {
    if (isEscapeEvent(e) && valueOrHandler(config.escapeDeactivates, e) !== false) {
      e.preventDefault();
      trap.deactivate();
      return;
    }

    if (isTabEvent(e)) {
      checkTab(e);
      return;
    }
  };

  var checkClick = function checkClick(e) {
    var target = getActualTarget(e);

    if (findContainerIndex(target) >= 0) {
      return;
    }

    if (valueOrHandler(config.clickOutsideDeactivates, e)) {
      return;
    }

    if (valueOrHandler(config.allowOutsideClick, e)) {
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();
  }; //
  // EVENT LISTENERS
  //


  var addListeners = function addListeners() {
    if (!state.active) {
      return;
    } // There can be only one listening focus trap at a time


    activeFocusTraps.activateTrap(trap); // Delay ensures that the focused element doesn't capture the event
    // that caused the focus trap activation.

    state.delayInitialFocusTimer = config.delayInitialFocus ? delay(function () {
      tryFocus(getInitialFocusNode());
    }) : tryFocus(getInitialFocusNode());
    doc.addEventListener('focusin', checkFocusIn, true);
    doc.addEventListener('mousedown', checkPointerDown, {
      capture: true,
      passive: false
    });
    doc.addEventListener('touchstart', checkPointerDown, {
      capture: true,
      passive: false
    });
    doc.addEventListener('click', checkClick, {
      capture: true,
      passive: false
    });
    doc.addEventListener('keydown', checkKey, {
      capture: true,
      passive: false
    });
    return trap;
  };

  var removeListeners = function removeListeners() {
    if (!state.active) {
      return;
    }

    doc.removeEventListener('focusin', checkFocusIn, true);
    doc.removeEventListener('mousedown', checkPointerDown, true);
    doc.removeEventListener('touchstart', checkPointerDown, true);
    doc.removeEventListener('click', checkClick, true);
    doc.removeEventListener('keydown', checkKey, true);
    return trap;
  }; //
  // TRAP DEFINITION
  //


  trap = {
    get active() {
      return state.active;
    },

    get paused() {
      return state.paused;
    },

    activate: function activate(activateOptions) {
      if (state.active) {
        return this;
      }

      var onActivate = getOption(activateOptions, 'onActivate');
      var onPostActivate = getOption(activateOptions, 'onPostActivate');
      var checkCanFocusTrap = getOption(activateOptions, 'checkCanFocusTrap');

      if (!checkCanFocusTrap) {
        updateTabbableNodes();
      }

      state.active = true;
      state.paused = false;
      state.nodeFocusedBeforeActivation = doc.activeElement;

      if (onActivate) {
        onActivate();
      }

      var finishActivation = function finishActivation() {
        if (checkCanFocusTrap) {
          updateTabbableNodes();
        }

        addListeners();

        if (onPostActivate) {
          onPostActivate();
        }
      };

      if (checkCanFocusTrap) {
        checkCanFocusTrap(state.containers.concat()).then(finishActivation, finishActivation);
        return this;
      }

      finishActivation();
      return this;
    },
    deactivate: function deactivate(deactivateOptions) {
      if (!state.active) {
        return this;
      }

      var options = _objectSpread2({
        onDeactivate: config.onDeactivate,
        onPostDeactivate: config.onPostDeactivate,
        checkCanReturnFocus: config.checkCanReturnFocus
      }, deactivateOptions);

      clearTimeout(state.delayInitialFocusTimer); // noop if undefined

      state.delayInitialFocusTimer = undefined;
      removeListeners();
      state.active = false;
      state.paused = false;
      activeFocusTraps.deactivateTrap(trap);
      var onDeactivate = getOption(options, 'onDeactivate');
      var onPostDeactivate = getOption(options, 'onPostDeactivate');
      var checkCanReturnFocus = getOption(options, 'checkCanReturnFocus');
      var returnFocus = getOption(options, 'returnFocus', 'returnFocusOnDeactivate');

      if (onDeactivate) {
        onDeactivate();
      }

      var finishDeactivation = function finishDeactivation() {
        delay(function () {
          if (returnFocus) {
            tryFocus(getReturnFocusNode(state.nodeFocusedBeforeActivation));
          }

          if (onPostDeactivate) {
            onPostDeactivate();
          }
        });
      };

      if (returnFocus && checkCanReturnFocus) {
        checkCanReturnFocus(getReturnFocusNode(state.nodeFocusedBeforeActivation)).then(finishDeactivation, finishDeactivation);
        return this;
      }

      finishDeactivation();
      return this;
    },
    pause: function pause() {
      if (state.paused || !state.active) {
        return this;
      }

      state.paused = true;
      removeListeners();
      return this;
    },
    unpause: function unpause() {
      if (!state.paused || !state.active) {
        return this;
      }

      state.paused = false;
      updateTabbableNodes();
      addListeners();
      return this;
    },
    updateContainerElements: function updateContainerElements(containerElements) {
      var elementsAsArray = [].concat(containerElements).filter(Boolean);
      state.containers = elementsAsArray.map(function (element) {
        return typeof element === 'string' ? doc.querySelector(element) : element;
      });

      if (state.active) {
        updateTabbableNodes();
      }

      return this;
    }
  }; // initialize container elements

  trap.updateContainerElements(elements);
  return trap;
};

function sendEvent(element, name, data = {}) {
  element.dispatchEvent(new CustomEvent(name, {
    detail: data,
    bubbles: true
  }));
}

class ExpandableHTMLElement extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', event => {
      if (!event.target.hasAttribute('close')) return;
      event.stopPropagation();
      event.target.closest(this.tagName).open = false;
    });
  }
  static get observedAttributes() {
    return ['open'];
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (newValue !== null) {
      setTimeout(() => this.focusTrap.activate(), 150);
    } else {
      this.focusTrap.deactivate();
    }
    this.sendEvent();
  }
  get overlay() {
    return this.hasAttribute('overlay');
  }
  get open() {
    return this.hasAttribute('open');
  }
  set open(value) {
    if (Boolean(value)) {
      this.setAttribute('open', '');
    } else {
      this.removeAttribute('open');
    }
  }
  get focusTrap() {
    return this._focusTrap = this._focusTrap || createFocusTrap(this, this.focusTrapOptions);
  }
  get focusTrapOptions() {
    return {
      allowOutsideClick: event => event.target.getAttribute('aria-controls') === this.id,
      clickOutsideDeactivates: event => !(event.target.getAttribute('aria-controls') === this.id),
      onDeactivate: () => this.open = false,
      ...this._focusTrapOptions
    };
  }
  set focusTrapOptions(options) {
    this._focusTrapOptions = options;
  }
  sendEvent() {
    sendEvent(this, this.open ? 'expandable-html-element:open' : 'expandable-html-element:close');
  }
}

class Modal extends ExpandableHTMLElement {
  constructor() {
    super();
    this.mql = window.matchMedia('(max-width: 751px)');
    this.addEventListener('click', event => {
      this.onClickOverlay(event.target);
    }, false);
  }
  async attributeChangedCallback(name, oldValue, newValue) {
    await this._animate().finished;
    super.attributeChangedCallback(name, oldValue, newValue);
    switch (name) {
      case 'open':
        document.documentElement.classList.toggle('scroll-lock', this.open);
        break;
    }
  }
  onClickOverlay(target) {
    if (target !== this) return;
    this.open = false;
  }
  _animate() {
    const keyframes = {
      opacity: [0, 1],
      visibility: ['hidden', 'visible'],
      transform: this.mql.matches || !this.mql.matches && this.querySelector('.modal__inner').classList.contains('modal__inner--fullscreen') ? ['translateY(100px)', 'translateY(0)'] : ['translate(-50%, calc(-50% + 100px))', 'translate(-50%, -50%)']
    };
    return this.querySelector('.modal__inner').animate(keyframes, {
      duration: 150 * window.LoessTheme.animations.multiplier,
      direction: this.open ? 'normal' : 'reverse',
      easing: 'cubic-bezier(0.5, 0, 0.175, 1)'
    });
  }
}
window.customElements.define('loess-modal', Modal);

window.customElements.define('loess-cart-notification-popup', class extends Modal {
  _animate() {
    const keyframes = {
      opacity: [0, 1],
      visibility: ['hidden', 'visible'],
      transform: ['translateY(-10px)', 'translateY(0)']
    };
    return this.querySelector('.cart-notification').animate(keyframes, {
      duration: 150 * window.LoessTheme.animations.multiplier,
      direction: this.open ? 'normal' : 'reverse',
      easing: 'cubic-bezier(0.5, 0, 0.175, 1)'
    });
  }
});

window.customElements.define('loess-collapsible-panel', class extends ExpandableHTMLElement {
  constructor() {
    super();
    if (!this.dismissable) {
      this.focusTrapOptions = {
        fallbackFocus: this,
        onDeactivate: () => {}
      };
    }

    // If the custom element has an open attribute, we don't want to animate it on page load
    this.animationOnInit = this.open || false;
  }
  async attributeChangedCallback(name, oldValue, newValue) {
    if (this.animationOnInit) {
      this.animationOnInit = false;
      return;
    }
    await this._animate().finished;
    super.attributeChangedCallback(name, oldValue, newValue);
  }
  _animate() {
    const keyframes = {
      opacity: [0, 1],
      visibility: ['hidden', 'visible'],
      height: ['0px', `${this.scrollHeight}px`]
    };
    return this.animate(keyframes, {
      duration: 150 * window.LoessTheme.animations.multiplier,
      direction: this.open ? 'normal' : 'reverse',
      easing: 'cubic-bezier(0.5, 0, 0.175, 1)'
    });
  }
  get dismissable() {
    return this.hasAttribute('dismissable');
  }
});

class Drawer extends ExpandableHTMLElement {
  constructor() {
    super();
    this.addEventListener('click', event => {
      this.onClickOverlay(event.target);
    }, false);
  }
  async attributeChangedCallback(name, oldValue, newValue) {
    await this._animate().finished;
    super.attributeChangedCallback(name, oldValue, newValue);
    switch (name) {
      case 'open':
        if (!this.classList.contains('drawer--inner')) {
          document.documentElement.classList.toggle('scroll-lock', this.open);
        }
        break;
    }
  }
  get position() {
    return this.getAttribute('position') || 'left';
  }
  onClickOverlay(target) {
    if (target !== this) return;
    this.open = false;
  }
  _animate() {
    const keyframes = {
      visibility: ['hidden', 'visible'],
      transform: this.position == 'left' ? ['translateX(-100%)', 'translateX(0)'] : ['translateX(100%)', 'translateX(0)']
    };
    return this.animate(keyframes, {
      duration: 150 * window.LoessTheme.animations.multiplier,
      direction: this.open ? 'normal' : 'reverse',
      easing: 'cubic-bezier(0.5, 0, 0.175, 1)'
    });
  }
}
window.customElements.define('loess-drawer', Drawer);

const LoessFilters = class extends Drawer {
  constructor() {
    super();
    this.mql = window.matchMedia('(max-width: 990px)');
    if (this.sticky) {
      this.mql.addListener(this.setupTabletDrawer.bind(this));
      this.setupTabletDrawer(this.mql);
    }
    if (this.sticky && !this.mql.matches) {
      this.setupStickyScroll(this);
    }
    this.addEventListener('click', event => {
      if (event.target.nodeName !== 'INPUT' || event.target.type !== 'checkbox') return;
      if (!event.target.name.startsWith('filter.')) return;
      this.onFilterChange(event);
    });
  }
  setupTabletDrawer(event) {
    this.classList.toggle('drawer', event.matches);
  }
  onFilterChange(event) {
    const formData = new FormData(event.target.closest('form'));
    const searchParams = new URLSearchParams(formData).toString();
    sendEvent(this, 'filters:changed', {
      searchParams
    });
  }
  get sticky() {
    return this.hasAttribute('sticky');
  }
};
Object.assign(LoessFilters.prototype, StickyScrollMixin);
window.customElements.define('loess-filters', LoessFilters);
window.customElements.define('loess-filters-toggle', class extends HTMLButtonElement {
  constructor() {
    super();
    this.isHidden = true;
    this.list = this.previousElementSibling;
    this.listElements = this.list.querySelectorAll('.collection-filter__list-item--hidden');
    this.addEventListener('click', this.onClickToggle.bind(this));
  }
  onClickToggle() {
    this.expanded = !this.expanded;
    this.isHidden = !this.isHidden;
    this.listElements.forEach(item => item.toggleAttribute('hidden'));
  }
  get expanded() {
    return this.getAttribute('aria-expanded') === 'true';
  }
  set expanded(value) {
    this.setAttribute('aria-expanded', String(value));
  }
}, {
  extends: 'button'
});

window.customElements.define('loess-filters-clear', class extends HTMLAnchorElement {
  constructor() {
    super();
    this.addEventListener('click', this.onFilterCleared.bind(this));
  }
  onFilterCleared(event) {
    event.preventDefault();
    const url = new URL(this.href);
    const searchParams = new URLSearchParams(url.search).toString();
    sendEvent(this, 'filters:changed', {
      searchParams
    });
  }
}, {
  extends: 'a'
});

window.customElements.define('loess-filters-price', class extends HTMLElement {
  constructor() {
    super();
    this.rangeInput = this.querySelectorAll('.price-range__range');
    this.priceInput = this.querySelectorAll('.price-range__input');
    this.range = this.querySelector('.price-slider__progress');
    this.priceGap = 10;
    this.priceInput.forEach(input => {
      input.addEventListener('input', this.onInputPrice.bind(this));
      input.addEventListener('change', this.onChangePrice.bind(this));
    });
    this.rangeInput.forEach(input => {
      input.addEventListener('input', this.onInputRange.bind(this));
      input.addEventListener('change', this.onChangePrice.bind(this));
    });
    this.range.style.left = '0%';
    this.range.style.right = '0%';
  }
  onInputPrice(event) {
    const minPrice = parseInt(this.priceInput[0].value);
    const maxPrice = parseInt(this.priceInput[1].value);
    if (maxPrice - minPrice >= this.priceGap && maxPrice <= this.rangeInput[1].max) {
      if (event.target.hasAttribute('input-min')) {
        this.rangeInput[0].value = minPrice;
        this.range.style.left = minPrice / this.rangeInput[0].max * 100 + '%';
      } else {
        this.rangeInput[1].value = maxPrice;
        this.range.style.right = 100 - maxPrice / this.rangeInput[1].max * 100 + '%';
      }
    }
  }
  onInputRange(event) {
    const minVal = parseInt(this.rangeInput[0].value);
    const maxVal = parseInt(this.rangeInput[1].value);
    if (maxVal - minVal < this.priceGap) {
      if (event.target.hasAttribute('input-min')) {
        this.rangeInput[0].value = maxVal - this.priceGap;
      } else {
        this.rangeInput[1].value = minVal + this.priceGap;
      }
    } else {
      this.priceInput[0].value = minVal;
      this.priceInput[1].value = maxVal;
      this.range.style.left = minVal / this.rangeInput[0].max * 100 + '%';
      this.range.style.right = 100 - maxVal / this.rangeInput[1].max * 100 + '%';
    }
  }
  onChangePrice(event) {
    event.preventDefault();
    const formData = new FormData(event.target.closest('form'));
    const searchParams = new URLSearchParams(formData).toString();
    sendEvent(this, 'filters:changed', {
      searchParams
    });
  }
});

window.customElements.define('loess-free-shipping-bar', class extends HTMLElement {
  connectedCallback() {
    document.documentElement.addEventListener('cart:updated', this.update.bind(this));
  }
  async update(event) {
    let total_price = event.detail['cart']['total_price'];
    if (!total_price) {
      const response = await fetch('/cart.js', {
        method: 'GET'
      });
      const responseText = await response.json();
      total_price = responseText['total_price'];
    }
    this.style.setProperty("--progress", Math.min(parseFloat(total_price) / this.threshold, 1));
  }
  get threshold() {
    return parseFloat(this.getAttribute('threshold'));
  }
});

async function imageLoaded(image) {
  return image.complete ? Promise.resolve() : new Promise(resolve => image.onload = resolve);
}

const IntersectionObserverMixin = {
  setupIntersectionObserver(callback, rootMargin = '0px 0px 200px 0px') {
    const handleIntersect = (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      if (callback) callback();
      observer.disconnect();
    };
    new IntersectionObserver(handleIntersect.bind(this), {
      rootMargin
    }).observe(this);
  }
};

const LoessImage = class extends HTMLImageElement {
  async connectedCallback() {
    await imageLoaded(this);
    this.setupIntersectionObserver(async () => {
      if (this.parallax) {
        await loadScript('https://cdn.jsdelivr.net/npm/simple-parallax-js@5.6.1/dist/simpleParallax.min.js');
        await this.setupSimpleParallax();
      }
      requestAnimationFrame(() => {
        this.removeAttribute('reveal');
      });
    }, '0px 0px -100px 0px');
  }
  setupSimpleParallax() {
    return new Promise(resolve => {
      resolve(new simpleParallax(this, {
        orientation: 'down',
        scale: 1.7,
        customWrapper: '[parallax]'
      }));
    });
  }
  get reveal() {
    return this.hasAttribute('reveal');
  }
  get parallax() {
    return this.parentElement.getAttribute('parallax') === 'true';
  }
};
Object.assign(LoessImage.prototype, IntersectionObserverMixin);
window.customElements.define('loess-image', LoessImage, {
  extends: 'img'
});

window.customElements.define('loess-input-field', class extends HTMLInputElement {
  constructor() {
    super();
    this.addEventListener('keyup', this.handleKeyUp);
  }
  handleKeyUp() {
    this.classList.toggle('input__field--has-input', this.value !== '');
  }
}, {
  extends: 'input'
});

window.customElements.define('loess-localization-form', class extends HTMLElement {
  constructor() {
    super();
    this.inputs = this.querySelector('input[name="locale_code"], input[name="country_code"]');
    this.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', this._onClick.bind(this));
    });
  }
  _onClick(event) {
    event.preventDefault();
    const form = this.querySelector('form');
    this.inputs.value = event.currentTarget.dataset.value;
    if (form) form.submit();
  }
});

window.customElements.define('loess-main-menu', class extends HTMLElement {
  constructor() {
    super();
    this.showTimeout = null;
    const items = Array.from(this.querySelectorAll('.has-dropdown[aria-expanded]'));
    items.forEach(item => {
      item.parentElement.addEventListener('mouseenter', event => {
        this.showDropdown(event.target);
      });
      if (!window.matchMedia('(hover: hover)').matches) {
        item.addEventListener('click', event => {
          if (event.target.getAttribute('aria-expanded' === 'true')) return;
          event.preventDefault();
          this.showDropdown(event.target.parentElement);
        });
      }
    });
  }
  showDropdown(navItem) {
    const anchor = navItem.querySelector('.has-dropdown');
    const dropdown = anchor.nextElementSibling;
    this.showTimeout = setTimeout(() => {
      if (anchor.getAttribute('aria-expanded') === 'true') return;
      anchor.setAttribute('aria-expanded', 'true');
      dropdown.removeAttribute('hidden');
      const mouseLeaveHandler = () => {
        this.closeDropdown(navItem);
        navItem.removeEventListener('mouseleave', mouseLeaveHandler);
      };
      navItem.addEventListener('mouseleave', mouseLeaveHandler);
      this.showTimeout = null;
    }, 0);
    navItem.addEventListener('mouseleave', () => {
      if (!this.showTimeout) return;
      clearTimeout(this.showTimeout);
    }, {
      once: true
    });
  }
  closeDropdown(navItem) {
    const anchor = navItem.querySelector('.has-dropdown');
    const dropdown = anchor.nextElementSibling;
    requestAnimationFrame(() => {
      anchor.setAttribute('aria-expanded', 'false');
      setTimeout(() => {
        dropdown.setAttribute('hidden', '');
        clearTimeout(this.showTimeout);
      }, 0);
    });
  }
}, {
  extends: 'nav'
});

window.customElements.define('loess-modal-product', class extends Modal {
  constructor() {
    super();
    if (!this.href) return;
    this.innerElement = this.querySelector('.modal__inner');
    this.contentElement = this.querySelector('.modal__inner-dynamic-content');
    this.closeButton = this.querySelector('.modal__close-button');
    this.spinner = this.querySelector('.modal__spinner');
  }
  connectedCallback() {
    this.handleState = this._handleState.bind(this);
    this.handleVariantChange = this._handleVariantChange.bind(this);
    document.addEventListener('expandable-html-element:open', this.handleState);
    document.addEventListener('expandable-html-element:close', this.handleState);
    document.addEventListener('product-card:variant:changed', this.handleVariantChange);
  }
  disconnectedCallback() {
    document.removeEventListener('expandable-html-element:open', this.handleState);
    document.removeEventListener('expandable-html-element:close', this.handleState);
    document.removeEventListener('product-card:variant:changed', this.handleVariantChange);
  }
  _handleState(event) {
    event.stopPropagation();
    if (event.target != this) return;
    if (event.type == 'expandable-html-element:open') {
      this.fetchPage();
    } else {
      if (this.controller) this.controller.abort();
      this.resetModal();
    }
  }
  _handleVariantChange(event) {
    if (!event.detail.variantId) return;
    if (event.target != this.closest('loess-product-card')) return;
    const link = document.createElement('a');
    link.setAttribute('href', this.href);
    const url = new URL(link.href);
    url.searchParams.set('variant', event.detail.variantId);
    this.setAttribute('href', url.toString());
  }
  async fetchPage() {
    this.controller = new AbortController();
    const response = await fetch(this.href, {
      signal: this.controller.signal
    });
    const responseText = await response.text();
    const html = new DOMParser().parseFromString(responseText, 'text/html');
    await this.renderModalContent(html);
    this.innerElement.classList.add('modal__inner--fit-height');
    if (window.Shopify && Shopify.PaymentButton) {
      Shopify.PaymentButton.init();
    }
  }
  renderModalContent(html) {
    return new Promise(resolve => {
      this.contentElement.innerHTML = html.getElementById('MainContent').innerHTML;
      this.spinner.classList.add('hidden');
      this.closeButton.style.display = 'flex';
      resolve();
    });
  }
  resetModal() {
    this.contentElement.innerHTML = '';
    this.innerElement.classList.remove('modal__inner--fit-height');
    this.spinner.classList.remove('hidden');
  }
  _animate() {
    const keyframes = {
      opacity: [0, 1],
      visibility: ['hidden', 'visible'],
      transform: ['translateY(calc(-50% + 100px))', 'translateY(-50%)']
    };
    return this.querySelector('.modal__inner').animate(keyframes, {
      duration: 150 * window.LoessTheme.animations.multiplier,
      direction: this.open ? 'normal' : 'reverse',
      easing: 'cubic-bezier(0.5, 0, 0.175, 1)'
    });
  }
  get href() {
    return `${this.getAttribute('href')}`;
  }
});

window.customElements.define('loess-modal-video', class extends Modal {
  constructor() {
    super();
    this.loaded = false;
  }
  connectedCallback() {
    this.handleState = this._handleState.bind(this);
    document.addEventListener('expandable-html-element:open', this.handleState);
    document.addEventListener('expandable-html-element:close', this.handleState);
  }
  disconnectedCallback() {
    document.removeEventListener('expandable-html-element:open', this.handleState);
    document.removeEventListener('expandable-html-element:close', this.handleState);
  }
  _handleState(event) {
    event.stopPropagation();
    if (event.target != this) return;
    if (event.type == 'expandable-html-element:open') {
      this.play();
    } else {
      this.pause();
    }
  }
  load() {
    return new Promise(resolve => {
      const iframe = this.querySelector('iframe');
      iframe.src = iframe.dataset.src;
      iframe.addEventListener('load', () => {
        var _this$querySelector;
        (_this$querySelector = this.querySelector('.spinner')) === null || _this$querySelector === void 0 ? void 0 : _this$querySelector.remove();
        this.loaded = true;
        resolve();
      });
    });
  }
  async play() {
    if (!this.loaded) await this.load();
    if (this.type === 'youtube') {
      this.querySelector('iframe').contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: 'playVideo',
        args: ''
      }), '*');
    } else if (this.type === 'vimeo') {
      this.querySelector('iframe').contentWindow.postMessage(JSON.stringify({
        method: 'play'
      }), '*');
    }
  }
  pause() {
    if (!this.loaded) return;
    if (this.type === 'youtube') {
      this.querySelector('iframe').contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: 'pauseVideo',
        args: ''
      }), '*');
    } else if (this.type === 'vimeo') {
      this.querySelector('iframe').contentWindow.postMessage(JSON.stringify({
        method: 'pause'
      }), '*');
    }
  }
  get type() {
    return this.getAttribute('type');
  }
});

window.customElements.define('loess-overlay', class extends HTMLElement {
  static get observedAttributes() {
    return ['open'];
  }
  async attributeChangedCallback(name) {
    switch (name) {
      case 'open':
        document.documentElement.classList.toggle('scroll-lock', this.open);
        break;
    }
  }
  connectedCallback() {
    this.handleState = this._handleState.bind(this);
    document.addEventListener('expandable-html-element:open', this.handleState);
    document.addEventListener('expandable-html-element:close', this.handleState);
  }
  disconnectedCallback() {
    document.removeEventListener('expandable-html-element:open', this.handleState);
    document.removeEventListener('expandable-html-element:close', this.handleState);
  }
  _handleState(event) {
    event.stopPropagation();
    if (!event.target.overlay) return;
    if (event.type == 'expandable-html-element:open') {
      this.open = true;
    } else {
      this.open = false;
    }
  }
  get open() {
    return this.hasAttribute('open');
  }
  set open(value) {
    if (Boolean(value)) {
      this.setAttribute('open', '');
    } else {
      this.removeAttribute('open');
    }
  }
});

window.customElements.define('loess-pagination', class extends HTMLElement {
  constructor() {
    super();
    if (!this.asyncLoad) return;
    this.addEventListener('click', this.onPageClick.bind(this));
  }
  onPageClick(event) {
    event.preventDefault();
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('page', event.target.dataset.page);
    sendEvent(this, 'pagination:link:clicked', {
      searchParams: searchParams.toString()
    });
  }
  get asyncLoad() {
    return this.hasAttribute('async');
  }
}, {
  extends: 'nav'
});

window.customElements.define('loess-popover', class extends ExpandableHTMLElement {});

window.customElements.define('loess-product-card', class extends HTMLElement {
  constructor() {
    super();
    this.colorSwatches = this.querySelectorAll('.card-swatches__button');
    if (!this.colorSwatches.length) return;
    this.colorSwatches.forEach(colorSwatch => {
      colorSwatch.addEventListener('mouseenter', this.onColorSwatchHover.bind(this));
      colorSwatch.addEventListener('click', this.onColorSwatchClick.bind(this));
    });
  }
  onColorSwatchHover(event) {
    this.preloadImage(event.target);
  }
  async onColorSwatchClick(event) {
    const image = this.preloadImage(event.target);
    await imageLoaded(image);
    if (!image.hasAttribute('hidden')) return;
    image.removeAttribute('hidden');
    this.updateActiveState(event.target);
    this.variantImages.filter(primaryImage => {
      return primaryImage !== image;
    }).forEach(image => image.setAttribute('hidden', 'true'));
    this.updateProductLinks(event.target);
    sendEvent(this, 'product-card:variant:changed', {
      variantId: event.target.dataset.variantId
    });
  }
  preloadImage(colorSwatch) {
    const image = this.getImageWithId(colorSwatch);
    image.setAttribute('loading', 'eager');
    return image;
  }
  getImageWithId(colorSwatch) {
    this.variantImages = this.variantImage || Array.from(this.querySelectorAll('.card__primary-image'));
    return this.variantImages.find(image => {
      return image.dataset.mediaId === colorSwatch.dataset.mediaId;
    });
  }
  updateActiveState(colorSwatch) {
    const activeClass = 'card-swatches__button--active';
    this.colorSwatches.forEach(colorSwatch => {
      colorSwatch.classList.remove(activeClass);
    });
    colorSwatch.classList.add(activeClass);
  }
  updateProductLinks(colorSwatch) {
    this.productLinks = this.productLinks || this.querySelectorAll(':not(loess-modal-product)[href*="/products"]');
    this.productLinks.forEach(link => {
      const url = new URL(link.href);
      url.searchParams.set('variant', colorSwatch.dataset.variantId);
      link.setAttribute('href', url.toString());
    });
  }
});

customElements.define('loess-product-form', class extends HTMLElement {
  constructor() {
    super();
    this.form = this.querySelector('form');
    this.form.querySelector('[name=id]').disabled = false;
    this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
    this.cart = document.querySelector('loess-cart-notification') || document.querySelector('loess-cart-drawer-items');
  }
  async onSubmitHandler(event) {
    event.preventDefault();
    this.submitButton = this.submitButton || this.querySelector('[type="submit"]');
    if (this.submitButton.getAttribute('aria-disabled') === 'true') return;
    this.handleErrorMessage();
    this.submitButton.setAttribute('aria-disabled', true);
    this.submitButton.querySelector('span').classList.add('hide');
    this.querySelector('.spinner').classList.remove('hide');
    const config = fetchConfig('javascript');
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    delete config.headers['Content-Type'];
    const formData = new FormData(this.form);
    if (this.cart && this.redirectType != 'page') {
      formData.append('sections', this.cart.getSectionsToRender().map(section => section.section));
      formData.append('sections_url', window.location.pathname);
    }
    config.body = formData;
    fetch(`${window.LoessTheme.routes.cart_add_url}`, config).then(response => response.json()).then(async state => {
      if (state.status) {
        this.handleErrorMessage(state.description);
        this.error = true;
        return;
      }
      this.error = false;
      if (!this.cart) {
        window.location = window.LoessTheme.routes.cart_url;
        return;
      }
      if (this.redirectType != 'page') {
        const modalProduct = this.closest('loess-modal-product');
        if (modalProduct) {
          modalProduct.open = false;
          await new Promise(r => setTimeout(r, 100 * window.LoessTheme.animations.multiplier));
        }
      }
      if (this.redirectType == 'drawer') {
        this.cart.renderCartItems(state);
        setTimeout(() => {
          document.querySelector(`[aria-controls="${this.cart.closest('loess-drawer').id}"`).click();
        }, 100);
      } else if (this.redirectType == 'popup') {
        this.cart.renderCartItems(state);
        const cartPopup = this.cart.closest('loess-cart-notification-popup');
        cartPopup.open = true;
        cartPopup.focus();
      } else {
        window.location = window.LoessTheme.routes.cart_url;
        return;
      }
    }).catch(e => {
      console.error(e);
    }).finally(() => {
      this.submitButton.removeAttribute('aria-disabled');
      if (this.redirectType != 'page') {
        this.submitButton.querySelector('span').classList.remove('hide');
        this.querySelector('.spinner').classList.add('hide');
      }
    });
  }
  handleErrorMessage(errorMessage = false) {
    this.errorMessageWrapper = this.errorMessageWrapper || this.querySelector('.form-message[role="alert"]');
    if (!this.errorMessageWrapper) return;
    this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.form-message__text');
    this.errorMessageWrapper.classList.toggle('hidden', !errorMessage);
    if (errorMessage) {
      this.errorMessage.textContent = errorMessage;
    }
  }
  get redirectType() {
    return this.getAttribute('redirect-type');
  }
});

window.customElements.define('loess-product-filters', class extends HTMLElement {
  constructor() {
    super();
    this.searchParamsInitial = window.location.search.slice(1);
    this.searchParamsPrev = window.location.search.slice(1);
    this.addEventListener('pagination:link:clicked', this.renderPage.bind(this));
    this.addEventListener('filters:changed', this.renderPage.bind(this));
  }
  connectedCallback() {
    const onHistoryChange = event => {
      const searchParams = event.state ? event.state.searchParams : this.searchParamsInitial;
      if (searchParams === this.searchParamsPrev) return;
      this.renderPage(searchParams, false);
    };
    window.addEventListener('popstate', onHistoryChange);
  }
  async renderPage(event, updateURLHash = true) {
    var _event$detail;
    let searchParams = event === null || event === void 0 ? void 0 : (_event$detail = event.detail) === null || _event$detail === void 0 ? void 0 : _event$detail.searchParams;
    if (!updateURLHash) searchParams = event;
    this.searchParamsPrev = searchParams;
    const url = `${window.location.pathname}?section_id=${this.sectionId}&${this.terms ? `q=${this.terms}` : ''}&${searchParams}`;
    this.setAttribute('loading', '');
    const response = await fetch(url);
    const responseText = await response.text();
    const html = new DOMParser().parseFromString(responseText, 'text/html');
    this.renderProductGrid(html);
    this.renderFilterValues(html, event);
    this.renderActiveFilters(html);
    this.renderProductCount(html);
    if (updateURLHash) this.updateURLHash(searchParams);
    this.removeAttribute('loading');
    requestAnimationFrame(() => {
      this.querySelector('.collection').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  }
  renderProductGrid(html) {
    var _html$querySelector, _html$querySelector$p;
    document.querySelector('.collection-bar').parentElement.innerHTML = (_html$querySelector = html.querySelector('.collection-bar')) === null || _html$querySelector === void 0 ? void 0 : (_html$querySelector$p = _html$querySelector.parentElement) === null || _html$querySelector$p === void 0 ? void 0 : _html$querySelector$p.innerHTML;
    document.getElementById('FilterProductGrid').innerHTML = html.getElementById('FilterProductGrid').innerHTML;
  }
  renderFilterValues(html) {
    const filterDrawersParent = html.getElementById('FilterDrawers');
    const filterMobileTemp = filterDrawersParent.querySelector('#FilterDrawerMobile');
    if (filterMobileTemp) {
      const filterMobileButtons = Array.from(this.querySelectorAll('.scroller-tabs button'));
      const filterMobileOffsetLeft = this.querySelector('.scroller-tabs button[aria-expanded="true"]').offsetLeft;
      const filterMobileScrollTop = this.querySelector('.drawer__content').scrollTop;
      filterMobileButtons.forEach(button => {
        const toggle = filterMobileTemp.querySelector(`[aria-controls="${button.getAttribute('aria-controls')}"]`);
        const panel = filterMobileTemp.querySelector(`[id="${button.getAttribute('aria-controls')}"]`);
        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        toggle.parentElement.toggleAttribute('active', isExpanded);
        panel.removeAttribute('hidden');
        panel.removeAttribute('open');
        panel.setAttribute(isExpanded ? 'open' : 'hidden', '');
      });
      this.querySelector('#FilterDrawerMobile').innerHTML = filterDrawersParent.querySelector('#FilterDrawerMobile').innerHTML;
      const scrollerTabs = this.querySelector('loess-scroller-tabs');
      scrollerTabs.scrollTo({
        behavior: 'instant',
        left: filterMobileOffsetLeft - scrollerTabs.clientWidth / 2 + scrollerTabs.selectedButton.clientWidth / 2
      });
      this.querySelector('.drawer__content').scrollTop = filterMobileScrollTop;
    }
    const filterLargeTemp = filterDrawersParent.querySelector('#FilterDrawerLarge');
    if (filterLargeTemp) {
      const filterLargeButtons = Array.from(this.querySelectorAll('.collection-filter > button[is="loess-button"]'));
      filterLargeButtons.forEach(button => {
        const toggle = filterLargeTemp.querySelector(`[aria-controls="${button.getAttribute('aria-controls')}"]`);
        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        toggle.nextElementSibling.toggleAttribute('open', isExpanded);
        const listToggleButton = button.nextElementSibling.querySelector('.collection-filter__more-button');
        if ((listToggleButton === null || listToggleButton === void 0 ? void 0 : listToggleButton.getAttribute('aria-expanded')) == 'true') {
          const toggleButtonIndex = listToggleButton.getAttribute('index');
          const toggleButton = filterLargeTemp.querySelector(`.collection-filter__more-button[index="${toggleButtonIndex}"]`);
          const hiddenItems = Array.from(toggleButton.previousElementSibling.querySelectorAll('.collection-filter__list-item--hidden'));
          hiddenItems.map(element => {
            element.removeAttribute('hidden');
            toggleButton.setAttribute('aria-expanded', 'true');
          });
        }
      });
      this.querySelector('#FilterDrawerLarge').innerHTML = filterLargeTemp.innerHTML;
    }
  }
  renderActiveFilters(html) {
    var _html$querySelector2;
    const activeFiltersHTML = (_html$querySelector2 = html.querySelector('.collection-active-filters')) === null || _html$querySelector2 === void 0 ? void 0 : _html$querySelector2.innerHTML;
    this.querySelectorAll('.collection-active-filters').forEach(element => {
      element.innerHTML = activeFiltersHTML || '';
    });
  }
  renderProductCount(html) {
    document.getElementById('FilterProductCount').innerHTML = html.getElementById('FilterProductCount').innerHTML;
  }
  updateURLHash(searchParams) {
    history.pushState({
      searchParams
    }, '', `${window.location.pathname}${searchParams && '?'.concat(searchParams)}`);
  }
  get sectionId() {
    return this.getAttribute('section-id');
  }
  get terms() {
    return this.getAttribute('terms');
  }
});

window.customElements.define('loess-product-image-zoom', class extends ExpandableHTMLElement {
  async connectedCallback() {
    this.gallery = this.parentElement.querySelector('loess-product-gallery');
    this.focusTrapOptions = {
      fallbackFocus: this
    };
  }
  disconnectedCallback() {
    var _this$pswpModule;
    (_this$pswpModule = this.pswpModule) === null || _this$pswpModule === void 0 ? void 0 : _this$pswpModule.destroy();
  }
  async attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    switch (name) {
      case 'open':
        if (this.open) {
          this.pswpModule = await this.loadPhotoSwipe();
          this.initializePhotoSwipe();
        }
    }
  }
  async loadPhotoSwipe() {
    return await import('https://cdn.jsdelivr.net/npm/photoswipe@5.3.2/dist/photoswipe.esm.min.js');
  }
  initializePhotoSwipe() {
    const options = {
      dataSource: this.buildImages(),
      index: this.gallery.getActiveSlideIndex(),
      zoom: false,
      counter: false,
      bgOpacity: 1,
      closeOnVerticalDrag: false,
      closeSVG: '<svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10"><path fill-rule="evenodd" clip-rule="evenodd" d="M.76 8.67a.75.75 0 0 0 1.06 1.06l3.3-3.3L8.3 9.6a.75.75 0 1 0 1.06-1.06L6.18 5.37 9.24 2.3a.75.75 0 0 0-1.06-1.06L5.12 4.31 1.94 1.13A.75.75 0 0 0 .87 2.19l3.19 3.18-3.3 3.3Z"/></svg>',
      arrowNextSVG: '<svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.066 8.662a.75.75 0 0 0 1.06 0l4.066-4.066L5.127.53a.75.75 0 1 0-1.061 1.061L7.07 4.596 4.066 7.601a.75.75 0 0 0 0 1.061Z"/></svg>',
      arrowPrevSVG: '<svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" style="transform: rotateY(180deg)"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.066 8.662a.75.75 0 0 0 1.06 0l4.066-4.066L5.127.53a.75.75 0 1 0-1.061 1.061L7.07 4.596 4.066 7.601a.75.75 0 0 0 0 1.061Z"/></svg>'
    };
    const pswp = new this.pswpModule.default(options);
    pswp.init();
    pswp.on('close', () => {
      this.open = false;
    });
  }
  buildImages() {
    return Array.from(this.gallery.querySelectorAll('img')).map(image => {
      return {
        srcset: image.srcset,
        src: image.src,
        width: image.getAttribute('width'),
        height: image.getAttribute('height'),
        alt: image.alt
      };
    });
  }
});

window.customElements.define('loess-predictive-search', class extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input[type="search"]');

    // Should probably (eventually) isolate this to its own custom element JS
    this.results = this.querySelector('.predictive-search-results__list');
    this.input.addEventListener('input', debounce(() => {
      this.onChange();
    }).bind(this));
  }
  getQuery() {
    return this.input.value.trim();
  }
  onChange() {
    const searchTerm = this.getQuery();
    this.results.innerHTML = '';
    this.querySelector('loess-predictive-search-results').hidden = false;
    this.querySelector('loess-predictive-search-results').setAttribute('loading', '');
    if (!searchTerm.length) {
      this.querySelector('loess-predictive-search-results').hidden = true;
      return;
    }
    this.searchTerm = searchTerm;
    this.getSearchResults();
  }
  async getSearchResults() {
    const response = await fetch(this.buildQueryString());
    if (!response.ok) {
      const error = new Error(response.status);
      throw error;
    }
    const text = await response.text();
    this.injectHTMLResponse(text);
    this.querySelector('loess-predictive-search-results').removeAttribute('loading');
  }
  buildQueryString() {
    return `${this.fetchUrl}?q=${encodeURIComponent(this.searchTerm)}&${encodeURIComponent('resources[type]')}=product${this.resources}&${encodeURIComponent('resources[limit]')}=8&section_id=predictive-search`;
  }
  injectHTMLResponse(text) {
    const responseMarkup = new DOMParser().parseFromString(text, 'text/html').querySelector('#shopify-section-predictive-search').innerHTML;
    this.results.innerHTML = responseMarkup;
  }
  get fetchUrl() {
    return this.getAttribute('fetch-url');
  }
  get resources() {
    const resources = this.getAttribute('resources');
    return resources ? `,${resources}` : '';
  }
});

window.customElements.define('loess-qr-code', class extends HTMLElement {
  constructor() {
    super();
    this._generateQRCode();
  }
  identifier() {
    return this.getAttribute('identifier');
  }
  async _generateQRCode() {
    await fetchInject([window.LoessTheme.scripts.QRCode]);
    new QRCode(this, {
      text: this.identifier,
      width: 120,
      height: 120
    });
  }
});

window.customElements.define('loess-quantity-input', class extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input');
    this.changeEvent = new Event('change', {
      bubbles: true
    });
    this.querySelectorAll('button').forEach(button => button.addEventListener('click', this.onButtonClick.bind(this)));
  }
  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;
    event.target.name === 'plus' ? this.input.stepUp() : this.input.stepDown();
    if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);
  }
});

window.customElements.define('loess-scroller', class extends HTMLElement {
  constructor() {
    super();
    if (!this.enabledScrollerMobile && !this.enabledScrollerLarge) return;
    this.scroller = this.querySelector('ul');

    // Hate to have to do this, but getting a bug in which the scroller jumps
    // to a random location when the page is loaded, most likely due to scroll-snap.
    // Let's add it dynamically after page load for now.
    this.scroller.style.scrollSnapType = 'x mandatory';
    this._checkMediaQueryBreakpoint();
  }
  connectedCallback() {
    this.previousSlide = this._previousSlide.bind(this);
    this.nextSlide = this._nextSlide.bind(this);
    this.addEventListener('scroller:previousButton:clicked', this.previousSlide);
    this.addEventListener('scroller:nextButton:clicked', this.nextSlide);
  }
  disconnectedCallback() {
    this.removeEventListener('scroller:previousButton:clicked', this.previousSlide);
    this.removeEventListener('scroller:nextButton:clicked', this.nextSlide);
  }
  _checkMediaQueryBreakpoint() {
    this.mediaQueryList = [window.matchMedia('(min-width: 991px)'), window.matchMedia('(min-width: 751px)')];
    this.mediaQueryList.forEach(mediaQuery => {
      mediaQuery.addListener(this.mediaQueryHandler.bind(this));
    });
    this.mediaQueryHandler();
  }
  async mediaQueryHandler() {
    var _this$dots, _this$dots2;
    this.scroller.scrollLeft = 0;
    await window.customElements.whenDefined('loess-scroller-dots');

    // Set an initial state for the dots
    this.dots = this.querySelector('loess-scroller-dots');
    (_this$dots = this.dots) === null || _this$dots === void 0 ? void 0 : _this$dots.reset();

    // If breakpoints change, we want to disconnect the previous observer
    if (this.observer) this.observer.disconnect();

    // No point in doing anything if not enough items
    if (!this.numberOfColumns) return;
    if (this.items.length <= this.numberOfColumns) return;
    this._setupItemsIntersectionObserver();
    (_this$dots2 = this.dots) === null || _this$dots2 === void 0 ? void 0 : _this$dots2.build(this.sentinels);
  }
  _setupItemsIntersectionObserver() {
    const options = {
      root: !this.mediaQueryList[0].matches && this.sentinels.length !== 2 ? this.scroller : null,
      rootMargin: this.observerRootMargin
    };
    this.observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        var _this$dots3;
        if (!entry.isIntersecting) return;
        (_this$dots3 = this.dots) === null || _this$dots3 === void 0 ? void 0 : _this$dots3.setActiveItem(entry.target);
      });
    }, options);
    this.sentinels.forEach(item => {
      this.observer.observe(item);
    });
  }
  get observerRootMargin() {
    if (this.mediaQueryList[0].matches) {
      return '0px';
    }

    // This only happens when number of columns is set to 1,
    // in which case we want the rootMargin to trigger at the half point
    if (this.items.length === this.sentinels.length) {
      return '-50%';
    }
    return '-25%';
  }
  get sentinels() {
    // Get the items that will acts as triggers for the scroller indicators
    return Array.from(this.items).filter((element, index, array) => index % this.numberOfColumns == 0);
  }
  get numberOfColumns() {
    // Scroller on desktop
    if (this.mediaQueryList[0].matches && this.enabledScrollerLarge) {
      return this.columnsLarge;
    }

    // Scroller on tablet
    if (this.mediaQueryList[1].matches && this.enabledScrollerTablet) {
      return this.columnsTablet;
    }

    // Scroller on mobile
    return this.columnsMobile;
  }
  get enabledScrollerMobile() {
    return this.hasAttribute('columns-mobile');
  }
  get enabledScrollerTablet() {
    return this.hasAttribute('columns-tablet');
  }
  get enabledScrollerLarge() {
    return this.hasAttribute('columns-large');
  }
  get columnsMobile() {
    return Number(this.getAttribute('columns-mobile'));
  }
  get columnsTablet() {
    return Number(this.getAttribute('columns-tablet') || this.columnsMobile + 1);
  }
  get columnsLarge() {
    return Number(this.getAttribute('columns-large'));
  }
  get items() {
    return this.scroller.children;
  }
  _previousSlide(event) {
    event.target.nextElementSibling.removeAttribute('disabled');
    event.target.toggleAttribute('disabled', this.scroller.scrollLeft - (this.scroller.clientWidth + 10) <= 0);
    this._changeSlide(-1);
  }
  _nextSlide(event) {
    event.target.previousElementSibling.removeAttribute('disabled');
    event.target.toggleAttribute('disabled', this.scroller.scrollLeft + (this.scroller.clientWidth + 10) * 2 >= this.scroller.scrollWidth);
    this._changeSlide(1);
  }
  _changeSlide(direction) {
    const columnGap = 10;
    this.scroller.scrollBy({
      left: direction * (this.scroller.clientWidth + columnGap),
      behavior: 'smooth'
    });
  }
});
window.customElements.define('loess-scroller-dots', class extends HTMLElement {
  constructor() {
    super();
    this.orderedList = this.querySelector('ol');
  }
  reset() {
    this.orderedList.innerHTML = '';
    delete this.orderedListItems;
  }
  build(items) {
    this.items = items;
    this.items.forEach(() => {
      const listItem = this.querySelector('template').content.cloneNode(true);
      this.orderedList.appendChild(listItem);
    });
  }
  setActiveItem(target, parent = null) {
    var _this$items;
    this.orderedListItems = this.orderedListItems || this.orderedList.querySelectorAll('li');
    this.orderedListItems.forEach(listItem => {
      listItem.removeAttribute('active');
    });
    const index = (_this$items = this.items) === null || _this$items === void 0 ? void 0 : _this$items.indexOf(target);
    if (parent !== null) {
      index = [...parent].indexOf(target);
    }
    this.orderedList.children[index].setAttribute('active', '');
  }
});
window.customElements.define('loess-scroller-buttons', class extends HTMLElement {
  constructor() {
    super();
    this.previousButton = this.querySelector('button:first-of-type');
    this.nextButton = this.querySelector('button:last-of-type');
  }
  connectedCallback() {
    this.previousButton.addEventListener('click', () => {
      sendEvent(this.previousButton, 'scroller:previousButton:clicked');
    });
    this.nextButton.addEventListener('click', () => {
      sendEvent(this.nextButton, 'scroller:nextButton:clicked');
    });
  }
});

window.customElements.define('loess-scroller-tabs', class extends HTMLElement {
  constructor() {
    super();
    this.buttons = Array.from(this.querySelectorAll('button'));
    this.buttons.forEach(button => {
      button.addEventListener('click', this.onButtonClick.bind(this));
      // button.addEventListener('mouseenter', this.onButtonHover.bind(this));
    });

    if (Shopify.designMode) {
      this.addEventListener('shopify:block:select', this.onButtonClick.bind(this));
    }
  }
  get selectedButton() {
    return this.buttons.find(button => {
      return button.getAttribute('aria-expanded') === 'true';
    });
  }
  async onButtonClick(event) {
    // Don't do anything if the selected button is the same as current
    if (this.selectedButton === event.target) return;
    this.contentToHide = document.getElementById(this.selectedButton.getAttribute('aria-controls'));
    this.contentToShow = document.getElementById(event.target.getAttribute('aria-controls'));
    this.updateButtons(event.target);
    if (Shopify.designMode && event.detail.load) {
      this.contentToHide.hidden = true;
      this.contentToShow.hidden = false;
    } else {
      this.animateContent();
    }
  }
  onButtonHover(event) {
    const contentToShow = document.getElementById(event.target.getAttribute('aria-controls'));
    this.loadContentImages(contentToShow);
  }
  loadContentImages(contentToShow) {
    const images = contentToShow.querySelectorAll('img');
    if (!images) return;
    images.forEach(image => image.setAttribute('loading', 'eager'));
  }
  updateButtons(button) {
    this.selectedButton.parentElement.removeAttribute('active');
    button.parentElement.setAttribute('active', '');
    this.selectedButton.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-expanded', 'true');

    // Ensures the offscreen button becomes visible when clicked
    this.scrollTo({
      behavior: 'smooth',
      left: this.selectedButton.offsetLeft - this.clientWidth / 2 + this.selectedButton.clientWidth / 2
    });
  }
  async animateContent() {
    const options = {
      duration: 150 * window.LoessTheme.animations.multiplier,
      easing: 'ease-in-out'
    };
    await this.contentToHide.animate({
      opacity: [1, 0]
    }, options).finished;
    this.contentToHide.hidden = true;
    this.contentToShow.hidden = false;
    await this.contentToShow.animate({
      opacity: [0, 1]
    }, options).finished;
  }
});

window.customElements.define('loess-share-button', class extends Button {
  constructor() {
    var _this$collapsiblePane;
    super();
    this.collapsiblePanel = this.parentElement.nextElementSibling;
    this.copyOrShareButton = this.collapsiblePanel.querySelector('button');
    this.urlToShare = ((_this$collapsiblePane = this.collapsiblePanel.querySelector('input')) === null || _this$collapsiblePane === void 0 ? void 0 : _this$collapsiblePane.value) || document.location.href;
    this.copyOrShareButton.addEventListener('click', this.copyOrShare.bind(this));
  }
  copyOrShare() {
    if (navigator.share) {
      navigator.share({
        url: this.urlToShare,
        title: document.title
      });
    } else {
      this.copyToClipboard();
    }
  }
  async copyToClipboard() {
    await navigator.clipboard.writeText(this.urlToShare);
    alert(window.LoessTheme.strings.copiedToClipboard);
  }
}, {
  extends: 'button'
});

window.customElements.define('loess-shipping-country-selector', class extends HTMLSelectElement {
  constructor() {
    super();
    this.addEventListener('change', this.updateProvinceSelector.bind(this));
    this.setDefaultSelectOption(this);
    this.updateProvinceSelector();
  }
  setDefaultSelectOption(selector) {
    if (selector.getAttribute('data-default-option') != '') {
      for (let i = 0; i !== selector.options.length; ++i) {
        if (selector.options[i].text === selector.getAttribute('data-default-option')) {
          selector.selectedIndex = i;
          break;
        }
      }
    }
  }
  updateProvinceSelector() {
    const selectedOption = this.options[this.selectedIndex];
    const provinceElement = document.getElementById(this.getAttribute('aria-owns'));
    const provinceElementSelector = provinceElement.querySelector('select');
    const provinces = JSON.parse(selectedOption.getAttribute('data-provinces'));
    provinceElementSelector.innerHTML = '';
    if (provinces.length === 0) {
      provinceElement.classList.add('input-group--hidden');
      return;
    }
    provinces.forEach(data => {
      provinceElementSelector.options.add(new Option(data[1], data[0]));
    });
    provinceElement.classList.remove('input-group--hidden');
    this.setDefaultSelectOption(provinceElementSelector);
  }
}, {
  extends: 'select'
});

window.customElements.define('loess-sort-by', class extends HTMLSelectElement {
  constructor() {
    super();
    this.resizeElement();
    this.addEventListener('change', this.onChange.bind(this));
  }
  onChange(event) {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('sort_by', event.target.value);
    searchParams.delete('page');
    this.resizeElement();
    sendEvent(this, 'filters:changed', {
      searchParams: searchParams.toString()
    });
  }
  resizeElement() {
    const tempSelect = document.createElement('select');
    const tempOption = document.createElement('option');
    tempSelect.appendChild(tempOption);
    tempOption.innerHTML = this.options[this.selectedIndex].textContent;
    this.insertAdjacentElement('afterend', tempSelect);
    this.style.width = `${tempSelect.clientWidth}px`;
    tempSelect.remove();
  }
}, {
  extends: 'select'
});

customElements.define('loess-variant-picker', class extends HTMLElement {
  constructor() {
    super();
    this.options = [];
    this.addEventListener('change', this.onVariantChange.bind(this));
    this.checkForInstallmentsBanner();
  }
  onVariantChange(event) {
    this.eventTarget = event.target;
    this.getOptions();
    this.updateMasterId();
    if (!this.currentVariant) {
      this.toggleAddButton(true, '', true);
      this.setUnavailable();
    } else {
      this.renderProductInfo();
      this.updateUrl();
      this.updateFullDetailsLinkUrl();
      this.updateVariantInput();
      this.checkForInstallmentsBanner();
      this.dispatchEvent();
    }
  }
  getOptions() {
    this.options = Array.from(this.querySelectorAll('loess-variant-selects, loess-variant-radios')).map(input => input.getOptionValue());
  }
  updateMasterId() {
    this.currentVariant = this.getVariantData().find(variant => {
      return !variant.options.map((option, index) => {
        return this.options[index] === option;
      }).includes(false);
    });
  }
  updateUrl() {
    if (!this.currentVariant || this.shouldUpdateUrl === 'false') return;
    window.history.replaceState({}, '', `${this.productUrl}?variant=${this.currentVariant.id}`);
  }
  updateFullDetailsLinkUrl() {
    if (!this.currentVariant) return;
    const fullDetailsLink = document.querySelector(`#ProductFullDetailsLinks-${this.sectionId}`);
    if (fullDetailsLink) {
      fullDetailsLink.href = `${this.productUrl}?variant=${this.currentVariant.id}`;
    }
  }
  updateVariantInput() {
    const productForms = document.querySelectorAll(`#product-form-${this.sectionId}, #product-form-installment-${this.sectionId}`);
    productForms.forEach(productForm => {
      const input = productForm.querySelector('input[name="id"]');
      input.value = this.currentVariant.id;
    });
  }
  async renderProductInfo() {
    const response = await fetch(`${this.productUrl}?section_id=${this.sectionId}&variant=${this.currentVariant.id}`);
    const responseText = await response.text();
    const html = new DOMParser().parseFromString(responseText, 'text/html');
    this.rerenderBlocks(html);
    const price = document.getElementById(`ProductPrice-${this.sectionId}`);
    if (price) price.classList.remove('hidden');
    this.toggleAddButton(!this.currentVariant.available, window.LoessTheme.cartStrings.soldOut);
  }
  rerenderBlocks(html) {
    const blocks = ['ProductPrice', 'VariantPickers', 'Share', 'StockAvailability', 'PickupAvailability'];
    blocks.forEach(block => {
      const element = document.getElementById(`${block}-${this.sectionId}`);
      if (!element) return;
      element.innerHTML = html.getElementById(`${block}-${this.sectionId}`).innerHTML;
    });
  }
  getVariantData() {
    this.variantData = this.variantData || JSON.parse(document.querySelector(`#ProductVariantData-${this.sectionId}[type="application/json"]`).textContent);
    return this.variantData;
  }
  dispatchEvent() {
    sendEvent(this.eventTarget, 'product:variant:changed', {
      sectionId: this.sectionId,
      variant: this.currentVariant
    });
  }
  toggleAddButton(disable = true, text, modifyClass = true) {
    const productForm = document.getElementById(`product-form-${this.sectionId}`);
    if (!productForm) return;
    const addButton = productForm.querySelector('[name="add"]');
    const addButtonText = productForm.querySelector('[name="add"] > span');
    if (!addButton) return;
    if (disable) {
      addButton.setAttribute('disabled', 'disabled');
      if (text) addButtonText.textContent = text;
    } else {
      addButton.removeAttribute('disabled');
      addButtonText.textContent = window.LoessTheme.cartStrings.addToCart;
    }
    if (!modifyClass) return;
  }
  setUnavailable() {
    const button = document.getElementById(`product-form-${this.sectionId}`);
    const addButton = button.querySelector('[name="add"]');
    const addButtonText = button.querySelector('[name="add"] > span');
    const price = document.getElementById(`ProductPrice-${this.sectionId}`);
    if (!addButton) return;
    addButtonText.textContent = window.LoessTheme.cartStrings.unavailable;
    if (price) price.classList.add('hidden');
  }

  // Not sure why clicking on the installments banner closes the product modal.
  // This is here until we find a proper fix for that issue.
  async checkForInstallmentsBanner() {
    const modalProduct = this.closest('loess-modal-product');
    if (!modalProduct) return;
    await new Promise(r => setTimeout(r, 500));
    const paymentTerms = modalProduct.querySelector('shopify-payment-terms');
    if (!paymentTerms) return;
    paymentTerms.shadowRoot.querySelector('.shopify-installments').style.pointerEvents = 'none';
    paymentTerms.shadowRoot.querySelector('.shopify-installments__learn-more').style.pointerEvents = 'auto';
  }
  get sectionId() {
    return this.getAttribute('section-id');
  }
  get productUrl() {
    return this.getAttribute('product-url');
  }
  get shouldUpdateUrl() {
    return this.getAttribute('should-update-url');
  }
});
customElements.define('loess-variant-selects', class extends HTMLElement {
  getOptionValue() {
    return this.querySelector('select').value;
  }
});
customElements.define('loess-variant-radios', class extends HTMLElement {
  getOptionValue() {
    return Array.from(this.querySelectorAll('input')).find(radio => radio.checked).value;
  }
});

window.customElements.define('loess-cookie-banner', class extends HTMLElement {
  constructor() {
    super();
    this.declineButton = this.querySelector('button:first-of-type');
    this.acceptButton = this.querySelector('button:last-of-type');
  }
  connectedCallback() {
    if (Shopify.designMode) {
      document.addEventListener('shopify:section:select', event => {
        if (event.detail.sectionId !== this.sectionId) return;
        this.open = true;
      });
      document.addEventListener('shopify:section:deselect', event => {
        if (event.detail.sectionId !== this.sectionId) return;
        this.open = false;
      });
    }
    this.declineButton.addEventListener('click', this._handleDecline.bind(this));
    this.acceptButton.addEventListener('click', this._handleAccept.bind(this));
    window.Shopify.loadFeatures([{
      name: 'consent-tracking-api',
      version: '0.1',
      onLoad: this._initCookieBanner.bind(this)
    }]);
  }
  get sectionId() {
    return this.getAttribute('section-id');
  }
  set open(value) {
    this.toggleAttribute('hidden', !value);
  }
  _initCookieBanner() {
    if (!window.Shopify.customerPrivacy.shouldShowGDPRBanner()) return;
    this.open = true;
  }
  _handleAccept() {
    window.Shopify.customerPrivacy.setTrackingConsent(true, () => this.open = false);
  }
  _handleDecline() {
    window.Shopify.customerPrivacy.setTrackingConsent(false, () => this.open = false);
  }
});

function throttle(callback, wait, immediate = false) {
  let timeout = null;
  let initialCall = true;
  return function () {
    const callNow = immediate && initialCall;
    const next = () => {
      callback.apply(this, arguments);
      timeout = null;
    };
    if (callNow) {
      initialCall = false;
      next();
    }
    if (!timeout) {
      timeout = setTimeout(next, wait);
    }
  };
}

window.customElements.define('loess-header', class extends HTMLElement {
  connectedCallback() {
    this.resizeObserver = new ResizeObserver(this._updateHeightProperty.bind(this)).observe(this);
    if (this.transparent) {
      this.isTransparentLocked = false;
      document.addEventListener('expandable-html-element:open', this._lockTransparentState.bind(this));
      document.addEventListener('expandable-html-element:close', this._lockTransparentState.bind(this));
      this.addEventListener('mouseenter', this._toggleTransparency.bind(this), true);
      this.addEventListener('mouseleave', this._toggleTransparency.bind(this));
    }
    if (this.transparent && this.sticky) {
      this._onScroll = throttle(this._toggleTransparency.bind(this), 100);
      window.addEventListener('scroll', this._onScroll, {
        passive: true
      });
      this._toggleTransparency();
    }
  }
  disconnectedCallback() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.sticky && this.transparent) {
      window.removeEventListener('scroll', this._onScroll);
    }
  }
  get sticky() {
    return this.hasAttribute('sticky');
  }
  get transparent() {
    return this.hasAttribute('transparent');
  }
  _lockTransparentState(event) {
    // Only lock transparency if specific elements are invoked
    if (!['SideBarMenu', 'CartDrawer', 'HeaderSearch'].includes(event.target.id)) return;
    this.isTransparentLocked = event.type === 'expandable-html-element:open';
    this._toggleTransparency();
  }
  _toggleTransparency(event) {
    if (this.sticky && window.scrollY > 15 || event && event.type === 'mouseenter' || this.isTransparentLocked) {
      this.classList.remove('header--transparent');
    } else {
      this.classList.add('header--transparent');
    }
  }
  _updateHeightProperty(entries) {
    for (const entry of entries) {
      const height = entry.borderBoxSize && entry.borderBoxSize.length > 0 ? entry.borderBoxSize[0].blockSize : entry.target.clientHeight;
      document.documentElement.style.setProperty('--header-height', `${height}px`);
    }
  }
});

const LoessSlideshow = class extends HTMLElement {
  constructor() {
    super();
    this.texts = Array.from(this.querySelectorAll('loess-slideshow-text'));
    this.images = Array.from(this.querySelectorAll('loess-slideshow-image'));
    this.backgrounds = Array.from(this.closest('section').querySelectorAll('.hero-background'));
    this.dots = Array.from(this.querySelectorAll('.hero-controls, .hero-slider-buttons')).map(element => {
      return Array.from(element.querySelectorAll('.slider-dots > ol > li'));
    });
    if (this.autoPlay) {
      this.progressBars = Array.from(this.querySelectorAll('loess-slideshow-progress'));
    }
    this.previousSlideIndex = 0;
    this.currentSlideIndex = 0;
    this.isAnimating = false;
  }
  connectedCallback() {
    this.setupIntersectionObserver(this.play.bind(this));
    this.previousSlide = this.previousSlide.bind(this);
    this.nextSlide = this.nextSlide.bind(this);
    this.addEventListener('slideshow:previousButton:clicked', this.previousSlide);
    this.addEventListener('slideshow:nextButton:clicked', this.nextSlide);
    if (Shopify.designMode) {
      this.addEventListener('shopify:block:select', event => {
        this.pause();
        const index = Array.from(event.target.parentNode.children).indexOf(event.target) || 0;
        this.currentSlideIndex = index;
        this.changeSlide();
      });
    }
  }
  disconnectedCallback() {
    this.removeEventListener('slideshow:previousButton:clicked', this.previousSlide);
    this.removeEventListener('slideshow:nextButton:clicked', this.nextSlide);
  }
  previousSlide() {
    if (this.currentSlideIndex <= 0) {
      this.currentSlideIndex = this.images.length - 1;
    } else {
      this.currentSlideIndex--;
    }
    this.changeSlide();
  }
  nextSlide(event) {
    if (this.currentSlideIndex >= this.images.length - 1) {
      this.currentSlideIndex = 0;
    } else {
      this.currentSlideIndex++;
    }
    this.changeSlide(event);
  }
  changeSlide() {
    if (this.isAnimating) return;
    if (this.previousSlideIndex == this.currentSlideIndex) return;
    if (this.autoPlay) {
      this.progressBars.forEach(element => {
        element.reset();
      });
    }
    this.isAnimating = true;
    this.updateImage();
    this.updateText();
    this.updateBackground();
    this.updateDots();
    this.previousSlideIndex = this.currentSlideIndex;
  }
  async updateImage() {
    const previousImage = this.images[this.previousSlideIndex];
    const nextImage = this.images[this.currentSlideIndex];
    if (this.animationStyle == 'swipe') {
      await this.animateSwipe(previousImage, nextImage);
    } else {
      await this.animateFade(previousImage, nextImage);
    }
    if (this.autoPlay) {
      this.progressBars.forEach(element => {
        element.play();
      });
    }
    this.isAnimating = false;
  }
  async animateSwipe(previousImage, nextImage) {
    previousImage.setAttribute('hidden', '');
    nextImage.removeAttribute('hidden');
    await nextImage.animate({
      visibility: ['hidden', 'visible'],
      clipPath: ['inset(0 0 0 100%)', 'inset(0 0 0 0)']
    }, {
      duration: 200 * window.LoessTheme.animations.multiplier,
      easing: 'cubic-bezier(0.65, 0.05, 0.36, 1)'
    }).finished;
    previousImage.style.visibility = 'hidden';
    nextImage.style.visibility = 'visible';
  }
  async animateFade(previousImage, nextImage) {
    const options = {
      duration: 150 * window.LoessTheme.animations.multiplier,
      easing: 'ease-in-out'
    };
    if (this.type == 'image-background') {
      await previousImage.animate({
        opacity: [1, 0]
      }, options);
    } else {
      await previousImage.animate({
        opacity: [1, 0]
      }, options).finished;
    }
    previousImage.style.visibility = 'hidden';
    nextImage.style.visibility = 'visible';
    await nextImage.animate({
      opacity: [0, 1]
    }, options).finished;
  }
  async updateText() {
    if (this.texts.length === 1) return;
    const previousText = this.texts[this.previousSlideIndex];
    const nextText = this.texts[this.currentSlideIndex];
    const previousTextChunks = previousText.querySelectorAll('.rich-text > *:not(.hero-slider-buttons)');
    const nextTextChunks = nextText.querySelectorAll('.rich-text > *:not(.hero-slider-buttons)');
    previousTextChunks.forEach(async text => {
      await text.animate({
        opacity: [1, 0]
      }, {
        duration: 50 * window.LoessTheme.animations.multiplier,
        easing: 'ease-in-out'
      }).finished;
    });
    previousText.hidden = true;
    if (this.type == 'image-background') {
      await new Promise(r => setTimeout(r, 250 * window.LoessTheme.animations.multiplier));
    }
    nextText.hidden = false;
    nextTextChunks.forEach(async text => {
      await text.animate({
        opacity: [0, 1]
      }, {
        duration: 150 * window.LoessTheme.animations.multiplier,
        easing: 'ease-in-out'
      }).finished;
    });
  }
  async updateBackground() {
    if (this.backgrounds.length <= 1) return;
    const previousBackground = this.backgrounds[this.previousSlideIndex];
    const nextBackground = this.backgrounds[this.currentSlideIndex];
    nextBackground.classList.remove('hero-background--hidden');
    await nextBackground.animate({
      opacity: [0, 1]
    }, {
      duration: 100 * window.LoessTheme.animations.multiplier,
      easing: 'ease-in-out'
    }).finished;
    previousBackground.classList.add('hero-background--hidden');
  }
  updateDots() {
    this.dots.forEach(dot => {
      const previousDot = dot[this.previousSlideIndex];
      const nextDot = dot[this.currentSlideIndex];
      previousDot.removeAttribute('active');
      nextDot.setAttribute('active', '');
    });
  }
  pause() {
    this.style.setProperty('--auto-play-state', 'paused');
  }
  play() {
    if (!this.autoPlay) return;
    this.style.setProperty('--auto-play-state', 'running');
  }
  get autoPlay() {
    return this.hasAttribute('auto-play');
  }
  get type() {
    return this.getAttribute('type');
  }
  get animationStyle() {
    return this.getAttribute('animation-style');
  }
};
Object.assign(LoessSlideshow.prototype, IntersectionObserverMixin);
window.customElements.define('loess-slideshow', LoessSlideshow);
window.customElements.define('loess-slideshow-buttons', class extends HTMLElement {
  constructor() {
    super();
    this.previousButton = this.querySelector('button:first-of-type');
    this.nextButton = this.querySelector('button:last-of-type');
    this.previousButton.addEventListener('click', () => {
      sendEvent(this.previousButton, 'slideshow:previousButton:clicked');
    });
    this.nextButton.addEventListener('click', () => {
      sendEvent(this.nextButton, 'slideshow:nextButton:clicked');
    });
  }
});
window.customElements.define('loess-slideshow-progress', class extends HTMLElement {
  constructor() {
    super();
    this.circle = this.querySelector('circle:first-child');
    this.circle.addEventListener('animationend', event => {
      sendEvent(event.target, 'slideshow:nextButton:clicked');
    });
  }
  reset() {
    this.circle.classList.remove('slider-progress-bar__circle--animation');
  }
  play() {
    this.circle.classList.add('slider-progress-bar__circle--animation');
  }
});

window.customElements.define('loess-product', class extends HTMLElement {
  async connectedCallback() {
    await window.customElements.whenDefined('loess-product-gallery');
    await window.customElements.whenDefined('loess-scroller-dots');
    this.gallery = this.querySelector('loess-product-gallery');
    this.thumbnails = this.parentElement.querySelector('.main-product-media__thumbnails');
    if (!this.thumbnails) return;
    this.slideIndex = this.gallery.getActiveSlideIndex();
    this.addEventListener('product:thumbnail:clicked', this.onClickThumbnail);
    this.addEventListener('scroller:previousButton:clicked', this.onClickPreviousButton);
    this.addEventListener('scroller:nextButton:clicked', this.onClickNextButton);
    this.addEventListener('product:variant:changed', this.onVariantChange);
  }
  onClickPreviousButton(event) {
    event.stopPropagation();
    this.slideIndex = this.slideIndex - 1;
    this.gallery.previousSlide(event, this.gallery.children[this.slideIndex]);
  }
  onClickNextButton(event) {
    event.stopPropagation();
    this.slideIndex = this.slideIndex + 1;
    this.gallery.nextSlide(event, this.gallery.children[this.slideIndex]);
  }
  onClickThumbnail(event) {
    event.stopPropagation();
    this.gallery.changeSlide(event.target);
  }
  onVariantChange(event) {
    event.stopPropagation();
    this.resetErrorMessage();
    const currentVariant = event.detail.variant;
    if (!currentVariant) return;
    if (!currentVariant.featured_media) return;
    const mediaId = `ProductMedia-${event.detail.sectionId}-${currentVariant.featured_media.id}`;
    this.gallery.changeSlide(document.getElementById(mediaId));
    const thumbnail = this.thumbnails.querySelector(`[aria-controls=${mediaId}]`);
    this.thumbnails.updateThumbnailState(thumbnail);
  }
  resetErrorMessage() {
    this.errorMessageWrapper = this.errorMessageWrapper || this.querySelector('.form-message[role="alert"]');
    this.errorMessageWrapper.classList.add('hidden');
  }
});
const LoessProductGallery = class extends HTMLElement {
  constructor() {
    super();
    this.product = this.closest('loess-product');
    this.items = Array.from(this.children);
    if (this.items.length <= 1) return;
    this.dots = Array.from(this.parentElement.querySelector('.slider-dots > ol').children);
    this.height = this.offsetHeight;
    this.transitioning = false;

    // If variant present, change slide so that it's showing its image
    this.changeSlide(this.querySelector('[active]'), false);
    if (this.parentHasSticky) {
      this.setupStickyScroll(this.parentElement);
    }
    this.checkFor3dModel();
  }
  async connectedCallback() {
    this.resizeObserver = new ResizeObserver(() => {
      this.setContainerHeight(this.querySelector('[active]'), false);
    }).observe(this);
    if (this.imageZoomEnabled) {
      this.addEventListener('click', () => {
        if (this.querySelector('[active]').getAttribute('media-type') != 'image') return;
        this.zoomButton = this.parentElement.querySelector('.main-product__media-zoom-button');
        this.zoomButton.click();
      });
    }
  }
  disconnectedCallback() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.parentHasSticky) {
      this.destroyStickyScroll(this.parentElement);
    }
  }
  previousSlide(event, target) {
    event.target.nextElementSibling.removeAttribute('disabled');
    event.target.toggleAttribute('disabled', target == this.firstElementChild);
    this.changeSlide(target);
  }
  nextSlide(event, target) {
    event.target.previousElementSibling.removeAttribute('disabled');
    event.target.toggleAttribute('disabled', target == this.lastElementChild);
    this.changeSlide(target);
  }
  async changeSlide(target, animate = true) {
    let slide;
    if (target == null) return;
    if (target.hasAttribute('aria-controls')) {
      slide = this.querySelector(`#${target.getAttribute('aria-controls')}`);
    } else {
      slide = target;
    }
    this.pauseAllMedia();
    this.checkForSlideType(slide);
    this.scrollTo({
      behavior: animate ? 'smooth' : 'instant',
      left: slide.offsetLeft
    });
    if (this.dots) this.setActiveDot(slide);
    this.setActiveSlide(slide);
    await this.waitForScrollEnd();
    this.setContainerHeight(slide, animate);
    this.currentSlide = this.querySelector('[active]');
    if (this.imageZoomEnabled) {
      this.toggleImageZoomVisibility();
    }
  }
  toggleImageZoomVisibility() {
    const isImageMediaType = this.querySelector('[active]').getAttribute('media-type') == 'image';
    this.parentElement.querySelector('.main-product__media-zoom-button').classList.toggle('hide', !isImageMediaType);
  }
  pauseAllMedia() {
    this.querySelectorAll('video').forEach(video => video.pause());
    this.querySelectorAll('loess-3d-model').forEach(model => {
      if (model.modelViewerUI) model.modelViewerUI.pause();
    });
    this.querySelectorAll('loess-video').forEach(video => {
      if (video.getAttribute('type') == 'native') return;
      if (video.getAttribute('type') === 'youtube') {
        var _video$querySelector;
        (_video$querySelector = video.querySelector('iframe')) === null || _video$querySelector === void 0 ? void 0 : _video$querySelector.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: 'pauseVideo',
          args: ''
        }), '*');
      } else {
        var _video$querySelector2;
        (_video$querySelector2 = video.querySelector('iframe')) === null || _video$querySelector2 === void 0 ? void 0 : _video$querySelector2.contentWindow.postMessage(JSON.stringify({
          method: 'pause'
        }), '*');
      }
    });
  }
  checkFor3dModel() {
    const mediaWrapper = document.querySelector('loess-3d-model');
    if (!mediaWrapper) return;
    this.initialModel3dId = mediaWrapper.getAttribute('model-id');
  }
  checkForSlideType(slide) {
    const slideType = slide.firstElementChild;
    const slideTagName = slideType.tagName;
    if (slideTagName == 'LOESS-3D-MODEL') {
      slideType.play();
    } else if (slideTagName == 'LOESS-VIDEO') {
      if (slideType.getAttribute('type') == 'native') {
        slideType.querySelector('video').play();
      } else {
        slideType.play();
      }
    }
    this.updateViewButtonModelId(slideType);
  }
  updateViewButtonModelId(slideType) {
    var _mediaWrapper$querySe;
    const mediaWrapper = this.closest('.main-product__media-gallery-wrapper');
    (_mediaWrapper$querySe = mediaWrapper.querySelector('.product__xr-button')) === null || _mediaWrapper$querySe === void 0 ? void 0 : _mediaWrapper$querySe.setAttribute('data-shopify-model3d-id', slideType.getAttribute('model-id') || this.initialModel3dId);
  }
  async setContainerHeight(slide, animate) {
    const keyframes = {
      height: [`${this.height}px`, `${slide === null || slide === void 0 ? void 0 : slide.offsetHeight}px`]
    };
    await this.animate(keyframes, {
      duration: animate ? 150 * window.LoessTheme.animations.multiplier : 0,
      easing: 'cubic-bezier(0.5, 0, 0.175, 1)'
    }).finished;
    this.height = slide === null || slide === void 0 ? void 0 : slide.offsetHeight;
    this.style.height = `${this.height}px`;
    this.style.paddingBottom = '0px';
  }
  setActiveSlide(slide) {
    this.items.map(item => item.removeAttribute('active'));
    slide.setAttribute('active', '');
  }
  setActiveDot(slide) {
    this.dots.map(dot => dot.removeAttribute('active'));
    const index = [...slide.parentElement.children].indexOf(slide);
    this.dots[index].setAttribute('active', '');
  }
  waitForScrollEnd() {
    let last_changed_frame = 0;
    let last_x = this.scrollLeft;
    return new Promise(resolve => {
      const tick = frames => {
        // We requestAnimationFrame either for 500 frames or until 20 frames with
        // no change have been observed.
        if (frames >= 500 || frames - last_changed_frame > 20) {
          resolve();
        } else {
          if (this.scrollLeft != last_x) {
            last_changed_frame = frames;
            last_x = this.scrollLeft;
          }
          requestAnimationFrame(tick.bind(null, frames + 1));
        }
      };
      tick(0);
    });
  }
  getActiveSlideIndex() {
    const activeSlide = this.querySelector('[active]');
    return [...activeSlide.parentElement.children].indexOf(activeSlide);
  }
  get imageZoomEnabled() {
    return this.getAttribute('image-zoom') === 'true';
  }
  get parentHasSticky() {
    return this.parentElement.hasAttribute('sticky');
  }
};
Object.assign(LoessProductGallery.prototype, StickyScrollMixin);
window.customElements.define('loess-product-gallery', LoessProductGallery);
window.customElements.define('loess-product-thumbnails', class extends HTMLUListElement {
  constructor() {
    super();
    this.buttons = Array.from(this.children).map(child => {
      return child.querySelector('button');
    });
    this.buttons.forEach(button => {
      button.addEventListener('click', this.onClickButton.bind(this));
    });
    this.positionActiveThumbnail(this.buttons[0], false);
  }
  onClickButton(event) {
    this.updateThumbnailState(event.currentTarget);
    sendEvent(event.currentTarget, 'product:thumbnail:clicked');
  }
  updateThumbnailState(element) {
    this.resetAriaCurrent(element);
    this.positionActiveThumbnail(element, true);
  }
  resetAriaCurrent(target) {
    this.buttons.map(button => button.removeAttribute('aria-current'));
    target.setAttribute('aria-current', 'true');
  }
  positionActiveThumbnail(target, animate = true) {
    this.scrollTo({
      behavior: animate ? 'smooth' : 'instant',
      top: target.offsetTop - this.clientHeight / 2 + target.clientHeight / 2,
      left: target.offsetLeft - this.clientWidth / 2 + target.clientWidth / 2
    });
  }
}, {
  extends: 'ul'
});

window.customElements.define('loess-popup', class extends ExpandableHTMLElement {
  constructor() {
    super();
    if (window.location.pathname === '/challenge') return;

    // If in the theme editor, let the lifecycle callbacks show/hide the popup
    if (Shopify.designMode || this._getWithExpiry('loess:theme:popup')) return;
    setTimeout(() => {
      this.open = true;
      this._setWithExpiry('loess:theme:popup', this.daysInSeconds);
    }, this.delayVisibility * 1000);
  }
  connectedCallback() {
    this.toggleVisibility = this._toggleVisibility.bind(this);
    if (Shopify.designMode) {
      document.addEventListener('shopify:section:select', this.toggleVisibility);
      document.addEventListener('shopify:section:deselect', this.toggleVisibility);
    }
  }
  disconnectedCallback() {
    if (Shopify.designMode) {
      document.removeEventListener('shopify:section:select', this.toggleVisibility);
      document.removeEventListener('shopify:section:deselect', this.toggleVisibility);
    }
  }
  _setWithExpiry(key, expiration) {
    const item = {
      expiry: new Date().getTime() + expiration
    };
    localStorage.setItem(key, JSON.stringify(item));
  }
  _getWithExpiry(key) {
    const storedItem = localStorage.getItem(key);
    if (!storedItem) return null;
    const item = JSON.parse(storedItem);

    // Compare the expiry time of the item with the current time
    // If expired, delete item from storage
    if (new Date().getTime() > item.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return true;
  }
  _toggleVisibility(event) {
    if (event.detail.sectionId !== this.sectionId) return;
    if (event.type === 'shopify:section:select') {
      this.open = true;
    } else {
      this.open = false;
    }
  }
  get daysInSeconds() {
    return this.dayFrequency * 86400000;
  }
  get sectionId() {
    return this.getAttribute('section-id');
  }
  get dayFrequency() {
    return this.getAttribute('day-frequency');
  }
  get delayVisibility() {
    return this.getAttribute('delay-visibility');
  }
});

window.customElements.define('loess-product-recommendations', class extends HTMLElement {
  constructor() {
    super();
    this.isLoaded = false;
  }
  connectedCallback() {
    this.initProductRecommendations();
  }
  async initProductRecommendations() {
    if (this.loaded) return;
    this.loaded = true;
    const section = this.closest('.shopify-section');
    const intent = this.getAttribute('intent') || 'related';
    const url = `${Shopify.routes.root}recommendations/products?product_id=${this.getAttribute('product-id')}&limit=${this.getAttribute('limit') || 4}&section_id=${section.id.replace('shopify-section-', '')}&intent=${intent}`;
    const response = await fetch(url, {
      priority: 'low'
    });
    const tempDiv = new DOMParser().parseFromString(await response.text(), 'text/html');
    const productRecommendationsSelector = tempDiv.querySelector('loess-product-recommendations');
    if (productRecommendationsSelector.childElementCount > 0) {
      this.replaceChildren(...document.importNode(productRecommendationsSelector, true).childNodes);
    } else {
      if (intent === 'related') {
        section.remove();
      } else {
        this.remove();
      }
    }
  }
});

customElements.define('loess-recently-viewed-products', class extends HTMLElement {
  constructor() {
    super();
    this.loaded = false;
    if (!Shopify.designMode) {
      this.collapsiblePanel = this.querySelector('loess-collapsible-panel');
      this.button = this.querySelector('button[is="loess-button"]');
      if (this.button) {
        this.setAttributesBasedOnLocalStorage();
      }
    }
  }
  connectedCallback() {
    if (Shopify.designMode) return;
    this.handleState = this._handleState.bind(this);
    document.addEventListener('expandable-html-element:open', this.handleState);
    document.addEventListener('expandable-html-element:close', this.handleState);
    if ('requestIdleCallback' in window) {
      requestIdleCallback(this._getProductIdSet.bind(this), {
        timeout: 2000
      });
    } else {
      this._getProductIdSet();
    }
  }
  disconnectedCallback() {
    document.removeEventListener('expandable-html-element:open', this.handleState);
    document.removeEventListener('expandable-html-element:close', this.handleState);
  }
  async _getProductIdSet() {
    if (this.loaded) return;
    this.loaded = true;
    const response = await fetch(`${this.fetchUrl}&q=${this.buildQueryString()}`);
    const div = document.createElement('div');
    div.innerHTML = await response.text();
    const recentlyViewedProductsElement = div.querySelector('loess-recently-viewed-products');
    if (recentlyViewedProductsElement.hasChildNodes()) {
      this.innerHTML = recentlyViewedProductsElement.innerHTML;
    }

    // Only able to clear history outside of the theme editor
    if (!Shopify.designMode) {
      this.setupClearHistoryButton();
    }
  }
  _handleState(event) {
    event.stopPropagation();
    if (event.target != this.querySelector('loess-collapsible-panel')) return;
    if (event.type == 'expandable-html-element:open') {
      this.setLocalStorageToggle('open');
    } else {
      this.setLocalStorageToggle('');
    }
  }
  setLocalStorageToggle(status) {
    localStorage.setItem('loess:recent-products:toggle', status);
  }
  getLocalStorageToggle() {
    return localStorage.getItem('loess:recent-products:toggle');
  }
  setAttributesBasedOnLocalStorage() {
    const status = localStorage.getItem('loess:recent-products:toggle');
    if (status === 'open') {
      this.button.setAttribute('aria-expanded', 'true');
      this.collapsiblePanel.setAttribute('open', '');
    } else {
      this.button.setAttribute('aria-expanded', 'false');
      this.collapsiblePanel.removeAttribute('open');
    }
  }
  buildQueryString() {
    const items = JSON.parse(localStorage.getItem('loess:recently-viewed-products') || '[]');
    if (this.hasAttribute('excluded-product-id') && items.includes(parseInt(this.getAttribute('excluded-product-id')))) {
      items.splice(items.indexOf(parseInt(this.getAttribute('excluded-product-id'))), 1);
    }
    return items.map(item => 'id:' + item).slice(0, 20).join(' OR ');
  }
  setupClearHistoryButton() {
    const clearHistoryButton = this.querySelector('button[clear-history]');
    if (!clearHistoryButton) return;
    clearHistoryButton.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear your recently viewed products?')) {
        this.style.display = 'none';
        localStorage.removeItem('loess:recent-products');
      }
    });
  }
  get fetchUrl() {
    return this.getAttribute('fetch-url');
  }
});

const moneyFormat = '${{amount}}';
function formatMoney(cents, format) {
  if (typeof cents === 'string') {
    cents = cents.replace('.', '');
  }
  let value = '';
  const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
  const formatString = format || moneyFormat;
  function formatWithDelimiters(number, precision = 2, thousands = ',', decimal = '.') {
    if (isNaN(number) || number == null) {
      return 0;
    }
    number = (number / 100.0).toFixed(precision);
    const parts = number.split('.');
    const dollarsAmount = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, `$1${thousands}`);
    const centsAmount = parts[1] ? decimal + parts[1] : '';
    return dollarsAmount + centsAmount;
  }
  switch (formatString.match(placeholderRegex)[1]) {
    case 'amount':
      value = formatWithDelimiters(cents, 2);
      break;
    case 'amount_no_decimals':
      value = formatWithDelimiters(cents, 0);
      break;
    case 'amount_with_comma_separator':
      value = formatWithDelimiters(cents, 2, '.', ',');
      break;
    case 'amount_no_decimals_with_comma_separator':
      value = formatWithDelimiters(cents, 0, '.', ',');
      break;
  }
  return formatString.replace(placeholderRegex, value);
}

window.customElements.define('loess-shipping-calculator', class extends HTMLElement {
  constructor() {
    super();
    this.button = this.querySelector('button[type="button"]');
    this.button.addEventListener('click', this.calculate.bind(this));
  }
  async calculate() {
    const spinner = this.parentElement.querySelector('.shipping-rates__spinner');
    const results = this.parentElement.querySelector('.shipping-rates__results');
    this.button.setAttribute('disabled', '');
    spinner.classList.remove('hide');
    results === null || results === void 0 ? void 0 : results.remove();
    this.country = this.querySelector('[name="shipping-rates[country]"]').value;
    this.province = this.querySelector('[name="shipping-rates[province]"]').value;
    this.zip = this.querySelector('[name="shipping-rates[zip]"]').value;
    const response = await fetch(`${window.LoessTheme.routes.cart_url}/prepare_shipping_rates.json?shipping_address[country]=${this.country}&shipping_address[province]=${this.province}&shipping_address[zip]=${this.zip}`, {
      method: 'POST'
    });
    if (response.ok) {
      const shippingRates = await this.getShippingRates();
      this.injectShippingRates(shippingRates);
    } else {
      const jsonError = await response.json();
      this.injectErrors(jsonError);
    }
    spinner.classList.add('hide');
    this.button.removeAttribute('disabled');
  }
  async getShippingRates() {
    const response = await fetch(`${window.LoessTheme.routes.cart_url}/async_shipping_rates.json?shipping_address[country]=${this.country}&shipping_address[province]=${this.province}&shipping_address[zip]=${this.zip}`);
    const responseText = await response.text();
    if (responseText === 'null') {
      return this.getShippingRates();
    } else {
      return JSON.parse(responseText)['shipping_rates'];
    }
  }
  injectShippingRates(shippingRates) {
    let shippingRatesList = '';
    shippingRates.forEach(shippingRate => {
      shippingRatesList += `<li>${shippingRate['presentment_name']}: ${formatMoney(parseFloat(shippingRate['price']) * 100)}</li>`;
    });
    const html = `
      <div class="shipping-rates__results">
        <span>${shippingRates.length === 0 ? window.LoessTheme.strings.shippingCalculatorNoResults : shippingRates.length === 1 ? window.LoessTheme.strings.shippingCalculatorOneResult : window.LoessTheme.strings.shippingCalculatorMultipleResults}</span>
        ${shippingRatesList === '' ? '' : `<ul class="shipping-rates__list caption">${shippingRatesList}</ul>`}
      </div>
    `;
    this.insertAdjacentHTML('afterend', html);
  }
  injectErrors(errors) {
    let shippingRatesList = '';
    Object.keys(errors).forEach(errorKey => {
      shippingRatesList += `<li>${errorKey} ${errors[errorKey]}</li>`;
    });
    const html = `
      <div class="shipping-rates__results">
        <span>${window.LoessTheme.strings.shippingCalculatorError}</span>
        <ul class="shipping-rates__list caption">${shippingRatesList}</ul>
      </div>
    `;
    this.insertAdjacentHTML('afterend', html);
  }
});

const LoessVideo = class extends HTMLElement {
  constructor() {
    super();
    this.loaded = false;
  }
  connectedCallback() {
    this.setupIntersectionObserver(async () => {
      this.play();
      if (this.parallax) {
        await loadScript('https://cdn.jsdelivr.net/npm/simple-parallax-js@5.6.1/dist/simpleParallax.min.js');
        await this.setupSimpleParallax();
      }
    });

    // We don't want the background video playing at the same time
    // as the modal's, so pause/play depending on modal state
    this.handleState = this._handleState.bind(this);
    document.addEventListener('expandable-html-element:open', this.handleState);
    document.addEventListener('expandable-html-element:close', this.handleState);
  }
  disconnectedCallback() {
    document.removeEventListener('expandable-html-element:open', this.handleState);
    document.removeEventListener('expandable-html-element:close', this.handleState);
  }
  setupSimpleParallax() {
    return new Promise(resolve => {
      resolve(new simpleParallax(this, {
        orientation: 'down',
        scale: 1.7,
        customWrapper: '[parallax]'
      }));
    });
  }
  _handleState(event) {
    event.stopPropagation();
    if (event.target.tagName.toLowerCase() !== 'loess-modal-video') return;
    if (event.type == 'expandable-html-element:open') {
      this.pause();
    } else {
      this.play();
    }
  }
  load() {
    return new Promise(resolve => {
      const template = this.querySelector('template');
      const node = template.content.firstElementChild.cloneNode(true);
      node.addEventListener('load', () => {
        this.loaded = true;
        resolve();
      });
      template.replaceWith(node);
    });
  }
  async play() {
    if (!this.loaded) await this.load();
    const coverImage = this.querySelector(':not(iframe)') || this.nextElementSibling;
    if (coverImage) coverImage.style.display = 'none';
    if (this.type === 'youtube') {
      this.querySelector('iframe').contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: 'playVideo',
        args: ''
      }), '*');
    } else if (this.type === 'vimeo') {
      this.querySelector('iframe').contentWindow.postMessage(JSON.stringify({
        method: 'play'
      }), '*');
    }
  }
  pause() {
    if (!this.loaded) return;
    if (this.type === 'youtube') {
      this.querySelector('iframe').contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: 'pauseVideo',
        args: ''
      }), '*');
    } else if (this.type === 'vimeo') {
      this.querySelector('iframe').contentWindow.postMessage(JSON.stringify({
        method: 'pause'
      }), '*');
    }
  }
  get type() {
    return this.getAttribute('type');
  }
  get parallax() {
    return this.parentElement.getAttribute('parallax') === 'true';
  }
};
Object.assign(LoessVideo.prototype, IntersectionObserverMixin);
window.customElements.define('loess-video', LoessVideo);
