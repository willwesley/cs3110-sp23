#!/usr/bin/env node

const locallydb = require("locallydb")
const db = new locallydb("./mydb")
const things = db.collection("nope")
const users = db.collection("users")

// import http and helpers
const http = require("http");
const getBody = require("./httpHelpers")
const { parseBasic, promptForAuth, sha256 } = require("./authHelpers")

if(users.items.length === 0) {
  // no users? first run probably, let's addd a default account
  users.insert({
    user: "chuck",
    password: sha256("password"),
    admin: true,
  });
}

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

/* our authentication mechanism proper. returns username if the request contains the Basic
 * authorization header containg a username and password found in users. Otherwise it
 * prompts for a username and password by sending the appropriate headers and response code
 * to the browser and returns false
 */
const authenticate = (req, res) => {
  const [user, pass] = parseBasic(req)
  if(user && pass && users.where({ user, password: sha256(pass) }).items.length > 0) {
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
  // handle amdinistration things
  if(req.url.indexOf("users") !== -1) {
    const user = authenticate(req,res)
    // checking for authentication and authorization
    if(user && users.where({ user }).items[0].admin) {
      if(req.method === "POST") {
        getBody(req).then(body => {
          users.insert({
            user: body.user,
            password: body.pass,
            admin: !!body.admin
          })
          users.save()
          // redirect to the admin page, since we're not ajaxing this
          res.writeHead(301, {
            Location: "/admin.html"
          })
        })
        .catch(() => res.writeHead(400))
        .finally(() => res.end())
      } else if(req.method === "PUT") {
        getBody(req).then(body => {
          const match = req.url.match(/\/api\/users\/(\d+)/)
          if(match && match[1]) {
            // if no password provided, use existing one
            const password = body.pass ? sha256(body.pass) : undefined
            // save the user
            users.update(match[1]*1, {
              user: body.user,
              password,
              admin: !!body.admin
            })
            users.save()
            res.writeHead(200)
          } else {
            throw "poo"
          }
        })
        .catch(() => res.writeHead(400))
        .finally(() => res.end())
      } else if(req.method === "DELETE") {
        // remove user is a whole lot like remove from listOfThings
        // we match on /api/users/<cid>
        const match = req.url.match(/\/api\/users\/(\d+)/)
        if(match && match[1]) {
          users.remove(1*match[1])
          users.save()
          res.writeHead(200)
          res.end()
        } else {
          res.writeHead(400)
          res.end()
        }
      } else {
        res.writeHead(200)
        // we really shouldn't send passwords to the front
        // even if they're hashed.
        res.write(JSON.stringify(
          users.items.map(u => ({ ...u, password: undefined }))
        ))
        res.end()
      }
    } else {
      // if we're here, either unauthenticated or unauthorized
      // either way, they belong on the main page, not admin
      res.writeHead(301, {
        Location: "/"
      })
      res.end()
    }
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
      const match = req.url.match(/\/api\/(\d+)/)
      if(match && match[1]) {
        // remove an item by cid, again note the coercion.
        things.remove(1*match[1])
        // make sure this change is written
        things.save()
        notify()
        res.writeHead(200)
        res.end()
      } else {
        res.writeHead(400)
        res.end()
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

