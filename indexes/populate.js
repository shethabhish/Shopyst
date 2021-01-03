'use strict';

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const request = require('request-promise-native');

const MoltinGateway = require('@moltin/sdk').gateway;
const Moltin = MoltinGateway({
  client_id: 'p77jkEq3TDgMqXSJ77FK4lIYmXiEy5EPy64egs3puK',
  client_secret: 'S9agsmvvbgcRnrB0999PwCFnQzph3AvcOjnyf4iKXi'
});

if (!Moltin.Files) {
  Moltin.Files = Object.setPrototypeOf(
    Object.assign({}, Moltin.Products),
    Moltin.Products
  );
  Moltin.Files.endpoint = 'files';
}

(async function() {
  // There are only 42 images in the AW catalog and the default pagination limit in Moltin API is 100
  const images = (await Moltin.Files.All()).data;
  const imagesLookup = _.groupBy(images, image => image.id);
  const taxonomy = (await Moltin.Categories.Tree()).data;
  for (let topCategory of taxonomy) {
    for (let child of topCategory.children) {
      child.parent = topCategory;
    }
  }

  const categories = _.flatMap(taxonomy, category => category.children || []);
  const categoryLookup = _.groupBy(categories, category => category.id);

  const catalog = await (async function read(offset = 0, all = []) {
    Moltin.Products.Offset(offset);
    const { data, meta } = await Moltin.Products.All();

    all.push(...data);

    const total = meta.results.all;
    const processed =
      (meta.page.current - 1) * meta.page.limit + meta.results.total;

    return total > processed ? await read(processed, all) : all;
  })();

  const allProducts = catalog.filter(record => /^AW_\d+$/.test(record.sku));
  const allVariants = catalog.filter(record => !/^AW_\d+$/.test(record.sku));

  for (let variant of allVariants) {
    variant.description = JSON.parse(variant.description);
  }

  const variantsLookup = _.groupBy(allVariants, v => v.description.parent);
  const categoryIndex = taxonomy.concat(categories).map(category => ({
    '@search.action': 'upload',
    id: category.id,
    title: category.name,
    description: category.description,
    parent: category.parent ? category.parent.id : null
  }));

    const productIndex = allProducts.map(product => {
    const categoryId = product.relationships.categories.data[0].id;

    const category = categoryLookup[categoryId][0];
    const variants = variantsLookup[product.id];

    const modifiers = _.chain(variants)
      .flatMap(variant =>
        _.without(Object.keys(variant.description), 'parent').filter(key =>
          Boolean(variant.description[key])
        )
      )
      .uniq()
      .value();

    const [color, size] = ['color', 'size'].map(modifier =>
      _.chain(variants)
        .map(variant => variant.description[modifier])
        .uniq()
        .filter(Boolean)
        .value()
    );

    return {
      '@search.action': 'upload',
      id: product.id,
      title: product.name,
      description: product.description,
      category: category.parent.name,
      categoryId: category.parent.id,
      subcategory: category.name,
      subcategoryId: category.id,
      modifiers: modifiers,
      color: color, // ToDo: check how empty arrays are created in Azure Search
      size: size,
      price: Number(product.price[0].amount),
    };
  });

  const variantIndex = allVariants.map(variant => {
    const [color, size] = ['color', 'size'].map(
      modifier => variant.description[modifier] || null
    );

    return {
      '@search.action': 'upload',
      id: variant.id,
      productId: variant.description.parent,
      color: color,
      size: size,
      sku: variant.sku,
      price: Number(variant.price[0].amount),
    };
  });

  const indexes = {
    categories: categoryIndex,
    products: productIndex,
    variants: variantIndex
  };

  const servicename = 'chatbot'; //process.env.SEARCH_APP_NAME;
  const apikey = 'AACEAE333C407C375BEDACA70C1363E0'; //process.env.SEARCH_API_KEY;
  const headers = {
    'Content-Type': 'application/json',
    'api-key': apikey
  };

  for (let index of Object.keys(indexes)) {
    try {
      await request({
        url: `https://${servicename}.search.windows.net/indexes/${index}?api-version=2016-09-01`,
        headers,
        method: 'DELETE'
      });
    } catch (error) {
      console.error(error);
    }

    await request({
      url: `https://${servicename}.search.windows.net/indexes/${index}?api-version=2016-09-01`,
      headers,
      method: 'PUT',
      body: fs.createReadStream(path.resolve(__dirname, `${index}.json`))
    });

    await request({
      url: `https://${servicename}.search.windows.net/indexes/${index}/docs/index?api-version=2016-09-01`,
      headers,
      method: 'POST',
      json: true,
      body: {
        value: indexes[index]
      }
    });
  }
})();
