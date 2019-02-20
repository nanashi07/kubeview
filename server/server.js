// Dotenv handy for local config & debugging
require('dotenv').config()

const K8sConfig = require('kubernetes-client').config
const Client = require('kubernetes-client').Client

// Core Express & logging stuff
var express = require('express')
var app = express()
var client = null;

// Serve static content from working directory ('.') by default
// - Optional parameter can specify different location, use when debugging & running locally
// - e.g. `node server.js ../angular/dist/`
var staticContentDir = process.argv[2] || __dirname;
// resolve to an absolute path
staticContentDir = require('path').resolve(staticContentDir)
console.log(`### Content dir = '${staticContentDir}'`);

// Serve all static content (index.html, js, css, assets, etc.)
app.use('/', express.static(staticContentDir));

// ===== API routes =====

app.use('/api/namespaces', async function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  
  try {
    const data = await client.api.v1.namespaces.get()
    res.send(data.body.items)
  } catch(e) {
    res.status(500).end(`Sorry, bad thing happened: ${e.toString()}`)
  }
})

app.use('/api/scrape/:ns', async function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");

  let ns = req.params.ns;

  let data = {}
  try {
    const services = await client.api.v1.namespaces(ns).services.get()
    const endpoints = await client.api.v1.namespaces(ns).endpoints.get()
    const pods = await client.api.v1.namespaces(ns).pods.get()
    const deployments = await client.apis.apps.v1.namespaces(ns).deployments.get()
    const replicasets = await client.apis.apps.v1.namespaces(ns).replicasets.get()
    const ingresses = await client.apis.extensions.v1beta1.namespaces(ns).ingresses.get()

    // Build response data and send
    data.services = services.body.items
    data.endpoints = endpoints.body.items
    data.ingresses = ingresses.body.items
    data.pods = pods.body.items
    data.deployments = deployments.body.items
    data.replicasets = replicasets.body.items
    res.send(data)

  } catch(e) {
    res.status(500).end(`Sorry, bad thing happened: ${e.toString()}`)
  }
})

// Redirect all other requests to Vue.js app - i.e. index.html
// This allows us to do in-app, client side routing and deep linking 
// - see https://angular.io/guide/deployment#server-configuration
app.use('*', function(req, res) {
  res.sendFile(`${staticContentDir}/index.html`);
});
// ===== Start server =====

// Server port
const port = process.env.PORT || 3000;

var server = app.listen(port, async function () {
  console.log(`### Server listening on ${server.address().port}`)
  console.log(`### NODE_ENV is ${process.env.NODE_ENV}`)
  console.log(`### Connecting to Kubernetes API...`)
  try {
    var kubeConf;
    if(process.env.NODE_ENV == "production") {
      kubeConf = K8sConfig.getInCluster()
    } else {
      kubeConf = K8sConfig.fromKubeconfig(`${process.env.HOME}/.kube/config`)
    }
    client = new Client({ config: kubeConf })
    await client.loadSpec()
    console.log(`### Connected to ${client.backend.requestOptions.baseUrl}`)
  } catch(e) {
    console.log(`### Error! ${e.toString()}`)
  }
});