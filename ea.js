/* 
    This is an external adapter that can be called from a chainlink node. 
    
    CL-EA-NodeJS-Template Migration Note:
    -------------------------------------
    Simple parameter validation is enabled for adapter input and API output, replicating the
    functionality of Validator() and Requester.validateResultNumber() in the classic templates,
    and can be configured in ./ea.rconfig.json.

    This template provides both a syncronous and a simulated asyncronous adapter. When using a 
    syncronous adapter, the result is expected to be returned to the node within a very 
    short timeout, and is used for non-computing intensive operations like querying a fast API.

    Asyncronous adapters are used when something takes long to compute or in the event of slow
    data providers. When using an asyncronous adapter, the first thing that happens is that the 
    adapter immediately returns the object {"pending": true} to the node, which pauses the job. 

    When the adapter is finished (runtime simulated in the asyncadapter with a setTimeout) it calls
    back to the node, using the URL that was supplied in the initial call to the adapter in 
    body.responseURL. In order for body.responseURL to be included in a request to an external 
    adapter, the environment variable BRIDGE_RESPONSE_URL has so be set in the nodes .env file, 
    to the http URL of the node itself.

    This template has been created as a bare minimum foundation for building an external adapter. 
    Any customization from hereon depends alot on if you are on Pipeline V1 or V2. Please
    refer to Chainlink documentation for more information. 

    Pipeline V1:
    -----------
    [httpPost]: "extPath", "queryParams" and "post" param can be used to modify request. Any headers or body have
    to be added in job spec.

    [Bridge]: "extpath", "queryParams", "post", "body" and "headers" are all ignored, but are packed in the 
    "data" key in the body of the request. Bridge outgoing token is added to headers as a bearer authentication
    token. Async Bridge Response URL is added to body.

    Pipeline V2:
    -----------   
    To be documented
    
*/

const axios = require("axios");
const rax = require('retry-axios');
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const port = process.env.EA_PORT || 8080
const validator = new (require("./ea.validator"))();
const eaconfig = require("./json/ea.config");

app.use(bodyParser.json())

const raxConfig = {
    timeout: 50,  
    raxConfig: {
      retry: 3, 
      noResponseRetries: 3, 
      backoffType: 'exponential',
      onRetryAttempt: err => {
        const cfg = rax.getConfig(err);
        console.log(`Retry attempt #${cfg.currentRetryAttempt}`); 
      }
    }
}

const adapterRequestAsync = async (request) => {
    let mockDelay = 4000;
    setTimeout(async ()=>{ 
        let r = await apiRequest(request);
        let arqCallback = {
            "method": "PATCH",
            "url": request.body.responseURL,
            "data": { ranFor: testDelay, ...r.data }
        }
        let ax = await axios(arqCallback);
    },mockDelay)
}

const adapterRequest = async (request) => {
    const jobRunID = request.id || 1;
    
    let validatedInput = validator.validate(request.body.data, eaconfig.requiredKeys.in);
    if (validatedInput.missingKeys) 
      return { 
        jobRunID, 
        status: 400, 
        message: "Input parameter(s) not found: " + validatedInput.missingKeys,
        error: true 
      }

    let ax = await axios({...eaconfig.apiRequest, params: validatedInput.params}, raxConfig);

    let validatedOutput = validator.validate(ax.data, eaconfig.requiredKeys.out);
    if (validatedOutput.missingKeys) 
      return { 
        jobRunID, 
        status: ax.status, 
        message: "Output key(s) not found: " + validatedOutput.missingKeys,
        error: true 
      }

    return { jobRunID, status: ax.status, data: ax.data }
}

app.post('/', async (req, res) => {
  let auth = req.headers.authorization.replace("Bearer ","");
  if (eaconfig.tokens.incoming.includes(auth)){
    let request = await adapterRequest(req)
    res.status(request.status).json(request);     
  } else {
    res.status(403).json({"jobRunID":0,"status":403,"message":"Forbidden","data":{}});
  }
});

app.post('/async', async (req, res) => {
  let auth = req.headers.authorization.replace("Bearer ","");
  if (eaconfig.tokens.incoming.includes(auth)){
    res.status(200).json({"pending": true });
    let request = await adapterRequestAsync(req);
  } else {
    res.status(403).json({"jobRunID":0,"status":403,"message":"Forbidden","data":{}});
  }
});

app.patch('/nodemock', async (req, res) => {
  console.log("This will be recieved in the node on callback: ", req.body);
});

app.listen(port, () => console.log("Listening on port: " + port));