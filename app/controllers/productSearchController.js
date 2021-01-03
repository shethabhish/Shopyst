const request = require('request-promise-native');
const _ = require('lodash');

const searchApp = 'chatbotv2';//chatbot';
const apiKey = 'DEBBCA949E82487495EF1C37EDA55F5F';

const indexes = {
  categories: `https://${searchApp}.search.windows.net/indexes/categories/docs?api-version=2015-02-28`,
  products: `https://${searchApp}.search.windows.net/indexes/products/docs?api-version=2015-02-28`,
  variants: `https://${searchApp}.search.windows.net/indexes/variants/docs?api-version=2015-02-28`
};

const search = (index, query) => {
  return request({
    url: `${indexes[index]}&${query}`,
    headers: { 'api-key': `${apiKey}` }
  })
    .then(result => {
      const obj = JSON.parse(result);
      console.log(
        `Searched ${index} for [${query}] and found ${obj &&
          obj.value &&
          obj.value.length} results`
      );
      return obj.value;
    })
    .catch(error => {
      console.error(error);
      return [];
    });
};

const searchCategories = query => search('categories', query);
const searchProducts = query => search('products', query);
const searchVariants = query => search('variants', query);

module.exports = {
  listTopLevelCategories: () => searchCategories('$filter=parent eq null'),

  findCategoryByTitle: title => searchCategories(`search=title:"${title}~"`),

  findSubcategoriesByParentId: id =>
    searchCategories(`$filter=parent eq '${id}'`),

  findSubcategoriesByParentTitle: function(title) {
    return this.findCategoryByTitle(title).then(value => {
      return value.slice(0, 1).reduce((chain, v) => {
        return chain.then(() => {
          return this.findSubcategoriesByParentId(v.id);
        });
      }, Promise.resolve({ value: [] }));
    });
  },

  findProductById: function(product) {
    return searchProducts(`$filter=id eq '${product}'`);
  },

  findProductsByTitle: function(product) {
    return searchProducts(`search=title:'${product}'`);
  },

  findProductsBySubcategoryTitle: function(title) {
    return searchProducts(`search=subcategory:'${title}'`);
  },

  findProducts: function(query) {
    return searchProducts(query);
  },

  findVariantById: function(id) {
    return searchVariants(`$filter=id eq '${id}'`);
  },

  findVariantBySku: function(sku) {
    return searchVariants(`$filter=sku eq '${sku}'`);
  },

  findVariantForProduct: function(productId, color, size) {
    return searchVariants(`$filter=productId eq '${productId}'`).then(
      variants => {
        if (variants.length === 1) {
          console.log(`Returning the only variant for ${productId}`);
          return variants[0];
        } else {
          return variants.find(v => {
            const isColorMatch = v.color === color || (!v.color && !color);
            const isSizeMatch = v.size === size || (!v.size && !size);

            console.log(
              `Checking if ${v.id} with ${v.size}-${
                v.color
              } is the right one for ${size}-${color}`
            );

            return (
              (!color && !size) ||
              (color && !size && isColorMatch) ||
              (!color && size && isSizeMatch) ||
              (isColorMatch && isSizeMatch)
            );
          });
        }
      }
    );
  },

  find: function(query) {
    return Promise.all([
      this.findSubcategoriesByParentTitle(query),
      this.findProducts(`search=${query}`)
    ]).then(([subcategories, products]) => ({ subcategories, products }));
  }
};
