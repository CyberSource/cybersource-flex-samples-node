var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var cybersourceRestApi = require('cybersource-rest-client');

// common parameters
const AuthenticationType = 'http_signature';
const RunEnvironment = 'cybersource.environment.SANDBOX';
const MerchantId = 'testrest';

// http_signature parameters
const MerchantKeyId = '08c94330-f618-42a3-b09d-e1e43be5efda';
const MerchantSecretKey = 'yBJxy6LjM2TmcPGu+GaJrHtkke25fPpUX+UY6/L/1tE=';

// jwt parameters
const KeysDirectory = 'Resource';
const KeyFileName = 'testrest';
const KeyAlias = 'testrest';
const KeyPass = 'testrest';

// logging parameters
const EnableLog = true;
const LogFileName = 'cybs';
const LogDirectory = '../log';
const LogfileMaxSize = '5242880'; //10 MB In Bytes


var configObj = {
	'authenticationType': AuthenticationType,	
	'runEnvironment': RunEnvironment,

	'merchantID': MerchantId,
	'merchantKeyId': MerchantKeyId,
	'merchantsecretKey': MerchantSecretKey,
    
	'keyAlias': KeyAlias,
	'keyPass': KeyPass,
	'keyFileName': KeyFileName,
	'keysDirectory': KeysDirectory,
    
	'enableLog': EnableLog,
	'logFilename': LogFileName,
	'logDirectory': LogDirectory,
	'logFileMaxSize': LogfileMaxSize
};


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// route pages
app.get('/checkout', function (req, res) {

        try {
                var instance = new cybersourceRestApi.KeyGenerationApi(configObj);

                var request = new cybersourceRestApi.GeneratePublicKeyRequest();
                request.encryptionType = 'RsaOaep256';
                request.targetOrigin = 'http://localhost:3000';

                var options = {
                        'generatePublicKeyRequest': request
                };

                console.log('\n*************** Generate Key ********************* ');

                instance.generatePublicKey(options, function (error, data, response) {
                        if (error) {
                                console.log('Error : ' + error);
                                console.log('Error status code : ' + error.statusCode);
                        }
                        else if (data) {
                                console.log('Data : ' + JSON.stringify(data));
                                res.render('index', { keyInfo:  JSON.stringify(data.jwk)});
                        }
                        console.log('Response : ' + JSON.stringify(response));
                        console.log('Response Code Of GenerateKey : ' + response['status']);
                });
        } catch (error) {
                res.send('Error : ' + error + ' Error status code : ' + error.statusCode);
        }
  

});

// route pages
app.post('/receipt', function (req, res) {

        console.log('GOT HERE');
        try {
               
                console.log('Response : ' + req.body.flexresponse);
                var tokenResponse = JSON.parse(req.body.flexresponse)

                res.render('receipt', { flexresponse:  req.body.flexresponse, flextoken: tokenResponse.token} );
                        
        } catch (error) {
                res.send('Error : ' + error + ' Error status code : ' + error.statusCode);
        }
  

});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
