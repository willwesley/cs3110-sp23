#!/usr/bin/env node

const locallydb = require("locallydb")
const db = new locallydb("./mydb")
const things = db.collection("things")

const fs = require("fs/promises");
const http = require("http"); // import the http library from node
// "data store" that we'll dump all the things in
let listOfThings = [];
// We'll assign unique ids to the incoming data, incrementing
let lastId = 0;

const getBody = require("./httpHelpers")
const { parseBasic, promptForAuth, sha256 } = require("./authHelpers")

/* our authentication mechanism proper. returns username "chuck" if the request contains
 * the Basic authorization header containg the right username and password. Otherwise it
 * prompts for a username and password by sending the appropriate headers and response code
 * to the browser and returns false
 */
const authenticate = (req, res) => {
  const [user, pass] = parseBasic(req)
  // You will probably want to change this next line to a call to a function that does some
  // sort of look up and password comparison
  if(user === "chuck" && sha256(pass) === "f52fbd32b2b3b86ff88ef6c490628285f482af15ddcb29541f94bcf526a3f6c7") {
    return user
  }
  promptForAuth(res)
  return false
}

/* http request handler (router and dispatcher)
 * @param req {http.request} the request object
 * @param res {http.response} the object for sending a response
 */
const requestHandler = (req, res) => {
  if(req.method === "POST") {
    // check for auth
    const user = authenticate(req,res)
    // if authed, do the thing
    if(user) {
      getBody(req).then(body => {
        body.who = user;
        things.insert(body)
        res.writeHead(201)
      })
      .catch(() => res.writeHead(400))
      .finally(() => res.end())
    }
  } else if(req.method === "PUT") {
    const user = authenticate(req,res)
    if(user) {
      getBody(req).then(body => {
        body.who = user;
        things.replace(body.cid*1, body)
        res.writeHead(200)
      })
      .catch(() => res.writeHead(400))
      .finally(() => res.end())
    }
  } else if(req.method === "DELETE") {
    const user = authenticate(req,res)
    if(user) {
      const match = req.url.match(/\/api\/(\d+)/)
      if(match && match[1]) {
        console.log(match[1])
        things.remove(1*match[1])
        things.save()
        res.writeHead(200)
        res.end()
      } else {
        res.writeHead(400)
        res.end()
      }
    }
  } else {
    // default assumes GET
    res.writeHead(200, {
      "Content-Type": "application/json",
    })
    res.write(JSON.stringify(
      things.items 
    ))
    res.end()
  }
}

// create the server and provide it the handler
const server = http.createServer(requestHandler);

server.listen(3000)
