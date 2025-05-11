let STOREFRONT_ACCESSTOKEN = 'ad3e1d2c04415ce864de0805c054a557';
let GRAPHQL_API = '/api/2023-01/graphql.json';
let CART_API = '/cart.js';
let PRODUCT_FIELDS = '' + 'id\n' + 'title\n' + 'handle\n' + 'featuredImage { url altText }\n' + 'variants(first: 1) { edges { node { id availableForSale price { amount } } } }';

function showCrossSellSpinner() 
{
  let spinner   = document.getElementById('cross-sell-spinner');
  let container = document.getElementById('cross-sell-container');
  if (!spinner || !container) return;

  if (shouldShowSpinner) {              
    spinner.style.display   = 'flex';
    container.style.display = 'none';
  } else {                              
    spinner.style.display   = 'none';
    container.style.display = '';
  }
}

function fetchFillers(limit, callback)
{
  let query = '{ products(first: ' + limit + ', sortKey: BEST_SELLING) { edges { node { ' + PRODUCT_FIELDS + ' } } } }';
  fetch(GRAPHQL_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESSTOKEN
    },
    body: JSON.stringify({ query: query })
  })
  .then(function(response)
  {
    return response.json();
  })
  .then(function(json)
  {
    let edges = (json && json.data && json.data.products) ? json.data.products.edges : [];
    let productList = [];
    for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++)
    {
      productList.push(edges[edgeIndex].node);
    }
    callback(productList);
  })
  .catch(function()
  {
    callback([]);
  });
}

// navigation
function initCrossSellNavigation(scrollContainer, cardCount)
{
  let previousButton = document.getElementById('cross-sell-prev');
  let nextButton = document.getElementById('cross-sell-next');

  if (!previousButton || !nextButton || cardCount === 0)
  {
    return;
  }

  previousButton.onclick = function()
  {
    scrollContainer.scrollBy({ left: -scrollContainer.offsetWidth, behavior: 'smooth' });
  };

  nextButton.onclick = function()
  {
    scrollContainer.scrollBy({ left: scrollContainer.offsetWidth, behavior: 'smooth' });
  };
}

function processCart(cart)
{
  let cartItems = cart.items || [];
  if (cartItems.length === 0)
  {
    return;
  }

  let cartProductGids = [];
  for (let itemIndex = 0; itemIndex < cartItems.length; itemIndex++)
  {
    cartProductGids.push('gid://shopify/Product/' + cartItems[itemIndex].product_id);
  }

  let aliasQueries = [];
  for (let aliasIndex = 0; aliasIndex < cartProductGids.length; aliasIndex++)
  {
    aliasQueries.push('p' + aliasIndex + ': productRecommendations(productId: "' + cartProductGids[aliasIndex] + '") { ' + PRODUCT_FIELDS + ' }');
  }

  let recommendationQuery = '{\n' + aliasQueries.join('\n') + '\n}';

  fetch(GRAPHQL_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESSTOKEN
    },
    body: JSON.stringify({ query: recommendationQuery })
  })
  .then(function(response)
  {
    return response.json();
  })
  .then(function(json)
  {
    if (!json || !json.data)
    {
      return;
    }

    let recommendationMap = {};
    Object.keys(json.data).forEach(function(aliasKey)
    {
      let productArray = json.data[aliasKey] || [];
      for (let productIndex = 0; productIndex < productArray.length; productIndex++)
      {
        let product = productArray[productIndex];
        if (cartProductGids.indexOf(product.id) === -1)
        {
          recommendationMap[product.id] = product;
        }
      }
    });

    let recommendations = Object.values(recommendationMap);

    let outerContainer  = document.getElementById('cross-sell-container');
    let scrollContainer = document.getElementById('cross-sell-scroll');
    if (!outerContainer || !scrollContainer)
    {
      return;
    }

    let maxProducts = parseInt(outerContainer.dataset.maxProducts, 10) || 4;

    function finaliseList(productList)
    {
      renderCrossSellCards(scrollContainer, productList, maxProducts);
      initCrossSellNavigation(scrollContainer, productList.length);

      let container = document.getElementById('cross-sell-container');
      if (container) container.style.display = '';
    
      let spinner = document.getElementById('cross-sell-spinner');
      if (spinner)  spinner.style.display = 'none';

      let wrapper = document.getElementById('cross-sell-wrapper');
      if (wrapper) wrapper.classList.remove('cross-sell-loading');
    }

    if (recommendations.length < maxProducts)
    {
      let shortfall = maxProducts - recommendations.length;
      fetchFillers(shortfall * 2, function(fillerProducts)
      {
        let excludeMap = {};
        recommendations.forEach(function(rec)
        {
          excludeMap[rec.id] = true;
        });
        cartProductGids.forEach(function(gid)
        {
          excludeMap[gid] = true;
        });

        let additionalProducts = [];
        for (let fillerIndex = 0; fillerIndex < fillerProducts.length && additionalProducts.length < shortfall; fillerIndex++)
        {
          let fillerProduct = fillerProducts[fillerIndex];
          if (!excludeMap[fillerProduct.id])
          {
            additionalProducts.push(fillerProduct);
          }
        }
        finaliseList(recommendations.concat(additionalProducts));
      });
    }
    else
    {
      finaliseList(recommendations);
    }
  })
  .catch(function() {});
}

