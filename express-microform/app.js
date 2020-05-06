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

// THIS IS THE SERVER-SIDE REQUEST TO GENERATE THE DYNAMIC KEY 
// REQUIRED FOR THE MICROFORM TO TOKENIZE
app.get('/checkout', function (req, res) {

        try {
                var instance = new cybersourceRestApi.KeyGenerationApi(configObj);

                var request = new cybersourceRestApi.GeneratePublicKeyRequest();
                request.encryptionType = 'RsaOaep256';
                request.targetOrigin = 'http://localhost:3000';

                var opts = [];
                opts['format'] = 'JWT';

                console.log('\n*************** Generate Key ********************* ');
                
                instance.generatePublicKey(request, opts, function (error, data, response) {
                    if (error) {
                        console.log('Error : ' + error);
                        console.log('Error status code : ' + error.statusCode);
                    }
                    else if (data) {
                        console.log('Data : ' + JSON.stringify(data));
                        console.log('CaptureContext: '+data.keyId);
                        res.render('index', { keyInfo: JSON.stringify(data.keyId)});
                    }
                    console.log('Response : ' + JSON.stringify(response));
                    console.log('Response Code Of GenerateKey : ' + response['status']);
                    callback(error, data);
                });
                
            } catch (error) {
                console.log(error);
            }
          
});

// THIS ROUTE SIMPLY POWERS THE TOKEN PAGE TO DISPLAY THE TOKEN
// NOTE THIS IS AN INTERIM STEP FOR THE SAMPLE AND WOULD OBVIOUSLY
// NOT BE PART OR A REAL CHECKOUT FLOW
app.post('/token', function (req, res) {

        try {
               
                console.log('Response : ' + req.body.flexresponse);
                var tokenResponse = JSON.parse(req.body.flexresponse)

                res.render('token', { flexresponse:  req.body.flexresponse} );
                        
        } catch (error) {
                res.send('Error : ' + error + ' Error status code : ' + error.statusCode);
        }
  

});

// THIS REPRESENTS THE SERVER-SIDE REQUEST TO MAKE A PAYMENT WITH THE TRANSIENT
// TOKEN
app.post('/receipt', function (req, res) {

        var tokenResponse = JSON.parse(req.body.flexresponse)
        console.log('Transient token for payment is: ' + JSON.stringify(tokenResponse));

         try {
                
                var instance = new cybersourceRestApi.PaymentsApi(configObj);

                var clientReferenceInformation = new cybersourceRestApi.Ptsv2paymentsClientReferenceInformation();
                clientReferenceInformation.code = 'test_flex_payment';

                var processingInformation = new cybersourceRestApi.Ptsv2paymentsProcessingInformation();
                processingInformation.commerceIndicator = 'internet';

                var amountDetails = new cybersourceRestApi.Ptsv2paymentsOrderInformationAmountDetails();
                amountDetails.totalAmount = '102.21';
                amountDetails.currency = 'USD';

                var billTo = new cybersourceRestApi.Ptsv2paymentsOrderInformationBillTo();
                billTo.country = 'US';
                billTo.firstName = 'John';
                billTo.lastName = 'Deo';
                billTo.phoneNumber = '4158880000';
                billTo.address1 = 'test';
                billTo.postalCode = '94105';
                billTo.locality = 'San Francisco';
                billTo.administrativeArea = 'MI';
                billTo.email = 'test@cybs.com';
                billTo.address2 = 'Address 2';
                billTo.district = 'MI';
                billTo.buildingNumber = '123';

                var orderInformation = new cybersourceRestApi.Ptsv2paymentsOrderInformation();
                orderInformation.amountDetails = amountDetails;
                orderInformation.billTo = billTo;

                // EVERYTHING ABOVE IS JUST NORMAL PAYMENT INFORMATION
                // THIS IS WHERE YOU PLUG IN THE MICROFORM TRANSIENT TOKEN
                var tokenInformation = new cybersourceRestApi.Ptsv2paymentsTokenInformation();
                tokenInformation.transientTokenJwt = tokenResponse;

                var request = new cybersourceRestApi.CreatePaymentRequest();
                request.clientReferenceInformation = clientReferenceInformation;
                request.processingInformation = processingInformation;
                request.orderInformation = orderInformation;
                request.tokenInformation = tokenInformation;

                console.log('\n*************** Process Payment ********************* ');

                instance.createPayment(request, function (error, data, response) {
                    if (error) {
                        console.log('\nError in process a payment : ' + JSON.stringify(error));
                    }
                    else if (data) {
                        console.log('\nData of process a payment : ' + JSON.stringify(data));
                        res.render('receipt', { paymentResponse:  JSON.stringify(data)} );
                
                    }
                    console.log('\nResponse of process a payment : ' + JSON.stringify(response));
                    console.log('\nResponse Code of process a payment : ' + JSON.stringify(response['status']));
                    callback(error, data);
                });
                
            } catch (error) {
                console.log(error);
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
