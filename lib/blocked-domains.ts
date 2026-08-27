// Dominios que NO queremos como resultado porque no son tiendas donde
// comprar directamente. Dos categorías distintas:

// 1) Marketplaces de reventa (precios inflados/manipulados, no retail real)
export const RESALE_DOMAINS = [
  'stockx.com', 'goat.com', 'klekt.com', 'restocks.net', 'laced.com',
  'novelship.com', 'grailed.com', 'stadiumgoods.com', 'flightclub.com',
  'kickscrew.com', 'kickz.com/en/marketplace',
  // Reventa/segunda mano generalista
  'vinted.es', 'vinted.com', 'wallapop.com', 'ebay.es', 'ebay.com',
  'ebay.de', 'ebay.fr', 'ebay.it', 'depop.com', 'vestiairecollective.com',
  'milanuncios.com', 'leboncoin.fr', 'marktplaats.nl', 'subito.it',
];

// 2) Agregadores/comparadores de precio — muestran "5 tiendas donde
// aparece" en vez de ser la tienda real; el usuario ya dijo que no
// quiere esto, quiere ir directo a la tienda.
export const AGGREGATOR_DOMAINS = [
  'idealo.es', 'idealo.de', 'idealo.it', 'idealo.fr', 'idealo.co.uk',
  'kelkoo.es', 'kelkoo.com', 'kelkoo.co.uk', 'kelkoo.fr',
  'twenga.es', 'twenga.fr', 'shopalike.es', 'shopalike.de', 'shopalike.it',
  'pricerunner.com', 'pricerunner.se', 'pricerunner.dk', 'pricerunner.co.uk',
  'billiger.de', 'guenstiger.de', 'geizhals.de', 'geizhals.at',
  'ladenzeile.de', 'ladenzeile.at', 'nextag.com', 'shopping.google.com',
  'google.com/shopping', 'shopmania.es', 'shopmania.com',
  'trovaprezzi.it', 'skinflint.co.uk', 'pricehunter.co.uk',
  'ceneo.pl', 'skapiec.pl', 'heureka.cz', 'heureka.sk',
  'compari.co.uk', 'prisjakt.no', 'prisjakt.se', 'pricespy.co.uk',
];

export const SKIP_DOMAINS = [...RESALE_DOMAINS, ...AGGREGATOR_DOMAINS];

export function shouldSkipDomain(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace(/^www\./, '');
    return SKIP_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`) || (host + pathname).includes(d));
  } catch {
    return true;
  }
}
