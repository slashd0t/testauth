const feathers = require('feathers')
const configuration = require('feathers-configuration')
const hooks = require('feathers-hooks')
const rest = require('feathers-rest') // I've disabled this for demonstrational purpose, feel free to enable it
const socketio = require('feathers-socketio')
const auth = require('feathers-authentication')

const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const path = require('path');
const favicon = require('serve-favicon');
const compress = require('compression');

const handler = require('feathers-errors/handler');
const notFound = require('feathers-errors/not-found');

const middleware = require('./middleware');
const services = require('./services');
const appHooks = require('./app.hooks');

const memory = require('feathers-memory');
const local = require('feathers-authentication-local');
const jwt = require('feathers-authentication-jwt');

const app = feathers()

app.configure(configuration())
  .configure(rest()) // I've disabled this for demonstrational purpose, feel free to enable it
  .configure(socketio())
  .configure(hooks())

// Auth
const authConfig = app.get('auth');
console.log('authConfig:',authConfig);
app.configure(auth(authConfig))
   .configure(local())
   .configure(jwt())
   .use('/users', memory());

// Enable CORS, security, compression, favicon and body parsing
app.use(cors());
app.use(helmet());
app.use(compress());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(favicon(path.join(app.get('public'), 'favicon.ico')));
// Host the public folder
app.use('/', feathers.static(app.get('public')));


// app.use(function(req, res, next) {
//   res.send({
//     Now: 'that rest is enabled, it works! But when it\'s not... it doesn\'t :('
//   })
// })

// Add a hook to the user service that automatically replaces
// the password with a hash of the password before saving it.
app.service('users').hooks({
  before: {
    find: [
      auth.hooks.authenticate('jwt')
    ],
    create: [
      local.hooks.hashPassword({ passwordField: 'password' })
    ]
  }
});

app.service('authentication').hooks({
  before: {
    create: [
      // You can chain multiple strategies
      auth.hooks.authenticate(['jwt', 'local'])
    ],
    remove: [
      auth.hooks.authenticate('jwt')
    ]
  }
});


// Custom route with custom redirects
app.post('/login', auth.express.authenticate('local', { successRedirect: '/app', failureRedirect: '/login' }));

// Custom Express routes
app.get('/protected', auth.express.authenticate('jwt'), (req, res, next) => {
  res.json({ success: true });
});

app.get('/unprotected', (req, res, next) => {
  res.json({ success: true, text: 'unprotected' });
});


app.get('/app', (req, res, next) => {
  res.json({ success: true, text: 'welcome to dashboard' });
});

app.get('/login', (req, res, next) => {
  res.json({ success: false, text: 'login failed' });
});

var User = {
  email: 'admin@feathersjs.com',
  password: 'admin',
  permissions: ['*']
};

app.service('users').create(User).then(user => {
  console.log('Created default user', user);
}).catch(console.error);

// Configure other middleware (see `middleware/index.js`)
app.configure(middleware);
// Set up our services (see `services/index.js`)
app.configure(services);
// Configure a middleware for 404s and the error handler
app.use(notFound());
app.use(handler());

app.hooks(appHooks);
module.exports = app;
