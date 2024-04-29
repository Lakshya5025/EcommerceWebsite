const path = require('path');
const mongoose = require('mongoose');
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const dotenv = require("dotenv");
const fs = require('fs');
const stripe = require("stripe");

mongoose.connect("mongodb://localhost:27017/Registration", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const app = express();
app.use(express.static('public'));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));


const replaceTemplate = (temp, product) => {
  let output = temp.replace(/{%PRODUCTNAME%}/g, product.productName);
  output = output.replace(/{%IMAGE%}/g, product.image);
  output = output.replace(/{%PRICE%}/g, product.price);
  output = output.replace(/{%FROM%}/g, product.from);
  output = output.replace(/{%NUTRIENTS%}/g, product.nutrients);
  output = output.replace(/{%QUANTITY%}/g, product.quantity);
  output = output.replace(/{%DESCRIPTION%}/g, product.description);
  output = output.replace(/{%ID%}/g, product.id);

  if (!product.organic) output = output.replace(/{%NOT_ORGANIC%}/g, 'not-organic');
  return output;
}
dotenv.config();

app.use(express.static('public'));
app.use(express.json());
const PORT = 8000;

const tempOverview = fs.readFileSync(`${__dirname}/templates/template-overview.html`, 'utf-8');
const tempCard = fs.readFileSync(`${__dirname}/templates/template-card.html`, 'utf-8');
const tempProduct = fs.readFileSync(`${__dirname}/templates/template-product.html`, 'utf-8');
const data = fs.readFileSync(`${__dirname}/dev-data/data.json`, 'utf-8');
const dataObj = JSON.parse(data);

app.get('/overview', (req, res) => {
  const cardsHtml = dataObj.map(el => replaceTemplate(tempCard, el)).join('');
  const output = tempOverview.replace('{%PRODUCT_CARDS%}', cardsHtml);
  res.send(output);
});

app.get('/product', (req, res) => {
  const { id } = req.query;
  const product = dataObj[id];
  const output = replaceTemplate(tempProduct, product);
  res.send(output);
});
app.get('/success', (req, res) => {
  res.sendFile('success.html', { root: 'templates' });
})
//Cancel
app.get('/cancel', (req, res) => {
  res.sendFile('cancel.html', { root: 'templates' });
})

app.get('/api', (req, res) => {
  res.json(dataObj);
});



let stripeGateway = stripe(process.env.stripe_api);
let DOMAIN = process.env.DOMAIN;

app.post('/stripe-checkout', async (req, res) => {
  const lineItems = req.body.items.map((item) => {
    const unitAmount = parseInt(item.price.replace(/[^0-9.-]+/g, '') * 100);
    console.log('item-price:', item.price);
    console.log('unitAmount:', unitAmount);
    return {
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.title,
          images: [item.productImg]
        },
        unit_amount: unitAmount,
      },
      quantity: item.quantity,
    };
  });
  console.log('lineItems:', lineItems);

  // create checkout session
  const session = await stripeGateway.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    success_url: `${DOMAIN}/success`,
    cancel_url: `${DOMAIN}/cancel`,
    line_items: lineItems,
    // asking address in stripe checkout page
    billing_address_collection: 'required'
  });
  res.json(session.url);
});


const User = mongoose.model('User', {
  username: String,
  password: String
}, 'users');

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).redirect('/login');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword
    });

    await newUser.save();
    res.redirect('/login'); // Redirect to the overview page after signup
  } catch (error) {
    console.error('Error signing up:', error);
    res.status(500).send('Error signing up');
  }
});

const authenticateUser = async (req, res, next) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (user) {
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (passwordMatch) {
      next(); // Proceed to the next middleware
    } else {
      res.status(401).send('Incorrect username or password');
    }
  } else {
    res.status(401).redirect("/signup")
  }
};

app.post("/login", authenticateUser, (req, res) => {
  res.redirect("/overview"); // If authentication is successful
});
app.get(['/', '/login'], (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "signup.html"));
});

// Create a testing user "user" with password "123" for initial testing
// bcrypt.hash('123', 10, async (err, hashedPassword) => {
//   if (!err) {
//     await User.create({ username: 'user', password: hashedPassword });
//   }
// });

app.use((req, res) => {
  res.status(404).send('<h1>Page not found!</h1>');
});

app.listen(PORT, () => {
  console.log(`Listening to requests on port ${PORT}`);
});
