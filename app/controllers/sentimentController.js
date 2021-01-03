const request = require('request-promise-native');
const builder = require('botbuilder');

let apiAccessKey = '5fa9ee88324744ff92976a9d971f5cca';
module.exports = {
  detect: function(message,threshold = 0.05) {
    return request({
      method: 'POST',
      url:'https://westus.api.cognitive.microsoft.com/text/analytics/v2.0/sentiment',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': apiAccessKey
      },
      body: {
        // array of texts to be analyzed, for us this is just one
        documents: [ 
          {
            id: '-',
            language:'en',
            message
          }
        ]
      },
      json: true
    }).then(result => {
      if (result && result.documents) {
        const sentimentScore = result.documents[0].score;
        console.log(`SENTIMENT: ${sentimentScore} in ${message}`);
          if (sentimentScore >= 0.5 + threshold) {
            return {
              response: true,
              sentimentScore
            };
          } else if (sentimentScore <= 0.5 - threshold) {
            return {
              response: false,
              sentimentScore
            };
          } else {
            return Promise.reject(
              `Sentiment detection failed`
            );
          }
      } else {
        return Promise.reject(
          'No response from sentiment analysis API.'
        );
      }
    });
  },

  confirm: function(question, reprompt) {
    return [
      (conv, args, next) => {
        builder.Prompts.text(conv, question);
      },
      (conv, args, next) => {
        const answer = builder.EntityRecognizer.parseBoolean(args.response);
        if (typeof answer !== 'undefined') {
          next({
            response: answer
          });
        } else {
          this.detect(args.response)
            .then(result => next(result))
            .catch(error => {
              console.error(error);
              next();
            });
        }
      },
      (conv, args, next) => {
        if (args && typeof args.response !== 'undefined') {
          next(args);
        } else {
          reprompt =
            reprompt ||
            'I am sorry, I did not understand what you meant. ' +
            "See if you can use the buttons or reply with a simple 'yes' or 'no'. ";
          conv.send(reprompt);
          builder.Prompts.confirm(conv, question, {
            listStyle: builder.ListStyle.button
          });
        }
      }
    ];
  }
};
