// include required libraries
var restify = require('restify');
const builder = require('botbuilder');
const express = require('express');

// import recognizers 
const gtRecognizer = require('./app/recognizers/greetingRecognizer');
const cmRecognizer = require('./app/recognizers/commandsRecognizer');

const dialog = {
    welcome: require('./app/dialogs/welcomeDialog'),
    categories: require('./app/dialogs/categoriesDialog'),
    explore: require('./app/dialogs/exploreDialog'),
    showProduct: require('./app/dialogs/showProductDialog'),
    choseVariant: require('./app/dialogs/choseVariantDialog'),
    showVariant: require('./app/dialogs/showVariantDialog'),
    addToCart: require('./app/dialogs/addToCartDialog'),
    showCart: require('./app/dialogs/showCartDialog'),
    showWishlist : require('./app/dialogs/showWishlistDialog'), // wishlist dialogs
    addToWishlist : require('./app/dialogs/addToWishlistDialog'),
    clearWishlist : require('./app/dialogs/clearWishlistDialog')
};

// Setup Restify Server
var rServer = restify.createServer();
rServer.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('Server [%s] listening on Url [%s]', rServer.name, rServer.url);
});

// Create chat connector for communicating with the Bot Framework Service
var chatConnector= new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});

// Listen for messages from users
rServer.post('/api/messages', chatConnector.listen());

const shopyst= new builder.UniversalBot(chatConnector, {
    persistConversationData: true
});

// attach custom recognizers for the bot
var intents = new builder.IntentDialog({
    recognizers: [
        cmRecognizer,
        gtRecognizer,
        new builder.LuisRecognizer(`https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/14501e5f-cad0-46a9-8ec8-9be3d58ff867?subscription-key=d25d400f69104eedb2fbb1189d80cf42&verbose=true&timezoneOffset=0`) //*process.env.LUIS_ENDPOINT*/
    ],
    intentThreshold: 0.2,
    recognizeOrder: builder.RecognizeOrder.series
});

// link intents to dialogs
intents.matches('Greeting', '/welcome');
intents.matches('ShowTopCategories', '/categories');
intents.matches('Explore', '/explore');
intents.matches('Next', '/next');
intents.matches('ShowProduct', '/showProduct');
intents.matches('AddToCart', '/addToCart');
intents.matches('ShowCart', '/showCart');
intents.matches('showWishlist', '/showWishlist');
intents.matches('addToWishlist','/addToWishlist');
intents.matches('clearWishlist', '/clearWishlist');
intents.matches('Checkout', '/checkout');
intents.matches('Reset', '/reset');
intents.matches('Smile', '/smileBack');
intents.onDefault('/confused');

shopyst.dialog('/', intents);
dialog.welcome(shopyst);
// product search functionality
dialog.categories(shopyst);
dialog.explore(shopyst);
dialog.showProduct(shopyst);
dialog.choseVariant(shopyst);
dialog.showVariant(shopyst);
// cart functionality
dialog.addToCart(shopyst);
dialog.showCart(shopyst);
// wishlist functionality
dialog.showWishlist(shopyst);
dialog.addToWishlist(shopyst);
dialog.clearWishlist(shopyst);

// if shopyst fails to understand user
shopyst.dialog('/confused', [
    function(conv, args, next) {
        if (conv.message.text.trim()) {
            conv.endDialog(
                "Sorry, I didn't get you."
            );
        } else {
            conv.endDialog();
        }
    }
]);

// reset the conversation, if current is finished
shopyst.dialog('/reset', [
    function(conv, args, next) { // end the conversation
           conv.send(
                'Thank you for shopping with us.'
            );
        conv.endConversation(['See you soon !']);
    }
]);

// checkout dialog
shopyst.dialog('/checkout', [
    function(conv, args, next) {
        const shoppingCart = conv.privateConversationData.cart;
        if (!shoppingCart || !shoppingCart.length) { // check if cart is empty
            conv.send(
                'Looks like your cart is empty. Feel free to look around and see if you like anything'
            );
            conv.reset('/categories');
        } else {
            conv.send('Sure. Placing your order now.. ');
            conv.endDialog('Your order has been placed.');
            // empty the cart
            conv.privateConversationData.cart = [];
        }
    }
]);
