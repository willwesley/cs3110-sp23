#!/usr/bin/env node

const locallydb = require("locallydb")
const db = new locallydb("./mydb")
const things = db.collection("things")

// import http and helpers
const http = require("http");
const getBody = require("./httpHelpers")
const { parseBasic, promptForAuth, sha256 } = require("./authHelpers")

// data store for users with a default admin account
const users = {
  chuck: {
    password: "f52fbd32b2b3b86ff88ef6c490628285f482af15ddcb29541f94bcf526a3f6c7",
    admin: true
  }
};

/* our authentication mechanism proper. returns username if the request contains the Basic
 * authorization header containg a username and password found in users. Otherwise it
 * prompts for a username and password by sending the appropriate headers and response code
 * to the browser and returns false
 */
const authenticate = (req, res) => {
  const [user, pass] = parseBasic(req)
  if(users[user] && sha256(pass) === users[user].password) {
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
    if(user && users[user].admin) {
      // probably *shouldn't* combine these, but upsert seems nice
      if(req.method === "POST" || req.method === "PUT") {
        getBody(req).then(body => {
          // if no password provided, use existing one
          // (this is why probably shouldn't combine)
          const password = body.pass ?
              sha256(body.pass) : users[body.user].password
          // save the user
          users[body.user] = {
            password,
            admin: !!body.admin
          }
          // redirect to the admin page, since we're not ajaxing this
          res.writeHead(301, {
            Location: "/admin.html"
          })
        })
        .catch(() => res.writeHead(400))
        .finally(() => res.end())
      } else if(req.method === "DELETE") {
        // remove user is a whole lot like remove from listOfThings
        // we match on /api/users/<any string>
        const match = req.url.match(/\/api\/users\/(.+)/)
        if(match && match[1]) {
          // delete from object is a nicer syntax, I suppose
          delete users[match[1]]
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
        const usersNoP = Object.fromEntries(
          Object.entries(users)
            .map(u => [u[0], { admin: u[1].admin }])
        );
        res.write(JSON.stringify(usersNoP))
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
  } else if(req.method === "POST") {
    // check for auth
    const user = authenticate(req,res)
    // if authed, do the thing
    if(user) {
      getBody(req).then(body => {
        body.who = user;
        // insert the thing into the things collection
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
        // update an existing thing by cid. Note the coercion of string to number
        things.replace(body.cid*1, body)
        // make sure this change is written
        things.save()
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