function renderCrossSellCards(container, productList, maxProducts)
{
  container.innerHTML = '';
  for (let cardIndex = 0; cardIndex < productList.length && cardIndex < maxProducts; cardIndex++)
  {
    let product      = productList[cardIndex];
    if (!product.variants.edges || product.variants.edges.length === 0)
    {
      continue;
    }
    let variantNode  = product.variants.edges[0].node;
    let variantId    = variantNode.id;

    let cardElement = document.createElement('div');
    cardElement.className = 'cross-sell-card';
    cardElement.innerHTML =
      '<a href="/products/' + product.handle + '" style="text-decoration:none;color:inherit;">'
      + '<img src="' + product.featuredImage.url + '" alt="' + (product.featuredImage.altText || product.title) + '" style="width:100%;height:120px;object-fit:cover;display:block;">'
      + '<div style="display: flex;justify-content: space-between;">'
      + '<h3 style="font-size:1.4rem;margin:0.5rem 0;">' + product.title + '</h3>'
      + '<p style="margin:0;">$' + variantNode.price.amount + '</p>'
      + '</div>'
      + '</a>';

    let addToCartButton = document.createElement('button');
    addToCartButton.className = 'button add-to-cart-button';
    addToCartButton.textContent = '+ Add';
    addToCartButton.style.marginTop = '0.5rem';
    addToCartButton.dataset.variantId = variantId;
    addToCartButton.onclick = function()
    {
      addToCartToShopifyCart(this.dataset.variantId);
    };

    cardElement.appendChild(addToCartButton);
    container.appendChild(cardElement);
  }
}
let drawerActionPending = false;

document.addEventListener('click', (e) => {
  if (e.target.closest('.add-to-cart-button, cart-remove-button')) 
    {
      drawerActionPending = true;   
      shouldShowSpinner = false;    
      showCrossSellSpinner();          
    }
});

function loadCrossSell(cartParameter)
{
  if (cartParameter)
  {
    processCart(cartParameter);
  }
  else
  {
    fetch(CART_API)
      .then(function(response)
      {
        return response.json();
      })
      .then(processCart)
      .catch(function(error)
      {
        console.error('[loadCrossSell] error:', error);
      });
  }
}

document.addEventListener('DOMContentLoaded', function()
{
  shouldShowSpinner = false;
  loadCrossSell();
});

document.addEventListener('cart-ready', function(event)
{
  if (event.detail && event.detail.cart)
  {
    loadCrossSell(event.detail.cart);
  }
  else
  {
    loadCrossSell();
  }
});

try {
  subscribe(PUB_SUB_EVENTS.cartUpdate, ({ source, cartData }) => {
    if (drawerActionPending) {
      drawerActionPending = false;
      shouldShowSpinner   = false;
    } else {
      shouldShowSpinner   = source === 'product-form';   // :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}
    }

    showCrossSellSpinner();
    loadCrossSell(cartData);
  });
}
catch (error) {}

function ensureShopifyCartId(callback)
{
  let storageKey = 'sf_cart_id';
  let storedGid  = sessionStorage.getItem(storageKey);
  if (storedGid)
  {
    callback(storedGid);
    return;
  }
  fetch(CART_API)
    .then(function(response)
    {
      return response.json();
    })
    .then(function(cartData)
    {
      let newCartGid = 'gid://shopify/Cart/' + cartData.token;
      sessionStorage.setItem(storageKey, newCartGid);
      callback(newCartGid);
    })
    .catch(function() {});
}

function addToCartToShopifyCart(variantGid)
{
  drawerActionPending = true;           
  shouldShowSpinner   = false;
  ensureShopifyCartId(function(cartId)
  {
    let mutation = ''
      + 'mutation cartLinesAdd($cartId:ID!,$lines:[CartLineInput!]!){'
      + 'cartLinesAdd(cartId:$cartId,lines:$lines){'
      + 'cart { id totalQuantity }'
      + 'userErrors { field message }'
      + '}'
      + '}';

    let variables = {
      cartId: cartId,
      lines: [
        {
          merchandiseId: variantGid,
          quantity: 1
        }
      ]
    };

    fetch(GRAPHQL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESSTOKEN
      },
      body: JSON.stringify({ query: mutation, variables: variables })
    })
    .then(function(response)
    {
      return response.json();
    })
    .then(function(json)
    {
      if (json.errors)
      {
        return;
      }
      let payload = json.data.cartLinesAdd;
      if (payload.userErrors && payload.userErrors.length > 0)
      {
        console.error(payload.userErrors);
        return;
      }
      drawerActionPending = false;     

      let cartDrawerComponent = document.querySelector('cart-drawer');
      if (cartDrawerComponent && typeof cartDrawerComponent.fetch === 'function')
      {
        cartDrawerComponent.fetch();
      }
      document.dispatchEvent(new CustomEvent('cart-ready'));
    })
    .catch(function(error) {});
  });
}