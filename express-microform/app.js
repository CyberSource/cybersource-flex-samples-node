const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const cybersourceRestApi = require('cybersource-rest-client');
const configuration = require('./Data/Configuration');

const app = express();

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
            const configObject = new configuration();
            const apiClient = new cybersourceRestApi.ApiClient();
            const requestObj = new cybersourceRestApi.GenerateCaptureContextRequest();
    
            requestObj.clientVersion = 'v2';
            requestObj.targetOrigins = ["http://localhost:3000"];
            requestObj.allowedCardNetworks = ["VISA", "MASTERCARD", "AMEX", "CARNET", "CARTESBANCAIRES", "CUP", "DINERSCLUB", "DISCOVER", "EFTPOS", "ELO", "JCB", "JCREW", "MADA", "MAESTRO", "MEEZA"];
            requestObj.allowedPaymentTypes = ["CARD"];
    
            const instance = new cybersourceRestApi.MicroformIntegrationApi(configObject, apiClient);
    
            instance.generateCaptureContext(requestObj, function (error, data, response) {
                if (error) {
                    console.log('\nError : ' + JSON.stringify(error));
                }
                else if (data) {
                    console.log('\nData : ' + JSON.stringify(data));
                    const decodeData =  JSON.parse(Buffer.from(data.split('.')[1], 'base64').toString());
                    const url = decodeData.ctx[0].data.clientLibrary;
                    const clientLibraryIntegrity = decodeData.ctx[0].data.clientLibraryIntegrity
                    res.render('index', { keyInfo: JSON.stringify(data), url: JSON.stringify(url), clientLibraryIntegrity: JSON.stringify(clientLibraryIntegrity)});
                }
    
                console.log('\nResponse : ' + JSON.stringify(response));
                console.log('\nResponse Code of Process a Payment : ' + JSON.stringify(response['status']));
            });
        }
        catch (error) {
            console.log('\nException on calling the API : ' + error);
        }
          
});

// THIS ROUTE SIMPLY POWERS THE TOKEN PAGE TO DISPLAY THE TOKEN
// NOTE THIS IS AN INTERIM STEP FOR THE SAMPLE AND WOULD OBVIOUSLY
// NOT BE PART OR A REAL CHECKOUT FLOW
app.post('/token', function (req, res) {

        try {
               
                console.log('Response : ' + req.body.flexresponse);
                res.render('token', { flexresponse:  req.body.flexresponse} );
                        
        } catch (error) {
                res.send('Error : ' + error + ' Error status code : ' + error.statusCode);
        }
  

});

// THIS REPRESENTS THE SERVER-SIDE REQUEST TO MAKE A PAYMENT WITH THE TRANSIENT
// TOKEN
app.post('/receipt', function (req, res) {

        const tokenResponse = JSON.parse(req.body.flexresponse)
        console.log('Transient token for payment is: ' + JSON.stringify(tokenResponse));

         try {
                const configObject = new configuration();
                const instance = new cybersourceRestApi.PaymentsApi(configObject);

                const clientReferenceInformation = new cybersourceRestApi.Ptsv2paymentsClientReferenceInformation();
                clientReferenceInformation.code = 'test_flex_payment';

                const processingInformation = new cybersourceRestApi.Ptsv2paymentsProcessingInformation();
                processingInformation.commerceIndicator = 'internet';

                const amountDetails = new cybersourceRestApi.Ptsv2paymentsOrderInformationAmountDetails();
                amountDetails.totalAmount = '102.21';
                amountDetails.currency = 'USD';

                const billTo = new cybersourceRestApi.Ptsv2paymentsOrderInformationBillTo();
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

                const orderInformation = new cybersourceRestApi.Ptsv2paymentsOrderInformation();
                orderInformation.amountDetails = amountDetails;
                orderInformation.billTo = billTo;

                // EVERYTHING ABOVE IS JUST NORMAL PAYMENT INFORMATION
                // THIS IS WHERE YOU PLUG IN THE MICROFORM TRANSIENT TOKEN
                const tokenInformation = new cybersourceRestApi.Ptsv2paymentsTokenInformation();
                tokenInformation.transientTokenJwt = tokenResponse;

                const request = new cybersourceRestApi.CreatePaymentRequest();
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
