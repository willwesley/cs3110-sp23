#!/usr/bin/env node

const locallydb = require("locallydb")
const db = new locallydb("./mydb")
const things = db.collection("nope")
const users = db.collection("users")

const http = require("http");
const { handleDelete, getBody } = require("./httpHelpers")
const { authenticate, userController } = require("./authHelpers")

let subscribers = [];
const notify = () => {
  const payload = JSON.stringify(things.items)
  subscribers.forEach(([req, res]) => {
    if(req.headers.accept === "text/event-stream") {
      res.write("data: " + payload + "\n\n")
    } else {
      res.write(payload)
      res.end()
    }
  })
};

/* http request handler (router and dispatcher)
 * @param req {http.request} the request object
 * @param res {http.response} the object for sending a response
 */
const requestHandler = (req, res) => {
  // handle amdinistration things
  if(req.url.indexOf("users") !== -1) {
    userController(req, res)
  } else if(req.url === "/api/subscribe") {
    if(req.headers.accept === "text/event-stream") {
      res.writeHead(200, {
        'Content-Type': "text/event-stream",
        'Connection': "keep-alive",
        'Cache-Control': "no-cache",
        "X-Accel-Buffering": "no",
      })
    }
    const i = Math.random()
    subscribers.push([req, res, i])
    req.on("close", () => subscribers = subscribers.filter(
      ([req, res, j]) => i !== j))
  } else if(req.method === "POST") {
    // check for auth
    const user = authenticate(req,res)
    // if authed, do the thing
    if(user) {
      getBody(req).then(body => {
        body.who = user;
        // insert the thing into the things collection
        things.insert(body)
        notify()
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
        // update an existing thing by cid. Note the coercion of string to number
        things.replace(body.cid*1, body)
        // make sure this change is written
        things.save()
        notify()
        res.writeHead(200)
      })
      .catch(() => res.writeHead(400))
      .finally(() => res.end())
    }
  } else if(req.method === "DELETE") {
    const user = authenticate(req,res)
    if(user) {
      if(handleDelete(req, res, /\/api\/(\d+)/, things)) {
        notify()
      }
    }
  } else {
    res.writeHead(200, {
      "Content-Type": "application/json",
    })
    // neat, almost just like the in-memory version! (because it is)
    res.write(JSON.stringify(
      things.items 
    ))
    res.end()
  }
}

const server = http.createServer(requestHandler);
server.listen(3000)
