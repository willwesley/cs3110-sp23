#!/usr/bin/env node

const fs = require("fs/promises");
const crypto = require("crypto");
const http = require("http"); // import the http library from node
// "data store" that we'll dump all the things in
let listOfThings = [];
// We'll assign unique ids to the incoming data, incrementing
let lastId = 0;

/* a function that parses a string as either form query or json
 * @param str {String} the string to be parsed.
 * @param type {String} a content-type string
 * @return {Object} A javascript value parsed.
 */
const parseData = (str, type) => {
  if(type === "application/x-www-form-urlencoded") {
    return Object.fromEntries(str.split("&").map((q) => q.split("=")))
  } else {
    return JSON.parse(str)
  }
}

/* get the body from a request, semi-intelligently
 * @param req {http.request} the request object, duh.
 * @return {Promise} that might someday contain a javascript value parsed from
 *   the body of the request
 */
const getBody = (req) => new Promise((resolve, reject) => {
  let body = ""
  // accumulate body
  req.on("data", (data) => {
    body += data
  })
  // body complete, try to parse
  req.on("end", () => {
    try {
      const parsed = parseData(body, req.headers["content-type"])
      resolve(parsed)
    } catch (e) {
      reject(parsed)
    }
  })
})

/* helper function to get a username/password tuple from request headers.
 * Returns an empty array if no authorization header is present
 */
const parseBasic = (req) => {
  if(req.headers.authorization) {
    // split the value of the header "Basic lwjkjvljk"
    const [ _, value ] = req.headers.authorization.split(" ")
    // decode base64 string into binary values in a buffer
    const buff = Buffer.from(value, 'base64')
    // convert the buffer into string and split user:pass
    return buff.toString().split(":")
  }
  return []
}

/* simple encapsulation of responding with Basic authentication request */
const promptForAuth = (res) => {
  res.writeHead(401, {
    "WWW-Authenticate": "Basic"
  })
  res.end()
}

/* helper function to produce a hash of some string */
const sha256 = (content) => crypto.createHash("sha256")
   .update(content).digest("hex");

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
        body.id = lastId++;
        // record creator
        body.who = user;
        listOfThings.push(body);
        // update on-disk copy
        fs.writeFile("things.json", JSON.stringify(listOfThings, null, 2))
        res.writeHead(201)
      })
      .catch(() => res.writeHead(400))
      .finally(() => res.end())
    }
  } else if(req.method === "PUT") {
    const user = authenticate(req,res)
    if(user) {
      getBody(req).then(body => {
        const idx = listOfThings.findIndex(t => t.id === body.id)
        body.who = user;
        listOfThings[idx] = body
        fs.writeFile("things.json", JSON.stringify(listOfThings, null, 2))
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
        listOfThings = listOfThings.filter(
          t => t.id != match[1]
        )
        fs.writeFile("things.json", JSON.stringify(listOfThings, null, 2))
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
      listOfThings
    ))
    res.end()
  }
}

// create the server and provide it the handler
const server = http.createServer(requestHandler);

// initialize data structure from disk
fs.readFile("things.json")
  // first just read in the array
  .then(things => listOfThings = JSON.parse(things))
  // the next two lines finds the biggest id in the array
  .then(things => things.map(t => t.id))
  .then(ids => Math.max(...ids))
  // initialize our id counter to avoid conflicting ids
  .then(maxid => lastId = maxid + 1)
  .catch(() => listOfThings = [])
  // now that we're initialized, instruct server to listen on TCP port 3000
  .finally(() => server.listen(3000))
